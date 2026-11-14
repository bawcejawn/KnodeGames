// Repo Lens #G-69 G69-1: a round the published copy decided but this run can't decide is a read that didn't finish,
// never a change. Whatever the cause (no ruler data this run, a card "not yet" on a rebuilt or truncated vhp-data
// branch, a blockAt "not yet" while one node's last irreversible block is behind), a final week gets no HOLD and a
// pending week neither stops the run (KC-8) nor loses the round: it keeps its published result and stays pending.
import test from "node:test";
import assert from "node:assert/strict";
import { R, timeline, FROM, PRE } from "../../tests/audit/race-ruler.fixture.mjs";
import { NotYet, type CardSettings } from "../recorder/sources/vhp-ruler.ts";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import type { GameModule } from "../recorder/types.ts";

const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const S0 = FROM + PRE + 100;
const settings = (S: number, round: string): CardSettings => ({
  game: 4, round, window: { W0: S - 7200, W1: S - 1, L: S - 1, S0: S, S1: S + 1199 },
  c: 500000, ownRule: "spot", paying: false, pooled: [VAULT], minK: 10, poolRule: "min",
});
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** Switches for the runs after the week is published: the cause of "this run can't decide". */
const cause = { cardNotYet: false, blockNotYet: false };
const n = (id: string) => Number(id.replace(/\D/g, "")) % 4;
const g: GameModule<any, any, any> = {
  ...exampleGame,
  slug: "kit-example",
  async resultOf(round, read, inputs, ctx) {
    if (cause.blockNotYet) await ctx!.blockAt!(Date.now() + 365 * DAY);       // past both nodes' last irreversible block
    if (cause.cardNotYet) throw new NotYet("not yet: the vhp-data branch was rebuilt and doesn't reach this card");
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

/** A week of the ruler game recorded to final, then one more hour under `run`. */
async function finalThen(run: { vhpLedger?: any }) {
  cause.cardNotYet = cause.blockNotYet = false;
  const wd = qworld(), rp = new Replay(g, cfg), L = R.ledger(timeline());
  let h;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(h!.result?.state, "final", JSON.stringify(h!.result));
  const before = rp.raw("W004.json");
  h = await rp.hour(nodes(wd), wd.time + 5 * 60000, run);
  cause.cardNotYet = cause.blockNotYet = false;
  return { rp, h, before, L, wd };
}
const noHold = (rp: Replay, h: any, before: string | null) => {
  assert.equal(rp.read("vault/HOLD-W4.json"), null, `no HOLD on a correct final week: ${JSON.stringify(h.result?.alerts)}`);
  assert.ok(!h.result!.alerts.errors.some((x: string) => /changed on chain/.test(x)), JSON.stringify(h.result!.alerts.errors));
  assert.ok(h.result!.alerts.warnings.some((x: string) => /G69-1/.test(x)), JSON.stringify(h.result!.alerts.warnings));
  assert.equal(rp.raw("W004.json"), before, "the final copy is unchanged");
  assert.equal(h.result?.state, "final");
};

test("G69-1: a final week whose re-read has no ruler data this run (a failed fetch) is not held", async () => {
  const { rp, h, before } = await finalThen({});
  noHold(rp, h, before);
});

test("G69-1: a final week whose re-read gets a card 'not yet' (a rebuilt or truncated vhp-data branch) is not held", async () => {
  cause.cardNotYet = true;
  const L = R.ledger(timeline());
  const wd = qworld(), rp = new Replay(g, cfg);
  cause.cardNotYet = false;
  let h;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(h!.result?.state, "final");
  const before = rp.raw("W004.json");
  cause.cardNotYet = true;
  h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  cause.cardNotYet = false;
  noHold(rp, h, before);
});

test("G69-1: a final week whose re-read gets blockAt 'not yet' (a node's last irreversible block behind) is not held", async () => {
  const L = R.ledger(timeline());
  const wd = qworld(), rp = new Replay(g, cfg);
  let h;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(h!.result?.state, "final");
  const before = rp.raw("W004.json");
  cause.blockNotYet = true;
  h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  cause.blockNotYet = false;
  noHold(rp, h, before);
});

test("G69-1 control: a final week that really changed on chain is still held", async () => {
  const L = R.ledger(timeline());
  const wd = qworld(), rp = new Replay(g, cfg);
  for (let i = 0; i < 4; i++) { await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(rp.read("W004.json").state, "final");
  wd.players[0].entry.answers[1].option = 0;
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.ok(rp.read("vault/HOLD-W4.json"), JSON.stringify(h.result?.alerts));
});

test("G69-1: a pending week whose published copy decided a round keeps it (no KC-8 stop) and stays pending", async () => {
  cause.cardNotYet = cause.blockNotYet = false;
  const L = R.ledger(timeline());
  const wd = qworld(), rp = new Replay(g, cfg);
  let h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(h.result?.state, "pending");
  const pub = rp.read("W004.json");
  const decided = pub.rounds.filter((r: any) => r[3] !== "p").map((r: any) => r[0]);
  assert.ok(decided.length > 0, "the published pending copy has decided rounds");
  wd.time += H;
  h = await rp.hour(nodes(wd), wd.time + 5 * 60000);           // no ruler data this run
  assert.ok(h.result, "the run finishes (no KC-8 stop)");
  assert.equal(h.result!.state, "pending");
  const j = rp.read("W004.json");
  for (const id of decided) {
    const a = pub.rounds.find((r: any) => r[0] === id), b = j.rounds.find((r: any) => r[0] === id);
    assert.deepEqual(b, a, `round ${id} keeps its published result`);
  }
  assert.ok(j.cards.length >= decided.length, "its cards are kept with it (cardPerRound)");
  assert.ok(h.result!.alerts.warnings.some((x: string) => /G69-1/.test(x)));
  // and the next run with data goes on normally
  wd.time += H;
  h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.ok(["pending", "final"].includes(h.result!.state!));
});

test("G69-1: in a game whose decided rounds can't change, a round read as pending for any reason keeps its published result", async () => {
  const { PENDING } = await import("../recorder/types.ts");
  let undecided = false;
  const pend: GameModule<any, any, any> = { ...g, async resultOf(r, read, inputs, ctx) { if (undecided) return PENDING; return g.resultOf(r, read, inputs, ctx); } };
  const fixed = { ...cfg, roundsCorrectable: false };
  const L = R.ledger(timeline());
  const wd = qworld(), rp = new Replay(pend, fixed);
  let h;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(h!.result?.state, "final");
  const before = rp.raw("W004.json");
  undecided = true;
  h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  noHold(rp, h, before);
});
