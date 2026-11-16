// Block Golf's Clubhouse hole (owner, 6 Nov; accumulating, 15 Nov; claude/golf/CLUBHOUSE-BUILD-PLAN-2026-11-15.md):
// a hole scored by how many different Knode Games features a wallet has used. Each feature is earned once, the first
// week it is seen, and kept for good. Strokes come from a fixed ladder of the features earned by the end of the week.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const { run, loadClub, growClub, CLUB_SOURCE, JOIN_FROM } = await import(path.resolve(APP, "bot/games/golf.ts"));
const G = globalThis.KGolf, M = globalThis.KRaceMath;
const H = 3600000, DAY = 24 * H;
const W = 3, START = M.weekStart(W), END = M.weekStart(W + 1);
process.env.CHECK_NOW_MS ??= String(END + 7 * DAY);
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const write = (dir, name, j) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof j === "string" ? j : JSON.stringify(j)); };
const P = Array.from({ length: 8 }, (_, i) => "1" + "ABCDEFGHJKLMNPQRSTUVWXYZ"[i].repeat(33));
const Q = (w) => ({ closed: true, questions: 2, resolved: 2, rows: P.slice(0, 6).map((a, i) => ({ a, pts: 10 - i, answered: 2 })) });
const SRC = [{ id: "questions", name: "Daily Questions", reader: "questions", live: true }, CLUB_SOURCE];
const prevWith = ({ club, course = { questions: W, clubhouse: W }, weeks = [], files = {} } = {}) => {
  const d = tmp("golf-prev-");
  write(d, "index.json", { v: 1, updated: "", weeks, course, stakedFromWeek: null });
  if (club) write(d, "clubhouse.json", club);
  for (const [f, j] of Object.entries(files)) write(d, f, j);
  return d;
};
const base = (o) => ({ sources: SRC, questionsOf: async (_n, w) => Q(w), p: "main", check: "check", stakedFromWeek: null, fresh: false,
  deskOf: async () => ({ total: 0, accounts: [] }), vaultOf: async () => new Map(), ...o });
const club = (out) => JSON.parse(fs.readFileSync(path.join(out, "clubhouse.json"), "utf8"));
const week = (out, w = W) => JSON.parse(fs.readFileSync(path.join(out, `W${String(w).padStart(3, "0")}.json`), "utf8"));
const hole = (out, w = W) => week(out, w).holes.find((h) => h.id === "clubhouse");

test("the ladder: 0 = lost ball, 1 = 6, 2 = 5, 3-4 = par, 5-6 = 3, 7-8 = 2, 9+ = hole in one", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15].map(G.clubStrokes), [7, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  const s = G.scoreClub([{ a: P[0], score: 3, scored: true, ranked: true }, { a: P[1], score: 9, scored: true, ranked: true }]);
  assert.equal(s.skipped, false);                                   // never skipped for a small field
  assert.equal(s.results[P[0]].strokes, 4); assert.equal(s.results[P[1]].strokes, 1);
  assert.equal(G.scoreHoleFor("clubhouse", [{ a: P[0], score: 1, scored: true, ranked: true }]).results[P[0]].strokes, 6);
  assert.equal(G.COURSE_ORDER.at(-1), "clubhouse"); assert.equal(JOIN_FROM.clubhouse, 6);
});

test("a card with the Clubhouse: the mulligan can drop it like any hole", () => {
  const holes = [{ id: "questions", skipped: false, results: { [P[0]]: { place: 1, of: 3, strokes: 1 } } },
    { id: "clubhouse", skipped: false, results: { [P[0]]: { place: 1, of: null, strokes: 6 } } },
    { id: "race", skipped: false, results: { [P[0]]: { place: 2, of: 3, strokes: 4 } } }];
  const c = G.card(holes, P[0]);
  assert.equal(c.mulligan, "clubhouse"); assert.equal(c.strokes, 5);
});

