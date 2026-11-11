// D-063: players see the week of Mon 16 Nov 2026 (vault week 4) as "Week 1" and the week of Mon 9 Nov (vault week 3) as
// the "Test week" (owner, 9 Nov 2026); earlier weeks show their date.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(`${APP}/weeks.js`, "utf8"), ctx);
const K = ctx.KWeeks;

test("vault week 4 is Week 1, vault week 3 the Test week; earlier weeks show their date; the week of a time", () => {
  assert.equal(K.label(4), "Week 1");
  assert.equal(K.label(5), "Week 2");
  assert.equal(K.label(3), "Test week");
  assert.equal(K.short(3), "Test");
  assert.equal(K.isTest(3), true);
  assert.equal(K.isTest(4), false);
  assert.equal(K.label(2), "Week of 2 Nov");
  assert.equal(K.label(0), "Week of 19 Oct");
  assert.equal(K.short(4), "1");
  assert.equal(K.short(2), "2 Nov");
  assert.equal(K.of(Date.parse("2026-11-09T00:00:00Z")), 3);
  assert.equal(K.of(Date.parse("2026-11-08T23:59:59Z")), 2);
});

test("board.js uses the same rule when a page doesn't load weeks.js", () => {
  const src = fs.readFileSync(`${APP}/board.js`, "utf8");
  const m = /const WL = \(w\) => \{([\s\S]*?)\n  \};/.exec(src);
  assert.ok(m, "board.js week label found");
  const fallback = new Function("root", `return (w) => {${m[1]}\n};`)({});
  for (let w = 0; w < 12; w++) assert.equal(fallback(w), K.label(w), `week ${w}`);
});

test("the pages that show weeks use the shared labels", () => {
  const idx = fs.readFileSync(`${APP}/index.html`, "utf8");
  assert.ok(idx.indexOf('src="weeks.js"') > -1 && idx.indexOf('src="weeks.js"') < idx.indexOf('src="app.js"'), "index.html loads weeks.js before app.js");
  for (const f of ["app.js", "results.js", "board.js"]) assert.doesNotMatch(fs.readFileSync(`${APP}/${f}`, "utf8"), /`Week \$\{[A-Za-z_.]+ \+ 1\}/, `${f}: no raw "Week n+1"`);
  assert.doesNotMatch(idx, /once the Knode Games vault is live/);
});

test("the test week banner: on every game page and the Stake page, only from Mon 9 to Mon 16 Nov 2026 UTC", () => {
  const nav = fs.readFileSync(`${APP}/nav.js`, "utf8");
  assert.match(nav, /const FROM = Date\.UTC\(2026, 10, 9\), UNTIL = Date\.UTC\(2026, 10, 16\);/);
  assert.match(nav, /const PAGES = \["index\.html", "race\.html", "blockx\.html", "golf\.html", "games\.html", "stake\.html"\];/);
  assert.match(nav, /no rewards; this week's earnings go to Week 1's pool/);
  assert.match(nav, /now < FROM \|\| now >= UNTIL\) return;/);
  assert.doesNotMatch(nav, /innerHTML|localStorage|fetch\(/);
  for (const p of ["index.html", "race.html", "blockx.html", "golf.html", "games.html", "stake.html"]) assert.match(fs.readFileSync(`${APP}/${p}`, "utf8"), /src="nav\.js"/, `${p} loads nav.js`);
});
