// Audit Bot red-team (insider) test INS-A, KnodeGames commit a8d0569.
// Attack: a stolen OPERATOR_WIF (or the owner key, by a set_operator round trip) posts a 255-point result row for the
// attacker's own 1-VHP wallet in a staked game's finished week (Kpred.ts:1995-2016) and either
//   A1) seals the week at once, before the hourly bot runs (Kpred.ts:2048-2056), or
//   A2) leaves it unsealed, so the bot posts the published file's rows next to it and seals it in.
// The bot skips a sealed week without a word (bot/vault.ts:325), checks only the file's own rows (vault.ts:436-448)
// and its alerts look only at owner corrections and voids (vault.ts:593-603); healthPass (bot/bot.ts:555-618) has no
// other check. Nobody is told; a day after the seal the bot's own vaultFinalizePass finalizes the week and the 1-VHP
// wallet claims the whole bucket (A1) or the top place in it (A2). SECURITY.md:19-21 promises the bot alerts on anything
// unexpected and a doubtful week is held.
// Asserts the SAFE behaviour (an alert, or no silent seal): FAILS before the fix (proof), PASSES after.
// Runs with plain `node --test` from <repo>/audit-bot-tests/ (cwd = repo root). bot/vault.ts imports bot/chain.ts,
// whose TypeScript parameter properties Node's type stripping refuses, so it is loaded through the repo's own tsx
// devDependency (tsx/esm/api). No network, no git: the chain and the data-branch files are in-memory fakes.
import { test } from "node:test";
import assert from "node:assert/strict";

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
const NOW = weekEnd(W) + 2 * HOUR;                      // the bot's first run after the week ended
const VHP = 100_000_000n;
const P1 = "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz";        // honest stakers on the game's board
const P2 = "1HGh4rQvYYcm4fGiU1C7vQoSxnUiGa9Ah7";
const SYBIL = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq";     // the attacker's wallet: 1 VHP staked a week ahead, never played

/** One staked game (id 2) whose week W is closed by the vault; `attack` is what the stolen key did first:
 *  "none" (control), "row" (a sybil row posted, not sealed) or "sealed" (a sybil row posted and the week sealed). */
function world(attack) {
  const game = { id: 2, name: "Producer Race", staked: true, free_prize: false, active: true, from_week: "1", season_weeks: 0, last_week_plus_one: 0 };
  const gw = { closed: true, sealed: false, seal_time: "0", finalized: false, voided: false, fin_started: false,
    eligible_players: 0, max_points: 0, bucket: String(80n * VHP), first_n: 0, second_n: 0, last_change_time: "0" };
  const points = new Map();
  if (attack !== "none") {
    points.set(SYBIL, 255);
    gw.eligible_players = 1;
    gw.max_points = 255;
    if (attack === "sealed") { gw.sealed = true; gw.seal_time = String(weekEnd(W) + 60_000); }
  }
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
          time: String(NOW),
          config: { genesis_time: String(GENESIS), week_length: String(WEEK), close_delay: String(12 * HOUR), min_stake: String(VHP),
            min_stake_next: "0", min_stake_next_week: "0", q60_rule_week_plus_one: "1" },
          totals: { weeks_closed: String(W + 1) },
        };
        case "get_game": return { game, week: Number(args.game) === 2 && Number(args.week) === W ? { ...gw } : {} };
        case "get_game_player": {
          const p = points.get(args.player);
          return { entry: p ? { points: p, prize_place: 0, stake: String(VHP), peak_stake: String(VHP) } : null,
            week_stake: String(10n * VHP), active_stake: String(10n * VHP) };
        }
        default: throw new Error(`unexpected read ${method}`);
      }
    },
  };
  const sent = [];
  const send = async (what, calls) => {
    for (const c of calls) {
      sent.push(c.method);
      if (c.method === "post_results") for (const r of c.args.rows) { points.set(r.player, r.points); gw.eligible_players += 1; }
      if (c.method === "seal_results") { gw.sealed = true; gw.seal_time = String(NOW); }
    }
    return true;
  };
  // The data branch as the recorder published it: the final results file and the board it is checked against.
  const files = {
    [`mem:race/vault/W${W}.json`]: { game: 2, week: W, final: true, rows: [{ player: P1, points: 2 }, { player: P2, points: 1 }], first: [], second: [] },
    "mem:race/board.json": { lastWeek: { week: W, rows: [{ a: P1, pts: 9, place: 1, ranked: true }, { a: P2, pts: 4, place: 2, ranked: true }] } },
  };
  const readFile = (spec) => (spec in files ? { state: "ok", data: structuredClone(files[spec]) } : { state: "missing" });
  const ctx = {
    chain, operator: null, dryRun: false, problems: [], quiet: true,
    deployment: { vaultGames: { "2": { name: "Producer Race", results: "mem:race/vault" } } },
    readFile,
    readPrizeSwitches: () => null,
  };
  return { ctx, send, sent, gw, game };
}

test("control: with nothing posted out of band, the bot posts the published file and seals it with no problem", async () => {
  const { ctx, send, sent } = world("none");
  await V.vaultResultsPass(ctx, send);
  assert.deepEqual(ctx.problems, [], "control: the fake chain and files pass every check of the results pass");
  assert.deepEqual(sent, ["post_results", "seal_results"], "control: the harness reaches the post and the seal");
});

test("INS-A1: a game week sealed outside the bot, holding a row its published results file doesn't have, raises an alert", async () => {
  const { ctx, send, gw, game } = world("sealed");
  await V.vaultResultsPass(ctx, send);
  const alerts = [];
  V.vaultAlerts({ games: [game], proposals: [] }, { weeksClosed: W + 1 }, new Map([[`Producer Race:${W}`, { ...gw }]]), (_key, text) => alerts.push(text));
  assert.ok(ctx.problems.length + alerts.length > 0,
    "INS-A1: the operator key posted a 255-point row for a 1-VHP wallet that is not in the published results file and " +
    "sealed the week before the bot ran; the bot's results pass and its hourly alerts said nothing " +
    `(problems ${JSON.stringify(ctx.problems)}, alerts ${JSON.stringify(alerts)}), so the week finalizes a day after the ` +
    "seal and that wallet claims the game's whole weekly bucket while the honest stakers get nothing");
});

test("INS-A2: a result row on chain that the published file doesn't have is not sealed in silently", async () => {
  const { ctx, send, sent, gw } = world("row");
  await V.vaultResultsPass(ctx, send);
  const sealedSilently = sent.includes("seal_results") && ctx.problems.length === 0;
  assert.ok(!sealedSilently,
    "INS-A2: before the bot ran, the operator key posted a 255-point row for a 1-VHP wallet the published file and board " +
    `don't have; the bot posted its own rows next to it and sealed the week without a word (sent ${JSON.stringify(sent)}, ` +
    `eligible on chain ${gw.eligible_players} vs ${2} file rows), so the sybil takes 1st place in the payout`);
});
