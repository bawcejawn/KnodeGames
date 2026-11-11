// Knode Games — the Producer Race on the shared VHP ruler (owner, 11 Nov 2026; docs/VHP-RULER.md "Switching a game
// onto the ruler"; settings from the Ruler chat, project doc claude/ruler/TO-RACE-CARD-SETTINGS-2026-11-11.md).
//
// One repository variable, RACE_RULER_FROM_WEEK, read strictly with KRuler.switchFrom (empty = off; anything odd stops
// the run). Set to vault week N: week N − 1 is the SHADOW week (the ruler's cards are made, scored and published in
// R<week>.json marked "shadow": true; nothing counts from them), and every week from N is ON (the 6-hour race's 1st,
// 2nd and 3rd are the ruler's: fpct order among the producers with entry that aren't void; the points per place are the
// Race's own, unchanged). The 6-hour race only: the race types stay on their own scoring (RULER_TYPES below).
//
// The W<week>.json files are unchanged (Block X, Combo, Golf and the pages read them): the 6-hour race is still recorded
// and its handicap standings are the page's live estimate. In an ON week the board and the vault take the placings from
// R<week>.json instead, with the picks from W<week>.json (read on both nodes as before).
//
// R<week>.json: { v: 1, week, rulerFrom (null = unset), mode ("off" | "shadow" | "on"), shadow (mode === "shadow"),
//   races: [ { id, round, window: { W0, W1, L, S0, S1 }, card (the ruler's canonical card JSON text, scored) | null,
//              note (why there is no card yet) | null, placings: [up to 3 producer addresses] } ] }
// The publish job (race.yml) rebuilds every card with vhp_ruler.recompute from the settings below (its own copy, a test
// keeps them equal), never from the card, and refuses a switch change that would change how a started week is scored.
import * as fs from "node:fs";
import * as path from "node:path";

await import("../vhp-ruler.js");
await import("../vhp-data.js");
const R: any = (globalThis as any).KRuler, D: any = (globalThis as any).KVhpData, M: any = (globalThis as any).KRaceMath;

/** The Race's ruler settings (the Ruler chat, 11 Nov): never read from a card. race.yml has the same values (tested). */
export const VAULT_ADDR = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
export const RULER = Object.freeze({ game: 7, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: Object.freeze([VAULT_ADDR]) });
/** The race types on the ruler (per-type flag, cleared one by one after a shadow week): only the 6-hour race for now. */
export const RULER_TYPES = Object.freeze([0]);
/** The card window's length (the 6 hours before the lock, for every type; the Ruler chat, 11 Nov). */
export const CARD_BLOCKS = 7200;

export type RulerEntry = { id: string; round: string; window: { W0: number; W1: number; L: number; S0: number; S1: number }; card: string | null; note: string | null; placings: string[] };
export type RulerFile = { v: 1; week: number; rulerFrom: number | null; mode: "off" | "shadow" | "on"; shadow: boolean; races: RulerEntry[] };

/** The variable, strictly (KRuler.switchFrom): empty → null; 1 … 999999 → the week; anything else throws. */
export const switchFrom = (v: unknown): number | null => R.switchFrom(v);
export const modeOf = (week: number, from: number | null): "off" | "shadow" | "on" => R.rulerMode(week, from === null ? "" : from);

