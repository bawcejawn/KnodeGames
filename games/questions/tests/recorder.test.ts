// Daily Questions results recorder (games/questions/recorder.ts) on two fake nodes: when it records, pending → final,
// written once, two nodes must agree, failed fetches, holds. Then its files go through the REAL publish check (cut from
// .github/workflows/games.yml), run by run, as the workflow would.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run, snapshotHash, weekList, type Node } from "../recorder.ts";
// Windows has `python`, not `python3` (Repo Lens F3-2); its held list ends lines with \r\n, so splits take /\r?\n/.
const PYTHON = process.platform === "win32" ? "python" : "python3";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const G = 1792368000000, DAY = 86400000, WK = 7 * DAY, H = 3600000;
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const RULE = 5;                                       // q60_rule_week_plus_one: week 4 (Mon 16 Nov) is the first shared week

type World = { time: number; rule: number; questions: Record<number, any>; players: any[]; next: number; fail?: string };
function world(): World {
  const s4 = G + 4 * WK;
  const questions: Record<number, any> = {};
  questions[200] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };       // last week's: not read as week 4's
  for (let i = 0; i < 4; i++) questions[201 + i] = { week: "4", outcome: 1 + (i % 2), lock_time: String(s4 + (i + 1) * DAY / 2) };
  const ans = (opts: number[]) => opts.map((o, i) => ({ question_id: 201 + i, option: o }));
  const players = [
    { address: A, entry: { stake: "500000000", peak_stake: "500000000", voided: false, answers: ans([0, 1, 0, 1]) } },   // staked, 4 pts
    { address: B, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([0, 1, 1]) } },                     // free, 2 pts
    { address: C, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([0, 0]) } },                        // free, 1 pt
  ];
  return { time: G + 5 * WK + 2 * H, rule: RULE, questions, players, next: 205 };
}
function node(wd: World, tweak?: (m: string, r: any) => any): Node {
  return {
    async read(m: string, a: any = {}) {
      if (wd.fail === m) throw new Error("node down");
      let r: any;
      if (m === "get_state") r = { time: String(wd.time), config: { genesis_time: String(G), week_length: String(WK), min_stake: "100000000", q60_rule_week_plus_one: String(wd.rule) }, totals: { next_question_id: wd.next } };
      else if (m === "get_question") r = { question: wd.questions[a.id] };
      else if (m === "list_players") {
        const xs = [...wd.players].sort((u, v) => (u.address < v.address ? -1 : 1));
        const i = a.start ? xs.findIndex((x) => x.address === a.start) + 1 : 0;
        r = { rows: xs.slice(i, i + (a.limit ?? 50)) };
      } else throw new Error(`unexpected read ${m}`);
      return tweak ? tweak(m, structuredClone(r)) : r;
    },
  };
}
const dirs = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "q-rec-"));
  const prev = path.join(d, "prev"), out = path.join(d, "out");
  fs.mkdirSync(path.join(prev, "vault"), { recursive: true }); fs.writeFileSync(path.join(prev, ".fetched"), "");
  return { d, prev, out };
};
const files = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".json")).sort() : [];
const j = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const quiet = () => {};
/** What the publish job does with a run's files: check them against the published copy, then publish (copy) what isn't held. */
function publish(out: string, pub: string, now: number) {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split(/\r?\n/);
  const a = y.findIndex((l) => l.includes(`/usr/bin/python3 - "$IN/questions" "$PUB/questions" "$HELD" <<'PY'`));
  const e = y.findIndex((l, i) => i > a && l.trim() === "PY");
  const src = y.slice(a + 1, e).map((l) => l.replace(/^ {10}/, "")).join("\n");
  const held = path.join(path.dirname(pub), `held-${now}`);
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true });
  const r = spawnSync(PYTHON, ["-I", "-", out, pub, held], { input: src, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const hl = fs.readFileSync(held, "utf8").split(/\r?\n/).filter(Boolean);
  for (const f of files(out)) {
    if (hl.includes("questions/" + f)) continue;
    const to = path.join(pub, f);
    if (/^vault\/(W|HOLD-W|RELEASE-W)\d+\.json$/.test(f) && fs.existsSync(to)) continue;   // write-once (the bash loop)
    fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(out, f), to);
  }
  return { held: hl, log: r.stdout };
}
/** One hourly run: the recorder reads the published files (prev = pub), writes out, the publish check runs. */
async function hour(wd: World, pub: string, root: string, nodes?: [Node, Node]) {
  const out = fs.mkdtempSync(path.join(root, "out-"));
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true }); fs.writeFileSync(path.join(pub, ".fetched"), "");
  const res = await run({ nodes: nodes ?? [node(wd), node(wd)], prev: pub, out, log: quiet });
  return { res, out, ...publish(out, pub, wd.time) };
}

