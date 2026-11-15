// K4 (Survivor, 13 Nov): a liveWeek game writes an open copy of the current week every run, with the rounds decided so
// far, so players see each day's result the next morning. No vault file, nothing in the all-time board, never in the
// way of last week's run; the publish check publishes it (open, this week only).
import test from "node:test";
import assert from "node:assert/strict";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
function qworld(t: number) {
  const s4 = at(4), s5 = at(5), wd = world(t);
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };
  for (let i = 0; i < 3; i++) wd.questions[201 + i] = { week: "4", outcome: 1, lock_time: String(s4 + (i + 1) * DAY) };
  for (let i = 0; i < 4; i++) wd.questions[204 + i] = { week: "5", outcome: i < 2 ? 1 : 0, lock_time: String(s5 + (i + 1) * DAY) };
  wd.next = 208;
  const ans = (ids: number[]) => ids.map((q) => ({ question_id: q, option: 0 }));
  const p = (a: number[], b: number[]) => [
    { address: A, entry: { stake: "500000000", peak_stake: "500000000", voided: false, answers: ans(a) } },
    { address: B, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans(b) } },
  ];
  wd.players = p([201, 202], [201]);
  wd.playersByWeek = { 5: p([204, 205, 206], [204]) };
  return wd;
}
const nodes = (wd: any): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];

test("K4: liveWeek writes the current week's open copy with the rounds decided so far; no vault file, last week unaffected", async () => {
  const wd = qworld(at(5, 2, 1));          // Wednesday of week 5: two week-5 rounds decided, two still to come
  const rp = new Replay(exampleGame, { ...exampleCfg(), liveWeek: true });
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, h.error);
  const open = rp.read("W005.json");
  assert.ok(open, "the open copy is published");
  assert.equal(open.state, "open");
  const st = open.rounds.map((r: any) => r[3]);
  assert.ok(st.includes("s") && st.includes("p"), `decided and still-pending rounds: ${st}`);
  assert.equal(rp.read("vault/W5.json"), null, "no vault file for an open week");
  assert.ok(rp.read("W004.json"), "last week is recorded as before");
  // the next run updates it; it never goes final while the week is being played
  wd.time += DAY;
  const h2 = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(h2.error, undefined, h2.error);
  assert.equal(rp.read("W005.json").state, "open");
});

test("K4: without liveWeek there is no open copy (unchanged)", async () => {
  const wd = qworld(at(5, 2, 1));
  const rp = new Replay(exampleGame, exampleCfg());
  await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(rp.read("W005.json"), null);
});
