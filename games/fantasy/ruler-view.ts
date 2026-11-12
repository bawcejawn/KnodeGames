// Fantasy Producers: what the game needs from the kit's VHP Ruler source (kit Phase 1b, "ruler source", Architecture
// chat; claude/architecture/TO-FANTASY-KIT-ANSWERS-2026-11-11.md). Types only: this file is the contract the kit's
// `ctx.vhp` must meet. Until Phase 1b passes `ctx.vhp`, Fantasy makes no price list and every day stays PENDING (never
// a guess).
//
// A day card (Ruler chat, claude/ruler/TO-FANTASY-RULER-ANSWERS-2026-11-11.md): game 4, S0/S1 = the UTC day's first and
// last blocks, window [L − 7199, L] with L the lock block, round = yyyymmdd, made and scored by the real ruler code
// (vhp-ruler.js) from the published vhp-data branch.

/** The ruler card settings Fantasy uses (Ruler chat, 11 Nov). */
export type CardSettings = { ownRule: "spot"; minK: number; poolRule: "min"; c: string; paying: boolean; pooled: string[] };

/** One producer on a scored card: credited and expected in millionths of a block (decimal strings, as cardJson writes them). */
export type RulerRow = { credited: string; expected: string; void: boolean; entry: boolean };

export type DayCard =
  | { state: "ready"; round: string; sha256: string; quality: "ok" | "flagged"; ruleVersion: number; rows: Record<string, RulerRow> }
  | { state: "not-yet"; why: string };

export interface RulerView {
  /** The scored card for the UTC day starting at `day` (ms). `include`: producers that must have a row whatever their
   *  activity before the day (the week's pool; Ruler chat G6). "not-yet" until vhp-data covers the day and its seed
   *  block is irreversible. Deterministic: the same answer every time it is asked. */
  dayCard(day: number, settings: CardSettings, include: string[]): Promise<DayCard>;
}

/** The kit's ruler source, if this run has it (Phase 1b passes it as ctx.vhp). */
export const rulerOf = (ctx: unknown): RulerView | null => {
  const v = (ctx as { vhp?: RulerView } | undefined)?.vhp;
  return v && typeof v.dayCard === "function" ? v : null;
};
