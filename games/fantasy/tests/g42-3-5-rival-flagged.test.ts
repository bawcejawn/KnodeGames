// #G-42 G42-3 (Low), G42-4 (Low), G42-5 (Medium, NEEDS BLIND VERIFIER). Run from the repo root of fantasy-kit @ 81a0343:
//   node --import tsx --test games/fantasy/tests/g42-3-5-rival-flagged.test.ts  (kept from Repo Lens #G-42)
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { MAX_EXTRAS_BYTES } = await imp("kit/publish/check.inline.mjs");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");

// ── G42-3: Weekly Rival is unbounded; past 256 KB the kit stops the whole run (runtime.ts l.433), vault file included ──
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i: number) => { let s = ""; for (let k = 0; k < 4; k++) { s = B58[i % 58] + s; i = Math.floor(i / 58); } return "1" + s.padStart(33, "Z"); };
test("G42-3: Weekly Rival's records stay under the kit's 256 KB extras cap however many staked players challenge", () => {
  const n = 4000, ws = Array.from({ length: n }, (_, i) => addr(i));
  const picks = new Map([[5, new Map([[at(4) / DAY, ws.map((w, i) => ({ wallet: w, round: "r", pick: { producers: [ws[(i + 1) % n]] }, at: 0 }))]])]]);
  const x = game.weekExtras({ week: 4, start: at(4), end: at(5) }, { points: new Map(ws.map((w, i) => [w, 1000 + i])), picks, staked: new Set(ws) });
  assert.ok(Buffer.byteLength(JSON.stringify(x)) <= MAX_EXTRAS_BYTES, `${Buffer.byteLength(JSON.stringify(x))} bytes`);
});

// ── shared harness (a G7-shaped ctx, and G42-1's locksAt fix so the rounds are read) ──
const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const blockAt = async (ms: number) => 1000000 + Math.ceil((ms - at(0)) / 3000);
const flaggedRounds = new Set<string>();
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: flaggedRounds.has(s.round) ? "flagged" : "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp, blockAt }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp, blockAt }),
  roundsFor: (w: any, c: any) => game.roundsFor(w, c).map((r: any) => ({ ...r, locksAt: r.day + 1 })) };
const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY };
// vhpData on (as game.json has it), so the kit knows the ruler's NotYet; the module's own fake ruler is used either way.
const cfgV = { ...cfg, vhpData: true };
async function setup(c: any = cfg) {
  flaggedRounds.clear();
  const wd = world(at(4) - 2 * DAY + H);
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: P.slice(0, 5), time: String(at(4) - 600000) } }] };
  const rp = new Replay(m, c), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  await rp.hour(nodes(), wd.time + 5 * 60000, { vhpLedger: { to: 0 } });
  assert.ok(rp.read("inputs/W4.json"), "week 4's price list was published");
  return { wd, rp, nodes };
}
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");

// ── G42-4: a form card flagged by the recount (an hour rebuilt after Saturday) throws a plain Error: the kit rethrows it
// (runtime.ts l.308), so the whole run stops every hour instead of holding the week with an alert ──
test("G42-4: a form card that turns flagged before the recount holds the week (pending, alert), it doesn't stop the run", async () => {
  const { wd, rp, nodes } = await setup(cfgV);
  flaggedRounds.add(ymd(at(4) - 4 * DAY));                    // Thursday's form card, flagged after the list was made
  wd.time = at(5, 0, 2);
  const h = await rp.hour(nodes(), wd.time + 5 * 60000, { vhpLedger: { to: 0 } });
  assert.equal(h.error, undefined, `the run stopped: ${h.error}`);
  assert.equal(h.result?.state, "pending");
});

// ── G42-5, owner's rule (12 Nov): a still-flagged play day waits until Tuesday 00:00 UTC after the week (read from the
// chain: blockAt is NotYet until then), then counts as 0 for every team, so the week still goes final before the vault's
// Thursday backstop. (Repo Lens offered "a HOLD file" or "document the loss"; the owner chose this instead.) ──
const { NotYet } = await imp("kit/recorder/sources/vhp-ruler.ts");
test("G42-5: a flagged play day waits for the cutoff, then scores 0 for everyone; the week goes final before Thursday", async () => {
  const { wd, rp, nodes } = await setup(cfgV);
  // The chain clock: a time past this run's chain time isn't irreversible yet (what kit-blockat does).
  m.resultOf = (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp, blockAt: async (ms: number) => { if (ms > wd.time) throw new NotYet("not yet"); return blockAt(ms); } });
  flaggedRounds.add(ymd(at(4, 2)));                            // Wednesday's day card is flagged, and stays flagged
  wd.time = at(5, 0, 2);
  let h = await rp.hour(nodes(), wd.time + 5 * 60000, { vhpLedger: { to: 0 } });
  assert.equal(h.error, undefined, h.error);
  let j = rp.read("W004.json");
  const wed = j.rounds.find((r: any) => r[1] === at(4, 2));
  assert.equal(wed[3], "p", "Monday after the week: Wednesday still waits");
  assert.equal(j.rounds.filter((r: any) => r[3] === "s").length, 6, "the other six days are decided");
  for (const t of [at(5, 1, 1), at(5, 1, 4)]) { wd.time = t; h = await rp.hour(nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); assert.equal(h.error, undefined, h.error); }
  j = rp.read("W004.json");
  const wed2 = j.rounds.find((r: any) => r[1] === at(4, 2));
  assert.equal(wed2[3], "s", "after Tuesday 00:00 UTC the flagged day is decided");
  assert.ok(wed2[4].every((row: any) => row[1] === 0), "and scores 0 for every team");
  assert.equal(h.result?.state, "final", `the week is final by Tuesday (state ${h.result?.state})`);
  assert.ok(rp.read("vault/W4.json"), "and its vault file is written");
});
