// Repo Lens #E-14 and #B-5 (the fix-check of #E-12 / #D-10 at 99311a5 / 0d0f35d): one test per finding fixed.
// Nothing here talks to a chain: simulated nodes and synthetic timelines only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, D, PY, makeChain, FakeNode, addr, toJson } from "./vhp-ruler.fixture.mjs";
import { recordHours } from "../../bot/vhp-ruler.ts";
import { fillAnchor } from "../../bot/vhp-fill.ts";

const H = 1200, at = (n) => (n + 1) * H - 1, quiet = () => {};
const opts = { waitMs: 50, pollMs: 1, log: quiet, rounds: 3 };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-fixcheck-"));
const pyCheck = (prev, t) => {
  fs.writeFileSync(path.join(dir, "p"), prev || ""); fs.writeFileSync(path.join(dir, "h"), t);
  return JSON.parse(PY(`print(json.dumps(V.check_hour(open(${JSON.stringify(path.join(dir, "p"))}).read(), open(${JSON.stringify(path.join(dir, "h"))}).read())))`));
};

// ── N-1 (and N-2): a live read that lands past the next hour's end, then an outage ──
for (const gap of [26000, 30000, 40000]) {
  test(`N-1: the last live hour's read is 1,500 blocks past its end, then ${gap.toLocaleString("en")} blocks of outage: the recorder catches up`, async () => {
    const lag = 1500, hours = 31 + Math.ceil((gap + lag) / H) + 8;
    const f = makeChain({ seed: 70 + gap / 1000, hours, np: 4, busy: 0.004, write: 31, lag });
    assert.ok(JSON.parse(f.texts[30]).anchor.at > at(f.n0 + 31), "the published hour's anchor is past the next hour's end");
    let head = at(f.n0 + 30) + lag + gap;
    let prev = f.texts[30], all = f.texts.slice(), kinds = [], runs = 0;
    for (; runs < 30; runs++) {
      const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
      const texts = await recordHours(A, B, prev, { ...opts, maxChained: 48 });
      for (const t of texts) {
        const r = D.checkHour(prev, t); assert.equal(r.ok, true, r.why);
        all.push(t); kinds.push(JSON.parse(t).kind); prev = t;
      }
      const lib = head - 60;
      if (lib - JSON.parse(prev).to < 2 * H) break;   // caught up
      head = Math.min(head + H, f.raw.top - 100);   // an hour passes
    }
    assert.ok(runs < 30, `caught up (kinds: ${kinds.join(" ")})`);
    assert.ok(kinds.includes("chained") && kinds.includes("live"), kinds.join(" "));
    assert.equal(kinds[kinds.length - 1], "live");
    // the Python checker agrees on every new hour, and the whole history rebuilds exact effective VHP
    const firstNew = 31; let p = all[firstNew - 1];
    for (const t of all.slice(firstNew)) { const r = pyCheck(p, t); assert.equal(r.ok, true, r.why); p = t; }
    const tl = D.timelineFrom(all.map((t) => JSON.parse(t)));
    assert.equal(tl.pending.length, 0, "a live hour followed: nothing pending");
    const L = R.ledger(tl);
    for (let h = L.from + 20; h <= L.to; h += 23) for (const a of f.ps) assert.equal(L.eff(a, h), f.eff(a, h));
  });
}

test("N-1: a chained hour's anchor must be max(its end, the previous anchor), nothing else (both languages)", async () => {
  const lag = 1500, f = makeChain({ seed: 77, hours: 31 + 30, np: 3, busy: 0.004, write: 31, lag });
  const head = at(f.n0 + 30) + lag + 30000;
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
  const [c1] = await recordHours(A, B, f.texts[30], { ...opts, maxChained: 1 });
  const h = JSON.parse(c1);
  assert.equal(h.kind, "chained"); assert.equal(h.anchor.at, JSON.parse(f.texts[30]).anchor.at, "anchored at the previous (later) anchor");
  assert.equal(D.checkHour(f.texts[30], c1).ok, true); assert.equal(pyCheck(f.texts[30], c1).ok, true);
  // the same hour anchored at its own end (behind the previous anchor) is refused in both
  const blocks = h.sig.map((s, k) => ({ s: h.addrs[s], id: h.ids[k], burn: h.burns[k] }));
  const own = D.makeHour({ n: h.n, prevText: f.texts[30], kind: "chained", blocks, events: h.events.map(([eh, k, a, b, v]) => ({ h: eh, k, f: a, t: b, v })), anchor: { at: h.to, id: h.ids[1199], bal: h.anchor.bal, reads: { A: {}, B: {} } } });
  assert.equal(D.checkHour(f.texts[30], own).ok, false); assert.equal(pyCheck(f.texts[30], own).ok, false);
});

