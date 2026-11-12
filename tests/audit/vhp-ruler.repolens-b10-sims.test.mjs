// Repo Lens #B-10, area 6: the v2.1 simulations' honesty (sims/ruler/v21.mjs). Loads the sims' own binom / binMidp /
// chances and checks them against the ruler (vhp-ruler.js R.fpct, and Python's V.fpct).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { R, PY, APP } from "./vhp-ruler.fixture.mjs";

const src = fs.readFileSync(`${APP}/sims/ruler/v21.mjs`, "utf8"), grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const lib = new Function(grab("const Phi", "/** A′ (R.fpct") + grab("function binMidp", "// ── the Poisson tools") + src.match(/const LF = \[0\];.*\n/)[0] + grab("function binom(", "/** an exact Poisson draw") + "return { binMidp, binom };")();
const { chances } = await import(`${APP}/sims/ruler/v21.mjs`);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const LF = [0], lf = (n) => { while (LF.length <= n) LF.push(LF[LF.length - 1] + Math.log(LF.length)); return LF[n]; };
const pmf = (n, p, k) => Math.exp(lf(n) - lf(k) - lf(n - k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
const B = 7200;
const cardOf = (shares) => ({ total: 1, blocks: B, rows: shares.map((s, i) => ({ p: i ? `p${i}` : "BIG", own: s, avg: s, k: B * s, rate: 1, lam: B * s, credFrac: 1, pmin: B * s, ptwa: B * s, pooled: false, gated: false, dev: 0 })) });

test("binom (Hörmann BTRS + inversion) matches the exact binomial: mean, variance, chi-square (holds)", () => {
  for (const [n, p] of [[7200, 10.2 / 7200], [30, 0.45], [7200, 0.18], [7200, 0.5], [7200, 1e-6], [1e6, 1.05e-5], [7200, 0.82]]) {
    const r = rng(12345), N = 100000, c = new Map(); let s = 0, s2 = 0;
    for (let i = 0; i < N; i++) { const k = lib.binom(n, p, r); s += k; s2 += k * k; c.set(k, (c.get(k) || 0) + 1); }
    const mu = n * p, va = mu * (1 - p), m = s / N;
    assert.ok(Math.abs(m - mu) < 4 * Math.sqrt(va / N), `mean n ${n} p ${p}`);
    assert.ok(Math.abs(s2 / N - m * m - va) / va < 0.03, `variance n ${n} p ${p}`);
    let chi = 0, df = -1, aE = 0, aO = 0, tE = N, tO = N;
    for (let k = Math.max(0, Math.floor(mu - 10 * Math.sqrt(va) - 5)); k <= Math.min(n, Math.ceil(mu + 10 * Math.sqrt(va) + 5)); k++) { const e = pmf(n, p, k) * N, o = c.get(k) || 0; aE += e; aO += o; tE -= e; tO -= o; if (aE >= 20) { chi += (aO - aE) ** 2 / aE; df++; aE = aO = 0; } }
    aE += tE; aO += tO; if (aE > 1e-9) { chi += (aO - aE) ** 2 / aE; df++; }
    assert.ok((chi - df) / Math.sqrt(2 * df) < 4, `chi-square n ${n} p ${p}: ${chi.toFixed(1)} on ${df}`);
  }
});

test("the chain of binomials hands out every block of the race (holds)", () => {
  const w = [0.18, 0.12, 0.05, 0.02, 0.63], r = rng(5);
  for (let t = 0; t < 2000; t++) { let left = B, wl = 1, sum = 0; for (let i = 0; i < w.length; i++) { const k = i === w.length - 1 ? left : lib.binom(left, w[i] / wl, r); sum += k; left -= k; wl -= w[i]; } assert.equal(sum, B); }
});

test("A′ in a perfectly honest, steady field: an 18% producer wins within 0.85–1.15 of fair (FAILS: ~1.17×, from the field-total conditioning)", { todo: "Repo Lens #B-10 S1: the biggest-producer correction is a library-chat design item (I-new P1); nothing pays until all eleven sims pass (D-111)" }, () => {
  // R.fpct (JS) = V.fpct (Python) on the values the race ranks by
  const pts = [[6500, 230000000000n, 1000000000000n, 1300n * 1000000n], [6500, 50000000000n, 1000000000000n, 340n * 1000000n]];
  assert.deepEqual(JSON.parse(PY(`print(json.dumps([str(V.fpct(*map(int, t))) for t in ${JSON.stringify(pts.map((t) => t.map(String)))}]))`)), pts.map((t) => R.fpct(...t).toString()));
  const ch = chances(cardOf([0.18, ...Array(20).fill(0.82 / 20)]), 40000, 77, { rank: "A2", minK: 10, poolRule: "min" });
  assert.ok(ch.BIG.ratio <= 1.15, `BIG wins ${ch.BIG.ratio.toFixed(3)}× fair with every producer honest and steady`);
});

test("the sims' float A′ (binMidp, exact in log space since #B-10 SIM-3) is within 1e-3 of R.fpct", () => {
  let worst = 0;
  for (const p of [0.0462, 0.05, 0.2]) { const n = 6500, mu = n * p, sd = Math.sqrt(mu * (1 - p)); for (let z = -2; z <= 2; z += 0.5) { const x = Math.round(mu + z * sd); const ex = Number(R.fpct(BigInt(n), BigInt(Math.round(p * 1e12)), 1000000000000n, BigInt(x) * 1000000n)) / 1e6; worst = Math.max(worst, Math.abs(lib.binMidp(n, p, x) - ex)); } }
  assert.ok(worst <= 1e-3, `worst gap ${worst.toExponential(2)}`);
});

test("void is no free option (owner, 5 Nov: a pick on a void producer counts as a loss): voiding the Vault whenever it trails at half-race gains nothing", () => {
  // the Vault (20,765 of 12.6M VHP) in a 22-producer A′ field; the producer's own move of > 10% mid-race voids the race
  const f = [0.18, 0.12, 0.10, 0.08, 0.07, 0.06, 0.05, 0.04, 0.035, 0.03, 0.025, 0.02, 0.018, 0.015, 0.012, 0.01, 0.008, 0.006, 0.005, 0.004, 0.003, 20765 / 12.6e6];
  const w = [...f, 1 - f.reduce((a, b) => a + b, 0)], n = f.length, me = n - 1, fF = f.reduce((a, b) => a + b, 0), r = rng(9), races = 20000;
  const half = () => { const c = []; let left = B / 2, wl = 1; for (let i = 0; i < w.length; i++) { const k = i === w.length - 1 ? left : lib.binom(left, w[i] / wl, r); c.push(k); left -= k; wl -= w[i]; } return c; };
  let honest = 0, option = 0;
  for (let t = 0; t < races; t++) {
    const a = half(), b = half(), x = a.map((v, i) => v + b[i]); let nF = 0; for (let i = 0; i < n; i++) nF += x[i];
    let best = -1, who = -1; for (let i = 0; i < n; i++) { const s = lib.binMidp(nF, f[i] / fF, x[i]); if (s > best) { best = s; who = i; } }
    const pay = (who === me ? n : 0) - 1;   // fair odds
    honest += pay; option += a[me] > 5 ? pay : -1;   // ≤ 5 of ~5.9 expected in the first half: move 10% of the Vault, void: the pick loses
  }
  assert.ok(option / races <= honest / races + 0.02, `EV per stake: honest ${(honest / races).toFixed(3)}, with the void option ${(option / races).toFixed(3)}`);
});
