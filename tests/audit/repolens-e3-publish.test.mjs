// Repo Lens #E-3 (Producer Bracket) H-2 / H-3, as written by the review (claude/bracket/repolens-e3-tests/, private),
// moved to the v5 week file (D-141) with honest fixtures: each case starts from a week the check ACCEPTS (the control),
// then changes one thing. Runs the workflow's own Bracket check (the heredoc cut from games.yml) with python3 -I and
// CHECK_NOW_MS as the job's clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));
const B = globalThis.KBracketMath;
const { WEEK, DAY, HOUR } = B;
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
/** An honest v5 week as the recorder writes it: seeded, picks locked, every hour recorded and re-read; status as
 *  given (final adds the end-of-week stakes). Results and points from the recorder's own scoreWeek. */
function week(w, status, { reread = true, held = status === "final" } = {}) {
  const seeds = Array.from({ length: SIZE }, (_, i) => A(100 + i));
  // the raw averages the seeds follow from (fix-check F2: the job derives the seeding from them), keys in address order
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
  const wf = { v: B.FILE_V, week: w, start: B.weekStart(w), end: B.weekStart(w + 1), status, seeding, picks: { checked: 2, rows }, days, results: null, points: [],
    staked: { checked: 2, list: [A(0), A(1)].sort(), ...(held ? { held: [A(0), A(1)].sort() } : {}) } };
  const sc = rec.scoreWeek(wf); wf.results = sc.results; wf.points = sc.points;
  return wf;
}
const index = (ws) => ({ v: 1, updated: "2026-11-20T00:00:00.000Z", weeks: ws, contract: null, game: 9, prizesFromWeek: null });
function put(dir, files) {
  for (const [f, o] of Object.entries(files)) { const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o) + "\n"); }
}
function check(pub, inn, now) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "e3-")), py = path.join(d, "check.py"), held = path.join(d, "held");
  fs.writeFileSync(py, bracketCheck()); fs.writeFileSync(held, "");
  put(path.join(d, "pub"), pub); put(path.join(d, "bracket"), inn);
  const r = spawnSync("python3", ["-I", py, path.join(d, "bracket"), path.join(d, "pub"), held], { encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  return { status: r.status, held: fs.readFileSync(held, "utf8").split("\n").filter(Boolean), out: r.stdout + r.stderr };
}
const ok = (r) => r.status === 0 && r.held.length === 0;
const MON = B.weekStart(W + 1);   // Monday 00:00 UTC after the week

test("control: an honest week going final on Monday is accepted, with its vault file in the same run (#E-3 M-5)", () => {
  const fin = week(W, "final"), vault = { game: 9, week: W, final: true, rows: rec.vaultRows(fin.points, new Set(fin.staked.list), new Map(fin.picks.rows.map((r) => [r[0], r[2]]))), first: [], second: [] };
  const free = rec.freeWinners(fin.points, new Set(fin.staked.held), new Map(fin.picks.rows.map((r) => [r[0], r[2]]))); vault.first = free.first; vault.second = free.second;
  const r = check({ "W003.json": week(W, "locked", { held: true }), "index.json": index([3]) }, { "W003.json": fin, [`vault/W${W}.json`]: vault, "index.json": index([3]) }, MON + HOUR);
  assert.ok(ok(r), r.out);
  // fix-check F1: the same final week, but its end-of-week stakes appear in this run for the first time: held
  const r2 = check({ "W003.json": week(W, "locked"), "index.json": index([3]) }, { "W003.json": fin, [`vault/W${W}.json`]: vault, "index.json": index([3]) }, MON + HOUR);
  assert.ok(!ok(r2), "final on stakes no earlier run published");
});

test("E3-H2: a run that turns a week final with points that don't follow from its seeding, picks and hours is held", () => {
  const forged = week(W, "final"); forged.points = forged.points.map((x, i) => (i === 0 ? [x[0], Math.min(x[1] + 3, 20), x[2], x[3]] : x));
  const r = check({ "W003.json": week(W, "locked", { held: true }), "index.json": index([3]) }, { "W003.json": forged, "index.json": index([3]) }, MON + HOUR);
  assert.ok(r.status !== 0 || r.held.length > 0, `forged final points must be held (exit ${r.status}, held ${JSON.stringify(r.held)}):\n${r.out}`);
  const forgedRes = week(W, "final"); forgedRes.results.rounds[0][0] = forgedRes.results.rounds[0][0] === 1 ? 8 : 1;
  const r2 = check({ "W003.json": week(W, "locked", { held: true }), "index.json": index([3]) }, { "W003.json": forgedRes, "index.json": index([3]) }, MON + HOUR);
  assert.ok(r2.held.length > 0, "forged results are held too");
});

test("E3-H3: new history is bounded by the job's clock (a final week two weeks ahead, an index week with no file, locked -> void)", () => {
  const pub = { "W003.json": week(W, "locked"), "index.json": index([3]) };
  const v = week(W, "locked"); v.status = "void"; v.void = "x"; v.staked = null;
  const r = check(pub, { "W003.json": v, "W006.json": week(6, "final"), "index.json": index([3, 6, 9999]) }, B.weekStart(W + 1) + DAY);
  assert.ok(r.status !== 0 || r.held.length > 0, `must be held (exit ${r.status}, held ${JSON.stringify(r.held)}):\n${r.out}`);
  // each one alone
  const one = (inn, now = MON + HOUR, p = pub) => check(p, { "index.json": index([3]), ...inn }, now);
  assert.ok(!ok(one({ "W003.json": week(W, "locked"), "W006.json": week(6, "final"), "index.json": index([3, 6]) })), "a new week two weeks ahead");
  assert.ok(!ok(one({ "W003.json": week(W, "locked"), "index.json": index([3, 9999]) })), "an index week with no file");
  assert.ok(!ok(one({ "W003.json": v })), "locked -> void before the backstop, stakes -> null");
  assert.ok(!ok(one({ "W003.json": week(W, "final") }, MON - HOUR)), "final before Monday 00:00 UTC (the review day)");
  const early = week(W, "locked"); early.picks = null; early.results = null; early.points = []; early.staked = null; early.status = "open";
  for (const d of early.days) d.fill(null);
  assert.ok(!ok(one({ "W003.json": week(W, "locked") }, B.lockTime(W) - HOUR, { "W003.json": early, "index.json": index([3]) })), "picks before the lock");
  const fresh = week(W, "locked", { reread: false }), pubFresh = { "W003.json": { ...fresh, days: fresh.days.map((d) => d.map(() => null)) }, "index.json": index([3]) };
  assert.ok(!ok(one({ "W003.json": week(W, "locked") }, MON + HOUR, pubFresh)), "hours marked re-read in the run that recorded them (the two-run rule)");
  assert.ok(ok(one({ "W003.json": week(W, "locked") }, MON + HOUR, { "W003.json": fresh, "index.json": index([3]) })), "…but re-read in a later run they're fine");
});

// ── fix-check of 5 Nov (PR #186): F2, F3, F4, F5 and the Pool ──
const withEnv = (env, f) => { const old = {}; for (const k of Object.keys(env)) { old[k] = process.env[k]; process.env[k] = env[k]; } try { return f(); } finally { for (const k of Object.keys(env)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } } };
const reseal = (w, s) => { const { hash: _h, re, ...base } = s; return { ...base, hash: rec.seedHash(w, base), ...(re ? { re } : {}) }; };

test("F2: the seeding must follow from its raw averages, appear within 24 h of its time, and be re-read by a later run", () => {
  const open = (w) => { const x = week(w, "locked"); x.status = "open"; x.picks = null; x.results = null; x.points = []; x.staked = null; for (const d of x.days) d.fill(null); return x; };
  const fresh = (w) => { const x = open(w); const { re: _r, ...s } = x.seeding; x.seeding = s; return x; };
  const SEED = B.seedTime(W);
  assert.ok(ok(check({ "index.json": index([]) }, { "W003.json": fresh(W), "index.json": index([3]) }, SEED + 3600000)), "control: a fresh seeding an hour after its time");
  assert.ok(!ok(check({ "index.json": index([]) }, { "W003.json": fresh(W), "index.json": index([3]) }, SEED + 30 * 3600000)), "first written 30 h after its time");
  assert.ok(!ok(check({ "index.json": index([]) }, { "W003.json": open(W), "index.json": index([3]) }, SEED + 3600000)), "marked re-read in the run that wrote it");
  assert.ok(ok(check({ "W003.json": fresh(W), "index.json": index([3]) }, { "W003.json": open(W), "index.json": index([3]) }, SEED + 2 * 3600000)), "re-read by a later run: fine");
  // a seed's VHP that doesn't come from its raw average (e.g. inflated so it forfeits every round)
  const infl = fresh(W); infl.seeding.vhp[0] = 80; infl.seeding = reseal(W, infl.seeding);   // still in order, shape fine
  const ri = check({ "index.json": index([]) }, { "W003.json": infl, "index.json": index([3]) }, SEED + 3600000);
  assert.ok(!ok(ri) && /doesn't follow from its raw averages/.test(ri.out), "seeding VHP not from raw: " + ri.out.slice(0, 300));
  // a no-bracket week made up by dropping the raw averages
  const none = fresh(W); Object.assign(none.seeding, { size: 0, seeds: [], vhp: [] }); none.days = []; none.seeding = reseal(W, none.seeding); none.status = "waiting";
  assert.ok(!ok(check({ "index.json": index([]) }, { "W003.json": none, "index.json": index([3]) }, SEED + 3600000)), "size 0 while the raw averages give 8");
  // a seed missing from the last seeding counts 0 there (RC-1): the job derives that too
  const lastWeek = fresh(W - 1); lastWeek.seeding.raw = { [A(100)]: 8 }; lastWeek.seeding = reseal(W - 1, lastWeek.seeding);
  const r = check({ "W002.json": lastWeek, "index.json": index([2]) }, { "W003.json": fresh(W), "index.json": index([2, 3]) }, SEED + 3600000);
  assert.ok(!ok(r) && /doesn't follow from its raw averages/.test(r.out), "with a last seeding that only had seed 1, the other 7 can't be seeded on today's average");
});

test("F2: only the Knode Games Pool may be pooled (never forfeits)", () => {
  const POOL = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
  const x = week(W, "locked"); x.seeding = reseal(W, { ...x.seeding, pooled: [x.seeding.seeds[0]] });
  assert.ok(!ok(check({ "index.json": index([]) }, { "W003.json": x, "index.json": index([3]) }, MON + 3600000)), "a non-Pool producer marked pooled");
  assert.ok(x.seeding.seeds[0] !== POOL);
});

test("F3: picks are two-node, first recorded within 3 h of the lock, and never change", () => {
  const before = week(W, "locked"); before.picks = null; before.results = null; before.points = []; before.staked = null; before.status = "open"; for (const d of before.days) d.fill(null);
  const pub = { "W003.json": before, "index.json": index([3]) };
  const lockedNow = () => { const x = week(W, "locked"); x.staked = null; for (const d of x.days) d.fill(null); const sc = rec.scoreWeek(x); x.results = sc.results; x.points = sc.points; return x; };
  assert.ok(ok(check(pub, { "W003.json": lockedNow(), "index.json": index([3]) }, B.lockTime(W) + 3600000)), "control: an hour after the lock");
  assert.ok(!ok(check(pub, { "W003.json": lockedNow(), "index.json": index([3]) }, B.lockTime(W) + 5 * 3600000)), "first recorded 5 h after the lock");
  assert.ok(withEnv({ BRACKET_RELEASE: "3" }, () => ok(check(pub, { "W003.json": lockedNow(), "index.json": index([3]) }, B.lockTime(W) + 5 * 3600000))), "…unless the owner released week 3");
  const one = lockedNow(); one.picks.checked = 1;
  assert.ok(!ok(check(pub, { "W003.json": one, "index.json": index([3]) }, B.lockTime(W) + 3600000)), "one-node picks");
  const changed = lockedNow(); changed.picks.rows[0][1] = 3; changed.picks.rows[0][3] = 1; const sc = rec.scoreWeek(changed); changed.results = sc.results; changed.points = sc.points;
  assert.ok(!ok(check({ "W003.json": lockedNow(), "index.json": index([3]) }, { "W003.json": changed, "index.json": index([3]) }, B.lockTime(W) + 2 * 3600000)), "recorded picks changed");
});

test("F4: a recorded hour or end-of-week stake can be replaced only under BRACKET_RELEASE, and is re-read again before final", () => {
  const pubWeek = week(W, "locked", { held: true }), pub = { "W003.json": pubWeek, "index.json": index([3]) };
  const fix = week(W, "locked", { held: true }); fix.days[0][5] = { ...fix.days[0][5], q: 0.75 }; delete fix.days[0][5].re;
  const sc = rec.scoreWeek(fix); fix.results = sc.results; fix.points = sc.points;
  assert.ok(!ok(check(pub, { "W003.json": fix, "index.json": index([3]) }, MON + 3600000)), "without release: held");
  assert.ok(withEnv({ BRACKET_RELEASE: "3" }, () => ok(check(pub, { "W003.json": fix, "index.json": index([3]) }, MON + 3600000))), "with release: taken");
  const reMarked = JSON.parse(JSON.stringify(fix)); reMarked.days[0][5].re = 1;
  assert.ok(withEnv({ BRACKET_RELEASE: "3" }, () => !ok(check(pub, { "W003.json": reMarked, "index.json": index([3]) }, MON + 3600000))), "a replacement can't come re-read already");
  assert.ok(withEnv({ BRACKET_RELEASE: "4,5" }, () => !ok(check(pub, { "W003.json": fix, "index.json": index([3]) }, MON + 3600000))), "another week's release doesn't count");
  assert.ok(withEnv({ BRACKET_RELEASE: "yes" }, () => !ok(check(pub, { "W003.json": fix, "index.json": index([3]) }, MON + 3600000))), "junk releases nothing");
  const stakes = week(W, "locked", { held: true }); stakes.staked.list = [stakes.staked.list[0]];
  assert.ok(!ok(check(pub, { "W003.json": stakes, "index.json": index([3]) }, MON + 3600000)), "end-of-week stakes changed: held");
  assert.ok(withEnv({ BRACKET_RELEASE: "3" }, () => ok(check(pub, { "W003.json": stakes, "index.json": index([3]) }, MON + 3600000))), "…taken under release (final waits for a second matching run)");
});

test("F5: seeding VHP values are whole hundredths, so the job's hash text and JavaScript's always agree", () => {
  const x = week(W, "locked"); const raw = { ...x.seeding.raw }; raw[x.seeding.seeds[7]] = 1e-7;
  x.seeding = reseal(W, { ...x.seeding, raw });
  assert.ok(!ok(check({ "index.json": index([]) }, { "W003.json": x, "index.json": index([3]) }, MON + 3600000)));
});
