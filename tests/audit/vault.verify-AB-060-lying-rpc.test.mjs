// Independent reviewer verification, a shorter path to AB-060's impact (KnodeGames, commit a8d0569).
// Claim: vaultResultsPass (bot/vault.ts:287-516) reads every chain fact it acts on (get_game_player: stake, posted
// points) from ONE node, ctx.chain = new KoinosChain(RPC) (bot/bot.ts:2200; RPC defaults to a public third-party node,
// .github/workflows/bot.yml:139). RPC_CHECK is used only for window blocks and VHP readings (bot.ts:2219-2241). A row
// the node says is "not staked" is skipped with a log line only (vault.ts:446, 487), never a problem, and the week is
// sealed anyway (vault.ts:515). So whoever runs (or compromises) the bot's primary RPC node, holding NO key and NO repo
// access, can make the bot drop every honest row of a game week and seal it with only its own legitimately played
// 1-VHP wallet left: the contract can't see an omission, the sealed week is skipped silently afterwards (vault.ts:325),
// and that wallet takes the game's whole weekly bucket. README:22-24 / SECURITY.md:20: "re-checked on two independent
// nodes before anything is paid".
// The results file and board here are the HONEST ones (the attacker's wallet really played and scored 1 point, last).
//   control: an honest node -> all three rows posted, then the seal.
//   attack:  the node reports the two honest 10-VHP stakers as unstaked -> only the attacker's row is posted, sealed,
//            no problem raised.
// Asserts the SAFE behaviour in the attack case (a problem raised, or nothing sealed): FAILS on the current code (proof).
// Run like tests/redteam-insider/vault.redteam-insider-silent-seal.test.mjs: copy into <repo>/audit-bot-tests/ and run
// `node --test audit-bot-tests/vault.verify-AB-060-lying-rpc.test.mjs` from the repo root.
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
const W = 5;
const weekEnd = (w) => GENESIS + (w + 1) * WEEK;
const VHP = 100_000_000n;
const P1 = "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz";        // honest stakers: 10 VHP each, 1st and 2nd on the board
const P2 = "1HGh4rQvYYcm4fGiU1C7vQoSxnUiGa9Ah7";
const ATT = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq";       // the node operator's own wallet: 1 VHP, really played, last
const SRC = "race-data:vault";

const FILE = { game: 7, week: W, final: true, rows: [{ player: P1, points: 3 }, { player: P2, points: 2 }, { player: ATT, points: 1 }], first: [], second: [] };
const BOARD = { lastWeek: { week: W, rows: [{ a: P1, pts: 9, place: 1, ranked: true }, { a: P2, pts: 4, place: 2, ranked: true }, { a: ATT, pts: 1, place: 3, ranked: true }] } };

function world(lie) {
  let now = weekEnd(W) + 2 * HOUR;
  const game = { id: 7, name: "Producer Race", staked: true, free_prize: false, active: true, from_week: "1", season_weeks: 0, last_week_plus_one: 0 };
  const gw = { closed: true, sealed: false, seal_time: "0", finalized: false, voided: false, fin_started: false,
    eligible_players: 0, max_points: 0, bucket: String(80n * VHP), first_n: 0, second_n: 0, last_change_time: "0" };
  const truth = new Map([[P1, 10n * VHP], [P2, 10n * VHP], [ATT, 1n * VHP]]);   // the chain's real stakes, week W
  const points = new Map();
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
          const p = points.get(args.player);
          // The lying primary node: the honest stakers "were not staked" that week (the attacker's wallet is told truly).
          const s = lie && args.player !== ATT ? 0n : (truth.get(args.player) ?? 0n);
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
  const files = { [`${SRC}/W${W}.json`]: FILE, "race-data:board.json": BOARD };
  const readFile = (spec) => (spec in files ? { state: "ok", data: structuredClone(files[spec]) } : { state: "missing" });
  const ctx = {
    chain, operator: null, dryRun: false, problems: [], quiet: true,
    deployment: { vaultGames: { "7": { name: "Producer Race", results: SRC } } },
    readFile, readPrizeSwitches: () => null, memo: {},
  };
  const twoRuns = async () => {
    await V.vaultResultsPass(ctx, send);
    now += 61 * 60_000;
    await V.vaultResultsPass(ctx, send);
  };
  return { ctx, sent, posted, twoRuns };
}

test("control: with an honest node every row of the honest file is posted, then the seal", async () => {
  const { ctx, sent, posted, twoRuns } = world(false);
  await twoRuns();
  assert.deepEqual(ctx.problems, [], "control: no problem");
  assert.deepEqual(posted.sort(), [P1, P2, ATT].sort(), "control: all three rows posted");
  assert.equal(sent[sent.length - 1], "seal_results", "control: sealed after the rows");
});

test("lying primary RPC: honest rows dropped as 'not staked' are not sealed out in silence", async () => {
  const { ctx, sent, posted, twoRuns } = world(true);
  await twoRuns();
  const silent = sent.includes("seal_results") && ctx.problems.length === 0 && !posted.includes(P1) && !posted.includes(P2);
  assert.ok(!silent,
    "AB-060 (shorter path): the bot's single primary RPC node said the two 10-VHP stakers were unstaked; the bot dropped " +
    `their rows with a log line only, posted ${JSON.stringify(posted)} and sealed (sent ${JSON.stringify(sent)}, problems ` +
    `${JSON.stringify(ctx.problems)}). On chain the attacker's 1-point, 1-VHP wallet is then the only result and takes the ` +
    "game's whole weekly bucket a day later: no key, no repo access, and the second node is never asked");
});