test("questions recorder: before the rule week it records nothing", async () => {
  const wd = world(); wd.time = G + 4 * WK + 2 * H;                    // week 3 just ended: old rules
  const { prev, out } = dirs();
  assert.equal((await run({ nodes: [node(wd), node(wd)], prev, out, log: quiet })).state, "not-shared");
  wd.rule = 0;                                                          // no v6.1 at all
  assert.equal((await run({ nodes: [node(wd), node(wd)], prev, out, log: quiet })).state, "not-shared");
  assert.deepEqual(files(out), []);
});

test("questions recorder: pending, then final after a second matching run an hour later; then written once", async () => {
  const wd = world(), { d } = dirs(), pub = path.join(d, "pub");
  let h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending");
  assert.deepEqual(h.held, []);
  assert.deepEqual(files(pub), ["W004.json", "board.json"]);
  assert.equal(j(path.join(pub, "W004.json")).final, false);
  wd.time += 30 * 60000;                                                // 30 minutes: still pending
  h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending");
  wd.time += 31 * 60000;                                                // over an hour after it was first seen
  h = await hour(wd, pub, d);
  assert.equal(h.res.state, "final");
  assert.deepEqual(h.held, [], h.log);
  const v = j(path.join(pub, "vault/W4.json"));
  assert.deepEqual(v, { game: 1, week: 4, final: true, rows: [{ player: A, points: 4 }], first: [B], second: [C] });
  const lw = j(path.join(pub, "board.json")).lastWeek;
  assert.equal(lw.final, true);
  assert.deepEqual(lw.rows.map((r: any) => [r.a, r.board, r.place, r.points, r.ranked]), [[A, "staked", 1, 4, true], [B, "free", 1, 2, false], [C, "free", 2, 1, false]]);
  const before = fs.readFileSync(path.join(pub, "W004.json"), "utf8");
  wd.time += H;
  h = await hour(wd, pub, d);
  assert.equal(h.res.state, "final");
  assert.equal(fs.readFileSync(path.join(pub, "W004.json"), "utf8"), before, "a final week file never changes");
  assert.deepEqual(h.held, []);
});

test("questions recorder: a question still to resolve keeps the week pending", async () => {
  const wd = world(); wd.questions[204].outcome = 0;
  const { d } = dirs(), pub = path.join(d, "pub");
  await hour(wd, pub, d); wd.time += 2 * H;
  const h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending");
  assert.equal(j(path.join(pub, "board.json")).lastWeek.complete, false);
  assert.ok(!fs.existsSync(path.join(pub, "vault/W4.json")));
});

test("questions recorder: a snapshot that changes restarts the hour", async () => {
  const wd = world(), { d } = dirs(), pub = path.join(d, "pub");
  await hour(wd, pub, d);
  wd.time += 2 * H; wd.questions[203].outcome = 1000;                   // the owner voids a question
  let h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending");
  wd.time += 2 * H;
  h = await hour(wd, pub, d);
  assert.equal(h.res.state, "final");
  assert.equal(j(path.join(pub, "vault/W4.json")).rows[0].points, 3);
});

