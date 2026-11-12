// Producer Bracket recorder (bot/games/bracket.ts): seeding once from the Sunday 00:00 card (never changed later,
// void without a card, none under 8 producers), picks only after the lock and only when both nodes agree, hours only
// once irreversible and identical on both nodes, re-read in a later run (the two-run rule), expected blocks from exact
// VHP rebuilt from the chain's VHP events (balances read at the head and walked back), results equal to the shared math
// run on the same blocks, final from Monday 00:00 UTC after the week (D-125, D-141) and frozen afterwards, and the
// leaderboards. Offline: fake nodes with a made-up VHP history.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));
const { scoreWeek, vaultRows, freeWinners, releaseFromEnv } = rec;
// The Vault's stakes: unless a test says otherwise, every player is staked in the Bracket
const run = (o) => rec.run({ stakedOf: async (_n, players) => players, ...o });
const M = globalThis.KRaceMath, B = globalThis.KBracketMath;
const plain = (x) => JSON.parse(JSON.stringify(x));
const H = 3600000, DAY = 24 * H;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i) => "1" + Array.from({ length: 33 }, (_, k) => B58[(i * 7 + k * (i + 3)) % 58]).join("");
const W = 3;                                   // week 3: Mon 9 Nov 2026 (16-producer rounds Wed–Sat)
const RD = (r, size = 16) => B.roundDay(W, r, size);   // the day round r is played
const T0 = B.weekStart(W) - 4 * DAY;           // the fake chain starts the Thursday before
const H0 = 40_000_000;
const T = (h) => T0 + (h - H0) * 3000;
const hAt = (t) => H0 + Math.ceil((t - T0) / 3000);

