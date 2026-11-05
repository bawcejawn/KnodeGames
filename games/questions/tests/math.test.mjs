// Daily Questions (game 1): the weekly scoring the results recorder pays from (games/questions/math.js), one test per
// rule in .ai/games/Questions.md, and the publish job's own copy of it (Python, in .github/workflows/games.yml) run on
// the same weeks: the two must agree exactly over thousands of random weeks (RECORDER_STANDARD §4.1).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scoreWeek, VOID, DAY } from "../math.js";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const START = 1792368000000 + 4 * 7 * DAY;           // vault week 4 (Mon 16 Nov 2026)
const MIN = "100000000";                              // 1 VHP
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const D = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const q = (id, outcome, lock = START + DAY) => [id, outcome, lock];
const p = (a, stake, peak, answers, voided = 0) => [a, String(stake), String(peak), voided, answers];
const week = (questions, players) => scoreWeek({ week: { start: START }, questions, players, min: MIN });
const row = (r, a) => r.rows.find((x) => x.a === a);

test("questions: 1 point per correct answer; a void question doesn't count", () => {
  const r = week([q(1, 1), q(2, 2), q(3, VOID)], [p(A, 2e8, 2e8, [[1, 0], [2, 0], [3, 0]])]);
  assert.equal(row(r, A).pts, 1);
  assert.equal(row(r, A).counted, 2);
  assert.deepEqual(r.vault.rows, [{ player: A, points: 1 }]);
});

test("questions: an unresolved question makes the week incomplete", () => {
  assert.equal(week([q(1, 1), q(2, 0)], []).complete, false);
  assert.equal(week([q(1, 1), q(2, VOID)], []).complete, true);
});

test("questions: a question locking after Saturday doesn't count for the week (D-129), even unresolved", () => {
  const sun = START + 6 * DAY;
  const r = week([q(1, 1), q(2, 1), q(3, 1, sun + 1), q(4, 0, sun + 3600000)], [p(A, 2e8, 2e8, [[1, 0], [2, 0], [3, 0]])]);
  assert.equal(r.complete, true);
  assert.equal(row(r, A).pts, 2);
  assert.equal(row(r, A).counted, 2);
  // Saturday's last round locks exactly at Sunday 00:00: it counts.
  assert.equal(week([q(1, 1, sun)], [p(A, 2e8, 2e8, [[1, 0]])]).rows[0].counted, 1);
});

test("questions: staked needs a stake at the minimum, 2 counted answers and 1 point", () => {
  const r = week([q(1, 1), q(2, 1), q(3, 2)], [
    p(A, 1e8, 1e8, [[1, 0], [2, 1]]),             // staked at exactly the minimum, 1 point from 2: in
    p(B, 1e8, 1e8, [[1, 0]]),                     // 1 counted answer: out
    p(C, 1e8, 1e8, [[1, 1], [2, 1]]),             // 0 points: out
    p(D, 99999999, 99999999, [[1, 0], [2, 0]]),   // under the minimum: free, not staked
  ]);
  assert.deepEqual(r.vault.rows, [{ player: A, points: 1 }]);
  assert.equal(row(r, D).free, true);
  assert.equal(row(r, B).staked || row(r, B).free, false);
});

test("questions: someone staked at the start who withdrew is neither staked nor free (the vault's peak rule)", () => {
  const r = week([q(1, 1), q(2, 1)], [p(A, 0, 5e8, [[1, 0], [2, 0]])]);
  assert.equal(row(r, A).staked, false);
  assert.equal(row(r, A).free, false);
  assert.equal(row(r, A).board, "staked", "the Staked board keeps players who withdrew (LEADERBOARD_STANDARD §1)");
  assert.deepEqual(r.vault, { rows: [], first: [], second: [] });
});

test("questions: a voided entry scores nothing", () => {
  const r = week([q(1, 1), q(2, 1)], [p(A, 5e8, 5e8, [[1, 0], [2, 0]], 1)]);
  assert.equal(row(r, A).pts, 0);
  assert.equal(row(r, A).staked, false);
  assert.equal(row(r, A).free, false);
});

test("questions: first and second are the best free players; a tie for 1st leaves 2nd empty (D-034)", () => {
  const qs = [q(1, 1), q(2, 1), q(3, 1)];
  let r = week(qs, [p(A, 0, 0, [[1, 0], [2, 0], [3, 0]]), p(B, 0, 0, [[1, 0], [2, 0], [3, 1]]), p(C, 0, 0, [[1, 0], [2, 0], [3, 1]]), p(D, 5e8, 5e8, [[1, 0], [2, 0], [3, 0]])]);
  assert.deepEqual(r.vault.first, [A]);
  assert.deepEqual(r.vault.second, [B, C]);
  assert.deepEqual(r.vault.rows, [{ player: D, points: 3 }], "a staked player is never a free winner");
  r = week(qs, [p(A, 0, 0, [[1, 0], [2, 0], [3, 0]]), p(B, 0, 0, [[1, 0], [2, 0], [3, 0]]), p(C, 0, 0, [[1, 0], [2, 0], [3, 1]])]);
  assert.deepEqual(r.vault.first, [A, B]);
  assert.deepEqual(r.vault.second, []);
});

