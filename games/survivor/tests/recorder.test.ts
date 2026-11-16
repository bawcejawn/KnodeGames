// Survivor (game 3) on the Shared Game Kit: the module on its own, and a whole season week run hour by hour through the
// kit's real recorder (runGame) and publish check, on fake nodes and the ruler's made-up test chain
// (tests/audit/race-ruler.fixture.mjs: 15 days of history from Sat 17 Oct, then blocks to Tue 10 Nov 2026).
//
// Every kit piece Survivor needs is the kit's own here (kit-next, #319): K1 seasonStaked and the season start (scoreRound's
// sixth argument), G7 ctx.blockAt from the fake nodes' block times, K4 the live week, K8 ctx.fallback. K9 (ctx.decided,
// the season's published rounds by how each was decided) isn't in the kit yet: its tests call the module directly.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R, timeline, chain, FROM, N, T_FIRST } from "../../../tests/audit/race-ruler.fixture.mjs";
import { kitConfig, loadManifest } from "../../../kit/recorder/manifest.ts";
import { Replay } from "../../../kit/testing/replay.ts";
import { fakeNode, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, HOUR } from "../../../kit/testing/fake-clock.ts";
import { NotYet, PENDING } from "../../../kit/recorder/types.ts";
import { dayResult, game, makeGame, settingsFor } from "../recorder.ts";
import * as S from "../math.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEEK = 2;                                       // Mon 2 – Sat 7 Nov 2026: inside the test chain
const W = ["a", "b", "c", "d", "e"].map((c) => "1" + c.repeat(33));
const [PA, PB, PC, PD, PE] = ["A", "B", "C", "D", "E"].map((c) => "1" + c.repeat(33));
const cfg = () => kitConfig(loadManifest("survivor", ROOT));
/** The kit config on the test chain's week (game.json firstWeek is mainnet's week 7). */
const cfgAt = (w = WEEK) => ({ ...cfg(), firstWeek: w });
/** The first block at or after `ms` on the test chain (what the kit's ctx.blockAt answers). */
async function blockAt(ms: number) {
  const i = Math.ceil((ms - T_FIRST) / 3000);
  if (i < 0 || i >= N) throw new Error("not yet: that time isn't on the test chain");
  return FROM + i;
}
test("manifest: game.json passes the kit's schema, ships building with the free prize off, 12-day seasons", () => {
  const m = loadManifest("survivor", ROOT);
  assert.equal(m.status, "building");
  assert.equal(m.freePrizeDefault, "off", "new games ship OFF; Survivor's free prize stays OFF");
  assert.equal(m.seasonWeeks, 2);
  assert.equal(m.week.sundayFunRound, false, "Sundays rest: no Sunday round");
  assert.equal(m.vhpData, true);
  assert.equal(m.maxRoundPoints, S.MAX_ROUND_POINTS);
  assert.equal(cfg().cardPerRound, true, "every decided day comes from its own ruler card");
  assert.equal(cfg().liveWeek, true, "K4: players see each day's result the next morning");
  assert.equal(m.firstWeek ?? null, S.FIRST_WEEK, "game.json firstWeek must be math.js FIRST_WEEK: the kit counts seasons from the first recorded week");
  const pin = JSON.parse(fs.readFileSync(path.join(ROOT, "game-data/deployment.json"), "utf8")).vaultGames["3"].kit;
  assert.deepEqual(pin, { payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, sundayFunRound: false, roundsCorrectable: false, liveWeek: true, seasonWeeks: 2 }, "the vault pin (KC-26)");
});

test("rounds: none before Season 1 or with no launch set; then Monday to Saturday, Picks round = the UTC day number", () => {
  const span = (w: number) => ({ week: w, start: S.weekStart(w), end: S.weekStart(w + 1) });
  assert.deepEqual(game.roundsFor(span(6), { now: 0 }), [], "mainnet: nothing before Season 1 (week 7)");
  assert.equal(game.roundsFor(span(7), { now: 0 })[0].id, "d20261207", "mainnet: Season 1 day 1 is Mon 7 Dec");
  assert.deepEqual(makeGame(null).roundsFor(span(WEEK), { now: 0 }), [], "no launch set: no rounds");
  const rs = makeGame(WEEK).roundsFor(span(WEEK), { now: 0 });
  assert.equal(rs.length, 6);
  assert.equal(rs[0].id, "d20261102");
  assert.equal(rs[5].id, "d20261107");
  for (const r of rs) { assert.equal(r.locksAt, r.day + S.DAY, "the kit's day key: the end of its own day"); assert.equal(r.pickRound, r.day / S.DAY); assert.equal(r.resolvesAt, r.day + S.DAY); }
  assert.throws(() => makeGame(WEEK).roundsFor({ week: WEEK, start: S.weekStart(WEEK) + 1, end: 0 }, { now: 0 }), /disagree/);
});

