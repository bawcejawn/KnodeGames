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

test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
