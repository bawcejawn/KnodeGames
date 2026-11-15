// Fantasy Producers (game 4) and Weekly Rival (game 5): every rule, as pure functions. The recorder (recorder.ts, on the
// Shared Game Kit) and the page use this one file, so a score shown in the browser and a score recorded always agree.
// No network, no clock, no randomness, no files. Whole numbers only (BigInt where the ruler's numbers are large), so
// JavaScript and Python give the same bytes.
//
// RULES (owner decisions; claude/fantasy/SIM-FANTASY-ON-RULER-2026-11-11.md, TO-ARCHITECTURE-FANTASY-PORT-PREP-2026-11-11.md)
// - A team is 5 different producers from the week's price list, costing at most the week's budget (100, or what the
//   five cheapest cost if more). The first is the captain and scores double.
// - Monday's team may be any valid team. After that, one change a day: one swap, or moving the captain's armband to a
//   producer already on the team. A producer swapped in may also become captain as part of that one swap, whoever wore
//   the armband before (FC-22, owner 11 Nov). An invalid pick is ignored and yesterday's team plays. A day with no pick
//   keeps yesterday's team. Last week's team carries into Monday only if it fits the new list.
// - Every day is measured by the VHP Ruler (RULE_VERSION 4): each producer's `credited` and `expected` blocks for that
//   UTC day (millionths of a block). A producer's day = 100 × credited ÷ expected, at most 150 (owner 11 Nov), kept in
//   hundredths (10000 = 100.00). A VOID day (its VHP left the ruler's band that day) scores 0 and is left out of its
//   form. A quiet or offline day is NOT a void: it scores what it earned (possibly 0) and counts in its form (owner 11 Nov).
// - Price list (write-once, Saturday 00:00 UTC before the week): the pool is the producers with the ruler's `entry`
//   (the 80% form gate) on the last form day's card; form = floor(10000 × Σ credited ÷ Σ expected) over the 7 form days
//   (void days left out); price = 20 + 1.5 × (form − median) ÷ 100, rounded half up, between 8 and 40; no form → 20.
// - Weekly Rival (game 5): one challenge a week, records only. A match counts when both are staked and both scored.

export const TEAM = 5;
export const BUDGET = 100;
export const CAP = 15000;                     // 150.00: the most a producer scores in a day (owner 11 Nov; was 130)
export const CAPTAIN = 2;
export const PRICE = { base: 20, min: 8, max: 40, none: 20 };   // per 1.5 index points: floor((4000 + 3 × Δ + 100) ÷ 200)
export const FORM_DAYS = 7;
export const PLAY_DAYS = 6;                   // Monday to Saturday; Sunday is the fun round (D-129, D-150)
export const DAY = 86400000;
export const GAMES = Object.freeze({ team: 4, rival: 5 });
export const VERSION = 1;                     // the price list's format

export const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const big = (x) => { if (typeof x === "bigint" && x >= 0n) return x; if (typeof x === "number" && Number.isSafeInteger(x) && x >= 0) return BigInt(x); if (typeof x === "string" && /^[0-9]+$/.test(x)) return BigInt(x); throw new Error(`not a whole number ≥ 0: ${x}`); };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── days ──
/** yyyymmdd of a UTC day (ms at 00:00), with no Date: days since 1970-01-01 → civil date (H. Hinnant's algorithm). */
export function ymd(dayMs) {
  if (!Number.isSafeInteger(dayMs) || dayMs % DAY !== 0) throw new Error("ymd: not the start of a UTC day");
  const z = dayMs / DAY + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9, y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return String(y * 10000 + m * 100 + d);
}
/** The UTC days the price list for a week starting at `start` uses: 7 form days, Friday to Thursday before the list is
 *  made (all at least a day old by Saturday 00:00); the pool comes from the last form day's card. */
export const formDays = (start) => Array.from({ length: FORM_DAYS }, (_, i) => start - (10 - i) * DAY);
/** The week's 7 rounds: Monday to Saturday play, then Sunday's fun round (the Saturday team plays on). */
export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => start + i * DAY);
/** When a still-flagged day of the week starting at `start` is decided anyway (as 0 for every team): Tuesday 00:00 UTC
 *  after the week, a day after it ends and well before the vault's Thursday backstop (owner, 12 Nov; #G-42 G42-5). */
