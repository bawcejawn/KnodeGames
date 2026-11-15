// Survivor (game 3): the rules, in one file shared by the kit recorder (games/survivor/recorder.ts) and the page
// (survivor.js). Pure functions only: no network, no clock, no randomness, no files.
//
// RULES (owner decisions 27 Oct – 12 Nov 2026; .ai/games/Survivor.md is the plain-language copy)
// - A season is two vault weeks. It plays Monday to Saturday of each week: 12 play days. Sundays rest (WEEK_CYCLE:
//   multi-week seasons rest on their Sundays; owner 12 Nov): no pick is due and no life is lost on a Sunday.
//   Season 1 starts on vault week FIRST_WEEK (7: Mon 7 Dec 2026, owner 14 Nov). Season 1 is unpaid practice and
//   Season 2 is the first paid season (owner 12 Nov, option C); what pays is decided by the vault registration and
//   SURVIVOR_PRIZES_FROM_WEEK, never by this file.
// - One pick a day: the producer you think will NOT land in the day's out-zone. Season day n is Picks contract game 3,
//   round = the UTC day number (round_size 1 day). The contract locks a day 5 minutes before it starts and opens it
//   7 days ahead. You are in the season if you have a pick for season day 1; nobody joins later.
// - Each day is scored by the shared VHP ruler (RULE_VERSION 4): one ruler card per UTC day. The field is the card's
//   producers with entry that aren't void. A producer's day score is its fpct (field percentile of its credited
//   blocks against its expected blocks: 0 = unluckiest, 1,000,000 = luckiest), so a big and a small producer have the
//   same chance (the ruler's daily fairness runs: 0.94–1.07 of fair). Kept to thousandths here (0–999).
// - The out-zone grows from a quarter of the field on day 1 to half on day 12: outSize(m, n) = floor(m × (10 + n) ÷ 44).
//   The producers whose score is below the (out + 1)-th lowest are out; ties at the line are safe.
// - 2 lives. You lose one when your producer lands in the out-zone, or when your pick can't count: no pick, a producer
//   not in the day's field, or a producer you already used this season (each producer once a season).
// - A void producer (its VHP moved more than −12% / +50% during the day, the ruler's daily band) is out of that day's
//   field only. A pick on it costs NO life, and the producer still counts as used (owner 12 Nov).
// - A day with no ruler card 48 hours after it ends doesn't count (owner 14 Nov; the platform's 48 h rule): nobody loses a
//   life, no pick is used, and the season's day numbers don't move (the next day is still day n + 1). Recorded by the kit
//   as a fallback round (K8), alerted, and never re-decided once published.
// - Two boards (owner 30 Oct): wallets staked in Survivor in either week of the season play the staked board; everyone
//   else the free board. Each board has its own safety net and its own end, so one board never changes the other.
//   Safety net: if nobody on a board is safe that day (every pick landed in the out-zone or couldn't count), nobody on
//   that board loses a life for the out-zone; a pick that couldn't count still costs its life. A board ends after the
//   day that leaves 2 or fewer of its players in (if it started with more than 2), when none is left, or after day 12.
// - Ranking (per board): lasted longest (still in, or out later), then more lives, then the higher total score of your
//   counted picks. Equal on all three: the same place.
//
// POINTS FOR THE KIT (the kit adds a week's round points; GAME_KIT.md §2). A wallet's standing after season day n is one
// whole number, standing(x) = (days × 3 + lives) × 2^14 + total, where days = season days played while in (the
// knockout day included), lives 0–2 and total = the sum of its counted picks' scores (thousandths, at most 12 × 999 <
// 2^14). Bigger standing = better place, exactly as rank() orders players, so the week's tally ranks the board as the
// season stands at the week's end (owner 29 Oct: staked weekly points come from the standings at each week's end).
// A round's points = standing after that day − standing before it, except the week's first play day, which carries the
// whole standing (the earlier week included). A day never lowers a standing (+1 day is worth more than a lost life),
// so points are never negative. A week's points add up to the standing at the week's end; the maximum is
// (12 × 3 + 2) × 2^14 + 2^14 − 1 = 638,975.
//
// NOT IN THIS FILE: the free prize's extra conditions (1 VHP held at every daily check, free in both weeks, not knocked
// out by a pick that couldn't count, 3+ such players). The free prize is OFF (D-081, D-082) and stays OFF until the
// kit can apply them (kit needs K3 and K5, docs/SURVIVOR.md "Before the free prize can be switched on").

