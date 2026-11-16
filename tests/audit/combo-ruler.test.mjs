// Combo Card on the VHP ruler (D-new A; the Library, 12 Nov: Combo launches on the ruler from its first week, with one
// week rule for race legs, as Repo Lens #G-16 Q6 advised). COMBO_RULER_FROM_WEEK = N: every race leg of a card whose day
// is in an ON week (N and later) is decided by the Race's own ruler card (race-data R<week>.json), never by the handicap
// standings; week N - 1 (shadow) and earlier keep the standings. Block X legs are unchanged. The recorder, the verify job
// and the publish job use the same rule; a started week never changes whether the ruler scores it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const F = await import("./repolens-fc-combo/D-R.fixtures.mjs");
const { APP, run, M, X, C, H1, H2, H3, H4, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const S = await import(path.join(APP, "bot/games/combo-score.mjs"));
const V = await import(path.join(APP, "tools/combo-verify.mjs"));
const YML = fs.readFileSync(path.join(APP, ".github/workflows/combo.yml"), "utf8");
const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`;
const rf = D3 * 4 + 3;                                   // the 18:00 UTC race of Monday 9 Nov (vault week 3)

// ── the ruler's card for a race: producers with entry, void, fpct, signed (as KRuler.cardJson writes them) ──
const cardOf = (rows) => JSON.stringify({ producers: rows.map(([a, fpct, extra = {}]) => ({ a, entry: true, void: false, fpct: fpct === null ? null : String(fpct), signed: 5, ...extra })) });
const entryOf = (round, rows) => ({ id: M.raceId(round), round: "x", window: { W0: 1, W1: 2, L: 2, S0: 3, S1: 4 }, card: cardOf(rows), note: null, placings: [] });
/** The Race's R file for week w: every race of the week on one card (unless `cards` names a race's own rows). */
function withRuler(dir, w, rows, cards = {}, mode = "on") {
  const races = [];
  for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) { const i = M.raceIndex(t); races.push(entryOf(i, cards[i] ?? rows)); }
  fs.writeFileSync(path.join(dir, `R${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, rulerFrom: 3, mode, shadow: mode === "shadow", races }));
  return dir;
}
// The handicap standings say H1, H2, H3, H4 for every race (raceDir); the ruler's card says H4, H3, H2, H1.
const REVERSED = [[H4, 900], [H3, 800], [H2, 700], [H1, 600]];
// The next race's ruler card has H3 first (a card names a producer once, so the second leg is on H3).
const NEXT = { [rf + 1]: [[H3, 950], [H4, 900], [H2, 700], [H1, 600]] };

test("the publish job's copy of the switch is vhp_ruler.py's, line for line", () => {
  const i = YML.indexOf("          SWITCH_MAX = 999999"), j = YML.indexOf("          # (End of the copy.)");
  assert.ok(i > 0 && j > i);
  const norm = (t) => t.split("\n").filter((l) => l.trim() !== "").join("\n");
  const mine = norm(YML.slice(i, j).split("\n").map((l) => l.slice(10)).join("\n"));
  const py = fs.readFileSync(path.join(APP, "vhp_ruler.py"), "utf8").split("\n");
  const block = (name) => { const k = py.findIndex((l) => l.startsWith(name)); assert.ok(k >= 0, name); let e = k + 1; while (e < py.length && (py[e] === "" || /^\s/.test(py[e]))) e++; return py.slice(k, e).join("\n"); };
  const theirs = norm(["SWITCH_MAX = 999999", ...["def switch_from(", "def _switch_week(", "def _mode_of(", "def ruler_mode(", "def switch_change("].map(block)].join("\n"));
  assert.equal(mine, theirs);
});

