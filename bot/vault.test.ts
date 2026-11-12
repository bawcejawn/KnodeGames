/**
 * The bot's vault passes (bot/vault.ts) against the v6 test build on the simulated chain: results files → points,
 * prize winners and the seal; finalize after the wait; rows the chain would refuse are left out; alerts; and a v5
 * contract where every pass does nothing.
 *
 * Run (after `npm run build:sim` in game/): node --import tsx --test bot/vault.test.ts   (from the repo root)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Signer } from "koilib";
import { SimChain } from "./chain.ts";
import { vaultView, vaultResultsPass, vaultFinalizePass, vaultAlerts, recentGameWeeks, checkResults, seasonEnds, type VaultCtx } from "./vault.ts";

const NEW = "game/build/sim/contract.wasm";
const V5 = "game/test-fixtures/kpred-v5-test-build.wasm";
const VHP = 100_000_000n;
const HOUR = 3_600_000, DAY = 24 * HOUR, WEEK = 7 * DAY;
const GENESIS = 1_800_000_000_000 - (1_800_000_000_000 % DAY);
const T0 = GENESIS - DAY, H0 = 50_000_000;
const key = (s: string) => Signer.fromSeed(`vault-bot ${s}`);
const [contract, owner, operator, seedOwner, A, B, C, D, E] = ["contract", "owner", "operator", "seed", "A", "B", "C", "D", "E"].map(key);
const addr = (s: Signer) => s.getAddress();

/** A contract initialised by the v5 code and upgraded to v6 (as on mainnet). The first v6 write is at T0 (before
 *  genesis, week 0), so the vault rules apply from week 1. `upgrade: false` keeps v5. */
async function world(upgrade = true) {
  const sim = new SimChain(addr(contract), V5);
  await sim.init();
  const at = (t: number) => sim.setHeight(H0 + Math.floor((t - T0) / 3000), t);
  const ok = async (calls: any[], who: Signer[]) => {
    const r = await sim.sendAs(calls.map(([method, args]) => ({ method, args })), who.map(addr));
    assert.ok(r.ok, `${calls.map((c) => c[0]).join(", ")}: ${r.error}`);
  };
  for (const p of [A, B, C, D, E]) { await sim.ledgerSet(2, addr(p), 1000n * VHP); await sim.ledgerSet(3, addr(p), 1000n * VHP); }
  await sim.ledgerSet(2, addr(seedOwner), 5000n * VHP);
  await sim.ledgerSet(3, addr(contract), 1000n * VHP);
  at(T0);
  await ok([["init", { owner: addr(owner), operator: addr(operator), seed_owner: addr(seedOwner), genesis_time: String(GENESIS), week_length: String(WEEK),
    close_delay: String(12 * HOUR), settle_length: String(DAY), timelock_length: String(2 * DAY), min_stake: String(VHP), max_sponsor_rc: String(0) }]], [contract]);
  if (upgrade) await sim.setCode(NEW);
  return { sim, at, ok };
}

function vctx(sim: SimChain, results: Record<string, any>): VaultCtx & { problems: string[] } {
  return {
    chain: sim, operator, dryRun: false, problems: [], quiet: true,
    deployment: { vaultGames: { "2": { results: "mem:fantasy" }, "3": { results: "mem:blockx" } } },
    readResults: (source, week) => results[`${source}/W${week}`] ?? null,
    readPrizeSwitches: () => null,   // no git remote needed (Repo Lens #F-4 F4-5): null = follow registrations
  };
}
const sendAs = (sim: SimChain, signer: Signer, sent: string[]) => async (what: string, calls: any[]) => {
  sent.push(what);
  const r = await sim.sendAs(calls, [addr(signer)]);
  if (!r.ok) throw new Error(`${what}: ${r.error}`);
  return true;
};

test("results files become points, prize winners and a seal; the week finalizes after the wait and winners claim", { skip: !fs.existsSync(NEW) && `${NEW} missing: run npm run build:sim in game/` }, async () => {
  const { sim, at, ok } = await world();
  await ok([["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false, season_weeks: 1 }], ["propose_game", { game: 3, name: "Block X", staked: false, free_prize: true, season_weeks: 1 }]], [owner]);
  assert.equal((await sim.read("get_state", {})).config.v6_rule_week_plus_one, "2", "vault rules from week 1");
  // an announcement emails the owner once
  const alerts: string[] = [];
  let view = (await vaultView(sim))!;
  vaultAlerts(view, { weeksClosed: 0 }, new Map(), (k) => alerts.push(k));
  assert.deepEqual(alerts.map((k) => k.split(":").slice(0, 2).join(":")), ["game-proposal:2", "game-proposal:3"]);
  at(T0 + 2 * DAY + HOUR);
  await ok([["apply_game", { game: 2 }], ["apply_game", { game: 3 }]], [owner]);
  view = (await vaultView(sim))!;
  assert.deepEqual(view.games.map((g: any) => [Number(g.id), Number(g.from_week ?? 0)]), [[1, 0], [2, 1], [3, 1]]);
  await ok([["seed_deposit_vhp", { amount: String(2000n * VHP) }]], [seedOwner]);
  await ok([["deposit_vhp", { from: addr(A), amount: String(10n * VHP) }]], [A]);
  for (const [p, n] of [[B, 20n], [C, 5n]] as const) await ok([["deposit_to", { from: addr(p), game: 2, amount: String(n * VHP), koin: false }]], [p]);
  // week 0 (v5 rules) and week 1 (the first vault week) close
  at(GENESIS + WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "0" }]], []);
  await sim.ledgerAdd(2, addr(contract), 100n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "1" }]], []);
  const bucket = BigInt((await sim.read("get_game", { game: 2, week: "1" })).week.bucket);
  assert.ok(bucket > 0n, "Fantasy earned a bucket");
  assert.equal((await sim.read("get_game", { game: 3, week: "1" })).week.prize, String(3n * VHP));
  // results: B and C staked in Fantasy, E never staked there (left out); Block X: D 1st, E 2nd; A (staked in the
  // question game only) is free in Block X too, but isn't in the file
  const results = {
    "mem:fantasy/W1": { game: 2, week: 1, final: true, rows: [{ player: addr(B), points: 9 }, { player: addr(C), points: 4 }, { player: addr(E), points: 7 }] },
    "mem:blockx/W1": { game: 3, week: 1, final: true, rows: [], first: [addr(D)], second: [addr(E)] },
  };
  const v = vctx(sim, results), sent: string[] = [];
  await vaultResultsPass(v, sendAs(sim, operator, sent));
  assert.deepEqual(v.problems, []);
  assert.deepEqual(sent, [
    "Fantasy week 1: points for 2 player(s)",
    "Fantasy week 1: seal the results (the owner can correct them for 24 h)",
    `Block X week 1: prize place 1 → ${addr(D)}`,
    `Block X week 1: prize place 2 → ${addr(E)}`,
    "Block X week 1: seal the results (the owner can correct them for 24 h)",
  ]);
  // a second run sends nothing (already sealed)
  const again: string[] = [];
  await vaultResultsPass(vctx(sim, results), sendAs(sim, operator, again));
  assert.deepEqual(again, []);
  // too early to finalize, also 12 hours after the seal (the owner can still correct); a day after the seal it
  // finalizes; winners claim
  const fin: string[] = [];
  await vaultFinalizePass(vctx(sim, results), sendAs(sim, operator, fin));
  assert.deepEqual(fin, []);
  at(sim.time + 12 * HOUR + 1);
  await vaultFinalizePass(vctx(sim, results), sendAs(sim, operator, fin));
  assert.deepEqual(fin, []);
  at(sim.time + 12 * HOUR);
  await vaultFinalizePass(vctx(sim, results), sendAs(sim, operator, fin));
  assert.deepEqual(fin, ["Fantasy week 1: finalize (find the winners)", "Block X week 1: finalize (find the winners)"]);
  await ok([["claim_game", { player: addr(B), game: 2, week: "1" }]], [B]);
  await ok([["claim_game", { player: addr(D), game: 3, week: "1" }]], [D]);
  await ok([["claim_game", { player: addr(E), game: 3, week: "1" }]], [E]);
  const gw = (await sim.read("get_game", { game: 2, week: "1" })).week;
  assert.ok(BigInt(gw.claimed) <= bucket, "claims never exceed the bucket");
  assert.ok(bucket - BigInt(gw.claimed) < 10n, "B, the only winner (top 30% of 2 players), took the bucket, less rounding dust");
});