test("questions recorder: the two nodes must agree; a failed read stops the run", async () => {
  const wd = world(), { prev, out } = dirs();
  const other = node(wd, (m, r) => { if (m === "list_players") r.rows = r.rows.map((x: any) => (x.address === A ? { ...x, entry: { ...x.entry, stake: "1" } } : x)); return r; });
  await assert.rejects(run({ nodes: [node(wd), other], prev, out, log: quiet, retryMs: 0 }), /disagree on the players/);
  const otherQ = node(wd, (m, r) => { if (m === "get_question" && r.question?.week === "4") r.question.outcome = 2; return r; });
  await assert.rejects(run({ nodes: [node(wd), otherQ], prev, out, log: quiet, retryMs: 0 }), /disagree on the week's questions/);
  const down = { ...wd, fail: "list_players" };
  await assert.rejects(run({ nodes: [node(wd), node(down)], prev, out, log: quiet }), /node down/);
  assert.deepEqual(files(out).filter((f) => !f.startsWith("vault/HOLD")), []);
});

test("questions recorder: without the last run's files it refuses to write", async () => {
  const wd = world(), { prev, out } = dirs();
  fs.rmSync(path.join(prev, ".fetched"));
  await assert.rejects(run({ nodes: [node(wd), node(wd)], prev, out, log: quiet }), /refusing to write/);
});

test("questions recorder: a final week that the chain later reads differently stops the run", async () => {
  const wd = world(), { d } = dirs(), pub = path.join(d, "pub");
  await hour(wd, pub, d); wd.time += 2 * H; await hour(wd, pub, d);
  assert.equal(j(path.join(pub, "W004.json")).final, true);
  wd.time += H; wd.players[0].entry.answers[0].option = 1;
  const out = fs.mkdtempSync(path.join(d, "x-"));
  await assert.rejects(run({ nodes: [node(wd), node(wd)], prev: pub, out, log: quiet }), /final, but the chain now reads differently/);
});

test("questions recorder: past the results deadline: loud for 3 h if no final was written, then it stops recording", async () => {
  const wd = world(); wd.time = G + 5 * WK + 3 * DAY + 1;
  const { prev, out } = dirs();
  await assert.rejects(run({ nodes: [node(wd), node(wd)], prev, out, log: quiet }), /no final file was written: its stakers' share rolls over/);
  // Repo Lens QF-5: a scheduled run delayed past the first hour still raises it (the window is 3 h, not 1 h).
  wd.time += 2 * H;
  await assert.rejects(run({ nodes: [node(wd), node(wd)], prev, out, log: quiet }), /no final file was written/, "a run 2 h past the deadline still alerts");
  wd.time = G + 5 * WK + 3 * DAY + 3 * H;
  assert.equal((await run({ nodes: [node(wd), node(wd)], prev, out, log: quiet })).state, "past-due");
  // a week that did go final is quiet past the deadline
  const w2 = world(), d2 = dirs(), pub = path.join(d2.d, "pub");
  await hour(w2, pub, d2.d); w2.time += 2 * H; await hour(w2, pub, d2.d);
  w2.time = G + 5 * WK + 3 * DAY + 1;
  assert.equal((await run({ nodes: [node(w2), node(w2)], prev: pub, out: fs.mkdtempSync(path.join(d2.d, "o-")), log: quiet })).state, "past-due");
});

test("questions recorder: QUESTIONS_FROM_WEEK set, an older week read as not shared stays quiet", async () => {
  const wd = world(); wd.time = G + 4 * WK + 2 * H;     // week 3 just ended (old rules), fromWeek 4
  const { prev, out } = dirs();
  assert.equal((await run({ nodes: [node(wd), node(wd)], prev, out, log: quiet, fromWeek: 4 })).state, "not-shared");
});

test("questions recorder: under 24 h left, the pending files are written and the run raises the late alert", async () => {
  const wd = world(); wd.questions[204].outcome = 0; wd.time = G + 5 * WK + 3 * DAY - 12 * H;
  const { prev, out } = dirs(), said: string[] = [];
  const res = await run({ nodes: [node(wd), node(wd)], prev, out, log: (s) => said.push(s) });
  assert.deepEqual(res, { week: 4, state: "late" }, "late, not a throw: the files still go out (Repo Lens QF-2)");
  assert.match(said.join("\n"), /::error::week 4 is still pending .*unresolved questions 204.*Its files were written and go out with this run\./);
  assert.equal(j(path.join(out, "W004.json")).final, false);
  assert.ok(fs.existsSync(path.join(out, "board.json")));
});

test("questions recorder: the owner's HOLD and RELEASE files are added once", async () => {
  const wd = world(), { d } = dirs(), pub = path.join(d, "pub");
  const out = fs.mkdtempSync(path.join(d, "o-"));
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true }); fs.writeFileSync(path.join(pub, ".fetched"), "");
  await run({ nodes: [node(wd), node(wd)], prev: pub, out, hold: [4], holdReason: "checking a question", release: [], log: quiet });
  assert.deepEqual(j(path.join(out, "vault/HOLD-W4.json")), { game: 1, week: 4, reason: "checking a question" });
  let p = publish(out, pub, wd.time);
  assert.deepEqual(p.held, []);
  const out2 = fs.mkdtempSync(path.join(d, "o-"));
  await run({ nodes: [node(wd), node(wd)], prev: pub, out: out2, hold: [4], release: [4], log: quiet });
  assert.ok(!fs.existsSync(path.join(out2, "vault/HOLD-W4.json")), "a published HOLD isn't written again");
  assert.deepEqual(j(path.join(out2, "vault/RELEASE-W4.json")), { game: 1, week: 4 });
  p = publish(out2, pub, wd.time);
  assert.deepEqual(p.held, []);
  assert.throws(() => weekList("4,x"), /not a week number/);
});

