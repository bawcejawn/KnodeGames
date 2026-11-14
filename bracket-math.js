/* Producer Bracket: the shared math. The page (bracket.js) and the recorder (bot/games/bracket.ts) both use this one
 * file, so a bracket scored in the browser and one scored by the bot always agree. No network, no page, no wallet.
 *
 * THE WEEK (D-141, owner 2026-11-05: "one round a day, like a 24-hour sprint"; capped at 32 producers so one pick still
 * fits the Picks contract's number; on the weekly rhythm, standards/WEEK_CYCLE.md, D-125 / D-129)
 * - Seeding: Sunday 00:00 UTC before the week (the review day of the week before), from exact VHP averaged over the
 *   28,800 blocks (about a day) before it. Repo Lens #E-3 M-6: a producer's seeding VHP is the LOWER of that average and
 *   its average at last week's seeding (when it had one), so lending a producer VHP for one day buys nothing; it has
 *   to be held across two seedings a week apart. The field: producers that signed in that day and would expect at
 *   least 10 blocks in a 6-hour race (the race field rule, on that seeding VHP), biggest first (equal: address order).
 * - Size: the largest power of two that fits: 32 or more → 32 (5 rounds, Tue–Sat); 16–31 → the top 16 (4 rounds,
 *   Wed–Sat); 8–15 → the top 8 (3 rounds, Thu–Sat); under 8 → no bracket that week. No byes.
 * - One round a day, and the final is always on Saturday: round r of an R-round bracket is played on the week's UTC
 *   day (6 − R + r) (0 = Monday). Nothing is played on Sunday, the review day.
 * - Picks open at seeding (Sunday 00:00 UTC) and lock Monday 23:55 UTC for every size (one Picks game, one lock):
 *   two days to fill a bracket in, and the lock is always before the first round's day.
 * - VHP follows the KnodeGames VHP standard (vhp-standard.js, D-058): exact effective VHP rebuilt from the chain's
 *   own VHP events. A matchup is won by the higher day index:
 *     index = credited blocks ÷ expected blocks,
 *     baseline = the producer's effective VHP just before the day's first block,
 *     expected = baseline × Σ over the day's blocks of 1 ÷ (effective VHP of every active producer),
 *     credited = Σ over the blocks it signed of min(1, baseline ÷ its effective VHP at that block).
 *   The Σ is the same for both producers, so a matchup comes down to credited blocks per baseline. Moving VHP away
 *   during the day only lowers its real chances; VHP added during the day (its own or sent by anyone) is neutral.
 *   An exact tie goes to the lower seed (the underdog).
 * - POOLED producers (the Knode Games Pool, i.e. the vault: its VHP is players' stakes, which they can deposit and
 *   withdraw at any time) stay in the field (D-086) and are judged on a RATE index that no deposit or withdrawal can
 *   move (Repo Lens #E-3 H-4): Σ over the blocks it signed of 1 ÷ its effective VHP at that block, divided by the same
 *   Σ q as everyone's expected blocks. For any VHP path its expected value is exactly 1 (a producer holding v signs a
 *   block with chance v ÷ total, worth 1 ÷ v), the same as everyone's index, so timing VHP around 00:00 changes nothing.
 * - FORFEIT (owner 2026-10-28, audit S-5; Repo Lens #E-3 H-5, D-086): a seed whose effective VHP AVERAGED over its
 *   round's day (over the day's blocks) is under half its seeding VHP loses that matchup, whatever its index: moving
 *   VHP away for one block at midnight no longer forfeits; throwing a matchup costs a day of real VHP. If both seeds
 *   forfeit, the index decides. Pooled producers never forfeit (a depositor could otherwise force it, fix-check F-1).
 *   Every producer meeting the field rule stays in the field, Knode Games' own nodes included (D-086).
 *   (D-141: matchups move to the VHP ruler's luck percentile once ruler v2.1 passes its simulations, R-RULER-2; this
 *    index is the rule until then.)
 *
 * THE PICK: one number for the whole bracket (one Picks game, kind NUMBER).
 * - The bracket has size − 1 matchups (31 at most: the number fits 0 … 2^31 − 1), numbered round by round, top to
 *   bottom. Bit n of the number says who wins matchup n in the player's own bracket: 0 = the better (smaller) seed,
 *   1 = the other one. Every number below 2^(size − 1) is a whole, consistent bracket; anything else scores nothing.
 *
 * SCORING: a correct winner scores 1, 2, 4, 8, 16 points by round (round 1 = 1 point), plus 2 for the right champion.
 *   Ranking: points, then a correct champion, then more correct winners, then the EARLIER bracket (the time of its last
 *   change, from the Picks contract, which is its block's time). Identical brackets picked in the same block share
 *   the place (D-087, Repo Lens #E-3 H-6): a block producer that also plays could put its copy of a bracket in the
 *   same block as the original, so a copy CAN tie the original; it can't get ahead of it. All-time boards have no pick
 *   time: ties share there. */
