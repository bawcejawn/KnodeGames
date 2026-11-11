// Repo Lens #B-15 (fix-check 3, PR #186 @ 3b46546f): helpers copied from repolens-e3fc2-payees.test.mjs (SIZE made a variable).
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
const W = 3; let SIZE = 8;

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
  const base = { at: B.seedTime(w), cardAt: 5, size: SIZE, seeds, vhp: seeds.map((_, i) => SIZE - i), totalVhp: seeds.reduce((t, _, i) => t + SIZE - i, 0), out: [], outVhp: [], raw, pooled: [] };
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


// ── B15-1: a 32-seed week: the job refuses honest picks after round 1's first hour (lock + 65 min) even without release;
//    the recorder keeps recording them until lock + 3 h, so one slow or failed run voids the week ──
test("B15-1: a 32-seed week's honest picks first recorded 70 min after the lock (no release) are accepted, as the recorder records them until lock + 3 h", () => {
  SIZE = 32;
  try {
    const pub = { "W003.json": beforePicks(W), "index.json": index([3]) };
    const honest = rescore((() => { const x = week(W, "locked"); x.staked = null; delete x.picks.re; for (const d of x.days) d.fill(null); return x; })());
    assert.equal(B.roundDay(W, 0, 32) - LOCK, 5 * 60000, "round 1 of a 32-seed week starts 5 minutes after the lock");
    const atRun = LOCK + 70 * 60000;   // an hourly run 70 min after the lock: inside the recorder's window (lock + 3 h)
    const r = check(pub, { "W003.json": honest, "index.json": index([3]) }, atRun);
    assert.ok(ok(r), "honest picks, no release, 70 min after the lock: " + r.out.slice(0, 300) + " held=" + JSON.stringify(r.held));
  } finally { SIZE = 8; }
});

// ── B15-2: R-1 residual: a forged run during a release replaces confirmed hours; the first run after the release is
//    cleared adds "re", marks the week final and writes the vault file in one go ──
test("B15-2: a week can't go final in the same run that first confirms an item replaced under release (the release just cleared)", () => {
  const honest = week(W, "locked", { held: true });
  const pub = { "W003.json": honest, "index.json": index([3]) };
  const target = B.decode(0, SIZE, SIZE).rounds, seeds = honest.seeding.seeds, r1f = clone(honest);
  target.forEach((winners, r) => {
    const playing = r === 0 ? seeds.map((_, i) => i + 1) : target[r - 1];
    const losers = playing.filter((n) => !winners.includes(n)).map((n) => seeds[n - 1]);
    for (const h of r1f.days[r]) { delete h.re; for (const a of losers) h.cr[a] = 0; for (const n of winners) h.cr[seeds[n - 1]] = Math.max(1, h.cr[seeds[n - 1]]); }
  });
  rescore(r1f);
  const r1 = check(pub, { "W003.json": r1f, "index.json": index([3]) }, MON + HOUR, "3");
  assert.ok(ok(r1), "R1 (forged, under the owner's release) accepted: " + r1.out.slice(0, 200));
  const r2f = clone(r1f); for (const d of r2f.days) for (const h of d) h.re = 1; r2f.status = "final"; rescore(r2f);
  const v = vaultOf(r2f), vh = vaultOf(rescore(Object.assign(clone(honest), { status: "final" })));
  assert.notDeepEqual(v.rows, vh.rows, "the Vault would pay different rows");
  // R2: the first run after the owner clears BRACKET_RELEASE
  const r2 = check({ "W003.json": r1f, "index.json": index([3]) }, { "W003.json": r2f, "vault/W3.json": v, "index.json": index([3]) }, MON + 2 * HOUR, "");
  assert.ok(!ok(r2), "the replaced hours' re-read mark and the final (and vault file) must not come from the same run: " + JSON.stringify({ status: r2.status, held: r2.held }));
});

// ── B15-3: per-week hold: a week file that fails (held on its own) is still the `last` seeding the next week's
//    derivation trusts ──
test("B15-3: a held (failing) week file is never the last seeding another week's seeding is derived from", () => {
  const w2 = week(2, "final"), w3 = beforePicks(3);
  const pub = { "W002.json": w2, "index.json": index([2]) };
  // forged run: W002 (final) with its top seed's raw average lowered to 0.5 and the seeding re-hashed. A final week
  // changed, so the job holds W002 on its own (fix-check 2 S-1) ...
  const w2f = clone(w2); const top = w2f.seeding.seeds[0]; w2f.seeding.raw[top] = 0.5; w2f.seeding = reseal(2, w2f.seeding);
  // ... and a new W003 seeding derived from that forged last: the top producer capped at 0.5, so seeded last
  const s3 = clone(w3.seeding); delete s3.re;
  const order = [...s3.seeds.slice(1), top], vOf = Object.fromEntries(s3.seeds.map((a, i) => [a, s3.vhp[i]])); vOf[top] = 0.5;
  const s3f = reseal(3, { ...s3, seeds: order, vhp: order.map((a) => vOf[a]) });
  const w3f = { ...w3, seeding: s3f };
  const r = check(pub, { "W002.json": w2f, "W003.json": w3f, "index.json": index([2, 3]) }, B.seedTime(3) + HOUR);
  const w3pub = r.status === 0 && !r.held.includes("bracket/W003.json");
  assert.ok(!w3pub, "W003 was published with a seeding derived from a W002 the job itself refused this run");
});
