// Shared Game Kit: the public interface a game implements (GAME_KIT.md §2, design §B).
// A game's games/<slug>/recorder.ts exports `game: GameModule`. The kit does everything else: two-node reads, stakes,
// the clock, files, pending → final, holds, boards, the vault file and alerts.

export type Wallet = string;

/** A vault week (UTC ms): Monday 00:00 → next Monday 00:00. */
export type WeekSpan = { week: number; start: number; end: number };

/** One round of a game. `day` is the UTC day it counts for (00:00 of that day); the kit marks Sunday rounds as fun
 *  rounds (D-129). Use dayOf(locksAt) from the kit unless the game's rules say otherwise. `resolvesAt`: the earliest
 *  time its result can be decided (the kit doesn't read it before). */
export type Round = {
  id: string; day: number; locksAt: number; resolvesAt: number;
  /** picks-contract games: the Picks contract round whose picks belong to this round (Fantasy: the day number). */
  pickRound?: number;
};

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

/** This game's own published FINAL week files, and other kit games' (manifest `published`), by week; read-only,
 *  loaded by the kit before the module runs (Fantasy Phase 1 item 6). */
export type Published = { own: Record<number, any>; games: Record<string, Record<number, any>> };
export type RoundCtx<I = unknown> = { now: number; inputs?: I; published?: Published };
export type ReadCtx<I = unknown> = RoundCtx<I> & { read: NodeReader };

export type PicksSource = { source: "picks-contract" | "race-picks" | "vault-answers" | "none"; gameId?: number };
/** A wallet's carried game state (Fantasy: its team). JSON only; at most 4 KB each (MAX_STATE_BYTES). */
export type States<S = unknown> = Map<Wallet, S>;
/** What weekExtras sees: the week's counted points per wallet, every source's picks by round, and the inputs. */
export type ExtrasCtx<I = unknown> = { points: Map<Wallet, number>; picks: Map<number, Map<number, Pick[]>>; staked: Set<Wallet>; inputs?: I };
export type BoardColumn = { key: string; label: string };

export interface GameModule<P = unknown, R = unknown, I = unknown> {
  /** Must equal game.json `slug`. */
  slug: string;
  /** Every round counting for the week. Pure: from the week, ctx.now and ctx.inputs only. */
  roundsFor(week: WeekSpan, ctx: RoundCtx<I>): Round[];
  /** Inputs published before picks open (cards, seeding, prices), or a game's own chain snapshot. Read through
   *  ctx.read only; the kit reads it on both nodes and requires them to agree. With inputsFile (FC-9) it is called
   *  when the file is made and again at the week's end (the recount): it must give the same answer both times, so
   *  read fixed heights or times, never "the latest", and don't use ctx.now. */
  inputsFor?(week: WeekSpan, ctx: ReadCtx<I>): Promise<I>;
  /** Where picks come from (declared, not coded). A list: the first source is scored; the others (other Picks games,
   *  e.g. Fantasy's Weekly Rival, game 5) reach only weekExtras. */
  picks: PicksSource | PicksSource[];
  /** The Picks contract rounds an extra source is read at for the week (pure). Default: none. */
  extraPickRounds?(week: WeekSpan, source: PicksSource): number[];
  /** A round's result from chain data (called once per node). PENDING until decided; VOID if nothing scores. */
  resultOf(round: Round, read: NodeReader, inputs?: I): Promise<R | Pending | Void>;
  /** Default: canonical-JSON equality. */
  same?(a: R, b: R): boolean;
  /** Points for every wallet that picked in the round (and, with carried state, every wallet with a state). Pure and
   *  deterministic (use the game's math.js). `state`: each wallet's state for this round, after nextState. */
  scoreRound(round: Round, picks: Pick<P>[], result: R, inputs?: I, state?: States<any>): Score;
  /** Carried state (FC-5). carryIn: each wallet's state at the week's start, from the last week's `next` (pure; e.g. drop
   *  a team that doesn't fit this week's price list). nextState: the states after one round's picks (pure; called for
   *  every round in lock order, picks known, results not needed). A week is recorded only once the week before it is
   *  final: the kit never carries from an unfinished week. */
  carryIn?(last: States<any>, week: WeekSpan, inputs?: I): States<any>;
  nextState?(state: States<any>, picks: Pick<P>[], round: Round, inputs?: I): States<any>;
  /** Records-only JSON for the week file (Weekly Rival). Pure; never paid from; at most 256 KB. */
  weekExtras?(week: WeekSpan, ctx: ExtrasCtx<I>): unknown;
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
  /** false: the week isn't paid from a results file (not live on chain): nothing is recorded. */
  active?: boolean;
  picks: Map<string, Pick<P>[]>;
  /** Extra sources' picks: gameId → Picks round → picks. */
  extra?: Map<number, Map<number, Pick<P>[]>>;
  stakes: Map<Wallet, StakeView>;
  min: string;
  inputs?: I;
};
