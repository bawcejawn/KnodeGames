// The VHP ruler's recorder (bot/vhp-ruler.ts) and first fill (bot/vhp-fill.ts), driven by simulated nodes: steps (c)
// and (d) of R-RULER-1. Nothing here talks to a chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Serializer, utils } from "koilib";
import { R, D, makeChain, FakeNode } from "./vhp-ruler.fixture.mjs";
import { recordHours, blockRecord, rollup } from "../../bot/vhp-ruler.ts";
import { fillHours, fillChunks } from "../../bot/vhp-fill.ts";

const quiet = () => {};
const opts = { waitMs: 50, pollMs: 1, log: quiet, rounds: 3 };
// a 40-hour chain; the published data stops at hour 30 (written by the fixture), the nodes' heads are near the end
const c = makeChain({ seed: 17, hours: 40, np: 5, busy: 0.02, write: 31 });
const H = 1200, at = (n) => (n + 1) * H - 1;

test("recordHours: the next irreversible hours, read on both nodes, chain onto the published one and check", async () => {
  const head = at(c.n0 + 33) + 70;   // irreversible = head − 60: hours 31, 32, 33 are done
  const A = new FakeNode(c.raw, { name: "A", head }), B = new FakeNode(c.raw, { name: "B", head: head + 3 });
  const texts = await recordHours(A, B, c.texts[30], opts);
  assert.equal(texts.length, 3);
  let prev = c.texts[30];
  for (const t of texts) { const r = D.checkHour(prev, t); assert.equal(r.ok, true, r.why); assert.equal(r.quality, "ok"); assert.equal(r.effAt, "next"); prev = t; }
  const h0 = JSON.parse(texts[0]);
  assert.equal(h0.n, c.n0 + 31);
  assert.equal(h0.anchor.at, JSON.parse(texts[2]).anchor.at, "one live read serves the three hours of this run");
  const reads = Object.values(h0.anchor.reads.A).map((r) => r[0]);
  assert.ok(new Set(reads).size > 1, "each address read at its own head block");
  // the timeline from published + recorded hours gives the exact effective VHP
  const all = [...c.texts.slice(0, 31), ...texts], hours = all.map((t) => JSON.parse(t));
  const L = R.ledger(D.timelineFrom(hours, all.map((t, i) => D.checkHour(i ? all[i - 1] : "", t))));
  for (let h = L.from + 20; h <= L.to; h += 11) for (const a of c.ps) assert.equal(L.eff(a, h), c.eff(a, h), `${a} at ${h}`);
});

test("maxHours: a run records at most that many hours; the next run carries on", async () => {
  const head = at(c.n0 + 36) + 70;
  const A = new FakeNode(c.raw, { name: "A", head }), B = new FakeNode(c.raw, { name: "B", head });
  const one = await recordHours(A, B, c.texts[30], { ...opts, maxHours: 2 });
  assert.equal(one.length, 2);
  const two = await recordHours(A, B, one[1], { ...opts, maxHours: 2 });
  assert.equal(JSON.parse(two[0]).n, c.n0 + 33);
  assert.equal(D.checkHour(one[1], two[0]).ok, true);
});

test("nothing to record before the next hour is irreversible", async () => {
  const head = at(c.n0 + 31) + 30;   // hour 31's last block is not yet 60 blocks deep
  assert.deepEqual(await recordHours(new FakeNode(c.raw, { head }), new FakeNode(c.raw, { name: "B", head }), c.texts[30], opts), []);
});

test("two nodes that disagree on a block: nothing is written", async () => {
  const head = at(c.n0 + 32) + 70;
  const A = new FakeNode(c.raw, { head }), B = new FakeNode(c.raw, { name: "B", head, tamper: { burnAt: (c.n0 + 31) * H + 500 } });
  await assert.rejects(recordHours(A, B, c.texts[30], opts), /differs between A and B/);
});

test("D-112: a node that can't answer effective_balance_of — the hours are written but flagged", async () => {
  const head = at(c.n0 + 31) + 70;
  const A = new FakeNode(c.raw, { head }), B = new FakeNode(c.raw, { name: "B", head, tamper: { noEff: true } });
  const texts = await recordHours(A, B, c.texts[30], opts);
  const r = D.checkHour(c.texts[30], texts[0]);
  assert.equal(r.ok, true); assert.equal(r.quality, "flagged"); assert.match(r.why, /not answered/);
});

test("a fork between the read and the tail (a read block's id changed): nothing is written", async () => {
  const head = at(c.n0 + 31) + 70;
  const A = new FakeNode(c.raw, { head, tamper: {} }), B = new FakeNode(c.raw, { name: "B", head });
  A.read = (orig => async (a) => { const r = await orig(a); r.id = "0x1220" + "ab".repeat(32); return r; })(A.read.bind(A));
  await assert.rejects(recordHours(A, B, c.texts[30], opts), /a fork/);
});

