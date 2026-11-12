// Who Signs Block X on the shared VHP ruler (owner, 11 Nov 2026; bot/blockx-ruler.ts; the Ruler chat's card settings,
// claude/ruler/TO-BLOCKX-CARD-SETTINGS-2026-11-11.md): the card for an hourly target, the core and kTop, the ×120
// multiplier, credit at X, the 1-hour void band, the switch. Offline: a made-up chain the ruler reads.
// Run: node --import tsx --test tests/audit/blockx-ruler.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";

const APP = process.env.APP || ".";
const BR = await import(path.resolve(APP, "bot/blockx-ruler.ts"));
const R = globalThis.KRuler, Mn = 1000000n;

// 16 producers: a big one (~30%), a spread, and small ones near the entry bar (10 expected blocks in 6 hours ≈ 0.14%).
const P = Array.from({ length: 16 }, (_, i) => "1" + String.fromCharCode(65 + i).repeat(33));
const VHP = [3000, 1800, 1200, 900, 700, 600, 500, 400, 300, 200, 150, 100, 60, 30, 18, 4];
const FROM = 100000, N = 16 * 28800, UNIT = 10n ** 13n, BURN = 408000000n;
const chain = (() => {
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const tot = VHP.reduce((a, b) => a + b), who = new Array(N), ids = new Array(N);
  for (let i = 0; i < N; i++) {
    let x = rnd() * tot, j = 0; while (x >= VHP[j]) { x -= VHP[j]; j++; }
    who[i] = P[j]; ids[i] = "0x1220" + crypto.createHash("sha256").update(`bx block ${FROM + i}`).digest("hex");
  }
  return { who, ids };
})();
function timeline(extra = []) {
  const bal = new Map(P.map((a, i) => [a, BigInt(VHP[i]) * UNIT])), deltas = [];
  for (let i = 0; i < N; i++) { deltas.push({ h: FROM + i, a: chain.who[i], d: -BURN, inc: 0n }); bal.set(chain.who[i], bal.get(chain.who[i]) - BURN); }
  for (const { h, a, v } of extra) { deltas.push({ h, a, d: v, inc: v > 0n ? v : 0n }); bal.set(a, (bal.get(a) || 0n) + v); }
  deltas.sort((x, y) => x.h - y.h);
  const to = FROM + N - 1;
  return { from: FROM, to, signers: chain.who.slice(), ids: chain.ids.slice(), deltas, anchors: Object.fromEntries([...bal].map(([a, v]) => [a, { h: to, v }])), bad: [], rebuilt: [], pending: [] };
}
const L0 = R.ledger(timeline());
const LOCK = FROM + 15 * 28800 + 5000, X = LOCK + 100, T_X = Date.parse("2026-11-23T06:20:00Z");

test("settings: the Ruler chat's (game 2, c 500000, minK 10, spot, min, paying, pooled = the Vault); round = the target's UTC hour; windows from the lock", () => {
  assert.deepEqual({ ...BR.RULER, pooled: [...BR.RULER.pooled] }, { game: 2, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: ["1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"] });
  assert.equal(BR.roundOf(T_X), "2026112306");
  assert.deepEqual(BR.windowOf(5000000), { W0: 4992801, W1: 5000000, L: 5000000, S0: 5000001, S1: 5007200 }, "[L − 7,199, L] and [L + 1, L + 7,200]");
  assert.equal(BR.CAP, 120n); assert.equal(BR.MAX_POINTS, 12000, "120 × 100 hundredths");
  assert.deepEqual(R.voidBand(BR.VOID_BLOCKS).map(Number), [50000, 250000], "the 1-hour band: 5% down, 25% up");
  const card = BR.cardFor(L0, LOCK, T_X);
  assert.equal(card.game, 2); assert.equal(card.round, "2026112306"); assert.equal(card.minK, 10); assert.equal(card.ownRule, "spot");
  assert.deepEqual(card.window, BR.windowOf(LOCK));
  assert.ok(card.T >= LOCK - 7199 && card.T <= LOCK, "the card's moment is in the 6 hours before the lock");
});

test("core and kTop: the k-weighted median form, the 0.97 line, the largest k in the core (hand-checked on a small card)", () => {
  const row = (a, k, form, entry = true) => ({ a, k: String(k * 1000000), form: String(form), entry });
  // k: 50, 30, 20 (total 100). Sorted by form: C (0.90, 20), B (0.99, 30) → 2 × 50 ≥ 100 at B: median 0.99, line 0.9603.
  const card = { producers: [row("1A", 50, 1000000), row("1B", 30, 990000), row("1C", 20, 900000), row("1D", 99, 2000000, false)] };
  const c = BR.coreOf(card);
  assert.equal(c.median, 990000n); assert.deepEqual(c.core, ["1A", "1B"], "C is under the line; D has no entry");
  assert.equal(c.kTop, 50000000n, "A's k (D's bigger k doesn't count: no entry)");
  assert.equal(BR.multiplierOf(card, "1B"), (50n * Mn) / 30n, "kTop ÷ k, millionths, rounded down");
  assert.equal(BR.multiplierOf(card, "1C"), 2500000n, "a producer outside the core still has a multiplier (50 ÷ 20)");
  assert.equal(BR.multiplierOf(card, "1D"), null, "no entry: none");
  // an exact tie at the median takes the lower form: equal forms sort by address, the running sum decides
  const tie = { producers: [row("1A", 50, 980000), row("1B", 50, 980000), row("1C", 1, 950000)] };
  assert.equal(BR.coreOf(tie).median, 980000n);
  // the cap: ×120
  const tiny = { producers: [row("1A", 600, 1000000), row("1B", 2, 1000000)] };
  assert.equal(BR.multiplierOf(tiny, "1B"), 120n * Mn, "600 ÷ 2 = 300 → capped at 120");
});

