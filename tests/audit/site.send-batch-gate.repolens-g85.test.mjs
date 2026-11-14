// Repo Lens #G-85 (PR #321): one gate for the card and for sendBatch.
// G85-1: sendBatch groups picks only when batchReady() is true, so a half-filled batch config, the Kondor payer or a
//        caller that skips the check still sends each pick alone.
// G85-2: batchReady() needs at least one usable perOp row (a 1 to 16 digit string), not just any key.
// Run: node --test tests/audit/site.send-batch-gate.repolens-g85.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const w = fs.readFileSync("wallet.js", "utf8");
const ready = w.match(/function batchReady\(\) \{[\s\S]*?\n  \}\n/);
const run = (W) => new Function("W", `${ready[0]}; return batchReady();`)(W);
const ok = { fixed: "100", margin: "50", perOp: { "abc:0000000a": "10" } };
const sp = (batch, payer = "sponsor") => ({ payer, sponsor: batch === undefined ? {} : { batch } });

test("G85-1: sendBatch reads perOp only through batchReady()", () => {
  const body = w.slice(w.indexOf("async function sendBatch"), w.indexOf("async function sendBatch") + 3000);
  assert.match(body, /const bt = batchReady\(\) \? W\.sponsor\.batch\.perOp : null;/);
  assert.doesNotMatch(body, /const bt = W\.sponsor && W\.sponsor\.batch && W\.sponsor\.batch\.perOp/);
  assert.match(body, /const together = bt \? live\.filter\(\(o\) => typeof bt\[opKey\(o\)\] === "string"\) : live\.slice\(0, 1\);/, "gate off: one pick per transaction");
});

test("G85-1b: the cases where sendBatch must not group are exactly the ones batchReady() turns off", () => {
  assert.equal(run(sp({ perOp: ok.perOp })), false, "perOp rows, no measured fixed/margin");
  assert.equal(run(sp({ ...ok, margin: undefined })), false, "no margin");
  assert.equal(run(sp(ok, "kondor")), false, "Kondor payer");
  assert.equal(run(sp(ok)), true, "measured numbers through the sponsor");
});

test("G85-2: a perOp row that isn't a base-unit string doesn't turn the card on", () => {
  assert.equal(run(sp({ ...ok, perOp: { "abc:0000000a": 10 } })), false, "number, not a string");
  assert.equal(run(sp({ ...ok, perOp: { "abc:0000000a": "1e3" } })), false, "not digits");
  assert.equal(run(sp({ ...ok, perOp: { "abc:0000000a": 10, "abc:0000000b": "12" } })), true, "one usable row is enough");
});
