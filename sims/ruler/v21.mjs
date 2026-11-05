// Knode Games — the VHP ruler v2.1 simulations (VHP_RULER.md §16, R-RULER-2): Fix A (rank by the luck percentile pct)
// against Fix B (the Race's handicap with a higher entry bar, the trim recalibrated per card, and the time-weighted pool
// rule), each with D-120's steady-producer rate and its steering cap, on the same races.
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
const STEER = Number(R.STEER_BAND) / 1e6;
/** the steering cap as built (credited ≤ expected × 1.15), or a variant to compare: "pct:0.3" (× 1.3) or "z:1" (expected + 1·√expected) */
const capOf = (e, steer) => { if (!steer) return e * (1 + STEER); const [kind, v] = steer.split(":"); return kind === "z" ? e + Number(v) * Math.sqrt(e) : e * (1 + Number(v)); };
const Phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
/** A′ (a proposal for the library chat, not built): the mid-p percentile of x among the field's own blocks, Binomial(n, p)
 *  with n = the field's blocks in this race and p = the producer's share of the field's expected blocks — so a jump that
 *  moves the whole network moves no one's rank. Exact for small means, normal with continuity correction above 30. */
function binMidp(n, pr, x) {
  const mu = n * pr;
  if (mu >= 30 && n * (1 - pr) >= 30) return Phi((x - mu) / Math.sqrt(mu * (1 - pr)));
  const k = Math.floor(x), f = x - k; let below = 0, pk = 0, pk1 = 0, lp = n * Math.log(1 - pr);
  for (let i = 0; i <= Math.min(n, k + 1); i++) { const p = Math.exp(lp); if (i < k) below += p; else if (i === k) pk = p; else pk1 = p; lp += Math.log((n - i) / (i + 1)) + Math.log(pr / (1 - pr)); }
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
    const k = blocks * own[p] / total, rate = (opts.rates && opts.rates[p]) || 1, signs = (opts.signs && opts.signs[p]) ?? rate;
    let lam = 0, cred = 0, pmin = 0, ptwa = 0;
    for (let b = S0; b <= S1; b++) { const e = at(p, b), pr = e / N[b - S0]; lam += pr; cred += pr * (e <= own[p] ? 1 : own[p] / e); pmin += Math.min(own[p], e) / total; ptwa += e / total; }
    // `signs`: the share of its blocks the producer really signs (its real steady rate, or what a test makes it do)
    // the form gate (D-120): a steady producer at 0.80 × its rate, others at 0.80 (synthetic producers: form 1)
    const form = (opts.forms && opts.forms[p]) ?? 1, steady = !!(opts.steady && opts.steady[p]), gated = form < (steady ? 0.8 * rate : 0.8);
    return { p, own: own[p], avg: avg[p], k, rate, lam: lam * signs, credFrac: lam > 0 ? cred / lam : 0, pmin, ptwa, pooled: (opts.pooled || []).includes(p), gated };
  });
  return { rows, total, blocks };
}
/** win chances of the field under one configuration: { rank: "A" | "B", minK, poolRule } */
export function chances(c, races, seed, cfg, opts = {}) {
  const exp = (r) => (r.pooled ? (cfg.poolRule === "twa" ? r.ptwa : r.pmin) : r.k) * r.rate;
  const field = c.rows.filter((r) => r.k * r.rate >= cfg.minK && !r.gated && !(opts.out || []).includes(r.p)).map((r) => ({ ...r, e: exp(r) })).sort((x, y) => y.e - x.e);
  if (field.length < 2) return null;
  const draws = field.map((r) => pois(r.lam)), tabs = cfg.rank === "A" ? field.map((r) => pois(r.e)) : null, eSum = field.reduce((s, r) => s + r.e, 0);
  let hs = null;
  if (cfg.rank === "B") {
    const ks = field.map((r) => r.e), cal = RM.calibrate(ks, 1500);
    const topAvg = Math.max(...c.rows.map((r) => r.avg)), kTop = c.blocks * topAvg / c.total;
    hs = field.map((r) => RM.handicapOf(r.e, kTop, cal.c));
  }
  const rng = RM.rng(seed), wins = new Float64Array(field.length);
  for (let t = 0; t < races; t++) {
    let best = -Infinity, who = [];
    const xs = new Float64Array(field.length); let nF = 0;
    for (let i = 0; i < field.length; i++) {
      const r = field[i], n = draw(draws[i], rng.next());
      let x = n * r.credFrac;
      if (r.rate < 1) x = Math.min(x, capOf(r.e, cfg.steer));   // the steering cap
      xs[i] = x; nF += n;
    }
    for (let i = 0; i < field.length; i++) {
      const r = field[i], x = xs[i];
      const s = cfg.rank === "A" ? midp(tabs[i], x) : cfg.rank === "A2" ? binMidp(nF, r.e / eSum, x) : x * hs[i];
      if (s > best + 1e-12) { best = s; who = [i]; } else if (Math.abs(s - best) <= 1e-12) who.push(i);
    }
    for (const i of who) wins[i] += 1 / who.length;   // ties: split (on a card: broken by the card's seed)
  }
  return Object.fromEntries(field.map((r, i) => [r.p, { chance: wins[i] / races, fair: 1 / field.length, ratio: wins[i] / races * field.length, index: r.lam * r.credFrac / r.e, k: r.k, e: r.e }]));
}

