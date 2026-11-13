// Block Golf's standard reader (Clubhouse plan §4): a game that publishes the shared board (games-data/<id>/board.json)
// and says "golf": "standard" in games.json is a hole with no reader of its own. Opt-in only; read like Block X.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { run, sourcesFromGames, STANDARD_ID } = await import(path.resolve(process.env.APP || ".", "bot/games/golf.ts"));
const M = globalThis.KRaceMath;
const H = 3600000, DAY = 24 * H;
const W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
process.env.CHECK_NOW_MS ??= String(END + 7 * DAY);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, name, j) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof j === "string" ? j : JSON.stringify(j)); };
const P = Array.from({ length: 8 }, (_, i) => "1" + "ABCDEFGHJKLMNPQRSTUVWXYZ"[i].repeat(33));
const rows = P.map((a, i) => ({ a, place: i + 1, pts: 80 - 10 * i, ranked: true }));
const SRC = [{ id: "fantasy", name: "Fantasy Producers", reader: "standard", live: true }];
const board = (last, final) => { const view = { week: W, start: START, rows, ...(last ? { final } : {}) };
  return { v: 1, updated: "", today: { rows: [] }, week: last ? { week: W + 1, start: END, rows: [] } : view, lastWeek: last ? view : null, allTime: { rows: [] } }; };
const gamesWith = (b, id = "fantasy") => { const d = tmp("games-"); if (b !== undefined) write(path.join(d, id), "board.json", b); return d; };
const stakers = async (_n, who) => new Map(who.map((a) => [a, 2]));
const base = (o) => ({ sources: SRC, questionsOf: async () => ({ closed: true, questions: 0, resolved: 0, rows: [] }), golfStakersOf: stakers, p: "main", check: "check", stakedFromWeek: 0, fresh: true, ...o });
const seeded = () => { const d = tmp("golf-prev-"); write(d, "index.json", { v: 1, updated: "", weeks: [], course: { fantasy: W }, stakedFromWeek: 0 }); return d; };
const hole = (out) => JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8")).holes.find((h) => h.id === "fantasy");

test("sourcesFromGames: a game joins only when it says golf: standard (and has a plain id)", () => {
  const f = path.join(tmp("g-"), "games.json");
  const g = (o) => ({ name: "X", status: "live", ...o });
  write(path.dirname(f), "games.json", { v: 1, games: [g({ id: "fantasy", golf: "standard" }), g({ id: "survivor" }), g({ id: "bad/../id", golf: "standard" }),
    g({ id: "Upper", golf: "standard" }), g({ id: "combo", golf: "other" }), g({ id: "blockx" }), g({ id: "constructor", golf: "standard" }), g({ id: "standard", golf: "standard" })] });
  const s = sourcesFromGames(f);
  assert.deepEqual(s.map((x) => [x.id, x.reader]).sort(), [["blockx", "blockx"], ["constructor", "standard"], ["fantasy", "standard"], ["standard", "standard"]]);
  assert.ok(STANDARD_ID.test("fantasy") && !STANDARD_ID.test("a/b") && !STANDARD_ID.test("..") && !STANDARD_ID.test("A"));
});

test("a standard game's week that is not final yet stays live; once final it is final", async () => {
  const o1 = tmp("golf-"); await run(base({ now: START + 3 * DAY, out: o1, gamesDir: gamesWith(board(false)) }));
  assert.equal(hole(o1).status, "live");
  const o2 = tmp("golf-"); await run(base({ now: END + 20 * H, fresh: false, prev: seeded(), out: o2, gamesDir: gamesWith(board(true, false)) }));
  assert.equal(hole(o2).status, "live");
  const mid = tmp("golf-"); const o3 = tmp("golf-");
  await run(base({ now: END + 20 * H, fresh: false, prev: seeded(), out: mid, gamesDir: gamesWith(board(true, true)) }));
  await run(base({ now: END + 21 * H, fresh: false, prev: mid, out: o3, gamesDir: gamesWith(board(true, true)) }));
  assert.equal(hole(o3).status, "final");
  assert.equal(hole(o3).rows.length, 8);
});

test("a missing, unreadable or linked board is reported, never guessed", async () => {
  const o1 = tmp("golf-"); const r1 = await run(base({ now: START + 3 * DAY, out: o1, gamesDir: gamesWith(undefined) }));
  assert.equal(hole(o1).rows.length, 0);
  assert.match(JSON.stringify(r1), /board\.json isn't there|games-data/);
  const o2 = tmp("golf-"); await run(base({ now: START + 3 * DAY, out: o2, gamesDir: gamesWith("{not json") }));
  assert.equal(hole(o2).rows.length, 0);
  const evil = tmp("evil-"); write(evil, "board.json", board(false));
  const gd = gamesWith(undefined); fs.mkdirSync(path.join(gd, "fantasy")); fs.symlinkSync(path.join(evil, "board.json"), path.join(gd, "fantasy", "board.json"));
  const o3 = tmp("golf-"); await run(base({ now: START + 3 * DAY, out: o3, gamesDir: gd }));
  assert.equal(hole(o3).rows.length, 0, "a link is not read");
});

test("a source whose id is not a plain name is not read (no path out of games-data)", async () => {
  const gd = gamesWith(board(false), "fantasy");
  const o = tmp("golf-");
  await run(base({ sources: [{ id: "../x", name: "Bad", reader: "standard", live: true }], now: START + 3 * DAY, out: o, gamesDir: gd }));
  assert.equal(JSON.parse(fs.readFileSync(path.join(o, "W003.json"), "utf8")).holes.find((h) => h.id === "../x")?.rows?.length ?? 0, 0);
});

test("the workflow fetches each opted-in game's board with a plain-id check", () => {
  const y = fs.readFileSync(path.resolve(process.env.APP || ".", ".github/workflows/golf.yml"), "utf8");
  assert.match(y, /x\.golf==="standard"/);
  assert.match(y, /\^\[a-z\]\[a-z0-9-\]\{1,30\}\$/);
});
