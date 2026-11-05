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
  assert.match(app, /if \(sharedWeek\(pw\)\) \{\s*try \{ G = \(await read\("get_game", \{ game: 1, week: String\(pw\) \}\)\)\.week \|\| \{\}; \}/);
  assert.match(app, /waiting for the weekly close/);
  assert.match(app, /results posted by \$\{dayTime\(due\)\}/);
  assert.match(app, /final: collect on the Stake page/);
});

test("old-rule rewards stay claimable on the page; newer ones point to the Stake page", () => {
  assert.match(app, /onclick: \(\) => claim\(c\.week\) \}, "Collect"/);
  assert.match(app, /Rewards from the newer weeks are collected on the /);
});

// ── Repo Lens (PR #152 audit) F-1 and F-2: the shared-week history row and last-week box, run from app.js's own code ──
function fnSrc(src, name) {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `app.js has ${name}`);
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1); }
  throw new Error(`unbalanced ${name}`);
}
const helpers = new Function("big", "num", "amount", "WL", "dayTime", "STAKE_LINK",
  `${fnSrc(app, "sharedHistoryRow")}\n${fnSrc(app, "historyText")}\n${fnSrc(app, "sharedLastWeek")}\nreturn { sharedHistoryRow, historyText, sharedLastWeek };`)(
  (x) => BigInt(x ?? 0), (x) => Number(x ?? 0), (x) => `${Number(BigInt(x ?? 0)) / 1e8}`, (w) => `Week ${w + 1}`, (ms) => new Date(ms).toISOString().slice(0, 16), "LINK");
const UNIT = 100000000n;

test("F-1: a posted shared-week result shows its real points and reward, never \"0 pts · free play\"", () => {
  const { sharedHistoryRow, historyText } = helpers;
  // q60_rule_week_plus_one = 4: week 3 is shared; finalized; a staked winner with 12 points.
  const h = sharedHistoryRow(3, { week_stake: String(5n * UNIT), entry: { points: "12", reward: String(3n * UNIT), claimed: false } }, { week: { finalized: true, cutoff: 9 } }, UNIT);
  assert.equal(h.pts, 12);
  assert.equal(h.staked, true);
  const t = historyText(h);
  assert.deepEqual(t, ["Won 3 VHP · ", "LINK"], "won, with a link to collect on the Stake page");
  assert.ok(!t.join(" ").includes("free play"));
  // A staked player below the line, a free winner, a week not final yet, a rolled-over week.
  assert.deepEqual(historyText(sharedHistoryRow(3, { week_stake: String(UNIT), entry: { points: "4" } }, { week: { finalized: true, cutoff: 9 } }, UNIT)), ["missed the line (9 pts)"]);
  assert.deepEqual(historyText(sharedHistoryRow(3, { week_stake: "0", entry: { points: "20", prize_place: 1, reward: String(2n * UNIT), claimed: true } }, { week: { finalized: true } }, UNIT)), ["Top free player: 2 VHP · collected"]);
  assert.deepEqual(historyText(sharedHistoryRow(3, { week_stake: String(UNIT), entry: { points: "7" } }, { week: { closed: true } }, UNIT)), ["staked: results not final yet"]);
  assert.deepEqual(historyText(sharedHistoryRow(3, { week_stake: String(UNIT) }, { week: { finalized: true, rolled_over: true } }, UNIT)), ["no results for this week (its share rolled over)"]);
  assert.equal(sharedHistoryRow(3, { week_stake: "0" }, { week: {} }, UNIT), null, "not in that week: no row");
});

test("F-2: the shared-week last-week box: the close time, a rolled-over week, a failed read", () => {
  const { sharedLastWeek } = helpers;
  const end = Date.parse("2026-11-16T00:00:00Z"), H = 3600000, P = (G, extra = {}) => ({ week: 3, end, G, ...extra });
  // (a) Monday morning: the vault week can't close before 12:00 UTC.
  assert.match(sharedLastWeek(P({}), end + 2 * H, 12 * H).note, /waiting for the weekly close, about 2026-11-16T12:00/);
  assert.match(sharedLastWeek(P({}), end + 13 * H, 12 * H).note, /within about an hour/);
  // (b) rolled over (no results by the deadline): says so, no "collect", and hides after a day past the deadline.
  const r = P({ closed: true, finalized: true, rolled_over: true, seal_time: "0" });
  assert.match(sharedLastWeek(r, end + 3.5 * 24 * H, 12 * H).note, /no results for this week/);
  assert.equal(sharedLastWeek(r, end + 3.5 * 24 * H, 12 * H).hidden, false);
  assert.equal(sharedLastWeek(r, end + 4.1 * 24 * H, 12 * H).hidden, true);
  // (c) a failed read shows "…", not "closing".
  const e = sharedLastWeek(P({}, { Gerr: true }), end + 2 * H, 12 * H);
  assert.equal(e.v, "…"); assert.match(e.k, /…/); assert.match(e.note, /couldn't read it/);
  // normal path: closed → sealed → final
  assert.match(sharedLastWeek(P({ closed: true, bucket: String(7n * UNIT) }), end + 20 * H, 12 * H).note, /results posted by 2026-11-19T00:00/);
  assert.match(sharedLastWeek(P({ closed: true, sealed: true, seal_time: String(end + 60 * H) }), end + 70 * H, 12 * H).note, /final 2026-11-19T12:00/);
  assert.match(sharedLastWeek(P({ closed: true, sealed: true, finalized: true, seal_time: String(end + 60 * H) }), end + 90 * H, 12 * H).note, /collect on the Stake page/);
});

test("F-3: no \"1 VHP each\" left for the free prize on the page", () => {
  assert.doesNotMatch(html, /1 VHP each/);
});
