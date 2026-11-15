// K8, ctx.fallback (the owner's rule, 13 Nov: after the 48 h grace a game with no ruler card falls back to its own
// simplest fixed rule, recorded and alerted), with #G-69 G69-2: offered only when the ruler's data loaded this run; a
// fallback decision stays fixed once published; a round the published copy decided with its card is never re-decided.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, timeline, FROM, PRE } from "../../tests/audit/race-ruler.fixture.mjs";
import type { CardSettings } from "../recorder/sources/vhp-ruler.ts";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import { FALLBACK_GRACE_MS, type GameModule } from "../recorder/types.ts";
import { checkGame, canon, cardKey, weekHash } from "../publish/check.inline.mjs";

const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const S0 = FROM + PRE + 100;
const settings = (S: number, round: string): CardSettings => ({
  game: 4, round, window: { W0: S - 7200, W1: S - 1, L: S - 1, S0: S, S1: S + 1199 },
  c: 500000, ownRule: "spot", paying: false, pooled: [VAULT], minK: 10, poolRule: "min",
});
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const n = (id: string) => Number(id.replace(/\D/g, "")) % 4;

/** Which rounds have no ruler card (the game then asks the kit's fallback), and whether a card exists again later. */
const noCard = new Set<number>();
const g: GameModule<any, any, any> = {
  ...exampleGame,
  slug: "kit-example",
  async resultOf(round, read, inputs, ctx) {
    if (noCard.has(n(round.id))) { await ctx!.fallback!("no ruler card for this round"); return exampleGame.resultOf(round, read, inputs); }
    ctx!.vhp!.card(settings(S0 + n(round.id) * 1200, String(2026110100 + n(round.id))));
    return exampleGame.resultOf(round, read, inputs);
  },
};
const cfg = { ...exampleCfg(), vhpData: true };

function qworld(): World {
  const s4 = at(4), wd = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };
  for (let i = 0; i < 4; i++) wd.questions[201 + i] = { week: "4", outcome: 1 + (i % 2), lock_time: String(s4 + (i + 1) * DAY / 2) };
  wd.next = 205;
  const ans = (o: number[]) => o.map((x, i) => ({ question_id: 201 + i, option: x }));
  wd.players = [
    { address: A, entry: { stake: "500000000", peak_stake: "500000000", voided: false, answers: ans([0, 1, 0, 1]) } },
    { address: B, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([0, 1, 1]) } },
  ];
  wd.lib = 400_000; wd.blockT0 = at(5, 0, 2) - 400_000 * 3000;
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const fresh = () => { noCard.clear(); return { wd: qworld(), rp: new Replay(g, cfg), L: R.ledger(timeline()) }; };
const roundOf = (j: any, k: number) => j.rounds.find((r: any) => n(r[0]) === k);

test("K8: with the ruler's data loaded, a round with no card is decided by the game's fallback, recorded, alerted, and needs no card", async () => {
  const { wd, rp, L } = fresh();
  noCard.add(2);
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(h.error, undefined, h.error);
  const j = rp.read("W004.json");
  const r2 = roundOf(j, 2);
  assert.equal(r2[3], "s", "decided");
  assert.equal(j.fallbacks.length, 1);
  assert.equal(j.fallbacks[0][0], r2[0]);
  assert.equal(j.fallbacks[0][2], "no ruler card for this round");
  assert.ok(j.fallbacks[0][1] >= j.start + FALLBACK_GRACE_MS);
  assert.equal(j.cards.length, 3, "three cards for the three other rounds (cardPerRound counts the fallback apart)");
  assert.ok(h.result!.alerts.errors.some((x: string) => /fallback rule/.test(x)), JSON.stringify(h.result!.alerts.errors));
  // the week goes final through the publish check like any other, and the alert isn't repeated once published
  wd.time += H;
  const h2 = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.ok(!h2.result!.alerts.errors.some((x: string) => /fallback rule/.test(x)));
  assert.deepEqual(rp.read("W004.json").fallbacks, j.fallbacks);
});

