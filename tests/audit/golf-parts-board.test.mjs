// Block Golf reads boards in KG parts (v 2): Block X's shape doc (claude/blockx/BLOCKX-BOARD-PARTS-SHAPE-2026-11-13.md)
// on kit/parts (#295). board.json keeps the top 100 rows of each list for pages; the full field is the list's parts
// folder. THE GUARD: a v 2 list's own rows never set a hole. Golf scores the 16 shards only, after checkParts, the
// board's hash, the final state, one-row-per-wallet-in-its-shard and the player count; anything else is a failed read.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP = process.env.APP || ".";
const { run, partsRows, PARTS_EXPECT } = await import(path.resolve(APP, "bot/games/golf.ts"));
const { encodePart, writeParts, shardOf } = await import(path.resolve(APP, "kit/parts/parts.inline.mjs"));
const M = globalThis.KRaceMath;
const H = 3600000, DAY = 24 * H;
const W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
process.env.CHECK_NOW_MS ??= String(END + 7 * DAY);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, name, j) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof j === "string" ? j : JSON.stringify(j)); };

// 40 wallets, so every one of the 16 shards is likely used and the top 100 / board rows are clearly not the field.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i) => { let s = "1", n = i * 7919 + 13; while (s.length < 34) { s += B58[n % 58]; n = Math.floor(n / 58) + 31 * s.length + i; } return s; };
const P = Array.from({ length: 40 }, (_, i) => addr(i));
const COLS = [["player", "a"], ["place", "i"], ["boardPlace", "i"], ["pts", "i"], ["correct", "i"], ["picks", "i"], ["days", "i"], ["lastCorrect", "i"], ["ranked", "b"]];
const rowOf = (a, i) => [a, i + 1, i + 1, 4000 - 100 * i, 10, 12, 5, 0, 1];

/** Writes games-data/<game>/<file>/ as the Block X writer would, and returns its manifest. */
function folder(gamesDir, game, file, week, state, players = P, edit = (byShard) => byShard) {
  let byShard = new Map(PARTS_EXPECT.filter((p) => p !== "top").map((p) => [p, []]));
  players.forEach((a, i) => byShard.get(`p/${shardOf(a, 16)}`).push(rowOf(a, i)));
  byShard = edit(byShard);
  const enc = [...byShard].map(([part, rows]) => encodePart({ game, file, part, cols: COLS, rows }));
  enc.push(encodePart({ game, file, part: "top", cols: COLS, rows: players.slice(0, 100).map(rowOf) }));
  return writeParts(path.join(gamesDir, game, file), { game, file, week, state, unit: "p", expect: PARTS_EXPECT, shards: 16, writtenAt: END }, enc).manifest;
}
/** A v 2 board whose lastWeek is week W (final or not), pointing at its folder; its own rows are only two wallets. */
function v2(gamesDir, game = "blockx", { final = true, state = final ? "final" : "pending", players = P, edit, list = {} } = {}) {
  const m = folder(gamesDir, game, "BW003", W, state, players, edit);
  const m4 = folder(gamesDir, game, "BW004", W + 1, "pending", []);   // the next week, open and empty
  const top = players.slice(0, 2).map((a, i) => ({ a, place: i + 1, pts: 9999, ranked: true }));
  const lastWeek = { week: W, start: START, final, prizes: [], players: players.length, parts: "BW003", hash: m.hash, rows: top, ...list };
  write(path.join(gamesDir, game), "board.json", { v: 2, updated: "", today: { day: "x", players: 0, parts: "BD-20261116", hash: "0".repeat(64), rows: [] },
    week: { week: W + 1, start: END, players: 0, parts: "BW004", hash: m4.hash, rows: [] }, lastWeek, allTime: { players: 0, parts: "BA", hash: "0".repeat(64), rows: [] } });
  return { m, gamesDir };
}
const stakers = async (_n, who) => new Map(who.map((a) => [a, 2]));
const SRC = { blockx: [{ id: "blockx", name: "Who Signs Block X", reader: "blockx", live: true }], fantasy: [{ id: "fantasy", name: "Fantasy Producers", reader: "standard", live: true }] };
const seeded = (id) => { const d = tmp("golf-prev-"); write(d, "index.json", { v: 1, updated: "", weeks: [], course: { [id]: W }, stakedFromWeek: 0 }); return d; };
const base = (id, o) => ({ sources: SRC[id], questionsOf: async () => ({ closed: true, questions: 0, resolved: 0, rows: [] }), golfStakersOf: stakers, p: "main", check: "check", stakedFromWeek: 0, fresh: false, ...o });
async function twice(gamesDir, id = "blockx") {   // two runs an hour apart after the week's end: a ready hole goes final
  const mid = tmp("golf-"), out = tmp("golf-");
  const r1 = await run(base(id, { now: END + 20 * H, prev: seeded(id), out: mid, gamesDir }));
  const r2 = await run(base(id, { now: END + 21 * H, prev: mid, out, gamesDir }));
  const hole = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8")).holes.find((h) => h.id === id);
  return { hole, text: JSON.stringify([r1, r2]) };
}
const failed = ({ hole, text }, re) => {
  assert.notEqual(hole.status, "final"); assert.equal(hole.rows.length, 0);
  if (re) assert.match(text, re);
};

