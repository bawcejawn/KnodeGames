// The conformance suite (GAME_KIT.md §5) passes the kit-example fixture end to end, and catches a module that reads
// the clock, randomness, the network or the environment, writes files, starts processes, or guesses a result it hasn't
// seen — in recorder.ts or any file it imports, at import time or in any function (Repo Lens #B-11 KC-12).
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { conformance, staticChecks, moduleFiles } from "../testing/conformance.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

const KIT = path.resolve(EXAMPLE_ROOT, "../..");

test("conformance: the kit-example fixture passes every check, end to end through the publish check", async () => {
  const res = await conformance("kit-example", EXAMPLE_ROOT);
  assert.deepEqual(res.filter((r) => !r.pass).map((r) => r.msg), []);
  assert.ok(res.some((r) => /goes final/.test(r.msg)) && res.some((r) => /PENDING/.test(r.msg)) && res.some((r) => /never touches the clock/.test(r.msg)));
});

test("conformance: forbidden sources are caught statically (each of the reviewer's bypass routes)", () => {
  for (const src of [
    `import fs from "node:fs";`, `import { readFile } from "node:fs/promises";`, `import crypto from "node:crypto";`, `import { Provider } from "koilib";`,
    `const x = process.env.RPC;`, `const t = Date.now();`, `const t = new Date();`, `const t = new Date;`, `const t = Date();`,
    `performance.now()`, `process.hrtime()`, `new Intl.DateTimeFormat()`, `crypto.getRandomValues(a)`, `crypto.randomUUID()`, `Math.random()`,
    `await fetch("https://x")`, `const m = await import("./x.js")`, `const r = createRequire(import.meta.url)`, `require("fs")`,
    `fs.writeFileSync("a", "b")`, `new Worker("x")`, `eval("1")`, `new Function("return 1")`, `globalThis.Date`, `tx.sign(key)`,
  ]) assert.ok(staticChecks(src).some((c) => !c.pass), src);
  for (const ok of [`const d = dayOf(round.locksAt);`, `const t = new Date(round.locksAt).getUTCDay();`, `// Date.now() in a comment`, `/* process.env */ const x = 1;`])
    assert.ok(staticChecks(ok).every((c) => c.pass), ok);
});

/** A copy of the fixture with its paths made absolute, so a variant can live outside the repo. */
function variant(edit: (recorder: string) => string, extra: Record<string, string> = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-conf-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example");
  const rec = path.join(dir, "recorder.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KIT.split(path.sep).join("/")}/`)));
  const sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1)).split(path.sep).join("/")}/`));
  for (const [f, src] of Object.entries(extra)) fs.writeFileSync(path.join(dir, f), src);
  return d;
}
const failures = async (root: string) => (await conformance("kit-example", root)).filter((r) => !r.pass).map((r) => r.msg);

test("conformance: a module that guesses an undecided result fails", async () => {
  const d = variant((s) => s.replace("if (!q || q[1] === 0) return PENDING;", "if (!q) return PENDING; if (q[1] === 0) return 1;"));
  assert.ok((await failures(d)).some((m) => /PENDING/.test(m)));
});

test("conformance: a helper file the module imports is scanned too", async () => {
  const d = variant((s) => s.replace(`const VOID_OUTCOME = 1000;`, `import { VOID_OUTCOME } from "./helper.ts";`), { "helper.ts": `export const VOID_OUTCOME = 1000 + (Date.now() > 0 ? 0 : 1);\n` });
  assert.ok(moduleFiles(path.join(d, "games/kit-example/recorder.ts"), d).some((f) => f.endsWith("helper.ts")));
  assert.ok((await failures(d)).some((m) => /helper\.ts: must not: reads the clock/.test(m)));
});

test("conformance: hidden uses are caught at run time in the sandbox (scoreRound, top-level code), and files can't be written", async () => {
  // Hidden from the static scan by building the names at run time; the sandbox's traps still see them.
  const g = `(0, eval)("this")`;
  const hide = (s: string, code: string) => s.replace("export const game", `${code}\nexport const game`);
  const cases: [string, string, RegExp][] = [
    ["clock in scoreRound", "scoreRound(round, picks, outcome) {", /Date\.now/],
    ["env at import", "", /process\.env/],
    ["randomness at import", "", /Math\.random/],
  ];
  for (const [what, , re] of cases) {
    const d = variant((s) => {
      // Bypass the static scan with property lookups by string (the reviewer's trick), then rely on the sandbox.
      const G = `const G: any = ${g};`;
      if (what === "clock in scoreRound") return hide(s, G).replace("scoreRound(round, picks, outcome) {", `scoreRound(round, picks, outcome) { void G["Da" + "te"]["no" + "w"]();`);
      if (what === "env at import") return hide(s, `${G}\nvoid G["pro" + "cess"]["en" + "v"]["RPC"];`);
      return hide(s, `${G}\nvoid G["Ma" + "th"]["ran" + "dom"]();`);
    });
    const f = await failures(d);
    assert.ok(f.some((m) => re.test(m)), `${what}: ${f.join(" | ")}`);
  }
  // Writing another game's files: the sandbox has no write access outside its own temp folder.
  const d = variant((s) => s.replace("export const game", `const G: any = ${g};\ntry { G["pro" + "cess"].getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(path.join(os.tmpdir(), "kit-conf-forged.json"))}, "{}"); } catch (e) { throw new Error("blocked: " + (e as Error).message); }\nexport const game`));
  try { fs.rmSync(path.join(os.tmpdir(), "kit-conf-forged.json"), { force: true }); } catch {}
  const f = await failures(d);
  assert.ok(!fs.existsSync(path.join(os.tmpdir(), "kit-conf-forged.json")), "the sandbox wrote a file");
  assert.ok(f.length > 0, "a module that writes files fails conformance");
});

test("conformance: the Fantasy-shaped kit-ruler-example passes every check (Picks-contract picks, a carried team, ctx.blockAt, a ruler card per round)", async () => {
  const RULER_ROOT = fileURLToPath(new URL("../testing/example-ruler/", import.meta.url));
  const r = await conformance("kit-ruler-example", RULER_ROOT);
  const bad = r.filter((x) => !x.pass).map((x) => x.msg);
  assert.deepEqual(bad, [], bad.join("\n"));
});
