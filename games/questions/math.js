// Daily Questions (game 1): the weekly scoring the results recorder pays from, from the vault's rule week on (Vault v6.1,
// D-116). Pure functions only: no network, no clock, no randomness. The publish job in .github/workflows/games.yml runs
// its own copy of these rules (Python) on the published inputs, and tests/math.test.mjs checks the two agree over
// thousands of random weeks.
//
// The rules are the contract's old settle rules, unchanged (Kpred.ts settleInternal; owner 4 Nov: "Questions keeps its
// entry rules"):
//   - 1 point per correct answer. A void question (outcome 1000) doesn't count; nor does a question that locks after
//     the week's Saturday (D-129: nothing on Sunday counts for the week; the schedule has none).
//   - "counted" = answers to questions that count. A voided entry has no points and no counted answers.
//   - Staked: not voided, stake > 0 and stake >= the week's minimum, at least 2 counted answers, at least 1 point.
//     `stake` is the entry's stake (the lowest that week, as the vault's qEntry).
//   - Free: not voided, the week's peak stake below the minimum (someone staked at the start who withdrew is not free),
//     at least 2 counted answers, at least 1 point.
//   - First / second (always filled, VAULT_STANDARD §6; the free-prize switch decides whether they're paid): the free
//     players with the best points; ties share their place, and a tie for 1st leaves 2nd empty (D-034).
//     Up to 10 wallets per place (the vault's limit). More than 10 qualifying for one place: exactly 10 are paid,
//     chosen by the earlier score time, then the address (owner, 5 Nov). A place is never left empty because of the
//     cap. Score time: entries on chain don't store when an answer was sent, so a player's score time is the lock time
//     of the question that gave them their last point (when their final score was fixed on chain).

export const VOID = 1000;                 // a voided question's outcome on chain
export const MAX_PLACE = 10;              // the vault's limit per prize place
export const DAY = 86400000;

const big = (x) => BigInt(x ?? 0);

/** One answer: correct when the question's outcome (winning option + 1) is the answer's option + 1. */
export const correct = (outcome, option) => Number(outcome) !== VOID && Number(outcome) > 0 && Number(outcome) === Number(option) + 1;
const cmpAddr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * One week's results.
 *   week:      { start }                                 the week's start (UTC ms); questions locking after start + 6 days
 *                                                        (Sunday 00:00) are left out
 *   questions: [[id, outcome, lockTime], …]               outcome 0 = not resolved yet, 1000 = void, k = option k − 1
 *   players:   [[address, stake, peak, voided, [[questionId, option], …]], …]   stake / peak as decimal strings
 *   min:       the week's minimum stake (decimal string)
 * Returns { complete, missing, rows, vault, prizes }:
 *   complete   every question that counts is resolved (else the week can't be scored yet)
 *   missing    answers to question ids not in `questions` (a read that missed a question: never score then)
 *   rows       one per player with at least one answer: { a, pts, counted, answers, scoreAt, staked, free, ranked, board, place }
 *              (scoreAt: the lock time of the question that gave the last point; 0 with no points)
 *              board "staked" = held the minimum at some point that week (LEADERBOARD_STANDARD §1), else "free";
 *              ranked = in the vault's rows; place = 1 + players on the same board with more points
 *   vault      { rows: [{ player, points }], first: [...], second: [...] }   rows by points, then address
 *   prizes     [{ player, place }] for first / second
 */
export function scoreWeek({ week, questions, players, min }) {
  const sunday = Number(week.start) + 6 * DAY;
  const out = new Map();
  let complete = true;
  for (const [id, outcome, lock] of questions) {
    const counts = Number(lock) <= sunday;
    if (counts && Number(outcome) === 0) complete = false;
    out.set(Number(id), { outcome: Number(outcome), counts, lock: Number(lock) });
  }
  const m = big(min);
  const rows = [], missing = [];
  for (const [a, stakeS, peakS, voided, answers] of players) {
    if (!answers.length) continue;
    let pts = 0, counted = 0, scoreAt = 0;
    for (const [qid, option] of answers) {
      const q = out.get(Number(qid));
      if (!q) { missing.push(Number(qid)); continue; }
      if (voided || !q.counts || q.outcome === VOID || q.outcome === 0) continue;
      counted++;
      if (q.outcome === Number(option) + 1) { pts++; if (q.lock > scoreAt) scoreAt = q.lock; }
    }
    const stake = voided ? 0n : big(stakeS);
    const peak = big(peakS) > stake ? big(peakS) : stake;
    const ok = !voided && counted >= 2 && pts >= 1;
    const staked = ok && stake > 0n && stake >= m;
    const free = ok && peak < m;
    rows.push({ a, pts, counted, answers: answers.length, scoreAt, staked, free, ranked: staked, board: peak >= m && !voided ? "staked" : "free", place: 0 });
  }
  // Places per board: 1 + the number of players on the same board with more points.
  for (const b of ["staked", "free"]) {
    const xs = rows.filter((r) => r.board === b);
    for (const r of xs) r.place = 1 + xs.filter((o) => o.pts > r.pts).length;
  }
  rows.sort((u, v) => (u.board === v.board ? 0 : u.board === "staked" ? -1 : 1) || v.pts - u.pts || cmpAddr(u.a, v.a));
  const vrows = rows.filter((r) => r.staked).map((r) => ({ player: r.a, points: r.pts }));
  const fr = rows.filter((r) => r.free);
  const best = fr.reduce((x, r) => Math.max(x, r.pts), 0);
  // The wallets paid for one place: everyone tied on it, or, past 10, the 10 with the earlier score time, then address.
  const pick = (xs) => xs.sort((u, v) => u.scoreAt - v.scoreAt || cmpAddr(u.a, v.a)).slice(0, MAX_PLACE).map((r) => r.a).sort(cmpAddr);
  const tiedFirst = fr.filter((r) => r.pts === best && best > 0);
  const first = pick(tiedFirst);
  const rest = fr.filter((r) => r.pts < best);
  const next = rest.reduce((x, r) => Math.max(x, r.pts), 0);
  const second = tiedFirst.length === 1 ? pick(rest.filter((r) => r.pts === next && next > 0)) : [];
  const prizes = [...first.map((p) => ({ player: p, place: 1 })), ...second.map((p) => ({ player: p, place: 2 }))];
  return { complete, missing: [...new Set(missing)].sort((x, y) => x - y), rows, vault: { rows: vrows, first, second }, prizes };
}
