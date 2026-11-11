// The ruler switch (owner, 11 Nov 2026; D-new, numbered by the Library): <GAME>_RULER_FROM_WEEK = N makes week N − 1 the
// shadow week and every week from N "on"; unset is "off". A started week never changes whether the ruler scores it.
// Run: node --import tsx --test tests/audit/vhp-ruler.switch.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { R, PY, rng, APP } from "./vhp-ruler.fixture.mjs";

test("switchFrom reads the variable strictly", () => {
  for (const v of [undefined, null, ""]) assert.equal(R.switchFrom(v), null);
  assert.equal(R.switchFrom("7"), 7);
  assert.equal(R.switchFrom("999999"), 999999);
  assert.equal(R.switchFrom(12), 12);
  for (const bad of ["0", "07", " 7", "7 ", "-1", "1.5", "1e3", "seven", "1000000", 0, -3, 1.5, true, false, {}, []]) {
    assert.throws(() => R.switchFrom(bad), /the ruler switch must be empty or a vault week/, JSON.stringify(bad));
  }
});

test("rulerMode: unset is off; N − 1 is the shadow week; from N it is on", () => {
  assert.equal(R.rulerMode(5, ""), "off");
  assert.equal(R.rulerMode(999999, null), "off");
  assert.deepEqual([4, 5, 6, 7, 8].map((w) => R.rulerMode(w, "7")), ["off", "off", "shadow", "on", "on"]);
  assert.deepEqual([0, 1, 2].map((w) => R.rulerMode(w, 1)), ["shadow", "on", "on"]);
  for (const bad of [-1, 1.5, "5", 1000000]) assert.throws(() => R.rulerMode(bad, "7"), /week must be a vault week/);
});

test("switchChange: a started week never changes whether the ruler scores it; off and shadow may swap", () => {
  // this week is 4 (Week 1). A first switch-on from next Monday: allowed (week 4 becomes the shadow week part-way: no money effect)
  assert.equal(R.switchChange("", "5", 4), null);
  assert.equal(R.switchChange("", "6", 4), null);
  // a first switch-on for the week that is running: refused
  assert.match(R.switchChange("", "4", 4), /week 4 has started and would change from off to on; .*a first switch-on: 5 or later/);
  assert.match(R.switchChange(null, 2, 4), /week 2 has started and would change from off to on/);
  // unchanged is always fine
  assert.equal(R.switchChange("7", "7", 50), null);
  // moving a switch that isn't on yet: allowed, earlier (not before next week) or later, or back to unset
  assert.equal(R.switchChange("8", "9", 5), null);
  assert.equal(R.switchChange("9", "6", 5), null);
  assert.equal(R.switchChange("8", "", 5), null);
  assert.equal(R.switchChange("8", "", 7), null);         // shadow week 7 cancelled: nothing it published counted
  assert.match(R.switchChange("9", "5", 5), /week 5 has started and would change from off to on/);
  // once on, a week already played never goes back to the game's own method, and never moves
  assert.match(R.switchChange("6", "", 9), /week 6 has started and would change from on to off/);
  assert.match(R.switchChange("6", "12", 9), /week 6 has started and would change from on to off/);
  assert.match(R.switchChange("6", "5", 9), /week 5 has started and would change from shadow to on/);
  assert.match(R.switchChange("6", "", 6), /week 6 has started and would change from on to off/);
  assert.equal(R.switchChange("6", "10", 5), null);       // in its shadow week, the start can still move later
});

test("switchChange agrees with a week-by-week check of every started week (random cases)", () => {
  const r = rng(20261111), pick = () => (r() < 0.2 ? "" : String(1 + Math.floor(r() * 30)));
  for (let i = 0; i < 3000; i++) {
    const p = pick(), n = pick(), w = Math.floor(r() * 32);
    let want = true;
    for (let x = 0; x <= w; x++) if ((R.rulerMode(x, p) === "on") !== (R.rulerMode(x, n) === "on")) want = false;
    assert.equal(R.switchChange(p, n, w) === null, want, `${p} -> ${n} at week ${w}`);
  }
});

test("JS = Python: switchFrom, rulerMode and switchChange, values and messages", () => {
  const r = rng(11112026), cases = [];
  const vals = ["", "1", "2", "5", "6", "7", "9", "30", "999999", "0", "07", " 7", "x", "1000000", null, 3, 0, true, 1.5];
  for (let i = 0; i < 1500; i++) {
    const p = vals[Math.floor(r() * vals.length)], n = vals[Math.floor(r() * vals.length)], w = Math.floor(r() * 40) - (r() < 0.03 ? 50 : 0);
    cases.push({ p, n, w });
  }
  const js = cases.map(({ p, n, w }) => {
    const one = (f) => { try { return ["ok", f()]; } catch (e) { return ["err", e.message]; } };
    return [one(() => R.switchFrom(p)), one(() => R.rulerMode(w, p)), one(() => R.switchChange(p, n, w))];
  });
  const py = JSON.parse(PY(`
cases = json.load(sys.stdin)
def one(f):
    try:
        return ["ok", f()]
    except ValueError as e:
        return ["err", str(e)]
out = []
for c in cases:
    p, n, w = c["p"], c["n"], c["w"]
    out.append([one(lambda: V.switch_from(p)), one(lambda: V.ruler_mode(w, p)), one(lambda: V.switch_change(p, n, w))])
print(json.dumps(out))
`, JSON.stringify(cases)));
  assert.deepEqual(py, js);
});

test("tools/vhp-ruler-switch.mjs: OK for a first switch-on from next Monday, refused for this week", () => {
  const run = (...a) => { try { return { code: 0, out: execFileSync("node", [`${APP}/tools/vhp-ruler-switch.mjs`, ...a], { encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: String(e.stdout) }; } };
  const ok = run("7", "--week", "5");
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /week   6  Mon, 30 Nov 2026  now: off     after: shadow/);
  assert.match(ok.out, /week   7  Mon, 07 Dec 2026  now: off     after: on/);
  assert.match(ok.out, /^OK: /m);
  assert.equal(run("6", "--week", "5").code, 0);
  const no = run("5", "--week", "5");
  assert.equal(no.code, 1);
  assert.match(no.out, /REFUSED: .*week 5 has started and would change from off to on/);
});