test("a prize winner who was staked in the game is reported, not posted; a missing file near the deadline is reported", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at, ok } = await world();
  await ok([["propose_game", { game: 3, name: "Both", staked: true, free_prize: true, season_weeks: 1 }]], [owner]);
  at(T0 + 2 * DAY + HOUR);
  await ok([["apply_game", { game: 3 }]], [owner]);
  await ok([["seed_deposit_vhp", { amount: String(2000n * VHP) }]], [seedOwner]);
  await ok([["deposit_to", { from: addr(B), game: 3, amount: String(2n * VHP), koin: false }]], [B]);
  at(GENESIS + WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "0" }]], []);
  await sim.ledgerAdd(2, addr(contract), 100n * VHP);   // rewards, so week 1 funds its prize (a week with no prize takes no winners)
  at(GENESIS + 2 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "1" }]], []);
  const results = { "mem:blockx/W1": { game: 3, week: 1, final: true, rows: [], first: [addr(B)], second: [] } };
  const v = vctx(sim, results), sent: string[] = [];
  await vaultResultsPass(v, sendAs(sim, operator, sent));
  assert.equal(v.problems.length, 1);
  assert.match(v.problems[0], /was staked in the game that week/);
  assert.deepEqual(sent, ["Both week 1: seal the results (the owner can correct them for 24 h)"]);
  // next week: no file; 3 days after the week, less than 12 h before the deadline → reported
  at(GENESIS + 3 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "2" }]], []);
  at(GENESIS + 3 * WEEK + 3 * DAY - 6 * HOUR);
  const v2 = vctx(sim, {}), sent2: string[] = [];
  await vaultResultsPass(v2, sendAs(sim, operator, sent2));
  assert.deepEqual(sent2, []);
  assert.match(v2.problems.join(" "), /week 2's results are not ready/);
  // past the deadline the bot rolls it over
  at(GENESIS + 3 * WEEK + 3 * DAY + 1);
  const fin: string[] = [];
  await vaultFinalizePass(vctx(sim, {}), sendAs(sim, operator, fin));
  assert.ok(fin.includes("Both week 2: finalize (no results: roll the week over)"), fin.join(" | "));
  const gw = (await sim.read("get_game", { game: 3, week: "2" })).week;
  assert.equal(gw.rolled_over, true);
});

test("on the v5 contract every vault pass does nothing", { skip: !fs.existsSync(V5) && `${V5} missing` }, async () => {
  const { sim } = await world(false);
  assert.equal(await vaultView(sim), null);
  const sent: string[] = [];
  await vaultResultsPass(vctx(sim, {}), sendAs(sim, operator, sent));
  await vaultFinalizePass(vctx(sim, {}), sendAs(sim, operator, sent));
  assert.deepEqual(sent, []);
  assert.equal((await recentGameWeeks(sim, { games: [], proposals: [] }, 0)).size, 0);
});

test("checkResults refuses malformed files; seasonEnds follows the season", () => {
  const P = "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz";
  assert.equal(checkResults({ game: 2, week: 5, final: true, rows: [{ player: P, points: 3 }] }, 2, 5), "");
  assert.match(checkResults({ game: 2, week: 5, final: false, rows: [] }, 2, 5), /not final/);
  assert.match(checkResults({ game: 2, week: 4, final: true, rows: [] }, 2, 5), /not game 2 week 5/);
  assert.match(checkResults({ game: 2, week: 5, final: true, rows: [{ player: P, points: 0 }] }, 2, 5), /1-255/);
  assert.match(checkResults({ game: 2, week: 5, final: true, rows: [{ player: P, points: 3 }], first: [P] }, 2, 5), /twice/);
  assert.match(checkResults({ game: 2, week: 5, final: true, rows: [{ player: "nope", points: 3 }] }, 2, 5), /valid address/);
  const g = { from_week: 4, season_weeks: 2 };
  assert.deepEqual([4, 5, 6, 7].map((w) => seasonEnds(g, w)), [false, true, false, true]);
  assert.equal(seasonEnds({ from_week: 4, season_weeks: 0 }, 4), true);
});

