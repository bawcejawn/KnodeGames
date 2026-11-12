// Fantasy Producers on the kit: the GameModule with a fake VHP Ruler source (the contract in ruler-view.ts that kit
// Phase 1b's ctx.vhp must meet). Rounds, the price list, day results (PENDING rules), scoring with the carried team,
// carryIn, nextState and the Rival extras.
import test from "node:test";
import assert from "node:assert/strict";
import { game, CARD, type PriceList, type TeamState } from "../recorder.ts";
import { PENDING } from "../../../kit/recorder/types.ts";
import type { DayCard, RulerRow, RulerView } from "../ruler-view.ts";
import * as F from "../math.js";

const DAY = 86400000, MON = Date.UTC(2026, 10, 16);
const WEEK = { week: 4, start: MON, end: MON + 7 * DAY };
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const D = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", E = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", G = "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG";
const W1 = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1", W2 = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW2";
const r = (cr: number, ex: number, v = false, entry = true): RulerRow => ({ credited: String(cr * 1000000), expected: String(ex * 1000000), void: v, entry });

/** A fake ruler: every day ready with the given rows unless told otherwise. */
function fakeRuler(rowsFor: (day: number) => Record<string, RulerRow> | null, quality: (day: number) => "ok" | "flagged" = () => "ok"): RulerView & { asked: [number, string[]][] } {
  const asked: [number, string[]][] = [];
  return {
    asked,
    async dayCard(day, _s, include): Promise<DayCard> {
      asked.push([day, include]);
      const rows = rowsFor(day);
      return rows ? { state: "ready", round: F.ymd(day), sha256: `c${F.ymd(day)}`.padEnd(64, "0"), quality: quality(day), ruleVersion: 4, rows } : { state: "not-yet", why: "vhp-data does not cover it yet" };
    },
  };
}
const base = () => ({ [A]: r(100, 100), [B]: r(100, 100), [C]: r(100, 100), [D]: r(100, 100), [E]: r(100, 100), [G]: r(100, 100) });
const ctxOf = (vhp: unknown) => ({ now: MON, vhp } as any);

async function priceList(): Promise<PriceList> {
  return (await game.inputsFor!(WEEK, ctxOf(fakeRuler(base)))) as PriceList;
}

test("rounds: Monday to Sunday, one a UTC day, id d<yyyymmdd>, Picks round = the day number, day = dayOf(locksAt)", () => {
  const rs = game.roundsFor(WEEK, { now: MON });
  assert.equal(rs.length, 7);
  assert.deepEqual(rs.map((x) => x.id), ["d20261116", "d20261117", "d20261118", "d20261119", "d20261120", "d20261121", "d20261122"]);
  for (const x of rs) { assert.equal(x.locksAt, x.day); assert.equal(x.pickRound, x.day / DAY); assert.equal(x.resolvesAt, x.day + DAY); }
});

test("inputsFor: no ruler source yet (before kit Phase 1b) → no price list, an error, never a guess", async () => {
  await assert.rejects(() => game.inputsFor!(WEEK, ctxOf(undefined)), /ctx\.vhp/);
});

test("inputsFor: 7 form cards Fri–Thu, pool from Thursday's entry list, the card settings the Ruler chat gave", async () => {
  const ruler = fakeRuler(base);
  const pl = (await game.inputsFor!(WEEK, ctxOf(ruler))) as PriceList;
  assert.deepEqual(ruler.asked.map(([d]) => F.ymd(d)), F.formDays(MON).map(F.ymd));
  assert.deepEqual(pl.card, CARD);
  assert.equal(pl.start, MON);
  assert.equal(pl.pool.length, 6);
  assert.ok(pl.pool.every((p) => p.price === 20));
  const again = await game.inputsFor!(WEEK, ctxOf(fakeRuler(base)));
  assert.deepEqual(again, pl, "the week-end recount gives the same list");
});

test("inputsFor: a form card not ready or flagged → no list yet (the kit retries)", async () => {
  const last = F.formDays(MON)[6];
  await assert.rejects(() => game.inputsFor!(WEEK, ctxOf(fakeRuler((d) => (d === last ? null : base())))), /not ready/);
  await assert.rejects(() => game.inputsFor!(WEEK, ctxOf(fakeRuler(base, (d) => (d === last ? "flagged" : "ok"))), /flagged/));
});