export const GAME_ID = 3;
export const DAY = 86400000;
export const WEEK = 7 * DAY;
/** The vault's week 0 starts Mon 19 Oct 2026 00:00 UTC (UTC day 20745); week 4 = Mon 16 Nov 2026 = "Week 1". */
export const GENESIS = 20745 * DAY;
/** Season 1's first vault week: week 7 = Mon 7 Dec 2026 (owner, 14 Nov). Season 1 (weeks 7–8) is unpaid practice;
 *  Season 2 (weeks 9–10, from Mon 21 Dec) is the first paid season (the vault's from_week = 9). Must equal game.json
 *  firstWeek (a test checks): the kit counts seasons from the first week it records. */
export const FIRST_WEEK = 7;
export const SEASON_WEEKS = 2;
export const PLAY_DAYS_PER_WEEK = 6;                       // Monday to Saturday
export const SEASON_DAYS = SEASON_WEEKS * PLAY_DAYS_PER_WEEK;   // 12
export const LIVES = 2;
export const LEAD_MS = 5 * 60000;                          // the Picks contract locks a day 5 minutes before it starts
export const AHEAD_MS = 7 * DAY;                           // … and opens it 7 days ahead
export const OUT_A = 10, OUT_B = 44;                       // outSize(m, n) = floor(m × (OUT_A + n) ÷ OUT_B)
export const SCALE = 16384;                                // 2^14: standing = (days × 3 + lives) × SCALE + total
export const MAX_ROUND_POINTS = (SEASON_DAYS * 3 + LIVES) * SCALE + SCALE - 1;   // 638,975
/** One letter a day in a player's log: s safe, o out-zone (life lost), v saved by the net, x void producer (no life
 *  lost, producer used), n no pick, f not in the field, u producer already used. */
export const CODE = Object.freeze({ safe: "s", out: "o", saved: "v", void: "x", none: "n", field: "f", used: "u", skip: "-" });
/** A day's ruler card must exist by 48 hours after the day ends, or the day doesn't count (owner 14 Nov). */
export const NO_CARD_GRACE_MS = 48 * 3600000;
/** Why a day was decided without its ruler card (recorded with the round in the week file's fallbacks). */
export const SKIP_WHY = "no ruler card 48 h after the day ended: the day doesn't count (no life lost, no pick used)";

/** The ruler card settings Survivor uses for a day (the Race's and Fantasy's values; confirmed per game with the
 *  Ruler chat). The window is filled per day by the recorder from block heights. */
export const CARD = Object.freeze({ game: GAME_ID, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true,
  pooled: Object.freeze(["1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"]) });
export const CARD_BLOCKS = 7200;                           // the card's size window: the 6 hours before the lock

const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const two = (n) => (n < 10 ? "0" : "") + n;