// ── N-4: the oldest kept hour is chained ──
test("N-4: load_ledger and checkKept accept a chained oldest kept hour (still unverified until a live hour)", async () => {
  const f = makeChain({ seed: 81, hours: 70, np: 3, busy: 0.004, write: 31 });
  const head = at(f.n0 + 30) + 30000;   // 25 hours behind: chained
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
  const ch = await recordHours(A, B, f.texts[30], { ...opts, maxChained: 2 });
  assert.deepEqual(ch.map((t) => JSON.parse(t).kind), ["chained", "chained"]);
  const head2 = at(f.n0 + 32) + 70 + 10000;   // then close enough for live reads
  const live = await recordHours(new FakeNode(f.raw, { head: head2 }), new FakeNode(f.raw, { name: "B", head: head2 }), ch[1], { ...opts, maxHours: 6 });   // 2 + 6 hours: long enough for a ledger
  assert.ok(live.length && JSON.parse(live[0]).kind === "live", "then a live hour");
  // retention removed everything before the first chained hour
  const kept = [...ch, ...live], tree = path.join(dir, "kept"); fs.mkdirSync(path.join(tree, "h"), { recursive: true });
  for (const t of kept) fs.writeFileSync(path.join(tree, "h", `${JSON.parse(t).n}.json`), t);
  assert.equal(D.checkKept(kept[0]).ok, true, D.checkKept(kept[0]).why);
  const out = JSON.parse(PY(`L, checks = V.load_ledger(${JSON.stringify(tree)}); print(json.dumps({"from": L.frm, "n": len(checks), "pending": L.pending}))`));
  assert.equal(out.n, kept.length); assert.deepEqual(out.pending, [], "a live hour follows: verified");
  // a tampered chained oldest hour is still refused
  const bad = D.canon({ ...JSON.parse(kept[0]), burns: JSON.parse(kept[0]).burns.map((b, i) => (i ? b : "0")) });
  assert.equal(D.checkKept(bad).ok, false);
});

// ── a synthetic timeline long enough for paying cards, with a producer that stops and comes back ──
function custom({ from, n, np = 5, signerAt }) {
  const ps = Array.from({ length: np }, (_, i) => addr(i)), to = from + n - 1;
  const bal = ps.map((_, i) => 10n ** 14n * BigInt(i + 2)), signers = new Array(n), ids = new Array(n), deltas = [];
  for (let k = 0; k < n; k++) {
    const s = ps[signerAt(from + k, k)]; signers[k] = s; ids[k] = "0x1220" + (from + k).toString(16).padStart(64, "0");
    deltas.push({ h: from + k, a: s, d: -408000000n, inc: 0n }); bal[ps.indexOf(s)] -= 408000000n;
  }
  return { tl: { from, to, signers, ids, deltas, anchors: Object.fromEntries(ps.map((a, i) => [a, { h: to, v: bal[i] }])) }, ps };
}
const cut = (tl, from) => ({ ...tl, from, signers: tl.signers.slice(from - tl.from), ids: tl.ids.slice(from - tl.from), deltas: tl.deltas.filter((d) => d.h >= from) });
const pyCard = (tl, g, score) => {
  fs.writeFileSync(path.join(dir, "c.json"), toJson({ tl, g }));
  return PY(`j = json.load(open(${JSON.stringify(path.join(dir, "c.json"))})); L = V.Ledger(j["tl"]); g = j["g"]
try:
    c = V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"])
    sys.stdout.write(V.card_json(V.score_card(L, c) if ${score ? "True" : "False"} else c))
except ValueError as e:
    sys.stdout.write("ERR " + str(e))`);
};

