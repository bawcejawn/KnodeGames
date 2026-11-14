// Fantasy Producers: the rules in math.js (owner decisions of 11 Nov: cap 150, the 80% gate, void vs quiet days,
// captaincy from any producer). Written first (D-140): each rule has a test that fails without it.
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "../math.js";

const DAY = F.DAY;
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const D = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", E = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", G = "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG";
const M = 1000000n;
const row = (cr, ex, extra = {}) => ({ credited: String(BigInt(Math.round(cr * 1e6))), expected: String(BigInt(Math.round(ex * 1e6))), void: false, entry: true, ...extra });
const MON = Date.UTC(2026, 10, 16);                 // vault week 4 starts Mon 16 Nov 2026

test("ymd: UTC days as yyyymmdd, with no Date in the rules", () => {
  assert.equal(F.ymd(MON), "20261116");
  assert.equal(F.ymd(Date.UTC(2024, 1, 29)), "20240229");
  assert.equal(F.ymd(Date.UTC(2026, 11, 31)), "20261231");
  for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2030, 0, 1); t += 37 * DAY) assert.equal(F.ymd(t), new Date(t).toISOString().slice(0, 10).replaceAll("-", ""));
  assert.throws(() => F.ymd(MON + 1));
});

test("days: form days are Friday to Thursday before the week; the week has 6 play days and Sunday", () => {
  assert.deepEqual(F.formDays(MON).map(F.ymd), ["20261106", "20261107", "20261108", "20261109", "20261110", "20261111", "20261112"]);
  assert.deepEqual(F.weekDays(MON).map(F.ymd), ["20261116", "20261117", "20261118", "20261119", "20261120", "20261121", "20261122"]);
});

test("points: 100 × credited ÷ expected in hundredths, capped at 150 (owner 11 Nov, was 130)", () => {
  assert.equal(F.producerPoints(row(100, 100)), 10000);
  assert.equal(F.producerPoints(row(97.5, 100)), 9750);
  assert.equal(F.producerPoints(row(140, 100)), 14000, "140 is under the new cap (130 would have cut it)");
  assert.equal(F.producerPoints(row(170, 100)), 15000);
  assert.equal(F.producerPoints({ credited: "2", expected: "3", void: false }), 6666, "floor, not round");
});

test("points: a void day scores 0; a quiet or offline day scores what it earned (owner 11 Nov)", () => {
  assert.equal(F.producerPoints(row(120, 100, { void: true })), 0, "void: 0 that day");
  assert.equal(F.producerPoints(row(0, 2.5)), 0, "quiet (no block): 0 earned, not void");
  assert.equal(F.producerPoints(row(3, 2.5)), 12000, "a small producer's lucky day");
  assert.equal(F.producerPoints(row(0, 0)), 0, "nothing expected");
  assert.equal(F.producerPoints(undefined), 0);
});

test("points: the captain counts twice", () => {
  const rows = { [A]: row(110, 100), [B]: row(100, 100), [C]: row(90, 100), [D]: row(80, 100), [E]: row(200, 100) };
  assert.equal(F.dayPoints([A, B, C, D, E], rows), 2 * 11000 + 10000 + 9000 + 8000 + 15000);
  assert.equal(F.dayPoints([E, A, B, C, D], rows), 2 * 15000 + 11000 + 10000 + 9000 + 8000);
  assert.equal(F.dayPoints(null, rows), 0);
});

test("form: void days are left out; quiet days count; no row = no data", () => {
  const days = [{ rows: { [A]: row(100, 100) } }, { rows: { [A]: row(0, 100) } }, { rows: { [A]: row(150, 100, { void: true }) } }, { rows: {} }];
  assert.deepEqual(F.formOf(A, days), { form: 5000, days: 2 }, "(100 + 0) ÷ (100 + 100); the void and the missing day left out");
  assert.deepEqual(F.formOf(B, days), { form: null, days: 0 });
});

test("price: 20 + 1.5 × (form − median), half up, clamped 8–40, whole numbers (JS = Python)", () => {
  assert.equal(F.priceOf(10000, 10000), 20);
  assert.equal(F.priceOf(10100, 10000), 22, "+1.00 → +1.5 → 21.5 rounds up to 22");
  assert.equal(F.priceOf(9900, 10000), 19, "−1.5 → 18.5 rounds half up to 19");
  assert.equal(F.priceOf(9933, 10000), 19, "−1.005 → 18.995 → 19");
  assert.equal(F.priceOf(20000, 10000), 40);
  assert.equal(F.priceOf(1000, 10000), 8);
  assert.equal(F.priceOf(null, 10000), 20);
  for (let d = -3000; d <= 3000; d += 7) { const want = Math.min(40, Math.max(8, Math.floor(20 + 1.5 * d / 100 + 0.5 + 1e-9))); assert.equal(F.priceOf(10000 + d, 10000), want, `Δ ${d}`); }
});

