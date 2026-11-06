// Shared Game Kit: the conformance suite every GameModule must pass (GAME_KIT.md §5). `npm run game:check -- <slug>`
// runs it for games on the kit. A game supplies a sample (games/<slug>/tests/sample.ts → `sample()`): a week on fake
// nodes, with one round still undecided and one Sunday round if the game has any.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadManifest, ROOT } from "../recorder/manifest.ts";
import type { KitNode } from "../recorder/nodes.ts";

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

/** Things a game's own files must not contain (no network, clock, files, processes, randomness or environment). Every
 *  file the module imports outside kit/ is scanned, not only recorder.ts (KC-12). */
export const FORBIDDEN: [RegExp, string][] = [
  [/\bfrom\s+["']node:/, "imports a Node built-in (files, network, processes, crypto)"],
  [/\bimport\s+["']node:/, "imports a Node built-in"],
  [/\bfrom\s+["'](?![./])/, "imports a package (only the game's own files and kit/ are allowed)"],
  [/\bimport\s*\(/, "imports dynamically"],
  [/\brequire\s*\(|\bcreateRequire\b|\bmodule\.require\b/, "uses require"],
  [/\bprocess\b/, "touches process (environment, clock, exit)"],
  [/\bnew\s+Date\s*(\(\s*\)|(?!\s*\())/, "reads the clock (new Date with no argument; use ctx.now)"],
  [/\bDate\s*\.\s*now\b|\bDate\s*\(\s*\)/, "reads the clock (use ctx.now)"],
  [/\bperformance\b|\bhrtime\b/, "reads a timer"],
  [/\bIntl\b/, "uses Intl (time zones, the clock's locale)"],
  [/\bMath\s*\.\s*random\b|\bcrypto\b|\bgetRandomValues\b|\brandomUUID\b/, "uses randomness or crypto"],
  [/\bfetch\b|\bXMLHttpRequest\b|\bWebSocket\b/, "uses the network"],
  [/\b(writeFile|appendFile|mkdir|rmSync|unlink|createWriteStream)\w*\b/, "writes files"],
  [/\bWorker\b|\bspawn\b|\bexec(Sync|File)?\b/, "starts workers or processes"],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, "evaluates code"],
  [/\bglobalThis\b|\bself\b\s*\./, "reaches the global object"],
  [/\b(signTransaction|sendTransaction|PrivateKey|WIF)\b|\.sign\(|\.send\(/, "signs or sends"],
];

export function staticChecks(source: string): Check[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");   // comments don't count
  return FORBIDDEN.map(([re, why]) => ({ pass: !re.test(code), msg: `must not: ${why}` }));
}

/** Every file the module imports, outside kit/, by relative path (recursively). */
export function moduleFiles(entry: string, root: string): string[] {
  const kitDir = path.join(root, "kit") + path.sep, realKit = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..") + path.sep;
  const seen = new Set<string>(), todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const p = path.resolve(path.dirname(f), m[1]);
      if (p.startsWith(kitDir) || p.startsWith(realKit)) continue;
      if (fs.existsSync(p)) todo.push(p);
    }
  }
  return [...seen].sort();
}

/** Runs the module in a child process under Node's permission model, with every trap set (conformance-child.ts). */
export function sandboxed(slug: string, root: string): { violations: string[]; checks: Check[]; error?: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kit-conf-sbx-"));
  const child = path.join(path.dirname(new URL(import.meta.url).pathname), "conformance-child.ts");
  const r = spawnSync(process.execPath, [
    "--experimental-permission", "--allow-fs-read=*", `--allow-fs-write=${tmp}/*`, "--allow-worker",
    "--no-warnings", "--import", "tsx", child, slug, root,
  ], { encoding: "utf8", env: { PATH: process.env.PATH ?? "", TMPDIR: tmp, HOME: tmp, NODE_OPTIONS: "" }, timeout: 120000 });
  fs.rmSync(tmp, { recursive: true, force: true });
  const line = (r.stdout ?? "").trim().split("\n").pop() ?? "";
  try { return JSON.parse(line); } catch { return { violations: [], checks: [], error: `the sandbox didn't finish (exit ${r.status}): ${(r.stderr ?? "").trim().split("\n").slice(-3).join(" / ").slice(0, 300)}` }; }
}

export async function conformance(slug: string, root = ROOT): Promise<Check[]> {
  const res: Check[] = [];
  const ok = (pass: boolean, msg: string) => res.push({ pass, msg });
  const dir = path.join(root, "games", slug);
  for (const f of moduleFiles(path.join(dir, "recorder.ts"), root)) {
    const rel = path.relative(root, f);
    for (const c of staticChecks(fs.readFileSync(f, "utf8"))) ok(c.pass, `${rel}: ${c.msg}`);
  }
  loadManifest(slug, root);
  if (!fs.existsSync(path.join(dir, "tests", "sample.ts"))) { ok(false, "tests/sample.ts exists (a sample week for the conformance suite)"); return res; }
  // The module itself runs ONLY in the sandbox (KC-12): its top-level code, roundsFor, resultOf and scoreRound twice
  // each, then the sample week hour by hour through the real publish check, with every clock, randomness, environment,
  // file and process entry point trapped. This process never imports it.
  const sb = sandboxed(slug, root);
  if (sb.error) ok(false, sb.error);
  ok(sb.violations.length === 0, `the module never touches the clock, randomness, the network or the environment${sb.violations.length ? ` (it used ${sb.violations.join(", ")})` : ""}`);
  for (const c of sb.checks) ok(c.pass, c.msg);
  return res;
}

export async function runConformance(slug: string): Promise<boolean> {
  const res = await conformance(slug);
  for (const r of res) console.log(`${r.pass ? "✔" : "✖"} conformance: ${r.msg}`);
  return res.every((r) => r.pass);
}
