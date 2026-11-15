// Repo Lens #G-79 G79-1 (Medium, latent): a game with both seasons (K1) and a live week (K4). The live pass re-scores
// the current week's decided rounds every run with seasonStaked as read on that run, so a stake placed mid-week changed
// a round the open copy had already shown; the KC-8 "decided rounds can't change" stop froze the open copy, and after
// the week ended the main pass stopped every run: the week was never recorded. The fix: an open copy is display only, so
// only a PENDING copy's decided rounds are fixed (recorder), and the publish check skips roundsChange against an open copy.
import test from "node:test";
import assert from "node:assert/strict";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import type { GameModule } from "../recorder/types.ts";

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
/** Survivor-shaped: a round's points depend on seasonStaked (here, its size). */
const g: GameModule<any, any, any> = {
  ...exampleGame,
  scoreRound(round, picks, _result, _inputs, _state, season) {
    const out = new Map<string, { points: number; at: number }>();
    for (const p of picks) out.set(p.wallet, { points: season!.seasonStaked.size, at: round.locksAt });
    return out;
  },
};
const cfg = { ...exampleCfg(), seasonWeeks: 2, liveWeek: true, roundsCorrectable: false };   // Survivor: rounds not correctable
const entry = (a: string, staked: boolean, ids: number[]) => ({ address: a, entry: { stake: staked ? "500000000" : "0", peak_stake: staked ? "500000000" : "0", voided: false, answers: ids.map((q) => ({ question_id: q, option: 0 })) } });

test("G79-1: season + live week: a stake placed mid-week doesn't freeze the open copy, and the week still goes final", async () => {
  const wd = world(at(4, 1, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(at(4) - DAY) };
  wd.questions[201] = { week: "4", outcome: 1, lock_time: String(at(4) + DAY) };        // Tue
  wd.questions[202] = { week: "4", outcome: 1, lock_time: String(at(4) + 3 * DAY) };    // Thu
  wd.next = 203;
  wd.players = [];
  wd.playersByWeek = { 4: [entry(A, true, [201, 202]), entry(B, false, [201, 202])] };
  const nodes = (): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  const rp = new Replay(g, cfg);
  // Wednesday: the open copy shows Tuesday's round decided, scored with seasonStaked = {A}
  wd.time = at(4, 2, 2);
  let h = await rp.hour(nodes(), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, h.error);
  const open = rp.read("W004.json");
  assert.equal(open.state, "open");
  // B stakes mid-week: the live pass now scores Tuesday's round with seasonStaked = {A, B}
  wd.playersByWeek[4] = [entry(A, true, [201, 202]), entry(B, true, [201, 202])];
  wd.time += H;
  h = await rp.hour(nodes(), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, h.error);
  assert.ok(!h.result!.alerts.warnings.some((x: string) => /open copy couldn't be written/.test(x)), JSON.stringify(h.result!.alerts.warnings));
  assert.notDeepEqual(rp.read("W004.json").rounds, open.rounds, "the open copy moved on (display only)");
  // after the week ends, the main pass records it and it goes final (before the fix: KC-8 stopped every run)
  wd.time = at(5, 0, 2);
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(), wd.time + 5 * 60000); assert.equal(h.error, undefined, h.error); wd.time += H; }
  assert.equal(rp.read("W004.json").state, "final");
  assert.ok(rp.read("vault/W4.json"), "the vault file is written");
});
