// D-172 (library, 6 Nov): per race, every producer void is recorded (VHP before / after, the sending address(es),
// whether the producer moved it itself) and every band set-aside (count vs expected in sd); a weekly summary counts
// them. Data only: nothing pays from it.
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson } from "./vhp-ruler.fixture.mjs";
import { chain, game, win } from "./vhp-ruler.repolens-b10-chain.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-d172-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };
const SENDER = "1SenderAddressXXXXXXXXXXXXXXXXXXX", SINK = "1ReceiverAddressXXXXXXXXXXXXXXXXX";
// a chain where VHP moves carry their counterparty, as vhpDeltas gives them
function moved(extra, tag) {
  const { tl, ps } = chain({ extra });
  for (const x of tl.deltas) for (const m of extra) if (x.h === m.h && x.a === ps[m.i] && x.d === m.v) Object.assign(x, tag(m));
  return { tl, ps };
}
const pyCard = (tl, g) => py(`L = V.Ledger(j["tl"]); g = j["g"]
sys.stdout.write(V.card_json(V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))))`, { tl, g });

test("D-172: a void from VHP sent in records the sender, not an own move; JS = Python on the card", () => {
  const { tl, ps } = moved([{ h: win.S0 + 3600, i: 2, v: 2n * 10n ** 15n }], () => ({ kind: "in", c: SENDER }));
  const L = R.ledger(tl), s = R.scoreCard(L, R.makeCard(L, game)), p = s.producers.find((x) => x.a === ps[2]);
  assert.equal(p.void, true);
  assert.equal(JSON.stringify(p.moves.received), JSON.stringify([{ a: SENDER, v: String(2n * 10n ** 15n) }]));
  assert.equal(JSON.stringify(p.moves.sent), JSON.stringify([]));
  assert.equal(p.moves.ownMove, false);
  assert.ok(BigInt(p.moves.hi) > BigInt(p.moves.own) && BigInt(p.moves.effS1) > BigInt(p.moves.effS0), "VHP before and after");
  assert.ok(BigInt(p.moves.burned) > 0n, "the block burns are totalled, not listed");
  for (const x of s.producers) if (!x.void) assert.equal(x.moves, null);
  assert.equal(pyCard(tl, game), R.cardJson(s));
});

test("D-172: a void from VHP the producer sent out itself is an own move, with the receiver", () => {
  const { tl, ps } = moved([{ h: win.S1 - 50, i: 3, v: -(10n ** 15n * 3n) / 2n }], () => ({ kind: "out", c: SINK }));
  const L = R.ledger(tl), s = R.scoreCard(L, R.makeCard(L, game)), p = s.producers.find((x) => x.a === ps[3]);
  assert.equal(p.void, true);
  assert.equal(p.moves.ownMove, true);
  assert.equal(JSON.stringify(p.moves.sent), JSON.stringify([{ a: SINK, v: String((10n ** 15n * 3n) / 2n) }]));
  assert.equal(pyCard(tl, game), R.cardJson(s));
});

test("D-172: core members carry z (millionths of an sd, signed) and setAside, exactly the band's decision; others null / false", () => {
  const { tl } = chain(), L = R.ledger(tl), s = R.scoreCard(L, R.makeCard(L, game));
  const core = s.producers.filter((p) => p.core), n = core.reduce((t, p) => t + BigInt(p.signed), 0n), b = core.reduce((t, p) => t + p.expected, 0n);
  for (const p of s.producers) {
    if (!p.core) { assert.equal(p.z, null); assert.equal(p.setAside, false); continue; }
    const d = BigInt(p.signed) * b - n * p.expected, v = n * p.expected * (b - p.expected);
    assert.equal(p.setAside, d * d > 4n * v);
    const r = R.isqrt(v), q = ((d < 0n ? -d : d) * 1000000n) / r;
    assert.equal(p.z, d < 0n ? -q : q);
  }
});

test("D-172: the weekly summary counts voids, own moves, repeat senders and set-asides; JS = Python", () => {
  const a = moved([{ h: win.S0 + 3600, i: 2, v: 2n * 10n ** 15n }], () => ({ kind: "in", c: SENDER }));
  const La = R.ledger(a.tl), cA = R.scoreCard(La, R.makeCard(La, game)), cB = R.scoreCard(La, R.makeCard(La, { ...game, round: "6" }));
  const cards = [R.cardJson(cA), R.cardJson(cB), R.cardJson(R.makeCard(La, game))];   // the last is not scored: skipped
  const w = R.weekSummary(cards);
  assert.equal(w.races, 2);
  assert.equal(w.voids, 2);
  assert.equal(w.ownMoves, 0);
  assert.equal(JSON.stringify(w.voidsByProducer), JSON.stringify([{ a: a.ps[2], races: 2 }]));
  assert.equal(JSON.stringify(w.repeatSenders), JSON.stringify([{ a: SENDER, races: 2, producers: [a.ps[2]] }]));
  assert.equal(w.setAsideExpected, 45500);
  assert.equal(w.setAsideRate, w.coreRaces ? Math.floor((w.setAsides * 1e6) / w.coreRaces) : 0);
  const out = py(`print(json.dumps(V.week_summary(j["cards"]), separators=(",", ":")))`, { cards }).trim();
  assert.equal(out, JSON.stringify(w));
});