test("fix-check VN-3: a game restarted after a gap still gets its last earned week posted, sealed and finalized", { skip: !fs.existsSync(NEW) && `${NEW} missing: run npm run build:sim in game/` }, async () => {
  const { sim, at, ok } = await world();
  await ok([["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false, season_weeks: 1 }]], [owner]);
  at(T0 + 2 * DAY + HOUR);
  await ok([["apply_game", { game: 2 }]], [owner]);
  for (const [p, n] of [[B, 20n], [C, 5n]] as const) await ok([["deposit_to", { from: addr(p), game: 2, amount: String(n * VHP), koin: false }]], [p]);
  at(GENESIS + WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "0" }]], []);
  // Stopped in week 1 (it earns week 1), announced again; restarted in week 2, after week 1 closed: a gap (week 2).
  await ok([["deactivate_game", { game: 2 }], ["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false, season_weeks: 1 }]], [owner]);
  await sim.ledgerAdd(2, addr(contract), 50n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "1" }]], []);
  await ok([["apply_game", { game: 2 }]], [owner]);
  assert.equal(Number((await sim.read("get_game", { game: 2, week: "0" })).game.from_week), 3, "restarts from week 3");
  assert.ok(BigInt((await sim.read("get_game", { game: 2, week: "1" })).week.bucket) > 0n, "week 1 earned a bucket");
  const results = { "mem:fantasy/W1": { game: 2, week: 1, final: true, rows: [{ player: addr(B), points: 9 }, { player: addr(C), points: 4 }] } };
  const sent: string[] = [];
  await vaultResultsPass(vctx(sim, results), sendAs(sim, operator, sent));
  assert.deepEqual(sent, ["Fantasy week 1: points for 2 player(s)", "Fantasy week 1: seal the results (the owner can correct them for 24 h)"]);
  at(sim.time + 24 * HOUR + 1);
  const fin: string[] = [];
  await vaultFinalizePass(vctx(sim, results), sendAs(sim, operator, fin));
  assert.deepEqual(fin, ["Fantasy week 1: finalize (find the winners)"]);
  await ok([["claim_game", { player: addr(B), game: 2, week: "1" }]], [B]);
});

// ═══════════════ the checks before paying (I-034, I-051, I-052, I-064) ═══════════════
import os from "node:os";
import path from "node:path";
import { orderBreak, boardSpec, boardScore, readSpec, hashOf, STABLE_MS, type VaultMemo, type FileRead } from "./vault.ts";

/** Fantasy (game 2, staked: B 20 VHP, C 5 VHP) and Block X (game 3, free prize) with week 1 closed and funded. */
async function weekOneClosed() {
  const { sim, at, ok } = await world();
  await ok([["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false, season_weeks: 1 }], ["propose_game", { game: 3, name: "Block X", staked: false, free_prize: true, season_weeks: 1 }]], [owner]);
  at(T0 + 2 * DAY + HOUR);
  await ok([["apply_game", { game: 2 }], ["apply_game", { game: 3 }]], [owner]);
  await ok([["seed_deposit_vhp", { amount: String(2000n * VHP) }]], [seedOwner]);
  for (const [p, n] of [[B, 20n], [C, 5n]] as const) await ok([["deposit_to", { from: addr(p), game: 2, amount: String(n * VHP), koin: false }]], [p]);
  at(GENESIS + WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "0" }]], []);
  await sim.ledgerAdd(2, addr(contract), 100n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "1" }]], []);
  return { sim, at, ok };
}
const fantasyW1 = () => ({ game: 2, week: 1, final: true, rows: [{ player: addr(B), points: 9 }, { player: addr(C), points: 4 }] });
/** Fantasy's board for week 1: B and C staked with points, E free with points (E isn't staked: not needed in the file). */
const fantasyBoard = (rows?: any[]) => ({ v: 1, lastWeek: { week: 1, rows: rows ?? [
  { a: addr(B), pts: 30, place: 1, ranked: true }, { a: addr(C), pts: 12, place: 2, ranked: true }, { a: addr(E), pts: 50, place: 1, ranked: false }] } });
const blockxW1 = () => ({ game: 3, week: 1, final: true, rows: [], first: [addr(D)], second: [addr(E)] });

/** A context reading files from a map: an object = the file, "ERR" = unreadable, absent = missing. */
function fctx(sim: SimChain, files: Record<string, any>, memo?: VaultMemo): VaultCtx & { problems: string[] } {
  const readFile = (spec: string): FileRead => {
    const v = files[spec];
    return v === undefined ? { state: "missing" } : v === "ERR" ? { state: "error", error: "test: unreadable" } : { state: "ok", data: JSON.parse(JSON.stringify(v)) };
  };
  return { chain: sim, operator, dryRun: false, problems: [], quiet: true, readFile, memo, readPrizeSwitches: () => null,
    deployment: { vaultGames: { "2": { results: "mem:fantasy/vault" }, "3": { results: "mem:blockx/vault" } } } };
}
const allFiles = () => ({ "mem:fantasy/vault/W1.json": fantasyW1(), "mem:fantasy/board.json": fantasyBoard(), "mem:blockx/vault/W1.json": blockxW1() });
const fantasySends = ["Fantasy week 1: points for 2 player(s)", "Fantasy week 1: seal the results (the owner can correct them for 24 h)"];

test("checks: a results file is posted only once it is unchanged on a later run (hourly bot memo)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at } = await weekOneClosed();
  const memo: VaultMemo = {}, files = allFiles();
  const s1: string[] = [];
  await vaultResultsPass(fctx(sim, files, memo), sendAs(sim, operator, s1));
  assert.deepEqual(s1, [], "first read: nothing sent");
  assert.ok(memo.seen?.["2:1"] && memo.seen?.["3:1"]);
  at(sim.time + STABLE_MS - 60_000);
  const s2: string[] = [];
  await vaultResultsPass(fctx(sim, files, memo), sendAs(sim, operator, s2));
  assert.deepEqual(s2, [], "not yet stable");
  at(sim.time + 2 * 60_000);
  const v3 = fctx(sim, files, memo), s3: string[] = [];
  await vaultResultsPass(v3, sendAs(sim, operator, s3));
  assert.deepEqual(v3.problems, []);
  assert.deepEqual(s3, [...fantasySends, `Block X week 1: prize place 1 → ${addr(D)}`, `Block X week 1: prize place 2 → ${addr(E)}`, "Block X week 1: seal the results (the owner can correct them for 24 h)"]);
});

