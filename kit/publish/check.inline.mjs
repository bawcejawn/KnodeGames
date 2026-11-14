// Shared Game Kit: the publish check (GAME_KIT.md §3, RECORDER_STANDARD §3, §4, §6; D-158).
//
// ONE self-contained Node script: it imports nothing but node:fs, node:path and node:crypto. The publish job runs no
// repository code, so tools/kit-render-workflows.mjs copies this file VERBATIM into each data branch's publish job
// (a test fails if the committed workflow differs). The recorder imports the same file for its week tally, so the
// recorder and the publish job count a week with one implementation; tests compare it with each game's own math.js.
//
// It judges a recorder run's files against what is ALREADY published and against this job's own clock, never against
// the run's own claims. A file that fails is held (not published); one game's bad file holds only that game's file,
// never the job or another game (RECORDER §6.4). It writes the list of files to publish; the workflow copies only those.
//
// Week file (W<NNN>.json, one per vault week, kit format v2):
//   { v: 2, game, week, start, end, min, state: "open" | "pending" | "final", seen: { hash, at },
//     rounds:  [[id, day, fun 0|1, status "s"|"v"|"p", [[i, points] | [i, points, at], …]], …]   by id; rows by i
//     players: [[wallet, stake, peak, voided 0|1], …] }                                            by wallet
//   i = the wallet's index in `players`; `at` (the score time, D-159) only on a row with points, in ms after the week's
//   start and before its results deadline (start ≤ score time < end + 3 days; #B-12 NK-3, NK-19). About 19 bytes a
//   scored row: ~1,900 wallets answering all 60 questions fit the recorder's 1.9 MB cap (GAME_KIT.md §6 limits).
//   status: "s" scored · "v" void (nothing scores) · "p" pending (not decided yet; rows hold points 0)
//   Rows record every wallet that took part in the round (points 0 included), so the entry rule ("at least N counted
//   rounds") is re-checked here without a per-game scorer.
//   seen.hash covers what decides the week (counted rounds, their wallets, stakes, min), never Sunday fun rounds
//   (KC-5); seen.at is when a run first read that hash, and the job holds it to its own clock (KC-1).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// The job's clock, taken when this file loads (the conformance sandbox loads it before it traps the clock, #E-26 NE-4).
const KIT_NOW = Date.now.bind(Date);

export const KIT_FILE_VERSION = 2;
export const DAY = 86400000;
export const HOUR = 3600000;
export const WEEK = 7 * DAY;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;      // the publish job's cap (RECORDER §6.3)
export const RESULTS_DAYS = 3;                      // the vault takes a week's results file for 3 days (VAULT §6)
export const STABLE_MS = HOUR;                      // final once two runs at least an hour apart read the same (D-135)
export const MAX_PER_PLACE = 10;                    // the vault takes at most 10 wallets per free place
export const MAX_VAULT_POINTS = 255;
export const FUTURE_SLACK_MS = 10 * 60000;          // a recorder's "seen at" may run this far ahead of the job's clock
// How far behind the job's clock a NEW seen.at may be (KC-1), derived from the workflow's own limits (#B-12 NK-11):
//   MAX_BEHIND_MS  the chain time a recorder stamps may lag the runner's clock this much (the recorder stops beyond it);
//   JOB_WAIT_MS    from a kit record job's start to the publish job's check: the hand-written record job (≤ 30 min) and
//                  publish job (≤ 10 min) it waits for, plus 5 for its own setup. tools/kit-render-workflows.mjs refuses
//                  a workflow whose timeouts don't fit (RECORD_TIMEOUT_MIN, LEGACY_*_MAX_MIN in kit/publish/render.mjs).
export const MAX_BEHIND_MS = 15 * 60000;
export const JOB_WAIT_MS = 45 * 60000;
export const FRESH_MS = MAX_BEHIND_MS + JOB_WAIT_MS;
// A final needs its content first read at least this long ago: a pending copy is published at most FRESH_MS after its
// seen.at, so the final then comes at least an hour after the pending copy was published (D-135; #B-12 NK-8).
export const FINAL_WAIT_MS = STABLE_MS + FRESH_MS;
export const MAX_ROUNDS = 10000;                    // the recorder refuses more too (KC-11)
export const MAX_PLAYERS = 20000;                   // wallets with an entry THIS week (KC-9)
export const DATA_BRANCHES = ["games-data", "race-data", "games-data-testnet"];   // KC-23

const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const DIGITS = /^(0|[1-9][0-9]{0,30})$/;
export const isAddr = (a) => typeof a === "string" && ADDR.test(a);
export const nat = (x) => Number.isSafeInteger(x) && x >= 0;
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The recorders' own JSON form: JSON.stringify of the value plus a newline (the publish job checks exact bytes). */
export const canon = (o) => JSON.stringify(o) + "\n";
export const pad3 = (w) => String(w).padStart(3, "0");
/** A week file's name: W004 … W999, then W1000 … W9999 (KC-30). */
export const weekName = (w) => `W${pad3(w)}.json`;
const WEEK_FILE = /^W([0-9]{3}|[1-9][0-9]{3})\.json$/;
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ───────────────────────── clock ─────────────────────────
/** A game's week clock from its config ({ genesis, weekMs }). All times UTC ms. */
export function weekClock(cfg) {
  const genesis = cfg.genesis, wk = cfg.weekMs ?? WEEK;
  return {
    weekOf: (t) => Math.floor((t - genesis) / wk),
    start: (w) => genesis + w * wk,
    end: (w) => genesis + (w + 1) * wk,
    /** The vault's results deadline: end + 3 days (Kpred resultsDue: week_length / 7 × RESULTS_DAYS). */
    due: (w) => genesis + (w + 1) * wk + Math.floor(wk / 7) * RESULTS_DAYS,
  };
}
/** The UTC day a round counts for: the day its picks close in, the closing instant belonging to the day it ends
 *  (a round closing at exactly Sun 00:00 is Saturday's). */
export const dayOf = (locksAt) => Math.floor((locksAt - 1) / DAY) * DAY;
/** Sunday UTC (D-129): a day d is Sunday when (d / DAY + 4) % 7 === 0 (1 Jan 1970 was a Thursday). */
export const isSunday = (day) => (((Math.floor(day / DAY) + 4) % 7) + 7) % 7 === 0;

// ───────────────────────── the week file ─────────────────────────
export const WEEK_KEYS = ["v", "game", "week", "start", "end", "min", "state", "seen", "rounds", "players"];
export const STATES = ["open", "pending", "final"];
/** Optional keys after `players`, in this order (Fantasy Phase 1). A week file without them is unchanged (and so is
 *  its hash). inputs: sha256 of the week's write-once inputs file (FC-9); carry / next: each wallet's game state at the
 *  week's start and after its last round, [[wallet, state], …] sorted (carried state, FC-5); extras: records-only JSON
 *  (Weekly Rival). None of these is recomputed here (the publish job runs no game code): the recorder's two-node
 *  reads, the stability wait and the HOLD on a changed final guard them, and the hash covers them. */
export const WEEK_OPT_KEYS = ["inputs", "carry", "next", "extras", "cards", "fallbacks", "season"];
const FALLBACK_GRACE_MS = 48 * 3_600_000;
/** Optional keys after those, NOT in the week hash: vhpTo, the last block of the ruler data the run used (#G-69 G69-1). */
export const WEEK_META_KEYS = ["vhpTo"];
/** cards (Phase 1b, vhpData games): every VHP ruler card the file's results (or price list) used, as
 *  [settings, sha256 of the scored card's cardJson], sorted by round then sha256. Rebuilt from vhp-data by the publish
 *  job once the inline ruler copy lands (G3); until then shape only, covered by the hash. */
