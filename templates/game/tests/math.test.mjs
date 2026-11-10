// {{name}}: scoring tests. Add one test per rule in .ai/games/{{Title}}.md.
import test from "node:test";
import assert from "node:assert/strict";
import { scorePick } from "../math.js";

test("{{slug}}: a right pick scores, a wrong one doesn't", () => {
  assert.equal(scorePick("a", "a"), 1);
  assert.equal(scorePick("a", "b"), 0);
});
