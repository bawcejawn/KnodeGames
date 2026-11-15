// Repo Lens #G-78 (PR #313 @ 0f522dec), Q3: G52-e past the cutoff. The PR's new G52-e stops at Mon 03:00 (kept, ERROR,
// pending). This follows the same week through Tue 00:00 (the flagged-day cutoff) to the Thu 00:00 backstop.
// Same harness as games/fantasy/tests/g52-flagged-cutoff-blockat.test.mts. Run from the repo root of 0f522dec:
//   REPO=$PWD TZ=UTC node --import tsx --test --test-concurrency=1 /home/claude/g1/tests-g78/g78-fantasy-g52e.test.mts
// Expected at 0f522dec (by reading runtime.ts:490-503): passes. Before the cutoff the round is kept with an ERROR each
// run; from the cutoff the flagged day decides 0, which differs from the published clean result, so KC-8 stops the run
// every hour (rc 2, emailed) and the week reaches the backstop with no vault file. The published clean result is never
// paid. If the Fantasy chat wants a different end state, this is the test to change.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const REPO = process.env.REPO ?? process.cwd();
const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");

const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const flaggedRounds = new Set<string>();
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: flaggedRounds.has(s.round) ? "flagged" : "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true };
const T0 = at(0) - 30 * DAY, LAG = 60;
const libAt = (t: number) => Math.floor((t - T0) / 3000) - LAG;
async function setup() {
  flaggedRounds.clear();
  const wd = world(at(4) - 2 * DAY + H);
  wd.blockT0 = T0;
  const tick = (t: number) => { wd.time = t; wd.lib = libAt(t); };
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: P.slice(0, 5), time: String(at(4) - 600000) } }] };
  const rp = new Replay(m, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  tick(wd.time);
  const h0 = await rp.hour(nodes(), wd.time + 5 * 60000, { vhpLedger: { to: 0 } });
  assert.equal(h0.error, undefined, h0.error);
  return { wd, rp, nodes, tick };
}
const run = async (s: any, t: number) => { s.tick(t); return s.rp.hour(s.nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); };
const wedOf = (j: any) => j.rounds.find((r: any) => r[1] === at(4, 2));

test("G78 Q3 (G52-e continued): kept with an ERROR until the cutoff; from the cutoff KC-8 stops every run; backstop, no vault file, the clean result never paid", async () => {
  const s = await setup();
  let h = await run(s, at(5, 0, 2)); assert.equal(h.error, undefined, h.error);
  const clean = JSON.stringify(wedOf(s.rp.read("W004.json")));
  assert.equal(wedOf(s.rp.read("W004.json"))[3], "s");
  flaggedRounds.add(ymd(at(4, 2)));
  for (let k = 3; k < 24; k++) {                          // Mon 03:00 .. Mon 23:00: before the cutoff
    h = await run(s, at(5, 0, k));
    assert.equal(h.error, undefined, h.error);
    assert.equal(h.result?.state, "pending");
    assert.ok(h.result!.alerts.errors.some((x: string) => /G69-1/.test(x)), `hour ${k}: an emailed error every run`);
  }
  let stops = 0;
  for (let t = at(5, 1, 1); t < at(5, 3); t += H) {        // Tue 01:00 .. Wed 23:00: past the cutoff
    h = await run(s, t);
    if (h.error) { stops++; assert.match(h.error, /was decided and now reads differently/); }
    assert.equal(s.rp.read("vault/W4.json"), null, "no vault file pays the published clean Wednesday");
    assert.notEqual(s.rp.read("W004.json").state, "final");
  }
  assert.ok(stops > 40, `KC-8 stops every run after the cutoff (${stops})`);
  assert.equal(JSON.stringify(wedOf(s.rp.read("W004.json"))), clean, "the published copy is unchanged (nothing recorded on a stop)");
  h = await run(s, at(5, 3, 1));                          // Thu 01:00: the backstop error
  assert.ok(h.error || h.result!.alerts.errors.some((x: string) => /backstop/.test(x)));
});