export const MAX_CARDS = 1000;
const CARD_SETTING_KEYS = "game,round,window,c,minK,poolRule,ownRule,paying,pooled";
// The optional mode, include and version follow, each only when set, in that order (2^3 key lists).
const CARD_SETTING_KEY_SETS = [[], ["mode"], ["include"], ["mode", "include"], ["version"], ["mode", "version"], ["include", "version"], ["mode", "include", "version"]].map((o) => [CARD_SETTING_KEYS, ...o].join());
const MAX_INCLUDE = 64;
const CARD_WINDOW_KEYS = "W0,W1,L,S0,S1";
/** The key of one card entry: its settings AND its sha256 (#G-24 G24-1), the same in the check and the rebuild list. */
export const cardKey = (s, h) => JSON.stringify(sortKeys([s, h]));
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
export function isCardList(xs) {
  if (!Array.isArray(xs) || xs.length > MAX_CARDS) return false;
  if (new Set(xs.map((x) => (Array.isArray(x) ? x[1] : null))).size !== xs.length) return false;   // G24-1: no sha256 twice
  let last = null;
  for (const x of xs) {
    if (!Array.isArray(x) || x.length !== 2 || typeof x[1] !== "string" || !/^[0-9a-f]{64}$/.test(x[1])) return false;
    const s = x[0];
    if (!s || typeof s !== "object" || Array.isArray(s) || !CARD_SETTING_KEY_SETS.includes(Object.keys(s).join())) return false;
    // Optional: the ruler's scoring mode and the kit's include list (G6), as the ruler itself checks them.
    if (s.mode !== undefined && !["A", "B", "C", "D"].includes(s.mode)) return false;
    if (s.version !== undefined && s.version !== 4 && s.version !== 5) return false;
    if (s.include !== undefined && !(Array.isArray(s.include) && s.include.length >= 1 && s.include.length <= MAX_INCLUDE && s.include.every(isAddr) && s.include.every((a, i) => i === 0 || s.include[i - 1] < a))) return false;
    if (!Number.isSafeInteger(s.game) || typeof s.round !== "string" || !/^[0-9]{1,20}$/.test(s.round) || typeof s.c !== "string" || !/^[0-9]{1,30}$/.test(s.c)) return false;
    if (!Number.isSafeInteger(s.minK) || typeof s.poolRule !== "string" || typeof s.ownRule !== "string" || typeof s.paying !== "boolean") return false;
    if (!Array.isArray(s.pooled) || s.pooled.length > 16 || !s.pooled.every(isAddr)) return false;
    const w = s.window;
    if (!w || typeof w !== "object" || Object.keys(w).join() !== CARD_WINDOW_KEYS || !Object.values(w).every((v) => Number.isSafeInteger(v) && v >= 0)) return false;
    const key = [s.round, x[1]];
    if (last !== null && (last[0] > key[0] || (last[0] === key[0] && last[1] >= key[1]))) return false;
    last = key;
  }
  return true;
}
export const MAX_STATE_BYTES = 4096;                // one wallet's carried state
export const MAX_EXTRAS_BYTES = 256 * 1024;
/** A round with its rows by wallet address: [id, day, fun, status, [[wallet, points, at], …]], `at` the absolute score
 *  time in ms (0 when no points). */
export const resolveRound = (j, r) => [r[0], r[1], r[2], r[3], r[4].map((x) => [j.players[x[0]][0], x[1], x.length === 3 ? j.start + x[2] : 0])];
/** The latest score-time offset a row may carry: before the week's results deadline (end + 3 days). */
export const atLimit = (j) => j.end - j.start + RESULTS_DAYS * DAY;
/** What decides a week's results (seen.hash): counted rounds by wallet address and the stakes of the wallets in them.
 *  Sunday fun rounds and wallets that only played them are left out (KC-5): they never change the week. */
export function weekHash(j) {
  const rounds = j.rounds.filter((r) => !r[2]).map((r) => resolveRound(j, r));
  const used = new Set(rounds.flatMap((r) => r[4].map((x) => x[0])));
  const base = [j.game, j.week, j.min, rounds, j.players.filter((p) => used.has(p[0]))];
  const opt = WEEK_OPT_KEYS.filter((k) => j[k] !== undefined).map((k) => [k, j[k]]);
  return sha256(JSON.stringify(opt.length ? [...base, opt] : base));
}
const isStateList = (xs) => {
  if (!Array.isArray(xs) || xs.length > MAX_PLAYERS) return false;
  let last = null;
  for (const x of xs) {
    if (!Array.isArray(x) || x.length !== 2 || !isAddr(x[0]) || x[1] === null || x[1] === undefined) return false;
    if (last !== null && cmp(last, x[0]) >= 0) return false;
    if (Buffer.byteLength(JSON.stringify(x[1])) > MAX_STATE_BYTES) return false;
    last = x[0];
  }
  return true;
};

/** "" when the week file is in the kit's shape for this game and name, else why not. */
export function weekShape(j, name, cfg) {
  const k = weekClock(cfg);
  if (!j || typeof j !== "object" || Array.isArray(j)) return "not an object";
  const keys = Object.keys(j);
  const opt = keys.slice(WEEK_KEYS.length), ALL_OPT = [...WEEK_OPT_KEYS, ...WEEK_META_KEYS];
  if (keys.length < WEEK_KEYS.length || !WEEK_KEYS.every((x, i) => keys[i] === x)
    || !opt.every((k, i) => ALL_OPT.includes(k) && (i === 0 || ALL_OPT.indexOf(opt[i - 1]) < ALL_OPT.indexOf(k)))) return "not the week file's keys in order";
  if (j.inputs !== undefined && !(typeof j.inputs === "string" && /^[0-9a-f]{64}$/.test(j.inputs))) return "inputs must be a sha256";
  if (!!cfg.inputsFile !== (j.inputs !== undefined)) return cfg.inputsFile ? "this game's week file must name its inputs file (FC-9)" : "inputs in a game without an inputs file";
  for (const k of ["carry", "next"]) if (j[k] !== undefined && !isStateList(j[k])) return `bad ${k} (sorted [wallet, state] pairs, each state at most ${MAX_STATE_BYTES} bytes)`;
  if ((j.carry === undefined) !== (j.next === undefined)) return "carry and next come together";
  if (!!cfg.vhpData !== (j.cards !== undefined)) return cfg.vhpData ? "a ruler game's week file must list its cards" : "cards in a game without ruler data";
  // K1: a season game's week file names its season's first week (at most seasonWeeks − 1 weeks back).
  if (!!cfg.seasonWeeks !== (j.season !== undefined)) return cfg.seasonWeeks ? "a season game's week file must name its season" : "season in a game without seasons";
  if (j.season !== undefined && !(Number.isSafeInteger(j.season) && j.season >= 0 && j.season <= j.week && j.week - j.season < cfg.seasonWeeks)) return "bad season (its first week, at most seasonWeeks − 1 weeks back)";
  if (j.vhpTo !== undefined && !(cfg.vhpData && Number.isSafeInteger(j.vhpTo) && j.vhpTo >= 0)) return cfg.vhpData ? "vhpTo must be a block number" : "vhpTo in a game without ruler data";
  if (j.cards !== undefined && !isCardList(j.cards)) return "bad cards (sorted [settings, sha256] pairs, no sha256 twice)";
  // #G-24 Info: a ruler game's decided rounds each come from a card (cardPerRound, on by default): at least as many
  // distinct cards as decided rounds.
  // K8: rounds decided by the game's fallback rule: [round, at, why], sorted, each a decided round of this file, at a
  // time at least 48 h after the week's start (the round's own end is the recorder's; the job's clock checks `at`).
  if (j.fallbacks !== undefined) {
    if (!cfg.vhpData) return "fallbacks in a game without ruler data";
    const dec = new Set(j.rounds.filter((r) => r[3] === "s" || r[3] === "v").map((r) => r[0]));
    if (!Array.isArray(j.fallbacks) || !j.fallbacks.length || j.fallbacks.length > j.rounds.length
      || !j.fallbacks.every((f, i) => Array.isArray(f) && f.length === 3 && typeof f[0] === "string" && dec.has(f[0])
        && Number.isSafeInteger(f[1]) && f[1] >= j.start + FALLBACK_GRACE_MS && typeof f[2] === "string" && f[2].length >= 1 && f[2].length <= 200
        && (i === 0 || j.fallbacks[i - 1][0] < f[0]))) return "bad fallbacks (sorted [decided round, at, why], at least 48 h after the week's start)";
  }
  if (cfg.cardPerRound && j.cards !== undefined) {
    const decided = j.rounds.filter((r) => r[3] === "s" || r[3] === "v").length - (j.fallbacks?.length ?? 0);
    if (j.cards.length < decided) return `${decided} decided rounds but only ${j.cards.length} ruler cards (cardPerRound)`;
  }
  if (j.extras !== undefined && (j.extras === null || typeof j.extras !== "object" || Buffer.byteLength(JSON.stringify(j.extras)) > MAX_EXTRAS_BYTES)) return `bad extras (an object or list, at most ${MAX_EXTRAS_BYTES} bytes)`;
  if (j.v !== KIT_FILE_VERSION || j.game !== cfg.game) return "wrong version or game";
  if (!nat(j.week) || j.week > 9999 || name !== weekName(j.week)) return "week and name don't match";
  if (j.start !== k.start(j.week) || j.end !== k.end(j.week)) return "wrong start or end for that week";
  if (typeof j.min !== "string" || !DIGITS.test(j.min)) return "min must be a decimal string";
  if (!STATES.includes(j.state)) return "unknown state";
  const s = j.seen;
  if (!s || typeof s !== "object" || Object.keys(s).join() !== "hash,at" || !/^[0-9a-f]{64}$/.test(s.hash) || !nat(s.at)) return "bad seen";
  if (!Array.isArray(j.rounds) || j.rounds.length > MAX_ROUNDS) return `bad rounds (at most ${MAX_ROUNDS})`;
  if (!Array.isArray(j.players) || j.players.length > MAX_PLAYERS) return `bad players (at most ${MAX_PLAYERS})`;
  let last = null;
  for (const p of j.players) {
    if (!Array.isArray(p) || p.length !== 4 || !isAddr(p[0]) || typeof p[1] !== "string" || !DIGITS.test(p[1])
      || typeof p[2] !== "string" || !DIGITS.test(p[2]) || (p[3] !== 0 && p[3] !== 1)) return "bad player row";
    if (last !== null && cmp(last, p[0]) >= 0) return "players not sorted or repeated";
    last = p[0];
  }
  let lastId = null;
  for (const r of j.rounds) {
    if (!Array.isArray(r) || r.length !== 5) return "bad round";
    const [id, day, fun, st, rows] = r;
    if (typeof id !== "string" || !/^[A-Za-z0-9._:-]{1,40}$/.test(id)) return "bad round id";
    if (lastId !== null && cmp(lastId, id) >= 0) return "rounds not sorted or repeated";
    lastId = id;
    if (!nat(day) || day % DAY !== 0 || day < j.start || day >= j.end) return `round ${id}: its day is not in the week`;
    if (fun !== (cfg.sundayFunRound && isSunday(day) ? 1 : 0)) return `round ${id}: fun flag must follow its day (D-129)`;
    if (!["s", "v", "p"].includes(st)) return `round ${id}: bad status`;
    if (!Array.isArray(rows)) return `round ${id}: bad rows`;
    let lw = -1;
    for (const x of rows) {
      if (!Array.isArray(x) || !nat(x[0]) || x[0] >= j.players.length || !nat(x[1])) return `round ${id}: bad row`;
      if (x.length !== (x[1] > 0 ? 3 : 2)) return `round ${id}: a row has its score time only when it has points`;
      if (x.length === 3 && !(nat(x[2]) && x[2] < atLimit(j))) return `round ${id}: a score time outside the week's start to its results deadline`;
      if (x[0] <= lw) return `round ${id}: rows not sorted or repeated`;
      if (st !== "s" && x[1] !== 0) return `round ${id}: points in a round that isn't scored`;
      if (x[1] > (cfg.maxRoundPoints ?? 1000000)) return `round ${id}: points over the game's maximum`;
      lw = x[0];
    }
  }
  if (s.hash !== weekHash(j)) return "its hash isn't its content's";
  return "";
}

