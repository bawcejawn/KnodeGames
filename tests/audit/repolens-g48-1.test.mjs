// Repo Lens #G-48 G48-1: the publish job accepts the seed-rule backup for a round whose ruler card its own vhp-data CAN make.
// Run from the repository root: APP=. TZ=UTC node --import tsx --test <this file>. Helpers copied from tests/audit/bracket-recorder.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));
const { scoreWeek, vaultRows, freeWinners, releaseFromEnv } = rec;
// The Vault's stakes: unless a test says otherwise, every player is staked in the Bracket
const run = (o) => rec.run({ stakedOf: async (_n, players) => players, ...o });
const M = globalThis.KRaceMath, B = globalThis.KBracketMath;
const plain = (x) => JSON.parse(JSON.stringify(x));
const H = 3600000, DAY = 24 * H;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i) => "1" + Array.from({ length: 33 }, (_, k) => B58[(i * 7 + k * (i + 3)) % 58]).join("");
const W = 3;                                   // week 3: Mon 9 Nov 2026 (16-producer rounds Wed–Sat)
const RD = (r, size = 16) => B.roundDay(W, r, size);   // the day round r is played
const T0 = B.weekStart(W) - 4 * DAY;           // the fake chain starts the Thursday before
const H0 = 40_000_000;
const T = (h) => T0 + (h - H0) * 3000;
const hAt = (t) => H0 + Math.ceil((t - T0) / 3000);

