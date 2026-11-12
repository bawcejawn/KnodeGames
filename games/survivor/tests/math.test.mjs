// Survivor (game 3): one test per rule in games/survivor/math.js (.ai/games/Survivor.md), and property tests over random
// seasons: the standing the kit adds up always orders players exactly as the ranking does, and round points are never
// negative and never above the manifest's maxRoundPoints.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "../math.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, "../game.json"), "utf8"));
const A = (c) => "1" + c.repeat(33);
const P = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V"].map(A);
const W = ["a", "b", "c", "d", "e", "f", "g", "h"].map((c) => "1" + c.repeat(33));
const FIRST = 6;                                      // a test launch: Season 1 = vault weeks 6 and 7

// a deterministic generator (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A day: the field [[a, score]] and its out-zone by the real rule. */
const day = (n, scores, voids = []) => {
  const field = scores.map(([a, s]) => [a, s]).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  return { round: String(n), n, field, out: S.outOf(field, n), void: voids };
};

test("calendar: no launch set, no season and no play days", () => {
  assert.equal(S.FIRST_WEEK, null, "mainnet has no launch week until the owner sets it");
  assert.equal(S.seasonOfWeek(10), null);
  assert.deepEqual(S.playDaysOf(10), []);
  assert.equal(S.seasonDayOf(S.weekStart(10)), null);
});

test("calendar: a season is two vault weeks, Monday to Saturday each, 12 play days; Sundays rest", () => {
  assert.equal(S.weekStart(4), Date.UTC(2026, 10, 16), "vault week 4 = Mon 16 Nov 2026 (Week 1)");
  assert.deepEqual(S.seasonOfWeek(FIRST, FIRST), { season: 1, k: 0, startWeek: FIRST });
  assert.deepEqual(S.seasonOfWeek(FIRST + 1, FIRST), { season: 1, k: 1, startWeek: FIRST });
  assert.deepEqual(S.seasonOfWeek(FIRST + 2, FIRST), { season: 2, k: 0, startWeek: FIRST + 2 });
  assert.equal(S.seasonOfWeek(FIRST - 1, FIRST), null, "before Season 1");
  const days = S.seasonDays(1, FIRST);
  assert.equal(days.length, 12);
  assert.deepEqual(days.map((d) => d.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const d of days) assert.notEqual(new Date(d.day).getUTCDay(), 0, "no play day is a Sunday");
  assert.equal(new Date(days[0].day).getUTCDay(), 1, "day 1 is a Monday");
  assert.equal(days[6].day, S.weekStart(FIRST + 1), "day 7 is the second week's Monday");
  const sunday = S.weekStart(FIRST) + 6 * S.DAY;
  assert.equal(S.seasonDayOf(sunday, FIRST), null, "Sunday is no season day");
  assert.deepEqual(S.seasonDayOf(S.weekStart(FIRST + 1) + 5 * S.DAY, FIRST), { season: 1, n: 12, day: S.weekStart(FIRST + 1) + 5 * S.DAY });
  assert.equal(S.ymd(S.weekStart(4)), "20261116");
});

test("picks: the Picks contract's lock (5 minutes before the day) and 7 days ahead", () => {
  const d = S.weekStart(FIRST);
  assert.equal(S.lockTime(d), d - 300000);
  assert.ok(S.isOpen(d, d - 300001));
  assert.ok(!S.isOpen(d, d - 300000), "from 23:55 the day is locked");
  assert.ok(S.isOpen(d, d - 7 * S.DAY));
  assert.ok(!S.isOpen(d, d - 7 * S.DAY - 1), "more than 7 days ahead");
});

test("out-zone: a quarter of the field on day 1 to half on day 12; ties at the line are safe", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => S.outSize(18, n)), [4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9]);
  assert.equal(S.outSize(20, 1), 5);
  assert.equal(S.outSize(20, 12), 10);
  assert.equal(S.outSize(1, 12), 0);
  for (let m = 1; m <= 40; m++) for (let n = 1; n <= 12; n++) assert.ok(S.outSize(m, n) * 2 <= m, "never more than half");
  // 8 producers on day 1: out = 2. Scores 5, 7, 7, 7, … : the line is the 3rd lowest (7), so only the 5 is out.
  const d = day(1, P.slice(0, 8).map((a, i) => [a, i === 0 ? 5 : 7]));
  assert.deepEqual(d.out, [P[0]]);
});

