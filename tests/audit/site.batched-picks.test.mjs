// Capacity ask (13 Nov): "send my picks" (up to 10 in one transaction, rc_limit = measured burn + margin), the own-Mana
// check (selfPayMin) and the low-Mana notice. All three stay off until deployment.json "sponsor" carries their settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { utils } from "koilib";

const wallet = fs.readFileSync("wallet.js", "utf8");
const PLAYER = "1JEG83vHFKLwt3dnDqjuX9s5Zc56U4bQet", SPONSOR = "1AZsVFFrvKFhhxLq2jKHUUesdm2zbCcbXW";
const PICKS = "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm", GAME = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const PICK = 0x1; // any entry: the stub below treats ANSWER/PICK by the page's own constants
const s0 = wallet.indexOf("  async function sendKondor("), s1 = wallet.indexOf("  async function sendVault(");
assert.ok(s0 > 0 && s1 > s0);

function world({ sponsor = {}, own = 0n, wouldPay = "yes" } = {}) {
  const log = { built: [], sent: [], asked: 0, status: [] };
  class Transaction {
    constructor(c) { this.options = { ...(c.options || {}) }; this.transaction = { header: { payer: c.options?.payer, payee: c.options?.payee, rc_limit: c.options?.rcLimit }, operations: [] }; log.built.push({ payer: c.options?.payer, rcLimit: c.options?.rcLimit }); }
    async pushOperation(op) { this.transaction.operations.push(op); }
    async prepare() { this.transaction.id = "0x1220" + "ab".repeat(32); }
    async sign() { if (!this.transaction.id) await this.prepare(); return { ...this.transaction, signatures: ["sig"] }; }
    async send() { if (!this.transaction.id) await this.prepare(); log.sent.push(this.transaction.header.payer); return {}; }
  }
  const reply = wouldPay === "yes" ? new Uint8Array([0x08, 0x01]) : new Uint8Array([0x12, wouldPay.length, ...Buffer.from(wouldPay)]);
  const provider = { wait: async () => {}, getAccountRc: async () => String(own), readContract: async () => { log.asked++; return { result: utils.encodeBase64url(reply) }; } };
  const rcLimits = {};
  const sp = { address: SPONSOR, covers: [GAME], rcLimit: "100000000", rcLimits, ...sponsor };
  const ctx = {
    W: { kind: "kondor", address: PLAYER, provider, payer: "sponsor", sponsor: sp, status: (m) => log.status.push(m) },
    lib: { Transaction, utils }, window: { kondor: { getSigner: () => ({}) } }, JSON, Number, BigInt, Uint8Array, Promise, setTimeout, withTimeout: (p) => p,
    ANSWER: 1, PICK,
  };
  vm.createContext(ctx);
  vm.runInContext(wallet.slice(s0, s1) + "\nthis.sendKondor = sendKondor; this.sendBatch = sendBatch; this.rcFor = rcFor;", ctx);
  ctx.send = async (label, ops, opts) => ctx.sendKondor(label, ops, opts);
  const op = (contract, entry) => ({ call_contract: { contract_id: contract, entry_point: entry, args: "" } });
  return { log, ctx, sp, op };
}

test("selfPayMin off (v3 setting): a wallet with lots of Mana is still sponsored, as before", async () => {
  const w = world({ own: 9000000000n });
  await w.ctx.sendKondor("t", [w.op(GAME, 2)], {});
  assert.equal(w.log.asked, 1);
});

test("selfPayMin 25: 25 Mana or more pays for itself and the sponsor is not asked; under 25 it is asked", async () => {
  const rich = world({ sponsor: { selfPayMin: 25 }, own: 2500000000n });
  await rich.ctx.sendKondor("t", [rich.op(GAME, 2)], {});
  assert.equal(rich.log.asked, 0);
  assert.equal(rich.log.built.at(-1).payer, PLAYER);
  assert.ok(rich.log.status.some((m) => /your own Mana/.test(m)));
  const poor = world({ sponsor: { selfPayMin: 25 }, own: 2499999999n });
  await poor.ctx.sendKondor("t", [poor.op(GAME, 2)], {});
  assert.equal(poor.log.asked, 1);
  assert.equal(poor.log.built.at(-1).payer, SPONSOR);
});