// A field of n producers with VHP n, n−1, …; the signer of block h is drawn by VHP (deterministic per height).
function fieldOf(n) { return Array.from({ length: n }, (_, i) => ({ a: addr(i), vhp: 1000 * (n - i) })); }
function signerFn(field, offline = new Set(), offFrom = 0) {
  const pick = (set) => { const tot = set.reduce((s, r) => s + r.vhp, 0); return (h) => { let x = ((Math.imul(h, 2654435761) >>> 0) / 4294967296) * tot; for (const r of set) { x -= r.vhp; if (x < 0) return r.a; } return set[set.length - 1].a; }; };
  const all = pick(field), live = pick(field.filter((r) => !offline.has(r.a)));
  const f = (h) => (h >= offFrom ? live(h) : all(h));   // the offline producers stop at height offFrom
  f.field = field;
  return f;
}
// The fake chain's VHP: each producer starts with 1,000 × its card VHP (so 4 VHP burned a block stays small), every
// block burns 4 VHP of its signer's, and moves [{ h, a, d (VHP) }] add or take VHP in block h.
const BURN = 4e8, START = (r) => r.vhp * 1000 * 1e8;
let TOP = H0;                                   // the fake head (set by headAt)
function nodeOf(signer, tamper = null, { moves = [], forkAt = null, effOff = 0 } = {}) {
  const start = new Map(signer.field.map((r) => [r.a, START(r)]));
  const signed = new Map(); let upTo = H0 - 1;   // blocks signed by each producer from H0 (cached)
  const count = (a, top) => { for (let h = upTo + 1; h <= top; h++) { const s = signer(h); signed.set(s, (signed.get(s) || [])); signed.get(s).push(h); } upTo = Math.max(upTo, top); const l = signed.get(a) || []; let lo = 0, hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (l[m] <= top) lo = m + 1; else hi = m; } return lo; };
  return (name) => {
    const who = (h) => (name === "check" && tamper && tamper(h) ? addr(99) : signer(h));
    const id = (h) => (forkAt !== null && name === forkAt.node && h >= forkAt.h ? "fork" : "id") + h;
    return {
      async head() { throw new Error("head is given"); },
      async blockTime(h) { return T(h); },
      async blockId(h) { return id(h); },
      async chain(from, to) {
        // the fake chain's history starts 40,000 blocks (~33 hours) before H0: last week's bracket can't be seeded
        if (from < H0 - 40_000) throw new Error(`no block ${from} on this node`);
        const out = { hs: [], ts: [], sig: [], signers: [], ids: [], deltas: [] }, ix = new Map();
        for (let h = from; h <= to; h++) {
          const a = who(h); let i = ix.get(a); if (i === undefined) { i = out.signers.length; out.signers.push(a); ix.set(a, i); }
          out.hs.push(h); out.ts.push(T(h)); out.sig.push(i); out.ids.push(id(h));
          for (const mv of moves) if (mv.h === h) out.deltas.push({ h, a: mv.a, d: mv.d * 1e8 });
          if (h >= H0) out.deltas.push({ h, a, d: -BURN });
        }
        return out;
      },
      async balance(a) {
        const v = (start.get(a) || 0) - BURN * count(a, TOP) + moves.filter((m) => m.a === a && m.h <= TOP).reduce((t, m) => t + m.d * 1e8, 0);
        // the contract's effective balance for the next block: minus what arrived in the last 19 blocks
        const eff = Math.max(0, v - moves.filter((m) => m.a === a && m.d > 0 && m.h > TOP - 19 && m.h <= TOP).reduce((t, m) => t + m.d * 1e8, 0)) + effOff;
        return { v, eff, h: TOP, id: "id" + TOP };
      },
    };
  };
}
const headAt = (t) => { const h = { height: hAt(t) + 20, time: t + 60000, lib: hAt(t), libTime: T(hAt(t)) }; TOP = h.height; return h; };
function raceDir(field, { skip = () => false, results = null } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-"));
  const card = (at) => ({ at, c: 0, blocksPerRace: 7200, fairness: null, field: field.map((r) => ({ ...r, k: 7200 * r.vhp / field.reduce((s, x) => s + x.vhp, 0), h: 1 })), paddock: [] });
  for (const w of [W - 1, W, W + 1]) {
    const races = [];
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) { const i = M.raceIndex(t); races.push({ id: M.raceId(i), start: t, end: t + M.RACE, cards: Array.from({ length: 6 }, (_, l) => (skip(t + l * H) ? null : card(t + l * H))), result: results ? results(t) : null }); }
    fs.writeFileSync(path.join(d, `W${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bracket-"));
const quiet = async (f) => { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } };
const readW = (dir, w = W) => JSON.parse(fs.readFileSync(path.join(dir, `W${String(w).padStart(3, "0")}.json`), "utf8"));
const P = (i) => addr(50 + i);
// picks for week W only (other weeks: none)
function picksOf(rows, tamper = false) { return async (node, round) => (round !== B.picksRound(W) ? [] : rows.map((r, i) => ({ ...r, number: node === "check" && tamper && i === 0 ? r.number + 1 : r.number }))); }

/** Run the recorder repeatedly at time t (carrying files forward) until nothing more gets recorded. */
async function runUntil(t, o, dir, times = 40) {   // at most 6 hours a run (audit A-2)
  let last;
  for (let i = 0; i < times; i++) last = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(t), ...o }));
  return last;
}

test("seeding: exact VHP averaged over the day before Sunday 00:00, on two nodes; recorded once with a hash, never changed", async () => {
  const field = fieldOf(17), dir = tmp();
  const o = { picksContract: "1P", nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([]) };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) - H), ...o }));
  assert.ok(!fs.existsSync(path.join(dir, "W003.json")), "nothing before the seeding time");
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + 40 * 60000), ...o }));
  const wf = readW(dir);
  assert.equal(wf.status, "open"); assert.equal(wf.seeding.size, 16); assert.equal(wf.seeding.seeds.length, 16);
  assert.deepEqual(wf.seeding.seeds, field.slice(0, 16).map((r) => r.a)); assert.deepEqual(wf.seeding.out, [field[16].a]);
  assert.match(wf.seeding.hash, /^[0-9a-f]{64}$/); assert.equal(wf.days.length, 4);
  assert.equal(wf.seeding.cardAt, hAt(B.seedTime(W)), "the block at Sunday 00:00");
  // the average is over the day before: seed 1's average is its starting VHP less about half a day's burns
  assert.ok(wf.seeding.vhp[0] < field[0].vhp * 1000 && wf.seeding.vhp[0] > field[0].vhp * 1000 * 0.99);
  // a later run on another chain keeps the published seeding
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + 3 * H), ...o, nodeOf: nodeOf(signerFn(fieldOf(40))) }));
  assert.deepEqual(readW(dir).seeding, wf.seeding);
  // a tampered seeding in the last run's files is not trusted (its hash no longer matches): seeded again from the chain
  const bad = readW(dir); bad.seeding.seeds[0] = addr(77); fs.writeFileSync(path.join(dir, "W003.json"), JSON.stringify(bad));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + 4 * H), ...o, nodeOf: nodeOf(signerFn(fieldOf(40))) }));
  assert.equal(readW(dir).seeding.size, 32, "re-seeded from the chain, not the tampered file");
});

test("seeding: waits while the nodes disagree and turns void after 24 hours; under 8 is no bracket; 13 is the top 8; 40 is a 32-bracket", async () => {
  const field = fieldOf(17), dir = tmp();
  const skew = (name) => { const n = nodeOf(signerFn(field))(name); return name === "check" ? { ...n, balance: async (a) => { const b = await n.balance(a); return { ...b, v: b.v + 1e8, eff: b.eff + 1e8 }; } } : n; };
  const o = { picksContract: "1P", nodeOf: skew, picksOf: picksOf([]) };
  const r1 = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  assert.ok(r1.problems.some((p) => p.includes("disagree about the seeding")));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + 23 * H), ...o }));
  assert.ok(!fs.existsSync(path.join(dir, "W003.json")) || readW(dir).status !== "void", "still waiting at 23 hours");
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + 25 * H), ...o }));
  assert.equal(readW(dir).status, "void");
  const one = tmp(); const r0 = await quiet(() => run({ p: "main", check: null, prev: one, out: one, head: headAt(B.seedTime(W) + H), picksContract: "1P", nodeOf: nodeOf(signerFn(field)) }));
  assert.ok(r0.problems.some((p) => p.includes("second node")), "one node can't seed");
  // (two runs: the seeding counts once a later run reads it again, fix-check F2)
  const seedWith = async (f) => { const d = tmp(); for (const t of [H, 2 * H]) await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + t), picksContract: "1P", nodeOf: nodeOf(signerFn(f)) })); return readW(d); };
  const w7 = await seedWith(fieldOf(7)); assert.equal(w7.status, "none"); assert.match(w7.void, /8 needed/);
  const w40 = await seedWith(fieldOf(40)); assert.equal(w40.seeding.size, 32); assert.equal(w40.days.length, 5, "Tuesday to Saturday");
  const w13 = await seedWith(fieldOf(13)); assert.equal(w13.seeding.size, 8, "the largest power of two that fits (D-141): no byes"); assert.equal(w13.seeding.seeds.length, 8);
  assert.equal(w13.seeding.out.length, 5); assert.equal(w13.days.length, 3, "Thursday to Saturday");
});

test("picks: only after the lock is irreversible, only when both nodes agree; bad numbers kept but marked invalid", async () => {
  const field = fieldOf(17), race = raceDir(field);
  const rows = [{ player: P(1), number: 0, time: 1 }, { player: P(2), number: 2 ** 15 - 1, time: 2 }, { player: P(3), number: 2 ** 20, time: 3 }];
  const base = { raceDir: race, picksContract: "1P", nodeOf: nodeOf(signerFn(field)) };
  const dir = tmp();
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...base, picksOf: picksOf(rows) }));
  // the head is past the lock but the irreversible block isn't yet
  const h = { ...headAt(B.lockTime(W) - 60000), time: B.lockTime(W) + 120000 };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: h, ...base, picksOf: picksOf(rows) }));
  assert.equal(readW(dir).picks, null);
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...base, picksOf: picksOf(rows, true) }));
  assert.ok(r.problems.some((p) => p.includes("disagree about the picks"))); assert.equal(readW(dir).picks, null);
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...base, picksOf: picksOf(rows) }));
  const wf = readW(dir);
  assert.equal(wf.status, "locked"); assert.equal(wf.picks.checked, 2);
  assert.deepEqual(wf.picks.rows.map((x) => [x[0], x[3]]), [[P(1), 1], [P(2), 1], [P(3), 0]]);
});

test("a whole week: hours irreversible only, re-read in a later run, results equal the shared math on the same blocks, final from Monday 00:00 UTC, then frozen", async () => {
  const field = fieldOf(17), offline = new Set([field[0].a]);   // seed 1 goes offline from Monday: it loses round 1
  const signer = signerFn(field, offline, hAt(B.weekStart(W))), race = raceDir(field), dir = tmp();
  // perfect bracket computed straight from the fake chain with bracket-math (balances read at the end, walked back)
  const seeds = field.slice(0, 16).map((r) => r.a), fake = nodeOf(signer)("main");
  headAt(RD(3) + DAY + H);
  const ch = await fake.chain(hAt(RD(0)) - B.ACTIVE_BLOCKS, TOP);
  const anchors = {}; for (const r of field) anchors[r.a] = await fake.balance(r.a);
  const book = B.vhpBook(anchors, ch.deltas);
  const days = [0, 1, 2, 3].map((r) => B.dayIndex(ch, RD(r), seeds, book));
  const truth = B.results(seeds, 16, days);
  const perfect = B.encode(truth.rounds, 16, 16);
  const rows = [{ player: P(1), number: perfect, time: 1 }, { player: P(2), number: 0, time: 2 }];
  const o = { raceDir: race, picksContract: "1P", nodeOf: nodeOf(signer), picksOf: picksOf(rows) };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...o }));
  // Thursday 10:30: Wednesday (round 1) done, Thursday hours up to 10:00 recorded, nothing later
  const last = await runUntil(RD(1) + 10.5 * H, o, dir);
  assert.deepEqual(last.problems, []);
  let wf = readW(dir);
  assert.ok(wf.days[0].every(Boolean)); assert.equal(wf.days[1].filter(Boolean).length, 10); assert.ok(wf.days[2].every((x) => x === null));
  assert.ok(wf.days[0].every((x) => x.checked === 2 && x.q > 0 && Object.keys(x.cr).length === 16 && Object.keys(x.w).length === 16 && Object.keys(x.r).length === 16 && Object.keys(x.av).length === 16));
  assert.ok(wf.days[0].every((x) => x.re === 1), "every hour recorded by an earlier run was read again and matched");
  assert.ok(wf.days[0].every((x) => JSON.stringify(x.w) === JSON.stringify(wf.days[0][0].w)), "one baseline per seed for the whole day");
  assert.equal(B.indexFromHours(wf.days[0]).get(field[0].a).blocks, 0, "seed 1 signed nothing");
  assert.ok(B.indexFromHours(wf.days[0]).get(field[0].a).expected > 100, "…but was expected to, by its VHP");
  assert.equal(wf.results.rounds.length, 1); assert.deepEqual(wf.results.rounds[0], truth.rounds[0]);
  assert.ok(!wf.results.rounds[0].includes(1), "offline seed 1 is out");
  assert.equal(wf.points.find((p) => p[0] === P(1))[1], 8, "8 right in round 1 so far");
  // heights recorded per hour are contiguous
  for (let h = 1; h < 24; h++) assert.equal(wf.days[0][h].from, wf.days[0][h - 1].to + 1);
  // Sunday 06:00 (the review day): all rounds in, not final yet (final from Monday 00:00 UTC)
  const rv = await runUntil(RD(3) + 30 * H, o, dir);
  wf = readW(dir);
  assert.equal(wf.status, "locked"); assert.equal(wf.results.done, true); assert.deepEqual(wf.results.rounds, plain(truth.rounds));
  assert.ok(rv.problems.every((p) => !p.includes("final")), "no final talk before Monday: " + JSON.stringify(rv.problems));
  assert.deepEqual(wf.points.find((p) => p[0] === P(1)), [P(1), 34, 1, 15], "perfect bracket: 34 points, champion, 15 right");
  assert.equal(wf.points.find((p) => p[0] === P(2))[2], 0, "chalk picked seed 1 as champion");
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.weekStart(W + 1) - 60000), ...o }));
  assert.equal(readW(dir).status, "locked", "still in review a minute before Monday 00:00 UTC");
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.weekStart(W + 1) + 0.5 * H), ...o }));
  assert.equal(readW(dir).status, "locked", "the end-of-week stakes are read, but count only once a later run reads them the same (F1)");
  assert.ok(readW(dir).staked.held);
  assert.equal(readW(dir).picks.re, 1, "the picks were read again by a later run (fix-check 2 PK-1)");
  // fix-check 2 R-1: while BRACKET_RELEASE names the week it never goes final
  const rel = tmp(); fs.cpSync(dir, rel, { recursive: true });
  const rr = await quiet(() => run({ p: "main", check: "check", prev: rel, out: rel, head: headAt(B.weekStart(W + 1) + 0.6 * H), ...o, release: new Set([W]) }));
  assert.equal(readW(rel).status, "locked"); assert.ok(rr.problems.some((p) => /BRACKET_RELEASE names this week/.test(p)), JSON.stringify(rr.problems));
  // #B-15 B15-2: the run that re-reads an hour (here one whose re mark is missing, as after a release) never also closes the week
  const one = tmp(); fs.cpSync(dir, one, { recursive: true });
  { const f1 = path.join(one, "W003.json"), x = readW(one); delete x.days[0][0].re; fs.writeFileSync(f1, JSON.stringify(x) + "\n"); }
  await quiet(() => run({ p: "main", check: "check", prev: one, out: one, head: headAt(B.weekStart(W + 1) + 0.6 * H), ...o }));
  assert.equal(readW(one).days[0][0].re, 1, "re-read"); assert.equal(readW(one).status, "locked", "…but not final in the same run");
  await quiet(() => run({ p: "main", check: "check", prev: one, out: one, head: headAt(B.weekStart(W + 1) + 0.7 * H), ...o }));
  assert.equal(readW(one).status, "final", "final the run after");
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.weekStart(W + 1) + 0.6 * H), ...o }));
  wf = readW(dir); assert.equal(wf.status, "final"); assert.ok(wf.staked.held, "the stakes read after the week ended");
  // after final, a different chain changes nothing
  const before = JSON.stringify(wf);
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.weekStart(W + 1) + H), ...o, nodeOf: nodeOf(signerFn(field)) }));
  assert.equal(JSON.stringify(readW(dir)), before);
  // scoreWeek on the file gives the same points (the page can check it)
  assert.deepEqual(plain(scoreWeek(wf).points), wf.points);
  // board: last week shows the final week; all time counts final weeks only
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.weekStart(W + 1) + 2 * H), ...o }));
  assert.equal(r.board.lastWeek.week, W); assert.equal(r.board.lastWeek.final, true);
  assert.equal(r.board.lastWeek.rows[0].a, P(1)); assert.equal(r.board.lastWeek.rows[0].place, 1);
  assert.equal(r.board.allTime.rows[0].pts, 34);
});

test("hours: the two nodes must agree; a fork while reading is caught; VHP moved mid-day is followed exactly", async () => {
  const field = fieldOf(17), signer = signerFn(field), dir = tmp();
  const mover = field[5].a, h5 = hAt(RD(0) + 5 * H);
  // the mover parks almost all its VHP elsewhere from 05:00 to 05:10 on Monday, then takes it back
  const moves = [{ h: h5, a: mover, d: -0.99 * field[5].vhp * 1000 }, { h: h5 + 200, a: mover, d: 0.99 * field[5].vhp * 1000 }];
  const o = { raceDir: raceDir(field), picksContract: "1P", nodeOf: nodeOf(signer, null, { moves }), picksOf: picksOf([]) };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...o }));
  const badH = hAt(RD(0) + 5 * H + 1000);
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(RD(0) + 8 * H), ...o, nodeOf: nodeOf(signer, (h) => h === badH, { moves }) }));
  assert.ok(r.problems.some((p) => p.includes("disagree")));
  assert.ok(readW(dir).days[0].every((x) => x === null), "nothing recorded while the nodes disagree");
  // a fork between the hour and the head while reading (the block a balance was read at changed): nothing recorded
  const r2 = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(RD(0) + 8 * H), ...o, nodeOf: nodeOf(signer, null, { moves, forkAt: { node: "main", h: hAt(RD(0) + 8 * H) + 1 } }) }));
  assert.ok(r2.problems.some((p) => p.includes("fork")), JSON.stringify(r2.problems));
  // agreeing nodes: recorded (at most 6 hours a run); parking VHP for 10 minutes doesn't lower the mover's baseline
  const r3 = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(RD(0) + 8 * H), ...o }));
  assert.equal(readW(dir).days[0].filter(Boolean).length, 6, "6 hours a run (audit A-2) " + JSON.stringify(r3.problems));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(RD(0) + 8 * H), ...o }));
  const wf = readW(dir);
  assert.equal(wf.days[0].filter(Boolean).length, 8, "00:00–07:59 are irreversible by 08:00");
  assert.equal(wf.days[0][5].w[mover], wf.days[0][0].w[mover], "the baseline is the day's start, whatever happens later");
  assert.ok(wf.days[0][6].w[mover] === wf.days[0][0].w[mover], "…also in the next run's hours (taken from hour 0)");
  assert.ok(Math.abs(wf.days[0][5].q / wf.days[0][4].q - 1) < 0.05, "q is about the same every hour");
});

test("files: only the expected names, sizes and fields", async () => {
  const field = fieldOf(17), dir = tmp();
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), picksContract: null, nodeOf: nodeOf(signerFn(field)) }));
  const names = fs.readdirSync(dir).sort();
  assert.ok(names.includes("W003.json") && names.includes("board.json") && names.includes("index.json"));
  assert.ok(names.every((f) => /^(index|board|W\d{3})\.json$/.test(f)), names.join());
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  assert.deepEqual(Object.keys(idx).sort(), ["contract", "game", "prizesFromWeek", "rulerFrom", "rulerSchedule", "updated", "v", "weeks"]); assert.equal(idx.rulerFrom, null, "R-BR-7: no ruler switch set"); assert.equal(idx.rulerSchedule, null); assert.equal(idx.game, B.GAME_ID);
  const wf = readW(dir);
  assert.deepEqual(Object.keys(wf).sort(), ["days", "end", "picks", "points", "results", "rulerFrom", "rulerMode", "rulerSchedule", "seeding", "staked", "start", "status", "v", "week"]);
  assert.deepEqual(Object.keys(wf).slice(-3), ["rulerFrom", "rulerMode", "rulerSchedule"], "R-BR-7: the ruler fields come last"); assert.equal(wf.rulerMode, "off");
  assert.ok(fs.statSync(path.join(dir, "W003.json")).size < 200000);
});

// ── the publish job's shape check (.github/workflows/games.yml) accepts the recorder's files and refuses bad ones ──
import { execFileSync } from "node:child_process";
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
const pys = [...yml.matchAll(/<<'PY'\n([\s\S]*?)\n\s*PY\n/g)].map((m) => m[1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n"));
const bracketPy = pys.find((p) => p.includes("bracket check done"));
// The publish job's Bracket check: `pub` = the published branch's bracket folder (default: the same files, as if this
// run's files were already published), `now` = the job's clock (default: Monday 02:00 after the test week, final).
const NOW = B.weekStart(W + 1) + 2 * H;   // Monday 02:00 UTC after the week: final
// ruler: the owner's BRACKET_RULER_FROM_WEEK as the publish step gets it (Repo Lens #G-20 G20-1); unset by default
// (phase 2) mode: BRACKET_RULER_MODE; tl: a ruler timeline file (the tests' chain) for the card rebuild; the ruler's code is
// the repository's vhp_ruler.py (the workflow loads the embedded copy, tested byte for byte in games-ruler-embed.test)
const checkRun = (dir, { pub = dir, now = NOW, held = "", ruler = "", mode = "", tl = "" } = {}) => execFileSync("python3", ["-c", bracketPy, dir, pub, held], { stdio: "pipe", env: { ...process.env, CHECK_NOW_MS: String(now), BRACKET_RULER_FROM_WEEK: ruler, BRACKET_RULER_MODE: mode, BRACKET_RULER_PY: path.resolve(APP, "vhp_ruler.py"), BRACKET_RULER_TL: tl, BRACKET_RULER_VHP_DATA: "" } }).toString();
/** What the publish check holds (file names, and "!alert" for an email), with the held list written to a file. */
const heldOf = (dir, opt = {}) => { const f = path.join(tmp(), "held"); fs.writeFileSync(f, ""); checkRun(dir, { ...opt, held: f }); return fs.readFileSync(f, "utf8").split("\n").filter(Boolean); };
const shapeOk = (dir, opt) => { try { checkRun(dir, opt); return true; } catch (e) { if (process.env.BR_DEBUG) console.error(String(e.stdout || "") + String(e.stderr || "")); return false; } };

test("workflow: records the bracket with the same prev/out/race folders and publishes only its own files", () => {
  assert.ok(bracketPy, "a bracket shape check in the publish job");
  assert.match(yml, /run: npm run bracket\n\s+env:\n\s+RPC: .*\n\s+RPC_CHECK: .*\n\s+BRACKET_PREV: \$\{\{ runner\.temp \}\}\/prev\/bracket\n\s+BRACKET_OUT: \$\{\{ runner\.temp \}\}\/games-data\/bracket\n/);
  assert.match(yml, /"\$IN"\/bracket\/\*\.json "\$IN"\/bracket\/vault\/\*\.json/, "the push loop takes the Bracket's files (vault files write-once)");
  assert.match(yml, /git show "FETCH_HEAD:bracket\/vault\/\$f" > "\$RUNNER_TEMP\/prev\/bracket\/vault\/\$f"/);
  assert.match(yml, /\/usr\/bin\/python3 - "\$IN\/bracket" "\$PUB\/bracket" "\$HELD" <<'PY'/);
  // (phase 2: the embedded vhp_ruler.py is text in the workflow, tested byte for byte; its comments are left out here)
  const noEmbed = yml.split("publish:")[1].replace(/# BEGIN vhp_ruler\.py\n[\s\S]*?# END vhp_ruler\.py\n/, "");
  assert.doesNotMatch(noEmbed, /npm |npx |tsx /, "the publish job runs no repository code");
});

test("workflow shape check: accepts a whole recorded week, refuses tampered files", async () => {
  const field = fieldOf(17), signer = signerFn(field), race = raceDir(field), dir = tmp();
  const o = { raceDir: race, picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf([{ player: P(1), number: 5, time: 1 }, { player: P(2), number: 2 ** 20, time: 2 }]) };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...o }));
  await runUntil(NOW, o, dir);
  assert.equal(readW(dir).status, "final");
  assert.ok(shapeOk(dir), "the recorder's own files pass");
  const bad = (f, mut) => { const d = tmp(); fs.cpSync(dir, d, { recursive: true }); const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); mut(j); fs.writeFileSync(path.join(d, f), JSON.stringify(j)); return shapeOk(d); };
  assert.equal(bad("W003.json", (j) => { j.points[0][1] = 999; }), false, "points over the maximum");
  assert.equal(bad("W003.json", (j) => { j.seeding.seeds.push("<script>"); }), false, "a non-address");
  assert.equal(bad("W003.json", (j) => { j.extra = 1; }), false, "an unknown field");
  assert.equal(bad("W003.json", (j) => { j.days[0][0].by["1x"] = 1; }), false);
  assert.equal(bad("board.json", (j) => { j.week.rows.push({ a: P(1), place: 1, pts: 1, champion: "yes", correct: 1, ranked: true }); }), false);
  assert.equal(bad("index.json", (j) => { j.game = 2; }), false, "the bracket's own game id");
});

// ── audit 2026-10-27 F-3 … F-7 ──
const { gameProblem } = await import(path.resolve(APP, "bot/games/bracket.ts"));
async function lockedWeek(o) {
  const dir = tmp();
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  return dir;
}
test("F-3: a last-run file that went missing stops the run instead of wiping history", async () => {
  const field = fieldOf(17), o = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([]) };
  const dir = await lockedWeek(o);
  fs.rmSync(path.join(dir, "W003.json"));
  await assert.rejects(quiet(() => run({ p: "main", check: "check", prev: dir, out: tmp(), head: headAt(B.seedTime(W) + 2 * H), ...o })), /missing; refusing to write/);
  const d2 = await lockedWeek(o); fs.rmSync(path.join(d2, "index.json"));
  await assert.rejects(quiet(() => run({ p: "main", check: "check", prev: d2, out: tmp(), head: headAt(B.seedTime(W) + 2 * H), ...o })), /index\.json is missing/);
  // (A failed read of the published branch that looked like "no history" can't publish over it either: the publish
  //  check holds any run that changes published history — see "published history" below.)
});
test("F-4: decisions use the irreversible block's time; a node far ahead can't void a week; the nodes must agree on it", async () => {
  const field = fieldOf(17), race = raceDir(field, { skip: (t) => t >= B.seedTime(W) - 6 * H && t < B.seedTime(W) + 12 * H });
  const o = { raceDir: race, picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([]) };
  const dir = tmp();
  const h = headAt(B.seedTime(W) + H); h.time += 10 * H;   // the head claims to be 10 hours ahead
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: h, ...o }));
  assert.notEqual(fs.existsSync(path.join(dir, "W003.json")) && readW(dir).status, "void");
  // the second node reports another time for the irreversible block: nothing is written
  const skew = (name) => { const n = nodeOf(signerFn(field))(name); return name === "check" ? { ...n, blockTime: async (x) => T(x) + 3000 } : n; };
  const d2 = tmp();
  const r = await quiet(() => run({ p: "main", check: "check", prev: d2, out: d2, head: headAt(B.seedTime(W) + H), ...o, raceDir: raceDir(field), nodeOf: skew }));
  assert.ok(r.problems.some((p) => p.includes("disagree about block")));
  assert.equal(fs.readdirSync(d2).length, 0);
});
test("F-5: the Picks game must have the bracket's shape; picks timed at or after the lock never count", async () => {
  // D-141: picks open at the seeding (Sunday 00:00) and lock Monday 23:55, so `ahead` is at most 2 days before Tuesday 00:00
  const good = { kind: 3, lock_mode: 2, round_size: String(B.WEEK), round_offset: String(B.ROUND_OFFSET), lead: String(B.LOCK_BEFORE), ahead: String(2 * B.DAY), number_min: "0", number_max: String(B.NUMBER_MAX) };
  assert.equal(gameProblem(good), null);
  for (const [k, v] of [["kind", 2], ["round_offset", "0"], ["round_size", String(B.DAY)], ["lead", "299999"], ["ahead", String(2 * B.DAY + 1)], ["ahead", "0"], ["number_max", "32767"]]) assert.match(gameProblem({ ...good, [k]: v }), new RegExp(k));
  // R-4: the owner's tighten_game (earlier lock, later opening) is still a valid bracket game
  assert.equal(gameProblem({ ...good, lead: String(B.LOCK_BEFORE * 3), ahead: String(B.DAY) }), null);
  assert.match(gameProblem(null), /no bracket game/);
  const field = fieldOf(17), race = raceDir(field);
  const rows = [{ player: P(1), number: 0, time: B.lockTime(W) - 1 }, { player: P(2), number: 1, time: B.lockTime(W) }, { player: P(3), number: 2, time: B.lockTime(W) + 9e5 }];
  const base = { raceDir: race, picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf(rows) };
  const dir = await lockedWeek(base);
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...base, gameOf: async () => good }));
  assert.deepEqual(readW(dir).picks.rows.map((x) => x[0]), [P(1)]);
  assert.ok(r.problems.some((p) => p.includes("2 pick(s) timed at or after the lock")));
  const d2 = await lockedWeek(base);
  const r2 = await quiet(() => run({ p: "main", check: "check", prev: d2, out: d2, head: headAt(B.lockTime(W) + 60000), ...base, gameOf: async () => ({ ...good, round_offset: "0" }) }));
  assert.equal(readW(d2).picks, null); assert.ok(r2.problems.some((p) => p.includes("round_offset")));
});
test("F-6 / F-7: each recorder step can fail alone; leaderboards are capped at 1,000 rows", async () => {
  const wfy = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
  // fix-check F9: the Bracket records in its own job; a failure there never stops Block X's publish, and emails
  const jobs = wfy.split(/\n  (?=[a-z_]+:\n)/);
  const rb = jobs.find((j) => j.startsWith("record_bracket:")), rx = jobs.find((j) => j.startsWith("record:"));
  assert.ok(rb && /- name: Record the Producer Bracket\n\s+id: bracket\n\s+run: npm run bracket/.test(rb) && /name: games-data-bracket/.test(rb), "its own job and artifact");
  assert.doesNotMatch(rx.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"), /bracket/i, "Block X's job runs no Bracket code");
  assert.match(wfy, /needs: \[record, record_bracket\]\n\s+# [^\n]*\n\s+if: \$\{\{ always\(\) && vars\.GAMES_ENABLED == 'true' && github\.ref == 'refs\/heads\/main' && needs\.record\.result == 'success' \}\}/);
  assert.match(wfy, /if: \$\{\{ always\(\) && \(needs\.record\.outputs\.held == 'true' \|\| needs\.record_bracket\.result == 'failure'\) \}\}/);
  assert.match(wfy, /if \[ -d "\$IN\/bracket" \]; then\n\s+\/usr\/bin\/python3 - "\$IN\/bracket"/, "no Bracket files: the check is skipped");
  const field = fieldOf(17), race = raceDir(field);
  const many = Array.from({ length: 1500 }, (_, i) => ({ player: ("1Many" + [0, 1, 2].map((k) => B58[Math.floor(i / 58 ** k) % 58]).join("")).padEnd(34, "x"), number: i % 3, time: 5 }));
  const o = { raceDir: race, picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf(many) };
  const dir = await lockedWeek(o);
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...o }));
  const r = await runUntil(RD(0) + 25 * H, o, dir, 2);
  assert.equal(r.board.week.rows.length, 1000); assert.equal(readW(dir).points.length, 1500, "every score stays in the week file");
  assert.ok(shapeOk(dir));
});

test("R-4: the two nodes must agree about the Picks game", async () => {
  const field = fieldOf(17), base = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([{ player: P(1), number: 0, time: 1 }]) };
  const good = { kind: 3, lock_mode: 2, round_size: String(B.WEEK), round_offset: String(B.ROUND_OFFSET), lead: String(B.LOCK_BEFORE), ahead: String(2 * B.DAY), number_min: "0", number_max: String(B.NUMBER_MAX) };
  const dir = await lockedWeek(base);
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...base, gameOf: async (n) => (n === "check" ? { ...good, enabled: false } : good) }));
  assert.equal(readW(dir).picks, null); assert.ok(r.problems.some((p) => p.includes("disagree about the Picks game")));
});

test("the rebuilt effective VHP must equal the VHP contract's own effective balance at the read block", async () => {
  const field = fieldOf(17), dir = tmp();
  const o = { picksContract: "1P", nodeOf: nodeOf(signerFn(field), null, { effOff: 1 }), picksOf: picksOf([]) };
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  assert.ok(r.problems.some((p) => p.includes("doesn't match the contract's effective balance")), JSON.stringify(r.problems));
  assert.ok(!fs.existsSync(path.join(dir, "W003.json")) || !readW(dir).seeding, "not seeded on a mismatch");
});

test("audit S-3: when a node can't give the effective balance as a read-only call, seeding goes ahead on the exact rebuild", async () => {
  const field = fieldOf(17), dir = tmp();
  const noEff = (name) => { const n = nodeOf(signerFn(field))(name); return { ...n, balance: async (a) => { const { eff, ...b } = await n.balance(a); return b; } }; };
  const r = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), picksContract: "1P", nodeOf: noEff, picksOf: picksOf([]) }));
  assert.deepEqual(r.problems, []);
  assert.equal(readW(dir).seeding.seeds.length, 16);
});

// ── the Vault file (Vault v6 hand-off, 2026-10-28) ──
test("vault rows (#E-3 C-1): the groups the Vault must pay get 255, 254, …; every other row gets 1, so its cutoff pays exactly them", () => {
  const pts = [[P(1), 20, 1, 9], [P(2), 20, 0, 9], [P(3), 20, 0, 9], [P(4), 31, 0, 12], [P(5), 0, 0, 0], [P(6), 5, 0, 4], [P(7), 40, 1, 14]];
  const staked = new Set([P(1), P(2), P(3), P(4), P(5), P(7)]);   // P(6) is a free player
  const rows = plain(vaultRows(pts, staked));
  assert.deepEqual(rows.map((r) => r.player), [P(7), P(4), P(1), P(2), P(3)], "best first; P(5) has no point; P(6) isn't staked");
  const v = Object.fromEntries(rows.map((r) => [r.player, r.points]));
  // 5 rows: the Vault pays ceil(30%) = 2 → P(7) and P(4); everyone else 1
  assert.deepEqual([v[P(7)], v[P(4)], v[P(1)], v[P(2)], v[P(3)]], [255, 254, 1, 1, 1]);
  assert.deepEqual(plain(rec.vaultPays(rows)).sort(), [P(4), P(7)].sort());
  assert.ok(rows.every((r) => Number.isInteger(r.points) && r.points >= 1 && r.points <= 255));
  assert.deepEqual(plain(vaultRows(pts, new Set())), [], "nobody qualifies: no rows");
  // a tied group straddling the cutoff is paid whole (the Vault's own rule)
  const tie = [[P(1), 9, 0, 5], [P(2), 7, 0, 4], [P(3), 7, 0, 4], [P(4), 7, 0, 4], [P(5), 2, 0, 1], [P(6), 1, 0, 1]];
  const tr = plain(vaultRows(tie, new Set(tie.map((r) => r[0]))));
  assert.deepEqual(plain(rec.vaultPays(tr)).sort(), [P(1), P(2), P(3), P(4)].sort(), "need 2: P(1), then the 3-way tie whole");
  // any number of places: the Vault's cutoff pays exactly the earners (stakedEarners), never the value-1 rows
  for (const N of [10, 300, 846, 847, 1000, 3000]) {
    const many = Array.from({ length: N }, (_, i) => [("1M" + String(i).padStart(6, "1")).padEnd(34, "x"), 1 + (i % 97), i % 2, i % 15]);
    const tm = new Map(many.map((r, i) => [r[0], 1_800_000_000_000 + i * 3000]));   // each in its own block
    const big = plain(vaultRows(many, new Set(many.map((r) => r[0])), tm));
    assert.equal(big.length, N); assert.ok(big.every((r) => r.points >= 1 && r.points <= 255));
    for (let i = 1; i < big.length; i++) assert.ok(big[i - 1].points >= big[i].points);
    assert.deepEqual(plain(rec.vaultPays(big)).sort(), plain(rec.stakedEarners(many, tm)).sort(), `N=${N}`);
    assert.equal(rec.vaultPays(big).length, Math.floor((N * 30 + 99) / 100), `N=${N}: exactly the Vault's 30%, ceil`);
  }
});

