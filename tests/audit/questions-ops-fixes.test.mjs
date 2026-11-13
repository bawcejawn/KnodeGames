// Daily Questions after the 6–9 Nov GitHub outage (owner, 9 Nov): the PC heartbeat with a daily cap and a back-off on
// GitHub errors (P1), the bot's honest "closes late" notice (P2), the page's line for skipped rounds (P3), and plainer
// answer bands for the network questions' decimal choices.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { heartbeatDecision, mayDispatch, countDispatch, backOff, inBackoff, clearBackoff, BACKOFF, HEARTBEAT_PER_DAY, MAX_DISPATCH_PER_DAY, HEARTBEAT_STALE }
  from "../../bot/release-kick.mjs";

const APP = process.env.APP || ".";
const app = fs.readFileSync(`${APP}/app.js`, "utf8");
const MIN = 60_000, HOUR = 60 * MIN, NOW = Date.parse("2026-11-10T03:00:00Z");
const run = (ago, status = "completed") => ({ created_at: new Date(NOW - ago).toISOString(), status });

test("P1 heartbeat: starts the bot only when no run has started for 120 minutes and none is going", () => {
  assert.equal(heartbeatDecision([run(30 * MIN)], NOW).start, false);
  assert.equal(heartbeatDecision([run(HEARTBEAT_STALE - MIN)], NOW).start, false);
  assert.equal(heartbeatDecision([run(HEARTBEAT_STALE + MIN)], NOW).start, true);
  assert.equal(heartbeatDecision([run(5 * HOUR), run(2 * MIN, "queued")], NOW).start, false, "a run is going");
  assert.equal(heartbeatDecision([], NOW).start, true);
  assert.match(heartbeatDecision([run(3 * HOUR)], NOW).why, /no bot run has started since 2026-11-10 00:00/);
});

test("P1 cap: at most 6 heartbeat starts and 12 starts in all per UTC day; a new day resets it", () => {
  const st = {};
  for (let i = 0; i < HEARTBEAT_PER_DAY; i++) { assert.ok(mayDispatch(st, NOW, true)); countDispatch(st, NOW, true); }
  assert.equal(mayDispatch(st, NOW, true), false, "heartbeat cap");
  for (let i = HEARTBEAT_PER_DAY; i < MAX_DISPATCH_PER_DAY; i++) { assert.ok(mayDispatch(st, NOW, false)); countDispatch(st, NOW, false); }
  assert.equal(mayDispatch(st, NOW, false), false, "the day's cap for all starts");
  assert.equal(mayDispatch(st, NOW + 24 * HOUR, true), true, "next UTC day");
});

test("P1 back-off: 15, 30, 60, 120 minutes, then every 4 hours; a success resets it", () => {
  const st = {};
  const waits = [];
  for (let i = 0; i < 7; i++) { backOff(st, NOW); waits.push((st.backoffUntil - NOW) / MIN); }
  assert.deepEqual(waits, [15, 30, 60, 120, 240, 240, 240]);
  assert.equal(inBackoff(st, NOW + 239 * MIN), true);
  assert.equal(inBackoff(st, NOW + 241 * MIN), false);
  clearBackoff(st);
  backOff(st, NOW);
  assert.equal((st.backoffUntil - NOW) / MIN, BACKOFF[0] / MIN);
});