test("a day from its ruler card: the field is entry and not void; voids are listed; fpct kept to thousandths", () => {
  const card = { round: "20261116", producers: [
    { a: P[0], entry: true, void: false, fpct: "999999" },
    { a: P[1], entry: true, void: false, fpct: "500000" },
    { a: P[2], entry: true, void: true, fpct: null },
    { a: P[3], entry: false, void: false, fpct: null },
    { a: P[4], entry: true, void: false, fpct: "0" },
    { a: P[5], entry: true, void: false, fpct: "1000000" },
  ] };
  const d = S.dayFromCard(card, 1);
  assert.deepEqual(d.field, [[P[0], 999], [P[5], 999], [P[1], 500], [P[4], 0]]);
  assert.deepEqual(d.void, [P[2]]);
  assert.deepEqual(d.out, [P[4]], "4 in the field, day 1: 1 out");
  assert.throws(() => S.scoreOf("1000001"));
  assert.throws(() => S.scoreOf("-1"));
  assert.throws(() => S.scoreOf("0.5"));
});

/** One season: days, and picks as { wallet: [producer for day 1, day 2, …] } (null = no pick). */
function play(days, picks, staked = []) {
  const m = new Map(Object.entries(picks).map(([a, xs]) => [a, xs.map((p, i) => (p ? [i + 1, p] : null)).filter(Boolean)]));
  return S.playSeason(days, m, new Set(staked));
}
const field10 = (n, outs, voids = []) => day(n, P.slice(0, 10).filter((a) => !voids.includes(a)).map((a) => [a, outs.includes(a) ? 10 : 500]), voids);

test("lives: the out-zone, no pick, a producer not in the field and a reused producer each cost a life", () => {
  const days = [field10(1, [P[0], P[1]]), field10(2, [P[0], P[1]]), field10(3, [P[0], P[1]])];
  const r = play(days, {
    [W[0]]: [P[2], P[3], P[4]],              // safe, safe, safe
    [W[1]]: [P[0], P[2], P[1]],              // out, safe, out → out on day 3
    [W[2]]: [P[2], null, P[3]],              // safe, no pick, safe
    [W[3]]: [P[2], P[15], P[3]],             // safe, not in the field, safe
    [W[4]]: [P[2], P[2], P[3]],              // safe, reused, safe
  });
  const g = (w) => r.players.get(w);
  assert.equal(g(W[0]).log, "sss"); assert.equal(g(W[0]).lives, 2);
  assert.equal(g(W[1]).log, "oso"); assert.equal(g(W[1]).outN, 3);
  assert.equal(g(W[2]).log, "sns"); assert.equal(g(W[2]).lives, 1);
  assert.equal(g(W[3]).log, "sfs"); assert.equal(g(W[3]).lives, 1);
  assert.equal(g(W[4]).log, "sus"); assert.equal(g(W[4]).lives, 1);
  assert.deepEqual(g(W[4]).used, [P[2], P[3]], "a reused producer isn't counted twice");
});

test("join: only a pick for day 1 puts a wallet in the season", () => {
  const r = play([field10(1, []), field10(2, [])], { [W[0]]: [P[2], P[3]], [W[1]]: [null, P[3]] });
  assert.ok(r.players.has(W[0]));
  assert.ok(!r.players.has(W[1]), "a wallet that starts on day 2 isn't in the season");
});

test("void producer: out of the day's field, a pick on it costs no life, and it still counts as used (owner 12 Nov)", () => {
  const days = [field10(1, [], [P[5]]), field10(2, [])];
  const r = play(days, { [W[0]]: [P[5], P[5]], [W[1]]: [P[5], P[6]], [W[2]]: [P[2], P[3]], [W[3]]: [P[2], P[3]] });
  assert.equal(r.players.get(W[0]).log, "xu", "void, then the same producer is a reuse");
  assert.equal(r.players.get(W[0]).lives, 1);
  assert.equal(r.players.get(W[1]).log, "xs");
  assert.equal(r.players.get(W[1]).lives, 2);
  assert.deepEqual(r.players.get(W[1]).used, [P[5], P[6]]);
  assert.equal(r.players.get(W[1]).total, 500, "a void pick adds no score");
  assert.ok(!days[0].field.some(([a]) => a === P[5]), "the void producer isn't in the field");
});

