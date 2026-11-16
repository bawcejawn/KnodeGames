// Independent reviewer verification for AB-058 (KnodeGames, commit a8d0569).
// Claim: bot/vault.ts vaultResultsPass reads a game's results file AND the board it checks that file against from the
// same data branch (race-data / games-data), with no signature, author check or recompute. Whoever can push to that
// branch writes a results file plus a matching board, and the hourly bot (OPERATOR_WIF) posts and seals it.
// This test drives the real vaultResultsPass through the hourly path (with a memo: two runs, 61 minutes apart, so the
// 30-minute stability rule is met), with an in-memory chain and in-memory branch files. No network, no git.
//   control-1: the honest file and honest board -> the bot posts the two honest stakers and seals (harness works).
//   control-2: a forged file with the HONEST board -> held ("staked-list"): the board is the only cross-check.
//   AB-058:    a forged file AND a forged board -> the bot posts a 255-point row for a 1-VHP wallet, seals, and raises
//              no problem; the two 10-VHP stakers that the chain shows as staked in the game are never read.
// Asserts the SAFE behaviour in the AB-058 case (a problem raised, or nothing sealed): FAILS on the current code (proof).
// Run like the auditor's tests/redteam-insider/vault.redteam-insider-silent-seal.test.mjs: copy into
// <repo>/audit-bot-tests/ and run `node --test audit-bot-tests/vault.verify-AB-058-forged-branch.test.mjs` from the
// repo root (it loads bot/vault.ts through the repo's own tsx devDependency, as that test does).
// ADAPTED for the fix (audit AB-058, 16 Nov 2026), changes marked "AB-058 fix": the data branch now carries the publish
// job's seals. The honest file and board are sealed with the publish key (deployment.json resultsSealKey is its public
// key); whoever pushes to the branch has no publish key, so the forged ones are unsealed (or sealed with another key).
// The import path is one level deeper (tests/audit/). Before the fix the AB-058 case failed exactly as the verifier's
// original did (the bot ignored resultsSealKey); after it, the forged week is held with a problem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

async function loadVault() {
  let api;
  try { api = await import("tsx/esm/api"); } catch (e) { throw new Error(`this test needs the repo's tsx devDependency (npm ci at the repo root): ${e?.message ?? e}`); }
  if (typeof api.tsImport === "function") return api.tsImport("../../bot/vault.ts", import.meta.url);
  api.register();
  return import("../../bot/vault.ts");
}
const V = await loadVault();

const HOUR = 3_600_000, DAY = 24 * HOUR, WEEK = 7 * DAY;
const GENESIS = 1_800_000_000_000 - (1_800_000_000_000 % DAY);
const W = 5;                                            // the vault week that just ended
const weekEnd = (w) => GENESIS + (w + 1) * WEEK;
const VHP = 100_000_000n;
const P1 = "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz";        // honest stakers in the game (10 VHP each)
const P2 = "1HGh4rQvYYcm4fGiU1C7vQoSxnUiGa9Ah7";
const SYBIL = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq";     // the branch writer's wallet: 1 VHP staked, never on the honest board
const SRC = "race-data:vault";                          // game 7 (Producer Race), as in game-data/deployment.json

const HONEST_FILE = { game: 7, week: W, final: true, rows: [{ player: P1, points: 2 }, { player: P2, points: 1 }], first: [], second: [] };
const HONEST_BOARD = { lastWeek: { week: W, rows: [{ a: P1, pts: 9, place: 1, ranked: true }, { a: P2, pts: 4, place: 2, ranked: true }] } };
const FORGED_FILE = { game: 7, week: W, final: true, rows: [{ player: SYBIL, points: 255 }], first: [], second: [] };
const FORGED_BOARD = { lastWeek: { week: W, rows: [{ a: SYBIL, pts: 99, place: 1, ranked: true }] } };

// AB-058 fix: the publish job's key (only the publish jobs hold it) and a key anyone else could make.
const publishKey = generateKeyPairSync("ed25519"), otherKey = generateKeyPairSync("ed25519");
const SEAL_PUB = publishKey.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const HONEST = new Set([HONEST_FILE, HONEST_BOARD]);
/** A data-branch file as the bot reads it, with the seal next to it: honest files by the publish job, forged ones by
 *  another key (or none). */
function put(files, spec, obj, sealWith) {
  const raw = JSON.stringify(obj) + "\n";
  files[spec] = { state: "ok", data: obj, raw };
  // The documented seal (kit/publish/results-seal.sh): "knodegames-results-v1\n<branch>:<path>\n" + the file's bytes.
  const msg = Buffer.from(`knodegames-results-v1\n${spec}\n${raw}`, "utf8");
  if (sealWith) files[`${spec}.seal`] = { state: "ok", data: { v: 1, sig: sign(null, msg, sealWith.privateKey).toString("base64") } };
}

