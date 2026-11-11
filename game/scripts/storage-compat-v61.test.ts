/**
 * Upgrade compatibility v6 → v6.1 (doubled Questions, D-092, R-VAULT-6).
 *
 * v6.1 will be uploaded over the live v6 vault, so this test lets the v6 code (test-fixtures/kpred-v6-test-build.wasm,
 * the test build of the source whose release build is the live fingerprint eed38f7c…) write a vault history on top of
 * a v5 start, as on mainnet, then swaps in the new build (build/sim/contract.wasm) on the same storage mid-week:
 *
 * 1. v5 → v6 history: seed, stakes, a question week, a second game with stakes, a vault week running.
 * 2. Every view reads back unchanged after the swap. The new rule-week field reads 0; get_state's caps are worked out.
 * 3. The week the upgrade lands in still holds only 30 questions; the next week holds 60; then everyone exits and the
 *    books balance.
 *
 * Run (after `npm run build:sim` in game/): node --import tsx --test game/scripts/storage-compat-v61.test.ts   (from the repo root)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Signer } from "koilib";
import { SimChain } from "../../bot/chain.ts";

const V5 = "game/test-fixtures/kpred-v5-test-build.wasm";
const V6 = "game/test-fixtures/kpred-v6-test-build.wasm";
const NEW = "game/build/sim/contract.wasm";
const VHP = 100_000_000n;
const HOUR = 3_600_000, DAY = 24 * HOUR, WEEK = 7 * DAY;
const GENESIS = 1_800_000_000_000 - (1_800_000_000_000 % DAY);
const T0 = GENESIS - DAY, H0 = 50_000_000;

const key = (s: string) => Signer.fromSeed(`storage-compat-v61 ${s}`);
const [contract, owner, operator, seedOwner, A, B, D] = ["contract", "owner", "operator", "seed", "A", "B", "D"].map(key);
const addr = (s: Signer) => s.getAddress();

const NEW_FIELDS = new Set(["q60_rule_week_plus_one", "questions_cap", "questions_cap_next"]);
/** Read-only values worked out on every read (Repo Lens V61-B2: checked, not waived). Right after the upgrade, before
 *  the first write sets the rule week: 30 this week, 60 next. */
const COMPUTED: Record<string, number> = { questions_cap: 30, questions_cap_next: 60 };
const isDefault = (v: any) => v === undefined || v === null || v === false || v === 0 || v === "0" || v === "";
function sameAsBefore(before: any, after: any, where: string) {
  if (before === null || typeof before !== "object") { assert.deepEqual(after, before, where); return; }
  assert.equal(typeof after, "object", `${where}: missing`);
  for (const k of Object.keys(before)) sameAsBefore(before[k], after?.[k], `${where}.${k}`);
  for (const k of Object.keys(after)) {
    if (k in before) continue;
    assert.ok(NEW_FIELDS.has(k), `${where}.${k}: a field v6 never returned (${JSON.stringify(after[k])})`);
    if (k in COMPUTED) assert.equal(after[k], COMPUTED[k], `${where}.${k}`);
    else assert.ok(isDefault(after[k]), `${where}.${k} should read as its default, got ${JSON.stringify(after[k])}`);
  }
}