// ───────────────────────── the week tally (the generic recount) ─────────────────────────
/** Paid set by the game's rule (RECORDER §4.3, D-152). `rows`: [{a, pts, at}] staked rows with pts ≥ 1, any order.
 *  legacy-tied-whole: walk score groups down until at least ceil(30%) are in; tied groups whole (the contract's walk).
 *  d152: exactly ceil(30%); a tie across the line admits wallets by `at` (reached the score first), then address. */
export function paidSet(rows, rule) {
  const xs = rows.filter((r) => r.pts >= 1).slice().sort((u, v) => v.pts - u.pts || u.at - v.at || cmp(u.a, v.a));
  const need = Math.ceil((xs.length * 30) / 100);
  const paid = new Set();
  if (!need) return paid;
  if (rule === "legacy-tied-whole") {
    let cutoff = Infinity;
    for (let i = 0; i < xs.length; i++) { if (i >= need && xs[i].pts < cutoff) break; cutoff = xs[i].pts; paid.add(xs[i].a); }
    return paid;
  }
  if (rule === "d152") { for (let i = 0; i < need; i++) paid.add(xs[i].a); return paid; }
  throw new Error(`unknown payout rule ${rule}`);
}

/** The vault values for the staked rows (RECORDER §4.3, VAULT §6). `rows` come ordered (best first); `paid` from paidSet.
 *  points:   the row's own points (game 1: the contract refuses more points than answers, so values are real points).
 *  dense255: groups of equal (points, paid) take 255, 254, … so unpaid rows never share a paid row's value; a paid group
 *            the walk can't separate throws (no file rather than a wrong one). */
export function vaultValues(rows, paid, mode) {
  if (mode === "points") {
    for (const r of rows) if (!(r.pts >= 1 && r.pts <= MAX_VAULT_POINTS)) throw new Error(`${r.a}: ${r.pts} points can't go in a vault file (1-255)`);
    return rows.map((r) => ({ player: r.a, points: r.pts }));
  }
  if (mode !== "dense255") throw new Error(`unknown vault values ${mode}`);
  const key = (r) => `${r.pts}|${paid.has(r.a) ? 1 : 0}`;
  // Groups best first: more points first; inside equal points the paid part first (whatever order the rows came in).
  const order = [...new Set(rows.map(key))].sort((x, y) => Number(y.split("|")[0]) - Number(x.split("|")[0]) || Number(y.split("|")[1]) - Number(x.split("|")[1]));
  const vals = new Map(order.map((k, i) => [k, Math.max(1, MAX_VAULT_POINTS - i)]));
  const out = rows.map((r) => ({ player: r.a, points: vals.get(key(r)) }));
  const minPaid = Math.min(...out.filter((x) => paid.has(x.player)).map((x) => x.points));
  if (out.some((x) => !paid.has(x.player) && x.points >= minPaid)) throw new Error("more paid places than vault values: an unpaid row would share a paid value");
  return out;
}

/** A port of the contract's winners walk (Kpred finalizeGameStep): the cutoff over posted values. */
export function contractWinners(vrows) {
  const need = Math.ceil((vrows.length * 30) / 100);
  if (!need) return new Set();
  const byPts = new Map();
  let max = 0;
  for (const r of vrows) { byPts.set(r.points, (byPts.get(r.points) ?? 0) + 1); if (r.points > max) max = r.points; }
  let cum = 0, cutoff = 0;
  for (let p = max; p >= 1; p--) { cum += byPts.get(p) ?? 0; cutoff = p; if (cum >= need) break; }
  return new Set(vrows.filter((r) => cutoff >= 1 && r.points >= cutoff).map((r) => r.player));
}

/** Free 1st / 2nd (D-159, VAULT §6, D-034, D-082), for every game: the best free points take 1st, the next 2nd; ties
 *  share their place; a tie for 1st leaves 2nd empty. Up to 10 wallets a place: past 10, exactly 10 are paid, chosen by
 *  the earlier score time (`at`), then the address; a place is never left empty because of the cap, and wallets cut by
 *  it get nothing (they don't move to 2nd). Rows: [{ a, pts, at }]. */
export function freePlaces(free) {
  const pick = (xs) => xs.slice().sort((u, v) => u.at - v.at || cmp(u.a, v.a)).slice(0, MAX_PER_PLACE).map((r) => r.a).sort(cmp);
  const best = free.reduce((x, r) => Math.max(x, r.pts), 0);
  const tied = free.filter((r) => best > 0 && r.pts === best);
  const rest = free.filter((r) => r.pts < best);
  const next = rest.reduce((x, r) => Math.max(x, r.pts), 0);
  return { first: pick(tied), second: tied.length === 1 ? pick(rest.filter((r) => next > 0 && r.pts === next)) : [] };
}

/**
 * A week's tally from its week file (fun rounds out, D-129): every row the boards, the vault file and the prizes come
 * from. cfg: { payoutRule, vaultValues, entry: { minRounds, minPoints }, minPts, rowCap }.
 *   counted  = scored, non-fun rounds the wallet took part in; pts = their points; answers = every round it took part in
 *   ok       = not voided, counted ≥ entry.minRounds, pts ≥ entry.minPoints and pts ≥ 1
 *   staked   = ok, stake > 0, stake ≥ min (the vault's week stake) and pts ≥ minPts (the vault's floor)   → the vault rows
 *   free     = ok and peak < min
 *   board    = "staked" when peak ≥ min and not voided (LEADERBOARD §1), else "free"
 *   place    = 1 + the rows above it on its board: more points, or (d152) the paid part of a tie split across the line
 * The paid set is computed over the vault rows exactly as posted, and must equal the contract's own walk over the vault
 * values (Kpred finalizeGameStep); otherwise `vaultError` says why and no vault file can be made (KC-2, KC-16).
 */
