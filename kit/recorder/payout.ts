// Shared Game Kit: who gets paid (RECORDER §4.3–4.4, D-152, VAULT §6). The one implementation lives in the publish
// check (kit/publish/check.inline.mjs) so the recorder and the publish job use the same code; this module names it.
export { paidSet, vaultValues, contractWinners, freePlaces, MAX_PER_PLACE, MAX_VAULT_POINTS } from "../publish/check.inline.mjs";

/** A prize-start gate (PRIZES_FROM_WEEK-style variables): a plain week number, else no prizes (fails closed). */
export function prizesFrom(v: string | undefined): number | null {
  return typeof v === "string" && /^[0-9]{1,4}$/.test(v.trim()) ? Number(v.trim()) : null;
}
