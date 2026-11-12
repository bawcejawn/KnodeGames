// Scoring modes A–D and the admin's mode schedule (owner, 11 Nov 2026: "build me 3 additional VHP ruler formulas which can
// run alongside the active ruler method and allow the admin the ability to shift future weeks"):
//  A VHP only (today's rule); B form lift, raise only (14-day form ÷ the field's expected-weighted median form);
//  C hot hand, raise only (3-day pace ÷ the field's median pace); D even odds (luck cap 100 blocks).
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

test("mode B: a producer above the field's median form gets target = expected × form ÷ median; at or below it, nothing changes; the median is expected-weighted", () => {
  const { tl, ps } = uneven(), { s } = scoreMode(tl, "B"), field = s.producers.filter((p) => p.entry && !p.void);
  const byForm = [...field].sort((x, y) => (BigInt(x.form) < BigInt(y.form) ? -1 : 1)), eAll = field.reduce((t, p) => t + p.expected, 0n);
  let median = 0n, cum = 0n; for (const p of byForm) { cum += p.expected; if (2n * cum >= eAll) { median = BigInt(p.form); break; } }
  assert.ok(median > 0n);
  let lifted = 0, flat = 0;
  for (const p of s.producers) {
    const want = BigInt(p.form) > median ? (BigInt(p.form) * M) / median : M;
    assert.equal(p.lift, want, `${p.a}: lift`); assert.equal(p.target, (p.expected * p.lift) / M, `${p.a}: target`);
    assert.ok(p.target >= p.expected, "never lowered");
    assert.equal(p.pct, R.pct(p.target, p.credited));
    if (p.lift > M) lifted++; else flat++;
  }
  assert.ok(lifted >= 1 && flat >= 1, `lifted ${lifted}, flat ${flat}`);
  const lowest = [...field].sort((x, y) => (BigInt(x.form) < BigInt(y.form) ? -1 : 1))[0];
  assert.ok(BigInt(lowest.form) < median && lowest.lift === M, "the producer below the median is not lowered in B");
  assert.ok(ps.length === 5);
});

test("mode C: target = expected × pace ÷ median pace when the 3-day pace is above the field's median, else expected; never lowered; JS = Python", () => {
  const { tl, ps } = uneven(), { L, s } = scoreMode(tl, "C"), T = s.T, H0 = Math.max(L.validFrom, T - R.C_DAYS * R.AVG);
  const pace = (a) => { const e = L.shareSum(a, H0, T - 1); return e > 0n ? (BigInt(L.signedIn(a, H0, T - 1)) * M * M) / e : 0n; };
  const field = s.producers.filter((p) => p.entry && !p.void), eAll = field.reduce((t, p) => t + p.expected, 0n);
  const byPace = [...field].sort((x, y) => (pace(x.a) < pace(y.a) ? -1 : 1)); let med = 0n, cum = 0n;
  for (const p of byPace) { cum += p.expected; if (2n * cum >= eAll) { med = pace(p.a); break; } }
  for (const p of s.producers) {
    const r = (pace(p.a) * M) / med, want = r > M ? r : M;
    assert.equal(p.lift, want, `${p.a}: lift`); assert.equal(p.target, (p.expected * p.lift) / M);
    assert.ok(p.target >= p.expected, "never lowered");
  }
  const weakest = [...field].sort((x, y) => (pace(x.a) < pace(y.a) ? -1 : 1))[0];
  assert.ok((pace(weakest.a) * M) / med < M, "the test field has a node below the median pace");
  assert.equal(weakest.lift, M, "the weak node is not lowered");
  assert.ok(s.producers.some((p) => p.lift > M), "a stronger node's target is raised");
  // C differs from B: a producer hot in the last 3 days but ordinary over 14 is lifted in C, not in B
  const b = scoreMode(tl, "B").s; let differ = 0; for (const [i, p] of s.producers.entries()) if (p.lift !== b.producers[i].lift) differ++;
  assert.ok(differ >= 1, "C's 3-day pace gives different lifts from B's 14-day form on this chain");
  assert.ok(ps.length === 5);
  assert.equal(R.C_DAYS, 3);
  assert.equal(PY(`print(V.C_DAYS, V.MODE_CAP["D"], "".join(V.MODES))`).trim(), "3 100000000 ABCD");
});

test("no steering in any mode: a producer that signed almost nothing for the 3 days before the card keeps target = expected in B and C (never lowered)", () => {
  const x = chain({ n: 445000 + 15000 }), T0 = R.makeCard(R.ledger(x.tl), game).T;
  // (it keeps signing in the last 6 hours, so it is still active at T and on the card; its 3-day pace is about a third of normal)
  for (let k = 0; k < x.tl.signers.length; k++) { const h = x.tl.from + k; if (h >= T0 - 3 * 28800 && h < T0 - 7200 && x.tl.signers[k] === x.ps[3]) { const to = x.ps[2]; x.tl.signers[k] = to; const d = x.tl.deltas[k]; if (d.h === h && d.a === x.ps[3]) x.tl.deltas[k] = { ...d, a: to }; } }
  const c = scoreMode(x.tl, "C"), b = scoreMode(x.tl, "B"), pc = c.s.producers.find((p) => p.a === x.ps[3]), pb = b.s.producers.find((p) => p.a === x.ps[3]);
  assert.equal(pc.lift, M, "C: never lowered, however little it signed");
  assert.equal(pb.lift, M, "B: never lowered");
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
  assert.match(R.recompute(L, R.cardJson(sB), settings({ ...game, paying: false, c: 400000n })).diff, /differs at byte/);
  const sNone = R.scoreCard(L, R.makeCard(L, { ...game, paying: false, c: 400000n }));
  assert.match(R.recompute(L, R.cardJson(sNone), settings(gB)).diff, /setting mode: the card says undefined, the game says "B"/);
  assert.match(R.recompute(L, R.cardJson(sB), settings({ ...gB, mode: "E" })).diff, /mode must be A, B, C or D/);
  const out = JSON.parse(py(`L = V.Ledger(j["tl"]); out = []
for g in j["games"]:
    ok, d = V.recompute(L, j["card"], g); out.append([ok, (d or "")[:60]])
print(json.dumps(out))`, { tl, card: R.cardJson(sB), games: [settings(gB), settings({ ...gB, mode: "C" }), settings({ ...gB, mode: "E" })] }));
  assert.equal(out[0][0], true); assert.match(out[1][1], /setting mode/); assert.match(out[2][1], /mode must be A, B, C or D/);
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
  assert.equal(ok.code, 0, ok.out); assert.match(ok.out, /week   6  Mon, 30 Nov 2026  now: A, VHP only {5}after: C, own pace/); assert.match(ok.out, /^OK: /m);
  const no = run("5:D", "--week", "5");
  assert.equal(no.code, 1); assert.match(no.out, /REFUSED: .*week 5 has started and would change from A to D/);
});
