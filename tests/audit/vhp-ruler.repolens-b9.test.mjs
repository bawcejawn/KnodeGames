// Repo Lens #B-9 (VHP ruler v2.1 @ 414c85d): failing tests for B9-1 (pool rule "twa" over-expects after a deposit),
// B9-2 (the steering cap doesn't bound pct) and B9-3 (pct rounds the top up to exactly 1). JavaScript and Python.
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, addr, toJson, fieldFpct, expectedOf, creditedOf, countsFor } from "./vhp-ruler.fixture.mjs";

const M = 1000000n, dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-b9-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };

// the same 15-day fixed-rotation chain as vhp-ruler.v21.test.mjs, plus optional VHP changes (mints / burns)
function rotation({ from = 2000000, n = 445000 + 15000, np = 5, extra = [] } = {}) {
  const ps = Array.from({ length: np }, (_, i) => addr(i)), to = from + n - 1;
  const bal = ps.map((_, i) => 10n ** 15n * BigInt(i + 2)), signers = new Array(n), ids = new Array(n), deltas = [];
  for (let k = 0; k < n; k++) {
    const s = ps[(k * 7 + (k >> 5)) % np]; signers[k] = s; ids[k] = "0x1220" + (from + k).toString(16).padStart(64, "0");
    deltas.push({ h: from + k, a: s, d: -408000000n, inc: 0n }); bal[ps.indexOf(s)] -= 408000000n;
  }
  for (const { h, i, v } of extra) { deltas.push({ h, a: ps[i], d: v, inc: v > 0n ? v : 0n }); bal[i] += v; }
  return { tl: { from, to, signers, ids, deltas, anchors: Object.fromEntries(ps.map((a, i) => [a, { h: to, v: bal[i] }])) }, ps };
}
const W0 = 2000000 + 445000, win = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
const game = { game: 7, round: "2026111006", window: win, c: 400000n, minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [] };

test("B9-1: every pool rule expects what a pooled producer can be credited on average, also after a deposit", () => {
  // the pooled producer (ps[2]) doubles its VHP in the middle of the scoring window: card credit pays only own ÷ eff
  // on the blocks after it, so its fair mean credited is Σ (eff/total)·(own/eff) = Σ own/total, the "min" rule
  const { tl, ps } = rotation({ extra: [{ h: win.S0 + 3600, i: 2, v: 4n * 10n ** 15n }] }), L = R.ledger(tl);
  for (const poolRule of R.POOL_RULES) {
    const g = { ...game, poolRule, pooled: [ps[2]] }, s = R.scoreCard(L, R.makeCard(L, g)), p = s.producers.find((x) => x.a === ps[2]);
    let fair = 0n; const tot = BigInt(s.total), own = BigInt(p.own);
    for (let H = win.S0; H <= win.S1; H++) if (countsFor(s, p, H)) { const e = L.eff(ps[2], H); fair += (((e * M) / tot) * R.creditOf(own, e)) / M; }   // RULE_VERSION 4: over the blocks that count for it (the luck cap)
    fair = (fair * BigInt(p.rate)) / M;
    const gap = BigInt(p.expected) > fair ? BigInt(p.expected) - fair : fair - BigInt(p.expected);
    assert.ok(gap * 1000n <= fair, `poolRule ${poolRule}: expected ${p.expected} vs fair mean credited ${fair} (more than 0.1% apart)`);
    const at = R.pct(BigInt(p.expected), fair);
    assert.ok(at > 400000n && at < 600000n, `poolRule ${poolRule}: a producer signing its fair share gets pct ${at}, not about 0.5`);
    const [pyExp] = JSON.parse(py(`L = V.Ledger(j["tl"]); g = j["g"]
c = V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))
print(json.dumps([str(next(p["expected"] for p in c["producers"] if p["a"] == j["a"]))]))`, { tl, g, a: ps[2] }));
    assert.equal(pyExp, String(p.expected), `Python, poolRule ${poolRule}`);
  }
});

// Tests 2 and 3 of #B-9 were design tests for "twa" and the +15% steering cap. Both rules are gone (owner, 5 Nov:
// throttlers stay in the games at their full size; "twa" removed), so, as the README says, they are replaced by what the
// rule now guarantees.
test("B9-1: there is one pool rule; a card asking for twa is refused (both languages)", () => {
  const { tl, ps } = rotation(), L = R.ledger(tl);
  assert.deepEqual([...R.POOL_RULES], ["min"]);
  assert.throws(() => R.makeCard(L, { ...game, poolRule: "twa", pooled: [ps[2]] }), /poolRule/);
  assert.match(py(`L = V.Ledger(j["tl"])
try:
    V.make_card(L, 7, "1", j["w"], 0, "spot", True, [], 10, "twa"); print("made")
except ValueError as e: print(e)`, { tl, w: win }), /poolRule/);
});

