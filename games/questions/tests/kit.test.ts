// Daily Questions on the Shared Game Kit (games/questions/recorder.ts + kit/): hour by hour on two fake nodes, each
// run's files through the REAL publish check (kit/publish/check.inline.mjs, the file the workflow inlines). Ported from
// PR #203's recorder tests (same scenarios), plus the kit's holds and the vault bot's own checks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { game } from "../recorder.ts";
import { kitConfig, loadManifest } from "../../../kit/recorder/manifest.ts";
import { runGame } from "../../../kit/recorder/runtime.ts";
import { releaseCode } from "../../../kit/recorder/lifecycle.ts";
import { weekHash, canon } from "../../../kit/publish/check.inline.mjs";
import { Replay } from "../../../kit/testing/replay.ts";
import { fakeNode, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../../../kit/testing/fake-clock.ts";

const cfg = kitConfig(loadManifest("questions"));
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

/** #203's world: week 4 (the rule week), four questions, A staked 4 pts, B free 2 pts, C free 1 pt. */
function qworld(): World {
  const s4 = at(4);
  const wd = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };
  for (let i = 0; i < 4; i++) wd.questions[201 + i] = { week: "4", outcome: 1 + (i % 2), lock_time: String(s4 + (i + 1) * DAY / 2) };
  wd.next = 205;
  const ans = (o: number[]) => o.map((x, i) => ({ question_id: 201 + i, option: x }));
  wd.players = [
    { address: A, entry: { stake: "500000000", peak_stake: "500000000", voided: false, answers: ans([0, 1, 0, 1]) } },
    { address: B, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([0, 1, 1]) } },
    { address: C, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([0, 0]) } },
  ];
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const hour = (rp: Replay, wd: World, env = {}) => rp.hour(nodes(wd), wd.time + 5 * 60000, env);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "q-kit-"));

test("questions: before the rule week it records nothing", async () => {
  const wd = qworld(); wd.config.q60_rule_week_plus_one = "6";
  const rp = new Replay(game, cfg);
  const h = await hour(rp, wd);
  assert.equal(h.result?.state, "not-active");
  assert.deepEqual(h.published, []);
  wd.config.q60_rule_week_plus_one = "0";
  assert.equal((await hour(rp, wd)).result?.state, "not-active");
});

test("questions: pending, then final after a second matching run an hour later; then written once", async () => {
  const wd = qworld(), rp = new Replay(game, cfg);
  let h = await hour(rp, wd);
  assert.equal(h.result?.state, "pending");
  assert.deepEqual(h.held, []);
  assert.deepEqual(h.published.sort(), ["W004.json", "board.json"]);
  wd.time += 30 * 60000;
  h = await hour(rp, wd);
  assert.equal(h.result?.state, "pending", "30 minutes isn't an hour");
  wd.time += 31 * 60000;
  h = await hour(rp, wd);
  assert.equal(h.result?.state, "final");
  assert.deepEqual(h.held, []);
  assert.deepEqual(rp.read("vault/W4.json"), { game: 1, week: 4, final: true, rows: [{ player: A, points: 4 }], first: [B], second: [C] });
  const lw = rp.read("board.json").lastWeek;
  assert.equal(lw.final, true);
  assert.deepEqual(lw.rows.map((r: any) => [r.a, r.board, r.place, r.points, r.ranked]), [[A, "staked", 1, 4, true], [B, "free", 1, 2, false], [C, "free", 2, 1, false]]);
  const before = rp.raw("W004.json");
  wd.time += H;
  h = await hour(rp, wd);
  assert.equal(h.result?.state, "final");
  assert.equal(rp.raw("W004.json"), before, "a final week file never changes");
  assert.deepEqual(h.held, []);
});

test("questions: a question still to resolve keeps the week pending (and the board says so)", async () => {
  const wd = qworld(); wd.questions[204].outcome = 0;
  const rp = new Replay(game, cfg);
  for (let i = 0; i < 3; i++) { assert.equal((await hour(rp, wd)).result?.state, "pending"); wd.time += 2 * H; }
  assert.equal(rp.read("board.json").lastWeek.complete, false);
  assert.equal(rp.read("vault/W4.json"), null);
});

test("questions: an owner correction (an outcome changed on chain) restarts the hour; the corrected week goes final", async () => {
  const wd = qworld(), rp = new Replay(game, cfg);
  await hour(rp, wd); wd.time += 2 * H;
  wd.questions[204].outcome = 1;              // corrected: A's 4th answer is now wrong
  assert.equal((await hour(rp, wd)).result?.state, "pending");
  wd.time += 2 * H;
  const h = await hour(rp, wd);
  assert.equal(h.result?.state, "final");
  assert.deepEqual(h.held, []);
  assert.equal(rp.read("vault/W4.json").rows[0].points, 3);
});

test("questions: the two nodes must agree; a failed read stops the run and writes nothing", async () => {
  const wd = qworld(), d = tmp();
  const prev = path.join(d, "prev"); fs.mkdirSync(prev); fs.writeFileSync(path.join(prev, ".fetched"), "");
  const other = fakeNode("b", () => wd, { tweak: (m, _a, r) => { if (m === "list_players") for (const x of r.rows ?? []) if (x.address === A) x.entry.answers[3].option = 0; return r; } });
  await assert.rejects(runGame(game, cfg, { nodes: [fakeNode("a", () => wd), other], prev, out: path.join(d, "o1"), log: () => {} }), /disagree/);
  const otherQ = fakeNode("b", () => wd, { tweak: (m, a, r) => { if (m === "get_question" && a.id === 202) r.question.outcome = 1; return r; } });
  await assert.rejects(runGame(game, cfg, { nodes: [fakeNode("a", () => wd), otherQ], prev, out: path.join(d, "o2"), log: () => {} }), /disagree/);
  const down = fakeNode("b", () => wd, { fail: ["list_players"] });
  await assert.rejects(runGame(game, cfg, { nodes: [fakeNode("a", () => wd), down], prev, out: path.join(d, "o3"), log: () => {} }), /node down/);
  for (const o of ["o1", "o2", "o3"]) assert.deepEqual(fs.readdirSync(path.join(d, o, "vault")), [], `${o} wrote nothing`);
  assert.deepEqual(fs.readdirSync(path.join(d, "o1")).filter((f) => f !== "vault"), []);
});

