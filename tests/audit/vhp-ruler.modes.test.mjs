// Scoring modes A–D and the admin's mode schedule (owner, 11 Nov 2026: "build me 3 additional VHP ruler formulas which can
// run alongside the active ruler method and allow the admin the ability to shift future weeks"):
//  A VHP only (today's rule); B clear edge and C best day, raise only (Repo Lens #G-19 rework): the best of 11 one-day
//  stretches over [T − 14 days, T − 3 days), each (signed − sd·√signed) ÷ expected (sd 2 in B, 1 in C) against the field's
//  expected-weighted median raw form that day; D even odds (luck cap 100 blocks).
//  A card without a mode is byte-identical to RULE_VERSION 4; a card with a mode records it and carries lift and target.
//  <GAME>_RULER_MODE = "5:B,8:C": a week that has started never changes mode.
// Run: node --import tsx --test tests/audit/vhp-ruler.modes.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { R, PY, rng, toJson, APP, expectedOf, creditedOf } from "./vhp-ruler.fixture.mjs";
import { chain, game, win } from "./vhp-ruler.repolens-b10-chain.mjs";

const M = 1000000n, dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-modes-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };
const pyCard = (tl, g) => py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"], g.get("mode")))))`, { tl, g });
// ps[4] signs 2 of every 5 blocks in the scoring window (as the B9-2 steering test), so it runs well above its share there;
// ps[1] signs a fifth less over the whole chain, so its 14-day form and 3-day pace sit below the field's median
function uneven() {
  const x = chain({ n: 445000 + 15000 });
  for (let k = 0; k < x.tl.signers.length; k++) {
    const h = x.tl.from + k;
    if (x.tl.signers[k] === x.ps[1] && k % 5 === 0) { const to = x.ps[0]; x.tl.signers[k] = to; const d = x.tl.deltas[k]; if (d.h === h && d.a === x.ps[1]) x.tl.deltas[k] = { ...d, a: to }; }
  }
  return x;
}
const scoreMode = (tl, mode) => { const L = R.ledger(tl); const g = { ...game, paying: false, ...(mode === undefined ? {} : { mode }) }; return { L, g, s: R.scoreCard(L, R.makeCard(L, g)) }; };
const strip = (c) => { const x = JSON.parse(c); delete x.mode; x.producers = x.producers.map((p) => { const q = { ...p }; delete q.lift; delete q.target; return q; }); return JSON.stringify(x); };

test("a card without a mode is RULE_VERSION 4 byte for byte; mode A adds only the mode key and lift = 1, target = expected; bad modes are refused in both languages", () => {
  const { tl } = uneven(), none = scoreMode(tl), a = scoreMode(tl, "A");
  assert.equal("mode" in none.s, false);
  assert.equal(a.s.mode, "A");
  for (const p of a.s.producers) { assert.equal(p.lift, M); assert.equal(p.target, p.expected); }
  assert.equal(strip(R.cardJson(none.s)), strip(R.cardJson(a.s)), "the same numbers");
  assert.notEqual(R.cardJson(none.s), R.cardJson(a.s));
  assert.equal(JSON.stringify(Object.keys(a.s.producers[0]).slice(-13)), JSON.stringify(["sample", "expected", "signed", "credited", "pct", "void", "moves", "lift", "target", "core", "z", "setAside", "fpct"]));
  assert.throws(() => R.makeCard(none.L, { ...game, mode: "E" }), /mode must be A, B, C or D/);
  assert.throws(() => R.scoreCard(none.L, { ...R.makeCard(none.L, game), mode: "x" }), /mode must be A, B, C or D/);
  assert.match(py(`L = V.Ledger(j["tl"]); g = j["g"]
try:
    V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"], "E"); print("made")
except ValueError as e: print(e)`, { tl, g: game }), /mode must be A, B, C or D/);
  for (const mode of ["A", "B", "C", "D"]) assert.equal(pyCard(tl, { ...game, paying: false, mode }), R.cardJson(scoreMode(tl, mode).s), `mode ${mode}: JS = Python`);
});

