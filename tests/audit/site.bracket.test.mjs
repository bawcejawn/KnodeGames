// Producer Bracket (bracket-math.js, shared by bracket.js and the recorder bot/games/bracket.ts): the week's timing
// (D-141: seeding Sunday, lock Monday 23:55, one round a day, final Saturday), bracket size from the field (8 / 16 /
// 32, the largest that fits), the one-number pick (encode/decode, invalid numbers), the day index from exact VHP,
// forfeits on the day's average and the pooled rate index (#E-3 H-4, H-5), tie → underdog, results, scoring and
// ranking, and fairness end to end. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const read = (f) => fs.readFileSync(`${APP}/${f}`, "utf8");
const box = { window: {} };
vm.runInNewContext(read("race-math.js"), box);
vm.runInNewContext(read("vhp-standard.js"), box);
vm.runInNewContext(read("bracket-math.js"), box);
const R = box.window.KRaceMath, M = box.window.KBracketMath;
const plain = (x) => JSON.parse(JSON.stringify(x));
const U = (s) => Date.parse(s), H = 3600000;
const dep = JSON.parse(fs.readFileSync(`${APP}/game-data/deployment.json`, "utf8"));
const addr = (i) => `1Producer${String(i).padStart(3, "0")}xxxxxxxxxxxxxxxx`;
const cardOf = (vhps, paddock = []) => ({ field: vhps.map((v, i) => ({ a: addr(i + 1), vhp: v })), paddock: paddock.map((v, i) => ({ a: addr(900 + i), vhp: v })) });

// ── timing ──
test("the week (D-141): seeding Sunday 00:00, lock Monday 23:55 UTC, one round a day with the final on Saturday", () => {
  assert.equal(M.GENESIS, dep.genesisTime); assert.equal(M.WEEK, dep.weekLength); assert.equal(M.GENESIS, R.GENESIS);
  for (const w of [1, 2, 3, 52]) assert.equal(M.weekStart(w), R.weekStart(w));
  assert.equal(new Date(M.seedTime(3)).toISOString(), "2026-11-08T00:00:00.000Z", "Sunday before the week");
  assert.equal(new Date(M.lockTime(3)).toISOString(), "2026-11-09T23:55:00.000Z", "Monday 23:55 UTC");
  assert.equal(M.lockTime(3) - M.seedTime(3), 48 * H - 5 * 60000, "about 48 hours to pick");
  const days = (size) => Array.from({ length: M.roundsOf(size) }, (_, r) => new Date(M.roundDay(3, r, size)).getUTCDay());
  assert.deepEqual(days(32), [2, 3, 4, 5, 6], "32: Tuesday → Saturday");
  assert.deepEqual(days(16), [3, 4, 5, 6], "16: Wednesday → Saturday");
  assert.deepEqual(days(8), [4, 5, 6], "8: Thursday → Saturday");
  for (const size of [8, 16, 32]) {
    assert.ok(M.roundDay(3, 0, size) >= M.lockTime(3) + 5 * 60000, "the first round starts after the lock");
    assert.ok(M.roundDay(3, M.roundsOf(size) - 1, size) + 24 * H <= M.weekStart(4) - 24 * H, "nothing is played on Sunday, the review day");
  }
  assert.equal(M.finalFrom(3), M.weekStart(4), "final no earlier than Monday 00:00 UTC after the week (WEEK_CYCLE.md)");
});

test("the Picks round for a week targets Tuesday 00:00 UTC of that week (lock = target − 5 min, opens ≤ 48 h before)", () => {
  assert.ok(M.ROUND_OFFSET >= 0 && M.ROUND_OFFSET < M.WEEK, "the Picks contract needs round_offset < round_size");
  for (const w of [0, 1, 2, 10, 500]) {
    const r = M.picksRound(w);
    assert.equal(r * M.WEEK + M.ROUND_OFFSET, M.weekStart(w) + 24 * H);
    assert.equal(M.weekOfPicksRound(r), w);
    assert.equal(r * M.WEEK + M.ROUND_OFFSET - M.LOCK_BEFORE, M.lockTime(w));
    assert.equal(r * M.WEEK + M.ROUND_OFFSET - 48 * H, M.seedTime(w), "an `ahead` of 48 h opens picks at the seeding");
  }
  assert.ok(M.LOCK_BEFORE >= 300000, "the contract's minimum time lead is 5 minutes");
});

// ── shape ──
test("bracket size: the largest power of two that fits (D-141): <8 none, 8–15 → 8, 16–31 → 16, 32+ → 32 (also at 50)", () => {
  const want = (n) => (n < 8 ? 0 : n < 16 ? 8 : n < 32 ? 16 : 32);
  for (let n = 0; n <= 60; n++) assert.equal(M.sizeFor(n), want(n), `field ${n}`);
  assert.deepEqual([8, 16, 32].map(M.roundsOf), [3, 4, 5]);
  assert.deepEqual([0, 8, 16, 32].map(M.maxPoints), [0, 14, 34, 82]);
  assert.ok(M.maxPoints(32) <= 255, "fits the vault's 1–255 points");
  assert.equal(M.NUMBER_MAX, 2 ** 31 - 1, "the Picks number range covers a 32-bracket from launch");
});

