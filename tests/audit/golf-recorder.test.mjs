// Block Golf recorder (bot/games/golf.ts): the course from games.json, each hole from that game's own published
// results, the question game (answers and who is ranked) read on two nodes, kept standings when a game's files move
// on, final holes that stay final, the 12-hour wait, the 60-hour deadline, frozen final weeks, a broken history that
// stops the run, practice weeks and the leaderboards. Offline: fake result files and a fake question game.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP = process.env.APP || ".";
const { run, sourcesFromGames, stakersFrom, minStakeFor, vaultFile, peakOf, peakedFrom, parseHoldWeeks, cleanScore, cleanName, statusLines } = await import(path.resolve(APP, "bot/games/golf.ts"));
const G = globalThis.KGolf;
const M = globalThis.KRaceMath;
const H = 3600000, DAY = 24 * H;

const P = Array.from({ length: 12 }, (_, i) => "1" + "ABCDEFGHJKLMNPQRSTUVWXYZ"[i].repeat(33));
const FREE = "1" + "a".repeat(33);
const W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
// The publish checks use their own clock (CHECK_NOW_MS in the tests; the workflow never sets it): by default a week
// after the test week, so every test week has ended. Tests about the clock set their own.
process.env.CHECK_NOW_MS ??= String(END + 7 * DAY);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, name, j) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), JSON.stringify(j)); };
const SOURCES = [
  { id: "questions", name: "Daily Questions", reader: "questions", live: true },
  { id: "race", name: "Producer Race", reader: "race", live: true },
  { id: "blockx", name: "Who Signs Block X", reader: "blockx", live: true },
];

/** Race files for week W: board with this week's rows (P0 best … P9) and races final or not. vaultFinal: the Race's
 *  own vault file for the week (race-data/vault/W<w>.json) is final (Repo Lens G-3); by default, when the races are. */
function raceDir({ week = W, final = true, rows = null, vaultFinal = final } = {}) {
  const d = tmp("race-");
  const r = rows ?? P.slice(0, 10).map((a, i) => ({ a, pts: 30 - 3 * i, correct: 10 - i, shows: 0, picks: 20, answers: 0, points: 0, ranked: true }));
  r.push({ a: FREE, pts: 100, correct: 30, shows: 0, picks: 30, answers: 0, points: 0, ranked: false });
  write(d, "board.json", { v: 1, updated: "", today: { rows: [] }, week: { week, start: M.weekStart(week), rows: r }, lastWeek: null, allTime: { rows: [] } });
  const races = [];
  for (let t = M.weekStart(week); t < M.weekStart(week + 1); t += M.RACE) races.push({ id: "x", start: t, end: t + M.RACE, cards: [], result: { final } });
  write(d, `W00${week}.json`, { v: 1, week, start: M.weekStart(week), end: M.weekStart(week + 1), races });
  write(path.join(d, "vault"), `W${week}.json`, { game: 7, week, final: vaultFinal, rows: [], first: [], second: [], skipped: [] });
  return d;
}
/** games-data: Block X board for week W as its "lastWeek" (final or not) or "week". */
function gamesDir({ last = false, final = false, rows = null } = {}) {
  const d = tmp("games-");
  const r = rows ?? P.slice(0, 8).map((a, i) => ({ a, place: i + 1, pts: 800 - 100 * i, correct: 8 - i, picks: 10, days: 3, lastCorrect: 0, ranked: true }));
  const view = { week: W, start: START, rows: r, ...(last ? { final, prizes: [] } : {}) };
  write(path.join(d, "blockx"), "board.json", { v: 1, updated: "", today: { rows: [] }, week: last ? { week: W + 1, start: END, rows: [] } : view, lastWeek: last ? view : null, allTime: { rows: [] } });
  return d;
}
const qWeek = ({ closed = true, resolved = 30 } = {}) => ({ closed, questions: 30, resolved, rows: P.slice(2, 9).map((a, i) => ({ a, pts: 20 - 2 * i, answered: 25, counted: 25 })).sort((x, y) => (x.a < y.a ? -1 : 1)) });
/** A previous run's index, so the course already holds the three games from week W (as after a first run in W). */
function seeded() { const d = tmp("golf-prev-"); write(d, "index.json", { v: 1, updated: "", weeks: [], course: { questions: W, race: W, blockx: W }, stakedFromWeek: 0 }); return d; }
// Staked rules (ranked field, 5 per hole) unless a test says otherwise; practice weeks have their own test.
/** Block Golf stakes for the tests: a Map of whole VHP (2 each unless given, so 5 players make the 10-VHP minimum). */
const vhp = (list, each = 2) => new Map(list.map((a) => [a, typeof each === "function" ? each(a) : each]));
const stakers = async (_node, who) => vhp(who.filter((a) => a !== FREE));   // everyone but FREE: 2 VHP in Block Golf
const base = (o) => ({ sources: SOURCES, questionsOf: async () => qWeek(), golfStakersOf: stakers, p: "main", check: "check", stakedFromWeek: 0, ...(o.prev === undefined && !o.fresh ? { prev: seeded() } : {}), ...o });
const readOut = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const holeOf = (dir, id, w = 3) => readOut(dir, `W00${w}.json`).holes.find((h) => h.id === id);
const FINAL_GAMES = () => gamesDir({ last: true, final: true });


// The weekly rhythm (WEEK_CYCLE.md): a week goes final only when two runs at least an hour apart read it the same.
// settle() runs the recorder at o.now and again an hour later (the second run reads the first run's files).
async function settle(o) {
  const mid = tmp("golf-");
  await run({ ...o, out: mid });
  return run({ ...o, prev: mid, now: o.now + H });
}

test("mid-week, first run: every live game joins at once; live holes and scorecards", async () => {
  const out = tmp("golf-");
  const r = await run(base({ fresh: true, now: START + 3 * DAY, out, raceDir: raceDir(), gamesDir: gamesDir() }));
  const wf = readOut(out, "W003.json");
  assert.deepEqual(wf.holes.map((h) => [h.id, h.status]), [["questions", "live"], ["race", "live"], ["blockx", "live"]]);
  assert.equal(wf.final, false);
  assert.equal(wf.practice, false);
  const p0 = wf.cards.find((c) => c.a === P[0]);
  assert.equal(p0.holes.find((x) => x[0] === "questions")[1], 7, "didn't play the question game: lost ball");
  assert.equal(p0.mulligan, "questions", "the mulligan drops the worst hole of any kind: here the missed game (owner, 6 Nov)");
  // The free race wallet (100 pts, unranked) beats the ranked field: hole in one, but it isn't in the field
  const free = wf.cards.find((c) => c.a === FREE);
  assert.equal(free.holes.find((x) => x[0] === "race")[1], 1);
  assert.equal(free.ranked, false);
  assert.deepEqual(readOut(out, "index.json").course, { questions: W, race: W, blockx: W });
  const board = readOut(out, "board.json");
  assert.equal(board.week.week, W);
  assert.equal(board.week.rows.length, wf.cards.length);
  assert.deepEqual(board.allTime.rows, [], "all time counts final weeks only");
  assert.deepEqual(Object.keys(board.week.rows[0]).sort(), ["a", "boardPlace", "holes", "lost", "place", "pts", "ranked", "strokes", "topar"]);
  assert.equal(r.problems.length, 0);
});

test("a game that goes live later joins from the next Monday; one that leaves keeps its joining week", async () => {
  const prev = tmp("golf-");
  await run(base({ fresh: true, now: START + DAY, out: prev, raceDir: raceDir(), gamesDir: gamesDir(), sources: SOURCES.map((s) => ({ ...s, live: s.id !== "blockx" })) }));
  const out = tmp("golf-");
  await run(base({ now: START + 2 * DAY, prev, out, raceDir: raceDir(), gamesDir: gamesDir() }));
  assert.deepEqual(readOut(out, "index.json").course, { questions: W, race: W, blockx: W + 1 });
  assert.deepEqual(readOut(out, "W003.json").holes.map((h) => h.id), ["questions", "race"]);
  // The race leaves games.json for a run (audit M2): it stays on this week's card and keeps its joining week
  const out2 = tmp("golf-");
  await run(base({ now: START + 3 * DAY, prev: out, out: out2, raceDir: raceDir(), gamesDir: gamesDir(), sources: SOURCES.map((s) => ({ ...s, live: s.id !== "race" })) }));
  assert.deepEqual(readOut(out2, "W003.json").holes.map((h) => h.id), ["questions", "race"]);
  assert.equal(readOut(out2, "index.json").course.race, W);
});

