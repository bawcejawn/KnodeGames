// Shared Game Kit: the conformance suite every GameModule must pass (GAME_KIT.md §5). `npm run game:check -- <slug>`
// runs it for games on the kit. A game supplies a sample (games/<slug>/tests/sample.ts → `sample()`): a week on fake
// nodes, with one round still undecided and one Sunday round if the game has any.
import fs from "node:fs";
import path from "node:path";
import { canon, isSunday } from "../publish/check.inline.mjs";
import { kitConfig, loadManifest, ROOT } from "../recorder/manifest.ts";
import { PENDING, type GameModule } from "../recorder/types.ts";
import type { KitNode } from "../recorder/nodes.ts";
import { Replay } from "./replay.ts";

export type Sample = {
  /** The vault week the sample plays. */
  week: number;
  /** The two nodes at chain time t (the same world on both). */
  nodes(t: number): [KitNode, KitNode];
  /** Optional: a source override for games whose source isn't wired yet. */
  source?: Parameters<typeof import("../recorder/runtime.ts").runGame>[2]["source"];
  /** Round ids that are undecided at the sample's first hour (must come back PENDING, never a guess). */
  undecided: string[];
  /** Chain times for the hourly runs (first one before every round is decided, then until final). */
  hours: { chain: (i: number) => number; job: (i: number) => number; count: number; decideAfter: number; decide(): void };
};

export type Check = { pass: boolean; msg: string };

