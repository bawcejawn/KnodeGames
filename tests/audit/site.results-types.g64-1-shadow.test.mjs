// Repo Lens #G-64 G64-1: a typed race whose Ruler file R<www>-<t>.json says mode "shadow" (or shadow: true, or no mode)
// is drawn with the T file's HANDICAP winner and points, while the recorder (bot/race.ts typedRuled: rulerOn(w) ? ... : null)
// counts nothing for it. Option A: a typed race is scored by the Ruler only, so the page must say "Checking"/no score.
// Run: APP=<repo> TZ=UTC node --test site.results-types.g64-1-shadow.test.mjs   (fails at 9a769c52)
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
const wk = (w) => String(w).padStart(3, "0");
const day = "2026-11-24";
const NOW = Date.UTC(2026, 10, 24, 12);
// The T file's own (handicap) result says A won and ME picked A: the recorder's handicap flags p[3] = 1.
const filesWith = (rfile) => ({
  "games.json": { games: [{ id: "race", name: "Producer Race", status: "live", results: true }] },
  "race-data/index.json": { v: 1, weeks: [W5] },
  [`race-data/W${wk(W5)}.json`]: { v: 1, week: W5, races: [] },
  [`race-data/T${wk(W5)}.json`]: { v: 1, week: W5, hours: [], races: [
    { type: 1, id: `H1-${day}T05`, result: { final: true, winner: A, standings: [{ a: A, steps: 9, blocks: 3 }, { a: B, steps: 8, blocks: 2 }, { a: C, steps: 7, blocks: 1 }], picks: [[ME, A, 0, 1, 0, 0]] } },
  ] },
  [`race-data/R${wk(W5)}-1.json`]: rfile,
});

for (const [name, rf] of [
  ["mode shadow (RACE_RULER_FROM_WEEK = week + 1)", { v: 1, week: W5, rulerFrom: W5 + 1, mode: "shadow", shadow: true, races: [] }],
  ["mode on but shadow: true", { v: 1, week: W5, rulerFrom: W5, mode: "on", shadow: true, races: [] }],
  ["no mode field", { v: 1, week: W5, rulerFrom: W5, races: [] }],
]) {
  test(`G64-1: a typed race with a Ruler file of ${name} never shows the T file's handicap win or points`, async () => {
    const text = await run({ now: NOW, files: filesWith(rf) });
    assert.match(text, /1-hour race · Tue, Nov 24, 05:00 UTC/);
    assert.doesNotMatch(text, /\+\d+ pts?/, "the board pays this typed race nothing (typedRuled = null), so the page must not show points");
    assert.doesNotMatch(text, /\d+ steps/, "the handicap standings must not be shown as the result of a typed race");
  });
}