export const flaggedCutoff = (start) => start + 8 * DAY;
/** How long a day with no ruler card at all (the ruler's data never reached it) waits before it counts as 0 for every
 *  team: 48 hours after the day ends (owner, 13 Nov: "after the 48-hour grace, the game's own simplest fixed rule"). */
export const NO_CARD_GRACE = 2 * DAY;
/** The most Weekly Rival matches a week records (records only): far more than players, and under the kit's 256 KB
 *  extras cap (#G-42 G42-3). */
export const MAX_RIVAL = 2500;

// ── one producer's day ──
/** A producer's points for a day from its ruler row { credited, expected, void } (millionths): hundredths, at most CAP.
 *  A void row scores 0. A row with nothing expected scores 0. */
export function producerPoints(row) {
  if (!row || row.void === true) return 0;
  const ex = big(row.expected), cr = big(row.credited);
  if (ex <= 0n) return 0;
  const p = (10000n * cr) / ex;
  return p > BigInt(CAP) ? CAP : Number(p);
}
/** A team's points for a day: the sum of its producers', the captain's twice. rows: { [address]: row }. */
export function dayPoints(team, rows) {
  if (!Array.isArray(team)) return 0;
  let s = 0;
  team.forEach((a, i) => { s += producerPoints(rows?.[a]) * (i === 0 ? CAPTAIN : 1); });
  return s;
}

// ── the price list ──
/** Form over some days: floor(10000 × Σ credited ÷ Σ expected), void days left out; null if nothing was expected.
 *  days: [{ rows: { [address]: row } }]. A day with no row for the producer has no data and doesn't count. */
export function formOf(a, days) {
  let cr = 0n, ex = 0n, n = 0;
  for (const d of days) {
    const r = d?.rows?.[a];
    if (!r || r.void === true) continue;
    cr += big(r.credited); ex += big(r.expected); n++;
  }
  return { form: ex > 0n ? Number((10000n * cr) / ex) : null, days: n };
}
/** The lower middle of the known forms, or null. */
export function medianOf(forms) {
  const f = forms.filter((x) => Number.isSafeInteger(x)).sort((x, y) => x - y);
  return f.length ? f[Math.floor((f.length - 1) / 2)] : null;
}
/** A price from a form and the median (both hundredths): 20 + 1.5 × (form − median) ÷ 100, half up, clamped 8–40. */
export function priceOf(form, median) {
  if (!Number.isSafeInteger(form) || !Number.isSafeInteger(median)) return PRICE.none;
  const p = Math.floor((4000 + 3 * (form - median) + 100) / 200);
  return Math.min(PRICE.max, Math.max(PRICE.min, p));
}
/** The week's price list (the `data` of inputs/W<week>.json).
 *  start: the week's Monday 00:00 UTC; card: the ruler card settings; formCards: the 7 form days' scored cards, oldest
 *  first, each { round, rows: { [address]: { credited, expected, void, entry } }, flagged? }. A FLAGGED card (a bad or
 *  rebuilt hour in what it reads) counts for nobody: its day is left out of every producer's form (owner, 12 Nov: a
 *  flagged day is the same for everyone). The pool is the producers with `entry` on the last unflagged form day's card.
 *  (The kit lists every card's settings and sha256 in the inputs file itself.) */
export function makePriceList(start, card, formCards) {
  if (!Array.isArray(formCards) || formCards.length !== FORM_DAYS) throw new Error(`the price list needs ${FORM_DAYS} form days`);
  const want = formDays(start).map(ymd);
  formCards.forEach((c, i) => { if (c?.round !== want[i]) throw new Error(`form day ${i + 1} must be ${want[i]}, not ${c?.round}`); });
  const used = formCards.filter((c) => c.flagged !== true), last = used[used.length - 1];
  if (!last) throw new Error("every form day's card is flagged: no price list");
  const pool = Object.keys(last.rows).filter((a) => isAddr(a) && last.rows[a].entry === true).sort(cmp);
  const forms = pool.map((a) => formOf(a, used)), median = medianOf(forms.map((f) => f.form));
  const rows = pool.map((a, i) => ({ a, form: forms[i].form, days: forms[i].days, price: priceOf(forms[i].form, median) }));
  const cheapest = rows.map((r) => r.price).sort((x, y) => x - y).slice(0, TEAM).reduce((s, x) => s + x, 0);
  return {
    v: VERSION, ruleVersion: 4, start, card,
    rules: { team: TEAM, budget: BUDGET, cap: CAP, captain: CAPTAIN, price: { base: 20, per: "1.5", min: PRICE.min, max: PRICE.max, none: PRICE.none } },
    poolDay: last.round,
    formDays: formCards.map((c) => c.round),
    flaggedDays: formCards.filter((c) => c.flagged === true).map((c) => c.round),
    median, budget: Math.max(BUDGET, cheapest), pool: rows,
  };
}

