// The welcome page leads with free play (launch UI research item 5, owner 5 Nov): a play button on the first screen,
// step 1 is answering for free, and wallets and staking come last, as the "want more" step.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const html = fs.readFileSync(`${APP}/index.html`, "utf8");
const welcome = html.slice(html.indexOf('id="view-welcome"'), html.indexOf("<!-- ───────────── PLAY"));

test("the headline is the game, not the money; the Producer Race and its Play free now button come before the explanation (owner, 10 Nov)", () => {
  assert.match(welcome, /<h1>Guess what the blockchain does next\.<\/h1>/);
  assert.doesNotMatch(welcome.match(/<h1>[\s\S]*?<\/h1>/)[0], /pool|win|VHP/i);
  const race = welcome.indexOf('id="welcome-race"'), play = welcome.indexOf('href="race.html#pick-zone">Play free now</a>'), why = welcome.indexOf('class="welcome-why"');
  assert.ok(race > 0 && race < play && play < why, "the race card, with Play free now in it, above 'What's going on'");
  for (const t of ["4 races a day", "Pick one horse per race", "3 points for a win, 1 for 2nd or 3rd", "Free"]) assert.ok(welcome.includes(`<b>${t}</b>`), t);
  assert.doesNotMatch(welcome, /welcome-question|href="#play">Play free/);
});
test("the home page hero no longer loads a question; wallet users' row hides once connected", () => {
  const app = fs.readFileSync(`${APP}/app.js`, "utf8");
  assert.match(app, /renderWelcomeToday\(\);/);
  assert.match(app, /if \(paths\) paths\.hidden = !!S\.account;/);
  assert.doesNotMatch(app, /wq\.replaceChildren|welcome-more/);
});
test("All the games lists every game; only the open ones are links; no 'Coming soon' label, no 'Never miss a day' box (owner, 10 Nov)", () => {
  const g = welcome.slice(welcome.indexOf('id="welcome-games"'), welcome.indexOf('class="welcome-actions"'));
  for (const [name, href] of [["Producer Race", "race.html"], ["Daily Questions", "#play"], ["Who Signs Block X", "blockx.html"], ["Producer Bracket", "bracket.html"], ["Block Golf", "golf.html"]]) assert.match(g, new RegExp(`<a class="also-card" href="${href.replace(".", "\\.")}"><span[^>]*>[^<]*</span><div><b>${name}</b>`), name);
  for (const name of ["Fantasy Producers", "Survivor"]) assert.match(g, new RegExp(`<div class="also-card soon" aria-disabled="true"><span[^>]*>[^<]*</span><div><b>${name}</b>`), `${name} is not a link`);
  assert.match(g, /<a class="also-card" href="swap\.html">[\s\S]*Knode Games Swap/);
  assert.match(g, /<a class="also-card" href="run-node\.html">[\s\S]*Run a node/);
  assert.match(g, /Block Golf[\s\S]*?Practice in Week 1 \(from Mon 16 Nov\)/);   // owner, 10 Nov: Golf is clickable, practice in Week 1
  assert.doesNotMatch(g, /Coming soon/);   // the games list has no label (the race card says what is coming)
  assert.doesNotMatch(welcome, /Never miss a day|welcome-remind/);
});
test("the Rules tab has a tab and a panel for every open game", () => {
  for (const t of ["game", "race", "blockx", "swap"]) { assert.match(html, new RegExp(`data-rules="${t}"`)); assert.match(html, new RegExp(`data-rules-panel="${t}"`)); }
  assert.match(fs.readFileSync(`${APP}/app.js`, "utf8"), /RULE_TABS = \["game", "race", "blockx", "swap"\]/);
});
test("wallet users get their own clear path: a Connect wallet button beside the race", () => {
  assert.match(welcome, /<b>Have a Koinos wallet\? Stake and play with it\.<\/b>[\s\S]*?<button class="btn btn-ghost" type="button" id="welcome-connect">Connect wallet<\/button>/);
  assert.match(fs.readFileSync(`${APP}/app.js`, "utf8"), /wc2\.addEventListener\("click", \(\) => connect\(\)\)/);
});
test("step 1 is a free pick with no sign-up; wallets and staking are the last step", () => {
  const steps = [...welcome.matchAll(/<li[^>]*><span>(\d)<\/span><div><b>([^<]+)<\/b><p>([\s\S]*?)<\/p><\/div><\/li>/g)].map((m) => ({ n: m[1], b: m[2], p: m[3] }));
  assert.equal(steps.length, 4);
  assert.match(steps[0].b, /free, no sign-up/i);
  assert.doesNotMatch(steps.slice(0, 3).map((s) => s.b + s.p).join(" "), /wallet|stake|Kondor|KOIN Vault/i, "no wallet talk before the last step");
  assert.match(steps[3].b + steps[3].p, /Stake/); assert.match(steps[3].p, /never spent/); assert.match(steps[3].p, /get\.html/);
});

test("more race types are shown as coming soon only; today's live points stay 3 for a win and 1 for a show (owner, 10 Nov)", () => {
  assert.match(welcome, /<b>Coming soon:<\/b> 1-hour, 2-hour, daily and weekly races too, all on one board\./);
  const at = html.indexOf('id="race-types-soon"'), soon = html.slice(at, html.indexOf('class="rules-more"', at));
  assert.match(soon, /planned, not live yet/);
  assert.match(soon, /Until this is announced as live, the points above stay as they are today/);
  assert.match(html, /A win is 3 points, a show \(2nd or 3rd\) is 1\./);
  assert.doesNotMatch(welcome, /Week 1 \(Mon 9|from Mon 9 Nov/);
});
