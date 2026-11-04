// Two question rounds a day (owner, 2026-11-04: D-092, R-Q-1). From the week of Mon 9 Nov (week 3): 2 questions at
// 00:00 UTC and 3 at 12:00 UTC, Monday to Saturday, each open 12 hours; 30 a week; Sunday stays results day. From the
// first week the chain allows 48 or more (Vault v6.1 get_state.questions_cap): 4 + 4, 48 a week.
// Checks the schedule (bot, PC backup task and website agree), the bot's round choice, and the generator's rule that
// a producer isn't asked about in two windows running at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCHEDULE, roundsAt, roundsOfDay, roundsOfWeek, weekTotal, capsFrom, postPass, paths } from "../../bot/bot.ts";
import { SCHEDULE as KICK_SCHEDULE, roundNear } from "../../bot/release-kick.mjs";
import { producersInOverlappingWindows } from "../../generator.ts";

const GENESIS = Date.parse("2026-10-19T00:00:00Z"), H = 3_600_000, DAY = 24 * H;
const at = (iso: string) => Date.parse(iso);

test("bot, PC backup task and website use the same round schedule", () => {
  const app = fs.readFileSync("app.js", "utf8");
  const m = app.match(/const ROUNDS = (\[.*\]);/);
  assert.ok(m, "app.js has its ROUNDS list");
  const plain = (x: unknown) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(plain(KICK_SCHEDULE), plain(SCHEDULE));
  assert.deepEqual(JSON.parse(m![1]), plain(SCHEDULE));
});

test("weeks before 9 Nov keep one round at 12:00; from 9 Nov two rounds, 30 a week, none on Sunday", () => {
  for (let w = 0; w < 8; w++) {
    const rounds = Array.from({ length: 7 }, (_, dd) => roundsOfDay(GENESIS, w * 7 + dd)).flat();
    assert.equal(rounds.reduce((n, r) => n + r.count, 0), 30, `week ${w}: 30 questions (the contract's cap)`);
    assert.equal(roundsOfDay(GENESIS, w * 7 + 6).length, 0, "Sunday: results day");
    for (const r of rounds) {
      assert.equal(r.lockTime - r.releaseAt, 12 * H, "each round is open 12 hours");
      assert.ok(r.lockTime <= GENESIS + (w * 7 + 6) * DAY, "every round closes by Sunday 00:00, so the week still closes Monday 12:00");
    }
    const opens = rounds.map((r) => new Date(r.releaseAt).getUTCHours());
    assert.deepEqual([...new Set(opens)].sort(), w < 3 ? [12] : [0, 12]);
  }
  assert.equal(new Date(GENESIS + 3 * 7 * DAY).toISOString(), "2026-11-09T00:00:00.000Z", "week 3 is the week of Mon 9 Nov");
});

test("4 + 4 (48 a week) only for a week whose on-chain cap allows it; the same hours either way", () => {
  assert.equal(weekTotal(3), 30);
  assert.equal(weekTotal(3, 30), 30);
  assert.equal(weekTotal(3, 47), 30);
  assert.equal(weekTotal(3, 48), 48);
  assert.equal(weekTotal(4, 60), 48);
  assert.equal(weekTotal(2, 60), 30, "never before week 3, whatever the chain allows");
  assert.deepEqual(roundsOfWeek(4, 60).map((r) => r.open), roundsOfWeek(4, 30).map((r) => r.open));
  // get_state of the live v6 code has no questions_cap: 30. Vault v6.1: this week's and next week's.
  const t = at("2026-11-15T23:50:00Z");
  assert.equal(capsFrom({}, GENESIS, 7 * DAY, t)(3), 30);
  const caps = capsFrom({ questions_cap: "30", questions_cap_next: "60" }, GENESIS, 7 * DAY, t);
  assert.deepEqual([caps(3), caps(4), caps(5)], [30, 60, 30]);
  assert.equal(roundsAt(GENESIS, t, caps).next!.count, 4, "next week's first round already plans 4");
  assert.equal(roundsAt(GENESIS, at("2026-11-14T13:00:00Z"), caps).current!.count, 3, "this week stays 2 + 3");
});

