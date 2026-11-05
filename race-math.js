/* Producer Race: the shared math. The page (race.js) and the race recorder (bot/race.ts) both use this one file, so
 * a race scored in the browser and a race recorded by the bot always agree. No network, no page, no wallet.
 *
 * FORMAT
 * - 4 races a day, 6 hours each, on UTC boundaries: 00:00, 06:00, 12:00, 18:00. The week is the Knode Games week
 *   (Monday 00:00 UTC, counted from the game's start on 2026-10-19), so a week holds exactly 28 races.
 * - Every block a producer signs during a race moves its horse forward by that producer's handicap. Each race starts
 *   from 0. The winner is the horse with the most steps when the 6 hours are up.
 * - Each race has 6 handicap cards, one per 1-hour leg: the starting card and an update every hour (owner's decision
 *   2026-10-27; races recorded before that have 3 cards of 2 hours, and keep them). A card is set from each producer's
 *   VHP at the time it is taken, and applies to the blocks signed in its leg. A race's leg length is 6 h divided by its
 *   number of cards.
 *
 * THE HANDICAP
 *   h = (VHP of the biggest producer ÷ this producer's VHP) × (1 − c ÷ √k) ÷ (1 − c ÷ √k_top)
 * - The first part gives every horse the same expected speed (Koinos picks block signers in proportion to VHP).
 * - The second part trims luck: a small producer's few blocks come in lucky or unlucky bursts (luck in a count of k
 *   blocks is about √k), which would otherwise let the smallest horses win most races. k = the blocks a producer is
 *   expected to sign in a whole race (6 hours).
 * - c is tuned for each card: the value (0.0 to 2.5 in steps of 0.1) that gives every horse the most equal chance of
 *   winning a fresh 6-hour race, from 4,000 simulated races with a fixed seed, so anyone re-running it gets the same c.
 * - Producers expected to sign fewer than 10 blocks in a race wait in the paddock: with so few blocks one lucky block
 *   decides the race, and no handicap gives them a fair chance (at 6 blocks it is about half a fair chance).
 * - The biggest producer always moves exactly 1 step per block. Handicaps are rounded to 4 decimals.
 *
 * SCORING A PICK
 * - A pick on the winner scores a win (3 points); a pick on the horse that finishes 2nd or 3rd scores a show (1 point).
 *
 * RACE TYPES (owner, 5 Nov 2026, D-153; Race contract v2)
 * - Type 0 is the 6-hour race above, unchanged. Types 1-4 run around the clock beside it: the 1-hour race (every hour),
 *   the 2-hour race (every even hour), the daily race (each UTC day) and the weekly race (Monday 00:00 to Sunday 00:00
 *   UTC, the play week). Points: 1- and 2-hour win 2 / show 1; 6-hour 3 / 1; daily 6 / 2; weekly 12 / 4. All count on
 *   the one Producer Race board.
 * - Their handicap is the same formula with k = the blocks a producer is expected to sign in THAT race (so the field
 *   is bigger the longer the race), from the same hourly VHP reading as the 6-hour card of that hour, and its own c.
 * - They are scored from the hour ledger: each producer's block count (and last block time) in each UTC hour. */
