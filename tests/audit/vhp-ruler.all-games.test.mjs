// The all-games ruler setting (owner, 14 Nov 2026: "one setting for all games, a per-game setting that overrides it; unset
// stays byte for byte as today; a started week never changes"). Spec: claude/ruler/SPEC-ALL-GAMES-RULER-MODE-2026-11-14.md.
//  effectiveSchedule(all, own, kind) / effective_schedule: the game's own schedule when set (it replaces the all-games
//    one), else the all-games schedule, else null; both strict. cardMode / card_mode and cardVersion / card_version: what
//    a card's settings carry for a week (null = leave the key out: mode A, version 4).
// Run: node --import tsx --test tests/audit/vhp-ruler.all-games.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { R, PY } from "./vhp-ruler.fixture.mjs";
import { chain, game } from "./vhp-ruler.repolens-b10-chain.mjs";

// [all-games value, the game's own value, vault week] → [effective schedule, the card's mode]
const MODE_CASES = [
  ["", "", 7, null, null],                 // 1. nothing set: no schedule, no mode key (byte for byte as today)
  ["6:B", "", 5, "6:B", null],             // 2. all games B from week 6: week 5 is still A, no key
  ["6:B", "", 6, "6:B", "B"],              // 3. ... and week 6 is B
  ["6:B", "8:C", 7, "8:C", null],          // 4. the game's own schedule replaces the all-games one: week 7 is A for it
  ["6:B", "8:C", 8, "8:C", "C"],           // 5. ... and C from its own week 8
  ["6:B", "1:A", 9, "1:A", null],          // 6. "no mode for this game": its own 1:A, so A every week, no key
  ["6:B,9:D", "", 12, "6:B,9:D", "D"],     // 7. several all-games pairs
  [undefined, null, 3, null, null],        // 8. unset variables read as undefined / null: same as ""
];
const VERSION_CASES = [
  ["", "", 6, null, null],
  ["6:5", "", 5, "6:5", null],
  ["6:5", "", 6, "6:5", 5],
  ["6:5", "1:4", 6, "1:4", null],          // version 4 for this game while all games take 5
];

test("all games: effectiveSchedule and cardMode, the spec's cases (JS)", () => {
  for (const [all, own, w, sched, mode] of MODE_CASES) {
    assert.equal(R.effectiveSchedule(all, own), sched, `${all} / ${own}`);
    assert.equal(R.effectiveSchedule(all, own, "mode"), sched);
    assert.equal(R.cardMode(w, sched), mode, `${all} / ${own} week ${w}`);
  }
  for (const [all, own, w, sched, v] of VERSION_CASES) {
    assert.equal(R.effectiveSchedule(all, own, "version"), sched);
    assert.equal(R.cardVersion(w, sched), v);
  }
});

test("all games: the same answers in Python (vhp_ruler.py), case for case", () => {
  const cases = JSON.stringify({ m: MODE_CASES.map(([a, o, w]) => [a ?? null, o ?? null, w]), v: VERSION_CASES.map(([a, o, w]) => [a, o, w]) });
  const out = JSON.parse(PY(`c = json.loads(sys.stdin.read())
m = [[V.effective_schedule(a, o), V.card_mode(w, V.effective_schedule(a, o))] for a, o, w in c["m"]]
v = [[V.effective_schedule(a, o, "version"), V.card_version(w, V.effective_schedule(a, o, "version"))] for a, o, w in c["v"]]
sys.stdout.write(json.dumps({"m": m, "v": v}))`, cases));
  assert.deepEqual(out.m, MODE_CASES.map((x) => [x[3], x[4]]));
  assert.deepEqual(out.v, VERSION_CASES.map((x) => [x[3], x[4]]));
});

