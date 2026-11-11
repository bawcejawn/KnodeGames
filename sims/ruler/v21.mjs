// Knode Games — the VHP ruler v2.1 simulations (VHP_RULER.md §16, R-RULER-2), under the owner's 5 Nov rulings: rank by
// A′ (R.fpct, the field percentile) or by Fix A (R.pct); every producer expected at its full size; a steady producer
// (D-120's steadiness test) stays in the field whatever its form; the Vault always in (D-123).
//   node sims/ruler/v21.mjs <timeline.json | vhp-data dir> [--cards N] [--races N] [--only 1,7] [--json out.json]
// Simulations judge the rules; they decide no result, so floating point is fine HERE (never in vhp-ruler.js). The
// percentile used here is the float twin of R.pct (checked against it on every run, below).
// Blocks in a race are drawn from the EXACT Poisson distribution of each producer's real effective VHP, block by block
// (sims.mjs's racer rounds a normal draw above 30 blocks, which shifts a percentile rank), with fixed seeds.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { effArray, raceSlots, synthetic, mod, movedFn, days, BLOCKS_PER_DAY, RACE, VAULT } from "./sims.mjs";
const here = new URL("../../", import.meta.url).pathname;
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(here + "vhp-ruler.js", "utf8") + fs.readFileSync(here + "vhp-data.js", "utf8") + fs.readFileSync(here + "race-math.js", "utf8"), box);
const R = box.window.KRuler, D = box.window.KVhpData, RM = box.window.KRaceMath;
export const JGA2 = "1MbsVfNw6yzQqA8499d8KQj8qdLyRs8CzW";
const Phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
/** A′ (R.fpct's float twin): the mid-p percentile of x among the field's own blocks, Binomial(n, p) with n = the field's
 *  blocks in this race and p = the producer's share of the field's expected blocks. Exact in log space everywhere
 *  (Repo Lens #B-10 SIM-3: the normal curve above a mean of 300 was off by up to 3.6e-3); terms more than 12 standard
 *  deviations below the mean (under 1e-30 of the mass) are skipped. Within 1e-9 of R.fpct (checked at start-up). */
function binMidp(n, pr, x) {
  const k = Math.floor(x), f = x - k;
  if (pr <= 0) return k > 0 ? 1 : 0.5 + f / 2;
  if (pr >= 1) return k < n ? (k === n - 1 ? f / 2 : 0) : k === n ? 0.5 + f / 2 : 1;
  if (k > n) return 1;
  const mu = n * pr, sd = Math.sqrt(mu * (1 - pr)), lo = Math.max(0, Math.floor(mu - 12 * sd - 5));
  if (k > mu + 12 * sd + 5) return 1;
  const start = k < lo ? 0 : lo, lr = Math.log(pr / (1 - pr));
  let lp = logFact(n) - logFact(start) - logFact(n - start) + start * Math.log(pr) + (n - start) * Math.log1p(-pr), below = 0, pk = 0, pk1 = 0;
  for (let i = start; i <= Math.min(n, k + 1); i++) { const p = Math.exp(lp); if (i < k) below += p; else if (i === k) pk = p; else pk1 = p; lp += Math.log((n - i) / (i + 1)) + lr; }
  return Math.min(1, (below + pk / 2) * (1 - f) + (below + pk + pk1 / 2) * f);
}

// ── the Poisson tools (float) ──
const LF = [0]; const logFact = (n) => { while (LF.length <= n) LF.push(LF[LF.length - 1] + Math.log(LF.length)); return LF[n]; };
/** pmf and "below" (P(X < i)) of Poisson(lam), i = 0 … n, as far as the mass reaches */
export function pois(lam) {
  const n = Math.ceil(lam + 14 * Math.sqrt(lam) + 30), pmf = new Float64Array(n + 2), below = new Float64Array(n + 3);
  for (let i = 0; i <= n + 1; i++) pmf[i] = lam > 0 ? Math.exp(-lam + i * Math.log(lam) - logFact(i)) : (i === 0 ? 1 : 0);
  for (let i = 0; i <= n + 1; i++) below[i + 1] = below[i] + pmf[i];
  return { lam, n, pmf, below };
}
/** mid-p percentile of x (fractional allowed, as R.pct) */
export function midp(t, x) {
  const n = Math.floor(x), f = x - n;
  if (n > t.n) return 1;
  const m0 = t.below[n] + t.pmf[n] / 2, m1 = t.below[n + 1] + t.pmf[n + 1] / 2;
  return Math.min(1, m0 * (1 - f) + m1 * f);
}
/** Walker's alias table over weights w: one draw per block in O(1) */
function alias(w) {
  const n = w.length, sum = w.reduce((s, x) => s + x, 0), prob = new Float64Array(n), al = new Int32Array(n), sc = w.map((x) => x * n / sum), small = [], large = [];
  sc.forEach((x, i) => (x < 1 ? small : large).push(i));
  while (small.length && large.length) { const s0 = small.pop(), l = large.pop(); prob[s0] = sc[s0]; al[s0] = l; sc[l] = sc[l] + sc[s0] - 1; (sc[l] < 1 ? small : large).push(l); }
  for (const i of [...small, ...large]) prob[i] = 1;
  return (u1, u2) => { const i = Math.floor(u1 * n); return u2 < prob[i] ? i : al[i]; };
}
/** an exact Binomial(n, p) draw: inversion for small means, Hörmann's BTRS (transformed rejection) above */
function binom(n, p, rnd) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (p > 0.5) return n - binom(n, 1 - p, rnd);
  if (n * p < 10) {   // inversion
    const q = 1 - p, s = p / q; let k = 0, f = Math.pow(q, n), u = rnd();
    while (u > f && k < n) { u -= f; f *= s * (n - k) / (k + 1); k++; }
    return k;
  }
  const spq = Math.sqrt(n * p * (1 - p)), b = 1.15 + 2.53 * spq, a = -0.0873 + 0.0248 * b + 0.01 * p, c = n * p + 0.5, vr = 0.92 - 4.2 / b;
  const alpha = (2.83 + 5.1 / b) * spq, lpq = Math.log(p / (1 - p)), m = Math.floor((n + 1) * p), h = logFact(m) + logFact(n - m);
  for (;;) {
    const u = rnd() - 0.5, v = rnd(), us = 0.5 - Math.abs(u), k = Math.floor((2 * a / us + b) * u + c);
    if (k < 0 || k > n) continue;
    if (us >= 0.07 && v <= vr) return k;
    const vv = Math.log(v * alpha / (a / (us * us) + b));
    if (vv <= h - logFact(k) - logFact(n - k) + (k - m) * lpq) return k;
  }
}
/** an exact Poisson draw by inversion */
const draw = (t, u) => { let lo = 0, hi = t.n + 1; while (lo < hi) { const m = (lo + hi) >> 1; if (t.below[m + 1] <= u) lo = m + 1; else hi = m; } return lo; };

