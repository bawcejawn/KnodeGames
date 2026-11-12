// Kit ruler example (TEST FIXTURE, never a real game): the shape of a Fantasy-like kit game, so the conformance suite
// checks every Phase 1 / 1b hook end to end. Picks from the Picks contract (game 40), one producer per team carried
// day to day (nextState), each day decided by one VHP ruler card (ctx.vhp, cardPerRound) whose window is found with
// ctx.blockAt. A team scores 10 when its producer credited the most blocks on the day's card.
import { PENDING, type GameModule, type Round } from "../../../../recorder/types.ts";

const DAY = 86400000;
// The ruler fixture's chain (tests/audit/race-ruler.fixture.mjs): history from block 100,000, 432,000 blocks of it.
const S_BASE = 100000 + 432000 + 100;
const POOLED = ["1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"];

export const settingsFor = (i: number) => {
  const S0 = S_BASE + i * 1200, L = S0 - 1;
  return { game: 251, round: String(2026111600 + i), window: { W0: L - 7199, W1: L, L, S0, S1: S0 + 1199 }, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: POOLED };
};

export const game: GameModule<{ producers: string[] }, { best: string }, unknown> = {
  slug: "kit-ruler-example",
  picks: { source: "picks-contract", gameId: 40 },
  roundsFor(week): Round[] {
    return [0, 1, 2].map((i) => {
      const day = week.start + i * DAY;
      return { id: `d${i}`, day, locksAt: day + 1, resolvesAt: day + DAY, pickRound: Math.floor(day / DAY) };
    });
  },
  nextState(state, picks) {
    const n = new Map(state);
    for (const p of picks) { const x = p.pick?.producers?.[0]; if (typeof x === "string") n.set(p.wallet, x); }
    return n;
  },
  async resultOf(round, _read, _inputs, ctx) {
    const i = Number(round.id.slice(1));
    await ctx!.blockAt!(round.locksAt);                 // the day's lock block (a real game builds its window from it)
    const card = ctx!.vhp!.card(settingsFor(i));
    if (!card?.producers?.length) return PENDING;
    let best = card.producers[0];
    for (const p of card.producers) if (BigInt(p.credited) > BigInt(best.credited) || (BigInt(p.credited) === BigInt(best.credited) && p.a < best.a)) best = p;
    return { best: best.a };
  },
  scoreRound(round, _picks, res, _inputs, state) {
    const out = new Map<string, { points: number; at: number }>();
    for (const [a, p] of state ?? []) out.set(a, p === res.best ? { points: 10, at: round.day + 1000 } : { points: 0, at: 0 });
    return out;
  },
};
