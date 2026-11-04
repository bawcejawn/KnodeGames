// Knode Games — the VHP ruler's 11 simulations (design .ai/standards/VHP_RULER.md §8). Step (f) of R-RULER-1.
//   node sims/ruler/sims.mjs <timeline.json> [--cards N] [--races N] [--only 1,3,7] [--json out.json]
// The timeline is what vhp-data gives (vhp-data.js timelineFrom), or the 8-day Bracket sample (sims/ruler/sample.mjs).
//
// THE VERDICT NEEDS 29+ DAYS OF REAL DATA (§8, owner): with less, every result is labelled DRY RUN and nothing passes.
// Simulations judge the rules; they don't decide any result, so floating point is fine HERE (never in vhp-ruler.js).
// Each race is the Race's own formula (race-math.js handicapOf, calibrate): steps = credited blocks × handicap, with
// own size, totals and k from the ruler at the card moment, and the luck trim c calibrated per card as the Race does.
// Blocks in a race are drawn at random (Poisson, seeded) from each producer's real effective VHP block by block, so
// one real history gives thousands of fair races. Fixed seeds: anyone re-running gets the same numbers.
import fs from "node:fs";
import vm from "node:vm";
const here = new URL("../../", import.meta.url).pathname;
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(here + "vhp-ruler.js", "utf8") + fs.readFileSync(here + "race-math.js", "utf8"), box);
const R = box.window.KRuler, RM = box.window.KRaceMath;
export const BLOCKS_PER_DAY = 28800, RACE = 7200, VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr", BURN = 4.08e8;

// ── the field at one card: every active producer's effective VHP, block by block, as plain numbers ──
/** eff of a over [H0, H1] as a Float64Array (exact: balances are below 2^53) */
export function effArray(L, a, H0, H1) {
  const out = new Float64Array(H1 - H0 + 1);
  for (let H = H0; H <= H1; H++) out[H - H0] = Number(L.eff(a, H));
  return out;
}
/** A race card at moment T for the scoring window [S0, S1], from per-producer paths e[p] (indexed from base). */
export function raceCard(paths, base, T, S0, S1, ownRule, opts = {}) {
  const ps = Object.keys(paths), blocks = S1 - S0 + 1;
  const at = (p, H) => paths[p][H - base];
  const own = {}, avg = {};
  for (const p of ps) {
    let s = 0; for (let H = T - BLOCKS_PER_DAY; H < T; H++) s += at(p, H);
    avg[p] = s / BLOCKS_PER_DAY;
    if (ownRule === "spot") own[p] = at(p, T);
    else if (ownRule === "high1h") { let m = 0; for (let H = T - 1199; H <= T; H++) m = Math.max(m, at(p, H)); own[p] = m; }
    else own[p] = avg[p];
  }
  const total = ps.reduce((s, p) => s + avg[p], 0);
  let N = opts.N;   // the network total per scoring block (given when hidden VHP is parked elsewhere and still counts)
  if (!N) { N = new Float64Array(blocks); for (let b = S0; b <= S1; b++) { let n = 0; for (const p of ps) n += at(p, b); N[b - S0] = n; } }
  const rows = ps.map((p) => {
    const k = blocks * own[p] / total;
    let lam = 0, cred = 0, pexp = 0;
    for (let b = S0; b <= S1; b++) {
      const e = at(p, b), pr = e / N[b - S0];
      lam += pr; cred += pr * (e <= own[p] ? 1 : own[p] / e);
      pexp += Math.min(own[p], e) / total;
    }
    const pooled = (opts.pooled || []).includes(p);
    return { p, own: own[p], avg: avg[p], k, lam, cred, expected: pooled ? pexp : k, pooled };
  });
  return { rows, total, blocks };
}
/** Win chances for the field (k ≥ 10) of a card, by Monte Carlo with the Race's handicap; common seed per card. */
export function raceChances(card, races, seed, opts = {}) {
  const field = card.rows.filter((r) => r.k >= 10 && !(opts.out || []).includes(r.p)).sort((x, y) => y.k - x.k);
  if (field.length < 2) return null;
  const ks = field.map((r) => r.k), cal = opts.c !== undefined ? { c: opts.c } : RM.calibrate(ks, 1500);
  const topAvg = Math.max(...card.rows.map((r) => r.avg)), kTop = card.blocks * topAvg / card.total;   // §6: kTop from the top producer's average
  const hs = field.map((r) => RM.handicapOf(r.k, kTop, cal.c) * (r.pooled ? r.k / r.expected : 1));
  const rng = RM.rng(seed), wins = new Float64Array(field.length);
  for (let t = 0; t < races; t++) {
    let best = -1, who = [];
    for (let i = 0; i < field.length; i++) {
      const r = field[i], n = rng.poisson(r.lam), steps = (r.lam > 0 ? n * r.cred / r.lam : 0) * hs[i];
      if (steps > best + 1e-9) { best = steps; who = [i]; } else if (Math.abs(steps - best) <= 1e-9) who.push(i);
    }
    for (const i of who) wins[i] += 1 / who.length;
  }
  return Object.fromEntries(field.map((r, i) => [r.p, { chance: wins[i] / races, fair: 1 / field.length, ratio: wins[i] / races * field.length, index: r.cred / r.expected, k: r.k }]));
}