test("checks: a results file that changes after the first read is held, reported once, and never posted automatically", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at } = await weekOneClosed();
  const memo: VaultMemo = {}, files: any = allFiles();
  await vaultResultsPass(fctx(sim, files, memo), sendAs(sim, operator, []));
  files["mem:fantasy/vault/W1.json"] = { ...fantasyW1(), rows: [{ player: addr(B), points: 9 }, { player: addr(C), points: 8 }] };
  at(sim.time + HOUR);
  const v = fctx(sim, files, memo), s: string[] = [];
  await vaultResultsPass(v, sendAs(sim, operator, s));
  assert.ok(!s.some((x) => x.startsWith("Fantasy")), s.join(" | "));
  assert.equal(v.problems.length, 1);
  assert.match(v.problems[0], /Fantasy week 1: held.*changed after the bot first read it.*game-post 2 1/);
  // back to the first version: still held (a final file must never change); the alert isn't repeated
  files["mem:fantasy/vault/W1.json"] = fantasyW1();
  at(sim.time + HOUR);
  const v2 = fctx(sim, files, memo), s2: string[] = [];
  await vaultResultsPass(v2, sendAs(sim, operator, s2));
  assert.ok(!s2.some((x) => x.startsWith("Fantasy")));
  assert.deepEqual(v2.problems, []);
  // under 12 h before the deadline: one reminder
  at(GENESIS + 2 * WEEK + 3 * DAY - 6 * HOUR);
  const v3 = fctx(sim, files, memo);
  await vaultResultsPass(v3, sendAs(sim, operator, []));
  assert.equal(v3.problems.length, 1);
  assert.match(v3.problems[0], /still held .* due/);
});

test("checks: a HOLD file holds the whole week; an unreadable HOLD holds too; a missing one doesn't (I-064)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  for (const [hold, re] of [[{ week: 1, reason: "watching node 1Abc" }, /HOLD-W1\.json \(watching node 1Abc\)/], ["ERR", /HOLD-W1\.json can't be read/]] as const) {
    const files: any = { ...allFiles(), "mem:fantasy/vault/HOLD-W1.json": hold };
    const v = fctx(sim, files), s: string[] = [];
    await vaultResultsPass(v, async (what, calls) => { s.push(what); return true; });
    assert.ok(!s.some((x) => x.startsWith("Fantasy")), "nothing for Fantasy: no rows, no winners, no seal");
    assert.ok(s.some((x) => x.startsWith("Block X")), "other games go on");
    assert.match(v.problems.join(" | "), re);
  }
});

test("checks: staked list: a staked wallet with points on the board but not in the file holds the week (I-064)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  const files: any = { ...allFiles(), "mem:fantasy/vault/W1.json": { game: 2, week: 1, final: true, rows: [{ player: addr(B), points: 9 }] } };
  const v = fctx(sim, files), s: string[] = [];
  await vaultResultsPass(v, async (what) => { s.push(what); return true; });
  assert.ok(!s.some((x) => x.startsWith("Fantasy")));
  assert.match(v.problems.join(" | "), new RegExp(`staked in the game that week, with points on its board, are not in the results file: ${addr(C)}`));
  assert.doesNotMatch(v.problems.join(" | "), new RegExp(addr(E)), "E has points but isn't staked: not needed");
  // a staked wallet with 0 points on the board isn't needed either
  const files2: any = { ...files, "mem:fantasy/board.json": fantasyBoard([{ a: addr(B), pts: 30, place: 1, ranked: true }, { a: addr(C), pts: 0, place: 2, ranked: true }]) };
  const v2 = fctx(sim, files2), s2: string[] = [];
  await vaultResultsPass(v2, async (what) => { s2.push(what); return true; });
  assert.deepEqual(v2.problems, []);
  assert.deepEqual(s2.filter((x) => x.startsWith("Fantasy")), ["Fantasy week 1: points for 1 player(s)", "Fantasy week 1: seal the results (the owner can correct them for 24 h)"]);
});

test("checks: a board that is missing, unreadable or for another week, a file row not on the board, or points against the board's order hold the week", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  const cases: Array<[any, RegExp]> = [
    [undefined, /board mem:fantasy\/board\.json is missing/],
    ["ERR", /board mem:fantasy\/board\.json is unreadable/],
    [{ v: 1, lastWeek: { week: 0, rows: [] } }, /has no lastWeek for week 1 \(it shows week 0\)/],
    [fantasyBoard([{ a: addr(B), pts: 30, place: 1, ranked: true }]), /results file are not on the game's board for week 1: /],
    [fantasyBoard([{ a: addr(B), pts: 10, place: 2, ranked: true }, { a: addr(C), pts: 12, place: 1, ranked: true }]), /don't follow the board's places/],
    [fantasyBoard([{ a: addr(B), pts: 10, place: 1, ranked: true }, { a: addr(C), pts: 10, place: 1, ranked: true }]), /share place 1 but get/],
  ];
  for (const [board, re] of cases) {
    const files: any = { ...allFiles(), "mem:fantasy/board.json": board };
    if (board === undefined) delete files["mem:fantasy/board.json"];
    const v = fctx(sim, files), s: string[] = [];
    await vaultResultsPass(v, async (what) => { s.push(what); return true; });
    assert.ok(!s.some((x) => x.startsWith("Fantasy")), `nothing posted: ${re}`);
    assert.match(v.problems.join(" | "), re);
  }
});

test("checks: a refused post is reported with the chain's reason, stops the week (no seal), and isn't retried (I-052)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at } = await weekOneClosed();
  const memo: VaultMemo = {}, files = allFiles();
  await vaultResultsPass(fctx(sim, files, memo), sendAs(sim, operator, []));     // first read
  at(sim.time + HOUR);
  const refuse = (s: string[]) => async (what: string, calls: any[]) => {
    s.push(what);
    if (calls[0].method === "post_results" || calls[0].method === "post_prize_winners") return { ok: false, error: "transaction reverted: test refusal" };
    const r = await sim.sendAs(calls, [addr(operator)]);
    return r.ok ? true : { ok: false, error: r.error };
  };
  const v = fctx(sim, files, memo), s: string[] = [];
  await vaultResultsPass(v, refuse(s));
  assert.deepEqual(s, ["Fantasy week 1: points for 2 player(s)", `Block X week 1: prize place 1 → ${addr(D)}`], "each week stops at its refusal: no seal");
  assert.equal(v.problems.length, 2);
  assert.match(v.problems[0], /Fantasy week 1: the vault REFUSED post_results \(transaction reverted: test refusal\)/);
  assert.match(v.problems[1], /Block X week 1: the vault REFUSED post_prize_winners/);
  assert.equal((await sim.read("get_game", { game: 2, week: "1" })).week.sealed ?? false, false);
  // the next run doesn't send it again; the hold is reported once
  at(sim.time + HOUR);
  const v2 = fctx(sim, files, memo), s2: string[] = [];
  await vaultResultsPass(v2, refuse(s2));
  assert.deepEqual(s2, []);
  assert.equal(v2.problems.length, 2);
  assert.match(v2.problems.join(" | "), /refused "Fantasy week 1: points for 2 player\(s\)".*won't send it again/);
  const v3 = fctx(sim, files, memo);
  await vaultResultsPass(v3, refuse([]));
  assert.deepEqual(v3.problems, [], "reported once");
});

