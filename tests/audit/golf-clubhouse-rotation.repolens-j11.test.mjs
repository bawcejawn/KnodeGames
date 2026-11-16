// Repo Lens #J-11 (PR #353 golf-clubhouse @ e454bcd7), J11-1 (Medium). Place in tests/audit/. Test 1 fails at e454bcd7.
// Run from the repository root: TZ=UTC node --import tsx --test tests/audit/golf-clubhouse-rotation.repolens-j11.test.mjs
//
// The vault features (staked, two-games, claimed) are read for at most 20 wallets a run (clubBudget), rotating over the
// week's players that still lack ANY of the three. Most players never get all three (claimed and two-games are rare),
// so nearly every player stays in the rotation for good. A feature is stamped with the week Golf first READS it, so two
// wallets that did exactly the same thing in week W can get `staked` stamped W (reached in time) or W+1 (not reached),
// and their week-W Clubhouse scores differ by the read order alone. With 1,500 players a full pass takes 75 hourly runs.
// In a staked week every Staked-board player is staked in Block Golf, so `staked` decides a stroke at the ladder's
// steps (2 vs 3 features, 4 vs 5, …) for the whole board, and with it the order the vault pays by.
// Here: 6 players, all staked the same way, budget 2 (the same as 1,500 players with the real budget of 20, scaled).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const { run, CLUB_SOURCE } = await import(path.resolve(APP, "bot/games/golf.ts"));
const M = globalThis.KRaceMath;
const H = 3600000, DAY = 24 * H;
const W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
process.env.CHECK_NOW_MS ??= String(END + 7 * DAY);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, name, j) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof j === "string" ? j : JSON.stringify(j)); };
const P = Array.from({ length: 6 }, (_, i) => "1" + "ABCDEF"[i].repeat(33));
const Q = () => ({ closed: true, questions: 2, resolved: 2, rows: P.map((a, i) => ({ a, pts: 10 - i, answered: 2 })) });
const SRC = [{ id: "questions", name: "Daily Questions", reader: "questions", live: true }, CLUB_SOURCE];
const week = (out) => JSON.parse(fs.readFileSync(path.join(out, `W${String(W).padStart(3, "0")}.json`), "utf8"));

async function weekCounts(budget) {   // a staked week: Block Golf pays from week W; every player has 2 VHP in Block Golf
  const prev = tmp("golf-prev-");
  write(prev, "index.json", { v: 1, updated: "", weeks: [W], course: { questions: W, clubhouse: W }, stakedFromWeek: W });
  write(prev, "clubhouse.json", { v: 1, updated: "", wallets: {} });
  write(prev, "W003.json", { v: 1, week: W, start: START, end: END, final: false, practice: false, holes: [{ id: "questions", name: "Daily Questions", status: "live", why: "", field: 6, rows: P.map((a, i) => [a, 10 - i, 1, 2]) }, { id: "clubhouse", name: "Clubhouse", status: "live", why: "", field: 0, rows: [] }], cards: [], notFree: [], check: null });
  // Every player is staked the same way all week (the vault says so for every wallet asked).
  const o = { sources: SRC, questionsOf: async () => Q(), p: "main", check: "check", stakedFromWeek: W, fresh: false, clubBudget: budget,
    golfStakersOf: async (_n, who) => new Map(who.map((a) => [a, 2])),
    deskOf: async () => ({ total: 0, accounts: [] }), vaultOf: async (_n, who) => new Map(who.map((a) => [a, { staked: true, games: 0, claimed: false }])) };
  let dir = prev;
  for (const t of [START + 2 * DAY, END + 20 * H, END + 21 * H]) { const out = tmp("golf-"); await run({ ...o, now: t, prev: dir, out }); dir = out; }
  const h = week(dir).holes.find((x) => x.id === "clubhouse");
  assert.equal(h.status, "final");
  return Object.fromEntries(P.map((a) => [a, h.rows.find((r) => r[0] === a)?.[1] ?? 0]));
}

test("J11-1: players who did the same thing in a week get the same Clubhouse score, whatever order the vault was read in", async () => {
  const c = await weekCounts(2);
  assert.equal(new Set(Object.values(c)).size, 1, `week ${W} Clubhouse features by wallet (all staked alike): ${JSON.stringify(Object.values(c))}`);
});

test("control: with a budget covering everyone, they are equal (the difference is only the read order)", async () => {
  const c = await weekCounts(20);
  assert.deepEqual(new Set(Object.values(c)), new Set([2]));   // play-questions + staked
});