function world(file, board) {
  let now = weekEnd(W) + 2 * HOUR;
  const game = { id: 7, name: "Producer Race", staked: true, free_prize: false, active: true, from_week: "1", season_weeks: 0, last_week_plus_one: 0 };
  const gw = { closed: true, sealed: false, seal_time: "0", finalized: false, voided: false, fin_started: false,
    eligible_players: 0, max_points: 0, bucket: String(80n * VHP), first_n: 0, second_n: 0, last_change_time: "0" };
  const stakes = new Map([[P1, 10n * VHP], [P2, 10n * VHP], [SYBIL, 1n * VHP]]);   // what the chain says, week W
  const points = new Map();
  const readPlayers = new Set();
  const chain = {
    kind: "sim",
    contractId: "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr",
    async head() { return { height: 1, lib: 1 }; },
    async mana() { return 10n ** 12n; },
    async send() { throw new Error("the vault passes send through the Send callback, never chain.send"); },
    async read(method, args = {}) {
      switch (method) {
        case "list_games": return { games: [game], proposals: [] };
        case "get_state": return {
          time: String(now),
          config: { genesis_time: String(GENESIS), week_length: String(WEEK), close_delay: String(12 * HOUR), min_stake: String(VHP),
            min_stake_next: "0", min_stake_next_week: "0", q60_rule_week_plus_one: "1" },
          totals: { weeks_closed: String(W + 1) },
        };
        case "get_game": return { game, week: Number(args.game) === 7 && Number(args.week) === W ? { ...gw } : {} };
        case "get_game_player": {
          readPlayers.add(args.player);
          const p = points.get(args.player), s = stakes.get(args.player) ?? 0n;
          return { entry: p ? { points: p, prize_place: 0, stake: String(s), peak_stake: String(s) } : null,
            week_stake: String(s), active_stake: String(s) };
        }
        default: throw new Error(`unexpected read ${method}`);
      }
    },
  };
  const sent = [], posted = [];
  const send = async (_what, calls) => {
    for (const c of calls) {
      sent.push(c.method);
      if (c.method === "post_results") for (const r of c.args.rows) { posted.push(r.player); points.set(r.player, r.points); gw.eligible_players += 1; }
      if (c.method === "seal_results") { gw.sealed = true; gw.seal_time = String(now); }
    }
    return true;
  };
  // The data branch as the branch writer left it (the bot fetches it fresh on every run).
  // AB-058 fix: the honest files carry the publish job's seal; a forged file or board carries another key's.
  const files = {};
  put(files, `${SRC}/W${W}.json`, file, HONEST.has(file) ? publishKey : otherKey);
  put(files, "race-data:board.json", board, HONEST.has(board) ? publishKey : otherKey);
  const readFile = (spec) => (spec in files ? structuredClone(files[spec]) : { state: "missing" });
  const memo = {};
  const ctx = {
    chain, operator: null, dryRun: false, problems: [], quiet: true,
    deployment: { vaultGames: { "7": { name: "Producer Race", results: SRC } }, resultsSealKey: SEAL_PUB },   // AB-058 fix
    readFile, readPrizeSwitches: () => null, memo,
  };
  // Two hourly runs, 61 minutes apart (the file must stay unchanged for 30 minutes before it is posted).
  const twoRuns = async () => {
    await V.vaultResultsPass(ctx, send);
    now += 61 * 60_000;
    await V.vaultResultsPass(ctx, send);
  };
  return { ctx, sent, posted, readPlayers, twoRuns };
}

test("control-1: the honest file and board are posted and sealed on the second hourly run", async () => {
  const { ctx, sent, posted, twoRuns } = world(HONEST_FILE, HONEST_BOARD);
  await twoRuns();
  assert.deepEqual(ctx.problems, [], "control-1: no problem with the honest files");
  assert.deepEqual(sent, ["post_results", "seal_results"], "control-1: the harness reaches the post and the seal");
  assert.deepEqual(posted.sort(), [P1, P2].sort(), "control-1: both honest stakers posted");
});

test("control-2: a forged file checked against the honest board is held (the board is the only cross-check)", async () => {
  const { ctx, sent, twoRuns } = world(FORGED_FILE, HONEST_BOARD);
  await twoRuns();
  assert.deepEqual(sent, [], "control-2: nothing sent");
  // AB-058 fix: the forged file is now held earlier, for its seal, before the board check would hold it.
  assert.ok(ctx.problems.some((p) => /not in the results file|isn't sealed by the publish job/.test(p)), `control-2: held (${JSON.stringify(ctx.problems)})`);
});

test("AB-058: a results file plus a matching board pushed to the data branch are not posted and sealed in silence", async () => {
  const { ctx, sent, posted, readPlayers, twoRuns } = world(FORGED_FILE, FORGED_BOARD);
  await twoRuns();
  const silent = sent.includes("seal_results") && ctx.problems.length === 0;
  assert.ok(!silent,
    "AB-058: a results file and board written to race-data by whoever can push there (nothing signed, nothing " +
    `recomputed) made the hourly bot post ${JSON.stringify(posted)} (255 points, 1 VHP) and seal the week with no problem ` +
    `raised (sent ${JSON.stringify(sent)}); the two 10-VHP stakers the chain shows in the game were ${readPlayers.has(P1) || readPlayers.has(P2) ? "read" : "never even read"}, ` +
    "so a day after the seal the week finalizes and that wallet takes the game's whole weekly bucket");
});
