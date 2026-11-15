// The Producer Race on the VHP ruler: a made-up chain the race recorder AND the ruler read (the same heights, signers
// and ids). 15 days of history before Sunday 1 Nov 00:00 UTC (the ruler's 14-day form look-back), then 11 days of race
// blocks, one every 3 s, signers drawn by VHP. Heights start at FROM; the race nodes serve them, the ruler's ledger holds
// them. Shared by tests/audit/race-ruler.test.mjs.
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
const APP = process.env.APP || ".";
// file:// URLs, so a Windows path (C:\...) imports too (the owner's PC, 14 Nov).
await import(pathToFileURL(path.resolve(APP, "race-math.js")).href);
await import(pathToFileURL(path.resolve(APP, "vhp-ruler.js")).href);
export const M = globalThis.KRaceMath, R = globalThis.KRuler;
export const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"];
export const VHP = [400, 250, 200, 140, 1];
export const T_RACE = Date.parse("2026-11-01T00:00:00Z"), PRE = 15 * 28800, RACE_N = 11 * 28800, FROM = 100000;
export const N = PRE + RACE_N, T_FIRST = T_RACE - PRE * 3000;
/** Block FROM + i: time, signer, id. */
export const chain = (() => {
  const g = M.rng(7), tot = VHP.reduce((a, b) => a + b), ts = new Array(N), who = new Array(N), ids = new Array(N);
  for (let i = 0; i < N; i++) {
    ts[i] = T_FIRST + i * 3000;
    let x = g.next() * tot, j = 0; while (x >= VHP[j]) { x -= VHP[j]; j++; }
    who[i] = P[j];
    ids[i] = "0x1220" + crypto.createHash("sha256").update(`race block ${FROM + i}`).digest("hex");
  }
  return { ts, who, ids };
})();
export const UNIT = 10n ** 15n, BURN = 408000000n;
/** The ruler's timeline of the chain (balances: VHP × UNIT at the start, less each block's burn). extra: [{ h, a, v }]. */
export function timeline(extra = []) {
  const bal = new Map(P.map((a, i) => [a, BigInt(VHP[i]) * UNIT])), deltas = [];
  for (let i = 0; i < N; i++) { deltas.push({ h: FROM + i, a: chain.who[i], d: -BURN, inc: 0n }); bal.set(chain.who[i], bal.get(chain.who[i]) - BURN); }
  for (const { h, a, v } of extra) { deltas.push({ h, a, d: v, inc: v > 0n ? v : 0n }); bal.set(a, (bal.get(a) || 0n) + v); }
  deltas.sort((x, y) => x.h - y.h);
  const to = FROM + N - 1;
  return { from: FROM, to, signers: chain.who.slice(), ids: chain.ids.slice(), deltas, anchors: Object.fromEntries([...bal].map(([a, v]) => [a, { h: to, v }])), bad: [], rebuilt: [], pending: [] };
}
/** A race node serving the chain up to the block at nowT (its irreversible block 60 behind). */
export function node(nowT, { tamper = null } = {}) {
  let top = 0; while (top + 1 < N && chain.ts[top + 1] <= nowT) top++;
  return {
    async getHeadInfo() { return { head_topology: { height: String(FROM + top), id: "0xhead" }, head_block_time: String(chain.ts[top]), last_irreversible_block: String(FROM + top - 60) }; },
    async call(m, a) {
      const s = Number(a.ancestor_start_height), items = [];
      for (let h = s; h < s + a.num_blocks && h <= FROM + top; h++) {
        const i = h - FROM; if (i < 0) continue;
        items.push({ block_height: String(h), block: { header: { signer: tamper === h ? P[(P.indexOf(chain.who[i]) + 1) % P.length] : chain.who[i], timestamp: String(chain.ts[i]) } } });
      }
      return { block_items: items };
    },
  };
}
export const vhpOf = async (who) => Object.fromEntries(who.map((a) => [a, String((VHP[P.indexOf(a)] || 0) * 1e8)]));
