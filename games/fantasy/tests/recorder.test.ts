// Fantasy Producers on the kit: the GameModule against the kit's real sources.
// - Unit: a fake ctx.vhp (cards built from given rows) and a fake ctx.blockAt (3-second blocks).
// - End to end: the REAL ruler (kit/recorder/sources/vhp-ruler.ts over the Race's made-up 24-day chain,
//   tests/audit/race-ruler.fixture.mjs), with blockAt worked out from that chain's block times.
import test from "node:test";
import assert from "node:assert/strict";
import { game, CARD, type PriceList, type TeamState } from "../recorder.ts";
import { daySettings, LEAD, LOOK_BACK } from "../ruler-view.ts";
import { PENDING } from "../../../kit/recorder/types.ts";
import { NotYet, vhpFor } from "../../../kit/recorder/sources/vhp-ruler.ts";
import * as F from "../math.js";
import { R, timeline, FROM, T_FIRST, P, N } from "../../../tests/audit/race-ruler.fixture.mjs";

const DAY = 86400000, MON = Date.UTC(2026, 10, 16);
const WEEK = { week: 4, start: MON, end: MON + 7 * DAY };
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const D = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", E = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", G = "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG";
const W1 = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1", W2 = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW2";
const BLOCK0 = 1000000, T0 = Date.UTC(2026, 9, 1);
/** A fake block clock: one block every 3 s from T0; `upTo` = the last irreversible time. */
const clock = (upTo = Infinity) => async (ms: number) => { if (ms > upTo) throw new NotYet("not yet: not irreversible"); return BLOCK0 + Math.ceil((ms - T0) / 3000); };
type Row = { credited: number; expected: number; void?: boolean; entry?: boolean; quality?: "ok" | "flagged" };
/** A fake ruler: the card for a settings object, from rows given per round (yyyymmdd); null = NotYet. */
function fakeVhp(rowsFor: (round: string) => Record<string, Row> | null) {
  const asked: any[] = [];
  return {
    asked, ruleVersion: 4, to: 0,
    card(s: any) {
      asked.push(s);
      const rows = rowsFor(s.round);
      if (!rows) throw new NotYet(`not yet: ${s.round}`);
      return { ruleVersion: 4, game: s.game, round: s.round, producers: Object.entries(rows).map(([a, r]) => ({ a, credited: String(r.credited * 1e6), expected: String(r.expected * 1e6), void: !!r.void, entry: r.entry ?? true, quality: r.quality ?? "ok" })) };
    },
  };
}
const base = (): Record<string, Row> => ({ [A]: { credited: 100, expected: 100 }, [B]: { credited: 100, expected: 100 }, [C]: { credited: 100, expected: 100 }, [D]: { credited: 100, expected: 100 }, [E]: { credited: 100, expected: 100 }, [G]: { credited: 100, expected: 100 } });
const ctxOf = (vhp: unknown, blockAt: unknown = clock()) => ({ now: MON, vhp, blockAt } as any);
const priceList = async () => (await game.inputsFor!(WEEK, ctxOf(fakeVhp(base)))) as PriceList;

test("rounds: Monday to Sunday, one a UTC day, id d<yyyymmdd>, Picks round = the day number, day = dayOf(locksAt)", () => {
  const rs = game.roundsFor(WEEK, { now: MON });
  assert.deepEqual(rs.map((x) => x.id), ["d20261116", "d20261117", "d20261118", "d20261119", "d20261120", "d20261121", "d20261122"]);
  for (const x of rs) { assert.equal(x.locksAt, x.day); assert.equal(x.pickRound, x.day / DAY); assert.equal(x.resolvesAt, x.day + DAY); }
});

test("day window: S0 = the day's first block, S1 = the last, L = the last block before the 5-minute lock (Picks.ts)", async () => {
  const at = clock(), s = await daySettings(MON, at);
  const S0 = await at(MON), next = await at(MON + DAY), lockB = await at(MON - LEAD);
  assert.deepEqual(s.window, { W0: lockB - 1 - LOOK_BACK, W1: lockB - 1, L: lockB - 1, S0, S1: next - 1 });
  assert.equal(s.round, "20261116");
  assert.equal(s.game, 4);
  assert.deepEqual({ ...s, round: undefined, window: undefined }, { ...CARD, pooled: [...CARD.pooled], round: undefined, window: undefined });
});