// ── a card: every producer's own, avg, k, the expected blocks under each pool rule, and its rate ──
export function card(paths, base, T, S0, S1, opts = {}) {
  const ps = Object.keys(paths), blocks = S1 - S0 + 1, at = (p, H) => paths[p][H - base];
  const own = {}, avg = {};
  for (const p of ps) { let s = 0; for (let H = T - BLOCKS_PER_DAY; H < T; H++) s += at(p, H); avg[p] = s / BLOCKS_PER_DAY; own[p] = at(p, T); }
  const total = ps.reduce((s, p) => s + avg[p], 0);
  let N = opts.N;
  if (!N) { N = new Float64Array(blocks); for (let b = S0; b <= S1; b++) { let n = 0; for (const p of ps) n += at(p, b); N[b - S0] = n; } }
  const rows = ps.map((p) => {
    const k = blocks * own[p] / total, rate = (opts.rates && opts.rates[p]) || 1, signs = (opts.signs && opts.signs[p]) ?? 1;
    let lam = 0, cred = 0, pmin = 0, ptwa = 0, dev = 0, pminN = 0, devUp = 0, devDown = 0;
    for (let b = S0; b <= S1; b++) { const e = at(p, b), pr = e / N[b - S0]; lam += pr; cred += pr * (e <= own[p] ? 1 : own[p] / e); pmin += Math.min(own[p], e) / total; pminN += Math.min(own[p], e) / N[b - S0]; ptwa += e / total; if (own[p] > 0) { dev = Math.max(dev, Math.abs(e / own[p] - 1)); devUp = Math.max(devUp, e / own[p] - 1); devDown = Math.max(devDown, 1 - e / own[p]); } }
    // `signs`: the share of its blocks the producer really signs (1: honest; sim 8 sets throttlers and steerers)
    // the form gate as the owner ruled (5 Nov): a steady producer is in whatever its level; others need form ≥ 0.80
    const form = (opts.forms && opts.forms[p]) ?? 1, steady = !!(opts.steady && opts.steady[p]), gated = !steady && form < 0.8;
    return { p, own: own[p], avg: avg[p], k, rate, lam: lam * signs, credFrac: lam > 0 ? cred / lam : 0, pmin, pminN, ptwa, pooled: (opts.pooled || []).includes(p), gated, form, steady, dev, devUp, devDown };
  });
  return { rows, total, blocks };
}
/** win chances of the field under one configuration: { rank: "A" | "B", minK, poolRule } */
export function chances(c, races, seed, cfg, opts = {}) {
  const exp = (r) => (cfg.minAllN ? r.pminN : r.pooled || cfg.minAll ? r.pmin : r.k);   /* cfg.minAll (a proposal, 11 Nov): everyone expected along its own path, capped at own */   // everyone at full size (owner, 5 Nov; #B-9 B9-2)
  // cfg.void: the owner's producer void (VHP more than ±void away from own during the race: out of that race)
  // cfg.v4 (RULE_VERSION 4, 11 Nov): the void band by race length, down and up; expected blocks along the producer's own
  // path capped at own, for everyone; the luck cap (a producer above cfg.cap expected blocks is scored on a sample of the
  // blocks); the yardstick counts credited blocks
  const band = cfg.v4 ? R.voidBand(c.blocks).map((x) => Number(x) / 1e6) : null, cap = cfg.v4 ? Number(R.LUCK_CAP) / 1e6 : Infinity;
  const isVoid = (r) => (cfg.v4 ? r.devDown > band[0] || r.devUp > band[1] : cfg.void && r.dev > cfg.void);
  const field = c.rows.filter((r) => r.k >= cfg.minK && !r.gated && !isVoid(r) && !(opts.out || []).includes(r.p)).map((r) => { const q = Math.min(1, cap / r.k); return { ...r, q, e: (cfg.v4 ? r.pmin : exp(r)) * q }; }).sort((x, y) => y.e - x.e);
  if (field.length < 2) return null;
  const draws = field.map((r) => pois(r.lam)), tabs = cfg.rank === "A" ? field.map((r) => pois(r.e)) : null;
  // A′ as built (D-165, D-171): the core is the field members with form ≥ 0.97 × the field's median form, the median
  // weighted by expected blocks (exact tie: the lower form); a producer's yardstick is the core less any other core
  // member more than 2 sd from its share of the core's blocks (the band, decided per race below), plus itself
  const byForm = field.map((r, i) => i).sort((a, b) => field[a].form - field[b].form), eAll = field.reduce((s, r) => s + r.e, 0);
  let med = 0; { let cum = 0; for (const i of byForm) { cum += field[i].e; if (2 * cum >= eAll - 1e-9) { med = field[i].form; break; } } }
  const core = field.map((r) => r.form >= 0.97 * med), eC = field.reduce((s, r, i) => s + (core[i] ? r.e : 0), 0);
  let hs = null;
  if (cfg.rank === "B") {
    const ks = field.map((r) => r.e), cal = RM.calibrate(ks, 1500);
    const topAvg = Math.max(...c.rows.map((r) => r.avg)), kTop = c.blocks * topAvg / c.total;
    hs = field.map((r) => RM.handicapOf(r.e, kTop, cal.c));
  }
  const rng = RM.rng(seed), rngCap = RM.rng(seed + 770077), rnd2 = () => rngCap.next(), wins = new Float64Array(field.length);
  // the race block by block, as on chain (#B-9 follow-up): the window's B blocks each go to one producer, the field in
  // proportion to its λ (its real share × what it signs), everyone else to "the rest"; so the field's counts are
  // multinomial (a big producer's good race leaves fewer blocks for the others), not independent
  // drawn as a chain of exact binomials (the same distribution as block by block, far faster)
  const B = c.blocks, lamF = field.reduce((s, r) => s + r.lam, 0), wts = [...field.map((r) => r.lam), Math.max(0, B - lamF)], wsum = wts.reduce((s, x) => s + x, 0), cnt = new Int32Array(field.length + 1), rnd = () => rng.next();
  for (let t = 0; t < races; t++) {
    let best = -Infinity, who = [];
    const xs = new Float64Array(field.length), ys = new Float64Array(field.length); let nF = 0;   // ys: what the yardstick counts (v4: credited)
    { let left = B, wl = wsum; for (let i = 0; i < wts.length; i++) { const k = i === wts.length - 1 ? left : binom(left, wl > 0 ? wts[i] / wl : 0, rnd); cnt[i] = k; left -= k; wl -= wts[i]; } }
    for (let i = 0; i < field.length; i++) {
      const r = field[i], n = cnt[i];
      // thinned credit (a proposal): each signed block counts whole with probability own ÷ eff (on chain: decided by the
      // block id), so the count stays Poisson at the card's size; today's credit counts each block at that fraction
      const cn = r.q < 1 ? binom(n, r.q, rnd2) : n;   // the luck cap: the blocks that count for it (its own random stream, so runs that share draws still do)
      let x = cn * r.credFrac;
      if (cfg.thin && r.credFrac < 1) { x = 0; for (let j = 0; j < n; j++) if (rng.next() < r.credFrac) x++; }
      xs[i] = x; ys[i] = cfg.v4 ? x : n; if (core[i]) nF += ys[i];
    }
    // the band (D-171): core members more than 2 sd from their share of the core's blocks this race
    let nY = nF, eY = eC;
    const aside = field.map((r, j) => { if (!core[j] || eC <= 0) return false; const p = r.e / eC, mu = nF * p, sd = Math.sqrt(nF * p * (1 - p)); const out = Math.abs(ys[j] - mu) > 2 * sd; if (out) { nY -= ys[j]; eY -= r.e; } return out; });
    if (opts.asides) for (let j = 0; j < field.length; j++) if (aside[j]) opts.asides[field[j].p] = (opts.asides[field[j].p] || 0) + 1;
    for (let i = 0; i < field.length; i++) {
      const r = field[i], x = xs[i], self = core[i] && !aside[i];
      const s = cfg.rank === "A" ? midp(tabs[i], x) : cfg.rank === "A2" ? binMidp(cfg.v4 ? Math.floor(self ? nY : nY + ys[i]) : self ? nY : nY + cnt[i], self ? r.e / eY : r.e / (eY + r.e), x) : x * hs[i];
      if (s > best + 1e-12) { best = s; who = [i]; } else if (Math.abs(s - best) <= 1e-12) who.push(i);
    }
    for (const i of who) wins[i] += 1 / who.length;   // ties: split (on a card: broken by the card's seed)
  }
  // D-165 (N-2): with opts.fairWin, fair = 1 ÷ (field − members that can't win): the steady throttlers, i.e. steady
  // members below the core line; they get no ratio (cantWin)
  const cantWin = field.map((r, i) => !!opts.fairWin && r.steady && !core[i]), F = field.length - cantWin.filter(Boolean).length;
  return Object.fromEntries(field.map((r, i) => [r.p, { chance: wins[i] / races, fair: 1 / F, ratio: wins[i] / races * F, index: r.lam * r.credFrac * (r.q ?? 1) / r.e, k: r.k, e: r.e, cantWin: cantWin[i], core: core[i] }]));
}

