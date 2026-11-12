// RULE_VERSION 4 (owner, 11 Nov 2026: fair rules for every race length; a D-new, numbered by the Library):
//  1. expected blocks follow each producer's VHP block by block, capped at the card's own size, for EVERY producer;
//  2. the yardstick counts credited blocks (the same blocks the expected blocks are for);
//  3. the void band depends on the race's length, down and up apart: 1 h and 2 h −5% / +25%, 6 h −10% / +25%,
//     1 day −12% / +50%, longer −15% / +100%; a void is for that race only;
//  4. the luck cap: no producer is scored on more than 1,000 expected blocks; above that a share of the window's blocks,
//     drawn from the card's seed, counts for it.
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson, fieldFpct, expectedOf, creditedOf, sampleOf, drawOf } from "./vhp-ruler.fixture.mjs";
import { chain, game, win, W0 } from "./vhp-ruler.repolens-b10-chain.mjs";

const M = 1000000n, dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-v4-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };
const pyCard = (tl, g) => py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))))`, { tl, g });
const UNIT = 10n ** 15n;   // producer i starts with (i + 2) units; ps[2] has 4
const scoreOn = (extra, g = game, n) => { const { tl, ps } = chain({ extra, ...(n ? { n } : {}) }), L = R.ledger(tl); return { tl, ps, L, s: R.scoreCard(L, R.makeCard(L, g)) }; };
const windowOf = (len, at = W0) => ({ W0: at, W1: at + 7199, L: at + 7200, S0: at + 7201, S1: at + 7200 + len });

test("the void band by race length: down and up apart, longer races wider; JS = Python; bad lengths refused", () => {
  const want = [[1, 50000, 250000], [1200, 50000, 250000], [1201, 50000, 250000], [2400, 50000, 250000], [2401, 100000, 250000], [7200, 100000, 250000], [7201, 120000, 500000], [28800, 120000, 500000], [28801, 150000, 1000000], [172800, 150000, 1000000], [10000000, 150000, 1000000]];
  for (const [b, d, u] of want) assert.equal(R.voidBand(b).map(Number).join(), `${d},${u}`, `${b} blocks`);
  assert.equal(PY(`print(json.dumps([list(V.void_band(b)) for b in ${JSON.stringify(want.map((x) => x[0]))}], separators=(",", ":")))`).trim(), JSON.stringify(want.map((x) => [x[1], x[2]])));
  let prev = [0, 0];
  for (const b of [1200, 2400, 7200, 28800, 172800]) { const v = R.voidBand(b).map(Number); assert.ok(v[0] >= prev[0] && v[1] >= prev[1], "never tighter for a longer race"); assert.ok(v[1] > v[0], "up is wider than down"); prev = v; }
  for (const bad of [0, -1, 1.5, "7200", null]) assert.throws(() => R.voidBand(bad), /blocks must be a whole number/);
  assert.match(PY(`
