/**
 * Producer Bracket on the shared VHP ruler (R-BR-7, the luck percentile of D-141; owner 11 Nov 2026). Read-only: it
 * reads the vhp-data branch the ruler records, makes and scores one ruler card per matchup day, and never sends.
 *
 * The switch is the repository variable BRACKET_RULER_FROM_WEEK (vhp-ruler.js switchFrom / rulerMode, the same rule in
 * every game): unset = the Bracket's own day index, as before; N = vault week N − 1 is the shadow week and every week
 * from N is on. This file is phase 1: off and shadow. A shadow week's ruler result is published beside the real one,
 * in its own file (ruler/W<week>.json, "shadow": true), and counts for nothing: the week file's results, points and the
 * vault file never use it. An "on" week isn't scored by this build (bracket.ts holds it with an alert).
 *
 * One card per matchup day (round r): all producers on one card, scored over the day's own blocks.
 *   S0 / S1: the first and last block of the day, as the Bracket recorded them (days[r][0].from, days[r][23].to).
 *   L = S0 − 1 (picks locked on Monday; the day's matchups are set before it starts); the card moment T is drawn by
 *   the ruler in [L − 7,199, L], the 6 hours before the day (the Ruler chat's daily shape, TO-RACE-CARD-SETTINGS).
 *   ownRule "spot" (the only rule the fairness runs measured at RULE_VERSION 4), minK 10, poolRule "min", c 500000,
 *   pooled: the Knode Games Pool (the Vault races like everyone, D-162), paying: true (the same waits and checks as a
 *   paying card, also in the shadow week).
 * A matchup: the higher fpct wins; a seed void that day, or not in the card's field, loses; both: the day index
 * decides (as when both forfeit); an exact fpct tie goes to the lower seed. Forfeits still come first, on the day's
 * averages (D-086, D-087). bracket-math otherWins / results.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import vm from "node:vm";

const root = new URL("../..", import.meta.url).pathname;
const box: any = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "vhp-ruler.js"), "utf8"), box);
vm.runInNewContext(fs.readFileSync(path.join(root, "vhp-data.js"), "utf8"), box);
export const R: any = box.window.KRuler;
const D: any = box.window.KVhpData;

export const GAME = 9;
export const C = 500000n;
export const OWN_RULE = "spot";
export const MIN_K = 10;
export const POOL_RULE = "min";
export const CARD_WINDOW = 7200;                 // the card moment falls in the 6 hours (7,200 blocks) before the day
export const SUMMARY_V = 1;

/** The switch, strictly (empty → null; a week 1 … 999,999; anything else stops the run loudly). */
export const switchFrom = (v: string | undefined | null): number | null => R.switchFrom(v ?? "");
export const rulerMode = (week: number, from: number | null): "off" | "shadow" | "on" => R.rulerMode(week, from === null ? "" : from);
export const switchChange = (prev: number | null, next: number | null, week: number): string | null =>
  R.switchChange(prev === null ? "" : prev, next === null ? "" : next, week);

/** A card's round number: the matchup day as yyyymmdd (UTC), unique per day for game 9 (it seeds the card moment). */
export function roundOf(dayStart: number): string {
  const d = new Date(dayStart);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** The card file's name for a week's round. */
export const cardName = (w: number, r: number) => `W${String(w).padStart(3, "0")}-R${r}.json`;
export const summaryName = (w: number) => `W${String(w).padStart(3, "0")}.json`;

/** The game's OWN settings for a day's card (never read from a card: the publish job rebuilds from these). */
export function settingsFor(dayStart: number, S0: number, S1: number, pooled: string[]) {
  const L = S0 - 1;
  return { game: GAME, round: roundOf(dayStart), window: { W0: L - (CARD_WINDOW - 1), W1: L, L, S0, S1 }, c: C, minK: MIN_K, poolRule: POOL_RULE, ownRule: OWN_RULE, paying: true, pooled: [...pooled].sort() };
}

/** vhp-data (a checkout of the vhp-data branch: d/<day>.json and h/<hour>.json), checked hour by hour as the ruler's
 *  own tools do; returns the ledger, or null when there is no data folder. A broken chain stops with the reason. */
export function loadLedger(dir: string | undefined): any | null {
  if (!dir || !fs.existsSync(path.join(dir, "h"))) return null;
  const texts = new Map<number, string>();
  const dd = path.join(dir, "d");
  for (const f of fs.existsSync(dd) ? fs.readdirSync(dd).filter((x) => /^[0-9]{1,7}\.json$/.test(x)) : []) {
    const d = JSON.parse(fs.readFileSync(path.join(dd, f), "utf8"));
    d.hours.forEach((h: any, i: number) => texts.set(d.n * 24 + i, D.canon(h)));
  }
  for (const f of fs.readdirSync(path.join(dir, "h")).filter((x) => /^[0-9]{1,9}\.json$/.test(x))) texts.set(Number(f.replace(".json", "")), fs.readFileSync(path.join(dir, "h", f), "utf8"));
  const ns = [...texts.keys()].sort((a, b) => a - b), hours: any[] = [], checks: any[] = [];
  let prev = "";
  for (const n of ns) {
    const c = prev === "" ? D.checkKept(texts.get(n)) : D.checkHour(prev, texts.get(n));
    if (!c.ok) throw new Error(`vhp-data hour ${n}: ${c.why}`);
    checks.push(c); hours.push(JSON.parse(texts.get(n)!)); prev = texts.get(n)!;
  }
  if (!hours.length) return null;
  return R.ledger(D.timelineFrom(hours, checks));
}

/** Make and score a day's card. Returns { card (the canonical JSON text) } or { notYet: reason } when the data doesn't
 *  cover it yet (retried next run). Any other error is thrown. */
export function dayCard(L: any, settings: any): { text: string } | { notYet: string } {
  // the day's last block (and the ruler's delay after it) must be in the data, as in the ruler's own shadow tool
  if (settings.window.S1 + R.DELAY > L.to) return { notYet: `vhp-data reaches block ${L.to}; the day ends at ${settings.window.S1}` };
  try {
    const card = R.scoreCard(L, R.makeCard(L, settings));
    return { text: R.cardJson(card) };
  } catch (e) {
    const m = (e as Error).message;
    if (/not yet|no id for the seed block|not enough history|needs .* blocks of data|outside the data|beyond the data/i.test(m)) return { notYet: m };
    throw e;
  }
}

/** A scored card's matchup summary: address → fpct (decimal millionths) or null (void, not in the field). */
export function rowsOf(text: string): Record<string, string | null> {
  const c = JSON.parse(text), out: Record<string, string | null> = {};
  for (const p of c.producers) out[p.a] = p.fpct === null || p.fpct === undefined ? null : String(p.fpct);
  return out;
}
