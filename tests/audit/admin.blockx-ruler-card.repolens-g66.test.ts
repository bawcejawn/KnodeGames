// Repo Lens #G-66 G66-1: the BLOCKX_RULER_FROM_WEEK admin card must not tell the owner that unsetting is harmless.
// Once a week the switch makes "on" has started, an unset (or a move) is refused by the shared publish step
// (.github/workflows/games.yml, switch_change → sys.exit), which stops Block X, the Bracket and Questions publishing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { VARIABLES } from "../../admin/switches.ts";

test("G66-1: the Block X ruler card warns that unsetting after a live week stops publishing", () => {
  const v = (VARIABLES as any[]).find((x) => x.name === "BLOCKX_RULER_FROM_WEEK");
  assert.ok(v, "card present");
  const text = `${v.what} ${v.when} ${v.note ?? ""}`;
  assert.match(text, /never (unset|change)/i, "says never to unset it once a week has started");
  assert.match(text, /(stops|holds|refus)/i, "says what happens if it is unset");
  assert.doesNotMatch(v.note ?? "", /^.*Unset = the old points \(no ruler\)\.?\s*$/m, "doesn't present unset as a harmless choice");
});
