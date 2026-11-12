// Repo Lens #B-10 (VHP ruler v2.1 @ faa9757), areas 3–4: the A′ field and the entry gate.
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson, coreOf, fieldFpct } from "./vhp-ruler.fixture.mjs";
import { M, chain, game } from "./vhp-ruler.repolens-b10-chain.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-b10f-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };

// 6 producers of equal VHP; ps[5] signs `slots` of every 120 blocks (20 = its full share), the other 5 share the rest
// equally, every day of the 15 (so ps[5] is "steady" at slots/20)
const throttled = (slots) => chain({ np: 6, units: [3, 3, 3, 3, 3, 3], signerOf: (k, ps) => { const s = k % 120; return s < slots ? ps[5] : ps[(k - Math.floor(k / 120) * slots - (s < slots ? 0 : slots)) % 5]; } });

test("B10-F1: a steady throttler in the field pushes every full producer's fpct to the 999,999 cap (A′ assumes every field member signs at full rate)", () => {
  for (const [slots, label] of [[20, "control (no throttling)"], [19, "ps[5] steady at 0.95 (out of the core, D-165)"], [6, "ps[5] steady at 0.3"], [1, "ps[5] parked at 0.05"]]) {
    const { tl, ps } = throttled(slots), L = R.ledger(tl), s = R.scoreCard(L, R.makeCard(L, game));
    const t = s.producers.find((p) => p.a === ps[5]);
    assert.equal(t.entry, true, `${label}: the throttler is in the field (owner, 5 Nov)`);
    const full = s.producers.filter((p) => p.a !== ps[5]);
    // the five full producers behave identically and each signs exactly 1/5 of what the full-rate field signed:
    // under A′'s own premise ("a jump that moves the whole network moves no one's percentile") they sit near the middle
    for (const p of full) assert.ok(BigInt(p.fpct) < 990000n, `${label}: ${p.a} signs exactly its share among full-rate signers, yet fpct = ${p.fpct}`);
  }
});

test("B10-F1 (D-165): a producer at 0.95 of the field's form is out of the core, and full producers signing in proportion to their size get the same fpct (pure fpct, the card's own totals)", () => {
  // shares of expected: T 0.30 (form 0.95), A 0.40, B 0.25, C 0.05 (form 1); 7,200 blocks, all signed by the field.
  // The median form is 1, the line 0.97: T is out of the core, which is A, B and C at full size
  const n = 7200, sh = { T: 0.3, A: 0.4, B: 0.25, C: 0.05 }, prod = 0.3 * 0.95 + 0.7;
  const e = (k) => BigInt(Math.round(sh[k] * 7200e6)), x = (k) => BigInt(Math.round((sh[k] / prod) * n * 1e6)), sg = (k) => x(k) / M;
  const nC = sg("A") + sg("B") + sg("C"), bC = e("A") + e("B") + e("C");
  const f = Object.fromEntries(["A", "B", "C"].map((k) => [k, R.fpct(nC, e(k), bC, x(k))]));
  const gap = f.A - f.C;
  assert.ok(gap < 50000n && gap > -50000n, `A (40%) fpct ${f.A} vs C (5%) fpct ${f.C}: identical relative performance, ${gap} millionths apart`);
});
test("B10-F2 (owner, 5 Nov: a steady throttler stays in): a producer parked at form ≈ 0.05 is in the field but moves no one's fpct; JS = Python on the card", () => {
  const { tl, ps } = throttled(1), L = R.ledger(tl), c = R.makeCard(L, game), s = R.scoreCard(L, c), p = s.producers.find((x) => x.a === ps[5]);
  assert.ok(BigInt(p.form) < 100000n, `form ${p.form}`);
  assert.equal(p.entry, true, "steady: in the field at full size, as the owner ruled");
  assert.notEqual(p.fpct, null);
  // the five full producers are scored among themselves only (D-165): exactly as if the parked address weren't on the card
  const { core } = coreOf(s.producers), want = fieldFpct(s.producers);
  assert.equal(core.includes(p), false, "below 0.97 × the median form: not in the yardstick");
  const n = core.reduce((t, x) => t + x.credited, 0n) / 1000000n, bC = core.reduce((t, x) => t + x.expected, 0n);   // RULE_VERSION 4: the yardstick counts credited blocks
  for (const x of core) { assert.equal(x.fpct, R.fpct(n, x.expected, bC, x.credited), `${x.a}: the parked address moved its fpct`); assert.equal(x.fpct, want[x.a]); }
  const out = py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))))`, { tl, g: game });
  assert.equal(out, R.cardJson(s), "JS = Python, a member below the gate included");
});