// the reference lift (written from the docs, not the code): the best stretch, never below 1
function refLifts(L, s, mode) {
  const k = 11, sd = { B: 2n, C: 1n }[mode], span = 316800 / k, field = s.producers.filter((p) => p.entry && !p.void), eAll = field.reduce((t, p) => t + p.expected, 0n);
  const out = new Map(s.producers.map((p) => [p.a, M]));
  for (let i = 0; i < k; i++) {
    const H0 = s.T - 86400 - 316800 + i * span, H1 = H0 + span - 1;
    const raw = (a) => { const e = L.shareSum(a, H0, H1); return e > 0n ? (BigInt(L.signedIn(a, H0, H1)) * M * M) / e : 0n; };
    const lf = (a) => { const e = L.shareSum(a, H0, H1), sg = BigInt(L.signedIn(a, H0, H1)) * M, x = sg - sd * R.isqrt(sg * M); return e > 0n && x > 0n ? (x * M) / e : 0n; };
    let med = 0n, c = 0n; for (const p of [...field].sort((x, y) => (raw(x.a) < raw(y.a) ? -1 : raw(x.a) > raw(y.a) ? 1 : 0))) { c += p.expected; if (2n * c >= eAll) { med = raw(p.a); break; } }
    for (const p of s.producers) { const r = (lf(p.a) * M) / med; if (r > out.get(p.a)) out.set(p.a, r); }
  }
  return out;
}
// a steer moves blocks from who to to in [h0, h1); the anchors (balances at the chain's end) move with each block's VHP
// delta, so every VHP balance BEFORE the steer is exactly as in the honest chain (as on a real chain)
const steer = (x, who, to, h0, h1, every = 1) => {
  let n = 0;
  for (let k = 0; k < x.tl.signers.length; k++) {
    const h = x.tl.from + k;
    if (h >= h0 && h < h1 && x.tl.signers[k] === who && n++ % every === 0) {
      x.tl.signers[k] = to; const d = x.tl.deltas[k];
      if (d.h === h && d.a === who) { x.tl.deltas[k] = { ...d, a: to }; x.tl.anchors[who] = { ...x.tl.anchors[who], v: x.tl.anchors[who].v - d.d }; x.tl.anchors[to] = { ...x.tl.anchors[to], v: x.tl.anchors[to].v + d.d }; }
    }
  }
  return x;
};

for (const mode of ["B", "C"]) test(`mode ${mode}: lift = the best of 11 days over [T − 14 d, T − 3 d) less ${mode === "B" ? 2 : 1} sd of luck, never below 1; target = expected × lift; JS = Python`, () => {
  const { tl } = uneven(), { L, s } = scoreMode(tl, mode), ref = refLifts(L, s, mode);
  let lifted = 0, flat = 0;
  for (const p of s.producers) {
    assert.equal(p.lift, ref.get(p.a), `${p.a}: lift`); assert.equal(p.target, (p.expected * p.lift) / M, `${p.a}: target`);
    assert.ok(p.target >= p.expected, "never lowered"); assert.equal(p.pct, R.pct(p.target, p.credited));
    if (p.lift > M) lifted++; else flat++;
  }
  assert.ok(lifted >= 1 && flat >= 1, `lifted ${lifted}, flat ${flat}`);
  assert.equal(pyCard(tl, { ...game, paying: false, mode }), R.cardJson(s), "JS = Python");
});

test("C raises on a smaller edge than B: on the same chain C's lift is at least B's and differs somewhere; the constants in both languages", () => {
  const { tl } = uneven(), b = scoreMode(tl, "B").s, c = scoreMode(tl, "C").s;
  let differ = 0; for (const [i, p] of c.producers.entries()) { assert.ok(p.lift >= b.producers[i].lift); if (p.lift !== b.producers[i].lift) differ++; }
  assert.ok(differ >= 1);
  assert.equal(R.LIFT_SKIP, 86400); assert.equal(R.LIFT_SPAN, 316800); assert.equal(JSON.stringify(R.STRETCHES), '{"B":11,"C":11}'); assert.equal(R.LIFT_SD.B, 2n); assert.equal(R.LIFT_SD.C, 1n);
  assert.equal(PY(`print(V.LIFT_SKIP, V.LIFT_SPAN, V.STRETCHES["B"], V.STRETCHES["C"], V.LIFT_SD["B"], V.LIFT_SD["C"], V.MODE_CAP["D"], "".join(V.MODES))`).trim(), "86400 316800 11 11 2 1 100000000 ABCD");
  assert.equal(R.liftForm(10000, 10000n * M, 2n), 980000n, "(10,000 − 200) ÷ 10,000");
  assert.equal(R.liftForm(10000, 10000n * M), 990000n, "(10,000 − 100) ÷ 10,000"); assert.equal(R.liftForm(0, 5n * M), 0n); assert.equal(R.liftForm(7, 0n), 0n);
});

