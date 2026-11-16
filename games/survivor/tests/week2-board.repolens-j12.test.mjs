// Repo Lens #J-12 (PR #332 @ 1eb403fa), J12-1: a wallet that stakes only in a season's SECOND week must not change a day
// already published. Owner, 16 Nov (option a): the staked board is the wallets staked in the season's FIRST week; a
// week-2-only staker plays Free play all season. Repo Lens's test (it failed on 1eb403fa), with week 2's board taken the
// way the recorder now takes it (recorder.ts stakedBoard: the kit's firstStaked, K1b).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../math.js";
import { stakedBoard } from "../recorder.ts";

const P = (i) => "1P" + "123456789"[i] + "Z".repeat(30);
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
// Day 1: a field of 8 producers, scores 0..700; out-zone on day 1 = floor(8 × 11 / 44) = 2 lowest (P(0), P(1)).
const field = Array.from({ length: 8 }, (_, i) => [P(i), i * 100]);
const day1 = { round: "20261207", n: 1, field: [...field].sort((x, y) => y[1] - x[1]), out: S.outOf(field, 1), void: [] };
const picks = new Map([[A, [[1, P(0)]]], [B, [[1, P(1)]]], [C, [[1, P(7)]]]]);

test("J12-1: staking in week 2 doesn't change an earlier, published day for other staked players", () => {
  assert.deepEqual(day1.out, [P(0), P(1)].sort());
  // Week 1's final file: A and B staked, C free. Every staked pick is out → the staked net saves both (log "v").
  const b1 = stakedBoard({ seasonStaked: new Set([A, B]), seasonStart: 7, seasonWeek: 1 });
  const w1 = S.playSeason([day1], picks, b1).players;
  assert.equal(w1.get(A).lives, 2); assert.equal(w1.get(A).log, "v");
  // Week 2: C stakes (only in week 2). The kit's seasonStaked now has A, B and C; the board is still week 1's.
  const b2 = stakedBoard({ seasonStaked: new Set([A, B, C]), firstStaked: new Set([A, B]), seasonStart: 7, seasonWeek: 2 });
  assert.deepEqual([...b2].sort(), [A, B]);
  const w2 = S.playSeason([day1], picks, b2).players;
  assert.equal(w2.get(A).lives, w1.get(A).lives, "A's day-1 life changed after week 1 was final");
  assert.equal(w2.get(A).log, w1.get(A).log);
  assert.equal(w2.get(C).board, "free", "a week-2-only staker plays Free play all season");
});

test("J12-1: in the season's second week no board is guessed without the kit's first-week stakers (K1b)", () => {
  assert.throws(() => stakedBoard({ seasonStaked: new Set([A, B, C]), seasonStart: 7, seasonWeek: 2 }), /K1b/);
  assert.throws(() => stakedBoard(undefined), /kit need K1/);
});
