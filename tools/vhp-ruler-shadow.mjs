// Knode Games — the ruler's own shadow run (owner, 11 Nov 2026): make and score REAL v2.1 cards (vhp-ruler.js, the
// exact code games will run) on live vhp-data, for every race length a game uses, and show who would have won.
// Read-only: reads a vhp-data checkout, writes only --out, sends nothing. Data only: nothing pays from it.
//   node tools/vhp-ruler-shadow.mjs <vhp-data folder> [--lengths 1200,2400,7200,28800] [--races 60] [--modes A,B,C,D] [--out <folder>]
// --modes scores the same races under each scoring mode (A VHP only, B form lift, C own pace, D even odds) side by side,
// so the admin can compare them before choosing a mode for a future week (<GAME>_RULER_MODE).
// Windows are block-aligned races of each length (1 h = 1,200 blocks), the latest --races of each that the data covers
// with 14 days of form before them: the same shape as a game's race, not its exact clock times.
// For each length: races scored, field sizes, voids, band set-asides, and each producer's wins (top fpct in its field)
// against its fair share (1 ÷ field for each race it was in). Ties at the top share the win.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadVhpData } from "../sims/ruler/v21.mjs";

const root = new URL("..", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(root + "vhp-ruler.js", "utf8"), box);
const R = box.window.KRuler;
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (!args[0] || args[0].startsWith("--")) { console.error("usage: node tools/vhp-ruler-shadow.mjs <vhp-data folder> [--lengths 1200,2400,7200,28800] [--races 60] [--modes A,B,C,D] [--out <folder>]"); process.exit(2); }
const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const lengths = opt("--lengths", "1200,2400,7200,28800").split(",").map(Number), want = Number(opt("--races", 60)), out = opt("--out");
const modes = opt("--modes") ? opt("--modes").split(",") : [undefined];
for (const m of modes) if (m !== undefined && !R.MODES.includes(m)) { console.error(`unknown mode ${m}: use A, B, C or D`); process.exit(2); }
const { tl } = loadVhpData(args[0]), L = R.ledger(tl);
if (out) fs.mkdirSync(out, { recursive: true });
const name = (n) => (n % 28800 === 0 ? `${n / 28800}-day` : `${n / 1200}-hour`);
const all = [];
for (const len of lengths) for (const mode of modes) {
  const tag = mode === undefined ? "" : ` [mode ${mode}]`, suffix = mode === undefined ? "" : `-${mode}`;
  const slots = [];
  for (let Lk = Math.floor(L.to / len) * len - len; slots.length < want && Lk - len + 1 - R.FORM - R.ACTIVE - 1300 >= L.from; Lk -= len) slots.push({ W0: Lk - len + 1, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + len });
  const cards = [], wins = new Map(), fair = new Map(), seen = new Map(), fields = [];
  let notYet = 0, voids = 0, coreRaces = 0, setAsides = 0;
  for (const w of slots.reverse()) {
    if (w.S1 + R.DELAY > L.to) { notYet++; continue; }
    let c;
    try { c = R.scoreCard(L, R.makeCard(L, { game: 7, round: String(w.L), window: w, c: 500000n, minK: 10, poolRule: "min", ownRule: "spot", paying: false, pooled: [VAULT], ...(mode === undefined ? {} : { mode }) })); }
    catch (e) { if (/not yet/.test(e.message)) { notYet++; continue; } throw e; }
    cards.push(R.cardJson(c));
    const field = c.producers.filter((p) => p.entry && !p.void);
    voids += c.producers.filter((p) => p.entry && p.void).length;
    coreRaces += c.producers.filter((p) => p.core).length; setAsides += c.producers.filter((p) => p.setAside).length;
    if (!field.length) continue;
    fields.push(field.length);
    let top = -1n; for (const p of field) if (BigInt(p.fpct) > top) top = BigInt(p.fpct);
    const winners = field.filter((p) => BigInt(p.fpct) === top);
    for (const p of field) { fair.set(p.a, (fair.get(p.a) || 0) + 1 / field.length); seen.set(p.a, (seen.get(p.a) || 0) + 1); }
    for (const p of winners) wins.set(p.a, (wins.get(p.a) || 0) + 1 / winners.length);
  }
  if (out) fs.writeFileSync(path.join(out, `${name(len)}${suffix}.jsonl`), cards.join(""));
  const sorted = [...fields].sort((a, b) => a - b), med = sorted.length ? sorted[sorted.length >> 1] : 0;
  const rows = [...seen.keys()].map((a) => ({ a, races: seen.get(a), wins: +(wins.get(a) || 0).toFixed(2), fair: +fair.get(a).toFixed(2) })).sort((x, y) => y.races - x.races);
  const s = R.weekSummary(cards);
  const res = { length: name(len), mode: mode ?? null, blocks: len, races: cards.length, racesWithField: fields.length, notYet, fieldMedian: med, fieldMin: sorted[0] || 0, fieldMax: sorted[sorted.length - 1] || 0, voids, setAsideRate: s.setAsideRate, setAsideExpected: s.setAsideExpected, producers: rows };
  all.push(res);
  console.log(`\n${res.length} races (${len} blocks)${tag}: ${res.races} scored, ${res.racesWithField} with a field (median ${med}, ${res.fieldMin}–${res.fieldMax} producers); ${voids} voids; band set-asides ${(s.setAsideRate / 10000).toFixed(2)}% of core member-races (≈${(s.setAsideExpected / 10000).toFixed(2)}% by chance)`);
  console.log("  producer                              races   wins   fair   wins÷fair");
  for (const r of rows) console.log(`  ${r.a.padEnd(36)} ${String(r.races).padStart(5)} ${r.wins.toFixed(2).padStart(6)} ${r.fair.toFixed(2).padStart(6)}   ${r.fair ? (r.wins / r.fair).toFixed(2) : "-"}`);
}
if (out) fs.writeFileSync(path.join(out, "shadow.json"), JSON.stringify(all, null, 1));
