// Repo Lens #B-11 (VHP ruler v2.1 @ 5408c57): the core rule's under-count (N-1).
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
// A core member whose 14-day rate is 0.80 counts in everyone else's b at 0.80 of its expected blocks; if it signs IN FULL
// in the race its full count is in n. Same totals as scoreCard (vhp-ruler.js ~475-485, vhp_ruler.py score_card).
import { test } from "node:test";
import assert from "node:assert/strict";
import { R, PY } from "./vhp-ruler.fixture.mjs";

const M = 1000000n;
// a 7,200-block race: p has 18% (e = 1,296), five others share the rest; everyone signs exactly its expected share of
// what was signed, so a fair rule puts every one of them near the middle (about 500,000)
function totals(rateP) {
  const eP = 1296n, eO = (7200n - eP) / 5n, sP = eP, sO = (7200n - sP) / 5n;
  const atP = (eP * rateP) / M, n = sP + 5n * sO, bw = atP + 5n * eO;
  return { n, eO, bO: bw - eO + eO, xO: sO * M, eP, bP: bw - atP + eP, xP: sP * M };
}
const cases = [1000000n, 950000n, 800000n];

test("B11-N1: a core member at rate 0.80 that signs in full in the race doesn't push the others' fpct down (JS)", { todo: "Repo Lens #B-11 N-1: the yardstick for A′'s field totals is a library-chat design item (claude/ruler/TO-LIBRARY-B11-YARDSTICK-2026-11-05.md); nothing pays until it is settled (D-111)" }, () => {
  const base = totals(M), fBase = R.fpct(base.n, base.eO, base.bO, base.xO);
  for (const r of cases) {
    const t = totals(r), fO = R.fpct(t.n, t.eO, t.bO, t.xO), fP = R.fpct(t.n, t.eP, t.bP, t.xP);
    console.log(`rate ${Number(r) / 1e6}: others' fpct ${fO} (fair ${fBase}), its own ${fP}`);
    assert.ok(fO >= fBase - 50000n, `rate ${Number(r) / 1e6}: an honest member's fpct falls from ${fBase} to ${fO} while the big member's own stays ${fP}`);
  }
});

test("B11-N1: the same in Python (JS = Python on these totals)", { todo: "Repo Lens #B-11 N-1: the yardstick for A′'s field totals is a library-chat design item (claude/ruler/TO-LIBRARY-B11-YARDSTICK-2026-11-05.md); nothing pays until it is settled (D-111)" }, () => {
  const t = totals(800000n);
  const out = PY(`print(V.fpct(${t.n}, ${t.eO}, ${t.bO}, ${t.xO}))`).trim();
  assert.equal(out, String(R.fpct(t.n, t.eO, t.bO, t.xO)));
  assert.ok(BigInt(out) >= R.fpct(totals(M).n, totals(M).eO, totals(M).bO, totals(M).xO) - 50000n, `Python: the honest member's fpct falls to ${out}`);
});
