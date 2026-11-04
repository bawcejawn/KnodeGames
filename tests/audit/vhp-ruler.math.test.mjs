// The shared VHP ruler (vhp-ruler.js, its Python twin vhp_ruler.py): design .ai/standards/VHP_RULER.md v2 (D-111),
// data rules D-112. Step (a): the pure math, integers only, the same in JavaScript and Python.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const APP = path.resolve(process.env.APP || ".");
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(`${APP}/vhp-ruler.js`, "utf8"), box);
const R = box.window.KRuler, M = R.M;
const PY = (code, input) => execFileSync("python3", ["-I", "-B", "-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(APP)}); import vhp_ruler as V\n${code}`], { encoding: "utf8", input, maxBuffer: 1 << 28 });

// seeded random numbers (mulberry32): the same tests every run
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toJson = (x) => JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v));

// ── the VHP contract, as written (koinos-contracts-as contracts/vhp Vhp.ts: _increase_balance_by, _decrease_balance_by,
//    _trim_balances, effective_balance_of), only the arithmetic, in BigInt (u64 subtraction is clamped where it is) ──
class ContractBalance {
  constructor(cur) { this.cur = cur; this.past = []; }
  trim(h) { if (this.past.length <= 1) return; const limit = h < 20 ? 0 : h - 20; while (this.past.length > 1 && this.past[1].h <= limit) this.past.shift(); }
  increase(h, v) {
    this.trim(h);
    if (this.past.length === 0) this.past.push({ h: h - 1, b: this.cur });
    this.cur += v;
    const last = this.past[this.past.length - 1];
    if (last.h !== h) this.past.push({ h, b: this.cur }); else last.b = this.cur;
  }
  decrease(h, v) { this.trim(h); this.cur -= v; for (const p of this.past) p.b = p.b < v ? 0n : p.b - v; }
  effective(h) { if (this.past.length === 0) return this.cur; const copy = new ContractBalance(this.cur); copy.past = this.past.map((p) => ({ ...p })); copy.trim(h); return copy.past[0].b; }
}

/** A random timeline: `np` producers, `n` blocks, each block burns ~4.08 VHP from its signer, plus random mints and
 *  transfers (some to producers, some between them). Returns the timeline and the contract-copy balances per block. */
function randomTimeline(seed, n = 9000, np = 6, opts = {}) {
  const r = rng(seed), from = 40_000_000, to = from + n - 1;
  const ps = Array.from({ length: np }, (_, i) => `1P${String(i).padStart(2, "0")}${"x".repeat(26)}`);
  const bal = ps.map((_, i) => BigInt(Math.floor((opts.big ? 1e14 : 1e12) * (0.2 + r() * (i + 1))))), con = bal.map((b) => new ContractBalance(b));
  const signers = [], deltas = [], effSeen = [], ids = [];
  for (let h = from; h <= to; h++) {
    const effs = con.map((c) => c.effective(h)); effSeen.push(effs);
    let tot = 0n; for (const e of effs) tot += e;
    let pick = BigInt(Math.floor(r() * 1e9)) * tot / 1000000000n, s = 0;
    for (; s < np - 1; s++) { if (pick < effs[s]) break; pick -= effs[s]; }
    signers.push(ps[s]); ids.push("0x1220" + crypto.createHash("sha256").update(String(h)).digest("hex"));
    const burn = 408000000n + BigInt(Math.floor(r() * 1000));
    if (bal[s] >= burn) { con[s].decrease(h, burn); bal[s] -= burn; deltas.push({ h, a: ps[s], d: -burn, inc: 0n }); }
    if (r() < (opts.busy ? 0.05 : 0.01)) {
      const i = Math.floor(r() * np), v = BigInt(1 + Math.floor(r() * 5e11));
      if (r() < 0.6) { con[i].increase(h, v); bal[i] += v; deltas.push({ h, a: ps[i], d: v, inc: v }); }
      else if (bal[i] > 0n) { const w = BigInt(Math.floor(r() * Number(bal[i]))); con[i].decrease(h, w); bal[i] -= w; deltas.push({ h, a: ps[i], d: -w, inc: 0n }); }
    }
  }
  const anchors = {}; ps.forEach((a, i) => (anchors[a] = { h: to, v: bal[i] }));
  return { tl: { from, to, signers, ids, deltas, anchors }, effSeen, ps };
}

