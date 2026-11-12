// Fantasy Producers (game 4) with Weekly Rival (game 5), on the Shared Game Kit (D-158 #4: Fantasy is the kit's first
// game). The kit does the reading, stakes, clock, files, pending → final, holds, boards, all-time, the vault file and
// alerts; this module supplies the week's rounds, the write-once price list, each day's result from the VHP Ruler, the
// scoring, the carried team and the Rival records. Every rule is in math.js.
//
// Rounds: Monday to Saturday play days, then Sunday's fun round (the Saturday team plays on; counts on Today and All
// time only, D-150). A round's Picks round is its day number (Picks game 4 locks each day 5 minutes before it starts).
// Points are in hundredths of an index point (a producer's day is at most 15000 = 150.00).
import { DAY } from "../../kit/recorder/clock.ts";
import { PENDING, type GameModule, type Round, type States, type Score } from "../../kit/recorder/types.ts";
import type { RawPick } from "../../kit/recorder/sources/picks-contract.ts";
import * as F from "./math.js";
import { rulerOf, type CardSettings } from "./ruler-view.ts";

export const VAULT_GAME = 4;                 // FC-29: one constant
export const RIVAL_GAME = 5;
const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
export const CARD: CardSettings = { ownRule: "spot", minK: 10, poolRule: "min", c: "500000", paying: true, pooled: [VAULT] };

export type PriceList = ReturnType<typeof F.makePriceList>;
/** A day's result: the card's hash and each pool producer's [credited, expected, void]. */
export type DayResult = { round: string; card: string; rows: Record<string, [string, string, boolean]> };
/** A wallet's carried state: its team (captain first) and when it was picked (chain ms). */
export type TeamState = { t: string[]; at: number };

const dayNo = (t: number) => Math.floor(t / DAY);
const rowsOf = (r: DayResult) => Object.fromEntries(Object.entries(r.rows).map(([a, [credited, expected, v]]) => [a, { credited, expected, void: v }]));

export const game: GameModule<RawPick, DayResult, PriceList> = {
  slug: "fantasy",
  picks: [{ source: "picks-contract", gameId: VAULT_GAME }, { source: "picks-contract", gameId: RIVAL_GAME }],
  extraPickRounds: (week, s) => (s.gameId === RIVAL_GAME ? [dayNo(week.start)] : []),

  roundsFor(week): Round[] {
    return F.weekDays(week.start).map((day) => ({ id: `d${F.ymd(day)}`, day, locksAt: day, resolvesAt: day + DAY, pickRound: dayNo(day) }));
  },

  /** The write-once price list (FC-9), made Saturday 00:00 UTC before the week from 7 ruler day cards, and made again
   *  at the week's end for the recount: the same cards give the same bytes. */
  async inputsFor(week, ctx) {
    const ruler = rulerOf(ctx);
    if (!ruler) throw new Error("Fantasy's price list needs the kit's VHP Ruler source (ctx.vhp, kit Phase 1b)");
    const cards = [];
    for (const day of F.formDays(week.start)) {
      const c = await ruler.dayCard(day, CARD, []);
      if (c.state !== "ready") throw new Error(`price list for week ${week.week}: the card for ${F.ymd(day)} is not ready (${c.why})`);
      if (c.quality !== "ok") throw new Error(`price list for week ${week.week}: the card for ${F.ymd(day)} is flagged`);
      if (c.ruleVersion !== 4) throw new Error(`price list for week ${week.week}: ruler version ${c.ruleVersion}, not 4`);
      cards.push({ round: c.round, sha256: c.sha256, rows: c.rows });
    }
    return F.makePriceList(week.start, CARD, cards);
  },

  /** A day's result from its ruler card. PENDING (never a guess) until the card is ready, while it is flagged (the
   *  owner's hold/release decides, FC-11), and if a pool producer has no row (Ruler chat G6: every listed producer
   *  must have one; a missing row holds the day, never a silent 0). */
  async resultOf(round, _read, inputs, ctx?: unknown) {
    const ruler = rulerOf(ctx);
    if (!ruler || !inputs) return PENDING;
    const pool = inputs.pool.map((p) => p.a);
    const c = await ruler.dayCard(round.day, inputs.card as CardSettings, pool);
    if (c.state !== "ready" || c.quality !== "ok" || c.ruleVersion !== 4 || c.round !== F.ymd(round.day)) return PENDING;
    const rows: DayResult["rows"] = {};
    for (const a of pool) {
      const r = c.rows[a];
      if (!r) return PENDING;
      rows[a] = [r.credited, r.expected, r.void === true];
    }
    return { round: c.round, card: c.sha256, rows };
  },

  /** Every wallet with a team scores, picked that day or not. Score time (D-152/D-159 ties): the day it counted. */
  scoreRound(round, _picks, result, _inputs, state): Score {
    const out: Score = new Map();
    const rows = rowsOf(result);
    for (const [a, s] of (state ?? new Map()) as States<TeamState>) {
      const points = F.dayPoints(s.t, rows);
      out.set(a, { points, at: points > 0 ? round.day : 0 });
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
