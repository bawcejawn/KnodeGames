// {{name}}: the game's own part of the recorder. The shared game kit (D-146) runs it: two-node reads,
// pending → final, holds, recompute at publish, finals locked, the vault file and board.json.
// Fill in the three functions below; don't add network, keys or file writes here.

export const SLUG = "{{slug}}";

/** The rounds that close in [weekStart, weekEnd) (UTC ms). */
export function roundsFor(weekStart: number, weekEnd: number): Array<{ id: string; locksAt: number }> {
  throw new Error("roundsFor: not built yet");
}

/** A round's result, from chain data the kit has already read on both nodes. */
export function resultOf(round: { id: string }, chain: unknown): unknown {
  throw new Error("resultOf: not built yet");
}

/** Points for every wallet in a round (use math.js). */
export function scoreRound(round: { id: string }, picks: Array<{ wallet: string; pick: unknown }>, result: unknown): Map<string, number> {
  throw new Error("scoreRound: not built yet");
}
