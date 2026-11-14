// "Send my picks" on the Producer Race (Capacity ask 13 Nov): hidden until the sponsor's batch row is set; any race length together;
// at most 10; a race that starts is dropped right before signing; the daily picks counted. A single pick is unchanged. Offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js = fs.readFileSync("race.js", "utf8"), css = fs.readFileSync("styles.css", "utf8");

test("the bar shows only behind W.batchReady and only with chosen picks", () => {
  assert.match(js, /function batchOn\(\) \{ return !!\(W && typeof W\.batchReady === "function" && W\.batchReady\(\)\); \}/);
  assert.match(js, /if \(!batchOn\(\) \|\| !me\(\) \|\| !n\) \{ bar\.hidden = true/);
  assert.match(css, /\.pk-bar\[hidden\]/);
});
test("chosen picks of every race length, open and different from the current pick, at most 10", () => {
  assert.match(js, /for \(const \[index, horse\] of drafts\)/); assert.match(js, /for \(const \[k, horse\] of rtDrafts\)/);
  assert.match(js, /horse !== myPicks\.get\(index\) && start - Date\.now\(\) > LOCK_MARGIN/);
  assert.match(js, /horse !== rtPicks\.get\(k\) && start - Date\.now\(\) > LOCK_MARGIN/);
  assert.match(js, /pendingDrafts\(\)\.slice\(0, 10\)/);
});
test("races that start are dropped right before signing; the daily picks counted; failure wording", () => {
  assert.match(js, /stillOpen: \(o\) => o\.__start - Date\.now\(\) > LOCK_MARGIN/);
  assert.match(js, /used \+ list\.length > max/);
  assert.match(js, /Nothing was saved; a race had started\. Try again\./);
  assert.match(js, /race: M\.contractRace\(d\.type, d\.index\)/);
});
test("a single pick still goes through sendPick exactly as before", () => {
  assert.match(js, /W\.send\(`pick \$\{nameOf\(horse\)\} for the race at \$\{dayTime\(tr\.start\)\}`, \[operation\]\)/);
  assert.match(js, /onclick: \(\) => sendPick\(cur \+ k, sel\.value\)/);
});
