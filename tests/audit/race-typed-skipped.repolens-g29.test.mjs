// Repo Lens #G-29 G29-1 (Low): a typed race the ruler never scored is dropped from a paid ON week without trace: it isn't
// in the vault file's skipped list (the publish job's shape check only admits 6-hour ids, at most 28), the publish recount
// (typed_ruled) drops it silently where a 6-hour race must be listed in skipped, and the recorder skips it at the week's
// end with a warning only (no RULER_GRACE, no email). Place in tests/audit/. Fails at f8b5396.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const APP = new URL("../../", import.meta.url).pathname;
const yml = fs.readFileSync(APP + ".github/workflows/race.yml", "utf8"), ts = fs.readFileSync(APP + "bot/race.ts", "utf8");

test("G29-1: the vault file's skipped list can name a typed race (H1-/H2-/D-/W- ids), and holds a full week of them", () => {
  const line = yml.split("\n").find((l) => /for x in sk\)/.test(l)) || "";
  assert.match(line, /H1-|\(H1-\|H2-\|D-\|W-\)/, "the shape check should accept typed race ids in skipped");
  assert.doesNotMatch(yml, /len\(sk\) > 28\b/, "28 = the 6-hour races only; a week has 28 + 168 + 84 + 7 + 1 races");
});
test("G29-1: the publish recount refuses an ON week whose unscored typed race isn't in skipped", () => {
  const body = yml.slice(yml.indexOf("def typed_ruled"), yml.indexOf("if w >= TYPES_FROM:", yml.indexOf("def typed_ruled")));
  assert.match(body, /skipped/, "typed_ruled should require an unscored typed race to be in skipped, as the 6-hour recount does");
});
test("G29-1: the recorder lists typed races it skips, and alerts the owner (or gives them the ruler grace)", () => {
  const vr = ts.slice(ts.indexOf("async function vaultResults"), ts.indexOf("async function vaultResults") + 12000);
  assert.match(vr, /skipped:\s*\[\s*\.\.\.open\.map\([^)]*\),\s*\.\.\.openTyped/, "skipped should include the typed races skipped");
  assert.match(vr, /openTyped[^\n]*heldAlert|heldAlert[^\n]*openTyped|typedWaiting/, "an unscored typed race should wait like rulerWaiting or alert");
});
