/* Knode Games — THE SHARED VHP RULER (design: .ai/standards/VHP_RULER.md v2, approved D-111; data rules D-112).
 * Pure math, no network, no storage, no wallet. The recorder (bot/vhp-ruler.ts), the publish job (its Python twin,
 * vhp_ruler.py) and the site all run the same rules, so a card computed anywhere is byte-identical.
 *
 * WHAT IT IS: one shared measuring tape for producer size. It is not a scoring formula; each game keeps its own.
 *
 * NUMBERS (§13): every number that decides a result is an integer.
 *  - VHP in satoshi as BigInt (1 VHP = 100,000,000).
 *  - k, credit, form, trim in MILLIONTHS (1.000000 = 1,000,000n), always rounded down.
 *  - averages = floor(Σ ÷ blocks). Sums of per-block shares round EACH block down, then add (owner, 4 Nov): the sum is
 *    at most (number of blocks) millionths below the exact value (tested).
 *  - no floating point anywhere in this file (tested: no Math.*, no parseFloat, no Number division).
 *
 * THE RULES (heights are block numbers; [a, b] includes both ends):
 *  eff(p, H)    effective VHP for producing block H = max(0, balance before H − VHP p received in blocks H−19 … H−1)
 *               (the VHP contract's effective_balance_of; checked line by line against a copy of its code, in tests).
 *  active(H)    producers that signed a block in [H − 7,200, H − 1].
 *  N(H)         Σ eff(q, H) over active(H): the network total block production uses.
 *  own(p, T)    "spot":   eff(p, T);
 *               "high1h": the highest eff(p, H) for H in [T − 1,199, T] (the 1,200 blocks ending at T);
 *               "avg24h": avg(p, T). Simulation 4 picks the rule; the card records which (ownRule).
 *  avg(p, T)    floor(Σ eff(p, H) for H in [T − 28,800, T − 1] ÷ 28,800).
 *  total(T)     Σ avg(q, T) over active(T).
 *  k(p)         floor((S1 − S0 + 1) × own × 10^6 ÷ total)  — expected blocks in the scoring window, millionths.
 *  form(p)      signed ÷ expected over [T − 403,200, T − 1] (clipped to the data), expected = Σ floor(eff(p,H)·10^6 ÷ N(H));
 *               form = floor(signed × 10^12 ÷ expected), millionths. A GATE ONLY (≥ 0.80), never a multiplier.
 *  credit(p, b) min(10^6, floor(own × 10^6 ÷ eff(p, b))) for a block b that p signed in [S0, S1].
 *  trim(k, c)   floor(c ÷ √k) in millionths = isqrt(floor(c² × 10^6 ÷ k)) with c, k in millionths (exact).
 *  entry(p)     k ≥ 10 blocks, form ≥ 0.80, and history: p signed a block at least 28,800 blocks before T.
 *  isNew, history  read over the fixed look-back [T − 410,400, T − 1] when the data reaches back that far (always on a
 *               paying card), so a card's bytes never depend on where the loaded data starts (Repo Lens #B-5 N-6):
 *               isNew = no block in [T − 410,400, T − 403,201]; history = a block in [T − 410,400, T − 28,800].
 *  pooled(p)    the card's pooled list (today the Knode Games Vault): expected = Σ_b floor(min(own, eff(p,b))·10^6 ÷ total).
 *  quality      for the whole card: "flagged" if any hour the card reads (from 19 blocks before its look-back or race,
 *               #B-6 B6-1) is bad for any active producer (its numbers feed everyone's total and form), or — on a paying card — any "rebuilt" hour in the 24-h size window
 *               [T − 28,800 − 19, T] or the scoring window [S0 − 19, S1] (19 blocks earlier: a change there still moves
 *               effective VHP inside the window, Repo Lens #B-5 N-7); form's older days may read rebuilt hours (D-112,
 *               D-113; Repo Lens #E-12 L-2, #D-10 M-3). Else "ok". A paying card needs 14 days + 6 h of data before T.
 *  not yet      a paying card isn't made (or scored) while a chained catch-up hour that no live hour has checked yet lies
 *               in those windows: it waits for the next live hour, so its bytes never change later (Repo Lens #B-5 N-3).
 *  cardTime     T = W0 + (first 8 bytes, big-endian, of sha256(UTF-8 "blockId|game|round")) mod (W1 − W0 + 1),
 *               blockId = the seed block's id as the node returns it (lowercase hex), game and round in decimal (D-112).
 *               Seed block = L + 20 (heights are consecutive, so the first irreversible block at or after L + 20).
 */
