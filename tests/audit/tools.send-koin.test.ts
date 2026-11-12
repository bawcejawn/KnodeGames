// tools/send-koin.ts (docs/WALLETS.md step 1): only checked command lines get through; nothing is sent here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, REFUSED, FROM, MAX_KOIN } from "../../tools/send-koin.ts";

const W = "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz";

test("send-koin: a good command line is a dry run unless --send", () => {
  assert.deepEqual(plan(["--to", W, "--confirm", W, "--amount", "10"]), { to: W, amount: 1_000_000_000n, send: false });
  assert.equal(plan(["--to", W, "--confirm", W, "--amount", "2.5", "--send"]).send, true);
  assert.equal(plan(["--to", W, "--confirm", W, "--amount", "20"]).amount, MAX_KOIN);
});

test("send-koin: refuses a mistyped confirmation, contracts, tokens, the sender, bad amounts", () => {
  assert.throws(() => plan(["--to", W, "--confirm", W.slice(0, -1) + "y", "--amount", "10"]), /exactly the same address/);
  assert.throws(() => plan(["--to", W, "--amount", "10"]), /exactly the same address/);
  for (const a of Object.keys(REFUSED)) assert.throws(() => plan(["--to", a, "--confirm", a, "--amount", "1"]), /never send KOIN there/, a);
  assert.ok(REFUSED[FROM]);
  for (const amt of ["0", "20.00000001", "21", "-1", "1e3", "abc", "1.123456789"]) assert.throws(() => plan(["--to", W, "--confirm", W, "--amount", amt]), /--amount/, amt);
  assert.throws(() => plan(["--to", "nope", "--confirm", "nope", "--amount", "1"]), /Koinos address/);
});
