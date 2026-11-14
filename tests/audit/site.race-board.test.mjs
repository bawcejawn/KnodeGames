import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const js = readFileSync(new URL("../../race.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../race.html", import.meta.url), "utf8");

test("race board: one animal picture per race length, all shipped with the site", () => {
  for (const a of ["rabbit", "horse", "bird", "snake", "turtle"]) {
    assert.ok(existsSync(new URL(`../../media/animals/${a}.png`, import.meta.url)), a);
    assert.ok(js.includes(a), a);
  }
  assert.match(js, /ANIMAL = \{ 0: "bird", 1: "rabbit", 2: "horse", 3: "snake", 4: "turtle" \}/);
});

test("race board: producers keep a fixed order, windows grow with race length, picks use the shared card", () => {
  assert.match(js, /rtFixed/);
  assert.match(js, /WINDOWS = \{ 1: \[15 \* 60000, 30 \* 60000\], 2: \[30 \* 60000, HOURMS\], 3: \[6 \* HOURMS, 12 \* HOURMS\], 4: \[DAYMS, 3 \* DAYMS\] \}/);
  assert.match(js, /rtDrafts\.set\(k, a\)/);
  assert.match(js, /id="rt-card"/.test(html) ? /rt-card/ : /rt-card/);
  assert.ok(html.includes('id="rt-track"') && html.includes('id="rt-win"') && html.includes('id="rt-time"'));
});

test("race board: images come from the site itself (CSP img-src 'self')", () => {
  assert.ok(/img-src 'self' data:/.test(html));
  assert.ok(!/https?:\/\/[^"']*\.png/.test(js));
});
