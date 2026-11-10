// Repo Lens #F-4 F4-1, for questions already posted: a question of a week before vaultPayFromWeek (owner, 9 Nov: the
// test week) is posted VOID on chain whatever its blocks say, so no answer counts, no entry can win, and the week's
// pot rolls over. From vaultPayFromWeek on (or without the setting) questions resolve from their blocks as before.
// Also: the committed deployment.json keeps vaultPayFromWeek >= 4 until week 4 is paid (F4-4).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Signer } from "koilib";
import { tick, paths } from "../../bot/bot.ts";

const fixture = JSON.parse(fs.readFileSync("tests/audit/fixtures/W000-D3.at-6b37c46.json", "utf8"));
const original = fixture.questions.find((q: any) => q.template === "M7");
const op = Signer.fromSeed("audit-test-only");

async function resolveWith(deployment: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f4void-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  if (deployment) fs.writeFileSync(P.deployment, JSON.stringify(deployment));
  const height = original.windowEnd + 500, time = 1_700_000_000_000, genesis = original.lockTime - 3 * 86_400_000;
  const onchain: any[] = [{ week: "0", k: 4, window_end: String(original.windowEnd), outcome: 0, params_hash: "0x" + original.paramsHash }];
  const sent: any[] = [];
  const chain: any = {
    kind: "sim", contractId: "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr",
    async head() { return { height, lib: height - 60 }; },
    async mana() { return 10n ** 12n; },
    async read(method: string, args: any) {
      if (method === "get_state") return { height: String(height), time: String(time),
        config: { owner: "1Owner", operator: "1Op", genesis_time: String(genesis), week_length: String(7 * 86_400_000), close_delay: "43200000", min_stake: "100000000" },
        totals: { weeks_closed: "0", weeks_finalized: "0", next_question_id: onchain.length }, koin_balance: "0" };
      if (method === "get_week") return { week: { questions: onchain.length, resolved: onchain.filter((x) => x.outcome).length } };
      if (method === "get_question") return { question: onchain[Number(args.id)] };
      if (method === "list_players") return { rows: [] };
      return {};
    },
    async send(calls: any[]) {
      for (const c of calls) {
        sent.push(c);
        if (c.method === "resolve_question") { const x = onchain[Number(c.args.id)]; x.outcome = c.args.outcome === 1000 ? 1000 : c.args.outcome + 1; }
      }
      return { ok: true };
    },
  };
  fs.writeFileSync(path.join(P.questions, "W000-D3.json"), JSON.stringify({ ...fixture, questions: [{ ...original, chainId: 0 }] }));
  const subj = original.subjects ?? ["1Other"];
  const windowBlocks = async (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => ({ h: a + i, ts: time - (b - a - i) * 3000, signer: subj[i % subj.length], ntx: 0, compute: 0 }));
  const ctx: any = { chain, operator: op, P, windowBlocks, noSealKey: true, dryRun: false, problems: [] as string[], generator: () => ({ ok: true, output: "" }), checkpoint: () => {}, quiet: true };
  await tick(ctx);
  // A second run reads the outcome back: no "differs from the blocks" alarm for a test-week void.
  await tick(ctx);
  return { resolves: sent.filter((c) => c.method === "resolve_question"), problems: ctx.problems as string[], file: JSON.parse(fs.readFileSync(path.join(P.questions, "W000-D3.json"), "utf8")) };
}

test("F4-1: a question of a week before vaultPayFromWeek is resolved VOID, and the next run raises no alarm", async () => {
  const r = await resolveWith({ vaultPayFromWeek: 1 });
  assert.equal(r.resolves.length, 1, "resolved once");
  assert.equal(r.resolves[0].args.outcome, 1000, "a test-week question must be VOID on chain");
  assert.ok(!r.problems.some((p) => /differs|must be VOID/.test(p)), r.problems.join("\n"));
  assert.ok(r.file.questions[0].result && !r.file.questions[0].result.void, "the file keeps the real answer for the site");
});

test("F4-1: from vaultPayFromWeek on (and without it) questions resolve from their blocks as before", async () => {
  for (const dep of [{ vaultPayFromWeek: 0 }, null]) {
    const r = await resolveWith(dep);
    assert.equal(r.resolves.length, 1);
    assert.notEqual(r.resolves[0].args.outcome, 1000, `blocks decide (${JSON.stringify(dep)})`);
  }
});

test("F4-4: the committed deployment.json keeps vaultPayFromWeek a whole number >= 4 (week 4 = Mon 16 Nov is the first paying week)", () => {
  const dep = JSON.parse(fs.readFileSync("game-data/deployment.json", "utf8"));
  assert.ok(Number.isInteger(dep.vaultPayFromWeek) && dep.vaultPayFromWeek >= 4, `vaultPayFromWeek is ${JSON.stringify(dep.vaultPayFromWeek)}`);
});