test("vault file: written once the week is final, with only staked players; none when the stakes can't be read in 3 days", async () => {
  const field = fieldOf(17), signer = signerFn(field);
  const rows = [{ player: P(1), number: 0, time: 1 }, { player: P(2), number: 5, time: 2 }, { player: P(3), number: 9, time: 3 }];
  const base = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf(rows) };
  const play = async (o, until) => { const d = tmp(); await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...base, ...o })); await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 60000), ...base, ...o })); for (let i = 0; i < 40; i++) await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(until), ...base, ...o })); return d; };
  // P(1) and P(3) are staked; P(2) plays free
  const d = await play({ stakedOf: async (_n, ps) => ps.filter((p) => p !== P(2)) }, NOW);
  const wf = readW(d); assert.equal(wf.status, "final"); assert.deepEqual(wf.staked.list, [P(1), P(3)].sort());
  const vf = JSON.parse(fs.readFileSync(path.join(d, "vault", `W${W}.json`), "utf8"));
  assert.deepEqual(Object.keys(vf).sort(), ["final", "first", "game", "rows", "second", "week"]);
  assert.equal(vf.game, 9); assert.equal(vf.week, W); assert.equal(vf.final, true);
  const p2 = readW(d).points.find((r) => r[0] === P(2));
  assert.deepEqual(vf.first, p2 && p2[1] >= 1 ? [P(2)] : [], "the only free player with a point is 1st on the Free play board");
  assert.deepEqual(vf.second, []);
  assert.deepEqual(readW(d).staked.held, [P(1), P(3)].sort(), "read again after the week ended");
  assert.ok(vf.rows.every((r) => r.player !== P(2)), "free players never in the rows");
  assert.equal(vf.week, B.weekOf(B.weekStart(W) + 1), "the Vault's week number = the KnodeGames week");
  // the board marks staked rows as ranked (Staked tab) and the rest as free play
  const board = JSON.parse(fs.readFileSync(path.join(d, "board.json"), "utf8"));
  const lw = board.lastWeek.rows; assert.ok(lw.find((r) => r.a === P(2)).ranked === false && lw.find((r) => r.a === P(1)).ranked === true);
  // the nodes disagree about the stakes: results in, not final
  const d2 = await play({ stakedOf: async (n, ps) => (n === "check" ? [] : ps) }, NOW);
  assert.equal(readW(d2).status, "locked"); assert.ok(!fs.existsSync(path.join(d2, "vault")));
  // still unreadable 3 days after the week ends: final without a file (the Vault rolls the week over)
  await quiet(() => rec.run({ p: "main", check: "check", prev: d2, out: d2, head: headAt(B.weekStart(W + 1) + 3 * DAY + H), ...base, stakedOf: async () => { throw new Error("no Vault v6 yet"); } }));
  assert.equal(readW(d2).status, "final"); assert.equal(readW(d2).vault, "missed"); assert.ok(!fs.existsSync(path.join(d2, "vault")));
  // the publish check refuses a bad vault file (judged against a branch without it: a published one is write-once)
  const noVault = tmp(); fs.cpSync(d, noVault, { recursive: true }); fs.rmSync(path.join(noVault, "vault"), { recursive: true });
  const badV = (mut) => { const x = tmp(); fs.cpSync(d, x, { recursive: true }); const f = path.join(x, "vault", `W${W}.json`); const j = JSON.parse(fs.readFileSync(f, "utf8")); mut(j); fs.writeFileSync(f, JSON.stringify(j)); return shapeOk(x, { pub: noVault }); };
  assert.ok(shapeOk(d)); assert.ok(shapeOk(d, { pub: noVault }), "the recorder's own vault file passes");
  assert.equal(badV((j) => { j.rows[0].points = 0; }), false, "points 0");
  assert.equal(badV((j) => { j.rows[0].points = 256; }), false, "points over 255");
  assert.equal(badV((j) => { j.rows.push({ ...j.rows[0] }); }), false, "a player twice");
  assert.equal(badV((j) => { j.game = 2; }), false, "another game");
  assert.equal(badV((j) => { j.first = [j.rows[0].player]; j.second = []; }), false, "a staked row can't also win the free prize");
  assert.equal(badV((j) => { j.first = Array.from({ length: 11 }, (_, i) => P(20 + i)); j.second = []; }), false, "at most 10 a place");
  assert.equal(badV((j) => { j.first = [P(20), P(21)]; j.second = [P(22)]; }), false, "a tie for 1st shares all 3 VHP: no 2nd");
  assert.equal(badV((j) => { j.first = [P(20)]; j.second = [P(21), P(22)]; }), false, "the right shape, but not what the published final week gives");
  assert.equal(badV((j) => { j.final = false; }), false);
});

