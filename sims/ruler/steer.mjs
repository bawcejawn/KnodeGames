// Knode Games — VHP ruler modes, the steer (Repo Lens #G-19): can a strong node escape mode B's or C's raise by signing
// less before a race, then signing in full in it? Runs the EXACT ruler code (vhp-ruler.js) on synthetic chains where the
// truth is known: 12 producers (VHP 18% … 3%), the big ones signing +5% over their share and the small ones −5%, with a
// daily wobble (sd 2%). The biggest node steers: it gives x of its blocks in [T − d days, T − 6 h) to the others, then
// signs as usual in a 6-hour race (7,200 blocks). Reported per mode: its lift and its race score (fpct) honest vs steered,
// the share of its raise it escapes, and its win chance in the race (top fpct) honest vs steered. Data only.
//   node --max-old-space-size=3000 sims/ruler/steer.mjs [seeds = 6] [ruleVersion = 4]   (5: the core judged on [T − 14 d, T − 3 d))
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../..", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(root + "vhp-ruler.js", "utf8"), box);
const R = box.window.KRuler, M = 1000000n, DAY = 28800;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const units = [18, 14, 12, 10, 9, 8, 7, 6, 5, 4, 4, 3], edge = [1.05, 1.05, 1.04, 1.02, 1, 1, 1, 0.98, 0.97, 0.96, 0.95, 0.95];
const FROM = 2000000, N = 16 * DAY, ps = units.map((_, i) => "1Sim" + String(i).padStart(30, "0")), BURN = 408000000n;
/** The honest chain for a seed: signers, ids, a −BURN VHP delta per block, anchors at the end. */
function honest(seed) {
  const r = rng(seed), wob = Array.from({ length: 17 }, () => units.map(() => { let g = 0; for (let j = 0; j < 12; j++) g += r(); return 1 + (g - 6) * 0.02; }));
  const signers = new Array(N), bal = units.map((u) => 10n ** 15n * BigInt(u));
  let day = -1, cum = [];
  for (let k = 0; k < N; k++) {
    const d = Math.floor(k / DAY); if (d !== day) { day = d; const w = units.map((u, i) => u * edge[i] * wob[d][i]), s = w.reduce((a, b) => a + b, 0); let c = 0; cum = w.map((v) => (c += v / s)); }
    const u = r(); let i = cum.findIndex((c) => u < c); if (i < 0) i = units.length - 1; signers[k] = i;
  }
  return { signers, bal, r };
}
/** A timeline from signer indexes; the anchors follow every block's delta, so balances before any change are untouched. */
function timeline({ signers, bal }) {
  const b = [...bal], to = FROM + N - 1, deltas = new Array(N), ids = new Array(N), sg = new Array(N);
  for (let k = 0; k < N; k++) { const i = signers[k]; sg[k] = ps[i]; ids[k] = "0x1220" + (FROM + k).toString(16).padStart(64, "0"); deltas[k] = { h: FROM + k, a: ps[i], d: -BURN, inc: 0n }; b[i] -= BURN; }
  return { from: FROM, to, signers: sg, ids, deltas, anchors: Object.fromEntries(ps.map((a, i) => [a, { h: to, v: b[i] }])) };
}
const seeds = Number(process.argv[2] || 6), version = Number(process.argv[3] || 4), MODES = ["A", "B", "C", "D"], len = 7200;
const steers = [{ d: 3, x: 0.06 }, { d: 3, x: 0.5 }, { d: 5, x: 0.06 }, { d: 5, x: 0.2 }, { d: 8, x: 0.06 }, { d: 8, x: 0.2 }, { d: 11, x: 0.06 }, { d: 14, x: 0.06 }, { d: 14, x: 0.2 }];
const agg = {};
for (let s = 1; s <= seeds; s++) {
  const h = honest(100 + s), Lk = FROM + N - len - 400, w = { W0: Lk - len + 1, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + len };
  const score = (sig, mode) => { const L = R.ledger(timeline({ signers: sig, bal: h.bal })); return R.scoreCard(L, R.makeCard(L, { game: 7, round: String(Lk), window: w, c: 500000n, minK: 10, poolRule: "min", ownRule: "spot", paying: false, pooled: [], mode, version })); };
  const T = score(h.signers, "A").T;
  const row = (c) => { const p = c.producers.find((q) => q.a === ps[0]), f = c.producers.filter((q) => q.fpct !== null), top = f.reduce((m, q) => (q.fpct > m ? q.fpct : m), -1n); return { core: p.core, aside: p.setAside, form: Number(p.form) / 1e6, lift: Number(p.lift) / 1e6, fpct: Number(p.fpct) / 1e6, win: p.fpct === top ? 1 / f.filter((q) => q.fpct === top).length : 0 }; };
  const base = Object.fromEntries(MODES.map((m) => [m, row(score(h.signers, m))]));
  for (const st of steers) {
    const sig = [...h.signers], r = rng(7000 + s); let gave = 0;
    for (let k = 0; k < N; k++) { const hh = FROM + k; if (hh >= T - st.d * DAY && hh < T - 7200 && sig[k] === 0 && r() < st.x) { sig[k] = 1 + Math.floor(r() * (units.length - 1)); gave++; } }
    for (const m of MODES) { const x = row(score(sig, m)), b = base[m], key = `${st.d}|${st.x}|${m}`, a = (agg[key] ||= { n: 0, lift0: 0, lift1: 0, f0: 0, f1: 0, w0: 0, w1: 0, gave: 0, why: {} });
      const why = `core ${b.core ? 1 : 0}→${x.core ? 1 : 0} aside ${b.aside ? 1 : 0}→${x.aside ? 1 : 0}`; a.why[why] = (a.why[why] || 0) + 1;
      a.n++; a.lift0 += b.lift; a.lift1 += x.lift; a.f0 += b.fpct; a.f1 += x.fpct; a.w0 += b.win; a.w1 += x.win; a.gave += gave; }
  }
}
console.log(`the biggest node (18%, signs +5%) steers before a 6-hour race; ${seeds} chains; RULE_VERSION ${version}; exact ruler code\n`);
console.log("steer".padEnd(22), "mode", "  lift honest → steered", "  escaped", "  race score honest → steered", "  wins honest → steered", "  blocks given up");
for (const st of steers) for (const m of MODES) {
  const a = agg[`${st.d}|${st.x}|${m}`], l0 = a.lift0 / a.n, l1 = a.lift1 / a.n, esc = l0 > 1 ? (l0 - Math.min(l0, l1)) / (l0 - 1) : 0;
  console.log(`${st.d} days, −${st.x * 100}%`.padEnd(22), m.padEnd(4), `  ${l0.toFixed(4)} → ${l1.toFixed(4)}`.padEnd(24), `  ${m === "B" || m === "C" ? (esc * 100).toFixed(0) + "%" : "—"}`.padEnd(10), `  ${(a.f0 / a.n).toFixed(3)} → ${(a.f1 / a.n).toFixed(3)}`.padEnd(30), `  ${a.w0}/${a.n} → ${a.w1}/${a.n}`.padEnd(24), `  ${Math.round(a.gave / a.n)}`, m === "A" ? "  " + Object.entries(a.why).map(([k, v]) => `${k}: ${v}`).join("; ") : "");
}
