// Knode Games — VHP ruler, RULE_VERSION 4 design runs (11 Nov 2026): how far producers' effective VHP really moves from its
// size at the start of a race, down and up apart, by race length, on live vhp-data; and the share of producer-races a
// void band of each width would void. The void bands (voidBand in vhp-ruler.js) were set from this.
//   node --max-old-space-size=3000 sims/ruler/moves.mjs <vhp-data folder> [out.json]
import fs from "node:fs"; import vm from "node:vm";
import { loadVhpData } from "./v21.mjs";
const box = { window: {} }; vm.runInNewContext(fs.readFileSync(new URL("../../vhp-ruler.js", import.meta.url), "utf8"), box); const R = box.window.KRuler;
const { tl } = loadVhpData(process.argv[2]), L = R.ledger(tl);
const from = L.from + 28800 + 1300, to = L.to - 25, n = to - from + 1;
const ps = [...new Set([from, from + Math.floor(n / 2), to - 7200].flatMap((h) => L.active(h)))];
const eff = {}; for (const p of ps) { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = Number(L.eff(p, from + i)); eff[p] = a; }
const N = new Float64Array(n); for (const p of ps) for (let i = 0; i < n; i++) N[i] += eff[p][i];
const T = [0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15, 0.20, 0.25, 0.35, 0.50, 1.0, 2.0], out = {};
for (const [nm, len] of [["1h", 1200], ["2h", 2400], ["6h", 7200], ["1d", 28800], ["6d", 172800]]) {
  const step = Math.min(len, 7200), ups = [], downs = [];
  for (let s = 0; s + len <= n; s += step) for (const p of ps) {
    const o = eff[p][s]; if (!(o > 0) || len * o / N[s] < 10) continue;
    let lo = o, hi = o; const e = eff[p]; for (let i = s; i < s + len; i++) { const v = e[i]; if (v < lo) lo = v; else if (v > hi) hi = v; }
    ups.push(hi / o - 1); downs.push(1 - lo / o);
  }
  const q = (a, f) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(f * a.length))];
  out[nm] = { n: ups.length, downMedian: q(downs, 0.5), downP90: q(downs, 0.9), downP99: q(downs, 0.99), upMedian: q(ups, 0.5), upP90: q(ups, 0.9), upP99: q(ups, 0.99),
    down: Object.fromEntries(T.map((t) => [t, downs.filter((d) => d > t).length / downs.length])), up: Object.fromEntries(T.map((t) => [t, ups.filter((d) => d > t).length / ups.length])) };
  console.log(nm, ups.length, "down med/p90/p99", [0.5, 0.9, 0.99].map((f) => (q(downs, f) * 100).toFixed(2)).join("/"), "up med/p90/p99", [0.5, 0.9, 0.99].map((f) => (q(ups, f) * 100).toFixed(2)).join("/"));
  console.log("   down void%:", T.map((t) => `${t * 100 | 0}:${(out[nm].down[t] * 100).toFixed(2)}`).join(" "));
  console.log("   up   void%:", T.map((t) => `${t * 100 | 0}:${(out[nm].up[t] * 100).toFixed(2)}`).join(" "));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
