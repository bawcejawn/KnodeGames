// tools/vhp-ruler-race-check.mjs: the Ruler chat's read-only check of the Race's ruled week (Week 1 = vault week 4).
// Real cards from the Race's own code (bot/race-ruler.ts entryForBlocks) on the made-up chain of race-ruler.fixture.mjs;
// then each way a ruled week can go wrong must be reported, and a clean week must pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, timeline, FROM, PRE, T_RACE } from "./race-ruler.fixture.mjs";
import * as RR from "../../bot/race-ruler.ts";
import { RACE, checkRulerFile, placingsFrom, scanLogs, checkRuns, report, loadWeek } from "../../tools/vhp-ruler-race-check.mjs";

const L = R.ledger(timeline());
const HOUR = 3600000;
const entry = (i) => RR.entryForBlocks(L, new Date(T_RACE + i * 6 * HOUR).toISOString().slice(0, 13), T_RACE + i * 6 * HOUR, 0, [FROM + PRE + i * 7200, FROM + PRE + i * 7200 + 7199]);
const good = () => ({ v: 1, week: 4, rulerFrom: 4, mode: "on", shadow: false, races: [0, 1, 2].map(entry) });
const NOW = T_RACE + 30 * HOUR;
const issues = (f, opt = {}) => checkRulerFile(f, { week: 4, L, now: NOW, ...opt });

test("race check: the tool's settings are the Race's own (bot/race-ruler.ts RULER)", () => {
  assert.deepEqual({ ...RACE, pooled: [...RACE.pooled] }, { ...RR.RULER, pooled: [...RR.RULER.pooled] });
});

test("race check: a clean ruled week passes, every card recomputed", () => {
  const f = good();
  assert.ok(f.races.every((e) => e.card), "the fixture made every card");
  const r = issues(f);
  assert.deepEqual(r.problems, []);
  assert.equal(r.cards, 3);
  assert.equal(r.recomputed, 3);
});

test("race check: the week header must be week 4, rulerFrom 4, mode on, not shadow", () => {
  for (const [k, v] of [["week", 3], ["rulerFrom", 5], ["mode", "shadow"], ["shadow", true]]) {
    const f = { ...good(), [k]: v };
    assert.ok(issues(f).problems.some((p) => p.includes(k)), `${k}=${v} is reported`);
  }
});