test("the weekly rhythm: pending until Monday 00:00 UTC, final after two matching runs an hour apart; then frozen (D-125)", async () => {
  const prev = tmp("golf-");
  await run(base({ now: START + 2 * DAY, out: prev, raceDir: raceDir(), gamesDir: gamesDir() }));
  // Sunday, the review day: the week hasn't ended, so it is pending however final the games look
  const sun = tmp("golf-");
  await run(base({ now: END - 2 * H, prev, out: sun, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(readOut(sun, "W003.json").final, false, "nothing goes final on Sunday");
  assert.equal(readOut(sun, "W003.json").check, null);
  // Monday 00:00: every hole final; the first matching run only stamps the check
  const out = tmp("golf-");
  await run(base({ now: END, prev: sun, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const first = readOut(out, "W003.json");
  assert.equal(first.final, false, "one run is not enough");
  assert.match(first.check.sig, /^[0-9a-f]{64}$/);
  assert.equal(first.check.at, END);
  // 30 minutes later, same reading: still waiting (the runs must be an hour apart)
  const half = tmp("golf-");
  await run(base({ now: END + H / 2, prev: out, out: half, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(readOut(half, "W003.json").final, false);
  assert.deepEqual(readOut(half, "W003.json").check, first.check, "the first stamp is kept while the reading matches");
  // An hour after the first stamp, same reading: final, and the check is cleared
  const out2 = tmp("golf-");
  await run(base({ now: END + H, prev: half, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const wf = readOut(out2, "W003.json");
  assert.equal(wf.final, true);
  assert.equal(wf.check, null);
  assert.ok(wf.holes.every((h) => h.status === "final"));
  const board = readOut(out2, "board.json");
  assert.equal(board.lastWeek.final, true);
  assert.ok(board.allTime.rows.length > 0);
  const out3 = tmp("golf-");
  await settle(base({ now: END + 30 * H, prev: out2, out: out3, raceDir: raceDir({ rows: [] }), gamesDir: gamesDir({ last: true, final: true, rows: [] }), questionsOf: async () => ({ ...qWeek(), rows: [] }) }));
  assert.deepEqual(readOut(out3, "W003.json"), wf, "a final week never changes");
});

test("two-run check: a reading that changes between runs starts the check again", async () => {
  // The question game can't be read: skipped at the 60-hour deadline; from 66 hours the read problem stops holding
  // the week, so the 67-hour run stamps the check with the hole skipped.
  const failing = async () => { throw new Error("node down"); };
  const p = tmp("golf-");
  await run(base({ now: END + 61 * H, out: p, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  const a = tmp("golf-");
  await run(base({ now: END + 67 * H, prev: p, out: a, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  const first = readOut(a, "W003.json");
  assert.equal(first.final, false, "one run is not enough");
  assert.equal(holeOf(a, "questions").status, "skipped");
  // An hour later the question game reads final again: the week reads differently, so not final and a new stamp
  const b = tmp("golf-");
  await run(base({ now: END + 68 * H, prev: a, out: b, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const second = readOut(b, "W003.json");
  assert.equal(holeOf(b, "questions").status, "final");
  assert.equal(second.final, false, "the reading changed");
  assert.notEqual(second.check.sig, first.check.sig);
  assert.equal(second.check.at, END + 68 * H);
  // Another hour with the same reading: final
  const c = tmp("golf-");
  await run(base({ now: END + 69 * H, prev: b, out: c, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(readOut(c, "W003.json").final, true);
});

test("a hole that was final stays final, even if a later run can't read it (audit H2)", async () => {
  const prev = tmp("golf-");
  // 13 h after: Block X and questions final, the race still waiting on a race
  await settle(base({ now: END + 13 * H, out: prev, raceDir: raceDir({ final: false }), gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(prev, "blockx").status, "final");
  assert.equal(readOut(prev, "W003.json").final, false);
  // 61 h after: the games-data files couldn't be read this run and the question game fails
  const out = tmp("golf-");
  const r = await settle(base({ now: END + 61 * H, prev, out, raceDir: raceDir({ final: false }), gamesDir: tmp("empty-"), questionsOf: async () => { throw new Error("node down"); } }));
  assert.equal(holeOf(out, "blockx").status, "final", "kept");
  assert.equal(holeOf(out, "questions").status, "final", "kept");
  // Repo Lens G-3: the Race never finalized its own week, so at the deadline the Race hole is skipped, not guessed
  assert.equal(holeOf(out, "race").status, "skipped");
  assert.match(holeOf(out, "race").why, /weren't final in time/);
  // Every hole is final or skipped, and the failed re-reads of the final holes keep their standings: final
  assert.equal(readOut(out, "W003.json").final, true);
  assert.match(r.problems.join("\n"), /couldn't read it again; its final standings are kept/);
  assert.ok(readOut(out, "W003.json").cards.every((c) => c.holes.length === 2), "the two kept holes (the skipped Race hole isn't on a card)");
});

test("the question game: nodes that disagree on answers, an unfinished week, the scoring", async () => {
  const out = tmp("golf-");
  await settle(base({ now: END + 20 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(),
    questionsOf: async (node) => (node === "check" ? { ...qWeek(), rows: qWeek().rows.slice(1) } : qWeek()) }));
  assert.match(holeOf(out, "questions").why, /don't agree/);
  assert.equal(readOut(out, "W003.json").final, false);
  const out2 = tmp("golf-");
  await settle(base({ now: END + 20 * H, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: async () => qWeek({ resolved: 29 }) }));
  assert.equal(holeOf(out2, "questions").status, "live", "a question still unresolved");
  const out3 = tmp("golf-");
  await settle(base({ now: END + 20 * H, out: out3, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out3, "questions").status, "final");
  assert.equal(holeOf(out3, "questions").field, 7);
  assert.equal(readOut(out3, "W003.json").cards.find((x) => x.a === P[2]).holes.find((x) => x[0] === "questions")[1], 1);
});

test("practice weeks read nothing about who is ranked: every scorer counts with weight 1 (Repo Lens G-4)", async () => {
  // A practice week whose readings never change goes final, and every hole row carries weight 1
  const out = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 20 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(),
    golfStakersOf: async () => { throw new Error("stakes must not be read in practice"); } }));
  const wf = readOut(out, "W003.json");
  assert.equal(wf.final, true);
  assert.ok(wf.holes.every((h) => h.rows.every((r) => r[3] === 1)), "weight 1 for every scorer");
  assert.deepEqual(wf.notFree, [], "nobody is staked in a practice week");
  assert.ok(wf.cards.every((c) => c.free === true && c.ranked === false));
});

test("the Questions hole: answering at least one question is playing it; no correct answer = 6 strokes, not a lost ball (owner, 6 Nov)", async () => {
  const rows = [
    { a: P[0], pts: 5, answered: 9, counted: 9 },
    { a: P[1], pts: 0, answered: 9, counted: 9 },     // played, nothing right
    { a: P[2], pts: 1, answered: 3, counted: 1 },
    { a: P[3], pts: 1, answered: 2, counted: 2 },
    { a: P[4], pts: 2, answered: 2, counted: 2 },
    { a: P[5], pts: 0, answered: 1, counted: 0 },     // one answer on a voided question: still played
  ];
  const out = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 20 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: async () => ({ ...qWeek(), rows }) }));
  const h = holeOf(out, "questions");
  assert.deepEqual(h.rows.map((r) => r[0]).sort(), P.slice(0, 6).sort(), "everyone who answered is on the hole");
  const wf = readOut(out, "W003.json");
  const strokes = (a) => wf.cards.find((c) => c.a === a).holes.find((x) => x[0] === "questions")[1];
  assert.equal(strokes(P[1]), 6, "played, nothing right: 6");
  assert.equal(strokes(P[5]), 6);
  assert.ok(wf.cards.filter((c) => !P.slice(0, 6).includes(c.a)).every((c) => c.holes.find((x) => x[0] === "questions")[1] === 7), "didn't answer: lost ball");
});

test("a question game that can't be read is skipped at the 60-hour deadline, never guessed", async () => {
  const failing = async () => { throw new Error("node down"); };
  const out = tmp("golf-");
  await run(base({ now: END + 59 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  assert.equal(holeOf(out, "questions").status, "live");
  const out2 = tmp("golf-");
  await run(base({ now: END + 61 * H, prev: out, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  assert.equal(holeOf(out2, "questions").status, "skipped");
  assert.match(holeOf(out2, "questions").why, /weren't final in time/);
  assert.equal(readOut(out2, "W003.json").final, false, "not final in a run that had a read problem");
  const out3 = tmp("golf-");
  await run(base({ now: END + 62 * H, prev: out2, out: out3, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  const wf = readOut(out3, "W003.json");
  assert.equal(wf.final, false, "still a read problem");
  // A later run that can read it again (the week isn't final yet) scores the hole after all
  const out4 = tmp("golf-");
  await settle(base({ now: END + 63 * H, prev: out3, out: out4, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out4, "questions").status, "final");
  assert.equal(readOut(out4, "W003.json").final, true);
});

test("a game's board that moved on: the standings kept from the last run are used", async () => {
  const prev = tmp("golf-");
  await run(base({ now: END - H, out: prev, raceDir: raceDir(), gamesDir: gamesDir() }));
  const rd = raceDir();
  const b = JSON.parse(fs.readFileSync(path.join(rd, "board.json"), "utf8"));
  b.week.week = W + 1;
  fs.writeFileSync(path.join(rd, "board.json"), JSON.stringify(b));
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, prev, out, raceDir: rd, gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out, "race").status, "final");
  assert.equal(holeOf(out, "race").rows.length, 11);
  // never read before it moved on: skipped, not guessed
  const out2 = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: out2, raceDir: rd, gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out2, "race").status, "skipped");
});

test("a hole needs 5 ranked players who scored; a player who scored nothing gets a double bogey", async () => {
  const out = tmp("golf-");
  const four = P.slice(0, 4).map((a, i) => ({ a, place: i + 1, pts: 10 - i, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: true }));
  const zeros = P.slice(4, 12).map((a) => ({ a, place: 5, pts: 0, correct: 0, picks: 3, days: 1, lastCorrect: 0, ranked: true }));
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: [...four, ...zeros] }) }));
  const bx = holeOf(out, "blockx");
  assert.equal(bx.status, "skipped", "8 idle wallets don't make up the field (audit H5)");
  assert.match(bx.why, /less than 10 VHP of Block Golf stake/);
  const out2 = tmp("golf-");
  const five = P.slice(0, 5).map((a, i) => ({ a, place: i + 1, pts: 10 - i, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: true }));
  await settle(base({ now: END + 13 * H, out: out2, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: [...five, ...zeros.slice(1)] }) }));
  const wf = readOut(out2, "W003.json");
  assert.equal(holeOf(out2, "blockx").field, 5);
  assert.equal(wf.cards.find((c) => c.a === P[6]).holes.find((x) => x[0] === "blockx")[1], 6);
  assert.equal(wf.cards.find((c) => c.a === P[4]).holes.find((x) => x[0] === "blockx")[1], 6, "5th of 5");
});

test("practice weeks (before the first staked week): every player who scored counts and 3 make a hole", async () => {
  const few = [P[0], P[1], FREE].map((a, i) => ({ a, place: i + 1, pts: 30 - 10 * i, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: a !== FREE }));
  const out = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 13 * H, out, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: few }) }));
  const wf = readOut(out, "W003.json");
  assert.equal(wf.practice, true);
  assert.equal(holeOf(out, "blockx").status, "final");
  assert.equal(holeOf(out, "blockx").field, 3, "the free wallet is in the practice field");
  assert.equal(readOut(out, "index.json").stakedFromWeek, null);
  const r = wf.cards.find((c) => c.a === P[0]).holes.find((x) => x[0] === "race");
  assert.deepEqual([r[2], r[3]], [2, 11], "the free race wallet counts in practice");
  const out2 = tmp("golf-");
  await settle(base({ stakedFromWeek: W, now: END + 13 * H, out: out2, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: few }) }));
  assert.equal(readOut(out2, "W003.json").practice, false);
  assert.equal(holeOf(out2, "blockx").status, "skipped");
  const out3 = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 13 * H, out: out3, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: few.slice(0, 2) }) }));
  assert.match(holeOf(out3, "blockx").why, /fewer than 3 players scored/);
});

test("a history that exists but can't be read stops the run instead of starting over (audit H1)", async () => {
  const prev = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: prev, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  fs.writeFileSync(path.join(prev, "index.json"), "{not json");
  await assert.rejects(run(base({ now: END + 14 * H, prev, out: tmp("golf-"), raceDir: raceDir(), gamesDir: FINAL_GAMES() })), /can't be read/);
  const prev2 = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: prev2, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  fs.rmSync(path.join(prev2, "W003.json"));
  await assert.rejects(run(base({ now: END + 14 * H, prev: prev2, out: tmp("golf-"), raceDir: raceDir(), gamesDir: FINAL_GAMES() })), /can't be read/);
});

test("files that are links are ignored", async () => {
  const gd = gamesDir();
  const evil = tmp("evil-");
  write(evil, "board.json", { v: 1, week: { week: W, rows: [{ a: P[0], pts: 999, ranked: true }] } });
  fs.rmSync(path.join(gd, "blockx", "board.json"));
  fs.symlinkSync(path.join(evil, "board.json"), path.join(gd, "blockx", "board.json"));
  const out = tmp("golf-");
  await run(base({ now: START + DAY, out, raceDir: raceDir(), gamesDir: gd }));
  assert.equal(holeOf(out, "blockx").rows.length, 0);
});

test("games.json: games with a reader become sources, with their live flag; Block Golf itself never does", () => {
  const d = tmp("gj-");
  const f = path.join(d, "games.json");
  fs.writeFileSync(f, JSON.stringify({ v: 1, games: [
    { id: "race", name: "Producer Race", status: "live" }, { id: "questions", name: "Daily Questions", status: "live" },
    { id: "blockx", name: "Who Signs Block X", status: "soon" }, { id: "golf", name: "Block Golf", status: "live" },
    { id: "mystery", name: "?", status: "live" } ] }));
  assert.deepEqual(sourcesFromGames(f).map((s) => [s.id, s.live]), [["race", true], ["questions", true], ["blockx", false]]);
  assert.ok(sourcesFromGames(path.join(APP, "games.json")).every((s) => s.id !== "golf"));
});

test("a whole week: points add up and places are consistent", async () => {
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const wf = readOut(out, "W003.json");
  for (const c of wf.cards) {
    assert.equal(c.holes.length, 3);
    const counted = c.holes.filter((x) => x[0] !== c.mulligan);
    assert.equal(c.strokes, counted.reduce((s, x) => s + x[1], 0));
    assert.equal(c.par, 8);
    assert.equal(c.pts, 14 - c.strokes);
  }
  for (let i = 1; i < wf.cards.length; i++) assert.ok(wf.cards[i].pts <= wf.cards[i - 1].pts);
});

/** The publish job's two checks, taken from the workflow file (shape, then history). */
function checks() {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/golf.yml"), "utf8");
  return [...y.matchAll(/<<'PY'\n([\s\S]*?)\n\s*PY\n/g)].map((m) => {
    const f = path.join(tmp("chk-"), "check.py");
    fs.writeFileSync(f, m[1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n"));
    return f;
  });
}
const copyDir = (from) => { const d = tmp("copy-"); fs.cpSync(from, d, { recursive: true }); return d; };

test("the publish job's shape check accepts the recorder's files and refuses tampered ones", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape] = checks();
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  await run(base({ now: END + 2 * DAY, prev: out, out, raceDir: raceDir({ week: W + 1 }), gamesDir: gamesDir() }));
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8" }), /golf files ok/);
  const bad = copyDir(out);
  const wf = readOut(bad, "W003.json"); wf.cards[0].holes[0][1] = 8; write(bad, "W003.json", wf);
  assert.throws(() => execFileSync("python3", [shape, bad], { stdio: "pipe" }), "8 strokes");
  const bad2 = copyDir(out);
  const b = readOut(bad2, "board.json"); b.week.rows.push({ a: P[0], place: 1, pts: 1, topar: 0, strokes: 1, holes: 1, lost: 0, ranked: true, html: "<b>" }); write(bad2, "board.json", b);
  assert.throws(() => execFileSync("python3", [shape, bad2], { stdio: "pipe" }), "stray key");
  const bad3 = copyDir(out);
  const w3 = readOut(bad3, "W003.json"); w3.start += 1; write(bad3, "W003.json", w3);
  assert.throws(() => execFileSync("python3", [shape, bad3], { stdio: "pipe" }), "start not the week's");
});

test("the publish job's clock (RECORDER_STANDARD §3.1): no final before the week ends, no future weeks or stamps", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape] = checks();
  const at = (ms) => ({ ...process.env, CHECK_NOW_MS: String(ms) });
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8", env: at(END + 14 * H) }), /golf files ok/);
  // The same files seen by a publish clock still inside the week: a final week that hasn't ended is refused
  assert.throws(() => execFileSync("python3", [shape, out], { stdio: "pipe", env: at(END - H) }), /final before the week ended|sent before its week ended/);
  // A week file and an index week from more than a week ahead
  const fut = copyDir(out);
  const idx = readOut(fut, "index.json"); idx.weeks.push(W + 3); write(fut, "index.json", idx);
  assert.throws(() => execFileSync("python3", [shape, fut], { stdio: "pipe", env: at(END + 14 * H) }), /from the future/);
  // A pending week's check stamp from the future, or from before the week ended
  const p = tmp("golf-");
  await run(base({ now: END, out: p, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.match(execFileSync("python3", [shape, p], { encoding: "utf8", env: at(END + H / 2) }), /golf files ok/);
  assert.throws(() => execFileSync("python3", [shape, p], { stdio: "pipe", env: at(END - 1) }), /check stamp outside its time|final before/);
  const early = copyDir(p);
  const wf = readOut(early, "W003.json"); wf.check.at = END - H; write(early, "W003.json", wf);
  assert.throws(() => execFileSync("python3", [shape, early], { stdio: "pipe", env: at(END + H) }), /check stamp outside its time/);
});

test("the publish job's history check: final weeks can't change, weeks only grow, joining weeks stay", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [, history] = checks();
  assert.ok(history, "the workflow has the history check");
  const old = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: old, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const next = tmp("golf-");
  await run(base({ now: END + 2 * DAY, prev: old, out: next, raceDir: raceDir({ week: W + 1 }), gamesDir: gamesDir() }));
  assert.match(execFileSync("python3", [history, next, old], { encoding: "utf8" }), /golf history ok/);
  const b1 = copyDir(next); const w = readOut(b1, "W003.json"); w.cards[0].pts += 1; write(b1, "W003.json", w);
  assert.throws(() => execFileSync("python3", [history, b1, old], { stdio: "pipe" }), "final week changed");
  const b2 = copyDir(next); const i = readOut(b2, "index.json"); i.weeks = []; write(b2, "index.json", i);
  assert.throws(() => execFileSync("python3", [history, b2, old], { stdio: "pipe" }), "weeks shrank");
  const b3 = copyDir(next); const i3 = readOut(b3, "index.json"); i3.course.race = 9; write(b3, "index.json", i3);
  assert.throws(() => execFileSync("python3", [history, b3, old], { stdio: "pipe" }), "joining week changed");
  // A first publish (empty branch) that carries a final week is refused: nothing published ever checked it (G-5)
  assert.throws(() => execFileSync("python3", [history, next, tmp("none-")], { stdio: "pipe" }), /final without an earlier run's check/);
  const fresh = tmp("golf-");
  await run(base({ now: START + DAY, out: fresh, raceDir: raceDir(), gamesDir: gamesDir() }));
  assert.match(execFileSync("python3", [history, fresh, tmp("none-")], { encoding: "utf8" }), /golf history ok/, "first publish, nothing final");
});

test("the publish job's history check: a week turns final only after an earlier published check (Repo Lens G-5)", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [, history] = checks();
  const at = (ms) => ({ ...process.env, CHECK_NOW_MS: String(ms) });
  // The published parent: the week stamped at END; the new files: the week final an hour later
  const parent = tmp("golf-");
  await run(base({ now: END, out: parent, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const fin = tmp("golf-");
  await run(base({ now: END + H, prev: parent, out: fin, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(readOut(fin, "W003.json").final, true);
  assert.match(execFileSync("python3", [history, fin, parent], { encoding: "utf8", env: at(END + H + 60000) }), /golf history ok/);
  // The parent's stamp is less than an hour old by the publish job's own clock: refused
  assert.throws(() => execFileSync("python3", [history, fin, parent], { stdio: "pipe", env: at(END + H - 60000) }), /an hour or more ago/);
  // What turns final isn't what the parent checked (a card changed after the stamp): refused
  const forged = copyDir(fin); const wf = readOut(forged, "W003.json"); wf.cards[0].pts += 1; write(forged, "W003.json", wf);
  assert.throws(() => execFileSync("python3", [history, forged, parent], { stdio: "pipe", env: at(END + 2 * H) }), /isn't what the earlier run checked/);
  // The parent had no check at all: refused
  const bare = copyDir(parent); const pw = readOut(bare, "W003.json"); pw.check = null; write(bare, "W003.json", pw);
  assert.throws(() => execFileSync("python3", [history, fin, bare], { stdio: "pipe", env: at(END + 2 * H) }), /final without an earlier run's check/);
});

test("a read problem that never clears stops holding the week back 66 hours after it ends (fix-check N1)", async () => {
  const failing = async () => { throw new Error("node down"); };
  let prev = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: prev, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  for (const h of [61, 65]) {
    const out = tmp("golf-");
    await run(base({ now: END + h * H, prev, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
    assert.equal(readOut(out, "W003.json").final, false, `${h} h`);
    prev = out;
  }
  const out = tmp("golf-");
  const r = await settle(base({ now: END + 67 * H, prev, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), questionsOf: failing }));
  const wf = readOut(out, "W003.json");
  assert.equal(wf.final, true);
  assert.equal(holeOf(out, "questions").status, "skipped");
  assert.match(r.problems.join(" "), /made final despite read problems/);
});

test("practice or staked is fixed when a week is first recorded (fix-check N2)", async () => {
  const prev = tmp("golf-");
  await run(base({ stakedFromWeek: null, now: START + DAY, out: prev, raceDir: raceDir(), gamesDir: gamesDir() }));
  assert.equal(readOut(prev, "W003.json").practice, true);
  const out = tmp("golf-");
  await run(base({ stakedFromWeek: W, now: START + 2 * DAY, prev, out, raceDir: raceDir(), gamesDir: gamesDir() }));
  assert.equal(readOut(out, "W003.json").practice, true, "set mid-week: this week stays practice");
  assert.equal(readOut(out, "index.json").stakedFromWeek, W);
});

test("the publish job's history check: the first staked week can't change once set", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [, history] = checks();
  const old = tmp("golf-");
  await run(base({ stakedFromWeek: 5, now: START + DAY, out: old, raceDir: raceDir(), gamesDir: gamesDir() }));
  const next = copyDir(old);
  const i = readOut(next, "index.json"); i.stakedFromWeek = 4; write(next, "index.json", i);
  assert.throws(() => execFileSync("python3", [history, next, old], { stdio: "pipe" }));
  const same = copyDir(old);
  assert.match(execFileSync("python3", [history, same, old], { encoding: "utf8" }), /golf history ok/);
});

test("staked weeks: a hole's field is the players staked in Block Golf who scored (owner, 2026-10-28)", async () => {
  // Only P0–P4 are staked in Block Golf; everyone on the race board is ranked there, but that no longer matters
  const golfers = new Set(P.slice(0, 5));
  const only = async (_n, who) => vhp(who.filter((a) => golfers.has(a)));
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: only }));
  const wf = readOut(out, "W003.json");
  assert.equal(holeOf(out, "race").field, 5, "the 5 golfers, not the 10 ranked race players");
  assert.equal(holeOf(out, "questions").status, "skipped", "only P2–P4 staked among the question players: 3 < 5");
  const p4 = wf.cards.find((c) => c.a === P[4]).holes.find((x) => x[0] === "race");
  assert.deepEqual([p4[1], p4[2], p4[3]], [6, 5, 5], "last of the 5 golfers");
  const p6 = wf.cards.find((c) => c.a === P[6]);
  assert.equal(p6.ranked, false, "not staked in Block Golf: free-play board");
  assert.equal(p6.holes.find((x) => x[0] === "race")[3], 6, "placed as one more player");
  assert.equal(wf.cards.find((c) => c.a === P[0]).ranked, true);
  // Practice weeks don't read stakes at all
  const out2 = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 13 * H, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: async () => { throw new Error("must not be read"); } }));
  assert.equal(readOut(out2, "W003.json").final, true);
});

test("staked weeks: stakes that can't be read, or that the nodes disagree on, keep the last flags and hold the week", async () => {
  const prev = tmp("golf-");
  await run(base({ now: END - H, out: prev, raceDir: raceDir(), gamesDir: gamesDir() }));
  const out = tmp("golf-");
  const r = await settle(base({ now: END + 13 * H, prev, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: async () => { throw new Error("rpc down"); } }));
  assert.equal(readOut(out, "W003.json").final, false);
  assert.match(r.problems.join(" "), /Block Golf stakes: rpc down/);
  assert.equal(holeOf(out, "race").field, 10, "last run's flags stand");
  const out2 = tmp("golf-");
  const r2 = await settle(base({ now: END + 13 * H, prev, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: async (n, who) => vhp(n === "check" ? who.slice(1) : who) }));
  assert.equal(readOut(out2, "W003.json").final, false);
  assert.match(r2.problems.join(" "), /don't agree on who is staked/);
});

test("staked weeks need the vault (v6) ABI, which main now has (fix-check S2)", async () => {
  // The guard refused staked weeks while the game ABI had no get_game_player. Vault v6 is live and its ABI is on
  // main, so the guard must find it; the guard itself stays in the recorder.
  const abi = JSON.parse(fs.readFileSync(path.join(APP, "game/abi/kpred.koilib.json"), "utf8"));
  assert.ok(abi.methods && abi.methods.get_game_player, "main's game ABI has get_game_player");
  const src = fs.readFileSync(path.join(APP, "bot/games/golf.ts"), "utf8");
  assert.match(src, /GOLF_STAKED_FROM_WEEK is set but the vault \(v6\) isn't live here/);
});

test("staked weeks: a hole is final only with stakes read after the week ended (fix-check S1)", async () => {
  const all = async (_n, who) => vhp(who.filter((a) => a !== FREE));
  const five = async (_n, who) => vhp(who.filter((a) => P.slice(0, 5).includes(a)));
  const prev = tmp("golf-");
  await run(base({ now: END - H, out: prev, raceDir: raceDir(), gamesDir: gamesDir(), golfStakersOf: all }));
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, prev, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: async () => { throw new Error("rpc down"); } }));
  assert.equal(holeOf(out, "race").status, "live", "no final hole on flags read during the week");
  assert.match(holeOf(out, "race").why, /Block Golf stakes/);
  const out2 = tmp("golf-");
  await settle(base({ now: END + 14 * H, prev: out, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: five }));
  assert.equal(readOut(out2, "W003.json").final, true);
  assert.equal(holeOf(out2, "race").field, 5, "the stakes after the week ended");
  // Stakes never readable: skipped at 66 h, not scored on old flags
  let p = prev;
  for (const h of [13, 61, 67, 68]) {   // 68: the second matching run an hour after 67
    const o2 = tmp("golf-");
    await run(base({ now: END + h * H, prev: p, out: o2, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: async () => { throw new Error("rpc down"); } }));
    p = o2;
  }
  const wf = readOut(p, "W003.json");
  assert.equal(wf.final, true);
  assert.ok(wf.holes.every((h) => h.status === "skipped"));
  assert.match(wf.holes[0].why, /couldn't be read in time/);
});

test("staked weeks: the Block Golf stakes alone decide who counts (fix-check S3)", async () => {
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(readOut(out, "W003.json").final, true);
  assert.ok(holeOf(out, "questions").rows.every((r) => r[3] === (r[0] === FREE ? 0 : 2)), "weights are the Block Golf stakes");
});

test("the Vault's file: a final staked week gets vault/W<week>.json with the Block Golf stakers' points (hand-off 2026-10-28)", async (t) => {
  const golfers = async (_n, who) => vhp(who.filter((a) => P.slice(0, 6).includes(a)));
  const out = tmp("golf-");
  await run(base({ now: END - H, out, raceDir: raceDir(), gamesDir: gamesDir(), golfStakersOf: golfers }));
  assert.ok(!fs.existsSync(path.join(out, "vault")), "nothing before the week is final");
  await settle(base({ now: END + 13 * H, prev: out, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: golfers }));
  const v = readOut(path.join(out, "vault"), "W3.json");
  const wf = readOut(out, "W003.json");
  assert.equal(v.game, 6); assert.equal(v.week, 3); assert.equal(v.final, true);
  // first/second: the Free play board (not staked in Block Golf) top, from the week's cards (D-081)
  const free = wf.cards.filter((c) => !c.ranked && c.pts >= 1);
  assert.ok(free.length > 0);
  assert.ok(v.first.length >= 1 && v.first.every((a) => free.some((c) => c.a === a)));
  assert.ok(v.first.every((a) => !v.rows.some((r) => r.player === a)), "a wallet is staked or free, never both");
  const want = wf.cards.filter((c) => P.slice(0, 6).includes(c.a) && c.pts >= 1).map((c) => c.a).sort();
  assert.deepEqual(v.rows.map((r) => r.player).sort(), want, "only Block Golf stakers with 1+ points");
  for (const r of v.rows) assert.equal(r.points, wf.cards.find((c) => c.a === r.player).pts);
  for (let i = 1; i < v.rows.length; i++) assert.ok(v.rows[i].points <= v.rows[i - 1].points);
  // Practice weeks: no vault file
  const out2 = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 13 * H, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(readOut(out2, "W003.json").final, true);
  assert.ok(!fs.existsSync(path.join(out2, "vault")));
  // The publish checks accept it, and refuse a changed vault file once sent
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape, history] = checks();
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8" }), /golf files ok/);
  const bad = copyDir(out); const bv = readOut(path.join(bad, "vault"), "W3.json"); bv.rows[0].points = 256; write(path.join(bad, "vault"), "W3.json", bv);
  assert.throws(() => execFileSync("python3", [shape, bad], { stdio: "pipe" }), "points over 255");
  const bad2 = copyDir(out); const b2 = readOut(path.join(bad2, "vault"), "W3.json"); b2.rows[0].points = b2.rows[0].points === 1 ? 2 : 1; write(path.join(bad2, "vault"), "W3.json", b2);
  assert.throws(() => execFileSync("python3", [shape, bad2], { stdio: "pipe" }), "rows must match the week's cards (fix-check V4)");
  const next = copyDir(out); const nv = readOut(path.join(next, "vault"), "W3.json"); nv.rows.pop(); write(path.join(next, "vault"), "W3.json", nv);
  assert.throws(() => execFileSync("python3", [history, next, out], { stdio: "pipe" }), "a sent week can't change");
  assert.match(execFileSync("python3", [history, copyDir(out), out], { encoding: "utf8" }), /golf history ok/);
});

test("staked weeks count VHP: a hole needs 10 VHP among its scorers, and a big staker can't void other holes (fix-check V2)", async () => {
  // P0 has 1,000 VHP in Block Golf and plays only the race; Block X's 7 scorers hold 2 VHP each = 14 VHP: still a hole
  const big = async (_n, who) => vhp(who.filter((a) => a !== FREE), (a) => (a === P[0] ? 1000 : 2));
  const bxRows = P.slice(1, 8).map((a, i) => ({ a, place: i + 1, pts: 70 - 10 * i, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: true }));
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: bxRows }), golfStakersOf: big }));
  assert.equal(holeOf(out, "blockx").status, "final");
  assert.equal(holeOf(out, "race").rows.find((r) => r[0] === P[0])[3], 1000, "the weight stored is the whole VHP staked");
  // 4 scorers at 2 VHP = 8 VHP: too small
  const out2 = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: out2, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: bxRows.slice(0, 4) }), golfStakersOf: big }));
  assert.match(holeOf(out2, "blockx").why, /less than 10 VHP/);
});

test("nobody staked: the vault file has empty rows, and the run says so (handoff 2026-10-29)", async () => {
  const nobody = async () => new Map();
  const out = tmp("golf-");
  const r = await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: nobody }));
  assert.equal(readOut(out, "W003.json").final, true);
  const v = readOut(path.join(out, "vault"), "W3.json");
  assert.deepEqual(v, { game: 6, week: 3, final: true, rows: [], first: [], second: [] });
  assert.match(r.problems.join(" "), /vault file has no rows/);
  try { execFileSync("python3", ["--version"]); } catch { return; }
  const [shape] = checks();
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8" }), /golf files ok/);
});

test("who counts as staked in Block Golf: the Vault's week_stake against that week's minimum (handoff 2026-10-29)", () => {
  const V = 100000000n;
  const cfg = { min_stake: String(V), min_stake_next: String(2n * V), min_stake_next_week: "5" };
  assert.equal(minStakeFor(cfg, 4), V);
  assert.equal(minStakeFor(cfg, 5), 2n * V, "a new minimum applies from its first week");
  assert.equal(minStakeFor({ min_stake: "0" }, 4), V, "never under 1 VHP");
  const reads = [
    { a: P[0], weekStake: String(5n * V) },          // 5 VHP all week
    { a: P[1], weekStake: String(V + V / 2n) },      // withdrew mid-week down to 1.5 VHP: counted at its lowest, 1 whole VHP
    { a: P[2], weekStake: "0" },                     // withdrew everything: not staked that week
    { a: P[3], weekStake: String(V / 2n) },          // under the minimum
    { a: P[4], weekStake: String(V) },
  ];
  const w4 = stakersFrom(reads, cfg, 4);
  assert.deepEqual([...w4], [[P[0], 5], [P[1], 1], [P[4], 1]]);
  const w5 = stakersFrom(reads, cfg, 5);
  assert.deepEqual([...w5], [[P[0], 5]], "from week 5 the minimum is 2 VHP");
});

test("vault rows: only Block Golf stakers (a player staked in another game is left out), ties keep equal points", async () => {
  // P6 is ranked on the race board (it holds VHP or stakes elsewhere) but has no Block Golf stake
  const golfers = async (_n, who) => vhp(who.filter((a) => a !== FREE && a !== P[6]));
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: golfers }));
  const v = readOut(path.join(out, "vault"), "W3.json");
  const wf = readOut(out, "W003.json");
  assert.ok(wf.cards.some((c) => c.a === P[6]), "P6 still has a scorecard (Free play board)");
  assert.ok(!v.rows.some((r) => r.player === P[6]), "but isn't in the vault rows");
  // ties: equal golf points stay equal in the file
  const t = vaultFile({ week: 3, cards: [
    { a: P[0], ranked: true, pts: 9 }, { a: P[1], ranked: true, pts: 9 }, { a: P[2], ranked: true, pts: 4 },
    { a: P[3], ranked: false, pts: 12 }, { a: P[4], ranked: true, pts: 0 }, { a: P[5], ranked: true, pts: 300 } ] });
  assert.deepEqual(t.rows, [{ player: P[5], points: 255 }, { player: P[0], points: 9 }, { player: P[1], points: 9 }, { player: P[2], points: 4 }]);
});