test("all games: a bad value stops the run in both languages, even when the game's own value wins", () => {
  for (const [all, own, kind] of [["6:Z", "8:C", "mode"], ["6:B", "8:Q", "mode"], ["6:B,5:C", "", "mode"], ["6:6", "", "version"], ["6:B", "", "both"]]) {
    assert.throws(() => R.effectiveSchedule(all, own, kind), `${all} / ${own} / ${kind}`);
    const py = PY(`try:\n    V.effective_schedule(${JSON.stringify(all)}, ${JSON.stringify(own)}, ${JSON.stringify(kind)}); print("ok")\nexcept ValueError as e: print("refused")`);
    assert.equal(py.trim(), "refused", `python ${all} / ${own} / ${kind}`);
  }
});

test("all games: modeChange on the effective schedule keeps every started week (each game's own record)", () => {
  // the game recorded its effective schedule; this run's variables give a new one; vault week 7 has started
  const eff = (a, o) => R.effectiveSchedule(a, o);
  assert.equal(R.modeChange(eff("", ""), eff("8:B", ""), 7), null);                  // 9. all games B from next week: OK
  assert.match(R.modeChange(eff("6:B", ""), eff("6:B", "8:C"), 7), /week 6 has started/); // 10. own 8:C drops started B weeks
  assert.equal(R.modeChange(eff("6:B", ""), eff("6:B", "6:B,9:A"), 7), null);        // 11. opt out from week 9: restate the past
  assert.equal(R.modeChange(eff("6:B", ""), eff("6:B", "1:A"), 5), null);            // 12. opt out before the first B week
  assert.match(R.modeChange(eff("6:B", ""), eff("", ""), 6), /week 6 has started/);  // 13. removing all games' B in week 6
  // the same answers in Python
  const py = PY(`e = V.effective_schedule
r = [V.mode_change(e("", ""), e("8:B", ""), 7), V.mode_change(e("6:B", ""), e("6:B", "8:C"), 7), V.mode_change(e("6:B", ""), e("6:B", "6:B,9:A"), 7), V.mode_change(e("6:B", ""), e("6:B", "1:A"), 5), V.mode_change(e("6:B", ""), e("", ""), 6)]
sys.stdout.write(json.dumps([x is None for x in r]))`);
  assert.deepEqual(JSON.parse(py), [true, false, true, true, false]);
});

test("all games: a card whose week is A carries no mode key, so a schedule set for future weeks changes no card today", () => {
  const { tl } = chain();
  const L = R.ledger(tl);
  const none = R.scoreCard(L, R.makeCard(L, { ...game }));
  const sched = R.effectiveSchedule("9:B", "");                 // set during week 7, for week 9
  const m = R.cardMode(7, sched);
  const today = R.scoreCard(L, R.makeCard(L, { ...game, ...(m === null ? {} : { mode: m }) }));
  assert.equal(R.cardJson(today), R.cardJson(none), "byte for byte the card of an unset schedule");
  // what the old rule (mode whenever a schedule is set) would make: a different card, so the week's earlier cards
  // (published without a mode) and its new ones would disagree
  const withA = R.scoreCard(L, R.makeCard(L, { ...game, mode: "A" }));
  assert.notEqual(R.cardJson(withA), R.cardJson(none));
  assert.equal(withA.mode, "A");
  // ... though it scores the same: mode A only adds the mode key and each row's lift and target
  assert.deepEqual(withA.producers.map((p) => p.fpct), none.producers.map((p) => p.fpct));
});

test("all games: tools/vhp-ruler-mode.mjs --all checks the game's effective schedule", async () => {
  const { execFileSync } = await import("node:child_process");
  const run = (...a) => { try { return { code: 0, out: execFileSync("node", ["tools/vhp-ruler-mode.mjs", ...a], { encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: String(e.stdout) }; } };
  const ok = run("--all", "9:B", "", "--week", "7");
  assert.equal(ok.code, 0);
  assert.match(ok.out, /"" -> "9:B" \(the game's all-games value\)/);
  assert.match(ok.out, /^OK/m);
  const own = run("--all", "6:B", "8:C", "--prev", "6:B", "--week", "7");
  assert.equal(own.code, 1);
  assert.match(own.out, /own value, which replaces the all-games one/);
  assert.match(own.out, /^REFUSED: .*week 6 has started/m);
  assert.notEqual(run("--all", "6:Z", "", "--week", "7").code, 0);
});
