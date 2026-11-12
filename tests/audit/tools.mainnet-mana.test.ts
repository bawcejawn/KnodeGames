// tools/mainnet-mana.ts (Repo Lens #D-8, D8-1): the pricing arithmetic and which calls carry a 1-Mana limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { manaOf, limitOf } from "../../tools/mainnet-mana.ts";

test("manaOf: ticks × compute price + disk × disk price + network × network price", () => {
  // The v6 testnet doc's 13-game close at its testnet prices (compute 6, disk 7,130, network 1,079) ≈ 0.347 Mana.
  const m = manaOf({ compute: "4627950", disk: "912", network: "415" }, { compute: 6n, disk: 7130n, network: 1079n });
  assert.equal(m, 4627950n * 6n + 912n * 7130n + 415n * 1079n);
  assert.ok(Math.abs(Number(m) / 1e8 - 0.347) < 0.01);
  assert.equal(manaOf({ compute: "0", disk: "0", network: "0" }, { compute: 9n, disk: 9n, network: 9n }), 0n);
});

test("limitOf: sponsored calls fit the owner's per-action limits; own-Mana answers 1, money calls 10; the bot 2", () => {
  for (const k of ["answerA1", "answerA60", "firstAnswerDue", "firstAnswerSettle", "answerOwn", "settleB30"]) assert.equal(limitOf(k), 1, k);
  for (const k of ["depositTo1", "withdrawFrom1", "claimGame"]) assert.equal(limitOf(k), 10, k);
  assert.equal(limitOf("answerSp"), 1.2); assert.equal(limitOf("claimGameSp"), 2.0);
  assert.equal(limitOf("depositTo1Sp"), 2.4); assert.equal(limitOf("withdrawFrom1Sp"), 1.55);
  for (const k of ["closeWeek13", "postResults4", "seal", "finalizeGame"]) assert.equal(limitOf(k), 2, k);
  for (const k of ["upload", "post10", "resolve10"]) assert.equal(limitOf(k), null, k);
});