test("state: a day-1 pick joins; later picks only for wallets in; a changed pick replaces the day; a new season starts empty", () => {
  const g = makeGame(WEEK);
  const d1 = { id: "d1", day: S.weekStart(WEEK), locksAt: 0, resolvesAt: 0 }, d2 = { ...d1, day: S.weekStart(WEEK) + S.DAY };
  const pick = (w: string, a: string) => ({ wallet: w, round: "x", pick: { producers: [a] }, at: 1 });
  let st = g.nextState!(new Map(), [pick(W[0], PA), pick(W[1], "not an address")], d1);
  assert.deepEqual([...st.keys()], [W[0]]);
  st = g.nextState!(st, [pick(W[0], PB), pick(W[2], PC)], d2);
  assert.deepEqual(st.get(W[0]), { p: [[1, PA], [2, PB]] });
  assert.ok(!st.has(W[2]), "a wallet can't join after day 1");
  st = g.nextState!(st, [pick(W[0], PC)], d2);
  assert.deepEqual(st.get(W[0]), { p: [[1, PA], [2, PC]] });
  assert.equal(g.carryIn!(st, { week: WEEK, start: S.weekStart(WEEK), end: 0 }).size, 0, "the season's first week starts empty");
  assert.deepEqual(g.carryIn!(st, { week: WEEK + 1, start: S.weekStart(WEEK + 1), end: 0 }).get(W[0]), { p: [[1, PA], [2, PC]] });
  assert.equal(g.carryIn!(st, { week: WEEK + 2, start: S.weekStart(WEEK + 2), end: 0 }).size, 0, "Season 2 starts empty");
});

test("result: PENDING without the ruler or ctx.blockAt (never a guess); the card's window is the day and its lock", async () => {
  const g = makeGame(WEEK), r = { id: "d", day: S.weekStart(WEEK), locksAt: 0, resolvesAt: 0 };
  assert.equal(await g.resultOf(r, null as any, undefined, {}), PENDING);
  assert.equal(await g.resultOf(r, null as any, undefined, { vhp: { card() { throw new Error("no"); } } } as any), PENDING, "no ctx.blockAt yet (kit G7)");
  const s = await settingsFor(S.weekStart(WEEK), blockAt);
  const i0 = (s.window.S0 - FROM), i1 = (s.window.S1 - FROM), iL = (s.window.L - FROM);
  assert.ok(chain.ts[i0] >= S.weekStart(WEEK) && chain.ts[i0 - 1] < S.weekStart(WEEK), "S0: the day's first block");
  assert.ok(chain.ts[i1] < S.weekStart(WEEK) + S.DAY && chain.ts[i1 + 1] >= S.weekStart(WEEK) + S.DAY, "S1: the day's last block");
  assert.ok(chain.ts[iL] < S.lockTime(S.weekStart(WEEK)) && chain.ts[iL + 1] >= S.lockTime(S.weekStart(WEEK)), "L: the last block a pick can land in");
  assert.equal(s.window.W1 - s.window.W0 + 1, 7200);
  assert.equal(s.round, "20261102");
});

test("scoreRound refuses to guess the boards (K1) and stops when the kit's season isn't math.js's", () => {
  const g = makeGame(WEEK), r = { id: "d", day: S.weekStart(WEEK), locksAt: 0, resolvesAt: 0 };
  const res = { round: "x", n: 1, field: [], out: [], void: [] };
  const inp = { season: 1, days: [], waiting: null };
  assert.throws(() => g.scoreRound(r, [], res, inp, new Map()), /kit need K1/);
  assert.throws(() => (g.scoreRound as any)(r, [], res, inp, new Map(), { seasonStaked: new Set() }), /isn't math.js's/, "no season start");
  assert.throws(() => (g.scoreRound as any)(r, [], res, inp, new Map(), { seasonStaked: new Set(), seasonStart: WEEK - 1, seasonWeek: 2 }), /isn't math.js's/, "a week apart");
  assert.equal((g.scoreRound as any)(r, [], res, inp, new Map(), { seasonStaked: new Set(), seasonStart: WEEK, seasonWeek: 1 }).size, 0);
  const r2 = { ...r, day: S.weekStart(WEEK + 1) };
  assert.throws(() => (g.scoreRound as any)(r2, [], { ...res, n: 7 }, inp, new Map(), { seasonStaked: new Set(), seasonStart: WEEK + 1, seasonWeek: 1 }), /isn't math.js's/, "the kit started a new season on the season's second week");
  // J12-1 (owner 16 Nov, option a): in the season's second week the board is the first week's stakers (kit K1b).
  const wk2 = { seasonStaked: new Set([W[0], W[1]]), seasonStart: WEEK, seasonWeek: 2 };
  assert.throws(() => (g.scoreRound as any)(r2, [], { ...res, n: 7 }, inp, new Map(), wk2), /K1b/, "no board guessed in week 2");
});