test("features are earned once and stamped with the week first seen; the record only grows", () => {
  const problems = [];
  const a = growClub(null, new Map([["swap", new Set([P[0]])], ["name", new Set([P[0], P[1]])]]), 3, END, problems);
  assert.deepEqual(a.wallets[P[0]], { name: 3, swap: 3 });
  const b = growClub(a, new Map([["swap", new Set([P[0]])], ["staked", new Set([P[0]])]]), 5, END, problems);
  assert.deepEqual(b.wallets[P[0]], { name: 3, staked: 5, swap: 3 });   // swap keeps week 3; doing it again adds nothing
  const c = growClub(b, new Map(), 6, END, problems);                    // nothing seen: nothing removed
  assert.deepEqual(c.wallets, b.wallets);
});

test("a run collects every feature it can read and writes the record; the hole counts the features by the week", async () => {
  const names = tmp("names-"); write(names, "names.json", { v: 1, nicknames: { [P[2]]: "two" } });
  const vhp = tmp("vhp-"); write(path.join(vhp, "h"), "100.json", { v: 1, addrs: [P[3], P[7]], sig: [0, 0, 0] });
  const games = tmp("games-"); write(path.join(games, "blockx"), "board.json", { v: 1, week: { week: W, start: START, rows: [{ a: P[4], pts: 1, days: 3, ranked: true }, { a: P[5], pts: 1, days: 2, ranked: true }] }, lastWeek: null });
  // Last week's recorded holes (a week keeps the holes it was first recorded with, so this week is fresh).
  const prev = prevWith({ club: { v: 1, updated: "", wallets: { [P[0]]: { name: 1, swap: 2 } } }, weeks: [W - 1], course: { questions: W - 1, clubhouse: W },
    files: { "W002.json": { v: 1, week: W - 1, start: M.weekStart(W - 1), end: START, final: true, practice: true, holes: [{ id: "questions", name: "Daily Questions", status: "live", why: "", field: 6, rows: P.slice(0, 6).map((a, i) => [a, 10 - i, 1, 1]) }], cards: [], notFree: [], check: null } } });
  const out = tmp("golf-");
  const r = await run(base({ now: START + 3 * DAY, prev, out, namesDir: names, vhpDir: vhp, gamesDir: games,
    deskOf: async () => ({ total: 7, accounts: [P[1]] }), vaultOf: async (_n, who) => new Map(who.map((a) => [a, { staked: a === P[0], games: a === P[0] ? 2 : 0, claimed: false }])) }));
  const c = club(out).wallets;
  assert.deepEqual(c[P[0]], { name: 1, "play-questions": W, staked: W, swap: 2, "two-games": W });
  assert.equal(c[P[1]].swap, W); assert.equal(c[P[2]].name, W); assert.equal(c[P[3]].producer, W);
  assert.equal(c[P[4]]["blockx-3-days"], W); assert.equal(c[P[5]]["blockx-3-days"], undefined);
  assert.equal(c[P[7]], undefined, "a producer key in addrs that signed nothing earns nothing");
  const h = hole(out);
  assert.equal(h.status, "live");
  assert.equal(h.rows.find((x) => x[0] === P[0])[1], 5);           // name, swap, play-questions, staked, two-games
  assert.equal(club(out).desk, 7);
  assert.deepEqual(r.problems.filter((p) => p.startsWith("clubhouse")), []);
});

test("a finished week's Clubhouse is final, and a feature seen after it counts only from the next week", async () => {
  const prev = prevWith({ club: { v: 1, updated: "", wallets: Object.fromEntries(P.slice(0, 4).map((a) => [a, { name: 1, swap: 2, staked: W }])) } });
  const mid = tmp("golf-"), out = tmp("golf-");
  const o = { deskOf: async () => ({ total: 1, accounts: [P[0]] }), vaultOf: async (_n, who) => new Map(who.map((a) => [a, { staked: true, games: 0, claimed: true }])) };
  await run(base({ ...o, now: END + 20 * H, prev, out: mid }));
  await run(base({ ...o, now: END + 21 * H, prev: mid, out }));
  const h = hole(out, W);
  assert.equal(h.status, "final");
  assert.equal(h.rows.find((x) => x[0] === P[0])[1], 3);           // claimed (seen in week 4) is not in week 3
  assert.equal(club(out).wallets[P[0]].claimed, W + 1);
  const wf = week(out, W);
  assert.equal(wf.final, true);
  const card = wf.cards.find((x) => x.a === P[0]);
  assert.deepEqual(card.holes.find((x) => x[0] === "clubhouse"), ["clubhouse", 4, 3, null]);   // 3 features = par
});