test("safety net, per board: nobody safe on a board saves that board's out-zone losses only", () => {
  const days = [field10(1, [P[0], P[1]])];
  // staked board: both in the out-zone → saved. free board: one safe → the other loses.
  const r = play(days, { [W[0]]: [P[0]], [W[1]]: [P[1]], [W[2]]: [P[0]], [W[3]]: [P[2]], [W[4]]: [null] }, [W[0], W[1]]);
  assert.equal(r.players.get(W[0]).log, "v"); assert.equal(r.players.get(W[0]).lives, 2);
  assert.equal(r.players.get(W[1]).log, "v");
  assert.equal(r.players.get(W[2]).log, "o"); assert.equal(r.players.get(W[2]).lives, 1);
  assert.equal(r.players.get(W[3]).log, "s");
  // the net never saves a pick that couldn't count
  const r2 = play(days, { [W[0]]: [P[0]], [W[1]]: [P[15]] });
  assert.equal(r2.players.get(W[0]).log, "v");
  assert.equal(r2.players.get(W[1]).log, "f"); assert.equal(r2.players.get(W[1]).lives, 1);
  // a void pick isn't a loss, so it switches the net off for the others on its board
  const r3 = play([field10(1, [P[0]], [P[5]])], { [W[0]]: [P[0]], [W[1]]: [P[5]] });
  assert.equal(r3.players.get(W[0]).log, "o");
});

test("board end: after the day that leaves 2 or fewer (if more than 2 started), or none, or after day 12", () => {
  const days = Array.from({ length: 12 }, (_, i) => field10(i + 1, [P[0], P[1]]));
  // Three players; two go out on day 2 (out twice), the third is safe: the board ends on day 2.
  const r = play(days, { [W[0]]: [P[0], P[1], P[2]], [W[1]]: [P[1], P[0], P[3]], [W[2]]: [P[2], P[3], P[4]], [W[3]]: [P[3], P[4], P[5]] });
  // W0 and W1 land in the out-zone on days 1 and 2; the net doesn't fire (W2 and W3 are safe), so both are out on day 2.
  assert.equal(r.players.get(W[0]).outN, 2);
  assert.equal(r.players.get(W[1]).outN, 2);
  assert.equal(r.ends.free, 2, "4 started, 2 left after day 2");
  assert.equal(r.players.get(W[2]).days, 2, "nobody plays after the board ends");
  // Two players only: the board runs to day 12 unless both are out.
  const two = {};
  two[W[0]] = P.slice(2, 14); two[W[1]] = P.slice(2, 14).reverse();
  const days20 = Array.from({ length: 12 }, (_, i) => day(i + 1, P.map((a) => [a, 500])));
  const r2 = play(days20, two);
  assert.equal(r2.ends.free, 12);
  assert.equal(r2.endN, 12);
  // the staked board ends on its own; the free board plays on. The lone staked player's two out-zone picks are saved
  // by its own board's net (nobody on the staked board is safe), then two missed days knock it out on day 4.
  const r3 = play(days, { [W[0]]: [P[0], P[1]], [W[1]]: [P[2], P[3], P[4], P[5]] }, [W[0]]);
  assert.equal(r3.players.get(W[0]).log, "vvnn");
  assert.equal(r3.ends.staked, 4, "the only staked player is out");
  assert.ok(r3.players.get(W[1]).days > 2, "the free board keeps playing");
});

test("ranking: lasted longest, then lives, then total; equal on all three share a place", () => {
  const rows = [
    { a: W[0], outN: null, lives: 1, total: 10 }, { a: W[1], outN: null, lives: 2, total: 1 },
    { a: W[2], outN: 5, lives: 0, total: 900 }, { a: W[3], outN: 7, lives: 0, total: 0 }, { a: W[4], outN: 7, lives: 0, total: 0 },
  ];
  assert.deepEqual(S.rank(rows).map((x) => [x.a, x.place]), [[W[1], 1], [W[0], 2], [W[3], 3], [W[4], 3], [W[2], 5]]);
});

test("standing: encodes days, lives and total, and decodes back", () => {
  for (const x of [{ days: 0, lives: 2, total: 0 }, { days: 12, lives: 2, total: 12 * 999 }, { days: 5, lives: 0, total: 77 }])
    assert.deepEqual(S.decodeStanding(S.standingOf(x)), x);
  assert.equal(S.standingOf({ days: 12, lives: 2, total: 12 * 999 }) <= S.MAX_ROUND_POINTS, true);
  assert.equal(MANIFEST.maxRoundPoints, S.MAX_ROUND_POINTS, "game.json's maxRoundPoints is math.js's bound");
});

