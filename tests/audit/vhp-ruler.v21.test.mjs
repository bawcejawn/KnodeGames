// VHP ruler v2.1 (VHP_RULER.md §16, R-RULER-2): Fix A's luck percentile pct, Fix B's settings (minK, poolRule), and D-120's
// steady-producer rate with its steering cap. Every number is checked in JavaScript and Python (byte-identical cards).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, addr, toJson } from "./vhp-ruler.fixture.mjs";

const M = 1000000n, dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-v21-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };

// ── Fix A: pct (and A′'s fpct, further down) ──
const floatMidP = (lam, x) => { let p = Math.exp(-lam), c = 0; for (let i = 0; i < x; i++) { c += p; p *= lam / (i + 1); } return c + p / 2; };

test("pct: the mid-p Poisson percentile, exact, and the same in Python (a fixed test vector)", () => {
  const cases = [];
  for (const lam of [0, 1, 500000, 3700000, 10000000, 33333333, 100000000, 1000000000]) for (const x of [0, 1000000, 2500000, 7000000, 10000000, 10500000, 120000000, 950000000]) cases.push([lam, x]);
  const js = cases.map(([l, x]) => R.pct(BigInt(l), BigInt(x)).toString());
  const pyv = JSON.parse(py(`print(json.dumps([str(V.pct(l, x)) for l, x in j]))`, cases));
  assert.deepEqual(pyv, js, "JavaScript and Python give the same millionths");
  // against floating point where it doesn't underflow (whole x): within one millionth
  for (const [l, x] of cases) if (l <= 100000000 && x % 1000000 === 0) assert.ok(Math.abs(Number(R.pct(BigInt(l), BigInt(x))) / 1e6 - floatMidP(l / 1e6, x / 1e6)) <= 2e-6, `λ ${l / 1e6}, x ${x / 1e6}`);
  // fixed values (if these change, every published percentile changes)
  assert.equal(R.pct(10n * M, 10n * M), 520484n);
  assert.equal(R.pct(0n, 0n), 500000n);
  assert.equal(R.pct(0n, 3n * M), 1000000n);
  assert.equal(R.pct(10n * M, 10500000n), 580196n, "a fractional x sits on the straight line from mid(10) to mid(11)");
});

test("pct: rises with credited blocks, falls with expected blocks; never above 1", () => {
  let last = -1n;
  for (let x = 0n; x <= 40n * M; x += 250000n) { const v = R.pct(12n * M, x); assert.ok(v >= last && v <= M, `x ${x}`); last = v; }
  last = 2n * M;
  for (let l = 0n; l <= 40n * M; l += 500000n) { const v = R.pct(l, 12n * M); assert.ok(v <= last, `λ ${l}`); last = v; }
  assert.throws(() => R.pct(-1n, 0n), /λ ≥ 0/);
});

test("pct: an honest producer's percentile is spread evenly whatever its size (the root of Fix A)", () => {
  // the mean of mid-p over Poisson(λ) is exactly 1/2 for every λ
  for (const lam of [0.3, 2, 10, 30, 150]) {
    let mean = 0, p = Math.exp(-lam);
    for (let x = 0; x < lam * 4 + 40; x++) { mean += p * Number(R.pct(BigInt(Math.round(lam * 1e6)), BigInt(x) * M)) / 1e6; p *= lam / (x + 1); }
    assert.ok(Math.abs(mean - 0.5) < 2e-5, `λ ${lam}: mean ${mean}`);
  }
});

