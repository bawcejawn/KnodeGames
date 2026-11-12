// Payout (RECORDER §4.3, D-152, Repo Lens #E-3 C-1): over 10,000 random weeks the kit's paid set is exactly the set a
// port of the vault contract's winners walk (Kpred finalizeGameStep: ceil(30%), walk down from the top value until
// the count reaches it, tied values whole) pays from the kit's own vault values — for every rule and value mode.
import test from "node:test";
import assert from "node:assert/strict";
import { paidSet, vaultValues, contractWinners, freePlaces, MAX_PER_PLACE } from "../recorder/payout.ts";
import { rng } from "../testing/fake-nodes.ts";

const addr = (i: number) => "1" + String(i).padStart(33, "A").replace(/0/g, "o");
function randomRows(r: () => number) {
  const n = Math.floor(r() * 60);
  const spread = 1 + Math.floor(r() * (r() < 0.3 ? 3 : 40));   // small spreads make big ties
  const rows = Array.from({ length: n }, (_, i) => ({ a: addr(i), pts: 1 + Math.floor(r() * spread), at: Math.floor(r() * 1000) }));
  return rows.sort((u, v) => v.pts - u.pts || (u.a < v.a ? -1 : 1));
}
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

test("payout fuzz: 10,000 random weeks, kit paid set == the contract's walk over the kit's vault values", () => {
  const r = rng(158);
  let ties = 0;
  for (let i = 0; i < 10000; i++) {
    const rows = randomRows(r);
    for (const [rule, mode] of [["legacy-tied-whole", "dense255"], ["legacy-tied-whole", "points"], ["d152", "dense255"]] as const) {
      const paid = paidSet(rows, rule);
      // The rows in board order (points, then address), as the tally hands them over, whatever the rule.
      const v = vaultValues(rows, paid, mode);
      for (const x of v) assert.ok(x.points >= 1 && x.points <= 255);
      const won = contractWinners(v);
      assert.ok(sameSet(paid, won), `week ${i} ${rule}/${mode}: kit paid ${paid.size}, contract pays ${won.size}`);
      if (rows.length) {
        const need = Math.ceil(rows.length * 0.3);
        if (rule === "d152") assert.equal(paid.size, need, "d152 pays exactly ceil(30%)");
        else { assert.ok(paid.size >= need); if (paid.size > need) ties++; }
      }
    }
  }
  assert.ok(ties > 100, "the fuzz exercised tied groups across the line");
});

test("payout: legacy-tied-whole pays whole tied groups; d152 admits by reached-first then address", () => {
  const rows = [{ a: addr(1), pts: 5, at: 9 }, { a: addr(2), pts: 3, at: 5 }, { a: addr(3), pts: 3, at: 1 }, { a: addr(4), pts: 1, at: 0 }, { a: addr(5), pts: 1, at: 0 }];
  assert.deepEqual([...paidSet(rows, "legacy-tied-whole")].sort(), [addr(1), addr(2), addr(3)].sort());
  assert.deepEqual([...paidSet(rows, "d152")].sort(), [addr(1), addr(3)].sort());
  assert.equal(paidSet([], "d152").size, 0);
  assert.throws(() => paidSet(rows, "other" as any), /unknown payout rule/);
});

test("payout: 'points' mode refuses a value over 255; dense255 never lets an unpaid row share a paid value", () => {
  assert.throws(() => vaultValues([{ a: addr(1), pts: 300, at: 0 }], new Set([addr(1)]), "points"), /1-255/);
  // 300 distinct places: the paid set (top 90) gets distinct values; everything past 255 shares 1, below every paid value.
  const rows = Array.from({ length: 300 }, (_, i) => ({ a: addr(i), pts: 1000 - i, at: 0 }));
  const paid = paidSet(rows, "legacy-tied-whole");
  const v = vaultValues(rows, paid, "dense255");
  assert.ok(sameSet(contractWinners(v), paid));
});

test("free places (D-159): ties share; a tie for 1st leaves 2nd empty; past 10, exactly 10 by score time then address", () => {
  const f = (pts: number[], at: (i: number) => number = () => 0) => pts.map((p, i) => ({ a: addr(i), pts: p, at: at(i) }));
  assert.deepEqual(freePlaces(f([3, 2, 2, 1])), { first: [addr(0)], second: [addr(1), addr(2)].sort() });
  assert.deepEqual(freePlaces(f([3, 3, 2])).second, [], "a tie for 1st leaves 2nd empty");
  // 12 tied for 1st: the 10 with the earlier score time (then address) are paid; 2nd stays empty; never zero.
  const many = f(Array(MAX_PER_PLACE + 2).fill(4), (i) => (i === 0 ? 900 : i === 5 ? 800 : 100));
  const won = freePlaces(many);
  assert.equal(won.first.length, MAX_PER_PLACE);
  assert.ok(!won.first.includes(addr(0)) && !won.first.includes(addr(5)), "the two latest score times are cut");
  assert.deepEqual(won.second, [], "cut wallets don't move to 2nd");
  // Same score time: by address.
  const same = freePlaces(f(Array(MAX_PER_PLACE + 1).fill(4)));
  const byAddr = Array.from({ length: MAX_PER_PLACE + 1 }, (_, i) => addr(i)).sort();
  assert.deepEqual(same.first, byAddr.slice(0, MAX_PER_PLACE), "the 10 lowest addresses");
  // 1 first, 11 tied for 2nd: 10 of them by score time.
  const two = freePlaces(f([5, ...Array(MAX_PER_PLACE + 1).fill(4)], (i) => (i === 1 ? 999 : 1)));
  assert.deepEqual(two.first, [addr(0)]);
  assert.equal(two.second.length, MAX_PER_PLACE);
  assert.ok(!two.second.includes(addr(1)));
  assert.deepEqual(freePlaces([]), { first: [], second: [] });
});