test("free prize winners: ties share, more than 10 tied leaves the place empty, staked or held players never win, nobody qualifying", () => {
  const W_ = (pts, held = []) => plain(freeWinners(pts, new Set(held)));
  // [player, points, champion, right winners]
  assert.deepEqual(W_([[P(1), 9, 0, 5], [P(2), 7, 0, 4], [P(3), 7, 0, 4], [P(4), 3, 0, 2]]), { first: [P(1)], second: [P(2), P(3)].sort() }, "one 1st, two share 2nd");
  assert.deepEqual(W_([[P(1), 9, 0, 5], [P(2), 9, 0, 5], [P(3), 7, 0, 4]]), { first: [P(1), P(2)].sort(), second: [] }, "tied for 1st: they share all 3 VHP");
  assert.deepEqual(W_([[P(1), 9, 1, 5], [P(2), 9, 0, 5]]), { first: [P(1)], second: [P(2)] }, "the right champion breaks the tie");
  const ten = Array.from({ length: 10 }, (_, i) => [P(10 + i), 5, 0, 3]), eleven = Array.from({ length: 11 }, (_, i) => [P(10 + i), 5, 0, 3]);
  assert.equal(W_(ten).first.length, 10, "10 tied all win");
  assert.deepEqual(W_([...eleven, [P(40), 2, 0, 1]]), { first: [], second: [] }, "11 tied for 1st: the place goes back to the pool, and nobody below is moved up");
  assert.deepEqual(W_([[P(1), 9, 0, 5], ...eleven]), { first: [P(1)], second: [] }, "11 tied for 2nd: 2nd goes back to the pool");
  assert.deepEqual(W_([[P(1), 9, 0, 5], [P(2), 4, 0, 3]], [P(1)]), { first: [P(2)], second: [] }, "a held (staked) player can't win; the next free player is 1st");
  assert.deepEqual(W_([[P(1), 0, 0, 0], [P(2), 0, 0, 0]]), { first: [], second: [] }, "nobody with a point: nobody qualifies");
  assert.deepEqual(W_([]), { first: [], second: [] });
});

test("audit S-5 forfeit: a seed starting its day under half its seeding VHP loses that matchup", () => {
  const day = (wa, ca, wb, cb) => new Map([["1Fav", { baseline: wa, credited: ca, expected: wa * 1e-8 }], ["1Dog", { baseline: wb, credited: cb, expected: wb * 1e-8 }]]);
  const sv = new Map([["1Fav", 100], ["1Dog", 50]]);
  // the underdog holds 10 VHP of its 50 and has a lucky day: it would win on index, but it forfeits
  assert.equal(B.otherWins(day(100e8, 1, 10e8, 5), "1Fav", "1Dog"), true, "without the rule: a lottery win");
  assert.equal(B.otherWins(day(100e8, 1, 10e8, 5), "1Fav", "1Dog", sv), false, "with the rule: forfeit");
  assert.equal(B.otherWins(day(100e8, 1, 25e8, 5), "1Fav", "1Dog", sv), true, "exactly half: no forfeit");
  assert.equal(B.otherWins(day(40e8, 9, 50e8, 1), "1Fav", "1Dog", sv), true, "the favourite forfeits: the underdog wins");
  assert.equal(B.otherWins(day(40e8, 9, 10e8, 1), "1Fav", "1Dog", sv), false, "both forfeit: the index decides");
  // results() takes the seeding VHP in seed order
  const seeds = Array.from({ length: 8 }, (_, i) => "1S" + i), vhp = seeds.map(() => 100);
  const d0 = new Map(seeds.map((a, i) => [a, { baseline: i === 7 ? 10e8 : 100e8, credited: i === 7 ? 999 : 1, expected: 1 }]));
  assert.equal(B.results(seeds, 8, [d0], vhp).rounds[0][0], 1, "seed 8 forfeits round 1 to seed 1");
  assert.equal(B.results(seeds, 8, [d0]).rounds[0][0], 8, "(without seeding VHP: no forfeits)");
});

test("fix-check F-5: a player who withdrew mid-week stays on the Staked board and is never a free-prize winner", async () => {
  const field = fieldOf(17), signer = signerFn(field);
  const rows = [{ player: P(1), number: 0, time: 1 }, { player: P(2), number: 5, time: 2 }, { player: P(3), number: 9, time: 3 }];
  const base = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf(rows) };
  // P(1) staked; P(2) staked at the start then withdrew (the close read: not staked, but held); P(3) free
  let closing = false;
  const stakedOf = async () => (closing ? { staked: [P(1)], held: [P(1), P(2)] } : { staked: [P(1), P(2)], held: [P(1), P(2)] });
  const d = tmp(), go = (t) => quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(t), ...base, stakedOf }));
  await go(B.seedTime(W) + H); await go(B.lockTime(W) + 60000); await go(B.weekStart(W) + H);
  closing = true; for (let i = 0; i < 40; i++) await go(NOW);
  assert.equal(readW(d).status, "final");
  const lw = JSON.parse(fs.readFileSync(path.join(d, "board.json"), "utf8")).lastWeek.rows;
  assert.equal(lw.find((r) => r.a === P(2)).ranked, true, "on the Staked board");
  assert.equal(lw.find((r) => r.a === P(2)).earns, 0, "…earning nothing there (#E-3 M-2)");
  const vf = JSON.parse(fs.readFileSync(path.join(d, "vault", `W${W}.json`), "utf8"));
  assert.ok(!vf.first.includes(P(2)) && !vf.second.includes(P(2)) && !vf.rows.some((r) => r.player === P(2)));
});

