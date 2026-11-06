// Two-node fault injection (RECORDER §2.1–2.3): one node fails, both fail, they disagree on each kind of value, one
// lags; and a failed read is never "zero" or "not staked". Plus the clock comes from the chain (the lower of the two),
// budgets stop a run cleanly, and the lifecycle's rules one by one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exampleGame as game, exampleCfg } from "../testing/example/index.ts";
import { runGame } from "../recorder/runtime.ts";
import { agree, Budget, budgeted, Disagree, OutOfBudget, ReadFailed, withRetries } from "../recorder/nodes.ts";
import { decide, holdWeeks, releaseMatches, releaseCode } from "../recorder/lifecycle.ts";
import { vaultClock, clockFromState } from "../recorder/clock.ts";
import { readVaultStakes } from "../recorder/sources/vault-stakes.ts";
import { readPicksContract } from "../recorder/sources/picks-contract.ts";
import { fakeNode, world } from "../testing/fake-nodes.ts";
import { sampleWorld } from "../testing/example/games/kit-example/tests/sample.ts";
import { at, DAY, HOUR, GENESIS, WEEK } from "../testing/fake-clock.ts";

const cfg = exampleCfg();
const dirs = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-f-")); const prev = path.join(d, "prev"); fs.mkdirSync(prev); fs.writeFileSync(path.join(prev, ".fetched"), ""); return { prev, out: path.join(d, "out") }; };
const run = (a: any, b: any) => { const { prev, out } = dirs(); return runGame(game, cfg, { nodes: [a, b], prev, out, log: () => {} }); };
const W = () => sampleWorld(at(5, 0, 2));

test("faults: one node down, both down, a node that answers nothing — the run stops, nothing is read as zero", async () => {
  const wd = W();
  for (const m of ["get_state", "get_question", "list_players"]) {
    await assert.rejects(run(fakeNode("a", () => wd), fakeNode("b", () => wd, { fail: [m] })), /node down/, m);
    await assert.rejects(run(fakeNode("a", () => wd, { fail: [m] }), fakeNode("b", () => wd, { fail: [m] })), /node down/, m);
  }
  const empty = fakeNode("b", () => wd, { tweak: (m, _a, r) => (m === "get_state" ? null : r) });
  await assert.rejects(run(fakeNode("a", () => wd), empty), ReadFailed);
});

