// Owner, 13 Nov: a quiet "Run your own node" line on every page (Koinos AI and our PowerShell/Docker steps), the footer
// app lists gone, and an Ecosystem page under More.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NODE_KIT, MORE, TOP } from "../../tools/site-nav.mjs";

const pages = fs.readdirSync(".").filter((f) => f.endsWith(".html"));
const read = (f) => fs.readFileSync(f, "utf8");

test("every page with a footer row carries the node line with both ways, and the Koinos AI link is ads.json's", () => {
  const ads = JSON.parse(read("ads.json"));
  assert.equal(NODE_KIT, ads.featured.link);
  let n = 0;
  for (const f of pages.filter((x) => read(x).includes('class="foot-row"'))) {
    n++;
    const h = read(f), m = h.match(/<p class="foot-node">.*?<\/p>/);
    assert.ok(m, `${f}: node line`);
    assert.ok(m[0].includes(`href="${NODE_KIT}"`) && /target="_blank" rel="noopener"/.test(m[0]), `${f}: Koinos AI`);
    assert.ok(m[0].includes('href="run-node.html"') && /PowerShell and Docker/.test(m[0]), `${f}: step by step`);
    assert.equal((h.match(/class="foot-node"/g) || []).length, 1, `${f}: once`);
  }
  assert.ok(n >= 15, "pages checked");
});

test("no page lists other Koinos apps at the bottom any more; the Ecosystem page is in More (menu and phone sheet)", () => {
  for (const f of pages) assert.doesNotMatch(read(f), /class="eco"|aria-labelledby="eco-title"/, `${f}: no footer list`);
  assert.doesNotMatch(read("app.js"), /footer: every project|\.eco"\)\.hidden/);
  assert.ok(MORE.some(([, h]) => h === "ecosystem.html"));
  assert.ok(TOP.find((t) => t.label === "More").items.some(([, h]) => h === "ecosystem.html"));
  for (const f of pages.filter((x) => read(x).includes(`class="tabbar"`))) assert.match(read(f), /ecosystem\.html/, `${f}: links Ecosystem`);
});

test("ecosystem page: the two node ways, the list from ads.json as text, https only, no storage", () => {
  const h = read("ecosystem.html"), j = read("ecosystem.js");
  assert.match(h, /koinosai\.com/); assert.match(h, /run-node\.html/); assert.match(h, /<script src="ecosystem\.js"><\/script>/);
  assert.match(j, /protocol === "https:"/); assert.match(j, /textContent/);
  assert.doesNotMatch(j, /innerHTML|localStorage|sessionStorage|eval\(|document\.write/);
  assert.doesNotMatch(h + j, /\b(bet|odds|gambl\w*|earn\w*|returns|guaranteed)\b/i, "player-facing words");
});
