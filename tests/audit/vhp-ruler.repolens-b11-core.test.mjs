// Repo Lens #B-11 (VHP ruler v2.1 @ 5408c57): the core rule's under-count (N-1), turned on under D-165 (option E: the
// core is the field members with form ≥ 0.97 × the field's median form, each at full size; everyone else plays at full
// size against the core plus itself and moves no one).
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson, coreOf, fieldFpct } from "./vhp-ruler.fixture.mjs";
import { chain, game, win, FROM } from "./vhp-ruler.repolens-b10-chain.mjs";

const M = 1000000n;
// a 7,200-block race: p has 18% (e = 1,296), five others share the rest; everyone signs exactly its expected share of
// what was signed, so a fair rule puts every one of them near the middle (about 500,000). p's 14-day form is `formP`, the
// others' 1, so the median is 1 and the line 0.97: below it p is out of the core
function totals(formP) {
  const eP = 1296n, eO = (7200n - eP) / 5n, sP = eP, sO = (7200n - sP) / 5n;
  const forms = [formP, M, M, M, M, M].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)), median = (forms[2] + forms[3]) / 2n, pIn = formP >= (median * R.CORE_LINE) / M;
  const n = 5n * sO + (pIn ? sP : 0n), b = 5n * eO + (pIn ? eP : 0n);
  return { n, eO, bO: b, xO: sO * M, eP, nP: pIn ? n : n + sP, bP: pIn ? b : b + eP, xP: sP * M, pIn };
}
const cases = [1000000n, 950000n, 800000n];

test("B11-N1: a core member at rate 0.80 that signs in full in the race doesn't push the others' fpct down (JS)", () => {
  const base = totals(M), fBase = R.fpct(base.n, base.eO, base.bO, base.xO);
  for (const r of cases) {
    const t = totals(r), fO = R.fpct(t.n, t.eO, t.bO, t.xO), fP = R.fpct(t.nP, t.eP, t.bP, t.xP);
    assert.equal(t.pIn, r === M, `form ${r}: in the core only at the field's full rate`);
    assert.ok(fO >= fBase - 50000n && fO <= fBase + 50000n, `rate ${Number(r) / 1e6}: an honest member's fpct ${fO} vs fair ${fBase}`);
    assert.ok(fP <= fBase + 50000n, `rate ${Number(r) / 1e6}: the big member's own fpct ${fP} gains nothing`);
  }
});

test("B11-N1: the same in Python (JS = Python on these totals)", () => {
  const t = totals(800000n);
  const out = PY(`print(V.fpct(${t.n}, ${t.eO}, ${t.bO}, ${t.xO}), V.fpct(${t.nP}, ${t.eP}, ${t.bP}, ${t.xP}))`).trim();
  assert.equal(out, `${R.fpct(t.n, t.eO, t.bO, t.xO)} ${R.fpct(t.nP, t.eP, t.bP, t.xP)}`);
  const fBase = R.fpct(totals(M).n, totals(M).eO, totals(M).bO, totals(M).xO);
  assert.ok(BigInt(out.split(" ")[0]) >= fBase - 50000n, `Python: the honest member's fpct falls to ${out}`);
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-b11-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };
// 6 producers of equal VHP; ps[5] signs `slots` of every 120 blocks for 15 days (steady at slots/20), then its full 20
// in the race [S0, S1]; the other 5 share the rest equally
const n1chain = (slots) => chain({ np: 6, units: [3, 3, 3, 3, 3, 3], signerOf: (k, ps) => { const sl = FROM + k >= win.S0 && FROM + k <= win.S1 ? 20 : slots, s = k % 120; return s < sl ? ps[5] : ps[(k - Math.floor(k / 120) * sl - (s < sl ? 0 : sl)) % 5]; } });

test("B11-N1 on a real card (D-165): a member steady at 0.80 (and 0.95) that signs in full in the race is out of the core and moves no one; JS = Python", () => {
  for (const slots of [16, 19]) {
    const { tl, ps } = n1chain(slots), L = R.ledger(tl), s = R.scoreCard(L, R.makeCard(L, game)), p = s.producers.find((x) => x.a === ps[5]);
    const { core } = coreOf(s.producers);
    assert.equal(p.entry, true, `${slots}/20: in the field at full size (D-163)`);
    assert.equal(core.includes(p), false, `${slots}/20: below 0.97 × the median form, so not in the yardstick`);
    const want = fieldFpct(s.producers);
    for (const x of s.producers) if (x.entry && !x.void) assert.equal(x.fpct, want[x.a]);
    // the five others are scored among themselves only: the same as on a card without the member's race blocks
    for (const x of core) assert.ok(BigInt(x.fpct) > 50000n && BigInt(x.fpct) < 950000n, `${slots}/20: ${x.a} fpct ${x.fpct} is pushed to an edge`);
    const out = py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))))`, { tl, g: game });
    assert.equal(out, R.cardJson(s), `${slots}/20: JS = Python`);
  }
});

test("D-171: the median is weighted by expected blocks (half the field's expected blocks at or below it; an exact tie takes the lower form), and the line is 970,000 millionths of it", () => {
  const row = (a, form, e) => ({ a, entry: true, void: false, form: String(form), signed: 10, expected: BigInt(e), credited: 10n * M });
  // weights 10, 10, 10, 70 by form: half of 100 is reached at the big member, so its form is the median
  let { median, line } = coreOf([row("p0", 1100000n, 10), row("p1", 1200000n, 10), row("p2", 900000n, 10), row("p3", 1000001n, 70)]);
  assert.equal(median, 1000001n);
  assert.equal(line, (1000001n * 970000n) / M);
  // an exact tie: 50 of 100 at or below 1,000,000 → the lower member's form
  ({ median } = coreOf([row("q0", 1000000n, 50), row("q1", 1200000n, 50)]));
  assert.equal(median, 1000000n);
});

test("D-171 on a real card: every row's core flag follows the weighted-median line, and fpct the band rule", () => {
  // (16 small steady addresses at 0.80 are sim 8's case, on real history)
  const base = n1chain(20), L0 = R.ledger(base.tl), s0 = R.scoreCard(L0, R.makeCard(L0, game));
  const { line: line0 } = coreOf(s0.producers);
  assert.ok(line0 > 0n);
  for (const x of s0.producers) assert.equal(x.core, x.entry && !x.void && BigInt(x.form) >= line0, `${x.a}: core as the rule says`);
  const want = fieldFpct(s0.producers);
  for (const x of s0.producers) if (x.entry && !x.void) assert.equal(x.fpct, want[x.a]);
});