export function tally(j, cfg) {
  const min = BigInt(j.min);
  const minRounds = cfg.entry?.minRounds ?? 1, minPoints = Math.max(1, cfg.entry?.minPoints ?? 1), floor = Math.max(1, cfg.minPts ?? 0);
  const acc = j.players.map(() => ({ pts: 0, counted: 0, answers: 0, at: 0 }));
  let complete = true;
  for (const [, , fun, st, rows] of j.rounds) {
    if (!fun && st === "p") complete = false;
    for (const [i, p, at = 0] of rows) {
      const x = acc[i];
      x.answers++;
      if (fun || st !== "s") continue;
      x.counted++; x.pts += p;
      if (p > 0 && j.start + at > x.at) x.at = j.start + at;
    }
  }
  const rows = [];
  j.players.forEach(([a, stakeS, peakS, voided], i) => {
    const x = acc[i];
    if (!x.answers) return;
    const pts = voided ? 0 : x.pts, counted = voided ? 0 : x.counted;
    const stake = voided ? 0n : BigInt(stakeS);
    const peak = BigInt(peakS) > stake ? BigInt(peakS) : stake;
    const ok = !voided && counted >= minRounds && pts >= minPoints;
    const staked = ok && stake > 0n && stake >= min && pts >= floor;
    const free = ok && peak < min;
    rows.push({ a, pts, counted, answers: x.answers, at: voided ? 0 : x.at, staked, free, ranked: staked, board: peak >= min && !voided ? "staked" : "free", place: 0 });
  });
  const stakedRows = rows.filter((r) => r.staked).sort((u, v) => v.pts - u.pts || cmp(u.a, v.a));
  const paid = paidSet(stakedRows, cfg.payoutRule);
  for (const b of ["staked", "free"]) {
    const xs = rows.filter((r) => r.board === b);
    // d152 can split a tie at the paid line: its paid part takes the place above the rest (KC-10). The whole-tie rule
    // never splits a tie, so its places are by points alone.
    const split = b === "staked" && cfg.payoutRule === "d152";
    const above = (o, r) => o.pts > r.pts || (split && o.pts === r.pts && paid.has(o.a) && !paid.has(r.a));
    for (const r of xs) r.place = 1 + xs.filter((o) => above(o, r)).length;
  }
  rows.sort((u, v) => (u.board === v.board ? 0 : u.board === "staked" ? -1 : 1) || u.place - v.place || cmp(u.a, v.a));
  const ordered = rows.filter((r) => r.staked);
  let vrows = [], vaultError = "";
  try {
    vrows = ordered.length ? vaultValues(ordered, paid, cfg.vaultValues) : [];
    const won = contractWinners(vrows);
    if (won.size !== paid.size || [...paid].some((a) => !won.has(a))) throw new Error(`the contract would pay ${won.size} wallets, the game's rule pays ${paid.size}`);
  } catch (e) { vrows = []; vaultError = String(e?.message ?? e); }
  const { first, second } = freePlaces(rows.filter((r) => r.free));
  const prizes = [...first.map((p) => ({ player: p, place: 1 })), ...second.map((p) => ({ player: p, place: 2 }))];
  return { complete, rows, paid, vault: { rows: vrows, first, second }, prizes, vaultError };
}

/** board.json (LEADERBOARD §1, the vault bot's board check): lastWeek with both boards. Over the game's rowCap the
 *  board keeps every ranked (vault) row and the best others up to the cap, and says how many it left out (KC-9). */
export const BOARD_MAX_BYTES = 1_500_000;           // board.json's own budget, under the recorder's 1.9 MB write cap (#B-12 NK-4)
/** board.json for week `j` from its tally. Every ranked (staked) row and every free prize winner's row is kept (NK-17);
 *  the other rows, best first, while they fit the game's rowCap (when set) and the board's byte budget. A board whose
 *  kept rows alone pass the budget is still returned: the recorder then doesn't write it and alerts (NK-4). */
export function boardOf(j, t, updated, rowCap = 0) {
  const winners = new Set(t.prizes.map((p) => p.player));
  const row = (x) => ({ a: x.a, board: x.board, place: x.place, pts: x.pts, points: x.pts, counted: x.counted, answers: x.answers, ranked: x.ranked });
  const must = (x) => x.ranked || winners.has(x.a);
  const shell = (rows, cut) => {
    const lastWeek = { week: j.week, start: j.start, final: j.state === "final", complete: t.complete, rows, prizes: t.prizes };
    if (cut) lastWeek.cut = cut;
    return { v: 1, updated, lastWeek };
  };
  let bytes = Buffer.byteLength(canon(shell([], t.rows.length || 0)));
  let room = rowCap > 0 ? Math.max(0, rowCap - t.rows.filter(must).length) : Infinity;
  for (const x of t.rows) if (must(x)) bytes += Buffer.byteLength(JSON.stringify(row(x))) + 1;
  const keep = t.rows.filter((x) => {
    if (must(x)) return true;
    if (room <= 0) return false;
    const n = Buffer.byteLength(JSON.stringify(row(x))) + 1;
    if (bytes + n > BOARD_MAX_BYTES) { room = 0; return false; }
    bytes += n; room--; return true;
  });
  return shell(keep.map(row), t.rows.length - keep.length);
}
/** alltime.json (LEADERBOARD §2 "All time", D-137, FC-16/FC-18): every published FINAL week of the game, in week
 *  order. pts = every scored round's points, Sunday fun rounds included (D-129); weeks = weeks with a row; medals only
 *  for weeks the vault was given a results file (D-034: only earners get one): gold / silver = the free 1st / 2nd
 *  paid places, earned = in the staked paid set; best = the best weekly place on either board. Rows by points, then
 *  address; trimmed to the board's byte budget (lowest first), with how many were left out. `medalWeeks`: the weeks
 *  whose vault file is published. Rebuilt the same way here and in the recorder, so it is recomputed, never trusted. */
export const ALLTIME_KEYS = ["v", "updated", "weeks", "rows"];
export function allTimeOf(finals, cfg, medalWeeks, updated) {
  const acc = new Map();
  const get = (a) => { let x = acc.get(a); if (!x) acc.set(a, x = { a, pts: 0, weeks: 0, gold: 0, silver: 0, earned: 0, best: 0 }); return x; };
  const weeks = [];
  for (const j of [...finals].sort((u, v) => u.week - v.week)) {
    if (j.state !== "final") continue;
    weeks.push(j.week);
    const t = tally(j, cfg), pts = new Map();
    for (const [, , , st, rows] of j.rounds) for (const [i, p] of rows) {
      const a = j.players[i][0];
      pts.set(a, (pts.get(a) ?? 0) + (st === "s" ? p : 0));
    }
    const medals = medalWeeks.has(j.week);
    for (const r of t.rows) {
      const x = get(r.a);
      x.weeks++; x.pts += pts.get(r.a) ?? 0;
      if (r.place > 0 && (x.best === 0 || r.place < x.best)) x.best = r.place;
    }
    if (medals) {
      for (const a of t.vault.first) get(a).gold++;
      for (const a of t.vault.second) get(a).silver++;
      for (const a of t.paid) get(a).earned++;
    }
  }
  const all = [...acc.values()].sort((u, v) => v.pts - u.pts || cmp(u.a, v.a));
  const out = { v: 1, updated, weeks, rows: [] };
  let bytes = Buffer.byteLength(canon(out)) + 32, cut = 0;
  for (const x of all) {
    const n = Buffer.byteLength(JSON.stringify(x)) + 1;
    if (bytes + n > BOARD_MAX_BYTES) { cut = all.length - out.rows.length; break; }
    bytes += n; out.rows.push(x);
  }
  if (cut) out.cut = cut;
  return out;
}

/** The week's write-once inputs file (FC-9): inputs/W<week>.json = { game, week, data }. Published before the week
 *  opens and never changed; the week file carries the sha256 of its exact bytes. */
export const inputsName = (w) => `inputs/W${w}.json`;
export const INPUTS_EARLIEST_MS = 7 * DAY;           // at most a week before the week opens

/** The vault's results file for a final week (VAULT §6): rows (staked), first and second always filled. */
export function vaultFileOf(j, t) {
  if (t.vaultError) throw new Error(`week ${j.week}: no vault file: ${t.vaultError}`);
  return { game: j.game, week: j.week, final: true, rows: t.vault.rows, first: t.vault.first, second: t.vault.second };
}

