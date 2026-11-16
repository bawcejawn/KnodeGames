// Repo Lens #J-12b (PR #332 @ ee723070), J12b-1: week 2's board must be taken through scoreRound itself, not only through
// stakedBoard. In the season's second week the kit's seasonStaked also holds week-2-only stakers; scoreRound must score
// on the kit's firstStaked (K1b). Mutation check: making scoreRound use season.seasonStaked again (with stakedBoard still
// called) passes every other test; this one fails. Put in games/survivor/tests/.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../math.js";
import { makeGame } from "../recorder.ts";

const FIRST = 7;                                         // the season's first week (math.js FIRST_WEEK on mainnet)
const P = (i) => "1P" + "123456789"[i] + "Z".repeat(30);
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
// Days 1-7 on the same field of 8 producers (scores 0..700). Day 1: A and B pick in the out-zone, C picks safe.
const field = Array.from({ length: 8 }, (_, i) => [P(i), i * 100]);
const day = (n) => ({ round: `r${n}`, n, field: [...field].sort((x, y) => y[1] - x[1]), out: S.outOf(field, n), void: [] });
const days = Array.from({ length: 7 }, (_, i) => day(i + 1));
const state = new Map([[A, { p: [[1, P(0)]] }], [B, { p: [[1, P(1)]] }], [C, { p: [[1, P(7)]] }]]);

const g = makeGame(FIRST);
const mon2 = S.weekStart(FIRST + 1);                     // the season's second week: its Monday is season day 7
const round = { id: "d", day: mon2, locksAt: 0, resolvesAt: 0 };
const score = (ctx) => (g.scoreRound)(round, [], days[6], { season: 1, days, waiting: null }, state, ctx);
const pts = (m) => Object.fromEntries([...m].map(([a, v]) => [a, v.points]));

test("J12b-1: in week 2, scoreRound scores on the first week's stakers, whatever seasonStaked holds", () => {
  const base = { seasonStart: FIRST, seasonWeek: 2 };
  const right = pts(score({ ...base, seasonStaked: new Set([A, B, C]), firstStaked: new Set([A, B]) }));
  const asIfWeek1 = pts(score({ ...base, seasonStaked: new Set([A, B]), firstStaked: new Set([A, B]) }));
  const cOnBoard = pts(score({ ...base, seasonStaked: new Set([A, B, C]), firstStaked: new Set([A, B, C]) }));
  assert.deepEqual(right, asIfWeek1, "a week-2-only staker (C) must change nothing");
  assert.notDeepEqual(right, cOnBoard, "precondition: C on the staked board would change A's season (day 1's net)");
});