test("a read on a block a micro-fork replaced is read again; the hours still check", async () => {
  const head = at(c.n0 + 31) + 70;
  const A = new FakeNode(c.raw, { head }), B = new FakeNode(c.raw, { name: "B", head });
  let forked = 2;   // the first two reads on node A land on blocks that get replaced
  A.read = (orig => async (a) => { const r = await orig(a); if (forked-- > 0) r.id = "0x1220" + "cd".repeat(32); return r; })(A.read.bind(A));
  const texts = await recordHours(A, B, c.texts[30], opts);
  assert.equal(texts.length, 1);
  const r = D.checkHour(c.texts[30], texts[0]); assert.equal(r.ok, true, r.why); assert.equal(r.quality, "ok");
});

test("a read block that doesn't become irreversible in time: nothing is written", async () => {
  const head = at(c.n0 + 31) + 61;
  const A = new FakeNode(c.raw, { head, step: 30 }), B = new FakeNode(c.raw, { name: "B", head, step: 30 });
  A.head = (async function () { return { height: this.headH, id: "x", lib: at(c.n0 + 31) + 1 }; }).bind(A);
  await assert.rejects(recordHours(A, B, c.texts[30], opts), /irreversible within/);
});

test("blockRecord: one block-level burn from the signer; reverted transactions skipped; other events kept", async () => {
  const ser = new Serializer(utils.tokenAbi.koilib_types);
  const ev = async (type, obj) => ({ source: R.VHP_CONTRACT, name: `token.${type}`, data: utils.encodeBase64url(await ser.serialize(obj, `token.${type}`)) });
  const S = "1MbsVfNw6yzQqA8499d8KQj8qdLyRs8CzW", X = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";   // real addresses (koilib checks them)
  const it = { block_height: "7", block_id: "0x1220" + "0a".repeat(32), block: { header: { signer: S } },
    receipt: { events: [await ev("burn_event", { from: S, value: "408000000" })],
      transaction_receipts: [{ events: [await ev("mint_event", { to: S, value: "5" })] }, { reverted: true, events: [await ev("transfer_event", { from: S, to: X, value: "9" })] }] } };
  const b = await blockRecord(it);
  assert.equal(b.burn, "408000000");
  assert.deepEqual(JSON.parse(JSON.stringify(b.events)), [{ h: 7, k: "m", f: "", t: S, v: "5" }]);
  it.receipt.events.push(await ev("burn_event", { from: S, value: "1" }));
  await assert.rejects(blockRecord(it), /exactly one VHP burn/);
  it.receipt.events = [];
  await assert.rejects(blockRecord(it), /exactly one VHP burn/);
  await assert.rejects(blockRecord({ ...it, block_id: "0x1220" + "0A".repeat(32) }), /lowercase/);
});

test("first fill: rebuilt hours + one live last hour, then the hourly recorder carries on — every hour checks", async () => {
  const f = makeChain({ seed: 23, hours: 34, np: 4, busy: 0.02, write: 0 });
  const plan = { v: 1, startN: f.n0, endN: f.n0 + 29 };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fill-"));
  const head = at(plan.endN) + 70;
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
  // resumable: a zero budget saves nothing; then the chunks fill and a second call finds them all
  assert.equal(await fillChunks(A, B, plan, dir, -1, quiet), false);
  assert.equal(await fillChunks(A, B, plan, dir, 1e9, quiet), true);
  const saved = fs.readdirSync(dir).sort(); assert.deepEqual(saved, ["c000.json", "c001.json"]);
  assert.equal(await fillChunks(A, B, plan, dir, 1e9, quiet), true, "nothing left to read");
  const blocks = saved.flatMap((x) => JSON.parse(fs.readFileSync(path.join(dir, x), "utf8")));
  const { liveAnchor } = await import("../../bot/vhp-ruler.ts");
  const anc = await liveAnchor(A, B, [...new Set(blocks.map((b) => b.s))].sort(), at(plan.endN), opts);
  const texts = fillHours(plan, blocks, anc);
  assert.equal(texts.length, 30);
  let prev = "";
  texts.forEach((t, i) => { const r = D.checkHour(prev, t); assert.equal(r.ok, true, `hour ${i}: ${r.why}`); assert.equal(JSON.parse(t).kind, i < 29 ? "rebuilt" : "live"); prev = t; });
  assert.equal(D.checkHour(texts[28], texts[29]).effAt, "next", "the first live hour is checked against both nodes");
  // the hourly recorder carries on
  const A2 = new FakeNode(f.raw, { head: at(plan.endN + 2) + 70 }), B2 = new FakeNode(f.raw, { name: "B", head: at(plan.endN + 2) + 70 });
  const more = await recordHours(A2, B2, texts[29], opts);
  assert.equal(more.length, 2);
  assert.equal(D.checkHour(texts[29], more[0]).ok, true);
  const all = [...texts, ...more], L = R.ledger(D.timelineFrom(all.map((t) => JSON.parse(t))));
  for (let h = L.from + 20; h <= L.to; h += 13) for (const a of f.ps) assert.equal(L.eff(a, h), f.eff(a, h));
  // D-112: rebuilt hours mark the timeline; a paying card whose [T − 28,800, T] reaches them is flagged
  assert.equal(D.timelineFrom(all.map((t) => JSON.parse(t))).rebuilt.length, 29);
});