test("checks: game-post by hand applies HOLD, board and refusal checks but not the two-run wait", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  await assert.rejects(vaultResultsPass(fctx(sim, { ...allFiles(), "mem:fantasy/vault/HOLD-W1.json": {} }, {}), async () => true, { game: 2, week: 1 }), /held: the game published HOLD-W1\.json/);
  const s: string[] = [];
  await vaultResultsPass(fctx(sim, allFiles(), {}), sendAs(sim, operator, s), { game: 2, week: 1 });
  assert.deepEqual(s, fantasySends, "posted at once");
});

test("orderBreak, boardSpec, boardScore, hashOf and readSpec (missing ≠ unreadable)", () => {
  const P = (n: number) => `1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrm${"abcdefgh"[n]}`;
  const pl = new Map([[P(0), 1], [P(1), 1], [P(2), 3]]);
  assert.equal(orderBreak([{ player: P(0), points: 9 }, { player: P(1), points: 9 }, { player: P(2), points: 8 }], pl), "");
  assert.match(orderBreak([{ player: P(0), points: 9 }, { player: P(1), points: 8 }], pl), /share place 1/);
  assert.match(orderBreak([{ player: P(0), points: 3 }, { player: P(2), points: 8 }], pl), /fewer than/);
  assert.equal(orderBreak([{ player: P(3), points: 1 }, { player: P(0), points: 9 }], pl), "", "rows without a place aren't compared");
  assert.equal(boardSpec("games-data:blockx/vault"), "games-data:blockx/board.json");
  assert.equal(boardSpec("race-data:vault"), "race-data:board.json");
  assert.equal(boardSpec("games-data:golf/vault/"), "games-data:golf/board.json");
  assert.equal(boardSpec("games-data:x/vault", "games-data:x/boards/staked.json"), "games-data:x/boards/staked.json");
  assert.deepEqual([boardScore({ pts: 4 }), boardScore({ points: 2 }), boardScore({ pts: 0 }), boardScore({ pts: -1 }), boardScore({})], [4, 2, 0, 0, null]);
  assert.equal(hashOf({ a: 1, b: [1, { c: 2, d: 3 }] }), hashOf({ b: [1, { d: 3, c: 2 }], a: 1 }), "key order doesn't matter");
  assert.notEqual(hashOf({ a: [1, 2] }), hashOf({ a: [2, 1] }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-read-"));
  fs.writeFileSync(path.join(dir, "ok.json"), "{\"x\":1}");
  fs.writeFileSync(path.join(dir, "bad.json"), "{not json");
  assert.deepEqual(readSpec(path.join(dir, "ok.json")), { state: "ok", data: { x: 1 } });
  assert.deepEqual(readSpec(path.join(dir, "none.json")), { state: "missing" });
  assert.equal(readSpec(path.join(dir, "bad.json")).state, "error");
  assert.equal(readSpec("bad/branch:x.json").state, "error", "a malformed spec is an error, not missing");
  assert.equal(readSpec("games-data:../x.json").state, "error");
});

// ═══════════════ Repo Lens #D-3 fixes ═══════════════
test("VB-2: a failed finalize stops that week's finalize loop (one try per week per run, not 20)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at } = await weekOneClosed();
  await vaultResultsPass(fctx(sim, allFiles(), {}), sendAs(sim, operator, []), { game: 2, week: 1 });
  at(sim.time + 24 * HOUR + 1);
  let tries = 0;
  await vaultFinalizePass(fctx(sim, {}), async (what) => { if (what.startsWith("Fantasy")) tries++; return { ok: false, error: "reverted: test" }; });
  assert.equal(tries, 1);
});

test("VB-3: only a chain revert counts as a refusal; a send that wasn't seen in a block (or a network error) is retried next run", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at } = await weekOneClosed();
  const memo: VaultMemo = {}, files = allFiles();
  await vaultResultsPass(fctx(sim, files, memo), sendAs(sim, operator, []));      // first read
  at(sim.time + HOUR);
  const v = fctx(sim, files, memo);
  await vaultResultsPass(v, async (what, calls) => calls[0].method === "post_results" ? { ok: false, error: "sent, but not seen in a block within 3 minutes (will be re-checked next run)" } : sendAs(sim, operator, [])(what, calls));
  assert.match(v.problems.join(" | "), /Fantasy week 1: .*not seen in a block.*tried again on the next run/);
  assert.equal(memo.refused?.["2:1"], undefined, "not recorded as a refusal");
  at(sim.time + HOUR);
  const s: string[] = [];
  await vaultResultsPass(fctx(sim, files, memo), sendAs(sim, operator, s));
  assert.deepEqual(s, fantasySends, "posted on the next run");
});

test("VB-3: isRevert tells the chain's refusals from other failures", async () => {
  const { isRevert } = await import("./vault.ts");
  assert.equal(isRevert('reverted: ["that week is not final yet"]'), true);
  assert.equal(isRevert('{"error":"x","code":1,"logs":["transaction reverted: results for that week are past their deadline"]}'), true);
  for (const e of ["sent, but not seen in a block within 3 minutes (will be re-checked next run)", "fetch failed", "insufficient pending account resources", "", undefined]) assert.equal(isRevert(e as any), false, String(e));
});