test("a final v 2 Block X board is scored on every wallet in its 16 shards, never the board's own rows", async () => {
  const { hole } = await twice(v2(tmp("games-")).gamesDir);
  assert.equal(hole.status, "final");
  assert.equal(hole.rows.length, P.length);
  const row = hole.rows.find((r) => r[0] === P[5]);
  assert.equal(row[1], 4000 - 500);               // the shard's pts, not the 9999 on board.json's top rows
});

test("the standard reader reads a v 2 kit board the same way", async () => {
  const { hole } = await twice(v2(tmp("games-"), "fantasy").gamesDir, "fantasy");
  assert.equal(hole.status, "final"); assert.equal(hole.rows.length, P.length);
});

test("THE GUARD: a v 2 board whose parts folder is missing is a failed read, never its top rows", async () => {
  const d = tmp("games-"); v2(d);
  fs.rmSync(path.join(d, "blockx", "BW003"), { recursive: true });
  failed(await twice(d), /BW003|parts check|manifest/);
});

test("a v 2 list that names no folder, no hash or no player count is a failed read", async () => {
  for (const list of [{ parts: undefined }, { parts: "../x" }, { hash: "nope" }, { players: -1 }, { players: 1.5 }]) {
    failed(await twice(v2(tmp("games-"), "blockx", { list }).gamesDir));
  }
});

test("board and folder from different runs (hash differs) is a failed read", async () => {
  failed(await twice(v2(tmp("games-"), "blockx", { list: { hash: "a".repeat(64) } }).gamesDir), /another run|hash/);
});

