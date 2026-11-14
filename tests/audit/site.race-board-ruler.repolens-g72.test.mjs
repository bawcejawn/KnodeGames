// Repo Lens #G-72 (PR #310 "Race lane boards: Winner = the Ruler's 1st in ruler weeks"): DOM-level checks of the
// 6-hour board for a finished race opened with "View", in a ruler (ON) week and in weeks without the Ruler.
// Needs race-dom-harness.mjs next to it. Run: TZ=UTC node --import tsx --test --test-concurrency=1 <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import * as H from "./race-dom-harness.mjs";

const APP = fileURLToPath(new URL("../../", import.meta.url));
const { A, Bp, C } = H;
const field = [[A, 100, 1], [Bp, 300, 0.5], [C, 50, 1.2]];
// Final steps: A has the most steps; the Ruler (in an ON week) puts B 1st.
const st = [{ a: A, steps: 30, blocks: 30, last: 1 }, { a: Bp, steps: 25, blocks: 50, last: 2 }, { a: C, steps: 10, blocks: 8, last: 3 }];
const prod = [{ a: A, void: false, signed: 5 }, { a: Bp, void: false, signed: 5 }, { a: C, void: false, signed: 5 }];
const ON_NOW = Date.parse("2026-11-16T07:00:00Z"), ON_RACE = "2026-11-16T00";           // vault week 4: Ruler ON
const SH_NOW = Date.parse("2026-11-14T19:00:00Z"), SH_RACE = "2026-11-14T12";           // vault week 3: shadow
const PR_NOW = Date.parse("2026-11-07T19:00:00Z"), PR_RACE = "2026-11-07T12";           // vault week 2: no Ruler at all

async function onWeek(r004, r003 = H.rulerFile(3, "shadow", 4, [])) {
  const files = { "W004.json": H.weekFile(4, ON_RACE, "2026-11-16T06", st, field), "R003.json": r003, "R004.json": r004 };
  const p = await H.boot({ app: APP, now: ON_NOW, files });
  await p.viewRace(ON_RACE);
  return p;
}
const stepsLeader = (p) => p.lanes().find((l) => l.a === A);
const noWinner = (p, why) => {
  assert.ok(p.lanes().length === 3, "three lanes drawn");
  assert.equal(p.lanes().filter((l) => l.win).length, 0, `${why}: no lane has the winner style`);
  assert.ok(!p.lanes().some((l) => /Winner/.test(l.gap)), `${why}: no lane says Winner`);
};

test("G72 #310 (1a): ON week, ruled: the Ruler's 1st is 'Winner (Ruler)' with the winner style; the steps leader says 'Most steps'", async () => {
  const p = await onWeek(H.rulerFile(4, "on", 4, [H.rulerEntry(ON_RACE, [Bp, A, C], prod)]));
  const L = p.lanes(), b = L.find((l) => l.a === Bp), a = stepsLeader(p);
  assert.match(b.gap, /^Winner \(Ruler\)/); assert.equal(b.win, true);
  assert.match(a.gap, /^Most steps/); assert.equal(a.win, false);
  assert.equal(L.filter((l) => l.win).length, 1);
  assert.match(p.note(), /Result \(Ruler\): 1st 1BBBB/);
  assert.deepEqual(p.errors, []);
});

test("G72 #310 (1b): ON week, the Ruler's files not loaded yet: no winner, 'Checking'", async () => {
  const files = { "W004.json": H.weekFile(4, ON_RACE, "2026-11-16T06", st, field), "R003.json": "hang", "R004.json": "hang" };
  const p = await H.boot({ app: APP, now: ON_NOW, files });
  await p.viewRace(ON_RACE);
  noWinner(p, "before load"); assert.match(stepsLeader(p).gap, /^Most steps/); assert.match(p.note(), /Checking/);
});

test("G72 #310 (1c): ON week, R004 failed (500): no winner, 'Checking'", async () => {
  const p = await onWeek("500");
  noWinner(p, "R004 500"); assert.match(p.note(), /Checking/);
});