test("G19-1: the last 3 days are not read: signing less (or more) in [T − 3 d, T) changes no lift and no target in B or C", () => {
  const T = scoreMode(uneven().tl).s.T;
  for (const mode of ["B", "C"]) {
    const h = scoreMode(uneven().tl, mode).s, less = scoreMode(steer(uneven(), uneven().ps[0], uneven().ps[2], T - 86400, T - 7200, 2).tl, mode).s;
    const more = scoreMode(steer(uneven(), uneven().ps[2], uneven().ps[0], T - 86400, T - 7200, 2).tl, mode).s;
    for (const [i, p] of h.producers.entries()) { assert.equal(less.producers[i].lift, p.lift, `${mode} ${p.a}: less`); assert.equal(more.producers[i].lift, p.lift, `${mode} ${p.a}: more`); }
    assert.ok(h.producers.find((p) => p.a === uneven().ps[0]).lift > M, `${mode}: precondition, ps[0] is raised`);
  }
});

test("G19-1: escaping a raise needs EVERY stretch: signing half as much for the 10 days before the last 3 leaves the raise of the untouched oldest day", () => {
  const x0 = uneven(), T = scoreMode(x0.tl).s.T, hot = x0.ps[0];
  for (const mode of ["B", "C"]) {
    const h = scoreMode(uneven().tl, mode), k = R.STRETCHES[mode], span = R.LIFT_SPAN / k, start = T - R.LIFT_SKIP - R.LIFT_SPAN;
    const st = scoreMode(steer(uneven(), hot, x0.ps[2], start + span, T - R.LIFT_SKIP, 2).tl, mode), p = st.s.producers.find((q) => q.a === hot);
    // the oldest stretch alone (untouched) against its own median
    const field = st.s.producers.filter((q) => q.entry && !q.void), eAll = field.reduce((t, q) => t + q.expected, 0n), H0 = start, H1 = start + span - 1;
    const raw = (a) => { const e = st.L.shareSum(a, H0, H1); return e > 0n ? (BigInt(st.L.signedIn(a, H0, H1)) * M * M) / e : 0n; };
    let med = 0n, c = 0n; for (const q of [...field].sort((u, v) => (raw(u.a) < raw(v.a) ? -1 : 1))) { c += q.expected; if (2n * c >= eAll) { med = raw(q.a); break; } }
    const e = st.L.shareSum(hot, H0, H1), sg = BigInt(st.L.signedIn(hot, H0, H1)) * M, oldest = (((sg - R.LIFT_SD[mode] * R.isqrt(sg * M)) * M) / e) * M / med;
    assert.ok(oldest > M, `${mode}: precondition, the oldest stretch raises it`);
    assert.ok(p.lift >= oldest, `${mode}: lift ${p.lift} kept at least the untouched stretch's ${oldest}`);
    assert.ok(p.lift > M, `${mode}: still raised after ${(R.LIFT_SPAN - span) / 28800} days of signing half`);
    assert.ok(h.s.producers.find((q) => q.a === hot).lift >= p.lift);
  }
});

