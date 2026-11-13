// Kit ruler example (TEST FIXTURE): the conformance sample. Vault week 4. Three play days (Mon–Wed), each decided by a
// ruler card from the ruler test fixture's made-up chain; wallets A (staked) and B (free) pick a producer on Monday,
// B changes on Tuesday; C picks nothing and has no team. Day 2 is undecided at the first hour (its lock block isn't
// irreversible yet), then decided.
import { fakeNode, world, type World } from "../../../../fake-nodes.ts";
import { at, DAY, HOUR } from "../../../../fake-clock.ts";
import { rulerLedger } from "../../../../ruler-fixture.ts";
import type { Sample } from "../../../../conformance.ts";

export const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

export function sampleWorld(t: number, decided: boolean): World {
  const wd = world(t);
  const d0 = Math.floor(at(4) / DAY);
  wd.picks = {
    [`40:${d0}`]: [{ player: A, pick: { producers: [A], time: String(at(4) - 600000) } }, { player: B, pick: { producers: [B], time: String(at(4) - 500000) } }],
    [`40:${d0 + 1}`]: [{ player: B, pick: { producers: [A], time: String(at(4) + DAY - 500000) } }],
  };
  wd.gamePlayers = { [A]: { week_stake: "500000000", peak_stake: "500000000" }, [B]: { week_stake: "0", peak_stake: "0" } };
  // 3 s blocks; the last irreversible block is just before day 2's lock until decide()
  wd.lib = 400_000;
  const top = decided ? t : at(4) + 2 * DAY - 6000;
  wd.blockT0 = top - 400_000 * 3000;
  return wd;
}

export function sample(): Sample {
  let decided = false;
  const now = { t: 0 };
  const w = () => sampleWorld(now.t, decided);
  const chain = (i: number) => at(5, 0, 1) + i * HOUR;
  return {
    week: 4,
    nodes: (t) => { now.t = t; return [fakeNode("a", w), fakeNode("b", w)]; },
    vhpLedger: rulerLedger(),
    undecided: ["d2"],
    hours: { chain, job: (i) => chain(i) + 5 * 60000, count: 6, decideAfter: 1, decide: () => { decided = true; } },
  };
}