// ───────────────────────── the checks ─────────────────────────
// No leading zeros in vault names (KC-17): W4, HOLD-W4, RELEASE-W4 — never W04 or W004.
const VNUM = "(0|[1-9][0-9]{0,3})";
// ─── KG parts v1 for kit games with game.json "parts" (Capacity's kit/parts; Architecture, 14 Nov 2026) ───────────
// The week file stays the kit's one logical format (weekHash, every check below unchanged). A parts game stores it as
// the folder W<NNN>/ (manifest + content-addressed parts): one part per UTC day ("d", d1–d7) or per round ("r",
// r001…) with the rounds' rows; wk with the week-level keys; p/<x> (16 shards by SHA-256 of the address) with the
// players and their carried states. partsToWeek rebuilds the exact week file; the publish job checks the folder with
// kit/parts' checkParts, rebuilds it, then judges the rebuilt file like any other. A game's display columns (partCols)
// ride along in the day parts and are not part of the week file. The parts library is embedded byte for byte by the
// publish job (globalThis.__KITPARTS); the recorder and tests load the repository's copy.
let kitParts = null;
/** The recorder and tests hand in the repository's kit/parts (no top-level await: the kit is also loaded as CJS). */
export const useKitParts = (lib) => { kitParts = lib; };
const KP = new Proxy({}, { get: (_, k) => { const l = kitParts ?? globalThis.__KITPARTS; if (!l) throw new Error("kit/parts isn't loaded (the publish job embeds it; the recorder calls useKitParts)"); return l[k]; } });
export const PARTS_SHARDS = 16;
const ROW_COLS = [["player", "a"], ["round", "i"], ["pts", "i"], ["at", "i"]];
const PLAYER_COLS = [["player", "a"], ["stake", "n"], ["peak", "n"], ["voided", "b"]];
const OPT_KEYS_ALL = () => [...WEEK_OPT_KEYS.filter((k) => k !== "carry" && k !== "next"), ...WEEK_META_KEYS];
const partOfRound = (cfg, j, r, ri) => (cfg.parts === "d" ? `d${Math.floor((r[1] - j.start) / DAY) + 1}` : `r${String(ri + 1).padStart(3, "0")}`);
export const weekFolder = (w) => weekName(w).replace(/\.json$/, "");

/** The kit week file j as encoded parts (kit/parts encodePart results) and the manifest's meta (state, unit, expect).
 *  disp (optional, partCols): { cols: [[name, type]], rows: Map<roundId, Map<wallet, values[]>> } for display. */
export function weekToParts(j, cfg, disp = null, writtenAt = 0) {
  const game = cfg.slug, file = weekFolder(j.week), dcols = disp?.cols ?? [];
  const byPart = new Map(), get = (p) => { let x = byPart.get(p); if (!x) byPart.set(p, (x = { rounds: [], rows: [] })); return x; };
  j.rounds.forEach((r, ri) => {
    const b = get(partOfRound(cfg, j, r, ri));
    b.rounds.push([ri, r[0], r[1], r[2], r[3], r[4].length]);
    const dr = disp?.rows?.get(r[0]);
    for (const x of r[4]) {
      const a = j.players[x[0]][0], dv = dcols.length ? (dr?.get(a) ?? dcols.map(() => null)) : [];
      if (dv.length !== dcols.length) throw new Error(`partCols gave ${dv.length} values for ${a} in round ${r[0]}, not ${dcols.length}`);
      b.rows.push([a, ri, x[1], x.length === 3 ? x[2] : 0, ...dv]);
    }
  });
  const encoded = [];
  for (const [part, b] of [...byPart].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    encoded.push(KP.encodePart({ game, file, part, t0: j.start, cols: [...ROW_COLS, ...dcols], rows: b.rows, extra: { rounds: b.rounds } }));
  }
  const shards = new Map(), sh = (a) => { const k = `p/${KP.shardOf(a, PARTS_SHARDS)}`; let x = shards.get(k); if (!x) shards.set(k, (x = { rows: [], carry: [], next: [] })); return x; };
  for (const p of j.players) sh(p[0]).rows.push([p[0], p[1], p[2], p[3]]);
  // States and the week-level values are kept as JSON text: kit/parts sorts an extra's keys, and a state's (or a card's
  // settings') own key order is part of the week file.
  if (j.carry !== undefined) { for (const c of j.carry) sh(c[0]).carry.push([c[0], JSON.stringify(c[1])]); for (const c of j.next) sh(c[0]).next.push([c[0], JSON.stringify(c[1])]); }
  for (const [part, x] of [...shards].sort((u, v) => (u[0] < v[0] ? -1 : 1))) {
    encoded.push(KP.encodePart({ game, file, part, t0: 0, cols: PLAYER_COLS, rows: x.rows, extra: j.carry !== undefined ? { carry: x.carry, next: x.next } : {} }));
  }
  const opt = {};
  for (const k of OPT_KEYS_ALL()) if (j[k] !== undefined) opt[k] = j[k];
  encoded.push(KP.encodePart({ game, file, part: "wk", t0: 0, cols: [["n", "i"]], rows: [], extra: { head: [j.v, j.game, j.week, j.start, j.end, j.min, j.state, j.seen.hash, j.seen.at], opt: JSON.stringify(opt), rounds: j.rounds.length, players: j.players.length, carry: j.carry !== undefined ? 1 : 0, display: dcols } }));
  const expect = encoded.map((e) => e.part).sort();
  return { meta: { game, file, week: j.week, state: j.state, unit: cfg.parts, expect, shards: PARTS_SHARDS, writtenAt }, encoded };
}

/** The kit week file rebuilt from a parts folder's decoded parts ([{ part, header, rows }]); throws when they don't
 *  add up (a round or player missing or twice, a row in the wrong part). */
export function partsToWeek(parts, cfg) {
  const bad = (m) => { throw new Error(`parts: ${m}`); };
  const wk = parts.find((p) => p.part === "wk");
  if (!wk) bad("no wk part");
  const x = wk.header.extra;
  if (!x || !Array.isArray(x.head) || x.head.length !== 9 || typeof x.opt !== "string") bad("wk part: bad head");
  let opt;
  try { opt = JSON.parse(x.opt); } catch { bad("wk part: bad opt"); }
  if (!opt || typeof opt !== "object" || Array.isArray(opt)) bad("wk part: bad opt");
  const [v, game, week, start, end, min, state, sh, sa] = x.head;
  const dcols = Array.isArray(x.display) ? x.display : [];
  const players = [];
  const carry = [], next = [];
  for (const p of parts.filter((q) => q.part.startsWith("p/"))) {
    if (JSON.stringify(p.header.cols) !== JSON.stringify(PLAYER_COLS)) bad(`${p.part}: bad columns`);
    for (const r of p.rows) { if (`p/${KP.shardOf(r.player, PARTS_SHARDS)}` !== p.part) bad(`${r.player} in the wrong shard`); players.push([r.player, r.stake, r.peak, r.voided]); }
    const e = p.header.extra ?? {};
    const st = (xs) => xs.map((c) => { if (!Array.isArray(c) || c.length !== 2 || typeof c[1] !== "string") bad(`${p.part}: bad state`); if (`p/${KP.shardOf(c[0], PARTS_SHARDS)}` !== p.part) bad(`${c[0]}'s state in the wrong shard`); return [c[0], JSON.parse(c[1])]; });
    if (x.carry) { if (!Array.isArray(e.carry) || !Array.isArray(e.next)) bad(`${p.part}: no carried states`); carry.push(...st(e.carry)); next.push(...st(e.next)); }
    else if (e.carry !== undefined || e.next !== undefined) bad(`${p.part}: carried states in a game without them`);
  }
  players.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (let i = 1; i < players.length; i++) if (players[i][0] === players[i - 1][0]) bad(`player ${players[i][0]} twice`);
  if (players.length !== x.players) bad(`${players.length} players, wk says ${x.players}`);
  const idx = new Map(players.map((p, i) => [p[0], i]));
  const rounds = new Array(x.rounds);
  for (const p of parts.filter((q) => /^(d[1-7]|r\d{3,5})$/.test(q.part))) {
    if (JSON.stringify(p.header.cols) !== JSON.stringify([...ROW_COLS, ...dcols])) bad(`${p.part}: bad columns`);
    const meta = p.header.extra?.rounds;
    if (!Array.isArray(meta)) bad(`${p.part}: no rounds`);
    const mine = new Map();
    for (const m of meta) {
      const [ri, id, day, fun, status, n] = m;
      if (!Number.isSafeInteger(ri) || ri < 0 || ri >= x.rounds || rounds[ri]) bad(`${p.part}: round index ${ri}`);
      rounds[ri] = [id, day, fun, status, []]; mine.set(ri, n);
    }
    for (const r of p.rows) {
      const rr = rounds[r.round];
      if (!mine.has(r.round)) bad(`${p.part}: a row for round ${r.round}, which isn't in this part`);
      if (!idx.has(r.player)) bad(`${p.part}: ${r.player} isn't a player`);
      rr[4].push(r.pts > 0 ? [r.player, r.pts, r.at] : [r.player, r.pts]);
    }
    for (const [ri, n] of mine) {
      const rr = rounds[ri];
      if (rr[4].length !== n) bad(`round ${rr[0]}: ${rr[4].length} rows, the part says ${n}`);
      if (p.part !== partOfRound(cfg, { start }, rr, ri)) bad(`round ${rr[0]} in the wrong part`);
      rr[4].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      rr[4] = rr[4].map((y) => (y.length === 3 ? [idx.get(y[0]), y[1], y[2]] : [idx.get(y[0]), y[1]]));
    }
  }
  for (let i = 0; i < x.rounds; i++) if (!rounds[i]) bad(`round ${i} missing`);
  const j = { v, game, week, start, end, min, state, seen: { hash: sh, at: sa }, rounds, players };
  for (const k of WEEK_OPT_KEYS) {
    if (k === "carry" || k === "next") { if (x.carry) j[k] = (k === "carry" ? carry : next).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)); continue; }
    if (opt[k] !== undefined) j[k] = opt[k];
  }
  for (const k of WEEK_META_KEYS) if (opt[k] !== undefined) j[k] = opt[k];
  const known = new Set([...WEEK_OPT_KEYS, ...WEEK_META_KEYS]);
  for (const k of Object.keys(opt)) if (!known.has(k) || k === "carry" || k === "next") bad(`wk part: unexpected key ${k}`);
  return j;
}