test("P1: every GitHub call in release-kick goes through the back-off, and the task now runs all day", () => {
  const src = fs.readFileSync(`${APP}/bot/release-kick.mjs`, "utf8");
  assert.match(src, /if \(inBackoff\(st, now\)\) return;/);
  assert.match(src, /e instanceof GitHubError[\s\S]*backOff\(st, now\)/);
  assert.equal((src.match(/throw new Error\(/g) || []).length, 0, "GitHub failures are GitHubError (backed off), not plain errors");
  const ps = fs.readFileSync(`${APP}/node/install-release-kick.ps1`, "utf8");
  assert.match(ps, /RepetitionInterval \(New-TimeSpan -Minutes 5\) -RepetitionDuration \(New-TimeSpan -Hours 23 -Minutes 59\)/);
});

test("P2: a week held open by the bot's own late resolve is a notice; any other late result still alarms", async () => {
  const { lateResultIsOurs, OWN_RESOLVE_SLACK_MS } = await import("../../bot/bot.ts");
  const t = Date.parse("2026-11-09T23:24:00Z");
  assert.equal(lateResultIsOurs([t - 60_000], t), true);
  assert.equal(lateResultIsOurs([t - OWN_RESOLVE_SLACK_MS - 1], t), false);
  assert.equal(lateResultIsOurs(undefined, t), false, "no record (fresh or distrusted state): alarm");
  assert.equal(lateResultIsOurs([t], 0), false);
  const bot = fs.readFileSync(`${APP}/bot/bot.ts`, "utf8");
  assert.match(bot, /&& lateResultIsOurs\(bs\.ownResolves, num\(wk\.last_resolved_time\)\)\) \{/);
  assert.match(bot, /bs\.ownResolves = \[\.\.\.\(bs\.ownResolves \?\? \[\]\), Date\.now\(\)\]\.slice\(-60\)/);
});

// ── P3 and the answer bands: the page's own functions, run on their own ──
const cut = (name) => { const i = app.indexOf(`  function ${name}(`); assert.ok(i > 0, name); let d = 0, j = app.indexOf("{", i); for (; j < app.length; j++) { if (app[j] === "{") d++; else if (app[j] === "}" && --d === 0) break; } return app.slice(i, j + 1); };
const roundsSrc = app.slice(app.indexOf("  const ROUNDS = "), app.indexOf("\n", app.indexOf("  const ROUNDS = ")));

test("P3: this week's closed rounds with nothing posted are listed, with why; posted and current rounds are not", () => {
  const G = 1792368000000, D = 86400000, W = 3;
  const ctx = { S: { genesis: G } };
  vm.runInNewContext(`${roundsSrc}\n${cut("roundsOfDay")}\n${cut("skippedRounds")}\nthis.f = skippedRounds;`, ctx);
  const mon = G + W * 7 * D, now = mon + D + 2 * HOUR;          // Tue 02:00 UTC
  const files = [
    { d: { date: "W003-D1", questions: [], skipped: "the bot was down: too late to release today's questions" } },
    { d: { date: "W003-D2-00", questions: [{ chainId: 85 }, { chainId: 86 }] } },
  ];
  const plain = (x) => JSON.parse(JSON.stringify(x));   // values from another vm realm
  const got = plain(ctx.f(now, W, files, []));
  assert.deepEqual(got.map((r) => [r.label, r.why]), [["W003-D1-00", "the bot was down"], ["W003-D1", "the bot was down"]]);
  assert.deepEqual(plain(ctx.f(now, W, [{ d: { date: "W003-D1-00", questions: [], skipped: "no fair questions could be made for this round" } }, ...files], [])).map((r) => r.why),
    ["no fair questions could be made", "the bot was down"]);
  assert.deepEqual(plain(ctx.f(mon + 2 * HOUR, W, [], [])), [], "Monday's 00:00 round still open: not listed");
  assert.match(fs.readFileSync(`${APP}/index.html`, "utf8"), /id="skipped-rounds" hidden/);
});

test("answer bands: network decimal choices get a plain name before their exact numbers; nothing else changes", () => {
  const ctx = { ADDR_RE: /1[1-9A-HJ-NP-Za-km-z]{25,34}/g };
  const block = app.slice(app.indexOf("  function qKind(q) {"), app.indexOf("  // question-words:end"));
  vm.runInNewContext(`${block}; this.W = { bandWords, optionWords };`, ctx);
  const { W } = ctx;
  const opts = (labels) => labels.map((label, index) => ({ index, label }));
  const m5 = { template: "M5", title: "Average block interval", unit: "ms", text: "What will be the average time between blocks between block 1 and block 5,000?",
    options: opts(["3.067 s or less", "3.068 s to 3.082 s", "3.083 s to 3.101 s", "3.102 s or more"]) };
  assert.deepEqual([...m5.options].map((o) => W.optionWords(m5, o)),
    ["Faster: 3.067 s or less", "A little faster: 3.068 s to 3.082 s", "A little slower: 3.083 s to 3.101 s", "Slower: 3.102 s or more"]);
  const m4 = { template: "M4", title: "Largest gap between blocks", unit: "ms", text: "What will be the longest gap between two consecutive blocks between block 1 and block 5,000?",
    options: opts(["26.670 s or less", "26.671 s to 30.410 s", "30.411 s or more"]) };
  assert.deepEqual(m4.options.map((o) => W.optionWords(m4, o)), ["Shorter wait: 26.670 s or less", "About as expected: 26.671 s to 30.410 s", "Longer wait: 30.411 s or more"]);
  const m6 = { template: "M6", title: "Share of empty blocks", unit: "permille", text: "What share of blocks will contain no transactions between block 1 and block 5,000?",
    options: opts(["98.9% or less", "99.0%", "99.1%", "99.2% or more"]) };
  assert.match(W.optionWords(m6, m6.options[0]), /^Busier \(fewer empty blocks\): 98\.9% or less$/);
  // Every label is kept whole after the words (the exact edges never change).
  for (const q of [m5, m4, m6]) for (const o of q.options) assert.ok(W.optionWords(q, o).endsWith(o.label));
  // Not touched: transactions (whole numbers) and producer questions.
  const m7 = { template: "M7", title: "Transactions", unit: "transactions", text: "How many transactions will be included in blocks between block 1 and block 5,000?", options: opts(["44 or fewer", "45 to 46"]) };
  assert.equal(W.optionWords(m7, m7.options[0]), "44 or fewer");
  const m1 = { template: "M1", title: "quartiles", unit: "blocks", text: "How many blocks will producer X sign", options: opts(["539 or fewer", "540 to 566"]) };
  assert.equal(W.bandWords(m1, m1.options[0]), null);
});

test("a wallet with something to collect sees one plain 'reward is waiting' line above the Collect buttons", () => {
  const app = fs.readFileSync(`${APP}/app.js`, "utf8");
  assert.match(app, /S\.claims\.length \? \[el\("p", \{ class: "muted", id: "claim-waiting" \}, "A reward is waiting for you\. It never expires; collect it any time\."\)\] : \[\]/);
  assert.ok(app.indexOf("claim-waiting") < app.indexOf('claim-row'), "the line comes before the rows");
});
