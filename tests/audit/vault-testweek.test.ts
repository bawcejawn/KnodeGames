// Owner, 10 Nov: Week 1 = Mon 16 Nov (vault week 4). The week of Mon 9 (vault week 3) is a test week: every game plays,
// nothing pays. game-data/deployment.json "vaultTestWeeks": [3]. Last week (vault week 2) pays as normal.
//  - Daily Questions are posted in a test week as in any week.
//  - Their questions are resolved VOID on chain whatever the blocks say (Repo Lens #F-4 F4-1: under the old rules
//    anyone can settle anyone, so with the bot settling nobody a lone settled player would take the week's whole pot).
//    The file keeps the real answer; the site shows it as practice (tests/audit/site.test-week-practice.test.mjs).
//  - The bot settles the week before (2) and not the test week (3).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Signer } from "koilib";
import { tick, paths, postPass, practiceHash, voidTestArgs } from "../../bot/bot.ts";

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

test("F4-1: a test-week question is resolved VOID, and the next run raises no alarm; the file keeps the real answer", async () => {
  const r = await resolveWith({ vaultTestWeeks: [0] });
  assert.equal(r.resolves.length, 1, "resolved once");
  assert.equal(r.resolves[0].args.outcome, 1000, "a test-week question must be VOID on chain");
  assert.match(r.resolves[0].args.data_hash, /^0x[0-9a-f]{64}$/);
  assert.equal(r.resolves[0].args.data_hash.slice(2), practiceHash(r.file.questions[0].result), "the chain carries the real result's practice hash (the site checks it, #F-6 F6-3)");
  assert.notEqual(practiceHash(r.file.questions[0].result), r.file.questions[0].result.dataHash);
  assert.ok(!r.problems.some((p) => /differs|must be VOID/.test(p)), r.problems.join("\n"));
  assert.ok(r.file.questions[0].result && !r.file.questions[0].result.void, "the file keeps the real answer for the site");
});

test("F4-1: a week that isn't listed (and no setting at all) resolves from its blocks as before", async () => {
  for (const dep of [{ vaultTestWeeks: [3] }, { vaultTestWeeks: [] }, null]) {
    const r = await resolveWith(dep);
    assert.equal(r.resolves.length, 1);
    assert.notEqual(r.resolves[0].args.outcome, 1000, `blocks decide (${JSON.stringify(dep)})`);
  }
});

// The Daily Questions release (same stub chain as tests/audit/release-rounds.test.ts).
const GENESIS = Date.parse("2026-10-19T00:00:00Z"), HOUR = 3_600_000, DAY = 24 * HOUR;
async function released(timeIso: string, dep: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-post-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  if (dep) fs.writeFileSync(P.deployment, JSON.stringify(dep));
  const calls: string[][] = [];
  const chain: any = { async read(m: string) {
    if (m === "get_state") return { height: "41000000", time: String(Date.parse(timeIso)),
      config: { genesis_time: String(GENESIS), week_length: String(7 * DAY), close_delay: String(12 * HOUR) },
      totals: { weeks_closed: "3", weeks_finalized: "2", next_question_id: 100 } };
    return {};
  } };
  const ctx: any = { chain, P, dryRun: false, quiet: true, problems: [], releaseWaitMs: 0,
    generator: (args: string[]) => { calls.push(args); return { ok: false, output: "test stub" }; }, checkpoint: () => {} };
  await postPass(ctx, {} as any);
  return calls;
}

test("owner 10 Nov: Daily Questions are still made in the test week (week 3, Tue 10 Nov 00:01 UTC) and in week 4", async () => {
  assert.equal((await released("2026-11-10T00:01:00Z", { vaultTestWeeks: [3] })).length, 1, "week 3 plays");
  assert.equal((await released("2026-11-16T00:01:00Z", { vaultTestWeeks: [3] })).length, 1, "week 4 plays");
});

// The settle pass: week 2 (pays) and week 3 (the test week) both closed and in their settlement windows.
async function settled(dep: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tw-settle-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  if (dep) fs.writeFileSync(P.deployment, JSON.stringify(dep));
  const time = 1_700_000_000_000, sent: string[] = [];
  const chain: any = {
    kind: "sim", contractId: "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr",
    async head() { return { height: 41_000_000, lib: 40_999_900 }; },
    async mana() { return 10n ** 12n; },
    async read(method: string, args: any) {
      if (method === "get_state") return { height: "41000000", time: String(time),
        config: { owner: "1Owner", operator: "1Op", genesis_time: "1600000000000", week_length: String(7 * DAY), close_delay: "43200000", min_stake: "100000000" },
        totals: { weeks_closed: "4", weeks_finalized: "2", next_question_id: 0 }, koin_balance: "0" };
      if (method === "get_week") return { week: { questions: 0, resolved: 0, closed: true, settle_start: String(time - 1000), settle_end: String(time + 3 * DAY) } };
      if (method === "list_players") return { rows: args.start ? [] : [{ address: "1Staker", entry: { settled: false, stake: "100000000" } }] };
      return {};
    },
    async send(calls: any[]) { for (const c of calls) if (c.method === "settle") sent.push(`week ${c.args.week}`); return { ok: true, rcUsed: "1" }; },
  };
  const ctx: any = { chain, operator: op, P, dryRun: false, problems: [], generator: () => ({ ok: true, output: "" }), checkpoint: () => {}, quiet: true };
  await tick(ctx);
  return [...new Set(sent)].sort();
}

test("owner 10 Nov: week 2 settles and pays as normal; the test week (3) is never settled", async () => {
  assert.deepEqual(await settled({ vaultTestWeeks: [3] }), ["week 2"]);
  assert.deepEqual(await settled(null), ["week 2", "week 3"], "(control) without a test week both are settled");
});

test("F4-4: the committed deployment.json marks only vault week 3 (Mon 9 Nov) as the test week", () => {
  const dep = JSON.parse(fs.readFileSync("game-data/deployment.json", "utf8"));
  assert.deepEqual(dep.vaultTestWeeks, [3]);
  assert.equal(dep.vaultPayFromWeek, undefined, "the old setting would stop week 2 from paying");
});

// Repo Lens #F-6 F6-1/F6-2: main's bot resolved and recorded a week-3 question to a real option; after #114 the bot alerts
// with "void-test", the owner runs it, and the next run takes it as the expected step (no "admin key" alarm, no alert).
test("F6-2: void-test posts VOID with the practice hash; afterwards the bot raises no alarm and stops asking", async () => {
  const r = await resolveWith(null);                                  // main's bot: a real outcome on chain
  assert.notEqual(r.resolves[0].args.outcome, 1000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f6vt-"));
  const P = paths(dir);
  fs.mkdirSync(P.questions, { recursive: true });
  fs.writeFileSync(path.join(P.questions, "W000-D3.json"), JSON.stringify(r.file));
  fs.writeFileSync(P.deployment, JSON.stringify({ vaultTestWeeks: [0] }));
  const args = voidTestArgs(P, 0);
  assert.deepEqual(args, { id: 0, outcome: 1000, data_hash: "0x" + practiceHash(r.file.questions[0].result) });
  fs.writeFileSync(P.deployment, JSON.stringify({ vaultTestWeeks: [3] }));
  assert.throws(() => voidTestArgs(P, 0), /not a test week/);
  assert.throws(() => voidTestArgs(P, 9), /in no question file/);
});