test("owner 2026-10-29 / D-087: ties go to who submitted first; brackets in the same block share (a same-block copy ties)", () => {
  const pts = [[P(1), 9, 0, 5], [P(2), 9, 0, 5], [P(3), 9, 0, 5], [P(4), 4, 0, 2]];
  const tm = new Map([[P(1), 3000], [P(2), 1000], [P(3), 1000], [P(4), 500]]);
  assert.deepEqual(plain(freeWinners(pts, new Set(), tm)), { first: [P(2), P(3)].sort(), second: [] }, "P(2) and P(3) picked in the same block: they share 1st");
  const tm2 = new Map([[P(1), 3000], [P(2), 1000], [P(3), 2000], [P(4), 500]]);
  assert.deepEqual(plain(freeWinners(pts, new Set(), tm2)), { first: [P(2)], second: [P(3)] }, "the earliest is 1st, the next earliest 2nd");
  // 11 copies of the leader's bracket, all made after it: the leader stays alone in 1st
  const copies = Array.from({ length: 11 }, (_, i) => [P(20 + i), 9, 0, 5]);
  const tm3 = new Map([[P(1), 100], ...copies.map((r, i) => [r[0], 200 + i])]);
  assert.deepEqual(plain(freeWinners([[P(1), 9, 0, 5], ...copies], new Set(), tm3)).first, [P(1)]);
  // the champion and right winners still come before the time
  assert.deepEqual(plain(freeWinners([[P(1), 9, 0, 5], [P(2), 9, 1, 5]], new Set(), new Map([[P(1), 1], [P(2), 9]]))).first, [P(2)]);
  // the Vault rows keep the same order for the paid groups (4 rows: the top 2 are paid)
  const v = plain(vaultRows(pts, new Set(pts.map((r) => r[0])), tm2));
  const at = Object.fromEntries(v.map((r) => [r.player, r.points]));
  assert.ok(at[P(2)] > at[P(3)] && at[P(3)] > at[P(1)] && at[P(1)] === 1 && at[P(4)] === 1);
  // the boards rank the same way
  const ranked = B.rank([{ player: P(1), points: 9, champion: false, correct: 5, time: 3000 }, { player: P(2), points: 9, champion: false, correct: 5, time: 1000 }]);
  assert.deepEqual(ranked.map((r) => [r.player, r.place]), [[P(2), 1], [P(1), 2]]);
  assert.equal(B.rank([{ player: P(1), points: 9, champion: false, correct: 5 }, { player: P(2), points: 9, champion: false, correct: 5 }])[1].place, 1, "no time (all-time board): shared");
});

test("fix-check F-1: the Vault (a pooled producer: players' withdrawable stakes) never forfeits; it stays in the field", async () => {
  // a pooled producer is judged on its rate index (rate ÷ q, #E-3 H-4); everyone else on credited ÷ expected
  const day = new Map([["1Vault", { baseline: 10e8, credited: 5, expected: 0.1, rate: 5, q: 0.1 }], ["1Dog", { baseline: 100e8, credited: 1, expected: 1, rate: 1, q: 1 }]]);
  const sv = new Map([["1Vault", 100], ["1Dog", 100]]);
  assert.equal(B.otherWins(day, "1Vault", "1Dog", sv), true, "an ordinary producer this far under would forfeit");
  assert.equal(B.otherWins(day, "1Vault", "1Dog", sv, new Set(["1Vault"])), false, "the Vault doesn't: its index decides");
  // the recorder records the Vault as pooled when it is seeded
  const field = fieldOf(17), dir = tmp();
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([]), vault: addr(2) }));
  const s = readW(dir).seeding;
  assert.ok(s.seeds.includes(addr(2)), "the Vault is seeded like any producer");
  assert.deepEqual(s.pooled, [addr(2)]);
  // fix-check F2: the publish job lets only the real Knode Games Pool be pooled, so a forged run can't exempt a producer
  assert.equal(shapeOk(dir), false, "a test address marked pooled is refused");
});

test("publish check: the Vault file is accepted in the run that makes its week final (#E-3 M-5), and published history can't change", async () => {
  const field = fieldOf(17), signer = signerFn(field);
  const rows = [{ player: P(1), number: 0, time: 1 }, { player: P(2), number: 5, time: 2 }, { player: P(3), number: 9, time: 3 }];
  const o = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf(rows), stakedOf: async (_n, ps) => ps.filter((p) => p !== P(2)) };
  const d = tmp();
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 60000), ...o }));
  const mid = tmp(); fs.cpSync(d, mid, { recursive: true });           // the branch as published at the lock
  for (let i = 0; i < 40; i++) await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.weekStart(W + 1) - H), ...o }));
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.weekStart(W + 1) + H), ...o }));
  const review = tmp(); fs.cpSync(d, review, { recursive: true });     // published Monday 01:00: end-of-week stakes read once
  assert.equal(readW(review).status, "locked"); assert.ok(readW(review).staked.held);
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(NOW), ...o }));
  assert.equal(readW(d).status, "final"); assert.ok(fs.existsSync(path.join(d, "vault", `W${W}.json`)));
  // the run that makes the week final publishes its vault file too, once the week's recompute agrees
  const hf = path.join(tmp(), "held"); fs.writeFileSync(hf, "");
  checkRun(d, { pub: review, held: hf });
  assert.deepEqual(fs.readFileSync(hf, "utf8").split("\n").filter(Boolean), [], "nothing held");
  // too late: after Thursday 00:00 UTC (the window), by the job's clock
  assert.equal(shapeOk(d, { pub: review, now: B.weekStart(W + 1) + 3 * DAY + 1 }), false);
  // published history: a final week, a seeding or a recorded hour that changes holds the whole run, with an alert
  const tamper = (mut, pub, now) => { const x = tmp(); fs.cpSync(pub === mid ? mid : d, x, { recursive: true }); const f = path.join(x, `W${String(W).padStart(3, "0")}.json`); const j = JSON.parse(fs.readFileSync(f, "utf8")); mut(j); fs.writeFileSync(f, JSON.stringify(j) + "\n"); const h = path.join(tmp(), "held"); fs.writeFileSync(h, ""); checkRun(x, { pub, held: h, now }); return fs.readFileSync(h, "utf8"); };
  assert.match(tamper((j) => { j.points[0][1] += 1; }, d), /!alert/, "a final week changed");
  assert.match(tamper((j) => { j.seeding.vhp[0] += 1; }, mid, B.lockTime(W) + 60000), /!alert/, "the seeding changed");
  assert.equal(tamper(() => {}, mid, B.lockTime(W) + 60000), "", "an unchanged run passes");
});

test("board rows follow the leaderboard standard: boardPlace and earns (medals only from the week the Vault pays)", async () => {
  const field = fieldOf(17), signer = signerFn(field);
  const rows = [{ player: P(1), number: 0, time: 1 }, { player: P(2), number: 5, time: 2 }, { player: P(3), number: 9, time: 3 }, { player: P(4), number: 0, time: 4 }];
  const ON = { v: 1, games: {} };   // no change for game 9: follows its registration (free prize allowed = on)
  const go = async (prizesFromWeek, freeSwitches = ON) => {
    const o = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf(rows), stakedOf: async (_n, ps) => ps.filter((p) => p === P(1) || p === P(3)), prizesFromWeek, freeSwitches };
    const d = tmp();
    await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o }));
    await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 60000), ...o }));
    for (let i = 0; i < 40; i++) await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(NOW), ...o }));
    return { d, board: JSON.parse(fs.readFileSync(path.join(d, "board.json"), "utf8")) };
  };
  const off = await go(null);
  assert.ok(off.board.lastWeek.rows.every((r) => r.earns === 0), "no from-week: nobody is marked as earning");
  assert.ok(off.board.lastWeek.rows.every((r) => r.boardPlace === r.place && r.boardPlace >= 1));
  const on = await go(W);
  const wr = on.board.lastWeek.rows, free = wr.filter((r) => !r.ranked), staked = wr.filter((r) => r.ranked);
  const vf = JSON.parse(fs.readFileSync(path.join(on.d, "vault", `W${W}.json`), "utf8"));
  assert.deepEqual(free.filter((r) => r.earns === 1).map((r) => r.a).sort(), vf.first, "the Free play medal is the Vault file's 1st");
  assert.deepEqual(free.filter((r) => r.earns === 2).map((r) => r.a).sort(), vf.second);
  // #E-3 M-2: the Staked medals are exactly the players the Vault pays from the file's rows
  assert.deepEqual(staked.filter((r) => r.earns === 3).map((r) => r.a).sort(), plain(rec.vaultPays(vf.rows)).sort());
  assert.ok(shapeOk(on.d), "the publish check accepts the board");
  assert.equal(JSON.parse(fs.readFileSync(path.join(on.d, "index.json"), "utf8")).prizesFromWeek, W);
  assert.ok(on.board.lastWeek.prizes.length > 0, "switch on: the free prize list is shown");
  // Owner 11 Nov: free prize OFF. The switch is off for the week (set before it started), or no switches file could be
  // read: no Free play medals and no prize list; the Staked medals and the vault file are unchanged.
  const offSw = { v: 1, games: { "9": [{ from: W - 1, on: false, set: new Date(B.weekStart(W - 1) - 3600000).toISOString() }] } };
  for (const [why, sw] of [["switch off", offSw], ["no switches file", null]]) {
    const x = await go(W, sw), xr = x.board.lastWeek.rows;
    assert.ok(xr.filter((r) => !r.ranked).every((r) => r.earns === 0), why + ": no Free play medal");
    assert.deepEqual(x.board.lastWeek.prizes, [], why + ": no free prize list");
    assert.deepEqual(xr.filter((r) => r.earns === 3).map((r) => r.a).sort(), staked.filter((r) => r.earns === 3).map((r) => r.a).sort(), why + ": Staked medals unchanged");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(x.d, "vault", `W${W}.json`), "utf8")), vf, why + ": the vault file is unchanged (the vault bot's switch decides the free prize)");
    assert.ok(shapeOk(x.d), why + ": the publish check accepts the board");
  }
});

test("owner 11 Nov: the switches file is read fail-closed (missing, malformed or a link = none)", () => {
  const d = tmp(), f = path.join(d, "free-prizes.json");
  assert.equal(rec.switchesFromFile(undefined), null);
  assert.equal(rec.switchesFromFile(f), null, "missing");
  fs.writeFileSync(f, "{not json"); assert.equal(rec.switchesFromFile(f), null, "unreadable");
  fs.writeFileSync(f, JSON.stringify({ v: 2, games: {} })); assert.equal(rec.switchesFromFile(f), null, "not a v1 file");
  const good = { v: 1, games: { "9": [{ from: 4, on: false, set: "2026-11-11T04:00:00.000Z" }] } };
  fs.writeFileSync(f, JSON.stringify(good)); assert.deepEqual(rec.switchesFromFile(f), good);
  const l = path.join(d, "link.json"); fs.symlinkSync(f, l); assert.equal(rec.switchesFromFile(l), null, "a link");
});

test("final weeks are frozen: a later run keeps the stored results and points as they are", async () => {
  const field = fieldOf(17), signer = signerFn(field);
  const rows = [{ player: P(1), number: 0, time: 1 }, { player: P(2), number: 5, time: 2 }];
  const o = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf(rows), stakedOf: async (_n, ps) => ps };
  const d = tmp();
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 60000), ...o }));
  for (let i = 0; i < 40; i++) await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(NOW), ...o }));
  const f = path.join(d, `W${String(W).padStart(3, "0")}.json`), wf = JSON.parse(fs.readFileSync(f, "utf8"));
  assert.equal(wf.status, "final");
  // as if the scoring rules had changed since: the stored points stay; re-scoring would give other numbers
  wf.points = wf.points.map((x) => [x[0], Math.min(x[1] + 1, 14), x[2], x[3]]); fs.writeFileSync(f, JSON.stringify(wf) + "\n");
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(NOW + H), ...o }));
  assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")).points, wf.points);
});

