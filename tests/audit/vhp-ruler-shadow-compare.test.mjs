// tools/vhp-ruler-shadow-compare.mjs: the Ruler chat's read-only comparison of each game's ruler shadow against its old
// rule, for a vault week (the Mon 23 Nov review of Block X's and the Bracket's shadow week 4, and the Race).
// Race entries and Block X entries are made by the games' own code (bot/race-ruler.ts, bot/blockx-ruler.ts) on the
// made-up chain of race-ruler.fixture.mjs, so the shapes are the real ones; the old rule's files are written as the
// recorders write them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, P, chain, timeline, FROM, PRE, T_RACE } from "./race-ruler.fixture.mjs";
import * as RR from "../../bot/race-ruler.ts";
import * as BX from "../../bot/blockx-ruler.ts";
import { compareRace, compareBlockX, compareBracket, oldMultiplier, loadGames, render } from "../../tools/vhp-ruler-shadow-compare.mjs";

const L = R.ledger(timeline());
const HOUR = 3600000;
const S0 = (i) => FROM + PRE + i * 7200;
const rEntry = (i) => RR.entryForBlocks(L, new Date(T_RACE + i * 6 * HOUR).toISOString().slice(0, 13), T_RACE + i * 6 * HOUR, 0, [S0(i), S0(i) + 7199]);
const oldRace = (i, top) => ({ id: new Date(T_RACE + i * 6 * HOUR).toISOString().slice(0, 13), result: { final: true, winner: top[0], standings: top.map((a, j) => ({ a, steps: 1000 - j, blocks: 10 })) } });

