// Repo Lens #G-49: fix-check of #G-35 on PR A blockx-ruler @ 5e7670ee (main 7dafd0b5).
// Run from the PR A root: TZ=UTC node --import tsx --test --test-concurrency=1 /home/claude/g1/tests-g49/repolens-g49.test.mjs
// "confirm" tests pass at 5e7670ee (the G35 fixes hold); "G49-n" tests FAIL at 5e7670ee (new findings).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const APP = path.resolve(process.env.APP || ".");
const { R, timeline, timelineJson, X } = await import(path.join(APP, "tests/audit/blockx-ruler.fixture.mjs"));
const BR = await import(path.join(APP, "bot/blockx-ruler.ts"));
const dirs = [], tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "g49-")); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const yml = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8");
const py = (() => {
  const runs = JSON.parse(execFileSync("python3", ["-c", "import yaml,json,sys; w=yaml.safe_load(open(sys.argv[1])); print(json.dumps([s.get('run','') for j in w['jobs'].values() for s in j['steps']]))", path.join(APP, ".github/workflows/games.yml")], { encoding: "utf8" }));
  const sh = runs.find((r) => r.includes('"$IN/blockx" 2 "$PUB/blockx"'));
  return sh.slice(sh.indexOf("<<'PY'\n") + 7, sh.indexOf("\nPY\n") + 1);
})();
const GENESIS = 1792368000000, WEEK = 7 * 86400000, DAY = 86400000;
const TL = (() => { const f = path.join(tmp(), "tl.json"); fs.writeFileSync(f, timelineJson()); return f; })();
const write = (dir, name, obj) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), JSON.stringify(obj) + "\n"); };
function check(incoming, pub, { now, env = {}, tl = true }) {
  const held = path.join(tmp(), "held"); fs.writeFileSync(held, "");
  const r = spawnSync("python3", ["-I", "-", incoming, "2", pub, held, "blockx", "2400", "0", "12:1200:0:3"], { input: py, encoding: "utf8",
    env: { ...process.env, CHECK_NOW_MS: String(now), RULER_PY: path.join(APP, "vhp_ruler.py"), ...(tl ? { BLOCKX_RULER_TL: TL } : {}), ...env } });
  return { code: r.status, out: r.stdout + r.stderr, held: fs.readFileSync(held, "utf8").split("\n").filter(Boolean) };
}
const W4 = GENESIS + 4 * WEEK, T_X = W4 + DAY + 6 * 3600000 + 20 * 60000;
const signer = R.ledger(timeline()).signer(X);
const target = { round: Math.floor(X / 1200), height: X, final: true, checked: 2, signer, time: T_X, lockTime: T_X - 300000, card: null,
  picks: [["1W1111111111111111111111111111111", signer, T_X - 3600000, 250, 0]] };
const weekFile = { v: 1, week: 4, start: W4, end: W4 + WEEK, game: 12, targets: [target] };
const dayFile = (rulerFrom, mode, targets) => ({ v: 1, week: 4, day: 1, rulerFrom, mode, shadow: mode === "shadow", targets });
const index = (rulerFrom) => ({ v: 1, updated: "2026-11-18T00:00:00.000Z", weeks: [4], contract: null, game: 2, prizesFromWeek: null, rulerFrom });
const pubWith = (extra = {}) => { const p = tmp(); write(p, "W004.json", weekFile); for (const [k, v] of Object.entries(extra)) write(p, k, v); return p; };