const W0 = 2000000, win = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
const game = { game: 7, round: "2026111006", window: win, c: 400000n, ownRule: "high1h", paying: true, pooled: [] };
// producer 4 signs early on, is away from W0 − 411,000 to W0 − 396,000, then signs again
const G0 = W0 - 411000, G1 = W0 - 396000;
const long = custom({ from: W0 - 445000, n: 445000 + 15000, signerAt: (h, k) => { const s = (k * 7 + (k >> 5)) % 5; return s === 4 && h >= G0 && h < G1 ? 3 : s; } });

test("N-6: isNew and history read a fixed look-back, so a card's bytes don't depend on where the data starts", () => {
  const Lfull = R.ledger(long.tl), card = R.makeCard(Lfull, game), T = card.T;
  const p4 = card.producers.find((p) => p.a === long.ps[4]);
  assert.equal(p4.isNew, true, "away for the whole of [T − 410,400, T − 403,201]: new");
  const Lcut = R.ledger(cut(long.tl, T - 410400));
  assert.equal(R.cardJson(R.makeCard(Lcut, game)), R.cardJson(card), "data from T − 445,000 or from T − 410,400: the same bytes");
  assert.equal(pyCard(cut(long.tl, T - 410400), game), R.cardJson(card), "Python: the same bytes");
  assert.equal(pyCard(long.tl, game), R.cardJson(card));
});

test("N-3: a paying card isn't made, or scored, while unverified chained hours are in its windows; once checked, it never changes", () => {
  const L0 = R.ledger(long.tl), T = R.makeCard(L0, game).T;
  for (const [what, p] of [["at T", { h0: T - 600, h1: T }], ["19 blocks before the size window", { h0: T - 28819, h1: T - 28819 }]]) {
    assert.throws(() => R.makeCard(R.ledger({ ...long.tl, pending: [p] }), game), /not yet/, what);
    assert.match(pyCard({ ...long.tl, pending: [p] }, game), /^ERR not yet/, what);
  }
  assert.equal(R.cardJson(R.makeCard(R.ledger({ ...long.tl, pending: [{ h0: T - 28820, h1: T - 28820 }] }), game)), R.cardJson(R.makeCard(L0, game)), "just outside: no effect");
  const free = R.makeCard(R.ledger({ ...long.tl, pending: [{ h0: T - 600, h1: T }] }), { ...game, paying: false });
  assert.ok(free.producers.every((p) => p.quality === "ok"), "free cards don't wait");
  // scoring waits too
  const card = R.makeCard(L0, game);
  assert.throws(() => R.scoreCard(R.ledger({ ...long.tl, pending: [{ h0: win.S0 - 19, h1: win.S0 - 19 }] }), card), /not yet/);
  // recompute of the card made once the hours were checked stays "same" as more hours come (here: the same data)
  assert.equal(R.recompute(L0, R.cardJson(card), game).same, true);
});

test("N-7: a rebuilt hour up to 19 blocks before the scoring window flags a paying card (both languages)", () => {
  for (const [h, want] of [[win.S0 - 19, "flagged"], [win.S0 - 20, "ok"]]) {
    const tl = { ...long.tl, rebuilt: [{ h0: h, h1: h }] }, L = R.ledger(tl);
    const s = R.scoreCard(L, R.makeCard(L, game));
    assert.ok(s.producers.every((p) => p.quality === want), `rebuilt at S0 − ${win.S0 - h}: ${want}`);
    assert.equal(pyCard(tl, game, true), R.cardJson(s));
  }
});

test("N-8: the card stores the round in plain decimal; game and round above 2^53 − 1 are refused in both", () => {
  const L = R.ledger(long.tl), g0 = { ...game, round: "02026111006" };
  const card = R.makeCard(L, g0);
  assert.equal(card.round, "2026111006");
  assert.equal(R.recompute(L, R.cardJson(card), game).same, true, "a leading zero no longer makes a card that fails recompute");
  assert.equal(pyCard(long.tl, g0), R.cardJson(card));
  for (const big of ["9007199254740992", "1".repeat(5000)]) {
    assert.throws(() => R.makeCard(L, { ...game, game: big }), /2\^53/);
    assert.throws(() => R.makeCard(L, { ...game, round: big }), /2\^53/);
    assert.match(pyCard(long.tl, { ...game, round: big }), /^ERR round must be a whole number from 0 to 2\^53/);
  }
});