test("the round open now and the next round", () => {
  // Week 2 (2-8 Nov): as before.
  assert.equal(roundsAt(GENESIS, at("2026-11-04T05:00:00Z")).current, null);
  assert.equal(roundsAt(GENESIS, at("2026-11-04T05:00:00Z")).next!.label, "W002-D3");
  assert.equal(roundsAt(GENESIS, at("2026-11-04T13:00:00Z")).current!.label, "W002-D3");
  // Sunday 8 Nov late evening: the next round is Monday 9 Nov 00:00 (2 questions).
  const sun = roundsAt(GENESIS, at("2026-11-08T23:50:00Z"));
  assert.equal(sun.current, null);
  assert.deepEqual([sun.next!.label, sun.next!.count, new Date(sun.next!.releaseAt).toISOString()], ["W003-D1-00", 2, "2026-11-09T00:00:00.000Z"]);
  const mon = roundsAt(GENESIS, at("2026-11-16T00:30:00Z")).current!;
  assert.deepEqual([mon.label, mon.count, new Date(mon.lockTime).toISOString()], ["W004-D1-00", 2, "2026-11-16T12:00:00.000Z"]);
  const noon = roundsAt(GENESIS, at("2026-11-16T12:00:00Z")).current!;
  assert.deepEqual([noon.label, noon.count, new Date(noon.lockTime).toISOString()], ["W004-D1", 3, "2026-11-17T00:00:00.000Z"]);
  assert.equal(roundsAt(GENESIS, at("2026-11-17T00:00:00Z")).current!.label, "W004-D2-00");
  // Saturday's 12:00 round is the week's last; Sunday has none.
  assert.equal(roundsAt(GENESIS, at("2026-11-21T23:59:00Z")).current!.label, "W004-D6");
  assert.equal(roundsAt(GENESIS, at("2026-11-22T06:00:00Z")).current, null);
});

test("the PC backup task acts near both release times from 9 Nov, and only at 12:00 before", () => {
  assert.equal(roundNear(GENESIS, at("2026-11-04T23:52:00Z")), null, "week 2: no 00:00 round");
  assert.equal(roundNear(GENESIS, at("2026-11-04T11:52:00Z"))!.label, "W002-D3");
  assert.equal(roundNear(GENESIS, at("2026-11-08T23:52:00Z"))!.label, "W003-D1-00");
  assert.equal(roundNear(GENESIS, at("2026-11-15T23:52:00Z"))!.label, "W004-D1-00");
  assert.equal(roundNear(GENESIS, at("2026-11-16T01:30:00Z"))!.label, "W004-D1-00", "checks for 2 hours after release");
  assert.equal(roundNear(GENESIS, at("2026-11-16T03:00:00Z")), null);
  assert.equal(roundNear(GENESIS, at("2026-11-22T11:52:00Z")), null, "Sunday: nothing");
});

function postWorld(timeIso: string, caps: { questions_cap?: string; questions_cap_next?: string } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rounds-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  const calls: string[][] = [];
  const chain: any = {
    async read(method: string) {
      if (method === "get_state") return { height: "41000000", time: String(at(timeIso)),
        config: { genesis_time: String(GENESIS), week_length: String(7 * DAY), close_delay: String(12 * H) },
        totals: { weeks_closed: "2", weeks_finalized: "2", next_question_id: 100 }, ...caps };
      return {};
    },
  };
  const ctx: any = { chain, P, dryRun: false, quiet: true, problems: [], releaseWaitMs: 0,
    generator: (args: string[]) => { calls.push(args); return { ok: false, output: "test stub" }; }, checkpoint: () => {} };
  return { ctx, calls };
}
const argOf = (a: string[], k: string) => a[a.indexOf(k) + 1];

test("the bot releases the 00:00 round with 2 questions and the 12:00 round with 3 (from 9 Nov, cap 30)", async () => {
  const c = postWorld("2026-11-09T00:01:00Z");
  await postPass(c.ctx, {} as any);
  assert.deepEqual([argOf(c.calls[0], "--label"), argOf(c.calls[0], "--count")], ["W003-D1-00", "2"]);
  assert.ok(!c.calls[0].includes("--max-uses"), "30 a week: game.json's producer cap as today");
  const a = postWorld("2026-11-16T00:01:00Z");
  await postPass(a.ctx, {} as any);
  assert.equal(a.calls.length, 1);
  assert.deepEqual([argOf(a.calls[0], "--label"), argOf(a.calls[0], "--count"), argOf(a.calls[0], "--lock-time")], ["W004-D1-00", "2", String(at("2026-11-16T12:00:00Z"))]);
  const b = postWorld("2026-11-16T12:01:00Z");
  await postPass(b.ctx, {} as any);
  assert.deepEqual([argOf(b.calls[0], "--label"), argOf(b.calls[0], "--count"), argOf(b.calls[0], "--lock-time")], ["W004-D1", "3", String(at("2026-11-17T00:00:00Z"))]);
});

test("before 9 Nov the bot posts nothing at 00:00 and 5 questions at 12:00, as today", async () => {
  const a = postWorld("2026-11-04T00:01:00Z");
  await postPass(a.ctx, {} as any);
  assert.equal(a.calls.length, 0);
  const b = postWorld("2026-11-04T12:01:00Z");
  await postPass(b.ctx, {} as any);
  assert.deepEqual([argOf(b.calls[0], "--label"), argOf(b.calls[0], "--count")], ["W002-D3", "5"]);
});