// ── a day with no ruler card (owner 14 Nov: the day doesn't count) ──
const noCard = { loaded: true, card() { throw new NotYet("not yet: no data for that day"); } };
const D0 = S.weekStart(WEEK), ID0 = "d20261102";
test("no card: without the kit's record of the season's rounds (K9) the day waits, never a skip", async () => {
  await assert.rejects(dayResult(D0, 1, { vhp: noCard, blockAt }), NotYet);
  await assert.rejects(dayResult(D0, 1, { vhp: noCard, blockAt, fallback: async () => {} }), NotYet, "ctx.fallback alone isn't enough");
});
test("no card: with K9 the day doesn't count once the first block 48 h after its end exists, recorded through ctx.fallback", async () => {
  const why: string[] = [];
  const fb = async (w: string) => { why.push(w); };
  const late = async (ms: number) => { if (ms >= D0 + S.DAY + S.NO_CARD_GRACE_MS) throw new NotYet("not yet: that block isn't irreversible"); return blockAt(ms); };
  await assert.rejects(dayResult(D0, 1, { vhp: noCard, blockAt: late, decided: new Map() }, fb), NotYet, "inside the 48 h: waits");
  assert.deepEqual(why, []);
  const d = await dayResult(D0, 1, { vhp: noCard, blockAt, decided: new Map() }, fb);
  assert.deepEqual(d, S.skipDay("20261102", 1));
  assert.deepEqual(why, [S.SKIP_WHY]);
  await assert.rejects(dayResult(D0, 1, { vhp: { ...noCard, loaded: false }, blockAt, decided: new Map() }, fb), NotYet, "no skip without this run's ruler data (#G-69 G69-2)");
  await assert.rejects(dayResult(D0, 1, { vhp: noCard, blockAt, decided: new Map([[ID0, "card"]]) }, fb), NotYet, "a day decided with its card is never skipped later");
});
test("no card: a day published as skipped stays skipped even when its card turns up later", async () => {
  const card = { loaded: true, card() { throw new Error("must not be read"); } };
  const why: string[] = [];
  const d = await dayResult(D0, 1, { vhp: card, blockAt, decided: new Map([[ID0, "fallback"]]) }, async (w) => { why.push(w); });
  assert.equal(d !== PENDING && (d as any).skip, true);
  assert.deepEqual(why, [S.SKIP_WHY], "re-recorded through ctx.fallback so the round needs no card");
});
test("no card: a skipped day costs nobody a life and uses no pick; the next day is still day 2", () => {
  const field: [string, number][] = [[PA, 900], [PB, 700], [PC, 500], [PD, 300], [PE, 100]];
  const day = (n: number) => ({ round: String(n), n, field, out: S.outOf(field, n), void: [] });
  const picks = new Map([[W[0], [[1, PE], [2, PE]] as [number, string][]], [W[1], [[2, PA]] as [number, string][]], [W[2], [[1, PA], [2, PA]] as [number, string][]]]);
  const r = S.playSeason([S.skipDay("1", 1), day(2)], picks, new Set());
  const a = r.players.get(W[0])!;
  assert.equal(a.lives, 1, "day 1 skipped (no life for PE), day 2 PE out: one life lost");
  assert.equal(a.log, "-o");
  assert.deepEqual(a.used, [PE], "the skipped day's pick isn't used, so PE can be picked on day 2");
  assert.ok(!r.players.has(W[1]), "still no join after day 1: you join with a pick for day 1, even a skipped one");
  assert.equal(r.players.get(W[2])!.log, "-s");
  assert.equal(r.players.get(W[2])!.days, 1, "a skipped day isn't a day played");
  const pts = S.roundPoints([S.skipDay("1", 1)], picks, new Set(), 1, true);
  assert.ok([...pts.values()].every((p) => p === S.standingOf({ days: 0, lives: 2, total: 0 })), "a skipped day 1 scores only the starting lives");
});
test("resultOf waits (NotYet, never a stopped run) until the inputs have every earlier day of the season", async () => {
  const g = makeGame(WEEK), r = { id: "d20261103", day: D0 + S.DAY, locksAt: 0, resolvesAt: 0 };
  await assert.rejects(g.resultOf(r, null as any, { season: 1, days: [], waiting: "x" }, { vhp: noCard, blockAt } as any), NotYet);
});

