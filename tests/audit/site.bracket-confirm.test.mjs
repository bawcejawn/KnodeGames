// Repo Lens #E-3 C-2, L-2, L-13, L-14 (Producer Bracket page): what the page shows is what it signs. Runs the real
// bracket.html + bracket.js in jsdom with a fake wallet (it can switch account and fire its notify), a fake Picks
// contract (records every `pick`) and the recorder's file shape. Behaviour, not regexes.
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

test("C-2: the check pop-up shows the number and account that will be signed; the page behind is inert", async () => {
  const p = await openPage({ now: SUNDAY });
  assert.equal(p.$("bracket-box").hidden, false, "the recorder's v" + BM.FILE_V + " week file is shown (#E-3 H-1)");
  await p.fill(); await p.review();
  const text = p.modalText(), n = Number(text.match(/one number: (\d+)/)[1]);
  assert.match(text, /Check your bracket/); assert.match(text, /Champion: 1 ·/, "chalk: seed 1 champion");
  assert.equal(n, 0, "chalk is the number 0");
  assert.ok(p.w.document.querySelector("main").hasAttribute("inert") && p.w.document.querySelector("header.top").hasAttribute("inert"), "page behind the pop-up is inert");
  await p.confirm();
  assert.equal(p.sent.length, 1); assert.equal(p.picks.length, 1);
  assert.deepEqual({ player: p.picks[0].player, number: p.picks[0].number, game: p.picks[0].game, round: p.picks[0].round, contract: p.picks[0].contract },
    { player: ALICE, number: "0", game: 9, round: String(BM.picksRound(4)), contract: PINNED });
  assert.match(p.modalText(), /Bracket confirmed/); assert.match(p.modalText(), /Champion: 1 ·/, "the final pop-up describes the signed number");
  p.button("Done").click(); await flush(p.w);
  assert.equal(p.w.document.querySelector("main").hasAttribute("inert"), false, "inert lifted once closed");
});

test("C-2: an account switch (with the wallet's notify) while checking closes the check: nothing is signed for the other account", async () => {
  const p = await openPage({ now: SUNDAY });
  await p.fill(); await p.review();
  assert.match(p.modalText(), /Check your bracket/);
  await p.switchAccount(BOB);
  assert.equal(p.modalText(), "", "the check pop-up for the old bracket is gone");
  assert.equal(p.sent.length, 0); assert.equal(p.picks.length, 0);
});

test("C-2: an account switched without a notify, or a bracket changed, is caught at Confirm: nothing is sent", async () => {
  const p = await openPage({ now: SUNDAY });
  await p.fill(); await p.review();
  await p.switchAccount(BOB, false);
  await p.confirm();
  assert.match(p.modalText(), /Your bracket changed/); assert.equal(p.sent.length, 0); assert.equal(p.picks.length, 0);
});

test("L-2: the 2-minute lock guard is checked again at send, on the chain's clock (a slow device clock can't send late)", async () => {
  const lock = BM.lockTime(4);
  const p = await openPage({ now: lock - 10 * 60000, chainNow: lock - 60000 });   // device says 10 min left, chain says 1
  await p.fill(); await p.review();
  assert.match(p.modalText(), /Check your bracket/, "the device clock lets the check open");
  await p.confirm();
  assert.match(p.modalText(), /Too close to the lock/); assert.equal(p.sent.length, 0);
});

test("L-13: a Picks contract other than the pinned mainnet one is never used to sign", async () => {
  const p = await openPage({ now: SUNDAY, picksDeployment: "1EviLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL" });
  await p.fill();
  assert.equal(p.$("bk-submit").disabled, true, "no contract: no submit");
  await p.review();
  assert.equal(p.sent.length, 0); assert.equal(p.picks.length, 0);
});

test("fix-check RC-3: a KOIN Vault request still open is never reported as cancelled, and blocks another send", async () => {
  const p = await openPage({ now: SUNDAY });
  p.w.KWallet.send = async () => { throw new Error("Still waiting in KOIN Vault. Approve or reject it there; don't send it again from here."); };
  await p.fill(); await p.review(); await p.confirm();
  assert.match(p.modalText(), /Still open in your wallet/); assert.doesNotMatch(p.modalText(), /Cancelled|Nothing was sent/);
  p.button("OK").click(); await flush(p.w);
  await p.fill(); await p.review();   // the draft starts again from the chain; filled again, it still can't be sent
  assert.match(p.modalText(), /still open in your wallet/i, "no second send while the first may still be approved");
  assert.equal(p.button("Confirm in wallet"), undefined);
});

test("fix-check 2 W-1: the lock survives a reload, lasts until KOIN Vault's own expiry, and a lost answer locks too", async () => {
  const until = SUNDAY + 45 * 60000;
  const p = await openPage({ now: SUNDAY });
  p.w.KWallet.send = async () => { throw Object.assign(new Error("Still waiting in KOIN Vault. Approve or reject it there; don't send it again from here."), { openUntil: until }); };
  await p.fill(); await p.review(); await p.confirm();
  const key = Object.keys(p.w.localStorage).find((k) => k.startsWith("kb-open-request:"));
  assert.ok(key && key.includes(ALICE), "kept in localStorage for this account");
  assert.equal(Number(p.w.localStorage.getItem(key)), until, "until KOIN Vault's expiry, not a fixed 10 min");
  // a reload: a fresh page in the same browser storage
  const q = await openPage({ now: SUNDAY + 20 * 60000 });
  q.w.localStorage.setItem(key, p.w.localStorage.getItem(key));
  await q.fill(); await q.review();
  assert.match(q.modalText(), /still open in your wallet/i, "a reloaded page still won't send");
  assert.equal(q.button("Confirm in wallet"), undefined);
  // a lost answer ("Failed to fetch") locks as well
  const r = await openPage({ now: SUNDAY });
  r.w.KWallet.send = async () => { throw new TypeError("Failed to fetch"); };
  await r.fill(); await r.review(); await r.confirm();
  assert.match(r.modalText(), /may still go through/);
  r.button("OK").click(); await flush(r.w);
  await r.fill(); await r.review();
  assert.match(r.modalText(), /still open in your wallet/i);
});

test("#B-15 B15-4: the lock is cleared on a definite answer (on the chain, or refused), so the player isn't blocked for nothing", async () => {
  const p = await openPage({ now: SUNDAY });
  await p.fill(); await p.review(); await p.confirm();
  assert.match(p.modalText(), /Bracket confirmed/);
  assert.deepEqual(Object.keys(p.w.localStorage).filter((k) => k.startsWith("kb-open-request:")), [], "cleared after a send that landed");
  const q = await openPage({ now: SUNDAY });
  q.w.KWallet.send = async () => { throw new Error("Rejected in KOIN Vault"); };
  await q.fill(); await q.review(); await q.confirm();
  assert.match(q.modalText(), /Cancelled/);
  assert.deepEqual(Object.keys(q.w.localStorage).filter((k) => k.startsWith("kb-open-request:")), [], "cleared after a rejection");
});
