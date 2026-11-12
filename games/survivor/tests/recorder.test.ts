// Survivor (game 3) on the Shared Game Kit: the module on its own, and a whole season week run hour by hour through the
// kit's real recorder (runGame) and publish check, on fake nodes and the ruler's made-up test chain
// (tests/audit/race-ruler.fixture.mjs: 15 days of history from Sat 17 Oct, then blocks to Tue 10 Nov 2026).
//
// Two kit pieces aren't on main yet, so the end-to-end test supplies them the way the kit will (kit needs, docs/SURVIVOR.md):
//  - K1: scoreRound's sixth argument { seasonStaked }: the wallets on the staked board this season;
//  - G7: ctx.blockAt(ms), the first block at or after a time (Architecture's branch kit-blockat).
// The module itself is unchanged: the test only adds those two arguments around it.
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
import { PENDING } from "../../../kit/recorder/types.ts";
import { game, makeGame, settingsFor } from "../recorder.ts";
import * as S from "../math.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEEK = 2;                                       // Mon 2 – Sat 7 Nov 2026: inside the test chain
const W = ["a", "b", "c", "d", "e"].map((c) => "1" + c.repeat(33));
const [PA, PB, PC, PD, PE] = ["A", "B", "C", "D", "E"].map((c) => "1" + c.repeat(33));
const PIN = { payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, sundayFunRound: false, roundsCorrectable: false, liveWeek: false };
const dep = () => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "game-data/deployment.json"), "utf8"));
  d.vaultGames["3"] = { ...d.vaultGames["3"], kit: PIN };           // the pin the Vault chat adds (needs list)
  return d;
};
const cfg = () => kitConfig(loadManifest("survivor", ROOT), dep());

/** The first block at or after `ms` on the test chain (what the kit's ctx.blockAt answers). */
async function blockAt(ms: number) {
  const i = Math.ceil((ms - T_FIRST) / 3000);
  if (i < 0 || i >= N) throw new Error("not yet: that time isn't on the test chain");
  return FROM + i;
}
/** The module with the two kit pieces a test adds (K1, G7); everything else is the module as it ships. */
function wired(staked: Set<string>, first = WEEK) {
  const base = makeGame(first);
  return {
    ...base,
    inputsFor: (w: any, ctx: any) => base.inputsFor!(w, { ...ctx, blockAt }),
    resultOf: (r: any, rd: any, i: any, ctx: any) => base.resultOf(r, rd, i, { ...ctx, blockAt }),
    scoreRound: (r: any, p: any, res: any, i: any, st: any) => (base.scoreRound as any)(r, p, res, i, st, { seasonStaked: staked }),
  };
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
});

test("rounds: none before the launch is set; then Monday to Saturday, Picks round = the UTC day number", () => {
  const span = (w: number) => ({ week: w, start: S.weekStart(w), end: S.weekStart(w + 1) });
  assert.deepEqual(game.roundsFor(span(WEEK), { now: 0 }), [], "mainnet: FIRST_WEEK is null");
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

test("scoreRound refuses to guess the boards: it needs the season's staked wallets from the kit (K1)", () => {
  const g = makeGame(WEEK), r = { id: "d", day: S.weekStart(WEEK), locksAt: 0, resolvesAt: 0 };
  const res = { round: "x", n: 1, field: [], out: [], void: [] };
  assert.throws(() => g.scoreRound(r, [], res, { season: 1, days: [], waiting: null }, new Map()), /kit need K1/);
});

// ── a whole week through the kit ──
const stake = (vhp: number) => ({ week_stake: String(vhp * 1e8), peak_stake: String(vhp * 1e8) });
function seasonWorld(picks: Record<string, string[]>, staked: string[]): World {
  const wd = world(at(WEEK + 1, 0, 3), { gamePlayers: Object.fromEntries(staked.map((a) => [a, stake(2)])) });
  wd.config.v6_rule_week_plus_one = "1";
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
  const m = wired(new Set(staked)), rp = new Replay(m as any, cfg());
  let h: any;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += HOUR; }
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "final", JSON.stringify(h.result?.alerts));
  assert.deepEqual(h.held, [], JSON.stringify(h.held));
  const wk = rp.read("W002.json");
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
  const rp = new Replay(wired(new Set()) as any, cfg());
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "pending");
  assert.ok(rp.read("W002.json").rounds.every((r: any) => r[3] === "p"));
});
