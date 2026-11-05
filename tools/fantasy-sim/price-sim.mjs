// Fantasy Producers: a real-data simulation of the price formula (R-FA-2, I-062). Read-only, offline.
//
//   node tools/fantasy-sim/price-sim.mjs <race-data folder> [--horizon 6] [--form 7] [--json out.json]
//   (--form below 7 is a preliminary look only: the game prices from 7 days of form.)
//
// It rebuilds each producer's DAILY index (100 × blocks signed ÷ blocks expected, the game's own formula) from the
// Producer Race's published files: each finished race's blocks per producer (`result.standings`) and the VHP shares on
// that race's cards (field + paddock). Then, for every day that has 7 days of form before it, it makes a price sheet
// with the game's own math (fantasy-math.js: priceOf, makeSheet's median, the 8–40 clamp) and scores teams over the
// following days with F.dayScore (the 130 cap, captain ×2). It answers:
//   1. Does price predict what a producer scores next (rank correlation)?
//   2. How many producers sit on the 8 / 40 clamps, and how swingy is each one day to day?
//   3. Is there a reliable edge in cheap, swingy producers, compared with picking by form and with random valid teams?
// Approximation (said in the report): a race's blocks count on the UTC day the race starts (races are 6-hour blocks
// aligned to the day, so this is exact), and expected blocks use the average share over the race's cards rather than
// the card in force each hour.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await import(path.join(APP, "race-math.js"));
await import(path.join(APP, "fantasy-math.js"));
const F = globalThis.KFantasyMath;

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) { console.error("usage: node tools/fantasy-sim/price-sim.mjs <race-data folder> [--horizon 6] [--json out.json]"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const HORIZON = Number(opt("--horizon", 6)), FORM = Number(opt("--form", 7)), JSON_OUT = opt("--json", null);
const DAY = 86400000;

// ── 1. daily records from the race files ──
const races = [];
for (const f of fs.readdirSync(dir).filter((f) => /^W[0-9]{3}\.json$/.test(f)).sort()) {
  const wf = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const r of wf.races || []) if (r && r.result && r.result.final === true && Array.isArray(r.result.standings)) races.push(r);
}
const byDay = new Map();            // day number → { [a]: { got, exp } }
const fields = new Map();           // day number → the race field on its first card that day (the pool)
for (const r of races) {
  const cards = (r.cards || []).filter((c) => c && Array.isArray(c.field) && c.field.length);
  if (!cards.length) continue;
  const share = new Map();
  for (const c of cards) {
    const rows = [...c.field, ...(c.paddock || [])], tot = rows.reduce((s, x) => s + (x.vhp > 0 ? x.vhp : 0), 0);
    if (tot > 0) for (const x of rows) if (x.vhp > 0) share.set(x.a, (share.get(x.a) || 0) + x.vhp / tot / cards.length);
  }
  const d = Math.floor(r.start / DAY), rec = byDay.get(d) || {};
  const n = r.result.blocks;
  for (const [a, s] of share) { const x = rec[a] || (rec[a] = { got: 0, exp: 0 }); x.exp += n * s; }
  for (const s of r.result.standings) { const x = rec[s.a] || (rec[s.a] = { got: 0, exp: 0 }); x.got += s.blocks || 0; }
  byDay.set(d, rec);
  if (!fields.has(d)) fields.set(d, cards[0]);
}
const days = [...byDay.keys()].sort((a, b) => a - b);
// A day counts only with all 4 races in (a partial day would look like a bad day for everyone).
const fullDays = days.filter((d) => races.filter((r) => Math.floor(r.start / DAY) === d).length === 4);
const dayRec = (d) => ({ day: d, producers: Object.fromEntries(Object.entries(byDay.get(d) || {}).map(([a, x]) => [a, [x.got, Math.round(x.exp * 100) / 100, x.exp > 0 ? Math.round(10000 * x.got / x.exp) / 100 : null]])) });

// ── 2. rolling sheets: 7 days of form, then up to HORIZON days of play ──
const iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const rankOf = (xs) => { const o = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const spearman = (xs, ys) => { const a = rankOf(xs), b = rankOf(ys), ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return da && db ? n / Math.sqrt(da * db) : NaN; };
function* teams(pool, budget) {             // every valid team: 5 different producers, cost ≤ budget, any captain
  const n = pool.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [pool[a], pool[b], pool[c], pool[d], pool[e]];
    if (five.reduce((s, p) => s + p.price, 0) > budget) continue;
    for (let k = 0; k < 5; k++) yield [five[k], ...five.filter((_, i) => i !== k)];
  }
}
let seed = 20261105; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const sheets = [];
for (const s of fullDays) {
  const form = [];
  for (let k = FORM; k >= 1; k--) if (fullDays.includes(s - k)) form.push(dayRec(s - k));
  if (form.length < FORM) continue;
  const play = []; for (let k = 0; k < HORIZON; k++) if (fullDays.includes(s + k)) play.push(dayRec(s + k));
  if (play.length < 2) continue;
  const sheet = F.makeSheet(0, fields.get(s), form);
  const pool = sheet.pool;
  const scoreOf = (t) => play.reduce((sum, day) => sum + F.dayScore(t.map((p) => p.a), day), 0);
  // Each producer: price, form, what it scored per day over the horizon (capped at 130), and its day-to-day swing.
  const prod = pool.map((p) => { const ix = play.map((d) => { const x = d.producers[p.a]; return Array.isArray(x) && x[2] !== null ? Math.min(130, x[2]) : 0; }); return { ...p, next: mean(ix), swing: sd([...form, ...play].map((d) => { const x = d.producers[p.a]; return Array.isArray(x) && x[2] !== null ? Math.min(130, x[2]) : 0; })) }; });
  const all = [];
  for (const t of teams(pool, sheet.budget)) all.push({ t, score: scoreOf(t) });
  all.sort((x, y) => y.score - x.score);
  const pick = (key) => { let best = null; for (const t of teams(pool, sheet.budget)) { const v = key(t); if (!best || v > best.v) best = { t, v }; } return best ? scoreOf(best.t) : NaN; };
  const formOf = (p) => (p.form === null ? sheet.median ?? 100 : p.form);
  const swingOf = new Map(prod.map((p) => [p.a, p.swing]));
  const strategies = {
    byForm: pick((t) => t.reduce((s, p, i) => s + formOf(p) * (i === 0 ? 2 : 1), 0)),
    cheapSwingy: pick((t) => t.reduce((s, p, i) => s + (40 - p.price) + swingOf.get(p.a) * (i === 0 ? 2 : 1), 0)),
    expensiveSteady: pick((t) => t.reduce((s, p, i) => s + p.price - swingOf.get(p.a) * (i === 0 ? 2 : 1), 0)),
  };
  const sample = Array.from({ length: Math.min(2000, all.length) }, () => all[Math.floor(rnd() * all.length)].score).sort((a, b) => a - b);
  sheets.push({
    sheetDay: iso(s), playDays: play.length, budget: sheet.budget, median: sheet.median, poolSize: pool.length, validTeams: all.length,
    clamp8: pool.filter((p) => p.price === 8).length, clamp40: pool.filter((p) => p.price === 40).length,
    priceVsNext: spearman(prod.map((p) => p.price), prod.map((p) => p.next)), formVsNext: spearman(prod.map((p) => formOf(p)), prod.map((p) => p.next)),
    best: all[0].score, randomMedian: sample[Math.floor(sample.length / 2)], random90: sample[Math.floor(sample.length * 0.9)], strategies,
    producers: prod.map((p) => ({ a: p.a, price: p.price, form: p.form, next: Math.round(p.next * 10) / 10, swing: Math.round(p.swing * 10) / 10 })),
  });
}

// ── 3. report ──
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "—"), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
console.log(`Fantasy price formula — real-data simulation (fantasy-math.js as on this branch)`);
console.log(`Race data: ${races.length} finished races, ${fullDays.length} full days (${iso(fullDays[0])} – ${iso(fullDays.at(-1))}); horizon up to ${HORIZON} days.`);
console.log(`Rolling sheets with ${FORM} full form days before them: ${sheets.length}${FORM < 7 ? "  (PRELIMINARY: the game uses 7 form days)" : ""}\n`);
console.log(`sheet day   days pool clamp8/40  price~next form~next  best   random(med/p90)  byForm  cheapSwingy  expSteady`);
for (const s of sheets) console.log(`${s.sheetDay}  ${String(s.playDays).padStart(3)} ${String(s.poolSize).padStart(4)}   ${String(s.clamp8).padStart(3)}/${String(s.clamp40).padEnd(3)}     ${f2(s.priceVsNext).padStart(6)}    ${f2(s.formVsNext).padStart(6)}  ${f1(s.best).padStart(6)}  ${f1(s.randomMedian).padStart(6)}/${f1(s.random90).padEnd(6)}  ${f1(s.strategies.byForm).padStart(6)}  ${f1(s.strategies.cheapSwingy).padStart(10)}  ${f1(s.strategies.expensiveSteady).padStart(9)}`);
const avg = (k) => mean(sheets.map(k).filter(Number.isFinite));
console.log(`\nAverages: price~next ${f2(avg((s) => s.priceVsNext))}, form~next ${f2(avg((s) => s.formVsNext))}; per-day team score — best ${f1(avg((s) => s.best / s.playDays))}, random median ${f1(avg((s) => s.randomMedian / s.playDays))}, byForm ${f1(avg((s) => s.strategies.byForm / s.playDays))}, cheapSwingy ${f1(avg((s) => s.strategies.cheapSwingy / s.playDays))}, expensiveSteady ${f1(avg((s) => s.strategies.expensiveSteady / s.playDays))}.`);
const last = sheets.at(-1);
if (last) {
  console.log(`\nLatest sheet (${last.sheetDay}), producers by price:`);
  for (const p of [...last.producers].sort((a, b) => b.price - a.price)) console.log(`  ${p.a}  price ${String(p.price).padStart(2)}  form ${f1(p.form).padStart(6)}  next ${f1(p.next).padStart(6)}  day-to-day swing ${f1(p.swing).padStart(5)}`);
}
console.log(`\nApproximation: expected blocks use each race's average card shares, not the card in force each hour; early cards (before 4 Nov) were made from few samples.`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ races: races.length, fullDays: fullDays.map(iso), sheets }, null, 1) + "\n");
