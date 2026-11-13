// R-RACE-18 (2) and (3), Repo Lens #D-14 N-2: a timed slow-node test of the payout re-check with the race types on.
// A paid week's vault file goes final only after the re-check (verifyWeek: the typed ledger's 144 hours on both nodes,
// every typed race's picks on both nodes, then the 6-hour races) finishes inside VERIFY_BUDGET_MS (10 min). Running out
// is safe (the week waits and alerts) but must not happen every run. Here every node call waits a fixed latency; the
// run's wall time divided by that latency is the number of calls on the critical path, i.e. the time at 1 s per call.
// R-RACE-18 (2): one block cache per node per run, so the 6-hour re-check reads no block the typed re-check already read.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const R = await import(path.resolve(APP, "bot/race.ts"));
const HOUR = 3600000, T0 = Date.UTC(2026, 10, 2), BLOCK = 3000, PER_HOUR = HOUR / BLOCK;
const SIGNERS = Array.from({ length: 15 }, (_, i) => "1" + String.fromCharCode(65 + i).repeat(33));
const tsOf = (h) => T0 + (h - 1) * BLOCK, LIB = 7 * 24 * PER_HOUR + 10;

function slowNode(latency, counter) {
  return {
    async getHeadInfo() { counter.n++; await new Promise((r) => setTimeout(r, latency)); return { head_topology: { id: "0xhead", height: String(LIB) }, last_irreversible_block: String(LIB) }; },
    async call(m, a) {
      counter.n++;
      await new Promise((r) => setTimeout(r, latency));
      assert.equal(m, "block_store.get_blocks_by_height");
      const from = Number(a.ancestor_start_height), n = Math.min(a.num_blocks, LIB - from + 1);
      return { block_items: Array.from({ length: Math.max(0, n) }, (_, k) => ({ block_height: String(from + k), block: { header: { signer: SIGNERS[(from + k) % 15], timestamp: String(tsOf(from + k)) } } })) };
    },
  };
}

test("R-RACE-18 (3): the week's typed re-check, at 1 s per node call, fits the 10-minute budget with room to spare", async () => {
  const L = 4, calls = { n: 0 };
  const p = slowNode(L, calls), check = slowNode(L, calls);
  const c = { p, check, headId: "0xhead", libH: LIB, libT: tsOf(LIB), picksRead: null };
  R.resetBlockCache();
  const hours = Array.from({ length: 6 * 24 }, (_, i) => T0 + i * HOUR);   // Monday to Saturday (Sunday counts for no week)
  const hint = (t) => [1 + (t - T0) / BLOCK, (t - T0) / BLOCK + PER_HOUR];
  const t0 = Date.now();
  for (let i = 0; i < hours.length; i += R.VERIFY_PARALLEL) {
    const got = await Promise.all(hours.slice(i, i + R.VERIFY_PARALLEL).map((t) => R.readHourForTimingTest(c, t, hint(t))));
    for (const g of got) assert.ok(g.ok, g.why);
  }
  const hoursWaves = (Date.now() - t0) / L;
  // The typed races' picks: 144 one-hour + 72 two-hour + 6 daily + 1 weekly, each read on both nodes (one page each at
  // launch sizes), VERIFY_PARALLEL races at once.
  const typedRaces = 144 + 72 + 6 + 1, picksWaves = Math.ceil(typedRaces / R.VERIFY_PARALLEL) * 2;
  // The 6-hour races (24, Mon to Sat) read the same blocks again: with the run's cache, no new block call.
  const before = calls.n;
  for (let i = 0; i < 24; i++) await R.readHourForTimingTest(c, T0 + i * 6 * HOUR, hint(T0 + i * 6 * HOUR));
  const sixHourBlockCalls = calls.n - before - 24;   // one getHeadInfo per read on the check node is not a block read
  assert.equal(sixHourBlockCalls, 0, "R-RACE-18 (2): the 6-hour re-check reads its blocks from this run's cache");
  const projected = hoursWaves + picksWaves + 28 * 2;   // + the 6-hour races' picks (28, both nodes), generously
  console.log(`re-check at 1 s per call: about ${Math.round(projected)} s (hours ${Math.round(hoursWaves)}, typed picks ${picksWaves}); budget ${R.VERIFY_BUDGET_MS / 1000} s`);
  assert.ok(projected * 1000 < R.VERIFY_BUDGET_MS * 0.9, `about ${Math.round(projected)} s at 1 s per call: over 90% of the budget`);
});

test("R-RACE-18 (2): the block cache is per node and per run: a new run reads the chain again, and the check node never uses the main node's reads", async () => {
  const a = { n: 0 }, b = { n: 0 };
  const p = slowNode(0, a), check = slowNode(0, b);
  const c = { p, check, headId: "0xhead", libH: LIB, libT: tsOf(LIB), picksRead: null };
  R.resetBlockCache();
  await R.readHourForTimingTest(c, T0, [1, PER_HOUR]);
  const a1 = a.n, b1 = b.n;
  assert.ok(a1 > 0 && b1 > 0, "both nodes read");
  await R.readHourForTimingTest(c, T0, [1, PER_HOUR]);
  assert.equal(a.n, a1, "main node: cached within the run");
  assert.equal(b.n - b1, 1, "check node: only its head read again (its blocks are its own cache's)");
  R.resetBlockCache();
  await R.readHourForTimingTest(c, T0, [1, PER_HOUR]);
  assert.ok(a.n > a1, "a new run reads the chain again");
});
