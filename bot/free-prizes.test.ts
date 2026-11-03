/**
 * Free-prize switches (bot/free-prizes.ts, D-082): a change counts only from the week after it was made, and the
 * vault bot posts free winners only when the switch is on (or unset), holding everything when it can't read them.
 *
 * Run: node --import tsx --test bot/free-prizes.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSwitches, switchFor, prizeOn, setSwitch, empty, weekOf, weekStart, GENESIS_MS, WEEK_MS, type Switches } from "./free-prizes.ts";
import { vaultResultsPass, type VaultCtx } from "./vault.ts";

const HOUR = 3_600_000;
const at = (w: number, hours = 0) => weekStart(w) + hours * HOUR;

test("vault week 0 is Mon 19 Oct 2026 00:00 UTC; Mon 9 Nov is week 3", () => {
  assert.equal(new Date(GENESIS_MS).toISOString(), "2026-10-19T00:00:00.000Z");
  assert.equal(weekOf(Date.UTC(2026, 10, 9)), 3);
  assert.equal(weekOf(Date.UTC(2026, 10, 8, 23, 59)), 2);
  assert.equal(WEEK_MS, 604_800_000);
});

test("a switch made in week W counts from week W + 1, never this week or before", () => {
  const { next, from } = setSwitch(empty(), 3, false, at(2, 50));      // Wed of week 2
  assert.equal(from, 3);
  assert.equal(switchFor(next, 3, 2), null, "this week keeps following the registration");
  assert.equal(switchFor(next, 3, 3), false);
  assert.equal(switchFor(next, 3, 9), false, "and every later week");
  assert.equal(switchFor(next, 7, 3), null, "other games unchanged");
  // Turned back on in week 5: on from week 6; weeks 3-5 stay off.
  const on = setSwitch(next, 3, true, at(5, 1)).next;
  assert.deepEqual([2, 3, 4, 5, 6, 7].map((w) => switchFor(on, 3, w)), [null, false, false, false, true, true]);
});

test("changing your mind in the same week replaces that week's change", () => {
  let s = setSwitch(empty(), 8, true, at(4, 1)).next;
  s = setSwitch(s, 8, false, at(4, 30)).next;
  assert.equal(s.games["8"].length, 1);
  assert.equal(switchFor(s, 8, 5), false);
});

test("a backdated change (set after its week started) never counts", () => {
  const s: Switches = { v: 1, games: { "2": [{ from: 3, on: false, set: new Date(at(3, 5)).toISOString() }] } };
  assert.equal(checkSwitches(s), "");
  assert.equal(switchFor(s, 2, 3), null);
  assert.equal(switchFor(s, 2, 4), null);
});

test("seasons: a 2-week season pays only if the switch was on for both weeks", () => {
  const s = setSwitch(empty(), 3, true, at(3, 1)).next;                 // on from week 4
  const off = setSwitch(empty(), 3, false, at(3, 1)).next;              // off from week 4
  assert.equal(prizeOn(off, 3, 4, 2), false, "season weeks 3-4: week 4 off");
  assert.equal(prizeOn(off, 3, 3, 2), true, "season weeks 2-3 untouched");
  assert.equal(prizeOn(s, 3, 5, 2), true);
  const offThenOn = setSwitch(setSwitch(empty(), 3, false, at(1, 1)).next, 3, true, at(4, 1)).next; // off 2-4, on 5+
  assert.equal(prizeOn(offThenOn, 3, 5, 2), false, "turned on mid-season: starts with the next season");
  assert.equal(prizeOn(offThenOn, 3, 7, 2), true);
  assert.equal(prizeOn(null, 3, 7, 2), true, "no file: follow the registration");
});

test("malformed files are refused; unknown games are refused", () => {
  for (const bad of [null, {}, { v: 2, games: {} }, { v: 1, games: [] }, { v: 1, games: { "1": [] } }, { v: 1, games: { "2": [{ from: 3, on: "yes", set: "2026-11-03T00:00:00Z" }] } },
    { v: 1, games: { "2": [{ from: 4, on: true, set: "2026-11-03T00:00:00Z" }, { from: 3, on: false, set: "2026-11-03T00:00:00Z" }] } }])
    assert.notEqual(checkSwitches(bad), "", JSON.stringify(bad));
  assert.throws(() => setSwitch(empty(), 5, true, at(3)), /isn't a vault game/);
  assert.throws(() => setSwitch(empty(), 1, true, at(3)), /isn't a vault game/);
});

// ── the vault bot obeys the switch (a stub chain: game 3, a free-prize game, week 3 just ended) ──
const P1 = "1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717", P2 = "1HsM33aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
function stubChain() {
  const sent: string[] = [];
  const chain: any = {
    read: async (m: string, a: any) => {
      if (m === "list_games") return { games: [{ id: 3, name: "Survivor", staked: true, free_prize: true, season_weeks: 1, from_week: 3, active: true }] };
      if (m === "get_state") return { time: String(at(4, 2)), config: { genesis_time: String(GENESIS_MS), week_length: String(WEEK_MS), min_stake: "100000000" }, totals: { weeks_closed: "4" } };
      if (m === "get_game") return { week: { closed: true, prize: "300000000" } };
      if (m === "get_game_player") return { entry: { points: 0, prize_place: 0, peak_stake: "0" }, active_stake: "0", week_stake: "0" };
      throw new Error(m);
    },
  };
  return { chain, sent };
}
const file = { game: 3, week: 3, final: true, rows: [], first: [P1], second: [P2] };
async function run(readPrizeSwitches: VaultCtx["readPrizeSwitches"]) {
  const { chain } = stubChain();
  const methods: string[] = [];
  const ctx: VaultCtx = { chain, operator: {} as any, dryRun: true, problems: [], quiet: true, deployment: { vaultGames: { "3": { results: "x" } } },
    readResults: () => JSON.parse(JSON.stringify(file)), readPrizeSwitches };
  await vaultResultsPass(ctx, async (_what, calls) => { methods.push(...calls.map((c) => c.method)); return true; });
  return { methods, problems: ctx.problems };
}

test("vault bot: switch on (or no file) → winners posted and sealed", async () => {
  assert.deepEqual((await run(() => null)).methods, ["post_prize_winners", "post_prize_winners", "seal_results"]);
  const on = setSwitch(empty(), 3, true, at(2, 1)).next;
  assert.deepEqual((await run(() => on)).methods, ["post_prize_winners", "post_prize_winners", "seal_results"]);
});

test("vault bot: switch off → no winners, still sealed (the prize goes back to the pool)", async () => {
  const off = setSwitch(empty(), 3, false, at(2, 1)).next;
  const r = await run(() => off);
  assert.deepEqual(r.methods, ["seal_results"]);
  assert.deepEqual(r.problems, []);
});

test("vault bot: a switch set during week 3 doesn't reach week 3", async () => {
  const late = setSwitch(empty(), 3, false, at(3, 10)).next;            // from week 4
  assert.deepEqual((await run(() => late)).methods, ["post_prize_winners", "post_prize_winners", "seal_results"]);
});

test("vault bot: switches unreadable → nothing posted for that game, a problem reported (fail closed)", async () => {
  const r = await run(() => { throw new Error("origin unreachable"); });
  assert.deepEqual(r.methods, []);
  assert.match(r.problems.join("\n"), /free-prize switches .* can't be read/);
});