test("selfPayMin is bounded 0 to 1000 and a failed Mana read means sponsored, never blocked", async () => {
  for (const bad of [0, -5, 5000, "x"]) { const w = world({ sponsor: { selfPayMin: bad }, own: 9000000000n }); await w.ctx.sendKondor("t", [w.op(GAME, 2)], {}); assert.equal(w.log.asked, 1, String(bad)); }
  const w = world({ sponsor: { selfPayMin: 25 } }); w.ctx.W.provider.getAccountRc = async () => { throw new Error("rpc"); };
  await w.ctx.sendKondor("t", [w.op(GAME, 2)], {}); assert.equal(w.log.asked, 1);
});

test("batch row: 2 to 10 operations ask for fixed + each op's perOp + margin (Mana), never more than the sum; one operation unchanged", () => {
  const K = `${PICKS}:00000007`;
  const row = { fixed: 0.43, perOp: { [K]: 0.45 }, margin: 0.5 };
  const w = world({ sponsor: { batch: row } });
  const pk = (n) => Array.from({ length: n }, () => w.op(PICKS, 7));
  w.sp.rcLimits[K] = "100000000";
  assert.equal(w.ctx.rcFor(w.sp, pk(1), "100000000"), "100000000");
  assert.equal(w.ctx.rcFor(w.sp, pk(10), "1000000000"), String(43000000 + 10 * 45000000 + 50000000));
  assert.equal(w.ctx.rcFor(w.sp, pk(2), "1000000000"), String(43000000 + 2 * 45000000 + 50000000));
  w.sp.rcLimits[K] = "10000000";   // the sum is smaller: the sum wins
  assert.equal(w.ctx.rcFor(w.sp, pk(10), "1000000000"), "100000000");
  const off = world(); off.sp.rcLimits[K] = "100000000";
  assert.equal(off.ctx.rcFor(off.sp, Array.from({ length: 10 }, () => off.op(PICKS, 7)), "1000000000"), "1000000000");
  for (const bad of [{ fixed: -1, perOp: { [K]: 0.45 }, margin: 1 }, { fixed: 1, perOp: { [K]: "x" }, margin: 1 }, { fixed: 1, perOp: {}, margin: 1 }, { fixed: 1, margin: 1 }]) {
    const j = world({ sponsor: { batch: bad } }); j.sp.rcLimits[K] = "100000000";
    assert.equal(j.ctx.rcFor(j.sp, Array.from({ length: 4 }, () => j.op(PICKS, 7)), "1000000000"), "400000000", JSON.stringify(bad));
  }
});

test("sendBatch: drops locked picks right before signing, sends at most 10, says so plainly when none is left", async () => {
  const w = world();
  const ops = Array.from({ length: 12 }, (_, i) => ({ ...w.op(GAME, 2), n: i }));
  await assert.rejects(w.ctx.sendBatch("t", ops), /at most 10/);
  const r = await w.ctx.sendBatch("t", ops, { stillOpen: (o) => o.n < 3 });
  assert.deepEqual([r.sent, r.dropped], [3, 9]);
  await assert.rejects(w.ctx.sendBatch("t", ops, { stillOpen: () => false }), /locked, so nothing was sent/);
  await assert.rejects(w.ctx.sendBatch("t", []), /nothing to send/);
});

test("a sponsor 'no' that says Mana is low shows the low-Mana notice, then the player's own Mana is used", async () => {
  const w = world({ wouldPay: "sponsor mana is low" });
  await w.ctx.sendKondor("t", [w.op(GAME, 2)], {});
  assert.ok(w.log.status.some((m) => /^Free Mana is low right now\. If a pick fails, try again later, or use your own Mana or Kondor's free Mana\.$/.test(m)));
  assert.equal(w.log.built.at(-1).payer, PLAYER);
  const other = world({ wouldPay: "today's sponsored mana is used up" });
  await other.ctx.sendKondor("t", [other.op(GAME, 2)], {});
  assert.ok(!other.log.status.some((m) => /low right now/.test(m)));
});