test("race check: ruleVersion not 4, or a mode / version / include key on a card, is reported", () => {
  for (const patch of [{ ruleVersion: 5 }, { mode: "B" }, { version: 5 }, { include: ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"] }]) {
    const f = good(), c = JSON.parse(f.races[1].card);
    f.races[1].card = JSON.stringify({ ...c, ...patch });
    const p = issues(f, { L: null }).problems;
    assert.ok(p.some((x) => x.includes(f.races[1].id)), `${JSON.stringify(patch)} is reported: ${p}`);
  }
});

test("race check: placings must be the card's top three by fpct (entry, not void; ties by address)", () => {
  const f = good();
  assert.deepEqual(f.races[0].placings, placingsFrom(JSON.parse(f.races[0].card)));
  f.races[0].placings = [...f.races[0].placings].reverse();
  assert.ok(issues(f).problems.some((p) => p.includes("placings")));
});

test("race check: a card that doesn't recompute from the ruler's data is reported", () => {
  const f = good(), c = JSON.parse(f.races[2].card);
  c.producers[0].fpct = String(BigInt(c.producers[0].fpct) + 1n);
  f.races[2].card = JSON.stringify(c);
  f.races[2].placings = placingsFrom(c);
  const p = issues(f).problems;
  assert.ok(p.some((x) => x.includes(f.races[2].id) && /recompute/.test(x)), p.join("\n"));
});

test("race check: a race with no card is 'not yet', and late after 3 hours", () => {
  const f = good();
  f.races[2] = { ...f.races[2], card: null, placings: [], note: "not yet: the ruler's data reaches block 1, the race ends at 2" };
  const early = issues(f, { now: T_RACE + 2 * 6 * HOUR + 6 * HOUR + HOUR });
  assert.deepEqual(early.problems, []);
  assert.equal(early.notYet.length, 1);
  const late = issues(f, { now: T_RACE + 2 * 6 * HOUR + 6 * HOUR + 4 * HOUR });
  assert.equal(late.late.length, 1);
  assert.ok(late.late[0].includes("not yet"));
});

test("race check: logs with 'differs', 'refused', a held file or 'doesn't match' are problems; ok lines are counted", () => {
  const s = scanLogs([
    "2026-11-16T01:40:00Z ok: the card matches the ruler's data",
    "2026-11-16T01:40:01Z ok: the card matches the ruler's data",
    "2026-11-16T02:40:00Z ##[error]the card doesn't match the ruler's data: sha256 differs: published a, recomputed b",
    "2026-11-16T03:40:00Z ::error::The ruler switch change is refused, nothing was published this run",
    "2026-11-16T04:40:00Z ::error::R004.json (VHP ruler) held, not published this run: x",
    "2026-11-16T05:40:00Z ::warning::The VHP ruler's data (vhp-data) didn't download this run: races are recorded",
    "2026-11-16T06:40:00Z 2 race(s) waiting for the VHP ruler's result (a, b): the ruler's data (vhp-data) is behind.",
    // the step's own script, which GitHub prints before running it: never a problem or an alert
    "2026-11-16T07:40:00Z \u001b[36;1m    return False, \"differs at byte %d\" % i, None\u001b[0m",
    "2026-11-16T07:40:00Z \u001b[36;1m  echo \"::warning::The VHP ruler's data (vhp-data) didn't download this run\"\u001b[0m",
  ].join("\n"));
  assert.equal(s.ok, 2);
  assert.equal(s.problems.length, 3);
  assert.equal(s.alerts.length, 2);
});

test("race check: every Race run since the start must be green; a red one is a problem", () => {
  const since = Date.parse("2026-11-16T00:00:00Z");
  const runs = [
    { id: 1, created_at: "2026-11-15T23:40:00Z", conclusion: "failure", status: "completed" },
    { id: 2, created_at: "2026-11-16T00:40:00Z", conclusion: "success", status: "completed" },
    { id: 3, created_at: "2026-11-16T01:40:00Z", conclusion: "failure", status: "completed", html_url: "u3" },
    { id: 4, created_at: "2026-11-16T02:40:00Z", conclusion: null, status: "in_progress" },
  ];
  const r = checkRuns(runs, since);
  assert.equal(r.counted, 3);
  assert.equal(r.green, 1);
  assert.equal(r.problems.length, 1);
  assert.ok(r.problems[0].includes("u3"));
  assert.equal(r.running, 1);
});

test("race check: loadWeek reads R<week>.json and R<week>-<type>.json, and the report says OK or lists problems", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "race-check-"));
  try {
    fs.writeFileSync(path.join(dir, "R004.json"), JSON.stringify(good()));
    fs.writeFileSync(path.join(dir, "R004-1.json"), JSON.stringify({ ...good(), races: [] }));
    fs.writeFileSync(path.join(dir, "R003.json"), JSON.stringify({ ...good(), week: 3 }));
    const files = loadWeek(dir, 4);
    assert.deepEqual(files.map((x) => x.name), ["R004-1.json", "R004.json"]);
    const res = files.map((x) => ({ name: x.name, ...checkRulerFile(x.file, { week: 4, L, now: NOW }) }));
    const ok = report({ files: res, runs: { counted: 2, green: 2, running: 0, problems: [] }, logs: { ok: 3, problems: [], alerts: [] } });
    assert.match(ok.text, /^OK/);
    assert.equal(ok.problems, 0);
    const bad = report({ files: res, runs: { counted: 2, green: 1, running: 0, problems: ["run 3 is red"] }, logs: { ok: 0, problems: [], alerts: [] } });
    assert.match(bad.text, /^PROBLEMS: 1/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── Repo Lens #G-86 ──
import { listRuns, readLogs } from "../../tools/vhp-ruler-race-check.mjs";

test("G86-2: a card-less race of the newer types (H1-, H2-, D-, W- ids) is listed as late after 3 hours", () => {
  const f = good(), base = f.races[0];
  const day = new Date(T_RACE).toISOString().slice(0, 10), hour = new Date(T_RACE).toISOString().slice(0, 13);
  const ids = [`H1-${hour}`, `H2-${hour}`, `D-${day}`, `W-${day}`];
  f.races = ids.map((id) => ({ ...base, id, card: null, placings: [], note: "not yet: x" }));
  const r = checkRulerFile(f, { week: 4, L: null, now: Date.parse(day + "T00:00:00Z") + 30 * 86400000 });
  assert.equal(r.late.length, 4, r.late.join("\n"));
  assert.equal(r.notYet.length, 0);
  const soon = checkRulerFile(f, { week: 4, L: null, now: T_RACE + 60000 });
  assert.equal(soon.late.length, 0);
});

test("G86-3: listRuns pages until a short page and refuses a list shorter than GitHub's total_count", () => {
  const all = Array.from({ length: 168 }, (_, i) => ({ id: i + 1, created_at: "2026-11-16T00:37:00Z", status: "completed", conclusion: "success" }));
  const pages = [];
  const get = (total) => (p) => { const n = Number(/[?&]page=(\d+)/.exec(p)[1]); pages.push(n); return { total_count: total, workflow_runs: all.slice((n - 1) * 100, n * 100) }; };
  const ok = listRuns(get(168), "o/r", Date.parse("2026-11-16T00:00:00Z"));
  assert.equal(ok.runs.length, 168);
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(ok.problems, []);
  const short = listRuns(get(170), "o/r", 0);
  assert.equal(short.problems.length, 1);
  assert.match(short.problems[0], /168 of GitHub's 170/);
});

test("G86-3 and the record-job Info: readLogs reads record and publish logs of every finished run and says when one is missing", () => {
  const runs = [1, 2, 3].map((id) => ({ id, status: "completed" })).concat([{ id: 4, status: "in_progress" }]);
  const get = (p) => ({ jobs: [{ id: Number(/runs\/(\d+)/.exec(p)[1]) * 10, name: "record" }, { id: Number(/runs\/(\d+)/.exec(p)[1]) * 10 + 1, name: "publish" }, { id: 99, name: "alert" }] });
  const asked = [];
  const getText = (p) => { const j = Number(/jobs\/(\d+)/.exec(p)[1]); asked.push(j); if (j === 31) throw new Error("gone"); return j % 10 === 0 ? "2 race(s) waiting for the VHP ruler's result (a, b): the ruler's data (vhp-data) is behind." : "ok: the card matches the ruler's data"; };
  const r = readLogs(get, getText, "o/r", runs);
  assert.deepEqual(asked.sort((a, b) => a - b), [10, 11, 20, 21, 30, 31], "record and publish only, finished runs only");
  assert.equal(r.read, 2);
  assert.equal(r.of, 3);
  assert.match(r.problems[0], /logs read for 2 of 3 finished runs/);
  const s = scanLogs(r.text);
  assert.equal(s.ok, 2);
  assert.equal(s.alerts.length, 3, "the record job's waiting line now reaches the scan");
});
