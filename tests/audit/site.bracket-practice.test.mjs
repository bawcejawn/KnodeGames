// Owner 11 Nov: Week 1 (vault week 4, Mon 16 Nov) is practice, and the free prize is OFF. The page says a week before
// index.json's prizesFromWeek is a practice week (no VHP paid), names the first paid week with its date, and says nothing
// once prizes have started. openPage() from site.bracket-repolens-e26.test.mjs, with index.json served when given.
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
const PINNED = "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm";
const ALICE = "1A1iceAAAAAAAAAAAAAAAAAAAAAAAAAAAA", BOB = "1BobBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const seeds = Array.from({ length: 8 }, (_, i) => "1Seed" + "ABCDEFGH"[i] + "x".repeat(28));
const windows = [];
after(() => { for (const w of windows) w.close(); });   // the page's refresh timers would keep the test alive
const flush = async (w, n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => w.setTimeout(r, 0)); };

async function openPage({ now, chainNow = now, picksDeployment = PINNED, index, game, noWeek = false } = {}) {
  const W = 4;   // shown week: seeded Sunday, picks until Monday 23:55
  const weekFile = { v: BM.FILE_V, week: W, start: BM.weekStart(W), end: BM.weekStart(W + 1), status: "open",
    seeding: { at: BM.seedTime(W), cardAt: 1, size: 8, seeds, vhp: seeds.map((_, i) => 8 - i), totalVhp: 36, out: [], outVhp: [], raw: {}, pooled: [], hash: "x" },
    picks: null, days: [[], [], []].map(() => new Array(24).fill(null)), results: null, points: [], staked: null };
  const dom = new JSDOM(read("bracket.html"), { runScripts: "outside-only", url: "https://knodegames.com/bracket.html" });
  const w = dom.window; windows.push(w);
  w.Date.now = () => now;
  const sent = [], picks = [];
  let chainPick = null;
  w.fetch = async (u) => {
    const s = String(u);
    const json = (o) => ({ ok: true, status: 200, json: async () => o });
    if (s.endsWith("picks-data/deployment.json")) return json({ contract: picksDeployment });
    if (s.endsWith("game-data/deployment.json")) return json({ chainId: "x" });
    if (s.endsWith("picks/abi/picks.koilib.json")) return json({ methods: {} });
    if (s.endsWith(`W00${W}.json`) && !noWeek) return json(weekFile);
    if (s.endsWith("bracket/index.json") && index !== undefined) return json(index);
    return { ok: false, status: 404, json: async () => null };
  };
  w.koilib = {
    Provider: class { async getHeadInfo() { return { head_block_time: String(chainNow) }; } },
    Contract: class {
      constructor(o) {
        this.id = o.id;
        this.functions = {
          ...(game === undefined ? {} : { get_game: async () => ({ result: game === null ? {} : { game } }) }),
          get_pick: async () => ({ result: chainPick === null ? {} : { pick: { number: String(chainPick), time: "1" } } }),
          pick: async (args) => { picks.push({ ...args, contract: o.id }); return { operation: { args } }; },
        };
      }
    },
  };
  const listeners = new Set();
  const wallet = { address: ALICE, kind: "kondor" };
  w.KWallet = {
    get address() { return wallet.address; }, get kind() { return wallet.kind; }, label: () => "Kondor",
    init() {}, subscribe: (f) => listeners.add(f),
    async send(what, ops) { sent.push({ what, ops, from: wallet.address }); chainPick = Number(ops[0].args.number); return "0xtx"; },
  };
  for (const f of ["vhp-standard.js", "bracket-math.js", "bracket.js"]) w.eval(read(f));
  await flush(w, 20);
  const $ = (id) => w.document.getElementById(id);
  const modal = () => w.document.querySelector(".pk-modal");
  const modalText = () => (modal() && !modal().hidden ? modal().textContent : "");
  const button = (text) => [...w.document.querySelectorAll(".pk-modal button")].find((b) => b.textContent === text);
  return {
    w, $, modal, modalText, button, sent, picks, wallet,
    switchAccount: async (a, notify = true) => { wallet.address = a; if (notify) for (const f of listeners) f(); await flush(w); },
    fill: async () => { $("bk-fill-chalk").click(); await flush(w); },
    review: async () => { $("bk-submit").click(); await flush(w); },
    confirm: async () => { const b = button("Confirm in wallet"); assert.ok(b, "a Confirm button: " + modalText()); b.click(); await flush(w, 30); },
  };
}
const SUNDAY = BM.seedTime(4) + 3 * 3600000;   // the week of Mon 16 Nov (vault week 4 = "Week 1") is on show
const idx = (prizesFromWeek) => ({ v: 1, updated: "2026-11-15T03:00:00.000Z", weeks: [4], contract: PINNED, game: 9, prizesFromWeek });
const note = (p) => p.$("bk-practice");

test("practice notice: Week 1 with prizes from vault week 5 says practice, no VHP, and when staked rewards start", async () => {
  const p = await openPage({ now: SUNDAY, index: idx(5) });
  assert.equal(note(p).hidden, false);
  assert.match(note(p).textContent, /^Week 1 is a practice week: brackets, points and both leaderboards count for fun only, and no VHP is paid for it\. Staked rewards start Week 2, the week of Mon, Nov 23\.$/);
});