(function (root) {
  "use strict";
  const HOUR = 3600000, RACE = 6 * HOUR, LEG = HOUR, LEGS = 6, DAY = 24 * HOUR, WEEK = 7 * DAY;
  const GENESIS = 1792368000000;    // the Knode Games week 0: Monday 2026-10-19 00:00 UTC (game-data/deployment.json genesisTime)
  const MIN_K = 10;                 // expected blocks in a race to enter (fewer: too few blocks for any handicap to be fair)
  const C_GRID = Array.from({ length: 26 }, (_, i) => i / 10);
  const SEED = 20261027, TRIALS = 4000;
  const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

  // ── time ──
  const raceIndex = (t) => Math.floor(t / RACE);
  const raceStart = (i) => i * RACE;
  /** "2026-10-27T06": the UTC start of the race. */
  const raceId = (i) => new Date(raceStart(i)).toISOString().slice(0, 13);
  function parseRaceId(id) { const m = /^(\d{4}-\d{2}-\d{2})T(00|06|12|18)$/.exec(String(id)); return m ? raceIndex(Date.parse(`${m[1]}T${m[2]}:00:00Z`)) : null; }
  /** The race running at time t. */
  function raceAt(t) { const i = raceIndex(t), start = raceStart(i); return { index: i, id: raceId(i), start, end: start + RACE, number: ((i % 4) + 4) % 4 + 1 }; }
  /** The leg of a race at time t, clamped to the race; n = the race's number of cards (6, or 3 for older races). */
  const legOf = (start, t, n = LEGS) => Math.min(n - 1, Math.max(0, Math.floor((t - start) / (RACE / n))));
  /** How many legs (cards) a race has: its cards array, else the current format. */
  const legsOf = (cards) => (Array.isArray(cards) && (cards.length === 3 || cards.length === 6) ? cards.length : LEGS);
  /** The Knode Games week of a time (same as the game contract's week_of: weeks before the start count as 0). */
  const weekOf = (t) => (t <= GENESIS ? 0 : Math.floor((t - GENESIS) / WEEK));
  const weekStart = (w) => GENESIS + w * WEEK;
  const dayOf = (t) => new Date(t).toISOString().slice(0, 10);   // UTC day
  /** The weekly rhythm (D-125, D-129): races Monday 00:00 → Saturday 24:00 UTC count for the week; Sunday UTC is the
   *  review day, and its races are fun races (Today and All time only, never the week). From vault week 3
   *  (Mon 9 Nov 2026, "Week 1"), the first paid week. */
  const RHYTHM_FROM_WEEK = 3;
  /** Is a race starting at t on a review day (Sunday UTC, from `from`), i.e. a fun race that counts for no week? */
  const restRace = (t, from = RHYTHM_FROM_WEEK) => new Date(t).getUTCDay() === 0 && weekOf(t) >= from;
  /** When play ends in week w: Saturday 24:00 UTC = Sunday 00:00 UTC. */
  const playEnd = (w) => weekStart(w) + 6 * DAY;

  // ── race types (D-153) ──
  /** len: how long the race runs; step: how often one starts; win / show: its points. Type numbers match the contract. */
  const TYPES = Object.freeze([
    Object.freeze({ id: 0, key: "6h", name: "6-hour", len: RACE, step: RACE, win: 3, show: 1 }),
    Object.freeze({ id: 1, key: "1h", name: "1-hour", len: HOUR, step: HOUR, win: 2, show: 1 }),
    Object.freeze({ id: 2, key: "2h", name: "2-hour", len: 2 * HOUR, step: 2 * HOUR, win: 2, show: 1 }),
    Object.freeze({ id: 3, key: "day", name: "Daily", len: DAY, step: DAY, win: 6, show: 2 }),
    Object.freeze({ id: 4, key: "week", name: "Weekly", len: 6 * DAY, step: WEEK, win: 12, show: 4 }),
  ]);
  /** The contract's weekly race w starts at 1970-01-05 (the first Monday) + w weeks. */
  const WEEK_OFFSET = 4 * DAY;
  const ID_PREFIX = ["", "H1-", "H2-", "D-", "W-"];
  const typedIndex = (type, t) => (type === 4 ? Math.floor((t - WEEK_OFFSET) / WEEK) : Math.floor(t / TYPES[type].step));
  const typedStart = (type, i) => (type === 4 ? WEEK_OFFSET + i * WEEK : i * TYPES[type].step);
  /** "H1-2026-11-09T05", "H2-2026-11-09T04", "D-2026-11-09", "W-2026-11-09"; type 0 keeps "2026-11-09T06". */
  function typedId(type, i) {
    const iso = new Date(typedStart(type, i)).toISOString();
    return ID_PREFIX[type] + (type >= 3 ? iso.slice(0, 10) : iso.slice(0, 13));
  }
  function parseTypedId(id) {
    const m = /^(H1-|H2-|D-|W-)?(\d{4}-\d{2}-\d{2})(?:T(\d{2}))?$/.exec(String(id));
    if (!m) return null;
    const type = m[1] ? ID_PREFIX.indexOf(m[1]) : 0;
    if ((type >= 3) !== (m[3] === undefined)) return null;
    const t = Date.parse(`${m[2]}T${m[3] || "00"}:00:00Z`), i = typedIndex(type, t);
    return typedStart(type, i) === t ? { type, index: i } : null;
  }
  /** A race of a type: { type, index, id, start, end }. */
  function typedRace(type, i) { const start = typedStart(type, i); return { type, index: i, id: type === 0 ? raceId(i) : typedId(type, i), start, end: start + TYPES[type].len }; }
  /** The races of a type that start in [from, to). */
  function typedRacesIn(type, from, to) {
    const out = [];
    for (let i = typedIndex(type, from - 1) + 1; typedStart(type, i) < to; i++) out.push(typedRace(type, i));
    return out;
  }
  const pointsOf = (type) => ({ win: TYPES[type].win, show: TYPES[type].show });
  /** The first Knode Games week the race types (1-4) run in: null = not yet (the Race contract v2 isn't uploaded).
   *  The owner sets it with the upload (D-153); until then the recorder, the publish job and the page show only the
   *  6-hour race. */
  const TYPES_FROM_WEEK = null;

  // ── seeded random numbers ──
  function rng(seed) {
    let a = seed >>> 0, spare = null;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let u = 0; while (u === 0) u = next(); const v = next(); const r = Math.sqrt(-2 * Math.log(u)); spare = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v); };
    const poisson = (mean) => {
      if (mean <= 0) return 0;
      if (mean >= 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal()));
      const L = Math.exp(-mean); let k = 0, p = 1;
      do { k++; p *= next(); } while (p > L);
      return k - 1;
    };
    return { next, normal, poisson };
  }

  // ── handicap ──
  const handicapOf = (k, kTop, c) => (kTop / k) * (1 - c / Math.sqrt(k)) / (1 - c / Math.sqrt(kTop));
  function drawCounts(ks, trials = TRIALS, seed = SEED) {
    const R = rng(seed), out = new Array(trials);
    for (let t = 0; t < trials; t++) { const row = new Float64Array(ks.length); for (let i = 0; i < ks.length; i++) row[i] = R.poisson(ks[i]); out[t] = row; }
    return out;
  }
  function chancesFrom(counts, hs) {
    const n = hs.length, wins = new Array(n).fill(0);
    for (const row of counts) {
      let best = -1, nb = 0;
      for (let i = 0; i < n; i++) { const p = row[i] * hs[i]; if (p > best + 1e-9) { best = p; nb = 1; } else if (Math.abs(p - best) <= 1e-9) nb++; }
      for (let i = 0; i < n; i++) if (Math.abs(row[i] * hs[i] - best) <= 1e-9) wins[i] += 1 / nb;
    }
    return wins.map((w) => w / counts.length);
  }
  /** Chance each horse wins a fresh race (for checking fairness only; the page never shows it). */
  const winChances = (ks, hs, trials = TRIALS, seed = SEED) => chancesFrom(drawCounts(ks, trials, seed), hs);
  /** The luck trim c that makes the horses' chances most equal. */
  function calibrate(ks, trials = TRIALS) {
    if (ks.length < 2) return { c: 0, spread: 0 };
    const kTop = ks[0], fair = 1 / ks.length, cMax = Math.sqrt(Math.min(...ks)) * 0.8, counts = drawCounts(ks, trials);
    let best = null;
    for (const c of C_GRID) {
      if (c >= cMax) break;
      const w = chancesFrom(counts, ks.map((k) => handicapOf(k, kTop, c)));
      const err = w.reduce((s, x) => s + (x - fair) * (x - fair), 0);
      if (!best || err < best.err - 1e-12) best = { c, err, min: Math.min(...w), max: Math.max(...w) };
    }
    return { c: best.c, min: best.min, max: best.max };
  }

  /** A handicap card from VHP readings. vhp: [[address, VHP as a number], ...] for the producers seen recently;
   *  blocksPerRace: how many blocks a 6-hour race is expected to have (from the recent fill rate). */
  function makeCard(vhp, blocksPerRace, at = 0, fixedC = undefined) {
    const all = vhp.filter(([a, v]) => typeof a === "string" && Number.isFinite(v) && v > 0);
    const total = all.reduce((s, [, v]) => s + v, 0);
    const rows = all.map(([a, v]) => ({ a, vhp: v, k: total > 0 ? blocksPerRace * v / total : 0 })).sort((x, y) => y.vhp - x.vhp || (x.a < y.a ? -1 : 1));
    const field = rows.filter((r) => r.k >= MIN_K), paddock = rows.filter((r) => r.k < MIN_K);
    // fixedC: a type's card rebuilt from a stored c (D-153), without simulating again.
    const ks = field.map((r) => r.k), cal = fixedC === undefined ? calibrate(ks) : { c: fixedC, min: NaN, max: NaN };
    return {
      at, blocksPerRace: round(blocksPerRace, 1), c: cal.c,
      fairness: field.length && fixedC === undefined ? [round(cal.min, 4), round(cal.max, 4)] : null,
      field: field.map((r) => ({ a: r.a, vhp: round(r.vhp, 2), k: round(r.k, 2), h: round(handicapOf(r.k, ks[0], cal.c), 4) })),
      paddock: paddock.map((r) => ({ a: r.a, vhp: round(r.vhp, 2), k: round(r.k, 2) })),
    };
  }
  /** The card for a leg: that leg's own card, else the latest earlier one, else the earliest later one (a leg the
   *  recorder missed keeps the card before it; a race whose first card came late uses that card from the start). */
  function cardForLeg(cards, leg) {
    if (!Array.isArray(cards)) return null;
    for (let l = leg; l >= 0; l--) if (cards[l]) return cards[l];
    for (let l = leg + 1; l < cards.length; l++) if (cards[l]) return cards[l];
    return null;
  }
  /** The finish line: the steps the biggest producer is expected to cover in the whole race (its k on each leg's card,
   *  a third of the race each). Every horse races toward it; the handicap makes it the same distance for all. */
  function finishLine(cards) {
    let s = 0;
    const n = legsOf(cards);
    for (let l = 0; l < n; l++) { const c = cardForLeg(cards, l); if (!c || !c.field.length) return null; s += c.field[0].k / n; }
    return round(s, 2);
  }

  /** Steps of every horse in a race up to time T. B: blocks { ts: [...ascending], sig: [index], signers: [address] }.
   *  Returns horses sorted by steps (ties: whoever reached the total first), each { a, steps, blocks, last }. */
  function standings(B, race, cards, T = race.end) {
    const n = legsOf(cards), until = Math.min(T, race.end);
    const hs = Array.from({ length: n }, (_, l) => { const c = cardForLeg(cards, l); return new Map((c ? c.field : []).map((r) => [r.a, r.h])); });
    const horses = new Map();
    for (const m of hs) for (const a of m.keys()) if (!horses.has(a)) horses.set(a, { a, steps: 0, blocks: 0, last: 0 });
    let i = lowerBound(B.ts, race.start);
    for (; i < B.ts.length && B.ts[i] < until; i++) {
      const a = B.signers[B.sig[i]], h = hs[legOf(race.start, B.ts[i], n)].get(a);
      if (!h) continue;
      const r = horses.get(a); r.steps += h; r.blocks++; r.last = B.ts[i];
    }
    const out = [...horses.values()].map((r) => ({ ...r, steps: round(r.steps, 4) }));
    out.sort((x, y) => y.steps - x.steps || (x.last || Infinity) - (y.last || Infinity) || (x.a < y.a ? -1 : 1));
    return out;
  }
  /** The winner of finished standings: most steps; on an exact tie, the horse that reached that total first. */
  function winners(st) { return st.length && st[0].steps > 0 ? [st[0].a] : []; }
  /** Show: the horses that finish 2nd and 3rd (each with at least one step), once the race has a winner. A pick on the
   *  winner is a win, not a show. Points: a win 3, a show 1 (owner's default 2026-10-27). */
  const POINTS = Object.freeze({ win: 3, show: 1 });
  function shows(st) { return winners(st).length ? st.slice(1, 3).filter((r) => r.steps > 0).map((r) => r.a) : []; }
  /** What the track shows during a race: a horse never passes the finish line, and the order among horses at the line
   *  stays hidden until the race ends. behind = steps behind the leader as drawn (capped at the line). */
  /** Where to draw each horse (x: 0 = start, 1 = the finish line) and how far it is behind the leader, with the handicap.
   *  The real order always shows. While the race runs, the track is the finish line or a little longer than the leader
   *  has gone (the leader is drawn at most LIVE_MAX of the way), so nobody reaches the line before the 6 hours are up and
   *  a leader running ahead of pace never piles up at the line with others. When the race ends, the winner sits on it. */
  const LIVE_MAX = 0.96;
  function track(st, line, ended) {
    const lead = st.length ? Math.max(0, st[0].steps) : 0;
    const scale = ended ? lead : Math.max(line > 0 ? line : 0, lead / LIVE_MAX);
    return st.map((r) => ({ ...r, x: scale > 0 ? Math.min(1, Math.max(0, r.steps) / scale) : 0, behind: round(lead - r.steps, 1) }));
  }
  /** A type's card for an hour, from that hour's 6-hour card (the same VHP reading), with blocks scaled to the type's
   *  length. c: the type's stored c for that hour, or undefined to tune it (the recorder does, once, and stores it). */
  function typeCard(base, type, c = undefined) {
    if (!base) return null;
    const vhp = [...(base.field || []), ...(base.paddock || [])].map((r) => [r.a, r.vhp]);
    return makeCard(vhp, base.blocksPerRace * TYPES[type].len / RACE, base.at, c);
  }
  /** A typed race's standings from the hour ledger. hours: Map(hour start → { n: {address: blocks}, l: {address: last
   *  block time} }); cardAt(hour start) → that hour's card for the race's type. null while an hour is missing. Same
   *  order as standings(): steps, then whoever reached the total first, then the address. */
  function ledgerStandings(hours, race, cardAt) {
    const horses = new Map();
    for (let h = race.start; h < race.end; h += HOUR) {
      const led = hours.get(h), card = cardAt(h);
      if (!led || !card) return null;
      for (const r of card.field) if (!horses.has(r.a)) horses.set(r.a, { a: r.a, steps: 0, blocks: 0, last: 0 });
      const hm = new Map(card.field.map((r) => [r.a, r.h]));
      for (const [a, n] of Object.entries(led.n || {})) {
        const h1 = hm.get(a);
        if (!h1 || !(n > 0)) continue;
        const x = horses.get(a); x.steps += n * h1; x.blocks += n; x.last = Math.max(x.last, Number((led.l || {})[a]) || 0);
      }
    }
    const out = [...horses.values()].map((r) => ({ ...r, steps: round(r.steps, 4) }));
    out.sort((x, y) => y.steps - x.steps || (x.last || Infinity) - (y.last || Infinity) || (x.a < y.a ? -1 : 1));
    return out;
  }
  /** A typed race's finish line: the biggest producer's expected steps, an hour at a time. */
  function ledgerLine(race, cardAt) {
    let s = 0;
    const n = Math.round((race.end - race.start) / HOUR);
    for (let h = race.start; h < race.end; h += HOUR) { const c = cardAt(h); if (!c || !c.field.length) return null; s += c.field[0].k / n; }
    return round(s, 2);
  }
  function lowerBound(ts, t) { let lo = 0, hi = ts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m; } return lo; }

  root.KRaceMath = {
    HOUR, RACE, LEG, LEGS, DAY, WEEK, GENESIS, MIN_K, SEED, TRIALS,
    raceIndex, raceStart, raceId, parseRaceId, raceAt, legOf, legsOf, weekOf, weekStart, dayOf, RHYTHM_FROM_WEEK, restRace, playEnd,
    TYPES, TYPES_FROM_WEEK, WEEK_OFFSET, typedIndex, typedStart, typedId, parseTypedId, typedRace, typedRacesIn, pointsOf, typeCard, ledgerStandings, ledgerLine,
    rng, handicapOf, winChances, calibrate, makeCard, cardForLeg, finishLine, standings, winners, shows, POINTS, track, LIVE_MAX, lowerBound,
  };
})(typeof window !== "undefined" ? window : globalThis);
