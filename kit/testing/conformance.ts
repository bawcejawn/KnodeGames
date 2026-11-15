// Shared Game Kit: the conformance suite every GameModule must pass (GAME_KIT.md §5). `npm run game:check -- <slug>`
// runs it for games on the kit. A game supplies a sample (games/<slug>/tests/sample.ts → `sample()`): a week on fake
// nodes, with one round still undecided and one Sunday round if the game has any.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  /** Ruler games (manifest vhpData): a VHP ruler ledger for the sample week (e.g. KRuler.ledger over a made-up timeline,
   *  as tests/audit/race-ruler.fixture.mjs builds one). The conformance run hands it to resultOf / inputsFor as ctx.vhp
   *  and the publish check's card rebuild uses it too. */
  vhpLedger?: unknown;
  /** Optional: the chain time of the "decided rounds to score" checks, when hour 0 can't be it (an inputs-file game's
   *  hour 0 is before the week, when the inputs file is made, so no round is decided yet). Default: hours.chain(0). */
  checkAt?: number;
  /** Round ids that are undecided at the sample's first hour (must come back PENDING, never a guess). */
  undecided: string[];
  /** Chain times for the hourly runs (first one before every round is decided, then until final). */
  hours: { chain: (i: number) => number; job: (i: number) => number; count: number; decideAfter: number; decide(): void };
};

export type Check = { pass: boolean; msg: string };

const HERE = path.dirname(fileURLToPath(import.meta.url));   // a real path on Windows too (never URL.pathname)

/** Things a game's own files must not contain (no network, clock, files, processes, randomness or environment). Every
 *  file the module imports outside kit/ is scanned, not only recorder.ts (KC-12). */
