// Repo Lens #G-41 (kit-blockat @ d65a504c): failing tests for the ctx.blockAt runtime wiring.
// Run from the repo root:  TZ=UTC node --import tsx --test /home/claude/g1/tests-g41/g41.test.ts
// (set G41_REPO to another checkout to try a fix; default /home/claude/g1/g41/repo)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const REPO = process.env.G41_REPO ?? fileURLToPath(new URL("../..", import.meta.url));   // Architecture: default = this checkout (was the reviewer's path)
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const { runGame } = await imp("kit/recorder/runtime.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { exampleGame, exampleCfg } = await imp("kit/testing/example/index.ts");
const { at, DAY } = await imp("kit/testing/fake-clock.ts");

// Same world as kit/tests/blockat.test.ts qworld(): week 4 open, 3 s blocks up to now, lib 400,000.
function qworld(): any {
  const s4 = at(4), wd: any = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };
  for (let i = 0; i < 2; i++) wd.questions[201 + i] = { week: "4", outcome: 1, lock_time: String(s4 + (i + 1) * DAY) };
  wd.next = 203;
  wd.players = [{ address: "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", entry: { stake: "0", peak_stake: "0", voided: false, answers: [{ question_id: 201, option: 0 }] } }];
  wd.lib = 400_000; wd.blockT0 = at(5, 0, 2) - 400_000 * 3000;
  return wd;
}
function dirs() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "g41-"));
  fs.mkdirSync(path.join(d, "prev")); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  return { prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {} };
}
// A game whose result depends only on the block at each round's lock (no vault read in resultOf).
const g7h: any = { ...exampleGame, async resultOf(round: any, _r: any, _i: any, ctx: any) { return ((await ctx.blockAt(round.locksAt)) % 2) + 1; } };

test("G41-1: a node whose block reads fail keeps the round pending (like any failed read), not a stop of the whole run", async () => {
  const wd = qworld();
  const b = fakeNode("b", () => wd, { fail: ["blockTime"] });
  let r: any;
  await assert.doesNotReject(async () => { r = await runGame(g7h, exampleCfg(), { nodes: [fakeNode("a", () => wd), b], ...dirs() }); },
    "a blockTime network failure must be a ReadFailed (round pending, warning), as a failed vault read is");
  assert.ok(r.alerts.warnings.some((x: string) => /blockTime|block/i.test(x)), JSON.stringify(r.alerts));
});

test("G41-2: block reads count against the run's time budget (a slow node can't run past the 18-minute budget)", async () => {
  const wd = qworld();
  let wall = 1_000_000, n = 0;
  const slow = { tweak: (m: string, _a: any, v: any) => { if (m === "blockTime") { n++; wall += 60_000; } return v; } };  // 1 min a block read
  const o = dirs();
  const r = await runGame(g7h, exampleCfg(), { nodes: [fakeNode("a", () => wd, slow), fakeNode("b", () => wd, slow)], ...o, wall: () => wall });
  const minutes = n;
  const j = JSON.parse(fs.readFileSync(path.join(o.out, "W004.json"), "utf8"));
  const decided = j.rounds.filter((x: any) => x[3] !== "p").length;
  assert.ok(minutes > 18, `setup: the block reads took ${minutes} fake minutes`);
  assert.ok([...r.alerts.warnings, ...r.alerts.errors].some((x: string) => /budget/i.test(x)) || decided === 0,
    `${minutes} minutes of block reads, ${decided} round(s) decided, and no budget warning: blockAt isn't charged to the Budget`);
});

test("G41-3: NotYet from ctx.blockAt in inputsFor (a game without an inputs file) waits, it doesn't throw out of the run", async () => {
  const wd = qworld();
  const g: any = { ...exampleGame, async inputsFor(span: any, ctx: any) { await ctx.blockAt(span.end + 30 * DAY); return {}; } };
  await assert.doesNotReject(runGame(g, exampleCfg(), { nodes: [fakeNode("a", () => wd), fakeNode("b", () => wd)], ...dirs() }),
    "README/GAME_KIT: NotYet = pending for every game");
});