test("resultOf: PENDING without the ruler, before the card, while flagged, or when a pool producer has no row (G6)", async () => {
  const pl = await priceList(), [mon] = game.roundsFor(WEEK, { now: MON });
  assert.equal(await game.resultOf(mon, {} as any, pl), PENDING, "no ctx: never a guess");
  assert.equal(await (game.resultOf as any)(mon, {}, pl, ctxOf(fakeRuler(() => null))), PENDING);
  assert.equal(await (game.resultOf as any)(mon, {}, pl, ctxOf(fakeRuler(base, () => "flagged"))), PENDING);
  const noG = () => { const x: any = base(); delete x[G]; return x; };
  assert.equal(await (game.resultOf as any)(mon, {}, pl, ctxOf(fakeRuler(noG))), PENDING, "a listed producer with no row holds the day");
  const ruler = fakeRuler(base);
  const res = await (game.resultOf as any)(mon, {}, pl, ctxOf(ruler));
  assert.equal(res.round, "20261116");
  assert.deepEqual(Object.keys(res.rows).sort(), [A, B, C, D, E, G].sort());
  assert.deepEqual(ruler.asked[0][1], pl.pool.map((p) => p.a), "the day card is asked to include every listed producer");
});

test("scoreRound: every wallet with a team scores, picked that day or not; void 0; cap 150; captain ×2", async () => {
  const pl = await priceList(), [mon] = game.roundsFor(WEEK, { now: MON });
  const rows = { ...base(), [A]: r(200, 100), [B]: r(90, 100, true), [C]: r(0, 3) };
  const res = await (game.resultOf as any)(mon, {}, pl, ctxOf(fakeRuler(() => rows)));
  const state = new Map<string, TeamState>([[W1, { t: [A, B, C, D, E], at: MON - 60000 }], [W2, { t: [D, E, G, A, B], at: MON - 60000 }]]);
  const s = game.scoreRound(mon, [], res, pl, state);
  assert.deepEqual(s.get(W1), { points: 2 * 15000 + 0 + 0 + 10000 + 10000, at: mon.day });
  assert.deepEqual(s.get(W2), { points: 2 * 10000 + 10000 + 10000 + 15000 + 0, at: mon.day });
});

test("carryIn: last week's team plays on only if it fits this week's list (FC-5)", async () => {
  const pl = await priceList();
  const H = "1HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH";
  const last = new Map<string, TeamState>([[W1, { t: [A, B, C, D, E], at: 1 }], [W2, { t: [A, B, C, D, H], at: 1 }]]);
  assert.deepEqual([...game.carryIn!(last, WEEK, pl).keys()], [W1]);
});

test("nextState: Monday any team; one change on later days; Sunday takes no picks; an invalid pick keeps the team", async () => {
  const pl = await priceList(), rs = game.roundsFor(WEEK, { now: MON });
  const pick = (w: string, list: string[], at: number) => ({ wallet: w, round: "x", pick: { producers: list }, at });
  let st = game.nextState!(new Map(), [pick(W1, [A, B, C, D, E], MON - 9e5)], rs[0], pl) as Map<string, TeamState>;
  assert.deepEqual(st.get(W1), { t: [A, B, C, D, E], at: MON - 9e5 });
  st = game.nextState!(st, [pick(W1, [G, B, C, D, A], MON + DAY - 9e5)], rs[1], pl) as Map<string, TeamState>;
  assert.deepEqual(st.get(W1)!.t, [G, B, C, D, A], "Tuesday: G in for E, and G takes the armband from A (FC-22)");
  const before = st.get(W1);
  st = game.nextState!(st, [pick(W1, [A, E, C, D, G], MON + 2 * DAY - 9e5)], rs[2], pl) as Map<string, TeamState>;
  assert.equal(st.get(W1), before, "two changes: ignored");
  st = game.nextState!(st, [pick(W1, [A, B, C, D, E], MON + 6 * DAY - 9e5)], rs[6], pl) as Map<string, TeamState>;
  assert.equal(st.get(W1), before, "Sunday: the Saturday team plays on");
});

test("weekExtras: Weekly Rival from Picks game 5's Monday round, records only", () => {
  const picks = new Map([[5, new Map([[MON / DAY, [{ wallet: W1, round: "r", pick: { producers: [W2] }, at: 0 }]]])]]);
  const x = game.weekExtras!(WEEK, { points: new Map([[W1, 60000], [W2, 50000]]), picks, staked: new Set([W1, W2]) } as any);
  assert.deepEqual(x, { rival: [[W1, W2, 0, "a"]] });
  assert.deepEqual(game.extraPickRounds!(WEEK, { source: "picks-contract", gameId: 5 }), [MON / DAY]);
  assert.deepEqual(game.extraPickRounds!(WEEK, { source: "picks-contract", gameId: 4 }), []);
});