test("Free play winners in the vault file: ties share, 2nd only if 1st is untied, over 10 tied left empty (D-081)", () => {
  const c = (a, pts, ranked = false, lost = 0, under = 0, best = 3, free = !ranked) => ({ a, ranked, free, pts, lost, under, best });
  const P2 = Array.from({ length: 14 }, (_, i) => "1" + "ABCDEFGHJKLMNPQ"[i].repeat(33));
  // untied 1st, two tied for 2nd; a staked player above them is not on the Free play board
  let v = vaultFile({ week: 5, cards: [c(P2[0], 20, true), c(P2[1], 15), c(P2[2], 12), c(P2[3], 12), c(P2[4], 9), c(P2[5], 0)] });
  assert.deepEqual(v.rows, [{ player: P2[0], points: 20 }]);
  assert.deepEqual(v.first, [P2[1]]);
  assert.deepEqual(v.second, [P2[2], P2[3]].sort());
  // tied 1st: they share, no 2nd
  v = vaultFile({ week: 5, cards: [c(P2[1], 15), c(P2[2], 15), c(P2[3], 12)] });
  assert.deepEqual(v.first, [P2[1], P2[2]].sort()); assert.deepEqual(v.second, []);
  // the tie-break (fewer lost balls) splits equal points
  v = vaultFile({ week: 5, cards: [c(P2[1], 15, false, 0), c(P2[2], 15, false, 1)] });
  assert.deepEqual(v.first, [P2[1]]); assert.deepEqual(v.second, [P2[2]]);
  // more than 10 tied for 1st: left empty, reported
  const probs = [];
  v = vaultFile({ week: 5, cards: P2.slice(0, 11).map((a) => c(a, 8)) }, probs);
  assert.deepEqual(v.first, []); assert.deepEqual(v.second, []);
  assert.match(probs.join(" "), /11 free players tied for 1st/);
  // nobody on the Free play board with a point
  v = vaultFile({ week: 5, cards: [c(P2[0], 5, true), c(P2[1], 0)] });
  assert.deepEqual(v.first, []); assert.deepEqual(v.second, []);
});