test("line order: a standard bracket where seeds 1 and 2 can only meet in the final", () => {
  for (const size of [8, 16, 32]) {
    const o = M.lineOrder(size);
    assert.deepEqual([...o].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i + 1), "every seed once");
    for (let i = 0; i < size; i += 2) assert.equal(o[i] + o[i + 1], size + 1, "round 1 pairs s v size+1−s");
    assert.ok(o.slice(0, size / 2).includes(1) && o.slice(size / 2).includes(2), "1 and 2 in opposite halves");
    const q = size / 4;   // top 4 seeds in different quarters
    assert.deepEqual([0, 1, 2, 3].map((k) => o.slice(k * q, (k + 1) * q).filter((s) => s <= 4).length), [1, 1, 1, 1]);
    // with every better seed winning, the semifinal four are seeds 1–4
    const chalk = M.play(size, size, () => false).rounds;
    assert.deepEqual([...chalk[M.roundsOf(size) - 3]].sort((a, b) => a - b), [1, 2, 3, 4]);
  }
});

test("seeding from a race card: by VHP, ties by address, paddock and bad rows left out", () => {
  // today's shape: 17 in the field → the top 16, the 17th sits out
  const s17 = M.seeding(cardOf(Array.from({ length: 17 }, (_, i) => 1000 - i), [5, 3]));
  assert.equal(s17.size, 16); assert.equal(s17.seeds.length, 16); assert.deepEqual(plain(s17.out), [addr(17)]);
  assert.equal(s17.seeds[0], addr(1));
  const tie = M.seeding({ field: [{ a: "1B", vhp: 5 }, { a: "1A", vhp: 5 }, ...Array.from({ length: 8 }, (_, i) => ({ a: addr(i), vhp: 1 }))] });
  assert.deepEqual(plain(tie.seeds.slice(0, 2)), ["1A", "1B"]);
  const bad = M.seeding({ field: [{ a: addr(1), vhp: 9 }, { a: addr(1), vhp: 9 }, { a: 7, vhp: 9 }, { a: addr(2), vhp: -1 }, { a: addr(3), vhp: NaN }, null] });
  assert.equal(bad.size, 0); assert.equal(bad.seeds.length, 0, "a field of 1 is no bracket");
  assert.equal(M.seeding(null).size, 0);
  // 13 → the top 8 (no byes, D-141); 5 sit out
  const s13 = M.seeding(cardOf(Array.from({ length: 13 }, (_, i) => 100 - i)));
  assert.equal(s13.size, 8); assert.equal(s13.seeds.length, 8); assert.equal(s13.out.length, 5);
  assert.deepEqual(plain(s13.vhp), [100, 99, 98, 97, 96, 95, 94, 93], "each seed's seeding VHP, in seed order");
  // 50 → 32 producers, 18 out
  const s50 = M.seeding(cardOf(Array.from({ length: 50 }, (_, i) => 5000 - i)));
  assert.equal(s50.size, 32); assert.equal(s50.seeds.length, 32); assert.equal(s50.out.length, 18);
  // 7 → no bracket
  assert.equal(M.seeding(cardOf([7, 6, 5, 4, 3, 2, 1])).size, 0);
});

test("#E-3 M-6: a producer's seeding VHP is the lower of its average now and at last week's seeding (a one-day loan buys nothing)", () => {
  const vhps = Array.from({ length: 17 }, (_, i) => 1000 - i * 10);
  // addr(17) borrows 5,000 VHP for the seeding day: on today's average it would be seed 1
  const today = cardOf(vhps.map((v, i) => (i === 16 ? v + 5000 : v)));
  const last = Object.fromEntries(vhps.map((v, i) => [addr(i + 1), v]));
  assert.equal(M.seeding(today).seeds[0], addr(17), "without last week's numbers the loan works");
  const s = M.seeding(today, last);
  assert.ok(!s.seeds.includes(addr(17)), "with them it is seeded on its own VHP: 17th, out of the 16");
  assert.deepEqual(plain(s.out), [addr(17)]);
  // a producer new this week is seeded on today's average; a producer that grew is seeded on last week's
  const grew = M.seeding(cardOf(vhps.map((v, i) => (i === 3 ? v * 2 : v))), last);
  assert.equal(grew.vhp[grew.seeds.indexOf(addr(4))], vhps[3]);
  // fix-check RC-1: an address missing from the last seeding counts 0 there (moving VHP to a fresh address buys nothing);
  // only with no last seeding at all (the first bracket) is today's average used alone
  const fresh = M.seeding(today, { ...last, [addr(17)]: undefined });
  assert.ok(!fresh.seeds.includes(addr(17)) && !fresh.out.includes(addr(17)), "a fresh address: out of the field");
  assert.equal(M.seeding(today, {}).seeds[0], addr(17), "the first bracket ever: today's average");
  // the field rule (≥ 10 expected blocks in a 6-hour race) is applied to the lower number
  const tiny = cardOf([...vhps.slice(0, 15), 900, 900], []);
  const lastTiny = { ...last, [addr(16)]: 1, [addr(17)]: 1 };
  assert.equal(M.seeding(tiny, lastTiny).size, 8, "two producers that were tiny last week drop out of the field: 15 → the top 8");
});