test("confirm G35-1 / Q1: a waiting ('not yet') entry is re-made each run with a new note, and the publish lets it through (not held)", () => {
  const e1 = BR.entryFor({ to: X - 5000 }, target, 100, T_X + 3600000, null);
  const e2 = BR.entryFor({ to: X - 4000 }, target, 100, T_X + 7200000, e1);
  assert.equal(e1.card, null); assert.equal(e1.void, false); assert.notEqual(e1.note, e2.note, "the note changes every run");
  const inc = tmp(); write(inc, "X004-1.json", dayFile(5, "shadow", [e2]));
  const r = check(inc, pubWith({ "X004-1.json": dayFile(5, "shadow", [e1]), "index.json": index(5) }), { now: T_X + 7200000, env: { BLOCKX_RULER_FROM_WEEK: "5" } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held, [], r.out);
  // and a void (3-day) entry and a carded entry are kept as published
  const late = BR.entryFor({ to: X - 5000 }, target, 100, T_X + BR.RULER_WAIT_MS + 1, null);
  assert.deepEqual(BR.entryFor(null, target, 100, T_X + BR.RULER_WAIT_MS + 3600000, late), late);
});

test("confirm G35-2: the real sequence (unset in the shadow week publishes index.json rulerFrom null) keeps every later run publishing", () => {
  const e = BR.entryFor(R.ledger(timeline()), target, 100, T_X + 7200000, null);
  const pub = pubWith({ "X004-1.json": dayFile(5, "shadow", [e]), "index.json": index(5) });
  const inc = tmp(); write(inc, "index.json", index(null));
  const r4 = check(inc, pub, { now: W4 + 2 * DAY, env: { BLOCKX_RULER_FROM_WEEK: "" } });
  assert.equal(r4.code, 0, r4.out);
  const pub5 = pubWith({ "X004-1.json": dayFile(5, "shadow", [e]), "index.json": index(null) });
  const r5 = check(tmp(), pub5, { now: W4 + WEEK + 2 * DAY, env: { BLOCKX_RULER_FROM_WEEK: "" } });
  assert.equal(r5.code, 0, r5.out);
  // the code step has no if:, the data step keeps its if: and continue-on-error (G35-5)
  // (Bracket #285 merged second: one shared step "The VHP ruler's code and data (Block X and the Producer Bracket)", its
  // fetch tolerant in the step itself, as Repo Lens #G-48 G48-2 asked, instead of a separate step with continue-on-error)
  const code = yml.slice(yml.indexOf("- name: The VHP ruler's code and data (Block X and the Producer Bracket)"), yml.indexOf("cat > \"$RUNNER_TEMP/ruler-code/vhp_ruler.py\""));
  assert.doesNotMatch(code, /\n\s+if:/);
  const data = yml.slice(yml.indexOf("# END vhp_ruler.py"), yml.indexOf("- name: Push games-data (and nothing else)"));
  assert.match(data, /else\n\s+rm -rf "\$RUNNER_TEMP\/vhp-data"\n\s+echo "::warning::/);
  const rec = yml.slice(yml.indexOf("- name: Take the VHP ruler's data"), yml.indexOf("- name: Record Who Signs Block X"));
  assert.match(rec, /continue-on-error: true/);
});

test("confirm Q2: switch unset, no vhp-data: a stray day file is held alone (alert), nothing needs the ledger, the job exits 0", () => {
  const e = BR.entryFor(R.ledger(timeline()), target, 100, T_X + 7200000, null);
  const inc = tmp(); write(inc, "X004-1.json", dayFile(5, "shadow", [e])); write(inc, "index.json", index(null));
  const r = check(inc, pubWith({ "index.json": index(null) }), { now: W4 + 2 * DAY, env: { BLOCKX_RULER_FROM_WEEK: "", RULER_VHP_DATA: "" }, tl: false });
  assert.equal(r.code, 0, r.out);
  assert.ok(r.held.includes("blockx/X004-1.json"), r.out);
  assert.match(r.out, /wasn't made with the switch as set/);
});

test("confirm G35-4: shownPts gives the ruler entry's points for an entry it has (card: points / 0, void: 0, waiting: undefined)", () => {
  const js = fs.readFileSync(path.join(APP, "blockx.js"), "utf8");
  const src = js.slice(js.indexOf("let rulerOn = new Map();"), js.indexOf("function renderResults()"));
  const f = new Function(src + "; return { set: (m) => { rulerOn = m; }, shownPts };")();
  f.set(new Map([[1, { card: "c", void: false, signer: "S", points: 777 }], [2, { card: null, void: true, signer: "S", points: 0 }], [3, { card: null, void: false, signer: "S", points: 0 }]]));
  assert.equal(f.shownPts({ height: 1 }, ["p", "S", 0, 500, 0]), 777);
  assert.equal(f.shownPts({ height: 1 }, ["p", "B", 0, 0, 0]), 0);
  assert.equal(f.shownPts({ height: 2 }, ["p", "S", 0, 500, 0]), 0);
  assert.equal(f.shownPts({ height: 3 }, ["p", "S", 0, 500, 0]), undefined);
});

test("G49-1 (Medium): in an ON week a target voided by the 3-day wait (data missing or behind) raises no alert and not even a warning", () => {
  // No ledger for 3 days (the vhp-data fetch keeps failing, or vhp-data is behind): the entry waits, then is void for good.
  const waiting = BR.entryFor(null, target, 100, T_X + 3600000, null);
  const voided = BR.entryFor(null, target, 100, T_X + BR.RULER_WAIT_MS + 60000, waiting);
  assert.equal(voided.void, true); assert.equal(voided.card, null);
  const rec = fs.readFileSync(path.join(APP, "bot/games/blockx.ts"), "utf8");
  const block = rec.slice(rec.indexOf("// ── 3b-ruler."), rec.indexOf("/** In an ON week, a pick's points are the ruler's"));
  // the recorder's only report of an entry: a problem (a ::warning::, no email) when the note isn't "not yet ..."
  const m = block.match(/if \((!e\.card && e\.note && !\/\^not yet\/\.test\(e\.note\))\) problems\.push/);
  assert.ok(m, "the recorder's per-entry report line");
  const warns = new Function("e", `return ${m[1]};`)(voided);
  assert.equal(warns, true, "a target voided by the 3-day wait is not even a warning (its note still says 'not yet ...')");
  assert.match(block, /holds\.push/, "in an ON week, the ruler's data missing (or a 3-day void) should alert the owner (holds → held=true → the alert job emails)");
});

test("G49-2 (Low): index.json made with the previous switch (owner changes the variable during a run) stops the WHOLE publish (Bracket, Questions too)", () => {
  // The record job started with the switch unset; the owner set 6 before the publish job started (week 4: allowed).
  const inc = tmp(); write(inc, "index.json", index(null));
  const r = check(inc, pubWith({ "index.json": index(null) }), { now: W4 + 2 * DAY, env: { BLOCKX_RULER_FROM_WEEK: "6" } });
  assert.equal(r.code, 0, "should hold Block X's index.json (an alert), not stop every game's publish:\n" + r.out);
  assert.ok(r.held.includes("blockx/index.json"));
});

test("G49-3 (Low, display): in an ON week a target with no ruler entry on the page (day file held, or not fetched) shows the old ×5-rule points", () => {
  const js = fs.readFileSync(path.join(APP, "blockx.js"), "utf8");
  const src = js.slice(js.indexOf("let rulerOn = new Map();"), js.indexOf("function renderResults()"));
  const f = new Function(src + "; return { set: (m) => { rulerOn = m; }, shownPts };")();
  // the page knows this week is ON (another target of it has an entry), but target 9's day file isn't published (held)
  f.set(new Map([[1, { card: "c", void: false, signer: "S", points: 777 }]]));
  assert.equal(f.shownPts({ height: 9 }, ["p", "S", 0, 500, 0]), undefined, "an ON-week target the ruler hasn't scored on the page should show '…', not the W file's old-rule 5.00");
});
