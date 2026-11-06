// Repo Lens #E-24 (fix-check of #B-12, PR #210 @ 6914cb83): the failing test for the NEW finding NE-1 (NK-6 bypass).
// It asserts the CORRECT behaviour, so it fails on 6914cb83 and passes once fixed.
// A game reads the real clock by aliasing Date (no static rule matches) and handing the builtin itself to a promise
// chain it doesn't await: when Date.now runs from the microtask queue, the stack holds no game frame (not even an
// `at async` one), so fromGame() says "not the game" (conformance-child.ts:25-34, the default `return false`).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxed, staticChecks } from "../testing/conformance.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

// A copy of kit-example with `edit` applied to its recorder.ts (the same way kit/tests/repolens-b12.test.ts does it).
function variant(edit: (recorder: string) => string) {
  const KIT = path.resolve(EXAMPLE_ROOT, "../..");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-e24-var-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example"), rec = path.join(dir, "recorder.ts"), sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KIT}/`)));
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1))}/`));
  return d;
}
// Helpers at the top of the module, then a read inside resultOf (awaited by the sandbox, so the timer surely fires).
const HELPERS = `const D = Date;\nconst M = Math;\nconst tick = () => new Promise<void>((r) => setTimeout(r, 0));\n`;
const withRead = (read: string) => (s: string) =>
  s.replace("export const game", `${HELPERS}export const game`)
   .replace("async resultOf(round, _read, inputs) {", `async resultOf(round, _read, inputs) { ${read}`);

const BYPASS_CLOCK = `let t = 0; Promise.resolve().then(D.now).then((v: number) => { t = v; }).catch(() => {}); await tick(); void t;`;
const BYPASS_RANDOM = `let t = 0; Promise.resolve().then(M.random).then((v: number) => { t = v; }).catch(() => {}); await tick(); void t;`;
const CONTROL = `let t = 0; Promise.resolve().then(() => D.now()).then((v: number) => { t = v; }).catch(() => {}); await tick(); void t;`;

test("NE-1 control: an arrow in the game's file calling the aliased clock after a tick IS caught today", () => {
  const r = sandboxed("kit-example", variant(withRead(CONTROL)));
  assert.ok(r.violations.includes("Date.now"), `control should be caught: ${JSON.stringify(r).slice(0, 300)}`);
});

test("NE-1 (Medium): passing the aliased Date.now itself to .then() after a timer tick must be caught (runtime or static)", () => {
  assert.ok(fs.existsSync(path.join(REPO, "package.json")));
  const src = HELPERS + BYPASS_CLOCK;
  const r = sandboxed("kit-example", variant(withRead(BYPASS_CLOCK)));
  const caught = r.violations.includes("Date.now") || staticChecks(src).some((c) => !c.pass);
  assert.ok(caught, `the real clock was read unflagged: violations ${JSON.stringify(r.violations)}, static scan all pass`);
});

test("NE-1 (Medium): the same with Math.random must be caught (runtime or static)", () => {
  const src = HELPERS + BYPASS_RANDOM;
  const r = sandboxed("kit-example", variant(withRead(BYPASS_RANDOM)));
  const caught = r.violations.includes("Math.random") || staticChecks(src).some((c) => !c.pass);
  assert.ok(caught, `randomness was read unflagged: violations ${JSON.stringify(r.violations)}`);
});

// Added with the fix: the same routes through a timer, the runtime trap on its own (not the static rule), and the
// static rule's allow list (a game's ordinary date and math code still passes).
test("NE-1: the runtime trap alone catches the clock and randomness handed to a promise or a timer", () => {
  for (const [what, read, want] of [
    ["promise, clock", `Promise.resolve().then(D.now).catch(() => {}); await tick();`, "Date.now"],
    ["promise, random", `Promise.resolve().then(M.random).catch(() => {}); await tick();`, "Math.random"],
    ["timer, clock", `setTimeout(D.now, 0); await tick();`, "Date.now"],
  ] as const) {
    const r = sandboxed("kit-example", variant(withRead(read)));
    assert.ok(r.violations.includes(want), `${what}: ${JSON.stringify(r).slice(0, 300)}`);
  }
  const t = sandboxed("kit-example", variant(withRead(`setTimeout(D.now, 0); await tick();`)));
  assert.ok(!t.error && t.checks.some((c) => !c.pass && /outside any call/.test(c.msg)), "a throw from a timer is reported, not a crash");
});

test("NE-1: the static scan refuses Date and Math used as values, and allows their ordinary uses", () => {
  for (const bad of ["const D = Date;", "p.then(Date.now)", "Date['now']()", "const M = Math;", "p.then(Math.random)", "Math['random']()", "(0, eval)('this')"])
    assert.ok(staticChecks(bad).some((c) => !c.pass), bad);
  for (const fine of ["new Date(round.locksAt).getUTCDay()", "Date.UTC(2026, 0, 1)", "Date.parse(s)", "function f(d: Date) {}", "if (v instanceof Date) {}", "Math.floor(x) + Math.max(a, b)", "xs.map(Math.floor)", "Math.PI * 2"])
    assert.ok(staticChecks(fine).every((c) => c.pass), fine);
});
