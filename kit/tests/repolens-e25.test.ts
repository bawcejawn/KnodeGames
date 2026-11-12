// Repo Lens #E-25 (fix-check of #E-24 NE-1, PR #210 @ 645795e5): failing tests for the NEW finding NE-3.
// They assert the CORRECT behaviour, so they fail on 645795e5 and pass once fixed.
// A game reaches Date and Math through `global` (no static rule names it) and hands Date.now / Math.random to a kit
// helper that calls it back (kit/recorder/alerts.ts `print`, kit/recorder/nodes.ts `pool`). The nearest file frame is
// then the kit's, so fromGame() (conformance-child.ts:31-38) returns false at "a file of the kit's is the caller".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxed, staticChecks } from "../testing/conformance.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const KIT = path.resolve(EXAMPLE_ROOT, "../..");

// A copy of kit-example with `edit` applied to its recorder.ts (as in repolens-b12 / repolens-e24).
function variant(edit: (recorder: string) => string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-e25-var-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example"), rec = path.join(dir, "recorder.ts"), sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KIT.split(path.sep).join("/")}/`)));
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1)).split(path.sep).join("/")}/`));
  return d;
}
// The game's own code: Date and Math reached by name through `global`, never spelled out.
const HELPERS = `const G: any = global;\nconst D = G["Da" + "te"], M = G["Ma" + "th"];\n`;
const IMPORT = (kit: string) => `import { print } from "${kit}/recorder/alerts.ts";\n`;
const withRead = (read: string) => (s: string) =>
  (IMPORT(KIT.split(path.sep).join("/")) + s).replace("export const game", `${HELPERS}export const game`)
    .replace("async resultOf(round, _read, inputs) {", `async resultOf(round, _read, inputs) { ${read}`);
// print() calls `out` for every error line, from inside the kit's file. (pool() in nodes.ts hands the value back too.)
const VIA_KIT_CLOCK = `print({ errors: ["x"], warnings: [], notes: [] }, "s", D["no" + "w"]);`;
const VIA_KIT_RANDOM = `print({ errors: ["x"], warnings: [], notes: [] }, "s", M["ran" + "dom"]);`;
const SOURCE = (read: string) => IMPORT("../../../../kit") + HELPERS + read;

test("NE-3 (Medium): Date.now handed to a kit helper that calls it back must be caught (runtime or static)", () => {
  assert.ok(fs.existsSync(path.join(REPO, "package.json")));
  const r = sandboxed("kit-example", variant(withRead(VIA_KIT_CLOCK)));
  const caught = r.violations.includes("Date.now") || staticChecks(SOURCE(VIA_KIT_CLOCK)).some((c) => !c.pass);
  assert.ok(caught, `the real clock was read unflagged: violations ${JSON.stringify(r.violations)}, static scan all pass`);
});

test("NE-3 (Medium): the same with Math.random must be caught (runtime or static)", () => {
  const r = sandboxed("kit-example", variant(withRead(VIA_KIT_RANDOM)));
  const caught = r.violations.includes("Math.random") || staticChecks(SOURCE(VIA_KIT_RANDOM)).some((c) => !c.pass);
  assert.ok(caught, `randomness was read unflagged: violations ${JSON.stringify(r.violations)}`);
});

test("NE-3 defence in depth (recommended): the runtime trap alone catches the kit-callback route", () => {
  const r = sandboxed("kit-example", variant(withRead(VIA_KIT_CLOCK)));
  assert.ok(r.violations.includes("Date.now"), `runtime missed it: ${JSON.stringify(r).slice(0, 300)}`);
});

test("NE-3 defence in depth (recommended): the static scan alone refuses `global`", () => {
  for (const src of [`const G: any = global;`, `global["Da" + "te"]`, `(global as any).x`])
    assert.ok(staticChecks(src).some((c) => !c.pass), src);
});
