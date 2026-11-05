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
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const a = y.findIndex((l) => l.includes(`/usr/bin/python3 - "$IN/questions" "$PUB/questions" "$HELD" <<'PY'`));
  const e = y.findIndex((l, i) => i > a && l.trim() === "PY");
  const src = y.slice(a + 1, e).map((l) => l.replace(/^ {10}/, "")).join("\n");
  const held = path.join(path.dirname(pub), `held-${now}`);
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true });
  const r = spawnSync("python3", ["-I", "-", out, pub, held], { input: src, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const hl = fs.readFileSync(held, "utf8").split("\n").filter(Boolean);
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
  await assert.rejects(run({ nodes: [node(wd), other], prev, out, log: quiet }), /disagree on the players/);
  const otherQ = node(wd, (m, r) => { if (m === "get_question" && r.question?.week === "4") r.question.outcome = 2; return r; });
  await assert.rejects(run({ nodes: [node(wd), otherQ], prev, out, log: quiet }), /disagree on the week's questions/);
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

test("questions recorder: past the results deadline it stops recording", async () => {
  const wd = world(); wd.time = G + 5 * WK + 3 * DAY + 1;
  const { prev, out } = dirs();
  assert.equal((await run({ nodes: [node(wd), node(wd)], prev, out, log: quiet })).state, "past-due");
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
