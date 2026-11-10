// Added with the Repo Lens #F-2 fixes: a game inside the checkout (F2-8: it shares the sandbox's own copy of the kit,
// which the temp-folder variants of the other tests don't), the kit import allowlist (F2-3), and the one-pass scanner
// (F2-5) on ordinary code it must keep passing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { moduleFiles, sandboxed, staticChecks, readSource, GAME_IMPORTS } from "../testing/conformance.ts";
import { Budget } from "../recorder/nodes.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** A copy of the kit-example game INSIDE the checkout, importing the kit by relative path like a real game. */
function inRepo(edit: (s: string) => string) {
  const root = fs.mkdtempSync(path.join(REPO, "kit", "testing", ".tmp-inrepo-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(root, "games"), { recursive: true });
  const dir = path.join(root, "games/kit-example");
  // kit/testing/example/games/kit-example → kit/testing/.tmp-x/games/kit-example: the same depth below kit/testing.
  const rec = path.join(dir, "recorder.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8")));
  return { root, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("F2-8 / F2-3: an in-repo game shares the kit's own modules, and still can't reach the real clock through Budget", () => {
  // The scan refuses the import outright …
  const v = inRepo((s) => s.replace("export const game", `import { Budget } from "../../../../recorder/nodes.ts";\nvoid Budget;\nexport const game`));
  try {
    assert.throws(() => moduleFiles(path.join(v.root, "games/kit-example/recorder.ts"), v.root), /may import only/);
  } finally { v.done(); }
  // … and even if it ran, nothing on a Budget hands out a clock: every own value that's a function is tried.
  const b: any = new Budget();
  const fns = Object.getOwnPropertyNames(b).map((k) => b[k]).filter((x) => typeof x === "function");
  assert.deepEqual(fns, [], "no function-valued property on a Budget");
  assert.deepEqual(Object.keys(b), ["b"], "only the limits are visible");
});

test("F2-8: the plain kit-example game, placed inside the checkout, passes the sandbox", () => {
  const v = inRepo((s) => s);
  try {
    const r = sandboxed("kit-example", v.root);
    assert.deepEqual(r.violations, [], JSON.stringify(r).slice(0, 300));
    assert.equal(r.error, undefined);
  } finally { v.done(); }
});

test("F2-3: a game may import only the kit's types, clock and sources", () => {
  for (const ok of ["recorder/types.ts", "recorder/clock.ts", "recorder/sources/vault-answers.ts", "recorder/sources/picks-contract.ts"]) assert.ok(GAME_IMPORTS.some((re) => re.test(ok)), ok);
  for (const no of ["recorder/nodes.ts", "recorder/runtime.ts", "recorder/store.ts", "publish/check.inline.mjs", "testing/fake-clock.ts", "recorder/sources/../nodes.ts"]) assert.ok(!GAME_IMPORTS.some((re) => re.test(no)), no);
  // The example game itself still passes the scan.
  assert.ok(moduleFiles(path.join(EXAMPLE_ROOT, "games/kit-example/recorder.ts"), EXAMPLE_ROOT).length >= 1);
});

test("F2-5: the one-pass scanner keeps ordinary code passing and still sees code after strings, regexes and templates", () => {
  for (const fine of [
    `const half = total / 2 / 3;`, `const r = a.length / b.length;`, `const url = "https://example.com/a//b";`,
    `const re = /^q0*(\\d+)$/; const id = Number(s.match(re)?.[1]);`, "const t = `round ${id}: ${a / 2} // not a comment`;",
    `if (x) /* note */ return y / 2;`, `const s = 'it\\'s fine';`,
  ]) assert.ok(staticChecks(fine).every((c) => c.pass), `${fine}: ${staticChecks(fine).filter((c) => !c.pass).map((c) => c.msg).join("; ")}`);
  for (const bad of [
    `const q = /"/; const t = Date.now();`, `const u = "a//b"; Date.now()`, "const v = `${`${Date.now()}`}`;",
    `const w = /[/]/; Math.random();`, `x = y / 2; /* */ const t = Date.now();`,
  ]) assert.ok(staticChecks(bad).some((c) => !c.pass), bad);
  // A comment is removed whole; a "//" inside a string or a regex stays.
  assert.equal(readSource(`a; // Date.now()\nb;`).code, `a; \nb;`);
  assert.equal(readSource(`const u = "a//b";`).code, `const u = "a//b";`);
  assert.equal(readSource(`const u = "a//b";`).bare, `const u = "";`);
});
