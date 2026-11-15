// Fix 1 (owner, 14 Nov 2026: from Week 2 = vault week 5): a Ruler-week race doesn't need handicap cards. When GitHub
// skips the recorder for a whole 6-hour race, the race has no card. Before Fix 1 it was "missed" (no pick counted, and
// its 1-hour and 2-hour races too). From NOCARD_FROM_WEEK, in a week the ruler is ON, the recorder reads its blocks
// [S0, S1] and its picks on both nodes (no handicap standings), and the VHP ruler scores it as any other race. Before
// that week, or in a shadow / off week, nothing changes: it is missed, byte for byte as before. The publish job refuses
// a no-card race recorded any other way. Offline: the made-up chain of tests/audit/race-ruler.fixture.mjs.
// Run: node --import tsx --test tests/audit/race-nocard-ruler.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { M, R, P, timeline, node, vhpOf } from "./race-ruler.fixture.mjs";

const APP = process.env.APP || ".";
const RACE = await import(path.resolve(APP, "bot/race.ts"));
const { run } = RACE;
const yml = fs.readFileSync(path.join(APP, ".github/workflows/race.yml"), "utf8");
const U = (s) => Date.parse(s);
const dirs = [], tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-nocard-")); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const W1 = "1W1111111111111111111111111111111", W2 = "1W2222222222222222222222222222222", W3 = "1W3333333333333333333333333333333";
const LEDGER = R.ledger(timeline());
const TL_FILE = (() => { const f = path.join(tmp(), "tl.json"); fs.writeFileSync(f, JSON.stringify(timeline(), (k, v) => (typeof v === "bigint" ? v.toString() : v))); return f; })();
const RACE00 = M.raceIndex(U("2026-11-02T00:00Z")), H1_00 = M.typedIndex(1, U("2026-11-02T00:00Z"));
const read = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
async function go(at, prev, { rulerFrom = 2, noCardFrom, picks = [], typesFrom = null, typedPicks = [] } = {}) {
  const out = tmp(), log = console.log;
  console.log = () => {};
  try {
    await run({ p: node(at), check: node(at), prev, out, vhpOf, raceContract: "x", prizesFrom: 0, vaultHold: false, holdWeeks: [], typesFrom, rulerFrom, rulerLedger: LEDGER,
      picksOf: async (n, r, type = 0) => (type === 0 ? (r === RACE00 ? picks : []) : type === 1 && r === H1_00 ? typedPicks : []),
      stakedOf: async () => false, ...(noCardFrom === undefined ? {} : { noCardFrom }) });
  } finally { console.log = log; }
  return out;
}
/** GitHub skips the recorder from Sunday 17:37 to Monday 06:37: the Monday 00-06 race has no handicap card at all. */
async function skipped(opts) { const a = await go(U("2026-11-01T17:37Z"), "", opts); return go(U("2026-11-02T06:37Z"), a, opts); }
/** The same race recorded as usual (cards at 05:37), for comparison. */
async function usual(opts) { const a = await go(U("2026-11-02T05:37Z"), "", opts); return go(U("2026-11-02T06:37Z"), a, opts); }
const race00 = (d) => read(d, "W002.json").races.find((r) => r.id === "2026-11-02T00");
const entry00 = (d, f = "R002.json") => read(d, f).races.find((e) => e.id === (f === "R002.json" ? "2026-11-02T00" : "H1-2026-11-02T00"));