/** A random season: a 14–20 producer field with random scores (some days a void), random players and picks. */
function randomSeason(r) {
  const m = 14 + Math.floor(r() * 7), prods = P.slice(0, m);
  const days = [];
  for (let n = 1; n <= 12; n++) {
    const voids = r() < 0.3 ? [prods[Math.floor(r() * m)]] : [];
    days.push(day(n, prods.filter((a) => !voids.includes(a)).map((a) => [a, Math.floor(r() * 1000)]), voids));
  }
  const nw = 1 + Math.floor(r() * 30), picks = new Map(), staked = new Set();
  for (let i = 0; i < nw; i++) {
    const w = "1" + String(i).padStart(33, "W").replace(/0/g, "o");
    const list = [];
    for (let n = 1; n <= 12; n++) {
      if (n > 1 && r() < 0.08) continue;                   // a missed day now and then
      list.push([n, r() < 0.05 ? P[19] : prods[Math.floor(r() * m)]]);   // sometimes a producer outside the field
    }
    picks.set(w, list);
    if (r() < 0.4) staked.add(w);
  }
  return { days, picks, staked };
}

test("property: on each board, standing order is exactly the ranking (5,000 random seasons)", () => {
  const r = rng(7);
  for (let t = 0; t < 5000; t++) {
    const { days, picks, staked } = randomSeason(r);
    const upTo = 1 + Math.floor(r() * 12);
    const res = S.playSeason(days.slice(0, upTo), picks, staked);
    for (const g of ["staked", "free"]) {
      const rows = [...res.players].filter(([, x]) => x.board === g).map(([a, x]) => ({ a, ...x }));
      const ranked = S.rank(rows);
      for (let i = 1; i < ranked.length; i++) {
        const p = ranked[i - 1], x = ranked[i];
        if (p.place === x.place) assert.equal(p.standing, x.standing, `season ${t}: a shared place has one standing`);
        else assert.ok(p.standing > x.standing, `season ${t}: place ${p.place} (${p.standing}) above place ${x.place} (${x.standing})`);
      }
    }
  }
});

test("property: round points are never negative, never above maxRoundPoints, and a week's points add up to the standing", () => {
  const r = rng(11);
  for (let t = 0; t < 1500; t++) {
    const { days, picks, staked } = randomSeason(r);
    const sum = new Map();
    for (let n = 1; n <= 12; n++) {
      const first = (n - 1) % 6 === 0;
      if (first) sum.clear();
      for (const [a, p] of S.roundPoints(days, picks, staked, n, first)) {
        assert.ok(Number.isSafeInteger(p) && p >= 0 && p <= S.MAX_ROUND_POINTS, `season ${t} day ${n}: ${p}`);
        sum.set(a, (sum.get(a) ?? 0) + p);
      }
      if (n === 6 || n === 12) {
        const end = S.playSeason(days.slice(0, n), picks, staked).players;
        for (const [a, x] of end) assert.equal(sum.get(a), x.standing, `season ${t}: week ending day ${n}, ${a}`);
      }
    }
  }
});

test("free-prize switch: the page shows a prize only on an explicit ON for both weeks of the season", () => {
  const set = new Date(S.weekStart(FIRST) - S.DAY).toISOString();
  const on = { v: 1, games: { 3: [{ from: FIRST, on: true, set }] } };
  assert.equal(S.freePrizeOn(on, 1, FIRST), true);
  assert.equal(S.freePrizeOn({ v: 1, games: { 3: [{ from: FIRST + 1, on: true, set }] } }, 1, FIRST), false, "on for week 2 only");
  assert.equal(S.freePrizeOn({ v: 1, games: { 3: [{ from: FIRST, on: true, set: new Date(S.weekStart(FIRST) + 1).toISOString() }] } }, 1, FIRST), false, "set after the week started");
  assert.equal(S.freePrizeOn(null, 1, FIRST), false);
  assert.equal(S.freePrizeOn(on, 1, null), false, "no launch set");
});

test("the rules file stays pure: no clock, randomness, network or Math aliasing (GAME_KIT §2)", () => {
  const src = fs.readFileSync(path.join(HERE, "../math.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /Date\.now|new Date\(\)|Math\.random|fetch\(|require\(|import\(|globalThis|process\./);
  assert.doesNotMatch(src, /=\s*Math\b(?!\.)/, "Math is never aliased");
});
