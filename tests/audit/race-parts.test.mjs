// The Race parts (KG parts v1, bot/race-parts.ts): every Race file -> parts folder -> the very same file, byte for byte.
// The files come from a real recorder run on the made-up chain of race-ruler.fixture.mjs (W, T, R, R-1, board.json),
// plus edge cases: old 5-field picks, a missed race, an unfinished race, an empty board section, many players.
// Optional: RACE_PARTS_SAMPLES=<folder of real race-data files> also round-trips those.
// Run: node --import tsx --test tests/audit/race-parts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { M, R, P, timeline, node, vhpOf } from "./race-ruler.fixture.mjs";

const APP = process.env.APP || ".";
const RP = await import(path.resolve(APP, "bot/race-parts.ts"));
const K = await import(path.resolve(APP, "kit/parts/parts.inline.mjs"));
const { run } = await import(path.resolve(APP, "bot/race.ts"));
const U = (s) => Date.parse(s);
const dirs = [], tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-parts-")); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const W1 = "1W1111111111111111111111111111111", W2 = "1W2222222222222222222222222222222";

/** A real recorder run: Monday of week 2, the race types and the ruler on, a few picks. */
async function recorded() {
  const LEDGER = R.ledger(timeline()), RACE00 = M.raceIndex(U("2026-11-02T00:00Z")), H1 = M.typedIndex(1, U("2026-11-02T00:00Z"));
  let prev = "";
  for (const at of ["2026-11-01T23:37Z", "2026-11-02T05:37Z", "2026-11-02T06:37Z"]) {
    const out = tmp(), log = console.log; console.log = () => {};
    try {
      await run({ p: node(U(at)), check: node(U(at)), prev, out, vhpOf, raceContract: "x", prizesFrom: 0, vaultHold: false, holdWeeks: [], typesFrom: 2, rulerFrom: 2, rulerLedger: LEDGER,
        picksOf: async (n, r, type = 0) => (type === 0 && r === RACE00 ? [[W1, P[0], 10], [W2, P[1], 11]] : type === 1 && r === H1 ? [[W1, P[2], 12]] : []), stakedOf: async () => false });
    } finally { console.log = log; }
    prev = out;
  }
  return prev;
}
const files = await recorded();
const read = (f) => fs.readFileSync(path.join(files, f), "utf8");
const weekStart = (w) => M.weekStart(w);

/** encode -> write the folder with kit/parts -> check it as a publish job would -> decode -> same text. */
function roundTrip(kind, text, extra = {}) {
  const j = JSON.parse(text);
  const enc = kind === "W" ? RP.encodeW(j) : kind === "T" ? RP.encodeT(j) : kind === "R" ? RP.encodeR(j, weekStart(j.week), extra.type || 0) : RP.encodeBoard(j, extra.week ?? 2);
  const root = tmp(), dir = path.join(root, enc.meta.file);
  const w = K.writeParts(dir, { ...enc.meta, writtenAt: 0 }, enc.parts);
  assert.equal(w.warnings.length, 0);
  const pubRoot = tmp();
  const chk = K.checkParts(dir, { game: "race", file: enc.meta.file, week: enc.meta.week, publishedRoot: pubRoot, rel: enc.meta.file, ...(enc.meta.unit === "p" ? {} : { full: enc.meta.expect }) });
  assert.ok(chk.ok, JSON.stringify(chk.errors));
  const back = RP.decodeFolder(dir);
  assert.equal(JSON.stringify(back) + "\n", text, `${enc.meta.file}: byte for byte`);
  assert.deepEqual(RP.readRaceFile(root, enc.meta.file), j, "readRaceFile prefers the folder");
  return { enc, dir, root };
}

test("W: every 6-hour race in its own part (r001…), picks as rows in their original order; reassembles byte for byte", () => {
  const { enc } = roundTrip("W", read("W002.json"));
  assert.deepEqual(enc.parts.map((p) => p.part).slice(0, 3), ["wk", "r001", "r002"]);
  const r1 = enc.parts.find((p) => p.part === "r001");
  assert.ok(K.decodePart(r1.text).rows.length >= 2, "the picks are rows");
});

test("T: one part per UTC day (hours + typed races starting that day); byte for byte", () => {
  const { enc } = roundTrip("T", read("T002.json"));
  assert.ok(enc.parts.some((p) => p.part === "d1"));
  assert.ok(enc.parts.every((p) => /^(wk|d[1-7])$/.test(p.part)));
});

test("R and R-1: one part per day, every card's text unchanged; byte for byte", () => {
  const { enc } = roundTrip("R", read("R002.json"));
  assert.ok(enc.parts.some((p) => p.part === "d1"));
  if (fs.existsSync(path.join(files, "R002-1.json"))) roundTrip("R", read("R002-1.json"), { type: 1 });
});

