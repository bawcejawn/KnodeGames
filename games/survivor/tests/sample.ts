// Survivor (TEST FIXTURE): the conformance sample for `npm run game:check -- survivor`. Season 1's first week (vault
// week 7, Mon 7 – Sat 12 Dec 2026) on the kit's made-up ruler chain (kit/testing/ruler-fixture.ts: five producers, one
// block every 3 s from block 100,000).
// - Block 100,000 is 15 days before the week, so every play day's card has its 14 days of history.
// - Hour 0 is just after the week. Until decide(), the last irreversible block sits just before Saturday ends, so
//   Saturday's window (S1 = the last block of the day) can't be read and Saturday stays pending; then it follows the
//   clock and the week goes final.
// Wallet S (staked) picks a different producer each day; F (free) picks on Monday and Tuesday only, then misses days.
import { fakeNode, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, DAY, HOUR } from "../../../kit/testing/fake-clock.ts";
import { rulerLedger, P, FROM } from "../../../kit/testing/ruler-fixture.ts";
import type { Sample } from "../../../kit/testing/conformance.ts";

export const S = "1SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS", F = "1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
const WEEK = 7, BLOCK = 3000, T_FROM = at(WEEK) - 15 * DAY;      // block FROM's time
const blockOf = (t: number) => FROM + Math.floor((t - T_FROM) / BLOCK);
const EXTRA = 8 * 28800;                                           // ledger: 15 + 8 days from FROM, to a day after the week
const LAST = FROM + 15 * 28800 + EXTRA - 1;
const SAT_END = at(WEEK) + 6 * DAY;

export function sampleWorld(t: number, decided: boolean): World {
  const wd = world(t);
  const d0 = Math.floor(at(WEEK) / DAY);
  const pick = (who: string, d: number, a: string) => ({ player: who, pick: { producers: [a], time: String((d0 + d) * DAY - HOUR) } });
  wd.picks = {};
  const sPicks = [P[0], P[1], P[2], P[3], P[1], P[0]];       // day 5 and 6 reuse producers: those picks can't count
  sPicks.forEach((a, d) => { (wd.picks![`3:${d0 + d}`] ??= []).push(pick(S, d, a)); });
  (wd.picks[`3:${d0}`] ??= []).push(pick(F, 0, P[2]));
  (wd.picks[`3:${d0 + 1}`] ??= []).push(pick(F, 1, P[0]));
  wd.gamePlayers = { [S]: { week_stake: "500000000", peak_stake: "500000000" }, [F]: { week_stake: "0", peak_stake: "0" } };
  const top = decided ? t : Math.min(t, SAT_END - 60000);
  wd.lib = Math.min(LAST, blockOf(top));
  wd.blockT0 = T_FROM - FROM * BLOCK;
  return wd;
}

export function sample(): Sample {
  let decided = false;
  const now = { t: 0 };
  const w = () => sampleWorld(now.t, decided);
  const chain = (i: number) => at(WEEK + 1, 0, 1) + i * HOUR;
  return {
    week: WEEK,
    nodes: (t) => { now.t = t; return [fakeNode("a", w), fakeNode("b", w)]; },
    vhpLedger: rulerLedger(EXTRA),
    undecided: ["d20261212"],
    hours: { chain, job: (i) => chain(i) + 5 * 60000, count: 6, decideAfter: 1, decide: () => { decided = true; } },
  };
}