test("questions: more than 10 free players on a place: nobody on it (the vault takes at most 10)", () => {
  const many = Array.from({ length: 11 }, (_, i) => "1" + String.fromCharCode(65 + i).repeat(33));
  const r = week([q(1, 1), q(2, 1)], many.map((a) => p(a, 0, 0, [[1, 0], [2, 0]])));
  assert.deepEqual(r.vault.first, []);
  assert.deepEqual(r.vault.second, []);
});

test("questions: places on each board, ties share; rows by board, points, then address", () => {
  const r = week([q(1, 1), q(2, 1), q(3, 1)], [p(C, 2e8, 2e8, [[1, 0], [2, 0]]), p(A, 2e8, 2e8, [[1, 0], [2, 0], [3, 0]]), p(B, 2e8, 2e8, [[1, 0], [2, 0]]), p(D, 0, 0, [[1, 0], [2, 1]])]);
  assert.deepEqual(r.rows.map((x) => [x.a, x.board, x.place]), [[A, "staked", 1], [B, "staked", 2], [C, "staked", 2], [D, "free", 1]]);
  assert.deepEqual(r.vault.rows.map((x) => x.points), [3, 2, 2]);
});

test("questions: answers to a question not read are reported (the recorder never scores then)", () => {
  assert.deepEqual(week([q(1, 1)], [p(A, 0, 0, [[1, 0], [9, 0]])]).missing, [9]);
});

// ── The publish job's copy (Python) must agree with math.js over random weeks ──
const cut = () => {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const a = y.findIndex((l) => l.includes(`/usr/bin/python3 - "$IN/questions" "$PUB/questions" "$HELD" <<'PY'`));
  const e = y.findIndex((l, i) => i > a && l.trim() === "PY");
  assert.ok(a > 0 && e > a, "the Daily Questions publish check is in games.yml");
  return y.slice(a + 1, e).map((l) => l.replace(/^ {10}/, "")).join("\n");
};
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function randomWeek(r) {
  const nq = 1 + Math.floor(r() * 50), qs = [];
  for (let i = 0; i < nq; i++) {
    const k = r();
    const outcome = k < 0.08 ? VOID : k < 0.12 ? 0 : 1 + Math.floor(r() * 2);
    const lock = START + Math.floor(r() * 7.2 * DAY);
    qs.push([100 + i, outcome, lock]);
  }
  const np = Math.floor(r() * 40), ps = [];
  const stakes = ["0", "1", "99999999", "100000000", "100000001", "500000000", "1000000000000"];
  for (let i = 0; i < np; i++) {
    const a = "1" + String(i).padStart(4, "0").replace(/0/g, "o").replace(/1/g, "x").replace(/[2-9]/g, (c) => "ABCDEFGHJ"[Number(c) - 1]) + "Q".repeat(29);
    const ans = [];
    for (const [id] of qs) if (r() < 0.6) ans.push([id, Math.floor(r() * 2)]);
    if (!ans.length) ans.push([qs[0][0], 0]);
    const stake = stakes[Math.floor(r() * stakes.length)], peak = r() < 0.3 ? stakes[Math.floor(r() * stakes.length)] : stake;
    ps.push([a, stake, peak, r() < 0.05 ? 1 : 0, ans]);
  }
  ps.sort((u, v) => (u[0] < v[0] ? -1 : 1));
  return { questions: qs, players: ps };
}

test("questions: the publish job's Python scorer agrees with math.js on 3,000 random weeks", () => {
  const src = cut().split("\nfiles = sorted(")[0];   // the helpers only, not the checks that read files
  const r = rng(20261116), weeks = [];
  for (let i = 0; i < 3000; i++) weeks.push(randomWeek(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "q-math-")), wf = path.join(dir, "weeks.json");
  fs.writeFileSync(wf, JSON.stringify(weeks));
  const py = `${src}\nimport json, sys\nout=[]\nfor w in json.load(open(${JSON.stringify(wf)})):\n    j={"start":${START},"min":"${MIN}","questions":w["questions"],"players":w["players"]}\n    out.append(score(j))\nprint(json.dumps(out))\n`;
  const res = spawnSync("python3", ["-I", "-", "in", "pub", "held"], { input: py, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, CHECK_NOW_MS: String(START) } });
  assert.equal(res.status, 0, res.stderr);
  const got = JSON.parse(res.stdout.trim().split("\n").pop());
  const seen = { staked: 0, first: 0, second: 0, incomplete: 0, tie: 0 };
  for (let i = 0; i < weeks.length; i++) {
    const js = scoreWeek({ week: { start: START }, questions: weeks[i].questions, players: weeks[i].players, min: MIN });
    assert.deepEqual(got[i], JSON.parse(JSON.stringify(js)), `week ${i} differs`);
    if (js.vault.rows.length) seen.staked++;
    if (js.vault.first.length) seen.first++;
    if (js.vault.first.length > 1) seen.tie++;
    if (js.vault.second.length) seen.second++;
    if (!js.complete) seen.incomplete++;
  }
  // The random weeks reach every case (so "they agree" means something).
  for (const [k, n] of Object.entries(seen)) assert.ok(n >= 50, `only ${n} random weeks with ${k}`);
});
