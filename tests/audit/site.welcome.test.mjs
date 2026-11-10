// The welcome page leads with free play (launch UI research item 5, owner 5 Nov): a play button on the first screen,
// step 1 is answering for free, and wallets and staking come last, as the "want more" step.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const html = fs.readFileSync(`${APP}/index.html`, "utf8");
const welcome = html.slice(html.indexOf('id="view-welcome"'), html.indexOf("<!-- ───────────── PLAY"));

test("the headline is the game, not the money; a 'Play free now' button comes before the explanation", () => {
  assert.match(welcome, /<h1>Guess what the blockchain does next\.<\/h1>/);
  assert.doesNotMatch(welcome.match(/<h1>[\s\S]*?<\/h1>/)[0], /pool|win|VHP/i);
  const play = welcome.indexOf('href="#play">Play free now</a>'), why = welcome.indexOf('class="welcome-why"');
  assert.ok(play > 0 && play < why, "play button above 'What's going on'");
});
test("step 1 is a free answer with no sign-up; wallets and staking are the last step", () => {
  const steps = [...welcome.matchAll(/<li[^>]*><span>(\d)<\/span><div><b>([^<]+)<\/b><p>([\s\S]*?)<\/p><\/div><\/li>/g)].map((m) => ({ n: m[1], b: m[2], p: m[3] }));
  assert.equal(steps.length, 4);
  assert.match(steps[0].b, /free, no sign-up/i);
  assert.doesNotMatch(steps.slice(0, 3).map((s) => s.b + s.p).join(" "), /wallet|stake|Kondor|KOIN Vault/i, "no wallet talk before the last step");
  assert.match(steps[3].b + steps[3].p, /Stake/); assert.match(steps[3].p, /never spent/); assert.match(steps[3].p, /get\.html/);
});