test("VB-4: vaultGames.<id>.board \"none\" skips the staked-list check (logged); a missing board without it still holds", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  const files: any = allFiles();
  delete files["mem:fantasy/board.json"];
  const v = fctx(sim, files);
  v.deployment.vaultGames["2"].board = "none";
  const logs: string[] = [], s: string[] = [];
  v.quiet = false;
  const orig = console.log; console.log = (...a: any[]) => logs.push(a.join(" "));
  try { await vaultResultsPass(v, async (what) => { s.push(what); return true; }); } finally { console.log = orig; }
  assert.deepEqual(s.filter((x) => x.startsWith("Fantasy")), fantasySends);
  assert.ok(logs.some((l) => /Fantasy week 1: no board check \(vaultGames\.2\.board is "none"\)/.test(l)), logs.join("\n"));
  const v2 = fctx(sim, files), s2: string[] = [];
  await vaultResultsPass(v2, async (what) => { s2.push(what); return true; });
  assert.ok(!s2.some((x) => x.startsWith("Fantasy")));
});

test("VB-5: vaultGames.<id>.minPts: board points below it don't require the wallet in the file (Combo: 100 hundredths)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  const files: any = { ...allFiles(), "mem:fantasy/vault/W1.json": { game: 2, week: 1, final: true, rows: [{ player: addr(B), points: 9 }] },
    "mem:fantasy/board.json": fantasyBoard([{ a: addr(B), pts: 300, place: 1, ranked: true }, { a: addr(C), pts: 50, place: 2, ranked: true }]) };
  const v = fctx(sim, files), s: string[] = [];
  v.deployment.vaultGames["2"].minPts = 100;
  await vaultResultsPass(v, async (what) => { s.push(what); return true; });
  assert.deepEqual(v.problems, []);
  assert.deepEqual(s.filter((x) => x.startsWith("Fantasy")), ["Fantasy week 1: points for 1 player(s)", "Fantasy week 1: seal the results (the owner can correct them for 24 h)"]);
  const v2 = fctx(sim, files), s2: string[] = [];
  await vaultResultsPass(v2, async (what) => { s2.push(what); return true; });
  assert.match(v2.problems.join(" | "), new RegExp(`not in the results file: ${addr(C)}`), "without minPts, C (50) is required");
});

test("VB-1: a HOLD file holds unless RELEASE-W<week>.json is published next to it; the hold reason is read from `why` too", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  const held: any = { ...allFiles(), "mem:fantasy/vault/HOLD-W1.json": { week: 1, why: "watching node 1Abc" } };
  const v = fctx(sim, held), s: string[] = [];
  await vaultResultsPass(v, async (what) => { s.push(what); return true; });
  assert.ok(!s.some((x) => x.startsWith("Fantasy")));
  assert.match(v.problems.join(" | "), /HOLD-W1\.json \(watching node 1Abc\)/);
  const released = { ...held, "mem:fantasy/vault/RELEASE-W1.json": { week: 1, released: true } };
  const v2 = fctx(sim, released), s2: string[] = [];
  await vaultResultsPass(v2, async (what) => { s2.push(what); return true; });
  assert.deepEqual(s2.filter((x) => x.startsWith("Fantasy")), fantasySends);
  const unreadable = { ...held, "mem:fantasy/vault/RELEASE-W1.json": "ERR" };
  const v3 = fctx(sim, unreadable), s3: string[] = [];
  await vaultResultsPass(v3, async (what) => { s3.push(what); return true; });
  assert.ok(!s3.some((x) => x.startsWith("Fantasy")), "an unreadable RELEASE file keeps the hold");
  assert.match(v3.problems.join(" | "), /RELEASE-W1\.json can't be read/);
});

test("VB-10: a results file first seen under 2 h before the deadline raises an alert to post it by hand", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim, at } = await weekOneClosed();
  at(GENESIS + 2 * WEEK + 3 * DAY - 90 * 60_000);
  const v = fctx(sim, allFiles(), {});
  await vaultResultsPass(v, async () => true);
  assert.match(v.problems.join(" | "), /Fantasy week 1: its results file appeared only .* before the deadline.*game-post 2 1/);
});

test("VB-8: only ranked (staked-board) rows are read for the missing-wallet check when the board marks them", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  let reads = 0;
  const chain: any = new Proxy(sim, { get: (t, p) => p === "read" ? async (m: string, a: any) => { if (m === "get_game_player" && a.player === addr(E) && a.game === 2) reads++; return t.read(m, a); } : (t as any)[p] });
  const v = fctx(chain, allFiles());
  await vaultResultsPass(v, async () => true);
  assert.equal(reads, 0, "E is on the Free play board (ranked: false): not read");
});

test("VB-6: past the board's row cap, a file row missing from the board doesn't hold (logged)", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  const files: any = { ...allFiles(), "mem:fantasy/board.json": fantasyBoard([{ a: addr(B), pts: 30, place: 1, ranked: true }]) };
  const v = fctx(sim, files), s: string[] = [];
  v.deployment.vaultGames["2"].boardCap = 1;
  await vaultResultsPass(v, async (what) => { s.push(what); return true; });
  assert.deepEqual(s.filter((x) => x.startsWith("Fantasy")), fantasySends);
  const v2 = fctx(sim, files);
  await vaultResultsPass(v2, async () => true);
  assert.match(v2.problems.join(" | "), /not on the game's board/, "below the cap it still holds");
});

test("VB-7: the missing-wallet check never asks for wallets under 1 VHP, whatever the vault's minimum", async () => {
  const { stakedFloor } = await import("./vault.ts");
  assert.equal(stakedFloor(0n), 100_000_000n);
  assert.equal(stakedFloor(50_000_000n), 100_000_000n);
  assert.equal(stakedFloor(500_000_000n), 500_000_000n);
});

test("VB-11: a results file's fingerprint ignores the order of rows and winners", async () => {
  const { fileHash } = await import("./vault.ts");
  const P = (n: number) => `1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrm${"abcdefgh"[n]}`;
  const a = { game: 2, week: 1, final: true, rows: [{ player: P(0), points: 9 }, { player: P(1), points: 4 }], first: [P(2), P(3)], second: [] };
  const b = { ...a, rows: [a.rows[1], a.rows[0]], first: [P(3), P(2)] };
  assert.equal(fileHash(a), fileHash(b));
  assert.notEqual(fileHash(a), fileHash({ ...a, rows: [{ player: P(0), points: 8 }, a.rows[1]] }));
});