test("a final week whose folder is still pending is a failed read", async () => {
  failed(await twice(v2(tmp("games-"), "blockx", { final: true, state: "pending" }).gamesDir), /isn't final/);
});

test("a player count that doesn't match the shards is a failed read", async () => {
  failed(await twice(v2(tmp("games-"), "blockx", { list: { players: P.length + 1 } }).gamesDir), /players but board.json says/);
});

test("a wallet in the wrong shard, or twice in one shard, is a failed read", async () => {
  const wrong = (m) => { const [a, b] = [...m.keys()].filter((k) => m.get(k).length); const r = m.get(a).pop(); m.get(b).push(r); return m; };
  failed(await twice(v2(tmp("games-"), "blockx", { edit: wrong }).gamesDir), /another shard/);
  const dup = (m) => { const k = [...m.keys()].find((x) => m.get(x).length); m.get(k).push([...m.get(k)[0]]); return m; };
  failed(await twice(v2(tmp("games-"), "blockx", { edit: dup, list: { players: P.length + 1 } }).gamesDir), /twice/);
});

test("a changed part file (bytes no longer match the manifest) is a failed read", async () => {
  const d = tmp("games-"); v2(d);
  const dir = path.join(d, "blockx", "BW003", "p");
  const f = fs.readdirSync(dir).map((x) => path.join(dir, x)).find((x) => fs.statSync(x).size > 200);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/"rows":\[\[/, '"rows":[[0,'));
  failed(await twice(d), /parts check/);
});

test("a board version Golf doesn't know is a failed read (not 'waiting')", async () => {
  for (const id of ["blockx", "fantasy"]) {
    const d = tmp("games-"); write(path.join(d, id), "board.json", { v: 3, lastWeek: { week: W, final: true, rows: [] } });
    failed(await twice(d, id), /version 3/);
  }
});

test("a v 2 week still open is live and scored on its pending folder", async () => {
  const d = tmp("games-");
  const m = folder(d, "blockx", "BW003", W, "pending");
  write(path.join(d, "blockx"), "board.json", { v: 2, week: { week: W, start: START, players: P.length, parts: "BW003", hash: m.hash, rows: [] }, lastWeek: null });
  const out = tmp("golf-");
  await run(base("blockx", { now: START + 3 * DAY, fresh: true, prev: undefined, out, gamesDir: d }));
  const hole = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8")).holes.find((h) => h.id === "blockx");
  assert.equal(hole.status, "live"); assert.equal(hole.rows.length, P.length);
});

test("partsRows: an empty week folder (0 players) is a whole, empty field", () => {
  const d = tmp("games-"); const m = folder(d, "blockx", "BW003", W, "final", []);
  const r = partsRows(path.join(d, "blockx"), "blockx", { parts: "BW003", hash: m.hash, players: 0 }, W, true);
  assert.deepEqual(r, { rows: [] });
});

test("the workflow takes each v 2 list's folder: plain files only, nothing else", () => {
  const y = fs.readFileSync(path.resolve(APP, ".github/workflows/golf.yml"), "utf8");
  const m = y.match(/\n( +)take_parts\(\) \{\n[\s\S]*?\n\1\}\n/);
  assert.ok(m, "take_parts is in the workflow");
  assert.match(y, /take_parts blockx/); assert.match(y, /take_parts "\$id"/);
  const fn = m[0].split("\n").map((l) => l.slice(m[1].length)).join("\n");
  // A games-data branch: Block X's v 2 board and its folder, plus a link and a stray file that must not be taken.
  const src = tmp("gd-"), git = (...a) => execFileSync("git", a, { cwd: src, stdio: ["ignore", "pipe", "pipe"] }).toString();
  v2(src);
  fs.symlinkSync("/etc/hostname", path.join(src, "blockx", "BW003", "p", "0.aaaaaaaaaaaa.json"));
  write(path.join(src, "blockx", "BW003"), "notes.txt", "x");
  git("init", "-q"); git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"); git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "gd");
  const rt = tmp("rt-");
  fs.mkdirSync(path.join(rt, "games", "blockx"), { recursive: true });
  fs.copyFileSync(path.join(src, "blockx", "board.json"), path.join(rt, "games", "blockx", "board.json"));
  execFileSync("bash", ["-c", `set -euo pipefail\n${fn}\ngit fetch -q . HEAD\ntake_parts blockx\ntake_parts nothere`], { cwd: src, env: { ...process.env, RUNNER_TEMP: rt } });
  const got = path.join(rt, "games", "blockx", "BW003");
  assert.ok(!fs.existsSync(path.join(got, "notes.txt")));
  assert.ok(!fs.existsSync(path.join(got, "p", "0.aaaaaaaaaaaa.json")));
  fs.rmSync(path.join(src, "blockx", "BW003", "notes.txt")); fs.rmSync(path.join(src, "blockx", "BW003", "p", "0.aaaaaaaaaaaa.json"));
  const list = (d) => fs.readdirSync(d, { recursive: true }).sort();
  assert.deepEqual(list(got), list(path.join(src, "blockx", "BW003")));
  const b = JSON.parse(fs.readFileSync(path.join(rt, "games", "blockx", "board.json"), "utf8"));
  assert.ok(!("error" in partsRows(path.join(rt, "games", "blockx"), "blockx", b.lastWeek, W, true)), "what the workflow took passes the reader's checks");
});
