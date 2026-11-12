// Knode Games — Who Signs Block X on the shared VHP ruler (owner, 11 Nov 2026; docs/VHP-RULER.md "Switching a game onto
// the ruler"; card settings from the Ruler chat, project doc claude/ruler/TO-BLOCKX-CARD-SETTINGS-2026-11-11.md).
//
// One repository variable, BLOCKX_RULER_FROM_WEEK, read strictly with KRuler.switchFrom (empty = off; anything odd stops
// the run). Set to vault week N: week N − 1 is the SHADOW week (each target's ruler card and the multiplier and points it
// would give are published in X<week>.json, marked "shadow": true; nothing counts from them), and every week from N is
// ON (a right pick scores base × min(120, kTop ÷ k) × credit at X, from the target's ruler card).
//
// One card per hourly target (makeCard only; scoreCard is for whole windows):
//   game 2; round = the target's UTC hour as yyyymmddhh; L = the pick lock (X − 100 blocks);
//   card window [W0, W1] = [L − 7,199, L] (the random moment T is in the 6 hours before the lock);
//   scoring window [S0, S1] = [L + 1, L + 7,200]: nominal, it only sizes k and the entry bar;
//   minK 10, c 500000 (unused), ownRule "spot", poolRule "min", paying, pooled = the Vault.
// Scoring a target X:
//   1. core = producers with entry whose form ≥ 0.97 × the k-weighted median form of those with entry (the lowest form
//      where 2 × the running k sum ≥ the total; equal forms sorted by address, so an exact tie takes the lower form);
//   2. kTop = the largest k in the core;
//   3. multiplier (millionths) = min(120 × M, kTop × M ÷ k), rounded down, for a producer with entry;
//   4. a pick on X's signer scores base × multiplier × creditOf(own, eff(signer, X)) ÷ M ÷ M;
//   5. void: eff(p, X) outside own × [1 − 5%, 1 + 25%] (KRuler.voidBand(1200)) → a pick on p is a miss for that target;
//   6. no entry: not offered, and a miss.
import * as fs from "node:fs";
import * as path from "node:path";

await import("../vhp-ruler.js");
await import("../vhp-data.js");
const R: any = (globalThis as any).KRuler, D: any = (globalThis as any).KVhpData;
const Mn = 1000000n;

/** Block X's ruler settings (the Ruler chat, 11 Nov): never read from a card. games.yml has the same values (tested). */
export const VAULT_ADDR = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
export const RULER = Object.freeze({ game: 2, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: Object.freeze([VAULT_ADDR]) });
/** The card's window (6 hours before the lock) and the nominal scoring window (6 hours after it). */
export const CARD_BLOCKS = 7200, SIZE_BLOCKS = 7200;
/** The multiplier's cap on the ruler (owner, 11 Nov): ×120. Points per right pick at ×1: 100 hundredths (1.00 point). */
export const CAP = 120n, BASE = 100n;
/** The void band for a single target: KRuler.voidBand(1200) = 5% down / 25% up (the 1-hour band). */
export const VOID_BLOCKS = 1200;
/** The most a pick can score while the ruler is on (hundredths): 120 × 100. */
export const MAX_POINTS = Number(CAP * BASE);

export type Window = { W0: number; W1: number; L: number; S0: number; S1: number };

/** The variable, strictly (KRuler.switchFrom): empty → null; 1 … 999999 → the week; anything else throws. */
export const switchFrom = (v: unknown): number | null => R.switchFrom(v);
export const modeOf = (week: number, from: number | null): "off" | "shadow" | "on" => R.rulerMode(week, from === null ? "" : from);

/** round: the target block's UTC hour as yyyymmddhh, decimal text (one target an hour, so unique; it seeds T). */
export function roundOf(targetTime: number): string {
  const d = new Date(targetTime), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;
}
/** The card's window from the pick lock L: W0 = L − 7,199, W1 = L, S0 = L + 1, S1 = L + 7,200. */
export function windowOf(L: number): Window {
  return { W0: L - CARD_BLOCKS + 1, W1: L, L, S0: L + 1, S1: L + SIZE_BLOCKS };
}
/** Block X's own settings for one target (what recompute needs: every key). */
export const settingsFor = (round: string, window: Window) => ({ game: RULER.game, round, window, c: RULER.c, minK: RULER.minK, poolRule: RULER.poolRule, ownRule: RULER.ownRule, paying: RULER.paying, pooled: [...RULER.pooled] });

