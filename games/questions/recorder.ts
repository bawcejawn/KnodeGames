// Daily Questions (game 1): the game's own part of its results recorder, on the Shared Game Kit (D-158, I-101).
// From Vault v6.1's rule week (D-116, Mon 16 Nov 2026) the vault pays Daily Questions from a results file like every
// vault game. The kit does the rest (two-node reads, the clock, pending → final, holds, board.json, the vault file).
//
// The rules are the contract's old settle rules, unchanged (owner 4 Nov: "Questions keeps its entry rules"), ported
// from PR #203 (games/questions/math.js):
//   - a round is one question; it counts for the day its answers close in (a round closing at exactly Sun 00:00 is
//     Saturday's); a question closing on Sunday would be a fun round and count for no week (D-129; the schedule has none);
//   - 1 point per correct answer; a void question (outcome 1000) scores nothing; an unresolved one is pending;
//   - entry (game.json `entry`): at least 2 counted answers and at least 1 point; staked / free by the entry's stake;
//   - free places by D-159: score time = the lock time of the question that gave the wallet its last point;
//   - vault values are the real points (game.json `vaultValues: "points"`): the contract refuses a game-1 row with more
//     points than answers (Kpred qEntryRule), so 255 → 1 can't be used for game 1.
import { dayOf } from "../../kit/recorder/clock.ts";
import { PENDING, VOID, type GameModule, type Round } from "../../kit/recorder/types.ts";
import { roundId, questionOf, type AnswerPick, type QuestionsInputs } from "../../kit/recorder/sources/vault-answers.ts";
import { VOID as VOID_OUTCOME, correct } from "./math.js";

export const SLUG = "questions";

/** A decided question: its winning option + 1 (the contract's `outcome`). */
type Outcome = number;

export const game: GameModule<AnswerPick, Outcome, QuestionsInputs> = {
  slug: SLUG,
  picks: { source: "vault-answers", gameId: 1 },

  roundsFor(week, ctx): Round[] {
    const qs = ctx.inputs?.questions ?? [];
    return qs.map(([id, , lock]) => ({ id: roundId(id), day: dayOf(lock), locksAt: lock, resolvesAt: lock }));
  },

  // The outcome comes from the snapshot the kit already read on both nodes and compared (vault-answers). `read` is
  // not needed: nothing else decides a question.
  async resultOf(round, _read, inputs) {
    const q = (inputs?.questions ?? []).find(([id]) => id === questionOf(round.id));
    if (!q) return PENDING;
    const outcome = q[1];
    if (outcome === 0) return PENDING;
    if (outcome === VOID_OUTCOME) return VOID;
    return outcome;
  },

  // Score time (D-159 (a), owner 5 Nov): entries on chain store no answer times, so a correct answer's time is its
  // question's lock time; the kit takes a wallet's latest one = the question that gave it its last point.
  scoreRound(round, picks, outcome) {
    const out = new Map<string, { points: number; at: number }>();
    for (const p of picks) { const ok = correct(outcome, p.pick.option); out.set(p.wallet, { points: ok ? 1 : 0, at: ok ? round.locksAt : 0 }); }
    return out;
  },
};
