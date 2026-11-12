// Repo Lens fix-check 2 (PR #186 @ 8d3d942f), area RA: run sequences the publish job's Bracket check accepts that change
// who is paid, or stall the game. Same harness as repolens-e3-publish.test.mjs: the workflow's own Bracket heredoc cut from
// games.yml, run with python3 -I and CHECK_NOW_MS as the job's clock; each forged run is just the files a record_bracket
// artifact could carry. Every test here FAILS on 8d3d942f and states the property the fix should give.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));
await import(path.resolve(APP, "vhp-standard.js"));
const B = globalThis.KBracketMath, V = globalThis.KVhp;
const { DAY, HOUR } = B;
const A = (i) => "1" + String(i).padStart(33, "0").replace(/0/g, "A").slice(0, 30) + String(1000 + i).replace(/0/g, "z");
const W = 3, SIZE = 8;

function bracketCheck() {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const s = y.findIndex((l) => l.includes('/usr/bin/python3 - "$IN/bracket"'));
  assert.ok(s > 0, "the Bracket check is in games.yml");
  const ind = y[s + 1].match(/^ */)[0].length, out = [];
  for (let i = s + 1; y[i].trim() !== "PY"; i++) out.push(y[i].slice(ind));
  return out.join("\n");
}
const reseal = (w, s) => { const { hash: _h, re, ...base } = s; return { ...base, hash: rec.seedHash(w, base), ...(re ? { re } : {}) }; };
const rescore = (x) => { const sc = rec.scoreWeek(x); x.results = sc.results; x.points = sc.points; return x; };
const clone = (o) => JSON.parse(JSON.stringify(o));
/** An honest v5 week (as repolens-e3-publish.test.mjs builds it). Fix-check 2 fix: its picks carry the re-read mark
 *  (picks.re, PK-1), as a week with stakes needs; tests about unconfirmed picks delete it. */
function week(w, status, { reread = true, held = status === "final" } = {}) {
  const seeds = Array.from({ length: SIZE }, (_, i) => A(100 + i));
  const raw = Object.fromEntries(seeds.map((a, i) => [a, SIZE - i]).sort((x, y) => (x[0] < y[0] ? -1 : 1)));
  const base = { at: B.seedTime(w), cardAt: 5, size: SIZE, seeds, vhp: seeds.map((_, i) => SIZE - i), totalVhp: 36, out: [], outVhp: [], raw, pooled: [] };
  const seeding = { ...base, hash: rec.seedHash(w, base), re: 1 };
  let h0 = 1000;
  const days = Array.from({ length: B.roundsOf(SIZE) }, () => Array.from({ length: 24 }, () => {
    const by = {}, cr = {}, wv = {}, r = {}, av = {};
    seeds.forEach((a, i) => { wv[a] = (SIZE - i) * 1e8; av[a] = (SIZE - i) * 1e8; by[a] = (h0 + i) % 3; cr[a] = by[a]; r[a] = by[a] * 1e7 / (SIZE - i); });
    const n = Object.values(by).reduce((t, x) => t + x, 0), hr = { from: h0, to: h0 + n - 1, n, by, cr, w: wv, q: 0.5, r, av, checked: 2, ...(reread ? { re: 1 } : {}) };
    h0 += n; return hr;
  }));
  const rows = [0, 1, 2, 3].map((i) => [A(i), [0, 5, 77, 127][i], B.lockTime(w) - HOUR - i * 3000, 1]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const wf = { v: B.FILE_V, week: w, start: B.weekStart(w), end: B.weekStart(w + 1), status, seeding, picks: { checked: 2, rows, re: 1 }, days, results: null, points: [],
    staked: { checked: 2, list: [A(0), A(1)].sort(), ...(held ? { held: [A(0), A(1)].sort() } : {}) } };
  return rescore(wf);
}
const beforePicks = (w) => { const x = week(w, "locked"); x.picks = null; x.results = null; x.points = []; x.staked = null; x.status = "open"; for (const d of x.days) d.fill(null); return x; };
const vaultOf = (fin) => {
  const tm = new Map(fin.picks.rows.map((r) => [r[0], r[2]]));
  const free = rec.freeWinners(fin.points, new Set(fin.staked.held), tm);
  return { game: 9, week: fin.week, final: true, rows: rec.vaultRows(fin.points, new Set(fin.staked.list), tm), first: free.first, second: free.second };
};
const index = (ws) => ({ v: 1, updated: "2026-11-20T00:00:00.000Z", weeks: ws, contract: null, game: 9, prizesFromWeek: null });
function put(dir, files) {
  for (const [f, o] of Object.entries(files)) { const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o) + "\n"); }
}
function check(pub, inn, now, release = "") {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "e3fc2-")), py = path.join(d, "check.py"), held = path.join(d, "held");
  fs.writeFileSync(py, bracketCheck()); fs.writeFileSync(held, "");
  put(path.join(d, "pub"), pub); put(path.join(d, "bracket"), inn);
  const r = spawnSync("python3", ["-I", py, path.join(d, "bracket"), path.join(d, "pub"), held], { encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now), BRACKET_RELEASE: release } });
  return { status: r.status, held: fs.readFileSync(held, "utf8").split("\n").filter(Boolean), out: r.stdout + r.stderr };
}
const ok = (r) => r.status === 0 && r.held.length === 0;
const MON = B.weekStart(W + 1), LOCK = B.lockTime(W);

