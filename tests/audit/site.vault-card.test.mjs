// Hub: "The Knode pool" card (vault-card.js). It reads the checked stats file and shows the whole platform's staked VHP,
// each game's share, the block rewards so far (only once stats.json carries them, and only while fresh) and the time left.
// Read-only, plain text, no chain reads. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");
const NOW = Date.UTC(2026, 10, 18, 12);   // Wed 18 Nov: Week 1
const stats = (extra = {}) => ({ v: 1, updated: new Date(NOW - 20 * 60000).toISOString(), week: { start: Date.UTC(2026, 10, 16), end: Date.UTC(2026, 10, 23) },
  staked: { total: 1500, games: [{ id: 1, name: "Daily Questions", vhp: 900 }, { id: 7, name: "Producer Race", vhp: 500 }, { id: 2, name: "Who Signs Block X", vhp: 100 }] },
  blocks: { vault24h: 96 }, ...extra });
function page(s, now = NOW) {
  const dom = new JSDOM('<section id="vault-card" hidden></section>', { runScripts: "outside-only" });
  const w = dom.window;
  w.eval(read("weeks.js")); w.eval(read("vault-card.js"));
  const ok = w.KVaultCard.draw(w.document.getElementById("vault-card"), JSON.parse(JSON.stringify(s)), now);
  return { w, ok, box: w.document.getElementById("vault-card"), text: w.document.getElementById("vault-card").textContent };
}

test("shows the pool's VHP, each game's share and the week's name", () => {
  const { ok, box, text } = page(stats());
  assert.equal(ok, true); assert.equal(box.hidden, false);
  assert.match(text, /The Knode pool/); assert.doesNotMatch(text, /vault/i, "it is called the pool"); assert.match(text, /1,500 VHP/); assert.match(text, /in the pool/);
  assert.match(text, /Week 1/);
  assert.match(text, /Daily Questions[\s\S]*60%/); assert.match(text, /Producer Race[\s\S]*33%/); assert.match(text, /Who Signs Block X[\s\S]*7%/);
  assert.match(text, /5 days|4d|5d/, "time left in the week");
  assert.match(text, /96[\s\S]*blocks made, last 24 h/);
});
test("block rewards: 'Counting…' until stats.json carries them; then the figure; never an old or last week's figure", () => {
  assert.match(page(stats()).text, /Counting…/);
  const r = page(stats({ rewards: { soFar: 12.5 } }));
  assert.match(r.text, /12\.5 VHP/); assert.match(r.text, /block rewards this week so far/); assert.doesNotMatch(r.text, /Counting/);
  assert.doesNotMatch(page(stats({ rewards: { soFar: 12.5 } }), NOW + 8 * 86400000).text, /12\.5 VHP/, "the week is over");
  assert.doesNotMatch(page(stats({ rewards: { soFar: 12.5 }, updated: new Date(NOW - 7 * 3600000).toISOString() })).text, /12\.5 VHP/, "older than 6 hours");
  assert.doesNotMatch(page(stats({ rewards: { soFar: -3 } })).text, /-3/);
  assert.match(page(stats({ rewards: { soFar: "9" } })).text, /Counting…/);
});
test("seed VHP: added to the pool total and named once stats.json carries it; absent or invalid means players' stake only", () => {
  const a = page(stats({ seed: { vhp: 170000 } })).text;
  assert.match(a, /171,500 VHP/); assert.match(a, /1,500 VHP players' stake \+ 170,000 VHP seed/); assert.match(a, /seed VHP helps the pool make blocks and never plays/);
  const b = page(stats()).text;
  assert.match(b, /1,500 VHP/); assert.match(b, /players' stake, all games/); assert.doesNotMatch(b, /seed/i);
  assert.doesNotMatch(page(stats({ seed: { vhp: -5 } })).text, /seed/i);
  assert.doesNotMatch(page(stats({ seed: { vhp: "170000" } })).text, /seed/i);
});
test("nothing true to show: the card stays hidden", () => {
  assert.equal(page(null).ok, false);
  assert.equal(page(stats({ staked: { total: 0, games: [] } })).ok, false);
  assert.equal(page(stats({ staked: undefined })).ok, false);
  assert.equal(page(stats()).w.document.getElementById("vault-card").hidden, false);
});
test("game names are plain text (no markup from data)", () => {
  const { box } = page(stats({ staked: { total: 10, games: [{ id: 1, name: "<img src=x onerror=1>", vhp: 10 }] } }));
  assert.equal(box.querySelector("img.vc-blocky") !== null, true);
  assert.equal(box.querySelectorAll("img").length, 1, "only Blocky is an image");
  assert.match(box.textContent, /<img src=x onerror=1>/);
});
test("source: no HTML from data, no storage or sending; the pages load it; no banned words", () => {
  const js = read("vault-card.js"), text = (js + read("vault-card.css")).toLowerCase();
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage|XMLHttpRequest|\.send\(/);
  assert.doesNotMatch(js.replace(/^\/\*[\s\S]*?\*\//, ""), /fetch\(/, "it reads through stats.js");
  for (const f of ["index.html", "stake.html"]) {
    const h = read(f);
    assert.match(h, /id="vault-card"/); assert.match(h, /vault-card\.css/); assert.match(h, /<script src="vault-card\.js">/);
    assert.ok(h.indexOf("stats.js") < h.indexOf("vault-card.js"), `${f}: stats.js first`);
  }
  assert.match(read("stake.html"), /connect-src[^;]*stats-data\//, "stake.html may read the stats file");
  const visible = js.replace(/^\/\*[\s\S]*?\*\//, "").match(/"[^"]*"|`[^`]*`/g).join(" ");
  assert.doesNotMatch(visible, /\b(bet|bets|odds|gambl\w*|earn\w*|returns?|guarantee\w*)\b/i);
  assert.ok(text.includes("#fff"));
});