test("effective VHP matches the Koinos VHP contract's own code on 3,000 random histories (BigInt)", () => {
  const r = rng(20261104);
  for (let trial = 0; trial < 3000; trial++) {
    const start = BigInt(1000 + Math.floor(r() * 1e6)), from = 1000, n = 30 + Math.floor(r() * 120);
    const c = new ContractBalance(start), deltas = [], want = [];
    let bal = start;
    for (let h = from; h < from + n; h++) {
      want.push([h, c.effective(h)]);   // block production reads it at the start of block h
      const k = r() < 0.25 ? 1 + Math.floor(r() * 3) : 0;
      for (let e = 0; e < k; e++) {
        if (r() < 0.5) { const v = BigInt(1 + Math.floor(r() * 5e5)); c.increase(h, v); bal += v; deltas.push({ h, a: "1A", d: v, inc: v }); }
        else if (bal > 0n) { const v = 1n + BigInt(Math.floor(r() * Number(bal))); c.decrease(h, v); bal -= v; deltas.push({ h, a: "1A", d: -v, inc: 0n }); }
      }
    }
    // a ledger needs ≥ 7,220 blocks: pad with blocks signed by someone else (the address under test never signs)
    const to = from + 7300 + n, signers = Array(to - from + 1).fill("1B");
    const L = R.ledger({ from, to, signers, deltas, anchors: { "1A": { h: from + n - 1, v: bal }, "1B": { h: to, v: 1n } } });
    for (const [h, e] of want) if (h >= from + R.DELAY) assert.equal(L.eff("1A", h), e, `trial ${trial}, block ${h}`);
  }
});

test("received VHP counts after 20 blocks; VHP sent away stops counting at once", () => {
  const from = 100, to = 7500, signers = Array(to - from + 1).fill("1B");
  const L = R.ledger({ from, to, signers, deltas: [{ h: 200, a: "1A", d: 100n, inc: 100n }, { h: 250, a: "1A", d: -50n, inc: 0n }], anchors: { "1A": { h: to, v: 150n }, "1B": { h: to, v: 1n } } });
  assert.equal(L.eff("1A", 200), 100n);
  assert.equal(L.eff("1A", 201), 100n, "received in block 200: not yet");
  assert.equal(L.eff("1A", 219), 100n);
  assert.equal(L.eff("1A", 220), 200n, "20 blocks later it counts");
  assert.equal(L.eff("1A", 251), 150n, "sent away: at once");
  assert.equal(L.sumEff("1A", 218, 221), 100n + 100n + 200n + 200n);
  assert.equal(L.maxEff("1A", 120, 219), 100n);
  assert.equal(L.maxEff("1A", 120, 220), 200n);
});

test("the card time: the fixed test vector (D-112), in JavaScript, Python and node:crypto", () => {
  const id = "0x1220" + crypto.createHash("sha256").update("knode games test vector").digest("hex");
  assert.equal(id, "0x1220e64fc1c035b4a337eec5f6bb7e91a8b198f545de20a1822c1e11e099bc33c4de");
  const d = crypto.createHash("sha256").update(`${id}|7|2026111006`, "utf8").digest();
  assert.equal(d.subarray(0, 8).toString("hex"), "8002add87ef77b6f");
  assert.equal(40700000 + Number(0x8002add87ef77b6fn % 7200n), 40704111);
  assert.equal(R.cardTime(id, 7, "2026111006", 40700000, 40707199), 40704111);
  assert.equal(R.cardTime(id, 7, 2026111006, 40700000, 40707199), 40704111, "round as a number or as text: same");
  assert.equal(PY(`print(V.card_time(${JSON.stringify(id)}, 7, "2026111006", 40700000, 40707199))`).trim(), "40704111");
  assert.throws(() => R.cardTime(id.toUpperCase(), 7, 1, 0, 10), /lowercase/);
  assert.throws(() => R.cardTime(id, 7, 1, 10, 9), /window/);
});

test("sha256 (pure, for the page) matches node:crypto on 500 random inputs", () => {
  const r = rng(7);
  for (let i = 0; i < 500; i++) {
    const s = Array.from({ length: Math.floor(r() * 300) }, () => String.fromCodePoint(r() < 0.9 ? 32 + Math.floor(r() * 90) : 0x4e00 + Math.floor(r() * 500))).join("");
    assert.equal(R.hex(R.sha256(s)), crypto.createHash("sha256").update(s, "utf8").digest("hex"));
  }
});

