// Block Golf's Producer Bracket reader (Bracket chat's note, Sat 14 Nov 2026): the WEEK FILE bracket/W<week>.json, never
// board.json (which can leave players out with no sign). Only status "final" scores; "void" and "none" skip the hole for
// everyone; anything else is not ready. points rows are [a, pts, champion, correct].
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { run, JOIN_FROM } = await import(path.resolve(process.env.APP || ".", "bot/games/golf.ts"));
const M = globalThis.KRaceMath;
const H = 3600000, DAY = 24 * H;
const W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
process.env.CHECK_NOW_MS ??= String(END + 7 * DAY);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, name, j) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof j === "string" ? j : JSON.stringify(j)); };
const P = Array.from({ length: 8 }, (_, i) => "1" + "ABCDEFGHJKLMNPQRSTUVWXYZ"[i].repeat(33));
const SRC = [{ id: "bracket", name: "Producer Bracket", reader: "bracket", live: true }];
const week = (over = {}) => ({ v: 5, week: W, start: START, end: END, status: "final", seeding: null, picks: null, days: [], results: null,
  points: P.map((a, i) => [a, 34 - 4 * i, i % 2, 10 - i]), staked: null, ...over });
const games = (file, name = "W003.json") => { const d = tmp("games-"); if (file !== undefined) write(path.join(d, "bracket"), name, file); return d; };
const seeded = () => { const d = tmp("golf-prev-"); write(d, "index.json", { v: 1, updated: "", weeks: [], course: { bracket: W }, stakedFromWeek: 0 }); return d; };
const stakers = async (_n, who) => new Map(who.map((a) => [a, 2]));
const base = (o) => ({ sources: SRC, questionsOf: async () => ({ closed: true, questions: 0, resolved: 0, rows: [] }), golfStakersOf: stakers, p: "main", check: "check", stakedFromWeek: 0, fresh: false, prev: seeded(), ...o });
const hole = (out) => JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8")).holes.find((h) => h.id === "bracket");
async function twice(gamesDir) {   // two runs an hour apart after the week's end: a ready hole goes final
  const mid = tmp("golf-"), out = tmp("golf-");
  await run(base({ now: END + 20 * H, out: mid, gamesDir }));
  await run(base({ now: END + 21 * H, prev: mid, out, gamesDir }));
  return hole(out);
}

test("a final week file scores every player in points", async () => {
  const h = await twice(games(week()));
  assert.equal(h.status, "final"); assert.equal(h.rows.length, 8);
  assert.equal(h.rows.find((r) => r[0] === P[0])[1], 34);
});

test("void and none skip the hole for everyone", async () => {
  for (const status of ["void", "none"]) {
    const h = await twice(games(week({ status, points: [], void: "no bracket this week" })));
    assert.equal(h.status, "skipped", status); assert.equal(h.rows.length, 0);
  }
});

test("waiting, open, locked and an unknown status are not ready (the hole stays in play)", async () => {
  for (const status of ["waiting", "open", "locked", "somethingnew"]) {
    const h = await twice(games(week({ status })));
    assert.notEqual(h.status, "final", status); assert.equal(h.rows.length, 0);
  }
});

test("a missing file, another week's file, bad rows and a wallet twice are failed reads, never scored", async () => {
  for (const g of [games(undefined), games(week({ week: W + 1 })), games("{nope"),
    games(week({ points: [[P[0], 1.5, 0, 0]] })), games(week({ points: [["not-a-wallet", 3, 0, 0]] })),
    games(week({ points: [[P[0], -1, 0, 0]] })), games(week({ points: "x" })),
    games(week({ points: [...P.map((a) => [a, 5, 0, 5]), [P[0], 9, 0, 9]] }))]) {
    const h = await twice(g);
    assert.notEqual(h.status, "final"); assert.equal(h.rows.length, 0);
  }
});

test("a board.json is never used for Bracket (a cut board must not set the hole)", async () => {
  const d = games(week({ status: "waiting" }));
  write(path.join(d, "bracket"), "board.json", { v: 1, lastWeek: { week: W, final: true, rows: P.map((a, i) => ({ a, pts: 30 - i, ranked: true })) } });
  const h = await twice(d);
  assert.notEqual(h.status, "final"); assert.equal(h.rows.length, 0);
});

test("Bracket joins from vault week 6 at the earliest; the workflow fetches its week files", () => {
  assert.equal(JOIN_FROM.bracket, 6);
  const y = fs.readFileSync(path.resolve(process.env.APP || ".", ".github/workflows/golf.yml"), "utf8");
  assert.match(y, /bracket\//); assert.match(y, /W\[0-9\]\{3,4\}/);
});
