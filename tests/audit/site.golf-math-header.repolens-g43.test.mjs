// Repo Lens #G-43 G43-2: golf-math.js (the shared rules file) still says in its header that a missed game is "never
// dropped", while its code (since #243) drops the worst hole of any kind, a missed game included.
// Run from the repo root: TZ=UTC node --test /home/claude/g1/tests-g43/g43-golf-math-header.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const file = path.resolve("golf-math.js");
await import(file);
const G = globalThis.KGolf;

test("code: a missed game (lost ball) is the hole the mulligan drops", () => {
  const holes = [{ id: "questions", skipped: false, results: { A: { place: 1, of: 3, strokes: 1 } } },
                 { id: "blockx", skipped: false, results: { A: { place: 1, of: 3, strokes: 2 } } },
                 { id: "race", skipped: false, results: {} }];
  const c = G.card(holes, "A");
  assert.equal(c.mulligan, "race");
});

test("G43-2: the rules header no longer says a missed game is never dropped", () => {
  const head = fs.readFileSync(file, "utf8").slice(0, 2000);
  assert.doesNotMatch(head, /never dropped/);
});