/** The card for a target (lock L, target time t): makeCard with Block X's settings. Throws "not yet …" while the data
 *  doesn't reach the seed block or a chained hour is unverified. */
export function cardFor(L: any, lock: number, targetTime: number): any {
  return R.makeCard(L, { ...settingsFor(roundOf(targetTime), windowOf(lock)), c: BigInt(RULER.c), pooled: [...RULER.pooled] });
}

const big = (x: any) => BigInt(x);
/** Steps 1 and 2: the core (addresses) and kTop, from a card (its own rows, as published). */
export function coreOf(card: any): { core: string[]; kTop: bigint; median: bigint } {
  const field = (card.producers || []).filter((p: any) => p.entry === true)
    .sort((x: any, y: any) => { const a = big(x.form), b = big(y.form); return a < b ? -1 : a > b ? 1 : x.a < y.a ? -1 : x.a > y.a ? 1 : 0; });
  const all = field.reduce((s: bigint, p: any) => s + big(p.k), 0n);
  let median = 0n, cum = 0n;
  for (const p of field) { cum += big(p.k); if (2n * cum >= all) { median = big(p.form); break; } }
  const line = (median * 970000n) / Mn;
  const core = field.filter((p: any) => big(p.form) >= line);
  const kTop = core.reduce((m: bigint, p: any) => (big(p.k) > m ? big(p.k) : m), 0n);
  return { core: core.map((p: any) => p.a).sort(), kTop, median };
}
/** Step 3: a producer's multiplier in millionths (null: no entry, or not on the card). */
export function multiplierOf(card: any, a: string, kTop = coreOf(card).kTop): bigint | null {
  const p = (card.producers || []).find((x: any) => x.a === a);
  if (!p || p.entry !== true || kTop <= 0n) return null;
  const k = big(p.k);
  if (k <= 0n) return null;
  const m = (kTop * Mn) / k, cap = CAP * Mn;
  return m < cap ? m : cap;
}
/** Steps 4–6 for X's signer: { points (hundredths), multiplier, credit, void, why }. points 0 = a miss. */
export function scoreTarget(card: any, L: any, X: number, signer: string) {
  const { kTop } = coreOf(card);
  const p = (card.producers || []).find((x: any) => x.a === signer);
  if (!p || p.entry !== true) return { points: 0, multiplier: null, credit: null, void: false, why: "the signer has no entry on the card" };
  const own = big(p.own), eff = big(L.eff(signer, X));
  const [down, up] = R.voidBand(VOID_BLOCKS);
  const lo = (own * (Mn - down)) / Mn, hi = (own * (Mn + up)) / Mn;
  if (eff < lo || eff > hi) return { points: 0, multiplier: null, credit: null, void: true, why: "the signer's VHP at the block was outside its card size by more than the 1-hour band" };
  const mult = multiplierOf(card, signer, kTop)!, credit = R.creditOf(own, eff) as bigint;
  return { points: Number((BASE * mult * credit) / (Mn * Mn)), multiplier: mult, credit, void: false, why: null };
}

/** The vhp-data folder as a ruler ledger: every hour checked (hash chain, balances) as the ruler's own tools do. */
export function loadLedger(dir: string): any {
  const texts = new Map<number, string>();
  const dd = path.join(dir, "d"), hd = path.join(dir, "h");
  for (const f of fs.existsSync(dd) ? fs.readdirSync(dd) : []) {
    if (!/^(0|[1-9][0-9]*)\.json$/.test(f)) continue;
    const day = JSON.parse(fs.readFileSync(path.join(dd, f), "utf8"));
    day.hours.forEach((h: any, i: number) => texts.set(day.n * 24 + i, D.canon(h)));
  }
  for (const f of fs.existsSync(hd) ? fs.readdirSync(hd) : []) if (/^(0|[1-9][0-9]*)\.json$/.test(f)) texts.set(Number(f.slice(0, -5)), fs.readFileSync(path.join(hd, f), "utf8"));
  const ns = [...texts.keys()].sort((a, b) => a - b), hours: any[] = [], checks: any[] = [];
  if (!ns.length) throw new Error("the vhp-data folder has no hours");
  let prev = "";
  for (const n of ns) {
    const t = texts.get(n)!, c = prev === "" ? D.checkKept(t) : D.checkHour(prev, t);
    if (!c.ok) throw new Error(`vhp-data h/${n}: ${c.why}`);
    checks.push(c); hours.push(JSON.parse(t)); prev = t;
  }
  return R.ledger(D.timelineFrom(hours, checks));
}

