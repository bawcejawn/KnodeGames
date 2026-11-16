// Owner, Sat 14 Nov 2026: week 4 is a free test week and week 5, the first real week, starts with no teams. Test week
// 4's final teams never carry into week 5; from week 6 on, last week's team carries as before (FC-5).
import test from "node:test";
import assert from "node:assert/strict";
import { game, FIRST_REAL_WEEK } from "../recorder.ts";
import { DAY } from "../../../kit/recorder/clock.ts";
import * as F from "../math.js";

const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"];
const W = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const team = [P[1], P[0], P[2], P[3], P[4]];
const span = (week: number) => ({ week, start: week * 7 * DAY, end: (week + 1) * 7 * DAY });
const inputsFor = (week: number) => ({ start: week * 7 * DAY, budget: 100, pool: P.map((a) => ({ a, price: 10 })) }) as any;

test("fresh start: the first real week (5) carries no team from test week 4", () => {
  assert.equal(FIRST_REAL_WEEK, 5);
  const inputs = inputsFor(5);
  assert.ok(F.checkTeam(team, inputs).ok, "the team fits week 5's prices, so only the fresh-start rule drops it");
  const last = new Map([[W, { t: team, at: 1 }]]);
  assert.equal(game.carryIn!(last, span(5), inputs).size, 0);
});

test("fresh start: from week 6 on, a team that still fits carries into Monday as before (FC-5)", () => {
  const inputs = inputsFor(6);
  const last = new Map([[W, { t: team, at: 1 }]]);
  const out = game.carryIn!(last, span(6), inputs);
  assert.deepEqual(out.get(W)?.t, team);
});
