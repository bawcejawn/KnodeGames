// Daily Questions: the conformance sample (kit/testing/conformance.ts). Vault week 4 (Mon 16 Nov 2026, the rule week):
// six questions over the week, Saturday 12:00's closing at exactly Sun 00:00 (Saturday's, counted), one question still
// unresolved at the first hour (it must come back PENDING), one void, and one closing on Sunday (a fun round: counts
// for no week). Two staked wallets, two free ones, one that withdrew (voided).
import { fakeNode, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, DAY, HOUR } from "../../../kit/testing/fake-clock.ts";
import { roundId } from "../../../kit/recorder/sources/vault-answers.ts";
import type { Sample } from "../../../kit/testing/conformance.ts";

export const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
export const D = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", E = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE";

export function sampleWorld(t: number): World {
  const wd = world(t);
  const s = at(4);
  wd.questions[300] = { week: "3", outcome: 1, lock_time: String(s - DAY) };
  const q = (id: number, outcome: number, lock: number) => (wd.questions[id] = { week: "4", outcome, lock_time: String(lock) });
  q(301, 1, s + 12 * HOUR);              // Mon
  q(302, 2, s + 2 * DAY);                // Wed 00:00 (Tuesday's)
  q(303, 1000, s + 3 * DAY + HOUR);      // void
  q(304, 2, s + 4 * DAY + 12 * HOUR);    // Fri
  q(305, 0, s + 6 * DAY);                // closes Sun 00:00 exactly: Saturday's; unresolved until decide()
  q(306, 1, s + 6 * DAY + 12 * HOUR);    // closes on Sunday: a fun round
  wd.next = 307;
  const ans = (xs: [number, number][]) => xs.map(([id, o]) => ({ question_id: id, option: o }));
  wd.players = [
    { address: A, entry: { stake: "500000000", peak_stake: "500000000", voided: false, answers: ans([[301, 0], [302, 1], [303, 0], [304, 1], [305, 0], [306, 0]]) } },
    { address: B, entry: { stake: "200000000", peak_stake: "300000000", voided: false, answers: ans([[301, 0], [302, 0], [304, 1]]) } },
    { address: C, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([[301, 0], [302, 1], [305, 1]]) } },
    { address: D, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([[301, 1], [302, 1]]) } },
    { address: E, entry: { stake: "0", peak_stake: "500000000", voided: true, answers: ans([[301, 0], [302, 1]]) } },
  ];
  return wd;
}

export function sample(): Sample {
  let decided = false;
  const now = { t: 0 };
  const w = () => { const x = sampleWorld(now.t); if (decided) x.questions[305].outcome = 1; return x; };
  const chain = (i: number) => at(5, 0, 1) + i * HOUR;   // from Mon 23 Nov 01:00 UTC, hourly
  return {
    week: 4,
    nodes: (t) => { now.t = t; return [fakeNode("a", w), fakeNode("b", w)]; },
    undecided: [roundId(305)],
    hours: { chain, job: (i) => chain(i) + 5 * 60000, count: 6, decideAfter: 1, decide: () => { decided = true; } },
  };
}