// ── a 15-day chain where producers sign in a fixed rotation: each signs 1/5 of the blocks whatever its VHP, so the
// bigger ones are steady producers that sign below their share (rates 0.8 and 0.67), the smaller ones above it ──
function rotation({ from = 2000000, n = 445000 + 15000, np = 5, mints = 30, mintTo = null } = {}) {
  const ps = Array.from({ length: np }, (_, i) => addr(i)), to = from + n - 1;
  const bal = ps.map((_, i) => 10n ** 15n * BigInt(i + 2)), signers = new Array(n), ids = new Array(n), deltas = [];
  for (let k = 0; k < n; k++) {
    const s = ps[(k * 7 + (k >> 5)) % np]; signers[k] = s; ids[k] = "0x1220" + (from + k).toString(16).padStart(64, "0");
    deltas.push({ h: from + k, a: s, d: -408000000n, inc: 0n }); bal[ps.indexOf(s)] -= 408000000n;
  }
  for (let m = 0; m < mints; m++) { const h = from + 1000 + m * Math.floor(n / mints), a = mintTo ?? ps[m % np], v = 10n ** 13n; deltas.push({ h, a, d: v, inc: v }); bal[ps.indexOf(a)] += v; }
  return { tl: { from, to, signers, ids, deltas, anchors: Object.fromEntries(ps.map((a, i) => [a, { h: to, v: bal[i] }])) }, ps };
}
const W0 = 2000000 + 445000, win = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
const game = { game: 7, round: "2026111006", window: win, c: 400000n, minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [] };
const { tl, ps } = rotation();
const L = R.ledger(tl);
const pyCard = (g, t = tl) => py(`L = V.Ledger(j["tl"]); g = j["g"]
c = V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"])
sys.stdout.write(V.card_json(c) + V.card_json(V.score_card(L, c)))`, { tl: t, g });

test("D-120: a steady producer's rate is its 14-day signed ÷ expected (capped at 1); others keep rate 1", () => {
  const card = R.makeCard(L, game), by = Object.fromEntries(card.producers.map((p) => [p.a, p]));
  for (const p of card.producers) {
    const f = R.formOf(L, p.a, card.T), r = R.rateOf(L, p.a, card.T, f);
    assert.equal(p.rate, r.rate);
    assert.equal(r.steady, true, "a fixed rotation is steady every day");
    assert.equal(p.rate, f.form < M ? f.form : M);
  }
  // shares 2/20 … 6/20, each signing 1/5: the two biggest sign below their share
  assert.ok(by[ps[3]].rate > 750000n && by[ps[3]].rate < 850000n, `ps[3] rate ${by[ps[3]].rate}`);
  assert.ok(by[ps[4]].rate > 620000n && by[ps[4]].rate < 720000n, `ps[4] rate ${by[ps[4]].rate}`);
  assert.equal(by[ps[0]].rate, M, "signing above its share: capped at 1");
  // a steady 0.67 producer plays (owner, 5 Nov: steady producers stay in); the 0.80 gate alone would bench it
  assert.equal(by[ps[4]].entry, true);
  assert.ok(by[ps[4]].form < 800000n);
  assert.equal(pyCard(game), R.cardJson(card) + R.cardJson(R.scoreCard(L, card)), "Python: the same bytes");
});

test("D-120: a producer whose daily rate swings by more than 0.15 isn't steady: rate 1 and the 0.80 gate", () => {
  // producer 4 stops signing for one day in the middle of the 14 (its blocks go to producer 0)
  const T = R.makeCard(L, game).T, gap0 = T - 200000, gap1 = gap0 + 28800;
  const x = rotation();
  for (let k = 0; k < x.tl.signers.length; k++) { const h = x.tl.from + k; if (h >= gap0 && h < gap1 && x.tl.signers[k] === ps[4]) { x.tl.signers[k] = ps[0]; } }
  // move the burns with the signers
  x.tl.deltas = x.tl.deltas.map((d) => (d.inc === 0n && d.d === -408000000n && d.h >= gap0 && d.h < gap1 && d.a === ps[4] ? { ...d, a: ps[0] } : d));
  const n = x.tl.signers.reduce((s, a, k) => s + (a === ps[4] && x.tl.from + k >= gap0 && x.tl.from + k < gap1 ? 1 : 0), 0);
  assert.equal(n, 0);
  // anchors: recompute the final balances for the two changed producers
  const moved = x.tl.signers.reduce((s, a, k) => s + (x.tl.from + k >= gap0 && x.tl.from + k < gap1 && a === ps[0] ? 1 : 0), 0);
  const L2 = R.ledger({ ...x.tl, anchors: { ...x.tl.anchors } });
  const card = R.makeCard(L2, game), p4 = card.producers.find((p) => p.a === ps[4]);
  assert.equal(R.rateOf(L2, ps[4], card.T).steady, false, "one day at 0 is outside ±0.15");
  assert.equal(p4.rate, M);
  assert.equal(p4.entry, false, "not steady and form < 0.80: benched, as v2");
  assert.ok(moved > 0);
});