// ── a whole week through the kit ──
const stake = (vhp: number) => ({ week_stake: String(vhp * 1e8), peak_stake: String(vhp * 1e8) });
function seasonWorld(picks: Record<string, string[]>, staked: string[]): World {
  const wd = world(at(WEEK + 1, 0, 3), { gamePlayers: Object.fromEntries(staked.map((a) => [a, stake(2)])) });
  wd.config.v6_rule_week_plus_one = "1";
  wd.lib = FROM + N - 1;                              // G7: the kit's blockAt reads the test chain's block times
  wd.blockT0 = T_FIRST - FROM * 3000;
  wd.picks = {};
  for (const [a, xs] of Object.entries(picks)) xs.forEach((p, i) => {
    if (!p) return;
    const day = S.weekStart(WEEK) + i * S.DAY, key = `3:${day / S.DAY}`;
    (wd.picks![key] ??= []).push({ player: a, pick: { producers: [p], time: String(day - S.DAY) } });
  });
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];

test("end to end: a season's first week through the kit's recorder and publish check goes final, and its board is the season's standings", async () => {
  const picks = { [W[0]]: [PA, PB, PC, PD, PE, PA], [W[1]]: [PE, PD, PC, PB, PA, PE], [W[2]]: [PB, PB, PC, PD, PE, PA], [W[3]]: [PC, null, PA, PB, PD, PE], [W[4]]: [null, PA, PB, PC, PD, PE] };
  const staked = [W[0], W[1]];
  const wd = seasonWorld(picks, staked), L = R.ledger(timeline());
  const m = makeGame(WEEK), rp = new Replay(m as any, cfgAt());
  let h: any;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += HOUR; }
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "final", JSON.stringify(h.result?.alerts));
  assert.deepEqual(h.held, [], JSON.stringify(h.held));
  const wk = rp.read("W002.json");
  assert.ok(fs.existsSync(path.join(rp.pub, "W002", "manifest.json")), "published as a KG parts v1 folder");
  assert.equal(wk.rounds.length, 6, "six play days, no Sunday round");
  assert.ok(wk.rounds.every((r: any) => r[3] === "s"), "every day decided from its ruler card");
  assert.equal(wk.cards.length, 6, "one ruler card per day, listed for the publish job's rebuild");

  // The same season by math.js alone, from the same cards: the week's points are each wallet's standing after day 6.
  const days: any[] = [];
  for (let n = 1; n <= 6; n++) {
    const day = S.weekStart(WEEK) + (n - 1) * S.DAY, s = await settingsFor(day, blockAt);
    days.push(S.dayFromCard(JSON.parse(R.cardJson(R.scoreCard(L, R.makeCard(L, { ...s, c: BigInt(s.c) })))), n));
  }
  const want = S.playSeason(days, new Map(Object.entries(picks).map(([a, xs]) => [a, xs.map((p, i) => [i + 1, p]).filter((x) => x[1])])), new Set(staked)).players;
  const tally = new Map<string, number>();
  for (const r of wk.rounds) for (const row of r[4]) { const a = wk.players[row[0]][0]; tally.set(a, (tally.get(a) ?? 0) + row[1]); }
  for (const [a, x] of want) assert.equal(tally.get(a) ?? 0, x.standing, `${a}: week points = season standing after day 6`);
  assert.equal(tally.get(W[4]) ?? 0, 0, "a wallet with no day-1 pick isn't in the season");

  const board = rp.read("board.json");
  assert.ok(board, "board.json written");
  const v = rp.read("vault/W2.json");
  assert.ok(v, "vault file written");
  const rows = v.rows.map((x: any) => x.player);
  assert.ok(rows.every((a: string) => staked.includes(a)), "only staked wallets get staked rows");
});

test("end to end: with no ruler data the days stay pending and nothing is guessed", async () => {
  const wd = seasonWorld({ [W[0]]: [PA, PB, PC, PD, PE, PA] }, []);
  const rp = new Replay(makeGame(WEEK) as any, cfgAt());
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "pending");
  assert.ok(rp.read("W002.json").rounds.every((r: any) => r[3] === "p"));
});
