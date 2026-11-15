// #G-42 G42-2 (High, NEEDS BLIND VERIFIER): a wallet that sends a Picks game 4 pick but never gets a valid team
// (an invalid Monday pick, a pick with a producer not on the list, or a Sunday-only pick) is in the kit's "who" list
// for that round, but Fantasy's scoreRound scores only wallets with a carried team. The kit then throws
// "scoreRound must score exactly the wallets that picked or carry a state" and the whole run stops, every hour:
// the week is never recorded and the vault pays game 4 nothing for it (Thursday backstop). One cheap pick from any
// wallet does it.
//
// The kit at 81a0343 doesn't pass ctx.blockAt yet (G7), so every Fantasy round is PENDING and this can't fire today.
// These tests inject a block clock and a fake ruler (what kit-blockat does) to show what happens once G7 merges.
//
// Run from the repo root of fantasy-kit @ 81a0343:
//   node --import tsx --test games/fantasy/tests/g42-2-picker-without-team.test.ts  (kept from Repo Lens #G-42)

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");

const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const NOT_LISTED = "1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1", ODD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW2";

// What kit-blockat gives the module (a block every 3 s), and a ruler card where every listed producer signs its share.
const blockAt = async (ms: number) => 1000000 + Math.ceil((ms - at(0)) / 3000);
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const withG7 = {
  ...game,
  inputsFor: (w: any, ctx: any) => game.inputsFor(w, { ...ctx, vhp, blockAt }),
  resultOf: (r: any, rd: any, i: any, ctx: any) => game.resultOf(r, rd, i, { ...ctx, vhp, blockAt }),
  // G42-1's candidate fix (locksAt = day + 1, as the kit's own Fantasy-shaped fixture does), so this test shows G42-2 alone.
  roundsFor: (w: any, c: any) => game.roundsFor(w, c).map((r: any) => ({ ...r, locksAt: r.day + 1 })),
};
const cfg = {
  slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000,
  inputsFile: true, inputsLeadMs: 2 * DAY,
};

async function runWeek4(oddPick: { round: number; producers: string[] }) {
  const wd = world(at(4) - 2 * DAY + H);
  const d0 = at(4) / DAY;
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" }, [ODD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = {
    [`4:${d0}`]: [{ player: GOOD, pick: { producers: P.slice(0, 5), time: String(at(4) - 600000) } }],
  };
  const k = `4:${oddPick.round}`;
  (wd.picks[k] ??= []).push({ player: ODD, pick: { producers: oddPick.producers, time: String(oddPick.round * DAY - 600000) } });
  const rp = new Replay(withG7, cfg);
  const nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  await rp.hour(nodes(), wd.time + 5 * 60000);                          // Saturday before week 4: its price list
  assert.ok(rp.read("inputs/W4.json"), "week 4's price list was published");
  wd.time = at(5, 0, 2);
  const h = await rp.hour(nodes(), wd.time + 5 * 60000);                 // Monday after week 4: record it
  return h;
}

test("G42-2: a wallet whose only pick is invalid (a producer not on the list) doesn't stop the week", async () => {
  const h = await runWeek4({ round: at(4) / DAY, producers: [P[0], P[1], P[2], P[3], NOT_LISTED] });
  assert.equal(h.error, undefined, `the run stopped: ${h.error}`);
  assert.equal(h.result?.state, "pending");
});

test("G42-2: a wallet that picks only for Sunday's fun round (no team) doesn't stop the week", async () => {
  const h = await runWeek4({ round: at(4) / DAY + 6, producers: P.slice(0, 5) });
  assert.equal(h.error, undefined, `the run stopped: ${h.error}`);
  assert.equal(h.result?.state, "pending");
});

test("G42-2 unit: scoreRound scores every wallet that picked, 0 for one with no team (the kit's contract, types.ts l.78)", async () => {
  const pl = { start: at(4), pool: P.map((a) => ({ a, form: 10000, days: 7, price: 20 })), budget: 100 };
  const [mon] = game.roundsFor({ week: 4, start: at(4), end: at(5) }, { now: at(4) });
  const res = await withG7.resultOf(mon, {}, pl, {});
  const picks = [{ wallet: ODD, round: mon.id, pick: { producers: [P[0], NOT_LISTED] }, at: at(4) - 1 }];
  const s = game.scoreRound(mon, picks, res, pl, new Map());
  assert.deepEqual(s.get(ODD), { points: 0, at: 0 });
});