// ── the one-number pick ──
function consistent(rounds, size, n) {
  const fr = M.firstRound(size, n);
  for (let m = 0; m < fr.length; m++) assert.ok(fr[m].includes(rounds[0][m]) && rounds[0][m] !== 0);
  for (let r = 1; r < rounds.length; r++) for (let m = 0; m < rounds[r].length; m++) assert.ok([rounds[r - 1][2 * m], rounds[r - 1][2 * m + 1]].includes(rounds[r][m]));
}
test("every number in range is one whole, consistent bracket and encodes back to itself (8 and 16: all of them)", () => {
  for (const size of [8, 16]) {
    const seen = new Set();
    for (let x = 0; x < 2 ** (size - 1); x++) {
      const d = M.decode(x, size, size); assert.ok(d, `${size}: ${x}`);
      const rounds = plain(d.rounds); consistent(rounds, size, size);
      assert.equal(M.encode(rounds, size, size), x);
      seen.add(JSON.stringify(rounds));
    }
    assert.equal(seen.size, 2 ** (size - 1), "different numbers are different brackets");
  }
  const rnd = R.rng(9);
  for (let i = 0; i < 3000; i++) {
    const x = i === 0 ? M.NUMBER_MAX : i === 1 ? 0 : Math.floor(rnd.next() * 2 ** 31);
    const d = M.decode(x, 32, 32); assert.ok(d); const rounds = plain(d.rounds); consistent(rounds, 32, 32);
    assert.equal(M.encode(rounds, 32, 32), x);
  }
});

test("invalid numbers score nothing: too big for the bracket, bits on a bye, not a whole number", () => {
  assert.equal(M.decode(2 ** 15, 16, 16), null); assert.ok(M.decode(2 ** 15 - 1, 16, 16));
  assert.equal(M.decode(2 ** 7, 8, 8), null);
  assert.equal(M.decode(2 ** 31, 32, 32), null);
  for (const x of [-1, 1.5, NaN, Infinity, "5", null, undefined, 2 ** 60]) assert.equal(M.decode(x, 16, 16), null, String(x));
  assert.equal(M.decode(0, 0, 0), null, "no bracket this week");
  // 13 seeds: byes on matchups 0, 4 and 7; their bits must be 0
  const byes = plain(M.byesOf(16, 13)); assert.deepEqual(byes, [0, 4, 7]);
  for (const b of byes) assert.equal(M.decode(2 ** b, 16, 13), null);
  let valid = 0; for (let x = 0; x < 2 ** 15; x++) if (M.decode(x, 16, 13)) valid++;
  assert.equal(valid, 2 ** 12, "one valid number per bracket");
  // a bye seed always advances in round 1
  for (let x = 0; x < 2 ** 15; x += 97) { const d = M.decode(x, 16, 13); if (d) for (const s of [1, 2, 3]) assert.ok(d.rounds[0].includes(s)); }
  assert.throws(() => M.encode([[1]], 16, 16), /winner must be/);
});

// ── the day index: exact VHP, block by block (option A, owner decision 2026-10-28) ──
const DAY0 = U("2026-11-02T00:00:00Z"), E8 = 1e8;
/** A made-up chain. vhp: { address: VHP }, each block's signer drawn by VHP (seeded), every block burns VHP of its
 *  signer's at mainnet's rate (4 VHP a block on ~12 million VHP, scaled to this network); moves: [{ at: block index, a, d (VHP) }] applied in that block; offline(a, i) → true to skip a producer.
 *  Starts ACTIVE_BLOCKS blocks before DAY0 + startHour, 3 s a block. Returns { B, deltas, anchors (after the last block) }. */