test("questions recorder: its files are in the recorders' own JSON form, and the hash is its content's", async () => {
  const wd = world(), { prev, out } = dirs();
  await run({ nodes: [node(wd), node(wd)], prev, out, log: quiet });
  for (const f of files(out)) {
    const raw = fs.readFileSync(path.join(out, f), "utf8");
    assert.equal(raw, JSON.stringify(JSON.parse(raw)) + "\n", f);
  }
  const w = j(path.join(out, "W004.json"));
  assert.equal(w.seen.hash, snapshotHash(w));
  assert.deepEqual(w.questions.map((q: any) => q[0]), [201, 202, 203, 204], "only week 4's questions");
});

test("questions recorder: the vault bot's own checks pass on its final files (bot/vault.ts)", async () => {
  const { checkResults, boardScore, orderBreak } = await import("../../../bot/vault.ts");
  const wd = world(), { d } = dirs(), pub = path.join(d, "pub");
  await hour(wd, pub, d); wd.time += 2 * H; await hour(wd, pub, d);
  const v = j(path.join(pub, "vault/W4.json")), b = j(path.join(pub, "board.json"));
  assert.equal(checkResults(v, 1, 4), "");
  assert.equal(b.lastWeek.week, 4);
  const places = new Map<string, number>(b.lastWeek.rows.map((r: any) => [r.a, r.place]));
  assert.equal(orderBreak(v.rows, places), "");
  // every Staked (ranked) row with points is in the file, and every file row is on the board
  const ranked = b.lastWeek.rows.filter((r: any) => r.ranked === true && (boardScore(r) ?? 0) > 0).map((r: any) => r.a);
  assert.deepEqual(ranked, v.rows.map((r: any) => r.player));
});
// Repo Lens #C-11 — APPEND to games/questions/tests/recorder.test.ts (uses its world, node, dirs, quiet, run, G, WK, H).
// Written by reading the code; Repo Lens did not run it. Expected: both FAIL on b416a96 (the fixes are new behaviour).

// C11-1: the vault is on the v6.1 rules (rule week 4) but the reader sees no q60_rule_week_plus_one (main's ABI before
// #114, or a node that leaves the field out). Today: "not-shared", a log line and no alert, so week 4's stakers' share
// rolls over silently. With QUESTIONS_FROM_WEEK = 4 (a repo variable passed as `fromWeek`), that must be an error.
test("Repo Lens C11-1: a week the owner expects to be paid from a file, read as not-shared, fails the run", async () => {
  const wd = world(); wd.rule = 0;                       // the field didn't decode
  const { prev, out } = dirs();
  await assert.rejects(() => run({ nodes: [node(wd), node(wd)], prev, out, log: quiet, fromWeek: 4 }), /not paid from a results file|q60|rule week/);
});

