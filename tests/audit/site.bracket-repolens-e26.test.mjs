// Repo Lens #E-26 (fix-check 4 of the Producer Bracket, PR #186 @ 97eef35b): failing tests for E26-1 and E26-2 (Low).
// They assert the CORRECT behaviour, so they fail on 97eef35b and pass once fixed.
// openPage() copied unchanged from site.bracket-repolens-b15.test.mjs (itself from site.bracket-confirm.test.mjs).
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

async function openPage({ now, chainNow = now, picksDeployment = PINNED } = {}) {
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
const SUNDAY = BM.seedTime(4) + 3 * 3600000;   // picks open

const LOCKS = (p) => Object.keys(p.w.localStorage).filter((k) => k.startsWith("kb-open-request:"));
const copyStorage = (from, to) => { for (const k of Object.keys(from.w.localStorage)) to.w.localStorage.setItem(k, from.w.localStorage.getItem(k)); };

test("E26-1: a review opened in a second tab BEFORE the first tab's request can't be confirmed while that request is open", async () => {
  // Tab B: the player fills and opens "Check your bracket" (no lock exists yet).
  const b = await openPage({ now: SUNDAY });
  await b.fill(); await b.review();
  assert.ok(b.button("Confirm in wallet"), "tab B is showing the review");
  // Tab A: same player sends a bracket; KOIN Vault holds the request waiting for approval (send never returns).
  const a = await openPage({ now: SUNDAY + 60000 });
  a.wallet.kind = "koinvault";
  a.w.KWallet.send = () => new Promise(() => {});
  await a.fill(); await a.review(); await a.confirm();
  assert.equal(LOCKS(a).length, 1, "tab A wrote the lock before asking the wallet");
  copyStorage(a, b);   // the same browser: both tabs see one localStorage
  // Back in tab B, the player clicks Confirm on the review that was already open.
  await b.confirm();
  assert.equal(b.sent.length, 0, "tab B sent a second bracket while tab A's request may still be approved (send() doesn't re-check the lock): " + b.modalText().slice(0, 120));
});

test("E26-2: a KOIN Vault 5xx on the request call isn't a definite answer, so the lock stays", async () => {
  const p = await openPage({ now: SUNDAY });
  p.wallet.kind = "koinvault";
  // wallet.js vaultApi: a gateway/server error after KOIN Vault may already have made the request
  p.w.KWallet.send = async () => { throw Object.assign(new Error("KOIN Vault answered 504"), { status: 504 }); };
  await p.fill(); await p.review(); await p.confirm();
  assert.equal(LOCKS(p).length, 1, "the lock was cleared on a 504, though the request may be open in KOIN Vault: " + p.modalText().slice(0, 120));
  assert.doesNotMatch(p.modalText(), /Bracket not sent/i, "the page told the player nothing was sent");
});
