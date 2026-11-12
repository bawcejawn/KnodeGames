// Survivor (game 3) on the Shared Game Kit (D-158: every new game launches on the kit). The kit does the reading,
// stakes, clock, files, pending → final, holds, boards, the vault file and alerts; this module supplies the season's
// rounds, each day's result from the VHP ruler, the carried picks and the scoring. Every rule is in math.js.
//
// ROUNDS: one per play day, Monday to Saturday (Sundays rest: no round, WEEK_CYCLE), for the vault weeks of a season.
//   A round's Picks round is its UTC day number (Picks game 3, round_size 1 day, lock 5 minutes before the day).
//   locksAt is the kit's day key, the end of the round's own UTC day (the kit's dayOf counts a time of exactly 00:00
//   for the day before); the real lock, 5 minutes before the day starts, is the Picks contract's, enforced on chain.
// RESULT: the day's ruler card (Survivor's settings, math.js CARD), its window from block heights:
//   S0 = the first block at or after 00:00 UTC of the day, S1 = the last block before the next 00:00, L = the last block
//   in which a pick for the day can land (the last block before the 23:55 lock), the size window W0 … W1 = the 7,200
//   blocks ending at L. The heights come from the kit's ctx.blockAt (kit G7): without it every day stays PENDING.
// INPUTS: every play day of the season so far, from the same cards (the season's earlier days decide each player's
//   lives, so a day's points need them). A day the data doesn't cover yet is left out (its round stays PENDING).
// STATE: each wallet's picks for the season, [[n, producer], …] (at most 12, about 500 bytes). Created by a pick for
//   season day 1 (nobody joins later); carried from the season's first week to its second; empty at a season's start.
// SCORE: math.js roundPoints: a round's points are the day's change in the wallet's season standing (the week's first
//   play day carries the whole standing), so the week's tally ranks the season as it stands at the week's end.
//   The two boards (staked in Survivor in either week of the season, or free) need the season's stakes: kit need K1.
import { DAY } from "../../kit/recorder/clock.ts";
import { PENDING, type GameModule, type Round, type Score, type States } from "../../kit/recorder/types.ts";
import type { RawPick } from "../../kit/recorder/sources/picks-contract.ts";
import * as S from "./math.js";

/** One play day's outcome: math.js dayFromCard. */
export type DayResult = { round: string; n: number; field: [string, number][]; out: string[]; void: string[] };
/** The season's days so far (inputs). */
export type SeasonInputs = { season: number; days: DayResult[]; waiting: string | null };
/** A wallet's carried state: its picks for the season. */
export type PicksState = { p: [number, string][] };

/** The kit's ruler and block-height readers, as this module uses them (kit Phase 1b ctx.vhp; kit G7 ctx.blockAt). */
type RulerCtx = { vhp?: { card(s: any): any }; blockAt?: (ms: number) => Promise<number> };
/** What scoreRound needs from the kit beyond today's arguments (kit need K1): who is on the staked board this season. */
type BoardCtx = { seasonStaked?: Set<string> };

const isAddr = (a: unknown): a is string => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);

function checkWeek(week: { week: number; start: number }) {
  if (week.start !== S.weekStart(week.week)) throw new Error(`Survivor: vault week ${week.week} starts at ${week.start}, not at math.js's ${S.weekStart(week.week)}: the vault's clock and math.js GENESIS disagree`);
}

/** The ruler card settings for the play day starting at `day`, from block heights (see the header). */
export async function settingsFor(day: number, blockAt: (ms: number) => Promise<number>) {
  const S0 = await blockAt(day);
  const S1 = (await blockAt(day + DAY)) - 1;
  const L = (await blockAt(S.lockTime(day))) - 1;
  if (!(Number.isSafeInteger(S0) && Number.isSafeInteger(S1) && Number.isSafeInteger(L) && L < S0 && S0 <= S1)) throw new Error(`Survivor: bad block heights for ${S.ymd(day)} (L ${L}, S0 ${S0}, S1 ${S1})`);
  return { game: S.CARD.game, round: S.ymd(day), window: { W0: L - S.CARD_BLOCKS + 1, W1: L, L, S0, S1 },
    c: S.CARD.c, minK: S.CARD.minK, poolRule: S.CARD.poolRule, ownRule: S.CARD.ownRule, paying: S.CARD.paying, pooled: [...S.CARD.pooled] };
}

/** One play day's result from its ruler card. Throws the kit's NotYet (the kit keeps the round PENDING) while the
 *  heights or the ruler's data aren't there yet. */
export async function dayResult(day: number, n: number, ctx: RulerCtx | undefined): Promise<DayResult | typeof PENDING> {
  if (!ctx?.vhp || typeof ctx.blockAt !== "function") return PENDING;      // no ruler data, or no ctx.blockAt (kit G7) yet
  const card = ctx.vhp.card(await settingsFor(day, ctx.blockAt));
  return S.dayFromCard(card, n);
}