test("a feature that can't be read is said aloud and tried again; nothing earned is lost", async () => {
  const prev = prevWith({ club: { v: 1, updated: "", wallets: { [P[0]]: { name: 1, swap: 2 } } } });
  const out = tmp("golf-");
  const r = await run(base({ now: START + DAY, prev, out, deskOf: async () => { throw new Error("node down"); }, namesDir: tmp("empty-") }));
  assert.equal(club(out).wallets[P[0]].swap, 2); assert.equal(club(out).wallets[P[0]].name, 1);
  assert.ok(r.problems.some((p) => /clubhouse swap desk: node down/.test(p)));
  assert.ok(r.problems.some((p) => /clubhouse @names: names.json can't be read/.test(p)));
});

test("two nodes that disagree add nothing from that source", async () => {
  const out = tmp("golf-");
  const r = await run(base({ now: START + DAY, prev: prevWith(), out, deskOf: async (n) => ({ total: 1, accounts: n === "main" ? [P[0]] : [P[1]] }) }));
  assert.equal(club(out).wallets[P[0]]?.swap, undefined); assert.equal(club(out).wallets[P[1]]?.swap, undefined);
  assert.ok(r.problems.some((p) => /swap desk: the two nodes don't agree/.test(p)));
});

test("more than 20 swaps since the last run is reported (the desk keeps only its newest 20)", async () => {
  const out = tmp("golf-");
  const r = await run(base({ now: START + DAY, prev: prevWith({ club: { v: 1, updated: "", wallets: {}, desk: 5 } }), out, deskOf: async () => ({ total: 40, accounts: [P[0]] }) }));
  assert.ok(r.problems.some((p) => /35 swaps since the last run/.test(p)));
  assert.equal(club(out).desk, 40);
});

test("vault facts are read for a few players a run (the budget), only for those still missing one", async () => {
  const asked = [];
  const prev = prevWith({ weeks: [W], club: { v: 1, updated: "", wallets: { [P[0]]: { staked: 1, "two-games": 1, claimed: 1 } } },
    files: { "W003.json": { v: 1, week: W, start: START, end: END, final: false, practice: true, holes: [{ id: "questions", name: "Daily Questions", status: "live", why: "", field: 6, rows: P.slice(0, 6).map((a, i) => [a, 10 - i, 1, 1]) }], cards: [], notFree: [], check: null } } });
  await run(base({ now: START + DAY, prev, out: tmp("golf-"), clubBudget: 2, vaultOf: async (_n, who) => { asked.push(who); return new Map(); } }));
  assert.equal(asked.length, 2);                                     // main and check
  assert.equal(asked[0].length, 2); assert.ok(!asked[0].includes(P[0]));
});

test("a record that is there but can't be read stops the run (never a fresh start)", async () => {
  const prev = prevWith(); write(prev, "clubhouse.json", "{broken");
  await assert.rejects(() => run(base({ now: START + DAY, prev, out: tmp("golf-") })), /clubhouse.json is there but can't be read/);
  const p2 = prevWith({ club: { v: 1, updated: "", wallets: { [P[0]]: { "Bad Feature": 1 } } } });
  assert.throws(() => loadClub(p2), /bad feature/);
});

test("the Clubhouse joins like a game: not before its join week", async () => {
  const out = tmp("golf-");
  await run(base({ now: START + DAY, prev: prevWith({ course: { questions: W } }), out }));
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, "index.json"), "utf8")).course.clubhouse, Math.max(W + 1, 6));
  assert.equal(hole(out), undefined);
});

// ── the publish job's own checks (taken from golf.yml), on what the recorder writes ──
import { execFileSync } from "node:child_process";
function checks() {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/golf.yml"), "utf8");
  return [...y.matchAll(/<<'PY'\n([\s\S]*?)\n\s*PY\n/g)].map((m) => {
    const f = path.join(tmp("chk-"), "check.py");
    fs.writeFileSync(f, m[1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n"));
    return f;
  });
}
const py = (args, now) => execFileSync("python3", args, { encoding: "utf8", stdio: "pipe", env: { ...process.env, CHECK_NOW_MS: String(now) } });
const copyDir = (from) => { const d = tmp("copy-"); fs.cpSync(from, d, { recursive: true }); return d; };
const edit = (dir, f, fn) => { const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); fn(j); fs.writeFileSync(path.join(dir, f), JSON.stringify(j) + "\n"); };
async function finalWeek() {
  const prev = prevWith({ club: { v: 1, updated: "", wallets: Object.fromEntries(P.slice(0, 5).map((a, i) => [a, { name: 1, swap: 2, ...(i < 2 ? { staked: W } : {}) }])) } });
  const mid = tmp("golf-"), out = tmp("golf-");
  const o = { deskOf: async () => ({ total: 3, accounts: [P[6]] }) };
  await run(base({ ...o, now: END + 20 * H, prev, out: mid }));
  await run(base({ ...o, now: END + 21 * H, prev: mid, out }));
  return { mid, out };
}

test("the publish job accepts the recorder's Clubhouse files and re-scores the hole by the ladder", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [shape, history] = checks();
  const { mid, out } = await finalWeek();
  assert.equal(week(out).final, true);
  assert.match(py([shape, out], END + 22 * H), /golf files ok/);
  assert.match(py([history, out, mid], END + 22 * H), /golf history ok/);
  // A Clubhouse row that doesn't match the record is refused.
  const b1 = copyDir(out); edit(b1, "W003.json", (j) => { j.holes.find((h) => h.id === "clubhouse").rows[0][1] += 1; });
  assert.throws(() => py([shape, b1], END + 22 * H), /scorecards don't match|Clubhouse hole doesn't match/);
  // A record with an extra feature for an ended week is refused by the shape check (the hole no longer matches).
  const b2 = copyDir(out); edit(b2, "clubhouse.json", (j) => { j.wallets[P[0]].producer = W; });
  assert.throws(() => py([shape, b2], END + 22 * H), /Clubhouse hole doesn't match/);
  // A bad feature name, or a week from the future, is refused.
  const b3 = copyDir(out); edit(b3, "clubhouse.json", (j) => { j.wallets[P[0]]["Bad Name"] = W + 1; });
  assert.throws(() => py([shape, b3], END + 22 * H), /clubhouse.json: wallets/);
});

test("the publish job's history check: an earned feature can't be removed or restamped, and a new one is this week's", async (t) => {
  try { execFileSync("python3", ["--version"]); } catch { t.skip("no python3 here"); return; }
  const [, history] = checks();
  const { mid, out } = await finalWeek();
  const gone = copyDir(out); edit(gone, "clubhouse.json", (j) => { delete j.wallets[P[0]].name; });
  assert.throws(() => py([history, gone, mid], END + 22 * H), /can't be removed or restamped/);
  const moved = copyDir(out); edit(moved, "clubhouse.json", (j) => { j.wallets[P[0]].name = 2; });
  assert.throws(() => py([history, moved, mid], END + 22 * H), /can't be removed or restamped/);
  const back = copyDir(out); edit(back, "clubhouse.json", (j) => { j.wallets[P[7]] = { swap: W - 2 }; });
  assert.throws(() => py([history, back, mid], END + 22 * H), /must be stamped with this week/);
  const lost = copyDir(out); fs.rmSync(path.join(lost, "clubhouse.json"));
  assert.throws(() => py([history, lost, mid], END + 22 * H), /published before and is missing now/);
  const desk = copyDir(out); edit(desk, "clubhouse.json", (j) => { j.desk = 0; });
  assert.throws(() => py([history, desk, mid], END + 22 * H), /swap count can't go down/);
});

test("only the week's players play the Clubhouse: features alone never make a scorecard", async () => {
  const outsider = "1" + "Z".repeat(33);
  const prev = prevWith({ club: { v: 1, updated: "", wallets: { [outsider]: { name: 1, swap: 1, producer: 1 }, [P[0]]: { name: 1 } } } });
  const out = tmp("golf-");
  await run(base({ now: START + DAY, prev, out }));
  const h = hole(out);
  assert.ok(h.rows.some((r) => r[0] === P[0]));
  assert.ok(!h.rows.some((r) => r[0] === outsider), "a wallet that played no game this week has no Clubhouse row");
  assert.ok(!week(out).cards.some((c) => c.a === outsider));
  assert.ok(club(out).wallets[outsider], "its features are still kept");
});