test("v6.1 (D-116): the vault bot handles the question game only from its shared-rules week; other games always", async () => {
  const { sharedRulesWeek, vaultHandles } = await import("./vault.ts");
  assert.equal(sharedRulesWeek({}, 5), false, "rule not set (v6): never");
  assert.equal(sharedRulesWeek({ q60_rule_week_plus_one: "0" }, 5), false);
  const c = { q60_rule_week_plus_one: "4" };                  // first shared-rules week: 3
  assert.equal(sharedRulesWeek(c, 2), false, "the week the upload lands in keeps the old rules");
  assert.equal(sharedRulesWeek(c, 3), true);
  assert.equal(sharedRulesWeek(c, 9), true);
  assert.equal(vaultHandles(1, c, 2), false, "an old-rule week of game 1: settle and claim, not a results file");
  assert.equal(vaultHandles(1, c, 3), true);
  assert.equal(vaultHandles(2, {}, 0), true, "every other game, always");
});

test("owner 4 Nov (Mana): a week's points and prize places go out six wallets per transaction", { skip: !fs.existsSync(NEW) && `${NEW} missing: run npm run build:sim in game/` }, async () => {
  const { sim, at, ok } = await world();
  await ok([["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false, season_weeks: 1 }], ["propose_game", { game: 3, name: "Block X", staked: false, free_prize: true, season_weeks: 1 }]], [owner]);
  at(T0 + 2 * DAY + HOUR);
  await ok([["apply_game", { game: 2 }], ["apply_game", { game: 3 }]], [owner]);
  await ok([["seed_deposit_vhp", { amount: String(2000n * VHP) }]], [seedOwner]);
  const many = Array.from({ length: 14 }, (_, i) => key(`many ${i}`));
  for (const p of many) {
    await sim.ledgerSet(2, addr(p), 100n * VHP); await sim.ledgerSet(3, addr(p), 100n * VHP);
    await ok([["deposit_to", { from: addr(p), game: 2, amount: String(VHP), koin: false }]], [p]);
  }
  at(GENESIS + WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "0" }]], []);
  await sim.ledgerAdd(2, addr(contract), 100n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "1" }]], []);
  const free = [A, B, C, D, E, key("free 6"), key("free 7")].map(addr);
  const results = {
    "mem:fantasy/W1": { game: 2, week: 1, final: true, rows: many.map((p, i) => ({ player: addr(p), points: 1 + i })) },
    "mem:blockx/W1": { game: 3, week: 1, final: true, rows: [], first: free, second: [] },
  };
  const v = vctx(sim, results), sent: string[] = [];
  await vaultResultsPass(v, sendAs(sim, operator, sent));
  assert.deepEqual(v.problems, []);
  assert.deepEqual(sent.filter((s) => s.startsWith("Fantasy")), [
    "Fantasy week 1: points for 6 player(s)", "Fantasy week 1: points for 6 player(s)", "Fantasy week 1: points for 2 player(s)",
    "Fantasy week 1: seal the results (the owner can correct them for 24 h)",
  ]);
  assert.deepEqual(sent.filter((s) => s.startsWith("Block X")), [
    `Block X week 1: prize place 1 → ${free.slice(0, 6).join(", ")}`, `Block X week 1: prize place 1 → ${free[6]}`,
    "Block X week 1: seal the results (the owner can correct them for 24 h)",
  ]);
  assert.equal(Number((await sim.read("get_game", { game: 3, week: "1" })).week.first_n), 7, "all seven tied winners are on chain");
});