function fakeChain(vhp, { hours = 24, seed = 7, moves = [], offline = () => false, h0 = 50_000_000, startHour = 0, luck = null } = {}) {
  const rnd = R.rng(seed), names = Object.keys(vhp), bal = new Map(names.map((a) => [a, vhp[a] * E8]));
  const burn = Math.round(4 * E8 * Object.values(vhp).reduce((t, v) => t + v, 0) / 12e6);
  const pre = M.ACTIVE_BLOCKS, n = pre + hours * 1200 + 1, t0 = DAY0 + startHour * H - pre * 3000;   // + the block after the last hour
  const hs = [], ts = [], sig = [], deltas = [];
  for (let i = 0; i < n; i++) {
    const h = h0 + i;
    for (const mv of moves) if (mv.at === i) { bal.set(mv.a, bal.get(mv.a) + mv.d * E8); deltas.push({ h, a: mv.a, d: mv.d * E8 }); }
    const live = names.filter((a) => !offline(a, i) && bal.get(a) > 0), tot = live.reduce((t, a) => t + bal.get(a), 0);
    let x = (luck ? luck(i) : rnd.next()) * tot, s = live[live.length - 1];
    for (const a of live) { x -= bal.get(a); if (x < 0) { s = a; break; } }
    hs.push(h); ts.push(t0 + i * 3000); sig.push(names.indexOf(s));
    bal.set(s, bal.get(s) - burn); deltas.push({ h, a: s, d: -burn });
  }
  const anchors = Object.fromEntries(names.map((a) => [a, { h: h0 + n - 1, v: bal.get(a) }]));
  return { B: { hs, ts, sig, signers: names }, deltas, anchors, n, h0 };
}
test("VHP events become balance changes: transfers both ways, mints in, burns out; others ignored", () => {
  const V = M.VHP_CONTRACT;
  const d = plain(M.vhpDeltas([
    { h: 5, src: V, name: "token.transfer_event", from: "1A", to: "1B", value: "300" },
    { h: 6, src: V, name: "token.mint_event", to: "1A", value: "50" },
    { h: 7, src: V, name: "token.burn_event", from: "1B", value: "20" },
    { h: 8, src: V, name: "token.approve_event", from: "1B", value: "999" },
    { h: 9, src: "1Other", name: "token.mint_event", to: "1A", value: "77" },
    { h: 10, src: V, name: "token.mint_event", to: "1A", value: "-1" },
  ]));
  assert.deepEqual(d, [{ h: 5, a: "1A", d: -300 }, { h: 5, a: "1B", d: 300 }, { h: 6, a: "1A", d: 50 }, { h: 7, a: "1B", d: -20 }]);
});
test("the VHP book: a balance read at one block, walked back and forward exactly", () => {
  const book = M.vhpBook({ "1A": { h: 100, v: 1000 } }, [{ h: 90, a: "1A", d: -4 }, { h: 100, a: "1A", d: -4 }, { h: 101, a: "1A", d: 50 }, { h: 95, a: "1Z", d: 7 }]);
  assert.equal(book.before("1A", 101), 1000, "before block 101 = after block 100 = the reading");
  assert.equal(book.before("1A", 100), 1004, "block 100's burn walked back");
  assert.equal(book.before("1A", 91), 1004); assert.equal(book.before("1A", 90), 1008);
  assert.equal(book.before("1A", 102), 1050, "forward past the reading");
  assert.equal(book.before("1Z", 100), null, "no reading, no balance");
});
test("expected blocks follow exact VHP: a producer signing its share scores ≈1 whatever its size; the burns are followed", () => {
  const vhp = { "1Big": 2_000_000, "1Mid": 600_000, "1Sml": 20_000, "1Tiny": 5_000, "1Rest": 2_400_000 };
  const { B, deltas, anchors } = fakeChain(vhp, { seed: 11 });
  const book = M.vhpBook(anchors, deltas);
  const idx = M.dayIndex(B, DAY0, Object.keys(vhp), book);
  const totalExp = [...idx.values()].reduce((t, r) => t + r.expected, 0);
  // baselines are taken at the day's start, before the day's burns (~1% of all VHP a day, the same share for everyone)
  assert.ok(totalExp / (24 * 1200) - 1 > 0 && totalExp / (24 * 1200) - 1 < 0.012, `expected adds up to the blocks of the day plus half a day's burns (${totalExp})`);
  for (const a of ["1Big", "1Mid"]) assert.ok(Math.abs(idx.get(a).index - 1) < 0.05, `${a} ${idx.get(a).index}`);
  assert.ok(Math.abs(idx.get("1Sml").index - 1) < 0.25, `small ${idx.get("1Sml").index}`);
  // hour records are contiguous and count every block once
  const hrs = M.exactHours(B, Array.from({ length: 24 }, (_, h) => DAY0 + h * H), Object.keys(vhp), book);
  for (let h = 1; h < 24; h++) assert.equal(hrs[h].from, hrs[h - 1].to + 1);
  assert.equal(hrs.reduce((t, x) => t + x.n, 0), 24 * 1200);
  assert.equal(M.indexFromHours(hrs.slice(0, 23)), null, "not every hour in: no result");
  assert.ok(M.indexSoFar(hrs.slice(0, 6)).get("1Big").expected > 0, "the live view works with part of the day");
});
test("moving VHP away and back (or adding it) gains nothing: expected follows the VHP block by block", () => {
  const vhp = { "1Fav": 100_000, "1Dog": 20_000, "1Rest": 880_000 };
  // the dog parks 19,800 of its VHP in another wallet for one block at the top of every hour, then takes it back
  const moves = [];
  for (let h = 0; h < 24; h++) { const i = M.ACTIVE_BLOCKS + h * 1200; moves.push({ at: i, a: "1Dog", d: -19_800 }, { at: i + 1, a: "1Dog", d: 19_800 }); }
  const { B, deltas, anchors } = fakeChain(vhp, { seed: 3, moves });
  const idx = M.dayIndex(B, DAY0, ["1Fav", "1Dog"], M.vhpBook(anchors, deltas));
  assert.ok(Math.abs(idx.get("1Dog").index - 1) < 0.2, `dog ${idx.get("1Dog").index}`);
  // its expected blocks are within 0.1% of never having moved anything (2 blocks of 1,200 an hour)
  const still = fakeChain(vhp, { seed: 3 }), idx2 = M.dayIndex(still.B, DAY0, ["1Dog"], M.vhpBook(still.anchors, still.deltas));
  assert.ok(Math.abs(idx.get("1Dog").expected / idx2.get("1Dog").expected - 1) < 0.002);
  // VHP added mid-day (burning KOIN, or sent by anyone) is neutral: blocks signed above the baseline count baseline ÷ VHP
  let sumUp = 0, sumSame = 0;
  for (let d = 0; d < 12; d++) {
    const up = fakeChain(vhp, { seed: 50 + d, moves: [{ at: M.ACTIVE_BLOCKS + 6 * 1200, a: "1Dog", d: 200_000 }] });
    sumUp += M.dayIndex(up.B, DAY0, ["1Dog"], M.vhpBook(up.anchors, up.deltas)).get("1Dog").index;
    const same = fakeChain(vhp, { seed: 50 + d });
    sumSame += M.dayIndex(same.B, DAY0, ["1Dog"], M.vhpBook(same.anchors, same.deltas)).get("1Dog").index;
  }
  assert.ok(Math.abs(sumUp / 12 - 1) < 0.06, `after adding VHP: mean index ${(sumUp / 12).toFixed(3)} (neutral)`);
  assert.ok(Math.abs(sumSame / 12 - 1) < 0.06, `unchanged: mean index ${(sumSame / 12).toFixed(3)}`);
});
test("audit A-1: holding VHP only while a stopped producer still counts as active doesn't pay (it did before)", () => {
  // a 20% producer stops at 06:00 and still counts as active for the next 7,200 blocks; the seed holds its VHP in its
  // producing address only during those 6 hours, elsewhere the rest of the day
  const vhp = { "1Seed": 50_000, "1Opp": 50_000, "1Dead": 250_000, "1Rest": 900_000 };
  const s0 = M.ACTIVE_BLOCKS + 6 * 1200, s1 = s0 + M.ACTIVE_BLOCKS;
  const moves = [{ at: 0, a: "1Seed", d: -49_000 }, { at: s0, a: "1Seed", d: 49_000 }, { at: s1, a: "1Seed", d: -49_000 }];
  let ahead = 0, sum = 0, sumOpp = 0; const N = 40;
  for (let d = 0; d < N; d++) {
    const c = fakeChain(vhp, { seed: 500 + d, moves, offline: (a, i) => a === "1Dead" && i >= s0 });
    const idx = M.dayIndex(c.B, DAY0, ["1Seed", "1Opp"], M.vhpBook(c.anchors, c.deltas));
    sum += idx.get("1Seed").index; sumOpp += idx.get("1Opp").index; if (idx.get("1Seed").index > idx.get("1Opp").index) ahead++;
  }
  // its baseline is the 1,000 VHP it held at 00:00: the blocks it signs with 50,000 count 1/50 each, so the 6 hours of
  // "cheap" blocks earn it exactly what an honest producer earns (before the fix it was ahead on 40 of 40 days)
  assert.ok(Math.abs(sum / N - sumOpp / N) < 0.15, `timing seed ${(sum / N).toFixed(3)} vs honest ${(sumOpp / N).toFixed(3)}`);
  assert.ok(ahead < N * 0.75, `ahead of an honest opponent on ${ahead} of ${N} days`);
});
test("audit G-1: VHP sent to a seed late in its day (a gift) neither lowers nor raises its index", () => {
  const vhp = { "1Target": 50_000, "1Opp": 50_000, "1Rest": 900_000 };
  const late = M.ACTIVE_BLOCKS + 23 * 1200;   // 23:00
  let withGift = 0, without = 0; const N = 30;
  for (let d = 0; d < N; d++) {
    const g = fakeChain(vhp, { seed: 900 + d, moves: [{ at: late, a: "1Target", d: 5_000 }] });
    const p = fakeChain(vhp, { seed: 900 + d });
    withGift += M.dayIndex(g.B, DAY0, ["1Target"], M.vhpBook(g.anchors, g.deltas)).get("1Target").index;
    without += M.dayIndex(p.B, DAY0, ["1Target"], M.vhpBook(p.anchors, p.deltas)).get("1Target").index;
  }
  // the same random days: the gift only changes the last hour, and blocks signed above the baseline count baseline ÷ VHP
  assert.ok(Math.abs(withGift / N - without / N) < 0.01, `with a 10% gift at 23:00 ${(withGift / N).toFixed(4)}, without ${(without / N).toFixed(4)}`);
});
test("a seed that goes offline is still expected to sign by its VHP, and loses", () => {
  const vhp = { "1Fav": 100_000, "1Dog": 20_000, "1Rest": 880_000 };
  // offline all day except the last 2 hours (it drops out of the active set, but keeps its VHP)
  const off = fakeChain(vhp, { seed: 9, offline: (a, i) => a === "1Dog" && i < M.ACTIVE_BLOCKS + 22 * 1200 });
  const idx = M.dayIndex(off.B, DAY0, ["1Fav", "1Dog"], M.vhpBook(off.anchors, off.deltas));
  assert.ok(idx.get("1Dog").expected > 0.015 * 24 * 1200, "expected all day, not only while active");
  assert.ok(idx.get("1Dog").index < 0.2, `dog ${idx.get("1Dog").index}`);
  assert.equal(M.otherWins(idx, "1Fav", "1Dog"), false);
});
test("#E-3 H-4: deposits in and out of the vault around 00:00 can't make the Knode Games Pool lose (its rate index)", () => {
  // the review's attack: the pool and its opponent at 100 VHP each, +900 deposited 100 blocks before 00:00, withdrawn at 00:00
  const vhp = { "1Pool": 100, "1Opp": 100, "1Rest": 2000 };
  const moves = [{ at: M.ACTIVE_BLOCKS - 100, a: "1Pool", d: 900 }, { at: M.ACTIVE_BLOCKS, a: "1Pool", d: -900 }];
  const sv = new Map([["1Pool", 100], ["1Opp", 100]]), pooled = new Set(["1Pool"]);
  let lostOld = 0, lostNew = 0, sumRate = 0; const N = 20;
  for (let d = 0; d < N; d++) {
    const c = fakeChain(vhp, { seed: 700 + d, moves });
    const idx = M.dayIndex(c.B, DAY0, ["1Pool", "1Opp"], M.vhpBook(c.anchors, c.deltas));
    if (M.otherWins(idx, "1Pool", "1Opp", sv, new Set())) lostOld++;   // as an ordinary producer (the old rule)
    if (M.otherWins(idx, "1Pool", "1Opp", sv, pooled)) lostNew++;
    sumRate += M.indexOf(idx.get("1Pool"), true);
  }
  assert.ok(lostOld >= N - 1, `as an ordinary producer the attack wins (${lostOld} of ${N}): its baseline has the deposit in it`);
  assert.ok(lostNew > 3 && lostNew < N - 3, `as a pooled producer it's a fair matchup again: lost ${lostNew} of ${N}`);
  assert.ok(Math.abs(sumRate / N - 1) < 0.15, `its rate index averages about 1 (${(sumRate / N).toFixed(3)})`);
});
test("#E-3 H-5: moving VHP away for the block at 00:00 no longer forfeits (judged on the day's average)", () => {
  // the review's attack: −60 VHP of 100 one block before 00:00, back at 00:00 (back VHP counts after 20 blocks)
  const vhp = { "1Fav": 100, "1Dog": 100, "1Rest": 2000 };
  const moves = [{ at: M.ACTIVE_BLOCKS - 1, a: "1Fav", d: -60 }, { at: M.ACTIVE_BLOCKS, a: "1Fav", d: 60 }];
  const sv = new Map([["1Fav", 100], ["1Dog", 100]]);
  let forfeits = 0, lost = 0; const N = 20;
  for (let d = 0; d < N; d++) {
    const c = fakeChain(vhp, { seed: 800 + d, moves });
    const idx = M.dayIndex(c.B, DAY0, ["1Fav", "1Dog"], M.vhpBook(c.anchors, c.deltas));
    assert.ok(idx.get("1Fav").baseline < 0.5 * 100e8, "its baseline at 00:00 is under half (the old rule forfeited here)");
    if (M.forfeits(idx.get("1Fav"), 100)) forfeits++;
    if (M.otherWins(idx, "1Fav", "1Dog", sv)) lost++;
  }
  assert.equal(forfeits, 0, "the day's average is near its full VHP: no forfeit");
  assert.ok(lost < N - 3, `so it doesn't lose for sure (${lost} of ${N})`);
  // a real day under half still forfeits
  const under = fakeChain(vhp, { seed: 1, moves: [{ at: M.ACTIVE_BLOCKS - 1, a: "1Fav", d: -60 }] });
  assert.equal(M.forfeits(M.dayIndex(under.B, DAY0, ["1Fav"], M.vhpBook(under.anchors, under.deltas)).get("1Fav"), 100), true, "a whole day at 40% of its seeding VHP forfeits");
});
test("fix-check B-1: the forfeit line is exact, whatever the size (sums past 2^53), and strictly under half", () => {
  // the reviewer's shape: a seed holding V satoshi all day, about 1,200 blocks an hour, seeding VHP up to 50 million
  let r = 7, mism = 0, trials = 0;
  const rnd = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
  for (let t = 0; t < 3000; t++) {
    const vhp = Math.round((1e5 + rnd() * 5e7) * 100) / 100, seedSat = BigInt(Math.round(vhp * 100)) * 1000000n;
    const ns = Array.from({ length: 24 }, () => 1150 + Math.floor(rnd() * 100));
    for (const V of [seedSat / 2n - 1n, seedSat / 2n, seedSat / 2n + (seedSat % 2n), seedSat / 2n + 1n]) {
      const hours = ns.map((n) => ({ from: 0, to: n - 1, n, by: { A: 0 }, cr: { A: 0 }, w: { A: Number(V) }, q: 1, r: { A: 0 }, av: { A: Number(V) } }));
      const want = 2n * BigInt(Number(V)) < seedSat;   // the line in exact integers (V as JSON carries it)
      trials++; if (M.forfeits(M.indexFromHours(hours).get("A"), vhp) !== want) mism++;
    }
  }
  assert.equal(mism, 0, `${mism} of ${trials} threshold cases on the wrong side`);
  // exactly half never forfeits; one satoshi under in one hour does
  const at = (v, low) => Array.from({ length: 24 }, (_, h) => ({ from: 0, to: 1199, n: 1200, by: {}, cr: {}, w: { A: v }, q: 1, r: {}, av: { A: h === 0 ? v - low : v } }));
  assert.equal(M.forfeits(M.indexFromHours(at(25_000_000e8, 0)).get("A"), 50_000_000), false, "exactly half: no forfeit");
  assert.equal(M.forfeits(M.indexFromHours(at(25_000_000e8, 1)).get("A"), 50_000_000), true, "a satoshi under: forfeit");
});
test("a balance missing for an active producer stops the hour (never guessed)", () => {
  const { B, deltas, anchors } = fakeChain({ "1A": 1000, "1B": 1000 }, { hours: 1 });
  delete anchors["1B"];
  assert.throws(() => M.exactHours(B, [DAY0], ["1A"], M.vhpBook(anchors, deltas)), /no VHP balance for 1B/);
});
test("a matchup: higher index advances, an exact tie goes to the lower seed", () => {
  const idx = new Map([["1A", { blocks: 50, expected: 100 }], ["1B", { blocks: 5, expected: 10 }], ["1C", { blocks: 6, expected: 10 }], ["1Z", { blocks: 0, expected: 0 }]]);
  assert.equal(M.otherWins(idx, "1A", "1B"), true, "0.5 v 0.5: underdog");
  assert.equal(M.otherWins(idx, "1A", "1C"), true);
  assert.equal(M.otherWins(idx, "1C", "1A"), false);
  assert.equal(M.otherWins(idx, "1A", "1Z"), false, "an underdog with nothing expected can't win");
  assert.equal(M.otherWins(idx, "1Z", "1A"), true);
  assert.equal(M.otherWins(idx, "1Q", "1Z"), true, "both nothing: underdog");
  assert.equal(M.otherWins(idx, "1A", "1Q"), false, "a producer missing from the day counts as 0 blocks");
  const zero = new Map([["1A", { blocks: 0, expected: 100 }], ["1B", { blocks: 0, expected: 5 }]]);
  assert.equal(M.otherWins(zero, "1A", "1B"), true, "both offline all day: underdog");
});