/** round: yyyymmddhh × 10 + type, as decimal text (unique per race; it seeds the card time). */
export function roundOf(start: number, type = 0): string {
  const d = new Date(start), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${type}`;
}
/** The 6-hour race's ruler window from its own blocks (the recorded heights [S0, S1]: the first and the last block in
 *  its UTC window, about 7,200; the Ruler chat, 11 Nov): L = S0 − 1, the last block a pick can be in (the Race contract
 *  locks at the race's start: the shape the fairness runs used, W1 = L = S0 − 1); W1 = L, W0 = L − 7,199 (the card
 *  window, the 6 hours before the lock). The seed block L + 20 is inside the race, after the lock. */
export function windowOf(S0: number, S1: number) {
  if (!Number.isSafeInteger(S0) || !Number.isSafeInteger(S1) || S1 < S0) throw new Error("a race's blocks [S0, S1] are needed");
  const L = S0 - 1;
  return { W0: L - CARD_BLOCKS + 1, W1: L, L, S0, S1 };
}
/** The Race's own settings for one race (what recompute needs: every key). */
export const settingsFor = (round: string, window: RulerEntry["window"]) => ({ game: RULER.game, round, window, c: RULER.c, minK: RULER.minK, poolRule: RULER.poolRule, ownRule: RULER.ownRule, paying: RULER.paying, pooled: [...RULER.pooled] });

/** 1st, 2nd, 3rd from a scored card: the field (entry and not void) by fpct, highest first; equal fpct by address. */
export function placingsOf(card: any): string[] {
  const field = (card.producers || []).filter((p: any) => p.entry && !p.void && p.fpct !== null && p.fpct !== undefined);
  field.sort((x: any, y: any) => { const a = BigInt(x.fpct), b = BigInt(y.fpct); return a > b ? -1 : a < b ? 1 : x.a < y.a ? -1 : x.a > y.a ? 1 : 0; });
  return field.slice(0, 3).map((p: any) => p.a);
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

/** One 6-hour race's ruler entry: its card made and scored once the data has S1 (+ the ruler's delay). A "not yet"
 *  (data not in, or a chained hour no live hour has checked) leaves card null with the note; the next run tries again. */
export function entryFor(L: any, race: { id: string; start: number; result: any }, old?: RulerEntry | null): RulerEntry | null {
  const h = race.result?.heights;
  if (!race.result?.final || race.result.missed || !Array.isArray(h) || !Number.isSafeInteger(h[0]) || !Number.isSafeInteger(h[1]) || h[1] < h[0]) return null;
  const round = roundOf(race.start, 0), window = windowOf(h[0], h[1]);
  if (old && old.card && old.round === round && JSON.stringify(old.window) === JSON.stringify(window)) return old;
  const base: RulerEntry = { id: race.id, round, window, card: null, note: null, placings: [] };
  if (!L) return { ...base, note: "not yet: the ruler's data isn't available this run" };
  if (window.S1 + R.DELAY > L.to) return { ...base, note: `not yet: the ruler's data reaches block ${L.to}, the race ends at ${window.S1}` };
  try {
    const card = R.scoreCard(L, R.makeCard(L, { ...settingsFor(round, window), c: BigInt(RULER.c), pooled: [...RULER.pooled] }));
    const text = R.cardJson(card);
    return { ...base, card: text, placings: placingsOf(JSON.parse(text)) };
  } catch (e) {
    const m = (e as Error).message;
    return { ...base, note: /not yet/.test(m) ? m : `the ruler couldn't make this card: ${m}` };
  }
}

/** A 6-hour race's result as the ruler scores it, for the board and the vault in an ON week: the picks from the W file
 *  (read on both nodes), 1st / 2nd / 3rd from the ruler's card. null: not scored yet (keeps the week open). A race whose
 *  field is empty (every producer void or out) counts no pick: the pick is given back (D-164). */
export function ruledResult(result: any, entry: RulerEntry | null | undefined): any | null {
  if (!result?.final) return result;
  if (result.missed) return result;
  if (!entry || !entry.card) return null;
  const pl = entry.placings;
  if (!pl.length) return { final: true, void: true, picks: [] };
  // D-033: a 2nd or 3rd scores a show only if that producer signed at least one block in the race.
  const rows = new Map((JSON.parse(entry.card).producers || []).map((p: any) => [p.a, p]));
  const shows = pl.slice(1, 3).filter((a) => Number((rows.get(a) as any)?.signed) >= 1);
  const picks = (Array.isArray(result.picks) ? result.picks : []).map((x: any[]) => [x[0], x[1], x[2], x[1] === pl[0] ? 1 : 0, 0, x[1] !== pl[0] && shows.includes(x[1]) ? 1 : 0]);
  // standings: the ruler's order, so the points per place (D-173, with the race types) read 2nd and 3rd from it
  return { final: true, winner: pl[0], placings: pl, standings: pl.map((a) => ({ a })), picks };
}

export function emptyRuler(week: number, from: number | null): RulerFile {
  const mode = modeOf(week, from);
  return { v: 1, week, rulerFrom: from, mode, shadow: mode === "shadow", races: [] };
}
void M;
