/**
 * Free-prize switches (bot/free-prizes.ts, D-082): a change counts only from the week after it was made, and the
 * vault bot posts free winners only when the switch is on (or unset), holding everything when it can't read them.
 *
 * Run: node --import tsx --test bot/free-prizes.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSwitches, switchFor, prizeOn, setSwitch, empty, weekOf, weekStart, nearWeekEdge, GENESIS_MS, WEEK_MS, type Switches } from "./free-prizes.ts";
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
  for (const bad of [null, {}, { v: 2, games: {} }, { v: 1, games: [] }, { v: 1, games: { "1x": [] } }, { v: 1, games: { "2": [{ from: 3, on: "yes", set: "2026-11-03T00:00:00Z" }] } },
    { v: 1, games: { "2": [{ from: 4, on: true, set: "2026-11-03T00:00:00Z" }, { from: 3, on: false, set: "2026-11-03T00:00:00Z" }] } }])
    assert.notEqual(checkSwitches(bad), "", JSON.stringify(bad));
  assert.throws(() => setSwitch(empty(), 5, true, at(3)), /isn't a vault game/);
  assert.doesNotThrow(() => setSwitch(empty(), 1, true, at(3)), "D-136: game 1 is on the switch");
});

// ── the vault bot obeys the switch (a stub chain: game 3, a free-prize game, week 3 just ended) ──
const P1 = "1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717", P2 = "1HsM33aaaaaaaaaaaaaaaaaaaaaaaaaaaa", S1 = "1K8VVbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
type Opt = { hoursIntoNextWeek?: number; seasonWeeks?: number; fromWeek?: number; week?: number };
function stubChain(o: Opt = {}) {
  const chain: any = {
    read: async (m: string, a: any) => {
      if (m === "list_games") return { games: [{ id: 3, name: "Survivor", staked: true, free_prize: true, season_weeks: o.seasonWeeks ?? 1, from_week: o.fromWeek ?? 3, active: true }] };
      if (m === "get_state") return { time: String(at((o.week ?? 3) + 1, o.hoursIntoNextWeek ?? 2)), config: { genesis_time: String(GENESIS_MS), week_length: String(WEEK_MS), min_stake: "100000000" }, totals: { weeks_closed: String((o.week ?? 3) + 1) } };
      if (m === "get_game") return { week: { closed: true, prize: "300000000" } };
      if (m === "get_game_player") return a.player === S1
        ? { entry: { points: 0, prize_place: 0, peak_stake: "500000000" }, active_stake: "500000000", week_stake: "500000000" }
        : { entry: { points: 0, prize_place: 0, peak_stake: "0" }, active_stake: "0", week_stake: "0" };
      throw new Error(m);
    },
  };
  return { chain };
}
async function run(readPrizeSwitches: VaultCtx["readPrizeSwitches"], o: Opt = {}) {
  const w = o.week ?? 3;
  const file = { game: 3, week: w, final: true, rows: [{ player: S1, points: 10 }], first: [P1], second: [P2] };
  const { chain } = stubChain(o);
  const methods: string[] = [];
  const ctx: VaultCtx = { chain, operator: {} as any, dryRun: true, problems: [], quiet: true, deployment: { vaultGames: { "3": { results: "x" } } },
    readResults: (_s, wk) => (wk === w ? JSON.parse(JSON.stringify(file)) : null), readPrizeSwitches };
  await vaultResultsPass(ctx, async (_what, calls) => { methods.push(...calls.map((c) => c.method)); return true; });
  return { methods, problems: ctx.problems };
}

test("vault bot: switch on (or no file) → winners posted and sealed", async () => {
  assert.deepEqual((await run(() => null)).methods, ["post_results", "post_prize_winners", "post_prize_winners", "seal_results"]);
  const on = setSwitch(empty(), 3, true, at(2, 1)).next;
  assert.deepEqual((await run(() => on)).methods, ["post_results", "post_prize_winners", "post_prize_winners", "seal_results"]);
});

test("vault bot: switch off → no winners, still sealed (the prize goes back to the pool)", async () => {
  const off = setSwitch(empty(), 3, false, at(2, 1)).next;
  const r = await run(() => off);
  assert.deepEqual(r.methods, ["post_results", "seal_results"]);
  assert.deepEqual(r.problems, []);
});

test("vault bot: a switch set during week 3 doesn't reach week 3", async () => {
  const late = setSwitch(empty(), 3, false, at(3, 10)).next;            // from week 4
  assert.deepEqual((await run(() => late)).methods, ["post_results", "post_prize_winners", "post_prize_winners", "seal_results"]);
});

// Repo Lens FP-2: an unreadable switch file holds only the free winners and the seal; stakers' points still go out.
test("vault bot: switches unreadable → staked points posted, winners and seal held, a problem reported", async () => {
  const r = await run(() => { throw new Error("origin unreachable"); });
  assert.deepEqual(r.methods, ["post_results"]);
  assert.match(r.problems.join("\n"), /free-prize switches .* can't be read.*Staked points posted.*held/);
});

test("vault bot: switches still unreadable under 6 h before the deadline → sealed without winners", async () => {
  // Results are due 3 days after the week ends; 70 h into the next week leaves 2 h.
  const r = await run(() => { throw new Error("bad JSON"); }, { hoursIntoNextWeek: 70 });
  assert.deepEqual(r.methods, ["post_results", "seal_results"]);
  assert.match(r.problems.join("\n"), /sealed WITHOUT free winners/);
});

test("a change set exactly at its week's start does not count (strict <)", () => {
  const s: Switches = { v: 1, games: { "3": [{ from: 4, on: false, set: new Date(weekStart(4)).toISOString() }] } };
  assert.equal(checkSwitches(s), "");
  assert.equal(switchFor(s, 3, 4), null);
});

test("vault bot: a 2-week season from an odd week (3-4), switch off only in its first week → no winners", async () => {
  const s: Switches = { v: 1, games: { "3": [{ from: 3, on: false, set: new Date(at(2, 1)).toISOString() }, { from: 4, on: true, set: new Date(at(3, 1)).toISOString() }] } };
  const r = await run(() => s, { week: 4, seasonWeeks: 2, fromWeek: 3 });
  assert.deepEqual(r.methods, ["post_results", "seal_results"]);
});

test("FP-7: set must be a strict UTC ISO time", () => {
  for (const bad of ["1", "Nov 3 2026", "2026-11-09T00:00:00", "2026-11-09"])
    assert.notEqual(checkSwitches({ v: 1, games: { "3": [{ from: 4, on: true, set: bad }] } }), "", bad);
  assert.equal(checkSwitches({ v: 1, games: { "3": [{ from: 4, on: true, set: "2026-11-03T17:00:00.000Z" }] } }), "");
});

test("FP-3 / FP-4: no publishing within 30 minutes of Monday 00:00 UTC", () => {
  assert.equal(nearWeekEdge(at(4, -0.4)), true, "Sunday 23:36");
  assert.equal(nearWeekEdge(at(4, 0.4)), true, "Monday 00:24");
  assert.equal(nearWeekEdge(at(4, 0.6)), false, "Monday 00:36");
  assert.equal(nearWeekEdge(at(4, 50)), false, "Wednesday");
});

test("D-136: Daily Questions (game 1) is on the switch: it can be set, and the bot reads it for its weeks", () => {
  assert.equal(checkSwitches({ v: 1, games: { "1": [{ from: 4, on: true, set: "2026-11-10T17:00:00.000Z" }] } }), "");
  const now = Date.UTC(2026, 10, 10, 17);                 // Tue 10 Nov: the week of Mon 9 is vault week 3
  const { next, from } = setSwitch(empty(), 1, true, now);
  assert.equal(from, 4, "set in the week of Mon 9, it counts from Mon 16 (the rule week)");
  assert.equal(switchFor(next, 1, 4), true);
  assert.equal(prizeOn(next, 1, 4), true);
  const off = setSwitch(next, 1, false, Date.UTC(2026, 10, 17, 12)).next;
  assert.equal(prizeOn(off, 1, 5), false, "switched off in week 4, no game-1 free winners from week 5");
  assert.equal(prizeOn(off, 1, 4), true, "the week in progress keeps its value");
});
