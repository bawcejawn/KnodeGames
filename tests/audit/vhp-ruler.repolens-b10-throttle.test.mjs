// Repo Lens #B-10 (verifier): a steady throttler in A′'s field at full size inflates every full-rate producer's fpct
// (the biggest most). Also checks the producer void fires on a third-party gift and on a pooled producer (JS = Python).
import { test } from "node:test";
import assert from "node:assert/strict";
import { R } from "./vhp-ruler.fixture.mjs";
import { chain, score } from "./vhp-ruler.repolens-b10-chain-v.mjs";

test("B10-F1: a steady 0.30 throttler doesn't push a fair-share producer to the fpct cap", () => {
  const { tl, ps } = chain({ w: [10, 10, 10, 10, 10, 10, 40], throttle: { 5: 0.3 }, seed: 1 }), s = score(tl);
  const F = s.producers.filter((p) => p.entry && !p.void), rest = F.filter((p) => p.a !== ps[5]);
  const n = rest.reduce((t, p) => t + BigInt(p.signed), 0n), b = rest.reduce((t, p) => t + p.expected, 0n);
  const big = s.producers.find((p) => p.a === ps[6]), fair = R.fpct(n, big.expected, b, big.credited);
  assert.ok(fair < 700000n, `sanity: among the full-rate producers the biggest is mid-pack (${fair})`);
  assert.ok(big.fpct < 990000n, `biggest producer fpct ${big.fpct} (at the cap) vs ${fair} with the throttler's expected left out`);
});
