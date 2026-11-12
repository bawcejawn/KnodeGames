// Knode Games — VHP ruler: the kit's include option (Repo Lens #G-13 G6, owner 11 Nov), RULE_VERSION 5 (the core judged
// on [T − 14 d, T − 3 d); Repo Lens #G-21 Info, owner 12 Nov) and the per-game version schedule (<GAME>_RULER_VERSION).
// A card without include and without version 5 stays RULE_VERSION 4 byte for byte. Run: node --import tsx --test <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson } from "./vhp-ruler.fixture.mjs";
import { chain, game } from "./vhp-ruler.repolens-b10-chain.mjs";

const M = 1000000n, dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-v5-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };
const pyCard = (tl, g) => py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"], g.get("mode"), g.get("include"), g.get("version", 4)))))`, { tl, g });
const pyRecompute = (tl, card, g) => py(`L = V.Ledger(j["tl"])
ok, d = V.recompute(L, j["card"], j["g"]); print("same" if ok else d)`, { tl, card, g });
const free = { ...game, paying: false };
const score = (tl, g = free) => { const L = R.ledger(tl); return { L, s: R.scoreCard(L, R.makeCard(L, g)) }; };

// ps[4] signs nothing from 8,000 blocks before the window to the chain's end: not active at T, no block in the race
const SILENT_FROM = 437000;
const quiet = () => chain({ units: [1, 1, 1, 1, 1], signerOf: (k, ps) => (k >= SILENT_FROM ? ps[(k * 7 + (k >> 5)) % 4] : ps[(k * 7 + (k >> 5)) % 5]) });
// a steer that moves blocks from who to to in [h0, h1); the anchors follow each block's VHP delta, so every balance before
// the steer is exactly as in the unsteered chain
const steer = (x, who, to, h0, h1, keepEvery) => {
  let n = 0;
  for (let k = 0; k < x.tl.signers.length; k++) {
    const h = x.tl.from + k;
    if (h >= h0 && h < h1 && x.tl.signers[k] === who && n++ % keepEvery !== 0) {
      x.tl.signers[k] = to; const d = x.tl.deltas[k];
      if (d.h === h && d.a === who) { x.tl.deltas[k] = { ...d, a: to }; x.tl.anchors[who] = { ...x.tl.anchors[who], v: x.tl.anchors[who].v - d.d }; x.tl.anchors[to] = { ...x.tl.anchors[to], v: x.tl.anchors[to].v + d.d }; }
    }
  }
  return x;
};

// ── include ──
test("include: a listed producer with no block in the 6 hours before T gets a row, scored by the same code; the total and every other row are unchanged; JS = Python", () => {
  const x = quiet(), silent = x.ps[4], { L, s: plain } = score(x.tl);
  assert.equal(plain.producers.some((p) => p.a === silent), false, "precondition: not active at T, so no row today");
  const g = { ...free, include: [silent] }, withInc = R.scoreCard(L, R.makeCard(L, g)), row = withInc.producers.find((p) => p.a === silent);
  assert.ok(row, "a row for the listed producer");
  assert.equal(JSON.stringify(withInc.include), JSON.stringify([silent]));
  assert.equal(withInc.total, plain.total, "the network total stays Σ avg over active(T)");
  assert.ok(row.expected > 0n && row.credited === 0n, "an offline day scores what it earned: expected > 0, credited 0");
  assert.equal(row.entry, true, "it signed in its form window, so it has entry (form gate and minK as usual)");
  for (const p of plain.producers) { const q = withInc.producers.find((r) => r.a === p.a); for (const k of ["own", "avg", "k", "form", "entry", "expected", "credited", "void"]) assert.equal(String(q[k]), String(p[k]), `${p.a} ${k}`); }
  assert.equal(pyCard(x.tl, g), R.cardJson(withInc), "JS = Python");
});

