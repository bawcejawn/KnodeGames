// Repo Lens #G-43 (Block Golf launch text and timing). G43-1 (the Hub's launch text) is tested in admin.golf-apply.repolens-g43.test.ts; G43-2: the rules header says the mulligan can drop a missed game; plus the apply
// window for the Week 2 launch (game-add 6 sent Thu 12 Nov ~3:16 PM ET), from the contract's formulas and weeks.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ── G43-2 ──
const mathFile = path.resolve("golf-math.js");
await import(mathFile);
const G = (globalThis as any).KGolf;
test("code: a missed game (lost ball) is the hole the mulligan drops", () => {
  const holes = [{ id: "questions", skipped: false, results: { A: { place: 1, of: 3, strokes: 1 } } },
                 { id: "blockx", skipped: false, results: { A: { place: 1, of: 3, strokes: 2 } } },
                 { id: "race", skipped: false, results: {} }];
  assert.equal(G.card(holes, "A").mulligan, "race");
});
test("G43-2: the rules header no longer says a missed game is never dropped", () => {
  assert.doesNotMatch(fs.readFileSync(mathFile, "utf8").slice(0, 2000), /never dropped/);
});

// ── the Week 2 apply window (confirmation) ──
await import(path.resolve("weeks.js"));
const W = (globalThis as any).KWeeks, DAY = 86400000;
const added = Date.parse("2026-11-12T20:16:00Z");          // Thu 12 Nov 3:16 PM EST (about; the exact eta is in `games`)
const eta = added + 2 * DAY, expiry = eta + 7 * DAY;
const fromWeek = (t: number) => (t >= eta && t < expiry ? W.of(t) + 1 : null);
test("apply window for game 6", () => {
  assert.equal(new Date(eta).toISOString(), "2026-11-14T20:16:00.000Z");     // opens Sat 14 Nov 3:16 PM ET
  assert.equal(new Date(expiry).toISOString(), "2026-11-21T20:16:00.000Z");  // expires Sat 21 Nov 3:16 PM ET
  assert.equal(fromWeek(Date.parse("2026-11-15T23:59:59Z")), 4, "Sun 15 Nov 6:59 PM ET: earns in Week 1 (wrong)");
  assert.equal(fromWeek(Date.parse("2026-11-16T00:00:00Z")), 5, "Sun 15 Nov 7:00 PM ET: from week 5");
  assert.equal(fromWeek(Date.parse("2026-11-21T20:15:00Z")), 5);
  assert.equal(fromWeek(Date.parse("2026-11-21T20:16:00Z")), null, "expired");
  assert.equal(W.label(5), "Week 2"); assert.equal(W.label(4), "Week 1"); assert.equal(W.label(3), "Test week");
  assert.equal(new Date(W.GENESIS_MS + 5 * W.WEEK_MS + 57 * 60000).toISOString(), "2026-11-23T00:57:00.000Z"); // Sun 22 Nov 7:57 PM EST
});
