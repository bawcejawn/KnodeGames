// Repo Lens #E-26 (fix-check of #E-25 NE-3, PR #210 @ 6dfce391): failing tests for the routes left open.
// They assert the CORRECT behaviour (the full conformance gate, static scan + sandbox, refuses the module), so they
// fail on 6dfce391 and pass once fixed.
//   NE-4: static: `new Date(0)["con" + "structor"]` is the Date function and `(0).toFixed["con" + "structor"]` is
//         Function (the constructor rule only matches the literal spelling, conformance.ts:50).
//         runtime: a kit helper scheduled by the game on a promise it doesn't await (`.then(pool.bind(...))`) has kit
//         frames and no game frame, so fromGame() returns false (conformance-child.ts:43-45).
//   NE-5: a game file under games/<slug>/node_modules/tsx/dist/ is taken for the TypeScript loader
//         (conformance-child.ts:33,42), ahead of the game check.
//   NE-6: the environment keeps the nearest-caller rule, so a kit helper calling Reflect.get on process.env reads it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { conformance } from "../testing/conformance.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

const KIT = path.resolve(EXAMPLE_ROOT, "../..");
const KIT_SRC = KIT.split(path.sep).join("/");   // for import paths written into a game's source (Windows too)
const REPO = path.resolve(KIT, "..");
function variant(edit: (recorder: string) => string, extra: Record<string, string> = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-e26-var-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example"), rec = path.join(dir, "recorder.ts"), sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KIT_SRC}/`)));
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1)).split(path.sep).join("/")}/`));
  for (const [f, src] of Object.entries(extra)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), src); }
  return d;
}
// No forbidden spelling anywhere: Date and Function reached through computed "constructor" keys.
const REACH = `const D: any = new Date(0)["con" + "structor"];\nconst F: any = (0).toFixed["con" + "structor"];\nconst M: any = F("return Ma" + "th")();\n`;
const top = (imports: string, code: string) => (s: string) => (imports + s).replace("export const game", `${REACH}${code}\nexport const game`);
// The sandbox must really run, or "refused" would pass for the wrong reason (see NE-7 on Linux).
const gate = async (root: string) => {
  const r = await conformance("kit-example", root), failed = r.filter((c) => !c.pass).map((c) => c.msg);
  assert.ok(!failed.some((m) => /the sandbox didn't finish/.test(m)), `the sandbox didn't start: ${failed.join(" | ")}`);
  return { refused: failed.length > 0, failed };
};

test("NE-4 (Medium): Date.now through a kit helper on an un-awaited promise is refused by the gate", async () => {
  const root = variant(top(`import { pool } from "${KIT_SRC}/recorder/nodes.ts";\n`, `const T = Promise.resolve().then(pool.bind(null, [0], 1, D["no" + "w"]));`));
  const g = await gate(root);
  assert.ok(g.refused, "the full conformance gate passed a module that read the real clock");
});

test("NE-4 (Medium): the same with Math.random", async () => {
  const root = variant(top(`import { pool } from "${KIT_SRC}/recorder/nodes.ts";\n`, `const R = Promise.resolve().then(pool.bind(null, [0], 1, M["ran" + "dom"]));`));
  assert.ok((await gate(root)).refused, "the full conformance gate passed a module that read Math.random");
});

test("NE-5 (Low): a game file under node_modules/tsx/dist/ is not the loader", async () => {
  const root = variant(top(`import { call } from "./node_modules/tsx/dist/h.ts";\n`, ``).bind(null), { "node_modules/tsx/dist/h.ts": "export const call = (f: any) => f();\n" });
  fs.writeFileSync(path.join(root, "games/kit-example/recorder.ts"), fs.readFileSync(path.join(root, "games/kit-example/recorder.ts"), "utf8")
    .replace("async resultOf(round, _read, inputs) {", `async resultOf(round, _read, inputs) { call(D["no" + "w"]);`));
  assert.ok((await gate(root)).refused, "the full conformance gate passed a module that read the real clock through a fake tsx path");
});

