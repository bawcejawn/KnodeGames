// Repo Lens #B-13 (Block Golf go-live fix-check, golf-launch @ 76754ea): failing tests for the new Lows.
// Run: node --import tsx --test tests/audit/golf-repolens-b13.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const APP = process.env.APP || ".";
const { cleanScore } = await import(path.resolve(APP, "bot/games/golf.ts"));
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/golf.yml"), "utf8");
const line = yml.split("\n").find((l) => l.includes("score_ok = lambda"));

test("B13-A1: the publish check's score_ok accepts every score cleanScore writes (hundredths and 4 decimals)", () => {
  assert.ok(line, "found score_ok in golf.yml");
  const xs = [];
  for (let k = 0; k <= 2000; k++) xs.push(cleanScore(k / 100));            // Block X-style hundredths 0.00 .. 20.00
  for (const x of [0.0003, 0.57, 1.005, 2.675, 0.1 + 0.2, 123.4567, 0.00025, 999.9999]) xs.push(cleanScore(x));
  const py = `import json, sys\n${line.trim()}\nxs = json.load(sys.stdin)\nprint(json.dumps([x for x in xs if not score_ok(x)][:10]))`;
  const bad = JSON.parse(execFileSync("python3", ["-I", "-c", py], { input: JSON.stringify(xs), encoding: "utf8" }));
  assert.deepEqual(bad, [], `the recorder writes these but the publish job refuses them (every hourly publish would be refused): ${bad.join(", ")}`);
});

// ── The three todos, written as tests ──
const { run } = await import(path.resolve(APP, "bot/games/golf.ts"));
await import(path.resolve(APP, "race-math.js"));
await import(path.resolve(APP, "golf-math.js"));
const M = globalThis.KRaceMath, G = globalThis.KGolf;
const H = 3600000, W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
const P = Array.from({ length: 10 }, (_, i) => "1" + "ABCDEFGHJK"[i].repeat(33));
const tmp = (p) => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), p));
const write = (d, f, j) => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, f), typeof j === "string" ? j : JSON.stringify(j)); };
const SOURCES = [
  { id: "questions", name: "Daily Questions", reader: "questions", live: true },
  { id: "race", name: "Producer Race", reader: "race", live: true },
  { id: "blockx", name: "Who Signs Block X", reader: "blockx", live: true },
];
function raceDir({ wfile = null, vfile = null } = {}) {
  const d = tmp("race-");
  const r = P.slice(0, 10).map((a, i) => ({ a, pts: 30 - 3 * i, correct: 10 - i, shows: 0, picks: 20, answers: 0, points: 0, ranked: true }));
  write(d, "board.json", { v: 1, updated: "", today: { rows: [] }, week: { week: W, start: START, rows: r }, lastWeek: null, allTime: { rows: [] } });
  const races = [];
  for (let t = START; t < END; t += M.RACE) races.push({ id: "x", start: t, end: t + M.RACE, cards: [], result: { final: true } });
  write(d, "W003.json", wfile ?? { v: 1, week: W, start: START, end: END, races });
  write(path.join(d, "vault"), "W3.json", vfile ?? { game: 7, week: W, final: true, rows: [], first: [], second: [], skipped: [] });
  return d;
}
function gamesDir(rows) {
  const d = tmp("games-");
  const view = { week: W, start: START, rows, final: true, prizes: [] };
  write(path.join(d, "blockx"), "board.json", { v: 1, updated: "", today: { rows: [] }, week: { week: W + 1, start: END, rows: [] }, lastWeek: view, allTime: { rows: [] } });
  return d;
}
const bx = (pts) => P.slice(0, 8).map((a, i) => ({ a, place: i + 1, pts: pts[i] ?? 0, correct: 1, picks: 1, days: 3, lastCorrect: 0, ranked: true }));
const qWeek = (rows) => ({ closed: true, questions: 5, resolved: 5, rows: (rows ?? P.slice(0, 8).map((a, i) => ({ a, pts: 8 - i, answered: 5, counted: 5 }))).slice().sort((x, y) => (x.a < y.a ? -1 : 1)) });
function seeded() { const d = tmp("golf-prev-"); write(d, "index.json", { v: 1, updated: "", weeks: [], course: { questions: W, race: W, blockx: W }, stakedFromWeek: null }); return d; }
const base = (o) => ({ sources: SOURCES, stakedFromWeek: null, questionsOf: async () => qWeek(), ...(o.prev === undefined ? { prev: seeded() } : {}), ...o });