test("no ruler data or no block clock yet → the kit's NotYet (the list waits, the day stays pending), never a guess", async () => {
  await assert.rejects(() => game.inputsFor!(WEEK, ctxOf(undefined)), NotYet);
  await assert.rejects(() => game.inputsFor!(WEEK, ctxOf(fakeVhp(base), null)), NotYet, "before the kit's blockAt (G7)");
  const pl = await priceList(), [mon] = game.roundsFor(WEEK, { now: MON });
  await assert.rejects(() => game.resultOf(mon, {} as any, pl, ctxOf(fakeVhp(() => null))), NotYet);
  await assert.rejects(() => game.resultOf(mon, {} as any, pl, ctxOf(fakeVhp(base), clock(MON))), NotYet, "the day's last block isn't irreversible");
});

test("inputsFor: 7 cards Fri–Thu, pool from Thursday's entry list, Fantasy's own settings; the recount is byte-equal", async () => {
  const vhp = fakeVhp(base);
  const pl = (await game.inputsFor!(WEEK, ctxOf(vhp))) as PriceList;
  assert.deepEqual(vhp.asked.map((s) => s.round), F.formDays(MON).map(F.ymd));
  assert.ok(vhp.asked.every((s) => s.game === 4 && s.minK === 10 && s.ownRule === "spot" && s.poolRule === "min" && s.c === "500000"));
  assert.deepEqual(pl.formDays, F.formDays(MON).map(F.ymd));
  assert.equal(pl.poolDay, "20261112");
  assert.equal(pl.pool.length, 6);
  assert.deepEqual(await game.inputsFor!(WEEK, ctxOf(fakeVhp(base))), pl);
});

test("inputsFor: a flagged form card stops the list (the owner checks it)", async () => {
  const last = F.ymd(F.formDays(MON)[6]);
  await assert.rejects(() => game.inputsFor!(WEEK, ctxOf(fakeVhp((r) => (r === last ? { ...base(), [A]: { credited: 1, expected: 1, quality: "flagged" } } : base())))), /flagged/);
});

test("resultOf: PENDING while flagged, or when a listed producer has no row (G6); otherwise the listed rows", async () => {
  const pl = await priceList(), [mon] = game.roundsFor(WEEK, { now: MON });
  assert.equal(await game.resultOf(mon, {} as any, pl, ctxOf(fakeVhp(() => ({ ...base(), [B]: { credited: 1, expected: 1, quality: "flagged" } })))), PENDING);
  const noG = () => { const x = base(); delete x[G]; return x; };
  assert.equal(await game.resultOf(mon, {} as any, pl, ctxOf(fakeVhp(noG))), PENDING, "a listed producer with no row holds the day");
  const extra = "1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  const res = await game.resultOf(mon, {} as any, pl, ctxOf(fakeVhp(() => ({ ...base(), [extra]: { credited: 5, expected: 5 } })))) as any;
  assert.equal(res.round, "20261116");
  assert.deepEqual(Object.keys(res.rows).sort(), [A, B, C, D, E, G].sort(), "only listed producers are kept");
  assert.deepEqual(res.rows[A], ["100000000", "100000000", false]);
});

test("scoreRound: every wallet with a team scores; void 0; quiet day as earned; cap 150; captain ×2; score time = when the team was picked", async () => {
  const pl = await priceList(), [mon, tue] = game.roundsFor(WEEK, { now: MON });
  const rows = { ...base(), [A]: { credited: 200, expected: 100 }, [B]: { credited: 120, expected: 100, void: true }, [C]: { credited: 0, expected: 3 } };
  const res = await game.resultOf(tue, {} as any, pl, ctxOf(fakeVhp(() => rows)));
  const state = new Map<string, TeamState>([[W1, { t: [A, B, C, D, E], at: MON - 60000 }], [W2, { t: [D, E, G, A, B], at: MON + DAY - 9e5 }]]);
  const s = game.scoreRound(tue, [], res as any, pl, state);
  assert.deepEqual(s.get(W1), { points: 2 * 15000 + 0 + 0 + 10000 + 10000, at: MON }, "a team from before the week counts from its start");
  assert.deepEqual(s.get(W2), { points: 2 * 10000 + 10000 + 10000 + 15000 + 0, at: MON + DAY - 9e5 });
  void mon;
});

test("carryIn: last week's team plays on only if it fits this week's list (FC-5)", async () => {
  const pl = await priceList(), H = "1HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH";
  const last = new Map<string, TeamState>([[W1, { t: [A, B, C, D, E], at: 1 }], [W2, { t: [A, B, C, D, H], at: 1 }]]);
  assert.deepEqual([...game.carryIn!(last, WEEK, pl).keys()], [W1]);
});