test("faults: the nodes disagree on each kind of value — the run stops (no file)", async () => {
  const wd = W();
  const tweaks: [string, (m: string, a: any, r: any) => any][] = [
    ["stake", (m, _a, r) => { if (m === "list_players" && r.rows[0]) r.rows[0].entry.stake = "1"; return r; }],
    ["peak", (m, _a, r) => { if (m === "list_players" && r.rows[0]) r.rows[0].entry.peak_stake = "1"; return r; }],
    ["voided", (m, _a, r) => { if (m === "list_players" && r.rows[1]) r.rows[1].entry.voided = true; return r; }],
    ["an answer", (m, _a, r) => { if (m === "list_players" && r.rows[0]) r.rows[0].entry.answers.pop(); return r; }],
    ["an outcome", (m, a, r) => { if (m === "get_question" && a.id === 301) r.question.outcome = 2; return r; }],
    ["a lock time", (m, a, r) => { if (m === "get_question" && a.id === 302) r.question.lock_time = String(Number(r.question.lock_time) + 1); return r; }],
    ["the minimum", (m, _a, r) => { if (m === "get_state") r.config.min_stake = "1"; return r; }],
    ["the rule week", (m, _a, r) => { if (m === "get_state") r.config.q60_rule_week_plus_one = "9"; return r; }],
    ["the clock", (m, _a, r) => { if (m === "get_state") r.config.week_length = String(WEEK + 1); return r; }],
  ];
  for (const [what, tweak] of tweaks) await assert.rejects(run(fakeNode("a", () => wd), fakeNode("b", () => wd, { tweak })), (e: any) => e instanceof Disagree || /disagree|isn't game-data/.test(e.message), what);
});

test("faults: the lower of two close chain clocks is the run's clock; a node far behind stops the run (KC-7)", async () => {
  const wd = W();
  wd.time = at(5, 0, 0) + 2 * 60000;        // 00:02 Monday on node a
  // node b 3 minutes behind (still Sunday): for the run the week hasn't ended, so it records nothing for week 4.
  const r = await run(fakeNode("a", () => wd), fakeNode("b", () => wd, { lagMs: 3 * 60000 }));
  assert.equal(r.week, 3);
  // 2 hours behind, or 3.5 days: the run stops (exit 2 in the CLI) instead of silently recording the wrong week.
  for (const lag of [2 * HOUR, 3.5 * DAY]) await assert.rejects(run(fakeNode("a", () => wd), fakeNode("b", () => wd, { lagMs: lag })), /min apart/);
  // Both nodes stalled at the same place: caught against the runner's clock.
  const { prev, out } = dirs();
  await assert.rejects(runGame(game, cfg, { nodes: [fakeNode("a", () => wd), fakeNode("b", () => wd)], prev, out, log: () => {}, wallNow: () => wd.time + HOUR }), /stalled/);
});

test("nodes: agree(), budgets, retries", async () => {
  assert.equal(await agree("x", async () => 1, async () => 1), 1);
  await assert.rejects(agree("x", async () => ({ a: 1n }), async () => ({ a: 2n })), Disagree);
  let t = 0;
  const b = new Budget({ reads: 2, ms: 1000, atOnce: 1, tries: 1 }, () => t);
  const r = budgeted({ label: "n", read: async () => ({ ok: 1 }) }, b);
  await r.read("m"); await r.read("m");
  await assert.rejects(r.read("m"), OutOfBudget);
  const b2 = new Budget({ reads: 10, ms: 1000, atOnce: 1, tries: 1 }, () => t);
  const r2 = budgeted({ label: "n", read: async () => ({}) }, b2);
  t = 2000;
  await assert.rejects(r2.read("m"), OutOfBudget);
  let n = 0;
  assert.equal(await withRetries("x", async () => { if (++n < 3) throw new Error("fetch failed"); return 5; }, 4, 1000, async () => {}), 5);
  await assert.rejects(withRetries("x", async () => { throw new Error("contract refused"); }, 4, 1000, async () => {}), /contract refused/);
});

test("vault-stakes: game 1 refused, read only after the week, a failed read is never 'not staked'", async () => {
  const wd = world(at(5, 0, 1));
  const node = { label: "n", read: async (m: string, a: any) => (m === "get_state" ? { time: String(wd.time), config: wd.config } : m === "get_game_player" ? (a.player.startsWith("1B") ? (() => { throw new Error("down"); })() : { week_stake: "200000000", entry: { peak_stake: "300000000", stake: "200000000" } }) : {}) };
  await assert.rejects(readVaultStakes(node as any, 1, [], 4, wd.time), /game 1/);
  await assert.rejects(readVaultStakes(node as any, 2, [], 5, wd.time), /only after the week/);
  const ok = await readVaultStakes(node as any, 2, ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"], 4, wd.time);
  assert.deepEqual(ok.stakes.get("1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), { stake: "200000000", peak: "300000000", voided: false });
  await assert.rejects(readVaultStakes(node as any, 2, ["1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"], 4, wd.time), /down/);
});

test("picks-contract: pages until an EMPTY page (BX-18), refuses repeats", async () => {
  const all = Array.from({ length: 250 }, (_, i) => ({ player: "1" + String(i).padStart(33, "Q").replace(/0/g, "o"), pick: { producers: ["1P"], time: String(i) } })).sort((a, b) => (a.player < b.player ? -1 : 1));
  const node = { label: "n", read: async (_m: string, a: any) => { const i = a.start_after ? all.findIndex((x) => x.player === a.start_after) + 1 : 0; return { rows: all.slice(i, i + 37) }; } };
  assert.equal((await readPicksContract(node as any, 2, 5)).length, 250);
  const rep = { label: "n", read: async () => ({ rows: [all[0], all[0]] }) };
  await assert.rejects(readPicksContract(rep as any, 2, 5), /repeated/);
});

test("clock: weeks, due (Thu 00:00), play window, chain time from get_state", () => {
  const k = vaultClock(GENESIS, WEEK);
  assert.equal(k.weekOf(at(4, 3)), 4);
  assert.equal(k.due(4), at(5, 3));
  assert.equal(new Date(k.due(4)).toISOString(), "2026-11-26T00:00:00.000Z", "W004's hard limit: Thu 26 Nov 00:00 UTC");
  assert.equal(k.finalNotBefore(4), at(5));
  assert.equal(k.inPlay(at(4, 5, 23)), true);
  assert.equal(k.inPlay(at(4, 6, 1)), false);
  assert.throws(() => vaultClock(0, WEEK), /genesis/);
  const s = clockFromState({ time: "5", config: { genesis_time: String(GENESIS), week_length: String(WEEK), min_stake: "100", min_stake_next: "200", min_stake_next_week: "6" } });
  assert.equal(s.minFor(5), 100n); assert.equal(s.minFor(6), 200n);
  assert.throws(() => clockFromState({ config: { genesis_time: String(GENESIS), week_length: String(WEEK) } }), /no time/);
});

test("lifecycle: final only after Mon 00:00, complete, re-read, no hold, and two runs ≥ 1 h apart reading the same", () => {
  const base = { now: at(5, 0, 3), end: at(5), due: at(5, 3), complete: true, hash: "h", rereadOk: true, held: null };
  const prevP = { state: "pending" as const, seen: { hash: "h", at: at(5, 0, 1) } };
  assert.equal(decide({ ...base, prev: prevP }).state, "final");
  assert.equal(decide({ ...base, prev: null }).state, "pending");
  assert.equal(decide({ ...base, prev: { ...prevP, seen: { hash: "x", at: at(5, 0, 1) } } }).state, "pending", "content changed: the hour restarts");
  assert.equal(decide({ ...base, prev: { ...prevP, seen: { hash: "h", at: at(5, 0, 2) + 1 } } }).state, "pending", "under an hour");
  assert.equal(decide({ ...base, prev: prevP, complete: false }).state, "pending");
  assert.equal(decide({ ...base, prev: prevP, rereadOk: false }).state, "pending");
  assert.equal(decide({ ...base, prev: prevP, held: "owner" }).state, "pending");
  assert.equal(decide({ ...base, prev: prevP, now: at(5) - 1, end: at(5) }).state, "open");
  assert.equal(decide({ ...base, prev: prevP, now: at(5, 3) }).state, "pending", "the backstop never finalizes");
  const s = decide({ ...base, prev: { ...prevP, seen: { hash: "x", at: 1 } } });
  assert.deepEqual(s.seen, { hash: "h", at: base.now }, "a change restamps seen.at");
  assert.deepEqual([...holdWeeks(" 4, 5 ")], [4, 5]);
  assert.throws(() => holdWeeks("4;5"), /not a week number/);
  const code = releaseCode("reason");
  assert.ok(releaseMatches(`4:${code}`, 4, "reason"));
  assert.ok(!releaseMatches(`5:${code}`, 4, "reason"));
  assert.ok(!releaseMatches(`4:${code}`, 4, "another"));
  assert.ok(!releaseMatches(undefined, 4, "reason"));
});

test("store: a week file can't be written over 1.9 MB, and the kit never writes another name", async () => {
  const { Out } = await import("../recorder/store.ts");
  const o = new Out(fs.mkdtempSync(path.join(os.tmpdir(), "kit-s-")));
  assert.throws(() => o.write("index.json", {}), /never writes/);
  assert.throws(() => o.write("W004.json", { x: "a".repeat(2_000_000) }), /over/);
  void DAY;
});