test("N-2: capScope \"staked\" compares the row cap with the Staked board only, so a short Staked board still holds", { skip: !fs.existsSync(NEW) && `${NEW} missing` }, async () => {
  const { sim } = await weekOneClosed();
  // The Staked board has 1 row (B) and the Free board 1 (E): 2 rows in all. C is in the file but on no board.
  const files: any = { ...allFiles(), "mem:fantasy/board.json": fantasyBoard([{ a: addr(B), pts: 30, place: 1, ranked: true }, { a: addr(E), pts: 50, place: 1, ranked: false }]) };
  // Without capScope (as before): the whole board is at its cap of 2, so the not-on-board check is skipped.
  const v1 = fctx(sim, files), s1: string[] = [];
  v1.deployment.vaultGames["2"].boardCap = 2;
  await vaultResultsPass(v1, async (what) => { s1.push(what); return true; });
  assert.deepEqual(s1.filter((x) => x.startsWith("Fantasy")), fantasySends);
  // capScope "staked": the Staked board (1 row) is under the cap, so C missing from it holds the week.
  const v2 = fctx(sim, files), s2: string[] = [];
  Object.assign(v2.deployment.vaultGames["2"], { boardCap: 2, capScope: "staked" });
  await vaultResultsPass(v2, async (what) => { s2.push(what); return true; });
  assert.deepEqual(s2.filter((x) => x.startsWith("Fantasy")), [], "nothing posted");
  assert.match(v2.problems.join(" | "), /not on the game's board/);
  // capScope "staked" with the Staked board at the cap: skipped again (logged).
  const v3 = fctx(sim, files), s3: string[] = [];
  Object.assign(v3.deployment.vaultGames["2"], { boardCap: 1, capScope: "staked" });
  await vaultResultsPass(v3, async (what) => { s3.push(what); return true; });
  assert.deepEqual(s3.filter((x) => x.startsWith("Fantasy")), fantasySends);
});

test("N-3: a transaction that ran out of Mana is retried next run, not remembered as the vault's refusal (with the chain's real log text, #C-6)", async () => {
  const { isRevert } = await import("./vault.ts");
  const { revertError } = await import("./chain.ts");
  const L = 190_000_000n, OUT = ["transaction reverted: insufficient rc"];
  // Out of compute: rc_used ends at the limit; the chain logs "insufficient rc".
  const compute = revertError({ rc_used: String(L), logs: OUT }, L);
  assert.match(compute, /^out of Mana/);
  assert.equal(isRevert(compute), false, "C6-1: its logs say 'transaction reverted', but it is still temporary");
  // Out of Mana on a large charge (a storage write): rc_used stops at 91% of the limit (C6-2).
  const write = revertError({ rc_used: String((L * 91n) / 100n), logs: OUT }, L);
  assert.match(write, /^out of Mana/);
  assert.equal(isRevert(write), false);
  // The whole limit used, even with no logs.
  assert.equal(isRevert(revertError({ rc_used: "188200000", logs: [] }, L)), false);
  // A contract refusal, as real receipts carry it.
  const refused = revertError({ rc_used: "1200000", logs: ["transaction reverted: owner only"] }, L);
  assert.equal(refused, 'reverted: ["transaction reverted: owner only"]');
  assert.equal(isRevert(refused), true, "a contract refusal is still a refusal");
  // A refusal whose text only mentions Mana is not the chain's exact line.
  assert.equal(isRevert(revertError({ rc_used: "1200000", logs: ["transaction reverted: not enough insufficient rc stuff"] }, L)), true);
  assert.equal(isRevert(revertError({ rc_used: "x", logs: [] }, L)), true, "unreadable Mana use: treated as a refusal (fails closed)");
  // Out of Mana at submit (#C-7, C7-1): koilib throws the node's JSON with the chain's logs; nothing is charged.
  const { submitError } = await import("./chain.ts");
  const atSubmit = submitError(JSON.stringify({ error: "insufficient rc", logs: ["transaction reverted: insufficient rc"] }));
  assert.match(atSubmit, /^out of Mana: refused when submitted/);
  assert.equal(isRevert(atSubmit), false, "out of Mana at submit is temporary");
  assert.equal(isRevert(submitError(JSON.stringify({ error: "insufficient rc", logs: ["a contract log", "transaction reverted: insufficient rc"] }))), false, "a contract log before it");
  const refusedAtSubmit = submitError(JSON.stringify({ error: "owner only", logs: ["transaction reverted: owner only"] }));
  assert.equal(isRevert(refusedAtSubmit), true, "a contract refusal at submit is still a refusal");
  assert.equal(submitError("fetch failed"), "fetch failed", "text that isn't JSON is returned as it is");
  // Submit-time refusals and other failures are unchanged.
  assert.equal(isRevert('{"error":"x","logs":["transaction reverted: results for that week are past their deadline"]}'), true);
  assert.equal(isRevert("sent, but not seen in a block within 3 minutes (will be re-checked next run)"), false);
});

test("Repo Lens #E-16 N-1: questionWeekShared follows the contract's qShared rule (rule week, or game 1's game-week closed)", async () => {
  const { questionWeekShared } = await import("./vault.ts");
  const chainWith = (closed: boolean | "throws") => ({ read: async (m: string, a: any) => {
    assert.equal(m, "get_game"); assert.equal(a.game, 1);
    if (closed === "throws") throw new Error("v6: no game-1 game-week");
    return { week: { closed } };
  } }) as any;
  const c = { q60_rule_week_plus_one: "4" };                      // rule week 3
  assert.equal(await questionWeekShared(chainWith(false), c, 3), true, "a shared-rules week, without reading");
  assert.equal(await questionWeekShared(chainWith(false), c, 2), false, "an old-rules week whose game-week isn't closed");
  assert.equal(await questionWeekShared(chainWith(true), {}, 2), true, "closed the new way: shared even after a rollback moved the rule week");
  assert.equal(await questionWeekShared(chainWith("throws"), {}, 2), false, "v6 (no game-1 game-week): not shared");
});

test("owner 10 Nov (Week 1 = Mon 16): a test week (vaultTestWeeks) posts nothing and rolls over at its deadline", { skip: !fs.existsSync(NEW) && `${NEW} missing: run npm run build:sim in game/` }, async () => {
  const { testWeeks, isTestWeek } = await import("./vault.ts");
  assert.deepEqual(testWeeks({ vaultTestWeeks: [3] }), [3]);
  assert.deepEqual(testWeeks({}), []);
  assert.equal(isTestWeek({ vaultTestWeeks: [3] }, 3), true);
  assert.equal(isTestWeek({ vaultTestWeeks: [3] }, 2), false, "only the listed week: the week before still pays");
  assert.equal(isTestWeek({ vaultTestWeeks: [3] }, 4), false);
  for (const bad of [3, "3", true, ["3"], [3.5], [-1], {}]) assert.throws(() => testWeeks({ vaultTestWeeks: bad }), /not a list of week numbers/, JSON.stringify(bad));
  const { sim, at, ok } = await world();
  await ok([["propose_game", { game: 2, name: "Fantasy", staked: true, free_prize: false, season_weeks: 1 }], ["propose_game", { game: 3, name: "Block X", staked: false, free_prize: true, season_weeks: 1 }]], [owner]);
  at(T0 + 2 * DAY + HOUR);
  await ok([["apply_game", { game: 2 }], ["apply_game", { game: 3 }]], [owner]);
  await ok([["seed_deposit_vhp", { amount: String(2000n * VHP) }]], [seedOwner]);
  for (const p of [A, B]) {
    await sim.ledgerSet(2, addr(p), 100n * VHP); await sim.ledgerSet(3, addr(p), 100n * VHP);
    await ok([["deposit_to", { from: addr(p), game: 2, amount: String(VHP), koin: false }]], [p]);
  }
  at(GENESIS + WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "0" }]], []);
  await sim.ledgerAdd(2, addr(contract), 100n * VHP);
  at(GENESIS + 2 * WEEK + 12 * HOUR + 1);
  await ok([["close_week", { week: "1" }]], []);
  const results = {
    "mem:fantasy/W1": { game: 2, week: 1, final: true, rows: [{ player: addr(A), points: 5 }, { player: addr(B), points: 3 }] },
    "mem:blockx/W1": { game: 3, week: 1, final: true, rows: [], first: [addr(C)], second: [] },
  };
  const v = vctx(sim, results);
  v.deployment.vaultTestWeeks = [1];                       // week 1 is the test week
  const sent: string[] = [];
  await vaultResultsPass(v, sendAs(sim, operator, sent));
  assert.deepEqual(sent, [], "nothing is posted for a test week");
  assert.deepEqual(v.problems, []);
  const before = (await sim.read("get_game", { game: 2, week: "1" })).week;
  assert.ok(BigInt(before.bucket ?? 0) > 0n, "the test week has a bucket to roll");
  at(GENESIS + 2 * WEEK + 3 * DAY + 13 * HOUR);           // past week 1's results deadline
  await vaultFinalizePass(v, sendAs(sim, operator, sent));
  assert.deepEqual(sent.filter((x) => !x.startsWith("Questions")).sort(), ["Block X week 1: finalize (no results: roll the week over)", "Fantasy week 1: finalize (no results: roll the week over)"]);
  const after = (await sim.read("get_game", { game: 2, week: "1" })).week;
  assert.equal(after.rolled_over, true, "the bucket stays in the game for its next week");
  assert.equal(BigInt((await sim.read("get_game", { game: 2 })).game.rolled ?? 0), BigInt(before.bucket), "added to the game's next week");
});
