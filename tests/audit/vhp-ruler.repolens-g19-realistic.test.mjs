// Repo Lens #G-19, blind verifier's realistic-edge run for G19-1 (prints the table; asserts nothing). Place in tests/audit/.
import { test } from "node:test";
import { R, rng } from "./vhp-ruler.fixture.mjs";
import { chain, game } from "./vhp-ruler.repolens-b10-chain.mjs";
const M = 1000000n;
// 8 producers, VHP units 18,16,14,14,12,10,8,8 (%); signing rates vs share: p0 x1.05 (big, +5%), p1 x1.04, others scaled down to sum 1
const units = [18,16,14,14,12,10,8,8];
const edge = [1.05,1.04,0.99,1.0,0.98,0.97,0.97,0.96];
function mk(seed, steerFrom, steerTo, steerFrac) {
  const r = rng(seed), r2 = rng(seed+999);
  const w = units.map((u,i)=>u*edge[i]); const s = w.reduce((a,b)=>a+b,0);
  const cum = []; let c=0; for (const x of w){ c+=x/s; cum.push(c); }
  return chain({ np: 8, units, signerOf: (k, ps) => { let u = r(); let i = cum.findIndex(x=>u<x); if (i<0) i=7;
      const h = 2000000 + k;
      if (i===0 && h>=steerFrom && h<steerTo && r2()<steerFrac) i = 2 + Math.floor(r2()*6);
      return ps[i]; } });
}
const score = (tl, mode) => { const L = R.ledger(tl), g = { ...game, paying: false, mode }; return R.scoreCard(L, R.makeCard(L, g)); };
test("realistic", () => {
  const h0 = mk(7, 0, 0, 0), T = R.makeCard(R.ledger(h0.tl), { ...game, paying: false }).T;
  for (const frac of [0, 0.04, 0.06, 0.10]) {
    const x = mk(7, T - 3*28800, T - 7200, frac);
    for (const mode of ["A","B","C"]) {
      const p = score(x.tl, mode).producers.find(q=>q.a===x.ps[0]);
      console.log(`steer ${frac} mode ${mode}: expected ${p.expected} target ${p.target ?? p.expected} lift ${p.lift ?? '-'} credited ${p.credited} fpct ${p.fpct} setAside ${p.setAside} void ${p.void}`);
    }
  }
});