test("practice weeks put every scorecard on the Free play board (nobody can be staked in Block Golf yet)", async () => {
  const out = tmp("golf-");
  await settle(base({ stakedFromWeek: null, now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const wf = readOut(out, "W003.json");
  assert.ok(wf.cards.length > 0 && wf.cards.every((c) => c.ranked === false));
  assert.ok(readOut(out, "board.json").lastWeek.rows.every((r) => r.ranked === false));
  assert.ok(!fs.existsSync(path.join(out, "vault")), "practice weeks still send nothing to the Vault");
});

// ── Repo Lens #golf-v2 findings (D-140: one test each) ──

test("G-1: a wallet staked in Block Golf at any point that week never takes the Free play 1st/2nd", async (t) => {
  // FREE ends the week with no counted stake (it withdrew on Saturday), but reached the minimum earlier: peaked
  const golf = async (_n, who) => ({ weights: vhp(who.filter((a) => a !== FREE)), peaked: new Set(who) });
  const bx = P.slice(0, 8).map((a, i) => ({ a, place: i + 2, pts: 800 - 100 * i, correct: 8 - i, picks: 10, days: 3, lastCorrect: 0, ranked: true }));
  bx.unshift({ a: FREE, place: 1, pts: 900, correct: 9, picks: 10, days: 3, lastCorrect: 0, ranked: false });
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: bx }), golfStakersOf: golf }));
  const wf = readOut(out, "W003.json");
  assert.equal(wf.final, true);
  assert.ok(wf.notFree.includes(FREE));
  const card = wf.cards.find((c) => c.a === FREE);
  assert.ok(card && card.pts >= 1, "FREE has a scoring card (it tops the Race and Block X boards)");
  assert.equal(card.ranked, false, "no counted stake: not on the vault's Staked rows");
  assert.equal(card.free, false, "but staked earlier in the week: not Free play");
  const v = readOut(path.join(out, "vault"), "W3.json");
  assert.ok(!v.first.includes(FREE) && !v.second.includes(FREE));
  assert.ok(!v.rows.some((r) => r.player === FREE));
  // The board shows it with the week's stakers, never on Free play
  assert.equal(readOut(out, "board.json").lastWeek.rows.find((r) => r.a === FREE).ranked, true);
  // The publish job agrees, and refuses a file that marks it free
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape] = checks();
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8" }), /golf files ok/);
  const bad = copyDir(out); const w = readOut(bad, "W003.json"); w.cards.find((c) => c.a === FREE).free = true; write(bad, "W003.json", w);
  assert.throws(() => execFileSync("python3", [shape, bad], { stdio: "pipe" }), /don't match their holes|don't match the Free play board/);
});