// ── P-1: picks have no two-run rule: the first run after the lock decides them for good ──
test("P-1: one forged run's picks (real players dropped) can't be the week's picks for good", () => {
  const pub = { "W003.json": beforePicks(W), "index.json": index([3]) };
  const honest = rescore((() => { const x = week(W, "locked"); x.staked = null; delete x.picks.re; for (const d of x.days) d.fill(null); return x; })());
  // forged run R1, an hour after the lock: only A(3)'s pick is kept (A(0), A(1), A(2) dropped: no stakes are ever read for them)
  const forged = clone(honest); forged.picks.rows = forged.picks.rows.filter((r) => r[0] === A(3)); rescore(forged);
  const r1 = check(pub, { "W003.json": forged, "index.json": index([3]) }, LOCK + HOUR);
  assert.ok(ok(r1), "R1 (forged) is accepted today: " + r1.out.slice(0, 300));
  // R2, the honest recorder's two-node reading an hour later, even with the owner's release, can never put them back
  const r2 = check({ "W003.json": forged, "index.json": index([3]) }, { "W003.json": honest, "index.json": index([3]) }, LOCK + 2 * HOUR, "3");
  assert.ok(ok(r2), "a later two-node picks reading must be able to replace picks no later run confirmed (under release at least): " + r2.out.slice(0, 300));
});

test("P-1b: a week can't go final on picks that no later run read again", () => {
  // the honest control week in repolens-e3-publish.test.mjs goes final with picks only one run ever wrote
  const fin = week(W, "final"); delete fin.picks.re;
  const r = check({ "W003.json": week(W, "locked", { held: true }), "index.json": index([3]) }, { "W003.json": fin, "vault/W3.json": vaultOf(fin), "index.json": index([3]) }, MON + HOUR);
  assert.ok(!ok(r), "final with picks that carry no re-read mark (picks.re) must be held");
});

test("P-2: under BRACKET_RELEASE, picks first recorded after the results are known are held", () => {
  // published: seeded and re-read, picks never recorded (outage). The owner releases week 3 (the recorder's own advice).
  const pub = { "W003.json": beforePicks(W), "index.json": index([3]) };
  // forged run on Monday: the real hours (honest, not re-read yet) plus a pick for A(9) that IS the result
  const x = week(W, "locked", { reread: false }); x.staked = null; delete x.picks.re; rescore(x);
  const res = rec.scoreWeek(x).results.rounds, perfect = B.encode(res, SIZE, SIZE);
  x.picks.rows = [...x.picks.rows, [A(9), perfect, LOCK - 10 * HOUR, 1]].sort((a, b) => (a[0] < b[0] ? -1 : 1)); rescore(x);
  assert.ok(x.points.find((p) => p[0] === A(9))[1] >= Math.max(...x.points.filter((p) => p[0] !== A(9)).map((p) => p[1])), "A(9) tops the week");
  const r = check(pub, { "W003.json": x, "index.json": index([3]) }, MON + HOUR, "3");
  assert.ok(!ok(r), "picks first written with hindsight (after round 1 began) must be held even under release");
});

// ── R-1: in a released week two forged runs (replace, then "re-read" + final) change who is paid ──
test("R-1: a released week can't go final in the run right after a replacement (two forged runs pick the payees)", () => {
  const honest = week(W, "locked", { held: true });
  const pub = { "W003.json": honest, "index.json": index([3]) };
  // R1 (Monday, after every result is known): every day's hours replaced so the results are exactly A(0)'s bracket
  // (number 0, every favourite): each round's losers by that bracket get 0 credited blocks, its winners at least 1
  const target = B.decode(0, SIZE, SIZE).rounds, seeds = honest.seeding.seeds, r1f = clone(honest);
  target.forEach((winners, r) => {
    const playing = r === 0 ? seeds.map((_, i) => i + 1) : target[r - 1];
    const losers = playing.filter((n) => !winners.includes(n)).map((n) => seeds[n - 1]);
    for (const h of r1f.days[r]) { delete h.re; for (const a of losers) h.cr[a] = 0; for (const n of winners) h.cr[seeds[n - 1]] = Math.max(1, h.cr[seeds[n - 1]]); }
  });
  rescore(r1f);
  assert.deepEqual(r1f.results.rounds, target, "the results are now A(0)'s bracket");
  assert.ok(ok(check(pub, { "W003.json": r1f, "index.json": index([3]) }, MON + HOUR, "3")), "R1 accepted (release)");
  // R2: the same values "re-read", the week final, the vault file from the forged points
  const r2f = clone(r1f); for (const d of r2f.days) for (const h of d) h.re = 1; r2f.status = "final"; rescore(r2f);
  const v = vaultOf(r2f), vh = vaultOf(rescore(Object.assign(clone(honest), { status: "final" })));
  assert.notDeepEqual(v.rows, vh.rows, "the Vault would pay different rows");
  console.log("honest vault rows", JSON.stringify(vh.rows), "forged", JSON.stringify(v.rows));
  const r2 = check({ "W003.json": r1f, "index.json": index([3]) }, { "W003.json": r2f, "vault/W3.json": v, "index.json": index([3]) }, MON + 2 * HOUR, "3");
  assert.ok(!ok(r2), "no final (and no vault file) while the week is still released / without an owner-named replacement");
});

