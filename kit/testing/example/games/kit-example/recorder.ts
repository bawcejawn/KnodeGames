// A TEST FIXTURE, not a game: the smallest GameModule on the kit, used by the kit's own tests and its conformance suite.
// It reads answers from the vault (the `vault-answers` source) and scores 1 point per correct answer, with the score time
// of a correct answer = its question's lock time. It runs in no workflow and publishes nothing (D-160: kit-core ships
// no game; Daily Questions moves onto the kit later by porting PR #203 with a byte-compatible replay).
import { dayOf } from "../../../../recorder/clock.ts";
import { PENDING, VOID, type GameModule, type Round } from "../../../../recorder/types.ts";
import { roundId, questionOf, type AnswerPick, type QuestionsInputs } from "../../../../recorder/sources/vault-answers.ts";

const VOID_OUTCOME = 1000;
const correct = (outcome: number, option: number) => outcome !== VOID_OUTCOME && outcome > 0 && outcome === option + 1;

export const game: GameModule<AnswerPick, number, QuestionsInputs> = {
  slug: "kit-example",
  picks: { source: "vault-answers", gameId: 250 },
  roundsFor(_week, ctx): Round[] {
    return (ctx.inputs?.questions ?? []).map(([id, , lock]) => ({ id: roundId(id), day: dayOf(lock), locksAt: lock, resolvesAt: lock }));
  },
  async resultOf(round, _read, inputs) {
    const q = (inputs?.questions ?? []).find(([id]) => id === questionOf(round.id));
    if (!q || q[1] === 0) return PENDING;
    return q[1] === VOID_OUTCOME ? VOID : q[1];
  },
  scoreRound(round, picks, outcome) {
    const out = new Map<string, { points: number; at: number }>();
    for (const p of picks) { const ok = correct(outcome, p.pick.option); out.set(p.wallet, { points: ok ? 1 : 0, at: ok ? round.locksAt : 0 }); }
    return out;
  },
};
