// Repo Lens #G-78 (PR #313, kit-g69-1 @ 0f522dec): G69-1's three causes on FINAL and PENDING weeks, one node behind
// only, and the findings G78-1..G78-5. Same harness as kit/tests/g69-1.test.ts (the kit's example game as a ruler game).
// Run from the repo root of a checkout of 0f522dec:
//   REPO=$PWD TZ=UTC node --import tsx --test --test-concurrency=1 /home/claude/g1/tests-g78/g78-kit.test.mts
// Expected at 0f522dec: Q1-* pass (confirmations); G78-1, G78-2, G78-3, G78-4, G78-5 FAIL (findings).
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const REPO = process.env.REPO ?? process.cwd();
const imp = (p: string) => import(path.join(REPO, p));
const { R, timeline, FROM, PRE } = await imp("tests/audit/race-ruler.fixture.mjs");
const { NotYet } = await imp("kit/recorder/sources/vhp-ruler.ts");
const { PENDING } = await imp("kit/recorder/types.ts");
const { exampleGame, exampleCfg } = await imp("kit/testing/example/index.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");
const { checkGame, canon } = await imp("kit/publish/check.inline.mjs");

const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const S0 = FROM + PRE + 100;
const settings = (S: number, round: string) => ({
  game: 4, round, window: { W0: S - 7200, W1: S - 1, L: S - 1, S0: S, S1: S + 1199 },
  c: 500000, ownRule: "spot", paying: false, pooled: [VAULT], minK: 10, poolRule: "min",
});
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** The cause of "this run can't decide", switched on for one run. */
const cause = { cardNotYet: false, blockNotYet: false, oneBehind: false, plainPending: false };
const off = () => { for (const k of Object.keys(cause)) (cause as any)[k] = false; };
let cur: any = null;                       // the world, for the one-node-behind target
const seenVhp: any[] = [];
const n = (id: string) => Number(id.replace(/\D/g, "")) % 4;
const g = {
  ...exampleGame,
  slug: "kit-example",
  async resultOf(round: any, read: any, inputs: any, ctx: any) {
    seenVhp.push(ctx?.vhp);
    if (cause.blockNotYet) await ctx.blockAt(Date.now() + 365 * DAY);
    // a time between node b's last irreversible block (lib − 100) and node a's (lib): only b is behind
    if (cause.oneBehind) await ctx.blockAt(cur.blockT0 + (cur.lib - 50) * 3000);
    if (cause.cardNotYet) throw new NotYet("not yet: the vhp-data branch was rebuilt and doesn't reach this card");
    ctx.vhp.card(settings(S0 + n(round.id) * 1200, String(2026110100 + n(round.id))));
    if (cause.plainPending) return PENDING;
    return exampleGame.resultOf(round, read, inputs);
  },
};
const cfg = { ...exampleCfg(), vhpData: true, roundsCorrectable: false };

function qworld() {
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
  cur = wd;
  return wd;
}
// node b is 100 blocks (5 min) behind on its last irreversible block while cause.oneBehind is on
const nodes = (wd: any): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => (cause.oneBehind ? { ...wd, lib: wd.lib - 100 } : wd))];
const L0 = () => R.ledger(timeline());

async function toFinal(rp: any, wd: any, L: any) {
  let h;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += H; }
  assert.equal(h!.result?.state, "final", JSON.stringify(h!.result));
}
async function toPending(rp: any, wd: any, L: any) {
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(h.result?.state, "pending");
  const pub = rp.read("W004.json");
  assert.ok(pub.rounds.some((r: any) => r[3] !== "p"), "the published pending copy has decided rounds");
  wd.time += H;
  return pub;
}
const g69 = (h: any, level: "errors" | "warnings") => h.result!.alerts[level].some((x: string) => /G69-1/.test(x));
const keptPending = (rp: any, h: any, pub: any) => {
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "pending");
  const j = rp.read("W004.json");
  for (const r of pub.rounds.filter((x: any) => x[3] !== "p")) assert.deepEqual(j.rounds.find((x: any) => x[0] === r[0]), r, `round ${r[0]} kept`);
  assert.ok(j.cards.length >= pub.cards.length, "cards kept");
  assert.ok(g69(h, "errors") || g69(h, "warnings"), JSON.stringify(h.result!.alerts));
};

// ── Q1: the three causes close, on a final and a pending week, and for one node behind only ──────────────────────

test("Q1-a: FINAL week, one node behind only (blockAt NotYet via the pin): no HOLD, final copy unchanged", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
  await toFinal(rp, wd, L);
  const before = rp.raw("W004.json");
  cause.oneBehind = true;
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); off();
  assert.equal(h.error, undefined, h.error);
  assert.equal(rp.read("vault/HOLD-W4.json"), null, JSON.stringify(h.result?.alerts));
  assert.equal(rp.raw("W004.json"), before);
  assert.ok(h.result!.alerts.warnings.some((x: string) => /couldn't re-read every round/.test(x)));
});