test("include: a listed producer that is active is just its usual row; one with VHP that never signed in its form window has no entry; one the data doesn't know is refused (the game holds)", () => {
  const x = quiet(), { L, s: plain } = score(x.tl), on = x.ps[0];
  const a = R.scoreCard(L, R.makeCard(L, { ...free, include: [on] }));
  assert.equal(JSON.stringify(a.producers.map((p) => [p.a, String(p.expected), p.entry])), JSON.stringify(plain.producers.map((p) => [p.a, String(p.expected), p.entry])));
  const y = chain({ signerOf: (k, ps) => ps[(k * 7 + (k >> 5)) % 4] }), never = y.ps[4], Ly = R.ledger(y.tl);   // VHP, no blocks ever
  const b = R.scoreCard(Ly, R.makeCard(Ly, { ...free, include: [never] })), r = b.producers.find((p) => p.a === never);
  assert.ok(r); assert.equal(r.entry, false); assert.ok(r.expected > 0n); assert.equal(r.credited, 0n); assert.equal(r.fpct, null);
  assert.equal(pyCard(y.tl, { ...free, include: [never] }), R.cardJson(b), "JS = Python");
  const stranger = "1" + "A".repeat(33);
  assert.throws(() => R.makeCard(L, { ...free, include: [stranger] }), /unknown address/);
  assert.match(R.recompute(L, R.cardJson(plain), { ...free, c: "400000", include: [stranger] }).diff, /setting include/);
  assert.match(py(`L = V.Ledger(j["tl"]); g = j["g"]
try:
    V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"], None, [j["s"]]); print("made")
except ValueError as e: print(e)`, { tl: x.tl, g: free, s: stranger }), /unknown address/);
});