/** Reads a parts folder's manifest and parts (each part's SHA-256 checked against the manifest). */
export function readWeekFolder(dir, cfg) {
  const mt = fs.readFileSync(path.join(dir, "manifest.json"), "utf8"), m = JSON.parse(mt);
  if (mt !== JSON.stringify(m) + "\n" || !Array.isArray(m.parts)) throw new Error("parts: manifest not in canonical form");
  const parts = m.parts.map((e) => {
    const t = fs.readFileSync(path.join(dir, e.name));
    if (sha256(t) !== e.sha256) throw new Error(`parts: ${e.name}: SHA-256 doesn't match the manifest`);
    const d = KP.decodePart(t.toString("utf8"));
    return { part: e.part, header: d.header, rows: d.rows };
  });
  return { manifest: m, week: partsToWeek(parts, cfg) };
}

const NAMES = new RegExp(`^(board\\.json|alltime\\.json|W([0-9]{3}|[1-9][0-9]{3})\\.json|vault/(HOLD-|RELEASE-)?W${VNUM}\\.json|inputs/W${VNUM}\\.json)$`);
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const same = (a, b) => a !== null && b !== null && Buffer.compare(a, b) === 0;
const isHold = (h, cfg, w) => !!h && typeof h === "object" && Object.keys(h).join() === "game,week,reason" && h.game === cfg.game && h.week === w && typeof h.reason === "string" && h.reason.length > 0 && h.reason.length <= 300;

function listFiles(dir) {
  const out = [], bad = [];
  if (!fs.existsSync(dir)) return { out, bad };
  const walk = (d, rel) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f), r = rel ? `${rel}/${f}` : f, s = fs.lstatSync(p);
      if (s.isSymbolicLink()) bad.push(r);
      else if (s.isDirectory()) { if (r === "vault" || r === "inputs") walk(p, r); else bad.push(r + "/"); }
      else if (s.isFile()) out.push(r); else bad.push(r);
    }
  };
  walk(dir, "");
  return { out, bad };
}
const readRaw = (dir, rel) => { const p = path.join(dir, rel); return fs.existsSync(p) && fs.lstatSync(p).isFile() ? fs.readFileSync(p) : null; };
/** Parsed JSON, only when the bytes are exactly the recorders' own form. */
function parseCanon(raw) {
  if (raw === null) return { ok: false, why: "missing" };
  if (raw.length > MAX_FILE_BYTES) return { ok: false, why: "over 2 MB" };
  let v;
  try { v = JSON.parse(raw.toString("utf8")); } catch { return { ok: false, why: "not JSON" }; }
  if (Buffer.compare(Buffer.from(canon(v), "utf8"), raw) !== 0) return { ok: false, why: "not in the recorders' own JSON form" };
  return { ok: true, v };
}

/** Why a new copy of a non-final week may not replace the published one ("" = it may). RECORDER §3.3 and KC-8:
 *  rounds are never dropped; a decided round keeps its id, day, fun flag and wallets; without roundsCorrectable it
 *  never changes at all; with it (owner corrections on chain) only its status (scored ↔ void), points and score
 *  times may change, never back to pending. */
export function roundsChange(prev, j, cfg) {
  const now = new Map(j.rounds.map((r) => [r[0], resolveRound(j, r)]));
  for (const r0 of prev.rounds) {
    const a = resolveRound(prev, r0), b = now.get(a[0]);
    if (!b) return `it drops published round ${a[0]}`;
    if (a[3] === "p") continue;
    // A Sunday fun round never counts toward the payout, so it may be corrected even in a game whose decided rounds
    // can't change (#B-12 NK-13); it still keeps its day and stays decided.
    if (!cfg.roundsCorrectable && !a[2]) { if (JSON.stringify(a) !== JSON.stringify(b)) return `it changes decided round ${a[0]}`; continue; }
    if (a[1] !== b[1] || a[2] !== b[2]) return `it moves decided round ${a[0]} to another day`;
    if (b[3] === "p") return `decided round ${a[0]} goes back to pending`;
    if (a[4].map((x) => x[0]).join() !== b[4].map((x) => x[0]).join()) return `it changes who played decided round ${a[0]}`;
  }
  return "";
}

/**
 * Check one game's incoming folder against its published folder, with this job's clock `now`.
 * Returns { publish: [relative names to publish], held: [{ name, why, alert }] }.
 * cfg: { slug, game, genesis, weekMs, sundayFunRound, payoutRule, vaultValues, entry, minPts, rowCap, maxRoundPoints,
 *        liveWeek, roundsCorrectable }; release: the owner's <SLUG>_RELEASE value from the job's own variables (KC-3).
 */