test("N-5: the game's settings must have every key, no other key, and c as plain digits (both languages)", () => {
  const L = R.ledger(long.tl), card = R.cardJson(R.makeCard(L, game));
  const plain = { ...game, c: "400000" };
  assert.equal(R.recompute(L, card, plain).same, true);
  const { paying, ...noPaying } = plain, { c, ...noC } = plain, { pooled, ...noPooled } = plain;
  for (const [what, g] of [["no paying", noPaying], ["no c", noC], ["no pooled", noPooled], ["an extra key", { ...plain, extra: 1 }],
    ["c: \"\"", { ...plain, c: "" }], ["c: \"0x10\"", { ...plain, c: "0x10" }], ["paying: 1", { ...plain, paying: 1 }]]) {
    const r = R.recompute(L, card, g);
    assert.equal(r.same, false, what); assert.match(r.diff, /the game's settings/, what);
    fs.writeFileSync(path.join(dir, "s.json"), toJson({ tl: long.tl, card, g }));
    const py = PY(`j = json.load(open(${JSON.stringify(path.join(dir, "s.json"))})); print(json.dumps(V.recompute(V.Ledger(j["tl"]), j["card"], j["g"])))`);
    const [same, diff] = JSON.parse(py);
    assert.equal(same, false, `Python, ${what}`); assert.match(diff, /the game's settings/, `Python, ${what}`);
  }
});

// ── N-6 of #E-14: a producer first seen in the fill's tail ──
test("#E-14 N-6: the fill reads a producer that first signs in its tail, as the recorder does", async () => {
  const f = makeChain({ seed: 91, hours: 6, np: 4, write: 0, busy: 0 });
  const plan = { v: 1, startN: f.n0, endN: f.n0 + 2 }, lastTo = at(plan.endN);
  // the fill's blocks never show producer 3 (as if it first signs after the plan's end)
  const blocks = (await new FakeNode(f.raw, { head: f.raw.top }).blocks(plan.startN * H, lastTo)).map((b) => (b.s === f.ps[3] ? { ...b, s: f.ps[0] } : b));
  const head = lastTo + 300;
  const A = new FakeNode(f.raw, { head }), B = new FakeNode(f.raw, { name: "B", head });
  A.blocks = ((orig) => async (x, y) => (await orig(x, y)).map((b) => (b.h <= lastTo && b.s === f.ps[3] ? { ...b, s: f.ps[0] } : b)))(A.blocks.bind(A));
  B.blocks = A.blocks;
  const anc = await fillAnchor(A, B, blocks, lastTo, opts);
  assert.ok(f.ps[3] in anc.reads.A && f.ps[3] in anc.reads.B, "the tail's new producer was read on both nodes (before: \"re-run this hours job\", which could never succeed)");
});

// ── N-9: the block check stops at the first failure ──
test("N-9: verify_blocks drops the queued batches after the first failure", () => {
  const c = makeChain({ seed: 95, hours: 4, np: 3, write: 4 });
  fs.writeFileSync(path.join(dir, "v.json"), JSON.stringify(c.texts));
  const out = PY(`texts = json.load(open(${JSON.stringify(path.join(dir, "v.json"))}))
calls = [0]
def fake(url, method, params, timeout=60):
    if method == "chain.get_head_info":
        return {"head_topology": {"id": "0x"}, "last_irreversible_block": "999999999"}
    calls[0] += 1
    raise ValueError("node down")
V._rpc = fake
try:
    V.verify_blocks(texts, "http://x"); print("no error")
except ValueError as e:
    print("raised", calls[0])`).trim();
  const m = /^raised (\d+)$/.exec(out); assert.ok(m, out);
  assert.ok(Number(m[1]) <= 16, `only the batches already running were tried (${m[1]} of ~49)`);
});
