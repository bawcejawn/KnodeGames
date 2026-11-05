// Fantasy's publish check (games.yml, the inline Python that runs no repository code), driven with real files.
// RECORDER_STANDARD §3.1-3.2 and WEEK_CYCLE §2: the publish job's OWN clock decides whether a week may be final and
// whether its vault file may be published; the two-run `pending` field has a strict shape.
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cut = (marker) => {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const a = y.findIndex((l) => l.includes(marker));
  const e = y.findIndex((l, i) => i > a && l.trim() === "PY");
  assert.ok(a > 0 && e > a, "found the Fantasy publish check");
  return y.slice(a + 1, e).map((l) => l.replace(/^ {10}/, "")).join("\n");
};
const CHECK = cut(`if [ -d "$IN/fantasy" ] && ! /usr/bin/python3 - "$IN/fantasy" "$FPUB" <<'PY'`);
const G = 1792368000000, WK = 7 * 86400000;           // vault week 0: Mon 19 Oct 2026 00:00 UTC
const start = G + 2 * WK, end = G + 3 * WK;            // week 2
const dirs = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "fx-pub-")); dirs.push(d); return d; };
const week = (over = {}) => ({ v: 1, week: 2, start, end, final: false, sheet: null, sha256: null, picks: {}, rivals: null, players: [], matches: [], pending: null, ...over });
const vault = { game: 4, week: 2, final: true, rows: [], first: [], second: [] };

