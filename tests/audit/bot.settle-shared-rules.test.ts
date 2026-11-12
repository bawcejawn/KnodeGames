// Vault v6.1 (D-116, R-Q-4): Daily Questions on the shared game rules from the rule week R
// (config.q60_rule_week_plus_one = R + 1). The bot's settle pass:
// - never settles a shared-rules week (there is no settle step; a settle there reverts);
// - settles EVERY staked player of the switch-over week R−1 itself, without the per-run cap (answers in week R no
//   longer settle it: the v6.1 Mana fix), and doesn't email "more than 10 needed settling" for it.
// Before the upgrade (no field) nothing changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Signer } from "koilib";
import { tick, paths, questionsSharedWeek } from "../../bot/bot.ts";

const WEEK = 7 * 86_400_000, GENESIS = 1_792_368_000_000, HOUR = 3_600_000;

function world(o: { q60?: string; week: number; players: number }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "settle-shared-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  const w = o.week, settleStart = GENESIS + (w + 1) * WEEK + 12 * HOUR, settleEnd = settleStart + 24 * HOUR;
  const now = settleStart + 2 * HOUR;                         // early in the window: the per-run cap would apply
  const players = Array.from({ length: o.players }, (_, i) => `1Player${String(i).padStart(3, "0")}`);
  const settled = new Set<string>(), sent: string[] = [];
  const chain: any = {
    kind: "sim", contractId: "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr",
    async head() { return { height: 50_000_000, lib: 49_999_900 }; },
    async mana() { return 10n ** 12n; },
    async read(method: string, args: any) {
      if (method === "get_state") return { height: "50000000", time: String(now),
        config: { owner: "1Owner", operator: "1Op", genesis_time: String(GENESIS), week_length: String(WEEK), close_delay: "43200000", min_stake: "100000000", ...(o.q60 ? { q60_rule_week_plus_one: o.q60 } : {}) },
        totals: { weeks_closed: String(w + 1), weeks_finalized: String(w), next_question_id: 0 }, koin_balance: "0" };
      if (method === "get_week") return Number(args.week) === w ? { week: { closed: true, finalized: false, settle_start: String(settleStart), settle_end: String(settleEnd), questions: 6, resolved: 6 } } : { week: {} };
      if (method === "list_players") return args.start ? { rows: [] } : { rows: players.map((a) => ({ address: a, entry: { stake: "100000000", settled: settled.has(a) } })) };
      return {};
    },
    async send(calls: any[], _s: any[], opts: any = {}) {
      if (opts.sponsored) return { ok: false, error: "transaction payer (contract) refused: authorize returned false" };   // D-099: the vault pays no Mana
      for (const c of calls) if (c.method === "settle") { settled.add(c.args.player); sent.push(c.args.player); }
      return { ok: true };
    },
  };
  const ctx: any = { chain, operator: Signer.fromSeed("settle-shared-test-only"), P, dryRun: false, problems: [] as string[],
    generator: () => ({ ok: true, output: "" }), checkpoint: () => {}, quiet: true };
  return { ctx, sent, players };
}

test("questionsSharedWeek: shared from the rule week on; never before the upgrade", () => {
  assert.equal(questionsSharedWeek({}, 10), false);
  assert.equal(questionsSharedWeek({ q60_rule_week_plus_one: "0" }, 10), false);
  assert.equal(questionsSharedWeek({ q60_rule_week_plus_one: "5" }, 3), false, "week R−1 = 3 is old-rule");
  assert.equal(questionsSharedWeek({ q60_rule_week_plus_one: "5" }, 4), true, "week R = 4 is shared");
});

test("a shared-rules week is never settled", async () => {
  const w = world({ q60: "5", week: 4, players: 3 });
  await tick(w.ctx);
  assert.equal(w.sent.length, 0);
});

test("the switch-over week R−1: the bot settles every staked player in one run, without the 10-a-run cap or its email", async () => {
  const w = world({ q60: "5", week: 3, players: 25 });
  await tick(w.ctx);
  assert.equal(w.sent.length, 25, "all 25 settled");
  assert.ok(!w.ctx.problems.some((p: string) => /needed settling this run/.test(p)), "no cap email for the switch-over week");
});

test("before the upgrade (no rule field), an old-rule week keeps the per-run cap as today", async () => {
  const w = world({ week: 3, players: 25 });
  await tick(w.ctx);
  assert.equal(w.sent.length, 10, "capped at 10 bot-paid settles this run");
});
