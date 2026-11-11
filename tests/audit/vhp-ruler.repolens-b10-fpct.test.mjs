// Repo Lens #B-10 (VHP ruler v2.1 @ faa9757), areas 1 and 5: fpct exactness and the scored card's bytes.
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson } from "./vhp-ruler.fixture.mjs";
import { M, chain, game, win } from "./vhp-ruler.repolens-b10-chain.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-b10p-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };

test("fpct = exact rational mid-p binomial (Python fractions) on every reachable edge, JS = Python (passes: regression guard)", () => {
  const cs = [];
  for (const n of [0, 1, 2, 5, 17]) for (const [a, b] of [[1, 2], [3, 10], [1, 10 ** 9], [10 ** 9 - 1, 10 ** 9], [5, 5]]) for (const x of [0, 1, 500000, 1000000, n * 1000000, Math.max(0, n * 1000000 - 1)]) if (x <= n * 1000000) cs.push([n, a, b, x]);
  const out = JSON.parse(py(`from fractions import Fraction as F
from math import comb
M = 10**6
def exact(n, a, b, x):
    k, f = divmod(x, M); p = F(1) if a == b else F(a, b)
    pm = lambda i: F(comb(n, i)) * p**i * (1 - p)**(n - i) if 0 <= i <= n else F(0)
    mid = lambda j: sum((pm(i) for i in range(min(j, n + 1))), F(0)) + pm(j) / 2
    v = mid(k) * (M - f) + mid(k + 1) * f
    e = v.numerator // v.denominator
    return min(e, M - 1) if v < M else e
print(json.dumps([[exact(*c), V.fpct(*c)] for c in j]))`, cs));
  cs.forEach((c, i) => { assert.equal(out[i][1], out[i][0], `Python fpct${JSON.stringify(c)}`); assert.equal(String(R.fpct(...c.map(BigInt))), String(out[i][0]), `JS fpct${JSON.stringify(c)}`); });
});

test("B10-P1 (Info, fixed): a certain result is 1,000,000 on a degenerate share and otherwise (x above n; unreachable from scoreCard); JS = Python", () => {
  assert.equal(R.fpct(3n, 2n, 2n, 4n * M), 1000000n, "a = b: X = 3 always, x = 4 > X: certain");
  assert.equal(R.fpct(3n, 0n, 2n, 1n * M), 1000000n, "a = 0: X = 0 always: certain");
  assert.equal(R.fpct(3n, 1n, 2n, 4n * M), 1000000n, "0 < a < b, x = 4 > n = 3: also certain");
  assert.equal(R.fpct(3n, 1n, 2n, 3n * M + 1n) < 1000000n, true, "x just above n (fractional, k = n) stays below 1");
  assert.equal(py(`print(V.fpct(3, 1, 2, 4000000), V.fpct(3, 2, 2, 4000000), V.fpct(3, 0, 2, 1000000))`, {}).trim(), "1000000 1000000 1000000");
});

test("card bytes: row order ends … sample, expected, signed, credited, pct, void, moves, core, z, setAside, fpct (D-171, D-172; sample: the luck cap); fpct null off the field; RULE_VERSION 4; JS = Python on void + pooled rows (passes: regression guard)", () => {
  const { tl, ps } = chain({ extra: [{ h: win.S0 + 3600, i: 2, v: 2n * 10n ** 15n }] }), L = R.ledger(tl), g = { ...game, pooled: [ps[2], ps[0]], minK: 2000 };
  const s = R.scoreCard(L, R.makeCard(L, g)), js = R.cardJson(s);
  assert.equal(s.ruleVersion, 4);
  for (const p of s.producers) assert.deepEqual(Object.keys(p).slice(-11), ["sample", "expected", "signed", "credited", "pct", "void", "moves", "core", "z", "setAside", "fpct"]);
  assert.ok(s.producers.some((p) => p.void) && s.producers.some((p) => !p.entry && p.fpct === null), "has a void row and an out-of-field row");
  for (const p of s.producers) assert.ok(Number.isSafeInteger(p.sample) && p.sample >= 1 && p.sample <= 1000000);
  const out = py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))))`, { tl, g });
  assert.equal(out, js);
});
