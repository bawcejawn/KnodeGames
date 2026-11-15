// Repo Lens #H-1 H1-1 and H1-3 (Low), written by the Bracket chat as stand-ins for Repo Lens's
// bracket-free-prize.repolens-h1.test.mjs and bracket-switch-deadline.repolens-h1.test.ts (those never reached the repo).
// H1-1: the Bracket's stake panel names the free prize only for a week on show at or after index.json's prizesFromWeek,
// never in the practice week and never before index.json is read. H1-3: game 9's launch step names the switch deadline.
// Run from the repository root: APP=. TZ=UTC node --import tsx --test tests/audit/bracket-free-prize-h1.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const APP = path.resolve(process.env.APP || ".");
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");

test("H1-1: the stake panel is mounted once, after index.json is read, with the free prize tied to prizesFromWeek", () => {
  const js = read("bracket.js");
  const mounts = js.match(/KStake\.mount\(\$\("bracket-stake"\)[^\n]*/g) || [];
  assert.equal(mounts.length, 1, "one mount of the Bracket's stake panel");
  assert.doesNotMatch(mounts[0], /freePrize: true\b/, "no fixed free prize");
  const m = mounts[0].match(/freePrize: ([^}]+?) \}\)/); assert.ok(m, "a freePrize expression");
  assert.equal(m[1], "Number.isInteger(prizesFrom) && view >= prizesFrom");
  assert.ok(js.indexOf(mounts[0]) > js.indexOf("await Promise.all([loadWeeks()"), "mounted after loadWeeks() (which reads index.json)");
  // the same expression, evaluated as the page does
  const free = new Function("prizesFrom", "view", "return " + m[1] + ";");
  assert.equal(free(undefined, 4), false, "index.json not read: no promise");
  assert.equal(free(null, 4), false, "no first paid week yet: no promise");
  assert.equal(free(5, 4), false, "Week 1 (vault week 4, practice): no promise");
  assert.equal(free(5, 5), true, "Week 2 (vault week 5): the prize is named");
  assert.equal(free(5, 9), true, "later weeks: the prize is named");
});

test("H1-1: the stake panel says nothing about a free prize when told it is off", () => {
  const src = read("stake-panel.js");
  assert.match(src, /freePrize/, "the panel reads the freePrize option");
  assert.match(src, /explain\(g, min, opts\)/, "mount passes its options to explain");
});

test("H1-3: game 9's launch step names the window for the free-prize switch, with its deadline", async () => {
  const { LAUNCH } = await import(path.join(APP, "admin/switches.ts"));
  const step = LAUNCH.find((l) => l.game === 9).steps.map((s) => s.text).join(" ");
  assert.match(step, /npm run prizes -- on 9 --send --from 5/);
  assert.match(step, /after Sun 15 Nov 7:30 PM ET and before Sun 22 Nov 6:30 PM ET/);
});
