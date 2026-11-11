// Shared Game Kit: the public interface a game implements (GAME_KIT.md §2, design §B).
// A game's games/<slug>/recorder.ts exports `game: GameModule`. The kit does everything else: two-node reads, stakes,
// the clock, files, pending → final, holds, boards, the vault file and alerts.

export type Wallet = string;

/** A vault week (UTC ms): Monday 00:00 → next Monday 00:00. */
export type WeekSpan = { week: number; start: number; end: number };

/** One round of a game. `day` is the UTC day it counts for (00:00 of that day); the kit marks Sunday rounds as fun
 *  rounds (D-129). Use dayOf(locksAt) from the kit unless the game's rules say otherwise. `resolvesAt`: the earliest
 *  time its result can be decided (the kit doesn't read it before). */
export type Round = { id: string; day: number; locksAt: number; resolvesAt: number };

/** resultOf's answers when there is no result: not decided yet (never a guess), or void (nothing scores). */
export const PENDING = Symbol.for("kit.pending");
export const VOID = Symbol.for("kit.void");
export type Pending = typeof PENDING;
export type Void = typeof VOID;

/** One wallet's pick in one round. `at`: the pick's time (chain ms), used for D-152's tie-break. */
export type Pick<P = unknown> = { wallet: Wallet; round: string; pick: P; at: number };

/** Points per wallet for one round: every wallet that picked must appear (0 points included). */
export type Score = Map<Wallet, { points: number; at: number }>;

/** The only way a module reads the chain: one node at a time; the kit compares the two. */
export interface NodeReader {
  readonly label: string;
  read(method: string, args?: unknown): Promise<any>;
}

/** A wallet's stake for the week, as the vault counts it (RECORDER §2.4). Decimal strings (satoshi-like units). */
export type StakeView = { stake: string; peak: string; voided: boolean };

export type RoundCtx<I = unknown> = { now: number; inputs?: I };
export type ReadCtx<I = unknown> = RoundCtx<I> & { read: NodeReader };

export type PicksSource = { source: "picks-contract" | "race-picks" | "vault-answers" | "none"; gameId?: number };
export type BoardColumn = { key: string; label: string };

export interface GameModule<P = unknown, R = unknown, I = unknown> {
  /** Must equal game.json `slug`. */
  slug: string;
  /** Every round counting for the week. Pure: from the week, ctx.now and ctx.inputs only. */
  roundsFor(week: WeekSpan, ctx: RoundCtx<I>): Round[];
  /** Inputs published before picks open (cards, seeding, prices), or a game's own chain snapshot. Read through
   *  ctx.read only; the kit reads it on both nodes and requires them to agree. */
  inputsFor?(week: WeekSpan, ctx: ReadCtx<I>): Promise<I>;
  /** Where picks come from (declared, not coded). */
  picks: PicksSource;
  /** A round's result from chain data (called once per node). PENDING until decided; VOID if nothing scores. */
  resultOf(round: Round, read: NodeReader, inputs?: I): Promise<R | Pending | Void>;
  /** Default: canonical-JSON equality. */
  same?(a: R, b: R): boolean;
  /** Points for every wallet that picked in the round. Pure and deterministic (use the game's math.js). */
  scoreRound(round: Round, picks: Pick<P>[], result: R, inputs?: I): Score;
  /** Extra board columns the page shows. */
  columns?: BoardColumn[];
}

/** Who gets paid (RECORDER §4.3): today's rule, or D-152. A migration never changes it (D-158 #2). */
export type PayoutRule = "legacy-tied-whole" | "d152";
/** Vault values: dense 255 → 1 by place, or the real points (game 1: the contract checks points ≤ answers). */
export type VaultValues = "dense255" | "points";

export type VaultFile = {
  game: number; week: number; final: true;
  rows: { player: Wallet; points: number }[];
  first: Wallet[]; second: Wallet[];
};

/** A source's answer for one week, on one node: picks per round, stakes per wallet, and the source's own inputs. */
export type SourceRead<P = unknown, I = unknown> = {
  picks: Map<string, Pick<P>[]>;
  stakes: Map<Wallet, StakeView>;
  min: string;
  inputs?: I;
};