test("trim = floor(c ÷ √k) exactly, in millionths, on 20,000 values (checked with exact integer squares)", () => {
  const r = rng(11);
  for (let i = 0; i < 20000; i++) {
    const k = 1n + BigInt(Math.floor(r() * 1e12)), c = BigInt(Math.floor(r() * 3e6));
    const t = R.trim(k, c);
    // t = floor(10^3 c ÷ √k)  ⇔  t² k ≤ 10^6 c² < (t + 1)² k
    assert.ok(t * t * k <= c * c * M && c * c * M < (t + 1n) * (t + 1n) * k, `k ${k} c ${c} → ${t}`);
  }
  assert.equal(R.trim(10n * M, 500000n), 158113n, "c 0.5 at k 10: 0.158113");
  assert.equal(R.trim(100n * M, M), 100000n, "c 1 at k 100: 0.1 exactly");
  assert.throws(() => R.trim(0n, M), /k > 0/);
});

test("credit and k: integer millionths, rounded down", () => {
  assert.equal(R.creditOf(100n, 100n), M);
  assert.equal(R.creditOf(100n, 50n), M, "signing below the card size counts in full");
  assert.equal(R.creditOf(100n, 300n), 333333n, "a block signed with 3× the card size counts 1/3, rounded down");
  assert.equal(R.kOf(7200, 1n, 3n), 2400n * M);
  assert.equal(R.kOf(7200, 2n, 7n), 2057142857n, "7,200 × 2/7 = 2,057.142857…");
  assert.equal(R.kOf(7200, 5n, 0n), 0n);
});

test("rounding: each block's share rounded down, then added — at most 1 millionth per block below exact (owner, 4 Nov)", () => {
  const { tl, ps } = randomTimeline(5, 12000, 5, { busy: true });
  const L = R.ledger(tl), H0 = L.validFrom, H1 = tl.to;
  for (const a of ps) {
    const s6 = L.shareSum(a, H0, H1);
    let s18 = 0n; const S = 10n ** 18n;
    for (let H = H0; H <= H1; H++) s18 += (L.eff(a, H) * S) / L.N(H);   // the same sum, 10^12 times finer
    const exact6 = s18 / 10n ** 12n, blocks = BigInt(H1 - H0 + 1);
    assert.ok(s6 <= exact6 + 1n, `${a}: the rounded sum is never above the finer one`);
    assert.ok(exact6 - s6 < blocks, `${a}: below by less than one millionth per block (${exact6 - s6} < ${blocks})`);
  }
});

test("N(H) by the one-sweep update equals the sum over the active set, block by block", () => {
  const { tl } = randomTimeline(9, 9000, 7, { busy: true });
  const L = R.ledger(tl);
  for (let H = L.validFrom; H <= tl.to + 1; H += 37) {
    let s = 0n; for (const a of L.active(H)) s += L.eff(a, H);
    assert.equal(L.N(H), s, `block ${H}`);
  }
});

test("the ledger's eff on a random field equals the contract copy at every block", () => {
  const { tl, effSeen, ps } = randomTimeline(3, 9000, 5, { busy: true });
  const L = R.ledger(tl);
  for (let h = tl.from + R.DELAY; h <= tl.to; h++) ps.forEach((a, i) => assert.equal(L.eff(a, h), effSeen[h - tl.from][i], `${a} at ${h}`));
});

test("a missed event is caught: the rebuild going below zero stops", () => {
  const { tl } = randomTimeline(4, 8000, 3);
  tl.anchors[Object.keys(tl.anchors)[0]].v = 0n;   // the anchor says it ends with 0: earlier it would be negative
  assert.throws(() => R.ledger(tl), /below zero/);
});

/** a card on a random timeline */
function cardOn(tl, extra = {}) {
  const L = R.ledger(tl), Lk = tl.from + 30000;
  return { L, card: R.makeCard(L, { game: 7, round: "2026111006", window: { W0: Lk - 400, W1: Lk - 1, L: Lk, S0: Lk + 1, S1: Lk + 900 }, c: 500000n, ownRule: "spot", paying: false, ...extra }) };
}

test("card credit: hiding VHP before the card, then bringing it back, gains nothing", () => {
  const { tl, ps } = randomTimeline(8, 9500, 4);
  const L = R.ledger(tl);
  const own = R.own(L, ps[0], tl.from + 7900, "spot"), b = R.creditOf(own / 10n, own);
  // a producer that shows 1/10 of its size gets ~10× the multiplier; each block it signs at full size counts 1/10
  assert.ok(b <= 100000n && b >= 99999n);
});

