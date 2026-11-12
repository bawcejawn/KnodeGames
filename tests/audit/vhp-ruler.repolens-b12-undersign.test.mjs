// Repo Lens #B-12 (VHP ruler v2.1 @ 1cf5d4d, option E): a core member that signs BELOW its expectation in the race
// lifts every other core member, the biggest most (N-4). Turned on under D-171: when scoring a producer, any OTHER core
// member more than 2 sd from its expected share of the core's blocks is left out of its yardstick (either way). A ~3%
// skip is about 1 sd for an 18% member: an accepted residual, like S1 (D-171).
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { R, PY } from "./vhp-ruler.fixture.mjs";

const M = 1000000n, N = 7200, SH = [0.18, 0.3, 0.13, 0.13, 0.13, 0.13];   // A, B, four smaller; all in the core
// A signs f of its share; on chain its missed slots go to the other producers by VHP, so n stays N
function card(f) {
  const e = SH.map((s) => BigInt(Math.round(s * N)) * M), sA = Math.round(SH[0] * N * f), rest = N - sA, o = 1 - SH[0];
  const sig = [sA, ...SH.slice(1).map((s) => Math.round((rest * s) / o))];
  const n = BigInt(sig.reduce((a, b) => a + b, 0)), b = e.reduce((a, c) => a + c, 0n);
  return { n, e, b, sig };
}
// D-171's band and yardstick, from the rule as decided (independent of the library's code)
const aside = (c) => c.e.map((e, j) => { const d = BigInt(c.sig[j]) * c.b - c.n * e; return d * d > 4n * c.n * e * (c.b - e); });
function fp(c, i) {
  const out = aside(c);
  let n = 0n, b = 0n;
  c.e.forEach((e, j) => { if (j === i || !out[j]) { n += BigInt(c.sig[j]); b += e; } });
  return R.fpct(n, c.e[i], b, BigInt(c.sig[i]) * M);
}

test("B12-N4 (D-171): a core member signing 0.90 or 0.80 of its share is left out of the others' yardsticks, and they stay fair (JS)", () => {
  const fair = card(1);
  assert.deepEqual(aside(fair), SH.map(() => false), "an honest race sets no one aside");
  for (const f of [0.9, 0.8]) {
    const c = card(f);
    assert.equal(aside(c)[0], true, `A at ${f}: more than 2 sd short`);
    for (let i = 1; i < SH.length; i++) {
      const before = fp(fair, i), after = fp(c, i);
      assert.ok(after - before <= 50000n && before - after <= 50000n, `member ${i} (${SH[i] * 100}%): fpct ${before} -> ${after} when A signs ${f}`);
    }
  }
});

test("B12-N4 (D-171): a 0.97 skip (about 1 sd) stays in the yardstick, the accepted residual", () => {
  const c = card(0.97);
  assert.equal(aside(c)[0], false);
  assert.ok(fp(c, 1) > fp(card(1), 1), "the lift remains, as ruled (like S1)");
});

test("B12-N4: with A left out the lift is not size-biased, and JS = Python on the totals", () => {
  const c = card(0.9), big = fp(c, 1), small = fp(c, 2);
  const out = aside(c);
  let n = 0n, b = 0n; c.e.forEach((e, j) => { if (j === 1 || !out[j]) { n += BigInt(c.sig[j]); b += e; } });
  const py = PY(`print(V.fpct(${n}, ${c.e[1]}, ${b}, ${BigInt(c.sig[1]) * M}))`).trim();
  assert.equal(py, String(big));
  assert.ok(big - small <= 50000n && small - big <= 50000n, `A at 0.90: the 30% member ${big} vs a 13% member ${small}`);
});