test("the switch: strict, three modes by week, and a started week never changes (KRuler)", () => {
  assert.equal(S.rulerFrom(""), null); assert.equal(S.rulerFrom(undefined), null); assert.equal(S.rulerFrom("6"), 6);
  for (const bad of [" ", "06", "six", "0", "1000000"]) assert.throws(() => S.rulerFrom(bad), undefined, JSON.stringify(bad));
  assert.deepEqual([4, 5, 6, 7].map((w) => S.rulerModeOf(w, 6)), ["off", "shadow", "on", "on"]);
  assert.equal(S.ruledDay(D3, null), false); assert.equal(S.ruledDay(D3, 3), true); assert.equal(S.ruledDay(D3, 4), false);
  assert.equal(S.rulerChange(null, 6, 4), null, "a first switch-on for a later week");
  assert.equal(S.rulerChange(null, 5, 4), null, "from next Monday");
  assert.match(String(S.rulerChange(null, 4, 4)), /week 4 has started/);
  assert.match(String(S.rulerChange(3, null, 4)), /has started/, "an ON week never goes back");
  assert.match(String(S.rulerChange(3, 6, 4)), /has started/);
});

test("a race leg on the ruler: the ruler's order decides; a void producer is a miss (D-164); absent is void (RL-16)", () => {
  const race = { result: { final: true, checked: 2, standings: [H1, H2, H3, H4].map((a) => ({ a, steps: 1 })) } };
  const R = (rows) => ({ entry: entryOf(rf, rows) });
  const leg = (code, producer) => ({ code, round: rf, producer });
  // Standings vs ruler: opposite orders.
  assert.equal(C.legResult(leg(C.WIN, H1), race, null), "hit");
  assert.equal(C.legResult(leg(C.WIN, H1), race, null, R(REVERSED)), "miss");
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, R(REVERSED)), "hit");
  assert.equal(C.legResult(leg(C.SHOW, H2), race, null, R(REVERSED)), "hit");
  assert.equal(C.legResult(leg(C.SHOW, H1), race, null, R(REVERSED)), "miss");
  assert.equal(C.legResult(leg(C.HALF, H3), race, null, R(REVERSED)), "hit", "top half of 4 = 2");
  assert.equal(C.legResult(leg(C.HALF, H2), race, null, R(REVERSED)), "miss");
  // Equal fpct: by address (the Race's placingsOf).
  const tie = [[H1, 500], [H2, 500]], first = [H1, H2].sort()[0];
  assert.equal(C.legResult(leg(C.WIN, first), race, null, R(tie)), "hit");
  // Void: a miss (the Race counts such a pick as a loss); the field is the rest.
  const voided = [[H4, null, { void: true }], [H3, 800], [H2, 700], [H1, 600]];
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, R(voided)), "miss");
  assert.equal(C.legResult(leg(C.WIN, H3), race, null, R(voided)), "hit");
  assert.equal(C.legResult(leg(C.HALF, H2), race, null, R(voided)), "miss", "top half of the 3 left = 1");
  // Not on the card at all, or without entry: void (no fault of the player). An empty field: void (picks given back).
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, R([[H1, 600], [H2, 500]])), "void");
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, R([[H4, 900, { entry: false }], [H1, 600]])), "void");
  assert.equal(C.legResult(leg(C.WIN, H1), race, null, R([[H1, null, { void: true }], [H2, null, { void: true }]])), "miss");
  assert.equal(C.legResult(leg(C.WIN, H3), race, null, R([[H1, null, { void: true }], [H2, null, { void: true }]])), "void");
  // Signed nothing (as the Race, D-033; Repo Lens #G-37 Info): the ruler's winner still wins; 2nd and lower don't place.
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, R([[H4, 900, { signed: 0 }], [H1, 600]])), "hit");
  assert.equal(C.legResult(leg(C.SHOW, H4), race, null, R([[H4, 900, { signed: 0 }], [H1, 600]])), "hit");
  assert.equal(C.legResult(leg(C.SHOW, H1), race, null, R([[H4, 900], [H1, 600, { signed: 0 }]])), "miss");
  assert.equal(C.legResult(leg(C.HALF, H1), race, null, R([[H4, 900], [H1, 600, { signed: 0 }], [H2, 500], [H3, 400]])), "miss");
  // No ruler card yet: pending; a race that never ran, or not checked on two nodes: unresolved, as before.
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, { entry: null }), "pending");
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, { entry: { ...entryOf(rf, REVERSED), card: null } }), "pending");
  assert.equal(C.legResult(leg(C.WIN, H4), { result: { final: true, missed: true } }, null, R(REVERSED)), "unresolved");
  assert.equal(C.legResult(leg(C.WIN, H4), { result: { ...race.result, checked: 1 } }, null, R(REVERSED)), "unresolved");
  assert.equal(C.legResult(leg(C.WIN, H4), { result: { final: false } }, null, R(REVERSED)), "pending");
  // A card that isn't JSON: no card (pending, so it ends unresolved at the deadline), never a guess.
  assert.equal(C.legResult(leg(C.WIN, H4), race, null, { entry: { ...entryOf(rf, REVERSED), card: "{" } }), "pending");
});

