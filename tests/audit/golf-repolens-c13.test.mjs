// Repo Lens #C-13 (Block Golf fix-check 3, PR #234, golf-b13 @ 4574b80).
// Run: node --import tsx --test tests/audit/golf-repolens-c13.test.mjs
// Test 1 failed on 4574b80 (finding C13-L1). The owner's fix (6 Nov, option c): the mulligan drops the worst hole
// of any kind, lost balls included, so a played hole is worth exactly 1 point more than a missed one at the same
// card. The "documents" test of the old rule is replaced by the rule as now built.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const APP = process.env.APP || ".";
await import(path.resolve(APP, "golf-math.js"));
const G = globalThis.KGolf;
const { vaultFile } = await import(path.resolve(APP, "bot/games/golf.ts"));
const L = "ABCDEFGHJKLMNPQRSTUVWXYZ", A = (i) => "1" + L[i % 24].repeat(32) + L[Math.floor(i / 24) % 24];   // base58, 34 chars

// A course of three holes; `mine` = this wallet's strokes per hole (null = not played: a lost ball).
const week = (mine) => ["questions", "race", "blockx"].map((id, i) => ({ id, skipped: false, results: mine[i] === null ? {} : { [A(0)]: { place: 1, of: 9, strokes: mine[i] } } }));
const ptsOf = (mine) => { const c = G.card(week(mine), A(0)); return c ? c.pts : 0; };

test("C13-L1: a wrong Questions answer (6 strokes) is worth at most 1 point more than not answering (the 6 Nov premise)", () => {
  // One Race hole at 3 strokes, Block X not played. Not answering: 0 points (the only played hole is the mulligan).
  // Answering one question wrongly: the 6 becomes the mulligan and the Race 3 counts: 4 points.
  const before = ptsOf([null, 3, null]), after = ptsOf([6, 3, null]);
  assert.ok(after - before <= 1, `a wrong answer moved the card from ${before} to ${after} points (the mulligan drops the 6)`);
});

test("C13-L1, option c (as built): playing never scores worse than skipping; a play that scores nothing is worth at most 1 point", () => {
  for (const d of [1, 2, 3, 4, 5, 6]) {
    assert.equal(ptsOf([6, d, null]) - ptsOf([null, d, null]), 1, `Race at ${d}`);
    assert.equal(ptsOf([d, null, null]), 7 - d, `one hole at ${d} counts (the mulligan drops a missed game)`);
  }
  // Plays that score nothing: none, one, two, three games (6 each). The third adds nothing: with every game played,
  // the mulligan drops one of the 6s.
  assert.deepEqual([[null, null, null], [6, null, null], [6, 6, null], [6, 6, 6]].map(ptsOf), [0, 1, 2, 2]);
  // Over every combination of results (1–6 or missed) on three holes: playing a hole never lowers the card, and a
  // 6 on it never raises it by more than 1.
  const R = [1, 2, 3, 4, 5, 6, null];
  for (const b of R) for (const c of R) for (const s of [1, 2, 3, 4, 5, 6]) {
    const gain = ptsOf([s, b, c]) - ptsOf([null, b, c]);
    assert.ok(gain >= 0, `playing (${s}) beside ${b},${c} lowered the card`);
    if (s === 6) assert.ok(gain <= 1, `a 6 beside ${b},${c} was worth ${gain}`);
  }
});

test("Q4: zero-point answerers (scored false) don't join the field or change anyone else's strokes", () => {
  const field = Array.from({ length: 7 }, (_, i) => ({ a: A(i + 1), score: 10 - i, scored: true, ranked: 3 }));
  const zeros = Array.from({ length: 20 }, (_, i) => ({ a: A(i + 40), score: 0, scored: false, ranked: 5 }));
  const x = G.scoreHole(field, G.MIN_FIELD, false, G.MIN_FIELD_VHP), y = G.scoreHole([...field, ...zeros], G.MIN_FIELD, false, G.MIN_FIELD_VHP);
  assert.equal(y.field, x.field); assert.equal(y.weight, x.weight);
  for (const r of field) assert.equal(y.results[r.a].strokes, x.results[r.a].strokes, r.a);
  for (const r of zeros) assert.equal(y.results[r.a].strokes, 6, "played, scored nothing = 6");
});

test("Q1: the pages' Free play medals (boardPlace → freeMedals) equal the vault file's first/second for the same cards", () => {
  const src = fs.readFileSync(path.resolve(APP, "bot/games/golf.ts"), "utf8");
  assert.match(src, /const staked = c\.ranked \|\| c\.free === false/, "view's Staked/Free split");
  assert.match(src, /c\.free === true && !c\.ranked && ok\(c\)/, "vaultFile's free set");
  const key = (c) => [c.pts, -c.lost, c.under, -c.best].join(",");
  // boardPlace exactly as view() computes it (copied: view is not exported).
  const view = (cards) => { const last = {}; return cards.map((c) => { const st = c.ranked || c.free === false, b = st ? "staked" : "free", k = key(c);
    const prev = last[b], n = (prev ? prev.n : 0) + 1, boardPlace = prev && prev.k === k ? prev.place : n; last[b] = { k, place: boardPlace, n };
    return { a: c.a, boardPlace, pts: c.pts, ranked: st }; }); };
  let seed = 7; const rnd = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  for (let t = 0; t < 2000; t++) {
    const cards = Array.from({ length: 1 + rnd(30) }, (_, i) => {
      const ranked = rnd(3) === 0, free = !ranked && rnd(4) !== 0;
      return { a: A(i), ranked, free, place: 0, pts: rnd(4), strokes: 0, par: 0, toPar: 0, lost: rnd(2), under: rnd(2), best: 1 + rnd(2), mulligan: "", holes: [] };
    }).sort((x, y) => y.pts - x.pts || x.lost - y.lost || y.under - x.under || x.best - y.best || (x.a < y.a ? -1 : 1));
    const vf = vaultFile({ week: 9, cards });
    const m = G.freeMedals(view(cards).filter((r) => !r.ranked));
    const got = (p) => [...m].filter(([, v]) => v === p).map(([a]) => a).sort();
    assert.deepEqual(got(1), vf.first, `trial ${t}: 1st`); assert.deepEqual(got(2), vf.second, `trial ${t}: 2nd`);
  }
});
