// bot/stats.ts: the hourly public summary behind the live stats panel (owner, 5 Nov). Pure parts only: no chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStats, checkStats, top3, questionPoints, blocksBy, VAULT, type Inputs } from "../../bot/stats.ts";

const W = 7 * 86400000, START = 1793577600000;                          // Mon 2 Nov 2026 00:00 UTC
const A = "1Nti1ZmdisnJ8J9FJsmTSt1nMKPyzWZxdz", B = "1LRshrZHPmft4SuaniExEsyzFecCPctMBV", C = "1Fdg4H1bGyooDhUZgHNw8WUNxvyP1sGdvF";
const D = "1MVRxwjaDxjqtYEKsV2rsc69wo3YLYHceM", E = "14ZefZYvDHPXfALKoktwCkbdY8Ku1AiDxZ";
const UNIT = 100000000n;
const board = (week: any[], last: any[], all: any[] = []) => ({ v: 1, week: { start: START, rows: week }, lastWeek: { start: START - W, rows: last }, allTime: { rows: all } });
function inputs(over: Partial<Inputs> = {}): Inputs {
  const now = START + 3 * 86400000 + 5 * 3600000;
  return {
    now, week: { start: START, end: START + W },
    totalStake: 48250n * UNIT + 12345678n,
    games: [{ id: 1, name: "Daily Questions", staked: true, stake: 40000n * UNIT }, { id: 2, name: "Producer Race", staked: false, stake: 0n }, { id: 3, name: "Block Golf", staked: true, stake: 8250n * UNIT }],
    qWeek: [{ address: A, answers: [{ question_id: 40, option: 1 }, { question_id: 41, option: 0 }] }, { address: B, answers: [] }, { address: C, answers: [{ question_id: 41, option: 1 }] }],
    qLastWeek: [{ address: A, answers: [{ question_id: 30, option: 1 }, { question_id: 31, option: 0 }] }, { address: D, answers: [{ question_id: 30, option: 1 }, { question_id: 31, option: 2 }] }, { address: E, answers: [{ question_id: 32, option: 0 }] }],
    qAll: [A, B, C, D, E],
    outcomes: new Map([[30, 2], [31, 1], [32, 1000]]),
    open: [{ id: 41, lockTime: now + 3600000 }, { id: 42, lockTime: now + 7200000 }, { id: 40, lockTime: now - 1 }],
    raceBoard: board([{ a: A, pts: 3, picks: 4 }, { a: D, pts: 0, picks: 2 }], [{ a: C, pts: 4, picks: 8 }, { a: D, pts: 1, picks: 5 }], [{ a: C, pts: 9 }]),
    blockxBoard: board([{ a: E, pts: 0, picks: 3 }], []),
    recentBlocks: { v: 1, signers: ["1UG4UUn7Da9JqE4PKbYUWgjbNwE5F9531", VAULT], sig: [1, 0, 0, 1, 0, 1], dts: [0, 3000, 3000, 3000, 3000, 3000] },
    ...over,
  };
}

test("players, plays, stake, today and last week's top 3 from the published sources and the vault", () => {
  const s = buildStats(inputs({ recentBlocks: null }));
  assert.equal(checkStats(s), null);
  assert.deepEqual(s.players, { week: 4, lastWeek: 4, allTime: 5 }, "this week: A, C (answers; B has none), D (race), E (Block X)");
  assert.deepEqual(s.plays, { answers: 3, racePicks: 6, blockxPicks: 3, total: 12 });
  assert.equal(s.staked.total, 48250.12);
  assert.deepEqual(s.staked.games, [{ id: 1, name: "Daily Questions", vhp: 40000 }, { id: 3, name: "Block Golf", vhp: 8250 }], "free games are left out");
  assert.deepEqual(s.today, { open: 2, closes: inputs().now + 3600000, answers: 2 }, "only questions still open count");
  assert.deepEqual(s.prizes.free, [2, 1]);
  assert.equal(s.blocks.vault24h, null, "no block snapshot: unknown, not zero");
  assert.deepEqual(s.top.questions, [{ a: A, pts: 2, place: 1 }, { a: D, pts: 1, place: 2 }], "a void question scores nobody; E has 0 points so isn't listed");
  assert.deepEqual(s.top.race, [{ a: C, pts: 4, place: 1 }, { a: D, pts: 1, place: 2 }]);
  assert.deepEqual(s.top.blockx, []);
});

test("a board that hasn't rolled over to this week isn't counted as this week", () => {
  const stale = { v: 1, week: { start: START - W, rows: [{ a: E, pts: 5, picks: 9 }] }, lastWeek: { start: START - 2 * W, rows: [] } };
  const s = buildStats(inputs({ raceBoard: stale, blockxBoard: null }));
  assert.equal(s.plays.racePicks, 0); assert.equal(s.players.week, 2);
  assert.equal(s.players.allTime, 5, "its players still count all-time");
});

test("top 3: ties share a place, never more than 5 rows, only players with points", () => {
  const rows = [C, A, B, D, E].map((a, i) => ({ a, pts: [5, 5, 4, 3, 3][i] }));
  assert.deepEqual(top3(rows).map((r) => r.place), [1, 1, 3]);
  assert.deepEqual(top3([{ a: A, pts: 2 }, { a: B, pts: 1 }, { a: C, pts: 1 }, { a: D, pts: 1 }, { a: E, pts: 1 }]).map((r) => r.place), [1, 2, 2, 2, 2]);
  assert.deepEqual(top3([{ a: A, pts: 0 }, { a: "not an address", pts: 9 }]), []);
});

