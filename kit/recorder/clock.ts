// Shared Game Kit: the clock (WEEK_CYCLE.md §1–2, RECORDER §3.1). All UTC ms.
// The recorder's "now" is the CHAIN's time (the lower of the two nodes' head times), never the runner's clock.
import { weekClock, dayOf, isSunday, DAY, HOUR, STABLE_MS, RESULTS_DAYS } from "../publish/check.inline.mjs";
import type { WeekSpan } from "./types.ts";

export { dayOf, isSunday, DAY, HOUR, STABLE_MS, RESULTS_DAYS };

export type VaultClock = {
  genesis: number; weekMs: number;
  weekOf(t: number): number;
  span(w: number): WeekSpan;
  /** Results due (the vault's 3-day window closes): Thursday 00:00 UTC after the week = the backstop. */
  due(w: number): number;
  /** The earliest a week may go final: its end, Monday 00:00 UTC (D-125, game.json week.finalNotBefore). */
  finalNotBefore(w: number): number;
  /** The play window: Monday 00:00 → Saturday 24:00 (WEEK_CYCLE §2). */
  inPlay(t: number): boolean;
};

export function vaultClock(genesis: number, weekMs: number): VaultClock {
  if (!(Number.isSafeInteger(genesis) && genesis > 0 && Number.isSafeInteger(weekMs) && weekMs > 0)) throw new Error("the vault's genesis_time / week_length are missing or not whole numbers");
  const k = weekClock({ genesis, weekMs });
  return {
    genesis, weekMs,
    weekOf: k.weekOf,
    span: (w) => ({ week: w, start: k.start(w), end: k.end(w) }),
    due: k.due,
    finalNotBefore: k.end,
    inPlay: (t) => !isSunday(Math.floor(t / DAY) * DAY),
  };
}

/** The vault's clock from get_state's config, and the minimum stake for a week (the contract's minStakeFor). */
export function clockFromState(state: any): { clock: VaultClock; time: number; minFor(w: number): bigint; config: any } {
  const c = state?.config ?? {};
  const clock = vaultClock(Number(c.genesis_time ?? 0), Number(c.week_length ?? 0));
  const time = Number(state?.time ?? 0);
  if (!(Number.isSafeInteger(time) && time > 0)) throw new Error("get_state has no time");
  const minFor = (w: number) => {
    const next = BigInt(c.min_stake_next ?? 0);
    return next > 0n && w >= Number(c.min_stake_next_week ?? 0) ? next : BigInt(c.min_stake ?? 0);
  };
  return { clock, time, minFor, config: c };
}

/** Label for logs: vault week w is shown to players as "Week w − 2" (D-063). */
export const siteWeek = (w: number) => w - 2;