(function (root) {
  "use strict";
  const VHP_CONTRACT = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq";   // mainnet VHP
  const DELAY = 20, ACTIVE = 7200, HIGH = 1200, AVG = 28800, FORM = 403200, HISTORY = 28800, SEED_AFTER = 20;
  const M = 1000000n, MIN_K = 10n * M, FORM_GATE = 800000n;
  const RULE_VERSION = 3, OWN_RULES = ["spot", "high1h", "avg24h"], POOL_RULES = ["min", "twa"];
  // v2.1 (VHP_RULER.md §16, R-RULER-2): a producer is "steady" when each of its last 14 daily rates is within ±0.15 of its
  // 14-day rate (D-120); in the race, a steady producer's credited blocks stop at expected × (1 + STEER_BAND)
  const STEADY_BAND = 150000n, STEER_BAND = 150000n;
  const PCT_SCALE = 1n << 256n;   // the Poisson terms' fixed-point scale (pct)

  // ── sha256 (pure, for the card time; tested against node:crypto) ──
  const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) {
    const out = [];
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return Uint8Array.from(out);
  }
  function sha256(msg) {
    const bytes = typeof msg === "string" ? utf8(msg) : msg;
    const len = bytes.length, total = (((len + 9 + 63) >> 6) << 6), b = new Uint8Array(total);
    b.set(bytes); b[len] = 0x80;
    const bits = BigInt(len) * 8n;
    for (let i = 0; i < 8; i++) b[total - 1 - i] = Number((bits >> BigInt(8 * i)) & 0xffn);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const W = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 255; out[4 * i + 2] = (H[i] >>> 8) & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }
  const hex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, "0")).join("");

  /** A game id or round as plain decimal text: a non-negative safe integer, or a string of digits (Repo Lens #E-12 I-3:
   *  no sign, no spaces, no hex; the Python twin accepts exactly the same). */
  const MAX_DEC = 9007199254740991n;   // 2^53 − 1: game ids are JSON numbers, so both stay exact in both languages (#B-5 N-8)
  function dec(x, what) {
    if (typeof x === "number" && Number.isSafeInteger(x) && x >= 0) return String(x);
    if (typeof x === "string" && /^[0-9]{1,30}$/.test(x) && BigInt(x) <= MAX_DEC) return BigInt(x).toString(10);
    throw new Error(`${what} must be a whole number from 0 to 2^53 − 1`);
  }
  /** The random measuring moment (D-090, D-112). */
  function cardTime(seedBlockId, game, round, W0, W1) {
    if (!Number.isSafeInteger(W0) || !Number.isSafeInteger(W1) || W1 < W0) throw new Error("bad card window");
    if (typeof seedBlockId !== "string" || !/^0x[0-9a-f]+$/.test(seedBlockId)) throw new Error("seed block id must be lowercase 0x-hex");
    const d = sha256(`${seedBlockId}|${dec(game, "game")}|${dec(round, "round")}`);
    let n = 0n; for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(d[i]);
    return W0 + Number(n % BigInt(W1 - W0 + 1));
  }

  // ── integer helpers ──
  const imin = (x, y) => (x < y ? x : y), imax = (x, y) => (x > y ? x : y);
  const big = (x) => (typeof x === "bigint" ? x : BigInt(x));
  function isqrt(n) {   // floor(√n) for a BigInt n ≥ 0 (Newton)
    if (n < 0n) throw new Error("isqrt of a negative number");
    if (n < 2n) return n;
    let x = BigInt(1) << BigInt((n.toString(2).length + 1) >> 1);
    for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
  }
  /** Luck trim c ÷ √k in millionths (c and k in millionths). */
  function trim(k, c) {
    k = big(k); c = big(c);
    if (k <= 0n) throw new Error("trim needs k > 0");
    if (c < 0n) throw new Error("trim needs c ≥ 0");
    return isqrt((c * c * M) / k);
  }
  /** Card credit of one block (millionths): min(1, own ÷ eff at the block). */
  function creditOf(own, effB) { own = big(own); effB = big(effB); return effB <= own ? M : (own * M) / effB; }
  /** Expected blocks in a window of `blocks` blocks (millionths). */
  function kOf(blocks, own, total) { own = big(own); total = big(total); return total > 0n ? (big(blocks) * own * M) / total : 0n; }
  /** Fix A (§16): the mid-p Poisson percentile of credited blocks x against expected blocks λ (both millionths):
   *  P(X < x) + ½·P(X = x), X ~ Poisson(λ), in millionths, rounded down once at the end. Credited blocks can be fractional
   *  (card credit): between two whole numbers n and n + 1 the value moves in a straight line from mid(n) to mid(n + 1),
   *  so a whole x gives exactly the mid-p value. Exact integer arithmetic: the terms q(i) = λ^i/i! on a 2^256 scale by the
   *  recursion q(i+1) = floor(q(i)·λ/(i+1)), summed until they reach zero past the peak; the result is a ratio of those
   *  sums, so e^−λ is never needed. Python's pct is the same arithmetic (byte-identical cards). */
  function pct(lam, x) {
    lam = big(lam); x = big(x);
    if (lam < 0n || x < 0n) throw new Error("pct needs λ ≥ 0 and x ≥ 0");
    const n = x / M, f = x % M;
    let q = PCT_SCALE, i = 0n, total = 0n, below = 0n, qn = 0n, qn1 = 0n;
    for (;;) {
      if (i < n) below += q; else if (i === n) qn = q; else if (i === n + 1n) qn1 = q;
      total += q;
      const nx = (q * lam) / (M * (i + 1n));
      i++;
      if (nx === 0n && i * M > lam && i > n + 1n) break;
      q = nx;
    }
    const mid0 = 2n * below + qn, mid1 = 2n * below + 2n * qn + qn1;   // twice mid(n) and mid(n + 1), × total
    return ((mid0 * (M - f) + mid1 * f) * M) / (2n * total * M);
  }
  const lowerBound = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; };
  const upperBound = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; };

  /** VHP changes from decoded VHP-contract events: [{ h, a, d (BigInt satoshi), inc (BigInt received) }].
   *  events: [{ h, src, name, from, to, value }]; approve and other contracts' events are ignored. */
  function vhpDeltas(events, contract = VHP_CONTRACT) {
    const out = [];
    for (const e of Array.isArray(events) ? events : []) {
      if (!e || e.src !== contract || !Number.isSafeInteger(e.h)) continue;
      const n = String(e.name || "");
      if (!/^(token\.)?(transfer|mint|burn)_event$/.test(n)) continue;
      if (!/^[0-9]+$/.test(String(e.value))) throw new Error(`bad VHP event value at block ${e.h}`);
      const v = BigInt(e.value);
      if (/transfer_event$/.test(n)) { out.push({ h: e.h, a: e.from, d: -v, inc: 0n }); out.push({ h: e.h, a: e.to, d: v, inc: v }); }
      else if (/mint_event$/.test(n)) out.push({ h: e.h, a: e.to, d: v, inc: v });
      else out.push({ h: e.h, a: e.from, d: -v, inc: 0n });
    }
    return out;
  }

  /** THE LEDGER: everything the ruler needs, built once from a timeline of consecutive blocks.
   *  tl = { from, to, signers: Addr[] (one per block from … to), ids?: string[] (block ids, same order),
   *         deltas: [{ h, a, d, inc }] (BigInt), anchors: { addr: { h, v } } (balance AFTER block h, BigInt),
   *         bad?: [{ h0, h1, a? }] (heights a node fault or a failed check makes unusable; no a = everyone),
   *         rebuilt?: [{ h0, h1 }] (heights whose anchors were rebuilt, not read live: D-112),
   *         pending?: [{ h0, h1 }] (chained catch-up hours no live hour has checked yet: Repo Lens #B-5 N-3) }.
   *  Defined for: eff at H in [from + 20, to + 1]; N, active and form from validFrom = from + 7,200. */
  function ledger(tl) {
    const from = tl.from, to = tl.to, n = to - from + 1;
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || n < ACTIVE + DELAY) throw new Error("the timeline is too short");
    if (!Array.isArray(tl.signers) || tl.signers.length !== n) throw new Error("one signer per block is required");
    const addrs = [], ix = new Map(), add = (a) => { let i = ix.get(a); if (i === undefined) { i = addrs.length; addrs.push(a); ix.set(a, i); } return i; };
    const sig = new Int32Array(n);
    for (let i = 0; i < n; i++) sig[i] = add(tl.signers[i]);
    const anchors = tl.anchors || {};
    for (const a of Object.keys(anchors).sort()) add(a);
    for (const a of addrs) if (!anchors[a]) throw new Error(`no anchor for ${a}`);
    // per address: deltas grouped by height (net, received)
    const per = addrs.map(() => new Map());
    const all = addrs.map(() => []);
    for (const x of tl.deltas || []) {
      const i = ix.get(x.a); if (i === undefined) continue;   // not a producer we track
      all[i].push(x);
      if (x.h < from || x.h > to) continue;
      const m = per[i], g = m.get(x.h) || { net: 0n, inc: 0n };
      g.net += big(x.d); g.inc += big(x.inc || 0n); m.set(x.h, g);
    }
    const P = addrs.map((a, i) => {
      const an = anchors[a], ah = an.h, av = big(an.v);
      if (!Number.isSafeInteger(ah) || ah < from - 1) throw new Error(`anchor for ${a} is before the timeline`);
      let b0 = av; for (const x of all[i]) if (x.h >= from && x.h <= ah) b0 -= big(x.d);   // balance before block `from`
      const hs = [...per[i].keys()].sort((p, q) => p - q), net = [0n], inc = [0n];
      for (const h of hs) { const g = per[i].get(h); net.push(net[net.length - 1] + g.net); inc.push(inc[inc.length - 1] + g.inc); }
      const balBefore = (H) => b0 + net[upperBound(hs, H - 1)];
      const recvIn = (x0, x1) => inc[upperBound(hs, x1)] - inc[upperBound(hs, x0 - 1)];
      const effAt = (H) => { const b = balBefore(H); if (b < 0n) throw new Error(`the VHP rebuild for ${a} went below zero at block ${H} (a missed event)`); const e = b - recvIn(H - DELAY + 1, H - 1); return e > 0n ? e : 0n; };
      const lo = from + DELAY, hi = to + 1, set = new Set([lo]);
      for (const h of hs) { if (h + 1 > lo && h + 1 <= hi) set.add(h + 1); if (per[i].get(h).inc > 0n && h + DELAY > lo && h + DELAY <= hi) set.add(h + DELAY); }
      const cp = [...set].sort((p, q) => p - q), ev = cp.map(effAt);
      const ps = [0n]; for (let j = 0; j < cp.length; j++) ps.push(ps[j] + ev[j] * BigInt((j + 1 < cp.length ? cp[j + 1] : hi + 1) - cp[j]));
      return { a, cp, ev, ps, b0, balBefore };
    });
    const signedAt = addrs.map(() => []);
    for (let i = 0; i < n; i++) signedAt[sig[i]].push(from + i);
    const validFrom = from + ACTIVE;
    const effI = (i, H) => {
      if (H < from + DELAY || H > to + 1) throw new Error(`block ${H} is outside the data (${from + DELAY} … ${to + 1})`);
      const p = P[i]; return p.ev[upperBound(p.cp, H) - 1];
    };
    /** Σ eff(i, H) for H in [H0, H1]. */
    const sumI = (i, H0, H1) => {
      if (H1 < H0) return 0n;
      const p = P[i], S = (x) => { const j = upperBound(p.cp, x - 1) - 1; return j < 0 ? 0n : p.ps[j] + p.ev[j] * BigInt(x - p.cp[j]); };
      effI(i, H0); effI(i, H1);
      return S(H1 + 1) - S(H0);
    };
    const maxI = (i, H0, H1) => {
      const p = P[i]; let m = effI(i, H0);
      for (let j = upperBound(p.cp, H0); j < p.cp.length && p.cp[j] <= H1; j++) if (p.ev[j] > m) m = p.ev[j];
      return m;
    };
    // the network total N(H) for H in [validFrom, to + 1], by one sweep
    const cnt = new Int32Array(addrs.length), cur = addrs.map((_, i) => effI(i, validFrom));
    for (let h = from; h < validFrom; h++) cnt[sig[h - from]]++;
    let N = 0n; for (let i = 0; i < addrs.length; i++) if (cnt[i] > 0) N += cur[i];
    const Nb = new BigInt64Array(to + 2 - validFrom), changes = new Map();
    for (let i = 0; i < addrs.length; i++) for (let j = 0; j < P[i].cp.length; j++) { const H = P[i].cp[j]; if (H > validFrom) { let l = changes.get(H); if (!l) changes.set(H, (l = [])); l.push([i, P[i].ev[j]]); } }
    Nb[0] = N;
    for (let H = validFrom + 1; H <= to + 1; H++) {
      for (const [i, v] of changes.get(H) || []) { if (cnt[i] > 0) N += v - cur[i]; cur[i] = v; }
      const s = sig[H - 1 - from], r = sig[H - 1 - ACTIVE - from];
      if (cnt[s]++ === 0) N += cur[s];
      if (--cnt[r] === 0) N -= cur[r];
      Nb[H - validFrom] = N;
    }
    const NAt = (H) => { if (H < validFrom || H > to + 1) throw new Error(`no network total at block ${H}`); return Nb[H - validFrom]; };
    // per-block shares for form, built when first asked (Σ floor(eff·10^6 ÷ N), each block rounded down)
    const shareP = new Map();
    const shares = (i) => {
      let s = shareP.get(i); if (s) return s;
      s = new BigInt64Array(to - validFrom + 2);   // prefix sums: ~blocks × 10^6 (a producer outside the active set can exceed 1 a block; still far inside 64 bits)
      const p = P[i]; let j = upperBound(p.cp, validFrom) - 1;
      for (let H = validFrom; H <= to; H++) {
        while (j + 1 < p.cp.length && p.cp[j + 1] <= H) j++;
        const Nh = Nb[H - validFrom], e = p.ev[j];
        s[H - validFrom + 1] = s[H - validFrom] + (Nh > 0n ? (e * M) / Nh : 0n);
      }
      shareP.set(i, s); return s;
    };
    const signedIn = (i, H0, H1) => (H1 < H0 ? 0 : upperBound(signedAt[i], H1) - lowerBound(signedAt[i], H0));
    const need = (a) => { const i = ix.get(a); if (i === undefined) throw new Error(`unknown address ${a}`); return i; };
    const L = {
      from, to, validFrom, addrs, ids: tl.ids || null, bad: tl.bad || [], rebuilt: tl.rebuilt || [], pending: tl.pending || [],
      signer: (h) => { if (h < from || h > to) throw new Error(`block ${h} is outside the data`); return addrs[sig[h - from]]; },
      eff: (a, H) => effI(need(a), H),
      balanceBefore: (a, H) => P[need(a)].balBefore(H),
      sumEff: (a, H0, H1) => sumI(need(a), H0, H1),
      maxEff: (a, H0, H1) => maxI(need(a), H0, H1),
      N: NAt,
      /** producers that signed in [H − 7,200, H − 1], sorted by address */
      active(H) {
        if (H < validFrom || H > to + 1) throw new Error(`no active set at block ${H}`);
        const s = new Set(); for (let h = H - ACTIVE; h < H; h++) s.add(addrs[sig[h - from]]);
        return [...s].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
      },
      signedIn: (a, H0, H1) => signedIn(need(a), H0, H1),
      signedBlocks: (a, H0, H1) => { const l = signedAt[need(a)]; return l.slice(lowerBound(l, H0), upperBound(l, H1)); },
      firstSigned: (a) => { const l = signedAt[need(a)]; return l.length ? l[0] : null; },
      /** Σ floor(eff(a,H)·10^6 ÷ N(H)) for H in [H0, H1] (millionths of a block) */
      shareSum(a, H0, H1) {
        if (H1 < H0) return 0n;
        if (H0 < validFrom || H1 > to) throw new Error(`no shares for blocks ${H0} … ${H1}`);
        const s = shares(need(a)); return s[H1 - validFrom + 1] - s[H0 - validFrom];
      },
    };
    return L;
  }

  // ── the outputs (§3) ──
  function own(L, a, T, rule) {
    if (rule === "spot") return L.eff(a, T);
    if (rule === "high1h") return L.maxEff(a, T - HIGH + 1, T);
    if (rule === "avg24h") return avg(L, a, T);
    throw new Error(`unknown own rule ${rule}`);
  }
  function avg(L, a, T) { return L.sumEff(a, T - AVG, T - 1) / BigInt(AVG); }
  function total(L, T) { let t = 0n; for (const q of L.active(T)) t += avg(L, q, T); return t; }
  /** D-120 (§16): the producer's long-run rate. Over the 14 days before T, rate = signed ÷ expected (millionths, capped
   *  at 1), used only if each of the 14 daily rates is within ±STEADY_BAND of the 14-day rate; else rate = 1 (steady:
   *  false) and the 0.80 gate applies as before. Needs the full 14 days (a paying card always has them). */
  function rateOf(L, a, T, f = formOf(L, a, T)) {
    if (T - FORM < L.validFrom || f.expected <= 0n) return { rate: M, steady: false };
    for (let d = 0; d < FORM / AVG; d++) {
      const H0 = T - FORM + d * AVG, e = L.shareSum(a, H0, H0 + AVG - 1), s = L.signedIn(a, H0, H0 + AVG - 1);
      const dr = e > 0n ? (BigInt(s) * M * M) / e : 0n, gap = dr > f.form ? dr - f.form : f.form - dr;
      if (gap > STEADY_BAND) return { rate: M, steady: false };
    }
    return { rate: f.form < M ? f.form : M, steady: true };
  }
  function formOf(L, a, T) {
    const H0 = imax(L.validFrom, T - FORM), H1 = T - 1;
    const expected = L.shareSum(a, H0, H1), signed = L.signedIn(a, H0, H1);
    return { form: expected > 0n ? (BigInt(signed) * M * M) / expected : 0n, signed, expected, from: H0 };
  }
  /** Is any height of [h0, h1] in a bad range for a (or everyone), or (paying) in a rebuilt range? */
  const badFor = (L, a, h0, h1) => L.bad.some((r) => r.h0 <= h1 && r.h1 >= h0 && (!r.a || r.a === a));
  /** D-112: a paying card may not read a rebuilt hour in its size window [T − 28,800, T] or its scoring window. */
  const rebuiltIn = (L, h0, h1) => L.rebuilt.some((r) => r.h0 <= h1 && r.h1 >= h0);
  const pendingIn = (L, h0, h1) => L.pending.some((r) => r.h0 <= h1 && r.h1 >= h0);
  const EARLY = DELAY - 1;   // a change up to 19 blocks before a window still moves effective VHP inside it (#B-5 N-7)
  // #B-6 B6-3: the message names where the unverified stretch starts, so a game can tell a short wait from a stuck ruler
  const notYet = (L, h0, h1) => { const r = L.pending.filter((x) => x.h0 <= h1 && x.h1 >= h0).sort((x, y) => x.h0 - y.h0)[0]; return `not yet: unverified chained hours in the card's windows (from block ${r.h0}); it is made once the next live hour checks them`; };
  /** isNew and history of producer a at T (Repo Lens #B-5 N-6): over the fixed look-back [T − 410,400, T − 1] when the
   *  data reaches back that far (always on a paying card); else (a free card on shorter data) from the data's start. */
  function newcomer(L, a, T) {
    const lb0 = T - FORM - ACTIVE;
    if (lb0 >= L.from) return { isNew: L.signedIn(a, lb0, T - FORM - 1) === 0, history: L.signedIn(a, lb0, T - HISTORY) > 0 };
    const first = L.firstSigned(a), seenAtStart = first !== null && first < L.validFrom;
    return { isNew: !seenAtStart && first !== null && T - first < FORM, history: first !== null && (seenAtStart ? T - L.from >= HISTORY : T - first >= HISTORY) };
  }

  /** The canonical JSON form of a card: BigInt as decimal strings, fixed key order, one trailing newline. */
  function cardJson(card) {
    return JSON.stringify(card, (k, v) => (typeof v === "bigint" ? v.toString(10) : v)) + "\n";
  }
  const checkWindow = (w) => {
    for (const k of ["W0", "W1", "S0", "S1", "L"]) if (!Number.isSafeInteger(w[k])) throw new Error(`window ${k} must be a block height`);
    if (!(w.W0 <= w.W1 && w.W1 <= w.L && w.L < w.S0 + 1 && w.S0 <= w.S1)) throw new Error("window order must be W0 ≤ W1 ≤ L ≤ S0 ≤ S1");
  };

  /** makeCard (§13): the card for one round, made after the seed block (L + 20) is irreversible.
   *  opts = { game, round, window: { W0, W1, L, S0, S1 }, c (millionths), pooled: Addr[], ownRule, paying } */
  function makeCard(L, opts) {
    const w = opts.window; checkWindow(w);
    const ownRule = opts.ownRule; if (!OWN_RULES.includes(ownRule)) throw new Error("ownRule must be spot, high1h or avg24h");
    const seedBlock = w.L + SEED_AFTER;
    if (!L.ids) throw new Error("the data has no block ids");
    const seedBlockId = L.ids[seedBlock - L.from];
    if (typeof seedBlockId !== "string") throw new Error(`no id for the seed block ${seedBlock}`);
    const T = cardTime(seedBlockId, opts.game, opts.round, w.W0, w.W1);
    if (T - AVG < L.from + DELAY) throw new Error("not enough history before the card time (24 h of data are needed)");
    const pooled = new Set(opts.pooled || []), c = big(opts.c ?? 0n), paying = !!opts.paying;
    // Fix B (§16) is two settings: the entry bar minK (whole expected blocks; 10 as approved, 15 / 20 / 30 to test) and
    // the pool rule ("min": min(own, eff) per block, §3.2; "twa": the time-weighted average eff over the scoring window)
    const minKBlocks = opts.minK ?? 10, poolRule = opts.poolRule ?? "min";
    if (!Number.isSafeInteger(minKBlocks) || minKBlocks < 1 || minKBlocks > 100000) throw new Error("minK must be a whole number of blocks from 1");
    if (!POOL_RULES.includes(poolRule)) throw new Error("poolRule must be min or twa");
    const minK = BigInt(minKBlocks) * M;
    // Repo Lens #E-12 L-1: a paying card reads the full 14-day form look-back, so its bytes never depend on where the
    // loaded data starts (T − from ≥ 403,200 + 7,200, the network total's own warm-up)
    if (paying && T - L.from < FORM + ACTIVE) throw new Error(`a paying card needs ${FORM + ACTIVE} blocks of data before its moment (14 days + 6 h)`);
    if (paying && pendingIn(L, T - AVG - EARLY, T)) throw new Error(notYet(L, T - AVG - EARLY, T));
    const formFrom = imax(L.validFrom, T - FORM), look0 = imin(T - AVG, formFrom);
    const blocks = w.S1 - w.S0 + 1, tot = total(L, T);
    const producers = L.active(T).map((a) => {
      const o = own(L, a, T, ownRule), av = avg(L, a, T), f = formOf(L, a, T), k = kOf(blocks, o, tot);
      const { isNew, history } = newcomer(L, a, T), { rate, steady } = rateOf(L, a, T, f);
      // D-120: the entry bar reads the blocks it is really expected to sign (k × rate); a steady producer is gated on its
      // form falling below 0.80 × its own rate (always met while it stays steady), others on 0.80 as before
      const kr = (k * rate) / M, gate = steady ? (FORM_GATE * rate) / M : FORM_GATE;
      return { a, own: o, avg: av, k, form: f.form, rate, entry: kr >= minK && f.form >= gate && history, pooled: pooled.has(a), isNew, quality: "ok" };
    }).sort((x, y) => (x.own > y.own ? -1 : x.own < y.own ? 1 : x.a < y.a ? -1 : 1));
    // quality, for the whole card: every producer's numbers feed everyone's total and form (Repo Lens #E-12 L-2), so a bad
    // range for any active producer in the look-back flags every producer. On a paying card, a rebuilt or unverified
    // hour in the 24-h size window [T − 28,800, T] flags it too; form's older days may read rebuilt hours (owner, 4 Nov,
    // D-113: "after 1 day is good"; Repo Lens #D-10 M-3 answered)
    const flagged = producers.some((p) => badFor(L, p.a, look0 - EARLY, T)) || (paying && rebuiltIn(L, T - AVG - EARLY, T));
    if (flagged) for (const p of producers) p.quality = "flagged";
    return {
      ruleVersion: RULE_VERSION, game: Number(dec(opts.game, "game")), round: dec(opts.round, "round"), ownRule, paying,
      T, seedBlock, seedBlockId, seedProducer: L.signer(seedBlock),
      window: { W0: w.W0, W1: w.W1, L: w.L, S0: w.S0, S1: w.S1 }, c, minK: minKBlocks, poolRule, total: tot, formFrom, producers,
    };
  }

  /** scoreCard: once S1 is in the data, fill expected, signed, credited and pct for every producer (millionths).
   *  expected = k × rate (D-120), or for a pooled producer the pool rule's sum × rate; a steady producer's credited
   *  blocks stop at expected × (1 + STEER_BAND) (the steering cap, §16); pct = the luck percentile (Fix A). */
  function scoreCard(L, card) {
    const { S0, S1 } = card.window, tot = big(card.total);
    if (card.paying && pendingIn(L, S0 - EARLY, S1)) throw new Error(notYet(L, S0 - EARLY, S1));
    const flagged = card.producers.some((p) => p.quality === "flagged" || badFor(L, p.a, S0 - EARLY, S1)) || (card.paying && rebuiltIn(L, S0 - EARLY, S1));
    const producers = card.producers.map((p) => {
      const o = big(p.own);
      let credited = 0n;
      for (const b of L.signedBlocks(p.a, S0, S1)) credited += creditOf(o, L.eff(p.a, b));
      const rate = big(p.rate);
      let expected = big(p.k);
      if (p.pooled) {   // §3.2 "min": min(own, eff at each block); Fix B "twa": eff at each block; each block rounded down
        expected = 0n;
        for (let H = S0; H <= S1;) {
          const e = L.eff(p.a, H); let H2 = H;
          while (H2 + 1 <= S1 && L.eff(p.a, H2 + 1) === e) H2++;   // a run of equal eff
          const m = card.poolRule === "twa" || e < o ? e : o;
          expected += BigInt(H2 - H + 1) * (tot > 0n ? (m * M) / tot : 0n);
          H = H2 + 1;
        }
      }
      expected = (expected * rate) / M;
      if (rate < M) { const cap = (expected * (M + STEER_BAND)) / M; if (credited > cap) credited = cap; }
      const quality = flagged ? "flagged" : "ok";
      return { ...p, quality, expected, signed: L.signedIn(p.a, S0, S1), credited, pct: pct(expected, credited) };
    });
    return { ...card, producers };
  }

  /** recompute (§13): rebuild a published card FROM THE GAME'S OWN SETTINGS and compare byte for byte (Repo Lens #E-12
   *  M-1: never from the card's own settings, or a card made with the wrong window, c, own rule, paying flag or pooled
   *  list would pass). game = { game, round, window: { W0, W1, L, S0, S1 }, c, minK, poolRule, ownRule, paying, pooled }. */
  const SETTINGS = ["game", "round", "window", "c", "minK", "poolRule", "ownRule", "paying", "pooled"], WKEYS = ["W0", "W1", "L", "S0", "S1"];
  /** The game's settings, strictly (Repo Lens #B-5 N-5): every key, no other key, each of its own type. Same in Python,
   *  with one difference JavaScript can't see: JSON.parse reads 1.0 and 0e0 as plain numbers, which Python refuses
   *  (#B-6 B6-2). The game's publish job runs the Python twin (recompute_main), so Python decides. */
  function checkSettings(g) {
    if (!g || typeof g !== "object" || Array.isArray(g)) throw new Error("recompute needs the game's own settings");
    const ks = Object.keys(g).sort();
    if (ks.join() !== [...SETTINGS].sort().join()) throw new Error(`the game's settings must have exactly: ${SETTINGS.join(", ")}`);
    dec(g.game, "game"); dec(g.round, "round");
    const w = g.window;
    if (!w || typeof w !== "object" || Array.isArray(w) || Object.keys(w).sort().join() !== [...WKEYS].sort().join()) throw new Error(`window must have exactly: ${WKEYS.join(", ")}`);
    if (!(typeof g.c === "bigint" ? g.c >= 0n : typeof g.c === "number" ? Number.isSafeInteger(g.c) && g.c >= 0 : typeof g.c === "string" && /^[0-9]{1,30}$/.test(g.c))) throw new Error("c must be a whole number of millionths");
    if (!Number.isSafeInteger(g.minK) || g.minK < 1 || g.minK > 100000) throw new Error("minK must be a whole number of blocks from 1");
    if (!POOL_RULES.includes(g.poolRule)) throw new Error("poolRule must be min or twa");
    if (!OWN_RULES.includes(g.ownRule)) throw new Error("ownRule must be spot, high1h or avg24h");
    if (typeof g.paying !== "boolean") throw new Error("paying must be true or false");
    if (!Array.isArray(g.pooled) || !g.pooled.every((a) => typeof a === "string")) throw new Error("pooled must be a list of addresses");
  }
  function recompute(L, published, game) {
    try { checkSettings(game); } catch (e) { return { same: false, diff: `the game's settings: ${e.message}` }; }
    const pub = typeof published === "string" ? JSON.parse(published) : published;
    const want = { game: Number(dec(game.game, "game")), round: dec(game.round, "round"), ownRule: game.ownRule, paying: game.paying, c: big(game.c).toString(10), minK: game.minK, poolRule: game.poolRule,
      W0: game.window.W0, W1: game.window.W1, L: game.window.L, S0: game.window.S0, S1: game.window.S1 };
    const got = { game: pub.game, round: pub.round, ownRule: pub.ownRule, paying: pub.paying, c: String(pub.c), minK: pub.minK, poolRule: pub.poolRule, ...(pub.window || {}) };
    for (const k of Object.keys(want)) if (got[k] !== want[k]) return { same: false, diff: `setting ${k}: the card says ${JSON.stringify(got[k])}, the game says ${JSON.stringify(want[k])}` };
    let mine;
    try {
      mine = makeCard(L, { game: game.game, round: game.round, window: game.window, c: big(game.c), minK: game.minK, poolRule: game.poolRule, ownRule: game.ownRule, paying: game.paying, pooled: game.pooled });
      if ((pub.producers || []).some((p) => "credited" in p)) mine = scoreCard(L, mine);
    } catch (e) { return { same: false, diff: `the data can't make this card: ${e.message}` }; }
    const a = cardJson(mine), b = typeof published === "string" ? published : cardJson(published);
    if (a === b) return { same: true };
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return { same: false, diff: `differs at byte ${i}: published …${b.slice(imax(0, i - 40), i + 40)}… vs recomputed …${a.slice(imax(0, i - 40), i + 40)}…` };
  }

  root.KRuler = { VHP_CONTRACT, DELAY, ACTIVE, HIGH, AVG, FORM, HISTORY, SEED_AFTER, M, MIN_K, FORM_GATE, RULE_VERSION, OWN_RULES, POOL_RULES, STEADY_BAND, STEER_BAND,
    sha256, hex, dec, cardTime, isqrt, trim, pct, rateOf, creditOf, kOf, vhpDeltas, ledger, own, avg, total, formOf, newcomer, makeCard, scoreCard, cardJson, checkSettings, recompute };
})(typeof window !== "undefined" ? window : globalThis);
