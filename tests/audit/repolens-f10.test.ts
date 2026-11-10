// Repo Lens #F-10: PR #245 (questions-ops-fixes @ af5df72d). Two Low findings; both tests fail today.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lateResultIsOurs } from "../../bot/bot.ts";

test("F10-1 (Low): every GitHub call from the PC task has a time limit (a hung call is killed at 4 min with no state written)", () => {
  const src = fs.readFileSync("bot/release-kick.mjs", "utf8");
  const gh = src.slice(src.indexOf("async function gh("), src.indexOf("class GitHubError"));
  assert.match(gh, /signal\s*:\s*AbortSignal\.timeout\(/, "fetch() in gh() has no timeout: a dispatch that went through but hung before writeState isn't counted against the daily cap, and no back-off is recorded");
});

test("F10-2 (Low): a result 10 minutes after the bot's own resolve is not taken for the bot's (an owner correction can follow it)", () => {
  const sent = Date.UTC(2026, 10, 16, 21, 0, 0);
  assert.equal(lateResultIsOurs([sent], sent + 30_000), true, "control: the bot's tx lands seconds after it is sent");
  assert.equal(lateResultIsOurs([sent], sent + 10 * 60_000), false,
    "OWN_RESOLVE_SLACK_MS is 20 min: a correct_question 10 min after the bot's late resolve becomes a notice, not the 'admin key may be compromised' alarm");
});