test("JavaScript = the publish job's Python on ruled race legs (random cards)", () => {
  // The publish step's ruled_field and expected, run with stub sources (race_record / ruler_record).
  const y = YML.split("\n");
  const from = y.findIndex((l) => l.startsWith("          def ruled_field(e):")), to = y.findIndex((l, k) => k > from && l.startsWith("              if not BX_TARGETS: return False"));
  assert.ok(from > 0 && to > from);
  const src = y.slice(from, to).map((l) => l.slice(10)).join("\n");
  let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const all = [H1, H2, H3, H4], cases = [];
  for (let k = 0; k < 300; k++) {
    const rows = all.filter(() => rnd(5) > 0).map((a) => [a, rnd(4) === 0 ? null : rnd(6) * 100, { void: rnd(6) === 0, entry: rnd(8) > 0, signed: rnd(5) === 0 ? 0 : 3 }]);
    const res = { final: rnd(10) > 0, checked: rnd(10) ? 2 : 1, missed: rnd(15) === 0, standings: [] };
    const code = [C.WIN, C.SHOW, C.HALF][rnd(3)], who = all[rnd(4)], card = rnd(12) === 0 ? null : cardOf(rows);
    const entry = { ...entryOf(rf, rows), card };
    cases.push({ js: C.legResult({ code, round: rf, producer: who }, { result: res }, null, { entry }), py: [code, rf, who], res, entry });
  }
  const py = `import json, re, sys
isaddr = lambda a: type(a) is str and re.fullmatch(r"1[1-9A-HJ-NP-Za-km-z]{25,34}", a) is not None
${src}
cases = json.load(sys.stdin); out = []
for c in cases:
    race_record = (lambda r, c=c: {"result": c["res"]}); ruler_record = (lambda r, c=c: c["entry"])
    globals()["race_record"] = race_record; globals()["ruler_record"] = ruler_record
    out.append(expected(c["py"] + [0, "pending"], True))
print(json.dumps(out))`;
  const f = path.join(tmp(), "t.py"); fs.writeFileSync(f, py);
  const got = JSON.parse(execFileSync("python3", [f], { input: JSON.stringify(cases) }).toString());
  assert.deepEqual(got, cases.map((c) => c.js));
  assert.ok(new Set(got).size >= 4, "the cases reach hits, misses, voids and pending: " + [...new Set(got)]);
});

