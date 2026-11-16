// Repo Lens #H-1 (PR #330 kg-09-bracket-followup @ 55e03cab), H1-1 (Low). Place in tests/audit/. Fails at 55e03cab.
// The Bracket page mounts the shared stake panel with a constant { freePrize: true }, so the panel's line (stake-panel.js
// explain) says "free players play for the 2 + 1 VHP prize" in every week, including Week 1 (vault week 4), the practice
// week, where the switch is off and nothing is paid, and on the same page as the practice notice that says no VHP is paid.
// Fix (candidate-fix-h1-1.diff): mount the panel after index.json is read, with freePrize on only from prizesFromWeek.
// Run from the repository root: TZ=UTC node --import tsx --test tests/audit/bracket-free-prize.repolens-h1.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");
await import(path.resolve(APP, "vhp-standard.js")); await import(path.resolve(APP, "bracket-math.js"));
const BM = globalThis.KBracketMath;
const windows = [];
after(() => { for (const w of windows) w.close(); });
const flush = async (w, n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => w.setTimeout(r, 0)); };

// stake-panel.js's own explain(), as repolens-g4.test.mjs extracts it
const explain = (() => {
  const src = read("stake-panel.js"), a = src.indexOf("function explain("), b = src.indexOf("\n  }\n", a);
  return new Function("exact", "UNIT", `${src.slice(a, b + 4)}; return explain;`)((x) => String(x), 100000000n);
})();
const GAME9 = { staked: true, free_prize: true, season_weeks: 1 };   // game-add 9 … --free (the vault's record)

/** The page at `now`, index.json saying prizes start at `prizesFromWeek`; returns the options of the LAST panel mount. */
async function mountOpts(now, prizesFromWeek) {
  const dom = new JSDOM(read("bracket.html"), { runScripts: "outside-only", url: "https://knodegames.com/bracket.html" });
  const w = dom.window; windows.push(w);
  w.Date.now = () => now;
  w.fetch = async (u) => {
    const s = String(u), json = (o) => ({ ok: true, status: 200, json: async () => o });
    if (s.endsWith("bracket/index.json")) return json({ v: 1, updated: "2026-11-15T03:00:00.000Z", weeks: [4], game: 9, prizesFromWeek });
    return { ok: false, status: 404, json: async () => null };
  };
  w.koilib = { Provider: class { async getHeadInfo() { return { head_block_time: String(now) }; } }, Contract: class { constructor() { this.functions = {}; } } };
  w.KWallet = { address: null, kind: null, label: () => "", init() {}, subscribe() {}, async send() { throw new Error("no"); } };
  const mounts = [];
  w.KStake = { badge() {}, mount: (root, opts) => { mounts.push({ ...opts }); return {}; } };
  for (const f of ["vhp-standard.js", "bracket-math.js", "bracket.js"]) w.eval(read(f));
  await flush(w);
  assert.ok(mounts.length >= 1, "the Bracket page mounts the stake panel");
  return mounts[mounts.length - 1];
}

test("H1-1 (Low): in Week 1 (vault week 4, practice) the stake panel promises no free prize", async () => {
  const opts = await mountOpts(BM.seedTime(4) + 3 * 3600000, 5);   // Sun 15 Nov, the week of Mon 16 Nov on show
  const line = explain(GAME9, 100000000n, opts);
  assert.doesNotMatch(line, /2 \+ 1 VHP|free players play for/, "practice week, switch off: " + line);
});

test("H1-1: from Week 2 (vault week 5) the stake panel names the free prize", async () => {
  const opts = await mountOpts(BM.seedTime(5) + 3 * 3600000, 5);
  assert.match(explain(GAME9, 100000000n, opts), /free players play for the 2 \+ 1 VHP prize/);
});