export function checkGame(cfg, inDir, pubDir, now, release = "", cardsOk = null) {
  const k = weekClock(cfg), cw = k.weekOf(now);
  const held = [], publish = [];
  const hold = (name, why, alert = true) => held.push({ name, why, alert });
  // G3: a ruler game's new or changed file must list only cards this job rebuilt from the published vhp-data with the
  // embedded vhp_ruler.py (cardsOk: their sha256 values; null = the rebuild didn't run). Unchanged copies aren't rebuilt.
  const cardsWhy = (raw, old, j) => {
    if (!cfg.vhpData || (old && same(raw, old)) || !Array.isArray(j?.cards) || !j.cards.length) return null;
    if (!cardsOk) return "its ruler cards couldn't be rebuilt in this job (G3)";
    const n = j.cards.filter((x) => !cardsOk.has(cardKey(x[0], x[1]))).length;
    return n ? `${n} of its ${j.cards.length} ruler cards aren't what the published ruler data gives (G3)` : null;
  };
  const { out: files, bad } = listFiles(inDir);
  for (const b of bad) hold(b, "not a plain file in an allowed folder");
  const okWeeks = new Map();     // week -> the week file that will be published after this job (incoming or published)
  const heldWeeks = new Set();
  const pubWeek = (w) => { const r = parseCanon(readRaw(pubDir, weekName(w))); return r.ok && !weekShape(r.v, weekName(w), cfg) ? r.v : null; };
  const tallyOf = (j) => tally(j, cfg);

  // Inputs files first (FC-9): write-once, only before their week opens (by this job's clock), at most a week ahead.
  const inputsOk = new Map();    // week -> sha256 of the inputs file that will be published after this job
  const pubInputs = (w) => { const raw = readRaw(pubDir, inputsName(w)); return raw && parseCanon(raw).ok ? sha256(raw) : null; };
  for (const f of files.filter((x) => x.startsWith("inputs/"))) {
    if (!NAMES.test(f)) continue;
    const w = Number(/^inputs\/W([0-9]+)\.json$/.exec(f)[1]);
    const raw = readRaw(inDir, f), old = readRaw(pubDir, f);
    const p = parseCanon(raw);
    if (!p.ok) { hold(f, p.why); continue; }
    if (old) { if (!same(raw, old)) hold(f, "it changes a published inputs file (write-once, FC-9)"); else inputsOk.set(w, sha256(raw)); continue; }
    const j = p.v;
    if (!cfg.inputsFile) { hold(f, "this game has no inputs file"); continue; }
    if (!j || typeof j !== "object" || Array.isArray(j) || Object.keys(j).join() !== (cfg.vhpData ? "game,week,data,cards" : "game,week,data") || j.game !== cfg.game || j.week !== w || j.data === null || typeof j.data !== "object" || (cfg.vhpData && !isCardList(j.cards))) { hold(f, `not an inputs file's shape ({game, week, data${cfg.vhpData ? ", cards" : ""}})`); continue; }
    if (!(now < k.start(w))) { hold(f, "an inputs file published after its week opened, by this job's clock (FC-9)"); continue; }
    if (now < k.start(w) - INPUTS_EARLIEST_MS) { hold(f, "an inputs file more than a week before its week"); continue; }
    { const cw2 = cardsWhy(raw, old, j); if (cw2) { hold(f, cw2); continue; } }
    inputsOk.set(w, sha256(raw)); publish.push(f);
  }

  for (const f of files) {
    if (!NAMES.test(f)) { hold(f, "a name the game may not publish"); continue; }
    if (!WEEK_FILE.test(f)) continue;
    const raw = readRaw(inDir, f), old = readRaw(pubDir, f);
    const p = parseCanon(raw);
    if (!p.ok) { hold(f, p.why); continue; }
    const j = p.v, why = weekShape(j, f, cfg);
    if (why) { hold(f, why); continue; }
    const w = j.week;
    heldWeeks.add(w);
    if (cfg.inputsFile && (inputsOk.get(w) ?? pubInputs(w)) !== j.inputs) { hold(f, "its inputs hash isn't the published inputs file's (FC-9)"); continue; }
    { const cw2 = cardsWhy(raw, old, j); if (cw2) { hold(f, cw2); continue; } }
    const pv = old ? parseCanon(old) : null;
    const prev = pv?.ok && !weekShape(pv.v, f, cfg) ? pv.v : null;
    if (old && !prev) { hold(f, "the published copy can't be read: nothing replaces it"); continue; }
    if (prev?.state === "final") {
      if (!same(raw, old)) { hold(f, "it changes a published final week"); continue; }
      okWeeks.set(w, prev); heldWeeks.delete(w); continue;     // copied forward unchanged: nothing to publish
    }
    if (prev) { const ch = roundsChange(prev, j, cfg); if (ch) { hold(f, ch); continue; } }
    // K8: a fallback, once published, stays exactly as published; and no fallback before its time by this job's clock.
    if (prev && (prev.fallbacks ?? []).some((f) => JSON.stringify((j.fallbacks ?? []).find((g) => g[0] === f[0])) !== JSON.stringify(f))) { hold(f, "it changes or drops a published fallback round"); continue; }
    if ((j.fallbacks ?? []).some((x) => x[1] > now)) { hold(f, "a fallback round decided before its 48 h grace, by this job's clock"); continue; }
    // #G-69 G69-1: the ruler data a week was read with never goes backwards (a stale or short download).
    if (prev && prev.vhpTo !== undefined && !(j.vhpTo !== undefined && j.vhpTo >= prev.vhpTo)) { hold(f, "it was read with older ruler data than the published copy (vhpTo goes backwards)"); continue; }
    // KC-1: seen.at is the recorder's claim. Kept only while the hash is the published one, and exactly; a new hash must
    // be stamped by this hour's run (by this job's clock), and for an ended week after its end.
    // An unchanged hash first read before the week ended (an open copy under liveWeek) may be stamped again once the
    // week has ended, by the same window rules (#B-12 NK-7): otherwise its final could never pass the end rule below.
    const restamp = !!prev && prev.seen.hash === j.seen.hash && prev.seen.at < j.end && j.seen.at !== prev.seen.at;
    if (prev && prev.seen.hash === j.seen.hash && !restamp) {
      if (j.seen.at !== prev.seen.at) { hold(f, "it changes when its unchanged content was first read"); continue; }
    } else {
      if (j.seen.at > now + FUTURE_SLACK_MS) { hold(f, "seen in the future by this job's clock"); continue; }
      if (j.seen.at < now - FRESH_MS) { hold(f, "new content first read long before this run, by this job's clock"); continue; }
      if (j.state !== "open" && j.seen.at < j.end) { hold(f, "an ended week first read before its end"); continue; }
    }
    if (j.state === "open") {
      if (!(cfg.liveWeek && w === cw)) { hold(f, "an open week other than this week, by this job's clock"); continue; }
    } else {
      if (w !== cw - 1 || now < j.end) { hold(f, "not the week that just ended, by this job's clock"); continue; }
      if (now >= k.due(w)) { hold(f, "past the vault's 3 days for that week"); continue; }
    }
    if (j.state === "final") {
      const t = tallyOf(j);
      if (!t.complete) { hold(f, "final while rounds are still pending"); continue; }
      if (t.vaultError) { hold(f, `final, but no vault file can be made: ${t.vaultError}`); continue; }
      if (now < j.end) { hold(f, "final before Mon 00:00 UTC (D-125)"); continue; }
      if (!(prev && prev.state === "pending" && prev.seen.hash === j.seen.hash)) { hold(f, "final without an earlier published run of the same week"); continue; }
      if (j.seen.at < j.end) { hold(f, "final, but its content was first read before the week ended"); continue; }
      if (now - j.seen.at < FINAL_WAIT_MS) { hold(f, "final less than an hour after its pending copy could have been published", false); continue; }
    }
    okWeeks.set(w, j); heldWeeks.delete(w); publish.push(f);
  }

  // board.json: recomputed from its week (this run's, if it passed; else the published one).
  if (files.includes("board.json")) {
    const p = parseCanon(readRaw(inDir, "board.json"));
    const b = p.ok ? p.v : null;
    const w = b?.lastWeek?.week;
    if (!p.ok) hold("board.json", p.why);
    else if (!b || Object.keys(b).join() !== "v,updated,lastWeek" || b.v !== 1 || typeof b.updated !== "string" || !ISO.test(b.updated) || !nat(w)) hold("board.json", "not the board's shape");
    else if (heldWeeks.has(w)) hold("board.json", "its week file is held this run", false);
    else {
      const src = okWeeks.get(w) ?? pubWeek(w);
      let want = null;
      try { if (src) want = canon(boardOf(src, tallyOf(src), b.updated, cfg.rowCap ?? 0)); } catch (e) { want = null; }
      if (!src) hold("board.json", "its week has no week file (published or in this run)");
      else if (want === null || want !== canon(b)) hold("board.json", "its rows aren't the ones recomputed from the week file");
      else if (Date.parse(b.updated) > now + FUTURE_SLACK_MS) hold("board.json", "updated in the future by this job's clock");
      else publish.push("board.json");
    }
  }

  // Vault files: HOLD only added; RELEASE only the owner's (KC-3); W<n> only for a final week, inside the vault's window,
  // exactly recomputed.
  for (const f of files.filter((x) => x.startsWith("vault/") && NAMES.test(x))) {
    const m = /^vault\/(HOLD-|RELEASE-)?W([0-9]+)\.json$/.exec(f);
    const w = Number(m[2]);
    const raw = readRaw(inDir, f), old = readRaw(pubDir, f);
    const p = parseCanon(raw);
    if (!p.ok) { hold(f, p.why); continue; }
    const j = p.v;
    if (old) { if (!same(raw, old)) hold(f, "a write-once file that differs from the published one"); continue; }
    if (m[1] === "HOLD-") {
      if (!isHold(j, cfg, w)) hold(f, "not a HOLD file's shape");
      else publish.push(f);
      continue;
    }
    if (m[1] === "RELEASE-") {
      if (Object.keys(j).join() !== "game,week,code" || j.game !== cfg.game || j.week !== w || typeof j.code !== "string" || !/^[0-9a-f]{16}$/.test(j.code)) { hold(f, "not a RELEASE file's shape"); continue; }
      // Only a HOLD published by an EARLIER run can be released, and only by the owner's own variable, which this job
      // reads itself: a recorder run can compute the code from the public HOLD, but can't set the variable.
      const hp = parseCanon(readRaw(pubDir, `vault/HOLD-W${w}.json`));
      const h = hp.ok && isHold(hp.v, cfg, w) ? hp.v : null;
      if (!h) { hold(f, "releases a week with no HOLD file published by an earlier run"); continue; }
      const code = sha256(h.reason).slice(0, 16);
      if (j.code !== code) { hold(f, "its code isn't the HOLD's (sha256 of its reason, first 16)"); continue; }
      const rel = parseRelease(release);
      if (!(rel && rel.week === w && rel.code === code)) { hold(f, `not released by the owner: the game's RELEASE variable isn't "${w}:${code}"`); continue; }
      publish.push(f);
      continue;
    }
    if (!(now >= k.end(w) && now < k.due(w))) { hold(f, "not inside the vault's 3 days for that week, by this job's clock"); continue; }
    const src = okWeeks.get(w) ?? pubWeek(w);
    if (!src || src.state !== "final") { hold(f, "its week isn't final (published or in this run)", false); continue; }
    let want = null;
    try { want = canon(vaultFileOf(src, tallyOf(src))); } catch (e) { want = null; }
    if (want === null || want !== canon(j)) { hold(f, "its rows or winners aren't the ones recomputed from the final week file"); continue; }
    publish.push(f);
  }

  // alltime.json: rebuilt from every final week (published, or this run's) and the vault files published by then.
  if (files.includes("alltime.json")) {
    const p = parseCanon(readRaw(inDir, "alltime.json"));
    const b = p.ok ? p.v : null;
    if (!p.ok) hold("alltime.json", p.why);
    else if (!b || typeof b !== "object" || !ALLTIME_KEYS.every((x, i) => Object.keys(b)[i] === x) || b.v !== 1 || typeof b.updated !== "string" || !ISO.test(b.updated)) hold("alltime.json", "not the all-time board's shape");
    else if (heldWeeks.size) hold("alltime.json", "a week file is held this run", false);
    else {
      const finals = new Map();
      for (const f of fs.existsSync(pubDir) ? fs.readdirSync(pubDir) : []) {
        const m = WEEK_FILE.exec(f);
        if (m) { const w = Number(m[1]), v = pubWeek(w); if (v?.state === "final") finals.set(w, v); }
      }
      for (const [w, v] of okWeeks) if (v.state === "final") finals.set(w, v);
      const medal = new Set();
      for (const w of finals.keys()) if (readRaw(pubDir, `vault/W${w}.json`) || publish.includes(`vault/W${w}.json`)) medal.add(w);
      let want = null;
      try { want = canon(allTimeOf([...finals.values()], cfg, medal, b.updated)); } catch { want = null; }
      if (want === null || want !== canon(b)) hold("alltime.json", "its rows aren't the ones rebuilt from the final week files");
      else if (Date.parse(b.updated) > now + FUTURE_SLACK_MS) hold("alltime.json", "updated in the future by this job's clock");
      else publish.push("alltime.json");
    }
  }
  return { publish, held };
}

