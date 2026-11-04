// Two question rounds a day (owner, 2026-11-04: D-092, R-Q-1). From the week of Mon 16 Nov (week 4): 2 questions at
// 00:00 UTC and 3 at 12:00 UTC, Monday to Saturday, each open 12 hours; still 30 a week; Sunday stays results day.
// Checks the schedule (bot, PC backup task and website agree), the bot's round choice, and the generator's rule that
// a producer isn't asked about in two windows running at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCHEDULE, roundsAt, roundsOfDay, postPass, paths } from "../../bot/bot.ts";
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

test("weeks before 16 Nov keep one round at 12:00; from 16 Nov two rounds, 30 a week, none on Sunday", () => {
  for (let w = 0; w < 8; w++) {
    const rounds = Array.from({ length: 7 }, (_, dd) => roundsOfDay(GENESIS, w * 7 + dd)).flat();
    assert.equal(rounds.reduce((n, r) => n + r.count, 0), 30, `week ${w}: 30 questions (the contract's cap)`);
    assert.equal(roundsOfDay(GENESIS, w * 7 + 6).length, 0, "Sunday: results day");
    for (const r of rounds) {
      assert.equal(r.lockTime - r.releaseAt, 12 * H, "each round is open 12 hours");
      assert.ok(r.lockTime <= GENESIS + (w * 7 + 6) * DAY, "every round closes by Sunday 00:00, so the week still closes Monday 12:00");
    }
    const opens = rounds.map((r) => new Date(r.releaseAt).getUTCHours());
    assert.deepEqual([...new Set(opens)].sort(), w < 4 ? [12] : [0, 12]);
  }
  assert.equal(new Date(GENESIS + 4 * 7 * DAY).toISOString(), "2026-11-16T00:00:00.000Z", "week 4 is the week of Mon 16 Nov");
});

test("the round open now and the next round", () => {
  // Week 3 (9-15 Nov): as before.
  assert.equal(roundsAt(GENESIS, at("2026-11-10T05:00:00Z")).current, null);
  assert.equal(roundsAt(GENESIS, at("2026-11-10T05:00:00Z")).next!.label, "W003-D2");
  assert.equal(roundsAt(GENESIS, at("2026-11-10T13:00:00Z")).current!.label, "W003-D2");
  // Sunday 15 Nov late evening: the next round is Monday 16 Nov 00:00 (2 questions).
  const sun = roundsAt(GENESIS, at("2026-11-15T23:50:00Z"));
  assert.equal(sun.current, null);
  assert.deepEqual([sun.next!.label, sun.next!.count, new Date(sun.next!.releaseAt).toISOString()], ["W004-D1-00", 2, "2026-11-16T00:00:00.000Z"]);
  const mon = roundsAt(GENESIS, at("2026-11-16T00:30:00Z")).current!;
  assert.deepEqual([mon.label, mon.count, new Date(mon.lockTime).toISOString()], ["W004-D1-00", 2, "2026-11-16T12:00:00.000Z"]);
  const noon = roundsAt(GENESIS, at("2026-11-16T12:00:00Z")).current!;
  assert.deepEqual([noon.label, noon.count, new Date(noon.lockTime).toISOString()], ["W004-D1", 3, "2026-11-17T00:00:00.000Z"]);
  assert.equal(roundsAt(GENESIS, at("2026-11-17T00:00:00Z")).current!.label, "W004-D2-00");
  // Saturday's 12:00 round is the week's last; Sunday has none.
  assert.equal(roundsAt(GENESIS, at("2026-11-21T23:59:00Z")).current!.label, "W004-D6");
  assert.equal(roundsAt(GENESIS, at("2026-11-22T06:00:00Z")).current, null);
});