test("G-1: the peak is read like Block X's (entry peak_stake or stake, else the active stake); at least the minimum", () => {
  assert.equal(peakOf({ entry: { peak_stake: "500000000", stake: "0" }, active_stake: "0" }), "500000000");
  assert.equal(peakOf({ entry: { peak_stake: "0", stake: "300000000" } }), "300000000");
  assert.equal(peakOf({ active_stake: "200000000" }), "200000000");
  assert.equal(peakOf({ entry: { peak_stake: "x" } }), "0");
  const cfg = { min_stake: "100000000" };
  const s = peakedFrom([{ a: P[0], weekStake: "0", peak: "100000000" }, { a: P[1], weekStake: "0", peak: "99999999" }, { a: P[2], weekStake: "200000000", peak: "0" }], cfg, 3);
  assert.deepEqual([...s].sort(), [P[0], P[2]].sort());
});

test("G-2: every hole is read again until the week is final; a final hole that reads differently starts the check again", async () => {
  // END: every hole final, the check is stamped
  const a = tmp("golf-");
  await run(base({ now: END, out: a, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.ok(readOut(a, "W003.json").check);
  // An hour later Block X's final board reads differently (a correction): not final, a new stamp, the new standings
  const changed = () => gamesDir({ last: true, final: true, rows: P.slice(0, 8).map((x, i) => ({ a: x, place: 8 - i, pts: 100 + 100 * i, correct: 1, picks: 10, days: 3, lastCorrect: 0, ranked: true })) });
  const b = tmp("golf-");
  const r = await run(base({ now: END + H, prev: a, out: b, raceDir: raceDir(), gamesDir: changed() }));
  const wb = readOut(b, "W003.json");
  assert.equal(wb.final, false, "the reading changed: no second matching run yet");
  assert.equal(wb.check.at, END + H);
  assert.match(r.problems.join("\n"), /blockx, week 3: its final standings read differently/);
  assert.equal(holeOf(b, "blockx").rows.find((x) => x[0] === P[7])[1], 800, "the new standings, not the frozen ones");
  // The same new reading an hour later: final
  const c = tmp("golf-");
  await run(base({ now: END + 2 * H, prev: b, out: c, raceDir: raceDir(), gamesDir: changed() }));
  assert.equal(readOut(c, "W003.json").final, true);
  // A game that no longer shows the week as final makes its hole wait (the week can't go final on it)
  const d = tmp("golf-");
  const r2 = await run(base({ now: END + H, prev: a, out: d, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: false }) }));
  assert.equal(holeOf(d, "blockx").status, "live");
  assert.equal(readOut(d, "W003.json").final, false);
  assert.match(r2.problems.join("\n"), /was final, but its game no longer shows the week as final/);
  // Staked weeks: a kept hole whose Block Golf stakes read differently is scored again
  const e = tmp("golf-");
  await run(base({ now: END + H, prev: a, out: e, raceDir: raceDir(), gamesDir: FINAL_GAMES(), golfStakersOf: async (_n, who) => vhp(who.filter((x) => x !== FREE), 3) }));
  assert.equal(readOut(e, "W003.json").final, false, "the stakes changed: the check starts again");
  assert.notEqual(readOut(e, "W003.json").check.sig, readOut(a, "W003.json").check.sig);
  assert.ok(holeOf(e, "blockx").rows.every((x) => x[3] === 3), "scored on this run's stakes");
  // When a final hole can't be read again, its kept weights are still compared with this run's stakes
  const f = tmp("golf-");
  const r3 = await run(base({ now: END + H, prev: a, out: f, raceDir: raceDir(), gamesDir: tmp("empty-"), golfStakersOf: async (_n, who) => vhp(who.filter((x) => x !== FREE), 3) }));
  assert.match(r3.problems.join("\n"), /blockx, week 3: the Block Golf stakes read differently/);
  assert.equal(readOut(f, "W003.json").final, false);
  assert.ok(holeOf(f, "blockx").rows.every((x) => x[3] === 3));
});

test("G-3: the Race hole is final only once the Race's own week (its vault file) is final", async () => {
  // Every race final but the Race's vault week not final yet (its review, re-check or the owner's hold): waits
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir({ vaultFinal: false }), gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out, "race").status, "live");
  assert.match(holeOf(out, "race").why, /Race's own week/);
  assert.equal(readOut(out, "W003.json").final, false);
  // Once the Race's file is final: final
  const out2 = tmp("golf-");
  await settle(base({ now: END + 14 * H, prev: out, out: out2, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out2, "race").status, "final");
  assert.equal(readOut(out2, "W003.json").final, true);
  // The Race's vault file for another week doesn't count
  const rd = raceDir({ vaultFinal: false });
  write(path.join(rd, "vault"), "W3.json", { game: 7, week: 4, final: true, rows: [], first: [], second: [], skipped: [] });
  const out3 = tmp("golf-");
  await settle(base({ now: END + 13 * H, out: out3, raceDir: rd, gamesDir: FINAL_GAMES() }));
  assert.equal(holeOf(out3, "race").status, "live");
});

test("§5.5: the owner's hold (GOLF_HOLD_WEEKS) keeps a week from going final; a bad value holds every week", async () => {
  assert.deepEqual(parseHoldWeeks("3, 4"), { weeks: [3, 4], bad: false, raw: "3, 4" });
  assert.equal(parseHoldWeeks("W3").bad, true);
  assert.equal(parseHoldWeeks("3 4").bad, true);
  assert.deepEqual(parseHoldWeeks(""), { weeks: [], bad: false, raw: "" });
  for (const hold of ["3", "W3"]) {
    const out = tmp("golf-");
    const r = await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), holdWeeks: hold }));
    assert.equal(readOut(out, "W003.json").final, false, `held by ${hold}`);
    assert.ok(!fs.existsSync(path.join(out, "vault", "W3.json")), "no vault file for a held week");
    assert.match(r.problems.join("\n"), /HELD/);
  }
  // Another week held: this one goes final
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: FINAL_GAMES(), holdWeeks: "5" }));
  assert.equal(readOut(out, "W003.json").final, true);
});