// ── results, scoring, ranking ──
function weekDays(seeds, rule) { // rule(day, address) → index; builds a Map per round day
  return Array.from({ length: 5 }, (_, d) => new Map(seeds.map((a, i) => [a, { blocks: rule(d, i + 1) * 1000, expected: 1000 }])));
}
test("results, a perfect bracket scores the maximum, champion bonus only once the final is known", () => {
  for (const [size, n] of [[8, 9], [16, 16], [8, 13], [32, 40]]) {
    const s = M.seeding(cardOf(Array.from({ length: n }, (_, i) => 10000 - i)));
    assert.equal(s.size, size);
    const days = weekDays(s.seeds, (d, seed) => ((seed * 7 + d * 3) % 11) + 1);
    const res = M.results(s.seeds, s.size, days.slice(0, M.roundsOf(size)));
    assert.equal(res.done, true); assert.equal(res.rounds.length, M.roundsOf(size));
    const perfect = { rounds: plain(res.rounds) };
    const byes = M.byesOf(size, s.seeds.length).length;
    const sc = M.score(perfect, res, size, s.seeds.length);
    assert.equal(sc.points, M.maxPoints(size) - byes, `${size}/${n}: byes score nothing`);
    assert.equal(sc.champion, true);
    // the same pick as a number round-trips
    const x = M.encode(perfect.rounds, size, s.seeds.length);
    assert.deepEqual(plain(M.decode(x, size, s.seeds.length)), perfect);
    // partway through the week: no champion bonus yet
    const part = M.results(s.seeds, s.size, [days[0], days[1], null]);
    assert.equal(part.done, false); assert.equal(part.rounds.length, 2);
    const ps = M.score(perfect, part, size, s.seeds.length);
    assert.equal(ps.champion, false); assert.equal(ps.points, size / 2 - byes + size / 2);
  }
  // an invalid pick scores 0
  assert.deepEqual(plain(M.score(null, { rounds: [[1]], done: true }, 16, 16)), { points: 0, correct: 0, champion: false });
});