export const CONFIGS = { "v4 (as built)": { rank: "A2", minK: 10, poolRule: "min", v4: true }, "A′ + void": { rank: "A2", minK: 10, poolRule: "min", void: 0.1 }, "A + void": { rank: "A", minK: 10, poolRule: "min", void: 0.1 }, "A′ (fpct)": { rank: "A2", minK: 10, poolRule: "min" }, "A′ + thinned credit (proposal)": { rank: "A2", minK: 10, poolRule: "min", thin: true }, "A (pct)": { rank: "A", minK: 10, poolRule: "min" }, "A′ + void + min for all (proposal)": { rank: "A2", minK: 10, poolRule: "min", void: 0.1, minAll: true }, "A′ + void + per-block min for all (proposal)": { rank: "A2", minK: 10, poolRule: "min", void: 0.1, minAllN: true } };

export function run(L, { cards = 40, races = 2500, only = null, log = console.log, moved = () => false, configs = CONFIGS } = {}) {
  const dry = days(L) < 29, res = [], want = (i) => !only || only.includes(i);
  // every card has its full 14-day look-back (as a paying card must), so each producer's D-120 rate is known
  const rng = RM.rng(20261105), slots = raceSlots(L).filter((w) => w.W0 - R.FORM >= L.validFrom), nC = Math.min(cards, slots.length);
  const chosen = Array.from({ length: nC }, (_, i) => slots[Math.floor(i * slots.length / nC)]);
  const fields = chosen.map((w) => {
    const base = w.W0 - BLOCKS_PER_DAY - 1300, ps = L.active(w.W0).filter((a) => Number(L.eff(a, w.W0)) > 0), paths = {};
    for (const p of ps) paths[p] = effArray(L, p, base, w.S1);
    const Nreal = new Float64Array(w.S1 - base + 1); for (const p of ps) for (let i = 0; i < Nreal.length; i++) Nreal[i] += paths[p][i];
    const T = w.W0 + Math.floor(rng.next() * (w.W1 - w.W0 + 1));
    // D-120: each real producer's rate at T, from the real 14 days (steady ones sign at that rate in the races)
    const rates = {}, steady = {}, forms = {};
    for (const p of ps) { const fo = R.formOf(L, p, T), r = R.rateOf(L, p, T, fo); rates[p] = Number(r.rate) / 1e6; steady[p] = r.steady; forms[p] = Number(fo.form) / 1e6; }
    return { w, base, ps, paths, Nreal, T, rates, steady, forms };
  });
  log(`${days(L).toFixed(1)} days · ${fields.length} race cards · ${races} races each · configs ${Object.keys(configs).join(", ")}${dry ? " · DRY RUN (needs 29+ days)" : ""}`);
  const say = (id, name, cfg, metric, pass, mark, detail) => { res.push({ id, name, cfg, metric, pass: dry ? null : pass, mark, detail }); log(`${dry ? "DRY " : pass ? "PASS" : "MISS"} sim ${id} [${cfg}] ${name}: ${metric} (mark: ${mark})`); };
  const agg = (per) => Object.fromEntries(Object.entries(per).map(([p, xs]) => [p, { n: xs.length, ratio: xs.reduce((s, x) => s + x.chance, 0) / xs.reduce((s, x) => s + x.fair, 0), index: xs.reduce((s, x) => s + x.index, 0) / xs.length, k: xs.reduce((s, x) => s + x.k, 0) / xs.length }]));
  const span = (o, f) => { const v = Object.values(o).map(f); return v.length ? [Math.min(...v), Math.max(...v)] : [NaN, NaN]; };
  // synthetic producers' forms are given relative to signing in full; on real cards everyone else's form is ~1.1–1.3
  // (a big throttler's blocks go to the rest), so a synthetic form is scaled by the card's median real form, and a
  // synthetic producer without one signs in full at that median (D-165's core line is relative to the field)
  const medForm = (f) => { const xs = f.ps.map((p) => f.forms[p]).filter((x) => x > 0).sort((a, b) => a - b), h = xs.length; return h === 0 ? 1 : h % 2 ? xs[(h - 1) / 2] : (xs[h / 2 - 1] + xs[h / 2]) / 2; };
  const field = (f, extra = {}) => {
    const m = extra.forms && extra.forms.__abs ? 1 : medForm(f), syn = {};
    for (const p of Object.keys(extra.add || {})) syn[p] = m * ((extra.forms && extra.forms[p]) ?? 1);
    const forms = { ...f.forms, ...(extra.forms && extra.forms.__abs ? extra.forms : {}), ...syn };
    if (extra.forms && !extra.forms.__abs) for (const [p, v] of Object.entries(extra.forms)) if (!(p in syn)) forms[p] = v * m;
    return card({ ...f.paths, ...(extra.add || {}) }, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT, ...(extra.pooled || [])], rates: { ...f.rates, ...(extra.rates || {}) }, signs: extra.signs, N: extra.N, forms, steady: { ...f.steady, ...(extra.steady || {}) } });
  };
  const honest = (cfg, mk, steadyOnly = true, seed0 = 1000, copts = {}) => {
    const per = {};
    fields.forEach((f, ci) => {
      const cd = field(f, mk ? mk(f) : {}), ch = chances(cd, races, seed0 + ci, cfg, copts); if (!ch) return;
      if (process.env.RULER_SIM_DIAG) for (const r of cd.rows) if (ch[r.p]) console.error(JSON.stringify({ ci, p: r.p.slice(0, 10), k: +r.k.toFixed(1), lam: +r.lam.toFixed(1), cf: +r.credFrac.toFixed(4), pminN: +r.pminN.toFixed(1), pmin: +r.pmin.toFixed(1), dev: +r.dev.toFixed(4), ratio: +ch[r.p].ratio.toFixed(2) }));
      for (const [p, x] of Object.entries(ch)) { if (x.cantWin) continue; if (steadyOnly && !p.startsWith("~") && moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) continue; (per[p] ||= []).push(x); }
    });
    return agg(per);
  };
  for (const [name, cfg] of Object.entries(configs)) {
    if (want(1)) {
      // (a) every producer honest and signing in full (rate 1, form 1: what a full producer's record shows)
      const adds = (f) => ({ "~shrinks 1%/day": synthetic(f.Nreal, 0.03, false), "~re-burns hourly": synthetic(f.Nreal, 0.03, true) });
      const ones = (f) => Object.fromEntries(f.ps.map((p) => [p, 1]));
      const r = honest(cfg, (f) => ({ add: adds(f), rates: ones(f), forms: { ...ones(f), __abs: true } }));
      const enough = Object.fromEntries(Object.entries(r).filter(([, v]) => v.n >= 5));
      const [w0, w1] = span(enough, (x) => x.ratio), [i0, i1] = span(enough, (x) => x.index);
      // (b) as on the real days: each steady producer signs at its real 14-day rate. Marked (D-165, N-2) against fair =
      // 1 ÷ (field − members that can't win): the steady throttlers (steady members below the core line) are left out
      const rr = honest(cfg, (f) => ({ add: adds(f), signs: Object.fromEntries(f.ps.filter((p) => f.steady[p]).map((p) => [p, f.rates[p]])) }), true, 1000, { fairWin: true });
      const full = Object.fromEntries(Object.entries(rr).filter(([, v]) => v.n >= 5));
      const [x0, x1] = span(full, (x) => x.ratio);
      say(1, "honest field", name, `all full: win chance ${w0.toFixed(2)} … ${w1.toFixed(2)} of fair (${Object.keys(enough).length} producers in 5+ races), index ${i0.toFixed(4)} … ${i1.toFixed(4)}; real rates (fair = 1 ÷ field less steady throttlers): ${x0.toFixed(2)} … ${x1.toFixed(2)} (${Object.keys(full).length})`, w0 >= 0.84 && w1 <= 1.16 && x0 >= 0.84 && x1 <= 1.16, "wins 0.84–1.16 of fair (D-170), all full and at real rates (index: see report)", { allFull: r, realRates: rr });
    }
    if (want(2)) {
      const r = honest(cfg, (f) => ({ add: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`~small${String(i).padStart(3, "0")}`, synthetic(f.Nreal, 0.0005 + i * 0.0001, i % 2 === 0)])) }));
      const small = Object.fromEntries(Object.entries(r).filter(([p, v]) => p.startsWith("~small") && v.n >= 5));
      const [w0, w1] = span(small, (x) => x.ratio), [a0, a1] = span(Object.fromEntries(Object.entries(r).filter(([, v]) => v.n >= 5)), (x) => x.ratio);
      say(2, "100 producers under 1%", name, `${Object.keys(small).length} small ones in fields: wins ${w0.toFixed(2)} … ${w1.toFixed(2)} of fair; everyone ${a0.toFixed(2)} … ${a1.toFixed(2)}`, w0 >= 0.85 && w1 <= 1.15, "small producers 0.85–1.15 of fair", r);
    }
    if (want(3)) {
      const tricks = {
        "hide 97% for 25 h": (e, f) => mod(e, f, (H) => (H > f.w.L - 30000 && H <= f.w.L + 20 ? 0.03 : 1)),
        "hide 50% for 7 days": (e, f) => mod(e, f, (H) => (H <= f.w.L + 20 ? 0.5 : 1)),
        "lower slowly to 50% over 2 weeks": (e, f) => mod(e, f, (H) => (H <= f.w.L + 20 ? 0.5 + 0.5 * Math.max(0, (f.w.L - H) / (14 * BLOCKS_PER_DAY)) : 1)),
        "add 100% in the race": (e, f) => mod(e, f, (H) => (H >= f.w.S0 + 20 ? 2 : 1)),
      };
      const out = {}; let worst = -Infinity;
      for (const s of [0.002, 0.02, 0.2]) for (const [tn, t] of Object.entries(tricks)) {
        let gain = 0, b0 = 0, n = 0;
        fields.forEach((f, ci) => {
          const e = synthetic(f.Nreal, s, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
          for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base];
          const hc = chances(field(f, { add: { "~me": e }, N }), races, 5000 + ci, cfg), tc = chances(field(f, { add: { "~me": t(e, f) }, N }), races, 5000 + ci, cfg);
          if (!hc || !tc || !hc["~me"]) return;
          b0 += hc["~me"].chance; gain += (tc["~me"] ? tc["~me"].chance : 0) - hc["~me"].chance; n++;
        });
        const g = n ? gain / n : 0, b = n ? b0 / n : 0; out[`${(s * 100).toFixed(1)}% · ${tn}`] = { honest: b, gain: g, n };
        worst = Math.max(worst, g - 2 * Math.sqrt(Math.max(b, 1e-4) / (races * Math.max(n, 1))));
      }
      say(3, "every trick, parked for free", name, Object.entries(out).map(([k, v]) => `${k}: ${v.honest.toFixed(3)} → ${(v.honest + v.gain).toFixed(3)}`).join("; "), worst <= 0, "expected gain ≤ 0", out);
    }
    if (want(7)) {
      const out = {};
      // withdrawals after the card, and (#B-9 B9-6) deposits after the card, at the window's start or its middle
      // Repo Lens #B-10 SIM-1: swings inside the ±10% band are measured (they can fail), and every swing reports how often
      // the Vault is void and its win share counting a void race as a non-win
      const voids = {}, asLoss = {};
      for (const [lbl, factor, at] of [["no change", 1, "L"], ["5% withdrawn", 0.95, "L"], ["+5% deposit", 1.05, "L"], ["+9% mid-race", 1.09, "mid"], ["50% withdrawn", 0.5, "L"], ["90% withdrawn", 0.1, "L"], ["doubled by a deposit", 2, "L"], ["doubled mid-race", 2, "mid"]]) {
        let ch = 0, n = 0, tried = 0;
        fields.forEach((f, ci) => {
          const e = f.paths[VAULT] ? f.paths[VAULT] : synthetic(f.Nreal, 0.08, true), from = at === "L" ? f.w.L : f.w.S0 + RACE / 2;
          const x = mod(e, f, (H) => (H > from && H <= f.w.S1 ? factor : 1));
          const r = chances(field(f, { add: { [VAULT]: x } }), races, 7000 + ci, cfg);
          const c0 = field(f, { add: { [VAULT]: x } }).rows.find((q) => q.p === VAULT);
          if (c0 && c0.k >= cfg.minK && !c0.gated) tried++;
          if (r && r[VAULT]) { ch += r[VAULT].ratio; n++; }
        });
        out[lbl] = n ? ch / n : cfg.void && factor !== 1 ? "void" : null;   // void: the Vault sits that race out (picks on it lose)
        voids[lbl] = tried ? 1 - n / tried : 0; asLoss[lbl] = tried ? ch / tried : 0;
      }
      out.voidRate = voids; out.winShareVoidAsLoss = asLoss;
      const lbls = Object.keys(voids), v = lbls.map((k) => out[k]), num = v.filter((x) => typeof x === "number");
      say(7, "Vault deposit swings", name, lbls.map((k) => `${k}: ${out[k] === null ? "n/a" : out[k] === "void" ? "void for that race" : out[k].toFixed(2) + "× fair"} (void ${(voids[k] * 100).toFixed(0)}%, ${asLoss[k].toFixed(2)}× counting void as a loss)`).join("; "), typeof out["no change"] === "number" && v.every((x) => x === "void" || x === null || (typeof x === "number" && Math.abs(x - num[0]) <= 0.15))   /* null: void on every card */, "no withdrawal or deposit moves the Vault beyond ±0.15 of its no-change case (a void race counts as no move)", out);
    }
    if (want(8)) {   // throttlers (owner, 5 Nov): in the games at full size while steady; steering can't pay
      const out = {};
      // (a) JGA Pool #2, its real history, signing at its real rate
      const jga = [], jSeen = [];
      fields.forEach((f, ci) => { if (!f.paths[JGA2]) return; jSeen.push({ rate: f.rates[JGA2], steady: f.steady[JGA2], form: f.forms[JGA2] }); const ch = chances(field(f, { signs: { [JGA2]: Math.min(1, f.forms[JGA2]) } }), races, 8000 + ci, cfg); if (ch && ch[JGA2]) jga.push(ch[JGA2]); });
      out.jga = { cards: jSeen.length, inField: jga.length, steadyCards: jSeen.filter((x) => x.steady).length, benched: jSeen.filter((x) => !x.steady && x.form < 0.8).length, forms: [Math.min(...jSeen.map((x) => x.form)), Math.max(...jSeen.map((x) => x.form))], ratio: jga.length ? jga.reduce((s, x) => s + x.chance, 0) / jga.reduce((s, x) => s + x.fair, 0) : NaN };
      // (b) a synthetic 2% producer: honest; a steady throttler at 0.66 (in, at full size); a steerer (0.66 for two weeks,
      // so steady and in, then signs in full in the race); (c) an honest 3-day outage (form 0.79, not steady: out until
      // steady or back at 0.80, then in again at full size, never boosted)
      const one = (form, steady, signs) => {
        let c0 = 0, f0 = 0, n = 0, inF = 0;
        fields.forEach((f, ci) => {
          const e = synthetic(f.Nreal, 0.02, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
          for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base] * signs;
          const c = field(f, { add: { "~me": e }, signs: { "~me": signs }, steady: { "~me": steady }, N });
          c.rows.find((r) => r.p === "~me").gated = !steady && form < 0.8;
          const ch = chances(c, races, 8500 + ci, cfg);
          n++; if (ch && ch["~me"]) { inF++; c0 += ch["~me"].chance; f0 += ch["~me"].fair; }
        });
        return { ratio: f0 ? c0 / f0 : 0, chance: n ? c0 / n : 0, inField: inF, cards: n };
      };
      out.honest = one(1, false, 1); out.throttler = one(0.66, true, 0.66); out.steerer = one(0.66, true, 1); out.outage = one(11 / 14, false, 1);
      // Repo Lens #B-10 SIM-2: the strategies the new rules leave open. One owner runs a 2% producer "~me" and an 8%
      // address "~park" that is steady at 0.05 for two weeks: (a) it stays parked in the race; (b) it signs in full in the
      // race. Neither may raise the owner's win chance (~me + ~park) above the same two addresses run honestly (the 8% one
      // signing in full with a full record). (Two producers always have two fair shares: every producer's fair share is
      // 1 ÷ field size, whatever its size, so the baseline is the honest pair, not one 10% producer.)
      const pair = (parkSigns, honestPark = false) => {
        let c0 = 0, n = 0;
        fields.forEach((f, ci) => {
          const me = synthetic(f.Nreal, 0.02, true), pk = synthetic(f.Nreal, 0.08, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
          for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + me[b - f.base] + pk[b - f.base] * parkSigns;
          const c = field(f, { add: { "~me": me, "~park": pk }, signs: { "~park": parkSigns }, steady: { "~me": false, "~park": !honestPark }, forms: { "~me": 1, "~park": honestPark ? 1 : 0.05 }, rates: { "~park": honestPark ? 1 : 0.05 }, N });
          const ch = chances(c, races, 8700 + ci, cfg);
          n++; if (ch) c0 += (ch["~me"] ? ch["~me"].chance : 0) + (ch["~park"] ? ch["~park"].chance : 0);
        });
        return n ? c0 / n : 0;
      };
      const big = () => { let c0 = 0, n = 0; fields.forEach((f, ci) => { const e = synthetic(f.Nreal, 0.1, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1); for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base]; const ch = chances(field(f, { add: { "~me": e }, steady: { "~me": false }, forms: { "~me": 1 }, N }), races, 8700 + ci, cfg); n++; if (ch && ch["~me"]) c0 += ch["~me"].chance; }); return n ? c0 / n : 0; };
      out.parked = { honest10: big(), honestPair: pair(1, true), parked: pair(0.05), switchOn: pair(1) };
      // Repo Lens #B-11 N-1 / D-165: an 18% member kept steady at 0.80, 0.90 or 0.95 of full (in the field) that signs in
      // full in the race, against the same member honest at full; and the others' win range beside it
      const n1 = (form) => {
        let c0 = 0, n = 0; const per = {};
        fields.forEach((f, ci) => {
          const e = synthetic(f.Nreal, 0.22, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
          for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base];
          const ch = chances(field(f, { add: { "~n1": e }, steady: { "~n1": form < 1 }, forms: { "~n1": form }, N }), races, 8800 + ci, cfg); n++;
          if (ch) for (const [p, x] of Object.entries(ch)) if (p === "~n1") c0 += x.chance; else if (!moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) (per[p] ||= []).push(x);
        });
        const each = Object.fromEntries(Object.entries(agg(per)).filter(([, v]) => v.n >= 5)), [lo, hi] = span(each, (x) => x.ratio);
        return { chance: n ? c0 / n : 0, others: [lo, hi], each: Object.fromEntries(Object.entries(each).map(([p, v]) => [p, v.ratio])) };
      };
      out.n1 = { honest: n1(1), at95: n1(0.95), at90: n1(0.9), at80: n1(0.8) };
      // Repo Lens #B-12 N-4 / D-171: an 18% core member (full record) that signs 0.97 or 0.90 of its share in the race.
      // Judged: no producer drops more than 0.05 below its honest result (D-170), and the skipper plus any one partner
      // never beats the same pair honest (skipping to lift a partner gains nothing)
      const n4 = (signs) => {
        const per = {}, mine = [];
        fields.forEach((f, ci) => {
          const e = synthetic(f.Nreal, 0.22, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
          for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base] * signs;
          const ch = chances(field(f, { add: { "~n4": e }, signs: { "~n4": signs }, steady: { "~n4": false }, forms: { "~n4": 1 }, N }), races, 8900 + ci, cfg);
          mine.push(ch ? Object.fromEntries(Object.entries(ch).map(([p, x]) => [p, x.chance])) : {});
          if (ch) for (const [p, x] of Object.entries(ch)) if (p !== "~n4" && !moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) (per[p] ||= []).push(x);
        });
        const each = Object.fromEntries(Object.entries(agg(per)).filter(([, v]) => v.n >= 5));
        return { each: Object.fromEntries(Object.entries(each).map(([p, v]) => [p, v.ratio])), cards: mine };
      };
      out.n4 = { honest: n4(1), at97: n4(0.97), at90: n4(0.9) };
      const pairGain = (k) => {   // the largest (skipper + partner) win-chance gain over the honest pair, averaged over cards
        const ps = new Set(); for (const c of out.n4.honest.cards) for (const p of Object.keys(c)) if (p !== "~n4") ps.add(p);
        let worst = -Infinity;
        for (const p of ps) { let d = 0, n = 0; out.n4[k].cards.forEach((c, i) => { const h = out.n4.honest.cards[i]; if (p in c && p in h) { d += (c["~n4"] || 0) + c[p] - (h["~n4"] || 0) - h[p]; n++; } }); if (n >= 5) worst = Math.max(worst, d / n); }
        return worst;
      };
      out.n4.pairGain = { at97: pairGain("at97"), at90: pairGain("at90") };
      const drop = (o, k) => Math.max(0, ...Object.entries(o[k].each).filter(([p]) => p in o.honest.each).map(([p, x]) => o.honest.each[p] - x));
      // D-171's other half: 16 small steady addresses (~0.14% of the network each, about 17,500 VHP, k ≥ 10) at 0.80 of
      // full can't move the weighted median: no real producer's core flag changes on any card; no one drops > 0.05
      let flips = 0, cardsSeen = 0; const perS = {}, perB = {};
      fields.forEach((f, ci) => {
        const add = {}, signs = {}, steady = {}, forms = {}, N = new Float64Array(f.w.S1 - f.w.S0 + 1);
        for (let j = 0; j < 16; j++) { const k = "~small" + j; add[k] = synthetic(f.Nreal, 0.0014, true); signs[k] = 0.8; steady[k] = true; forms[k] = 0.8; }
        for (let b = f.w.S0; b <= f.w.S1; b++) { let t = f.Nreal[b - f.base]; for (const k of Object.keys(add)) t += add[k][b - f.base] * 0.8; N[b - f.w.S0] = t; }
        const base = chances(field(f, {}), races, 9100 + ci, cfg), withS = chances(field(f, { add, signs, steady, forms, N }), races, 9100 + ci, cfg);
        if (!base || !withS) return; cardsSeen++;
        for (const [p, x] of Object.entries(base)) { if (p in withS && withS[p].core !== x.core) flips++; if (!moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) { (perB[p] ||= []).push(x); if (p in withS) (perS[p] ||= []).push(withS[p]); } }
      });
      const rB = Object.fromEntries(Object.entries(agg(perB)).filter(([, v]) => v.n >= 5).map(([p, v]) => [p, v.ratio])), rS = Object.fromEntries(Object.entries(agg(perS)).filter(([, v]) => v.n >= 5).map(([p, v]) => [p, v.ratio]));
      out.small16 = { cards: cardsSeen, coreFlips: flips, largestDrop: Math.max(0, ...Object.keys(rS).filter((p) => p in rB).map((p) => rB[p] - rS[p])) };
      const err = 2 * Math.sqrt(Math.max(out.honest.chance, 1e-4) / (races * Math.max(out.honest.cards, 1)));
      const errP = 2 * Math.sqrt(Math.max(out.parked.honestPair, 1e-4) / (races * Math.max(out.honest.cards, 1)));
      const errN = 2 * Math.sqrt(Math.max(out.n1.honest.chance, 1e-4) / (races * Math.max(out.honest.cards, 1)));
      const n1ok = ["at95", "at90", "at80"].every((k) => out.n1[k].chance <= out.n1.honest.chance + errN && Object.entries(out.n1[k].each).every(([p, x]) => !(p in out.n1.honest.each) || x >= out.n1.honest.each[p] - 0.05));   // D-170: low side only, per producer
      const errQ = 2 * Math.sqrt(0.3 / (races * Math.max(out.honest.cards, 1)));
      const n4ok = ["at97", "at90"].every((k) => drop(out.n4, k) <= 0.05 && out.n4.pairGain[k] <= errQ), smallOk = out.small16.coreFlips === 0 && out.small16.largestDrop <= 0.05;
      const pass = out.steerer.chance <= out.honest.chance + err && out.throttler.inField === out.throttler.cards && out.outage.inField === 0 && out.parked.parked <= out.parked.honestPair + errP && out.parked.switchOn <= out.parked.honestPair + errP && n1ok && n4ok && smallOk;
      say(8, "throttlers and steering", name, `JGA Pool #2 (real, signing at its real rate): steady on ${out.jga.steadyCards} of ${out.jga.cards} cards, in the field on ${out.jga.inField} (benched on ${out.jga.benched}: not steady and below 0.80), wins ${out.jga.ratio.toFixed(2)}× fair there; a 2% producer: honest ${out.honest.chance.toFixed(3)} (${out.honest.ratio.toFixed(2)}× fair), steady throttler at 0.66 in the field on ${out.throttler.inField} of ${out.throttler.cards} cards, wins ${out.throttler.chance.toFixed(3)} (${out.throttler.ratio.toFixed(2)}×), steerer ${out.steerer.chance.toFixed(3)} (${out.steerer.ratio.toFixed(2)}×); after a 3-day outage: in the field on ${out.outage.inField} of ${out.outage.cards} cards (back once steady or at 0.80); a 2% producer plus an 8% address parked at 0.05: ${out.parked.parked.toFixed(3)} parked, ${out.parked.switchOn.toFixed(3)} switched on in the race, vs ${out.parked.honestPair.toFixed(3)} run honestly (${out.parked.honest10.toFixed(3)} as one 10% producer); an 18% member steady at 0.95 / 0.90 / 0.80 that signs in full: ${["at95", "at90", "at80"].map((k) => out.n1[k].chance.toFixed(3)).join(" / ")} vs ${out.n1.honest.chance.toFixed(3)} honest, others ${["at95", "at90", "at80"].map((k) => out.n1[k].others.map((x) => x.toFixed(2)).join("–")).join(" / ")} (honest ${out.n1.honest.others.map((x) => x.toFixed(2)).join("–")}); the largest drop of any producer from its honest result: ${["at95", "at90", "at80"].map((k) => Math.max(0, ...Object.entries(out.n1[k].each).filter(([p]) => p in out.n1.honest.each).map(([p, x]) => out.n1.honest.each[p] - x)).toFixed(3)).join(" / ")}; an 18% core member signing 0.97 / 0.90 (N-4): largest drop of another producer ${drop(out.n4, "at97").toFixed(3)} / ${drop(out.n4, "at90").toFixed(3)}, its best pair gain ${out.n4.pairGain.at97.toFixed(4)} / ${out.n4.pairGain.at90.toFixed(4)}; 16 small steady addresses at 0.80: core flags changed on ${out.small16.coreFlips} producer-cards of ${out.small16.cards} cards, largest drop ${out.small16.largestDrop.toFixed(3)}`, pass, "steering never beats honest; a steady throttler stays in; an outage gives no boost; parking or switching on a parked address never beats running it honestly; a member kept below its rate that signs in full in the race gains nothing and moves no one (#B-11 N-1); a core member that skips lifts no partner and drops no one > 0.05 (#B-12 N-4); 16 small steady addresses move no one across the line (D-171)", out);
    }
    if (want(9)) {
      const out = {};
      for (const [sc, how] of [["a 1% producer joins mid-race", "join"], ["the biggest producer leaves mid-race", "leave"], ["a mint adds 10% to the network mid-race", "mint"]]) {
        const per = {}, rel = [];
        fields.forEach((f, ci) => {
          const big = f.ps.slice().sort((a, b) => f.paths[b][f.T - f.base] - f.paths[a][f.T - f.base])[0], mid = f.w.S0 + RACE / 2;
          const paths = { ...f.paths };
          if (how === "leave") paths[big] = mod(f.paths[big], f, (H) => (H >= mid ? 0 : 1));
          else if (how === "mint") paths["~minted"] = mod(new Float64Array(f.paths[big].length).fill(0.1 * f.Nreal[f.T - f.base]), f, (H) => (H >= mid + 20 ? 1 : 0));
          else paths["~joins"] = mod(new Float64Array(f.paths[big].length).fill(0.01 * f.Nreal[f.T - f.base]), f, (H) => (H >= mid + 20 ? 1 : 0));
          const c0 = card(f.paths, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT], forms: f.forms, steady: f.steady }), c1 = card(paths, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT], forms: f.forms, steady: f.steady });
          const before = Object.fromEntries(c0.rows.map((r) => [r.p, r.lam * r.credFrac]));
          for (const r of c1.rows) if (r.k >= 10 && r.p !== big && !r.p.startsWith("~")) rel.push((r.lam * r.credFrac) / before[r.p]);
          const ch = chances(c1, races, 9000 + ci, cfg, { out: ["~minted", "~joins", how === "leave" ? big : ""] });
          if (ch) for (const [p, x] of Object.entries(ch)) if (!moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) (per[p] ||= []).push(x);
        });
        const a = agg(per), enough = Object.fromEntries(Object.entries(a).filter(([, v]) => v.n >= 5)), [w0, w1] = span(enough, (x) => x.ratio);
        out[sc] = { indexMin: Math.min(...rel), indexMax: Math.max(...rel), winMin: w0, winMax: w1, low: Object.entries(enough).sort((x, y) => x[1].ratio - y[1].ratio).slice(0, 3).map(([p, v]) => ({ p, ratio: v.ratio, n: v.n, k: v.k })) };
      }
      const j = out["a 1% producer joins mid-race"], ok = j.indexMin >= 0.99 && j.indexMax <= 1.01 && ["the biggest producer leaves mid-race", "a mint adds 10% to the network mid-race"].every((k) => out[k].winMin >= 0.85 && out[k].winMax <= 1.15);
      say(9, "joining / leaving / network jumps", name, Object.entries(out).map(([k, v]) => `${k}: index × ${v.indexMin.toFixed(3)} … ${v.indexMax.toFixed(3)}, wins ${v.winMin.toFixed(2)} … ${v.winMax.toFixed(2)} of fair`).join("; "), ok, "one producer: index ±0.01; network jump: wins 0.85–1.15 of fair", out);
    }
    if (want(10)) {
      let flips = 0, seen = 0;
      fields.forEach((f) => { const inAt = (T) => new Set(card(f.paths, f.base, T, f.w.S0, f.w.S1, { forms: f.forms, steady: f.steady }).rows.filter((r) => r.k >= cfg.minK && !r.gated).map((r) => r.p)); const a = inAt(f.w.W0), b = inAt(f.w.W1); for (const p of f.ps) { seen++; if (a.has(p) !== b.has(p)) flips++; } });
      say(10, "a pick on a producer below the bar at T", name, `${flips} of ${seen} producer-cards cross the k ≥ ${cfg.minK} bar inside the card window; each game's stated rule applies (§5)`, true, "handled by each game's stated rule", { flips, seen });
    }
  }
  if (want(6)) {   // grinding under Fix A: the best moment's win chance against the average moment's, per producer
    const moves = [], cfg = configs["v4 (as built)"] || configs["A′ (fpct)"] || CONFIGS["A′ (fpct)"];
    fields.slice(0, 20).forEach((f, ci) => {
      const Ts = []; for (let T = f.w.W0; T <= f.w.W1; T += 600) Ts.push(T);
      const per = {};
      for (const T of Ts) { const ch = chances(card(f.paths, f.base, T, f.w.S0, f.w.S1, { pooled: [VAULT], forms: f.forms, steady: f.steady }), 3000, 6000 + ci, cfg); if (ch) for (const [p, x] of Object.entries(ch)) (per[p] ||= []).push(x.chance); }
      for (const xs of Object.values(per)) if (xs.length === Ts.length) { const m = xs.reduce((s, x) => s + x, 0) / xs.length; if (m > 0.01) moves.push(Math.max(...xs) / m - 1); }
    });
    moves.sort((a, b) => a - b); const q = (x) => moves[Math.floor(x * (moves.length - 1))];
    say(6, "seed grinding under A′ (win chance, best moment vs average)", "A′ (fpct)", `median +${(q(0.5) * 100).toFixed(1)}%, 90th percentile +${(q(0.9) * 100).toFixed(1)}% (3,000 races a moment, the same draws at every moment)`, null, "accepted residual (§16): re-measured, not judged", { median: q(0.5), p90: q(0.9), n: moves.length });
  }
  return { days: days(L), dry, results: res };
}

