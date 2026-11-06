// Shared Game Kit: the conformance suite's sandbox (Repo Lens #B-11 KC-12). conformance.ts runs this file in a child
// process under Node's permission model: files readable, writable only in a private temp folder, no child processes.
// Before the module loads, every clock, randomness and environment entry point is trapped; a use counts as a violation
// when the call comes from the game's own files (its folder), so Node's and the kit's own use don't trip it. Then the
// module runs on the sample week: roundsFor, resultOf on both nodes and scoreRound, each twice (determinism).
// Prints one JSON line: { violations: [...], checks: [{ pass, msg }] }.
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [slug, root] = process.argv.slice(2);
const gameDir = path.join(root, "games", slug);
const violations = new Set<string>();
// Every trap asks the stack "is this the game?". The module must not be able to switch that off (#B-12 NK-6): the
// whole stack is kept (no frame limit to hide behind), and stackTraceLimit / prepareStackTrace are frozen before it loads.
const RealError = Error;
Object.defineProperty(RealError, "stackTraceLimit", { value: Infinity, writable: false, configurable: false });
Object.defineProperty(RealError, "prepareStackTrace", { value: undefined, writable: false, configurable: false });
const stackOf = () => { const o: { stack?: string } = {}; RealError.captureStackTrace(o); return String(o.stack ?? ""); };
// The caller that counts is the nearest frame outside this file: a builtin like Array.map in between doesn't hide the
// game; the kit's or Node's own call, made while a game function is further up the stack, isn't the game's.
const SELF = new URL(import.meta.url).pathname;
const inGame = (l: string) => l.includes(gameDir) || l.includes(pathToFileURL(gameDir).href);
const fromGame = () => {
  for (const l of stackOf().split("\n").slice(1)) {
    if (l.includes(SELF)) continue;
    if (/\(node:|at node:/.test(l)) return false;           // Node's own code is the caller (e.g. its source maps)
    if (inGame(l)) return true;
    if (/\(<anonymous>\)|^\s*at [^(]*$|native/.test(l) && !/\.(ts|mts|js|mjs):\d+/.test(l)) continue;   // a builtin in between
    return false;
  }
  return false;
};
function trap<T extends object>(obj: T, key: keyof T & string, what: string) {
  const orig = (obj as any)[key];
  if (typeof orig !== "function") return;
  const fn = function (this: unknown, ...a: unknown[]) {
    if (fromGame()) { violations.add(what); throw new Error(`conformance: the module used ${what}`); }
    return orig.apply(this, a);
  };
  try { (obj as any)[key] = fn; } catch { /* a getter-only property */ }
  if ((obj as any)[key] !== fn) try { Object.defineProperty(obj, key, { value: fn, configurable: true, writable: true }); } catch { /* fixed by Node: the static scan forbids node:crypto */ }
}

// The clock.
const RealDate = Date;
const TrapDate: any = function (this: unknown, ...a: unknown[]) {
  if (!new.target) { if (fromGame()) { violations.add("Date()"); throw new Error("conformance: the module used Date()"); } return RealDate(); }
  if (a.length === 0 && fromGame()) { violations.add("new Date() (the clock)"); throw new Error("conformance: the module used new Date()"); }
  return new (RealDate as any)(...a);
};
TrapDate.prototype = RealDate.prototype;
// (new Date(0)).constructor is the trapped Date too, not a way back to the real one (NK-6).
Object.defineProperty(RealDate.prototype, "constructor", { value: TrapDate, writable: false, configurable: false });
TrapDate.UTC = RealDate.UTC; TrapDate.parse = RealDate.parse;
TrapDate.now = () => { if (fromGame()) { violations.add("Date.now"); throw new Error("conformance: the module used Date.now"); } return RealDate.now(); };
(globalThis as any).Date = TrapDate;
trap(performance, "now", "performance.now");
trap(process, "hrtime", "process.hrtime");
trap(process.hrtime, "bigint", "process.hrtime.bigint");
trap(process, "uptime", "process.uptime");
// Randomness.
trap(Math, "random", "Math.random");
for (const k of ["randomBytes", "randomUUID", "randomInt", "getRandomValues", "randomFillSync", "randomFill"] as const) trap(crypto as any, k, `crypto.${k}`);
syncBuiltinESMExports();
if ((globalThis as any).crypto) for (const k of ["getRandomValues", "randomUUID"]) trap((globalThis as any).crypto, k, `crypto.${k}`);
// The network.
trap(globalThis as any, "fetch", "fetch");
// Workers and processes (NK-5): a worker would run with none of these traps, so the game may not start one, whichever
// way it reaches the module (getBuiltinModule, an eval'd import(): the patched export is what every import sees).
import * as wt from "node:worker_threads";
import cp from "node:child_process";
{
  const RealWorker = (wt as any).Worker;
  const TrapWorker = function (this: unknown, ...a: unknown[]) {
    if (fromGame()) { violations.add("worker_threads.Worker"); throw new Error("conformance: the module started a Worker"); }
    return new RealWorker(...a);
  };
  try { (wt as any).default.Worker = TrapWorker; } catch { /* read-only */ }
  for (const k of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) trap(cp as any, k, `child_process.${k}`);
}
trap(process as any, "getBuiltinModule", "process.getBuiltinModule");
syncBuiltinESMExports();
// The environment (read at import too: the traps are in place before the module loads).
const realEnv = process.env;
(process as any).env = new Proxy(realEnv, {
  get(t, k) { if (typeof k === "string" && fromGame()) { violations.add(`process.env.${k}`); return undefined; } return Reflect.get(t, k); },
  ownKeys(t) { if (fromGame()) violations.add("process.env (listing)"); return Reflect.ownKeys(t); },
});

const checks: { pass: boolean; msg: string }[] = [];
const ok = (pass: boolean, msg: string) => checks.push({ pass, msg });
const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x instanceof Map ? [...x.entries()] : typeof x === "symbol" ? String(x) : x));