test("§4.1: the publish job's scorer port matches golf-math.js on random weeks, and refuses cards that don't follow the holes", (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape] = checks();
  const GEN = M.weekStart(0), WK = M.weekStart(1) - M.weekStart(0);
  let seed = 12345;   // mulberry32: a small, exact 32-bit generator
  const rnd = (n) => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) % n; };
  const A = Array.from({ length: 30 }, (_, i) => "1" + "ABCDEFGHJKLMNPQRSTUVWXYZabcdefgh"[i].repeat(33));
  const dir = tmp("golf-rand-");
  const WEEKS = 400;
  for (let w = 0; w < WEEKS; w++) {
    const practice = rnd(2) === 0;
    const R = G.rule(w, practice ? null : 0), minW = practice ? 0 : G.MIN_FIELD_VHP;
    const nh = 2 + rnd(4), players = A.slice(0, 3 + rnd(27));
    const holes = [];
    for (let h = 0; h < nh; h++) {
      const rows = players.filter(() => rnd(4) !== 0).map((a) => {
        const score = rnd(3) === 0 ? 0 : rnd(6) + (rnd(5) === 0 ? 0.5 : 0);
        return [a, score, score > 0 ? 1 : 0, practice ? 1 : (rnd(3) === 0 ? 0 : 1 + rnd(5))];
      });
      const skipped = rnd(8) === 0;
      const s = skipped ? null : G.scoreHole(rows.map(([a, score, sc, rk]) => ({ a, score, scored: !!sc, ranked: G.weightOf(rk) })), R.minField, R.everyone, minW);
      holes.push({ id: ["questions", "race", "blockx", "lastnode", "bracket"][h], name: "x", status: skipped || s.skipped ? "skipped" : "final", why: "", field: s ? s.field : 0, rows });
    }
    const scored = holes.map((h) => {
      if (h.status === "skipped") return { id: h.id, skipped: true, results: {} };
      const s = G.scoreHole(h.rows.map(([a, score, sc, rk]) => ({ a, score, scored: !!sc, ranked: G.weightOf(rk) })), R.minField, R.everyone, minW);
      return { id: h.id, skipped: s.skipped, results: s.results };
    });
    const rankedAny = new Set(); if (!practice) for (const h of holes) if (h.status !== "skipped") for (const r of h.rows) if (r[3]) rankedAny.add(r[0]);
    const notFree = practice ? [] : players.filter(() => rnd(6) === 0).sort();
    const cards = G.cards(scored).map((c) => ({ a: c.a, ranked: rankedAny.has(c.a), free: !rankedAny.has(c.a) && !notFree.includes(c.a), place: c.place, pts: c.pts, strokes: c.strokes, par: c.par, toPar: c.toPar, lost: c.lost, under: c.under, best: c.best, mulligan: c.mulligan, holes: c.holes.map((x) => [x.id, x.strokes, x.place, x.of]) }));
    write(dir, `W${String(w).padStart(3, "0")}.json`, { v: 1, week: w, start: GEN + w * WK, end: GEN + (w + 1) * WK, final: false, practice, holes, cards, notFree, check: null });
  }
  const clock = { ...process.env, CHECK_NOW_MS: String(GEN + WEEKS * WK) };
  const many = fs.readdirSync(dir).map((f) => readOut(dir, f)).filter((f) => f.cards.length >= 2).length;
  assert.ok(many > WEEKS / 2, `most random weeks have scorecards (${many})`);
  assert.match(execFileSync("python3", [shape, dir], { encoding: "utf8", env: clock }), /golf files ok/, "the port agrees on every random week");
  // Tampering that keeps the shape: two cards swapped, a stroke changed, a place changed, a hole's score changed
  const tamper = (fn) => { const d = copyDir(dir); let w = 0; for (; w < WEEKS; w++) { const f = readOut(d, `W${String(w).padStart(3, "0")}.json`); if (f.cards.length >= 2 && fn(f)) { write(d, `W${String(w).padStart(3, "0")}.json`, f); return d; } } throw new Error("no week to tamper"); };
  for (const [what, fn] of [
    ["swapped", (f) => { if (f.cards[0].pts === f.cards[1].pts) return false; [f.cards[0], f.cards[1]] = [f.cards[1], f.cards[0]]; return true; }],
    ["place", (f) => { f.cards[1].place += 1; return true; }],
    ["strokes", (f) => { const h = f.cards[0].holes[0]; if (h[1] >= 7) return false; h[1] += 1; return true; }],
    ["hole score", (f) => { const h = f.holes.find((x) => x.status === "final" && x.rows.some((r) => r[1] > 0)); if (!h) return false; const r = h.rows.find((x) => x[1] > 0); r[1] = 1000; return true; }],
  ]) assert.throws(() => execFileSync("python3", [shape, tamper(fn)], { stdio: "pipe", env: clock }), /don't match their holes|field/, what);
});