test("price list: pool = entry on the last form day (the 80% gate); median, budget, hashes; deterministic", () => {
  const days = F.formDays(MON);
  const mk = (i, extra = {}) => ({ round: F.ymd(days[i]), rows: { [A]: row(100, 100), [B]: row(105, 100), [C]: row(95, 100), [D]: row(100, 50), [E]: row(80, 100), [G]: row(100, 100, { entry: i !== 6 }), ...extra } });
  const cards = days.map((_, i) => mk(i));
  const pl = F.makePriceList(MON, { ownRule: "spot" }, cards);
  assert.deepEqual(pl.pool.map((p) => p.a), [A, B, C, D, E], "G has no entry on Thursday's card: not listed");
  assert.equal(pl.median, 10000);
  assert.deepEqual(pl.pool.map((p) => [p.form, p.days, p.price]), [[10000, 7, 20], [10500, 7, 28], [9500, 7, 13], [20000, 7, 40], [8000, 7, 8]]);
  assert.equal(pl.budget, 109, "the five cheapest cost 109 > 100: the budget rises");
  assert.equal(pl.poolDay, "20261112");
  assert.equal(pl.formDays.length, 7);
  assert.deepEqual(F.makePriceList(MON, { ownRule: "spot" }, cards), pl, "the recount gives the same list");
  assert.throws(() => F.makePriceList(MON, {}, cards.slice(1)));
  assert.throws(() => F.makePriceList(MON, {}, [...cards.slice(1), cards[0]]), /form day/);
});

test("teams: 5 different listed producers within the budget", () => {
  const pl = { budget: 100, pool: [A, B, C, D, E, G].map((a) => ({ a, price: 20 })) };
  assert.equal(F.checkTeam([A, B, C, D, E], pl).ok, true);
  assert.match(F.checkTeam([A, B, C, D], pl).why, /5 producers/);
  assert.match(F.checkTeam([A, A, C, D, E], pl).why, /twice/);
  assert.match(F.checkTeam([A, B, C, D, "1HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH"], pl).why, /price list/);
  assert.match(F.checkTeam([A, B, C, D, E], { ...pl, pool: pl.pool.map((p) => ({ ...p, price: 21 })) }).why, /budget/);
});

test("changes (FC-22, owner 11 Nov): a swapped-in producer may take the armband from any producer in one change", () => {
  const t = [A, B, C, D, E];
  assert.equal(F.changes(t, [A, B, C, D, G]), 1, "a swap");
  assert.equal(F.changes(t, [B, A, C, D, E]), 1, "the armband moved to a producer already on the team");
  assert.equal(F.changes(t, [G, B, C, D, A]), 1, "G replaces E and takes the armband from A (a third producer): one change");
  assert.equal(F.changes(t, [B, A, C, D, G]), 2, "a swap plus moving the armband to B (already on the team): two");
  assert.equal(F.changes(t, [A, B, C, G, "1HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH"]), 2);
});

test("nextTeam: Monday any valid team; then one change a day; an invalid pick keeps yesterday's team", () => {
  const H = "1HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH";
  const pl = { budget: 100, pool: [A, B, C, D, E, G, H].map((a) => ({ a, price: 20 })) };
  const t = [A, B, C, D, E];
  assert.deepEqual(F.nextTeam(null, t, pl, true).team, t);
  assert.deepEqual(F.nextTeam(t, [G, H, C, D, E], pl, true).team, [G, H, C, D, E], "Monday: any number of changes");
  assert.deepEqual(F.nextTeam(t, [G, H, C, D, E], pl, false), { team: t, note: "ignored: more than one change from yesterday" });
  assert.deepEqual(F.nextTeam(t, [G, B, C, D, A], pl, false).team, [G, B, C, D, A]);
  assert.equal(F.nextTeam(t, [A, B, C, D], pl, false).team, t);
  assert.equal(F.nextTeam(t, null, pl, false).team, t, "no pick: yesterday's team");
  assert.equal(F.nextTeam(t, [...t], pl, false).team, t, "the same team: unchanged");
});

test("Weekly Rival: both staked and both scored; mutual challenges are one match; records only", () => {
  const pts = new Map([[A, 50000], [B, 40000], [C, 40000], [D, 0]]), staked = new Set([A, B, C, D]);
  assert.deepEqual(F.matches([[A, B], [B, A], [C, B], [A, D], [A, E], [A, A]], pts, staked), [[A, B, 1, "a"], [C, B, 0, "d"]]);
  assert.deepEqual(F.matches([[A, B]], pts, new Set([A])), [], "an unstaked rival: no match");
});