test("R-BR-4: the vault bot's own board check passes on the recorder's board and vault file (ties broken by pick time on both)", async () => {
  const { orderBreak, boardScore, boardSpec } = await import(path.resolve(APP, "bot/vault.ts"));
  const dep = JSON.parse(fs.readFileSync(path.resolve(APP, "game-data/deployment.json"), "utf8"));
  assert.equal(boardSpec(dep.vaultGames["9"].results, dep.vaultGames["9"].board), "games-data:bracket/board.json", "the board sits next to the vault folder");
  const field = fieldOf(17), signer = signerFn(field);
  // P(1) and P(4) send the same bracket in different blocks; P(2) and P(5) the same one in the same block
  const rows = [{ player: P(1), number: 0, time: 1000 }, { player: P(4), number: 0, time: 4000 }, { player: P(2), number: 5, time: 2000 }, { player: P(5), number: 5, time: 2000 }, { player: P(3), number: 9, time: 3000 }];
  const o = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf(rows), stakedOf: async (_n, ps) => ps };
  const d = tmp();
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 60000), ...o }));
  for (let i = 0; i < 40; i++) await quiet(() => rec.run({ p: "main", check: "check", prev: d, out: d, head: headAt(NOW), ...o }));
  const board = JSON.parse(fs.readFileSync(path.join(d, "board.json"), "utf8")), vf = JSON.parse(fs.readFileSync(path.join(d, "vault", `W${W}.json`), "utf8"));
  assert.equal(board.lastWeek.week, W);
  const lw = board.lastWeek.rows.filter((x) => x.ranked);
  const places = new Map(lw.map((x) => [x.a, x.place]));
  assert.equal(orderBreak(vf.rows, places), "", "the file's values follow the board's places");
  const at = new Map(lw.map((x) => [x.a, x.place]));
  if (boardScore(lw.find((x) => x.a === P(1))) === boardScore(lw.find((x) => x.a === P(4)))) assert.ok(at.get(P(1)) < at.get(P(4)), "the earlier of two identical brackets places higher");
  if (boardScore(lw.find((x) => x.a === P(2))) === boardScore(lw.find((x) => x.a === P(5)))) assert.equal(at.get(P(2)), at.get(P(5)), "same block: same place (D-087)");
  for (const x of vf.rows) assert.ok(places.has(x.player), "every file row is on the board");
});

// ── fix-check of 5 Nov (PR #186): recorder side ──
test("F3 / RC-4: picks are recorded within 3 h of the lock (or under BRACKET_RELEASE); never recorded → void at the backstop", async () => {
  const field = fieldOf(17), rows = [{ player: P(1), number: 0, time: 1 }];
  let down = true;
  const o = { picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: async (n, r) => { if (down) throw new Error("node down"); return picksOf(rows)(n, r); } };
  const d = await lockedWeek(o);
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + H), ...o }));
  assert.equal(readW(d).picks, null, "the Picks reads fail: nothing recorded");
  down = false;
  const late = await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 4 * H), ...o }));
  assert.equal(readW(d).picks, null, "4 h after the lock: not recorded any more");
  assert.ok(late.problems.some((p) => /within 3 h of the lock/.test(p)), JSON.stringify(late.problems));
  const d2 = tmp(); fs.cpSync(d, d2, { recursive: true });
  await quiet(() => run({ p: "main", check: "check", prev: d2, out: d2, head: headAt(B.lockTime(W) + 4 * H), ...o, release: new Set([W]) }));
  assert.equal(readW(d2).picks.rows.length, 1, "under BRACKET_RELEASE the late picks are recorded");
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.weekStart(W + 1) + 3 * DAY + H), ...o }));
  assert.equal(readW(d).status, "void"); assert.match(readW(d).void, /picks could not be recorded/);
});

test("F2: the seeding counts only after a later run reads it the same; a different reading is held, or replaced under release (before picks)", async () => {
  const d = tmp(), o = { picksContract: addr(60), picksOf: picksOf([]) };
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o, nodeOf: nodeOf(signerFn(fieldOf(17))) }));
  assert.equal(readW(d).seeding.re, undefined, "first read: not counted yet");
  const r = await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + 2 * H), ...o, nodeOf: nodeOf(signerFn(fieldOf(40))) }));
  assert.equal(readW(d).seeding.re, undefined); assert.ok(r.problems.some((p) => /seeding reads differently/.test(p)), JSON.stringify(r.problems));
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + 3 * H), ...o, nodeOf: nodeOf(signerFn(fieldOf(40))), release: new Set([W]) }));
  assert.equal(readW(d).seeding.size, 32, "replaced under release"); assert.equal(readW(d).seeding.re, undefined, "…and read again before it counts");
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + 4 * H), ...o, nodeOf: nodeOf(signerFn(fieldOf(40))) }));
  assert.equal(readW(d).seeding.re, 1);
});

test("F4: an hour that reads differently later is held; under BRACKET_RELEASE the new two-node reading replaces it and is read again", async () => {
  const field = fieldOf(17), signer = signerFn(field), d = tmp();
  const o = { picksContract: addr(60), nodeOf: nodeOf(signer), picksOf: picksOf([{ player: P(1), number: 0, time: 1 }]) };
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 60000), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(RD(0) + 3 * H), ...o }));   // hours 0-2 recorded
  // a forged hour 1 in the published file (as a bad run would leave it)
  const f = path.join(d, "W003.json"), wf = readW(d); wf.days[0][1] = { ...wf.days[0][1], q: wf.days[0][1].q + 1 }; fs.writeFileSync(f, JSON.stringify(wf) + "\n");
  const r = await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(RD(0) + 3 * H), ...o }));
  assert.ok(r.problems.some((p) => /hour 1 reads differently/.test(p)), JSON.stringify(r.problems)); assert.notEqual(readW(d).days[0][1].re, 1);
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(RD(0) + 3 * H), ...o, release: new Set([W]) }));
  const fixed = readW(d).days[0][1];
  assert.equal(fixed.q, wf.days[0][1].q - 1, "the chain's reading is back"); assert.equal(fixed.re, undefined, "not counted until read again");
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(RD(0) + 3 * H), ...o }));
  assert.equal(readW(d).days[0][1].re, 1);
});

// ── fix-check 2 (PR #186 @ 8d3d942f) ──
test("PK-1 / PK-2: picks count only once a later run reads them the same; a different read is held, replaced only under release before round 1's first hour", async () => {
  const field = fieldOf(17);
  let cur = [{ player: P(1), number: 0, time: 1 }];
  const o = { picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: async (n, r) => picksOf(cur)(n, r) };
  const d = await lockedWeek(o);
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + H), ...o }));
  assert.equal(readW(d).picks.rows.length, 1); assert.equal(readW(d).picks.re, undefined, "first read: not counted yet");
  assert.equal(readW(d).staked, null, "no stakes are read for unconfirmed picks");
  cur = [...cur, { player: P(2), number: 5, time: 2 }];   // a later reading differs (a forged first run dropped P(2))
  const r = await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 2 * H), ...o }));
  assert.ok(r.problems.some((p) => /picks read differently/.test(p)), JSON.stringify(r.problems)); assert.equal(readW(d).picks.rows.length, 1);
  const late = tmp(); fs.cpSync(d, late, { recursive: true });
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 3 * H), ...o, release: new Set([W]) }));
  assert.equal(readW(d).picks.rows.length, 2, "replaced under release"); assert.equal(readW(d).picks.re, undefined, "…and read again before it counts");
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 4 * H), ...o }));
  assert.equal(readW(d).picks.re, 1);
  // PK-2: after round 1's first hour, not even a release replaces them (every result could be known)
  const r2 = await quiet(() => run({ p: "main", check: "check", prev: late, out: late, head: headAt(B.roundDay(W, 0, 16) + 2 * H), ...o, release: new Set([W]) }));
  assert.equal(readW(late).picks.rows.length, 1); assert.equal(readW(late).picks.re, undefined);
  assert.ok(r2.problems.some((p) => /round 1's first hour/.test(p)), JSON.stringify(r2.problems));
  // never confirmed → void at the backstop
  await quiet(() => run({ p: "main", check: "check", prev: late, out: late, head: headAt(B.weekStart(W + 1) + 3 * DAY + H), ...o }));
  assert.equal(readW(late).status, "void"); assert.match(readW(late).void, /picks could not be confirmed/);
});

test("S-1: a seeding that reads differently after its 24 hours is never replaced, even under release (the publish job would refuse it)", async () => {
  const d = tmp(), o = { picksContract: addr(60), picksOf: picksOf([]) };
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + H), ...o, nodeOf: nodeOf(signerFn(fieldOf(17))) }));
  const r = await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.seedTime(W) + 27 * H), ...o, nodeOf: nodeOf(signerFn(fieldOf(40))), release: new Set([W]) }));
  assert.equal(readW(d).seeding.size, 16, "not replaced"); assert.ok(r.problems.some((p) => /24 hours are over/.test(p)), JSON.stringify(r.problems));
});

test("I-1: BRACKET_RELEASE takes plain week numbers only (no other whitespace), like the publish job", () => {
  assert.deepEqual([...releaseFromEnv(" 3, 4 ")], [3, 4]);
  for (const v of ["\uFEFF3", "3\u001c", "3\t", "\u00a03", "3,", "x"]) assert.deepEqual([...releaseFromEnv(v)], [], JSON.stringify(v));
});

test("#B-15 B15-1: a 32-seed week's picks are recorded until lock + 3 h without a release (round 1 starts 5 min after the lock)", async () => {
  const o = { picksContract: addr(60), nodeOf: nodeOf(signerFn(fieldOf(40))), picksOf: picksOf([{ player: P(1), number: 0, time: 1 }]) };
  const d = await lockedWeek(o);
  assert.equal(readW(d).seeding.size, 32);
  await quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(B.lockTime(W) + 170 * 60000), ...o }));
  assert.equal(readW(d).picks.rows.length, 1, "recorded 170 min after the lock");
  const late = await lockedWeek(o);
  const r = await quiet(() => run({ p: "main", check: "check", prev: late, out: late, head: headAt(B.lockTime(W) + 190 * 60000), ...o }));
  assert.equal(readW(late).picks, null);
  assert.ok(r.problems.some((p) => /not even BRACKET_RELEASE can/.test(p)), "no advice to use a release that can't help: " + JSON.stringify(r.problems));
});

// ── R-BR-7: the VHP ruler switch (BRACKET_RULER_FROM_WEEK), phase 1: off and shadow; an "on" week is held ──
// The day cards come from a stand-in (dayCardOf) with the Bracket's own settings and made-up field percentiles: the
// real cards' math is the ruler's (vhp-ruler.js, its own tests); here, what the Bracket does with them.
const RU = await import(path.resolve(APP, "bot/games/bracket-ruler.ts"));
/** A scored card as the ruler writes it (only what the Bracket reads), with fpct from fp(address, settings). */
const fakeCard = (fp) => (st) => ({ text: JSON.stringify({ ruleVersion: 4, game: st.game, round: st.round, ownRule: st.ownRule, paying: st.paying, T: st.window.L - 100,
  window: st.window, c: String(st.c), minK: st.minK, poolRule: st.poolRule, total: "1", producers: fieldOf(17).map((p) => ({ a: p.a, fpct: fp(p.a, st) })) }) + "\n" });
const underdogs = fakeCard((a) => { const i = fieldOf(17).findIndex((p) => p.a === a); return String(100000 + i * 1000); });   // lower seeds luckier
async function rulerWeekDir(extra) {
  const field = fieldOf(17), dir = tmp();
  const o = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([{ player: P(1), number: 5, time: 1 }, { player: P(2), number: 2 ** 20, time: 2 }]), ...extra };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...o }));
  await runUntil(NOW, o, dir);
  return { dir, o };
}
const rulerFile = (dir, f) => path.join(dir, "ruler", f);