// ── teams ──
/** Is a pick (captain first) a valid team on this price list? { ok, why?, cost }. */
export function checkTeam(list, pl) {
  if (!Array.isArray(list) || list.length !== TEAM) return { ok: false, why: `a team is ${TEAM} producers` };
  if (new Set(list).size !== TEAM) return { ok: false, why: "the same producer twice" };
  const price = new Map((pl?.pool || []).map((p) => [p.a, p.price]));
  let cost = 0;
  for (const a of list) { if (!price.has(a)) return { ok: false, why: "a producer not on this week's price list" }; cost += price.get(a); }
  if (cost > (pl.budget || BUDGET)) return { ok: false, why: `over the budget (${cost} of ${pl.budget || BUDGET})`, cost };
  return { ok: true, cost };
}
/** Changes from yesterday's team to today's: producers swapped out, plus 1 if the armband moved to a producer that was
 *  already on the team. A swapped-in producer taking the armband is part of its own swap (FC-22). */
export function changes(prev, next) {
  const old = new Set(prev), out = prev.filter((a) => !next.includes(a)).length;
  return out + (prev[0] !== next[0] && old.has(next[0]) ? 1 : 0);
}
/** The team after a day's pick. cur: yesterday's team (or null); first: Monday (any valid team allowed).
 *  Returns { team, note? }: an invalid pick is ignored with a note, and yesterday's team stays. */
export function nextTeam(cur, pick, pl, first) {
  if (!Array.isArray(pick)) return { team: cur };
  if (cur && pick.length === cur.length && pick.every((a, i) => a === cur[i])) return { team: cur };
  const c = checkTeam(pick, pl);
  if (!c.ok) return { team: cur, note: `ignored: ${c.why}` };
  if (!first && cur && changes(cur, pick) > 1) return { team: cur, note: "ignored: more than one change from yesterday" };
  return { team: [...pick] };
}

// ── Weekly Rival (records only) ──
/** At most MAX_RIVAL of the week's matches (records only), and how many were left out (#G-52 G52-4: never silently):
 *  the matches with the most points between the two players are kept, ties by address; the kept ones stay sorted by
 *  address. points: Map address → week points. */
export function capMatches(all, points) {
  if (all.length <= MAX_RIVAL) return { rival: all, dropped: 0 };
  const sum = (m) => (points?.get(m[0]) ?? 0) + (points?.get(m[1]) ?? 0);
  const kept = [...all].sort((x, y) => sum(y) - sum(x) || cmp(x[0], y[0]) || cmp(x[1], y[1])).slice(0, MAX_RIVAL);
  return { rival: kept.sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1])), dropped: all.length - MAX_RIVAL };
}
/** The week's matches. challenges: [[challenger, target]]; points: Map address → week points; staked: Set of staked
 *  wallets. A match counts when both differ, both are staked and both scored. Mutual challenges are one match.
 *  Returns [[a, b, mutual (0/1), result ("a" | "b" | "d")]] sorted, a = the challenger. */
export function matches(challenges, points, staked) {
  const seen = new Map();
  for (const [a, b] of challenges || []) {
    if (!isAddr(a) || !isAddr(b) || a === b) continue;
    if (!(staked?.has(a) && staked?.has(b))) continue;
    const pa = points?.get(a) ?? 0, pb = points?.get(b) ?? 0;
    if (!(pa > 0 && pb > 0)) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) { seen.get(key)[2] = 1; continue; }
    seen.set(key, [a, b, 0, pa > pb ? "a" : pb > pa ? "b" : "d"]);
  }
  return [...seen.values()].sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
}