test("practice notice: no first paid week set yet says practice too", async () => {
  const p = await openPage({ now: SUNDAY, index: idx(null) });
  assert.equal(note(p).hidden, false);
  assert.match(note(p).textContent, /practice week.*no VHP is paid.*The first paid week will be announced here\./);
});

test("practice notice: hidden once the week on show is a paid week, and when index.json can't be read", async () => {
  const paid = await openPage({ now: SUNDAY, index: idx(4) });
  assert.equal(note(paid).hidden, true);
  const none = await openPage({ now: SUNDAY });
  assert.equal(note(none).hidden, true);
});

// Before picks open (owner 11 Nov: merge Thursday, picks open Sat 14 Nov 9 PM ET = Sun 15 Nov 02:00 UTC, the Picks
// game's ahead of 46 h): the page says when picks open, the bracket can't be filled in or sent, and nothing errors.
const OPEN = BM.seedTime(4) + 2 * 3600000;
// The page shows times in the visitor's own time zone; the expected text is built the same way, so the tests pass in any
// time zone (CI runs in UTC, an ET visitor sees Sat, Nov 14, 9:00 PM EST)
const full = (t) => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
test("an ET visitor sees picks open Sat, Nov 14, 9:00 PM EST", () => {
  const et = (t) => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/New_York" });
  assert.equal(et(OPEN), "Sat, Nov 14, 9:00 PM EST");
  assert.equal(et(BM.seedTime(4)), "Sat, Nov 14, 7:00 PM EST");
  assert.equal(et(BM.lockTime(4)), "Mon, Nov 16, 6:55 PM EST");
});

test("before the seeding (Thursday): the line names the seeding and when picks open; no bracket to send", async () => {
  const p = await openPage({ now: BM.seedTime(4) - 2 * 86400000, noWeek: true, index: idx(5) });
  const line = p.$("week-line").textContent;
  assert.match(line, new RegExp(`^Week 1: the bracket is seeded ${esc(full(BM.seedTime(4)))} \\(in .*\\), and picks open ${esc(full(OPEN))}\\.$`));
  assert.equal(new Date(OPEN).toISOString(), "2026-11-15T02:00:00.000Z");
  assert.equal(p.$("bk-actions").hidden, true, "no Submit");
});

test("seeded but before picks open (Sat 7–9 PM ET): bracket shown read-only, 'Picks open' line, no Submit", async () => {
  const p = await openPage({ now: BM.seedTime(4) + 3600000, index: idx(5) });
  assert.ok(p.$("week-line").textContent.startsWith(`Week 1: 8-producer bracket, seeded. Picks open ${full(OPEN)} (in 1 h 00 min) and lock ${full(BM.lockTime(4))}`), p.$("week-line").textContent);
  assert.equal(p.$("bk-actions").hidden, true, "no Submit before picks open");
  assert.equal(p.w.document.querySelectorAll("#bk-list button").length, 0, "no pick buttons");
  assert.equal(p.modalText(), "", "no error pop-up");
});

test("picks open but the Picks game isn't on chain yet: says so, no Submit; once it's live the bracket opens", async () => {
  const none = await openPage({ now: OPEN + 60000, index: idx(5), game: null });
  assert.match(none.$("week-line").textContent, /Picks open as soon as the Bracket's Picks game is live on the chain \(it isn't yet\)/);
  assert.equal(none.$("bk-actions").hidden, true);
  const live = await openPage({ now: OPEN + 60000, index: idx(5), game: { id: 9, enabled: true } });
  assert.match(live.$("week-line").textContent, /^Week 1: 8-producer bracket\. Picks lock /);
  assert.equal(live.$("bk-actions").hidden, false, "Submit shown once the game is live");
});

test("weeks are named as players know them: vault week 4 is 'Week 1', never 'Week 5'", async () => {
  const p = await openPage({ now: SUNDAY, index: idx(5) });
  assert.match(p.$("week-line").textContent, /^Week 1: /);
  assert.doesNotMatch(p.w.document.body.textContent, /Week 5/);
});

// R-BR-7 (owner 11 Nov): the VHP ruler line, from index.json rulerFrom (the switch the recorder read)
test("ruler line: hidden with the switch unset; the shadow week names the Monday it turns on and the void rule", async () => {
  const unset = await openPage({ now: SUNDAY, index: idx(5) });
  assert.equal(unset.$("bk-ruler").hidden, true);
  const sh = await openPage({ now: SUNDAY, index: { ...idx(5), rulerFrom: 5 } });   // week 4 on show = the shadow week
  const t = sh.$("bk-ruler").textContent;
  assert.equal(sh.$("bk-ruler").hidden, false);
  assert.match(t, /^Shadow week: the VHP ruler runs beside the real results and counts for nothing; from Week 2 \(the week of Mon, Nov 23\) it decides the matchups\./);
  assert.match(t, /void for that day only: it loses its matchup, so a pick on it counts as a loss; if both are void, the day index decides/);
  const later = await openPage({ now: SUNDAY, index: { ...idx(5), rulerFrom: 6 } });
  assert.match(later.$("bk-ruler").textContent, /^From Week 3 \(the week of Mon, Nov 30\) the VHP ruler decides the matchups\./);
  const on = await openPage({ now: SUNDAY, index: { ...idx(5), rulerFrom: 4 } });
  assert.match(on.$("bk-ruler").textContent, /^The VHP ruler decides the matchups \(since Week 1, the week of Mon, Nov 16\)\./);
});