test("a later-round pick on a producer already knocked out scores 0 for that round", () => {
  const s = M.seeding(cardOf(Array.from({ length: 16 }, (_, i) => 100 - i)));
  const days = weekDays(s.seeds, (d, seed) => (seed === 1 ? 0.1 : 1)); // seed 1 is offline all week: loses round 1
  const res = M.results(s.seeds, 16, days.slice(0, 4));
  assert.ok(!res.rounds[0].includes(1));
  const chalk = M.decode(0, 16, 16);   // picks seed 1 all the way
  const sc = M.score(chalk, res, 16, 16);
  assert.equal(sc.champion, false);
  for (let r = 0; r < 4; r++) assert.notEqual(res.rounds[r][0], 1);
});

test("ranking: points, then a correct champion, then more correct winners; ties share a place", () => {
  const rows = [
    { player: "1d", points: 20, champion: false, correct: 9 },
    { player: "1a", points: 20, champion: true, correct: 7 },
    { player: "1c", points: 20, champion: false, correct: 9 },
    { player: "1b", points: 25, champion: false, correct: 6 },
    { player: "1e", points: 3, champion: false, correct: 3 },
  ];
  const r = plain(M.rank(rows));
  assert.deepEqual(r.map((x) => [x.player, x.place]), [["1b", 1], ["1a", 2], ["1c", 3], ["1d", 3], ["1e", 5]]);
  assert.equal(rows[0].place, undefined, "doesn't change its input");
});