test("B13-A2: an unreadable race-data/W<w>.json or vault/W<w>.json gives a problem line, as board.json does", async () => {
  for (const [which, opt] of [["W003.json", { wfile: "{oops" }], ["vault/W3.json", { vfile: "{oops" }]]) {
    const out = tmp("golf-");
    const r = await run(base({ now: END + 13 * H, out, raceDir: raceDir(opt), gamesDir: gamesDir(bx([9, 8, 7, 6, 5, 4, 3, 2])) }));
    assert.match(r.problems.join("\n"), new RegExp(`race, week 3: race-data ${which.replace(".", "\\.")} can't be read as JSON`), which);
    const wf = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
    assert.equal(wf.final, false, `${which}: the week is held, not made final on a guess`);
  }
  // An absent vault file (the Race hasn't finished its week) is not a problem: the hole just waits
  const d = raceDir(); fs.rmSync(path.join(d, "vault", "W3.json"));
  const r = await run(base({ now: END + 13 * H, out: tmp("golf-"), raceDir: d, gamesDir: gamesDir(bx([9, 8, 7, 6, 5, 4, 3, 2])) }));
  assert.ok(!r.problems.some((p) => /race-data vault/.test(p)));
});

test("B13-B1: board rows carry boardPlace; Golf's page and the Leaders page give free medals by Golf's place", async () => {
  // A and B: equal points; A has 0 lost balls, B 1 (B misses the question game). Golf ranks A 1st, B 2nd.
  const A = P[0], B = P[1];
  const qRows = P.slice(0, 8).filter((a) => a !== B).map((a, i) => ({ a, pts: 8 - i, answered: 5, counted: 5 }));
  const opts = { raceDir: raceDir(), gamesDir: gamesDir(bx([9, 8, 7, 6, 5, 4, 3, 2])), questionsOf: async () => qWeek(qRows) };
  const prev = tmp("golf-"); await run(base({ now: END + 13 * H, out: prev, ...opts }));
  const out = tmp("golf-"); await run(base({ now: END + 14 * H, prev, out, ...opts }));
  const board = JSON.parse(fs.readFileSync(path.join(out, "board.json"), "utf8"));
  const rows = board.lastWeek.rows;
  assert.ok(rows.every((r) => Number.isInteger(r.boardPlace) && r.boardPlace >= 1));
  const ra = rows.find((r) => r.a === A), rb = rows.find((r) => r.a === B);
  // Golf's medals from golf-math (the page) …
  const page = G.freeMedals(rows.filter((r) => !r.ranked));
  // … and the Leaders page's rule with byPlace (games.json sets it for Golf)
  const box = { window: {}, document: { addEventListener() {}, getElementById: () => null, querySelector: () => null } };
  const src = fs.readFileSync(path.resolve(APP, "leaders.js"), "utf8");
  const fw = src.slice(src.indexOf("function freeWinnersFor(cfg)"), src.indexOf("/** Board data with the points column"));
  const freeWinnersFor = new Function(`${fw}; return freeWinnersFor;`)();
  const cfg = { main: "pts", free: { byPlace: true, minDays: 0 } };
  const leaders = freeWinnersFor(cfg)({ final: false }, rows.filter((r) => !r.ranked), true);
  assert.deepEqual([...leaders].sort(), [...page].sort(), "both pages agree");
  // Every row's boardPlace follows Golf's tie key on its own board: equal keys share a place, the next key takes
  // its row number (checked against the week file's cards, which carry under par and best hole)
  const wfile = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
  const card = new Map(wfile.cards.map((c) => [c.a, c]));
  const key = (r) => { const c = card.get(r.a); return [c.pts, -c.lost, c.under, -c.best].join(","); };
  for (const staked of [true, false]) {
    const b = rows.filter((r) => r.ranked === staked);
    b.forEach((r, k) => assert.equal(r.boardPlace, k > 0 && key(b[k - 1]) === key(r) ? b[k - 1].boardPlace : k + 1, `${staked ? "Staked" : "Free play"} row ${k}`));
  }
  // The reviewer's case: A 20 pts 0 lost, B 20 pts 1 lost → Golf places A 1st and B 2nd, and both pages say so
  const two = [{ a: A, pts: 20, lost: 0, boardPlace: 1 }, { a: B, pts: 20, lost: 1, boardPlace: 2 }];
  assert.deepEqual([...G.freeMedals(two)], [[A, 1], [B, 2]], "Golf's page");
  assert.deepEqual([...freeWinnersFor(cfg)({ final: false }, two, true)], [[A, 1], [B, 2]], "the Leaders page");
  // Without byPlace (the old rule) the Leaders page gave both a gold medal
  assert.deepEqual([...freeWinnersFor({ main: "pts", free: { minDays: 0 } })({ final: false }, two, true)], [[A, 1], [B, 1]]);
  // games.json opts Golf into byPlace; no other game does
  const gj = JSON.parse(fs.readFileSync(path.resolve(APP, "games.json"), "utf8")).games;
  assert.deepEqual(gj.filter((g) => g.board?.free?.byPlace === true).map((g) => g.id), ["golf"]);
  // The rule matches the vault file's first/second: ties share, 2nd only when 1st is single, > 10 tied = empty
  const tied = (n) => Array.from({ length: n }, (_, i) => ({ a: "1" + String(i).padStart(33, "z"), pts: 5, boardPlace: 1 }));
  assert.equal(G.freeMedals(tied(10)).size, 10);
  assert.equal(G.freeMedals(tied(11)).size, 0);
  assert.deepEqual([...G.freeMedals([{ a: A, pts: 5, boardPlace: 1 }, { a: B, pts: 5, boardPlace: 1 }, { a: P[2], pts: 4, boardPlace: 3 }]).values()], [1, 1]);
});

