// Fantasy Producers: how a UTC day becomes a VHP Ruler card, on the kit's sources.
//
// - ctx.vhp.card(settings) (kit Phase 1b, PR #267, merged): the real ruler's scored card (vhp-ruler.js makeCard +
//   scoreCard + cardJson) made from the published vhp-data branch; it throws NotYet while the data doesn't cover it.
// - ctx.blockAt(ms) (kit G7, `kit-blockat`): the first irreversible block at or after a UTC time, the same on both
//   nodes; NotYet until that block is irreversible. Until the kit passes it, Fantasy waits (NotYet), never guesses.
//
// A day card (Ruler chat 11 Nov; lock rule confirmed against picks/assembly/Picks.ts l.126–133, Block X chat 12 Nov):
//   S0 = blockAt(dayStart), S1 = blockAt(dayStart + DAY) − 1, L = blockAt(dayStart − LEAD) − 1 (the last block that can
//   still hold a pick), window { W0: L − 7199, W1: L, L, S0, S1 }, round = yyyymmdd, game 4, Fantasy's own settings.
import { NotYet } from "../../kit/recorder/sources/vhp-ruler.ts";
import { DAY } from "../../kit/recorder/clock.ts";
import * as F from "./math.js";

export const LEAD = 300000;                         // Picks game 4 locks each day 5 minutes before it starts
export const LOOK_BACK = 7199;                      // the card's look-back: the 6 hours (7,200 blocks) up to the lock
export const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
/** Fantasy's card settings (Ruler chat, 11 Nov; mode A = no mode field). Never read from a card. */
export const CARD = Object.freeze({ game: 4, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [VAULT] });
export type CardBase = typeof CARD;

/** One producer on a scored card, as cardJson writes it (millionths of a block, decimal strings). */
export type RulerRow = { a: string; credited: string; expected: string; void: boolean; entry: boolean; quality: "ok" | "flagged" };
export type RulerCard = { ruleVersion: number; game: number; round: string; producers: RulerRow[] };

type Vhp = { ruleVersion: number; to?: number; loaded?: boolean; card(settings: unknown): RulerCard };
type BlockAt = (ms: number) => Promise<number>;
/** The kit's way to decide a round without a ruler card (Architecture, 13 Nov: `kit-next`, opening Fri 20 Nov). The kit
 *  itself waits for the round's end + 48 h on both nodes (NotYet before), records `fallback: { why, at }` in the week
 *  file, exempts the round from cardPerRound and alerts. Until the kit passes it, Fantasy's no-card day waits (pending). */
type Fallback = (why: string) => Promise<void>;
/** The ruler's scoring mode and rule version for this run's week, as the kit will pass them (D-175: one all-games setting
 *  plus a per-game one, Architecture's next kit PR; spec `SPEC-ALL-GAMES-RULER-MODE-2026-11-14.md` rule 4): only the
 *  keys that differ from today's default, so mode A and version 4 are ABSENT, never "A" or 4. Unset (today) means every
 *  card is byte for byte as before. Fantasy never chooses these itself; it only carries them into its card settings and
 *  checks the card it gets back was made under them. */
export type RulerExtra = { mode?: "B" | "C" | "D"; version?: 5 };
/** loaded: this run has the ruler's data. The kit says so in ctx.vhp.loaded (#G-73 G73-1); `to` −1 is kept as a second
 *  sign of the kit's no-data stand-in. */
export type Sources = { vhp: Vhp; blockAt: BlockAt; fallback?: Fallback; loaded: boolean; ruler?: RulerExtra };