// ── the recorder, end to end ──
const legs = [{ code: C.SHOW, round: rf, producer: H4 }, { code: C.WIN, round: rf + 1, producer: H3 }];
const sent = D3 * M.DAY + 13 * 3600000, t = M.weekStart(4) + 13 * 3600000;
const cards = (r) => (r === S0 ? [{ player: ALICE, legs, time: sent, height: heightAt(sent), changes: 0 }] : []);
async function record({ rulerFrom, race = withRuler(raceDir(), 3, REVERSED, NEXT), prev } = {}) {
  const out = tmp(), bx = blockxDir();
  // The Race on the ruler from week 3 in every test (Repo Lens #G-37: Combo never before the Race).
  await quiet(() => run({ p: node({ t, cards }), check: node({ t, cards }), out, prev, raceDir: race, blockxDir: bx, picksContract: PICKS, knodeGame: VAULT, now: t, vhpMovesOf: async () => 0n, rulerFrom, raceRulerFrom: 3 }));
  return { out, race, bx, card: read(out, dn(D3)).slots.find((s) => s.round === S0).cards[0] };
}

test("recorder: one week rule; an ON week's race legs follow the Race's ruler card, an off week's the standings", async () => {
  const off = await record({ rulerFrom: null });
  assert.equal(off.card.outcome, "miss", "by the standings H4 is 4th and H3 3rd: both legs miss");
  assert.equal(read(off.out, dn(D3)).ruled, false); assert.equal(read(off.out, "board.json").rulerFrom, null);
  const shadow = await record({ rulerFrom: 4 });
  assert.equal(shadow.card.outcome, "miss", "week 3 is the shadow week of 4: still the standings");
  assert.equal(read(shadow.out, dn(D3)).ruled, false);
  const on = await record({ rulerFrom: 3 });
  assert.deepEqual(on.card.legs.map((l) => l[4]), ["hit", "hit"], "by the ruler H4 is 1st, then H3 is 1st");
  assert.equal(on.card.outcome, "hit"); assert.ok(on.card.pts > 0);
  assert.equal(read(on.out, dn(D3)).ruled, true); assert.equal(read(on.out, "board.json").rulerFrom, 3);
  // The worths are the handicap card's either way (the price is unchanged by the switch).
  assert.deepEqual(on.card.legs.map((l) => l[3]), off.card.legs.map((l) => l[3]));
});

test("recorder: a voided producer's leg is a miss in an ON week; a race without its ruler card waits", async () => {
  const race = withRuler(raceDir(), 3, REVERSED, { ...NEXT, [rf]: [[H4, null, { void: true }], [H3, 800], [H2, 700], [H1, 600]] });
  const v = await record({ rulerFrom: 3, race });
  assert.equal(v.card.legs[0][4], "miss"); assert.equal(v.card.outcome, "miss");
  // No R file at all (the Race not on the ruler that week): the legs stay pending, never the standings.
  const none = await record({ rulerFrom: 3, race: raceDir() });
  assert.deepEqual(none.card.legs.map((l) => l[4]), ["pending", "pending"]);
  assert.equal(none.card.state, "pending");
});

test("recorder: a switch change that would change a started week is refused, nothing is written", async () => {
  const first = await record({ rulerFrom: 3 });
  await assert.rejects(() => record({ rulerFrom: null, prev: first.out }), /ruler switch change is refused/);
  await assert.rejects(() => record({ rulerFrom: 6, prev: first.out }), /ruler switch change is refused/);
  const later = await record({ rulerFrom: null, prev: (await record({ rulerFrom: null })).out });
  assert.equal(read(later.out, "board.json").rulerFrom, null);
  const ok = await record({ rulerFrom: 5, prev: later.out });            // a first switch-on from next Monday: fine
  assert.equal(read(ok.out, "board.json").rulerFrom, 5);
});