/** The module for a launch week (math.js FIRST_WEEK on mainnet; tests pass their own). */
export function makeGame(first: number | null = S.FIRST_WEEK): GameModule<RawPick, DayResult, SeasonInputs> {
  const dayOf = (t: number) => S.seasonDayOf(t, first);
  return {
  slug: "survivor",
  picks: { source: "picks-contract", gameId: S.GAME_ID },

  roundsFor(week): Round[] {
    checkWeek(week);
    return S.playDaysOf(week.week, first).map(({ day }: { day: number }) => ({ id: `d${S.ymd(day)}`, day, locksAt: day + DAY, resolvesAt: day + DAY, pickRound: S.dayNo(day) }));
  },

  /** The season's play days so far, oldest first, stopping at the first day that isn't ready (never a guess). */
  async inputsFor(week, ctx) {
    checkWeek(week);
    const s = S.seasonOfWeek(week.week, first);
    if (!s) return { season: 0, days: [], waiting: null };
    const days: DayResult[] = [];
    let waiting: string | null = null;
    for (const { day, n } of S.seasonDays(s.season, first) as { day: number; n: number }[]) {
      if (day >= week.end) break;
      try {
        const r = await dayResult(day, n, ctx as RulerCtx);
        if (r === PENDING) { waiting = `${S.ymd(day)}: no ruler data or block heights yet`; break; }
        days.push(r);
      } catch (e) {
        // Not ready yet (the kit's NotYet) or a read that failed: this day and the ones after it wait. The day's own
        // round reads its card again in resultOf, where the kit tells a NotYet from a failed read.
        waiting = `${S.ymd(day)}: ${(e as Error).message}`;
        break;
      }
    }
    return { season: s.season, days, waiting };
  },

  async resultOf(round, _read, _inputs, ctx?: unknown) {
    const sd = dayOf(round.day);
    if (!sd) return PENDING;
    return dayResult(round.day, sd.n, ctx as RulerCtx);
  },

  /** A new season starts empty; the season's second week carries the first week's picks (FC-5). */
  carryIn(last, week) {
    const s = S.seasonOfWeek(week.week, first);
    if (!s || s.k === 0) return new Map();
    const out: States<PicksState> = new Map();
    for (const [a, v] of last as States<PicksState>) if (isAddr(a) && v && Array.isArray(v.p)) out.set(a, { p: v.p.map(([n, x]) => [n, x] as [number, string]) });
    return out;
  },

  /** A day's picks: on season day 1 every valid pick joins the season; later, only wallets in the season record picks. */
  nextState(state, picks, round) {
    const sd = dayOf(round.day);
    const next: States<PicksState> = new Map(state as States<PicksState>);
    if (!sd) return next;
    for (const p of picks) {
      const a = Array.isArray(p.pick?.producers) ? p.pick.producers[0] : null;
      if (!isAddr(p.wallet) || !isAddr(a)) continue;
      const cur = next.get(p.wallet);
      if (!cur && sd.n !== 1) continue;
      const list = (cur?.p ?? []).filter(([n]) => n !== sd.n);
      list.push([sd.n, a]);
      list.sort((x, y) => x[0] - y[0]);
      next.set(p.wallet, { p: list });
    }
    return next;
  },

  scoreRound(round, picks, result, inputs, state, ctx?: unknown): Score {
    const sd = dayOf(round.day);
    if (!sd || sd.n !== result.n) throw new Error(`Survivor: round ${round.id} isn't season day ${result.n}`);
    const staked = (ctx as BoardCtx | undefined)?.seasonStaked;
    if (!(staked instanceof Set)) throw new Error("Survivor needs the season's staked wallets in scoreRound (kit need K1: docs/SURVIVOR.md \"Kit needs\")");
    const earlier = (inputs?.days ?? []).filter((d) => d.n < sd.n);
    if (earlier.length !== sd.n - 1 || earlier.some((d, i) => d.n !== i + 1)) throw new Error(`Survivor: day ${sd.n} is decided but the season's earlier days aren't all ready this run (${inputs?.waiting ?? "?"}); the next run tries again`);
    const mine = (inputs?.days ?? []).find((d) => d.n === sd.n);
    if (mine && JSON.stringify(mine) !== JSON.stringify(result)) throw new Error(`Survivor: day ${sd.n}'s card differs between the inputs and the round this run`);
    const picksOf = new Map<string, [number, string][]>();
    for (const [a, v] of (state ?? new Map()) as States<PicksState>) picksOf.set(a, v.p);
    const pts = S.roundPoints([...earlier, result], picksOf, staked, sd.n, (sd.n - 1) % S.PLAY_DAYS_PER_WEEK === 0);
    const out: Score = new Map();
    for (const a of new Set([...picks.map((p) => p.wallet), ...picksOf.keys()])) {
      const points = pts.get(a) ?? 0;
      out.set(a, { points, at: points > 0 ? round.day : 0 });
    }
    return out;
  },
  };
}

/** The mainnet module (no rounds until the owner sets math.js FIRST_WEEK). */
export const game = makeGame();
