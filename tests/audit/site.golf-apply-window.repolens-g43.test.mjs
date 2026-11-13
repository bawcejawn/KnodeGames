// Repo Lens #G-43 (confirmation, passes): the docs' game-6 window, from the contract's own formulas
// (Kpred.ts propose_game: eta = now + timelock_length (2 days on mainnet); apply_game: now >= eta, now < eta + 7 days,
// from_week = weekOf(now) + 1) and weeks.js (genesis Mon 19 Oct 2026 00:00 UTC).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
await import(path.resolve("weeks.js"));
const W = globalThis.KWeeks, DAY = 86400000;
const added = Date.parse("2026-11-12T20:16:00Z");          // Thu 12 Nov 3:16 PM EST (about; the exact eta is in `games`)
const eta = added + 2 * DAY, expiry = eta + 7 * DAY;
const fromWeek = (t) => (t >= eta && t < expiry ? W.of(t) + 1 : null);
test("apply window", () => {
  assert.equal(new Date(eta).toISOString(), "2026-11-14T20:16:00.000Z");     // opens Sat 14 Nov 3:16 PM ET
  assert.equal(new Date(expiry).toISOString(), "2026-11-21T20:16:00.000Z");  // expires Sat 21 Nov 3:16 PM ET
  assert.equal(fromWeek(Date.parse("2026-11-15T23:59:59Z")), 4, "Sun 15 Nov 6:59 PM ET: earns in Week 1 (wrong)");
  assert.equal(fromWeek(Date.parse("2026-11-16T00:00:00Z")), 5, "Sun 15 Nov 7:00 PM ET: from week 5");
  assert.equal(fromWeek(Date.parse("2026-11-21T20:15:00Z")), 5);
  assert.equal(fromWeek(Date.parse("2026-11-21T20:16:00Z")), null, "expired");
  assert.equal(W.label(5), "Week 2"); assert.equal(W.label(4), "Week 1"); assert.equal(W.label(3), "Test week");
  assert.equal(new Date(W.GENESIS_MS + 5 * W.WEEK_MS + 57 * 60000).toISOString(), "2026-11-23T00:57:00.000Z"); // Sun 22 Nov 7:57 PM EST
});
