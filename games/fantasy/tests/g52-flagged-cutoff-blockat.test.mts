// Repo Lens #G-52 (fix-check of #G-42 on PR #266 @ 1f8110c): G42-5's owner rule end to end with the KIT's own
// ctx.blockAt (kit-blockat d6ac02b: both nodes, pinned to the lower last irreversible block, Disagree on heights).
// Run on a trial merge of origin/fantasy-kit (1f8110c) + origin/kit-blockat (d6ac02b), from its repo root:
//   REPO=$PWD TZ=UTC node --import tsx --test /home/claude/g1/tests-g52/g52-flagged-cutoff-blockat.test.mts
// Only the ruler is faked (cards with a per-day "flagged" switch); the block clock is the kit's.
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
// The module as shipped; only ctx.vhp is replaced. ctx.blockAt is whatever the kit passes.
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true };

const T0 = at(0) - 30 * DAY;                       // block h is at T0 + 3 s × h
const LAG = 60;                                    // last irreversible block: 60 blocks (3 min) behind the head
const libAt = (t: number) => Math.floor((t - T0) / 3000) - LAG;
async function setup() {
  flaggedRounds.clear();
  const wd = world(at(4) - 2 * DAY + H);
  wd.blockT0 = T0;
  const tick = (t: number, libB?: number) => { wd.time = t; wd.lib = libAt(t); wd.libB = libB; };
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: P.slice(0, 5), time: String(at(4) - 600000) } }] };
  // Node b can be given its own (lower) last irreversible block.
  const wB = () => ({ ...wd, lib: wd.libB ?? wd.lib });
  const rp = new Replay(m, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", wB)];
  tick(wd.time);
  const h0 = await rp.hour(nodes(), wd.time + 5 * 60000, { vhpLedger: { to: 0 } });
  assert.equal(h0.error, undefined, h0.error);
  assert.ok(rp.read("inputs/W4.json"), "week 4's price list was published (with the kit's blockAt)");
  return { wd, rp, nodes, tick };
}
const run = async (s: any, t: number, libB?: number) => { s.tick(t, libB); const h = await s.rp.hour(s.nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); return h; };
const wedOf = (j: any) => j.rounds.find((r: any) => r[1] === at(4, 2));

test("G52-a: flagged Wednesday: pending Monday, decided 0 after Tue 00:00 (kit blockAt), final Tuesday, vault file", async () => {
  const s = await setup();
  flaggedRounds.add(ymd(at(4, 2)));
  let h = await run(s, at(5, 0, 2));
  assert.equal(h.error, undefined, h.error);
  assert.equal(wedOf(s.rp.read("W004.json"))[3], "p");
  // 00:02 Tuesday: the last irreversible block (3 min behind) is still before 00:00 → still pending
  h = await run(s, at(5, 1) + 2 * 60000); assert.equal(h.error, undefined, h.error);
  assert.equal(wedOf(s.rp.read("W004.json"))[3], "p", "Tue 00:02: lib is before the cutoff");
  let finalAt = 0;
  for (let k = 1; k <= 6 && !finalAt; k++) {
    h = await run(s, at(5, 1, k)); assert.equal(h.error, undefined, h.error);
    if (h.result?.state === "final") finalAt = k;
  }
  const w = wedOf(s.rp.read("W004.json"));
  assert.equal(w[3], "s"); assert.ok(w[4].every((r: any) => r[1] === 0));
  assert.ok(finalAt > 0 && finalAt <= 4, `final by Tue 04:00 (at hour ${finalAt})`);
  assert.ok(s.rp.read("vault/W4.json"));
  console.log(`# final at Tue ${String(finalAt).padStart(2, "0")}:00 UTC; due Thu 00:00 → ${48 - finalAt} h left for the vault bot`);
});

test("G52-b: nodes on either side of the cutoff (b's lib before it): pinned to the lower lib, both wait, no Disagree", async () => {
  const s = await setup();
  flaggedRounds.add(ymd(at(4, 2)));
  await run(s, at(5, 0, 2));
  const h = await run(s, at(5, 1, 1), libAt(at(5, 1) - 60000));
  assert.equal(h.error, undefined, h.error);
  assert.equal(wedOf(s.rp.read("W004.json"))[3], "p");
  assert.ok(!h.result!.alerts.warnings.some((x: string) => /disagree|differ/i.test(x)), h.result!.alerts.warnings.join(" | "));
});

test("G52-c: card flips flagged → clean after the 0 was decided, week still pending: the run stops loudly (KC-8), no silent change", async () => {
  const s = await setup();
  flaggedRounds.add(ymd(at(4, 2)));
  await run(s, at(5, 0, 2));
  let h = await run(s, at(5, 1, 1)); assert.equal(h.error, undefined, h.error);
  assert.equal(wedOf(s.rp.read("W004.json"))[3], "s");
  assert.notEqual(h.result?.state, "final");
  flaggedRounds.clear();                             // the ruler data is rebuilt: Wednesday is clean now
  h = await run(s, at(5, 1, 2));
  assert.match(String(h.error), /was decided and now reads differently/);
  assert.equal(wedOf(s.rp.read("W004.json"))[4].every((r: any) => r[1] === 0), true, "published copy unchanged");
});

test("G52-d: card flips flagged → clean after the week is final: HOLD file, the published final is copied unchanged", async () => {
  const s = await setup();
  flaggedRounds.add(ymd(at(4, 2)));
  await run(s, at(5, 0, 2));
  let h: any;
  for (let k = 1; k <= 6; k++) { h = await run(s, at(5, 1, k)); if (h.result?.state === "final") break; }
  assert.equal(h.result?.state, "final");
  const before = JSON.stringify(s.rp.read("W004.json")), vf = JSON.stringify(s.rp.read("vault/W4.json"));
  flaggedRounds.clear();
  h = await run(s, at(5, 1, 8));
  assert.equal(h.error, undefined, h.error);
  assert.equal(JSON.stringify(s.rp.read("W004.json")), before);
  assert.equal(JSON.stringify(s.rp.read("vault/W4.json")), vf);
  assert.ok(s.rp.read("vault/HOLD-W4.json"), "a HOLD file is written for the owner");
});

test("G52-e: clean Wednesday decided, then flagged before the cutoff: the run stops loudly (KC-8)", async () => {
  const s = await setup();
  let h = await run(s, at(5, 0, 2)); assert.equal(h.error, undefined, h.error);
  assert.equal(wedOf(s.rp.read("W004.json"))[3], "s");
  flaggedRounds.add(ymd(at(4, 2)));
  h = await run(s, at(5, 0, 3));
  assert.match(String(h.error), /was decided and now reads differently/);
});

test("G52-f (Info): a form card flagged after the price list was published: loud error every run, the WHOLE week held to the backstop, no release", async () => {
  const s = await setup();
  flaggedRounds.add(ymd(at(4) - 4 * DAY));            // Thursday's form card, flagged after Saturday's list
  let h: any;
  for (const t of [at(5, 0, 2), at(5, 1, 2), at(5, 2, 2), at(5, 2, 23)]) {
    h = await run(s, t); assert.equal(h.error, undefined, h.error);
    assert.equal(h.result?.state, "pending");
    assert.ok(h.result!.alerts.errors.some((x: string) => /inputs recount differs/.test(x)), "error alert every run");
  }
  assert.ok(!s.rp.read("vault/W4.json"), "no vault file: the vault pays nothing for the week");
  assert.ok(!s.rp.read("vault/HOLD-W4.json"), "and no HOLD file the owner's RELEASE could clear (FC-9 recount holds have no release)");
});
