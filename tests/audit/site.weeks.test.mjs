// D-063: players see the week of Mon 9 Nov 2026 (vault week 3) as "Week 1"; earlier weeks show their date.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(`${APP}/weeks.js`, "utf8"), ctx);
const K = ctx.KWeeks;

test("vault week 3 is Week 1; earlier weeks show their date; the week of a time", () => {
  assert.equal(K.label(3), "Week 1");
  assert.equal(K.label(4), "Week 2");
  assert.equal(K.label(2), "Week of 2 Nov");
  assert.equal(K.label(0), "Week of 19 Oct");
  assert.equal(K.short(3), "1");
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