// Phase 2: the ruler's own timeline of the same fake chain (the same heights and signers; the ruler's block ids are
// 0x-hex, its own), from 10 days before H0 (the 14-day form look-back of the week's first card) to past NOW. Balances:
// START at the first block, less BURN for each block signed from H0 (as nodeOf). Real cards: RU.dayCard on it (JS), and
// the publish job rebuilds each one with vhp_ruler.py from the same timeline (BRACKET_RULER_TL).
const TL_FROM = H0 - 10 * 28800, TL_TO = hAt(NOW) + 1000;
function rulerTimeline(field = fieldOf(17)) {
  const sign = signerFn(field), n = TL_TO - TL_FROM + 1, signers = new Array(n), ids = new Array(n), deltas = [];
  const bal = new Map(field.map((r) => [r.a, BigInt(START(r))]));
  for (let i = 0; i < n; i++) {
    const h = TL_FROM + i, a = sign(h); signers[i] = a; ids[i] = "0x" + h.toString(16).padStart(16, "0");
    if (h >= H0) { deltas.push({ h, a, d: -BigInt(BURN), inc: 0n }); bal.set(a, bal.get(a) - BigInt(BURN)); }
  }
  return { from: TL_FROM, to: TL_TO, signers, ids, deltas, anchors: Object.fromEntries([...bal].map(([a, v]) => [a, { h: TL_TO, v }])), bad: [], rebuilt: [], pending: [] };
}
let _tl = null;
/** The JS ledger and the timeline's JSON file for the publish job (built once). */
function rulerTL() {
  if (_tl) return _tl;
  const tl = rulerTimeline(), file = path.join(tmp(), "tl.json");
  fs.writeFileSync(file, JSON.stringify(tl, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  return (_tl = { L: RU.R.ledger(tl), file });
}
/** The real day cards (the recorder's default, on the fake chain's ruler data). */
const realCards = (st) => RU.dayCard(rulerTL().L, st);

test("R-BR-7 shadow week: day cards and the ruler's result beside the real one; the real week, board and vault file unchanged", async () => {
  const off = await rulerWeekDir({});
  const sh = await rulerWeekDir({ rulerFrom: String(W + 1), dayCardOf: realCards });   // N = W + 1: week W is the shadow week
  const a = readW(off.dir), b = readW(sh.dir);
  assert.equal(a.rulerMode, "off"); assert.equal(a.rulerFrom, null);
  assert.equal(b.rulerMode, "shadow"); assert.equal(b.rulerFrom, W + 1);
  const { rulerFrom: _f1, rulerMode: _m1, ...ra } = a, { rulerFrom: _f2, rulerMode: _m2, ...rb } = b;
  assert.deepEqual(rb, ra, "the shadow week's own results, points and status are the real method's");
  assert.equal(b.status, "final");
  const vault = (d) => fs.readFileSync(path.join(d, "vault", `W${W}.json`), "utf8");
  assert.equal(vault(sh.dir), vault(off.dir), "the vault file never uses the shadow result");
  const board = (d) => { const j = JSON.parse(fs.readFileSync(path.join(d, "board.json"), "utf8")); delete j.updated; return j; };
  assert.deepEqual(board(sh.dir), board(off.dir), "nor does any leaderboard");
  const R = B.roundsOf(b.seeding.size);
  for (let r = 0; r < R; r++) {
    const c = JSON.parse(fs.readFileSync(rulerFile(sh.dir, RU.cardName(W, r)), "utf8"));
    const d = b.days[r];
    assert.deepEqual(c.window, { W0: d[0].from - 7200, W1: d[0].from - 1, L: d[0].from - 1, S0: d[0].from, S1: d[23].to }, "the day's own blocks, the card moment in the 6 hours before");
    assert.equal(c.round, RU.roundOf(B.roundDay(W, r, b.seeding.size)));
    assert.equal(c.ownRule, "spot"); assert.equal(c.minK, 10); assert.equal(c.poolRule, "min"); assert.equal(c.paying, true);
    assert.equal(c.ruleVersion, 4); assert.ok(!("mode" in c), "no mode schedule set: no mode on the card");
    assert.ok(c.producers.every((p) => p.quality === "ok" && p.pooled === (p.a === RU.POOL)), "only the Knode Games Pool (the vault) is pooled, pinned in the code as in the publish job");
  }
  const s = JSON.parse(fs.readFileSync(rulerFile(sh.dir, RU.summaryName(W)), "utf8"));
  assert.equal(s.shadow, true); assert.equal(s.rulerMode, "shadow"); assert.equal(s.done, true);
  assert.deepEqual(s.real, b.results.rounds);
  const rulerDays = s.cards.map((n) => new Map(Object.entries(RU.rowsOf(fs.readFileSync(rulerFile(sh.dir, n), "utf8")))));
  const days = b.days.map((d) => B.indexFromHours(d));
  assert.deepEqual(s.rounds, B.results(b.seeding.seeds, b.seeding.size, days, b.seeding.vhp, b.seeding.pooled, rulerDays).rounds);
  assert.notDeepEqual(s.rounds, s.real, "on this chain the ruler's cards pick other winners than the day index");
  assert.ok(!fs.existsSync(rulerFile(off.dir, RU.summaryName(W))), "no ruler files with the switch unset");
  assert.deepEqual(heldOf(sh.dir, { ruler: String(W + 1) }), [], "the publish job accepts every shadow-week file; week W + 1 (on) has started but none of its days has ended, so no alert");
  assert.equal(shapeOk(sh.dir), false, "with the owner's variable unset the same files are refused (#G-20 G20-1)");
  const idx = JSON.parse(fs.readFileSync(path.join(sh.dir, "index.json"), "utf8"));
  assert.equal(idx.rulerFrom, W + 1);
});

/** Copy dir as new files over a published copy without its ruler folder; mut: { file: (json) => void }; the held files. */
function freshHeld(dir, ruler, muts, opt = {}) {
  const d = tmp(), pub = tmp(); fs.cpSync(dir, d, { recursive: true }); fs.cpSync(dir, pub, { recursive: true }); fs.rmSync(path.join(pub, "ruler"), { recursive: true });
  for (const [f, mut] of Object.entries(muts)) { const p = rulerFile(d, f), j = JSON.parse(fs.readFileSync(p, "utf8")); mut(j); fs.writeFileSync(p, JSON.stringify(j) + "\n"); }
  return heldOf(d, { pub, ruler, ...opt });
}

test("R-BR-7 phase 2: every new day card is rebuilt from the ruler's data (vhp_ruler.py); a changed or mis-set card is refused; a published card is written once", async () => {
  const { dir, o } = await rulerWeekDir({ rulerFrom: String(W + 1), dayCardOf: realCards });
  const name = RU.cardName(W, 0), was = fs.readFileSync(rulerFile(dir, name), "utf8");
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(NOW + H), ...o, dayCardOf: fakeCard(() => "1") }));
  assert.equal(fs.readFileSync(rulerFile(dir, name), "utf8"), was, "the next run keeps the published card exactly");
  const tl = rulerTL().file, c = (r) => RU.cardName(W, r), card = (r) => "bracket/ruler/" + c(r);
  assert.deepEqual(freshHeld(dir, String(W + 1), {}, { tl }), [], "the recorder's own cards pass as new: the publish job's Python rebuilt each one");
  assert.ok(freshHeld(dir, String(W + 1), {}).includes(card(0)), "without the ruler's data the job can't check a new card, so it holds it");
  const h1 = freshHeld(dir, String(W + 1), {
    [c(1)]: (j) => { j.window.S1 += 1; }, [c(2)]: (j) => { j.ownRule = "avg24h"; }, [c(3)]: (j) => { j.round = "20990101"; },
  }, { tl });
  assert.deepEqual([card(1), card(2), card(3)].filter((f) => h1.includes(f)), [card(1), card(2), card(3)], "other blocks, another own rule, another round number");
  assert.ok(!h1.includes(card(0)), "each card is held on its own");
  const h2 = freshHeld(dir, String(W + 1), {
    [c(0)]: (j) => { j.producers[0].fpct = 0.5; }, [c(1)]: (j) => { j.producers[0].fpct = "1000001"; },
    [c(2)]: (j) => { const p = j.producers.find((x) => x.fpct !== null); p.fpct = String((Number(p.fpct) + 1) % 1000000); },
    [c(3)]: (j) => { j.producers[0].quality = "flagged"; },
  }, { tl });
  assert.deepEqual([0, 1, 2, 3].map(card).filter((f) => h2.includes(f)), [0, 1, 2, 3].map(card), "an fpct that isn't whole millionths, above 1,000,000, a percentile the ruler's data doesn't give, a flagged card");
  const fresh = (mut, f) => !freshHeld(dir, String(W + 1), { [f]: mut }).includes("bracket/ruler/" + f);
  assert.equal(fresh((j) => { j.shadow = false; }, RU.summaryName(W)), false, "a summary not marked shadow");
  assert.equal(fresh((j) => { j.real = []; }, RU.summaryName(W)), false, "a summary whose real result isn't the week file's");
  const d2 = tmp(), pub2 = tmp(); fs.cpSync(dir, d2, { recursive: true }); fs.cpSync(dir, pub2, { recursive: true });
  fs.writeFileSync(rulerFile(d2, name), was.replace(/"fpct":"[0-9]+"/, '"fpct":"1"'));
  assert.ok(heldOf(d2, { pub: pub2, ruler: String(W + 1) }).includes("bracket/ruler/" + name), "a published card can't change");
});

test("R-BR-7 phase 2: an \"on\" week's matchups are the ruler's; its results, points and vault file follow the cards, and the publish job rebuilds them", async () => {
  const { dir } = await rulerWeekDir({ rulerFrom: String(W), dayCardOf: realCards });   // N = W: week W is on
  const off = await rulerWeekDir({});
  const wf = readW(dir), R = B.roundsOf(wf.seeding.size);
  assert.equal(wf.rulerMode, "on"); assert.equal(wf.status, "final"); assert.equal(wf.results.done, true);
  const texts = Array.from({ length: R }, (_, r) => fs.readFileSync(rulerFile(dir, RU.cardName(W, r)), "utf8"));
  const rulerDays = texts.map((t) => new Map(Object.entries(RU.rowsOf(t))));
  const days = wf.days.map((d) => B.indexFromHours(d));
  assert.deepEqual(wf.results.rounds, B.results(wf.seeding.seeds, wf.seeding.size, days, wf.seeding.vhp, wf.seeding.pooled, rulerDays).rounds, "every matchup from the day's card");
  assert.notDeepEqual(wf.results.rounds, readW(off.dir).results.rounds, "not the day index's result");
  assert.ok(fs.existsSync(path.join(dir, "vault", `W${W}.json`)), "the vault file is written from the ruler's result");
  assert.ok(!fs.existsSync(rulerFile(dir, RU.summaryName(W))), "no shadow summary for an on week");
  const tl = rulerTL().file;
  assert.deepEqual(freshHeld(dir, String(W), {}, { tl }), [], "the publish job rebuilds the four cards and the week's results from them");
  const h = freshHeld(dir, String(W), { [RU.cardName(W, 0)]: (j) => { for (const p of j.producers) if (p.fpct !== null) p.fpct = String(1000000 - Number(p.fpct)); } }, { tl });
  assert.ok(h.includes("bracket/ruler/" + RU.cardName(W, 0)) && h.includes(`bracket/W00${W}.json`), "a card the ruler's data doesn't give is refused, and so is the week scored from it");
  const bad = tmp(); fs.cpSync(dir, bad, { recursive: true });
  const f = path.join(bad, `W00${W}.json`), j = JSON.parse(fs.readFileSync(f, "utf8")); j.results = readW(off.dir).results; j.points = readW(off.dir).points;
  fs.writeFileSync(f, JSON.stringify(j) + "\n");
  assert.ok(heldOf(bad, { pub: dir, ruler: String(W) }).includes(`bracket/W00${W}.json`), "an on week scored by the day index is refused");
});

test("R-BR-7 phase 2: a day card that can't be made yet waits (never the day index); alerts 3 hours after its day and at the 48-hour grace", async () => {
  const late = (st) => (st.round >= RU.roundOf(B.roundDay(W, 2, 16)) ? { notYet: "vhp-data reaches block 1" } : realCards(st));
  const flagged = (st) => (st.round >= RU.roundOf(B.roundDay(W, 2, 16)) ? { notYet: "the ruler's card is flagged" } : realCards(st));
  for (const cardOf of [late, flagged]) {
    const { dir } = await rulerWeekDir({ rulerFrom: String(W), dayCardOf: cardOf });
    const wf = readW(dir);
    assert.equal(wf.results.done, false); assert.equal(wf.results.rounds.length, 2, "rounds 1 and 2 from their cards; round 3 waits (the owner's round 3 = index 2)");
    assert.notEqual(wf.status, "final");
    assert.ok(!fs.existsSync(rulerFile(dir, RU.cardName(W, 2))) && !fs.existsSync(path.join(dir, "vault", `W${W}.json`)));
    const say = (now) => { const hf = path.join(tmp(), "held"); fs.writeFileSync(hf, ""); const out = checkRun(dir, { now, ruler: String(W), held: hf }); return { out, held: fs.readFileSync(hf, "utf8").split("\n").filter(Boolean) }; };
    const r1 = say(B.roundDay(W, 2, 16) + DAY + 2 * H);
    assert.ok(!r1.held.includes("!alert"), "2 hours after the day: no alert yet");
    const r2 = say(B.roundDay(W, 2, 16) + DAY + 3 * H + 60000);
    assert.ok(r2.held.includes("!alert") && /week 3 round 3: the VHP ruler.s day card is still missing 3 hours/.test(r2.out), "3 hours after: the owner is alerted");
    assert.ok(!r2.held.some((x) => x.startsWith("bracket/")), "the waiting week itself is published");
    const r3 = say(B.weekStart(W + 1) + 48 * H + 60000);
    assert.match(r3.out, /still waiting for the VHP ruler 48 hours after the week ended: once each missing day is recorded and re-read, the seed rule decides/);
  }
});

