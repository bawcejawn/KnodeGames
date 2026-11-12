// tests/audit/release-rounds.wait.C5-1.test.ts   (node --import tsx --test)   Repo Lens #C-5, finding C5-1 (PR #98)
// The release runs (11:48 and 23:48 UTC, releaseWaitMs 12 min) must wait for the round that opens on the hour even while
// the earlier round is still open. The clock is mocked: no real 12-minute wait. (Added by the Questions chat, 4 Nov,
// from claude/repolens-c5-tests/; the same finding as #D-6 Q-1.)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { postPass, paths } from "../../bot/bot.ts";

const GENESIS = Date.parse("2026-10-19T00:00:00Z"), H = 3_600_000, DAY = 24 * H;

function world(times: string[], doneLabel: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c5-1-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  // the earlier round is already out (every question posted)
  fs.writeFileSync(path.join(P.questions, `${doneLabel}.json`), JSON.stringify({ date: doneLabel, week: 4, day: 1, questions: [{ id: "q1", chainId: 90 }, { id: "q2", chainId: 91 }] }));
  let i = 0;
  const calls: string[][] = [];
  const chain: any = {
    async read(method: string) {
      if (method === "get_state") {
        const t = Date.parse(times[Math.min(i++, times.length - 1)]);
        return { height: "41000000", time: String(t), config: { genesis_time: String(GENESIS), week_length: String(7 * DAY), close_delay: String(12 * H) },
          totals: { weeks_closed: "3", weeks_finalized: "3", next_question_id: 100 } };
      }
      return {};
    },
  };
  const ctx: any = { chain, P, dryRun: false, quiet: true, problems: [], releaseWaitMs: 12 * 60_000,
    generator: (args: string[]) => { calls.push(args); return { ok: false, output: "test stub" }; }, checkpoint: () => {} };
  return { ctx, calls };
}
const labelOf = (a: string[]) => a[a.indexOf("--label") + 1];

for (const [start, after, done, want] of [
  ["2026-11-16T11:48:00Z", "2026-11-16T12:00:06Z", "W004-D1-00", "W004-D1"],     // the 11:48 run, 00:00 round open
  ["2026-11-16T23:48:00Z", "2026-11-17T00:00:06Z", "W004-D1", "W004-D2-00"],     // the 23:48 run, 12:00 round open
]) test(`C5-1: the release run started ${start.slice(11, 16)} posts ${want} on the hour`, async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const w = world([start, after], done);
  const run = postPass(w.ctx, {} as any);
  for (let k = 0; k < 20 && !w.calls.length; k++) { await new Promise((r) => setImmediate(r)); t.mock.timers.tick(60_000); }
  await run;
  assert.deepEqual(w.calls.map(labelOf), [want], `the release run returned without waiting for ${want}`);
});
