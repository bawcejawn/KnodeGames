// Leaderboards (index.html#leaderboard, site/leaders.js): one tab per game, each with its own players and points.
// Plain data only, no storage, and only recorder files on this repo's data branches. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const read = (p) => fs.readFileSync(`${APP}/${p}`, "utf8");

test("leaders.js only reads and draws: no sending, storage, eval or HTML from data", () => {
  const js = read("leaders.js");
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|localStorage|sessionStorage|indexedDB|sendTransaction|\.send\(|signTransaction/);
  assert.match(js, /\^\(race-data\|games-data\)/, "board files must be on this repo's data branches");
});

test("every live game in games.json with a leaderboard points at a recorder board.json with plain columns", () => {
  const games = JSON.parse(read("games.json")).games;
  const race = games.find((g) => g.id === "race");
  assert.ok(race && race.board, "the Producer Race has its own leaderboard");
  for (const g of games.filter((x) => x.board)) {
    assert.match(g.board.data, /^(race-data|games-data)\/([a-z0-9-]{1,24}\/)?board\.json$/, `${g.id}: data file`);
    assert.ok(Array.isArray(g.board.columns) && g.board.columns.length >= 1 && g.board.columns.length <= 6, `${g.id}: columns`);
    for (const c of g.board.columns) { assert.match(c.key, /^[a-z]{1,12}$/); assert.ok(c.label.length <= 20); }
    const branch = g.board.data.split("/")[0];
    assert.ok(read("index.html").includes(`https://raw.githubusercontent.com/bawcejawn/KnodeGames/${branch}/`), `${g.id}: index.html may read ${branch}`);
  }
});

test("the leaderboard view has a game switcher, keeps the question table, and loads the shared board", () => {
  const h = read("index.html");
  assert.match(h, /id="lb-games"/);
  assert.match(h, /<div id="lb-q">[\s\S]*id="board"[\s\S]*<\/div>\s*<div class="lb-game" id="lb-game" hidden><\/div>/);
  assert.match(h, /<script src="app\.js"><\/script>\s*<script src="board\.js"><\/script>\s*<script src="leaders\.js"><\/script>/);
  assert.match(h, /<link rel="stylesheet" href="board\.css">/);
});

test("the More sheet calls it Leaderboards (every game), not the question leaderboard", () => {
  assert.match(read("race.html"), />Leaderboards</);
  assert.doesNotMatch(read("race.html"), /Question leaderboard/);
});

// Free play (owner, 2026-10-28): wallets without VHP or a stake have their own board in every game. Only the top 6
// are listed; everyone else stays private, and a free player still sees their own place.
test("free play boards: the shared board lists only the top N unranked rows and keeps the rest private", async () => {
  const src = read("board.js");
  assert.match(src, /function renderFree\(/);
  assert.match(src, /free\.slice\(0, F\.show\)/, "only the top N free rows are drawn");
  assert.match(src, /!r\.ranked/, "free play = rows that aren't ranked");
  const games = JSON.parse(read("games.json")).games;
  const race = games.find((g) => g.id === "race");
  assert.equal(race.board.free.show, 6);
  assert.match(read("race.js"), /free: \{ show: 6,/);
  assert.match(read("leaders.js"), /b\.free\.show >= 3 && b\.free\.show <= 10/, "games.json can't ask for a long free list");
});

test("free play boards: the question leaderboard splits Staked / Free play and lists only the top 6 free players", () => {
  const app = read("app.js");
  assert.match(app, /const FREE_SHOW = 6;/);
  assert.match(app, /freeAll\.slice\(0, FREE_SHOW\)/);
  assert.match(app, /everyone\.filter\(\(s\) => s\.stake >= UNIT\)/, "the staked board holds staked players only");
  assert.match(read("index.html"), /id="lb-kind"[\s\S]*id="lb-me"/);
});

test("Staked / Free play: the same two board names in every game, fixed in board.js", () => {
  assert.match(read("board.js"), /const LABELS = Object\.freeze\(\{ staked: "Staked", free: "Free play" \}\)/);
  assert.match(read("board.js"), /main: LABELS\.staked, label: LABELS\.free/, "a game can't rename the boards");
  assert.match(read("app.js"), /\[\["main", L\.staked\], \["free", L\.free\]\]/, "the question table uses the same names");
  for (const f of ["race.js", "leaders.js", "games.json"]) assert.doesNotMatch(read(f), /main: "|"main":|VHP players/, `${f}: no per-game board names`);
});

// Block X on the Leaders page (2026-11-03): points stored in hundredths (scale 100, shown with 2 decimals), free medals
// from last week's frozen prize list when final, else this week's rows by the game's rule (3+ days, > 0 points, ties share).
test("Block X board: scale 100, frozen last-week prizes, this week's medals by the prize rule", () => {
  const g = JSON.parse(read("games.json")).games.find((x) => x.id === "blockx");
  assert.equal(g.board.data, "games-data/blockx/board.json");
  assert.equal(g.board.scale, 100);
  assert.equal(g.board.free.minDays, 3);
  const js = read("leaders.js");
  assert.match(js, /scale: b\.scale === 100 \? 100 : 1/, "only 100 is allowed");
  assert.match(js, /part\.final === true && Array\.isArray\(part\.prizes\)/, "last week's medals come from the frozen list");
  assert.match(js, /\{ \.\.\.c, d: 2 \}/, "the points column shows 2 decimals");
  assert.match(read("board.js"), /fmt\(r\[c\.key\], c\.d\)/);
});

test("Block X board: the medal rule picks the right players (run in a sandbox)", async () => {
  const vm = await import("node:vm");
  const src = read("leaders.js");
  const body = src.slice(src.indexOf("function freeWinnersFor"), src.indexOf("  let games ="));
  const box = {};
  vm.runInNewContext(body + "\nthis.f = freeWinnersFor; this.s = scaled;", box);
  const cfg = { main: "pts", scale: 100, free: { minDays: 3 } };
  const fw = box.f(cfg);
  const rows = [
    { a: "A", pts: 300, correct: 3, lastCorrect: 5, days: 2 },   // too few days
    { a: "B", pts: 250, correct: 2, lastCorrect: 4, days: 3 },
    { a: "C", pts: 250, correct: 2, lastCorrect: 4, days: 4 },   // tie with B → both 1st
    { a: "D", pts: 100, correct: 1, lastCorrect: 2, days: 5 },   // 3rd row → place 3, no medal
    { a: "E", pts: 0, correct: 0, days: 6 },
  ];
  const m = fw(null, rows, true);
  assert.deepEqual(JSON.parse(JSON.stringify([...m.entries()])), [["B", 1], ["C", 1]]);
  assert.equal(fw(null, rows, false).size, 0, "no medals on today / all-time");
  const last = fw({ final: true, prizes: [{ player: "D", place: 1 }, { player: "E", place: 2 }] }, rows, true);
  assert.deepEqual(JSON.parse(JSON.stringify([...last.entries()])), [["D", 1], ["E", 2]], "a final week uses its frozen prize list");
  const d = box.s({ v: 1, week: { rows: [{ a: "A", pts: 179, correct: 2 }] } }, cfg);
  assert.equal(d.week.rows[0].pts, 1.79);
  assert.equal(d.week.rows[0].correct, 2, "count columns aren't scaled");
});
