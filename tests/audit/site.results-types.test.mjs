// Hub results for the Producer Race's other lengths (Race chat ask, 13 Nov): from M.TYPES_ON_WEEK (vault week 5) the Results page
// draws the typed races (T<www>.json) with the Ruler's places (R<www>-<t>.json) and points per place; before it nothing changes.
// Runs results.js against a tiny fake page and fake race-data files. Offline.
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

const A = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr", B = "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR", C = "1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8", D = "1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd";
const ME = "1635QUaaaaaaaaaaaaaaaaaaaaaaaaaaaa".slice(0, 34).replace(/a/g, "b");
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

async function run({ now, files, ids = [] }) {
  const nodes = new Map(), host = fakeEl("div"), gPart = fakeEl("div"), qPart = fakeEl("div");
  nodes.set("res-games", host); nodes.set("res-g", gPart); nodes.set("res-q", qPart);
  for (const id of ids) nodes.set(id, fakeEl("p"));
  const asked = [];
  const FD = class extends Date { static now() { return now; } };
  const fetch = async (url) => {
    asked.push(String(url));
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
  return { text: gPart.textContent, asked, nodes };
}

const wk = (w) => String(w).padStart(3, "0");
const day = "2026-11-24";                       // a Tuesday of vault week 5
const card = (rows) => JSON.stringify({ producers: rows });
const files5 = () => ({
  "games.json": { games: [{ id: "race", name: "Producer Race", status: "live", results: true }] },
  "race-data/index.json": { v: 1, weeks: [W5] },
  [`race-data/W${wk(W5)}.json`]: { v: 1, week: W5, races: [] },
  [`race-data/T${wk(W5)}.json`]: { v: 1, week: W5, hours: [], races: [
    { type: 1, id: `H1-${day}T05`, result: { final: true, standings: [{ a: A }, { a: B }, { a: C }], picks: [[ME, B, 0, 0, 0, 0]] } },
    { type: 1, id: `H1-${day}T06`, result: { final: true, standings: [{ a: A }], picks: [[ME, D, 0, 0, 0, 0]] } },
    { type: 2, id: `H2-${day}T08`, result: { final: true, standings: [{ a: A }], picks: [[ME, A, 0, 1, 0, 0]] } },
    { type: 3, id: `D-${day}`, result: { final: true, standings: [{ a: A }], picks: [[ME, A, 0, 1, 0, 0]] } },
  ] },
  [`race-data/R${wk(W5)}-1.json`]: { v: 1, week: W5, mode: "on", rulerFrom: W5, races: [
    { id: `H1-${day}T05`, placings: [A, B, C], card: card([{ a: A, signed: 4 }, { a: B, signed: 2 }, { a: C, signed: 1 }, { a: D, void: true, signed: 0 }]) },
    { id: `H1-${day}T06`, placings: [A], card: card([{ a: A, signed: 4 }, { a: D, void: true, signed: 0 }]) },
  ] },
  [`race-data/R${wk(W5)}-2.json`]: { v: 1, week: W5, mode: "on", rulerFrom: W5, races: [
    { id: `H2-${day}T08`, placings: [], card: card([{ a: A, void: true, signed: 0 }]) },   // an empty field: every producer void
  ] },
  // no R<www>-3.json yet: the daily race is still "Checking"
});
const NOW5 = Date.UTC(2026, 10, 25, 12);

test("a typed race the Ruler scored: its 1st to 3rd, and the player's place and points (1-hour 2nd = 2)", async () => {
  const { text } = await run({ now: NOW5, files: files5() });
  assert.match(text, /1-hour race · Tue, Nov 24, 05:00 UTC/);
  assert.match(text, /\(Ruler\)/);
  assert.match(text, /showed \(2nd\) · \+2 pts/, "a 1-hour 2nd place scores 2");
});

test("a void pick is a loss; an empty field scores nobody", async () => {
  const { text } = await run({ now: NOW5, files: files5() });
  assert.match(text, /missed · 0 pts/, "the pick on the void producer");
  assert.match(text, /Every producer was void/, "the empty field");
});

test("a typed race with no Ruler file yet is 'Checking', never a handicap result", async () => {
  const { text } = await run({ now: NOW5, files: files5() });
  assert.match(text, /Daily race · Tue, Nov 24/);
  assert.match(text, /Checking/);
  assert.match(text, /waiting for the Ruler/);
});

test("the points text and the race lengths show from the types' week", async () => {
  const { text, nodes } = await run({ now: NOW5, files: files5(), ids: ["rt-watch-pts", "rt-free-pts", "rt-soon-3", "rt-soon-h"] });
  assert.match(text, /3 \/ 2 \/ 1 in a 1-hour or 2-hour race, 4 \/ 2 \/ 1 in a 6-hour race, 6 \/ 3 \/ 2 in a daily race and 12 \/ 6 \/ 4/);
  assert.match(text, /1-hour/); assert.match(text, /Weekly/);
  assert.match(nodes.get("rt-watch-pts").textContent, /12 \/ 6 \/ 4/);
  assert.equal(nodes.get("rt-soon-3").hidden, true);
});

test("before the types' week nothing changes: no typed files are asked for and the old words stay", async () => {
  const f = files5(); f["race-data/index.json"] = { v: 1, weeks: [W5 - 1] }; f[`race-data/W${wk(W5 - 1)}.json`] = { v: 1, week: W5 - 1, races: [] };
  const { asked, nodes, text } = await run({ now: Date.UTC(2026, 10, 18, 12), files: f, ids: ["rt-watch-pts", "rt-soon-3", "rt-soon-h"] });
  assert.ok(!asked.some((u) => /race-data\/[TR]\d+-?\d*\.json/.test(u) && /T\d{3}\.json|-\d\.json/.test(u)), `asked for typed files: ${asked}`);
  assert.equal(nodes.get("rt-watch-pts").textContent, "");
  assert.equal(nodes.get("rt-soon-3").hidden, false);
  assert.doesNotMatch(text, /Points are per place/);
});

test("the Hub sources: typed ids only through race-math, the week switch is M.TYPES_ON_WEEK, no copied rules", () => {
  const js = read("results.js");
  assert.match(js, /M\.TYPES_ON_WEEK !== null && w >= M\.TYPES_ON_WEEK/);
  assert.match(js, /race-data\/T\$\{p3\}\.json/); assert.match(js, /race-data\/R\$\{p3\}-\$\{t\}\.json/);
  assert.match(js, /M\.parseTypedId\(r\.id\)/); assert.match(js, /M\.pagePick\(type, r\.start/);
  assert.doesNotMatch(js, /places: *\[|win: *12|\b12, 6, 4\b/, "the points table lives in race-math only");
  assert.match(read("games.js"), /M\.TYPES_ON_WEEK !== null && M\.weekOf\(Date\.now\(\)\) >= M\.TYPES_ON_WEEK/);
  assert.match(read("admin/actions.ts"), /pattern: \/\^\(0\|\[1-9\]\|1\\d\|20\)\$\//, "the admin accepts 0 (no per-game limit)");
});