for b in (0, -1, "7200", None, True):
    try:
        V.void_band(b); print("ok")
    except ValueError as e: print(e)`), /^(blocks must be a whole number from 1\n){5}$/);
});

test("6-hour race: a withdrawal past −10% or a deposit past +25% voids; inside the band nothing does; block burns never do", () => {
  const mid = win.S0 + 3600, vOf = (v) => { const r = scoreOn(v === 0n ? [] : [{ h: mid, i: 2, v }]); return r.s.producers.find((x) => x.a === r.ps[2]).void; };
  assert.equal(vOf(0n), false, "honest: only its block burns");
  assert.equal(vOf(-(4n * UNIT * 8n) / 100n), false, "−8%: inside");
  assert.equal(vOf(-(4n * UNIT * 12n) / 100n), true, "−12%: void");
  assert.equal(vOf((4n * UNIT * 20n) / 100n), false, "+20%: inside (VHP added is capped by card credit and gains nothing)");
  assert.equal(vOf((4n * UNIT * 30n) / 100n), true, "+30%: void");
  // every other producer on those cards is untouched
  const r = scoreOn([{ h: mid, i: 2, v: -(4n * UNIT * 12n) / 100n }]);
  for (const p of r.s.producers) if (p.a !== r.ps[2]) assert.equal(p.void, false);
});

test("a void is for that race only: the same producer is in the next race at its new size", () => {
  const extra = [{ h: win.S0 + 3600, i: 2, v: -(4n * UNIT * 30n) / 100n }], n = 445000 + 7200 * 4;
  const a = scoreOn(extra, game, n), pa = a.s.producers.find((x) => x.a === a.ps[2]);
  assert.equal(pa.void, true); assert.equal(pa.fpct, null, "out of this race's field");
  const next = { ...game, round: "2026111012", window: windowOf(7200, W0 + 7200) };
  const s2 = R.scoreCard(a.L, R.makeCard(a.L, next)), pb = s2.producers.find((x) => x.a === a.ps[2]);
  assert.equal(pb.void, false, "not void in the next race");
  assert.equal(pb.entry, true); assert.notEqual(pb.fpct, null);
  assert.ok(BigInt(pb.own) < (BigInt(pa.own) * 75n) / 100n, "measured at its new, smaller size");
});

test("the band is exact at the line, down and up, on a 1-hour, 6-hour, 1-day and 6-day race (both languages)", () => {
  for (const len of [1200, 7200, 28800, 172800]) {
    const [down, up] = R.voidBand(len), g = { ...game, round: `9${len}`, window: windowOf(len), paying: false }, n = 445000 + 7200 + len + 600;
    const base = scoreOn([], g, n), p0 = base.s.producers.find((x) => x.a === base.ps[2]), own = BigInt(p0.own), h = g.window.S0 + 5;
    assert.equal(base.s.producers.some((x) => x.void), false, `${len}: honest producers (block burns only) are never void`);
    const effAt = base.L.eff(p0.a, h + 30), lo = (own * (M - down)) / M, hi = (own * (M + up)) / M;
    // the smallest withdrawal that crosses the down line at block h + 30, and one satoshi less; the same for a deposit
    const cases = [[lo - effAt - 1n, true], [hi - effAt + 1n, true]];
    for (const [v, want] of cases) {
      const r = scoreOn([{ h, i: 2, v }], g, n), p = r.s.producers.find((x) => x.a === r.ps[2]);
      assert.equal(p.void, want, `${len} blocks, move ${v}`);
      assert.equal(pyCard(r.tl, g), R.cardJson(r.s), `${len} blocks: JS = Python`);
    }
    const near = scoreOn([{ h: g.window.S1 - 40, i: 2, v: (own * up) / M - (own * 2n) / 100n }], g, n);   // a late deposit just inside the up line
    assert.equal(near.s.producers.find((x) => x.a === near.ps[2]).void, false, `${len} blocks: just inside the up line`);
  }
});

test("expected and credited, written from the rule, on every producer of a 1-day race; the yardstick is credited blocks; JS = Python", () => {
  const g = { ...game, round: "928800", window: windowOf(28800), paying: false }, n = 445000 + 7200 + 28800 + 600;
  // ps[3] adds 20% early in the race (inside the band): its credit is capped at its card size from there on
  const r = scoreOn([{ h: g.window.S0 + 2000, i: 3, v: UNIT }], g, n), s = r.s;
  assert.equal(s.ruleVersion, 4);
  for (const p of s.producers) {
    assert.equal(p.void, false);
    assert.equal(BigInt(p.sample), sampleOf(p));
    assert.equal(p.expected, expectedOf(r.L, s, p), `${p.a}: expected`);
    assert.equal(p.credited, creditedOf(r.L, s, p), `${p.a}: credited`);
  }
  const grown = s.producers.find((x) => x.a === r.ps[3]);
  assert.ok(grown.expected * 100n <= ((BigInt(grown.k) * BigInt(grown.sample)) / M) * 103n, "VHP added in the race doesn't raise its expected blocks above its card size (3%: the draw)");
  assert.ok(grown.credited < BigInt(grown.signed) * BigInt(grown.sample) * 103n / 100n, "and each block signed after it is credited at own ÷ eff");
  const want = fieldFpct(s.producers);
  for (const p of s.producers) if (p.entry) assert.equal(p.fpct, want[p.a], `${p.a}: fpct from a yardstick of credited blocks`);
  // (before RULE_VERSION 4 the yardstick counted raw signed blocks: with a member's credit capped, n was larger than the
  // blocks anyone was credited for, and every expectation rose with it)
  const core = s.producers.filter((p) => p.core), cr = core.reduce((t, p) => t + p.credited, 0n), raw = core.reduce((t, p) => t + BigInt(p.signed) * M, 0n);
  assert.ok(cr < raw, "the yardstick's n is the credited blocks, fewer than the raw signed blocks here");
  assert.equal(pyCard(r.tl, g), R.cardJson(s));
});

test("the luck cap: at most about 1,000 expected blocks a producer; the blocks that count come from the card's seed and are nested", () => {
  const g = { ...game, round: "928801", window: windowOf(28800), paying: false }, n = 445000 + 7200 + 28800 + 600;
  const { s, L } = scoreOn([], g, n);
  assert.equal(R.LUCK_CAP, 1000n * M);
  const capped = s.producers.filter((p) => p.sample < 1000000);
  assert.ok(capped.length >= 3, "the test field has producers above the cap on a 1-day race");
  for (const p of s.producers) {
    if (BigInt(p.k) <= R.LUCK_CAP) { assert.equal(p.sample, 1000000); continue; }
    assert.equal(BigInt(p.sample), (R.LUCK_CAP * M) / BigInt(p.k));
    assert.ok(p.expected > 900n * M && p.expected < 1100n * M, `${p.a}: expected ${p.expected} is about 1,000 blocks`);
    assert.ok(p.credited <= BigInt(p.signed) * M);
  }
  // one draw a block: a block that counts for a bigger producer (smaller sample) counts for every smaller one
  const [a, b] = capped.sort((x, y) => x.sample - y.sample);
  let na = 0, nb = 0;
  for (let H = g.window.S0; H <= g.window.S1; H++) { const u = drawOf(s, H); if (u < BigInt(a.sample)) { na++; assert.ok(u < BigInt(b.sample)); } if (u < BigInt(b.sample)) nb++; }
  const share = (c, p) => Math.abs(c / 28800 - p.sample / 1e6);
  assert.ok(share(na, a) < 0.01 && share(nb, b) < 0.01, "the share of blocks that count is the sample, within 1 point");
  // the draw changes with the seed block: another round's card counts other blocks
  const s2 = R.scoreCard(L, R.makeCard(L, { ...g, round: "928802", window: windowOf(28800, W0 + 100) }));
  assert.notEqual(s2.seedBlockId, s.seedBlockId);
  let same = 0; for (let H = g.window.S0 + 200; H < g.window.S0 + 1200; H++) if ((drawOf(s, H) < 500000n) === (drawOf(s2, H) < 500000n)) same++;
  assert.ok(same > 400 && same < 600, `independent draws agree on about half the blocks (${same} of 1000)`);
});

test("short races are untouched by the cap when no one is above it; a 6-day race scores in both languages, byte for byte", () => {
  const small = scoreOn([], { ...game, round: "91200", window: windowOf(1200), paying: false });
  for (const p of small.s.producers) assert.equal(p.sample, 1000000, "1-hour race: every block counts for everyone");
  const g = { ...game, round: "9172800", window: windowOf(172800), paying: false }, n = 445000 + 7200 + 172800 + 600;
  const r = scoreOn([{ h: g.window.S0 + 50000, i: 1, v: -(3n * UNIT * 10n) / 100n }, { h: g.window.S0 + 90000, i: 4, v: (6n * UNIT * 60n) / 100n }], g, n);
  for (const p of r.s.producers) { assert.equal(p.void, false, "−10% and +60% are inside a 6-day race's band"); assert.equal(p.expected, expectedOf(r.L, r.s, p)); assert.ok(p.expected < 1100n * M); }
  assert.equal(pyCard(r.tl, g), R.cardJson(r.s));
});