test("makeCard: fields, order, entry bar, pooled, quality, D-112's rebuilt rule", () => {
  const { tl, ps } = randomTimeline(21, 32000, 6);
  let { card } = cardOn(tl, { pooled: [ps[2]] });
  assert.deepEqual([...Object.keys(card)], ["ruleVersion", "game", "round", "ownRule", "paying", "T", "seedBlock", "seedBlockId", "seedProducer", "window", "c", "total", "formFrom", "producers"]);
  assert.deepEqual([...Object.keys(card.producers[0])], ["a", "own", "avg", "k", "form", "entry", "pooled", "isNew", "quality"]);
  assert.ok(card.T >= card.window.W0 && card.T <= card.window.W1);
  assert.equal(card.seedBlock, card.window.L + 20);
  for (let i = 1; i < card.producers.length; i++) assert.ok(card.producers[i - 1].own >= card.producers[i].own, "biggest first");
  assert.equal(card.producers.find((p) => p.a === ps[2]).pooled, true);
  // Repo Lens #E-12 L-2: a bad range for ONE producer flags the whole card (its numbers feed everyone's total and form)
  const T = card.T;
  ({ card } = cardOn({ ...tl, bad: [{ h0: T - 10, h1: T - 5, a: ps[0] }] }));
  assert.ok(card.producers.every((p) => p.quality === "flagged"), "one producer's bad range flags every producer");
  ({ card } = cardOn({ ...tl, rebuilt: [{ h0: tl.from, h1: T - 100 }] }));
  assert.ok(card.producers.every((p) => p.quality === "ok"), "not paying: rebuilt anchors are fine");
  assert.throws(() => cardOn(tl, { paying: true }), /14 days/, "#E-12 L-1: a paying card needs 14 days + 6 h of data");
});

