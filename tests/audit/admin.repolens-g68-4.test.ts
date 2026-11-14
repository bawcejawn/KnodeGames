// Repo Lens #G-68 G68-2 (Low): the BRACKET_RULER_FROM_WEEK admin card still says "Unset = the Bracket's own method." without
// saying that, once a week it makes "on" has started, an unset (or a move) is refused: the publish job holds that Bracket week
// (and the board) with an email every hour until it is set back (tests/g68-1 "#G-66 lesson"). Same lesson as #G-66 G66-1.
// Also checks the BRACKET_RULER_MODE card against the code's rules. Run from the repository root:
// TZ=UTC node --import tsx --test <this file> (copy into tests/audit/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { VARIABLES } from "../../admin/switches.ts";
const card = (n: string) => { const v = (VARIABLES as any[]).find((x) => x.name === n); assert.ok(v, n + " card"); return v; };

test("G68-2: the Bracket ruler switch card warns that unsetting or moving it after a started week is refused", () => {
  const v = card("BRACKET_RULER_FROM_WEEK"), text = `${v.what} ${v.when} ${v.note ?? ""}`;
  assert.match(text, /never (unset|move)/i, "says never to unset or move it once a week has started");
  assert.match(text, /(holds|refus|stops)/i, "says what happens if it is");
});

test("G68 / CI: the BRACKET_RULER_MODE card matches mode_schedule / mode_change", () => {
  const v = card("BRACKET_RULER_MODE");
  assert.deepEqual(v.games, [9]);
  assert.match(v.format, /week:mode pairs like 6:B/); assert.match(v.format, /A to D/); assert.match(v.format, /rising/);
  assert.match(v.what, /Empty = mode A/);
  assert.match(v.note, /started never changes mode/);
});