test("first fill: a node that stops answering for a while — the chunk is tried again and saved", async () => {
  const f = makeChain({ seed: 37, hours: 6, np: 3, write: 0 });
  const plan = { v: 1, startN: f.n0, endN: f.n0 + 3 }, head = at(plan.endN) + 70;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fill-"));
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
  let down = 2; A.blocks = (orig => async (x, y) => { if (down-- > 0) throw new Error("A blocks: no answer within 30 s"); return orig(x, y); })(A.blocks.bind(A));
  assert.equal(await fillChunks(A, B, plan, dir, 1e9, quiet, 0, Infinity, 3, 1), true);
  assert.deepEqual(fs.readdirSync(dir), ["c000.json"]);
  down = 5; fs.rmSync(path.join(dir, "c000.json"));
  await assert.rejects(fillChunks(A, B, plan, dir, 1e9, quiet, 0, Infinity, 3, 1), /no answer/, "after 3 tries the job fails (and is re-run)");
});

test("first fill: two nodes that disagree on any block of a chunk — the chunk isn't saved", async () => {
  const f = makeChain({ seed: 29, hours: 6, np: 3, write: 0 });
  const plan = { v: 1, startN: f.n0, endN: f.n0 + 3 }, head = at(plan.endN) + 70;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fill-"));
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head, tamper: { burnAt: f.n0 * H + 100 } });
  await assert.rejects(fillChunks(A, B, plan, dir, 1e9, quiet), /differs between A and B/);
  assert.deepEqual(fs.readdirSync(dir), [], "nothing saved");
});

test("rollup: hours of days at least 3 days old become day files; days beyond retention are removed", () => {
  const g = makeChain({ seed: 31, hours: 48, np: 3, n0: 33480 });
  const map = new Map(g.texts.map((t) => [JSON.parse(t).n, t]));
  const { days, remove } = rollup(map, new Set([1300]), 33480 + 24 * 4, 30);
  assert.deepEqual(Object.keys(days), ["1395", "1396"]);
  assert.equal(D.checkDay(days[1395], "").ok, true);
  assert.ok(remove.includes("h/33480.json") && remove.includes("d/1300.json"));
});

test("#D-10 M-2: 27 hours behind — the recorder chains, catches up, goes live; the live hour checks the whole chain", async () => {
  const f = makeChain({ seed: 61, hours: 62, np: 4, busy: 0.02, write: 31 });
  const head = at(f.n0 + 58) + 70;   // published to hour 30; the nodes are 28 hours ahead
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
  const logs = [], log = (s) => logs.push(s);
  let all = f.texts.slice(), prev = f.texts[30];
  for (let run = 0; run < 6; run++) {
    const texts = await recordHours(A, B, prev, { ...opts, log, maxChained: 4 });
    if (!texts.length) break;
    for (const t of texts) { const r = D.checkHour(prev, t); assert.equal(r.ok, true, r.why); prev = t; all.push(t); }
    if (JSON.parse(texts[0]).kind === "live") break;
  }
  const kinds = all.slice(31).map((t) => JSON.parse(t).kind);
  assert.ok(kinds.includes("chained") && kinds[kinds.length - 1] === "live", kinds.join());
  assert.ok(logs.some((l) => /::error::the VHP ruler is .* hours behind/.test(l)), "an alert when more than 12 h behind");
  const L = R.ledger(D.timelineFrom(all.map((t) => JSON.parse(t))));
  for (let h = L.from + 20; h <= L.to; h += 17) for (const a of f.ps) assert.equal(L.eff(a, h), f.eff(a, h));
  assert.equal(D.timelineFrom(all.map((t) => JSON.parse(t))).rebuilt.length, 0, "a live hour follows: the chained hours are verified");
});