// ── Repo Lens golf-v2 fix-check (F-1 – F-3, I-1) ──

test("F-1: with the stakes unreadable, a wallet keeps one weight on every hole, and the publish port agrees", async (t) => {
  // Week stamped with stakes read: every wallet but FREE has 2 VHP on every hole
  const prev = tmp("golf-");
  await run(base({ now: END - H, out: prev, raceDir: raceDir(), gamesDir: gamesDir() }));
  // A new wallet NEW appears on Block X only; the stakes can't be read: it gets weight 0 everywhere (never staked on
  // one hole and not on another), and every old wallet keeps its one weight
  const NEW = "1" + "b".repeat(33);
  const bx = P.slice(0, 8).map((a, i) => ({ a, place: i + 1, pts: 800 - 100 * i, correct: 8 - i, picks: 10, days: 3, lastCorrect: 0, ranked: true }));
  bx.push({ a: NEW, place: 9, pts: 50, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: true });
  const out = tmp("golf-");
  await run(base({ now: END + H, prev, out, raceDir: raceDir(), gamesDir: gamesDir({ rows: bx }), golfStakersOf: async () => { throw new Error("rpc down"); } }));
  const wf = readOut(out, "W003.json");
  const weights = new Map();
  for (const h of wf.holes) for (const r of h.rows) { if (!weights.has(r[0])) weights.set(r[0], new Set()); weights.get(r[0]).add(r[3]); }
  for (const [a, set] of weights) assert.equal(set.size, 1, `${a} has one weight across the holes`);
  assert.deepEqual([...weights.get(NEW)], [0]);
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape] = checks();
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8" }), /golf files ok/, "the port's ranked matches the recorder's");
});

