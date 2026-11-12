// Knode Games — VHP ruler, RULE_VERSION 4 design runs (11 Nov 2026): what can a producer gain by changing its VHP DURING a race, depending on how its luck is going?
// "stop when ahead": shrink by t once it is lucky; "lock": add u (credit capped at the card size); "dilute": add u when unlucky, if a rebalance re-measured it upward.
import { KS } from "./lengths.mjs";
const LF = [0]; const logFact = (n) => { while (LF.length <= n) LF.push(LF[LF.length - 1] + Math.log(LF.length)); return LF[n]; };
function binParts(n, pr, k) { if (pr <= 0) return [k > 0 ? 1 : 0, k === 0 ? 1 : 0]; if (k > n) return [1, 0]; const mu = n * pr, sd = Math.sqrt(mu * (1 - pr)), lo = Math.max(0, Math.floor(mu - 10 * sd - 5)); if (k > mu + 10 * sd + 5) return [1, 0];
  const start = k < lo ? 0 : lo, lr = Math.log(pr / (1 - pr)); let lp = logFact(n) - logFact(start) - logFact(n - start) + start * Math.log(pr) + (n - start) * Math.log1p(-pr), below = 0, pk = 0;
  for (let i = start; i <= Math.min(n, k); i++) { const p = Math.exp(lp); if (i < k) below += p; else pk = p; lp += Math.log((n - i) / (i + 1)) + lr; } return [below, pk]; }
function binom(n, p, rnd) { if (n <= 0 || p <= 0) return 0; if (p >= 1) return n; if (p > 0.5) return n - binom(n, 1 - p, rnd);
  if (n * p < 10) { const q = 1 - p, s = p / q; let k = 0, f = Math.pow(q, n), u = rnd(); while (u > f && k < n) { u -= f; f *= s * (n - k) / (k + 1); k++; } return k; }
  const spq = Math.sqrt(n * p * (1 - p)), b = 1.15 + 2.53 * spq, a = -0.0873 + 0.0248 * b + 0.01 * p, c = n * p + 0.5, vr = 0.92 - 4.2 / b, alpha = (2.83 + 5.1 / b) * spq, lpq = Math.log(p / (1 - p)), m = Math.floor((n + 1) * p), h = logFact(m) + logFact(n - m);
  for (;;) { const u = rnd() - 0.5, v0 = rnd(), us = 0.5 - Math.abs(u), k = Math.floor((2 * a / us + b) * u + c); if (k < 0 || k > n) continue; if (us >= 0.07 && v0 <= vr) return k; const v = Math.log(v0 * alpha / (a / (us * us) + b)); if (v <= h - logFact(k) - logFact(n - k) + (k - m) * lpq) return k; } }
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const tot = KS.reduce((a, b) => a + b, 0), SH = KS.map((k) => k / tot * 0.97);
export function run({ B, who, mode, amt, races = 30000, steps = 8, zOn = 1, K = Infinity, seed = 3 }) {
  const all = SH.map((s, i) => ({ i, s })).filter((r) => r.s * B >= 10), m = all.length, me = all.findIndex((r) => r.i === who), rnd = mulberry(seed);
  let win = 0, place = 0; const q = all.map((r) => Math.min(1, K / (r.s * B)));
  for (let t = 0; t < races; t++) {
    const x = new Float64Array(m), e = new Float64Array(m); let mult = 1, cf = 1, eMult = 1, acted = false;
    for (let st = 0; st < steps; st++) {
      const b = B / steps, lam = all.map((r, j) => r.s * b * (j === me ? mult : 1)), ls = lam.reduce((a, c) => a + c, 0);
      let left = b, wl = ls + Math.max(0, b - ls);
      for (let j = 0; j < m; j++) { const k = binom(left, lam[j] / wl, rnd); left -= k; wl -= lam[j]; const th = q[j] < 1 ? binom(k, q[j], rnd) : k; x[j] += th * (j === me ? cf : 1); e[j] += all[j].s * b * q[j] * (j === me ? eMult : 1); }
      if (!acted && st < steps - 1 && mode !== "honest") {
        const eo = e.reduce((a, c) => a + c, 0), xo = x.reduce((a, c) => a + c, 0), p = e[me] / eo, z = (x[me] - xo * p) / Math.sqrt(xo * p * (1 - p));
        if (mode === "stop" && z > zOn) { mult = 1 - amt; eMult = 1 - amt; acted = true; }             // shrinks: expected follows it down
        if (mode === "lock" && z > zOn) { mult = 1 + amt; cf = 1 / (1 + amt); acted = true; }           // grows: credit capped at the card size
        if (mode === "dilute" && z < -zOn) { mult = 1 + amt; eMult = 1 + amt; acted = true; }           // grows after an upward rebalance: counted in full
      }
    }
    const eC = e.reduce((a, c) => a + c, 0), nF = x.reduce((a, c) => a + c, 0), sc = [];
    let nY = nF, eY = eC; const aside = new Array(m).fill(false);
    for (let j = 0; j < m; j++) { const p = e[j] / eC, sd = Math.sqrt(nF * p * (1 - p)); if (Math.abs(x[j] - nF * p) > 2 * sd) { aside[j] = true; nY -= x[j]; eY -= e[j]; } }
    for (let j = 0; j < m; j++) { const n = Math.max(0, Math.round(aside[j] ? nY + x[j] : nY)), p = aside[j] ? e[j] / (eY + e[j]) : e[j] / eY, k = Math.floor(x[j]), f = x[j] - k; const [b0, p0] = binParts(n, p, k); const p1 = f > 0 ? binParts(n, p, k + 1)[1] : 0; sc.push((b0 + p0 / 2) * (1 - f) + (b0 + p0 + p1 / 2) * f); }
    const rank = sc.filter((s) => s > sc[me]).length; if (rank === 0) win++; if (rank < 3) place++;
  }
  return { win: win / races * m, place: place / races * m / 3 };
}
if (process.argv[1] && process.argv[1].endsWith("midrace.mjs")) {
  for (const [nm, B] of [["1h", 1200], ["6h", 7200], ["1d", 28800], ["6d", 172800]]) for (const who of [0, 10]) {
    const h = run({ B, who, mode: "honest" });
    const line = [`${nm} producer #${who}: honest win ${h.win.toFixed(2)} place ${h.place.toFixed(2)}`];
    for (const amt of [0.05, 0.1, 0.15, 0.25, 0.5, 0.97]) { const r = run({ B, who, mode: "stop", amt }); line.push(`stop −${amt * 100}%: ${r.win.toFixed(2)}/${r.place.toFixed(2)}`); }
    for (const amt of [0.25, 1, 9]) { const r = run({ B, who, mode: "lock", amt }); line.push(`lock +${amt * 100}%: ${r.win.toFixed(2)}/${r.place.toFixed(2)}`); }
    for (const amt of [0.25, 1, 9]) { const r = run({ B, who, mode: "dilute", amt }); line.push(`dilute +${amt * 100}% (if rebalanced up): ${r.win.toFixed(2)}/${r.place.toFixed(2)}`); }
    console.log(line.join(" | "));
  }
}