/** ctx.ruler, checked: absent → {}; anything but the non-default values above stops the run (never a silent guess). */
export function rulerOf(ctx: unknown): RulerExtra {
  const r = (ctx as { ruler?: unknown } | undefined)?.ruler;
  if (r === undefined || r === null) return {};
  if (typeof r !== "object" || Array.isArray(r)) throw new Error("ctx.ruler: not an object");
  const { mode, version, ...rest } = r as Record<string, unknown>;
  if (Object.keys(rest).length) throw new Error(`ctx.ruler: unknown key ${Object.keys(rest)[0]}`);
  if (mode !== undefined && !["B", "C", "D"].includes(mode as string)) throw new Error(`ctx.ruler.mode ${JSON.stringify(mode)}: only B, C or D (mode A is no key)`);
  if (version !== undefined && version !== 5) throw new Error(`ctx.ruler.version ${JSON.stringify(version)}: only 5 (version 4 is no key)`);
  return { ...(mode === undefined ? {} : { mode: mode as RulerExtra["mode"] }), ...(version === undefined ? {} : { version: 5 as const }) };
}

/** The ruler source and the block clock from a kit context, or NotYet if this run doesn't have both yet. */
export function sourcesOf(ctx: unknown): Sources {
  const c = ctx as { vhp?: Vhp; blockAt?: BlockAt } | undefined;
  if (!c?.vhp || typeof c.vhp.card !== "function") throw new NotYet("not yet: no ruler data this run (ctx.vhp)");
  if (typeof c.blockAt !== "function") throw new NotYet("not yet: the kit's block clock (ctx.blockAt, G7) isn't available");
  const fb = (ctx as { fallback?: Fallback }).fallback;
  return { vhp: c.vhp, blockAt: c.blockAt, loaded: c.vhp.loaded !== false && !(typeof c.vhp.to === "number" && c.vhp.to < 0), ruler: rulerOf(ctx), ...(typeof fb === "function" ? { fallback: fb } : {}) };
}

/** The settings of the card for the UTC day starting at `day`. `include`: the week's listed producers, so each has a
 *  row even with no block in the 6 hours before the day (the ruler's G6, on main since 14a257b; the kit's card
 *  settings carry it from Architecture's next kit PR; until then the kit leaves it out and a missing row keeps the day
 *  pending). Sorted, distinct, never empty (the ruler's rule). */
export async function daySettings(day: number, blockAt: BlockAt, base: CardBase = CARD, include: string[] = [], ruler: RulerExtra = {}) {
  const S0 = await blockAt(day), S1 = (await blockAt(day + DAY)) - 1, L = (await blockAt(day - LEAD)) - 1;
  if (!(Number.isSafeInteger(S0) && Number.isSafeInteger(S1) && Number.isSafeInteger(L)) || !(L < S0 && S0 <= S1)) throw new Error(`day ${F.ymd(day)}: bad block window ${L}/${S0}/${S1}`);
  const inc = [...new Set(include)].sort();
  return { ...base, pooled: [...base.pooled], round: F.ymd(day), window: { W0: L - LOOK_BACK, W1: L, L, S0, S1 }, ...(ruler.mode ? { mode: ruler.mode } : {}), ...(inc.length ? { include: inc } : {}), ...(ruler.version ? { version: ruler.version } : {}) };
}

/** The scored card for a UTC day, checked: made under the rule version asked for (4 unless the kit passes version 5),
 *  the right round and game. Throws NotYet while the data or the block clock doesn't reach it. */
export async function dayCard(day: number, src: Sources, base: CardBase = CARD, include: string[] = []): Promise<RulerCard> {
  const want = src.ruler?.version ?? 4;
  const c = src.vhp.card(await daySettings(day, src.blockAt, base, include, src.ruler ?? {}));
  if (c?.ruleVersion !== want) throw new Error(`day ${F.ymd(day)}: ruler version ${c?.ruleVersion}, not ${want}`);
  if (c.round !== F.ymd(day) || c.game !== 4 || !Array.isArray(c.producers)) throw new Error(`day ${F.ymd(day)}: not Fantasy's card`);
  return c;
}

/** Is any part of the card flagged (a bad or rebuilt hour in what it reads)? The ruler marks every row then. */
export const flagged = (c: RulerCard) => c.producers.some((p) => p.quality !== "ok");
/** The card's rows by address. */
export const rowsOf = (c: RulerCard) => Object.fromEntries(c.producers.map((p) => [p.a, p]));
