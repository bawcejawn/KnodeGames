// "Send my picks" on Block X (Capacity ask 13 Nov, PR B): nothing shows until the wallet reports batch settings; picks
// are dropped right before signing; the failure text is the one Capacity approved.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js = fs.readFileSync("blockx.js", "utf8"), w = fs.readFileSync("wallet.js", "utf8");

test("the bar and the Add button exist only behind W.batchReady (the sponsor's batch row)", () => {
  assert.match(js, /const batchOn = \(\) => !!\(W && typeof W\.batchReady === "function" && W\.batchReady\(\)/);
  assert.match(js, /const add = batchOn\(\) \? /);
  assert.match(js, /if \(!batchOn\(\) \|\| !queue\.size\) \{ bar\.hidden = true/);
  assert.match(w, /batchReady: batchReady,/);
});
test("at most 10 per transaction, locked rounds dropped right before signing, the daily picks counted", () => {
  assert.match(js, /\.slice\(0, 10\)/);
  assert.match(js, /stillOpen: \(o\) => open\(o\.__round\)/);
  assert.match(js, /used \+ rounds\.length > max/);
  assert.match(js, /Nothing was saved; a round had locked\. Try again\./);
});
test("a single pick still goes through sendPick exactly as before", () => {
  assert.match(js, /W\.send\(`pick \$\{nameOf\(producer\)\} for block/);
});

test("batchReady is off for a missing batch, batch {}, an empty perOp or missing fixed/margin; on only with measured numbers (Block X chat, 14 Nov)", () => {
  const m = w.match(/function batchReady\(\) \{[\s\S]*?\n  \}\n/);
  assert.ok(m, "batchReady is a named function");
  const make = (W) => new Function("W", `${m[0]}; return batchReady();`)(W);
  const ok = { fixed: "100", margin: "50", perOp: { "abc:0000000a": "10" } };
  const sp = (batch, payer = "sponsor") => ({ payer, sponsor: batch === undefined ? {} : { batch } });
  assert.equal(make(sp(undefined)), false);
  assert.equal(make(sp({})), false);
  assert.equal(make(sp({ ...ok, perOp: {} })), false);
  assert.equal(make(sp({ perOp: ok.perOp })), false);
  assert.equal(make(sp({ ...ok, fixed: 100 })), false);
  assert.equal(make(sp(ok, "kondor")), false);
  assert.equal(make(sp(ok)), true);
});
