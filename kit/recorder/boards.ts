// Shared Game Kit: board.json (LEADERBOARD §1, RECORDER §5) — lastWeek with both boards (Staked and Free play), every
// row with points kept, places with ties (1, 1, 3 …), Staked vs Free by the vault's stake rule. Built from the same
// tally the publish job recomputes, so the vault bot's board check and the vault file always agree.
import { boardOf, tally } from "../publish/check.inline.mjs";

export { boardOf, tally };

/** board.json for week file `j`, stamped with the chain time `now`. */
export const boardFor = (j: any, cfg: any, now: number) => boardOf(j, tally(j, cfg), new Date(now).toISOString(), cfg.rowCap ?? 0);
