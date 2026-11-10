// Repo Lens #F-4 (PR #114 @ 9c0d626): a week below vaultPayFromWeek gets no Daily Questions at all.
// Why: in an old-rules question week only settled entries count, and anyone can settle anyone (the sponsor pays). With
// the bot settling nobody, a lone player who settles their own week-3 entry takes the whole week-3 game-1 pot
// (Kpred.ts finalize + rewardOf). No questions in week 3 = no entries = nothing to settle = the pot rolls over.
// Fails at 9c0d626 (the bot posts week 3's rounds); passes once postPass skips weeks below vaultPayFromWeek.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { postPass, paths } from "../../bot/bot.ts";

const GENESIS = Date.parse("2026-10-19T00:00:00Z"), H = 3_600_000, DAY = 24 * H;
function world(timeIso: string, payFrom: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f4-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  fs.mkdirSync(path.dirname(P.deployment), { recursive: true });
  fs.writeFileSync(P.deployment, JSON.stringify(payFrom === undefined ? {} : { vaultPayFromWeek: payFrom }));
  const calls: string[][] = [];
  const chain: any = { async read(m: string) {
    if (m === "get_state") return { height: "41000000", time: String(Date.parse(timeIso)),
      config: { genesis_time: String(GENESIS), week_length: String(7 * DAY), close_delay: String(12 * H) },
      totals: { weeks_closed: "3", weeks_finalized: "3", next_question_id: 100 } };
    return {};
  } };
  const ctx: any = { chain, P, dryRun: false, quiet: true, problems: [], releaseWaitMs: 0,
    generator: (args: string[]) => { calls.push(args); return { ok: false, output: "test stub" }; }, checkpoint: () => {} };
  return { ctx, calls };
}

test("F4-1: no Daily Questions are made for a week below vaultPayFromWeek (week 3, Tue 10 Nov 00:01 UTC)", async () => {
  const w = world("2026-11-10T00:01:00Z", 4);
  await postPass(w.ctx, {} as any);
  assert.deepEqual(w.calls, [], "the bot started a week-3 round: its entries could be settled by one player, who would take the whole week-3 pot");
});

test("F4-1: from vaultPayFromWeek on, rounds are made as before (week 4, Mon 16 Nov 00:01 UTC)", async () => {
  const w = world("2026-11-16T00:01:00Z", 4);
  await postPass(w.ctx, {} as any);
  assert.equal(w.calls.length, 1, "week 4's first round is made");
});

test("F4-1: without vaultPayFromWeek (0 = every week pays) week 3 rounds are made as before", async () => {
  const w = world("2026-11-10T00:01:00Z", undefined);
  await postPass(w.ctx, {} as any);
  assert.equal(w.calls.length, 1);
});
