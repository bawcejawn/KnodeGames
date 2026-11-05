// Repo Lens #E-3 C-1 (Producer Bracket), the review's own test (claude/bracket/repolens-e3-tests/, private): past 255
// places the vault file must never make the Vault pay players outside the top 30%. Unchanged except for the import
// line; the review's re-implementation of the Vault's cutoff is kept as it wrote it.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));

/** The Vault v6 cutoff (Kpred.ts finalizeGameStep): need = ceil(30% of the rows posted); walk the point values from the
 *  top, taking each whole group, until at least `need` players are in. Returns the players paid. */
function vaultPays(rows) {
  const need = Math.ceil(rows.length * 0.3), byVal = new Map();
  for (const r of rows) byVal.set(r.points, [...(byVal.get(r.points) || []), r.player]);
  const paid = [];
  for (const v of [...byVal.keys()].sort((a, b) => b - a)) { if (paid.length >= need) break; paid.push(...byVal.get(v)); }
  return paid;
}

test("E3-C1: past 255 places the vault file never makes the Vault pay players outside the top 30%", () => {
  for (const N of [846, 847, 1000, 2000]) {
    const pts = [], times = new Map(), staked = new Set();
    for (let i = 0; i < N; i++) {
      const p = "1" + String(i).padStart(33, "A");
      pts.push([p, 10 + (i % 7), 0, 3]); times.set(p, 1_800_000_000_000 + i * 3000); staked.add(p);   // each in its own block
    }
    const rows = rec.vaultRows(pts, staked, times);
    const earners = new Set(rec.stakedEarners(pts, times));
    const paid = vaultPays(rows);
    const extra = paid.filter((p) => !earners.has(p)).length;
    assert.equal(extra, 0, `N=${N}: the Vault would pay ${paid.length} players, ${extra} of them outside the top 30% (${earners.size})`);
    assert.equal(paid.length, earners.size, `N=${N}: and every earner is paid`);
  }
});