test("shadow compare, Race: same winner and top three are counted; a difference says why", () => {
  const rf = { v: 1, week: 4, rulerFrom: 5, mode: "shadow", shadow: true, races: [0, 1, 2, 3].map(rEntry) };
  const ruled = rf.races.map((e) => e.placings);
  assert.ok(ruled.every((p) => p.length === 3), "the fixture's cards have a field of at least 3");
  const other = (pl) => P.filter((a) => !pl.includes(a))[0];
  const wf = { v: 1, week: 4, races: [oldRace(0, ruled[0]), oldRace(1, [ruled[1][1], ruled[1][0], ruled[1][2]]), oldRace(2, [other(ruled[2]), ruled[2][0], ruled[2][1]]), oldRace(3, [ruled[3][0], ruled[3][1], other(ruled[3])])] };
  const r = compareRace(wf, [{ name: "R004.json", file: rf }]);
  assert.equal(r.compared, 4);
  assert.equal(r.sameWinner, 2);
  assert.equal(r.sameTop3, 2);
  assert.equal(r.diffs.length, 3);
  const d = r.diffs.find((x) => x.id === rf.races[2].id);
  assert.match(d.why, /old winner/);
  assert.match(d.why, /fpct #\d|no entry|void|not on the card/);
  assert.match(r.diffs.find((x) => x.id === rf.races[3].id).why, /^same winner/);
});

test("shadow compare, Race: a race without a ruler card is 'not yet', a typed-race file has no old rule", () => {
  const rf = { v: 1, week: 4, rulerFrom: 5, mode: "shadow", shadow: true, races: [{ ...rEntry(0), card: null, placings: [], note: "not yet: x" }] };
  const wf = { v: 1, week: 4, races: [oldRace(0, [P[0], P[1], P[2]])] };
  const r = compareRace(wf, [{ name: "R004.json", file: rf }, { name: "R004-1.json", file: { ...rf, races: [rEntry(1)] } }]);
  assert.equal(r.compared, 0);
  assert.equal(r.notYet, 1);
  assert.equal(r.typedOnly, 1);
});

test("shadow compare, Block X: the old multiplier is min(cap, top ÷ signer's VHP), 2 decimals", () => {
  const t = Date.parse("2026-11-17T12:00:00Z");
  assert.equal(oldMultiplier({ top: 1000, signerVhp: 400 }, t), 2.5);
  assert.equal(oldMultiplier({ top: 1000, signerVhp: 1 }, t), 5);
  assert.equal(oldMultiplier(null, t), null);
});

test("shadow compare, Block X: per target, scored / void on each side, and the multipliers side by side", () => {
  const lead = 100, now = T_RACE + 20 * 86400000, targets = [], old = [];
  for (let i = 0; i < 6; i++) {
    const h = S0(1) + 600 * i, signer = chain.who[h - FROM], time = chain.ts[h - FROM];
    targets.push(BX.entryFor(L, { round: 500 + i, height: h, time, signer }, lead, now));
    old.push({ round: 500 + i, height: h, final: true, signer, time, card: i === 5 ? null : { top: 400e8, signerVhp: [400, 250, 200, 140, 1][P.indexOf(signer)] * 1e8 }, picks: [], ...(i === 5 ? { void: "no handicap card was recorded for this target's lock; no points" } : {}) });
  }
  assert.ok(targets.slice(0, 5).every((e) => e.card), "the fixture made the ruler cards");
  const day = { v: 1, week: 4, day: 0, rulerFrom: 5, mode: "shadow", shadow: true, targets };
  const r = compareBlockX({ v: 1, week: 4, targets: old }, [{ name: "X004-0.json", file: day }], BX);
  assert.equal(r.targets, 6);
  assert.equal(r.bothScored + r.bothVoid + r.rulerOnlyVoid + r.oldOnlyVoid + r.notYet, 6);
  assert.equal(r.oldOnlyVoid, 1);
  assert.equal(r.rows.filter((x) => x.ruler !== null && x.old !== null).length, r.bothScored);
  for (const x of r.rows) if (x.ruler !== null) assert.ok(x.ruler >= 1 && x.ruler <= 120, `ruler multiplier ${x.ruler} in [1, 120]`);
});

test("shadow compare, Bracket: per round, the ruler's winners against the day index's", () => {
  const summary = { v: 1, game: 9, week: 4, shadow: true, rulerFrom: 5, rulerMode: "shadow", cards: ["W004-R0.json", null], rounds: [[1, 2, 3, 4], [1, 3]], done: false, real: [[1, 2, 6, 4], [1]] };
  const r = compareBracket(summary, { seeding: { seeds: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"] } }, {});
  assert.equal(r.matchups, 6);
  assert.equal(r.same, 4);
  assert.equal(r.waiting, 1);
  assert.deepEqual(r.diffs.map((d) => [d.round, d.ruler, d.old]), [[1, 3, 6]]);
});

test("shadow compare: loadGames reads a week's files from games-data and race-data; render says what's missing", () => {
  const g = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-g-")), rd = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-r-"));
  try {
    fs.mkdirSync(path.join(g, "blockx")); fs.mkdirSync(path.join(g, "bracket", "ruler"), { recursive: true });
    fs.writeFileSync(path.join(g, "blockx", "W004.json"), JSON.stringify({ v: 1, week: 4, targets: [] }));
    fs.writeFileSync(path.join(rd, "W004.json"), JSON.stringify({ v: 1, week: 4, races: [] }));
    fs.writeFileSync(path.join(rd, "R004.json"), JSON.stringify({ v: 1, week: 4, races: [] }));
    const x = loadGames(g, rd, 4);
    assert.equal(x.race.r.length, 1);
    assert.equal(x.blockx.x.length, 0);
    assert.equal(x.bracket.summary, null);
    const text = render(4, { race: compareRace(x.race.w, x.race.r), blockx: null, bracket: null });
    assert.match(text, /Producer Race/);
    assert.match(text, /Block X: no ruler day files/);
    assert.match(text, /Bracket: no ruler summary/);
  } finally { fs.rmSync(g, { recursive: true, force: true }); fs.rmSync(rd, { recursive: true, force: true }); }
});

test("G86-1: a signer missing from the old card scored ×1 under the old rule, never 'nothing' or an infinite ratio", () => {
  const t = Date.parse("2026-11-17T12:00:00Z");
  assert.equal(oldMultiplier({ top: 1000, signerVhp: null }, t), 1);
  assert.equal(oldMultiplier({ top: 1000, signerVhp: 0 }, t), 1);
  const now = T_RACE + 20 * 86400000, h = S0(1), signer = chain.who[h - FROM], time = chain.ts[h - FROM];
  const e = BX.entryFor(L, { round: 700, height: h, time, signer }, 100, now);
  const r = compareBlockX({ v: 1, week: 4, targets: [{ round: 700, height: h, final: true, signer, time, card: { top: 400e8, signerVhp: null }, picks: [] }] }, [{ name: "X004-0.json", file: { targets: [e] } }], BX);
  assert.equal(r.bothScored, 1);
  assert.equal(r.rows[0].old, 1);
  assert.ok(Number.isFinite(r.medianRatio), `median ${r.medianRatio}`);
});
