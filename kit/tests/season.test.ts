// K1 (Survivor, 13 Nov): scoreRound's 6th argument for a season game (game.json seasonWeeks): seasonStaked, the
// wallets with a counted stake in ANY week of the season so far; the season's first week recorded in each week file.
// Option (a), the Library, 14 Nov: the first week is the game's first week (or <SLUG>_RESET_FROM_WEEK), then every
// seasonWeeks weeks.
import test from "node:test";
import assert from "node:assert/strict";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import type { GameModule, SeasonCtx } from "../recorder/types.ts";

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const seen = new Map<number, SeasonCtx>();
const g: GameModule<any, any, any> = {
  ...exampleGame,
  scoreRound(round, picks, result, inputs, state, season) {
    if (season) seen.set(Math.floor((round.locksAt - at(0)) / (7 * DAY)), season);
    return exampleGame.scoreRound(round, picks, result, inputs, state);
  },
};
const cfg = { ...exampleCfg(), seasonWeeks: 2 };
const entry = (a: string, staked: boolean, ids: number[]) => ({ address: a, entry: { stake: staked ? "500000000" : "0", peak_stake: staked ? "500000000" : "0", voided: false, answers: ids.map((q) => ({ question_id: q, option: 0 })) } });

function qworld() {
  const wd = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(at(4) - DAY) };
  let id = 201;
  const ids: Record<number, number[]> = {};
  for (const wk of [4, 5, 6]) { ids[wk] = []; for (let i = 0; i < 2; i++) { wd.questions[id] = { week: String(wk), outcome: 1, lock_time: String(at(wk) + (i + 1) * DAY) }; ids[wk].push(id++); } }
  wd.next = id;
  wd.players = [];
  wd.playersByWeek = {
    4: [entry(A, true, ids[4]), entry(B, false, ids[4])],          // A staked in week 4
    5: [entry(B, false, ids[5]), entry(C, true, ids[5])],          // A sits out week 5; C stakes
    6: [entry(B, true, ids[6])],                                   // a new season: only B
  };
  return wd;
}
const nodes = (wd: any): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
async function weekTo(rp: Replay, wd: any, w: number) {
  wd.time = at(w + 1, 0, 2);
  let h;
  for (let i = 0; i < 3; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000); assert.equal(h.error, undefined, h.error); wd.time += H; }
  return h!;
}

test("K1: seasonStaked spans the season so far; the season's first week is recorded; a new season starts afresh", async () => {
  seen.clear();
  const wd = qworld(), rp = new Replay(g, cfg);
  await weekTo(rp, wd, 4);
  assert.equal(rp.read("W004.json").state, "final");
  assert.equal(rp.read("W004.json").season, 4, "the game's first week starts season 1");
  assert.deepEqual([...seen.get(4)!.seasonStaked].sort(), [A]);
  await weekTo(rp, wd, 5);
  assert.equal(rp.read("W005.json").season, 4, "week 5 is the season's second week");
  assert.deepEqual([...seen.get(5)!.seasonStaked].sort(), [A, C], "A staked in week 4 (from its final file), C this week");
  assert.equal(seen.get(5)!.seasonWeek, 2);
  await weekTo(rp, wd, 6);
  assert.equal(rp.read("W006.json").season, 6, "week 6 starts a new season (every 2 weeks)");
  assert.deepEqual([...seen.get(6)!.seasonStaked].sort(), [B]);
});

test("K1: a season week waits while an earlier week of its season isn't final; the publish check requires the season key", async () => {
  seen.clear();
  const wd = qworld(), rp = new Replay(g, cfg);
  wd.time = at(5, 0, 2);
  await rp.hour(nodes(wd), wd.time + 5 * 60000);                   // week 4 published pending, not final
  assert.equal(rp.read("W004.json").state, "pending");
  // jump to week 6's first hour: week 5's run needs week 4 final
  const rp2 = new Replay(g, cfg);
  (rp2 as any).pub = (rp as any).pub;
  wd.time = at(6, 0, 2);
  const h = await rp2.hour(nodes(wd), wd.time + 5 * 60000);
  assert.ok(h.result!.alerts.errors.some((x: string) => /waits on week 4/.test(x)), JSON.stringify(h.result!.alerts.errors));
  const { weekShape } = await import("../publish/check.inline.mjs");
  const j = rp.read("W004.json"), { season, ...noSeason } = j; void season;
  assert.equal(weekShape(j, "W004.json", cfg), "");
  assert.match(weekShape(noSeason, "W004.json", cfg), /must name its season/);
  assert.match(weekShape(j, "W004.json", exampleCfg()), /season in a game without seasons/);
  assert.match(weekShape({ ...j, season: 2 }, "W004.json", cfg), /bad season/);
});
