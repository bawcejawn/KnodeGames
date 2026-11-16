// Repo Lens #G-16 (Combo fix-check 4 @ ba2d9b30): FC4-3. Place in tests/audit/repolens-fc-combo/.
// FC4-3: D-159 / I-103: free-prize ties pay up to 10 per place; more than 10 tied pays exactly 10 (earlier score time,
// then address), never zero. combo-math.js freeWinners (and the publish job's copy, combo.yml ~583-584) empty the place.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = process.env.APP || fileURLToPath(new URL("../../../", import.meta.url));
for (const f of ["race-math.js", "blockx-math.js", "combo-math.js"]) await import(path.join(ROOT, f));
const C = globalThis.KCombo;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i) => "1" + B58[i] + "A".repeat(32);

test("FC4-3 (Low): eleven tied free players at 1st: exactly 10 are paid (by address), the place is never empty", () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ player: addr(i), pts: 500, hits: 2, lastHit: 1793000000000, days: 3, staked: false, free: true }));
  rows.push({ player: addr(20), pts: 400, hits: 1, lastHit: 1793000000000, days: 3, staked: false, free: true });
  const { first, second } = C.freeWinners(rows);
  assert.equal(first.length, 10, "more than 10 tied must pay exactly 10 (D-159), not nobody");
  assert.deepEqual(first, rows.slice(0, 11).map((r) => r.player).sort().slice(0, 10));
  assert.deepEqual(second, [], "2nd stays empty when 1st is shared");
});