/** The owner's `<SLUG>_RELEASE` value, "<week>:<code>" (week without leading zeros, code 16 hex), or null. The
 *  recorder and the publish check both read it with this one parser (#B-12 NK-9). */
export function parseRelease(s) {
  const m = typeof s === "string" ? /^\s*(0|[1-9][0-9]{0,3}):([0-9a-f]{16})\s*$/.exec(s) : null;
  return m ? { week: Number(m[1]), code: m[2] } : null;
}

/** The env variable a game's owner release lives in, in the publish job: KIT_RELEASE_<SLUG> (hyphens → _). */
export const releaseEnv = (slug) => `KIT_RELEASE_${String(slug).toUpperCase().replace(/-/g, "_")}`;

/** The publish job's entry point: node - <in> <pub> <out-list> (games from KIT_GAMES, clock from CHECK_NOW_MS or now,
 *  each game's owner release from KIT_RELEASE_<SLUG>). <in>/<slug> is that game's own artifact (KC-13). */
/** KG parts v1: temporary copies of a parts game's incoming and published folders, each W<NNN>/ replaced by its
 *  rebuilt W<NNN>.json (the incoming one only when kit/parts' checkParts passes). folders: "W004.json" -> the
 *  folder's files to publish. A week both as a file and as a folder is held. */
export function partsViews(g, inDir, pubDir, tmpRoot) {
  const held = [], folders = new Map();
  // The caller names the temp folder (the publish job: RUNNER_TEMP; the replay and conformance: their own), so this
  // never reads the environment itself (Fantasy, 14 Nov: the conformance sandbox would blame the game for it).
  if (typeof tmpRoot !== "string" || !tmpRoot.length) throw new Error("partsViews needs a temp folder");
  const tmp = fs.mkdtempSync(path.join(tmpRoot, `kit-parts-${g.slug}-`));
  const view = (src, dst, incoming) => {
    fs.mkdirSync(dst, { recursive: true });
    if (!fs.existsSync(src)) return;
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, e.name), to = path.join(dst, e.name);
      const m = /^W([0-9]{3}|[1-9][0-9]{3})$/.exec(e.name);
      if (m && e.isDirectory() && !e.isSymbolicLink()) {
        const rel = `${e.name}.json`, week = Number(m[1]);
        if (fs.existsSync(path.join(src, rel))) { if (incoming) held.push({ name: e.name + "/", why: "a week both as a file and as a parts folder" }); continue; }
        try {
          if (incoming) {
            const c = KP.checkParts(from, { game: g.slug, file: e.name, week, full: ["wk"], publishedRoot: pubDir, rel: e.name });
            if (!c.ok) { held.push({ name: e.name + "/", why: `its parts don't check (${c.errors.slice(0, 3).join("; ")})` }); continue; }
            const j = partsToWeek(c.parts, g);
            fs.writeFileSync(path.join(dst, rel), canon(j));
            folders.set(rel, ["manifest.json", ...c.manifest.parts.map((p) => p.name)].map((n) => `${e.name}/${n}`));
          } else fs.writeFileSync(path.join(dst, rel), canon(readWeekFolder(from, g).week));
        } catch (err) { if (incoming) held.push({ name: e.name + "/", why: String(err?.message ?? err).slice(0, 200) }); else throw err; }
      } else if (e.isDirectory() && !e.isSymbolicLink()) fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
      else if (e.isFile()) fs.copyFileSync(from, to);
      else if (incoming) held.push({ name: e.name, why: "not a plain file" });
    }
  };
  view(inDir, path.join(tmp, "in"), true);
  view(pubDir, path.join(tmp, "pub"), false);
  return { inDir: path.join(tmp, "in"), pubDir: path.join(tmp, "pub"), folders, held };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const [inRoot, pubRoot, listFile] = argv;
  const games = JSON.parse(env.KIT_GAMES || "[]");
  const now = env.CHECK_NOW_MS ? Number(env.CHECK_NOW_MS) : KIT_NOW();
  const lines = [];
  let alert = false;
  const top = fs.existsSync(inRoot) ? fs.readdirSync(inRoot) : [];
  for (const f of top) if (!games.some((g) => g.slug === f)) { console.log(`::error::held, not published: ${f}: not a kit game on this branch`); alert = true; }
  for (const g of games) {
    try {
      const dir = path.join(inRoot, g.slug);
      if (fs.existsSync(dir) && !fs.lstatSync(dir).isDirectory()) { console.log(`::error::held, not published: ${g.slug}: not a plain folder`); alert = true; continue; }
      // G3: the cards the publish job's embedded vhp_ruler.py rebuilt for this game (absent = it didn't run or failed).
      let cardsOk = null;
      if (g.vhpData && env.KIT_CARDS_DIR) {
        const cf = path.join(env.KIT_CARDS_DIR, `${g.slug}.json`);
        if (fs.existsSync(cf)) { const v = JSON.parse(fs.readFileSync(cf, "utf8")); if (Array.isArray(v.ok)) cardsOk = new Set(v.ok.filter((x) => Array.isArray(x) && x.length === 2).map((x) => cardKey(x[0], x[1]))); }
      }
      const pub = path.join(pubRoot, g.slug);
      // KG parts v1: a parts game's W<NNN>/ folders are checked by kit/parts, rebuilt into week files, and judged
      // like any other week file; publishing a rebuilt week publishes its folder's files.
      const v = g.parts ? partsViews(g, dir, pub, env.RUNNER_TEMP || path.dirname(listFile)) : { inDir: dir, pubDir: pub, folders: new Map(), held: [] };
      for (const h of v.held) { console.log(`::error::held, not published: ${g.slug}/${h.name}: ${h.why}`); alert = true; }
      const r = checkGame(g, v.inDir, v.pubDir, now, env[releaseEnv(g.slug)] ?? "", cardsOk);
      for (const h of r.held) {
        console.log(`${h.alert ? "::error::" : "::notice::"}held, not published: ${g.slug}/${h.name}: ${h.why}`);
        if (h.alert) alert = true;
      }
      for (const f of r.publish) for (const x of v.folders.get(f) ?? [f]) lines.push(`${g.slug}/${x}`);
      console.log(`${g.slug}: ${r.publish.length} to publish, ${r.held.length} held`);
    } catch (e) {
      // One game's broken files never stop another's (RECORDER §6.4).
      console.log(`::error::${g.slug}: its files couldn't be checked (${String(e?.message ?? e).slice(0, 200)}): none published this run`);
      alert = true;
    }
  }
  fs.writeFileSync(listFile, lines.map((l) => l + "\n").join(""));
  if (alert) fs.writeFileSync(listFile + ".alert", "1\n");
  return { lines, alert };
}
