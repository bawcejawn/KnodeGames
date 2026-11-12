// Repo Lens #E-17 (PR #152 fix check): "Your past weeks" and the last-week box for shared-rules weeks, fed what the vault
// really returns. get_game_player's entry for game 1 is never null (the posted entry, else one built from the player's
// records), and an entry's `reward` is written only when the player collects it (claim_game).
// Runs app.js's own functions, cut out of the file, as site.questions-shared-rules.test.mjs does.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
function fnSrc(src, name) {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `app.js has ${name}`);
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1); }
  throw new Error(`unbalanced ${name}`);
}
const { sharedHistoryRow, historyText, sharedLastWeek } = new Function("big", "num", "amount", "WL", "dayTime", "STAKE_LINK",
  `${fnSrc(app, "sharedHistoryRow")}\n${fnSrc(app, "historyText")}\n${fnSrc(app, "sharedLastWeek")}\nreturn { sharedHistoryRow, historyText, sharedLastWeek };`)(
  (x) => BigInt(x ?? 0), (x) => Number(x ?? 0), (x) => `${Number(BigInt(x ?? 0)) / 1e8}`, (w) => `Week ${w + 1}`, (ms) => new Date(ms).toISOString().slice(0, 16), "LINK");
const U = 100000000n;
const text = (h) => historyText(h).join("|");

test("G-1: a staked winner who hasn't collected yet sees the reward waiting and the Stake page link", () => {
  // As the vault returns it before claim_game: points posted, no reward field yet, not claimed.
  const gg = { week: { finalized: true, cutoff: 9, pot_a: String(4n * U), pot_b: String(6n * U), aw_lo: "1", bw_lo: "1" }, buckets: [] };
  const h = sharedHistoryRow(3, { week_stake: String(5n * U), entry: { points: "12", stake: String(5n * U) } }, gg, U);
  assert.ok(historyText(h).includes("LINK"), `expected a "collect on the Stake page" link, got: ${text(h)}`);
});

test("G-1: a free-prize winner who hasn't collected yet is shown as a winner, not as \"free play\"", () => {
  const gg = { week: { finalized: true, prize_first: String(2n * U), first_n: 1 }, buckets: [] };
  const h = sharedHistoryRow(3, { week_stake: "0", entry: { points: "20", prize_place: 1 } }, gg, U);
  assert.doesNotMatch(text(h), /^free play$/, "a 1st-place free winner is not plain free play");
  assert.ok(historyText(h).includes("LINK"), `expected the Stake page link, got: ${text(h)}`);
});

test("G-2: a week the wallet never played (the vault returns an empty entry) gives no row", () => {
  assert.equal(sharedHistoryRow(3, { week_stake: "0", entry: {} }, { week: { finalized: true } }, U), null);
});

test("G-3: a week with no staked winners still pays its free prizes: not \"no results\"", () => {
  const G = { closed: true, finalized: true, rolled_over: true, prize_first: String(2n * U), first_n: 1, seal_time: "1" };
  const h = sharedHistoryRow(3, { week_stake: "0", entry: { points: "5", prize_place: 1 } }, { week: G }, U);
  assert.doesNotMatch(text(h), /no results/, `a paid free prize is a result, got: ${text(h)}`);
  const end = Date.parse("2026-11-16T00:00:00Z");
  assert.doesNotMatch(sharedLastWeek({ week: 3, end, G }, end + 3 * 86400000, 43200000).note, /no results/);
});