test("G72 #310 (1d): ON week, R004 not published yet (404) while R003 says the Ruler is on from week 4: no winner", async () => {
  const p = await onWeek("404");
  noWinner(p, "R004 404"); assert.match(p.note(), /Checking/);
});

test("G72 #310 (1e): ON week, R004 has no entry for this race, or the entry has no card yet: no winner", async () => {
  noWinner(await onWeek(H.rulerFile(4, "on", 4, [])), "no entry");
  noWinner(await onWeek(H.rulerFile(4, "on", 4, [{ id: ON_RACE, card: "", placings: [] }])), "no card");
});

test("G72 #310 (2): ON week, every producer void (empty placings): no winner, and the note says so", async () => {
  const voids = prod.map((x) => ({ ...x, void: true }));
  const p = await onWeek(H.rulerFile(4, "on", 4, [H.rulerEntry(ON_RACE, [], voids)]));
  noWinner(p, "void field");
  assert.match(p.note(), /Every producer was void/);
});

test("G72 #310 (1f): a shadow week is not ruled: the steps leader is the Winner, nothing says (Ruler)", async () => {
  const files = { "W003.json": H.weekFile(3, SH_RACE, "2026-11-14T18", st, field), "R002.json": "404",
    "R003.json": H.rulerFile(3, "shadow", 4, [H.rulerEntry(SH_RACE, [Bp, A, C], prod)]) };
  const p = await H.boot({ app: APP, now: SH_NOW, files });
  await p.viewRace(SH_RACE);
  const a = stepsLeader(p);
  assert.match(a.gap, /^Winner/); assert.doesNotMatch(a.gap, /Ruler/); assert.equal(a.win, true);
  assert.doesNotMatch(p.note(), /Ruler/);
});

// Repo Lens #G-72 G72-1 (Low): the place number next to the name (and the screen-reader label) is the steps place.
// In a ruled, finished race the lane that says "Winner (Ruler)" is numbered 2 / "2nd" and the steps leader 1 / "1st",
// next to a note that says "Result (Ruler): 1st B". Fails at #310 fa66d194 ("1"), #311 and the -on-310 branch ("1st").
test("G72-1: ON week, ruled: the steps leader's lane is not numbered 1st (nor 'place 1'); the Ruler's 1st is not numbered 2nd", async () => {
  const p = await onWeek(H.rulerFile(4, "on", 4, [H.rulerEntry(ON_RACE, [Bp, A, C], prod)]));
  const a = stepsLeader(p), b = p.lanes().find((l) => l.a === Bp);
  assert.doesNotMatch(a.rank, /^1(st)?$/, `steps leader numbered ${a.rank}`);
  assert.doesNotMatch(a.aria, /place 1,/, a.aria);
  assert.doesNotMatch(b.rank, /^2(nd)?$/, `Ruler's 1st numbered ${b.rank}`);
});

// Repo Lens #G-72 G72-2 (Info): the page learns "the Ruler is on from week N" only from a loaded R file. If neither
// R<w-1> nor R<w> is there (both 404), an ON-week race falls back to the steps "Winner". Fails at fa66d194.
test("G72-2: ON week (vault week 4), no R file reachable (404s): still no steps 'Winner'", async () => {
  const p = await onWeek("404", "404");
  noWinner(p, "no R files");
});

