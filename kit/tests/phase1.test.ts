// Fantasy Phase 1 (kit additions after #210), one block per item. FC-13: the runner's clock caps `now`. FC-26: a vault
// file only for a week the game earns in the vault (from_week, last week, or closed with it).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exampleGame as game, exampleCfg } from "../testing/example/index.ts";
import { runGame, gameEarnsWeek } from "../recorder/runtime.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";

const cfg = exampleCfg();
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

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
async function toFinal(wd: World) {
  const rp = new Replay(game, cfg);
  let last;
  for (let i = 0; i < 4; i++) { last = await rp.hour(nodes(wd), wd.time + 5 * 60000); wd.time += H; }
  return { rp, last };
}

test("FC-26: the vault's own earning rule (from_week, last_week_plus_one, a closed week)", () => {
  assert.equal(gameEarnsWeek({}, 4), false, "not registered");
  assert.equal(gameEarnsWeek({ game: { from_week: 5, last_week_plus_one: 0 }, week: {} }, 4), false, "before from_week");
  assert.equal(gameEarnsWeek({ game: { from_week: 4, last_week_plus_one: 0 }, week: {} }, 4), true);
  assert.equal(gameEarnsWeek({ game: { from_week: 2, last_week_plus_one: 4 }, week: {} }, 4), false, "stopped after week 3");
  assert.equal(gameEarnsWeek({ game: { from_week: 2, last_week_plus_one: 5 }, week: {} }, 4), true, "its last week");
  assert.equal(gameEarnsWeek({ game: { from_week: 9, last_week_plus_one: 0 }, week: { closed: true } }, 4), true, "a week the vault closed with it");
  assert.equal(gameEarnsWeek({ game: { from_week: "x" }, week: {} }, 4), false, "an unreadable from_week is no");
});

test("FC-26: a week before the game's from_week goes final with its board, but no vault file", async () => {
  const wd = qworld(); wd.games = { 250: { from_week: 5 } };
  const { rp, last } = await toFinal(wd);
  assert.equal(last!.result?.state, "final");
  assert.equal(rp.read("W004.json").state, "final");
  assert.equal(rp.read("vault/W4.json"), null);
  assert.ok(last!.result!.alerts.notes.some((n) => /FC-26/.test(n)));
});

test("FC-26: an unregistered game writes no vault file; a registered one does", async () => {
  const wd = qworld(); wd.games = {};
  assert.equal((await toFinal(wd)).rp.read("vault/W4.json"), null);
  const w2 = qworld(); w2.games = { 250: { from_week: 4 } };
  assert.equal((await toFinal(w2)).rp.read("vault/W4.json")?.week, 4);
});

test("FC-26: the two nodes must agree on the game's registration", async () => {
  const wd = qworld();
  const b = fakeNode("b", () => wd, { tweak: (m, _a, r) => (m === "get_game" ? { ...r, game: { ...r.game, from_week: 9 } } : r) });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "p1-"));
  fs.mkdirSync(path.join(d, "prev")); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  await assert.rejects(runGame(game, cfg, { nodes: [fakeNode("a", () => wd), b], prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {} }), /registration/);
});

test("FC-13: chain time ahead of the runner's clock is capped at the runner's clock (nothing ends early)", async () => {
  const wd = qworld();                            // chain says Monday 02:00 of week 5: week 4 has ended
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "p1-"));
  fs.mkdirSync(path.join(d, "prev")); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  const r = await runGame(game, cfg, { nodes: nodes(wd), prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {}, wallNow: () => wd.time - 3 * H });
  assert.notEqual(r.week, 4, "the runner's clock is still in week 4: week 4 must not be recorded");
  assert.ok(r.alerts.warnings.some((x) => /ahead of this runner's clock/.test(x)));
  const ok = await runGame(game, cfg, { nodes: nodes(wd), prev: path.join(d, "prev"), out: path.join(d, "out2"), log: () => {}, wallNow: () => wd.time + 60000 });
  assert.equal(ok.week, 4);
  assert.ok(!ok.alerts.warnings.some((x) => /FC-13/.test(x)));
});
