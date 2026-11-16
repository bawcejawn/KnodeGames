// Repo Lens #J-12b (PR #332 @ ee723070), J12b-2: the page puts a week-2-only staker on Free play (owner 16 Nov, J12-1,
// option a): survivor.js seasonView takes the staked board from the season's FIRST week only. Mutation check: removing
// `if (wk === weeks[0])` passes every other test; this one fails. Put in games/survivor/tests/.
import { test } from "node:test";
import assert from "node:assert/strict";
const { seasonView } = await import("../../../survivor.js");

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
// [wallet, ?, peak stake, voided], as the kit's week file players; min 1 VHP in base units.
const MIN = "100000000";
const wk = (players, rows) => ({ players, min: MIN, fallbacks: [], pk: new Map(), rounds: [["d1", 0, null, "s", rows]] });
const pts = (1 * 3 + 2) * 2 ** 14 + 500;                // one day lasted, 2 lives, total 500 (math.js standingOf)

test("J12b-2: the page's staked board is the first week's stakers; a week-2-only stake leaves the wallet on Free play", () => {
  const w1 = wk([[A, "", MIN, 0], [C, "", "0", 0]], [[A, pts], [C, pts]]);
  const w2 = wk([[A, "", MIN, 0], [C, "", MIN, 0]], [[A, pts], [C, pts]]);
  const v = seasonView([w1, w2]);
  const board = Object.fromEntries(v.players.map((x) => [x.a, x.board]));
  assert.equal(board[A], "staked");
  assert.equal(board[C], "free", "C staked only in the season's second week");
});