test("v6.1 reads v6's stored data unchanged; the week it lands in keeps 30 questions, the next holds 60", { skip: (![V5, V6, NEW].every((f) => fs.existsSync(f))) && `a build is missing: run npm run build:sim in game/` }, async () => {
  const sim = new SimChain(addr(contract), V5);
  await sim.init();
  const at = (t: number) => sim.setHeight(H0 + Math.floor((t - T0) / 3000), t);
  const send = (calls: any[], who: Signer[]) => sim.sendAs(calls.map(([method, args]) => ({ method, args })), who.map(addr));
  const ok = async (calls: any[], who: Signer[]) => {
    const r = await send(calls, who);
    assert.ok(r.ok, `${calls.map((c) => c[0]).join(", ")}: ${r.error}`);
    return r;
  };
  for (const p of [A, B, D]) { await sim.ledgerSet(2, addr(p), 1000n * VHP); await sim.ledgerSet(3, addr(p), 1000n * VHP); }
  await sim.ledgerSet(2, addr(seedOwner), 5000n * VHP);
  await sim.ledgerSet(3, addr(seedOwner), 500n * VHP);
  await sim.ledgerSet(3, addr(contract), 1000n * VHP);
  const postArgs = (lock: number) => {
    const ws = sim.height + Math.ceil((lock - sim.time) / 2800) + 20;
    return { k: 2, lock_time: String(lock), window_start: String(ws), window_end: String(ws + 1000), params_hash: "0x" + "ab".repeat(32) };
  };
  const post = (lock: number) => ok([["post_question", postArgs(lock)]], [operator]);
  const resolve = (id: number) => ok([["resolve_question", { id, outcome: 1, data_hash: "0x" + "cd".repeat(32) }]], [operator]);

  // ───── 1. history: v5 start, then v6 as on mainnet ─────
  at(T0);
  await ok([["init", { owner: addr(owner), operator: addr(operator), seed_owner: addr(seedOwner), genesis_time: String(GENESIS), week_length: String(WEEK),
    close_delay: String(12 * HOUR), settle_length: String(DAY), timelock_length: String(2 * DAY), min_stake: String(VHP), max_sponsor_rc: String(2n * VHP) }]], [contract]);
  await ok([["seed_deposit_vhp", { amount: String(500n * VHP) }]], [seedOwner]);
  for (const [p, n] of [[A, 100n], [B, 40n]] as const) await ok([["deposit_vhp", { from: addr(p), amount: String(n * VHP) }]], [p]);
  await sim.setCode(V6);

  // week 0: one question (the first v6 write: the vault split starts with week 2)
  at(GENESIS + 12 * HOUR);
  await post(GENESIS + DAY);
  at(GENESIS + 13 * HOUR);
  for (const p of [A, B]) await ok([["answer", { player: addr(p), question_id: 0, option: 1 }]], [p]);
  at(GENESIS + 2 * DAY);
  await resolve(0);
  await ok([["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false }]], [owner]);
  at(GENESIS + 4 * DAY + HOUR);
  await ok([["apply_game", { game: 2 }]], [owner]);
  await ok([["deposit_to", { game: 2, from: addr(D), amount: String(30n * VHP), koin: false }]], [D]);
  await sim.ledgerAdd(2, addr(contract), 20n * VHP);
  at(GENESIS + WEEK + 12 * HOUR);
  await ok([["close_week", { week: "0" }]], []);
  for (const p of [A, B]) await ok([["settle", { player: addr(p), week: "0" }]], []);
  at(GENESIS + WEEK + 37 * HOUR);
  await ok([["finalize_week", { week: "0" }]], []);
  // week 1: no questions; closes as the first vault week's predecessor
  await sim.ledgerAdd(2, addr(contract), 30n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR);
  await ok([["close_week", { week: "1" }]], []);
  // week 2 (a vault week, running): 3 questions posted under v6
  at(GENESIS + 2 * WEEK + 13 * HOUR);
  for (let i = 0; i < 3; i++) await post(GENESIS + 2 * WEEK + 2 * DAY);

  const views = async () => ({
    state: await sim.read("get_state", {}),
    weeks: await Promise.all(["0", "1", "2"].map((week) => sim.read("get_week", { week }))),
    players: await Promise.all([A, B, D].flatMap((p) => ["0", "2"].map((week) => sim.read("get_player", { player: addr(p), week })))),
    games: await sim.read("list_games", {}),
    game2: await sim.read("get_game", { game: 2, week: "2" }),
  });
  const before = await views();
  assert.ok(Number(before.state.config.v6_rule_week_plus_one) > 0, "v6 rules in force");
  assert.equal(before.state.questions_cap, undefined, "v6 has no cap field");

  // ───── 2. the upgrade, mid-week 2 ─────
  await sim.setCode(NEW);
  const after = await views();
  sameAsBefore(before, after, "view");
  assert.equal(after.state.questions_cap, 30, "the landing week reads 30");
  assert.equal(after.state.questions_cap_next, 60, "next week reads 60");

  // ───── 3. week 2 keeps 30; week 3 holds 60 ─────
  at(GENESIS + 2 * WEEK + 14 * HOUR);
  for (let i = 3; i < 30; i++) await post(GENESIS + 2 * WEEK + 2 * DAY);
  const st2 = await sim.read("get_state", {});
  assert.equal(st2.config.q60_rule_week_plus_one, "4", "set once, by the first v6.1 write: 60 from week 3");
  const r31 = await send([["post_question", postArgs(GENESIS + 2 * WEEK + 2 * DAY)]], [operator]);
  assert.ok(!r31.ok && /too many questions this week/.test(r31.error ?? ""), `the 31st question of the landing week is refused (${r31.error})`);
  at(GENESIS + 2 * WEEK + 3 * DAY);
  for (let i = 1; i <= 30; i++) await resolve(i);                                          // week 2: ids 1 … 30
  await sim.ledgerAdd(2, addr(contract), 50n * VHP);
  at(GENESIS + 3 * WEEK + 12 * HOUR);
  await ok([["close_week", { week: "2" }]], []);
  const w2 = (await sim.read("get_week", { week: "2" })).week;
  assert.equal(w2.prize_v6, true, "week 2 still closes by the vault split");
  assert.equal(w2.questions, 30);

  at(GENESIS + 3 * WEEK + 13 * HOUR);
  const st3 = await sim.read("get_state", {});
  assert.equal(st3.questions_cap, 60);
  for (let i = 0; i < 60; i++) await post(GENESIS + 3 * WEEK + 2 * DAY);
  const r61 = await send([["post_question", postArgs(GENESIS + 3 * WEEK + 2 * DAY)]], [operator]);
  assert.ok(!r61.ok && /too many questions this week/.test(r61.error ?? ""), `the 61st question is refused (${r61.error})`);
  assert.equal((await sim.read("get_week", { week: "3" })).week.questions, 60);
  // A answers all 60: the 60th answer still goes through.
  for (let i = 31; i < 91; i++) await ok([["answer", { player: addr(A), question_id: i, option: 1 }]], [A]);
  assert.equal((await sim.read("get_player", { player: addr(A), week: "3" })).entry.answers.length, 60);
  // B answers 20, all right as well.
  for (let i = 31; i < 51; i++) await ok([["answer", { player: addr(B), question_id: i, option: 1 }]], [B]);

  // ───── 4. week 3 runs on the shared game rules (D-116) ─────
  await ok([["deposit_vhp", { from: addr(B), amount: String(VHP) }]], [B]);                        // the old call, kept as an alias
  await ok([["deposit_to", { game: 1, from: addr(B), amount: String(VHP), koin: false }]], [B]);   // the shared call, into B's own record
  const bq = await sim.read("get_game_player", { player: addr(B), game: 1, week: "3" });
  assert.equal(bq.week_stake, String(40n * VHP), "B's week-3 stake in game 1, read in place");
  assert.equal(bq.player.pending, String(2n * VHP), "both deposits count from next week, in the same record");
  at(GENESIS + 3 * WEEK + 3 * DAY);
  for (let i = 31; i < 91; i++) await resolve(i);
  await sim.ledgerAdd(2, addr(contract), 40n * VHP);
  at(GENESIS + 4 * WEEK + 12 * HOUR);
  await ok([["close_week", { week: "3" }]], []);
  const g13 = await sim.read("get_game", { game: 1, week: "3" });
  assert.equal(g13.week.closed, true, "game 1's week 3 closed like every game's");
  assert.ok(BigInt(g13.week.bucket) > 0n, "with its bucket");
  assert.equal(BigInt((await sim.read("get_week", { week: "3" })).week.pot ?? 0), 0n, "and nothing in the old baskets");
  const s3 = await send([["settle", { player: addr(A), week: "3" }]], []);
  assert.ok(!s3.ok && /no settle step/.test(s3.error ?? ""), `no settle step from the new week (${s3.error})`);
  await ok([["post_results", { game: 1, week: "3", rows: [{ player: addr(A), points: 60 }, { player: addr(B), points: 20 }] }]], [operator]);
  await ok([["seal_results", { game: 1, week: "3" }]], [operator]);
  at(GENESIS + 4 * WEEK + 12 * HOUR + 2 * 12 * HOUR + HOUR);
  const f = await ok([["finalize_game_week", { game: 1, week: "3" }]], []);
  assert.ok(f.ok);
  const claimA = await ok([["claim_game", { game: 1, week: "3", player: addr(A) }]], [A]);
  assert.ok(claimA.ok, "A claims week 3 like any game");
  const a3 = await sim.read("get_game_player", { player: addr(A), game: 1, week: "3" });
  assert.ok(BigInt(a3.entry.reward) > 0n && BigInt(a3.entry.reward) <= BigInt(g13.week.bucket));

  // ───── everyone exits, A by the old call and B by the new one; books balance ─────
  for (const [p, call] of [[A, "withdraw"], [B, "withdraw_from"]] as const) {
    const pl = (await sim.read("get_player", { player: addr(p), week: "4" })).player ?? {};
    const all = BigInt(pl.stake ?? 0) + BigInt(pl.pending ?? 0);
    if (all > 0n) await ok([[call, call === "withdraw" ? { to: addr(p), amount: String(all) } : { game: 1, to: addr(p), amount: String(all) }]], [p]);
  }
  await ok([["withdraw_from", { game: 2, to: addr(D), amount: String(30n * VHP) }]], [D]);
  const e = await sim.read("get_state", {});
  assert.equal(e.totals.total_stake ?? "0", "0", "every stake came out");
});

test("rollback (Repo Lens V61-A1): v6.1 → v6 → v6.1 again; a no-op owner call during the rollback keeps the running week at 30", { skip: (![V6, NEW].every((f) => fs.existsSync(f))) && `a build is missing: run npm run build:sim in game/` }, async () => {
  /** Runs the rollback story; `noop` = the owner's set_paused(false) while v6 is live. Returns whether the 31st
   *  question of the week the vault returns to v6.1 in was accepted. */
  const story = async (noop: boolean) => {
    const sim = new SimChain(addr(contract), V6);
    await sim.init();
    const at = (t: number) => sim.setHeight(H0 + Math.floor((t - T0) / 3000), t);
    const send = (calls: any[], who: Signer[]) => sim.sendAs(calls.map(([method, args]) => ({ method, args })), who.map(addr));
    const ok = async (calls: any[], who: Signer[]) => { const r = await send(calls, who); assert.ok(r.ok, `${calls.map((c) => c[0]).join(", ")}: ${r.error}`); return r; };
    const postArgs = (lock: number) => {
      const ws = sim.height + Math.ceil((lock - sim.time) / 2800) + 20;
      return { k: 2, lock_time: String(lock), window_start: String(ws), window_end: String(ws + 1000), params_hash: "0x" + "ab".repeat(32) };
    };
    at(T0);
    await ok([["init", { owner: addr(owner), operator: addr(operator), seed_owner: addr(seedOwner), genesis_time: String(GENESIS), week_length: String(WEEK),
      close_delay: String(12 * HOUR), settle_length: String(DAY), timelock_length: String(2 * DAY), min_stake: String(VHP), max_sponsor_rc: String(2n * VHP) }]], [contract]);
    // v6.1 arrives in week 0: its first write sets the rule week to week 1 (stored 2)
    await sim.setCode(NEW);
    at(GENESIS + 12 * HOUR);
    await ok([["post_question", postArgs(GENESIS + DAY)]], [operator]);
    assert.equal((await sim.read("get_state", {})).config.q60_rule_week_plus_one, "2");
    // rolled back to v6 in week 1; the owner's no-op call rewrites the config with v6's encoding, dropping the rule week
    await sim.setCode(V6);
    at(GENESIS + WEEK + 12 * HOUR);
    if (noop) await ok([["set_paused", { paused: false }]], [owner]);
    // week 2: v6 posts 30 questions, then v6.1 is uploaded again mid-week
    at(GENESIS + 2 * WEEK + 12 * HOUR);
    for (let i = 0; i < 30; i++) await ok([["post_question", postArgs(GENESIS + 2 * WEEK + 2 * DAY)]], [operator]);
    await sim.setCode(NEW);
    at(GENESIS + 2 * WEEK + 13 * HOUR);
    return send([["post_question", postArgs(GENESIS + 2 * WEEK + 2 * DAY)]], [operator]);
  };
  const withNoop = await story(true);
  assert.equal(withNoop.ok, false, "with the no-op owner call during the rollback, the 31st question of the running week is refused");
  assert.match(String(withNoop.error), /too many questions this week/, "refused for the cap, not for another reason (D8-10)");
  // Without it, the rule week survives the rollback and the running week's cap jumps to 60: the runbook rule exists for this.
  assert.equal((await story(false)).ok, true, "without the no-op call the 31st is accepted (V61-A1): the runbook rule is needed");
});

test("rollback after the rule week (Repo Lens C-1): a week the new code closed into game 1's game-week stays payable after a rollback to v6 and a re-upload, and is never settled", { skip: (![V5, V6, NEW].every((f) => fs.existsSync(f))) && `a build is missing: run npm run build:sim in game/` }, async () => {
  const sim = new SimChain(addr(contract), V5);                      // as on mainnet: v5, then v6, then v6.1
  await sim.init();
  const at = (t: number) => sim.setHeight(H0 + Math.floor((t - T0) / 3000), t);
  const send = (calls: any[], who: Signer[]) => sim.sendAs(calls.map(([method, args]) => ({ method, args })), who.map(addr));
  const ok = async (calls: any[], who: Signer[]) => { const r = await send(calls, who); assert.ok(r.ok, `${calls.map((c) => c[0]).join(", ")}: ${r.error}`); return r; };
  const postArgs = (lock: number) => {
    const ws = sim.height + Math.ceil((lock - sim.time) / 2800) + 20;
    return { k: 2, lock_time: String(lock), window_start: String(ws), window_end: String(ws + 1000), params_hash: "0x" + "ab".repeat(32) };
  };
  await sim.ledgerSet(2, addr(A), 1000n * VHP); await sim.ledgerSet(3, addr(A), 1000n * VHP);
  await sim.ledgerSet(3, addr(contract), 1000n * VHP);
  at(T0);
  await ok([["init", { owner: addr(owner), operator: addr(operator), seed_owner: addr(seedOwner), genesis_time: String(GENESIS), week_length: String(WEEK),
    close_delay: String(12 * HOUR), settle_length: String(DAY), timelock_length: String(2 * DAY), min_stake: String(VHP), max_sponsor_rc: String(2n * VHP) }]], [contract]);
  await ok([["deposit_vhp", { from: addr(A), amount: String(5n * VHP) }]], [A]);
  await sim.setCode(V6);                                             // v6's first write: the vault split from week 1
  await ok([["deposit_vhp", { from: addr(A), amount: String(5n * VHP) }]], [A]);
  // v6.1 arrives in week 0; its first write makes week 1 the rule week
  await sim.setCode(NEW);
  at(GENESIS + 12 * HOUR);
  await ok([["post_question", postArgs(GENESIS + DAY)]], [operator]);
  assert.equal((await sim.read("get_state", {})).config.q60_rule_week_plus_one, "2");
  at(GENESIS + 2 * DAY);
  await ok([["resolve_question", { id: 0, outcome: 1, data_hash: "0x" + "cd".repeat(32) }]], [operator]);
  // week 1 (the rule week): A answers two questions, all right
  at(GENESIS + WEEK + 12 * HOUR);
  for (let i = 0; i < 2; i++) await ok([["post_question", postArgs(GENESIS + WEEK + DAY)]], [operator]);
  at(GENESIS + WEEK + 13 * HOUR);
  for (const id of [1, 2]) await ok([["answer", { player: addr(A), question_id: id, option: 1 }]], [A]);
  at(GENESIS + WEEK + 2 * DAY);
  for (const id of [1, 2]) await ok([["resolve_question", { id, outcome: 1, data_hash: "0x" + "cd".repeat(32) }]], [operator]);
  await sim.ledgerAdd(2, addr(contract), 30n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR);
  await ok([["close_week", { week: "1" }]], []);
  const g1 = await sim.read("get_game", { game: 1, week: "1" });
  assert.equal(g1.week.closed, true, "week 1 closed into game 1's game-week");
  // rolled back to v6 (against the runbook, to prove the hardening): the owner's config call drops the rule week
  await sim.setCode(V6);
  at(GENESIS + 2 * WEEK + 13 * HOUR);
  await ok([["set_paused", { paused: false }]], [owner]);
  // v6.1 again: the first write sets a NEW, later rule week (week 3)
  await sim.setCode(NEW);
  at(GENESIS + 2 * WEEK + 14 * HOUR);
  await ok([["set_paused", { paused: false }]], [owner]);
  assert.equal((await sim.read("get_state", {})).config.q60_rule_week_plus_one, "4", "the re-upload moved the rule week");
  // week 1 is still paid from its results file, and can't be settled
  const st = await send([["settle", { player: addr(A), week: "1" }]], []);
  assert.ok(!st.ok && /no settle step/.test(st.error ?? ""), `week 1 is never settled (${st.error})`);
  await ok([["post_results", { game: 1, week: "1", rows: [{ player: addr(A), points: 2 }] }]], [operator]);
  await ok([["seal_results", { game: 1, week: "1" }]], [operator]);
  at(GENESIS + 2 * WEEK + 14 * HOUR + 2 * 12 * HOUR + HOUR);
  await ok([["finalize_game_week", { game: 1, week: "1" }]], []);
  await ok([["claim_game", { game: 1, week: "1", player: addr(A) }]], [A]);
  const a1 = await sim.read("get_game_player", { player: addr(A), game: 1, week: "1" });
  assert.ok(BigInt(a1.entry.reward) > 0n, "A is paid for week 1 after the rollback");
  // and every stake still comes out
  await ok([["withdraw", { to: addr(A), amount: String(10n * VHP) }]], [A]);
  assert.equal((await sim.read("get_state", {})).totals.total_stake ?? "0", "0");
});