// C11-4: a counted question that never resolves keeps the week pending until it is past due, with no alert at any
// point: the stakers' share rolls over silently. Under 24 h before the deadline, a still-pending week must raise the alert.
// Repo Lens QF-2: the alert is state "late" (the command line exits 3: the workflow publishes the files, then emails).
test("Repo Lens C11-4: a week still pending under 24 h before its results are due raises the late alert (files written)", async () => {
  const wd = world(); wd.questions[204].outcome = 0;    // one counted question never resolved
  wd.time = G + 5 * WK + 3 * 24 * H - 12 * H;          // 12 h before week 4's results are due
  const { prev, out } = dirs(), said: string[] = [];
  const res = await run({ nodes: [node(wd), node(wd)], prev, out, log: (s) => said.push(s) });
  assert.equal(res.state, "late");
  assert.match(said.join("\n"), /::error::.*(due|pending|unresolved)/);
  assert.equal(j(path.join(out, "W004.json")).final, false, "the pending week file is written");
});

test("questions recorder: two nodes that disagree for a moment (a resolve between the reads) agree on the second read", async () => {
  const wd = world(), { prev, out } = dirs();
  let calls = 0;
  const lagging = node(wd, (m, r) => { if (m === "get_question" && r.question?.week === "4" && calls++ < 4) r.question.outcome = 0; return r; });
  assert.equal((await run({ nodes: [node(wd), lagging], prev, out, log: quiet, retryMs: 0 })).state, "pending");
});

// ───────────────────────── Repo Lens #F-1, fix-check of #C-11 (questions-recorder @ 6b07974), 9 Nov 2026 ─────────────────────────
// APPEND to games/questions/tests/recorder.test.ts (uses its world, node, dirs, files, j, quiet, publish, run, G, WK, DAY, H).
// All five tests FAIL at 6b07974 and must PASS after the QF-1..QF-3 fixes. The three that run the real workflow step need
// bash (CI's ubuntu runner, Linux, macOS, WSL); on native Windows they are skipped and say so.
const NEEDS_BASH = process.platform === "win32" ? "runs the workflow's bash step: needs bash (CI on ubuntu runs it)" : false;

/** One hourly run AS THE WORKFLOW DOES IT: the "Record Daily Questions" step copies the recorder's files to the artifact
 *  only if `npm run questions` succeeded (`set -euo pipefail`, then `cp`). A run that throws publishes nothing. */
async function wfHour(wd: any, pub: string, root: string) {
  const out = fs.mkdtempSync(path.join(root, "out-"));
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true }); fs.writeFileSync(path.join(pub, ".fetched"), "");
  let res: any;
  try { res = await run({ nodes: [node(wd), node(wd)], prev: pub, out, log: quiet }); }
  catch (e: any) { return { res: { state: "failed", error: String(e.message) }, held: [] as string[] }; }
  return { res, ...publish(out, pub, wd.time) };
}


/** Runs the REAL "Record Daily Questions" step script from games.yml with a stub `npm` that writes the given files into
 *  $QUESTIONS_OUT and exits with `code`. Returns the step's exit status and which files reached the artifact folder. */
function recordStep(code: number, write: string[]) {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split(/\r?\n/);
  const at = y.findIndex((l) => l.includes("name: Record Daily Questions"));
  const r0 = y.findIndex((l, i) => i > at && l.trim() === "run: |");
  const body: string[] = [];
  for (let i = r0 + 1; i < y.length && (y[i].startsWith("          ") || y[i].trim() === ""); i++) body.push(y[i].replace(/^ {10}/, ""));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "q-step-")), bin = path.join(tmp, "bin");
  fs.mkdirSync(bin);
  const sh = write.map((f) => `mkdir -p "$(dirname "$QUESTIONS_OUT/${f}")"; echo '{}' > "$QUESTIONS_OUT/${f}"`).join("\n");
  fs.writeFileSync(path.join(bin, "npm"), `#!/bin/sh\n${sh}\nexit ${code}\n`, { mode: 0o755 });
  const r = spawnSync("bash", ["-c", body.join("\n")], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: tmp, QUESTIONS_OUT: path.join(tmp, "questions-out") } });
  const dest = path.join(tmp, "games-data/questions");
  return { status: r.status, copied: files(dest) };
}

