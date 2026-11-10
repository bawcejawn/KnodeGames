// The welcome page leads with free play (launch UI research item 5, owner 5 Nov): a play button on the first screen,
// step 1 is answering for free, and wallets and staking come last, as the "want more" step.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const html = fs.readFileSync(`${APP}/index.html`, "utf8");
const welcome = html.slice(html.indexOf('id="view-welcome"'), html.indexOf("<!-- ───────────── PLAY"));

test("the headline is the game, not the money; today's question (or a 'Play free now' button) comes before the explanation", () => {
  assert.match(welcome, /<h1>Guess what the blockchain does next\.<\/h1>/);
  assert.doesNotMatch(welcome.match(/<h1>[\s\S]*?<\/h1>/)[0], /pool|win|VHP/i);
  const q = welcome.indexOf('id="welcome-question"'), play = welcome.indexOf('href="race.html#pick-zone">Play free now</a>'), why = welcome.indexOf('class="welcome-why"');
  assert.ok(q > 0 && q < play && play < why, "the question slot, with Play free now inside it until the questions load, above 'What's going on'");
});
test("play first (mockup version 2): app.js puts today's first open question in the welcome view, as the Play tab's own card", () => {
  const app = fs.readFileSync(`${APP}/app.js`, "utf8");
  assert.match(app, /renderWelcomeToday\(open, emptyText\);/);
  assert.match(app, /const first = open\.find\(\(q\) => myAnswer\(q\) === null\) \|\| open\[0\];/);
  assert.match(app, /wq\.replaceChildren\(\.\.\.\(first \? \[questionCard\(first, "open"\)\]/);
  assert.match(app, /if \(paths\) paths\.hidden = !!S\.account;/);
});
test("wallet users get their own clear path: a Connect wallet button beside the question", () => {
  assert.match(welcome, /<b>Have a Koinos wallet\? Stake and play with it\.<\/b>[\s\S]*?<button class="btn btn-ghost" type="button" id="welcome-connect">Connect wallet<\/button>/);
  assert.match(fs.readFileSync(`${APP}/app.js`, "utf8"), /wc2\.addEventListener\("click", \(\) => connect\(\)\)/);
});
test("step 1 is a free answer with no sign-up; wallets and staking are the last step", () => {
  const steps = [...welcome.matchAll(/<li[^>]*><span>(\d)<\/span><div><b>([^<]+)<\/b><p>([\s\S]*?)<\/p><\/div><\/li>/g)].map((m) => ({ n: m[1], b: m[2], p: m[3] }));
  assert.equal(steps.length, 4);
  assert.match(steps[0].b, /free, no sign-up/i);
  assert.doesNotMatch(steps.slice(0, 3).map((s) => s.b + s.p).join(" "), /wallet|stake|Kondor|KOIN Vault/i, "no wallet talk before the last step");
  assert.match(steps[3].b + steps[3].p, /Stake/); assert.match(steps[3].p, /never spent/); assert.match(steps[3].p, /get\.html/);
});