test("include: without it the card is byte for byte as before; bad lists are refused in both languages; recompute needs the same list", () => {
  const x = quiet(), L = R.ledger(x.tl), silent = x.ps[4];
  assert.equal(R.cardJson(R.makeCard(L, free)), R.cardJson(R.makeCard(L, { ...free, include: undefined })));
  assert.equal("include" in R.makeCard(L, free), false);
  for (const [bad, re] of [[[], /non-empty list/], [["x"], /non-empty list/], [[x.ps[1], x.ps[0]].sort().reverse(), /rising order/], [[silent, silent], /rising order/], ["1abc", /non-empty list/]]) {
    assert.throws(() => R.makeCard(L, { ...free, include: bad }), re, JSON.stringify(bad));
    assert.match(py(`try:
    V.check_include(j["x"]); print("ok")
except ValueError as e: print(e)`, { x: bad }), re, `Python ${JSON.stringify(bad)}`);
  }
  const g = { ...free, c: "400000", include: [silent] }, card = R.cardJson(R.scoreCard(L, R.makeCard(L, { ...g, c: 400000n })));
  assert.equal(R.recompute(L, card, g).same, true);
  assert.equal(pyRecompute(x.tl, card, g).trim(), "same");
  const { include, ...noInc } = g;
  assert.match(R.recompute(L, card, noInc).diff, /setting include/);
  assert.match(pyRecompute(x.tl, card, noInc), /setting include/);
  const plainCard = R.cardJson(R.scoreCard(L, R.makeCard(L, free)));
  assert.match(R.recompute(L, plainCard, g).diff, /setting include/);
  assert.match(pyRecompute(x.tl, plainCard, g), /setting include/);
  assert.match(R.recompute(L, card, { ...g, include: [silent, silent] }).diff, /the game's settings: include must be in rising order/);
});

// ── RULE_VERSION 5 ──
test("version: no version and version 4 give the same card, byte for byte (RULE_VERSION 4); version 5 changes only ruleVersion, coreForm, core, z, setAside and fpct", () => {
  const x = chain(), L = R.ledger(x.tl);
  const none = R.scoreCard(L, R.makeCard(L, free)), v4 = R.scoreCard(L, R.makeCard(L, { ...free, version: 4 })), v5 = R.scoreCard(L, R.makeCard(L, { ...free, version: 5 }));
  assert.equal(R.cardJson(none), R.cardJson(v4));
  assert.equal(none.ruleVersion, 4); assert.equal(v5.ruleVersion, 5);
  assert.equal("coreForm" in none.producers[0], false);
  const strip = (c) => JSON.stringify({ ...c, ruleVersion: 0, producers: c.producers.map(({ coreForm, core, z, setAside, fpct, ...p }) => p) }, (k, v) => (typeof v === "bigint" ? String(v) : v));
  assert.equal(strip(v5), strip(none));
  assert.throws(() => R.makeCard(L, { ...free, version: 6 }), /version must be 4 or 5/);
  assert.throws(() => R.scoreCard(L, { ...R.makeCard(L, free), ruleVersion: 3 }), /ruleVersion must be 4 or 5/);
});

test("version 5: coreForm = signed ÷ expected share over [T − 14 d, T − 3 d) (a reference from the docs); core = field members with coreForm ≥ 0.97 × the field's expected-weighted median coreForm; JS = Python", () => {
  const x = chain(), L = R.ledger(x.tl), s = R.scoreCard(L, R.makeCard(L, { ...free, version: 5 }));
  const H0 = Math.max(L.validFrom, s.T - R.FORM), H1 = s.T - R.LIFT_SKIP - 1;
  const ref = (a) => { const e = L.shareSum(a, H0, H1); return e > 0n ? (BigInt(L.signedIn(a, H0, H1)) * M * M) / e : 0n; };
  const field = s.producers.filter((p) => p.entry && !p.void), eAll = field.reduce((t, p) => t + p.expected, 0n);
  let med = 0n, c = 0n; for (const p of [...field].sort((u, v) => (ref(u.a) < ref(v.a) ? -1 : ref(u.a) > ref(v.a) ? 1 : 0))) { c += p.expected; if (2n * c >= eAll) { med = ref(p.a); break; } }
  const line = (med * R.CORE_LINE) / M;
  for (const p of s.producers) { assert.equal(p.coreForm, ref(p.a), `${p.a} coreForm`); assert.equal(p.core, p.entry && !p.void && ref(p.a) >= line, `${p.a} core`); }
  assert.equal(pyCard(x.tl, { ...free, version: 5 }), R.cardJson(s), "JS = Python");
});

test("version 5 closes the core steer: signing far less in the last 3 days before T takes a node out of the core in version 4, never in version 5", () => {
  const even = () => chain({ units: [1, 1, 1, 1, 1] });   // every form about 1, the core line 0.97
  const T = score(even().tl).s.T, h4 = score(even().tl), h5 = score(even().tl, { ...free, version: 5 });
  // the steerer: the field member with the lowest form (closest to the core line), still above the 80% entry gate after
  // signing half as much for the 3 days before the race
  const who = [...h4.s.producers].sort((u, v) => (u.form < v.form ? -1 : 1))[0].a, to = even().ps.find((a) => a !== who);
  const st = () => steer(even(), who, to, T - R.LIFT_SKIP, T - 7200, 2);
  const s4 = score(st().tl), s5 = score(st().tl, { ...free, version: 5 });
  const row = (c) => c.producers.find((p) => p.a === who);
  assert.equal(row(h4.s).core, true, "precondition: honest, it is in the core");
  assert.equal(row(s4.s).entry, true, "precondition: after the dip it still has entry");
  assert.equal(row(s4.s).core, false, "version 4: the 3-day dip takes it out of the core");
  assert.equal(row(s5.s).core, true, "version 5: still in the core");
  assert.equal(row(s5.s).coreForm, row(h5.s).coreForm, "version 5: the last 3 days aren't read");
  for (const [i, p] of h5.s.producers.entries()) assert.equal(s5.s.producers[i].core, p.core, `${p.a}: version 5 core unchanged by the dip`);
});

test("version: recompute needs the same version both ways and refuses others, in both languages", () => {
  const x = chain(), L = R.ledger(x.tl), g = { ...free, c: "400000" };
  const c4 = R.cardJson(R.scoreCard(L, R.makeCard(L, { ...free }))), c5 = R.cardJson(R.scoreCard(L, R.makeCard(L, { ...free, version: 5 })));
  assert.equal(R.recompute(L, c5, { ...g, version: 5 }).same, true); assert.equal(pyRecompute(x.tl, c5, { ...g, version: 5 }).trim(), "same");
  assert.equal(R.recompute(L, c4, { ...g, version: 4 }).same, true); assert.equal(pyRecompute(x.tl, c4, { ...g, version: 4 }).trim(), "same");
  assert.equal(R.recompute(L, c4, g).same, true); assert.equal(pyRecompute(x.tl, c4, g).trim(), "same");
  assert.match(R.recompute(L, c4, { ...g, version: 5 }).diff, /setting version: the card says 4, the game says 5/);
  assert.match(pyRecompute(x.tl, c4, { ...g, version: 5 }), /setting version: the card says 4, the game says 5/);
  assert.match(R.recompute(L, c5, g).diff, /setting version: the card says 5, the game says 4/);
  assert.match(pyRecompute(x.tl, c5, g), /setting version: the card says 5, the game says 4/);
  assert.match(R.recompute(L, c4, { ...g, version: 6 }).diff, /version must be 4 or 5/);
  assert.match(pyRecompute(x.tl, c4, { ...g, version: "5" }), /version must be 4 or 5/);
  assert.match(R.recompute(L, c4, { ...g, extra: 1 }).diff, /optionally, mode, include, version/);
});

// ── the version schedule ──
test("versionSchedule / versionAt / versionChange: strict, 4 before the first pair, a started week never changes; JS = Python", () => {
  assert.equal(R.versionSchedule(""), null); assert.equal(R.versionSchedule(undefined), null);
  assert.equal(JSON.stringify(R.versionSchedule("6:5")), "[[6,5]]"); assert.equal(JSON.stringify(R.versionSchedule("6:5,9:4")), "[[6,5],[9,4]]");
  for (const bad of ["6:6", "6:B", "0:5", "6:5,6:4", "7:5,6:4", "6:5,", " 6:5", "1000000:5"]) assert.throws(() => R.versionSchedule(bad), /version schedule/, bad);
  assert.equal(R.versionAt(5, "6:5"), 4); assert.equal(R.versionAt(6, "6:5"), 5); assert.equal(R.versionAt(10, "6:5,9:4"), 4); assert.equal(R.versionAt(7, ""), 4);
  assert.equal(R.versionChange("", "6:5", 5), null, "a future week may change");
  assert.match(R.versionChange("", "5:5", 5), /week 5 has started and would change from 4 to 5/);
  assert.match(R.versionChange("6:5", "", 6), /week 6 has started and would change from 5 to 4/);
  const cases = [["", "6:5", 5], ["", "5:5", 5], ["6:5", "", 6], ["6:5", "7:5", 6], ["6:5", "6:5,9:4", 8]];
  const js = cases.map(([p, n, w]) => [R.versionChange(p, n, w), R.versionAt(w, n)]);
  const pyOut = JSON.parse(py(`print(json.dumps([[V.version_change(p, n, w), V.version_at(w, n)] for p, n, w in j["c"]]))`, { c: cases }));
  assert.deepEqual(pyOut, js, "JS = Python, messages included");
  assert.match(py(`try:
    V.version_schedule("6:6"); print("ok")
except ValueError as e: print(e)`, {}), /version schedule must be empty or week:version pairs/);
});

test("tools/vhp-ruler-mode.mjs --version: OK for a future week, REFUSED for the running week; mode schedules unchanged", async () => {
  const { execFileSync } = await import("node:child_process"), { APP } = await import("./vhp-ruler.fixture.mjs");
  const run = (...a) => { try { return { code: 0, out: execFileSync("node", [`${APP}/tools/vhp-ruler-mode.mjs`, ...a], { encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
  const ok = run("--version", "6:5", "--week", "5");
  assert.equal(ok.code, 0); assert.match(ok.out, /week {3}6 .* now: version 4 +after: version 5/); assert.match(ok.out, /OK: no week that has started changes version/);
  const no = run("--version", "5:5", "--week", "5");
  assert.equal(no.code, 1); assert.match(no.out, /REFUSED: the ruler version schedule moved from "" to "5:5": week 5 has started/);
  assert.notEqual(run("--version", "6:B", "--week", "5").code, 0, "a bad version schedule stops");
  const m = run("6:B", "--week", "5");
  assert.equal(m.code, 0); assert.match(m.out, /OK: no week that has started changes mode/);
});