// QF-2: the C11-4 alert throws AFTER writing, but the workflow drops a failed run's files. So once a week becomes complete
// (or its snapshot changes) inside the last 24 h, no run can publish the "first seen" file, the next run never finds a
// matching earlier snapshot, and the week can never go final: the stakers' share rolls over. The owner's own remedy for
// the alert ("resolve or void them") is exactly what triggers this.
test("Repo Lens QF-2: a question resolved under 24 h before the deadline still goes final in the workflow", async () => {
  const wd = world(); wd.questions[204].outcome = 0;                     // one counted question unresolved
  const { d } = dirs(), pub = path.join(d, "pub");
  const due = G + 5 * WK + 3 * DAY;                                        // week 4's results due (Thu 00:00 UTC)
  wd.time = due - 30 * H;
  assert.equal((await wfHour(wd, pub, d)).res.state, "pending", "30 h left: pending, published, no alert");
  wd.questions[204].outcome = 2;                                           // the owner resolves it after the email
  const states: string[] = [];
  for (let t = due - 20 * H; t < due && !j(path.join(pub, "W004.json")).final; t += H) {
    wd.time = t; states.push((await wfHour(wd, pub, d)).res.state);
  }
  assert.equal(j(path.join(pub, "W004.json")).final, true,
    `week 4 never went final in the 20 h left (runs: ${states.join(", ")}): its stakers' share rolls over`);
  assert.ok(fs.existsSync(path.join(pub, "vault/W4.json")), "the vault file is published");
});

// QF-2, the workflow half (for the "exit 3 = written, alert" fix): the real "Record Daily Questions" step, with a stub
// `npm` that writes a week file and exits 3, must still copy the files to the artifact folder and then fail the step.
// Any other non-zero exit still copies nothing.
test("Repo Lens QF-2: the Record step publishes a run that wrote its files and then raised the late alert (exit 3)", { skip: NEEDS_BASH }, () => {
  for (const [code, copied] of [[0, true], [3, true], [1, false]] as const) {
    const r = recordStep(code, ["W004.json"]);
    assert.equal(r.status === 0, code === 0, `recorder exit ${code}: the step's exit (${r.status}) must be non-zero exactly when the recorder's is`);
    assert.equal(r.copied.includes("W004.json"), copied, `recorder exit ${code}: the week file ${copied ? "must" : "must not"} reach the artifact`);
  }
});

// QF-3: the owner's QUESTIONS_HOLD is written at the start of every run, but a run that then throws publishes nothing,
// so the HOLD never reaches games-data (the vault bot reads HOLD files only there). The case a hold exists for, the chain
// disagreeing with a published final (an owner void after the week went final), is exactly a run that throws every hour.
test("Repo Lens QF-3: the owner's HOLD is published even when the run then stops (final vs chain disagreement)", { skip: NEEDS_BASH }, async () => {
  const wd = world(), { d } = dirs(), pub = path.join(d, "pub");
  await wfHour(wd, pub, d); wd.time += 2 * H; await wfHour(wd, pub, d);
  assert.equal(j(path.join(pub, "W004.json")).final, true);
  assert.ok(fs.existsSync(path.join(pub, "vault/W4.json")), "week 4's vault file is published (the vault bot will post it)");
  wd.time += H; wd.questions[202].outcome = 1000;                         // the owner voids a question after the final
  // The owner sets QUESTIONS_HOLD=4 to stop the vault bot posting the old file. One run, as the workflow does it:
  const out = fs.mkdtempSync(path.join(d, "out-"));
  let threw = false;
  try { await run({ nodes: [node(wd), node(wd)], prev: pub, out, hold: [4], holdReason: "voided a question after the final", log: quiet }); }
  catch { threw = true; }
  assert.ok(threw, "the run stops: final, but the chain reads differently");
  assert.ok(fs.existsSync(path.join(out, "vault/HOLD-W4.json")), "the recorder wrote the HOLD before it stopped");
  // The real Record step, for a recorder that wrote a HOLD (and a week file) and then failed with exit 1:
  const r = recordStep(1, ["vault/HOLD-W4.json", "W004.json"]);
  assert.notEqual(r.status, 0, "the step still fails (the alert)");
  assert.ok(r.copied.includes("vault/HOLD-W4.json"), "the HOLD must reach the artifact even though the recorder failed; today the vault bot never sees it");
  assert.ok(!r.copied.includes("W004.json"), "but nothing else from a failed run goes out");
});

