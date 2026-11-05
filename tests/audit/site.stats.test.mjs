// stats.js: the live stats strip (home page) and panel (games page). Runs in jsdom with a fake fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const APP = process.env.APP || ".";
const src = fs.readFileSync(`${APP}/stats.js`, "utf8");
const A = "1Nti1ZmdisnJ8J9FJsmTSt1nMKPyzWZxdz", B = "1LRshrZHPmft4SuaniExEsyzFecCPctMBV";

function sample(over = {}) {
  const now = Date.now();
  return { v: 1, updated: new Date(now - 20 * 60000).toISOString(), week: { start: now - 2 * 86400000, end: now + 5 * 86400000 },
    players: { week: 64, lastWeek: 51, allTime: 230 }, plays: { answers: 410, racePicks: 120, blockxPicks: 35, total: 565 },
    staked: { total: 48250.12, games: [{ id: 1, name: "Daily Questions", vhp: 40000 }, { id: 3, name: "Block Golf", vhp: 8250.12 }] },
    prizes: { free: [2, 1] }, blocks: { vault24h: 48 }, today: { open: 3, closes: now + 3 * 3600000, answers: 41 },
    top: { questions: [{ a: A, pts: 22, place: 1 }, { a: B, pts: 19, place: 2 }], race: [], blockx: [{ a: B, pts: 1, place: 1 }] }, ...over };
}
async function page(body, data, { names = false, ...over } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${body}</body>`, { runScripts: "outside-only", url: "https://knodegames.com/" });
  const w = dom.window, calls = [];
  const reads = [];
  w.fetch = async (url) => { calls.push(url); const body = typeof data === "string" ? data : JSON.stringify(data);
    return data === "down" ? { ok: false } : { ok: true, headers: { get: (h) => (h === "content-length" ? String(over.len ?? body.length) : null) }, text: async () => { reads.push(url); return body; } }; };
  if (names) w.KNames = { of: (a) => (a === A ? "@alice · 1Nti1Z…zdxz" : a.slice(0, 6) + "…"), onChange: () => {} };
  w.eval(src);
  await new Promise((r) => setTimeout(r, 20));
  return { w, d: w.document, calls, reads };
}
const STRIP = '<div id="stats-strip" hidden></div>', PANEL = '<section id="stats-panel" hidden></section>';

test("the strip shows up to 3 strong facts, from one fetch of the stats-data file", async () => {
  const { d, calls } = await page(STRIP, sample());
  assert.deepEqual(calls, ["https://raw.githubusercontent.com/bawcejawn/KnodeGames/stats-data/stats.json"]);
  const s = d.getElementById("stats-strip");
  assert.equal(s.hidden, false);
  const facts = [...s.querySelectorAll(".stats-fact")].map((f) => f.textContent);
  assert.deepEqual(facts, ["48,250 VHP staked in the prize vault", "64 players this week", "565 answers and picks this week"]);
});
test("small numbers stay off the strip (research item 18); free prizes always qualify", async () => {
  const { d } = await page(STRIP, sample({ players: { week: 14, lastWeek: 9, allTime: 30 }, plays: { answers: 30, racePicks: 5, blockxPicks: 1, total: 36 }, staked: { total: 300, games: [] } }));
  const facts = [...d.querySelectorAll(".stats-fact")].map((f) => f.textContent);
  assert.equal(facts.length, 2); assert.match(facts[0], /^3 open questions, answers close in 3h 0m$/); assert.equal(facts[1], "2 + 1 VHP free prizes every week");
  assert.ok(!facts.some((f) => /14|300 VHP|36/.test(f)));
});
test("the strip hides when the file is missing, malformed, stale or not the right shape", async () => {
  for (const data of ["down", "not json", sample({ updated: new Date(Date.now() - 7 * 3600000).toISOString() }), sample({ v: 2 }),
    sample({ players: { week: "<img src=x onerror=alert(1)>", lastWeek: 1, allTime: 1 } }), sample({ top: { questions: [{ a: "<b>x</b>", pts: 1, place: 1 }], race: [], blockx: [] } }),
    sample({ staked: { total: 1, games: [{ id: 1, name: "x".repeat(41), vhp: 1 }] } }), "x".repeat(70000)]) {
    const { d } = await page(STRIP, data);
    assert.equal(d.getElementById("stats-strip").hidden, true, `shown for ${String(typeof data === "string" ? data : JSON.stringify(data)).slice(0, 60)}`);
  }
});
test("the panel shows every number and last week's top 3 with @names, all as text", async () => {
  const { d } = await page(PANEL, sample(), { names: true });
  const p = d.getElementById("stats-panel");
  assert.equal(p.hidden, false);
  const t = p.textContent;
  for (const want of ["64players this week", "51 last week · 230 wallets all time", "565answers and picks this week", "410 answers · 120 race picks · 35 Block X picks",
    "48,250 VHPstaked in the prize vault", "Daily Questions 40,000 · Block Golf 8,250", "2 + 1 VHPfree prizes every week", "48blocks made by the prize vault", "3 openquestions, answers close in", "41 answers so far", "Updated 20 min ago"]) assert.ok(t.includes(want), `missing "${want}" in ${t}`);
  const qs = [...p.querySelectorAll(".stats-top")][0];
  assert.deepEqual([...qs.querySelectorAll("li")].map((l) => l.textContent), ["#1@alice · 1Nti1Z…zdxz22 points", "#2" + B.slice(0, 6) + "…19 points"]);
  assert.match([...p.querySelectorAll(".stats-top")][1].textContent, /No points scored last week/);
  assert.match([...p.querySelectorAll(".stats-top")][2].textContent, /1 point$/);
  assert.equal(p.querySelectorAll("img, script, a").length, 0);
});
test("the panel stays hidden with no file, and says so when the numbers are old", async () => {
  assert.equal((await page(PANEL, "down")).d.getElementById("stats-panel").hidden, true);
  const { d } = await page(PANEL, sample({ updated: new Date(Date.now() - 8 * 3600000).toISOString() }));
  assert.match(d.getElementById("stats-panel").textContent, /more than 6 hours old/);
});
test("stats.js never writes HTML or stores anything, and both pages load it with the stats-data host allowed", () => {
  assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|localStorage|sessionStorage|eval\(/);
  for (const f of ["index.html", "games.html"]) {
    const h = fs.readFileSync(`${APP}/${f}`, "utf8");
    assert.match(h, /<script src="stats\.js"><\/script>/, f);
    assert.match(h.match(/connect-src [^;]*/)[0], /https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/stats-data\//, f);
  }
  assert.match(fs.readFileSync(`${APP}/index.html`, "utf8"), /<div class="stats-strip" id="stats-strip" hidden><\/div>/);
  assert.match(fs.readFileSync(`${APP}/games.html`, "utf8"), /<section class="stats-panel" id="stats-panel" aria-label="Live stats" hidden><\/section>/);
});

// ── Repo Lens #C-9 ──
test("C9-3: a file dated in the future is refused; once its week is over the strip hides and the panel says so", async () => {
  assert.equal((await page(STRIP, sample({ updated: new Date(Date.now() + 30 * 60000).toISOString() }))).d.getElementById("stats-strip").hidden, true);
  const ended = sample({ week: { start: Date.now() - 7 * 86400000 - 3600000, end: Date.now() - 3600000 } });
  assert.equal((await page(STRIP, ended)).d.getElementById("stats-strip").hidden, true);
  const { d } = await page(PANEL, ended);
  assert.match(d.getElementById("stats-panel").textContent, /These are last week's numbers/);
  assert.equal((await page(STRIP, sample({ week: { start: 5, end: 1 } }))).d.getElementById("stats-strip").hidden, true, "a week that ends before it starts");
});
test("C9-5: a game name with an invisible or direction character is refused", async () => {
  for (const ch of ["\u061c", "\u2028", "\u2060", "\ufeff", "\u3164", "\u202e"]) {
    const { d } = await page(STRIP, sample({ staked: { total: 48250, games: [{ id: 1, name: "Daily" + ch, vhp: 1 }] } }));
    assert.equal(d.getElementById("stats-strip").hidden, true, JSON.stringify(ch));
  }
});
test("C9-6: a file announced as over 64 KB isn't even downloaded", async () => {
  const { d, reads } = await page(STRIP, sample(), { len: 70000 });
  assert.equal(d.getElementById("stats-strip").hidden, true); assert.equal(reads.length, 0);
});
test("C9-4: the panel calls the all-time number wallets (stakers who never answered count too)", async () => {
  assert.match((await page(PANEL, sample())).d.getElementById("stats-panel").textContent, /230 wallets all time/);
});
