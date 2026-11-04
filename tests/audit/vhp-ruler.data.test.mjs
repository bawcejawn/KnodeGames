// The vhp-data hour format and its checks (vhp-data.js and its Python twin in vhp_ruler.py): step (b) of R-RULER-1.
// Design .ai/standards/VHP_RULER.md §7 (M-3): write-once, hash-chained, two-node anchors; D-112: live vs rebuilt.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, D, PY, makeChain, blockId } from "./vhp-ruler.fixture.mjs";

const chain = makeChain({ seed: 7, hours: 34, np: 5, busy: 0.02 });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhpdata-"));
/** checkHour in JavaScript and in Python, which must agree */
function both(prevText, text) {
  const js = D.checkHour(prevText, text);
  const fp = path.join(dir, "p.json"), fh = path.join(dir, "h.json");
  fs.writeFileSync(fp, prevText || ""); fs.writeFileSync(fh, text);
  const py = JSON.parse(PY(`p = open(${JSON.stringify(fp)}, encoding="utf-8").read(); h = open(${JSON.stringify(fh)}, encoding="utf-8").read()
print(json.dumps(V.check_hour(p, h)))`));
  assert.equal(JSON.stringify(py), JSON.stringify(js), "JavaScript and Python give the same answer");
  return js;
}
const edit = (text, f) => { const h = JSON.parse(text); f(h); return D.canon(h); };

test("a clean chain: every hour checks, live anchors match the rebuild at the block after the read", () => {
  for (let i = 0; i < chain.texts.length; i++) {
    const r = both(i ? chain.texts[i - 1] : "", chain.texts[i]);
    assert.equal(r.ok, true, `hour ${i}: ${r.why}`);
    assert.equal(r.quality, "ok");
    assert.equal(r.effAt, "next");
  }
});

test("a file with one burn removed is refused (§7)", () => {
  const t = edit(chain.texts[5], (h) => { h.burns.splice(100, 1); });
  const r = both(chain.texts[4], t);
  assert.equal(r.ok, false); assert.match(r.why, /one burn per block/);
});

test("a burn changed, or a block's signer swapped, is refused: the anchors no longer add up", () => {
  let r = both(chain.texts[4], edit(chain.texts[5], (h) => { h.burns[100] = String(BigInt(h.burns[100]) - 1n); }));
  assert.equal(r.ok, false); assert.match(r.why, /previous anchor plus the changes since/);
  r = both(chain.texts[4], edit(chain.texts[5], (h) => { const k = h.sig.findIndex((s) => s !== h.sig[0]); [h.sig[0], h.sig[k]] = [h.sig[k], h.sig[0]]; }));
  // swapping two blocks' signers moves one burn between them: a balance breaks unless the burns were equal
  assert.equal(r.ok, false);
});

test("an event removed is refused", () => {
  const i = chain.texts.findIndex((t, k) => k > 0 && JSON.parse(t).events.length > 0);
  assert.ok(i > 0, "the fixture has an hour with an event");
  const r = both(chain.texts[i - 1], edit(chain.texts[i], (h) => { h.events.shift(); }));
  assert.equal(r.ok, false);
});

test("the hash chain: a wrong prev, a gap, or an edited earlier file breaks it", () => {
  let r = both(chain.texts[3], edit(chain.texts[4], (h) => { h.prev = "0".repeat(64); }));
  assert.equal(r.ok, false); assert.match(r.why, /hash chain/);
  r = both(chain.texts[2], chain.texts[4]);
  assert.equal(r.ok, false);
  const edited = edit(chain.texts[3], (h) => { h.ids[7] = blockId(1); });
  r = both(edited, chain.texts[4]);
  assert.equal(r.ok, false); assert.match(r.why, /hash chain/, "an earlier file can't be rewritten unnoticed");
  r = both("", chain.texts[4]);
  assert.equal(r.ok, false); assert.match(r.why, /first file/);
});

test("the tail must be the next hour's first blocks", () => {
  const r = both(chain.texts[3], edit(chain.texts[4], (h) => { h.ids[2] = blockId(99); }));
  assert.equal(r.ok, false); assert.match(r.why, /tail/);
});

