// The ruler switch (owner, 11 Nov 2026; D-new, numbered by the Library): <GAME>_RULER_FROM_WEEK = N makes week N − 1 the
// shadow week and every week from N "on"; unset is "off". A change may never touch a week that has started.
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

test("switchChange: no week that has started changes method; a first switch-on gets a whole shadow week", () => {
  // this week is 4 (Week 1). Off -> on at 6: week 5 is the shadow week, nothing started changes.
  assert.equal(R.switchChange("", "6", 4), null);
  // off -> 5 during week 4 would make week 4 (already running) the shadow week: refused
  assert.match(R.switchChange("", "5", 4), /week 4 has started and would change from off to shadow; .* 6 or later/);
  // off -> 4 during week 4: refused (the current week would turn on)
  assert.match(R.switchChange(null, 4, 4), /week 3 has started and would change from off to shadow/);
  // unchanged is always fine
  assert.equal(R.switchChange("7", "7", 50), null);
  // moving a switch whose shadow week hasn't started: allowed, earlier or later, or back to unset
  assert.equal(R.switchChange("8", "9", 5), null);
  assert.equal(R.switchChange("9", "7", 5), null);
  assert.equal(R.switchChange("8", "", 5), null);
  // once the shadow week started, it can't be cancelled or moved
  assert.match(R.switchChange("8", "", 7), /week 7 has started and would change from shadow to off/);
  assert.match(R.switchChange("8", "10", 7), /week 7 has started and would change from shadow to off/);
  // once on, a game never goes back to its old method for a week already played
  assert.match(R.switchChange("6", "", 9), /week 5 has started and would change from shadow to off/);
  assert.match(R.switchChange("6", "12", 9), /would change/);
  assert.match(R.switchChange("6", "5", 9), /week 4 has started and would change from off to shadow/);
});

test("switchChange agrees with a week-by-week check of every started week (random cases)", () => {
  const r = rng(20261111), pick = () => (r() < 0.2 ? "" : String(1 + Math.floor(r() * 30)));
  for (let i = 0; i < 3000; i++) {
    const p = pick(), n = pick(), w = Math.floor(r() * 32);
    let want = true;
    for (let x = 0; x <= w; x++) if (R.rulerMode(x, p) !== R.rulerMode(x, n)) want = false;
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

test("tools/vhp-ruler-switch.mjs: OK for a first switch-on two weeks out, refused for next week", () => {
  const run = (...a) => { try { return { code: 0, out: execFileSync("node", [`${APP}/tools/vhp-ruler-switch.mjs`, ...a], { encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: String(e.stdout) }; } };
  const ok = run("7", "--week", "5");
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /week   6  Mon, 30 Nov 2026  now: off     after: shadow/);
  assert.match(ok.out, /week   7  Mon, 07 Dec 2026  now: off     after: on/);
  assert.match(ok.out, /^OK: /m);
  const no = run("6", "--week", "5");
  assert.equal(no.code, 1);
  assert.match(no.out, /REFUSED: .*week 5 has started and would change from off to shadow/);
});
