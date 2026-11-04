// Repo Lens #D-6, finding Q-1 (PR #98): from week 4 the rounds are back to back, so at 11:48 and 23:48 a round is
// always "current". postPass then returns once that round is posted and never waits for the next release, so every
// round except Monday 00:00 goes out with the next hourly run instead of on the dot (D-047).
// Written, not run here. Fails on 7b3d498; passes once postPass also waits for `next` when a round is current.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { postPass, paths } from "../../bot/bot.ts";

const GENESIS = Date.parse("2026-10-19T00:00:00Z"), H = 3_600_000, DAY = 24 * H;

function world(startIso, postedLabel) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d6-wait-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  // The round open now is already fully posted (every question has a chainId).
  fs.writeFileSync(path.join(P.questions, `${postedLabel}.json`), JSON.stringify({ date: postedLabel, questions: [{ id: `${postedLabel}-1`, chainId: 1 }] }));
  const clock = { now: Date.parse(startIso) };
  const calls = [];
  const chain = {
    async read(method) {
      if (method === "get_state") return { height: "41000000", time: String(clock.now),
        config: { genesis_time: String(GENESIS), week_length: String(7 * DAY), close_delay: String(12 * H) },
        totals: { weeks_closed: "3", weeks_finalized: "3", next_question_id: 100 } };
      return {};
    },
  };
  const ctx = { chain, P, dryRun: false, quiet: true, problems: [], releaseWaitMs: 12 * 60_000,
    generator: (args) => { calls.push(args); return { ok: false, output: "test stub" }; }, checkpoint: () => {} };
  return { ctx, calls, clock };
}
const argOf = (a, k) => a[a.indexOf(k) + 1];
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

for (const [name, startIso, posted, nextLabel, nextCount, releaseIso] of [
  ["Mon 16 Nov 11:48: waits for the 12:00 round while the 00:00 round is open", "2026-11-16T11:48:00Z", "W004-D1-00", "W004-D1", "3", "2026-11-16T12:00:05Z"],
  ["Mon 16 Nov 23:48: waits for Tuesday's 00:00 round while the 12:00 round is open", "2026-11-16T23:48:00Z", "W004-D1", "W004-D2-00", "2", "2026-11-17T00:00:05Z"],
]) {
  test(`Q-1: ${name}`, async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const w = world(startIso, posted);
      const run = postPass(w.ctx, {});
      await flush();
      w.clock.now = Date.parse(releaseIso);          // the chain reaches the release time while the bot waits
      mock.timers.tick(13 * 60_000);
      await flush();
      await run;
      assert.equal(w.calls.length, 1, `the release run must wait for ${nextLabel} instead of leaving it to the hourly run`);
      assert.deepEqual([argOf(w.calls[0], "--label"), argOf(w.calls[0], "--count")], [nextLabel, nextCount]);
    } finally { mock.timers.reset(); }
  });
}
