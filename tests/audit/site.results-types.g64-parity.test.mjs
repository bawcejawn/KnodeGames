// Repo Lens #G-64 (A3): parity, the Results page's points for a typed race vs the recorder's board points for the same
// inputs (bot/race-ruler.ts ruledResult + bot/race.ts tally's rule: right ? P.win : show ? M.showPoints(P, standings, horse) : 0,
// P = M.pointsOf(type, week, PRIZES_FROM_WEEK, TYPES_ON_WEEK)), over seeded random R/T fixtures in an ON week.
// Run: APP=<repo> TZ=UTC node --import tsx --test site.results-types.g64-parity.test.mjs   (passes at 9a769c52: a guard test)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const read = (p) => fs.readFileSync(`${APP}/${p}`, "utf8");
const mathCtx = vm.createContext({ console, Math, Date }); vm.runInContext(read("race-math.js"), mathCtx);
const M = mathCtx.KRaceMath;
vm.runInContext(read("ruler-void.js"), mathCtx);
const KV = mathCtx.KRulerVoid;
const A = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr", B = "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR", C = "1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8";
const ME = "1635QUbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const W5 = M.TYPES_ON_WEEK;

function fakeEl(tag) {
  const e = { tag, kids: [], attrs: {}, listeners: {}, hidden: false, _text: "", classList: { remove() {}, add() {} } };
  e.setAttribute = (k, v) => { e.attrs[k] = v; };
  e.append = (...k) => { for (const c of k) e.kids.push(typeof c === "string" ? { tag: "#t", _text: c, kids: [], textContent: c } : c); };
  e.replaceChildren = (...k) => { e.kids = []; e.append(...k.filter((c) => c != null)); };
  e.addEventListener = (n, f) => { e.listeners[n] = f; };
  Object.defineProperty(e, "textContent", { get() { return e.tag === "#t" ? e._text : e._text + e.kids.map((k) => k.textContent).join(" "); }, set(v) { e._text = String(v); e.kids = []; } });
  return e;
}
async function run({ now, files }) {
  const nodes = new Map(), host = fakeEl("div"), gPart = fakeEl("div"), qPart = fakeEl("div");
  nodes.set("res-games", host); nodes.set("res-g", gPart); nodes.set("res-q", qPart);
  const FD = class extends Date { static now() { return now; } };
  const fetch = async (url) => {
    const key = Object.keys(files).find((k) => String(url).endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => files[key] };
  };
  const win = { KRaceMath: M, KRulerVoid: KV, KWallet: { address: ME, subscribe() {} }, addEventListener() {} };
  const ctx = vm.createContext({ window: win, document: { getElementById: (i) => nodes.get(i) || null, createElement: fakeEl, querySelectorAll: () => [] },
    location: { hash: "#results/race" }, fetch, Date: FD, console, setTimeout, Promise });
  win.window = win;
  vm.runInContext(read("results.js"), ctx);
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 5));
  return gPart.textContent;
}
const RR = await import(`${process.env.APP ? process.env.APP : "."}/bot/race-ruler.ts`.replace(/^(?!\/)/, process.cwd() + "/"));
const wk = (w) => String(w).padStart(3, "0");
const PROD = [A, B, C, "1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd", "1NsQbH5AhQXgtSNg1ejpFqTi2hmCWz1eQS"];
let seed = 20261113; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const IDS = { 1: "H1-2026-11-24T05", 2: "H2-2026-11-24T08", 3: "D-2026-11-24", 4: "W-2026-11-23" };
const NOW = Date.UTC(2026, 11, 2, 12);         // a week later: every race of week 5 has ended
const PAID_FROM = 4;                           // PRIZES_FROM_WEEK (Week 1 = vault week 4); week 5 >= TYPES_ON_WEEK anyway
function recorderPts(type, start, result, entry) {
  const r = RR.ruledResult(result, entry);
  if (!r || !r.final || !Array.isArray(r.picks)) return 0;
  const P = M.pointsOf(type, M.weekOf(start), PAID_FROM, M.TYPES_ON_WEEK);
  let pts = 0;
  for (const [who, horse, , right, , show] of r.picks) if (who === ME) pts += right ? P.win : show ? M.showPoints(P, r.standings, horse) : 0;
  return pts;
}
test("A3 parity: page points = recorder points for 120 random ruled typed races (every type, place, signed 0, void, empty field)", async () => {
  const bad = [];
  for (let n = 0; n < 120; n++) {
    const type = 1 + (n % 4), id = IDS[type], start = M.typedStart(type, M.parseTypedId(id).index);
    const rows = PROD.map((a) => ({ a, signed: pick([0, 0, 1, 2, 5]), void: rnd() < 0.2 }));
    const field = shuffle(rows.filter((r) => !r.void)).map((r) => r.a);
    const placings = rnd() < 0.1 ? [] : field.slice(0, 3);
    const entry = { id, round: "x", window: {}, card: JSON.stringify({ producers: rows }), note: null, placings };
    const horse = pick(PROD);
    const result = { final: true, winner: PROD[0], standings: PROD.map((a) => ({ a, steps: 1, blocks: 1 })), picks: [[ME, horse, 0, horse === PROD[0] ? 1 : 0, 0, 0]] };
    const want = recorderPts(type, start, result, entry);
    const text = await run({ now: NOW, files: {
      "games.json": { games: [{ id: "race", name: "Producer Race", status: "live", results: true }] },
      "race-data/index.json": { v: 1, weeks: [W5] },
      [`race-data/W${wk(W5)}.json`]: { v: 1, week: W5, races: [] },
      [`race-data/T${wk(W5)}.json`]: { v: 1, week: W5, hours: [], races: [{ type, id, result }] },
      [`race-data/R${wk(W5)}-${type}.json`]: { v: 1, week: W5, rulerFrom: 4, mode: "on", shadow: false, races: [entry] },
    } });
    const m = /You: .*?(?:\+(\d+) pts?|missed · 0 pts)/.exec(text);
    const got = m ? Number(m[1] || 0) : null;
    const weekPts = Number((/Race results (\d+) +pts this week/.exec(text) || [])[1]);
    if (got !== want || weekPts !== want) bad.push({ type, horse, rows, placings, want, got, weekPts });
  }
  assert.deepEqual(bad, [], `page != recorder in ${bad.length} case(s)`);
});