test("question points: one per answer matching the outcome; open (0) and void (1000) score nothing", () => {
  const p = questionPoints([{ address: A, answers: [{ question_id: 1, option: 0 }, { question_id: 2, option: 3 }, { question_id: 3, option: 0 }, { question_id: 4, option: 0 }] }], new Map([[1, 1], [2, 4], [3, 0], [4, 1000]]));
  assert.deepEqual(p, [{ a: A, pts: 2 }]);
});

test("vault blocks in the last 24 hours, counted back from the newest block; null if the snapshot is shorter", () => {
  const n = 30000, sig = Array.from({ length: n }, (_, i) => (i % 600 === 0 ? 1 : 0)), dts = Array(n).fill(3000);
  const rb = { v: 1, signers: ["1UG4UUn7Da9JqE4PKbYUWgjbNwE5F9531", VAULT], sig, dts };
  assert.equal(blocksBy(rb, VAULT, 24), 48, "28,800 blocks of 3 s = 24 h; one in 600 is the vault's");
  assert.equal(blocksBy({ ...rb, sig: sig.slice(0, 100), dts: dts.slice(0, 100) }, VAULT, 24), null);
  assert.equal(blocksBy({ v: 2 }, VAULT, 24), null);
});

test("checkStats refuses a bad file: text where a number belongs, a non-address, an oversized list", () => {
  const good = buildStats(inputs());
  assert.equal(checkStats(good), null);
  const bad = (f: (s: any) => void) => { const s = JSON.parse(JSON.stringify(good)); f(s); return checkStats(s); };
  assert.ok(bad((s) => { s.players.week = "<img src=x>"; }));
  assert.ok(bad((s) => { s.top.race = [{ a: "<b>evil</b>", pts: 1, place: 1 }]; }));
  assert.ok(bad((s) => { s.staked.games = Array(21).fill(s.staked.games[0]); }));
  assert.ok(bad((s) => { s.staked.total = -1; }));
  assert.ok(bad((s) => { s.v = 2; }));
});

import fs from "node:fs";
test("stats.yml: hourly, off until STATS_ENABLED, no secrets; the check is read-only; publish runs no repo code and pushes only stats-data", () => {
  const y = fs.readFileSync(".github/workflows/stats.yml", "utf8");
  assert.match(y, /cron:\s*"17 \* \* \* \*"/); assert.doesNotMatch(y, /pull_request/); assert.doesNotMatch(y, /\$\{\{\s*secrets\./);
  assert.match(y, /vars\.STATS_ENABLED == 'true' && github\.ref == 'refs\/heads\/main'/);
  const check = y.slice(y.indexOf("  check:"), y.indexOf("  publish:")), publish = y.slice(y.indexOf("  publish:"));
  assert.match(check, /permissions:\s*\n\s*contents: read/); assert.doesNotMatch(check, /contents:\s*write/);
  assert.match(check, /persist-credentials: false/); assert.match(check, /npm run stats -- run/);
  assert.match(publish, /contents: write/);
  for (const bad of [/actions\/checkout/, /npm /, /npx /, /node /, /tsx/]) assert.doesNotMatch(publish, bad, `publish must not run repo code (${bad})`);
  assert.match(publish, /refs\/heads\/stats-data/); assert.doesNotMatch(publish, /refs\/heads\/(main|names-data|race-data|games-data|blocks-data)/);
  assert.match(publish, /force-with-lease="refs\/heads\/stats-data:\$\{BASE\}"/, "replaces the branch only if it is still what the check saw");
  assert.match(publish, /-gt 65536/); assert.match(publish, /addr\.fullmatch\(r\["a"\]\)/);
});

import { gather, pagePlayers } from "../../bot/stats.ts";
test("gather: the week from genesis_time and week_length at chain time, every player page, last week's outcomes", async () => {
  const G = 1792368000000, WL = 7 * 86400000, T = G + 2 * WL + 3 * 86400000;     // week 2, Thursday
  const addrs = Array.from({ length: 120 }, (_, i) => "1" + "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMN".slice(0, 26) + String(100000 + i).replace(/0/g, "z"));
  const seen: any[] = [];
  const list = async (args: any) => {
    seen.push(args);
    const from = args.start ? addrs.indexOf(args.start) + 1 : 0;
    return { rows: addrs.slice(from, from + 50).map((a, i) => ({ address: a, entry: from + i < 3 ? { answers: [{ question_id: args.week === "1" ? 30 + from + i : 50, option: 0 }] } : undefined })) };
  };
  const reader = {
    state: async () => ({ time: String(T), config: { genesis_time: String(G), week_length: String(WL) }, totals: { total_stake: "4825012345678" } }),
    games: async () => ({ games: [{ id: 1, name: "Daily Questions", staked: true, stake: "4000000000000" }] }),
    question: async (id: number) => ({ question: { outcome: id === 30 ? 1 : 0 } }),
    players: (week: string) => pagePlayers(list, week),
  };
  const x = await gather(T, reader, "/nonexistent", []);
  assert.deepEqual(x.week, { start: G + 2 * WL, end: G + 3 * WL });
  assert.equal(x.qAll.length, 120, "every page read");
  assert.deepEqual([...new Set(seen.map((a) => a.week))], ["2", "1"], "this week and last week only");
  assert.equal(x.qWeek.filter((r) => r.answers.length).length, 3);
  assert.deepEqual([...x.outcomes], [[30, 1], [31, 0], [32, 0]]);
  assert.equal(x.totalStake, 4825012345678n);
  const s = buildStats(x);
  assert.equal(checkStats(s), null); assert.equal(s.staked.total, 48250.12); assert.equal(s.top.questions.length, 1);
});
