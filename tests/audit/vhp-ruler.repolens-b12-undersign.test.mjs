// Repo Lens #B-12 (VHP ruler v2.1 @ 1cf5d4d, option E): a core member that signs BELOW its expectation in the race
// lifts every other core member, the biggest most (N-4). Same totals as scoreCard (vhp-ruler.js ~480-485).
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { R, PY } from "./vhp-ruler.fixture.mjs";

const M = 1000000n, N = 7200, SH = [0.18, 0.3, 0.13, 0.13, 0.13, 0.13];   // A, B, four smaller; all in the core
// A signs f of its share; on chain its missed slots go to the other producers by VHP, so n stays N
function card(f) {
  const e = SH.map((s) => BigInt(Math.round(s * N))), sA = Math.round(SH[0] * N * f), rest = N - sA, o = 1 - SH[0];
  const sig = [sA, ...SH.slice(1).map((s) => Math.round((rest * s) / o))];
  const n = BigInt(sig.reduce((a, b) => a + b, 0)), b = e.reduce((a, c) => a + c, 0n);
  return { n, e, b, sig };
}
const fp = (c, i) => R.fpct(c.n, c.e[i], c.b, BigInt(c.sig[i]) * M);

test("B12-N4: a core member signing 0.97 of its share in the race doesn't lift the others (JS)", { todo: "Repo Lens #B-12 N-4: a library-chat design item (claude/ruler/TO-LIBRARY-B12-2026-11-06.md); nothing pays until it is settled (D-111)" }, () => {
  const fair = card(1), c = card(0.97);
  for (let i = 1; i < SH.length; i++) {
    const before = fp(fair, i), after = fp(c, i);
    assert.ok(after - before <= 50000n, `member ${i} (${SH[i] * 100}%): fpct ${before} -> ${after} when A signs 0.97`);
  }
});

test("B12-N4: the lift is size-biased (the biggest other member gains most), JS = Python", { todo: "Repo Lens #B-12 N-4: a library-chat design item (claude/ruler/TO-LIBRARY-B12-2026-11-06.md); nothing pays until it is settled (D-111)" }, () => {
  const c = card(0.9), big = fp(c, 1), small = fp(c, 2);
  const py = PY(`print(V.fpct(${c.n}, ${c.e[1]}, ${c.b}, ${BigInt(c.sig[1]) * M}))`).trim();
  assert.equal(py, String(big));
  assert.ok(big - small <= 20000n, `A at 0.90: the 30% member ${big} vs a 13% member ${small}`);
});