// A field of n producers with VHP n, n−1, …; the signer of block h is drawn by VHP (deterministic per height).
function fieldOf(n) { return Array.from({ length: n }, (_, i) => ({ a: addr(i), vhp: 1000 * (n - i) })); }
function signerFn(field, offline = new Set(), offFrom = 0) {
  const pick = (set) => { const tot = set.reduce((s, r) => s + r.vhp, 0); return (h) => { let x = ((Math.imul(h, 2654435761) >>> 0) / 4294967296) * tot; for (const r of set) { x -= r.vhp; if (x < 0) return r.a; } return set[set.length - 1].a; }; };
  const all = pick(field), live = pick(field.filter((r) => !offline.has(r.a)));
  const f = (h) => (h >= offFrom ? live(h) : all(h));   // the offline producers stop at height offFrom
  f.field = field;
  return f;
}
// The fake chain's VHP: each producer starts with 1,000 × its card VHP (so 4 VHP burned a block stays small), every
// block burns 4 VHP of its signer's, and moves [{ h, a, d (VHP) }] add or take VHP in block h.
const BURN = 4e8, START = (r) => r.vhp * 1000 * 1e8;
let TOP = H0;                                   // the fake head (set by headAt)
function nodeOf(signer, tamper = null, { moves = [], forkAt = null, effOff = 0 } = {}) {
  const start = new Map(signer.field.map((r) => [r.a, START(r)]));
  const signed = new Map(); let upTo = H0 - 1;   // blocks signed by each producer from H0 (cached)
  const count = (a, top) => { for (let h = upTo + 1; h <= top; h++) { const s = signer(h); signed.set(s, (signed.get(s) || [])); signed.get(s).push(h); } upTo = Math.max(upTo, top); const l = signed.get(a) || []; let lo = 0, hi = l.length; while (lo < hi) { const m = (lo + hi) >> 1; if (l[m] <= top) lo = m + 1; else hi = m; } return lo; };
  return (name) => {
    const who = (h) => (name === "check" && tamper && tamper(h) ? addr(99) : signer(h));
    const id = (h) => (forkAt !== null && name === forkAt.node && h >= forkAt.h ? "fork" : "id") + h;
    return {
      async head() { throw new Error("head is given"); },
      async blockTime(h) { return T(h); },
      async blockId(h) { return id(h); },
      async chain(from, to) {
        // the fake chain's history starts 40,000 blocks (~33 hours) before H0: last week's bracket can't be seeded
        if (from < H0 - 40_000) throw new Error(`no block ${from} on this node`);
        const out = { hs: [], ts: [], sig: [], signers: [], ids: [], deltas: [] }, ix = new Map();
        for (let h = from; h <= to; h++) {
          const a = who(h); let i = ix.get(a); if (i === undefined) { i = out.signers.length; out.signers.push(a); ix.set(a, i); }
          out.hs.push(h); out.ts.push(T(h)); out.sig.push(i); out.ids.push(id(h));
          for (const mv of moves) if (mv.h === h) out.deltas.push({ h, a: mv.a, d: mv.d * 1e8 });
          if (h >= H0) out.deltas.push({ h, a, d: -BURN });
        }
        return out;
      },
      async balance(a) {
        const v = (start.get(a) || 0) - BURN * count(a, TOP) + moves.filter((m) => m.a === a && m.h <= TOP).reduce((t, m) => t + m.d * 1e8, 0);
        // the contract's effective balance for the next block: minus what arrived in the last 19 blocks
        const eff = Math.max(0, v - moves.filter((m) => m.a === a && m.d > 0 && m.h > TOP - 19 && m.h <= TOP).reduce((t, m) => t + m.d * 1e8, 0)) + effOff;
        return { v, eff, h: TOP, id: "id" + TOP };
      },
    };
  };
}
const headAt = (t) => { const h = { height: hAt(t) + 20, time: t + 60000, lib: hAt(t), libTime: T(hAt(t)) }; TOP = h.height; return h; };
function raceDir(field, { skip = () => false, results = null } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-"));
  const card = (at) => ({ at, c: 0, blocksPerRace: 7200, fairness: null, field: field.map((r) => ({ ...r, k: 7200 * r.vhp / field.reduce((s, x) => s + x.vhp, 0), h: 1 })), paddock: [] });
  for (const w of [W - 1, W, W + 1]) {
    const races = [];
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) { const i = M.raceIndex(t); races.push({ id: M.raceId(i), start: t, end: t + M.RACE, cards: Array.from({ length: 6 }, (_, l) => (skip(t + l * H) ? null : card(t + l * H))), result: results ? results(t) : null }); }
    fs.writeFileSync(path.join(d, `W${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bracket-"));
const quiet = async (f) => { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } };
const readW = (dir, w = W) => JSON.parse(fs.readFileSync(path.join(dir, `W${String(w).padStart(3, "0")}.json`), "utf8"));
const P = (i) => addr(50 + i);
// picks for week W only (other weeks: none)
function picksOf(rows, tamper = false) { return async (node, round) => (round !== B.picksRound(W) ? [] : rows.map((r, i) => ({ ...r, number: node === "check" && tamper && i === 0 ? r.number + 1 : r.number }))); }

/** Run the recorder repeatedly at time t (carrying files forward) until nothing more gets recorded. */
async function runUntil(t, o, dir, times = 40) {   // at most 6 hours a run (audit A-2)
  let last;
  for (let i = 0; i < times; i++) last = await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(t), ...o }));
  return last;
}

// ── the publish job's shape check (.github/workflows/games.yml) accepts the recorder's files and refuses bad ones ──
import { execFileSync } from "node:child_process";
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
const pys = [...yml.matchAll(/<<'PY'\n([\s\S]*?)\n\s*PY\n/g)].map((m) => m[1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n"));
const bracketPy = pys.find((p) => p.includes("bracket check done"));
// The publish job's Bracket check: `pub` = the published branch's bracket folder (default: the same files, as if this
// run's files were already published), `now` = the job's clock (default: Monday 02:00 after the test week, final).
const NOW = B.weekStart(W + 1) + 2 * H;   // Monday 02:00 UTC after the week: final
// ruler: the owner's BRACKET_RULER_FROM_WEEK as the publish step gets it (Repo Lens #G-20 G20-1); unset by default
// (phase 2) mode: BRACKET_RULER_MODE; tl: a ruler timeline file (the tests' chain) for the card rebuild; the ruler's code is
// the repository's vhp_ruler.py (the workflow loads the embedded copy, tested byte for byte in games-ruler-embed.test)
const checkRun = (dir, { pub = dir, now = NOW, held = "", ruler = "", mode = "", tl = "" } = {}) => execFileSync("python3", ["-c", bracketPy, dir, pub, held], { stdio: "pipe", env: { ...process.env, CHECK_NOW_MS: String(now), BRACKET_RULER_FROM_WEEK: ruler, BRACKET_RULER_MODE: mode, BRACKET_RULER_PY: path.resolve(APP, "vhp_ruler.py"), BRACKET_RULER_TL: tl, BRACKET_RULER_VHP_DATA: "" } }).toString();
/** What the publish check holds (file names, and "!alert" for an email), with the held list written to a file. */
const heldOf = (dir, opt = {}) => { const f = path.join(tmp(), "held"); fs.writeFileSync(f, ""); checkRun(dir, { ...opt, held: f }); return fs.readFileSync(f, "utf8").split("\n").filter(Boolean); };
const shapeOk = (dir, opt) => { try { checkRun(dir, opt); return true; } catch (e) { if (process.env.BR_DEBUG) console.error(String(e.stdout || "") + String(e.stderr || "")); return false; } };
const RU = await import(path.resolve(APP, "bot/games/bracket-ruler.ts"));
/** A scored card as the ruler writes it (only what the Bracket reads), with fpct from fp(address, settings). */
const fakeCard = (fp) => (st) => ({ text: JSON.stringify({ ruleVersion: 4, game: st.game, round: st.round, ownRule: st.ownRule, paying: st.paying, T: st.window.L - 100,
  window: st.window, c: String(st.c), minK: st.minK, poolRule: st.poolRule, total: "1", producers: fieldOf(17).map((p) => ({ a: p.a, fpct: fp(p.a, st) })) }) + "\n" });
const underdogs = fakeCard((a) => { const i = fieldOf(17).findIndex((p) => p.a === a); return String(100000 + i * 1000); });   // lower seeds luckier
async function rulerWeekDir(extra) {
  const field = fieldOf(17), dir = tmp();
  const o = { raceDir: raceDir(field), picksContract: addr(60), nodeOf: nodeOf(signerFn(field)), picksOf: picksOf([{ player: P(1), number: 5, time: 1 }, { player: P(2), number: 2 ** 20, time: 2 }]), ...extra };
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.seedTime(W) + H), ...o }));
  await quiet(() => run({ p: "main", check: "check", prev: dir, out: dir, head: headAt(B.lockTime(W) + 60000), ...o }));
  await runUntil(NOW, o, dir);
  return { dir, o };
}
const rulerFile = (dir, f) => path.join(dir, "ruler", f);

// Phase 2: the ruler's own timeline of the same fake chain (the same heights and signers; the ruler's block ids are
// 0x-hex, its own), from 10 days before H0 (the 14-day form look-back of the week's first card) to past NOW. Balances:
// START at the first block, less BURN for each block signed from H0 (as nodeOf). Real cards: RU.dayCard on it (JS), and
// the publish job rebuilds each one with vhp_ruler.py from the same timeline (BRACKET_RULER_TL).
const TL_FROM = H0 - 10 * 28800, TL_TO = hAt(NOW) + 1000;
function rulerTimeline(field = fieldOf(17)) {
  const sign = signerFn(field), n = TL_TO - TL_FROM + 1, signers = new Array(n), ids = new Array(n), deltas = [];
  const bal = new Map(field.map((r) => [r.a, BigInt(START(r))]));
  for (let i = 0; i < n; i++) {
    const h = TL_FROM + i, a = sign(h); signers[i] = a; ids[i] = "0x" + h.toString(16).padStart(16, "0");
    if (h >= H0) { deltas.push({ h, a, d: -BigInt(BURN), inc: 0n }); bal.set(a, bal.get(a) - BigInt(BURN)); }
  }
  return { from: TL_FROM, to: TL_TO, signers, ids, deltas, anchors: Object.fromEntries([...bal].map(([a, v]) => [a, { h: TL_TO, v }])), bad: [], rebuilt: [], pending: [] };
}
let _tl = null;
/** The JS ledger and the timeline's JSON file for the publish job (built once). */
function rulerTL() {
  if (_tl) return _tl;
  const tl = rulerTimeline(), file = path.join(tmp(), "tl.json");
  fs.writeFileSync(file, JSON.stringify(tl, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  return (_tl = { L: RU.R.ledger(tl), file });
}
/** The real day cards (the recorder's default, on the fake chain's ruler data). */
const realCards = (st) => RU.dayCard(rulerTL().L, st);

test("G48-1: a recorder that withholds a card it could make can't get the seed rule to decide that round", async () => {
  const lateFrom = RU.roundOf(B.roundDay(W, 2, 16));
  // the recorder says "not yet" for rounds 3-4, although the ruler's data (the same timeline the publish job reads) covers them
  const withheld = (st) => (st.round >= lateFrom ? { notYet: "vhp-data reaches block 1" } : realCards(st));
  const { dir, o } = await rulerWeekDir({ rulerFrom: String(W), dayCardOf: withheld });
  const pub = tmp(); fs.cpSync(dir, pub, { recursive: true });
  const GRACE = B.weekStart(W + 1) + 48 * H;
  await runUntil(GRACE + H, o, dir, 3);
  const wf = readW(dir);
  assert.deepEqual(wf.rulerBackup, [2, 3], "setup: the recorder used the backup for rounds 3 and 4");
  // the publish job's own vhp-data can make both cards (unflagged): prove it with the JS ruler on the same timeline
  for (const r of [2, 3]) {
    const d = wf.days[r], got = RU.dayCard(rulerTL().L, RU.settingsFor(B.roundDay(W, r, 16), d[0].from, d[23].to, null));
    assert.ok("text" in got, "setup: the ruler's data gives round " + (r + 1) + "'s card");
  }
  const hf = path.join(tmp(), "held"); fs.writeFileSync(hf, "");
  checkRun(dir, { pub, now: GRACE + 2 * H, ruler: String(W), held: hf, tl: rulerTL().file });
  const held = fs.readFileSync(hf, "utf8").split("\n").filter(Boolean);
  assert.ok(held.includes(`bracket/W00${W}.json`), "the publish job must refuse a backup for a round its own ruler data can card (held: " + JSON.stringify(held) + ")");
});