// ── fairness end to end ──
test("exact VHP on a made-up chain shaped like today's field: 1 v 16 and 8 v 9 stay near 50/50", () => {
  // the 17 producers on the 2026-10-27 card (VHP), every one online and signing by VHP
  const vhps = [2182618, 1746945, 1428829, 1315361, 1152329, 861923, 724413, 671091, 637361, 609793, 200376, 120391, 106403, 99216, 62457, 21609, 20969];
  const vhp = Object.fromEntries(vhps.map((v, i) => [`1S${i + 1}`, v]));
  let w116 = 0, w89 = 0; const N = 60;
  for (let d = 0; d < N; d++) {
    const c = fakeChain(vhp, { seed: 1000 + d });
    const idx = M.dayIndex(c.B, DAY0, ["1S1", "1S16", "1S8", "1S9"], M.vhpBook(c.anchors, c.deltas));
    if (M.otherWins(idx, "1S1", "1S16")) w116++;
    if (M.otherWins(idx, "1S8", "1S9")) w89++;
  }
  assert.ok(w116 / N > 0.3 && w116 / N < 0.7, `seed 16 beat seed 1 on ${w116} of ${N} days`);
  assert.ok(w89 / N > 0.3 && w89 / N < 0.7, `seed 9 beat seed 8 on ${w89} of ${N} days`);
});