test("B13-B2: any argument other than `status` prints the usage, exits non-zero and writes nothing", () => {
  const cwd = tmp("golf-cli-");
  for (const a of ["Status", "--status", "statuss"]) {
    let code = 0, err = "";
    try { execFileSync(process.execPath, ["--import", "tsx", path.resolve(APP, "bot/games/golf.ts"), a], { cwd: path.resolve(APP), stdio: "pipe", env: { ...process.env, GOLF_OUT: path.join(cwd, "out") } }); }
    catch (e) { code = e.status; err = String(e.stderr); }
    assert.equal(code, 1, a);
    assert.match(err, /Usage: npm run golf -- status/);
    assert.ok(!fs.existsSync(path.join(cwd, "out")), "no files written");
  }
});

test("B13-B3: status prints published text without control or bidi characters, and survives a malformed week file", async () => {
  const { statusLines, plain } = await import(path.resolve(APP, "bot/games/golf.ts"));
  assert.equal(plain("ok\u001b[31m‮evil\u0007"), "ok[31mevil");
  const idx = { v: 1, updated: "2026-11-09T01:00:00Z\u001b[2J", course: { race: 3 }, weeks: [3], stakedFromWeek: null };
  const lines = statusLines(idx, new Map([[3, { holes: "x" }]]), END).join("\n");
  assert.doesNotMatch(lines, /\u001b/);
  assert.match(lines, /Week 1 \(vault week 3\): its file couldn't be read/);
});
