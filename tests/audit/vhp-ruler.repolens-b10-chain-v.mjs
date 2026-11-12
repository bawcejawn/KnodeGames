import { R, addr, rng } from "./vhp-ruler.fixture.mjs";
// weights w (VHP units of 1e15), throttle: {i: rate}; dropped blocks redrawn among the others
export function chain({ w, throttle = {}, seed = 1, from = 2000000, n = 460000, extra = [] }) {
  const ps = w.map((_, i) => addr(i)), to = from + n - 1, r = rng(seed);
  const bal = w.map((x) => 10n ** 15n * BigInt(x)), signers = new Array(n), ids = new Array(n), deltas = [];
  const W = w.reduce((s, x) => s + x, 0);
  const draw = (skip) => { for (;;) { let u = r() * W, i = 0; while (u >= w[i]) { u -= w[i]; i++; } if (i === skip) continue; return i; } };
  for (let k = 0; k < n; k++) {
    let i = draw(-1); if (throttle[i] !== undefined && r() >= throttle[i]) i = draw(i);
    const s = ps[i]; signers[k] = s; ids[k] = "0x1220" + (from + k).toString(16).padStart(64, "0");
    deltas.push({ h: from + k, a: s, d: -408000000n, inc: 0n }); bal[i] -= 408000000n;
  }
  for (const { h, i, v } of extra) { deltas.push({ h, a: ps[i], d: v, inc: v > 0n ? v : 0n }); bal[i] += v; }
  return { tl: { from, to, signers, ids, deltas, anchors: Object.fromEntries(ps.map((a, i) => [a, { h: to, v: bal[i] }])) }, ps };
}
const W0 = 2000000 + 445000;
export const win = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
export const game = { game: 7, round: "2026111006", window: win, c: 400000n, minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [] };
export const score = (tl, g = game) => { const L = R.ledger(tl); return R.scoreCard(L, R.makeCard(L, g)); };