export const CONFIGS = { A: { rank: "A", minK: 10, poolRule: "min" }, "A2 (proposal)": { rank: "A2", minK: 10, poolRule: "min" }, "B15": { rank: "B", minK: 15, poolRule: "twa" }, "B20": { rank: "B", minK: 20, poolRule: "twa" }, "B30": { rank: "B", minK: 30, poolRule: "twa" } };

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
  const field = (f, extra = {}) => card({ ...f.paths, ...(extra.add || {}) }, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT, ...(extra.pooled || [])], rates: { ...f.rates, ...(extra.rates || {}) }, signs: extra.signs, N: extra.N, forms: f.forms, steady: { ...f.steady, ...(extra.steady || {}) } });
  const honest = (cfg, mk, steadyOnly = true, seed0 = 1000) => {
    const per = {};
    fields.forEach((f, ci) => {
      const ch = chances(field(f, mk ? mk(f) : {}), races, seed0 + ci, cfg); if (!ch) return;
      for (const [p, x] of Object.entries(ch)) { if (steadyOnly && !p.startsWith("~") && moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) continue; (per[p] ||= []).push(x); }
    });
    return agg(per);
  };
  for (const [name, cfg] of Object.entries(configs)) {
    if (want(1)) {
      const r = honest(cfg, (f) => ({ add: { "~shrinks 1%/day": synthetic(f.Nreal, 0.03, false), "~re-burns hourly": synthetic(f.Nreal, 0.03, true) } }));
      const enough = Object.fromEntries(Object.entries(r).filter(([, v]) => v.n >= 5));
      const [w0, w1] = span(enough, (x) => x.ratio), [i0, i1] = span(enough, (x) => x.index);
      say(1, "honest field", name, `win chance ${w0.toFixed(2)} … ${w1.toFixed(2)} of fair (${Object.keys(enough).length} producers in 5+ races); index ${i0.toFixed(4)} … ${i1.toFixed(4)}`, w0 >= 0.85 && w1 <= 1.15, "wins 0.85–1.15 of fair (index: see report)", r);
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
      for (const w of [0, 0.5, 0.9]) {
        let ch = 0, n = 0;
        fields.forEach((f, ci) => {
          const e = f.paths[VAULT] ? f.paths[VAULT] : synthetic(f.Nreal, 0.08, true);
          const x = mod(e, f, (H) => (H > f.w.L && H <= f.w.S1 ? 1 - w : 1));
          const r = chances(field(f, { add: { [VAULT]: x } }), races, 7000 + ci, cfg);
          if (r && r[VAULT]) { ch += r[VAULT].ratio; n++; }
        });
        out[`${w * 100}% withdrawn`] = n ? ch / n : null;
      }
      const v = Object.values(out);
      say(7, "Vault deposit swings", name, Object.entries(out).map(([k, x]) => `${k}: ${x === null ? "n/a" : x.toFixed(2)}× fair`).join("; "), v.every((x) => x !== null && Math.abs(x - v[0]) <= 0.15), "no withdrawal moves the Vault beyond ±0.15 of its 0% case", out);
    }
    if (want(8)) {   // D-120 with the steering cap
      const out = {};
      // (a) JGA Pool #2, its real history: its real rate at each card, signing at that rate
      const jga = [], jSeen = []; fields.forEach((f, ci) => { if (!f.paths[JGA2]) return; jSeen.push({ rate: f.rates[JGA2], steady: f.steady[JGA2], form: f.forms[JGA2] }); const ch = chances(field(f), races, 8000 + ci, cfg); if (ch && ch[JGA2]) jga.push({ ...ch[JGA2], rate: f.rates[JGA2], steady: f.steady[JGA2] }); });
      out.jga = { cards: jSeen.length, inField: jga.length, steadyCards: jSeen.filter((x) => x.steady).length, forms: [Math.min(...jSeen.map((x) => x.form)), Math.max(...jSeen.map((x) => x.form))], rates: [Math.min(...jSeen.map((x) => x.rate)), Math.max(...jSeen.map((x) => x.rate))], ratio: jga.length ? jga.reduce((s, x) => s + x.chance, 0) / jga.reduce((s, x) => s + x.fair, 0) : NaN };
      // (b) a synthetic 2% producer: honest (rate 1), honest steady throttler (rate 0.66, signs at 0.66), and a steerer
      // (rate 0.66 from two weeks of throttling, then signs in full in the race)
      const one = (c2, lbl, rate, signs) => {
        let c0 = 0, f0 = 0, n = 0;
        fields.forEach((f, ci) => {
          const e = synthetic(f.Nreal, 0.02, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
          for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base] * signs;
          const ch = chances(field(f, { add: { "~me": e }, rates: { "~me": rate }, signs: { "~me": signs }, steady: { "~me": rate < 1 }, N }), races, 8500 + ci, c2);
          if (ch && ch["~me"]) { c0 += ch["~me"].chance; f0 += ch["~me"].fair; n++; }
        });
        return { ratio: n ? c0 / f0 : null, chance: n ? c0 / n : null, n };
      };
      for (const [lbl, rate, signs] of [["honest, full rate", 1, 1], ["steady throttler at 0.66", 0.66, 0.66], ["steerer: 0.66 for 14 days, full in the race", 0.66, 1]]) out[lbl] = one(cfg, lbl, rate, signs);
      // the cap's width: other choices, for the report (honest throttler vs steerer at each)
      out.caps = {};
      for (const steer of ["pct:0", "pct:0.3", "z:0", "z:0.5", "z:1", "z:2"]) out.caps[steer] = { throttler: one({ ...cfg, steer }, "", 0.66, 0.66).ratio, steerer: one({ ...cfg, steer }, "", 0.66, 1).ratio };
      const st = out["steerer: 0.66 for 14 days, full in the race"], hon = out["honest, full rate"], thr = out["steady throttler at 0.66"];
      const err = 2 * Math.sqrt(Math.max(hon.chance, 1e-4) / (races * Math.max(hon.n, 1)));
      const pass = st.chance <= hon.chance + err && thr.ratio >= 0.85 && thr.ratio <= 1.15 && (!out.jga.inField || (out.jga.ratio >= 0.85 && out.jga.ratio <= 1.15));
      say(8, "D-120 steady rate and steering cap", name, `JGA Pool #2 (real): form ${out.jga.forms.map((x) => x.toFixed(2)).join(" … ")}, steady on ${out.jga.steadyCards} of ${out.jga.cards} cards, in the field on ${out.jga.inField}, wins ${out.jga.ratio.toFixed(2)}× fair there; a 2% producer: honest ${hon.chance.toFixed(3)} (${hon.ratio.toFixed(2)}× fair), steady throttler ${thr.chance.toFixed(3)} (${thr.ratio.toFixed(2)}×), steerer ${st.chance.toFixed(3)} (${st.ratio.toFixed(2)}×); other caps (throttler / steerer × fair): ${Object.entries(out.caps).map(([k, v]) => `${k} ${v.throttler.toFixed(2)} / ${v.steerer.toFixed(2)}`).join(", ")}`, pass, "steering never beats honest; a steady throttler and JGA #2 win 0.85–1.15 of fair", out);
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
          const c0 = card(f.paths, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT], rates: f.rates }), c1 = card(paths, f.base, f.T, f.w.S0, f.w.S1, { pooled: [VAULT], rates: f.rates });
          const before = Object.fromEntries(c0.rows.map((r) => [r.p, r.lam * r.credFrac]));
          for (const r of c1.rows) if (r.k >= 10 && r.p !== big && !r.p.startsWith("~")) rel.push((r.lam * r.credFrac) / before[r.p]);
          const ch = chances(c1, races, 9000 + ci, cfg, { out: ["~minted", "~joins", how === "leave" ? big : ""] });
          if (ch) for (const [p, x] of Object.entries(ch)) if (!moved(p, f.T - BLOCKS_PER_DAY, f.w.S1)) (per[p] ||= []).push(x);
        });
        const a = agg(per), enough = Object.fromEntries(Object.entries(a).filter(([, v]) => v.n >= 5)), [w0, w1] = span(enough, (x) => x.ratio);
        out[sc] = { indexMin: Math.min(...rel), indexMax: Math.max(...rel), winMin: w0, winMax: w1 };
      }
      const j = out["a 1% producer joins mid-race"], ok = j.indexMin >= 0.99 && j.indexMax <= 1.01 && ["the biggest producer leaves mid-race", "a mint adds 10% to the network mid-race"].every((k) => out[k].winMin >= 0.85 && out[k].winMax <= 1.15);
      say(9, "joining / leaving / network jumps", name, Object.entries(out).map(([k, v]) => `${k}: index × ${v.indexMin.toFixed(3)} … ${v.indexMax.toFixed(3)}, wins ${v.winMin.toFixed(2)} … ${v.winMax.toFixed(2)} of fair`).join("; "), ok, "one producer: index ±0.01; network jump: wins 0.85–1.15 of fair", out);
    }
    if (want(10)) {
      let flips = 0, seen = 0;
      fields.forEach((f) => { const inAt = (T) => new Set(card(f.paths, f.base, T, f.w.S0, f.w.S1, { rates: f.rates }).rows.filter((r) => r.k * r.rate >= cfg.minK).map((r) => r.p)); const a = inAt(f.w.W0), b = inAt(f.w.W1); for (const p of f.ps) { seen++; if (a.has(p) !== b.has(p)) flips++; } });
      say(10, "a pick on a producer below the bar at T", name, `${flips} of ${seen} producer-cards cross the k × rate ≥ ${cfg.minK} bar inside the card window; each game's stated rule applies (§5)`, true, "handled by each game's stated rule", { flips, seen });
    }
  }
  if (want(6)) {   // grinding under Fix A: the best moment's win chance against the average moment's, per producer
    const moves = [], cfg = configs.A || CONFIGS.A;
    fields.slice(0, 20).forEach((f, ci) => {
      const Ts = []; for (let T = f.w.W0; T <= f.w.W1; T += 600) Ts.push(T);
      const per = {};
      for (const T of Ts) { const ch = chances(card(f.paths, f.base, T, f.w.S0, f.w.S1, { pooled: [VAULT], rates: f.rates }), 1500, 6000 + ci, cfg); if (ch) for (const [p, x] of Object.entries(ch)) (per[p] ||= []).push(x.chance); }
      for (const xs of Object.values(per)) if (xs.length === Ts.length) { const m = xs.reduce((s, x) => s + x, 0) / xs.length; if (m > 0.01) moves.push(Math.max(...xs) / m - 1); }
    });
    moves.sort((a, b) => a - b); const q = (x) => moves[Math.floor(x * (moves.length - 1))];
    say(6, "seed grinding under Fix A (win chance, best moment vs average)", "A", `median +${(q(0.5) * 100).toFixed(1)}%, 90th percentile +${(q(0.9) * 100).toFixed(1)}% (1,500 races a moment: includes sampling noise of about ±${(100 * 2 / Math.sqrt(1500 * 0.05)).toFixed(0)}%)`, null, "accepted residual (§16): re-measured, not judged", { median: q(0.5), p90: q(0.9), n: moves.length });
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
  for (const n of ns) { const c = D.checkHour(prev, texts.get(n)); if (!c.ok) throw new Error(`h/${n}: ${c.why}`); checks.push(c); hours.push(JSON.parse(texts.get(n))); prev = texts.get(n); }
  const tl = D.timelineFrom(hours, checks);
  tl.moves = hours.flatMap((h) => h.events.flatMap(([eh, , f, t]) => [f, t].filter(Boolean).map((a) => [eh, a])));
  return { tl, hours: ns.length, kinds: hours.reduce((o, h) => ((o[h.kind] = (o[h.kind] || 0) + 1), o), {}) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  // the float percentile against the ruler's own integer pct
  for (const [l, x] of [[10, 10], [3.7, 7], [150, 140.5], [1200, 1251]]) { const a = midp(pois(l), x), b = Number(R.pct(BigInt(Math.round(l * 1e6)), BigInt(Math.round(x * 1e6)))) / 1e6; if (Math.abs(a - b) > 2e-6) throw new Error(`float pct ${a} vs ruler ${b} at λ ${l}, x ${x}`); }
  let tl, src;
  if (fs.statSync(args[0]).isDirectory()) { const v = loadVhpData(args[0]); tl = v.tl; src = `vhp-data: ${v.hours} hours (${Object.entries(v.kinds).map(([k, n]) => `${n} ${k}`).join(", ")})`; }
  else { tl = JSON.parse(fs.readFileSync(args[0], "utf8")); for (const d of tl.deltas) { d.d = BigInt(d.d); d.inc = BigInt(d.inc); } for (const a of Object.values(tl.anchors)) a.v = BigInt(a.v); src = "timeline file"; }
  const t0 = Date.now(), L = R.ledger(tl);
  console.log(`${src}; ledger in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const out = run(L, { cards: Number(opt("--cards", 40)), races: Number(opt("--races", 2500)), only: opt("--only") ? opt("--only").split(",").map(Number) : null, moved: movedFn(tl.moves || []), configs: opt("--configs") ? Object.fromEntries(opt("--configs").split(",").map((k) => [k, CONFIGS[k]])) : CONFIGS });
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(out, null, 1));
}
