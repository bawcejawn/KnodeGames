// {{name}}: the game's own part of the recorder, a GameModule (.ai/standards/GAME_KIT.md §2). The shared game kit
// (kit/) runs it: two-node reads, stakes, the clock, pending → final, holds, boards, the vault file and alerts.
// Rules: no network except through `read`, no clock except ctx.now, no files, no randomness, no environment.
// `npm run game:check -- {{slug}}` runs the kit's conformance suite on this module.
import { PENDING, VOID, type GameModule, type Round } from "../../kit/recorder/types.ts";
import { dayOf } from "../../kit/recorder/clock.ts";

type MyPick = unknown;     // the pick's shape on chain
type MyResult = unknown;   // a decided round's result

export const game: GameModule<MyPick, MyResult> = {
  slug: "{{slug}}",
  picks: { source: "picks-contract", gameId: 0 },   // {{picks-contract | race-picks | vault-answers | none}}
  roundsFor(week, ctx): Round[] {
    // Every round counting for the week: { id, day: dayOf(locksAt), locksAt, resolvesAt }. Pure.
    void week; void ctx; void dayOf;
    throw new Error("roundsFor: not built yet");
  },
  async resultOf(round, read) {
    // Read the chain only through `read`; PENDING until decided, VOID if nothing scores.
    void round; void read; void PENDING; void VOID;
    throw new Error("resultOf: not built yet");
  },
  scoreRound(round, picks, result) {
    // Points for EVERY wallet that picked (0 included), with the scoring pick's time. Use math.js.
    void round; void picks; void result;
    throw new Error("scoreRound: not built yet");
  },
};
