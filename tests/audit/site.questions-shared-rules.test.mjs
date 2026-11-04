// Daily Questions on the shared game rules (D-116, R-Q-4), the page side: staking only through the shared Stake page;
// shared-rules weeks recognised from config.q60_rule_week_plus_one; their results and claims follow the shared route.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const app = fs.readFileSync(`${APP}/app.js`, "utf8"), html = fs.readFileSync(`${APP}/index.html`, "utf8");

test("no own Stake / Withdraw buttons or stake dialog on the Questions page: staking is on the Stake page", () => {
  assert.doesNotMatch(app, /openStake|stake-dialog|"deposit_vhp"|"deposit_koin"|opOf\(writer\(\), "withdraw"/);
  assert.doesNotMatch(html, /id="stake-dialog"/);
  assert.match(app, /const STAKE_HREF = "stake\.html#g1"/);
  assert.ok((app.match(/href: STAKE_HREF/g) || []).length >= 2, "the band and the Your game panel link to the Stake page");
});

test("shared-rules weeks: the same test as the bot (q60_rule_week_plus_one > 0 and week + 1 >= it)", () => {
  const m = app.match(/const sharedWeek = \(week\) => \{ const v = num\(\(S\.st && S\.st\.config \|\| \{\}\)\.q60_rule_week_plus_one\); return v > 0 && week \+ 1 >= v; \};/);
  assert.ok(m, "sharedWeek reads config.q60_rule_week_plus_one");
  const num = (x) => Number(x ?? 0);
  const make = (cfg) => { const S = { st: { config: cfg } }; return eval(`(${m[0].replace(/^const sharedWeek = /, "").replace(/;$/, "")})`); };
  assert.equal(make({})(9), false, "before the upgrade: never");
  assert.equal(make({ q60_rule_week_plus_one: "5" })(3), false);
  assert.equal(make({ q60_rule_week_plus_one: "5" })(4), true);
});

test("a shared-rules week's last-week box reads get_game (game 1) and says when results are due and final", () => {
  assert.match(app, /sharedWeek\(pw\) \? \(\(await read\("get_game", \{ game: 1, week: String\(pw\) \}\)/);
  assert.match(app, /waiting for the weekly close/);
  assert.match(app, /results posted by \$\{dayTime\(due\)\}/);
  assert.match(app, /final: collect on the Stake page/);
});

test("old-rule rewards stay claimable on the page; newer ones point to the Stake page", () => {
  assert.match(app, /onclick: \(\) => claim\(c\.week\) \}, "Collect"/);
  assert.match(app, /Rewards from the newer weeks are collected on the /);
});
