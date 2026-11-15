// Repo Lens #G-64 (A2, A4): before week 5 the Results page is the same as main's; the swap happens on the vault-week clock
// (Mon 23 Nov 00:00 UTC = Sun 22 Nov 7 PM ET); typed races are filtered to their own week; Sunday typed races are fun races.
// Run: APP=<repo> MAIN_APP=<main checkout> TZ=UTC node --test site.results-types.g64-a2-a4.test.mjs
// At 9a769c52 every test passes except "G64-4 (Info)": the footer's new 'How the Ruler works' link shows in every week.
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
const MAIN = process.env.MAIN_APP;
const H = 3600000;
const six = (iso, picked) => { const start = Date.parse(iso + ":00:00Z"); return { id: iso, start, end: start + 6 * H, result: { final: true, standings: [{ a: A, steps: 9, blocks: 3 }, { a: B, steps: 8, blocks: 2 }, { a: C, steps: 7, blocks: 1 }], picks: [[ME, picked, 0, picked === A ? 1 : 0, 0, picked === B ? 1 : 0]] } }; };
const w4files = () => ({
  "games.json": { games: [{ id: "race", name: "Producer Race", status: "live", results: true }] },
  "race-data/index.json": { v: 1, weeks: [4, 3] },
  "race-data/W004.json": { v: 1, week: 4, races: [six("2026-11-17T00", A), six("2026-11-17T06", B), six("2026-11-22T00", A)] },
  "race-data/R004.json": { v: 1, week: 4, rulerFrom: 4, mode: "on", shadow: false, races: [] },
  "race-data/T004.json": { v: 1, week: 4, hours: [], races: [{ type: 1, id: "H1-2026-11-17T05", result: { final: true, standings: [{ a: A }], picks: [[ME, A, 0, 1, 0, 0]] } }] },
});
const IDS = ["rt-free-pts", "rt-open", "rt-watch-pts", "rt-soon-h", "rt-soon-1", "rt-soon-2", "rt-soon-3"];
const NOW4 = Date.UTC(2026, 10, 22, 23, 59, 59, 999);      // Sun 22 Nov 23:59:59.999 UTC: still vault week 4
const NOW5 = Date.UTC(2026, 10, 23, 0, 0, 0, 0);            // Mon 23 Nov 00:00 UTC: vault week 5

test("A2: the clock: Sun 22 Nov 23:59:59.999 UTC is week 4, Mon 23 Nov 00:00 UTC is week 5 (= Sun 22 Nov 7 PM ET)", () => {
  assert.equal(M.weekOf(NOW4), 4); assert.equal(M.weekOf(NOW5), 5); assert.equal(M.weekStart(5), NOW5);
  assert.equal(M.TYPES_ON_WEEK, 5);
});
test("A2: at Sun 23:59:59.999 UTC no typed file is asked for and no text is swapped; at Mon 00:00 UTC the swap happens", async () => {
  const a = await run({ now: NOW4, files: w4files(), ids: IDS });
  assert.ok(!a.asked.some((u) => /\/T\d{3}\.json$|\/R\d{3}-\d\.json$/.test(u)), a.asked.join(" "));
  for (const id of IDS) assert.equal(a.nodes.get(id).textContent, "", id);
  assert.equal(a.nodes.get("rt-soon-3").hidden, false);
  assert.doesNotMatch(a.text, /Points are per place|1-hour|Weekly/);
  const b = await run({ now: NOW5, files: w4files(), ids: IDS });
  assert.match(b.nodes.get("rt-watch-pts").textContent, /12 \/ 6 \/ 4/);
  assert.equal(b.nodes.get("rt-soon-3").hidden, true);
  // week 4 is still shown with its old points when browsed in week 5, and no T004 is asked for
  assert.ok(!b.asked.some((u) => /T004|R004-/.test(u)), b.asked.join(" "));
});
test("A2: before week 5 the Results text and requests equal main's, except the new footer link", { skip: !MAIN && "set MAIN_APP" }, async () => {
  const pr = await run({ now: NOW4, files: w4files(), ids: IDS });
  const main = await runMain({ now: NOW4, files: w4files(), ids: IDS });
  assert.deepEqual(pr.asked, main.asked);
  assert.equal(pr.text.replace("  ·  How the Ruler works", ""), main.text);
});
test("G64-4 (Info): before week 5 the Results footer is byte-for-byte main's (the request says nothing changes)", { skip: !MAIN && "set MAIN_APP" }, async () => {
  const pr = await run({ now: NOW4, files: w4files(), ids: IDS });
  const main = await runMain({ now: NOW4, files: w4files(), ids: IDS });
  assert.equal(pr.text, main.text);
});
async function runMain(args) {
  // same harness, results.js from MAIN_APP
  const src = fs.readFileSync(`${MAIN}/results.js`, "utf8");
  return runSrc(src, args);
}
async function runSrc(src, { now, files, ids = [] }) {
  const nodes = new Map(), host = fakeEl("div"), gPart = fakeEl("div"), qPart = fakeEl("div");
  nodes.set("res-games", host); nodes.set("res-g", gPart); nodes.set("res-q", qPart);
  for (const id of ids) nodes.set(id, fakeEl("p"));
  const asked = [];
  const FD = class extends Date { static now() { return now; } };
  const fetch = async (url) => { asked.push(String(url)); const key = Object.keys(files).find((k) => String(url).endsWith(k)); if (!key) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => files[key] }; };
  const win = { KRaceMath: M, KRulerVoid: KV, KWallet: { address: ME, subscribe() {} }, addEventListener() {} };
  const ctx = vm.createContext({ window: win, document: { getElementById: (i) => nodes.get(i) || null, createElement: fakeEl, querySelectorAll: () => [] }, location: { hash: "#results/race" }, fetch, Date: FD, console, setTimeout, Promise });
  win.window = win; vm.runInContext(src, ctx);
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 5));
  return { text: gPart.textContent, asked, nodes };
}

