// Knode Games — Fix A (pct) and network jumps just below a race-void line: how far does a mid-race jump of m% move honest
// producers' win chances? Same cards and draws as v21.mjs (chain of exact binomials). Picks the race-void threshold.
//   node sims/ruler/jumps.mjs <timeline.json | vhp-data folder> [cards] [races]
import fs from "node:fs";
import vm from "node:vm";
import { card, chances, loadVhpData, CONFIGS } from "./v21.mjs";
import { effArray, raceSlots, mod, movedFn, BLOCKS_PER_DAY, RACE, VAULT } from "./sims.mjs";
const here = new URL("../../", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(here + "vhp-ruler.js", "utf8") + fs.readFileSync(here + "race-math.js", "utf8"), box);
const R = box.window.KRuler, RM = box.window.KRaceMath;
const src = process.argv[2], cards = Number(process.argv[3] || 60), races = Number(process.argv[4] || 2500);
const tl = fs.statSync(src).isDirectory() ? loadVhpData(src).tl : JSON.parse(fs.readFileSync(src, "utf8"));
const L = R.ledger(tl), moved = movedFn(tl.moves || []);
const rng = RM.rng(20261105), slots = raceSlots(L).filter((w) => w.W0 - R.FORM >= L.validFrom), nC = Math.min(cards, slots.length);
const fields = Array.from({ length: nC }, (_, i) => slots[Math.floor(i * slots.length / nC)]).map((w) => {
  const base = w.W0 - BLOCKS_PER_DAY - 1300, ps = L.active(w.W0).filter((a) => Number(L.eff(a, w.W0)) > 0), paths = {};
  for (const p of ps) paths[p] = effArray(L, p, base, w.S1);
  const Nreal = new Float64Array(w.S1 - base + 1); for (const p of ps) for (let i = 0; i < Nreal.length; i++) Nreal[i] += paths[p][i];
  const T = w.W0 + Math.floor(rng.next() * (w.W1 - w.W0 + 1)), forms = {}, steady = {};
  for (const p of ps) { const fo = R.formOf(L, p, T), r = R.rateOf(L, p, T, fo); forms[p] = Number(fo.form) / 1e6; steady[p] = r.steady; }
  return { w, base, ps, paths, Nreal, T, forms, steady };
});
const out = {};
for (const cfgName of ["A (pct)", "A′ (fpct)"]) for (const m of [0, 0.02, 0.03, 0.05, -0.03, -0.05]) {
  const per = {};
  fields.forEach((f, ci) => {
    const paths = { ...f.paths }, mid = f.w.S0 + RACE / 2;
    if (m > 0) paths["~minted"] = mod(new Float64Array(f.paths[f.ps[0]].length).fill(m * f.Nreal[f.T - f.base]), f, (H) => (H >= mid + 20 ? 1 : 0));
    if (m < 0) for (const p of f.ps) paths[p] = mod(f.paths[p], f, (H) => (H >= mid ? 1 + m : 1));   // everyone loses |m| (stake leaves the network)
    const ch = chances(card(paths, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT], forms: f.forms, steady: f.steady }), races, 9000 + ci, CONFIGS[cfgName], { out: ["~minted"] });
    if (ch) for (const [p, x] of Object.entries(ch)) if (!moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) (per[p] ||= []).push(x);
  });
  const rs = Object.values(per).filter((xs) => xs.length >= 5).map((xs) => xs.reduce((s, x) => s + x.chance, 0) / xs.reduce((s, x) => s + x.fair, 0));
  out[`${cfgName} · network ${m >= 0 ? "+" : ""}${(m * 100).toFixed(0)}% mid-race`] = `${Math.min(...rs).toFixed(2)} … ${Math.max(...rs).toFixed(2)} of fair (${rs.length} producers)`;
  console.log(Object.keys(out).at(-1), "→", Object.values(out).at(-1));
}
