// Shared Game Kit source: the VHP ruler's published data (vhp-data branch), for games that score from ruler cards
// (Fantasy first; kit Phase 1b, G1/G2). Games never import vhp-ruler.js or vhp-data.js themselves: they get ctx.vhp from
// the kit, which loads the vhp-data folder the workflow fetched (read-only) into one checked ledger per run, exactly as
// bot/race-ruler.ts does. One copy serves both "nodes": the ruler's own recorder already read it on two nodes and the
// ruler's publish job checked every hour (D-112).
//
// ctx.vhp.card(settings) makes and scores one card (KRuler.makeCard + scoreCard, RULE_VERSION from vhp-ruler.js) and
// returns it parsed; the kit records [settings, sha256 of cardJson] so the week / inputs file names every card it used
// (G3: the publish check rebuilds them, once the Ruler chat agrees which functions its inline copy holds).
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { ReadFailed } from "../nodes.ts";

await import("../../../vhp-ruler.js");
await import("../../../vhp-data.js");
const R: any = (globalThis as any).KRuler, D: any = (globalThis as any).KVhpData;

/** A card that can't be made YET (the data doesn't reach the window plus the ruler's delay, or a chained hour no live
 *  hour has checked yet): the kit's NotYet (types.ts). */
import { NotYet } from "../types.ts";
export { NotYet };

/** One card's settings (what KRuler.recompute needs; the game's own constants, never read from a card). */
export type CardSettings = {
  game: number; round: string; window: { W0: number; W1: number; L: number; S0: number; S1: number };
  c: string; minK: number; poolRule: string; ownRule: string; paying: boolean; pooled: string[];
  /** Optional (the ruler's scoring modes, #284): A, B, C or D. Without it the card scores exactly as before. */
  mode?: "A" | "B" | "C" | "D";
  /** Optional (the ruler's G6): producers that get a row even with no block in the 6 hours before the card. */
  include?: string[];
};
export type CardRef = [CardSettings, string];          // [settings, sha256 of the scored card's cardJson text]
export type Vhp = {
  /** The last block the data reaches. */
  to: number;
  ruleVersion: number;
  /** The scored card for these settings, parsed (cardJson). Throws NotYet while the data doesn't cover it. */
  card(s: CardSettings): any;
};

export const RULE_VERSION: number = R.RULE_VERSION;
export const DELAY: number = R.DELAY;

/** The vhp-data folder (d/<n>.json day files and h/<n>.json hour files) as a ruler ledger; every hour checked (hash
 *  chain, balances) with the ruler's own checks. A gap or a failed check throws: the kit then gives the game no data
 *  this run (ctx.vhp = null), never partial data. */
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

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
// Key order is the publish check's (game … pooled, then mode, then include, each only when set).
const canonSettings = (s: CardSettings): CardSettings => ({
  game: s.game, round: String(s.round), window: { W0: s.window.W0, W1: s.window.W1, L: s.window.L, S0: s.window.S0, S1: s.window.S1 },
  c: String(s.c), minK: s.minK, poolRule: s.poolRule, ownRule: s.ownRule, paying: !!s.paying, pooled: [...s.pooled].sort(),
  ...(s.mode === undefined ? {} : { mode: s.mode }),
  ...(s.include === undefined ? {} : { include: [...s.include].sort() }),
});
/** A card's identity without its optional scoring settings: the same game, round, window and terms (#G-69 G69-3). */
export const cardIdentity = (s: CardSettings): string => {
  const { mode, include, ...core } = canonSettings(s);
  void mode; void include;
  return JSON.stringify(core);
};

/** ctx.vhp for one run over a loaded ledger, recording every card made into `used` (keyed by sha256, so a card made
 *  twice, e.g. once per "node", is listed once). */
export function vhpFor(L: any, used: Map<string, CardRef>, pinned?: Map<string, CardSettings>): Vhp {
  return {
    to: L.to,
    ruleVersion: RULE_VERSION,
    card(s0: CardSettings) {
      // #G-69 G69-3: a card this game already published is re-made from the settings stored with it (mode, include),
      // never from today's, so switching include or a mode on doesn't make a published week look changed.
      const pin = pinned?.get(cardIdentity(s0));
      const s = canonSettings(pin ?? s0);
      if (!Number.isSafeInteger(s.window.S1) || s.window.S1 + DELAY > L.to) throw new NotYet(`not yet: the ruler's data reaches block ${L.to}, the card needs ${s.window.S1} + ${DELAY}`);
      let text: string;
      try {
        text = R.cardJson(R.scoreCard(L, R.makeCard(L, { ...s, c: BigInt(s.c), pooled: [...s.pooled], ...(s.include ? { include: [...s.include] } : {}) })));
      } catch (e) {
        const m = (e as Error).message;
        if (/not yet/i.test(m)) throw new NotYet(m);
        // Data that should be there and isn't (pruned past retention, G4) or a card the ruler refuses: a read failure,
        // so a final week's re-read is "couldn't re-read", never "the result changed".
        throw new ReadFailed("vhp-data", `card ${s.round}`, e);
      }
      const h = sha(text);
      used.set(h, [s, h]);
      return JSON.parse(text);
    },
  };
}

/** Every card used, in a stable order (round, then sha256): the `cards` list of a week or inputs file. */
/** The settings of a published card list, by card identity (#G-69 G69-3). */
export const pinsOf = (cards: unknown): Map<string, CardSettings> => {
  const m = new Map<string, CardSettings>();
  if (Array.isArray(cards)) for (const c of cards) if (Array.isArray(c) && c[0] && typeof c[0] === "object") m.set(cardIdentity(c[0] as CardSettings), c[0] as CardSettings);
  return m;
};

export const cardList = (used: Map<string, CardRef>): CardRef[] =>
  [...used.values()].sort((x, y) => (x[0].round < y[0].round ? -1 : x[0].round > y[0].round ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));

/** The loaded ruler library (KRuler), for the kit's test fixtures only; games use ctx.vhp. */
export const rulerLib = (): any => R;
