// Fantasy Producers (TEST FIXTURE): the conformance sample for `npm run game:check -- fantasy`. Vault week 4 on the
// kit's made-up ruler chain (kit/testing/ruler-fixture.ts: five producers, one block every 3 s from block 100,000).
// - Block 100,000 is 25 days before the week, so the 7 form days (10 to 4 days before) have paying ruler cards.
// - Hour 0 is 47 hours before the week: the price list (inputs/W4.json) is made and published then.
// - Hours 1+ are after the week. Until decide(), the last irreversible block sits just before Saturday's lock, so
//   Saturday and Sunday stay pending; then it follows the clock and the week goes final.
// Wallet S (staked) picks a team on Monday and moves the armband on Tuesday; F (free) picks on Monday only.
import { fakeNode, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, DAY, HOUR } from "../../../kit/testing/fake-clock.ts";
import { rulerLedger, P, FROM } from "../../../kit/testing/ruler-fixture.ts";
import type { Sample } from "../../../kit/testing/conformance.ts";

export const S = "1SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS", F = "1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
const BLOCK = 3000, T_FROM = at(4) - 25 * DAY;           // block FROM's time (a paying card needs 14 days + 6 h of data before it)
const blockOf = (t: number) => FROM + Math.floor((t - T_FROM) / BLOCK);
const EXTRA = 18 * 28800;                                  // ledger: 15 + 18 days from FROM, to a day after the week
const LAST = FROM + 15 * 28800 + EXTRA - 1;
const SAT_LOCK = at(4) + 5 * DAY - 5 * 60000;

export function sampleWorld(t: number, decided: boolean): World {
  const wd = world(t);
  const d0 = Math.floor(at(4) / DAY);
  const team = [P[0], P[1], P[2], P[3], P[4]], moved = [P[1], P[0], P[2], P[3], P[4]];
  wd.picks = {
    [`4:${d0}`]: [{ player: S, pick: { producers: team, time: String(at(4) - 600000) } }, { player: F, pick: { producers: moved, time: String(at(4) - 500000) } }],
    [`4:${d0 + 1}`]: [{ player: S, pick: { producers: moved, time: String(at(4) + DAY - 600000) } }],
  };
  wd.gamePlayers = { [S]: { week_stake: "500000000", peak_stake: "500000000" }, [F]: { week_stake: "0", peak_stake: "0" } };
  const top = decided ? t : Math.min(t, SAT_LOCK - 6000);
  wd.lib = Math.min(LAST, blockOf(top));
  wd.blockT0 = T_FROM - FROM * BLOCK;
  return wd;
}

export function sample(): Sample {
  let decided = false;
  const now = { t: 0 };
  const w = () => sampleWorld(now.t, decided);
  const chain = (i: number) => (i === 0 ? at(4) - 47 * HOUR : at(5, 0, 1) + (i - 1) * HOUR);
  const days = Array.from({ length: 7 }, (_, d) => `d${new Date(at(4) + d * DAY).toISOString().slice(0, 10).replace(/-/g, "")}`);
  return {
    week: 4,
    nodes: (t) => { now.t = t; return [fakeNode("a", w), fakeNode("b", w)]; },
    vhpLedger: rulerLedger(EXTRA),
    // The kit runs its direct checks at hour 0. For a game with an inputs file hour 0 must come before the week (the
    // price list), when no day can be decided yet, so the kit's "decided rounds to score" check can't pass there.
    // Asked of Architecture (13 Nov): an optional checkAt, the chain time of those checks. Here: hour 1, after the
    // week, Monday–Friday decided and the weekend pending. (Saturday and Sunday are pending at hour 0 too.)
    checkAt: chain(1),
    undecided: days.slice(5),
    hours: { chain, job: (i) => chain(i) + 5 * 60000, count: 8, decideAfter: 2, decide: () => { decided = true; } },
  };
}