test("B9-2: steering can't pay: a steady throttler that signs in full in the race is expected, credited and ranked exactly as at full size", () => {
  // ps[4] signs 1/5 of the blocks with 6/20 of the VHP (steady, rate ≈ 0.67); in the scoring window it signs 2/5 more
  const x = rotation();
  for (let k = 0; k < x.tl.signers.length; k++) { const h = x.tl.from + k; if (h >= win.S0 && h <= win.S1 && k % 5 < 2) { const old = x.tl.signers[k]; x.tl.signers[k] = x.ps[4]; const d = x.tl.deltas[k]; if (d.h === h && d.a === old) x.tl.deltas[k] = { ...d, a: x.ps[4] }; } }
  const L = R.ledger(x.tl), s = R.scoreCard(L, R.makeCard(L, game)), p = s.producers.find((q) => q.a === x.ps[4]);
  assert.ok(BigInt(p.rate) < M, "it is a steady throttler");
  assert.equal(p.entry, true, "it stays in the game (owner, 5 Nov) although its form is below 0.80");
  assert.ok(BigInt(p.form) < 800000n);
  // RULE_VERSION 4: expected follows its VHP (never its rate), capped at the card's own size, over the blocks that count
  assert.equal(BigInt(p.expected), expectedOf(L, s, p), "expected from its VHP alone: its throttling never lowers what it must beat");
  assert.ok(BigInt(p.expected) * M >= ((BigInt(p.k) * BigInt(p.sample)) / M) * 980000n, "within 2% of its full size on those blocks (block burns and the draw only)");
  const raw = creditedOf(L, s, p);
  assert.equal(BigInt(p.credited), raw, "nothing is capped by its rate");
  assert.equal(BigInt(p.pct), R.pct(BigInt(p.expected), raw), "ranked exactly as any producer of its size with those blocks");
});

test("B9-3: pct rounds down: just below certain is 999,999, never exactly 1 (both languages)", () => {
  // λ = 0.000001 blocks, 12 credited blocks: the exact mid-p is 1 − (a tiny tail), so floor(× 10^6) = 999,999.
  // The loop drops the terms past q(n + 1) once they floor to 0 on the 2^256 scale, so the tail is lost and pct = 1,000,000
  assert.equal(R.pct(1n, 12n * M), 999999n);
  assert.equal(PY(`print(V.pct(1, 12 * 10**6))`).trim(), "999999");
});

// ── owner, 5 Nov: a producer whose VHP moves more than ±10% during the race is void for that race (never for good) ──
test("void: a deposit or withdrawal of more than 10% during the race voids that producer for the race; block burns don't (both languages)", () => {
  const scored = (extra) => { const { tl, ps } = rotation({ extra }), L = R.ledger(tl), g = { ...game, paying: false }; return { tl, ps, L, s: R.scoreCard(L, R.makeCard(L, g)), g }; };
  const base = scored([]);
  assert.ok(base.s.producers.every((p) => p.void === false), "ordinary block burns never void anyone");
  for (const [what, v, want] of [["a deposit of +50%", 2n * 10n ** 15n, true], ["a withdrawal of −50%", -2n * 10n ** 15n, true], ["a deposit of +5%", 2n * 10n ** 14n, false]]) {
    const { tl, ps, s, g } = scored([{ h: win.S0 + 3600, i: 2, v }]), p = s.producers.find((x) => x.a === ps[2]);
    assert.equal(p.void, want, what);
    if (want) assert.equal(p.fpct, null, "a void producer has no field percentile");
    const want2 = fieldFpct(s.producers), field = s.producers.filter((x) => x.entry && !x.void);
    for (const x of field) assert.equal(x.fpct, want2[x.a], `${what}: the field without the void producer`);
    const out = py(`L = V.Ledger(j["tl"]); g = j["g"]
c = V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"])
sys.stdout.write(V.card_json(V.score_card(L, c)))`, { tl, g });
    assert.equal(out, R.cardJson(s), `Python, ${what}`);
  }
  // the next race, with the VHP stable at its new size, plays as usual
  const { tl, ps } = rotation({ n: 445000 + 30000, extra: [{ h: win.S0 + 3600, i: 2, v: 2n * 10n ** 15n }] }), L = R.ledger(tl);
  const w2 = { W0: win.W0 + 14400, W1: win.W0 + 14400 + 7199, L: win.W0 + 21600, S0: win.W0 + 21601, S1: win.W0 + 28800 };
  assert.ok(w2.S1 <= tl.to, "the chain holds the next race");
  const s2 = R.scoreCard(L, R.makeCard(L, { ...game, paying: false, window: w2 }));
  assert.equal(s2.producers.find((x) => x.a === ps[2]).void, false, "not void for good: the next race, at its new size, plays as usual");
});