test("F-1: the publish port takes 'ranked' from every hole that isn't skipped, even one whose field is too small", (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape] = checks();
  // Two scored holes without X's weight, and a live hole (field too small) where X has weight 3: the recorder ranks X
  const rows = (wX) => P.slice(0, 6).map((a, i) => [a, 10 - i, 1, 2]).concat([[P[9], 1, 1, wX]]);
  const holes = [
    { id: "questions", name: "Daily Questions", status: "final", why: "", field: 6, rows: rows(0) },
    { id: "race", name: "Producer Race", status: "final", why: "", field: 6, rows: rows(0) },
    { id: "blockx", name: "Who Signs Block X", status: "live", why: "x", field: 1, rows: [[P[9], 5, 1, 3]] },
  ];
  const scored = holes.map((h) => {
    if (h.status === "skipped") return { id: h.id, skipped: true, results: {} };
    const s = G.scoreHole(h.rows.map(([a, score, sc, rk]) => ({ a, score, scored: !!sc, ranked: G.weightOf(rk) })), G.MIN_FIELD, false, G.MIN_FIELD_VHP);
    return { id: h.id, skipped: s.skipped, results: s.results };
  });
  const rankedAny = new Set(); for (const h of holes) if (h.status !== "skipped") for (const r of h.rows) if (r[3]) rankedAny.add(r[0]);
  assert.ok(rankedAny.has(P[9]));
  const cards = G.cards(scored).map((c) => ({ a: c.a, ranked: rankedAny.has(c.a), free: !rankedAny.has(c.a), place: c.place, pts: c.pts, strokes: c.strokes, par: c.par, toPar: c.toPar, lost: c.lost, under: c.under, best: c.best, mulligan: c.mulligan, holes: c.holes.map((x) => [x.id, x.strokes, x.place, x.of]) }));
  const d = tmp("golf-f1-");
  write(d, "W003.json", { v: 1, week: W, start: START, end: END, final: false, practice: false, holes, cards, notFree: [], check: null });
  assert.match(execFileSync("python3", [shape, d], { encoding: "utf8" }), /golf files ok/);
});

test("F-2: scores are stored with at most 4 decimals and names never split an emoji; the publish job refuses anything else clearly", async (t) => {
  assert.equal(cleanScore(0.00001), 0);
  assert.equal(cleanScore(1.23456789), 1.2346);
  assert.equal(cleanScore(-1), null); assert.equal(cleanScore(NaN), null); assert.equal(cleanScore(Infinity), null); assert.equal(cleanScore("5"), null);
  const golfName = "⛳".repeat(45);
  assert.equal(Array.from(cleanName(golfName, "x")).length, 40);
  assert.ok(!/[\uD800-\uDFFF]/.test(cleanName(golfName, "x").replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")), "no half emoji");
  assert.equal(cleanName("a\ud83c", "fallback"), "fallback", "a lone surrogate is never written");
  // A Block X board with a tiny float score: stored rounded, and the week publishes and can go final
  const bx = P.slice(0, 8).map((a, i) => ({ a, place: i + 1, pts: i === 7 ? 0.00001 : 800 - 100 * i + 0.123456, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: true }));
  const out = tmp("golf-");
  await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: gamesDir({ last: true, final: true, rows: bx }) }));
  const wf = readOut(out, "W003.json");
  assert.equal(wf.final, true);
  assert.ok(holeOf(out, "blockx").rows.every((r) => Math.round(r[1] * 10000) === r[1] * 10000));
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape, history] = checks();
  assert.match(execFileSync("python3", [shape, out], { encoding: "utf8" }), /golf files ok/);
  const bad = copyDir(out); const w = readOut(bad, "W003.json"); w.holes[0].rows[0][1] = 0.00001; write(bad, "W003.json", w);
  assert.throws(() => execFileSync("python3", [shape, bad], { stdio: "pipe" }), /W003/, "a 5-decimal score is refused");
  // A history check that meets a name it can't encode refuses with a message instead of crashing
  const parent = tmp("golf-");
  await run(base({ now: END, out: parent, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const fin = tmp("golf-");
  await run(base({ now: END + H, prev: parent, out: fin, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const odd = copyDir(fin);
  const raw = fs.readFileSync(path.join(odd, "W003.json"), "utf8").replace('"name":"Daily Questions"', '"name":"Daily \\ud83c"');
  fs.writeFileSync(path.join(odd, "W003.json"), raw);
  let msg = "";
  try { execFileSync("python3", [history, odd, parent], { stdio: "pipe", env: { ...process.env, CHECK_NOW_MS: String(END + 3 * H) } }); } catch (e) { msg = String(e.stderr); }
  assert.match(msg, /can't be written as text|isn't what the earlier run checked/);
  assert.doesNotMatch(msg, /^UnicodeEncodeError/m, "a clear refusal, not a crash");
});

test("F-3: a game's results file that can't be read is said aloud and holds the week (or keeps a final hole, with a note)", async () => {
  // Block X's board is over the size cap / not JSON: a problem line, and no final this run
  const g = tmp("games-"); fs.mkdirSync(path.join(g, "blockx"), { recursive: true }); fs.writeFileSync(path.join(g, "blockx", "board.json"), "{not json");
  const out = tmp("golf-");
  const r = await settle(base({ now: END + 13 * H, out, raceDir: raceDir(), gamesDir: g }));
  assert.match(r.problems.join("\n"), /blockx, week 3: games-data board.json can't be read as JSON/);
  assert.equal(readOut(out, "W003.json").final, false);
  // The Race board missing: said aloud too
  const rd = raceDir(); fs.rmSync(path.join(rd, "board.json"));
  const out2 = tmp("golf-");
  const r2 = await run(base({ now: END + 13 * H, out: out2, raceDir: rd, gamesDir: FINAL_GAMES() }));
  assert.match(r2.problems.join("\n"), /race, week 3: race-data board.json isn't there/);
});

test("I-1: a week whose results keep changing is reported from 48 hours after it ends", async () => {
  const flip = (n) => gamesDir({ last: true, final: true, rows: P.slice(0, 8).map((a, i) => ({ a, place: i + 1, pts: (n % 2 ? 900 : 800) - 100 * i, correct: 1, picks: 1, days: 1, lastCorrect: 0, ranked: true })) });
  let prev = tmp("golf-");
  await run(base({ now: END + 46 * H, out: prev, raceDir: raceDir(), gamesDir: flip(0) }));
  const quiet = await run(base({ now: END + 47 * H, prev, out: tmp("golf-"), raceDir: raceDir(), gamesDir: flip(1) }));
  assert.ok(!quiet.problems.some((p) => /still read differently/.test(p)), "not before 48 hours");
  const o = tmp("golf-");
  await run(base({ now: END + 47 * H, prev, out: o, raceDir: raceDir(), gamesDir: flip(1) }));
  const loud = await run(base({ now: END + 49 * H, prev: o, out: tmp("golf-"), raceDir: raceDir(), gamesDir: flip(2) }));
  assert.match(loud.problems.join("\n"), /week 3: its results still read differently from one run to the next, 49 hours after the week/);
});

test("npm run golf -- status: plain lines from the published files, read-only", async () => {
  assert.match(statusLines(null, new Map(), END)[0], /published nothing yet.*GOLF_ENABLED = true/);
  const out = tmp("golf-");
  await run(base({ now: END, out, raceDir: raceDir(), gamesDir: FINAL_GAMES() }));
  const lines = statusLines(readOut(out, "index.json"), new Map([[3, readOut(out, "W003.json")]]), END + 10 * 60000).join("\n");
  assert.match(lines, /Staked play from vault week 0/);
  assert.match(lines, /Week 1 \(vault week 3\), staked: waiting for its second matching run/);
  assert.match(lines, /hole race: final/);
  assert.match(lines, /GOLF_HOLD_WEEKS = <week>/);
  const src = fs.readFileSync(path.join(APP, "bot/games/golf.ts"), "utf8");
  const body = src.slice(src.indexOf("async function status()"), src.indexOf("const isMain"));
  assert.ok(body.length > 200 && body.length < 2000, "the status function, and only it");
  assert.doesNotMatch(body, /writeFile|signTransaction|\.send\(|Provider/, "status only reads");
});