/** Rules marked `true` read the strings too: module names, and a key written as a string ("constructor"). */
export const FORBIDDEN: [RegExp, string, true?][] = [
  [/\bfrom\s+["']node:/, "imports a Node built-in (files, network, processes, crypto)", true],
  [/\bimport\s+["']node:/, "imports a Node built-in", true],
  [/\bfrom\s+["'](?![./])/, "imports a package (only the game's own files and kit/ are allowed)", true],
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
  [/\beval\b|\bnew\s+Function\b|\bFunction\s*\(/, "evaluates code"],
  // The clock and randomness objects may only be used in place (#E-24 NE-1): new Date(<arg>), Date.UTC, Date.parse,
  // a type annotation, and Math's pure functions and constants. Never aliased, passed by reference or read by brackets.
  [/(?<!:\s*|\binstanceof\s+|\bnew\s+)\bDate\b(?!\s*\.\s*(UTC|parse)\b)|\bnew\s+Date\b(?!\s*\()/, "uses Date other than new Date(<time>), Date.UTC or Date.parse (aliasing it, passing it on or reading it by brackets reaches the clock)"],
  [/\bMath\b(?!\s*\.\s*(abs|floor|ceil|round|trunc|min|max|pow|sqrt|cbrt|sign|log|log2|log10|log1p|exp|expm1|hypot|imul|clz32|fround|sin|cos|tan|atan2?|PI|E|LN2|LN10|SQRT2)\b)/, "uses Math other than its pure functions (aliasing it, passing it on or reading it by brackets reaches Math.random)"],
  // (`window` doesn't exist in Node, so a game may name things "window": #E-26 NE-8. Words inside strings are fine.)
  [/\bglobalThis\b|\bglobal\b|\bself\b\s*\./, "reaches the global object (globalThis, global, self: #E-25 NE-3)"],
  // A member key built at run time out of string pieces ("con" + "structor", a template) is how the other rules are
  // got around (#E-26 NE-4). The sandbox denies the clock whatever the route; this keeps the usual spelling out too.
  [/(?<=[\w$)\]]\s*)\[\s*(["'`][^\]]*\+|[^\]]*\+\s*["'`]|`[^`\]]*\$\{)/, "builds a property name at run time out of strings"],
  [/\bstackTraceLimit\b|\bprepareStackTrace\b|\bcaptureStackTrace\b/, "changes how stack traces work (the sandbox reads them, NK-6)"],
  [/\.\s*constructor\b|\[\s*["'`]constructor["'`]\s*\]|\bgetPrototypeOf\b|__proto__/, "reaches a constructor or prototype (a way around the trapped clock, NK-6)", true],
  [/\bgetBuiltinModule\b|\bworker_threads\b|\bchild_process\b/, "reaches Node's modules at run time"],
  [/\b(signTransaction|sendTransaction|PrivateKey|WIF)\b|\.sign\(|\.send\(/, "signs or sends"],
];

/** Reads JavaScript / TypeScript source the way the language does, in one pass (Repo Lens #F-2 F2-5): comments,
 *  strings, templates (with their ${…} code) and regex literals. Returns the source twice:
 *  - `code`: comments removed, everything else as written (a "//" inside a string or a regex stays);
 *  - `bare`: the same, with the text of every string, template and regex blanked (quotes, slashes and ${…} code kept),
 *    so an ordinary word in a string ("the pick window", "global leaderboard") never trips a rule about code (NE-8).
 *  A "/" starts a regex where an expression can start (after an operator, an opening bracket, a comma, at the start, or
 *  after a keyword like `return`); anywhere else it is division. */
export function readSource(source: string): { code: string; bare: string } {
  let code = "", bare = "", i = 0;
  const KEYWORDS = new Set(["return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "yield", "await", "instanceof"]);
  const emit = (t: string, keep: boolean) => { code += t; if (keep) bare += t; };
  const regexCanStart = () => {
    const t = code.replace(/\s+$/, "");
    if (t === "" || /[(,=:[!&|?{};+\-*%<>~^]$/.test(t)) return true;
    const w = /([A-Za-z_$][\w$]*)$/.exec(t)?.[1];
    return !!w && KEYWORDS.has(w);
  };
  // Code, until the "}" that closes a template's ${…} (when inTemplate) or the end of the source.
  const readCode = (inTemplate: boolean) => {
    let depth = 0;
    while (i < source.length) {
      const c = source[i], n = source[i + 1];
      if (c === "/" && n === "/") { while (i < source.length && source[i] !== "\n") i++; continue; }
      if (c === "/" && n === "*") { const e = source.indexOf("*/", i + 2); i = e < 0 ? source.length : e + 2; emit(" ", true); continue; }
      if (c === '"' || c === "'") {
        emit(c, true); i++;
        while (i < source.length && source[i] !== c && source[i] !== "\n") { const k = source[i] === "\\" ? 2 : 1; emit(source.slice(i, i + k), false); i += k; }
        if (i < source.length && source[i] === c) { emit(c, true); i++; }
        continue;
      }
      if (c === "`") { readTemplate(); continue; }
      if (c === "/" && regexCanStart()) {
        emit("/", true); i++;
        let cls = false;
        while (i < source.length && source[i] !== "\n") {
          if (source[i] === "\\") { emit(source.slice(i, i + 2), false); i += 2; continue; }
          if (source[i] === "/" && !cls) break;
          if (source[i] === "[") cls = true; else if (source[i] === "]") cls = false;
          emit(source[i], false); i++;
        }
        if (source[i] === "/") { emit("/", true); i++; }
        continue;
      }
      if (inTemplate && c === "{") depth++;
      if (inTemplate && c === "}") { if (depth === 0) return; depth--; }
      emit(c, true); i++;
    }
  };
  const readTemplate = () => {
    emit("`", true); i++;
    while (i < source.length && source[i] !== "`") {
      if (source[i] === "\\") { emit(source.slice(i, i + 2), false); i += 2; continue; }
      if (source[i] === "$" && source[i + 1] === "{") {
        emit("${", true); i += 2;
        readCode(true);
        if (source[i] === "}") { emit("}", true); i++; }
        continue;
      }
      emit(source[i], false); i++;
    }
    if (source[i] === "`") { emit("`", true); i++; }
  };
  readCode(false);
  return { code, bare };
}

/** The source with the text of every string, template and regex blanked (see readSource). */
export const blankStrings = (source: string) => readSource(source).bare;

export function staticChecks(source: string): Check[] {
  const { code, bare } = readSource(source);   // comments don't count; strings, templates and regexes are known
  return FORBIDDEN.map(([re, why, raw]) => ({ pass: !re.test(raw ? code : bare), msg: `must not: ${why}` }));
}

/** How tsx resolves a relative import: the path as written, a .js/.mjs/.cjs written for a .ts/.mts/.cts file, the path
 *  with an extension added, or a folder's index file (#B-12 NK-5). null when none exists. */
export function resolveLikeTsx(from: string, spec: string): string | null {
  const p = path.resolve(path.dirname(from), spec);
  const isFile = (f: string) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
  const swap: Record<string, string[]> = { ".js": [".ts", ".tsx"], ".jsx": [".tsx"], ".mjs": [".mts"], ".cjs": [".cts"] };
  const ext = path.extname(p);
  const tries = [p, ...(swap[ext] ?? []).map((e) => p.slice(0, -ext.length) + e)];
  for (const e of [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]) tries.push(p + e);
  for (const e of [".ts", ".tsx", ".mts", ".js", ".mjs"]) tries.push(path.join(p, "index" + e));
  return tries.find(isFile) ?? null;
}

/** The kit files a game may import: its types, the clock helpers and the shared sources (Repo Lens #F-2 F2-3). */
export const GAME_IMPORTS = [/^recorder\/types\.ts$/, /^recorder\/clock\.ts$/, /^recorder\/sources\/[A-Za-z0-9-]+\.ts$/];
const GAME_IMPORTS_TEXT = "kit/recorder/types.ts, kit/recorder/clock.ts and kit/recorder/sources/*";

/** Every file the module imports, outside kit/, by relative path (recursively), resolved the way tsx does. A relative
 *  import that resolves to nothing throws: a file the scan can't find is a file it can't check (NK-5). */
export function moduleFiles(entry: string, root: string): string[] {
  const kitDir = path.join(root, "kit") + path.sep, realKit = path.resolve(HERE, "..") + path.sep;
  const seen = new Set<string>(), todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+|\.{1,2}|\/[^"']+)["']/g)) {
      const p = resolveLikeTsx(f, m[1]);
      if (!p) throw new Error(`${path.relative(root, f)} imports "${m[1]}", which resolves to no file`);
      if (p.split(path.sep).includes("node_modules")) throw new Error(`${path.relative(root, f)} imports "${m[1]}" from a node_modules folder: a game's files can't live there (#E-26 NE-5)`);
      const kit = p.startsWith(kitDir) ? kitDir : p.startsWith(realKit) ? realKit : "";
      if (kit) {
        // A game may use only the kit's game-facing files (Repo Lens #F-2 F2-3): never the runtime, the node readers and
        // their budget clock, the publish check or the test harness.
        const rel = path.relative(kit, p).split(path.sep).join("/");
        if (!GAME_IMPORTS.some((re) => re.test(rel))) throw new Error(`${path.relative(root, f)} imports kit/${rel}: a game may import only ${GAME_IMPORTS_TEXT} from kit/`);
        continue;
      }
      todo.push(p);
    }
  }
  return [...seen].sort();
}

/** The permission model's flag on this Node: --permission (Node 24, and 22.13+), else --experimental-permission. */
export const permissionFlag = () => (process.allowedNodeEnvironmentFlags.has("--permission") ? "--permission" : "--experimental-permission");

let cpNeeded: boolean | undefined;
/** Does tsx need --allow-child-process on this Node? Asked once per process, of a canary that loads one kit file
 *  (kit/testing/fake-clock.ts) and no game code, under the sandbox's own flags (Repo Lens #F-2 F2-1). */
function childProcessNeeded(perm: string, reads: string[], tmp: string): boolean {
  if (cpNeeded !== undefined) return cpNeeded;
  const canary = path.join(HERE, "fake-clock.ts");
  const ok = (extra: string[]) => spawnSync(process.execPath, [perm, ...reads, `--allow-fs-write=${path.join(tmp, "*")}`, "--allow-worker", ...extra, "--no-warnings", "--import", "tsx", canary],
    { encoding: "utf8", env: sandboxEnv(tmp), timeout: 120000 }).status === 0;
  cpNeeded = !ok([]) && ok(["--allow-child-process"]);
  return cpNeeded;
}
const sandboxEnv = (tmp: string) => ({ PATH: process.env.PATH ?? "", TMPDIR: tmp, TEMP: tmp, TMP: tmp, HOME: tmp, USERPROFILE: tmp, NODE_OPTIONS: "", SystemRoot: process.env.SystemRoot ?? "" });

/** Runs the module in a child process under Node's permission model, with every trap set (conformance-child.ts). */
export function sandboxed(slug: string, root: string): { violations: string[]; checks: Check[]; error?: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kit-conf-sbx-"));
  const child = path.join(HERE, "conformance-child.ts");
  // Reads only inside the repo, the game's root and the temp folder: never /proc (the parent's environment), the home
  // folder or the rest of the machine (NK-5). Workers stay allowed for tsx's loader, but the game can't start one.
  const repo = path.resolve(HERE, "../..");
  const reads = [...new Set([repo, path.resolve(root), tmp])].map((d) => `--allow-fs-read=${path.join(d, "*")}`);
  // tsx looks for package.json and tsconfig.json in every folder above a file: those two names only.
  for (const top of [repo, path.resolve(root)]) for (let d = path.dirname(top); ; d = path.dirname(d)) {
    for (const f of ["package.json", "tsconfig.json"]) reads.push(`--allow-fs-read=${path.join(d, f)}`);
    if (d === path.dirname(d)) break;
  }
  // Node 24 names the permission model --permission (Node 22 still takes --experimental-permission); use whichever this
  // Node knows (#E-26: on the owner's Windows Node 24 the old name stopped every run).
  const perm = permissionFlag();
  const run = (extra: string[]) => spawnSync(process.execPath, [
    perm, ...reads, `--allow-fs-write=${path.join(tmp, "*")}`, "--allow-worker", ...extra,
    "--no-warnings", "--import", "tsx", child, slug, root,
  ], { encoding: "utf8", env: sandboxEnv(tmp), timeout: 120000 });
  const r = run(childProcessNeeded(perm, reads, tmp) ? ["--allow-child-process"] : []);
  // Whether this Node's loader needs --allow-child-process (#E-26 NE-7) is decided before any game code runs, by a canary
  // that loads one kit file and no game, under the same flags: a game can never ask for it by failing (#F-2 F2-1), and it
  // runs exactly once. Even with the flag, every child_process function is trapped and denied for the game.
  fs.rmSync(tmp, { recursive: true, force: true });
  const line = (r.stdout ?? "").trim().split("\n").pop() ?? "";
  try { return JSON.parse(line); } catch { return { violations: [], checks: [], error: `the sandbox didn't finish (exit ${r.status}): ${(r.stderr ?? "").trim().split("\n").slice(-3).join(" / ").slice(0, 300)}` }; }
}

export async function conformance(slug: string, root = ROOT): Promise<Check[]> {
  const res: Check[] = [];
  const ok = (pass: boolean, msg: string) => res.push({ pass, msg });
  const dir = path.join(root, "games", slug);
  let files: string[] = [];
  try { files = moduleFiles(path.join(dir, "recorder.ts"), root); } catch (e) { ok(false, `every file the module imports can be scanned (${(e as Error).message})`); }
  for (const f of files) {
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