test("owner, 5 Nov: no producer's expected blocks follow its rate; nothing is capped; every row has pct", () => {
  const card = R.makeCard(L, game), s = R.scoreCard(L, card);
  for (const p of s.producers) {
    assert.equal(p.expected, p.k);
    let raw = 0n; for (const b of L.signedBlocks(p.a, win.S0, win.S1)) raw += R.creditOf(p.own, L.eff(p.a, b));
    assert.equal(p.credited, raw);
    assert.equal(p.pct, R.pct(p.expected, p.credited));
  }
  assert.equal(pyCard(game), R.cardJson(card) + R.cardJson(s), "Python: the same bytes");
});

test("minK sets the entry bar on the producer's full size; the pooled producer uses min(own, eff) per block", () => {
  const card10 = R.makeCard(L, game), card900 = R.makeCard(L, { ...game, minK: 900 });
  for (const p of card900.producers) if (p.k < 900n * M) assert.equal(p.entry, false);
  assert.ok(card900.producers.filter((p) => p.entry).length <= card10.producers.filter((p) => p.entry).length);
  const g2 = { ...game, pooled: [ps[2]] }, s = R.scoreCard(L, R.makeCard(L, g2)), p = s.producers.find((x) => x.pooled);
  let want = 0n; for (let H = win.S0; H <= win.S1; H++) { const e = L.eff(p.a, H); want += ((e < p.own ? e : p.own) * M) / s.total; }
  assert.equal(p.expected, want);
  assert.equal(pyCard(g2), R.cardJson(R.makeCard(L, g2)) + R.cardJson(s));
  assert.throws(() => R.makeCard(L, { ...game, minK: 0 }), /minK/);
  assert.throws(() => R.makeCard(L, { ...game, poolRule: "twa" }), /poolRule/);
});

test("recompute: minK and poolRule are part of the game's settings, required and checked (both languages)", () => {
  const g = { ...game, c: "400000" }, card = R.cardJson(R.scoreCard(L, R.makeCard(L, g)));
  assert.equal(R.recompute(L, card, g).same, true);
  const { minK, ...noMinK } = g, { poolRule, ...noPool } = g;
  for (const [what, bad, re] of [["no minK", noMinK, /settings/], ["no poolRule", noPool, /settings/], ["minK 1.5", { ...g, minK: 1.5 }, /minK/], ["poolRule x", { ...g, poolRule: "x" }, /poolRule/], ["minK 20", { ...g, minK: 20 }, /setting minK/], ["poolRule twa", { ...g, poolRule: "twa" }, /poolRule/]]) {
    const r = R.recompute(L, card, bad);
    assert.equal(r.same, false, what); assert.match(r.diff, re, what);
    const [same, diff] = JSON.parse(py(`print(json.dumps(V.recompute(V.Ledger(j["tl"]), j["card"], j["g"])))`, { tl, card, g: bad }));
    assert.equal(same, false, `Python, ${what}`); assert.match(diff, re, `Python, ${what}`);
  }
  const [same] = JSON.parse(py(`print(json.dumps(V.recompute(V.Ledger(j["tl"]), j["card"], j["g"])))`, { tl, card, g }));
  assert.equal(same, true, "Python passes the game's own card");
});

