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

async function openPage({ now, chainNow = now, picksDeployment = PINNED, index } = {}) {
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
    if (s.endsWith(`W00${W}.json`)) return json(weekFile);
    if (s.endsWith("bracket/index.json") && index !== undefined) return json(index);
    return { ok: false, status: 404, json: async () => null };
  };
  w.koilib = {
    Provider: class { async getHeadInfo() { return { head_block_time: String(chainNow) }; } },
    Contract: class {
      constructor(o) {
        this.id = o.id;
        this.functions = {
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