function check(files, now) {
  const d = tmp(), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(path.join(inn, "vault"), { recursive: true }); fs.mkdirSync(path.join(pub, "vault"), { recursive: true });
  for (const [f, j] of Object.entries(files)) fs.writeFileSync(path.join(inn, f), JSON.stringify(j) + "\n");
  const r = spawnSync("python3", ["-I", "-", inn, pub], { input: CHECK, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
}

test("a final week before its end (by the publish clock) is refused; after it, accepted", () => {
  const fin = week({ final: true });
  assert.equal(check({ "W002.json": fin }, end - 60000).ok, false, "Sunday 23:59: still the review day");
  const r = check({ "W002.json": fin }, end + 60000);
  assert.ok(r.ok, r.out);
});

test("a vault file needs its week final and ended", () => {
  assert.equal(check({ "W002.json": week({ pending: { hash: "a".repeat(64), at: end + 1 } }), "vault/W2.json": vault }, end + 7200000).ok, false, "pending week: no vault file");
  assert.equal(check({ "W002.json": week({ final: true }), "vault/W2.json": vault }, end - 1).ok, false, "before the end");
  const r = check({ "W002.json": week({ final: true }), "vault/W2.json": vault }, end + 3600000);
  assert.ok(r.ok, r.out);
  assert.equal(check({ "vault/W2.json": vault }, end + 3600000).ok, false, "no week file at all");
});

test("pending: null or {hash, at}; never on a final week; a week file too far ahead is refused", () => {
  const now = end + 3600000;
  assert.ok(check({ "W002.json": week({ pending: { hash: "0".repeat(64), at: end + 1 } }) }, now).ok);
  for (const p of [{ hash: "xyz", at: 1 }, { hash: "0".repeat(64) }, { hash: "0".repeat(64), at: -5 }, "0".repeat(64)])
    assert.equal(check({ "W002.json": week({ pending: p }) }, now).ok, false, JSON.stringify(p));
  assert.equal(check({ "W002.json": week({ final: true, pending: { hash: "0".repeat(64), at: end + 1 } }) }, now).ok, false);
  const { pending, ...noPending } = week();
  assert.equal(check({ "W002.json": noPending }, now).ok, false, "the pending key is required");
  assert.equal(check({ "W002.json": week() }, start - 9 * 86400000).ok, false, "a week starting 9 days ahead");
  assert.ok(check({ "W002.json": week() }, start - 2 * 86400000).ok, "the next week's file from Saturday");
});

test("D-129: alltime.json carries the counted Sunday fun rounds; a counted Sunday can't go missing", () => {
  const now = end + 3600000, A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const at = (sundays) => ({ v: 1, weeks: [2], sundays, players: { [A]: { points: 700, weeks: 1, best: 600, staked: true } } });
  assert.ok(check({ "alltime.json": at([20765]) }, now).ok);
  assert.equal(check({ "alltime.json": { v: 1, weeks: [2], players: {} } }, now).ok, false, "the key is required");
  assert.equal(check({ "alltime.json": at([20765, 20765]) }, now).ok, false, "no Sunday twice");
  // Against a published file that already counted Sunday 20765:
  const d = tmp(), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn, { recursive: true }); fs.mkdirSync(path.join(pub, "vault"), { recursive: true });
  fs.writeFileSync(path.join(pub, "alltime.json"), JSON.stringify(at([20765])) + "\n");
  fs.writeFileSync(path.join(inn, "alltime.json"), JSON.stringify(at([])) + "\n");
  const r = spawnSync("python3", ["-I", "-", inn, pub], { input: CHECK, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  assert.notEqual(r.status, 0, "a counted Sunday dropped is refused");
});

// ── §4.1: the ported scorer agrees with fantasy-math.js (differential, thousands of random weeks, one Python run) ──
await import(path.join(APP, "race-math.js"));
await import(path.join(APP, "fantasy-math.js"));
const F = globalThis.KFantasyMath;
const SCORER = (() => {
  const a = CHECK.indexOf("# ── Fantasy scorer"), b = CHECK.indexOf("# ── end of the Fantasy scorer ──");
  assert.ok(a > 0 && b > a, "the scorer block is marked");
  return CHECK.slice(a, b);
})();
test("§4.1 differential: the publish job's Python scorer = fantasy-math.js on 3,000 random weeks", () => {
  let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const addr = (i) => { let x = i, t = ""; do { t = B58[x % 58] + t; x = Math.floor(x / 58); } while (x); return "1" + t.padStart(33, "Z"); };
  const cases = [];
  for (let n = 0; n < 3000; n++) {
    const prods = Array.from({ length: 6 + Math.floor(rnd() * 14) }, (_, i) => addr(i));
    const producers = {};
    for (const a of prods) { const exp = Math.round(rnd() * 3000) / 100, got = Math.floor(rnd() * 40); producers[a] = [got, exp, exp > 0 ? Math.round(10000 * got / exp) / 100 : null]; }
    const nPlayers = 1 + Math.floor(rnd() * (n % 10 === 0 ? 400 : 30));
    const rows = Array.from({ length: nPlayers }, (_, i) => {
      const team = rnd() < 0.1 ? null : [...prods].sort(() => rnd() - 0.5).slice(0, 5);
      const pts = rnd() < 0.15 ? 0 : Math.round(rnd() * (n % 7 === 0 ? 50 : 400000)) / 100;
      return { a: addr(1000 + i), team, points: pts, staked: rnd() < 0.5, full: rnd() < 0.7 };
    });
    // a few ties
    for (let k = 0; k + 1 < rows.length; k += 5) rows[k + 1].points = rows[k].points;
    const stakedRows = rows.filter((r) => r.staked);
    const vp = F.vaultPoints(stakedRows), fw = F.freeWinners(rows);
    const places = Object.fromEntries(F.rank(rows).map((r) => [r.a, r.place]));
    cases.push({ producers, rows, js: { day: rows.map((r) => F.dayScore(r.team, { producers })), vault: Object.fromEntries(vp), first: fw.first, second: fw.second, places, total: rows.map((r) => Math.round(r.points * 3 * 100) / 100) } });
  }
  const driver = SCORER + `
import json, sys
bad = 0
for line in sys.stdin:
    c = json.loads(line); rows = c["rows"]; js = c["js"]
    day = [fx_day_score(r["team"], c["producers"]) for r in rows]
    vault = fx_vault_points([r for r in rows if r["staked"]])
    first, second = fx_free_winners(rows)
    places = fx_rank(rows)
    if day != js["day"] or vault != js["vault"] or [first, second] != [js["first"], js["second"]] or places != js["places"]:
        bad += 1
        if bad < 4: print("MISMATCH", json.dumps({"day": [day, js["day"]] if day != js["day"] else None, "vault": vault != js["vault"], "free": [first, second, js["first"], js["second"]], "places": places != js["places"]})[:600])
print("bad", bad)
`;
  const r = spawnSync("python3", ["-I", "-c", driver], { input: cases.map((c) => JSON.stringify(c)).join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /bad 0\s*$/, r.stdout.slice(0, 2000));
});
test("§4.1: rjs is JavaScript's round to 2 decimals, including the awkward cases", () => {
  const xs = [0, 0.005, 0.015, 1.005, 2.675, 0.49999999999999994, 129.995, 1e6 + 0.125, 4200.5, 3 * 130.1, 0.1 + 0.2, 99.995, 260 + 101.33 + 130];
  for (let i = 0; i < 2000; i++) xs.push(Math.random() * 1e5, Math.round(Math.random() * 1e7) / 1000);
  const r = spawnSync("python3", ["-I", "-c", SCORER + "\nimport json,sys\nprint(json.dumps([rjs(x) for x in json.loads(sys.stdin.read())]))"], { input: JSON.stringify(xs), encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const py = JSON.parse(r.stdout);
  xs.forEach((x, i) => assert.equal(py[i], Math.round(x * 100) / 100, String(x)));
});

test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
