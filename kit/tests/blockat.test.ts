// G7 (Fantasy's UTC days): ctx.blockAt(ms), the first irreversible block at or after a UTC time, read on both nodes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { blockAt, blockAtFor, MAX_READS } from "../recorder/sources/block-at.ts";
import { NotYet, PENDING, type GameModule } from "../recorder/types.ts";
import { fakeNode, world, rng, type World } from "../testing/fake-nodes.ts";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { runGame } from "../recorder/runtime.ts";
import { Replay } from "../testing/replay.ts";
import { at, DAY } from "../testing/fake-clock.ts";

/** A chain of `n` blocks with irregular gaps (1–9 s, some long stalls), times strictly increasing. */
function chain(n: number, seed = 1) {
  const r = rng(seed), ts = [0, 1_800_000_000_000];
  for (let h = 2; h <= n; h++) ts.push(ts[h - 1] + (r() < 0.01 ? 600_000 : 1000 + Math.floor(r() * 8000)));
  return ts;
}
const nodeOn = (ts: number[], lib: number) => {
  const wd = world(ts[lib]); wd.lib = lib; wd.blockTimes = (h) => ts[h];
  return fakeNode("a", () => wd);
};
const firstAtOrAfter = (ts: number[], lib: number, ms: number) => { for (let h = 1; h <= lib; h++) if (ts[h] >= ms) return h; return -1; };

test("blockAt: the first irreversible block at or after the time, exactly, on an irregular chain (1,000 times)", async () => {
  const ts = chain(200_000), lib = 199_000, n = nodeOn(ts, lib), r = rng(9);
  for (let i = 0; i < 1000; i++) {
    const h0 = 1 + Math.floor(r() * (lib - 1));
    const ms = i % 3 === 0 ? ts[h0] : i % 3 === 1 ? ts[h0] + 1 : ts[h0] - 1;      // exact, just after, just before
    assert.equal(await blockAt(n, ms, lib), firstAtOrAfter(ts, lib, ms), `ms ${ms}`);
  }
});

test("blockAt: NotYet while the last irreversible block is before the time; at most MAX_READS reads", async () => {
  const ts = chain(50_000), lib = 40_000, n = nodeOn(ts, lib);
  await assert.rejects(blockAt(n, ts[lib] + 1, lib), NotYet);
  assert.equal(await blockAt(n, ts[lib], lib), lib);
  assert.equal(await blockAt(n, 1, lib), 1, "a time before the chain is block 1");
  let reads = 0;
  const counting = { ...n, blockTime: async (h: number) => { reads++; return ts[h]; } };
  await blockAt(counting as any, ts[1000], lib);
  assert.ok(reads <= MAX_READS, `${reads} reads`);
});

test("blockAtFor: memoized per run, pinned to one irreversible block", async () => {
  const ts = chain(30_000), lib = 29_000;
  let reads = 0;
  const n = { ...nodeOn(ts, lib), blockTime: async (h: number) => { reads++; return ts[h]; } };
  const f = blockAtFor(n as any, lib);
  const a = await f(ts[5000]), r1 = reads, b = await f(ts[5000]);
  assert.equal(a, b);
  assert.equal(reads, r1, "the same time twice reads nothing more");
});

// A game whose results need a block at a time: the example game, asking for the block at each round's lock.
const asked: number[] = [];
const g7: GameModule<any, any, any> = {
  ...exampleGame,
  async resultOf(round, read, inputs, ctx) {
    asked.push(await ctx!.blockAt!(round.locksAt));
    return exampleGame.resultOf(round, read, inputs);
  },
};
function qworld(): World {
  const s4 = at(4), wd = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };
  for (let i = 0; i < 2; i++) wd.questions[201 + i] = { week: "4", outcome: 1, lock_time: String(s4 + (i + 1) * DAY) };
  wd.next = 203;
  wd.players = [{ address: "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", entry: { stake: "0", peak_stake: "0", voided: false, answers: [{ question_id: 201, option: 0 }] } }];
  wd.lib = 400_000; wd.blockT0 = at(5, 0, 2) - 400_000 * 3000;               // 3 s blocks up to now
  return wd;
}

test("G7 runtime: resultOf gets ctx.blockAt on each node; the week records", async () => {
  asked.length = 0;
  const wd = qworld(), rp = new Replay(g7, exampleCfg());
  const h = await rp.hour([fakeNode("a", () => wd), fakeNode("b", () => wd)], wd.time + 5 * 60000);
  assert.equal(h.result?.state, "pending", JSON.stringify(h));
  const want = Math.ceil((at(4) + DAY - wd.blockT0!) / 3000);
  assert.ok(asked.includes(want), `asked ${asked.slice(0, 4)} want ${want}`);
});

