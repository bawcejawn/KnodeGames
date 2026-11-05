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
// Week file (W<NNN>.json, one per vault week, kit format v1):
//   { v: 1, game, week, start, end, min, state: "open" | "pending" | "final", seen: { hash, at },
//     rounds:  [[id, day, fun 0|1, status "s"|"v"|"p", [[wallet, points, at], …]], …]   by id; rows by wallet
//     players: [[wallet, stake, peak, voided 0|1], …] }                                     by wallet
//   status: "s" scored · "v" void (nothing scores) · "p" pending (not decided yet; rows hold points 0)
//   Rows record every wallet that took part in the round (points 0 included), so the entry rule ("at least N counted
//   rounds") is re-checked here without a per-game scorer.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const KIT_FILE_VERSION = 1;
export const DAY = 86400000;
export const HOUR = 3600000;
export const WEEK = 7 * DAY;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;      // the publish job's cap (RECORDER §6.3)
export const RESULTS_DAYS = 3;                      // the vault takes a week's results file for 3 days (VAULT §6)
export const STABLE_MS = HOUR;                      // final once two runs at least an hour apart read the same (D-135)
export const MAX_PER_PLACE = 10;                    // the vault takes at most 10 wallets per free place
export const MAX_VAULT_POINTS = 255;
export const FUTURE_SLACK_MS = 10 * 60000;          // a recorder's "seen at" may run this far ahead of the job's clock
export const MAX_ROUNDS = 2000;
export const MAX_PLAYERS = 20000;

const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const DIGITS = /^(0|[1-9][0-9]{0,30})$/;
export const isAddr = (a) => typeof a === "string" && ADDR.test(a);
export const nat = (x) => Number.isSafeInteger(x) && x >= 0;
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The recorders' own JSON form: JSON.stringify of the value plus a newline (the publish job checks exact bytes). */
export const canon = (o) => JSON.stringify(o) + "\n";
export const pad3 = (w) => String(w).padStart(3, "0");
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
/** What decides a week's results; the hash a run records when it first reads it (seen.hash). */
export const weekHash = (j) => sha256(JSON.stringify([j.game, j.week, j.min, j.rounds, j.players]));