// ── the verify job ──
function vnode(n) {
  return { async call(method, params) {
    if (method === "chain.get_head_info") return n.getHeadInfo();
    if (method === "chain.read_contract") return n.readContract(params);
    return n.call(method, params);
  } };
}
test("verify job: confirms an ON week's ruled card, refuses a day whose \"ruled\" mark or result isn't the switch's", async () => {
  const on = await record({ rulerFrom: 3 });
  const go = (incoming, rulerFrom) => V.verify({ incoming, published: tmp(), race: on.race, blockx: on.bx, picks: PICKS, now: t, rulerFrom, raceRulerFrom: 3,
    p: vnode(node({ t, cards })), check: vnode(node({ t, cards })), vhpMovesOf: async () => 0n });
  assert.ok((await go(on.out, 3)).approved.some((x) => x.name === dn(D3)), "the honest ruled day is confirmed");
  const r1 = await go(on.out, null);
  assert.ok(!r1.approved.some((x) => x.name === dn(D3)), "with the switch unset the same day is refused");
  assert.ok(r1.problems.some((x) => x.day === D3 && /ruled/.test(x.why)));
  // A forged mark: the standings' result published as if the ruler were off.
  const off = await record({ rulerFrom: null, race: on.race });
  const r2 = await go(off.out, 3);
  assert.ok(!r2.approved.some((x) => x.name === dn(D3)));
  // The right mark on the standings' result: the card isn't what the ruler gives.
  const j = read(off.out, dn(D3)); j.ruled = true; fs.writeFileSync(path.join(off.out, dn(D3)), JSON.stringify(j) + "\n");
  const r3 = await go(off.out, 3);
  assert.ok(!r3.approved.some((x) => x.name === dn(D3)), JSON.stringify(r3.problems));
});