// ── S-1: the release can't repair a seeding after seed time + 26 h, and trying holds every Bracket file ──
test("S-1: a release-replaced seeding after 26 h holds the whole Bracket, including last week's vault file", () => {
  const W2 = 2, W3 = 3, NOW = B.weekStart(W3) + 3 * HOUR;   // Monday 03:00: week 2 goes final, week 3's seeding is 27 h old
  const open3 = (raw) => { const x = beforePicks(W3); const s = { ...x.seeding, raw }; delete s.re;
    const last = week(W2, "locked").seeding.raw, d = B.seeding({ field: Object.entries(raw).map(([a, v]) => ({ a, vhp: v })), paddock: [] }, last);
    x.seeding = reseal(W3, { ...s, size: d.size, seeds: d.seeds, vhp: d.vhp, out: d.out, outVhp: d.outVhp }); x.days = Array.from({ length: B.roundsOf(d.size) }, () => Array(24).fill(null)); return x; };
  const honestRaw = week(W3, "locked").seeding.raw, forgedRaw = { ...honestRaw, [A(100)]: 1, [A(107)]: 8 };
  const fin2 = week(W2, "final");
  const pub = { "W002.json": week(W2, "locked", { held: true }), "W003.json": open3(forgedRaw), "index.json": index([2, 3]) };
  const control = check(pub, { "W002.json": fin2, "vault/W2.json": vaultOf(fin2), "W003.json": open3(forgedRaw), "index.json": index([2, 3]) }, NOW, "3");
  assert.ok(ok(control), "control: week 2 final + vault file, week 3 unchanged: " + control.out.slice(0, 300));
  // the honest recorder, released for week 3, replaces the forged seeding with its two-node reading (bracket.ts:456)
  const r = check(pub, { "W002.json": fin2, "vault/W2.json": vaultOf(fin2), "W003.json": open3(honestRaw), "index.json": index([2, 3]) }, NOW, "3");
  assert.ok(!r.held.includes("bracket/vault/W2.json"), "week 2's vault file must not be held by week 3's seeding repair: " + r.out.slice(0, 400));
});

// ── D-1: the job's derive_seeding sums the raw averages in its own order, fieldOf in block order ──
test("D-1: an honest seeding at the field line (k = 10 exactly) is accepted whatever order the card was summed in", () => {
  const c = [326015, 536128, 374784, 372160, 568960, 204856, 325920, 403872, 157184, 365760, 422528, 499744, 162912, 469056, 340448, 589760, 455168, 9145];
  const m = new Map(c.map((h, i) => [A(200 + i), h * 1e6]));   // satoshi, in the order the producers signed (the last one last)
  const card = V.fieldOf(m), s = B.seeding(card, {});
  const rows = [...card.field, ...card.paddock].sort((x, y) => (x.a < y.a ? -1 : 1)), raw = {}; for (const r of rows) raw[r.a] = r.vhp;
  const base = { at: B.seedTime(W), cardAt: 5, size: s.size, seeds: s.seeds, vhp: s.vhp, totalVhp: Math.round(rows.reduce((t, r) => t + r.vhp, 0) * 100) / 100, out: s.out, outVhp: s.outVhp, raw, pooled: [] };
  const wf = { v: B.FILE_V, week: W, start: B.weekStart(W), end: B.weekStart(W + 1), status: "open", seeding: { ...base, hash: rec.seedHash(W, base) }, picks: null,
    days: Array.from({ length: B.roundsOf(s.size) }, () => Array(24).fill(null)), results: null, points: [], staked: null };
  const r = check({ "index.json": index([]) }, { "W003.json": wf, "index.json": index([3]) }, B.seedTime(W) + HOUR);
  assert.ok(ok(r), "the recorder's honest seeding is held: " + r.out.slice(0, 300));
});

// ── I-1: BRACKET_RELEASE is parsed the same on both sides, and a bad value releases nothing (never crashes the job) ──
test("I-1: BRACKET_RELEASE parses the same in the recorder and the job, fail-closed", () => {
  for (const v of ["3\u001c", "﻿3"]) {
    const js = [...rec.releaseFromEnv(v)];
    const r = check({ "W003.json": week(W, "locked"), "index.json": index([3]) }, { "W003.json": week(W, "locked"), "index.json": index([3]) }, MON + HOUR, v);
    assert.ok(r.status === 0, `the job must not crash on ${JSON.stringify(v)}: ` + r.out.slice(-200));
    assert.deepEqual(js, [], `${JSON.stringify(v)} must release nothing in the recorder too (it releases ${JSON.stringify(js)})`);
  }
});
