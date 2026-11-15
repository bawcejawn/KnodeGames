// Repo Lens #G-64 G64-3 (Low, text): from week 5 results.js swaps four spans and the "Coming soon" box, but the Race rules
// panel's "In short" paragraph (index.html, #rp-race .rules-short) keeps "Pick the winner for 3 points, or score 1 point (a show)",
// and the welcome step 2 keeps "After 6 hours, the horse furthest ahead wins." Both contradict the swapped text below them
// (the 6-hour race scores 4 / 2 / 1 from week 5; races of 1 hour to a week).
// Run: APP=<repo> node --test site.results-types.g64-3-stale-words.test.mjs   (fails at 9a769c52)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const html = fs.readFileSync(`${APP}/index.html`, "utf8");
const js = fs.readFileSync(`${APP}/results.js`, "utf8");
const swapped = new Set([...js.matchAll(/(?:set|getElementById)\("([a-z0-9-]+)"/g)].map((m) => m[1]));

// Every element in the HTML whose text names the old points or the 6-hour-only race must be one results.js swaps in week 5.
const OLD = /3 points|1 point \(a show\)|After 6 hours, the horse/;
test("G64-3: every old-points / 6-hour-only sentence on the home page is swapped from week 5", () => {
  const bad = [];
  for (const m of html.matchAll(/<(p|li|span|h3)([^>]*)>([^<]*(?:<(?!\/?(?:p|li)\b)[^<]*)*)<\/\1>/g)) {
    const [, , attrs, inner] = m;
    if (!OLD.test(inner)) continue;
    const id = (/\bid="([^"]+)"/.exec(attrs) || [])[1];
    const innerIds = [...inner.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
    const covered = (id && swapped.has(id)) || innerIds.some((x) => swapped.has(x) && OLD.test(inner.split(`id="${x}"`)[1].split("</span>")[0]));
    if (!covered) bad.push(inner.replace(/<[^>]+>/g, "").slice(0, 90));
  }
  assert.deepEqual(bad, [], "old wording left visible from week 5");
});