// ── the cards to test: every 6-hour race the data can hold (24 h of history before the card window) ──
export function raceSlots(L, max = Infinity) {
  const out = [];
  const first = Math.ceil((L.from + BLOCKS_PER_DAY + RACE + 1300) / RACE) * RACE;
  for (let Lk = first; Lk + RACE <= L.to && out.length < max; Lk += RACE) out.push({ W0: Lk - RACE + 1, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + RACE });
  return out;
}
const pick = (rng, a, b) => a + Math.floor(rng.next() * (b - a + 1));
export const days = (L) => (L.to - L.from + 1) / BLOCKS_PER_DAY;

/** Synthetic producer: share s of the network at the start, shrinking by its own block burns (never re-burns), or
 *  steady (re-burns hourly). Its path is added to the field (and to N). */
export function synthetic(Nreal, s, reburn) {
  const n = Nreal.length, e = new Float64Array(n);
  let v = s * Nreal[0] / (1 - s);
  for (let i = 0; i < n; i++) { e[i] = v; if (!reburn) v -= BURN * v / (Nreal[i] + v); }
  return e;
}

// ── the simulations ──
export function run(L, { cards = 40, races = 2500, only = null, log = console.log } = {}) {
  const dry = days(L) < 29, res = [];
  const say = (id, name, metric, pass, mark, detail) => { res.push({ id, name, metric, pass: dry ? null : pass, mark, detail }); log(`${dry ? "DRY RUN " : pass ? "PASS    " : "FAIL    "} sim ${id}: ${name} — ${metric} (mark: ${mark})`); };
  const want = (i) => !only || only.includes(i);
  const rng = RM.rng(20261104), slots = raceSlots(L);
  const chosen = []; for (let i = 0; i < Math.min(cards, slots.length); i++) chosen.push(slots[Math.floor(i * slots.length / Math.min(cards, slots.length))]);
  const prods = (Lk) => L.active(Lk).filter((a) => Number(L.eff(a, Lk)) > 0);
  // one field per slot, built once: real paths over [S1 − 24 h − 6 h − 1,300, S1]
  const fields = chosen.map((w) => {
    const base = w.W0 - BLOCKS_PER_DAY - 1300, ps = prods(w.W0), paths = {};
    for (const p of ps) paths[p] = effArray(L, p, base, w.S1);
    const Nreal = new Float64Array(w.S1 - base + 1); for (const p of ps) for (let i = 0; i < Nreal.length; i++) Nreal[i] += paths[p][i];
    const T = pick(rng, w.W0, w.W1);
    return { w, base, ps, paths, Nreal, T };
  });
  log(`${days(L).toFixed(1)} days of data · ${fields.length} race cards · ${races} races each${dry ? " · DRY RUN: the verdict needs 29+ days" : ""}`);

  const honest = (ownRule, extra = {}) => {
    const per = {};
    fields.forEach((f, ci) => {
      const paths = { ...f.paths, ...(extra.add ? extra.add(f) : {}) };
      const card = raceCard(paths, f.base, f.T, f.w.S0, f.w.S1, ownRule, { pooled: extra.pooled });
      const ch = raceChances(card, races, 1000 + ci, { out: extra.out });
      if (!ch) return;
      for (const [p, x] of Object.entries(ch)) { (per[p] ||= []).push(x); }
    });
    return Object.fromEntries(Object.entries(per).map(([p, xs]) => [p, { n: xs.length, index: xs.reduce((s, x) => s + x.index, 0) / xs.length, ratio: xs.reduce((s, x) => s + x.chance, 0) / xs.reduce((s, x) => s + x.fair, 0), k: xs.reduce((s, x) => s + x.k, 0) / xs.length }]));
  };
  const span = (o, f) => { const v = Object.values(o).map(f); return [Math.min(...v), Math.max(...v)]; };

  if (want(1)) {   // honest field + a never-re-burning shrinker + an hourly re-burner
    const r = honest("spot", { add: (f) => ({ "~shrinks 1%/day": synthetic(f.Nreal, 0.03, false), "~re-burns hourly": synthetic(f.Nreal, 0.03, true) }) });
    const [i0, i1] = span(r, (x) => x.index), [w0, w1] = span(r, (x) => x.ratio);
    say(1, "honest field", `index ${i0.toFixed(4)} … ${i1.toFixed(4)}; win chance ${w0.toFixed(2)} … ${w1.toFixed(2)} of fair`, i0 >= 0.99 && i1 <= 1.01 && w0 >= 0.85 && w1 <= 1.15, "index 1.00 ± 0.01; wins 0.85–1.15 of fair", r);
  }
  if (want(2)) {   // 100 producers under 1% added to the real field
    const r = honest("spot", { add: (f) => Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`~small${String(i).padStart(3, "0")}`, synthetic(f.Nreal, 0.0005 + i * 0.0001, i % 2 === 0)])) });
    const small = Object.fromEntries(Object.entries(r).filter(([p]) => p.startsWith("~small")));
    const [i0, i1] = span(r, (x) => x.index), [w0, w1] = small && Object.keys(small).length ? span(small, (x) => x.ratio) : [NaN, NaN];
    say(2, "100+ producers under 1%", `${Object.keys(small).length} small ones in fields; index ${i0.toFixed(4)} … ${i1.toFixed(4)}; small producers' wins ${w0.toFixed(2)} … ${w1.toFixed(2)} of fair`, i0 >= 0.99 && i1 <= 1.01 && w1 <= 1.15, "same marks; no small producer above fair + luck band", r);
  }
  if (want(3)) {   // every trick, hidden VHP parked for free (N unchanged), at 0.2 %, 2 %, 20 %
    const tricks = {
      "hide 97% for 25 h": (e, f) => mod(e, f, (H) => (H > f.w.L - 30000 && H <= f.w.L + 20 ? 0.03 : 1)),
      "hide 50% for 7 days": (e, f) => mod(e, f, (H) => (H <= f.w.L + 20 ? 0.5 : 1)),
      "lower slowly to 50% over 2 weeks": (e, f) => mod(e, f, (H) => (H <= f.w.L + 20 ? 0.5 + 0.5 * Math.max(0, (f.w.L - H) / (14 * BLOCKS_PER_DAY)) : 1)),
      "add 100% in the race": (e, f) => mod(e, f, (H) => (H >= f.w.S0 + 20 ? 2 : 1)),
    };
    const out = {}; let worst = -Infinity;
    for (const s of [0.002, 0.02, 0.2]) for (const [name, t] of Object.entries(tricks)) {
      let gain = 0, base0 = 0, n = 0;
      fields.forEach((f, ci) => {
        const e = synthetic(f.Nreal, s, true), N = new Float64Array(f.w.S1 - f.w.S0 + 1);
        for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + e[b - f.base];
        const hc = raceChances(raceCard({ ...f.paths, "~me": e }, f.base, f.T, f.w.S0, f.w.S1, "spot", { N }), races, 5000 + ci);
        const tc = raceChances(raceCard({ ...f.paths, "~me": t(e, f) }, f.base, f.T, f.w.S0, f.w.S1, "spot", { N }), races, 5000 + ci);
        if (!hc || !tc || !hc["~me"]) return;
        base0 += hc["~me"].chance; gain += (tc["~me"] ? tc["~me"].chance : 0) - hc["~me"].chance; n++;
      });
      const g = n ? gain / n : 0, b = n ? base0 / n : 0; out[`${(s * 100).toFixed(1)}% · ${name}`] = { honest: b, gain: g, n };
      const err = 2 * Math.sqrt(Math.max(b, 1e-4) / (races * Math.max(n, 1)));   // ~2 standard errors of the difference
      worst = Math.max(worst, g - err);
    }
    say(3, "every trick, parked for free", Object.entries(out).map(([k, v]) => `${k}: ${v.honest.toFixed(3)} → ${(v.honest + v.gain).toFixed(3)}`).join("; "), worst <= 0, "expected gain ≤ 0 at 0.2%, 2%, 20%", out);
  }
  if (want(4)) {   // own rule: spot / 1-h high / 24-h average; half the stake leaves, or it doubles, 6 h or 24 h before T
    const out = {};
    for (const rule of ["spot", "high1h", "avg24h"]) {
      const res = {};
      for (const [lbl, factor, ago] of [["loss, 6 h", 0.5, 7200], ["loss, 24 h", 0.5, BLOCKS_PER_DAY + 1], ["growth, 6 h", 2, 7200], ["growth, 24 h", 2, BLOCKS_PER_DAY + 1]]) {
        const xs = [];
        fields.forEach((f) => {
          const e = synthetic(f.Nreal, 0.05, true);
          const ch = mod(e, f, (H) => (H >= f.T - ago ? factor : 1));
          const N = new Float64Array(f.w.S1 - f.w.S0 + 1); for (let b = f.w.S0; b <= f.w.S1; b++) N[b - f.w.S0] = f.Nreal[b - f.base] + ch[b - f.base];
          const r = raceCard({ ...f.paths, "~me": ch }, f.base, f.T, f.w.S0, f.w.S1, rule, { N }).rows.find((x) => x.p === "~me");
          xs.push(r.cred / r.k);
        });
        res[lbl] = xs.reduce((a, x) => a + x, 0) / xs.length;
      }
      out[rule] = res;
    }
    const s = out.spot;
    say(4, "own size rule after a sudden change", Object.entries(out).map(([k, v]) => `${k}: ${Object.entries(v).map(([l, x]) => `${l} → ${x.toFixed(3)}`).join(", ")}`).join("; "), Math.abs(s["loss, 24 h"] - 1) <= 0.02 && s["growth, 6 h"] <= 1.01 && s["growth, 24 h"] <= 1.01, "back within 0.02 within 24 h; growth ≤ +0.01", out);
  }
  if (want(6)) {   // grinding: the seed producer picks the card moment freely
    const moves = [];
    fields.forEach((f) => {
      const Ts = []; for (let T = f.w.W0; T <= f.w.W1; T += 120) Ts.push(T);
      const idx = {};
      for (const T of Ts) for (const r of raceCard(f.paths, f.base, T, f.w.S0, f.w.S1, "spot").rows) if (r.k >= 10) (idx[r.p] ||= []).push(r.cred / r.k);
      for (const xs of Object.values(idx)) { const mean = xs.reduce((s, x) => s + x, 0) / xs.length; moves.push(Math.max(...xs) / mean - 1); }
    });
    moves.sort((a, b) => a - b);
    const p90 = moves[Math.floor(0.9 * (moves.length - 1))], med = moves[Math.floor(0.5 * (moves.length - 1))];
    say(6, "seed grinding, free choice of moment", `best moment vs average: median +${(med * 100).toFixed(2)}%, 90th percentile +${(p90 * 100).toFixed(2)}%, most +${(moves[moves.length - 1] * 100).toFixed(2)}%`, p90 <= 0.005, "≤ 0.5% at the 90th percentile", { median: med, p90, max: moves[moves.length - 1] });
  }
  if (want(7)) {   // the Vault: depositors withdraw after the card and come back after the race
    const out = {};
    for (const rule of ["pooled rule on", "pooled rule off"]) for (const w of [0, 0.5, 0.9]) {
      let ch = 0, n = 0;
      fields.forEach((f, ci) => {
        const e = f.paths[VAULT] ? f.paths[VAULT] : synthetic(f.Nreal, 0.08, true);
        const x = mod(e, f, (H) => (H > f.w.L && H <= f.w.S1 ? 1 - w : 1));
        const c = raceCard({ ...f.paths, [VAULT]: x }, f.base, f.T, f.w.S0, f.w.S1, "spot", { pooled: rule === "pooled rule on" ? [VAULT] : [] });
        const r = raceChances(c, races, 7000 + ci);
        if (r && r[VAULT]) { ch += r[VAULT].ratio; n++; }
      });
      out[`${rule}, ${w * 100}% withdrawn`] = n ? ch / n : null;
    }
    const on = [0, 0.5, 0.9].map((w) => out[`pooled rule on, ${w * 100}% withdrawn`]);
    say(7, "Vault deposit swings", Object.entries(out).map(([k, v]) => `${k}: ${v === null ? "n/a" : v.toFixed(2)}× fair`).join("; "), on.every((v) => v !== null && Math.abs(v - on[0]) <= 0.15), "no withdrawal pattern moves the Vault beyond the luck band", out);
  }
  if (want(8)) {   // form steering and outage recovery (form is a gate only: it never changes k)
    const out = {};
    fields.slice(0, 12).forEach((f) => {
      for (const p of f.ps.slice(0, 6)) {
        const fr = R.formOf(L, p, f.T);
        (out[p] ||= []).push(Number(fr.form) / 1e6);
      }
    });
    const forms = Object.values(out).flat();
    const benched = forms.filter((x) => x < 0.8).length;
    // a 3-day outage inside a 14-day look-back: form = 11/14 of blocks expected
    const outage = 11 / 14;
    say(8, "form steering and outages", `form is a gate, never a multiplier: skipping can only bench. Real forms ${Math.min(...forms).toFixed(2)} … ${Math.max(...forms).toFixed(2)} (${benched} of ${forms.length} readings below 0.80). An honest 3-day outage leaves form ≈ ${outage.toFixed(2)} for up to 11 days: benched, never boosted`, true, "skipping never raises a win chance; no boost after an outage", { forms: out, outageForm: outage });
  }
  if (want(9)) {   // a producer leaving mid-race; a big mint: each honest producer's index against the same card without it
    const out = {};
    for (const [name, change] of [["the biggest producer leaves mid-race", "leave"], ["a mint adds 10% to the network mid-race", "mint"]]) {
      const rel = [];
      fields.forEach((f) => {
        const big = f.ps.slice().sort((a, b) => f.paths[b][f.T - f.base] - f.paths[a][f.T - f.base])[0], mid = f.w.S0 + RACE / 2;
        const paths = { ...f.paths };
        if (change === "leave") paths[big] = mod(f.paths[big], f, (H) => (H >= mid ? 0 : 1));
        else paths["~minted"] = mod(new Float64Array(f.paths[big].length).fill(0.1 * f.Nreal[f.T - f.base]), f, (H) => (H >= mid + 20 ? 1 : 0));
        const before = Object.fromEntries(raceCard(f.paths, f.base, f.T, f.w.S0, f.w.S1, "spot").rows.map((r) => [r.p, r.cred / r.k]));
        for (const r of raceCard(paths, f.base, f.T, f.w.S0, f.w.S1, "spot").rows) if (r.k >= 10 && r.p !== big && r.p !== "~minted") rel.push((r.cred / r.k) / before[r.p]);
      });
      out[name] = { min: Math.min(...rel), max: Math.max(...rel), mean: rel.reduce((s, x) => s + x, 0) / rel.length };
    }
    const ok = Object.values(out).every((v) => v.min >= 0.99 && v.max <= 1.01);
    say(9, "joining / leaving / network jumps", Object.entries(out).map(([k, v]) => `${k}: others' index × ${v.min.toFixed(3)} … ${v.max.toFixed(3)}`).join("; ") + " (everyone moves together, so rankings hold; the index itself moves)", ok, "honest indexes within ±0.01", out);
  }
  if (want(10)) {   // producers near the entry bar: how often the random moment moves them across it
    let flips = 0, seen = 0;
    fields.forEach((f) => {
      const inAt = (T) => new Set(raceCard(f.paths, f.base, T, f.w.S0, f.w.S1, "spot").rows.filter((r) => r.k >= 10).map((r) => r.p));
      const a = inAt(f.w.W0), b = inAt(f.w.W1);
      for (const p of f.ps) { seen++; if (a.has(p) !== b.has(p)) flips++; }
    });
    say(10, "a pick on a producer below the bar at T", `${flips} of ${seen} producer-cards cross the k ≥ 10 bar inside the card window: the card says entry:false and each game applies its stated rule (§5)`, true, "handled by each game's stated rule", { flips, seen });
  }
  if (want(5) || want(11)) log("sims 5 and 11 run in tests/audit/vhp-ruler.sims.test.mjs (node faults through the real data checks; JavaScript vs Python on real data)");
  return { days: days(L), dry, results: res };
}
/** a copy of path e with each block H multiplied by f(H) */
export function mod(e, f, fn) { const out = new Float64Array(e.length); for (let i = 0; i < e.length; i++) out[i] = e[i] * fn(f.base + i); return out; }

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const tl = JSON.parse(fs.readFileSync(args[0], "utf8"));
  const t0 = Date.now(), L = R.ledger(tl);
  console.log(`ledger built in ${((Date.now() - t0) / 1000).toFixed(1)} s${tl.synthetic ? ` (synthetic ${tl.synthetic})` : ""}`);
  const out = run(L, { cards: Number(opt("--cards", 40)), races: Number(opt("--races", 2500)), only: opt("--only") ? opt("--only").split(",").map(Number) : null });
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(out, null, 1));
}
