// The VHP ruler's made-up chain for Block X's tests (tests/audit/blockx-ruler*.test.mjs): 16 producers, 16 days of
// blocks signed by VHP, a lock 100 blocks before the target X. Shared so the recorder's cards and the publish job's
// Python recount read the same chain.
import crypto from "node:crypto";
import path from "node:path";
const APP = process.env.APP || ".";
await import(path.resolve(APP, "vhp-ruler.js"));
export const R = globalThis.KRuler;
// 16 producers: a big one (~30%), a spread, and small ones near the entry bar (10 expected blocks in 6 hours ≈ 0.14%).
export const P = Array.from({ length: 16 }, (_, i) => "1" + String.fromCharCode(65 + i).repeat(33));
export const VHP = [3000, 1800, 1200, 900, 700, 600, 500, 400, 300, 200, 150, 100, 60, 30, 18, 4];
export const FROM = 100000, N = 16 * 28800, UNIT = 10n ** 13n, BURN = 408000000n;
export const chain = (() => {
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const tot = VHP.reduce((a, b) => a + b), who = new Array(N), ids = new Array(N);
  for (let i = 0; i < N; i++) {
    let x = rnd() * tot, j = 0; while (x >= VHP[j]) { x -= VHP[j]; j++; }
    who[i] = P[j]; ids[i] = "0x1220" + crypto.createHash("sha256").update(`bx block ${FROM + i}`).digest("hex");
  }
  return { who, ids };
})();
export function timeline(extra = []) {
  const bal = new Map(P.map((a, i) => [a, BigInt(VHP[i]) * UNIT])), deltas = [];
  for (let i = 0; i < N; i++) { deltas.push({ h: FROM + i, a: chain.who[i], d: -BURN, inc: 0n }); bal.set(chain.who[i], bal.get(chain.who[i]) - BURN); }
  for (const { h, a, v } of extra) { deltas.push({ h, a, d: v, inc: v > 0n ? v : 0n }); bal.set(a, (bal.get(a) || 0n) + v); }
  deltas.sort((x, y) => x.h - y.h);
  const to = FROM + N - 1;
  return { from: FROM, to, signers: chain.who.slice(), ids: chain.ids.slice(), deltas, anchors: Object.fromEntries([...bal].map(([a, v]) => [a, { h: to, v }])), bad: [], rebuilt: [], pending: [] };
}
export const LOCK = FROM + 15 * 28800 + 5000, X = LOCK + 100;
/** The timeline as JSON for the publish job's Python (BLOCKX_RULER_TL): BigInts as decimal text. */
export const timelineJson = (extra = []) => JSON.stringify(timeline(extra), (k, v) => (typeof v === "bigint" ? v.toString() : v));
