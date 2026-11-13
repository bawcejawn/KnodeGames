// The kit's VHP ruler test chain (TEST FIXTURE): the shape of tests/audit/race-ruler.fixture.mjs (five producers by VHP,
// one block every 3 s, 15 days of history from block 100,000), without reading the environment or the clock, so a game's
// conformance sample can build its ledger inside the sandbox. A deterministic generator (no Math.random).
import { createHash } from "node:crypto";
import { rulerLib } from "../recorder/sources/vhp-ruler.ts";

export const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"];
export const VHP = [400, 250, 200, 140, 1];
export const FROM = 100000, PRE = 15 * 28800;
const UNIT = 10n ** 15n, BURN = 408000000n;

/** A ruler ledger over FROM … FROM + PRE + extraBlocks − 1 (default 4 hours past the history). */
export function rulerLedger(extraBlocks = 4800): any {
  const N = PRE + extraBlocks, tot = VHP.reduce((a, b) => a + b);
  let s = 7n;
  const next = () => { s = (s * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number(s >> 11n) / 2 ** 53; };
  const who: string[] = new Array(N), ids: string[] = new Array(N);
  const bal = new Map(P.map((a, i) => [a, BigInt(VHP[i]) * UNIT])), deltas: any[] = [];
  for (let i = 0; i < N; i++) {
    let x = next() * tot, j = 0;
    while (x >= VHP[j]) { x -= VHP[j]; j++; }
    who[i] = P[j];
    ids[i] = "0x1220" + createHash("sha256").update(`kit ruler block ${FROM + i}`).digest("hex");
    deltas.push({ h: FROM + i, a: who[i], d: -BURN, inc: 0n });
    bal.set(who[i], bal.get(who[i])! - BURN);
  }
  const to = FROM + N - 1;
  return rulerLib().ledger({ from: FROM, to, signers: who, ids, deltas, anchors: Object.fromEntries([...bal].map(([a, v]) => [a, { h: to, v }])), bad: [], rebuilt: [], pending: [] });
}
