// Repo Lens #G-64 G64-2: with typed races in the list, the Results page's default day tab is no longer the latest day.
// draw() takes `ended[ended.length - 1]` (array order: the 6-hour races, then the T file's races type by type), so mid-week
// it opens on YESTERDAY (the last ended daily race), and from Sunday 00:00 UTC on MONDAY (the weekly race, start Monday).
// Run: APP=<repo> TZ=UTC node --test site.results-types.g64-2-default-day.test.mjs   (fails at 9a769c52)
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
const H = 3600000;
const six = (iso) => { const start = Date.parse(iso + ":00:00Z"); return { id: iso, start, end: start + 6 * H, result: { final: true, standings: [{ a: A, steps: 9, blocks: 3 }, { a: B, steps: 8, blocks: 2 }, { a: C, steps: 7, blocks: 1 }], picks: [] } }; };
const files = (sixes, typed) => ({
  "games.json": { games: [{ id: "race", name: "Producer Race", status: "live", results: true }] },
  "race-data/index.json": { v: 1, weeks: [W5] },
  [`race-data/W${wk(W5)}.json`]: { v: 1, week: W5, races: sixes.map(six) },
  [`race-data/T${wk(W5)}.json`]: { v: 1, week: W5, hours: [], races: typed.map(([type, id]) => ({ type, id, result: { final: true, standings: [], picks: [] } })) },
});
test("G64-2: mid-week (Wed 12:00 UTC) the page opens on today, not on yesterday's daily race", async () => {
  const text = await run({ now: Date.UTC(2026, 10, 25, 12), files: files(["2026-11-24T00", "2026-11-25T00"], [[1, "H1-2026-11-25T10"], [3, "D-2026-11-24"]]) });
  assert.match(text, /Wed, Nov 25/, "today's finished races are shown by default");
});
test("G64-2: on Sunday (after the weekly race ends at 00:00 UTC) the page opens on Sunday, not on Monday", async () => {
  const text = await run({ now: Date.UTC(2026, 10, 29, 12), files: files(["2026-11-28T18", "2026-11-29T00"], [[1, "H1-2026-11-29T10"], [4, "W-2026-11-23"]]) });
  assert.match(text, /Sun, Nov 29/, "Sunday's finished races are shown by default");
});
