// Repo Lens #B-10 shared chain for the b10 tests: a 15-day chain with a fixed signer pattern and optional VHP moves.
import { addr } from "./vhp-ruler.fixture.mjs";
export const M = 1000000n, FROM = 2000000, N = 445000 + 15000;
export const W0 = FROM + 445000, win = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
export const game = { game: 7, round: "2026111006", window: win, c: 400000n, minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [] };
/** signerOf(k, ps) picks the signer of block FROM + k; extra: [{ h, i, v }] VHP moves (v > 0 received). */
export function chain({ np = 5, units = null, signerOf = (k, ps) => ps[(k * 7 + (k >> 5)) % ps.length], extra = [], n = N } = {}) {
  const ps = Array.from({ length: np }, (_, i) => addr(i)), to = FROM + n - 1;
  const bal = ps.map((_, i) => 10n ** 15n * BigInt(units ? units[i] : i + 2)), signers = new Array(n), ids = new Array(n), deltas = [];
  for (let k = 0; k < n; k++) {
    const s = signerOf(k, ps); signers[k] = s; ids[k] = "0x1220" + (FROM + k).toString(16).padStart(64, "0");
    deltas.push({ h: FROM + k, a: s, d: -408000000n, inc: 0n }); bal[ps.indexOf(s)] -= 408000000n;
  }
  for (const { h, i, v } of extra) { deltas.push({ h, a: ps[i], d: v, inc: v > 0n ? v : 0n }); bal[i] += v; }
  return { tl: { from: FROM, to, signers, ids, deltas, anchors: Object.fromEntries(ps.map((a, i) => [a, { h: to, v: bal[i] }])) }, ps };
}