test("never lowered in any mode: a producer that signed almost nothing for the 3 days before the card keeps target ≥ expected", () => {
  const x = chain({ n: 445000 + 15000 }), T0 = R.makeCard(R.ledger(x.tl), game).T;
  // (it keeps signing in the last 6 hours, so it is still active at T and on the card; its 3-day pace is about a third of normal)
  for (let k = 0; k < x.tl.signers.length; k++) { const h = x.tl.from + k; if (h >= T0 - 3 * 28800 && h < T0 - 7200 && x.tl.signers[k] === x.ps[3]) { const to = x.ps[2]; x.tl.signers[k] = to; const d = x.tl.deltas[k]; if (d.h === h && d.a === x.ps[3]) x.tl.deltas[k] = { ...d, a: to }; } }
  const c = scoreMode(x.tl, "C"), b = scoreMode(x.tl, "B"), pc = c.s.producers.find((p) => p.a === x.ps[3]), pb = b.s.producers.find((p) => p.a === x.ps[3]);
  assert.ok(pc.lift >= M, "C: never lowered, however little it signed");
  assert.ok(pb.lift >= M, "B: never lowered");
  for (const m of ["A", "B", "C", "D"]) for (const p of scoreMode(x.tl, m).s.producers) assert.ok(p.target >= p.expected, `${m}: no target below the VHP share`);
  assert.equal(pc.expected, pb.expected, "the VHP-based expected blocks are the same in every mode");
});

test("mode D: the luck cap is 100 expected blocks; every other number follows A; the cap's draw is the card's", () => {
  const { tl } = uneven(), a = scoreMode(tl, "A"), d = scoreMode(tl, "D");
  assert.equal(R.MODE_CAP.D, 100n * M);
  let capped = 0;
  for (const [i, p] of d.s.producers.entries()) {
    const want = BigInt(p.k) > 100n * M ? (100n * M * M) / BigInt(p.k) : M;
    assert.equal(BigInt(p.sample), want, `${p.a}: sample`);
    if (want < M) capped++;
    assert.equal(p.lift, M);
    assert.equal(p.expected, expectedOf(a.L, d.s, p), `${p.a}: expected over the blocks that count at cap 100`);
    assert.equal(p.own, a.s.producers[i].own); assert.equal(p.k, a.s.producers[i].k); assert.equal(p.form, a.s.producers[i].form); assert.equal(p.void, a.s.producers[i].void);
  }
  assert.ok(capped >= 3, `${capped} producers above the cap in a 6-hour test field`);
  for (const p of d.s.producers) { assert.ok(p.expected <= 110n * M, `${p.a}: expected ${p.expected} about 100 blocks at most`); assert.equal(p.credited, creditedOf(a.L, d.s, p)); }
});

test("recompute: the game's settings may carry mode; the card must match it; a settings mode of E, or a card whose mode differs from the settings, is refused (both languages)", () => {
  const { tl } = uneven(), L = R.ledger(tl), gB = { ...game, paying: false, mode: "B", c: 400000n }, sB = R.scoreCard(L, R.makeCard(L, gB));
  const settings = (g) => ({ game: g.game, round: g.round, window: g.window, c: g.c.toString(), minK: g.minK, poolRule: g.poolRule, ownRule: g.ownRule, paying: g.paying, pooled: g.pooled, ...("mode" in g ? { mode: g.mode } : {}) });
  assert.equal(R.recompute(L, R.cardJson(sB), settings(gB)).same, true);
  assert.match(R.recompute(L, R.cardJson(sB), settings({ ...gB, mode: "C" })).diff, /setting mode: the card says "B", the game says "C"/);
  assert.match(R.recompute(L, R.cardJson(sB), settings({ ...game, paying: false, c: 400000n })).diff, /setting mode: the card says "B", the game says undefined/, "G19-2: a clear refusal, not only a byte offset");
  const sNone = R.scoreCard(L, R.makeCard(L, { ...game, paying: false, c: 400000n }));
  assert.match(R.recompute(L, R.cardJson(sNone), settings(gB)).diff, /setting mode: the card says undefined, the game says "B"/);
  assert.match(R.recompute(L, R.cardJson(sB), settings({ ...gB, mode: "E" })).diff, /mode must be A, B, C or D/);
  const out = JSON.parse(py(`L = V.Ledger(j["tl"]); out = []
for g in j["games"]:
    ok, d = V.recompute(L, j["card"], g); out.append([ok, (d or "")[:60]])
print(json.dumps(out))`, { tl, card: R.cardJson(sB), games: [settings(gB), settings({ ...gB, mode: "C" }), settings({ ...gB, mode: "E" }), settings({ ...game, paying: false, c: 400000n })] }));
  assert.equal(out[0][0], true); assert.match(out[1][1], /setting mode/); assert.match(out[2][1], /mode must be A, B, C or D/);
  assert.equal(out[3][0], false); assert.match(out[3][1], /setting mode: the card says "B", the game says null/, "G19-2 in Python");
});