test("the PC backup task acts near both release times from 16 Nov, and only at 12:00 before", () => {
  assert.equal(roundNear(GENESIS, at("2026-11-10T23:52:00Z")), null, "week 3: no 00:00 round");
  assert.equal(roundNear(GENESIS, at("2026-11-10T11:52:00Z"))!.label, "W003-D2");
  assert.equal(roundNear(GENESIS, at("2026-11-15T23:52:00Z"))!.label, "W004-D1-00");
  assert.equal(roundNear(GENESIS, at("2026-11-16T01:30:00Z"))!.label, "W004-D1-00", "checks for 2 hours after release");
  assert.equal(roundNear(GENESIS, at("2026-11-16T03:00:00Z")), null);
  assert.equal(roundNear(GENESIS, at("2026-11-22T11:52:00Z")), null, "Sunday: nothing");
});

function postWorld(timeIso: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rounds-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  const calls: string[][] = [];
  const chain: any = {
    async read(method: string) {
      if (method === "get_state") return { height: "41000000", time: String(at(timeIso)),
        config: { genesis_time: String(GENESIS), week_length: String(7 * DAY), close_delay: String(12 * H) },
        totals: { weeks_closed: "3", weeks_finalized: "3", next_question_id: 100 } };
      return {};
    },
  };
  const ctx: any = { chain, P, dryRun: false, quiet: true, problems: [], releaseWaitMs: 0,
    generator: (args: string[]) => { calls.push(args); return { ok: false, output: "test stub" }; }, checkpoint: () => {} };
  return { ctx, calls };
}
const argOf = (a: string[], k: string) => a[a.indexOf(k) + 1];

test("the bot releases the 00:00 round with 2 questions and the 12:00 round with 3 (from 16 Nov)", async () => {
  const a = postWorld("2026-11-16T00:01:00Z");
  await postPass(a.ctx, {} as any);
  assert.equal(a.calls.length, 1);
  assert.deepEqual([argOf(a.calls[0], "--label"), argOf(a.calls[0], "--count"), argOf(a.calls[0], "--lock-time")], ["W004-D1-00", "2", String(at("2026-11-16T12:00:00Z"))]);
  const b = postWorld("2026-11-16T12:01:00Z");
  await postPass(b.ctx, {} as any);
  assert.deepEqual([argOf(b.calls[0], "--label"), argOf(b.calls[0], "--count"), argOf(b.calls[0], "--lock-time")], ["W004-D1", "3", String(at("2026-11-17T00:00:00Z"))]);
});

test("before 16 Nov the bot posts nothing at 00:00 and 5 questions at 12:00, as today", async () => {
  const a = postWorld("2026-11-10T00:01:00Z");
  await postPass(a.ctx, {} as any);
  assert.equal(a.calls.length, 0);
  const b = postWorld("2026-11-10T12:01:00Z");
  await postPass(b.ctx, {} as any);
  assert.deepEqual([argOf(b.calls[0], "--label"), argOf(b.calls[0], "--count")], ["W003-D2", "5"]);
});

test("generator: producers in a window still running are left out of the next round", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overlap-"));
  const w = (f: string, qs: any[]) => fs.writeFileSync(path.join(dir, f), JSON.stringify({ questions: qs }));
  w("W004-D1-00.json", [{ subjects: ["1Alpha"], windowStart: 100, windowEnd: 25_000 }, { subjects: [], group: ["1Beta", "1Gamma"], windowStart: 100, windowEnd: 15_000 }]);
  w("W003-D6.json", [{ subjects: ["1Old"], windowStart: 1, windowEnd: 90 }]);
  w("notes.txt", []);
  // The 12:00 round's windows start at block 20,000: only 1Alpha's window (to 25,000) is still running then.
  assert.deepEqual([...producersInOverlappingWindows(dir, 20_000, "W004-D1")], ["1Alpha"]);
  assert.deepEqual([...producersInOverlappingWindows(dir, 10_000, "W004-D1")].sort(), ["1Alpha", "1Beta", "1Gamma"]);
  assert.deepEqual([...producersInOverlappingWindows(dir, 20_000, "W004-D1-00")], [], "a round's own file doesn't count");
});