test("on the chain: every producer with entry gets kTop ÷ k (capped at ×120); the biggest core producer gets ×1", () => {
  const card = BR.cardFor(L0, LOCK, T_X), { kTop, core } = BR.coreOf(card);
  const withEntry = card.producers.filter((p) => p.entry);
  assert.ok(withEntry.length >= 12, "most of the field enters");
  assert.ok(card.producers.some((p) => !p.entry), "the smallest producer is under the entry bar");
  const top = card.producers.find((p) => BigInt(p.k) === kTop);
  assert.ok(core.includes(top.a)); assert.equal(BR.multiplierOf(card, top.a), Mn, "×1 for the biggest");
  for (const p of withEntry) {
    const m = BR.multiplierOf(card, p.a), want = (kTop * Mn) / BigInt(p.k);
    assert.equal(m, want < 120n * Mn ? want : 120n * Mn, p.a);
  }
  // fair: up to the cap, multiplier × k is the same for everyone (expected points per pick, within rounding)
  for (const p of withEntry) {
    const m = BR.multiplierOf(card, p.a);
    if (m < 120n * Mn) assert.ok(kTop - (m * BigInt(p.k)) / Mn <= BigInt(p.k) / Mn + 1n, p.a);
  }
});

test("scoring X: a right pick scores base × multiplier × credit; VHP added after the card is credited own ÷ eff; outside the 1-hour band is void (a miss)", () => {
  const card = BR.cardFor(L0, LOCK, T_X);
  const s = chain.who[X - FROM], sc = BR.scoreTarget(card, L0, X, s);
  const m = BR.multiplierOf(card, s);
  if (m !== null) {
    assert.equal(sc.void, false); assert.equal(sc.credit, Mn, "VHP at X at or below the card's size: credit 1");
    assert.equal(sc.points, Number((100n * m) / Mn), "base 100 × multiplier");
    assert.ok(sc.points >= 100 && sc.points <= 12000);
  }
  // add 20% to a mid producer after the card (inside the 25% band): credited own ÷ eff, so the add gains nothing
  const who = P[5], own = BigInt(card.producers.find((p) => p.a === who).own);
  const up = R.ledger(timeline([{ h: card.T + 10, a: who, v: own / 5n }]));
  const c2 = BR.cardFor(up, LOCK, T_X);
  assert.equal(c2.producers.find((p) => p.a === who).own, card.producers.find((p) => p.a === who).own, "the card is made before the add");
  const s2 = BR.scoreTarget(c2, up, X, who);
  assert.equal(s2.void, false); assert.ok(s2.credit < Mn && s2.credit > 800000n, "credit ≈ 1 ÷ 1.2");
  assert.equal(s2.points, Number((100n * s2.multiplier * s2.credit) / (Mn * Mn)));
  // remove 10% after the card (more than the 5% down band): void, a miss
  const down = R.ledger(timeline([{ h: card.T + 10, a: who, v: -own / 10n }]));
  const s3 = BR.scoreTarget(BR.cardFor(down, LOCK, T_X), down, X, who);
  assert.equal(s3.void, true); assert.equal(s3.points, 0);
  // add 30% (more than the 25% up band): void too
  const big = R.ledger(timeline([{ h: card.T + 10, a: who, v: (own * 3n) / 10n }]));
  assert.equal(BR.scoreTarget(BR.cardFor(big, LOCK, T_X), big, X, who).void, true);
  // no entry: a miss
  const small = card.producers.find((p) => !p.entry);
  assert.deepEqual([BR.scoreTarget(card, L0, X, small.a).points, BR.scoreTarget(card, L0, X, small.a).void], [0, false]);
});

test("the switch is read strictly: empty = off; a plain week number; week N − 1 shadow, on from N", () => {
  assert.equal(BR.switchFrom(""), null); assert.equal(BR.switchFrom("6"), 6);
  for (const bad of ["06", " 6", "x", "0", "-1", "6.0"]) assert.throws(() => BR.switchFrom(bad), /ruler switch/, JSON.stringify(bad));
  assert.deepEqual([4, 5, 6, 7].map((w) => BR.modeOf(w, 6)), ["off", "shadow", "on", "on"]);
  assert.equal(BR.modeOf(9, null), "off");
});
