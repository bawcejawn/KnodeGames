// Fantasy's free test week banner (owner, 14 Nov 2026: week 4 free test, week 5 from Sun 22 Nov 7 PM ET first real week).
// Runs nav.js with a tiny fake page at chosen times. Run: TZ=UTC node --test tests/audit/site.fantasy-test-week.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../../", import.meta.url));
const NAV = fs.readFileSync(`${APP}/nav.js`, "utf8");

function run(page, iso) {
  const kids = [];
  const mk = (tag) => ({ tag, className: "", attrs: {}, parts: [], textContent: "",
    setAttribute(k, v) { this.attrs[k] = v; }, append(...x) { this.parts.push(...x); } });
  const main = { prepend: (n) => kids.unshift(n), querySelector: (sel) => kids.find((k) => sel.split(".").filter(Boolean).every((c) => k.className.split(" ").includes(c))) || null };
  const document = { querySelector: (s) => (s === "main" ? main : null), getElementById: () => null, createElement: mk };
  const RealDate = Date, t = RealDate.parse(iso);
  const FakeDate = class extends RealDate { static now() { return t; } };
  vm.runInNewContext(NAV, { document, location: { pathname: `/${page}` }, Date: FakeDate, window: {} });
  return kids.map((k) => [k.className, (k.parts[0] && k.parts[0].textContent) + (k.parts[1] || "")]);
}
const fx = (page, iso) => run(page, iso).filter(([c]) => c.includes("fx-test-week"));

test("Fantasy test week banner: Home, All games and Fantasy only, from Mon 16 Nov 00:00 UTC to Mon 23 Nov 00:00 UTC", () => {
  for (const p of ["index.html", "games.html", "fantasy.html"]) {
    assert.equal(fx(p, "2026-11-15T23:59:59Z").length, 0, `${p}: not before week 4`);
    assert.equal(fx(p, "2026-11-16T00:00:00Z").length, 1, `${p}: on at the start of week 4 (Sun 15 Nov 7 PM ET)`);
    assert.equal(fx(p, "2026-11-22T23:59:59Z").length, 1, `${p}: still on at the end of week 4`);
    assert.equal(fx(p, "2026-11-23T00:00:00Z").length, 0, `${p}: off when the first real week starts (Sun 22 Nov 7 PM ET)`);
  }
  for (const p of ["race.html", "blockx.html", "stake.html", "golf.html"]) assert.equal(fx(p, "2026-11-18T12:00:00Z").length, 0, `${p}: never`);
});

test("Fantasy test week banner: the words follow the site's rules and the owner's dates", () => {
  const [[, text]] = fx("fantasy.html", "2026-11-18T12:00:00Z");
  assert.match(text, /^Fantasy Producers: free test week\. Teams and points are practice, with no rewards or prizes\. The first real week starts Sunday 22 November, 7 PM ET\.$/);
  assert.doesNotMatch(text, /\b(bet|odds|gambl|earn|returns|guaranteed|beta)/i);
  assert.doesNotMatch(NAV.slice(NAV.indexOf("Fantasy's free test week")), /innerHTML|localStorage|sessionStorage|fetch\(/);
});

test("Fantasy page note and the games list say week 4 is a free test and every week is real from Sun 22 Nov 7 PM ET", () => {
  const h = fs.readFileSync(`${APP}/fantasy.html`, "utf8"), g = JSON.parse(fs.readFileSync(`${APP}/games.json`, "utf8"));
  assert.match(h, /<b>Week 4 is a free test week\.<\/b>[^<]*test play starts with the Tue 17 Nov round \(first lock Mon 16 Nov, 6:55 PM ET\)\. From Sun 22 Nov, 7 PM ET \(week 5\) every week is real\. Week 5 starts with no teams: pick yours before Sun 22 Nov, 6:55 PM ET\./);
  assert.doesNotMatch(h, /planned for Mon 30 Nov|Test weeks/);
  const f = (g.games || g).find((x) => x.id === "fantasy");
  assert.match(f.line, /Week 4 is a free test week; from Sun 22 Nov, 7 PM ET every week is real\.$/);
  assert.doesNotMatch(f.line, /Test weeks/);
  // The page hides its note from Mon 23 Nov 00:00 UTC (Sun 22 Nov 7 PM ET), the end of week 4.
  assert.match(fs.readFileSync(`${APP}/fantasy.js`, "utf8"), /TEST_WEEK_ENDS = Date\.UTC\(2026, 10, 23\);\n  if \(Date\.now\(\) >= TEST_WEEK_ENDS && \$\("fx-testweeks"\)\) \$\("fx-testweeks"\)\.hidden = true;/);
});

test("only the Fantasy banner is left: nothing shows in the old test week (its banner is gone), Fantasy's shows from Mon 16 Nov", () => {
  assert.equal(run("index.html", "2026-11-12T12:00:00Z").length, 0);
  assert.deepEqual(run("index.html", "2026-11-16T00:00:00Z").map(([c]) => c), ["test-week fx-test-week"]);
});