test("K8 / G69-2: no fallback without the ruler's data this run, and none before the 48 h grace on the chain", async () => {
  {
    const { wd, rp } = fresh();
    noCard.add(2);
    await rp.hour(nodes(wd), wd.time + 5 * 60000);                 // no ruler data loaded
    const j = rp.read("W004.json");
    assert.equal(roundOf(j, 2)[3], "p", "stays pending");
    assert.equal(j.fallbacks, undefined);
  }
  {
    const { wd, rp, L } = fresh();
    noCard.add(3);
    // the chain's last irreversible block is before round 3's end + 48 h
    wd.blockT0 = at(4) + 2 * DAY - 400_000 * 3000;
    await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
    const j = rp.read("W004.json");
    assert.equal(roundOf(j, 3)[3], "p", "waits for the grace");
    assert.equal(j.fallbacks, undefined);
  }
});

test("G69-2: a fallback decision stays fixed once published, even when a card turns up later", async () => {
  const { wd, rp, L } = fresh();
  noCard.add(2);
  await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  const pub = rp.read("W004.json");
  noCard.clear();                                                     // now the game would make a card
  wd.players[0].entry.answers[2].option = 1;                          // and would score the round differently
  wd.time += H;
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(h.error, undefined, h.error);
  const j = rp.read("W004.json");
  assert.deepEqual(roundOf(j, 2), roundOf(pub, 2), "the fallback round is exactly as published");
  assert.deepEqual(j.fallbacks, pub.fallbacks);
});

test("G69-2: a round the published copy decided with its card is never re-decided by the fallback", async () => {
  const { wd, rp, L } = fresh();
  await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  const pub = rp.read("W004.json");
  noCard.add(1);                                                      // the card is gone this run
  wd.time += H;
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(h.error, undefined, h.error);
  const j = rp.read("W004.json");
  assert.deepEqual(roundOf(j, 1), roundOf(pub, 1), "kept as published (G69-1)");
  assert.equal(j.fallbacks, undefined, "no fallback recorded");
});

test("K8 publish check: a fallback before its grace, a changed or dropped published fallback, or fallbacks without ruler data, are held", async () => {
  const { wd, rp, L } = fresh();
  noCard.add(2);
  await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  const pub = rp.read("W004.json");
  const ok = new Set(pub.cards.map(([s, h]: any) => cardKey(s, h)));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-fb-"));
  const run = (inFile0: any, pubFile: any, now: number, c: any = cfg) => {
    const inFile = { ...inFile0, seen: { hash: weekHash(inFile0), at: now - 60000 } };
    const inn = fs.mkdtempSync(path.join(d, "in-")), out = fs.mkdtempSync(path.join(d, "pub-"));
    fs.writeFileSync(path.join(inn, "W004.json"), canon(inFile));
    if (pubFile) fs.writeFileSync(path.join(out, "W004.json"), canon(pubFile));
    return checkGame(c, inn, out, now, "", ok).held.map((x: any) => x.why).join(" | ");
  };
  const now = wd.time + 5 * 60000;
  assert.match(run({ ...pub, fallbacks: [[pub.fallbacks[0][0], now + H, "x"]] }, null, now), /before its 48 h grace/);
  assert.match(run({ ...pub, fallbacks: [[pub.fallbacks[0][0], pub.fallbacks[0][1], "other"]] }, pub, now), /changes or drops a published fallback/);
  const { fallbacks, ...noFb } = pub; void fallbacks;
  assert.match(run(noFb, pub, now), /changes or drops a published fallback|ruler cards \(cardPerRound\)/);
  assert.match(run({ ...pub, fallbacks: [[roundOf(pub, 2)[0], pub.start + 1, "x"]] }, null, now), /bad fallbacks/);
  const { cards, vhpTo, ...plain } = pub; void cards; void vhpTo;
  assert.match(run(plain, null, now, exampleCfg()), /fallbacks in a game without ruler data/);
});
