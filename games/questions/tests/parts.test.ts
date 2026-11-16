// Daily Questions on KG parts v1 (games/questions/parts.inline.mjs, from vault week 6): encode / decode, the recorder's
// parts weeks, and the publish job's REAL checks cut from .github/workflows/games.yml (the embedded kit/parts check,
// then the Python recompute), run by run, as the workflow would.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as kit from "../../../kit/parts/parts.inline.mjs";
import { encodeWeek, decodeWeek, useKitParts, FULL, PARTS_FROM_WEEK } from "../parts.inline.mjs";
import { run, buildWeek, readSnapshot, type Node } from "../recorder.ts";
import { scoreWeek } from "../math.js";
useKitParts(kit);
const PYTHON = process.platform === "win32" ? "python" : "python3";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const G = 1792368000000, DAY = 86400000, WK = 7 * DAY, H = 3600000;
const W = 6, S = G + W * WK;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const fake = (i: number) => { const h = crypto.createHash("sha256").update(`qp${i}`).digest(); let s = "1"; for (let k = 0; k < 33; k++) s += B58[h[k % 32] % 58]; return s; };
const quiet = () => {};

// A week-6 world: 8 questions over Monday and Tuesday, n players (the first `staked` of them staked).
type World = { time: number; questions: Record<number, any>; players: any[]; next: number };
function world(n = 40, staked = 10): World {
  const questions: Record<number, any> = {};
  questions[300] = { week: String(W - 1), outcome: 1, lock_time: String(S - DAY) };
  for (let i = 0; i < 8; i++) questions[301 + i] = { week: String(W), outcome: 1 + (i % 3), lock_time: String(S + (i < 4 ? 12 : 24) * H + Math.floor(i / 4) * DAY) };
  const players = [];
  for (let p = 0; p < n; p++) {
    // answers in a scrambled order (the chain keeps the order they were sent); some players skip a question
    const answers = [];
    for (let i = 7; i >= 0; i--) if ((p + i) % 5 !== 0) answers.push({ question_id: 301 + i, option: (p * 7 + i) % 3 });
    const st = p < staked ? String(100000000 * (1 + p)) : "0";
    players.push({ address: fake(p), entry: { stake: st, peak_stake: st, voided: p === 3, answers } });
  }
  return { time: S + WK + 2 * H, questions, players, next: 309 };
}
function node(wd: World): Node {
  return {
    async read(m: string, a: any = {}) {
      if (m === "get_state") return { time: String(wd.time), config: { genesis_time: String(G), week_length: String(WK), min_stake: "100000000", q60_rule_week_plus_one: "5" }, totals: { next_question_id: wd.next } };
      if (m === "get_question") return { question: wd.questions[a.id] };
      if (m === "list_players") {
        const xs = [...wd.players].sort((u, v) => (u.address < v.address ? -1 : 1));
        const i = a.start ? xs.findIndex((x) => x.address === a.start) + 1 : 0;
        return { rows: xs.slice(i, i + (a.limit ?? 50)) };
      }
      throw new Error(`unexpected read ${m}`);
    },
  };
}
const listAll = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort() : []);
const j = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

/** A script cut from games.yml: the lines after `start`, up to the line `end`, de-indented. */
function cut(start: string, end: string) {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split(/\r?\n/);
  const a = y.findIndex((l) => l.includes(start));
  assert.ok(a >= 0, `games.yml has no line with ${start}`);
  const e = y.findIndex((l, i) => i > a && l.trim() === end);
  return y.slice(a + 1, e).map((l) => l.replace(/^ {10}/, "")).join("\n");
}
const GLUE = () => cut(`node --input-type=module - "$IN/questions" "$PUB/questions" "$DEC" "$HELD" <<'QPARTS'`, "QPARTS");
const PY = () => cut(`/usr/bin/python3 - "$IN/questions" "$PUB/questions" "$HELD" "$DEC" <<'PY'`, "PY");