test("nextState: Monday any team; one change on later days (FC-22 captaincy); Sunday takes no picks", async () => {
  const pl = await priceList(), rs = game.roundsFor(WEEK, { now: MON });
  const pick = (w: string, list: string[], at: number) => ({ wallet: w, round: "x", pick: { producers: list }, at });
  let st = game.nextState!(new Map(), [pick(W1, [A, B, C, D, E], MON - 9e5)], rs[0], pl) as Map<string, TeamState>;
  assert.deepEqual(st.get(W1), { t: [A, B, C, D, E], at: MON - 9e5 });
  st = game.nextState!(st, [pick(W1, [G, B, C, D, A], MON + DAY - 9e5)], rs[1], pl) as Map<string, TeamState>;
  assert.deepEqual(st.get(W1)!.t, [G, B, C, D, A]);
  const before = st.get(W1);
  st = game.nextState!(st, [pick(W1, [A, E, C, D, G], MON + 2 * DAY - 9e5)], rs[2], pl) as Map<string, TeamState>;
  assert.equal(st.get(W1), before, "two changes: ignored");
  st = game.nextState!(st, [pick(W1, [A, B, C, D, E], MON + 6 * DAY - 9e5)], rs[6], pl) as Map<string, TeamState>;
  assert.equal(st.get(W1), before, "Sunday: the Saturday team plays on");
});

test("weekExtras: Weekly Rival from Picks game 5's Monday round, records only", () => {
  const picks = new Map([[5, new Map([[MON / DAY, [{ wallet: W1, round: "r", pick: { producers: [W2] }, at: 0 }]]])]]);
  assert.deepEqual(game.weekExtras!(WEEK, { points: new Map([[W1, 60000], [W2, 50000]]), picks, staked: new Set([W1, W2]) } as any), { rival: [[W1, W2, 0, "a"]] });
  assert.deepEqual(game.extraPickRounds!(WEEK, { source: "picks-contract", gameId: 5 }), [MON / DAY]);
  assert.deepEqual(game.extraPickRounds!(WEEK, { source: "picks-contract", gameId: 4 }), []);
});

// ── end to end on the real ruler ──
const realBlockAt = (tl: any) => async (ms: number) => {
  const h = FROM + Math.ceil((ms - T_FIRST) / 3000);
  if (h > tl.to - 60) throw new NotYet("not yet: past the made-up chain's last irreversible block");
  return h;
};

test("real ruler: a week of day results (Mon 2 – Sun 8 Nov on the made-up chain), scored with a carried team", async () => {
  const tl = timeline(), vhp = vhpFor(R.ledger(tl), new Map()), ctx = ctxOf(vhp, realBlockAt(tl));
  const start = Date.UTC(2026, 10, 2), week = { week: 2, start, end: start + 7 * DAY };
  // A price list listing the chain's five producers (the real cards decide entry; here the week's list is given).
  const pl = { ...(await priceList()), start, pool: P.map((a: string) => ({ a, form: 10000, days: 7, price: 20 })), budget: 100 } as PriceList;
  const state = new Map<string, TeamState>([[W1, { t: [...P], at: start - 9e5 }]]);
  let total = 0;
  for (const r of game.roundsFor(week, { now: start })) {
    const res = await game.resultOf(r, {} as any, pl, ctx) as any;
    assert.notEqual(res, PENDING, `${r.id} decided`);
    assert.equal(res.round, F.ymd(r.day));
    for (const a of P) assert.match(res.rows[a][1], /^[0-9]+$/);
    const s = game.scoreRound(r, [], res, pl, state).get(W1)!;
    assert.ok(s.points >= 0 && s.points <= 90000);
    if (r.day - start < 6 * DAY) total += s.points;
  }
  // Five producers signing about their share: about 600 a day (captain double), so a week near 3,600.
  assert.ok(total > 6 * 40000 && total < 6 * 80000, `week total ${total}`);
});

test("real ruler: past the chain's end the day is NotYet (pending), not a guess", async () => {
  const tl = timeline(), ctx = ctxOf(vhpFor(R.ledger(tl), new Map()), realBlockAt(tl));
  // The first whole UTC day after the made-up chain's last block (the fixture's length may grow; this follows it).
  const after = Math.floor((T_FIRST + N * 3000) / DAY) * DAY + DAY, start = after - ((after / DAY + 3) % 7) * DAY;
  const pl = { ...(await priceList()), start, pool: P.map((a: string) => ({ a, form: 10000, days: 7, price: 20 })) } as PriceList;
  const round = game.roundsFor({ week: 3, start, end: start + 7 * DAY }, { now: start }).find((r) => r.day === after)!;
  assert.ok(round, "that day is a round of its week");
  await assert.rejects(() => game.resultOf(round, {} as any, pl, ctx), NotYet);
});
