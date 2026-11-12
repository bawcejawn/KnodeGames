// Knode Games — how often would the owner's void rules (5 Nov) fire on real days? For every 6-hour race slot with a
// full 14-day look-back: (1) a PRODUCER VOID, when a producer's effective VHP during the race moves more than Y% away
// from its card size (own at T); (2) a RACE VOID, when the network total during the race moves more than X% away from
// the card's total. Read-only, real data only, no races drawn.
//   node sims/ruler/voids.mjs <timeline.json | vhp-data folder>
import fs from "node:fs";
import vm from "node:vm";
import { loadVhpData } from "./v21.mjs";
import { raceSlots, BLOCKS_PER_DAY } from "./sims.mjs";
const here = new URL("../../", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(here + "vhp-ruler.js", "utf8"), box);
const R = box.window.KRuler;
const src = process.argv[2];
const tl = fs.statSync(src).isDirectory() ? loadVhpData(src).tl : JSON.parse(fs.readFileSync(src, "utf8"));
const L = R.ledger(tl), slots = raceSlots(L).filter((w) => w.W0 - R.FORM >= L.validFrom);
const Ys = [0.05, 0.1, 0.2, 0.3], Xs = [0.02, 0.03, 0.05], STEP = 60;
const prodVoid = Object.fromEntries(Ys.map((y) => [y, 0])), raceVoid = Object.fromEntries(Xs.map((x) => [x, 0]));
let pr = 0, worstNet = 0;
const netMoves = [];
for (const w of slots) {
  const T = w.W0 + Math.floor((w.W1 - w.W0) / 2), tot = Number(R.total(L, T));
  const field = L.active(T).filter((a) => R.kOf(w.S1 - w.S0 + 1, R.own(L, a, T, "spot"), R.total(L, T)) >= 10n * R.M);
  let netDev = 0;
  for (let H = w.S0; H <= w.S1; H += STEP) { const d = Math.abs(Number(L.N(H)) / tot - 1); if (d > netDev) netDev = d; }
  netMoves.push(netDev); worstNet = Math.max(worstNet, netDev);
  for (const x of Xs) if (netDev > x) raceVoid[x]++;
  for (const a of field) {
    const own = Number(R.own(L, a, T, "spot")); if (own <= 0) continue;
    let dev = 0;
    for (let H = w.S0; H <= w.S1; H += STEP) { const d = Math.abs(Number(L.eff(a, H)) / own - 1); if (d > dev) dev = d; }
    pr++; for (const y of Ys) if (dev > y) prodVoid[y]++;
  }
}
netMoves.sort((a, b) => a - b);
console.log(JSON.stringify({ races: slots.length, producerRaces: pr,
  producerVoid: Object.fromEntries(Ys.map((y) => [`±${y * 100}%`, `${prodVoid[y]} (${(100 * prodVoid[y] / pr).toFixed(1)}%)`])),
  raceVoid: Object.fromEntries(Xs.map((x) => [`±${x * 100}%`, `${raceVoid[x]} (${(100 * raceVoid[x] / slots.length).toFixed(1)}%)`])),
  networkMoveInARace: { median: `${(100 * netMoves[Math.floor(netMoves.length / 2)]).toFixed(2)}%`, p90: `${(100 * netMoves[Math.floor(netMoves.length * 0.9)]).toFixed(2)}%`, worst: `${(100 * worstNet).toFixed(2)}%` } }, null, 1));