/** Things a module's source must not contain (no network, clock, files, randomness or environment). */
export const FORBIDDEN: [RegExp, string][] = [
  [/from\s+["']node:(fs|net|http|https|child_process|dgram|worker_threads|os)["']/, "imports a node module that reaches files, the network or processes"],
  [/from\s+["'](fs|net|http|https|child_process|koilib|axios|node-fetch)["']/, "imports files, the network or a chain client"],
  [/\bprocess\s*\.\s*env\b/, "reads environment variables"],
  [/\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(\s*\)/, "reads the clock (use ctx.now)"],
  [/\bMath\s*\.\s*random\s*\(/, "uses randomness"],
  [/\bfetch\s*\(/, "uses the network"],
  [/\b(writeFile|appendFile|mkdir|rmSync|unlink)\w*\s*\(/, "writes files"],
  [/\b(signTransaction|sendTransaction|\.sign\(|\.send\(|PrivateKey|WIF)\b/, "signs or sends"],
];

export function staticChecks(source: string): Check[] {
  return FORBIDDEN.map(([re, why]) => ({ pass: !re.test(source), msg: `must not: ${why}` }));
}

/** Runs fn with the clock, randomness, network and environment trapped: any use throws. */
export async function trapped<T>(fn: () => Promise<T> | T): Promise<T> {
  const g: any = globalThis;
  const saved = { now: Date.now, random: Math.random, fetch: g.fetch, env: process.env };
  const trap = (what: string) => () => { throw new Error(`conformance: the module used ${what}`); };
  Date.now = trap("Date.now") as any;
  Math.random = trap("Math.random") as any;
  g.fetch = trap("fetch");
  (process as any).env = new Proxy({}, { get: (_t, k) => { if (typeof k === "string") throw new Error(`conformance: the module read process.env.${k}`); return undefined; } });
  try { return await fn(); } finally { Date.now = saved.now; Math.random = saved.random; g.fetch = saved.fetch; (process as any).env = saved.env; }
}

export async function conformance(slug: string, root = ROOT): Promise<Check[]> {
  const res: Check[] = [];
  const ok = (pass: boolean, msg: string) => res.push({ pass, msg });
  const dir = path.join(root, "games", slug);
  const src = fs.readFileSync(path.join(dir, "recorder.ts"), "utf8");
  for (const c of staticChecks(src)) ok(c.pass, `recorder.ts: ${c.msg}`);
  const m = loadManifest(slug, root);
  const cfg = kitConfig(m);
  const mod: GameModule<any, any, any> = (await import(path.join(dir, "recorder.ts"))).game;
  ok(!!mod && mod.slug === m.slug, `recorder.ts exports game with slug "${m.slug}"`);
  const want = { vault: "vault-answers", picks: "picks-contract", racepicks: "race-picks", none: "none" } as Record<string, string>;
  ok(mod.picks?.source === want[m.picks.contract], `picks.source matches game.json picks.contract (${m.picks.contract} → ${want[m.picks.contract]})`);
  const samplePath = path.join(dir, "tests", "sample.ts");
  if (!fs.existsSync(samplePath)) { ok(false, "tests/sample.ts exists (a sample week for the conformance suite)"); return res; }
  const sample: Sample = (await import(samplePath)).sample();
  const t0 = sample.hours.chain(0);
  const span = { week: sample.week, start: cfg.genesis + sample.week * cfg.weekMs, end: cfg.genesis + (sample.week + 1) * cfg.weekMs };

  // Purity and determinism on the sample's inputs (read through the kit's source, as the runtime would).
  const [na] = sample.nodes(t0);
  const read = sample.source ? await sample.source(na, sample.week) : null;
  const inputs = read?.inputs ?? (mod.picks.source === "vault-answers" ? (await (await import("../recorder/sources/vault-answers.ts")).readVaultAnswers(na.vault, sample.week)).inputs : undefined);
  let rounds: any[] = [];
  try {
    rounds = await trapped(() => mod.roundsFor(span, { now: t0, inputs }));
    const again = await trapped(() => mod.roundsFor(span, { now: t0, inputs }));
    ok(canon(rounds) === canon(again), "roundsFor is deterministic");
    ok(rounds.every((r) => r.day % 86400000 === 0 && r.day >= span.start && r.day < span.end), "every round's day is a UTC day inside the week");
  } catch (e) { ok(false, `roundsFor runs without clock, network, randomness or environment (${(e as Error).message})`); }
  try {
    for (const id of sample.undecided) {
      const r = rounds.find((x) => x.id === id);
      const v = r ? await trapped(() => mod.resultOf(r, na.vault, inputs)) : null;
      ok(v === PENDING, `resultOf(${id}) is PENDING while undecided (never a guess)`);
    }
  } catch (e) { ok(false, `resultOf runs without clock, network, randomness or environment (${(e as Error).message})`); }

  // End to end on fake nodes, hour by hour, through the real publish check.
  const rp = new Replay(mod, cfg);
  let finalAt = -1, vaultAt = -1, funOk = true, sawSunday = false;
  for (let i = 0; i < sample.hours.count; i++) {
    if (i === sample.hours.decideAfter) sample.hours.decide();
    const h = await rp.hour(sample.nodes(sample.hours.chain(i)), sample.hours.job(i));
    if (h.error) { ok(false, `hour ${i}: the recorder stopped (${h.error})`); break; }
    if (h.held.some((x) => x.alert)) { ok(false, `hour ${i}: the publish check held ${h.held.filter((x) => x.alert).map((x) => `${x.name} (${x.why})`).join(", ")}`); break; }
    const wf = rp.read(`W${String(sample.week).padStart(3, "0")}.json`);
    for (const r of wf?.rounds ?? []) { if (isSunday(r[1])) sawSunday = true; if (r[2] !== (cfg.sundayFunRound && isSunday(r[1]) ? 1 : 0)) funOk = false; }
    if (wf?.state === "final" && finalAt < 0) finalAt = i;
    if (rp.read(`vault/W${sample.week}.json`) && vaultAt < 0) vaultAt = i;
  }
  ok(funOk, `Sunday rounds are tagged as fun rounds (D-129)${sawSunday ? "" : " (the sample has no Sunday round)"}`);
  ok(finalAt >= 0, "the sample week goes final on fake nodes through the real publish check");
  ok(vaultAt >= 0, "its vault file is published");
  return res;
}

export async function runConformance(slug: string): Promise<boolean> {
  const res = await conformance(slug);
  for (const r of res) console.log(`${r.pass ? "✔" : "✖"} conformance: ${r.msg}`);
  return res.every((r) => r.pass);
}
