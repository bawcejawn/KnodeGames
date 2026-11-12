// Repo Lens #F-6 (fix-check of PR #114 @ 5e7d3fa9). Failing tests for F6-1 and F6-2.
// Same stub chain as tests/audit/vault-testweek.test.ts, but one chain and one game-data folder across runs, so a
// question can be resolved by main's bot (no test week) and then seen by #114's bot (vaultTestWeeks).
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

function world(preOutcome = 0) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f6-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  const height = original.windowEnd + 500, time = 1_700_000_000_000, genesis = original.lockTime - 3 * 86_400_000;
  const onchain: any[] = [{ week: "0", k: 4, window_end: String(original.windowEnd), outcome: preOutcome, params_hash: "0x" + original.paramsHash, data_hash: preOutcome ? "0xabc" : "" }];
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
        if (c.method === "resolve_question") { const x = onchain[Number(c.args.id)]; x.outcome = c.args.outcome === 1000 ? 1000 : c.args.outcome + 1; x.data_hash = c.args.data_hash; }
      }
      return { ok: true };
    },
  };
  fs.writeFileSync(path.join(P.questions, "W000-D3.json"), JSON.stringify({ ...fixture, questions: [{ ...original, chainId: 0 }] }));
  const subj = original.subjects ?? ["1Other"];
  const windowBlocks = async (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => ({ h: a + i, ts: time - (b - a - i) * 3000, signer: subj[i % subj.length], ntx: 0, compute: 0 }));
  const run = async (dep: any) => {
    if (dep) fs.writeFileSync(P.deployment, JSON.stringify(dep)); else fs.rmSync(P.deployment, { force: true });
    const ctx: any = { chain, operator: op, P, windowBlocks, noSealKey: true, dryRun: false, problems: [] as string[], generator: () => ({ ok: true, output: "" }), checkpoint: () => {}, quiet: true };
    await tick(ctx);
    return ctx.problems as string[];
  };
  const file = () => JSON.parse(fs.readFileSync(path.join(P.questions, "W000-D3.json"), "utf8")).questions[0];
  return { run, file, onchain, sent };
}

test("F6-1 (Medium): a test-week question that main's bot already resolved (and recorded) to a real option raises 'must be VOID' after #114 merges", async () => {
  const w = world();
  await w.run(null);               // main's bot (no vaultTestWeeks): resolves from the blocks
  await w.run(null);               // main's next run reads it back and records chainOutcome in the file
  assert.notEqual(w.onchain[0].outcome, 1000, "setup: a real outcome is on chain");
  assert.notEqual(w.file().chainOutcome, undefined, "setup: the file has recorded it");
  const problems = await w.run({ vaultTestWeeks: [0] });   // #114 merged
  assert.ok(problems.some((p) => /must be VOID/.test(p)),
    "a test-week question with a real outcome on chain must alert every run until it is voided; today it is silent:\n" + problems.join("\n"));
});

test("F6-2 (Low): the 'must be VOID' alert's command posts the real result's data_hash (so verify and the practice page agree)", async () => {
  const w = world(2);              // already resolved on chain to a real option; the file has not recorded it yet
  const problems = await w.run({ vaultTestWeeks: [0] });
  const msg = problems.find((p) => /must be VOID/.test(p));
  assert.ok(msg, "setup: the alert fires on this path:\n" + problems.join("\n"));
  const real = w.file().result?.dataHash;
  assert.ok(real, "setup: the file has the real result");
  assert.ok(msg!.includes(real), `the suggested void must carry data_hash 0x${real}; 'bot void' hashes a reason instead, so verify alerts on it for good and the page shows no practice result:\n${msg}`);
});

// Vault chat, after the F6 fixes: once the owner runs the alert's void-test, the next run logs it as the expected step.
test("F6-1/F6-2 follow-up: after the owner's void-test the bot neither alarms nor asks again", async () => {
  const { practiceHash } = await import("../../bot/bot.ts");
  const w = world();
  await w.run(null);
  await w.run(null);
  assert.ok((await w.run({ vaultTestWeeks: [0] })).some((p) => /must be VOID/.test(p)), "setup: it asks");
  w.onchain[0].outcome = 1000;                                        // the owner's void-test
  w.onchain[0].data_hash = "0x" + practiceHash(w.file().result);
  const problems = await w.run({ vaultTestWeeks: [0] });
  assert.deepEqual(problems.filter((p) => /must be VOID|compromised|changed on chain/.test(p)), [], problems.join("\n"));
  assert.equal(w.file().chainOutcome, 1000);
  assert.deepEqual(await w.run({ vaultTestWeeks: [0] }), [], "and it stays quiet");
});