/** The publish job for Daily Questions: the parts check, the Python check, then what isn't held is published (folders whole). */
function publish(out: string, pub: string, now: number) {
  const root = path.dirname(pub);
  const held = path.join(root, `held-${now}-${Math.random()}`); fs.writeFileSync(held, "");
  const dec = fs.mkdtempSync(path.join(root, "dec-"));
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true });
  const g = spawnSync(process.execPath, ["--input-type=module", "-", out, pub, dec, held], { input: GLUE(), encoding: "utf8" });
  assert.equal(g.status, 0, g.stderr + g.stdout);
  const p = spawnSync(PYTHON, ["-I", "-", out, pub, held, dec], { input: PY(), encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  assert.equal(p.status, 0, p.stderr + p.stdout);
  const hl = fs.readFileSync(held, "utf8").split(/\r?\n/).filter(Boolean);
  for (const f of fs.readdirSync(out)) {
    const from = path.join(out, f), to = path.join(pub, f);
    if (/^W\d{3}$/.test(f) && fs.statSync(from).isDirectory()) {
      if (hl.includes(`questions/${f}`) || !fs.existsSync(path.join(dec, "in", `${f}.json`))) continue;
      fs.rmSync(to, { recursive: true, force: true }); fs.cpSync(from, to, { recursive: true });
    }
  }
  for (const f of listAll(out).filter((x) => !/^W\d{3}\//.test(x))) {
    if (hl.includes("questions/" + f)) continue;
    const to = path.join(pub, f);
    if (/^vault\/(W|HOLD-W|RELEASE-W)\d+\.json$/.test(f) && fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(out, f), to);
  }
  return { held: hl, log: g.stdout + p.stdout };
}
async function hour(wd: World, pub: string, root: string) {
  const out = fs.mkdtempSync(path.join(root, "out-"));
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true }); fs.writeFileSync(path.join(pub, ".fetched"), "");
  const res = await run({ nodes: [node(wd), node(wd)], prev: pub, out, log: quiet });
  return { res, out, ...publish(out, pub, wd.time) };
}
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "q-parts-")); return { d, pub: path.join(d, "pub") }; };

test("parts: the format starts at vault week 6 and every part is always written", () => {
  assert.equal(PARTS_FROM_WEEK, 6);
  assert.deepEqual(FULL, ["wk", ...[..."0123456789abcdef"].map((x) => `p/${x}`)]);
});

test("parts: a snapshot decodes back to exactly the old players list, so the scores are the same", async () => {
  const wd = world(200, 50);
  const s = await readSnapshot(node(wd), W);
  const enc = encodeWeek(s);
  assert.deepEqual(enc.map((p: any) => p.part), FULL);
  const back = decodeWeek(enc.map((p: any) => ({ part: p.part, ...kit.decodePart(p.text) })), W);
  assert.deepEqual(back.questions, s.questions);
  assert.deepEqual(back.players, s.players);
  assert.deepEqual(scoreWeek({ week: { start: back.start }, questions: back.questions, players: back.players, min: back.min }), scoreWeek({ week: { start: s.start }, questions: s.questions, players: s.players, min: s.min }));
  // the snapshot lists each player's answers in question order (the chain's order was scrambled)
  for (const p of s.players) assert.deepEqual(p[4], [...p[4]].sort((x: any, y: any) => x[0] - y[0]));
});