test("NE-6 (Low): process.env read through a kit helper is flagged", async () => {
  const root = variant(top(`import { pool } from "${KIT_SRC}/recorder/nodes.ts";\n`, `const P: any = F("return pro" + "cess")();\nconst E = pool(["PATH"], 1, Reflect.get.bind(null, P["en" + "v"]));`));
  assert.ok((await gate(root)).refused, "the full conformance gate passed a module that read process.env");
});

// Proof (passes today): the game really gets the value. It throws it from resultOf, and the sandbox reports it.
// At 6dfce391 this proved the route handed the game the real clock and a real random number. With the fix (#E-26), the
// same module gets nothing back and the gate names both reads.
test("proof, after the fix: the un-awaited kit-helper route hands the game nothing, and the sandbox names both reads", async () => {
  const code = `const T = Promise.resolve().then(pool.bind(null, [0], 1, D["no" + "w"]));\nconst R = Promise.resolve().then(pool.bind(null, [0], 1, M["ran" + "dom"]));`;
  const root = variant((s) => top(`import { pool } from "${KIT_SRC}/recorder/nodes.ts";\n`, code)(s)
    .replace("async resultOf(round, _read, inputs) {", "async resultOf(round, _read, inputs) { const t = (await T)[0], r = (await R)[0]; throw new Error(`GOT t=${t} r=${r}`);"));
  const g = await gate(root);
  assert.ok(!/GOT t=\d+ r=[\d.]+/.test(g.failed.join(" ")), `the game still got real values: ${g.failed.join(" | ")}`);
  assert.ok(g.failed.some((x) => /used .*Date\.now/.test(x)) && g.failed.some((x) => /used .*Math\.random/.test(x)), g.failed.join(" | "));
});

// Controls: the direct forms are caught (so the variants above really run).
test("control: D.now called by the game itself is refused", async () => {
  const root = variant(top("", `const T = D["no" + "w"]();`));
  assert.ok((await gate(root)).refused);
});

// Added with the fix (#E-26): the Windows run the owner made (Node 24), the static rules for built keys and plain
// words, and the node_modules refusal.
import { permissionFlag, moduleFiles, staticChecks as scan } from "../testing/conformance.ts";

test("E-26 Windows: the sandbox uses the permission flag this Node knows, and no kit file turns a URL into a path by .pathname", () => {
  assert.ok(process.allowedNodeEnvironmentFlags.has(permissionFlag()), permissionFlag());
  const kit = path.join(REPO, "kit");
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const bad = walk(kit).filter((f) => /\.(ts|mjs)$/.test(f) && !/repolens-e2[456]/.test(f)).filter((f) => /new URL\([^)]*import\.meta\.url\)\.pathname/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(bad.map((f) => path.relative(REPO, f)), [], "C:\\C:\\… on Windows: use fileURLToPath");
});

test("NE-4 static: a property name built from strings is refused; NE-8: plain words and arrays of strings are fine", () => {
  for (const bad of [`new Date(0)["con" + "structor"]`, `x[\`con\${s}\`]`, `D[k + "w"]`, `x["constructor"]`]) assert.ok(scan(bad).some((c) => !c.pass), bad);
  for (const fine of [`const msg = "the pick window closes at noon";`, `const window = 3600;`, `const t = "global leaderboard";`, `const ids = ["q" + n, "r"];`, `rows[i + 1]`, `log(\`round \${id}: closed\`)`])
    assert.ok(scan(fine).every((c) => c.pass), `${fine}: ${scan(fine).filter((c) => !c.pass).map((c) => c.msg).join("; ")}`);
  assert.ok(scan("const s = `${Date.now()}`;").some((c) => !c.pass), "code inside a template's ${…} is still scanned");
});

test("NE-5: a game file under a node_modules folder is refused by the scan itself", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-e26-nm-"));
  fs.mkdirSync(path.join(d, "games/g/node_modules/tsx/dist"), { recursive: true });
  fs.writeFileSync(path.join(d, "games/g/recorder.ts"), `import { call } from "./node_modules/tsx/dist/h.ts";\n`);
  fs.writeFileSync(path.join(d, "games/g/node_modules/tsx/dist/h.ts"), `export const call = (f: any) => f();\n`);
  assert.throws(() => moduleFiles(path.join(d, "games/g/recorder.ts"), d), /node_modules/);
});
