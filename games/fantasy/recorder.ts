// Fantasy Producers (game 4) with Weekly Rival (game 5), on the Shared Game Kit (D-158 #4: Fantasy is the kit's first
// game). The kit does the reading, stakes, clock, files, pending → final, holds, boards, all-time, the vault file and
// alerts; this module supplies the week's rounds, the write-once price list, each day's result from the VHP Ruler, the
// scoring, the carried team and the Rival records. Every rule is in math.js; how a UTC day becomes a ruler card is in
// ruler-view.ts.
//
// Rounds: Monday to Saturday play days, then Sunday's fun round (the Saturday team plays on; counts on Today and All
// time only, D-150). A round's Picks round is its day number (Picks game 4: time lock, round size one day, lead 5 min).
// Points are in hundredths of an index point (a producer's day is at most 15000 = 150.00; a team's at most 90000).
// Nothing is ever guessed: while the ruler data or the block clock doesn't reach a day, the kit's NotYet keeps the
// round PENDING (or the price list waiting); a flagged card, or a listed producer missing from a card, stays PENDING
// too, for the owner's hold/release.
import { DAY } from "../../kit/recorder/clock.ts";
import { PENDING, type GameModule, type Round, type States, type Score } from "../../kit/recorder/types.ts";
import type { RawPick } from "../../kit/recorder/sources/picks-contract.ts";
import * as F from "./math.js";
import { CARD, dayCard, flagged, rowsOf, sourcesOf } from "./ruler-view.ts";

export const VAULT_GAME = 4;                 // FC-29: one constant
export const RIVAL_GAME = 5;
export { CARD };

export type PriceList = ReturnType<typeof F.makePriceList>;
/** A day's result: its ruler round and each listed producer's [credited, expected, void] (millionths of a block). */
export type DayResult = { round: string; rows: Record<string, [string, string, boolean]> };
/** A wallet's carried state: its team (captain first) and when it was picked (chain ms). */
export type TeamState = { t: string[]; at: number };

const dayNo = (t: number) => Math.floor(t / DAY);
const asRows = (r: DayResult) => Object.fromEntries(Object.entries(r.rows).map(([a, [credited, expected, v]]) => [a, { credited, expected, void: v }]));

export const game: GameModule<RawPick, DayResult, PriceList> = {
  slug: "fantasy",
  picks: [{ source: "picks-contract", gameId: VAULT_GAME }, { source: "picks-contract", gameId: RIVAL_GAME }],
  extraPickRounds: (week, s) => (s.gameId === RIVAL_GAME ? [dayNo(week.start)] : []),

  roundsFor(week): Round[] {
    return F.weekDays(week.start).map((day) => ({ id: `d${F.ymd(day)}`, day, locksAt: day, resolvesAt: day + DAY, pickRound: dayNo(day) }));
  },

  /** The write-once price list (FC-9), made Saturday 00:00 UTC before the week from 7 ruler day cards (Friday to
   *  Thursday before), and made again at the week's end for the recount: the same cards give the same bytes. A card
   *  that isn't ready throws the kit's NotYet (the list waits and the next run tries again); a flagged one stops it. */
  async inputsFor(week, ctx) {
    const src = sourcesOf(ctx);
    const cards = [];
    for (const day of F.formDays(week.start)) {
      const c = await dayCard(day, src);
      if (flagged(c)) throw new Error(`price list for week ${week.week}: the ruler card for ${c.round} is flagged (a bad or rebuilt hour); the owner checks it`);
      cards.push({ round: c.round, rows: rowsOf(c) });
    }
    return F.makePriceList(week.start, { ...CARD, pooled: [...CARD.pooled] }, cards);
  },

  /** A day's result from its ruler card: PENDING while it is flagged, and while a listed producer has no row (the
   *  ruler's G6 `include` gives every listed producer one; until then such a day waits, never a silent 0). */
  async resultOf(round, _read, inputs, ctx) {
    if (!inputs) return PENDING;
    const c = await dayCard(round.day, sourcesOf(ctx));
    if (flagged(c)) return PENDING;
    const by = rowsOf(c), rows: DayResult["rows"] = {};
    for (const { a } of inputs.pool) {
      const r = by[a];
      if (!r) return PENDING;
      rows[a] = [String(r.credited), String(r.expected), r.void === true];
    }
    return { round: c.round, rows };
  },

  /** Every wallet with a team scores, picked that day or not. Score time (D-152/D-159 ties): when the team in force
   *  was picked, never before the week starts (owner question: earlier team wins a tie). */
  scoreRound(round, _picks, result, inputs, state): Score {
    const out: Score = new Map();
    const rows = asRows(result), start = inputs?.start ?? round.day;
    for (const [a, s] of (state ?? new Map()) as States<TeamState>) {
      const points = F.dayPoints(s.t, rows);
      out.set(a, { points, at: points > 0 ? Math.min(round.day, Math.max(start, s.at)) : 0 });
    }
    return out;
  },

  /** Last week's final Saturday team plays on into Monday only if it still fits this week's price list (FC-5). */
  carryIn(last, _week, inputs) {
    const out: States<TeamState> = new Map();
    if (!inputs) return out;
    for (const [a, s] of last as States<TeamState>) if (s && F.checkTeam(s.t, inputs).ok) out.set(a, s);
    return out;
  },

  /** A day's picks applied in lock order: Monday any valid team; then one change a day; Sunday has no picks. */
  nextState(state, picks, round, inputs) {
    const next: States<TeamState> = new Map(state as States<TeamState>);
    if (!inputs) return next;
    const offset = round.day - inputs.start;
    if (offset < 0 || offset >= F.PLAY_DAYS * DAY) return next;
    for (const p of picks) {
      const list = Array.isArray(p.pick?.producers) ? p.pick.producers : null;
      const cur = next.get(p.wallet)?.t ?? null;
      const r = F.nextTeam(cur, list, inputs, offset === 0);
      if (r.team && r.team !== cur) next.set(p.wallet, { t: r.team, at: p.at });
    }
    return next;
  },

  /** Weekly Rival (game 5): records only, never paid (both staked, both scored). */
  weekExtras(week, ctx) {
    const picks = ctx.picks.get(RIVAL_GAME)?.get(dayNo(week.start)) ?? [];
    const challenges = picks.map((p) => [p.wallet, (p.pick as RawPick)?.producers?.[0]] as [string, string]);
    return { rival: F.matches(challenges, ctx.points, ctx.staked) };
  },
};