test("questions: without the last run's files (no .fetched mark), or with one it can't read, it refuses to write", async () => {
  const wd = qworld(), d = tmp(), prev = path.join(d, "prev");
  fs.mkdirSync(prev);
  await assert.rejects(runGame(game, cfg, { nodes: nodes(wd), prev, out: path.join(d, "o"), log: () => {} }), /refusing to write/);
  fs.writeFileSync(path.join(prev, ".fetched"), "");
  fs.writeFileSync(path.join(prev, "W004.json"), "{not json");
  await assert.rejects(runGame(game, cfg, { nodes: nodes(wd), prev, out: path.join(d, "o"), log: () => {} }), /can't be read: refusing to write/);
});

test("questions: a final week the chain later reads differently: copied forward unchanged, a HOLD file, an alert", async () => {
  const wd = qworld(), rp = new Replay(game, cfg);
  await hour(rp, wd); wd.time += 2 * H; await hour(rp, wd);
  const before = rp.raw("vault/W4.json");
  assert.ok(before);
  wd.time += H; wd.players[0].entry.answers[3].option = 0;
  const h = await hour(rp, wd);
  assert.ok(h.result!.alerts.errors.some((e) => /changed on chain after it went final/.test(e)));
  assert.equal(rp.raw("vault/W4.json"), before, "the published vault file never changes");
  const hold = rp.read("vault/HOLD-W4.json");
  assert.match(hold.reason, /changed on chain after it went final/);
  // The owner releases exactly that hold with its code; nothing else releases it.
  wd.time += H;
  await hour(rp, wd, { release: "4:0000000000000000" });
  assert.equal(rp.read("vault/RELEASE-W4.json"), null);
  wd.time += H;
  await hour(rp, wd, { release: `4:${releaseCode(hold.reason)}` });
  assert.deepEqual(rp.read("vault/RELEASE-W4.json"), { game: 1, week: 4, code: releaseCode(hold.reason) });
});

test("questions: the owner's hold weeks keep a week pending; lifting it lets it go final", async () => {
  const wd = qworld(), rp = new Replay(game, cfg);
  for (let i = 0; i < 3; i++) { assert.equal((await hour(rp, wd, { holdWeeks: "4" })).result?.state, "pending"); wd.time += 2 * H; }
  assert.equal(rp.read("vault/W4.json"), null);
  assert.equal((await hour(rp, wd)).result?.state, "final");
  assert.ok(rp.read("vault/W4.json"));
  await assert.rejects(hour(rp, wd, { holdWeeks: "4,x" }).then((h) => { if (h.error) throw new Error(h.error); }), /not a week number/);
});

test("questions: past the results deadline (Thursday 00:00 UTC) it records nothing more, with an alert", async () => {
  const wd = qworld(); wd.time = at(5, 3, 0) + 10 * 60000;
  const rp = new Replay(game, cfg);
  const h = await hour(rp, wd);
  assert.equal(h.result?.state, "past-due");
  assert.ok(h.result!.alerts.errors.some((e) => /backstop/.test(e)));
  assert.deepEqual(h.published, []);
});

test("questions: its files are in the recorders' own JSON form, and the hash is its content's", async () => {
  const wd = qworld(), rp = new Replay(game, cfg);
  await hour(rp, wd);
  for (const f of ["W004.json", "board.json"]) { const raw = rp.raw(f)!; assert.equal(raw, canon(JSON.parse(raw)), f); }
  const w = rp.read("W004.json");
  assert.equal(w.seen.hash, weekHash(w));
  assert.deepEqual(w.rounds.map((r: any) => r[0]), ["q00000201", "q00000202", "q00000203", "q00000204"], "only week 4's questions");
});

test("questions: the vault bot's own checks pass on its final files (bot/vault.ts)", async () => {
  const { checkResults, boardScore, orderBreak } = await import("../../../bot/vault.ts");
  const wd = qworld(), rp = new Replay(game, cfg);
  await hour(rp, wd); wd.time += 2 * H; await hour(rp, wd);
  const v = rp.read("vault/W4.json"), b = rp.read("board.json");
  assert.equal(checkResults(v, 1, 4), "");
  assert.equal(b.lastWeek.week, 4);
  const places = new Map<string, number>(b.lastWeek.rows.map((r: any) => [r.a, r.place]));
  assert.equal(orderBreak(v.rows, places), "");
  const ranked = b.lastWeek.rows.filter((r: any) => r.ranked === true && (boardScore(r) ?? 0) > 0).map((r: any) => r.a);
  assert.deepEqual(ranked, v.rows.map((r: any) => r.player));
});

test("questions: game 1's vault values are real points, never more than the wallet's answers (Kpred qEntryRule)", async () => {
  const wd = qworld(), rp = new Replay(game, cfg);
  await hour(rp, wd); wd.time += 2 * H; await hour(rp, wd);
  const v = rp.read("vault/W4.json");
  for (const r of v.rows) {
    const n = wd.players.find((p) => p.address === r.player)!.entry.answers.length;
    assert.ok(n >= 2 && r.points <= n, `${r.player}: ${r.points} points, ${n} answers`);
  }
});
