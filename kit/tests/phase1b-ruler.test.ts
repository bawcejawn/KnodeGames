// Kit Phase 1b: the VHP ruler's data as a kit source (G1/G2). Cards are made from the Race's made-up chain
// (tests/audit/race-ruler.fixture.mjs: 15 days of history, then 9 days), exactly as bot/race-ruler.ts makes them.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { R, timeline, FROM, PRE } from "../../tests/audit/race-ruler.fixture.mjs";
import { vhpFor, cardList, NotYet, DELAY, type CardSettings } from "../recorder/sources/vhp-ruler.ts";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import { checkGame, canon, isCardList } from "../publish/check.inline.mjs";
import type { GameModule } from "../recorder/types.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const S0 = FROM + PRE + 100;
const settings = (S: number, round = "2026110100"): CardSettings => {
  const L = S - 1;
  return { game: 4, round, window: { W0: L - 7199, W1: L, L, S0: S, S1: S + 7199 }, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [VAULT] };
};
const ledger = () => R.ledger(timeline());

test("vhp-ruler source: a card is the ruler's own (makeCard + scoreCard + cardJson), listed once by sha256", () => {
  const L = ledger(), used = new Map();
  const v = vhpFor(L, used);
  const a = v.card(settings(S0)), b = v.card(settings(S0));
  assert.deepEqual(a, b);
  const s = settings(S0);
  const want = R.cardJson(R.scoreCard(L, R.makeCard(L, { ...s, c: BigInt(s.c) })));
  assert.deepEqual(a, JSON.parse(want));
  const list = cardList(used);
  assert.equal(list.length, 1);
  assert.equal(list[0][1], createHash("sha256").update(want).digest("hex"));
  assert.ok(isCardList(list), "the publish check accepts the list's shape");
  assert.equal(v.card(settings(S0 + 28800, "2026110200")).round, "2026110200");
  assert.deepEqual(cardList(used).map((x) => x[0].round), ["2026110100", "2026110200"], "sorted by round");
});

test("vhp-ruler source: a card past the data (plus the ruler's delay) is NotYet, never a guess", () => {
  const L = ledger(), v = vhpFor(L, new Map());
  assert.throws(() => v.card(settings(L.to - 7199 - DELAY + 1)), NotYet);
});

test("publish check: card lists must be sorted, unique, and well-formed", () => {
  const L = ledger(), used = new Map(), v = vhpFor(L, used);
  v.card(settings(S0)); v.card(settings(S0 + 28800, "2026110200"));
  const ok = cardList(used);
  assert.ok(isCardList(ok));
  assert.ok(!isCardList([ok[1], ok[0]]), "out of order");
  assert.ok(!isCardList([ok[0], ok[0]]), "twice");
  assert.ok(!isCardList([[{ ...ok[0][0], extra: 1 }, ok[0][1]]]), "an unknown setting");
  assert.ok(!isCardList([[ok[0][0], "nothex"]]), "not a sha256");
});

// A vhpData game on the kit: the example game, whose every result also needs one ruler card (its round's window).
const vgame: GameModule<any, any, any> = {
  ...exampleGame,
  slug: "kit-example",
  async resultOf(round, read, inputs, ctx) {
    ctx!.vhp!.card(settings(S0 + (Number(round.id.replace(/\D/g, "")) % 4) * 1200, String(2026110100 + (Number(round.id.replace(/\D/g, "")) % 4))));
    return exampleGame.resultOf(round, read, inputs);
  },
};
const vcfg = { ...exampleCfg(), vhpData: true };
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
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
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];

test("Phase 1b: a ruler game's week file lists every card its results used, and goes final", async () => {
  const wd = qworld(), rp = new Replay(vgame, vcfg), L = ledger();
  let h;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(h!.result?.state, "final", JSON.stringify(h));
  const j = rp.read("W004.json");
  assert.equal(j.cards.length, 4);
  assert.ok(isCardList(j.cards));
});

test("Phase 1b: with no ruler data this run, rounds stay pending (a warning), and nothing is guessed", async () => {
  const wd = qworld(), rp = new Replay(vgame, vcfg);
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(h.result?.state, "pending");
  assert.ok(h.result!.alerts.warnings.some((w) => /ruler's data couldn't be loaded/.test(w)));
  const j = rp.read("W004.json");
  assert.ok(j.rounds.every((r: any) => r[3] === "p"), "every round pending");
  assert.deepEqual(j.cards, []);
});

test("Phase 1b publish check: a ruler game's week file without cards, or another game's with cards, is held", async () => {
  const wd = qworld(), rp = new Replay(vgame, vcfg), L = ledger();
  await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "p1b-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(pub);
  const j = rp.read("W004.json");
  const { cards, ...noCards } = j;
  fs.writeFileSync(path.join(inn, "W004.json"), canon(noCards));
  assert.ok(checkGame(vcfg, inn, pub, wd.time).held.some((x: any) => /must list its cards/.test(x.why)));
  fs.writeFileSync(path.join(inn, "W004.json"), canon(j));
  assert.ok(checkGame(exampleCfg(), inn, pub, wd.time).held.some((x: any) => /cards in a game without ruler data/.test(x.why)));
  void cards;
});

test("G3 publish check: a ruler game's new week file is held unless every card was rebuilt in the publish job", async () => {
  const L = ledger();
  const none = new Replay(vgame, vcfg), wd = qworld();
  const h1 = await none.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L, cardsOk: null });
  assert.ok(h1.held.some((x: any) => x.name === "W004.json" && /couldn't be rebuilt/.test(x.why)), JSON.stringify(h1.held));
  const wrong = new Replay(vgame, vcfg), w2 = qworld();
  const h2 = await wrong.hour(nodes(w2), w2.time + 5 * 60000, { vhpLedger: L, cardsOk: new Set(["0".repeat(64)]) });
  assert.ok(h2.held.some((x: any) => x.name === "W004.json" && /4 of its 4 ruler cards/.test(x.why)), JSON.stringify(h2.held));
  const right = new Replay(vgame, vcfg), w3 = qworld();
  const h3 = await right.hour(nodes(w3), w3.time + 5 * 60000, { vhpLedger: L });
  assert.ok(h3.published.includes("W004.json"), JSON.stringify(h3.held));
});