// ── A4: week boundaries ──
const t5 = (races) => ({
  "games.json": { games: [{ id: "race", name: "Producer Race", status: "live", results: true }] },
  "race-data/index.json": { v: 1, weeks: [W5] },
  "race-data/W005.json": { v: 1, week: W5, races: [] },
  "race-data/T005.json": { v: 1, week: W5, hours: [], races },
  "race-data/R005-1.json": { v: 1, week: W5, rulerFrom: 4, mode: "on", shadow: false, races: [
    { id: "H1-2026-11-29T05", placings: [A], card: JSON.stringify({ producers: [{ a: A, signed: 3 }] }) },
    { id: "H1-2026-11-30T01", placings: [A], card: JSON.stringify({ producers: [{ a: A, signed: 3 }] }) }] },
  "race-data/R005-3.json": { v: 1, week: W5, rulerFrom: 4, mode: "on", shadow: false, races: [
    { id: "D-2026-11-29", placings: [A], card: JSON.stringify({ producers: [{ a: A, signed: 3 }] }) },
    { id: "H1-2026-11-24T05", placings: [A], card: JSON.stringify({ producers: [{ a: A, signed: 3 }] }) }] },
  "race-data/R005-4.json": { v: 1, week: W5, rulerFrom: 4, mode: "on", shadow: false, races: [
    { id: "W-2026-11-23", placings: [A], card: JSON.stringify({ producers: [{ a: A, signed: 3 }] }) }] },
});
const fin = (picked) => ({ final: true, standings: [{ a: A }], picks: [[ME, picked, 0, 1, 0, 0]] });
test("A4: the weekly race (Mon 00:00 UTC) is week 5's; Sunday typed races are fun races and left out of 'pts this week'; next week's id and a wrong type digit are skipped", async () => {
  const { text } = await run({ now: Date.UTC(2026, 10, 30, 12), files: t5([
    { type: 4, id: "W-2026-11-23", result: fin(A) },          // weekly, Mon 23 Nov → Sun 29 Nov 00:00: 12 pts, counts
    { type: 3, id: "D-2026-11-29", result: fin(A) },          // Sunday daily: fun race (6 pts, not in the week)
    { type: 1, id: "H1-2026-11-29T05", result: fin(A) },      // Sunday 1-hour: fun race
    { type: 1, id: "H1-2026-11-30T01", result: fin(A) },      // next week's id in this week's file: skipped
    { type: 3, id: "H1-2026-11-24T05", result: fin(A) },      // type 3 record with a 1-hour id: skipped
  ]) });
  assert.match(text, /Race results 12 +pts this week · 1 pick/, text.slice(0, 120));
  assert.ok(!/Nov 30/.test(text), "next week's race is not drawn");
});
test("A4: the race-length row shows only in a week that has typed races", async () => {
  const f = t5([]); delete f["race-data/T005.json"];
  const { text } = await run({ now: Date.UTC(2026, 10, 24, 12), files: { ...f, "race-data/W005.json": { v: 1, week: 5, races: [six("2026-11-23T00", A)] } } });
  assert.doesNotMatch(text, /All 1-hour 2-hour 6-hour Daily Weekly/);
});