test("parts: what the encoder refuses (it never stores a week it can't give back exactly)", async () => {
  const s: any = await readSnapshot(node(world(5, 1)), W);
  const bad = (f: (x: any) => void, re: RegExp) => { const c = structuredClone(s); f(c); assert.throws(() => encodeWeek(c), re); };
  bad((c) => c.players[0][4].push([999, 0]), /isn't in week 6/);
  bad((c) => c.players[0][4].push([...c.players[0][4][c.players[0][4].length - 1]]), /question order, or two answers/);
  bad((c) => { c.players[0][4][0][1] = 16; }, /option 16 out of range/);
  bad((c) => c.players.reverse(), /not by address/);
  bad((c) => { c.questions = [c.questions[1], c.questions[0], ...c.questions.slice(2)]; }, /id order/);
});

test("parts: the decoder refuses a player in the wrong shard, a missing part, a bad answer string", async () => {
  const s: any = await readSnapshot(node(world(30, 5)), W);
  const enc = encodeWeek(s);
  const dec = () => enc.map((p: any) => ({ part: p.part, ...kit.decodePart(p.text) }));
  assert.throws(() => decodeWeek(dec().slice(1), W), /needs exactly the parts/);
  const moved = dec();
  const from = moved.find((p: any) => p.part !== "wk" && p.rows.length)!, to = moved.find((p: any) => p.part !== "wk" && p !== from)!;
  to.rows.push(from.rows.pop());
  assert.throws(() => decodeWeek(moved, W), /not its own/);
  const longer = dec(); const sh = longer.find((p: any) => p.part !== "wk" && p.rows.length)!; sh.rows[0].ans += "0";
  assert.throws(() => decodeWeek(longer, W), /wrong length/);
  const letter = dec(); const sh2 = letter.find((p: any) => p.part !== "wk" && p.rows.length)!; sh2.rows[0].ans = "z" + sh2.rows[0].ans.slice(1);
  assert.throws(() => decodeWeek(letter, W), /is not an option/);
  const none = dec(); const sh3 = none.find((p: any) => p.part !== "wk" && p.rows.length)!; sh3.rows[0].ans = ".".repeat(sh3.rows[0].ans.length);
  assert.throws(() => decodeWeek(none, W), /no answers/);
});

test("parts recorder + publish: pending, final after a second matching run an hour later, then never changed", async () => {
  const wd = world(), { d, pub } = tmp();
  let h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending");
  assert.deepEqual(h.held, [], h.log);
  assert.ok(!fs.existsSync(path.join(pub, "W006.json")), "no single week file from week 6");
  const m1 = j(path.join(pub, "W006/manifest.json"));
  assert.equal(m1.state, "pending");
  assert.deepEqual(m1.expect, FULL);
  assert.deepEqual(m1.meta.seen, { hash: m1.hash, at: wd.time });
  assert.equal(listAll(path.join(pub, "W006")).length, 18);
  const b = j(path.join(pub, "board.json"));
  assert.equal(b.v, 2);
  assert.ok(b.lastWeek.rows.length > 0 && b.lastWeek.rows.every((r: any) => Object.keys(r).join(",") === "a,place,pts,ranked"), "Staked rows only, four columns");
  wd.time += 61 * 60000;
  h = await hour(wd, pub, d);
  assert.equal(h.res.state, "final");
  assert.deepEqual(h.held, [], h.log);
  const m2 = j(path.join(pub, "W006/manifest.json"));
  assert.equal(m2.state, "final");
  assert.equal(m2.hash, m1.hash);
  assert.deepEqual(m2.meta.seen, m1.meta.seen);
  const v = j(path.join(pub, "vault/W6.json"));
  const s = await readSnapshot(node(wd), W);
  const r = scoreWeek({ week: { start: s.start }, questions: s.questions, players: s.players, min: s.min });
  assert.deepEqual(v, { game: 1, week: 6, final: true, rows: r.vault.rows, first: r.vault.first, second: r.vault.second });
  const before = listAll(path.join(pub, "W006")).map((f) => fs.readFileSync(path.join(pub, "W006", f), "utf8"));
  wd.time += H;
  h = await hour(wd, pub, d);
  assert.equal(h.res.state, "final");
  assert.deepEqual(h.held, []);
  assert.deepEqual(listAll(path.join(pub, "W006")).map((f) => fs.readFileSync(path.join(pub, "W006", f), "utf8")), before, "a final folder never changes");
});

test("parts recorder + publish: a changed snapshot restarts the hour and the old parts go in the same publish", async () => {
  const wd = world(), { d, pub } = tmp();
  await hour(wd, pub, d);
  const firstNames = listAll(path.join(pub, "W006"));
  wd.time += 2 * H; wd.players.push({ address: fake(999), entry: { stake: "0", peak_stake: "0", voided: false, answers: [{ question_id: 301, option: 0 }, { question_id: 302, option: 1 }] } });
  const h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending", "a new snapshot is seen now, so not final yet");
  assert.deepEqual(h.held, [], h.log);
  const now = listAll(path.join(pub, "W006"));
  assert.equal(now.length, 18, "exactly 18 files: the replaced shard's old part is gone");
  assert.notDeepEqual(now, firstNames);
});

test("parts publish: a final that would change, a tampered part, a single W006.json are held (with an alert)", async () => {
  const wd = world(), { d, pub } = tmp();
  await hour(wd, pub, d); wd.time += 61 * 60000; await hour(wd, pub, d);
  assert.equal(j(path.join(pub, "W006/manifest.json")).state, "final");
  // 1) the chain reads differently after the week went final: the recorder stops, nothing goes out
  const wd2 = structuredClone(wd); wd2.time += H; wd2.questions[305].outcome = 1000;
  await assert.rejects(run({ nodes: [node(wd2), node(wd2)], prev: pub, out: fs.mkdtempSync(path.join(d, "o-")), log: quiet }), /is final, but the chain now reads differently/);
  // 2) an incoming copy of the final week with one part's bytes changed
  const out = fs.mkdtempSync(path.join(d, "o-"));
  fs.cpSync(path.join(pub, "W006"), path.join(out, "W006"), { recursive: true });
  const shard = listAll(path.join(out, "W006")).find((f) => f.startsWith("p/"))!;
  fs.appendFileSync(path.join(out, "W006", shard), " ");
  let r = publish(out, pub, wd.time + H);
  assert.ok(r.held.includes("questions/W006") && r.held.includes("!alert"), r.log);
  // 3) a week from 6 on as one file
  const out2 = fs.mkdtempSync(path.join(d, "o-"));
  const s = await readSnapshot(node(wd), W);
  const one = buildWeek(s, null, wd.time).file;
  fs.writeFileSync(path.join(out2, "W006.json"), JSON.stringify(one) + "\n");
  r = publish(out2, pub, wd.time + H);
  assert.ok(r.held.includes("questions/W006.json") && r.held.includes("!alert"), r.log);
});

test("parts publish: a pending folder for a week that isn't the one that just ended is held", async () => {
  const wd = world(), { d, pub } = tmp();
  const out = fs.mkdtempSync(path.join(d, "o-"));
  fs.mkdirSync(path.join(pub, "vault"), { recursive: true }); fs.writeFileSync(path.join(pub, ".fetched"), "");
  await run({ nodes: [node(wd), node(wd)], prev: pub, out, log: quiet });
  const r = publish(out, pub, wd.time + 2 * WK);        // two weeks later by the job's clock
  assert.ok(r.held.includes("questions/W006") && r.held.includes("!alert"), r.log);
  assert.ok(!fs.existsSync(path.join(pub, "W006")));
});

test("parts: weeks before 6 keep the old single file", async () => {
  const wd = world(); for (const q of Object.values(wd.questions)) q.week = String(Number(q.week) - 2);
  wd.time -= 2 * WK;                                                   // the same week shape, as vault week 4
  for (const q of Object.values(wd.questions)) q.lock_time = String(Number(q.lock_time) - 2 * WK);
  const { d, pub } = tmp();
  const h = await hour(wd, pub, d);
  assert.equal(h.res.state, "pending");
  assert.ok(fs.existsSync(path.join(pub, "W004.json")) && !fs.existsSync(path.join(pub, "W004")));
  assert.equal(j(path.join(pub, "board.json")).v, 1);
});

test("parts: sizes at 9,000 weekly players answering all 48 questions stay under 60% of 2 MB per file", () => {
  const qs: any[] = []; for (let i = 0; i < 48; i++) qs.push([1000 + i, 1 + (i % 4), S + Math.floor(i / 8) * DAY + (i % 8 < 4 ? 12 : 24) * H]);
  const players: any[] = [];
  for (let i = 0; i < 9000; i++) { const st = String(100000000 * (1 + (i % 500))); players.push([fake(i), st, st, 0, qs.map(([id], k) => [id, (i + k) % 4])]); }
  players.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const s: any = { week: W, start: S, end: S + WK, min: "100000000", shared: true, time: S + WK + H, questions: qs, players };
  const enc = encodeWeek(s);
  for (const p of enc) assert.ok(p.bytes < kit.WARN_BYTES, `${p.part} is ${p.bytes} bytes`);
  const { board } = buildWeek(s, null, s.time);
  const bb = Buffer.byteLength(JSON.stringify(board) + "\n");
  assert.ok(bb < kit.WARN_BYTES, `board.json is ${bb} bytes with every player staked`);
});

test("parts: the publish job's embedded copy is today's kit/parts and parts.inline.mjs", () => {
  execFileSync(process.execPath, [path.join(APP, "tools/questions-parts-embed.mjs"), "--check"], { encoding: "utf8" });
});

test("parts: the publish job's Python switches at the same week as the recorder (Repo Lens #H-2, I-3)", () => {
  const m = PY().match(/^PARTS_FROM = (\d+)$/m);
  assert.ok(m, "the Python check has PARTS_FROM");
  assert.equal(Number(m![1]), PARTS_FROM_WEEK);
});

test("parts: the embed tool refuses any import that isn't node:fs, node:path or node:crypto (Repo Lens #H-2, I-1)", async () => {
  const { allowedOnly } = await import("../../../tools/questions-parts-embed.mjs");
  assert.equal(allowedOnly('import fs from "node:fs";\nimport path from "node:path";'), true);
  for (const bad of ['import x from "./y.mjs";', 'import "./side.mjs";', 'export { a } from "./b.mjs";', 'import {\n  a,\n  b,\n} from "../kit.mjs";', 'import os from "node:os";'])
    assert.equal(allowedOnly(bad), false, bad);
  for (const f of ["kit/parts/parts.inline.mjs", "games/questions/parts.inline.mjs"]) assert.equal(allowedOnly(fs.readFileSync(path.join(APP, f), "utf8")), true, f);
});

test("game.json keeps the 30-question week's per-producer cap at 4; the bot passes 4 x total / 30 above 30 (Repo Lens #H-2, H2-1)", () => {
  const g = JSON.parse(fs.readFileSync(path.join(APP, "game-data/game.json"), "utf8"));
  assert.equal(g.maxUsesPerWeek, 4);
  const bot = fs.readFileSync(path.join(APP, "bot/bot.ts"), "utf8");
  assert.match(bot, /Math\.ceil\(\(4 \* weekTotal\(w, cap\)\) \/ BASE_CAP\)/, "the bot's --max-uses is ceil(4 x the week's total / 30)");
});