// ── page rules ──
test("the shared math is read only and has no betting words", () => {
  const src = read("bracket-math.js");
  assert.doesNotMatch(src, /\.send\(|signTransaction|sendTransaction|fetch\(|XMLHttpRequest|localStorage/);
  assert.doesNotMatch(src, /\bodds\b|\bwager|\bbet\b|\bpays\s+\d/i);
});

// ── the page (site/bracket.html, bracket.js) ──
const page = read("bracket.html"), js = read("bracket.js");
test("the page: scripts in order, the shared board, reads only the bracket files, the block snapshot and the site", () => {
  assert.match(page, /<script src="names\.js"><\/script>\s*<script src="stake-panel\.js"><\/script>\s*<script src="vhp-standard\.js"><\/script>\s*<script src="bracket-math\.js"><\/script>\s*<script src="board\.js"><\/script>\s*<script src="bracket\.js"><\/script>/);
  assert.match(page, /<link rel="stylesheet" href="board\.css">/);
  const csp = page.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /connect-src [^;]*https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/games-data\//);
  assert.match(csp, /connect-src [^;]*https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/blocks-data\//);
  assert.doesNotMatch(page, /<script>(?!\s*<\/script>)|\son[a-z]+="/i, "no inline scripts or handlers");
  const urls = [...js.matchAll(/"(https:\/\/[^"]+)"/g)].map((m) => m[1]);
  for (const u of urls) assert.ok(/^https:\/\/(raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/(games-data\/bracket\/|blocks-data\/recent-blocks\.json)|koinos\.armana\.io|api\.koinosblocks\.com|koinosscan\.com\/address\/)$/.test(u), u);
  const body = page.slice(page.indexOf("<body>"));
  assert.doesNotMatch(body + js, /bawcejawn\/Knode\/|bawcejawn\.github\.io\/Knode|api\.koinos\.io/, "no old URLs (#E-3 L-15)");
  assert.match(js, /new URL\("picks-data\/deployment\.json", ROOT\)/);
});
test("the page builds everything with textContent and sends one thing: a pick of game 9 as one number", () => {
  // fix-check 2 W-1: the one thing kept in browser storage is the open-wallet-request lock (per account and week)
  const stored = js.match(/localStorage\.\w+\([^)]*\)?/g) || [];
  assert.deepEqual([...new Set(stored.map((x) => x.replace(/\(.*/, "")))].sort(), ["localStorage.getItem", "localStorage.setItem"], "storage only for the request lock");
  assert.ok(stored.every((x) => /\(openKey\(/.test(x)), "only under the kb-open-request key: " + stored.join(" | "));
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|sessionStorage|indexedDB/);
  const sends = [...js.matchAll(/W\.send\(/g)]; assert.equal(sends.length, 1, "one send");
  assert.match(js, /picksContract\.functions\.pick\(\{ player: frozen\.account, game: BM\.GAME_ID, round: String\(BM\.picksRound\(wk\)\), producers: \[\], number: String\(n\) \}, \{ onlyOperation: true \}\)/);
  const calls = new Set([...js.matchAll(/picksContract\.functions\.([a-z_]+)/g)].map((m) => m[1]));
  assert.deepEqual([...calls].sort(), ["get_pick", "pick"]);
  // the number sent is the one shown in the check pop-up, and it is encoded by the shared math
  assert.match(js, /const draftNumber = \(\) => \{ const s = seeding\(\); try \{ return filled\(\) \? BM\.encode\(draft, s\.size, s\.seeds\.length\) : null;/);
  assert.match(js, /btn\("Confirm in wallet", \(\) => send\(frozen\)\)/, "Confirm sends exactly what was checked (#E-3 C-2; behaviour: site.bracket-confirm)");
  assert.match(js, /const LOCK_MARGIN = 120000;/, "refuses to send within 2 minutes of the lock");
});
test("the page says what the contract and recorder do (sizes, lock, scoring, ties, own nodes)", () => {
  for (const s of ["Seeding on Sunday 00:00 UTC, picks until Monday 23:55 UTC, one round a day, the final on Saturday", "Sunday is review day: results are checked and paid from Monday.",
    "32 or more play Tuesday to Saturday, 16 to 31 Wednesday to Saturday, 8 to 15 Thursday to Saturday", "Under 8, there is no bracket that week", "an exact tie goes to the lower seed",
    "1 point in the first round, then 2, 4, 8 (and 16 in a 32-producer bracket), plus 2 for the right champion", "ties go to a right champion, then more right picks",
    "the lower of that average and its average at the last seeding (a producer that wasn't there counts zero)", "No rule can stop a producer from losing on purpose", "averaged over its round's day, is less than half its seeding VHP", "If both seeds are under half, the blocks decide",
    "Brackets sent in the same block share a place", "tied for 1st share all 3 VHP; otherwise 2 VHP to 1st and 1 VHP shared by those tied 2nd",
    "it never forfeits, and it is judged on a rate that no deposit or withdrawal can move"]) assert.ok(page.includes(s), s);
  assert.match(page, /Disclosure: a Knode Games node is in this bracket/);
  const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  assert.doesNotMatch(main + page.match(/<meta name="description" content="[^"]*"/)[0], /Sixteen|same chance|\bbyes?\b|can't tie the original|a drop isn't its choice/i, "#E-3 M-10: no old or wrong claims");
  assert.match(read("terms.html"), /The Producer Bracket seeds whichever producers are in the field, by VHP/);
  assert.doesNotMatch(page + js, /\bodds\b|\bwager|\bbet\b|\bpays\s+\d/i);
});

// ── the page and the recorder score the same way ──
test("the page and the recorder both use the recorded exact hours (no card shares, no floor)", () => {
  assert.match(js, /BM\.indexFromHours\(day\) : BM\.indexSoFar\(day\.filter\(Boolean\)\)/);
  const rec = fs.readFileSync(`${APP}/bot/games/bracket.ts`, "utf8");
  assert.match(rec, /const days = wf\.days\.map\(\(d\) => \(d\.every\(Boolean\) \? B\.indexFromHours\(d\) : null\)\);/);
  assert.doesNotMatch(rec + read("bracket-math.js") + js, /floorOf|provenOf|sharesOf|hourOf\(/);
  assert.match(page, /VHP added during the day neither helps nor hurts/);
});