/** "" when the week file is in the kit's shape for this game and name, else why not. */
export function weekShape(j, name, cfg) {
  const k = weekClock(cfg);
  if (!j || typeof j !== "object" || Array.isArray(j)) return "not an object";
  const keys = Object.keys(j);
  if (keys.length !== WEEK_KEYS.length || !WEEK_KEYS.every((x, i) => keys[i] === x)) return "not the week file's keys in order";
  if (j.v !== KIT_FILE_VERSION || j.game !== cfg.game) return "wrong version or game";
  if (!nat(j.week) || name !== `W${pad3(j.week)}.json`) return "week and name don't match";
  if (j.start !== k.start(j.week) || j.end !== k.end(j.week)) return "wrong start or end for that week";
  if (typeof j.min !== "string" || !DIGITS.test(j.min)) return "min must be a decimal string";
  if (!STATES.includes(j.state)) return "unknown state";
  const s = j.seen;
  if (!s || typeof s !== "object" || Object.keys(s).join() !== "hash,at" || !/^[0-9a-f]{64}$/.test(s.hash) || !nat(s.at)) return "bad seen";
  if (s.hash !== weekHash(j)) return "its hash isn't its content's";
  if (!Array.isArray(j.rounds) || j.rounds.length > MAX_ROUNDS) return "bad rounds";
  if (!Array.isArray(j.players) || j.players.length > MAX_PLAYERS) return "bad players";
  const who = new Set();
  let last = null;
  for (const p of j.players) {
    if (!Array.isArray(p) || p.length !== 4 || !isAddr(p[0]) || typeof p[1] !== "string" || !DIGITS.test(p[1])
      || typeof p[2] !== "string" || !DIGITS.test(p[2]) || (p[3] !== 0 && p[3] !== 1)) return "bad player row";
    if (last !== null && cmp(last, p[0]) >= 0) return "players not sorted or repeated";
    last = p[0]; who.add(p[0]);
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
    let lw = null;
    for (const x of rows) {
      if (!Array.isArray(x) || x.length !== 3 || !isAddr(x[0]) || !nat(x[1]) || !nat(x[2])) return `round ${id}: bad row`;
      if (lw !== null && cmp(lw, x[0]) >= 0) return `round ${id}: rows not sorted or repeated`;
      if (!who.has(x[0])) return `round ${id}: ${x[0]} is not in players`;
      if (st !== "s" && x[1] !== 0) return `round ${id}: points in a round that isn't scored`;
      if (x[1] > (cfg.maxRoundPoints ?? 1000000)) return `round ${id}: points over the game's maximum`;
      lw = x[0];
    }
  }
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
 * from. cfg: { payoutRule, vaultValues, entry: { minRounds, minPoints } }.
 *   counted  = scored, non-fun rounds the wallet took part in; pts = their points; answers = every round it took part in
 *   ok       = not voided, counted ≥ entry.minRounds, pts ≥ entry.minPoints
 *   staked   = ok and stake > 0 and stake ≥ min (the vault's week stake)     free = ok and peak < min
 *   board    = "staked" when peak ≥ min and not voided (LEADERBOARD §1), else "free"; place = 1 + more points, same board
 */
export function tally(j, cfg) {
  const min = BigInt(j.min);
  const minRounds = cfg.entry?.minRounds ?? 1, minPoints = cfg.entry?.minPoints ?? 1;
  const acc = new Map(j.players.map(([a]) => [a, { pts: 0, counted: 0, answers: 0, at: 0 }]));
  let complete = true;
  for (const [, , fun, st, rows] of j.rounds) {
    if (!fun && st === "p") complete = false;
    for (const [a, p, at] of rows) {
      const x = acc.get(a);
      x.answers++;
      if (fun || st !== "s") continue;
      x.counted++; x.pts += p;
      if (p > 0 && at > x.at) x.at = at;
    }
  }
  const rows = [];
  for (const [a, stakeS, peakS, voided] of j.players) {
    const x = acc.get(a);
    if (!x.answers) continue;
    const pts = voided ? 0 : x.pts, counted = voided ? 0 : x.counted;
    const stake = voided ? 0n : BigInt(stakeS);
    const peak = BigInt(peakS) > stake ? BigInt(peakS) : stake;
    const ok = !voided && counted >= minRounds && pts >= minPoints;
    const staked = ok && stake > 0n && stake >= min;
    const free = ok && peak < min;
    rows.push({ a, pts, counted, answers: x.answers, at: voided ? 0 : x.at, staked, free, ranked: staked, board: peak >= min && !voided ? "staked" : "free", place: 0 });
  }
  for (const b of ["staked", "free"]) {
    const xs = rows.filter((r) => r.board === b);
    for (const r of xs) r.place = 1 + xs.filter((o) => o.pts > r.pts).length;
  }
  rows.sort((u, v) => (u.board === v.board ? 0 : u.board === "staked" ? -1 : 1) || v.pts - u.pts || cmp(u.a, v.a));
  const stakedRows = rows.filter((r) => r.staked);
  const paid = paidSet(stakedRows, cfg.payoutRule);
  const vrows = stakedRows.length ? vaultValues(stakedRows, paid, cfg.vaultValues) : [];
  const { first, second } = freePlaces(rows.filter((r) => r.free));
  const prizes = [...first.map((p) => ({ player: p, place: 1 })), ...second.map((p) => ({ player: p, place: 2 }))];
  return { complete, rows, paid, vault: { rows: vrows, first, second }, prizes };
}

/** board.json (LEADERBOARD §1, the vault bot's board check): lastWeek with both boards. */
export function boardOf(j, t, updated) {
  return {
    v: 1, updated,
    lastWeek: {
      week: j.week, start: j.start, final: j.state === "final", complete: t.complete,
      rows: t.rows.map((x) => ({ a: x.a, board: x.board, place: x.place, pts: x.pts, points: x.pts, counted: x.counted, answers: x.answers, ranked: x.ranked })),
      prizes: t.prizes,
    },
  };
}
/** The vault's results file for a final week (VAULT §6): rows (staked), first and second always filled. */
export const vaultFileOf = (j, t) => ({ game: j.game, week: j.week, final: true, rows: t.vault.rows, first: t.vault.first, second: t.vault.second });

// ───────────────────────── the checks ─────────────────────────
const NAMES = /^(board\.json|W[0-9]{3}\.json|vault\/(HOLD-|RELEASE-)?W[0-9]{1,4}\.json)$/;
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const same = (a, b) => a !== null && b !== null && Buffer.compare(a, b) === 0;

function listFiles(dir) {
  const out = [], bad = [];
  if (!fs.existsSync(dir)) return { out, bad };
  const walk = (d, rel) => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f), r = rel ? `${rel}/${f}` : f, s = fs.lstatSync(p);
      if (s.isSymbolicLink()) bad.push(r);
      else if (s.isDirectory()) { if (r === "vault") walk(p, r); else bad.push(r + "/"); }
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

/**
 * Check one game's incoming folder against its published folder, with this job's clock `now`.
 * Returns { publish: [relative names to publish], held: [{ name, why, alert }] }.
 * cfg: { slug, game, genesis, weekMs, sundayFunRound, payoutRule, vaultValues, entry, liveWeek, roundsCorrectable }.
 */
export function checkGame(cfg, inDir, pubDir, now) {
  const k = weekClock(cfg), cw = k.weekOf(now);
  const held = [], publish = [];
  const hold = (name, why, alert = true) => held.push({ name, why, alert });
  const { out: files, bad } = listFiles(inDir);
  for (const b of bad) hold(b, "not a plain file in an allowed folder");
  const okWeeks = new Map();     // week -> the week file that will be published after this job (incoming or published)
  const heldWeeks = new Set();
  const pubWeek = (w) => { const r = parseCanon(readRaw(pubDir, `W${pad3(w)}.json`)); return r.ok && !weekShape(r.v, `W${pad3(w)}.json`, cfg) ? r.v : null; };

  for (const f of files) {
    if (!NAMES.test(f)) { hold(f, "a name the game may not publish"); continue; }
    if (!/^W[0-9]{3}\.json$/.test(f)) continue;
    const raw = readRaw(inDir, f), old = readRaw(pubDir, f);
    const p = parseCanon(raw);
    if (!p.ok) { hold(f, p.why); continue; }
    const j = p.v, why = weekShape(j, f, cfg);
    if (why) { hold(f, why); continue; }
    const w = j.week;
    heldWeeks.add(w);
    const pv = old ? parseCanon(old) : null;
    const prev = pv?.ok && !weekShape(pv.v, f, cfg) ? pv.v : null;
    if (old && !prev) { hold(f, "the published copy can't be read: nothing replaces it"); continue; }
    if (prev?.state === "final") {
      if (!same(raw, old)) { hold(f, "it changes a published final week"); continue; }
      okWeeks.set(w, prev); heldWeeks.delete(w); continue;     // copied forward unchanged: nothing to publish
    }
    if (prev && !cfg.roundsCorrectable) {
      // RECORDER §3.3: a decided round never changes, and rounds are only added.
      const now2 = new Map(j.rounds.map((r) => [r[0], JSON.stringify(r)]));
      const lost = prev.rounds.find((r) => r[3] !== "p" && now2.get(r[0]) !== JSON.stringify(r));
      if (lost) { hold(f, `it changes or drops published round ${lost[0]}`); continue; }
      const goneP = prev.rounds.find((r) => !now2.has(r[0]));
      if (goneP) { hold(f, `it drops published round ${goneP[0]}`); continue; }
    }
    if (j.seen.at > now + FUTURE_SLACK_MS) { hold(f, "seen in the future by this job's clock"); continue; }
    if (j.state === "open") {
      if (!(cfg.liveWeek && w === cw)) { hold(f, "an open week other than this week, by this job's clock"); continue; }
    } else {
      if (w !== cw - 1 || now < j.end) { hold(f, "not the week that just ended, by this job's clock"); continue; }
      if (now >= k.due(w)) { hold(f, "past the vault's 3 days for that week"); continue; }
    }
    if (j.state === "final") {
      const t = tally(j, cfg);
      if (!t.complete) { hold(f, "final while rounds are still pending"); continue; }
      if (now < j.end) { hold(f, "final before Mon 00:00 UTC (D-125)"); continue; }
      if (!(prev && prev.state === "pending" && prev.seen.hash === j.seen.hash && prev.seen.at === j.seen.at)) { hold(f, "final without an earlier published run of the same week"); continue; }
      if (now - j.seen.at < STABLE_MS) { hold(f, "final less than an hour after the week was first read the same", false); continue; }
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
      try { if (src) want = canon(boardOf(src, tally(src, cfg), b.updated)); } catch (e) { want = null; }
      if (!src) hold("board.json", "its week has no week file (published or in this run)");
      else if (want === null || want !== canon(b)) hold("board.json", "its rows aren't the ones recomputed from the week file");
      else if (Date.parse(b.updated) > now + FUTURE_SLACK_MS) hold("board.json", "updated in the future by this job's clock");
      else publish.push("board.json");
    }
  }

  // Vault files: HOLD / RELEASE only added; W<n> only for a final week, inside the vault's window, exactly recomputed.
  for (const f of files.filter((x) => x.startsWith("vault/") && NAMES.test(x))) {
    const m = /^vault\/(HOLD-|RELEASE-)?W([0-9]+)\.json$/.exec(f);
    const w = Number(m[2]);
    const raw = readRaw(inDir, f), old = readRaw(pubDir, f);
    const p = parseCanon(raw);
    if (!p.ok) { hold(f, p.why); continue; }
    const j = p.v;
    if (old) { if (!same(raw, old)) hold(f, "a write-once file that differs from the published one"); continue; }
    if (m[1] === "HOLD-") {
      if (Object.keys(j).join() !== "game,week,reason" || j.game !== cfg.game || j.week !== w || typeof j.reason !== "string" || !j.reason || j.reason.length > 300) hold(f, "not a HOLD file's shape");
      else publish.push(f);
      continue;
    }
    if (m[1] === "RELEASE-") {
      if (Object.keys(j).join() !== "game,week,code" || j.game !== cfg.game || j.week !== w || typeof j.code !== "string" || !/^[0-9a-f]{16}$/.test(j.code)) { hold(f, "not a RELEASE file's shape"); continue; }
      const hp = parseCanon(readRaw(pubDir, `vault/HOLD-W${w}.json`));
      const hi = parseCanon(readRaw(inDir, `vault/HOLD-W${w}.json`));
      const h = hp.ok ? hp.v : hi.ok ? hi.v : null;
      if (!h) hold(f, "releases a week that has no HOLD file");
      else if (sha256(h.reason).slice(0, 16) !== j.code) hold(f, "its code isn't the HOLD's (sha256 of its reason, first 16)");
      else publish.push(f);
      continue;
    }
    if (!(now >= k.end(w) && now < k.due(w))) { hold(f, "not inside the vault's 3 days for that week, by this job's clock"); continue; }
    const src = okWeeks.get(w) ?? pubWeek(w);
    if (!src || src.state !== "final") { hold(f, "its week isn't final (published or in this run)", false); continue; }
    let want = null;
    try { want = canon(vaultFileOf(src, tally(src, cfg))); } catch (e) { want = null; }
    if (want === null || want !== canon(j)) { hold(f, "its rows or winners aren't the ones recomputed from the final week file"); continue; }
    publish.push(f);
  }
  return { publish, held };
}

/** The publish job's entry point: node - <in> <pub> <out-list> (games from KIT_GAMES, clock from CHECK_NOW_MS or now). */
export function main(argv = process.argv.slice(2), env = process.env) {
  const [inRoot, pubRoot, listFile] = argv;
  const games = JSON.parse(env.KIT_GAMES || "[]");
  const now = env.CHECK_NOW_MS ? Number(env.CHECK_NOW_MS) : Date.now();
  const lines = [];
  let alert = false;
  const top = fs.existsSync(inRoot) ? fs.readdirSync(inRoot) : [];
  for (const f of top) if (!games.some((g) => g.slug === f)) { console.log(`::error::held, not published: ${f}: not a kit game on this branch`); alert = true; }
  for (const g of games) {
    try {
      const r = checkGame(g, path.join(inRoot, g.slug), path.join(pubRoot, g.slug), now);
      for (const h of r.held) {
        console.log(`${h.alert ? "::error::" : "::notice::"}held, not published: ${g.slug}/${h.name}: ${h.why}`);
        if (h.alert) alert = true;
      }
      for (const f of r.publish) lines.push(`${g.slug}/${f}`);
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