for (const [name, k] of [["card() NotYet (rebuilt/truncated branch)", "cardNotYet"], ["blockAt NotYet (both nodes behind)", "blockNotYet"], ["one node behind only", "oneBehind"]] as const) {
  test(`Q1-b: PENDING week, ${name}: no KC-8 stop, decided rounds and cards kept, stays pending; then recovers to final`, async () => {
    off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
    const pub = await toPending(rp, wd, L);
    (cause as any)[k] = true;
    let h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); off();
    keptPending(rp, h, pub);
    let fin = false;
    for (let i = 0; i < 4 && !fin; i++) { wd.time += H; h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); fin = h.result?.state === "final"; }
    assert.ok(fin, `goes final once the cause clears: ${JSON.stringify(h.result?.alerts)}`);
  });
}

test("Q1-c: PENDING week, no ruler data this run: kept, pending, warnings only (no email)", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
  const pub = await toPending(rp, wd, L);
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  keptPending(rp, h, pub);
  assert.equal(h.result!.alerts.errors.length, 0, JSON.stringify(h.result!.alerts.errors));
});

// ── Findings ───────────────────────────────────────────────────────────────────────────────────────────────────────

test("G78-1 (Medium): ruler data missing from the 2nd run until 24 h before the deadline: an owner (error) alert must fire before then", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
  await toPending(rp, wd, L);
  const due = at(5, 3);                                   // Thu 00:00 UTC after the week
  let errs: string[] = [], runs = 0, h: any;
  while (wd.time < due - 24 * H) {
    h = await rp.hour(nodes(wd), wd.time + 5 * 60000);   // a failed vhp-data fetch every run
    assert.equal(h.error, undefined, h.error);
    assert.equal(h.result?.state, "pending");
    errs = errs.concat(h.result!.alerts.errors); runs++; wd.time += H;
  }
  // At 0f522dec: ~45 runs, only ::warning:: lines (no email); the first error is the backstop itself at Thu 00:00.
  assert.ok(errs.length > 0, `${runs} runs kept the published rounds with warnings only; the owner hears nothing until the backstop`);
});

test("G78-2 (Low): FINAL week, all data loaded, both nodes healthy, a decided round now reads plainly PENDING (not NotYet): HOLD as before", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
  await toFinal(rp, wd, L);
  cause.plainPending = true;
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); off();
  assert.equal(h.error, undefined, h.error);
  // At 0f522dec: an error alert, but no HOLD; HOLD_WEEKS can't hold a final week (KC-20), so nothing stops the vault bot.
  assert.ok(rp.read("vault/HOLD-W4.json"), `no HOLD: ${JSON.stringify(h.result?.alerts.errors)}`);
});

test("G78-3 (Info): PENDING week, one node's last irreversible block a few minutes behind: a warning, not an emailed 'with all its data: check it' error", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
  await toPending(rp, wd, L);
  cause.oneBehind = true;
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); off();
  assert.equal(h.error, undefined, h.error);
  assert.ok(!g69(h, "errors"), `a lagging node emails the owner: ${JSON.stringify(h.result!.alerts.errors)}`);
});

test("G78-4 (Low): a published vhpTo beyond the chain's head (a bad run) freezes the week as 'stale' with warnings only; it must be an error", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg), L = L0();
  const pub = await toPending(rp, wd, L);
  // The publish check takes any vhpTo that goes forward: a copy with vhpTo = 10^12 (outside the hash) is not held.
  const fs = await import("node:fs"), os = await import("node:os");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "g78-4-")), inn = path.join(d, "in"), out = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(out);
  fs.writeFileSync(path.join(out, "W004.json"), canon(pub));
  fs.writeFileSync(path.join(inn, "W004.json"), canon({ ...pub, vhpTo: 1e12 }));
  const r = checkGame(cfg, inn, out, wd.time + 5 * 60000, "", null);
  assert.ok(!r.held.some((x: any) => /vhpTo/.test(x.why)), "confirmation: the publish check accepts it");
  // Suppose it was published: every later honest run is "stale", re-reads nothing, never goes final.
  fs.writeFileSync(path.join(rp.pub, "W004.json"), canon({ ...pub, vhpTo: 1e12 }));
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(h.result?.state, "pending");
  assert.ok(h.result!.alerts.errors.some((x: string) => /vhpTo|ruler data/.test(x)), `warnings only: ${JSON.stringify(h.result!.alerts.warnings.filter((x: string) => /stale/.test(x)))}`);
});

test("G78-5 (Info, #G-73 G73-1): the kit's no-data stand-in says so with an explicit flag, not only the private `to: -1`", async () => {
  off(); const wd = qworld(), rp = new Replay(g, cfg);
  seenVhp.length = 0;
  await rp.hour(nodes(wd), wd.time + 5 * 60000);          // no ruler data this run
  const stub = seenVhp.find((v) => v);
  assert.ok(stub, "resultOf got a ctx.vhp");
  assert.equal(stub.loaded, false, `the stand-in is ${JSON.stringify(stub)}: games must infer "not loaded" from to < 0`);
});