// ── stage 2: the recorder's ruler entries (one per target) and day files ──
/** A target's ruler entry. card: the canonical card JSON text (never re-made once published) | null with a note.
 *  points: what a right pick on the signer scores (hundredths); 0 when void or no entry. A wrong pick always scores 0. */
export type RulerTarget = { round: number; height: number; lock: number; cardRound: string; window: Window; card: string | null; note: string | null;
  signer: string | null; points: number; void: boolean; why: string | null };
/** X<week>-<d>.json, d = 0 (Monday) … 6 (Sunday) by the target's UTC day: at most 24 cards, so no file nears 2 MB. */
export type RulerDay = { v: 1; week: number; day: number; rulerFrom: number | null; mode: "off" | "shadow" | "on"; shadow: boolean; targets: RulerTarget[] };
export const xName = (week: number, day: number) => `X${String(week).padStart(3, "0")}-${day}.json`;
export const dayOf = (time: number, weekStart: number) => Math.floor((time - weekStart) / 86400000);
export function emptyDay(week: number, day: number, from: number | null): RulerDay {
  const mode = modeOf(week, from);
  return { v: 1, week, day, rulerFrom: from, mode, shadow: mode === "shadow", targets: [] };
}
/** How long the recorder waits for the ruler's data to score a target before it counts no pick on it (3 days, the
 *  recorder's own look-back: vhp-data is normally an hour or two behind). */
export const RULER_WAIT_MS = 3 * 86400000;

/** A final, recorded target's ruler entry. L: the ruler's ledger (null: unavailable this run). old: last run's entry
 *  (kept as published once it has a card). now: the run's head time (for the wait). A target the recorder voided is
 *  void here too (no points). */
export function entryFor(L: any, t: { round: number; height: number; time: number; signer: string | null; void?: boolean }, lead: number, now: number, old?: RulerTarget | null): RulerTarget {
  const lock = t.height - lead, cardRound = roundOf(t.time), window = windowOf(lock);
  if (old && old.card && old.height === t.height && old.cardRound === cardRound && JSON.stringify(old.window) === JSON.stringify(window)) return old;
  const base: RulerTarget = { round: t.round, height: t.height, lock, cardRound, window, card: null, note: null, signer: t.signer, points: 0, void: false, why: null };
  if (t.void || !t.signer) return { ...base, void: true, why: "the target itself is void (no signer recorded)" };
  const late = now - t.time >= RULER_WAIT_MS;
  const wait = (note: string) => (late ? { ...base, void: true, note, why: "the ruler couldn't score this target within 3 days: no pick on it counts" } : { ...base, note });
  if (!L) return wait("not yet: the ruler's data isn't available this run");
  if (t.height + R.DELAY > L.to || lock + 20 > L.to) return wait(`not yet: the ruler's data reaches block ${L.to}, the target is block ${t.height}`);
  try {
    const card = cardFor(L, lock, t.time), text = R.cardJson(card), sc = scoreTarget(JSON.parse(text), L, t.height, t.signer);
    return { ...base, card: text, points: sc.points, void: sc.void, why: sc.why };
  } catch (e) {
    const m = (e as Error).message;
    return wait(/not yet/.test(m) ? m : `the ruler couldn't make this card: ${m}`);
  }
}
/** A pick's points on the ruler: the entry's points if the pick named the signer, else 0. undefined: not scored yet. */
export function ruledPoints(e: RulerTarget | null | undefined, producer: string): number | undefined {
  if (!e || (!e.card && !e.void)) return undefined;
  return !e.void && producer === e.signer ? e.points : 0;
}