// ── A′: fpct, the field percentile ──
const floatBin = (n, p, x) => { let c = 0, lp = n * Math.log(1 - p); for (let i = 0; i <= n; i++) { const q = Math.exp(lp); if (i < x) c += q; else if (i === x) return c + q / 2; lp += Math.log((n - i) / (i + 1)) + Math.log(p / (1 - p)); } return c; };

test("fpct: the binomial mid-p percentile, exact, the same in Python (a fixed test vector)", () => {
  const cases = [];
  for (const [n, a, b] of [[0, 1, 4], [1, 1, 4], [40, 3, 10], [400, 1, 50], [7200, 144, 7200], [7200, 3600, 7200], [5, 0, 7], [9, 7, 7]]) for (const x of [0, 1, 2, 7, 12, 40, 144, 5000]) cases.push([n, BigInt(a) * M, BigInt(b) * M, BigInt(x) * M]);
  cases.push([400, 8n * M, 400n * M, 8500000n]);
  const js = cases.map((c) => R.fpct(...c).toString());
  const pyv = JSON.parse(py(`print(json.dumps([str(V.fpct(n, a, b, x)) for n, a, b, x in j]))`, cases.map((c) => c.map(String)).map(([n, a, b, x]) => [Number(n), a, b, x])));
  assert.deepEqual(pyv, js, "JavaScript and Python give the same millionths");
  for (const [n, a, b, x] of cases) {
    if (a === 0n || a === b || x % M !== 0n || n > 2000) continue;
    const want = floatBin(n, Number(a) / Number(b), Number(x / M));
    assert.ok(Math.abs(Number(R.fpct(n, a, b, x)) / 1e6 - want) <= 2e-6, `n ${n}, share ${a}/${b}, x ${x / M}: ${R.fpct(n, a, b, x)} vs ${want}`);
  }
  assert.equal(R.fpct(40, 3n * M, 10n * M, 12n * M), 508894n, "a fixed value (exact: 0.508894…): if it changes, every field percentile changes");
  assert.equal(R.fpct(9, 7n * M, 7n * M, 9n * M), 500000n, "a field of one: X = n always");
  assert.equal(R.fpct(5, 0n, 7n * M, 0n), 500000n);
});

test("fpct: a jump that moves the whole field together moves no one's percentile (sim 9's root)", () => {
  // three producers expected 300, 60 and 12 blocks; the network jumps +12% so each signs 12% more: same shares, n × 1.12
  const ex = [300n, 60n, 12n].map((v) => v * M), b = ex.reduce((s, v) => s + v, 0n);
  for (const [i, e] of ex.entries()) {
    const x = e, xJump = (e * 112n) / 100n, n = 372n, nJump = (372n * 112n) / 100n;
    const before = Number(R.fpct(n, e, b, x)), after = Number(R.fpct(nJump, e, b, xJump));
    assert.ok(Math.abs(before - after) < 40000, `producer ${i}: ${before} → ${after}`);   // whole blocks: a little rounding
    // Fix A's pct against the fixed expectation moves by size
    if (i === 0) assert.ok(Number(R.pct(e, xJump)) - Number(R.pct(e, x)) > 400000, "pct moves a big producer far up");
  }
});

test("fpct on a scored card: the field is the producers with entry; others get null; JS = Python", () => {
  const card = R.makeCard(L, { ...game, minK: 1500 }), s = R.scoreCard(L, card);
  const inF = s.producers.filter((p) => p.entry);
  assert.ok(inF.length >= 1 && inF.length < s.producers.length, "the bar leaves some producers out");
  const n = inF.reduce((t, p) => t + BigInt(p.signed), 0n), b = inF.reduce((t, p) => t + p.expected, 0n);
  for (const p of s.producers) assert.equal(p.fpct, p.entry ? R.fpct(n, p.expected, b, p.credited) : null);
  assert.equal(pyCard({ ...game, minK: 1500 }), R.cardJson(card) + R.cardJson(s), "Python: the same bytes, nulls included");
  assert.match(R.cardJson(s), /"fpct":null/);
});