test("Fix 1: the recorder's and the publish job's first week are both 5 (vault week 5 = Week 2, Sun 22 Nov 7 PM ET)", () => {
  assert.equal(RACE.NOCARD_FROM_WEEK, 5);
  assert.match(yml, /\n {10}NOCARD_FROM_WEEK = 5   # = NOCARD_FROM_WEEK in bot\/race\.ts/);
  assert.match(yml, /NOCARD_FROM = int\(os\.environ\.get\("RACE_NOCARD_FROM"\) or NOCARD_FROM_WEEK\)/);
  assert.doesNotMatch(yml, /RACE_NOCARD_FROM:/, "the workflow never sets the tests' override");
});

test("before Fix 1's week (the default, 5): a no-card race is missed exactly as before, even in an ON week", async () => {
  const d = await skipped({ picks: [[W1, P[0], 10]] });
  assert.deepEqual(race00(d).cards.filter(Boolean), [], "the skip left the race with no card");
  assert.deepEqual(race00(d).result, { final: true, missed: true, note: "no handicap card was recorded for this race" });
  assert.equal(entry00(d), undefined, "no ruler entry");
  assert.deepEqual(read(d, "board.json").week.rows, [], "nothing counts");
});

test("Fix 1 off the ruler: a shadow or off week still marks a no-card race missed", async () => {
  for (const rulerFrom of [3, null]) {
    const d = await skipped({ rulerFrom, noCardFrom: 2, picks: [[W1, P[0], 10]] });
    assert.equal(race00(d).result.missed, true, `ruler from ${rulerFrom}`);
  }
});

test("Fix 1 on: the no-card race is recorded from its blocks and picks, and the ruler scores it exactly as if it had cards", async () => {
  const base = entry00(await usual({}));
  const [first, , third] = base.placings, rest = P.filter((a) => !base.placings.includes(a));
  const picks = [[W1, first, 10], [W2, third, 11], [W3, rest[0], 12]];
  const ok = await usual({ picks }), d = await skipped({ noCardFrom: 2, picks });
  const r = race00(d).result, want = race00(ok).result;
  assert.deepEqual(race00(d).cards.filter(Boolean), []);
  assert.deepEqual(r.heights, want.heights, "the race's own blocks [S0, S1], as a recorded race has them");
  assert.deepEqual({ final: r.final, checked: r.checked, blocks: r.blocks, line: r.line, winner: r.winner, standings: r.standings }, { final: true, checked: 2, blocks: want.blocks, line: null, winner: null, standings: [] }, "no handicap standings");
  assert.deepEqual(r.picks, picks.map(([a, b, t]) => [a, b, t, 0, 0, 0]), "the picks, read on both nodes, with no handicap win or show");
  const e = entry00(d);
  assert.deepEqual(e, base, "the ruler's entry (window, card, placings) is the one a carded race gets");
  const rows = read(d, "board.json").week.rows, row = (w) => rows.find((x) => x.a === w);
  assert.deepEqual([row(W1).pts, row(W1).correct], [3, 1], "a pick on the ruler's 1st is a win");
  assert.deepEqual([row(W2).pts, row(W2).shows], [1, 1], "a pick on its 3rd is a show");
  assert.equal(row(W3)?.pts ?? 0, 0);
  assert.deepEqual(rows.map((x) => [x.a, x.pts]), read(ok, "board.json").week.rows.map((x) => [x.a, x.pts]), "the same board as the carded race");
});

test("Fix 1 on: the week's re-check before a payout scores the no-card race again from the chain and agrees", async () => {
  const d = await skipped({ noCardFrom: 2, picks: [[W1, P[0], 10]] });
  const at = U("2026-11-02T06:37Z"), p = node(at), h = await p.getHeadInfo();
  const picksRead = async (n, r, type = 0) => (type === 0 && r === RACE00 ? [[W1, P[0], 10]] : []);
  const ctx = { p, check: node(at), headId: "0xhead", libH: Number(h.last_irreversible_block), libT: at - 180000, picksRead };
  const wf = read(d, "W002.json");
  assert.equal(await RACE.verifyWeek({ ...wf, races: wf.races.filter((x) => x.id === "2026-11-02T00") }, ctx, 120000), "");
  const bad = structuredClone(wf); bad.races.find((x) => x.id === "2026-11-02T00").result.heights[1] += 1;
  assert.match(await RACE.verifyWeek({ ...bad, races: bad.races.filter((x) => x.id === "2026-11-02T00") }, ctx, 120000), /2026-11-02T00/);
});

test("Fix 1 on, with the race types: the hours of a no-card race go in the ledger with no luck trims; its 1-hour race is scored by the ruler, not missed", async () => {
  const typedPicks = [[W1, P[0], 10]];
  const off = await skipped({ typesFrom: 2, typedPicks });
  const h1off = read(off, "T002.json").races.find((r) => r.id === "H1-2026-11-02T00");
  assert.deepEqual(h1off.result, { final: true, missed: true, note: "an hour of this race has no handicap card" }, "before Fix 1's week: missed as before");
  const d = await skipped({ typesFrom: 2, noCardFrom: 2, typedPicks });
  const tf = read(d, "T002.json"), hr = tf.hours.find((x) => x.t === U("2026-11-02T00:00Z"));
  assert.ok(hr, "the hour is in the ledger");
  assert.deepEqual(hr.c, [0, 0, 0, 0], "no luck trims: there is no card to tune them from");
  const ok = await usual({ typesFrom: 2 }), hok = read(ok, "T002.json").hours.find((x) => x.t === hr.t);
  assert.deepEqual([hr.a, hr.b, hr.n, hr.l], [hok.a, hok.b, hok.n, hok.l], "the same blocks as a carded hour");
  const h1 = tf.races.find((r) => r.id === "H1-2026-11-02T00").result;
  assert.deepEqual({ ...h1, picks: undefined }, { final: true, checked: 2, line: null, winner: null, standings: [], picks: undefined });
  assert.deepEqual(h1.picks, [[W1, P[0], 10, 0, 0, 0]]);
  const e = entry00(d, "R002-1.json");
  assert.ok(e && e.card, "the ruler's card for the 1-hour race");
  assert.deepEqual(e, entry00(ok, "R002-1.json"), "the same entry a carded hour gives");
});

// ── the publish job ──
const publishSh = (() => {
  const step = yml.split("- name: Push race-data (and nothing else)")[1];
  return step.split("\n        run: |\n")[1].split("\n").filter((l) => l.startsWith("          ") || l === "").map((l) => l.slice(10)).join("\n");
})();
function publish(incoming, bare, now, extra = {}) {
  const env = { ...process.env, IN: incoming, GH_TOKEN: "t", GITHUB_REPOSITORY: "o/r", RUNNER_TEMP: tmp(), RACE_CHECK_NOW: String(now / 1000), CHECK_NOW_MS: String(now), RACE_PRIZES_FROM: "0",
    RULER_PY: path.resolve(APP, "vhp_ruler.py"), RACE_RULER_TL: TL_FILE,
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: `url.${bare}.insteadOf`, GIT_CONFIG_VALUE_0: "https://x-access-token:t@github.com/o/r.git", ...extra };
  try { return { ok: true, out: execFileSync("bash", ["-c", publishSh], { cwd: tmp(), env, stdio: "pipe" }).toString() }; }
  catch (e) { return { ok: false, out: String(e.stdout) + String(e.stderr) }; }
}
const bareRepo = () => { const b = tmp(); execFileSync("git", ["init", "-q", "--bare", b]); return b; };
const published = (bare, f) => { try { return execFileSync("git", ["--git-dir", bare, "show", `race-data:${f}`], { stdio: "pipe" }).toString(); } catch { return null; } };
/** A bare repo where the switch was set to 2 during week 1 (so an ON week 2 isn't a refused mid-week switch change). */
function onRepo() {
  const b = bareRepo(), w1 = tmp();
  fs.writeFileSync(path.join(w1, "R001.json"), JSON.stringify({ v: 1, week: 1, rulerFrom: 2, mode: "shadow", shadow: true, races: [] }) + "\n");
  const s = publish(w1, b, U("2026-10-31T12:00Z"), { RACE_RULER_FROM_WEEK: "2" });
  assert.ok(s.ok, s.out);
  return b;
}
const NOW = U("2026-11-02T06:40Z");

test("publish: a no-card race recorded by Fix 1 publishes in its week; before NOCARD_FROM, or with standings, it is refused", async () => {
  const d = await skipped({ noCardFrom: 2, picks: [[W1, P[0], 10]] });
  const b = onRepo(), r = publish(d, b, NOW, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2" });
  assert.ok(r.ok, r.out); assert.doesNotMatch(r.out, /Fix 1|W002\.json held|R002\.json \(VHP ruler\) held/, r.out);
  assert.ok(JSON.parse(published(b, "W002.json")).races.find((x) => x.id === "2026-11-02T00").result.heights, "W002.json published with the no-card race");
  assert.ok(published(b, "R002.json"), "and the ruler's file");
  // the workflow's own week (5): week 2 is before it, so the same files are refused
  const r5 = publish(d, onRepo(), NOW, { RACE_RULER_FROM_WEEK: "2" });
  assert.equal(r5.ok, false); assert.match(r5.out, /no handicap card is recorded only from NOCARD_FROM/);
  // handicap standings on a no-card race: refused
  const t = tmp(); fs.cpSync(d, t, { recursive: true });
  const wf = read(t, "W002.json"), x = wf.races.find((y) => y.id === "2026-11-02T00");
  x.result.standings = [{ a: P[0], steps: 1, blocks: 1 }]; x.result.winner = P[0]; x.result.picks = x.result.picks.map((p) => [p[0], p[1], p[2], p[1] === P[0] ? 1 : 0, 0, 0]);
  fs.writeFileSync(path.join(t, "W002.json"), JSON.stringify(wf) + "\n");
  const rs = publish(t, onRepo(), NOW, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2" });
  assert.equal(rs.ok, false); assert.match(rs.out, /no handicap card is recorded only from NOCARD_FROM/);
});

test("publish: a T file with a no-card hour publishes in Fix 1's week; before it, it is held alone (the 6-hour files still publish)", async () => {
  const d = await skipped({ typesFrom: 2, noCardFrom: 2 });
  const b = onRepo(), r = publish(d, b, NOW, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2", RACE_TYPES_FROM: "2" });
  assert.ok(r.ok, r.out); assert.doesNotMatch(r.out, /T002\.json \(race types\) held/, r.out);
  assert.ok(published(b, "T002.json"));
  // the same T file, with a typed race given handicap standings over the no-card hour: held alone
  const t = tmp(); fs.cpSync(d, t, { recursive: true });
  const tf = read(t, "T002.json"), h1 = tf.races.find((y) => y.id === "H1-2026-11-02T00");
  const hr = tf.hours.find((y) => y.t === h1.start);
  h1.result.standings = Object.entries(hr.n).map(([a, n]) => ({ a, steps: 0, blocks: n }));
  fs.writeFileSync(path.join(t, "T002.json"), JSON.stringify(tf) + "\n");
  const b2 = onRepo(), r2 = publish(t, b2, NOW, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2", RACE_TYPES_FROM: "2" });
  assert.ok(r2.ok, r2.out); assert.match(r2.out, /T002\.json \(race types\) held.*no handicap standings \(Fix 1\)/);
  assert.equal(published(b2, "T002.json"), null);
  // a ledger hour over a no-card race with luck trims: held alone
  const t3 = tmp(); fs.cpSync(d, t3, { recursive: true });
  const tf3 = read(t3, "T002.json"); tf3.hours.find((y) => y.t === h1.start).c = [1, 1, 1, 1];
  fs.writeFileSync(path.join(t3, "T002.json"), JSON.stringify(tf3) + "\n");
  const r3 = publish(t3, onRepo(), NOW, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2", RACE_TYPES_FROM: "2" });
  assert.ok(r3.ok, r3.out); assert.match(r3.out, /T002\.json \(race types\) held.*ledger hour with no handicap card/);
});

// ── Repo Lens #G-75 G75-1: a failure after a successful vhp-data download (the checkout) is soft and loud ──
function stepRun(name) {
  const i = yml.indexOf(`- name: ${name}`), rest = yml.slice(i), lines = rest.slice(rest.indexOf("run: |\n") + 7).split("\n");
  const ind = lines[0].match(/^ */)[0], out = [];
  for (const l of lines) { if (l.trim() && !l.startsWith(ind)) break; out.push(l.slice(ind.length)); }
  return out.join("\n");
}
/** A source repo with a vhp-data branch holding d/0.json, and a runner folder where that file is already there
 *  (untracked), so the fetch works and the checkout refuses to overwrite it. */
function checkoutFails(script) {
  const t = tmp(), src = path.join(t, "src");
  execFileSync("git", ["init", "-q", "-b", "vhp-data", src]);
  fs.mkdirSync(path.join(src, "d")); fs.writeFileSync(path.join(src, "d", "0.json"), "{}\n");
  execFileSync("git", ["-C", src, "add", "d"]); execFileSync("git", ["-C", src, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"]);
  fs.mkdirSync(path.join(t, "vhp-data", "d"), { recursive: true }); fs.writeFileSync(path.join(t, "vhp-data", "d", "0.json"), "local\n");
  const s = script.replaceAll('"https://github.com/${GITHUB_REPOSITORY}.git"', `"${src}"`);
  const p = spawnSync("bash", ["-c", s], { env: { ...process.env, RUNNER_TEMP: t, GITHUB_REPOSITORY: "x/y" }, encoding: "utf8" });
  return { ...p, t };
}
test("G75-1: the record step: a checkout that fails after the download leaves an empty data folder and a warning (exit 0)", () => {
  const r = checkoutFails(stepRun("Take the VHP ruler's data"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::The VHP ruler's data \(vhp-data\) downloaded but didn't unpack this run: races are recorded/);
  assert.deepEqual(fs.readdirSync(path.join(r.t, "vhp-data")).filter((f) => f !== ".git"), [], "nothing half-unpacked: loadLedger fails, the ruler's cards wait");
});
test("G75-1: the publish step's fetch lines: the same failure, under its set -euo pipefail, doesn't stop the step", () => {
  const all = yml.split("\n"), k = all.findIndex((l) => l.includes("# Capacity (14 Nov): a download hiccup holds only the ruler's files"));
  const block = ["set -euo pipefail", 'git init -q "$RUNNER_TEMP/vhp-data"', ...all.slice(k + 1, k + 6).map((l) => l.trim()), 'echo "after"'].join("\n");
  const r = checkoutFails(block);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::The VHP ruler's data \(vhp-data\) downloaded but didn't unpack this run \(G75-1\): the ruler's files are held/);
  assert.match(r.stdout, /after/);
  assert.deepEqual(fs.readdirSync(path.join(r.t, "vhp-data")).filter((f) => f !== ".git"), []);
});

test("Repo Lens #G-87 F1-1: a card added later to a race published final with no card is refused (the paid week would never re-check)", async () => {
  const d = await skipped({ noCardFrom: 2, picks: [[W1, P[0], 10]] });
  const b = onRepo(), r = publish(d, b, NOW, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2" });
  assert.ok(r.ok, r.out);
  const before = published(b, "W002.json");
  // a bad or stale run: the same race with the card a usual run takes at 05:37 (inside its leg)
  const cards = race00(await usual({})).cards, i = cards.findIndex(Boolean);
  assert.ok(i >= 0, "the usual run took a card");
  const t = tmp(); fs.cpSync(d, t, { recursive: true });
  const wf = read(t, "W002.json"); wf.races.find((y) => y.id === "2026-11-02T00").cards[i] = cards[i];
  fs.writeFileSync(path.join(t, "W002.json"), JSON.stringify(wf) + "\n");
  const r2 = publish(t, b, NOW + 60000, { RACE_RULER_FROM_WEEK: "2", RACE_NOCARD_FROM: "2" });
  assert.equal(r2.ok, false); assert.match(r2.out, /a card added to a race published final with no card \(Fix 1\)/);
  assert.equal(published(b, "W002.json"), before, "nothing published");
});