// QF-1: KoinosChain.read has no time limit, and the CLI never calls process.exit. A node that accepts the connection but
// never answers keeps `npm run questions` alive until the record job's 30-minute limit: the job is cancelled, the
// upload-artifact step never runs, and Block X's files for that hour (already recorded by its own step) aren't published.
// Every hourly run reads get_state on both nodes, so this is live from the merge, not only from the rule week.
test("Repo Lens QF-1: a node that never answers can't hold the run (each read gives up)", async () => {
  const wd = world(), { prev, out } = dirs();
  const hung: Node = { read: () => new Promise(() => {}) };
  let timer: any;
  const guard = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("GUARD")), 20_000); });
  try {
    await Promise.race([run({ nodes: [node(wd), hung], prev, out, log: quiet, callTimeoutMs: 200 } as any), guard]);
    assert.fail("the run finished against a node that never answers");
  } catch (e: any) {
    assert.ok(e.message !== "GUARD", "still waiting after 20 s: a hung node holds the run until the record job's 30-minute limit (Block X's files go too)");
  } finally { clearTimeout(timer); }
});

test("Repo Lens QF-1: both Daily Questions steps have their own time limit and can fail alone", () => {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8");
  for (const name of ["name: Take Daily Questions' last files", "name: Record Daily Questions"]) {
    const a = y.indexOf(name), rest = y.slice(a + name.length);
    const step = rest.slice(0, rest.search(/\n {6}- (name|uses):/));
    const m = /\n {8}timeout-minutes: *([0-9]+)/.exec(step);
    assert.ok(m && Number(m[1]) <= 10, `${name}: needs timeout-minutes (at most 10) so it can't use up the job's 30 minutes`);
    assert.match(step, /\n {8}continue-on-error: true/, `${name}: must stay continue-on-error`);
  }
});

// Repo Lens F3-1: the recorder gets only what is left of the job's 30 minutes (minus 2.5 for the upload).
test("Repo Lens F3-1: with no time left in the job the recorder is skipped and the step takes the failed path", { skip: NEEDS_BASH }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "q-f31-"));
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split(/\r?\n/);
  const at = y.findIndex((l) => l.includes("name: Record Daily Questions"));
  const r0 = y.findIndex((l, i) => i > at && l.trim() === "run: |");
  const body: string[] = [];
  for (let i = r0 + 1; i < y.length && (y[i].startsWith("          ") || y[i].trim() === ""); i++) body.push(y[i].replace(/^ {10}/, ""));
  const bin = path.join(tmp, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "npm"), `#!/bin/sh\necho ran > "$RUNNER_TEMP/npm-ran"\nexit 0\n`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: tmp, QUESTIONS_OUT: path.join(tmp, "questions-out") };
  // started 29 minutes ago: under a minute left
  fs.writeFileSync(path.join(tmp, "job-start"), String(Math.floor(Date.now() / 1000) - 29 * 60));
  let r = spawnSync("bash", ["-c", body.join("\n")], { encoding: "utf8", env });
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(path.join(tmp, "npm-ran")), "the recorder didn't start");
  // started just now: it runs
  fs.writeFileSync(path.join(tmp, "job-start"), String(Math.floor(Date.now() / 1000)));
  r = spawnSync("bash", ["-c", body.join("\n")], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(tmp, "npm-ran")));
});