// ── the calendar ──
export const dayNo = (t) => Math.floor(t / DAY);
export const weekOf = (t) => Math.floor((t - GENESIS) / WEEK);
export const weekStart = (w) => GENESIS + w * WEEK;
/** yyyymmdd of a UTC day start (the ruler card's round). */
export function ymd(t) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`;
}
/** The season a vault week belongs to: { season (1, 2, …), k (0 = its first week, 1 = its second), startWeek }, or
 *  null before Season 1 or while no launch is set. */
export function seasonOfWeek(w, first = FIRST_WEEK) {
  if (!Number.isInteger(first) || !Number.isInteger(w) || w < first) return null;
  const s = Math.floor((w - first) / SEASON_WEEKS);
  return { season: s + 1, k: w - first - s * SEASON_WEEKS, startWeek: first + s * SEASON_WEEKS };
}
/** The play days (UTC day starts, ms) of a vault week, with their season day number n (1–12). Empty before Season 1. */
export function playDaysOf(w, first = FIRST_WEEK) {
  const s = seasonOfWeek(w, first);
  if (!s) return [];
  const out = [];
  for (let i = 0; i < PLAY_DAYS_PER_WEEK; i++) out.push({ day: weekStart(w) + i * DAY, n: s.k * PLAY_DAYS_PER_WEEK + i + 1 });
  return out;
}
/** Every play day of a season (n = 1 … 12). */
export function seasonDays(season, first = FIRST_WEEK) {
  if (!Number.isInteger(first) || !Number.isInteger(season) || season < 1) return [];
  const w0 = first + (season - 1) * SEASON_WEEKS;
  return [...playDaysOf(w0, first), ...playDaysOf(w0 + 1, first)];
}
/** A UTC day (start, ms) → its season and season day, or null (Sunday, before Season 1, no launch). */
export function seasonDayOf(day, first = FIRST_WEEK) {
  const s = seasonOfWeek(weekOf(day), first);
  if (!s) return null;
  const i = Math.floor((day - weekStart(weekOf(day))) / DAY);
  if (i >= PLAY_DAYS_PER_WEEK) return null;
  return { season: s.season, n: s.k * PLAY_DAYS_PER_WEEK + i + 1, day: weekStart(weekOf(day)) + i * DAY };
}
/** The time from which the Picks contract refuses a pick for the day starting at `day` (23:55 UTC the night before). */
export const lockTime = (day) => day - LEAD_MS;
/** Is the play day starting at `day` open for a pick at time t? The contract's own rule (round target = day start). */
export const isOpen = (day, t) => t < lockTime(day) && day - t <= AHEAD_MS;

// ── a day, from its ruler card ──
/** How many producers are in the out-zone on season day n (1–12) with a field of size m. */
export function outSize(m, n) {
  const k = n < 1 ? 1 : n > SEASON_DAYS ? SEASON_DAYS : n;
  return Math.floor((m * (OUT_A + k)) / OUT_B);
}
/** A producer's day score from its card fpct (decimal millionths): thousandths, 0–999. */
export function scoreOf(fpct) {
  const t = String(fpct);
  if (!/^(0|[1-9][0-9]{0,6})$/.test(t) || Number(t) > 1000000) throw new Error(`fpct ${t.slice(0, 20)} is not a millionths value`);
  const s = Math.floor(Number(t) / 1000);
  return s > 999 ? 999 : s;
}
/** One day's outcome from its scored ruler card (cardJson parsed): the field (entry, not void) with each producer's
 *  score, the void producers, and the out-zone. { round, n, field: [[a, score]] best first (ties: address), out: [a],
 *  void: [a] }. */
/** The result of a day that doesn't count (no ruler card after the 48 h grace): nothing is scored. */
export const skipDay = (round, n) => ({ round: String(round), n, field: [], out: [], void: [], skip: true });
export function dayFromCard(card, n) {
  if (!card || !Array.isArray(card.producers)) throw new Error("a ruler card with producers is needed");
  const field = [], voids = [];
  for (const p of card.producers) {
    if (!isAddr(p.a)) throw new Error("a card producer without an address");
    if (p.entry && p.void) voids.push(p.a);
    else if (p.entry && p.fpct !== null && p.fpct !== undefined) field.push([p.a, scoreOf(p.fpct)]);
  }
  field.sort((x, y) => y[1] - x[1] || cmpStr(x[0], y[0]));
  voids.sort(cmpStr);
  return { round: String(card.round), n, field, out: outOf(field, n), void: voids };
}
/** The out-zone of a field [[a, score]]: below the (out + 1)-th lowest score; ties at the line are safe. */
export function outOf(field, n) {
  const o = outSize(field.length, n);            // always below the field's size (at most half)
  if (!o) return [];
  const asc = field.map((f) => f[1]).sort((x, y) => x - y);
  const line = asc[o];
  return field.filter((f) => f[1] < line).map((f) => f[0]).sort(cmpStr);
}

// ── a season ──
/** A wallet's picks for the season: [[n, producer], …]. Picks before day 1 or on days the season doesn't have are
 *  ignored. */
const pickOn = (picks, n) => { for (const [m, a] of picks) if (m === n) return a; return null; };

/** Play a season from its days in order (days: [{ n, field, out, void, skip? }] for n = 1, 2, … without gaps; it stops at the
 *  first missing day) and each wallet's picks (Map wallet → [[n, producer]]; a wallet is in the season if it has a pick
 *  for day 1). staked: a Set of wallets on the staked board (staked in Survivor in either week of the season).
 * Returns { players: Map wallet → { board, lives, outN, total, days, used, log, standing }, endN, ends: { staked,
 *  free } } where standing is after the last day played (see POINTS above). */
export function playSeason(days, picks, staked) {
  const ps = new Map();
  for (const [a, list] of picks) {
    if (!isAddr(a) || !Array.isArray(list) || !isAddr(pickOn(list, 1))) continue;
    ps.set(a, { board: staked && staked.has(a) ? "staked" : "free", lives: LIVES, outN: null, total: 0, days: 0, used: [], log: "" });
  }
  const B = { staked: { started: 0, end: null }, free: { started: 0, end: null } };
  for (const g of ["staked", "free"]) B[g].started = [...ps.values()].filter((x) => x.board === g).length;
  let endN = 0;
  for (let i = 0; i < days.length && i < SEASON_DAYS; i++) {
    const d = days[i];
    if (!d || d.n !== i + 1) break;
    if (B.staked.end !== null && B.free.end !== null) break;
    if (d.skip === true) {
      // A day that doesn't count: no life, no pick used, no day played; only the season's last day still ends the boards.
      for (const x of ps.values()) if (x.outN === null && B[x.board].end === null) x.log += CODE.skip;
      endN = d.n;
      for (const g of ["staked", "free"]) if (B[g].end === null && d.n >= SEASON_DAYS) B[g].end = d.n;
      continue;
    }
    const score = new Map(d.field), out = new Set(d.out), voids = new Set(d.void);
    const fate = [];
    for (const [a, x] of ps) {
      if (x.outN !== null || B[x.board].end !== null) continue;
      const p = pickOn(picks.get(a), d.n);
      const code = !isAddr(p) ? "none"
        : x.used.includes(p) ? "used"
        : voids.has(p) ? "void"
        : !score.has(p) ? "field"
        : out.has(p) ? "out" : "safe";
      fate.push({ x, p, code });
    }
    const allLose = {};
    for (const g of ["staked", "free"]) {
      const mine = fate.filter((f) => f.x.board === g);
      allLose[g] = mine.length > 0 && mine.every((f) => f.code !== "safe" && f.code !== "void");
    }
    for (const { x, p, code } of fate) {
      x.days++;
      if (code === "safe" || code === "out") { x.used.push(p); x.total += score.get(p); }
      if (code === "void") x.used.push(p);
      if (code === "safe" || code === "void") { x.log += CODE[code]; continue; }
      if (code === "out" && allLose[x.board]) { x.log += CODE.saved; continue; }
      x.log += CODE[code];
      x.lives--;
      if (x.lives <= 0) x.outN = d.n;
    }
    endN = d.n;
    for (const g of ["staked", "free"]) {
      if (B[g].end !== null) continue;
      const left = [...ps.values()].filter((x) => x.board === g && x.outN === null).length;
      if (left === 0 || (B[g].started > 2 && left <= 2) || d.n >= SEASON_DAYS) B[g].end = d.n;
    }
  }
  for (const x of ps.values()) x.standing = standingOf(x);
  return { players: ps, endN, ends: { staked: B.staked.end, free: B.free.end } };
}
/** standing = (days × 3 + lives) × SCALE + total (see POINTS above). */
export const standingOf = (x) => (x.days * 3 + (x.lives > 0 ? x.lives : 0)) * SCALE + x.total;
/** Decode a standing (the page reads a week's points back): { days, lives, total }. */
export function decodeStanding(v) {
  const hi = Math.floor(v / SCALE);
  return { days: Math.floor(hi / 3), lives: hi % 3, total: v % SCALE };
}
/** Ranking within one board: lasted longest, then lives, then total; equal on all three share a place. */
export function rank(rows) {
  const key = (x) => [x.outN === null ? 99 : x.outN, x.lives, x.total];
  const sorted = [...rows].sort((x, y) => { const a = key(x), b = key(y); return b[0] - a[0] || b[1] - a[1] || b[2] - a[2] || cmpStr(x.a, y.a); });
  let place = 0;
  return sorted.map((x, i) => {
    const p = sorted[i - 1];
    if (!p || key(p).some((v, j) => v !== key(x)[j])) place = i + 1;
    return { ...x, place };
  });
}
/** A round's points for every wallet in the season: standing after day n − standing after day n − 1, or the whole
 *  standing on the week's first play day (firstOfWeek). Wallets not in the season get 0. */
export function roundPoints(days, picks, staked, n, firstOfWeek) {
  const now = playSeason(days.filter((d) => d.n <= n), picks, staked).players;
  const before = firstOfWeek ? null : playSeason(days.filter((d) => d.n < n), picks, staked).players;
  const out = new Map();
  for (const [a, x] of now) {
    const prev = before ? before.get(a)?.standing ?? 0 : 0;
    const pts = x.standing - prev;
    if (pts < 0) throw new Error(`Survivor: ${a}'s standing went down on day ${n} (${prev} → ${x.standing}): a rules bug`);
    out.set(a, pts);
  }
  return out;
}

// ── the free-prize switch (D-081, D-082): the page's strict view, unchanged from the old page ──
/** Does `season` pay the free prize? Only on an explicit ON for both of its weeks in the owner's switches file
 *  (prize-settings:free-prizes.json); anything else is no. The page never promises more than the vault pays. */
export function freePrizeOn(switches, season, first = FIRST_WEEK) {
  if (!Number.isInteger(first) || !Number.isInteger(season) || season < 1 || !switches || switches.v !== 1) return false;
  const w = first + (season - 1) * SEASON_WEEKS;
  return switchOn(switches, w) === true && switchOn(switches, w + 1) === true;
}
function switchOn(s, w) {
  const list = s && s.games && typeof s.games === "object" ? s.games[String(GAME_ID)] : null;
  if (!Array.isArray(list)) return null;
  let on = null;
  for (const c of list) {
    if (!c || !Number.isInteger(c.from) || c.from > w || typeof c.on !== "boolean") continue;
    const set = Date.parse(c.set);
    if (Number.isFinite(set) && set < weekStart(c.from)) on = c.on;
  }
  return on;
}