(function (root) {
  "use strict";
  const HOUR = 3600000, DAY = 24 * HOUR, WEEK = 7 * DAY;
  const GENESIS = 1792368000000;               // KnodeGames week 0: Monday 2026-10-19 00:00 UTC (same as race-math)
  const FILE_V = 5;                            // the week file's version: the recorder writes it, the publish job and the
                                               // page accept only it (Repo Lens #E-3 H-1: one shared number). v5 (D-141):
                                               // the one-round-a-day shape; hours carry r and av (H-4, H-5) and re (re-read)
  const SEED_BEFORE = DAY;                     // seeding: Sunday 00:00 UTC before the week (D-141, D-125)
  const LOCK_DAY = 1;                          // picks lock on the week's day 1 (Tuesday) ...
  const LOCK_BEFORE = 5 * 60000;               // ... 5 minutes before it: Monday 23:55 UTC (the Picks game's `lead`)
  const LAST_DAY = 5;                          // the final is always played on Saturday (day 5); Sunday is review day
  const MIN_FIELD = 8;
  const MAX_SIZE = 32, NUMBER_MAX = 2 ** (MAX_SIZE - 1) - 1;   // the Picks game's number range: 0 … 2,147,483,647
  const MIN_K = 10, RACE_BLOCKS = 7200;        // the field rule: at least 10 expected blocks in a 6-hour race
  const CHAMPION_BONUS = 2;
  const FORFEIT_SHARE = 0.5;                   // a round's baseline under half the seeding VHP loses the matchup (S-5)
  const V = root.KVhp;                          // the KnodeGames VHP standard (site/vhp-standard.js, loaded first)
  if (!V) throw new Error("bracket-math.js needs vhp-standard.js loaded first");
  const { ACTIVE_BLOCKS, SEED_BLOCKS, Q_SCALE, VHP_CONTRACT, vhpDeltas, vhpBook, averageCard } = V;
  const GAME_ID = 9;                           // the Bracket's game id in the Picks contract (Block X is 2)
  const MAX_CHANGES = 20, PICKS_PER_DAY = 20;  // the Picks game's limits
  const ROUND_NAMES = { 32: ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Final"],
    16: ["Round of 16", "Quarterfinals", "Semifinals", "Final"], 8: ["Quarterfinals", "Semifinals", "Final"] };

  // ── time ──
  const weekStart = (w) => GENESIS + w * WEEK;
  const weekOf = (t) => (t <= GENESIS ? 0 : Math.floor((t - GENESIS) / WEEK));
  const seedTime = (w) => weekStart(w) - SEED_BEFORE;
  const lockTime = (w) => weekStart(w) + LOCK_DAY * DAY - LOCK_BEFORE;
  /** The week's day (0 = Monday) on which round r of a bracket of `size` is played: the final is on Saturday. */
  const roundDayIndex = (size, r) => LAST_DAY - (roundsOf(size) - 1) + r;
  /** The day (ms start) on which round r of week w is played, for a bracket of `size`. */
  const roundDay = (w, r, size) => weekStart(w) + roundDayIndex(size, r) * DAY;
  /** The Picks contract round for week w: target = round × WEEK + ROUND_OFFSET = Tuesday 00:00 UTC of week w (the lock
   *  is the target minus the game's lead, 5 minutes). */
  const ROUND_OFFSET = (GENESIS + LOCK_DAY * DAY) % WEEK;
  const picksRound = (w) => Math.floor((GENESIS + LOCK_DAY * DAY) / WEEK) + w;
  const weekOfPicksRound = (r) => r - Math.floor((GENESIS + LOCK_DAY * DAY) / WEEK);
  /** The earliest a week may go final (D-125, WEEK_CYCLE.md): Monday 00:00 UTC after it, once Sunday's review is done. */
  const finalFrom = (w) => weekStart(w + 1);

  // ── shape ──
  /** Bracket size for a field of n producers: the largest power of two that fits, 8 to 32 (D-141); 0 = no bracket. */
  const sizeFor = (n) => (n >= 32 ? 32 : n >= 16 ? 16 : n >= MIN_FIELD ? 8 : 0);
  const roundsOf = (size) => Math.round(Math.log2(size));
  const pointsFor = (r) => 2 ** r;
  const maxPoints = (size) => (size ? roundsOf(size) * (size / 2) + CHAMPION_BONUS : 0);
  /** Seeds in bracket line order, so 1 and 2 can only meet in the final: 16 → [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]. */
  function lineOrder(size) {
    let o = [1, 2];
    while (o.length < size) { const n = o.length * 2; o = o.flatMap((s) => (s % 2 ? [s, n + 1 - s] : [n + 1 - s, s])); }
    return o.length === size ? o : [];
  }
  /** Index of the first matchup of round r. */
  const roundOffset = (size, r) => size - size / 2 ** r;

  /** The seeding from a seeding card ({ field, paddock }: averages in VHP, vhp-standard averageCard) and, optionally,
   *  the last seeding's raw averages (address → VHP; Repo Lens #E-3 M-6). Each producer's seeding VHP is the lower of
   *  its average now and then (0 then if it wasn't there, RC-1); the field rule (≥ MIN_K expected blocks in a 6-hour race) is applied
   *  to that, against the card's total. Returns { size, seeds: [address of seed 1, …] (the producers in the bracket),
   *  vhp: [their seeding VHP], out: [the rest of the field], outVhp: [theirs] }. size 0 means no bracket this week. */
  function seeding(card, last) {
    const all = [...(card && Array.isArray(card.field) ? card.field : []), ...(card && Array.isArray(card.paddock) ? card.paddock : [])]
      .filter((r) => r && typeof r.a === "string" && Number.isFinite(r.vhp) && r.vhp > 0);
    // Repo Lens fix-check 2 FL-1: who is in the field is decided here in whole cents (RACE_BLOCKS × cents ≥ MIN_K × total
    // cents), never by a float sum whose order differs between the recorder and the publish job
    const cents = (v) => Math.round(v * 100), totC = all.reduce((t, r) => t + cents(r.vhp), 0);
    const inField = (v) => totC > 0 && RACE_BLOCKS * cents(v) >= MIN_K * totC;
    const before = last instanceof Map ? last : new Map(Object.entries(last && typeof last === "object" ? last : {}));
    const seen = new Set(), rows = [];
    for (const r of all) {
      if (seen.has(r.a)) continue;
      seen.add(r.a);
      if (!inField(r.vhp)) continue;
      // Repo Lens fix-check RC-1: with last week's numbers, a producer missing from them (a fresh address) counts 0
      // there, so moving VHP to a new address for the seeding day buys nothing. Without any (the first bracket, or no
      // seeding in the weeks before), everyone is on today's average.
      const prev = Number(before.get(r.a)), vhp = before.size ? Math.min(r.vhp, Number.isFinite(prev) && prev > 0 ? prev : 0) : r.vhp;
      if (inField(vhp)) rows.push({ a: r.a, vhp });
    }
    rows.sort((x, y) => y.vhp - x.vhp || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
    const size = sizeFor(rows.length), n = Math.min(rows.length, size);
    return { size, seeds: rows.slice(0, n).map((r) => r.a), vhp: rows.slice(0, n).map((r) => r.vhp), out: rows.slice(n).map((r) => r.a), outVhp: rows.slice(n).map((r) => r.vhp) };
  }

  /** Round 1 pairs as seed numbers [better, other]; other = 0 is a bye (no producer in that slot). */
  function firstRound(size, nSeeds) {
    const o = lineOrder(size), out = [];
    for (let i = 0; i < size; i += 2) { const a = Math.min(o[i], o[i + 1]), b = Math.max(o[i], o[i + 1]); out.push([a, b <= nSeeds ? b : 0]); }
    return out;
  }

  /** Play the bracket with a chooser for each matchup: choose(round, matchIndex, better, other) → true if `other` wins.
   *  better/other are seed numbers (other is 0 for a bye, which `better` always wins). Returns { rounds: [[winner seed of
   *  each matchup]], byes: [matchup numbers that were byes] }. */
  function play(size, nSeeds, choose) {
    let pairs = firstRound(size, nSeeds), rounds = [], byes = [];
    for (let r = 0; r < roundsOf(size); r++) {
      const winners = pairs.map(([a, b], m) => {
        if (!b) { byes.push(roundOffset(size, r) + m); return a; }
        return choose(r, m, a, b) ? b : a;
      });
      rounds.push(winners);
      pairs = [];
      for (let i = 0; i < winners.length; i += 2) pairs.push([Math.min(winners[i], winners[i + 1]), Math.max(winners[i], winners[i + 1])]);
    }
    return { rounds, byes };
  }

  /** The bye matchup numbers of a bracket. */
  const byesOf = (size, nSeeds) => play(size, nSeeds, () => false).byes;

  /** Decode a pick. Returns { rounds: [[winner seed of each matchup]] } or null if the number isn't a valid bracket. */
  function decode(number, size, nSeeds) {
    if (!size || typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) return null;
    if (number >= 2 ** (size - 1)) return null;
    const bit = (n) => Math.floor(number / 2 ** n) % 2 === 1;
    for (const b of byesOf(size, nSeeds)) if (bit(b)) return null;
    return { rounds: play(size, nSeeds, (r, m) => bit(roundOffset(size, r) + m)).rounds };
  }

  /** Encode a bracket given as winner seeds per round (same shape as decode's result). Throws if it isn't consistent. */
  function encode(rounds, size, nSeeds) {
    let number = 0;
    const res = play(size, nSeeds, (r, m, a, b) => {
      const w = rounds[r] && rounds[r][m];
      if (w !== a && w !== b) throw new Error(`round ${r + 1} matchup ${m + 1}: winner must be seed ${a} or ${b}`);
      if (w === b) number += 2 ** (roundOffset(size, r) + m);
      return w === b;
    });
    for (let r = 0; r < res.rounds.length; r++) for (let m = 0; m < res.rounds[r].length; m++) {
      if (!rounds[r] || rounds[r][m] !== res.rounds[r][m]) throw new Error(`round ${r + 1} matchup ${m + 1}: not consistent`);
    }
    return number;
  }

  // ── the day index (VHP from the standard) ──
  /** Hour records from blocks. B: { hs, ts, sig, signers }, contiguous, starting at least ACTIVE_BLOCKS before the first
   *  hour. starts: hour starts (ms), in order. base: { dayStart ms: { seed: baseline } } for days whose first hour is
   *  not in `starts` (taken from the recorded hour 0); a day whose first hour is in `starts` gets its baselines there.
   *  Returns one { from, to, n, by, cr, w, q } per start (see vhp-standard windowStats), or throws if a balance is
   *  missing or a baseline unknown. */
  function exactHours(B, starts, seeds, book, base = {}) {
    const out = [], days = new Map(Object.entries(base || {}).map(([d, w]) => [Number(d), w]));
    for (const start of starts) {
      const i0 = lowerBound(B.ts, start), i1 = lowerBound(B.ts, start + HOUR), day = Math.floor(start / DAY) * DAY;
      if (start === day && !days.has(day)) { const w = {}; for (const a of seeds) { const v = book.effective(a, B.hs[i0]); if (v === null) throw new Error(`no VHP balance for ${a}`); w[a] = v; } days.set(day, w); }
      const w = days.get(day);
      if (!w) throw new Error(`no baseline for the day of ${new Date(start).toISOString()}`);
      if (i1 >= B.hs.length) throw new Error(`no block after the hour of ${new Date(start).toISOString()} yet`);   // #E-3 L-3
      const st = V.windowStats(B, i0, i1, seeds, book, w);
      for (const a of seeds) st.cr[a] = Math.round(st.cr[a] * 1e9) / 1e9;
      // #E-3 H-4 / H-5: per seed, r = Σ over the blocks it signed of Q_SCALE ÷ its effective VHP (the pooled rate
      // index), and av = its effective VHP averaged over the hour's blocks (satoshi, whole; the day's average decides
      // forfeits). An hour without blocks has av = its effective VHP at the next block (weight 0 in the day's average).
      const r = {}, av = {}, keep = new Set(seeds);
      for (const a of seeds) { r[a] = 0; av[a] = 0; }
      for (let i = i0; i < i1; i++) {
        for (const a of seeds) { const v = book.effective(a, B.hs[i]); if (v === null) throw new Error(`no VHP balance for ${a}`); av[a] += v; }
        const sg = B.signers[B.sig[i]];
        if (keep.has(sg)) { const v = book.effective(sg, B.hs[i]); if (v > 0) r[sg] += V.Q_SCALE / v; }
      }
      for (const a of seeds) {
        r[a] = Math.round(r[a] * 1e9) / 1e9;
        if (i1 > i0) av[a] = Math.round(av[a] / (i1 - i0));
        else { const v = book.effective(a, B.hs[i0]); if (v === null) throw new Error(`no VHP balance for ${a}`); av[a] = Math.round(v); }
      }
      out.push({ from: i1 > i0 ? B.hs[i0] : B.hs[i0], to: i1 > i0 ? B.hs[i1 - 1] : B.hs[i0] - 1,
        n: i1 - i0, by: st.by, cr: st.cr, w: st.w, q: Math.round(st.q * 1e9) / 1e9, r, av });
    }
    return out;
  }
  const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const hourOk = (h) => !!(h && obj(h.by) && obj(h.cr) && obj(h.w) && obj(h.r) && obj(h.av) && Number.isFinite(h.q) && h.q >= 0 && Number.isInteger(h.n) && h.n >= 0);
  /** Day totals per seed from hours (in order): blocks, credited, baseline (satoshi, at the day's start), expected,
   *  index; rate (Σ r) and q (Σ q) for the pooled rate index; avg (satoshi), the effective VHP averaged over the
   *  day's blocks (the baseline if the day had no blocks). */
  function sumHours(hours) {
    const out = new Map(), get = (a) => { let x = out.get(a); if (!x) out.set(a, (x = { blocks: 0, credited: 0, baseline: 0, expected: 0, index: 0, rate: 0, q: 0, avgSum: 0, n: 0, avg: 0, avgSumExact: 0n, nExact: 0n })); return x; };
    const ok = (x) => Number.isFinite(x) && x >= 0;
    let q = 0;
    for (const hr of hours) {
      q += hr.q;
      for (const [a, b] of Object.entries(hr.by || {})) if (ok(b)) get(a).blocks += b;
      for (const [a, c] of Object.entries(hr.cr || {})) if (ok(c)) get(a).credited += c;
      for (const [a, c] of Object.entries(hr.r || {})) if (ok(c)) get(a).rate += c;
      // the forfeit sum in exact integers too (fix-check B-1: a float sum passes 2^53 and can land either side of the line)
      for (const [a, v] of Object.entries(hr.av || {})) if (ok(v)) { const x = get(a); x.avgSum += v * hr.n; x.n += hr.n; x.avgSumExact += BigInt(Math.round(v)) * BigInt(hr.n); x.nExact += BigInt(hr.n); }
    }
    for (const [a, v] of Object.entries(hours[0].w || {})) if (ok(v)) get(a).baseline = v;   // one baseline a day
    for (const x of out.values()) {
      x.q = q; x.expected = V.expectedBlocks(x.baseline, q); x.index = x.expected > 0 ? x.credited / x.expected : 0;
      x.avg = x.n > 0 ? x.avgSum / x.n : x.baseline;
    }
    return out;
  }
  /** Day index from the 24 recorded hours: Map address → { blocks, credited, baseline, expected, index }; null unless
   *  every hour is in. */
  function indexFromHours(hours) {
    if (!Array.isArray(hours) || hours.length !== 24 || !hours.every(hourOk)) return null;
    return sumHours(hours);
  }
  /** The index so far in a day still being played (the hours recorded up to now; for the page's live view). */
  function indexSoFar(hours) {
    const got = (Array.isArray(hours) ? hours : []).filter(hourOk);
    return got.length ? sumHours(got) : null;
  }
  /** Day index straight from blocks and a book (tests and the replay): the 24 hours from dayStart. */
  function dayIndex(B, dayStart, seeds, book) {   // (unchanged)
    return indexFromHours(exactHours(B, Array.from({ length: 24 }, (_, h) => dayStart + h * HOUR), seeds, book));
  }
  /** A producer's day as compared in a matchup: [what it scored, what it was expected to score]. Pooled producers use
   *  the rate index (Σ r ÷ Σ q, #E-3 H-4), everyone else credited ÷ expected blocks. Both have the expected value 1. */
  function scoreOf(x, isPooled) {
    if (!x) return [0, 0];
    if (isPooled) return [Number.isFinite(x.rate) ? x.rate : 0, Number.isFinite(x.q) ? x.q : 0];
    return [x.credited ?? x.blocks ?? 0, x.expected || 0];
  }
  /** The index shown for a producer's day (the page): the same number scoreOf compares. */
  const indexOf = (x, isPooled) => { const [c, e] = scoreOf(x, isPooled); return e > 0 ? c / e : 0; };
  /** Does `other` beat `better` on a day? Higher index wins; an exact tie (compared without division) goes to `other`,
   *  the lower seed. A producer missing from the day's index counts as 0 blocks. */
  function otherWins(idx, better, other, seedVhp, pooled, ruler) {
    const pa = !!(pooled && pooled.has(better)), pb = !!(pooled && pooled.has(other));
    const A = idx.get(better) || null, B = idx.get(other) || null;
    if (seedVhp) {
      const fa = !pa && forfeits(A, seedVhp.get(better)), fb = !pb && forfeits(B, seedVhp.get(other));
      if (fa !== fb) return fa;   // only one forfeits: it loses
    }
    // R-BR-7 (the VHP ruler, owner 11 Nov): with the day's ruler card, the higher field percentile (fpct) wins; a seed
    // with no fpct (void that day, or not in the card's field) loses; both without one: the day index below decides,
    // as when both forfeit. An exact fpct tie goes to `other`, the lower seed, like an index tie.
    // Phase 2 (Repo Lens #G-36, the Race's D-033 "a show needs a signed block"): a seed that signed no block on the day
    // has no fpct that day, whatever its card says, so it can't win on fpct (it counts as void).
    if (ruler) {
      const ra = A && A.blocks > 0 ? rulerPct(ruler, better) : null, rb = B && B.blocks > 0 ? rulerPct(ruler, other) : null;
      if (ra !== null && rb !== null) return rb >= ra;
      if (ra !== null) return false;
      if (rb !== null) return true;
    }
    const [ca, ea] = scoreOf(A, pa), [cb, eb] = scoreOf(B, pb);
    if (ea <= 0 && eb <= 0) return true;
    if (eb <= 0) return false;   // the underdog was on no card all day: it can't win
    if (ea <= 0) return true;
    const sa = ca * eb, sb = cb * ea;   // index A vs index B, cross-multiplied
    const tol = 1e-9 * Math.max(1, Math.abs(sa), Math.abs(sb));
    return sb > sa - tol;   // other's index ≥ better's index → other (tie → underdog)
  }

  /** A seed's fpct on a day's ruler card summary (address → fpct as a decimal string of millionths, or null), as a
   *  BigInt, or null: void, not in the field, or not on the card. */
  function rulerPct(ruler, a) {
    const v = ruler.get(a);
    // a percentile in millionths: 0 … 1,000,000 (Repo Lens #G-20 Info); anything else counts as no fpct
    return typeof v === "string" && /^[0-9]{1,7}$/.test(v) && BigInt(v) <= 1000000n ? BigInt(v) : null;
  }
  /** Does a seed forfeit its day? Its effective VHP averaged over the day's blocks (satoshi; #E-3 H-5) is strictly
   *  under half (FORFEIT_SHARE) of its seeding VHP (VHP, whole hundredths). Fix-check B-1: compared in exact integers —
   *  2 × Σ(av × n) < seeding satoshi × Σ n — so the page, the recorder and the publish job's port always agree, even
   *  when the sums pass 2^53. A day without blocks compares its baseline. No record for the day: no forfeit here. */
  function forfeits(x, vhp) {
    if (!(vhp > 0) || !x) return false;
    const seedSat = BigInt(Math.round(vhp * 100)) * 1000000n;
    if (typeof x.nExact === "bigint" && x.nExact > 0n) return 2n * x.avgSumExact < seedSat * x.nExact;
    const v = Number.isFinite(x.avg) && !(typeof x.nExact === "bigint") ? x.avg : Number.isFinite(x.baseline) ? x.baseline : 0;
    return 2n * BigInt(Math.round(v)) < seedSat;
  }

  /** The real results of a week: seeds (addresses), days: [dayIndex Map for each round, or null if not known yet],
   *  seedVhp: each seed's seeding VHP in seed order (the forfeit rule; left out: no forfeits); pooled: addresses that
   *  never forfeit.
   *  Returns { rounds: [[winner seed]] for each round played so far, done: true when every round is known }. */
  function results(seeds, size, days, seedVhp, pooled, rulerDays) {
    const nSeeds = seeds.length, R = roundsOf(size), rounds = [];
    const sv = Array.isArray(seedVhp) ? new Map(seeds.map((a, i) => [a, Number(seedVhp[i]) || 0])) : null;
    const pl = new Set(Array.isArray(pooled) ? pooled : []);
    // rulerDays (R-BR-7): [Map address → fpct | null for each round, or null if its card isn't made yet]; a round is
    // known only once both its day and its card are. Left out: the day index alone, as before.
    const ru = Array.isArray(rulerDays) ? rulerDays : null;
    let known = 0; while (known < R && days[known] && (!ru || ru[known])) known++;
    const full = play(size, nSeeds, (r, m, a, b) => (r < known ? otherWins(days[r], seeds[a - 1], seeds[b - 1], sv, pl, ru ? ru[r] : null) : false));
    for (let r = 0; r < known; r++) rounds.push(full.rounds[r]);
    return { rounds, done: known === R };
  }

  /** Score a decoded pick against results (both as winner seeds per round). Byes score nothing. */
  function score(pick, res, size, nSeeds) {
    const s = { points: 0, correct: 0, champion: false };
    if (!pick) return s;
    const byes = new Set(byesOf(size, nSeeds));
    for (let r = 0; r < res.rounds.length; r++) for (let m = 0; m < res.rounds[r].length; m++) {
      if (byes.has(roundOffset(size, r) + m)) continue;
      if (pick.rounds[r][m] === res.rounds[r][m]) { s.points += pointsFor(r); s.correct++; }
    }
    if (res.done && pick.rounds[roundsOf(size) - 1][0] === res.rounds[roundsOf(size) - 1][0]) { s.champion = true; s.points += CHAMPION_BONUS; }
    return s;
  }

  /** Rank rows [{ player, points, champion, correct, time? }]: points, then a correct champion, then more correct
   *  winners, then the earlier pick time (rows with a time); tied rows share a place (1, 2, 2, 4 …). Returns new rows
   *  with `place`, best first (ties by player for a stable order). */
  function rank(rows) {
    const key = (r) => [r.points, r.champion ? 1 : 0, r.correct, Number.isFinite(r.time) ? -r.time : 0];
    const cmp = (x, y) => { const a = key(x), b = key(y); for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
    const out = rows.map((r) => ({ ...r })).sort((x, y) => cmp(x, y) || (x.player < y.player ? -1 : x.player > y.player ? 1 : 0));
    out.forEach((r, i) => { r.place = i > 0 && cmp(out[i - 1], r) === 0 ? out[i - 1].place : i + 1; });
    return out;
  }

  function lowerBound(ts, t) { let lo = 0, hi = ts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m; } return lo; }

  root.KBracketMath = {
    GAME_ID, FILE_V, MAX_CHANGES, PICKS_PER_DAY, HOUR, DAY, WEEK, GENESIS, SEED_BEFORE, LOCK_DAY, LOCK_BEFORE, LAST_DAY, MIN_FIELD, MIN_K, RACE_BLOCKS, MAX_SIZE, NUMBER_MAX, CHAMPION_BONUS, FORFEIT_SHARE, forfeits, scoreOf, indexOf, ROUND_NAMES, ROUND_OFFSET,
    weekStart, weekOf, seedTime, lockTime, roundDayIndex, roundDay, picksRound, weekOfPicksRound, finalFrom,
    sizeFor, roundsOf, pointsFor, maxPoints, lineOrder, roundOffset, seeding, firstRound, play, byesOf, decode, encode,
    ACTIVE_BLOCKS, SEED_BLOCKS, Q_SCALE, VHP_CONTRACT, vhpDeltas, vhpBook, exactHours, indexFromHours, indexSoFar, averageCard, dayIndex, otherWins, results, score, rank,
  };
})(typeof window !== "undefined" ? window : globalThis);