test("not canonical, extra fields, unsorted keys, out-of-range heights: refused", () => {
  assert.equal(both(chain.texts[3], chain.texts[4].replace(/\n$/, " \n")).ok, false);
  assert.equal(both(chain.texts[3], edit(chain.texts[4], (h) => { h.extra = 1; })).ok, false);
  assert.equal(both(chain.texts[3], edit(chain.texts[4], (h) => { h.anchor.bal = Object.fromEntries(Object.entries(h.anchor.bal).reverse()); })).ok, false);
  assert.equal(both(chain.texts[3], edit(chain.texts[4], (h) => { h.anchor.at = h.to + 5000; })).ok, false);
  assert.equal(both(chain.texts[3], edit(chain.texts[4], (h) => { h.burns[0] = "0"; })).ok, false, "every block burns VHP");
});

test("D-112: a node that can't answer effective_balance_of, or two nodes that disagree, flags the whole hour", () => {
  const first = (h) => Object.keys(h.anchor.reads.B)[0];
  let r = both(chain.texts[3], edit(chain.texts[4], (h) => { h.anchor.reads.B[first(h)][2] = ""; }));
  assert.equal(r.ok, true); assert.equal(r.quality, "flagged"); assert.equal(r.flagged.join(), "*"); assert.match(r.why, /not answered/);
  r = both(chain.texts[3], edit(chain.texts[4], (h) => { const x = h.anchor.reads.B[first(h)]; x[2] = String(BigInt(x[2]) + 1n); }));
  assert.equal(r.quality, "flagged", "two nodes that disagree: flagged");
  r = both(chain.texts[3], edit(chain.texts[4], (h) => { for (const n of ["A", "B"]) for (const a of Object.keys(h.anchor.reads[n])) h.anchor.reads[n][a][2] = "1"; }));
  assert.equal(r.quality, "flagged"); assert.match(r.why, /neither/, "a rebuild that matches no rule: not ok (audit S-3)");
  r = both(chain.texts[3], edit(chain.texts[4], (h) => { const x = h.anchor.reads.A[first(h)]; x[1] = String(BigInt(x[1]) + 5n); }));
  assert.equal(r.ok, false, "a node that read a wrong balance: refused"); assert.match(r.why, /node A's balance read/);
  r = both(chain.texts[3], edit(chain.texts[4], (h) => { delete h.anchor.reads.B[first(h)]; }));
  assert.equal(r.ok, false, "a live hour reads every anchored address on both nodes");
});

test("rebuilt hours (first fill): no effective reads; a rebuilt hour can't follow a live one", () => {
  const c = makeChain({ seed: 9, hours: 6, np: 4, rebuiltHours: 3 });
  for (let i = 0; i < 6; i++) assert.equal(both(i ? c.texts[i - 1] : "", c.texts[i]).ok, true);
  assert.equal(JSON.parse(c.texts[2]).kind, "rebuilt");
  const r = both(c.texts[3], edit(c.texts[4], (h) => { h.kind = "rebuilt"; h.anchor.reads = { A: {}, B: {} }; }));
  assert.equal(r.ok, false); assert.match(r.why, /rebuilt hour can't follow a live one/);
});

test("late runs: several hours share one live read; every hour still checks and the timeline is exact", () => {
  const c = makeChain({ seed: 13, hours: 8, np: 4, share: 3, busy: 0.03 });
  for (let i = 0; i < 8; i++) { const r = both(i ? c.texts[i - 1] : "", c.texts[i]); assert.equal(r.ok, true, `hour ${i}: ${r.why}`); assert.equal(r.quality, "ok"); }
  assert.equal(JSON.parse(c.texts[0]).anchor.at, JSON.parse(c.texts[2]).anchor.at, "hours 0–2 share a read");
  assert.equal(JSON.parse(c.texts[0]).tail.sig.length, 2 * 1200 + 25, "so hour 0's tail reaches it");
  const r = both(c.texts[0], edit(c.texts[1], (h) => { h.burns[300] = String(BigInt(h.burns[300]) + 1n); }));
  assert.equal(r.ok, false, "the blocks two files share must agree"); assert.match(r.why, /differs from the previous hour's tail/);
});

test("the anchored set only grows", () => {
  const r = both(chain.texts[3], edit(chain.texts[4], (h) => {
    const signers = new Set([...h.sig, ...h.tail.sig].map((i) => h.addrs[i]));
    const a = Object.keys(h.anchor.bal).find((x) => !signers.has(x));
    if (!a) return;   // every producer signed this hour; nothing to drop
    delete h.anchor.bal[a]; delete h.anchor.reads.A[a]; delete h.anchor.reads.B[a];
  }));
  if (r.ok === false) assert.match(r.why, /stay anchored/);
});

test("day files list each hour's sha256; the chain still checks after the rollup; a changed hour is refused", () => {
  const c = makeChain({ seed: 11, hours: 49, np: 3, n0: 33480 });   // 33,480 = day 1,395 × 24
  const day = Math.floor(c.n0 / 24) + 1, start = day * 24 - c.n0;
  const texts = c.texts.slice(start, start + 24);
  assert.equal(texts.length, 24);
  const dt = D.makeDay(day, texts);
  assert.equal(D.checkDay(dt, c.texts[start - 1] || "").ok, true);
  const bad = D.canon({ ...JSON.parse(dt), hours: JSON.parse(dt).hours.map((h, i) => (i === 5 ? { ...h, ids: h.ids.map((x, j) => (j ? x : blockId(3))) } : h)) });
  assert.equal(D.checkDay(bad, c.texts[start - 1] || "").ok, false);
  const fd = path.join(dir, "d.json"), fp = path.join(dir, "dp.json");
  fs.writeFileSync(fd, dt); fs.writeFileSync(fp, c.texts[start - 1] || "");
  assert.equal(PY(`print(V.check_day(open(${JSON.stringify(fd)}, encoding="utf-8").read(), open(${JSON.stringify(fp)}, encoding="utf-8").read())["ok"])`).trim(), "True");
});

test("timelineFrom → ledger: effective VHP equals the contract copy at every block; JS and Python cards agree", () => {
  const hours = chain.texts.map((t) => JSON.parse(t)), checks = chain.texts.map((t, i) => D.checkHour(i ? chain.texts[i - 1] : "", t));
  const tl = D.timelineFrom(hours, checks), L = R.ledger(tl);
  for (let h = tl.from + 20; h <= tl.to; h += 7) for (const a of chain.ps) assert.equal(L.eff(a, h), chain.eff(a, h), `${a} at ${h}`);
  const Lk = tl.from + 36500;
  const card = R.scoreCard(L, R.makeCard(L, { game: 7, round: "9", window: { W0: Lk - 7199, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + 2400 }, c: 400000n, ownRule: "high1h", paying: false, pooled: [chain.ps[0]] }));
  fs.writeFileSync(path.join(dir, "chain.json"), JSON.stringify(chain.texts));
  const py = PY(`texts = json.load(open(${JSON.stringify(path.join(dir, "chain.json"))}))
hours = [json.loads(t) for t in texts]; checks = [V.check_hour(texts[i - 1] if i else "", t) for i, t in enumerate(texts)]
L = V.Ledger(V.timeline_from(hours, checks)); Lk = L.frm + 36500
c = V.score_card(L, V.make_card(L, 7, "9", {"W0": Lk - 7199, "W1": Lk, "L": Lk, "S0": Lk + 1, "S1": Lk + 2400}, 400000, "high1h", False, [${JSON.stringify(chain.ps[0])}]))
sys.stdout.write(V.card_json(c))`);
  assert.equal(py, R.cardJson(card));
  // a flagged hour inside the card's window flags the card
  const flagged = checks.map((c, i) => (i === 24 ? { ...c, quality: "flagged", flagged: ["*"] } : c));
  const L2 = R.ledger(D.timelineFrom(hours, flagged));
  const c2 = R.makeCard(L2, { game: 7, round: "9", window: { W0: Lk - 7199, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + 2400 }, c: 400000n, ownRule: "high1h", paying: false });
  assert.ok(c2.producers.every((p) => p.quality === "flagged"));
});