/** a timeline (and its VHP moves) from a vhp-data folder: every hour checked in order, as the publish job does */
export function loadVhpData(dir) {
  const texts = new Map();
  for (const f of fs.existsSync(path.join(dir, "d")) ? fs.readdirSync(path.join(dir, "d")) : []) { const d = JSON.parse(fs.readFileSync(path.join(dir, "d", f), "utf8")); d.hours.forEach((h, i) => texts.set(d.n * 24 + i, D.canon(h))); }
  for (const f of fs.readdirSync(path.join(dir, "h"))) texts.set(Number(f.replace(".json", "")), fs.readFileSync(path.join(dir, "h", f), "utf8"));
  const ns = [...texts.keys()].sort((a, b) => a - b), hours = [], checks = [];
  let prev = "";
  for (const n of ns) { const c = prev === "" ? D.checkKept(texts.get(n)) : D.checkHour(prev, texts.get(n)); /* the oldest kept hour may be chained to one retention removed */ if (!c.ok) throw new Error(`h/${n}: ${c.why}`); checks.push(c); hours.push(JSON.parse(texts.get(n))); prev = texts.get(n); }
  const tl = D.timelineFrom(hours, checks);
  tl.moves = hours.flatMap((h) => h.events.flatMap(([eh, , f, t]) => [f, t].filter(Boolean).map((a) => [eh, a])));
  return { tl, hours: ns.length, kinds: hours.reduce((o, h) => ((o[h.kind] = (o[h.kind] || 0) + 1), o), {}) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  // the float percentile against the ruler's own integer pct
  for (const [l, x] of [[10, 10], [3.7, 7], [150, 140.5], [1200, 1251]]) { const a = midp(pois(l), x), b = Number(R.pct(BigInt(Math.round(l * 1e6)), BigInt(Math.round(x * 1e6)))) / 1e6; if (Math.abs(a - b) > 2e-6) throw new Error(`float pct ${a} vs ruler ${b} at λ ${l}, x ${x}`); }
  for (const [n, p, x] of [[6500, 0.0462, 300], [6500, 0.2, 1340.5], [7200, 0.0015, 9], [7200, 0.5, 3650]]) { const a = binMidp(n, p, x), b = Number(R.fpct(BigInt(n), BigInt(Math.round(p * 1e12)), 1000000000000n, BigInt(Math.round(x * 1e6)))) / 1e6; if (Math.abs(a - b) > 2e-6) throw new Error(`float fpct ${a} vs ruler ${b} at n ${n}, p ${p}, x ${x}`); }
  let tl, src;
  if (fs.statSync(args[0]).isDirectory()) { const v = loadVhpData(args[0]); tl = v.tl; src = `vhp-data: ${v.hours} hours (${Object.entries(v.kinds).map(([k, n]) => `${n} ${k}`).join(", ")})`; }
  else { tl = JSON.parse(fs.readFileSync(args[0], "utf8")); for (const d of tl.deltas) { d.d = BigInt(d.d); d.inc = BigInt(d.inc); } for (const a of Object.values(tl.anchors)) a.v = BigInt(a.v); src = "timeline file"; }
  const t0 = Date.now(), L = R.ledger(tl);
  console.log(`${src}; ledger in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const out = run(L, { cards: Number(opt("--cards", 40)), races: Number(opt("--races", 2500)), only: opt("--only") ? opt("--only").split(",").map(Number) : null, moved: movedFn(tl.moves || []), configs: opt("--configs") ? Object.fromEntries(opt("--configs").split(",").map((k) => [k, CONFIGS[k]])) : CONFIGS });
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(out, null, 1));
}
