// Knode Games — VHP ruler, RULE_VERSION 4 design runs (11 Nov 2026): fairness of A′ at any race length on a clean field, with
// real-life imperfections (an uptime spread, members whose credit is capped), for each rule variant: the yardstick
// counting raw or credited blocks, and the luck cap K. Floats; a design tool, not the library.
//   node sims/ruler/lengths.mjs
const LF = [0]; const logFact = (n) => { while (LF.length <= n) LF.push(LF[LF.length - 1] + Math.log(LF.length)); return LF[n]; };
function binParts(n, pr, k) {   // P(X<k), P(X=k)
  if (pr <= 0) return [k > 0 ? 1 : 0, k === 0 ? 1 : 0]; if (k > n) return [1, 0];
  const mu = n * pr, sd = Math.sqrt(mu * (1 - pr)), lo = Math.max(0, Math.floor(mu - 10 * sd - 5));
  if (k > mu + 10 * sd + 5) return [1, 0];
  const start = k < lo ? 0 : lo, lr = Math.log(pr / (1 - pr));
  let lp = logFact(n) - logFact(start) - logFact(n - start) + start * Math.log(pr) + (n - start) * Math.log1p(-pr), below = 0, pk = 0;
  for (let i = start; i <= Math.min(n, k); i++) { const p = Math.exp(lp); if (i < k) below += p; else pk = p; lp += Math.log((n - i) / (i + 1)) + lr; }
  return [below, pk];
}
function binom(n, p, rnd) {
  if (n <= 0 || p <= 0) return 0; if (p >= 1) return n; if (p > 0.5) return n - binom(n, 1 - p, rnd);
  if (n * p < 10) { const q = 1 - p, s = p / q; let k = 0, f = Math.pow(q, n), u = rnd(); while (u > f && k < n) { u -= f; f *= s * (n - k) / (k + 1); k++; } return k; }
  const spq = Math.sqrt(n * p * (1 - p)), b = 1.15 + 2.53 * spq, a = -0.0873 + 0.0248 * b + 0.01 * p, c = n * p + 0.5, vr = 0.92 - 4.2 / b;
  const alpha = (2.83 + 5.1 / b) * spq, lpq = Math.log(p / (1 - p)), m = Math.floor((n + 1) * p), h = logFact(m) + logFact(n - m);
  for (;;) { const u = rnd() - 0.5, v0 = rnd(), us = 0.5 - Math.abs(u), k = Math.floor((2 * a / us + b) * u + c); if (k < 0 || k > n) continue; if (us >= 0.07 && v0 <= vr) return k;
    const v = Math.log(v0 * alpha / (a / (us * us) + b)); if (v <= h - logFact(k) - logFact(n - k) + (k - m) * lpq) return k; }
}
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const KS = [4799, 4618, 3749, 2690, 2393, 1792, 1502, 1444, 1324, 1275, 519, 254, 213, 207, 121, 44, 40.5, 24, 21, 11.7];
export function sim({ B, races = 20000, K = Infinity, credYard = true, rate = () => 1, cf = () => 1, rpit = false, band = 2, seed = 1, minK = 10, shares = KS.map((k) => k / 28800 * 0.97 / (KS.reduce((a, b) => a + b, 0) / 28800)) }) {
  const all = shares.map((s, i) => ({ i, s, e0: s * B })).filter((r) => r.e0 >= minK);
  const m = all.length, rnd = mulberry(seed), wins = new Float64Array(m);
  const r = all.map((x) => rate(x.i, x.s)), c = all.map((x) => cf(x.i, x.s));
  const lam = all.map((x, j) => x.e0 * r[j] / c[j]);            // real chance: share × uptime; a grower signs more than its capped size
  const q = all.map((x) => Math.min(1, K / x.e0)), e = all.map((x, j) => x.e0 * q[j]);
  const lamSum = lam.reduce((a, b) => a + b, 0), wts = [...lam, Math.max(0, B - lamSum)], wsum = wts.reduce((a, b) => a + b, 0);
  const eC = e.reduce((a, b) => a + b, 0), cnt = new Float64Array(m), raw = new Float64Array(m), sc = new Float64Array(m);
  for (let t = 0; t < races; t++) {
    let left = B, wl = wsum;
    for (let j = 0; j < m; j++) { const k = binom(left, wl > 0 ? wts[j] / wl : 0, rnd); left -= k; wl -= wts[j]; const th = q[j] < 1 ? binom(k, q[j], rnd) : k; raw[j] = th; cnt[j] = th * c[j]; }
    const yc = credYard ? cnt : raw;   // what the yardstick counts
    let nF = 0; for (let j = 0; j < m; j++) nF += yc[j];
    let nY = nF, eY = eC; const aside = new Array(m).fill(false);
    for (let j = 0; j < m; j++) { const p = e[j] / eC, sd = Math.sqrt(nF * p * (1 - p)); if (Math.abs(yc[j] - nF * p) > band * sd) { aside[j] = true; nY -= yc[j]; eY -= e[j]; } }
    let best = -1, who = -1;
    for (let j = 0; j < m; j++) {
      const n = Math.max(0, Math.round(aside[j] ? nY + yc[j] : nY)), p = aside[j] ? e[j] / (eY + e[j]) : e[j] / eY, x = cnt[j], k = Math.floor(x), f = x - k;
      const [b0, p0] = binParts(n, p, k); let s;
      if (rpit) s = b0 + rnd() * p0; else { const p1 = f > 0 ? binParts(n, p, k + 1)[1] : 0; s = (b0 + p0 / 2) * (1 - f) + (b0 + p0 + p1 / 2) * f; }
      sc[j] = s; if (s > best) { best = s; who = j; }
    }
    wins[who]++;
  }
  return all.map((x, j) => ({ k: x.e0, ke: e[j], r: r[j], cf: c[j], ratio: wins[j] / races * m }));
}
export const show = (label, rows) => { const cl = rows.filter((x) => x.r === 1 && x.cf === 1), mm = (a) => [Math.min(...a.map((x) => x.ratio)), Math.max(...a.map((x) => x.ratio))];
  const big = rows.filter((x) => x.k / rows.reduce((a, b) => a + b.k, 0) > 0.05), small = rows.filter((x) => x.k / rows.reduce((a, b) => a + b.k, 0) < 0.01), avg = (a) => a.reduce((s, x) => s + x.ratio, 0) / Math.max(1, a.length);
  console.log(`${label.padEnd(46)} all ${mm(rows).map((v) => v.toFixed(2)).join("–")}  clean ${cl.length ? mm(cl).map((v) => v.toFixed(2)).join("–") : "-"}  big avg ${avg(big).toFixed(2)}  small avg ${avg(small).toFixed(2)}  | ${rows.map((x) => x.ratio.toFixed(2) + (x.r !== 1 ? (x.r > 1 ? "+" : "-") : "") + (x.cf !== 1 ? "g" : "")).join(" ")}`); };
if (process.argv[1] && process.argv[1].endsWith("lengths.mjs")) {
  const N = Number(process.argv[2] || 20000);
  for (const [nm, B] of [["1h", 1200], ["2h", 2400], ["6h", 7200], ["1d", 28800], ["6d", 172800]]) {
    show(`${nm} clean, cap 1000`, sim({ B, races: N, K: 1000 }));
    const up = (i) => (i % 3 === 0 ? 1.01 : i % 3 === 1 ? 0.99 : 1);
    show(`${nm} uptime ±1%, no cap`, sim({ B, races: N, rate: up }));
    show(`${nm} uptime ±1%, cap 1000`, sim({ B, races: N, rate: up, K: 1000 }));
    const g = (i) => (i === 1 || i === 7 ? 0.98 : 1);
    show(`${nm} two growers 2%, raw yardstick (v3)`, sim({ B, races: N, cf: g, credYard: false }));
    show(`${nm} two growers 2%, credited + cap (v4)`, sim({ B, races: N, cf: g, K: 1000 }));
  }
}
