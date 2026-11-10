// Repo Lens #F-2 (fix-check of #E-26 NE-4..NE-8, PR #210 @ 1db2440a): failing tests for the routes still open.
// Each asserts the CORRECT behaviour (the full conformance gate, static scan + sandbox, refuses the module; or the kit
// holds no real clock a game can reach), so it fails on 1db2440a and passes once fixed.
//   F2-1 (High, latent): a game fakes the "needs --allow-child-process" failure, the sandbox re-runs it with child
//         processes allowed, and the game runs a shell command through a function named after the loader's path.
//   F2-2 (Medium): Date.now / Math.random called by a game function whose NAME is the loader's path: the loader test
//         (conformance-child.ts:49) is a substring match on the whole stack line, function name included.
//   F2-3 (Medium): `new Budget()` (kit/recorder/nodes.ts) carries the kit's real clock as a run-time property.
//   F2-4 (Low): an environment read from a game function named "node:…" passes as Node's own code (line 39, 45).
//   F2-5 (Low): the static scan misses code after a quote inside a regex literal, or after `//` inside a string.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { conformance, staticChecks } from "../testing/conformance.ts";
import { Budget } from "../recorder/nodes.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

const KIT = path.resolve(EXAMPLE_ROOT, "../..");
const KIT_SRC = KIT.split(path.sep).join("/");
const REPO = path.resolve(KIT, "..");
// The loader's path exactly as the sandbox spells it (conformance-child.ts LOADER, file:// form).
const LOADER_URL = pathToFileURL(path.join(REPO, "node_modules", "tsx", "dist")).href + "/";
function variant(edit: (recorder: string) => string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-f2-var-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example"), rec = path.join(dir, "recorder.ts"), sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KIT_SRC}/`)));
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1)).split(path.sep).join("/")}/`));
  return d;
}
// No forbidden spelling: Function and process reached with keys joined from pieces, and a function named after the loader.
const REACH = `const c = ["con", "structor"].join("");
const F: any = (0).toFixed[c];
const P: any = F("return pro" + "cess")();
const L = ${JSON.stringify(LOADER_URL)};
const viaLoader = { [L]: (f: any) => f() }[L];
`;
const top = (code: string, inResult = "", imports = "") => (s: string) =>
  (imports + s).replace("export const game", `${REACH}${code}\nexport const game`)
    .replace("async resultOf(round, _read, inputs) {", `async resultOf(round, _read, inputs) { ${inResult}`);
const gate = async (root: string) => {
  const r = await conformance("kit-example", root), failed = r.filter((c) => !c.pass).map((c) => c.msg);
  return { refused: failed.length > 0, failed };
};

test("F2-1 (High): a game that fakes the child-process failure gets no shell in the sandbox's second run", { skip: process.platform === "win32" && "uses /bin/sh" }, async () => {
  const mark = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kit-f2-mark-")), "ran");
  const root = variant(top(`const ea: string[] = P[["exec", "Argv"].join("")];
if (!ea.includes("--allow-child-process")) { P.stderr.write("Use --allow-child-process to manage permissions.\\n"); P[["ex", "it"].join("")](1); }
const CP: any = viaLoader(P[["get", "Builtin", "Module"].join("")].bind(P, "child_" + "process"));
viaLoader(CP[["ex", "ec", "Sync"].join("")].bind(CP, "touch " + ${JSON.stringify(mark)}));`));
  const g = await gate(root);
  assert.ok(!fs.existsSync(mark), "the game ran a shell command inside the conformance sandbox (it wrote a file outside it)");
  assert.ok(g.refused, "the full conformance gate passed a module that started a process");
});

test("F2-2 (Medium): Date.now called by a game function named after the loader's path is refused", async () => {
  const root = variant(top(`const D: any = new Date(0)[c];\nexport let t = 0;`, `t = viaLoader(D[["no", "w"].join("")]);`));
  assert.ok((await gate(root)).refused, "the full conformance gate passed a module that read the real clock (its function's name is the loader's path)");
});

test("F2-2 (Medium): the same with Math.random", async () => {
  const root = variant(top(`const M: any = F("return Ma" + "th")();\nexport let r = 0;`, `r = viaLoader(M.random);`));
  assert.ok((await gate(root)).refused, "the full conformance gate passed a module that read Math.random (its function's name is the loader's path)");
});

test("F2-3 (Medium): the kit hands no real clock to a game (Budget keeps its clock private at run time)", () => {
  const b: any = new Budget();
  const exposed = Reflect.ownKeys(b).filter((k) => typeof b[k] === "function");
  assert.deepEqual(exposed, [], `new Budget() carries ${exposed.map(String).join(", ")} as a property: a game that imports nodes.ts gets the kit's real clock, which no trap sees`);
});

test("F2-4 (Low): an environment read from a game function named \"node:…\" is flagged", async () => {
  const root = variant(top(`const asNode = { ["node:internal/x"]: () => P.env.PATH }["node:internal/x"];\nexport let e = "";`, `e = asNode();`));
  assert.ok((await gate(root)).refused, "the full conformance gate passed a module that read process.env (its function's name starts with node:)");
});

test("F2-5 (Low): code after a quote in a regex literal, or after // inside a string, is still scanned", () => {
  for (const src of [`const q = /"/; const t = Date.now(); const s = "x";`, `const u = "a//b"; const t = Date.now();`]) {
    const refused = staticChecks(src).some((c) => !c.pass);
    assert.ok(refused, `the static scan missed Date.now in: ${src}`);
  }
  assert.ok(staticChecks(`const u = "see https://example.com"; const r = /a\\/b/; const n = 1 / 2 / 3;`).every((c) => c.pass), "plain strings, regexes and division stay fine");
});