// (3) Weeks without the Ruler: the board's text is the same as main's (snapshot taken from main 63c65f2e).
for (const [k, now, race, files] of [
  ["shadow", SH_NOW, SH_RACE, { "W003.json": H.weekFile(3, SH_RACE, "2026-11-14T18", st, field), "R003.json": H.rulerFile(3, "shadow", 4, [H.rulerEntry(SH_RACE, [Bp, A, C], prod)]) }],
  ["practice", PR_NOW, PR_RACE, { "W002.json": H.weekFile(2, PR_RACE, "2026-11-07T18", st, field) }],
]) test(`G72 #310 (3): ${k} week: the finished board reads the same as on main`, async () => {
  const p = await H.boot({ app: APP, now, files });
  await p.viewRace(race);
  const doc = p.doc, track = doc.getElementById("track");
  const gaps = Object.fromEntries([...track.querySelectorAll(".pr-lane[data-addr]")].map((l) => [l.dataset.addr, l.querySelector(".pr-gap").textContent]));
  const wins = [...track.querySelectorAll(".pr-lane.win")].map((l) => l.dataset.addr);
  assert.equal(wins.length, 1); assert.equal(wins[0], A, `${k}: the steps leader is the winner`);
  assert.deepEqual(gaps, { [A]: "Winner30.0 steps", [Bp]: "5.0 behind25.0 steps", [C]: "20.0 behind10.0 steps" }, k);
  assert.equal(doc.getElementById("track-note").textContent, "", `${k}: no note after the finish`);
});

// The weekly race runs Monday to Saturday, but its tab shows that week's race all through Sunday: a finished race on
// the typed board. Vault week 5 (types live), Sunday 29 Nov 2026, the weekly race W-2026-11-23 is over.
async function weeklySunday(r0054) {
  const now = Date.parse("2026-11-29T10:00:00Z"), ws = Date.parse("2026-11-23T00:00:00Z");
  const hours = []; for (let t = ws; t < ws + 6 * 86400000; t += 3600000) hours.push({ t, n: { [A]: 12, [Bp]: 4, [C]: 2 }, l: { [A]: t + 1000, [Bp]: t + 2000, [C]: t + 3000 }, c: [1, 1, 1, 1] });
  const blocks = (T) => { const ts = [], sig = []; for (let t = T - 7 * 3600000, i = 0; t <= T; t += 30000, i++) { ts.push(t); sig.push(i % 3); } return { ts, sig, signers: [A, Bp, C], from: 1, top: ts.length }; };
  const files = { "W005.json": { v: 1, week: 5, races: [] }, "T005.json": { v: 1, week: 5, races: [], hours }, "R004.json": H.rulerFile(4, "on", 4, []), "R005.json": H.rulerFile(5, "on", 4, []), "R005-4.json": r0054 };
  const p = await H.boot({ app: APP, now, files, vhp: { [A]: 100, [Bp]: 300, [C]: 200 }, blocks, type: 4 });
  await p.tick(6000);
  return p;
}
test("G72 #310 (1g): weekly board on Sunday (finished race, ON week, ruled): 'Winner (Ruler)' on the Ruler's 1st only", async () => {
  const p = await weeklySunday(H.rulerFile(5, "on", 4, [H.rulerEntry("W-2026-11-23", [Bp, A, C], prod)]));
  const L = p.typedLanes(), a = L.find((l) => l.a === A), b = L.find((l) => l.a === Bp);
  assert.equal(L.length, 3, JSON.stringify(L));
  assert.match(a.gap, /^Most steps/); assert.equal(a.win, false);
  assert.match(b.gap, /^Winner \(Ruler\)/); assert.equal(b.win, true);
  assert.match(p.doc.getElementById("rt-time").textContent, /Result \(Ruler\): 1st/);
});
test("G72 #310 (1h): weekly board on Sunday, R005-4 not in yet: no winner", async () => {
  const p = await weeklySunday("404");
  const L = p.typedLanes();
  assert.equal(L.length, 3); assert.ok(!L.some((l) => l.win || /Winner/.test(l.gap)), JSON.stringify(L));
});
test("G72-1 (typed): weekly board on Sunday, ruled: the steps leader is not numbered 1st", async () => {
  const p = await weeklySunday(H.rulerFile(5, "on", 4, [H.rulerEntry("W-2026-11-23", [Bp, A, C], prod)]));
  const a = p.typedLanes().find((l) => l.a === A);
  assert.doesNotMatch(a.rank, /^1(st)?$/, `steps leader numbered ${a.rank}`);
});
