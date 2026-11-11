// Shared Game Kit testing: a clock for the chain (what the fake nodes report as get_state.time and head time) and a
// separate one for the job (the publish check's CHECK_NOW_MS), so a test can make them disagree on purpose.
export const GENESIS = 1792368000000;   // Mon 19 Oct 2026 00:00 UTC, vault week 0
export const DAY = 86400000, HOUR = 3600000, WEEK = 7 * DAY;

export class FakeClock {
  constructor(public t: number) {}
  now() { return this.t; }
  set(t: number) { this.t = t; return this; }
  advance(ms: number) { this.t += ms; return this; }
}

export const weekStart = (w: number) => GENESIS + w * WEEK;
export const weekEnd = (w: number) => GENESIS + (w + 1) * WEEK;
/** Monday 00:00 + d days + h hours of vault week w. */
export const at = (w: number, d = 0, h = 0) => weekStart(w) + d * DAY + h * HOUR;
