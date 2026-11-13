// Capacity (owner, 11 Nov 2026): the Questions page asks the public node less.
// 1. One head read is shared for 3 s (and while one is on its way); every other call goes through unchanged.
// 2. The block strip runs every 12 s and never in a hidden tab; the 60 s live loop skips hidden tabs too.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const body = src.slice(src.indexOf("  function gentle(provider) {"), src.indexOf("  async function read(method"));
const gentle = new Function(`${body}; return gentle;`)();

function fakeProvider() {
  const calls = [];
  return { calls, call: async (m, p) => { calls.push(m); await new Promise((r) => setTimeout(r, 5)); return { m, n: calls.length }; } };
}

test("CAP-1 three head reads at once go to the node once", async () => {
  const f = fakeProvider(); const p = gentle(f);
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => p.call("chain.get_head_info", {})));
  assert.deepEqual(f.calls, ["chain.get_head_info"]);
  assert.deepEqual(a, b); assert.deepEqual(b, c);
});

test("CAP-2 a head read within 3 s reuses the reply; after 3 s it asks again", async () => {
  const f = fakeProvider(); const p = gentle(f);
  await p.call("chain.get_head_info", {});
  await p.call("chain.get_head_info", {});
  assert.equal(f.calls.filter((m) => m === "chain.get_head_info").length, 1);
  const real = Date.now; Date.now = () => real() + 3100;
  try { await p.call("chain.get_head_info", {}); } finally { Date.now = real; }
  assert.equal(f.calls.filter((m) => m === "chain.get_head_info").length, 2);
});

test("CAP-3 other calls are never cached", async () => {
  const f = fakeProvider(); const p = gentle(f);
  await p.call("block_store.get_blocks_by_height", {});
  await p.call("block_store.get_blocks_by_height", {});
  await p.call("chain.submit_transaction", {});
  assert.deepEqual(f.calls, ["block_store.get_blocks_by_height", "block_store.get_blocks_by_height", "chain.submit_transaction"]);
});

test("CAP-4 a failed head read is not kept", async () => {
  let n = 0;
  const p = gentle({ call: async () => { n++; if (n === 1) throw new Error("refused by node"); return { ok: n }; } });
  await assert.rejects(p.call("chain.get_head_info", {}));
  assert.deepEqual(await p.call("chain.get_head_info", {}), { ok: 2 });
});

test("CAP-5 strip every 12 s, hidden tabs skip the strip and the live loop, both catch up when shown", () => {
  assert.match(src, /const TICKER_MS = 12000;/);
  assert.match(src, /setInterval\(\(\) => \{ if \(!document\.hidden\) ticker\(\); \}, S\.demo \? 3000 : TICKER_MS\);/);
  assert.match(src, /setInterval\(\(\) => \{ if \(!document\.hidden\) liveTick\(\); \}, 60000\);/);
  assert.equal((src.match(/addEventListener\("visibilitychange"/g) || []).length, 2);
  assert.doesNotMatch(src, /setInterval\(ticker, S\.demo \? 3000 : 6000\)/);
});

test("CAP-6 questions are re-read every minute only while waiting for a result; others at most every 10 minutes", () => {
  assert.match(src, /const chainReadAt = new Map\(\), SLOW_REREAD_MS = 600000;/);
  assert.match(src, /waiting = !chainOutcomes\.get\(id\) && !!known && nowMs\(\) >= known\.lock;/);
  assert.match(src, /const due = !chainReadAt\.has\(id\) \|\| waiting \|\| Date\.now\(\) - chainReadAt\.get\(id\) >= SLOW_REREAD_MS;/);
  assert.match(src, /if \(!chainHashes\.has\(id\) \|\| \(\(recent \|\| !chainOutcomes\.get\(id\)\) && due\)\) \{/);
  // The file-vs-chain check itself is unchanged: every question is still hashed and compared with the chain's hash.
  assert.match(src, /const ok = same && \(await paramsHashOf\(q\)\) === chainHashes\.get\(id\);/);
});