test("board.json: top 100 + 16 shards; the whole board from the shards, byte for byte; top alone gives the first 100", () => {
  roundTrip("board", read("board.json"));
  // many players, one empty section, a null lastWeek
  const rows = Array.from({ length: 450 }, (_, i) => ({ a: `1P${String(i).padStart(31, "x").replace(/0/g, "o")}`.slice(0, 33), pts: 450 - i, correct: i % 3, shows: 1, picks: 4, ranked: i % 2 === 0, boardPlace: i + 1, earns: 0 }));
  for (const r of rows) assert.match(r.a, /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/);
  const big = { v: 1, updated: "2026-11-02T06:40:00.000Z", today: { day: 3, rows: rows.slice(0, 7) }, week: { week: 2, start: weekStart(2), rows }, lastWeek: null, allTime: { rows: [] } };
  const { dir } = roundTrip("board", JSON.stringify(big) + "\n");
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const parts = m.parts.map((p) => ({ part: p.part, ...K.decodePart(fs.readFileSync(path.join(dir, p.name), "utf8")) }));
  const top = RP.decodeBoard(parts, "top");
  assert.equal(top.week.rows.length, 100); assert.deepEqual(top.week.rows, rows.slice(0, 100));
  assert.ok(parts.filter((p) => p.part.startsWith("p/")).length > 1, "spread over shards");
  for (const p of parts.filter((x) => x.part.startsWith("p/"))) for (const r of p.rows) assert.equal(K.shardOf(r.a, 16), p.part.slice(2), "each player in its own shard");
});

test("edge cases: old 5-field picks, a missed race, an unfinished race, a race with no picks list keep their exact text", () => {
  const w = JSON.parse(read("W002.json"));
  const fin = w.races.find((r) => r.result && r.result.picks);
  fin.result.picks = fin.result.picks.map((p) => p.slice(0, 5));
  w.races[1].result = { final: true, missed: true, note: "no handicap card was recorded for this race" };
  w.races[2].result = null;
  roundTrip("W", JSON.stringify(w) + "\n");
});

test("a part's name changes with its bytes; the same file always gives the same part set (hash)", () => {
  const t = read("W002.json"), a = RP.encodeW(JSON.parse(t)), b = RP.encodeW(JSON.parse(t));
  assert.equal(K.partSetHash(a.meta, a.parts), K.partSetHash(b.meta, b.parts));
  const w = JSON.parse(t); w.races[0].cards = w.races[0].cards.map((c) => c && { ...c, c: (c.c || 1) + 0.01 });
  const c = RP.encodeW(w);
  assert.notEqual(c.parts.find((p) => p.part === "r001").name, a.parts.find((p) => p.part === "r001").name);
});

test("sizes at 9,000 weekly players (Capacity's gate): a W race part, a board shard and top stay well under 60%", () => {
  const w = JSON.parse(read("W002.json")), r = w.races.find((x) => x.result && x.result.final && !x.result.missed);
  const who = (i) => "1" + String(i).padStart(32, "A").replace(/0/g, "a").replace(/l/g, "L");
  // every one of 9,000 players picks this race (the worst case for one part)
  r.result.picks = Array.from({ length: 9000 }, (_, i) => [who(i), P[i % P.length], 1000 + i, 0, 0, 0]);
  const part = RP.encodeW(w).parts.find((p) => p.part === `r${String(Math.floor((r.start - w.start) / 21600000) + 1).padStart(3, "0")}`);
  assert.ok(part.bytes < K.WARN_BYTES, `W race part with 9,000 picks: ${part.bytes} bytes`);
  const rows = Array.from({ length: 9000 }, (_, i) => ({ a: who(i), pts: 9000 - i, correct: 1, shows: 1, picks: 28, ranked: true, boardPlace: i + 1, earns: 0 }));
  const b = RP.encodeBoard({ v: 1, updated: "x", today: { day: 3, rows }, week: { week: 2, start: weekStart(2), rows }, lastWeek: { week: 1, start: weekStart(1), rows }, allTime: { rows } }, 2);
  const max = Math.max(...b.parts.filter((p) => p.part.startsWith("p/")).map((p) => p.bytes));
  assert.ok(max < K.WARN_BYTES, `largest board shard at 9,000 players: ${max} bytes`);
  assert.ok(b.parts.find((p) => p.part === "top").bytes < 100000);
  console.log(`# sizes at 9,000 players: W race part ${part.bytes} B; board shard max ${max} B; top ${b.parts.find((p) => p.part === "top").bytes} B`);
});

test("real race-data files round-trip (RACE_PARTS_SAMPLES)", { skip: !process.env.RACE_PARTS_SAMPLES }, () => {
  const d = process.env.RACE_PARTS_SAMPLES;
  for (const f of fs.readdirSync(d)) {
    const t = fs.readFileSync(path.join(d, f), "utf8");
    if (/^W\d{3}\.json$/.test(f)) roundTrip("W", t);
    else if (/^T\d{3}\.json$/.test(f)) roundTrip("T", t);
    else if (/^R\d{3}(-\d)?\.json$/.test(f)) roundTrip("R", t, { type: Number((f.match(/-(\d)/) || [0, 0])[1]) });
    else if (f === "board.json") roundTrip("board", t);
  }
});