test("once the chain allows 60 this week, the bot posts 4 + 4 and lets each producer be in up to 7 questions", async () => {
  const a = postWorld("2026-11-16T00:01:00Z", { questions_cap: "60", questions_cap_next: "60" });
  await postPass(a.ctx, {} as any);
  assert.deepEqual([argOf(a.calls[0], "--label"), argOf(a.calls[0], "--count"), argOf(a.calls[0], "--max-uses")], ["W004-D1-00", "4", "7"]);
  const b = postWorld("2026-11-16T12:01:00Z", { questions_cap: "60", questions_cap_next: "60" });
  await postPass(b.ctx, {} as any);
  assert.deepEqual([argOf(b.calls[0], "--label"), argOf(b.calls[0], "--count")], ["W004-D1", "4"]);
  // The upload landed this week: next week may take 60, this week still 30, so this week stays 2 + 3.
  const c = postWorld("2026-11-12T12:01:00Z", { questions_cap: "30", questions_cap_next: "60" });
  await postPass(c.ctx, {} as any);
  assert.deepEqual([argOf(c.calls[0], "--label"), argOf(c.calls[0], "--count")], ["W003-D4", "3"]);
});

test("generator: producers in a posted window still running are left out of the next round (D-6 Q-3: never-posted questions and skipped files don't count)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overlap-"));
  const w = (f: string, qs: any[]) => fs.writeFileSync(path.join(dir, f), JSON.stringify({ questions: qs }));
  w("W004-D1-00.json", [{ subjects: ["1Alpha"], windowStart: 100, windowEnd: 25_000, chainId: 1 }, { subjects: [], group: ["1Beta", "1Gamma"], windowStart: 100, windowEnd: 15_000, chainId: 2 },
    { subjects: ["1NeverPosted"], windowStart: 100, windowEnd: 25_000 }, { subjects: ["1PostSkipped"], windowStart: 100, windowEnd: 25_000, postSkipped: "too late" }]);
  w("W003-D6.json", [{ subjects: ["1Old"], windowStart: 1, windowEnd: 90, chainId: 0 }]);
  fs.writeFileSync(path.join(dir, "W003-D5.json"), JSON.stringify({ skipped: "too late", questions: [{ subjects: ["1Skipped"], windowEnd: 99_999, chainId: 9 }] }));
  w("notes.txt", []);
  // The 12:00 round's windows start at block 20,000: only 1Alpha's window (to 25,000) is still running then.
  assert.deepEqual([...producersInOverlappingWindows(dir, 20_000, "W004-D1")], ["1Alpha"]);
  assert.deepEqual([...producersInOverlappingWindows(dir, 10_000, "W004-D1")].sort(), ["1Alpha", "1Beta", "1Gamma"]);
  assert.deepEqual([...producersInOverlappingWindows(dir, 20_000, "W004-D1-00")], [], "a round's own file doesn't count");
});

test("D-6 Q-2: the overlap rule is asked for only in weeks with two rounds", async () => {
  const a = postWorld("2026-11-04T12:01:00Z");
  await postPass(a.ctx, {} as any);
  assert.ok(!a.calls[0].includes("--avoid-overlap"), "week 2: today's generator rules exactly");
  const b = postWorld("2026-11-16T12:01:00Z");
  await postPass(b.ctx, {} as any);
  assert.ok(b.calls[0].includes("--avoid-overlap"));
});

test("D-6 Q-4: a round the generator can't fill is marked skipped and reported", async () => {
  const w = postWorld("2026-11-16T00:01:00Z");
  w.ctx.generator = (args: string[]) => {
    const label = argOf(args, "--label");
    fs.writeFileSync(path.join(w.ctx.P.questions, `${label}.json`), JSON.stringify({ date: label, week: 4, day: 1, questions: [] }));
    return { ok: true, output: "" };
  };
  await postPass(w.ctx, {} as any);
  const f = JSON.parse(fs.readFileSync(path.join(w.ctx.P.questions, "W004-D1-00.json"), "utf8"));
  assert.match(f.skipped, /no fair questions/);
  assert.equal(w.ctx.problems.length, 1);
});

test("D-6 Q-5: the calendar file has a reminder per round (here the 00:00 one from 16 Nov)", async () => {
  const vm = await import("node:vm");
  const win: any = {}; win.window = win;
  vm.createContext(win); vm.runInContext(fs.readFileSync("extras.js", "utf8"), win);
  const ics: string = win.KnodeExtras.buildIcs("https://example.test/", new Date("2026-11-05T09:00:00Z"), [{ hour: 0, from: Date.parse("2026-11-16T00:00:00Z") }, { hour: 12, from: GENESIS }]);
  assert.equal(ics.match(/BEGIN:VEVENT/g)!.length, 2);
  assert.match(ics, /DTSTART:20261116T000000Z/);
  assert.match(ics, /DTSTART:20261105T120000Z/);
  assert.equal(new Set(ics.match(/UID:[^\r]+/g)).size, 2, "each reminder has its own UID");
});
