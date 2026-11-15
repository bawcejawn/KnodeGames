// #G-42 G42-1 (High, NEEDS BLIND VERIFIER): Fantasy's rounds set locksAt = the day's 00:00 (recorder.ts l.95). The kit
// requires round.day === dayOf(locksAt) (runtime.ts l.389, KC-30), and dayOf(t) = floor((t − 1) / DAY) × DAY gives the
// DAY BEFORE for an instant exactly at 00:00 ("a round closing at exactly Sun 00:00 is Saturday's"). So once a week has
// a price list and has ended, every run throws "its day must be dayOf(locksAt) inside week w (KC-30)": no week file, no
// board, no vault file, every hour, every week; the vault pays game 4 nothing (Thursday backstop).
// Hidden today only because, without ctx.blockAt (G7), no price list is ever made, so runs stop earlier at "no-inputs".
// The kit's own Fantasy-shaped fixture on kit-blockat uses locksAt: day + 1.
//
// Run from the repo root of fantasy-kit @ 81a0343:
//   node --import tsx --test games/fantasy/tests/g42-1-locksat-kc30.test.ts  (kept from Repo Lens #G-42)
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { dayOf } = await imp("kit/publish/check.inline.mjs");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");

test("G42-1 unit: every Fantasy round's day is the kit's dayOf(locksAt) (KC-30)", () => {
  for (const r of game.roundsFor({ week: 4, start: at(4), end: at(5) }, { now: at(4) })) assert.equal(r.day, dayOf(r.locksAt), r.id);
});

const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const blockAt = async (ms: number) => 1000000 + Math.ceil((ms - at(0)) / 3000);          // what kit-blockat passes
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const withG7 = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp, blockAt }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp, blockAt }) };
const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY };

test("G42-1 end to end (kit + G7-shaped ctx): one ordinary week with one valid team records instead of stopping", async () => {
  const wd = world(at(4) - 2 * DAY + H);
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: P.slice(0, 5), time: String(at(4) - 600000) } }] };
  const rp = new Replay(withG7, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  await rp.hour(nodes(), wd.time + 5 * 60000);
  assert.ok(rp.read("inputs/W4.json"), "week 4's price list was published");
  wd.time = at(5, 0, 2);
  const h = await rp.hour(nodes(), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, `the run stopped: ${h.error}`);
  assert.equal(h.result?.state, "pending");
  const j = rp.read("W004.json");
  assert.equal(j.rounds.filter((r: any) => r[3] === "s").length, 7, "all 7 days decided");
});