test("the mode schedule: strict parsing, modeAt, and no change to a started week; JS = Python on values and messages", () => {
  assert.equal(R.modeSchedule(""), null); assert.equal(R.modeSchedule(undefined), null);
  assert.equal(JSON.stringify(R.modeSchedule("5:B,8:C")), JSON.stringify([[5, "B"], [8, "C"]]));
  for (const bad of ["5", "5:E", "5:B,5:C", "8:B,5:C", "05:B", " 5:B", "5:b", "1000000:B", 5, ["5:B"], { 5: "B" }]) assert.throws(() => R.modeSchedule(bad), /ruler mode schedule/, JSON.stringify(bad));
  assert.deepEqual([3, 4, 5, 7, 8, 9].map((w) => R.modeAt(w, "5:B,8:C")), ["A", "A", "B", "B", "C", "C"]);
  assert.equal(R.modeAt(50, ""), "A");
  assert.equal(R.modeChange("", "5:B", 4), null, "next week may change");
  assert.equal(R.modeChange("5:B", "5:B,8:C", 6), null, "adding a later change");
  assert.equal(R.modeChange("5:B,8:C", "5:B,9:D", 7), null, "moving a future change");
  assert.match(R.modeChange("", "4:B", 4), /week 4 has started and would change from A to B/);
  assert.match(R.modeChange("5:B", "", 5), /week 5 has started and would change from B to A/);
  assert.match(R.modeChange("5:B", "6:B", 5), /week 5 has started and would change from B to A/);
  assert.match(R.modeChange("5:B,8:C", "5:B", 8), /week 8 has started and would change from C to B/);
  assert.equal(R.modeChange("5:B,8:C", "5:B", 7), null);
  // random cross-check against week-by-week comparison
  const r = rng(20261111), pickS = () => { if (r() < 0.25) return ""; const n = 1 + Math.floor(r() * 3), ws = [...new Set(Array.from({ length: n }, () => 1 + Math.floor(r() * 20)))].sort((a, b) => a - b); return ws.map((w) => `${w}:${"ABCD"[Math.floor(r() * 4)]}`).join(","); };
  const cases = [];
  for (let i = 0; i < 1500; i++) { const p = pickS(), n = pickS(), w = Math.floor(r() * 24); let want = true; for (let x = 0; x <= w; x++) if (R.modeAt(x, p) !== R.modeAt(x, n)) want = false; assert.equal(R.modeChange(p, n, w) === null, want, `${p} -> ${n} at ${w}`); cases.push([p, n, w]); }
  const bads = ["5", "5:E", "5:B,5:C", "05:B", "1000000:B"];
  const js = cases.map(([p, n, w]) => [R.modeAt(w, p), R.modeChange(p, n, w)]).concat(bads.map((b) => { try { R.modeSchedule(b); return ["ok"]; } catch (e) { return ["err", e.message]; } }));
  const pyOut = JSON.parse(py(`out = []
for p, n, w in j["cases"]:
    out.append([V.mode_at(w, p), V.mode_change(p, n, w)])
for b in j["bads"]:
    try:
        V.mode_schedule(b); out.append(["ok"])
    except ValueError as e: out.append(["err", str(e)])
print(json.dumps(out))`, { cases, bads }));
  assert.equal(JSON.stringify(pyOut), JSON.stringify(js));
});

test("tools/vhp-ruler-mode.mjs: OK for a future week, REFUSED for the running week", () => {
  const run = (...a) => { try { return { code: 0, out: execFileSync("node", [`${APP}/tools/vhp-ruler-mode.mjs`, ...a], { encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: String(e.stdout) }; } };
  const ok = run("6:C", "--week", "5");
  assert.equal(ok.code, 0, ok.out); assert.match(ok.out, /week   6  Mon, 30 Nov 2026  now: A, VHP only {5}after: C, best day/); assert.match(ok.out, /^OK: /m);
  const no = run("5:D", "--week", "5");
  assert.equal(no.code, 1); assert.match(no.out, /REFUSED: .*week 5 has started and would change from A to D/);
});
