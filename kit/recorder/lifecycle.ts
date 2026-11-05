// Shared Game Kit: open → pending → final, holds and the backstop (RECORDER §3.1, §4.2, §5.5; WEEK_CYCLE §2; D-135).
import { STABLE_MS, sha256 } from "../publish/check.inline.mjs";

export type WeekState = "open" | "pending" | "final";

export type Decide = {
  now: number; end: number; due: number;
  complete: boolean;            // every counted round decided
  hash: string;                 // this run's week hash (both nodes agreed)
  prev: { state: WeekState; seen: { hash: string; at: number } } | null;
  rereadOk: boolean;            // this run re-read and re-scored every counted round on both nodes
  held: string | null;          // why the week is held (owner hold or an unreleased HOLD file), else null
  liveWeek?: boolean;
};

/** The week's state and its `seen` (when this exact content was first read; kept while it doesn't change). */
export function decide(d: Decide): { state: WeekState; seen: { hash: string; at: number }; why: string } {
  const same = !!d.prev && d.prev.seen.hash === d.hash;
  const seen = { hash: d.hash, at: same ? d.prev!.seen.at : d.now };
  if (d.now < d.end) return { state: "open", seen, why: "the week is still being played" };
  if (d.now >= d.due) return { state: "pending", seen, why: "past the vault's 3 days: the backstop (no vault file)" };
  if (!d.complete) return { state: "pending", seen, why: "rounds still to be decided" };
  if (!d.rereadOk) return { state: "pending", seen, why: "the week-end re-read didn't finish this run" };
  if (d.held) return { state: "pending", seen, why: `held: ${d.held}` };
  if (!same || d.prev!.state !== "pending") return { state: "pending", seen, why: "waiting for a second matching run an hour later" };
  if (d.now - seen.at < STABLE_MS) return { state: "pending", seen, why: "waiting for a second matching run an hour later" };
  return { state: "final", seen, why: "final: two runs at least an hour apart read the same, after Mon 00:00 UTC" };
}

/** The release code of a hold: sha256 of its exact reason, first 16 hex (Block X's rule, fix-check L-2). */
export const releaseCode = (reason: string) => sha256(reason).slice(0, 16);

/** `<SLUG>_RELEASE = "<week>:<code>"` releases exactly that week's hold, and only for that reason. */
export function releaseMatches(release: string | undefined, week: number, reason: string): boolean {
  const m = typeof release === "string" ? /^\s*([0-9]{1,4}):([0-9a-f]{16})\s*$/.exec(release) : null;
  return !!m && Number(m[1]) === week && m[2] === releaseCode(reason);
}

/** `<SLUG>_HOLD_WEEKS = "4,5"`: weeks the owner keeps pending (the Race's rule). Anything but week numbers throws. */
export function holdWeeks(s: string | undefined): Set<number> {
  const out = new Set<number>();
  for (const x of String(s ?? "").split(",").map((v) => v.trim()).filter(Boolean)) {
    if (!/^[0-9]{1,4}$/.test(x)) throw new Error(`"${x}" in the hold weeks is not a week number`);
    out.add(Number(x));
  }
  return out;
}
