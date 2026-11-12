// Block Golf page (golf.html, golf.js, golf.css): the same strict page rules as every game page, nothing built
// from HTML, read-only (no transaction, no storage), and every element the script draws into exists. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const read = (f) => fs.readFileSync(`${APP}/${f}`, "utf8");
const html = read("golf.html"), js = read("golf.js");
const csp = (h) => (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(h) || [])[1];

test("the same Content-Security-Policy as the other game pages; no inline scripts or handlers", () => {
  assert.equal(csp(html), csp(read("blockx.html")));
  assert.doesNotMatch(html, /<script>(?!\s*<\/script>)|<script(?![^>]*\bsrc=)[^>]*>/i, "no inline script");
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "no inline handlers");
  for (const m of html.matchAll(/<script src="https:[^"]+"[^>]*>/g)) assert.match(m[0], /integrity="sha384-[^"]+" crossorigin="anonymous"/, "CDN scripts pinned");
});

test("scripts load in order: wallet first, names and the stake panel, the shared rules, the board, the page, analytics", () => {
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !s.startsWith("https:"));
  assert.deepEqual(srcs, ["data-source.js", "guest.js", "wallet.js", "header-wallet.js", "nav.js", "names.js", "stake-panel.js", "weeks.js", "golf-math.js", "board.js", "golf.js", "vendor/posthog-1.438.13.js", "analytics.js"]);
  assert.match(html, /<link rel="stylesheet" href="board\.css">\s*<link rel="stylesheet" href="golf\.css">/);
});

test("golf.js builds nothing from HTML, sends nothing and stores nothing", () => {
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(js, /\.send\(|signTransaction|method:\s*"POST"/);
  assert.match(js, /const DATA = "https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/games-data\/golf\/"/);
  assert.ok(csp(html).includes("https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/"), "the page may read games-data");
});

test("every element the script uses exists once in the page", () => {
  const ids = new Set([...js.matchAll(/\$\("([a-z0-9-]+)"\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 10);
  for (const id of ids) assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, id);
});

test("game links come only from games.json pages on this site", () => {
  assert.match(js, /\/\^\[a-z0-9-\]\+\\\.html\(#\[a-z0-9\/-\]\*\)\?\$\/\.test\(g\.href\)/);
});

test("the page's stroke key matches the shared rules", () => {
  const box = { window: {} };
  vm.runInNewContext(read("golf-math.js"), box);
  const G = box.window.KGolf;
  assert.equal(JSON.stringify(G.BANDS.map((b) => b[0])), "[5,25,65,90,100]");
  for (const pct of [5, 25, 65, 90]) assert.ok(html.includes(`Top ${pct}%`) || js.includes(`Top ${pct}%`), `${pct}% in the key`);
  assert.match(html, /at least 5 Block Golf stakers with at least 10 VHP/);
  assert.match(html, /In practice weeks every player who scored counts, and 3 make a hole/, "Repo Lens G-6");
  assert.equal(G.PRACTICE_MIN_FIELD, 3);
  assert.doesNotMatch(html + js, /at least 1 VHP\)|hold at least 1 VHP or stake in Knode Games/, "Repo Lens G-6: Golf's own staking rule");
  assert.match(html, /counted by the VHP they have staked/);
  assert.equal(G.MIN_FIELD, 5);
});

test("games.json: Block Golf is live, with its page and its leaderboard on games-data; the menus link it", () => {
  const g = JSON.parse(read("games.json")).games.find((x) => x.id === "golf");
  assert.equal(g.status, "live");
  assert.equal(g.href, "golf.html");
  assert.ok(g.line.length <= 200);
  for (const p of ["golf.html", "blockx.html", "index.html", "games.html"]) assert.match(read(p), /href="golf\.html"/, `${p} links Block Golf`);
  assert.equal(g.board.data, "games-data/golf/board.json");
  assert.deepEqual(g.board.columns.map((c) => c.key), ["pts", "topar", "holes", "lost"]);
});

test("standards every game page meets: nicknames (D-078), stake badge and panel for game 6 (D-031), the Sunday line (D-125)", () => {
  assert.match(js, /window\.KNames\.of\(a\)/, "names through names.js");
  assert.match(js, /name: nameOf,/, "the board shows nicknames");
  assert.match(js, /const GAME_ID = 6;/);
  assert.match(js, /KStake\.badge\(\$\("stake-badge"\), \{ game: GAME_ID \}\)/);
  assert.match(js, /KStake\.mount\(\$\("golf-stake"\), \{ game: GAME_ID \}\)/);
  assert.match(html, /<main class="gf">\s*<div id="stake-badge" hidden><\/div>/, "badge at the top of <main>");
  assert.match(html, /Sunday is review day: results are checked and paid from Monday\./);
  assert.doesNotMatch(html + js, /bawcejawn\.github\.io\/Knode|\/Knode\/|final 12 hours/, "no old repo address or 12-hour final");
});

test("week labels: Golf names weeks as players see them (D-063: vault week 4 is Week 1)", () => {
  assert.doesNotMatch(js, /wf\.week \+ 1/, "never vault week + 1");
  assert.match(js, /window\.KWeeks\.label\(w\)/);
  assert.match(js, /G\.shareText\(card, weekLabel\(wf\.week\)\)/);
  // B13-B5: the card line itself names the week through weekLabel, and no other `Week ${…}` is built on the page
  assert.match(js, /\$\("card-sub"\)\.textContent = `\$\{weekLabel\(wf\.week\)\}, from /);
  assert.deepEqual(js.match(/`Week \$\{[^}]*\}/g), ["`Week ${w}"], "only weekLabel's own fallback");
  const box = { window: {} }; box.globalThis = box.window;
  new Function("window", "globalThis", fs.readFileSync(`${APP}/weeks.js`, "utf8"))(box.window, box.window);
  assert.equal(box.window.KWeeks.label(4), "Week 1");   // owner, 9 Nov: Week 1 = Mon 16 (vault week 4)
});

test("npm run golf exists (golf.yml runs it every hour)", () => {
  assert.equal(JSON.parse(read("package.json")).scripts.golf, "tsx bot/games/golf.ts");
  assert.match(read(".github/workflows/golf.yml"), /run: npm run golf\n/);
});