// A game whose result depends on the block it found (as Fantasy's day cards will).
const g7h: GameModule<any, any, any> = { ...exampleGame, async resultOf(round, _read, _inputs, ctx) { return ((await ctx!.blockAt!(round.locksAt)) % 2) + 1; } };
test("G7 runtime: the two nodes must agree on the block at a time (else the round stays pending, with an alert)", async () => {
  const wd = qworld();
  const b = fakeNode("b", () => wd, { tweak: (m, _a, r) => (m === "blockTime" ? r + 3000 : r) });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "g7-"));
  fs.mkdirSync(path.join(d, "prev")); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  const r = await runGame(g7h, exampleCfg(), { nodes: [fakeNode("a", () => wd), b], prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {} });
  const j = JSON.parse(fs.readFileSync(path.join(d, "out", "W004.json"), "utf8"));
  assert.ok(j.rounds.filter((x: any) => x[0] !== "q00000200").every((x: any) => x[3] === "p"), "no round decided on disagreeing blocks");
  assert.ok([...r.alerts.errors, ...r.alerts.warnings].some((x) => /disagree/i.test(x)), JSON.stringify(r.alerts));
});

test("G7 runtime: a time past the last irreversible block keeps the round pending (never a guess)", async () => {
  const wd = qworld();
  wd.blockT0 = at(4) + DAY - 400_000 * 3000 - 10;    // the chain ends just before the first round's lock
  const rp = new Replay(g7, exampleCfg());
  const h = await rp.hour([fakeNode("a", () => wd), fakeNode("b", () => wd)], wd.time + 5 * 60000);
  const j = rp.read("W004.json");
  assert.equal(h.result?.state, "pending");
  assert.ok(j.rounds.every((r: any) => r[3] === "p"), JSON.stringify(j.rounds.map((r: any) => r[3])));
  void PENDING;
});

test("lastPickBlock: the last block strictly before the lock time (Picks.ts: accepted only while time < target − lead)", async () => {
  const { lastPickBlock } = await import("../recorder/sources/block-at.ts");
  const ts = chain(20_000), lib = 19_000, n = nodeOn(ts, lib), f = blockAtFor(n, lib);
  for (const h of [500, 7_777, 18_000]) {
    assert.equal(await lastPickBlock(f, ts[h]), h - 1, "a block stamped exactly at the lock holds no pick");
    assert.equal(await lastPickBlock(f, ts[h] + 1), h, "a block before the lock time does");
    const L = await lastPickBlock(f, ts[h] + 1);
    assert.ok(ts[L] < ts[h] + 1 && ts[L + 1] >= ts[h] + 1);
  }
});

test("#G-41 G41-4: the kit compares the two nodes' heights itself, so a game that drops the height can't hide a lying node", async () => {
  const wd = qworld();
  // node b's times run 6 s late: its heights differ by 2, so a parity-based result would still match
  const b = fakeNode("b", () => wd, { tweak: (m, _a, r) => (m === "blockTime" ? r + 6000 : r) });
  const drops: GameModule<any, any, any> = { ...exampleGame, async resultOf(round, read, inputs, ctx) { await ctx!.blockAt!(round.locksAt); return exampleGame.resultOf(round, read, inputs); } };
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "g41-4-"));
  fs.mkdirSync(path.join(d, "prev")); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  const r = await runGame(drops, exampleCfg(), { nodes: [fakeNode("a", () => wd), b], prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {} });
  const j = JSON.parse(fs.readFileSync(path.join(d, "out", "W004.json"), "utf8"));
  assert.ok(j.rounds.filter((x: any) => x[0] !== "q00000200").every((x: any) => x[3] === "p"), "no round decided on disagreeing blocks");
  assert.ok([...r.alerts.errors, ...r.alerts.warnings].some((x) => /disagree on the first block at/.test(x)), JSON.stringify(r.alerts));
});

test("#G-50 G50-1: a node whose head read fails at the first ctx.blockAt keeps the round pending (no throw from the run)", async () => {
  const wd = qworld();
  const a0 = fakeNode("a", () => wd);
  let heads = 0;
  const a = { ...a0, async head() { if (heads++ === 0) throw new Error("a: node down (head)"); return a0.head(); } };
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "g50-"));
  fs.mkdirSync(path.join(d, "prev")); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  const r = await runGame(g7, exampleCfg(), { nodes: [a as any, fakeNode("b", () => wd)], prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {} });
  const j = JSON.parse(fs.readFileSync(path.join(d, "out", "W004.json"), "utf8"));
  assert.ok(j.rounds.filter((x: any) => x[0] !== "q00000200").every((x: any) => x[3] === "p"), "rounds pending");
  assert.ok(r.alerts.warnings.some((x) => /head/.test(x)), JSON.stringify(r.alerts));
});