try {
  const { kitConfig, loadManifest } = await import("../recorder/manifest.ts");
  const { PENDING } = await import("../recorder/types.ts");
  const { readVaultAnswers } = await import("../recorder/sources/vault-answers.ts");
  const cfg = kitConfig(loadManifest(slug, root));
  const mod = (await import(pathToFileURL(path.join(gameDir, "recorder.ts")).href)).game;   // top-level code runs trapped
  const sample = (await import(pathToFileURL(path.join(gameDir, "tests", "sample.ts")).href)).sample();
  const t0 = sample.hours.chain(0);
  const span = { week: sample.week, start: cfg.genesis + sample.week * cfg.weekMs, end: cfg.genesis + (sample.week + 1) * cfg.weekMs };
  const [na, nb] = sample.nodes(t0);
  const read = sample.source ? await sample.source(na, sample.week, na.vault) : mod.picks.source === "vault-answers" ? await readVaultAnswers(na.vault, sample.week) : null;
  const inputs = read?.inputs;
  const rounds = mod.roundsFor(span, { now: t0, inputs });
  ok(canon(rounds) === canon(mod.roundsFor(span, { now: t0, inputs })), "roundsFor is deterministic");
  let decided = 0;
  for (const r of rounds) {
    const a = await mod.resultOf(r, na.vault, inputs), a2 = await mod.resultOf(r, na.vault, inputs), b = await mod.resultOf(r, nb.vault, inputs);
    if (canon(a) !== canon(a2) || canon(a) !== canon(b)) ok(false, `resultOf(${r.id}) gives the same answer twice and on both nodes`);
    if (sample.undecided.includes(r.id)) ok(a === PENDING, `resultOf(${r.id}) is PENDING while undecided (never a guess)`);
    if (typeof a !== "symbol" && read) {
      decided++;
      const picks = read.picks.get(r.id) ?? [];
      const s1 = mod.scoreRound(r, picks, a, inputs), s2 = mod.scoreRound(r, picks, a, inputs);
      if (canon(s1) !== canon(s2)) ok(false, `scoreRound(${r.id}) is deterministic`);
    }
  }
  ok(decided > 0, "the sample has decided rounds to score");

  const m = loadManifest(slug, root);
  ok(!!mod && mod.slug === m.slug, `recorder.ts exports game with slug "${m.slug}"`);
  const want: Record<string, string> = { vault: "vault-answers", picks: "picks-contract", racepicks: "race-picks", none: "none" };
  ok(mod.picks?.source === want[m.picks.contract], `picks.source matches game.json picks.contract (${m.picks.contract} → ${want[m.picks.contract]})`);

  // End to end on fake nodes, hour by hour, through the real publish check (in this sandbox's own temp folder).
  const { Replay } = await import("./replay.ts");
  const { isSunday } = await import("../publish/check.inline.mjs");
  const rp = new Replay(mod, cfg);
  let finalAt = -1, vaultAt = -1, funOk = true, sawSunday = false;
  for (let i = 0; i < sample.hours.count; i++) {
    if (i === sample.hours.decideAfter) sample.hours.decide();
    const h = await rp.hour(sample.nodes(sample.hours.chain(i)), sample.hours.job(i));
    if (h.error) { ok(false, `hour ${i}: the recorder stopped (${h.error})`); break; }
    if (h.held.some((x: any) => x.alert)) { ok(false, `hour ${i}: the publish check held ${h.held.filter((x: any) => x.alert).map((x: any) => `${x.name} (${x.why})`).join(", ")}`); break; }
    const wf = rp.read(`W${String(sample.week).padStart(3, "0")}.json`);
    for (const r of wf?.rounds ?? []) { if (isSunday(r[1])) sawSunday = true; if (r[2] !== (cfg.sundayFunRound && isSunday(r[1]) ? 1 : 0)) funOk = false; }
    if (wf?.state === "final" && finalAt < 0) finalAt = i;
    if (rp.read(`vault/W${sample.week}.json`) && vaultAt < 0) vaultAt = i;
  }
  ok(funOk, `Sunday rounds are tagged as fun rounds (D-129)${sawSunday ? "" : " (the sample has no Sunday round)"}`);
  ok(finalAt >= 0, "the sample week goes final on fake nodes through the real publish check");
  ok(vaultAt >= 0, "its vault file is published");
} catch (e) {
  ok(false, `the module ran in the sandbox (${(e as Error).message.split("\n")[0]}${(e as any)?.resource ? `: ${(e as any).resource}` : ""})`);
}
process.stdout.write(JSON.stringify({ violations: [...violations], checks }) + "\n");