test("R-BR-7 phase 2 backup (owner, 12 Nov): after the 48-hour grace the seed rule decides the rounds still without a card; recorded, alerted, checked", async () => {
  const lateFrom = RU.roundOf(B.roundDay(W, 2, 16));
  const late = (st) => (st.round >= lateFrom ? { notYet: "vhp-data reaches block 1" } : realCards(st));
  const { dir, o } = await rulerWeekDir({ rulerFrom: String(W), dayCardOf: late });
  const before = readW(dir);
  assert.ok(!("rulerBackup" in before), "before the grace: no backup, the week waits");
  const pub = tmp(); fs.cpSync(dir, pub, { recursive: true });
  const GRACE = B.weekStart(W + 1) + 48 * H;
  await runUntil(GRACE + H, o, dir, 3);
  const wf = readW(dir), seeds = wf.seeding.seeds, size = wf.seeding.size;
  assert.deepEqual(wf.rulerBackup, [2, 3], "rounds 3 and 4 (no card) decided by the seed rule");
  assert.deepEqual(Object.keys(wf).slice(-4), ["rulerFrom", "rulerMode", "rulerSchedule", "rulerBackup"], "recorded last");
  assert.equal(wf.results.done, true); assert.equal(wf.status, "final");
  assert.ok(fs.existsSync(path.join(dir, "vault", `W${W}.json`)), "the week is paid");
  assert.ok(!fs.existsSync(rulerFile(dir, RU.cardName(W, 2))) && !fs.existsSync(rulerFile(dir, RU.cardName(W, 3))), "no card is made later for a decided round");
  const cards = [0, 1].map((r) => new Map(Object.entries(RU.rowsOf(fs.readFileSync(rulerFile(dir, RU.cardName(W, r)), "utf8")))));
  const days = wf.days.map((d) => B.indexFromHours(d)), tie = new Map(seeds.map((a, i) => [a, String(1000000 - i)]));
  assert.deepEqual(wf.results.rounds, B.results(seeds, size, days, wf.seeding.vhp, wf.seeding.pooled, [...cards, tie, tie]).rounds, "rounds 1–2 by their cards, rounds 3–4 by the seed rule");
  assert.deepEqual(tie, rec.seedRuleDay(seeds), "the recorder's backup day");
  const say = (d, opt) => { const hf = path.join(tmp(), "held"); fs.writeFileSync(hf, ""); const out = checkRun(d, { ruler: String(W), held: hf, ...opt }); return { out, held: fs.readFileSync(hf, "utf8").split("\n").filter(Boolean) }; };
  const ok = say(dir, { pub, now: GRACE + 2 * H });
  assert.deepEqual(ok.held, ["!alert"], "the publish job accepts the week, and alerts the owner");
  assert.match(ok.out, /week 3: the seed rule decided round\(s\) 3, 4: no VHP ruler card 48 hours after the week ended/);
  assert.deepEqual(say(dir, { now: GRACE + 3 * H }).held, [], "once published, no new alert");
  const edit = (mut) => { const d = tmp(); fs.cpSync(dir, d, { recursive: true }); const f = path.join(d, `W00${W}.json`), j = JSON.parse(fs.readFileSync(f, "utf8")); mut(j, d); fs.writeFileSync(f, JSON.stringify(j) + "\n"); return d; };
  assert.ok(say(dir, { pub, now: GRACE - 60000 }).held.includes(`bracket/W00${W}.json`), "the seed rule before the grace ends is refused");
  assert.ok(say(edit((j) => { j.rulerBackup = [1, 2, 3]; }), { pub, now: GRACE + 2 * H }).held.includes(`bracket/W00${W}.json`), "a round that has a card can't be decided by the seed rule");
  const withCard = edit((j, d) => { fs.writeFileSync(rulerFile(d, RU.cardName(W, 2)), fs.readFileSync(rulerFile(d, RU.cardName(W, 1)), "utf8")); });
  assert.ok(say(withCard, { pub, now: GRACE + 2 * H }).held.includes("bracket/ruler/" + RU.cardName(W, 2)), "nor can a card appear for a round the seed rule decided");
  assert.ok(say(edit((j) => { j.results.rounds[3] = [j.results.rounds[2].find((x) => x !== j.results.rounds[3][0])]; }), { pub, now: GRACE + 2 * H }).held.includes(`bracket/W00${W}.json`), "a result other than the seed rule's is refused");
});

test("R-BR-7 phase 2: the mode schedule (BRACKET_RULER_MODE) is on every card and checked like the switch", async () => {
  const { dir } = await rulerWeekDir({ rulerFrom: String(W), dayCardOf: realCards, rulerSchedule: `${W}:B` });
  const wf = readW(dir); assert.equal(wf.rulerSchedule, `${W}:B`);
  for (let r = 0; r < 4; r++) assert.equal(JSON.parse(fs.readFileSync(rulerFile(dir, RU.cardName(W, r)), "utf8")).mode, "B");
  const tl = rulerTL().file;
  assert.deepEqual(freshHeld(dir, String(W), {}, { tl, mode: `${W}:B` }), [], "cards made in mode B pass when the job rebuilds them in mode B");
  assert.equal(shapeOk(dir, { ruler: String(W), mode: "" }), false, "files that don't carry the owner's mode schedule are refused");
  assert.equal(shapeOk(dir, { ruler: String(W), mode: "x" }), false, "an unreadable schedule holds the Bracket");
  const pub = tmp(); fs.cpSync(dir, pub, { recursive: true });
  const f = path.join(pub, `W00${W}.json`), j = JSON.parse(fs.readFileSync(f, "utf8")); j.rulerSchedule = null; fs.writeFileSync(f, JSON.stringify(j) + "\n");
  assert.equal(shapeOk(dir, { pub, now: B.lockTime(W) + 2 * H, ruler: String(W), mode: `${W}:B` }), false, "a schedule change that would rescore a started week is refused (mode_change)");
});

test("R-BR-7: the publish job refuses a switch change that would change how a started week is scored (switch_change)", async () => {
  const field = fieldOf(17), pub = tmp();
  const o = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([{ player: P(1), number: 5, time: 1 }]) };
  await quiet(() => run({ p: "main", check: "check", prev: pub, out: pub, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: pub, out: pub, head: headAt(B.lockTime(W) + 60000), ...o }));
  const mid = B.lockTime(W) + 2 * H;
  const next = (from) => { const d = tmp(); fs.cpSync(pub, d, { recursive: true }); return quiet(() => run({ p: "main", check: "check", prev: d, out: d, head: headAt(mid), ...o, rulerFrom: from, dayCardOf: realCards })).then(() => d); };
  assert.equal(shapeOk(await next(String(W)), { pub, now: mid, ruler: String(W) }), false, "unset → W during week W: the started week would turn on");
  assert.equal(shapeOk(await next(String(W + 1)), { pub, now: mid, ruler: String(W + 1) }), true, "unset → W + 1: this week becomes the shadow week, next week on");
  assert.equal(shapeOk(await next(""), { pub, now: mid }), true, "unset stays unset");
  assert.equal(shapeOk(await next(String(W + 1)), { pub, now: mid, ruler: "" }), false, "files that don't carry the owner's variable are refused (#G-20 G20-1)");
  assert.equal(shapeOk(await next(String(W + 2)), { pub, now: mid, ruler: "x" }), false, "an unreadable variable holds the Bracket");
  assert.deepEqual(heldOf(await next(String(W + 1)), { pub, now: B.weekStart(W + 1) - 2 * 86400000 + 60000, ruler: String(W + 1) }), [], "phase 2 scores an on week, so the switch alone never alerts (#G-20 G20-2's phase-1 alert is gone)");
});

test("R-BR-7: a ruler card that isn't ready waits (\"not yet\"); a bad switch value stops the run loudly", async () => {
  const { dir } = await rulerWeekDir({ rulerFrom: String(W + 1), dayCardOf: () => ({ notYet: "vhp-data reaches block 1" }) });
  const s = JSON.parse(fs.readFileSync(rulerFile(dir, RU.summaryName(W)), "utf8"));
  assert.ok(s.cards.every((c) => c === null)); assert.deepEqual(s.rounds, []); assert.equal(s.done, false);
  assert.equal(readW(dir).status, "final", "the real week doesn't wait for the ruler in the shadow week");
  for (const v of ["07", "4 ", "x", "0"]) await assert.rejects(quiet(() => run({ p: "main", check: "check", prev: tmp(), out: tmp(), head: headAt(B.seedTime(W) + H), picksContract: addr(60), nodeOf: nodeOf(signerFn(fieldOf(17))), picksOf: picksOf([]), rulerFrom: v })), /ruler switch/, v);
});

// ── Repo Lens #G-20 (PR #263 @ f225f4d1): append to tests/audit/bracket-recorder.test.mjs (uses its helpers) ──
// G20-1 (Medium): the publish job never reads BRACKET_RULER_FROM_WEEK; it takes each incoming week file's rulerFrom and
// only checks switch_change against the published copy at this job's week (games.yml ruler_fields / switch_change). So a
// bad record run, BEFORE week W starts, can write week W's file with rulerFrom = W ("on"): no started week changes, so it
// is published. Once week W starts, the honest recorder (switch unset) writes rulerFrom null and every run is refused
// (week W would turn off); setting the variable to W instead makes week W "on", which phase 1 holds and voids at the
// backstop. Either way one bad run costs a paid week. Fix: pass vars.BRACKET_RULER_FROM_WEEK to the publish step and
// require every incoming non-final week file's rulerFrom (and index.json's) to equal it, read strictly.
test("G20-1: a week file whose ruler switch isn't the owner's variable is refused, also before its week starts", async () => {
  const field = fieldOf(17), pub = tmp();
  const o = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([{ player: P(1), number: 5, time: 1 }]) };
  const t0 = B.seedTime(W) + H;
  assert.ok(t0 < B.weekStart(W), "precondition: the run is before week W starts");
  await quiet(() => run({ p: "main", check: "check", prev: pub, out: pub, head: headAt(t0), ...o }));            // honest, switch unset
  const bad = tmp(); fs.cpSync(pub, bad, { recursive: true });
  await quiet(() => run({ p: "main", check: "check", prev: bad, out: bad, head: headAt(t0 + 60000), ...o, rulerFrom: String(W), dayCardOf: underdogs }));
  assert.equal(readW(bad).rulerMode, "on", "the bad run's week W file says the ruler is on");
  assert.equal(shapeOk(bad, { pub, now: t0 + 60000 }), false, "published although the owner's BRACKET_RULER_FROM_WEEK is unset: week W is then locked 'on'");
});

// Repo Lens #G-25 Info (written by the Bracket chat from the finding's description; the original file wasn't
// attached): index.json carries the owner's variable, but one open week file carries another value. The publish job
// must refuse that week file (G20-1 checks every open week file, not only index.json).
test("Repo Lens #G-25 Info: index.json right but one open week file's rulerFrom wrong: that week file is refused", async () => {
  const field = fieldOf(17), dir = tmp();
  const o = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([{ player: P(1), number: 5, time: 1 }]), rulerFrom: String(W + 1), dayCardOf: underdogs };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  const mid = B.lockTime(W) + 2 * H;
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(mid), ...o }));
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  assert.equal(idx.rulerFrom, W + 1, "index.json carries the owner's value");
  assert.deepEqual(heldOf(dir, { now: mid, ruler: String(W + 1) }), [], "the recorder's own files: nothing held");
  // week W's file (open: locked, mid-week) is rewritten with another, self-consistent switch value, as a tampered run could
  const bad = tmp(); fs.cpSync(dir, bad, { recursive: true });
  const f = path.join(bad, `W00${W}.json`), j = JSON.parse(fs.readFileSync(f, "utf8"));
  assert.ok(!["final", "none", "void"].includes(j.status), "an open week: " + j.status);
  j.rulerFrom = W + 2; j.rulerMode = "off";   // week W is off under W + 2: consistent with itself, but not the owner's
  fs.writeFileSync(f, JSON.stringify(j) + "\n");
  const held = heldOf(bad, { now: mid, pub: dir, ruler: String(W + 1) });
  assert.ok(held.includes(`bracket/W00${W}.json`), "the week file that doesn't carry the owner's variable is held: " + held.join(", "));
});