// ── the publish job ──
/** combo.yml's publish step, verbatim except the remote (a local bare repo); as D-C.publish.test.mjs. */
function publish(IN, remote, env = {}) {
  const y = YML.split("\n");
  const i = y.findIndex((l) => l.includes("Push games-data/combo (and nothing else)")), j = y.findIndex((l, k) => k > i && l.trim() === "run: |");
  const body = y.slice(j + 1).map((l) => (l.startsWith("          ") ? l.slice(10) : l)).join("\n").replace(/remote="https:[^\n]*"/, 'remote="$REMOTE"');
  const sh = path.join(tmp(), "p.sh"); fs.writeFileSync(sh, "set -euo pipefail\n" + body);
  try { return { ok: true, out: execFileSync("bash", [sh], { env: { ...process.env, IN, REMOTE: remote, RUNNER_TEMP: tmp(), CHECK_NOW_MS: String(t), RACE_RULER_FROM_WEEK: "3", ...env }, cwd: tmp(), stdio: "pipe" }).toString() }; }
  catch (e) { return { ok: false, out: String(e.stdout) + String(e.stderr) }; }
}
function remoteWith(dir, race) {
  const T = tmp(), remote = path.join(T, "r.git"); execFileSync("git", ["init", "-q", "--bare", remote]);
  const g = (s, ...a) => execFileSync("git", ["-C", s, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
  const s = path.join(T, "s"); fs.mkdirSync(s); if (dir) fs.cpSync(dir, path.join(s, "combo"), { recursive: true }); else fs.writeFileSync(path.join(s, "x"), "");
  g(s, "init", "-q"); g(s, "add", "-A"); g(s, "commit", "-qm", "s"); g(s, "push", "-q", remote, "HEAD:refs/heads/games-data");
  const r = path.join(T, "race"); fs.cpSync(race, r, { recursive: true });
  g(r, "init", "-q"); g(r, "add", "-A"); g(r, "commit", "-qm", "r"); g(r, "push", "-q", remote, "HEAD:refs/heads/race-data");
  return remote;
}
const asIncoming = (out) => { const IN = tmp(); fs.cpSync(out, path.join(IN, "combo"), { recursive: true }); return IN; };
const show = (remote, p) => { try { return execFileSync("git", ["--git-dir", remote, "show", `games-data:${p}`]).toString(); } catch { return null; } };

test("publish job: an ON week's ruled day is published; a wrong mark is held; a refused switch change publishes nothing", async () => {
  const on = await record({ rulerFrom: 3 });
  const remote = remoteWith(null, on.race);
  const a = publish(asIncoming(on.out), remote, { COMBO_RULER_FROM_WEEK: "3" });
  assert.ok(a.ok, a.out);
  assert.ok(show(remote, `combo/${dn(D3)}`), "published: " + a.out.slice(-800));
  assert.equal(JSON.parse(show(remote, "combo/board.json")).rulerFrom, 3);
  // The same files with the switch read differently: the board and the day don't match it, so neither is published.
  const remote2 = remoteWith(null, on.race);
  const b = publish(asIncoming(on.out), remote2, { COMBO_RULER_FROM_WEEK: "" });
  assert.equal(show(remote2, `combo/${dn(D3)}`), null, b.out.slice(-800));
  // A switch change against the published board that would change week 3 (started, ON): the run stops.
  const remote3 = remoteWith(on.out, on.race);
  const c = publish(asIncoming(on.out), remote3, { COMBO_RULER_FROM_WEEK: "6" });
  assert.equal(c.ok, false); assert.match(c.out, /ruler switch change is refused/);
  // Anything odd in the variable stops the run too.
  const d = publish(asIncoming(on.out), remoteWith(null, on.race), { COMBO_RULER_FROM_WEEK: "03" });
  assert.equal(d.ok, false);
});

test("capacity standard (rule 2): a file past 60% of the 2 MB publish cap is a warning, past the cap an error", async () => {
  const R = await import(path.join(APP, "bot/games/combo.ts"));
  assert.equal(R.FILE_CAP, 2 * 1024 * 1024); assert.equal(R.FILE_WARN, Math.floor(R.FILE_CAP * 0.6));
  assert.equal(R.sizeNote("board.json", R.FILE_WARN), null);
  assert.equal(R.sizeNote("board.json", R.FILE_WARN + 1).level, "warning");
  assert.equal(R.sizeNote("board.json", R.FILE_CAP + 1).level, "error");
  const src = fs.readFileSync(path.join(APP, "bot/games/combo.ts"), "utf8"), w = src.slice(src.indexOf("// ── 7. write ──"));
  assert.equal((w.match(/fs\.writeFileSync\(/g) || []).length, 1, "every file the recorder writes goes through put()");
});

test("Repo Lens #G-37: Combo is never on the ruler before the Race (recorder, verify job and publish job refuse)", async () => {
  assert.equal(S.rulerPairProblem(null, null), null, "Combo off: anything goes");
  assert.equal(S.rulerPairProblem(7, 7), null); assert.equal(S.rulerPairProblem(7, 5), null);
  assert.match(String(S.rulerPairProblem(7, null)), /RACE_RULER_FROM_WEEK is unset/);
  assert.match(String(S.rulerPairProblem(5, 7)), /before RACE_RULER_FROM_WEEK/);
  const out = tmp();
  await assert.rejects(() => quiet(() => run({ p: node({ t, cards }), check: node({ t, cards }), out, raceDir: withRuler(raceDir(), 3, REVERSED, NEXT), blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: t, vhpMovesOf: async () => 0n, rulerFrom: 3, raceRulerFrom: 4 })), /before RACE_RULER_FROM_WEEK/);
  assert.equal(fs.readdirSync(out).length, 0, "nothing written");
  const on = await record({ rulerFrom: 3 });
  const r = await V.verify({ incoming: on.out, published: tmp(), race: on.race, blockx: on.bx, picks: PICKS, now: t, rulerFrom: 3, raceRulerFrom: "",
    p: vnode(node({ t, cards })), check: vnode(node({ t, cards })), vhpMovesOf: async () => 0n });
  assert.deepEqual(r.approved, []); assert.ok(r.problems.some((x) => x.alert && /unset/.test(x.why)));
  const b = publish(asIncoming(on.out), remoteWith(null, on.race), { COMBO_RULER_FROM_WEEK: "3", RACE_RULER_FROM_WEEK: "5" });
  assert.equal(b.ok, false); assert.match(b.out, /needs RACE_RULER_FROM_WEEK/);
});