test("scoreCard: credited ≤ signed; the pooled rule uses min(own, eff) per block", () => {
  const { tl, ps } = randomTimeline(31, 32000, 5, { busy: true });
  const { L, card } = cardOn(tl, { pooled: [ps[1]] });
  const s = R.scoreCard(L, card);
  for (const p of s.producers) {
    assert.ok(p.credited <= BigInt(p.signed) * M);
    if (!p.pooled) assert.equal(p.expected, p.k);
  }
  const p = s.producers.find((x) => x.pooled), own = p.own;
  let want = 0n; for (let H = card.window.S0; H <= card.window.S1; H++) { const e = L.eff(p.a, H); want += ((e < own ? e : own) * M) / card.total; }
  assert.equal(p.expected, want);
  const game = { game: 7, round: "2026111006", window: card.window, c: 500000n, ownRule: "spot", paying: false, pooled: [ps[1]] };
  assert.equal(R.recompute(L, R.cardJson(s), game).same, true);
  const tampered = R.cardJson(s).replace(/"credited":"(\d)/, (m, d) => `"credited":"${(+d + 1) % 10}`);
  assert.equal(R.recompute(L, tampered, game).same, false, "a changed number is refused");
});

test("JavaScript and Python make byte-identical cards on 12 random fields (scored and unscored)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ruler-"));
  for (let seed = 100; seed < 112; seed++) {
    const { tl, ps } = randomTimeline(seed, 31500 + (seed % 4) * 400, 3 + (seed % 6), { busy: seed % 2 === 0, big: seed % 3 === 0 });
    const ownRule = R.OWN_RULES[seed % 3], pooled = [ps[seed % ps.length]], paying = false;   // paying cards: the long-chain tests
    if (seed % 5 === 0) tl.bad = [{ h0: tl.from + 7000, h1: tl.from + 7100, a: ps[0] }];
    const { L, card } = cardOn(tl, { ownRule, pooled, paying, c: BigInt(seed * 1000) });
    const js = [R.cardJson(card), R.cardJson(R.scoreCard(L, card))];
    const f = path.join(dir, `t${seed}.json`);
    fs.writeFileSync(f, toJson({ tl, game: 7, round: "2026111006", window: card.window, c: card.c.toString(), ownRule, paying, pooled }));
    const py = PY(`import json
j = json.load(open(${JSON.stringify(f)}))
L = V.Ledger(j["tl"])
c = V.make_card(L, j["game"], j["round"], j["window"], j["c"], j["ownRule"], j["paying"], j["pooled"])
sys.stdout.write(V.card_json(c)); sys.stdout.write(V.card_json(V.score_card(L, c)))
ok, d = V.recompute(L, V.card_json(V.score_card(L, c)), {"game": j["game"], "round": j["round"], "window": j["window"], "c": j["c"], "ownRule": j["ownRule"], "paying": j["paying"], "pooled": j["pooled"]}); assert ok, d`);
    assert.equal(py, js[0] + js[1], `seed ${seed}`);
  }
});

test("the library is pure and integer-only: no network, storage, wallet, Math or floating point", () => {
  const src = fs.readFileSync(`${APP}/vhp-ruler.js`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|localStorage|\.send\(|signTransaction|require\(|import /);
  assert.doesNotMatch(src, /Math\.|parseFloat|toFixed|Float64Array|Float32Array/);
  // the math and the checks (everything before the publish job's file handling) touch no files or network
  const whole = fs.readFileSync(`${APP}/vhp_ruler.py`, "utf8"), py = whole.slice(0, whole.indexOf("# ── the publish job"));
  assert.ok(py.length > 20000, "the publish section marker is there");
  assert.doesNotMatch(py, /urllib|socket|http/, "the math and checks never touch the network");
  assert.doesNotMatch(whole, /float\(|import (socket|requests|subprocess)|open\([^)]*["']w/, "the publish part reads files, and calls the third node only through urllib");
  assert.doesNotMatch(py, /float\(|math\.|import (os|socket|urllib|requests|subprocess)|\d\.\d/);
  assert.doesNotMatch(py.replace(/"""[\s\S]*?"""/g, "").replace(/#.*$/gm, "").replace(/"[^"\n]*"/g, '""'), /[^/]\/[^/]/, "Python divides with // only");
});

test("paying cards (14 days + 6 h of data): D-113's rebuilt rule, a bad range flags all, JS = Python", async () => {
  const { longTimeline } = await import("./vhp-ruler.fixture.mjs");
  const { tl, ps } = longTimeline({ n: 440000 });
  const W0 = tl.from + 415000, window = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
  const game = { game: 7, round: "5", window, c: 400000n, ownRule: "high1h", paying: true, pooled: [ps[1]] };
  const mk = (extra) => R.makeCard(R.ledger({ ...tl, ...extra }), game);
  let card = mk({});
  assert.ok(card.producers.every((p) => p.quality === "ok"));
  assert.equal(card.formFrom, card.T - R.FORM, "the full 14 days are read");
  // D-113 (owner, 4 Nov: "after 1 day is good"): form's older days may read rebuilt hours; the 24-h size window may not
  card = mk({ rebuilt: [{ h0: card.T - 400000, h1: card.T - 28801 }] });
  assert.ok(card.producers.every((p) => p.quality === "ok"), "rebuilt hours in form's older days: a paying card is fine");
  card = mk({ rebuilt: [{ h0: card.T - 400000, h1: card.T - 28800 }] });
  assert.ok(card.producers.every((p) => p.quality === "flagged"), "one rebuilt block inside [T − 28,800, T]: flagged");
  // a bad range (a fault) anywhere in the look-back still flags the card, form's days included
  card = mk({ bad: [{ h0: card.T - 400000, h1: card.T - 399000 }] });
  assert.ok(card.producers.every((p) => p.quality === "flagged"));
  // a scored card: one producer's bad range in the race flags every producer
  const L = R.ledger({ ...tl, bad: [{ h0: window.S0 + 10, h1: window.S0 + 20, a: ps[3] }] });
  const s = R.scoreCard(L, R.makeCard(L, game));
  assert.ok(s.producers.every((p) => p.quality === "flagged"));
  // the Python twin gives the same bytes
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ruler-long-")), f = path.join(dir, "t.json");
  fs.writeFileSync(f, toJson({ tl: { ...tl, bad: [{ h0: window.S0 + 10, h1: window.S0 + 20, a: ps[3] }] }, game }));
  const py = PY(`j = json.load(open(${JSON.stringify(f)})); L = V.Ledger(j["tl"]); g = j["game"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"]))))`);
  assert.equal(py, R.cardJson(s));
});

test("#E-12 I-3: game and round must be plain non-negative decimals in both languages", () => {
  const id = "0x1220" + "ab".repeat(32);
  for (const bad of [" 5", "0x10", "-1", "1e3", "5 "]) {
    assert.throws(() => R.cardTime(id, 7, bad, 0, 10), /whole number/);
    assert.match(PY(`try:\n    V.card_time(${JSON.stringify(id)}, 7, ${JSON.stringify(bad)}, 0, 10); print("ok")\nexcept ValueError as e: print(e)`), /whole number/);
  }
  assert.equal(R.cardTime(id, 7, "007", 0, 10), R.cardTime(id, 7, 7, 0, 10), "leading zeros read as the same number in both");
  assert.equal(PY(`print(V.card_time(${JSON.stringify(id)}, 7, "007", 0, 10))`).trim(), String(R.cardTime(id, 7, 7, 0, 10)));
});
