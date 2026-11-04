// The staking hub (stake.html + stake-page.js) as a player sees it (owner, 2026-11-03: "clear and easy to understand
// exactly what I'm doing, where I'm staked and how much", with Claim next to Stake and Withdraw).
// Runs the real page script in jsdom with the real number/date helpers from stake-panel.js and a fake vault overview;
// K.send is recorded, never sent.
import { test, after } from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const { JSDOM } = createRequire(import.meta.url)("jsdom");
const U = 100000000n;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const open = [];
after(() => { for (const w of open) w.close(); });

function data(over = {}) {
  const g = (id, name, o) => ({ id, name, active: true, total: 0n, mine: 0n, counted: 0n, pending: 0n, pendingFrom: "", share: 0, staked: false, claims: [], last: null, ...o });
  return {
    live: true, week: 2n, config: { genesis_time: "1792368000000", week_length: "604800000" }, paused: false, min: U,
    wallet: { vhp: 42n * U, koin: 0n },
    games: [
      g(7, "Producer Race", { total: 500n * U, mine: 20n * U, counted: 15n * U, pending: 5n * U, pendingFrom: "Mon 9 Nov", share: 0.04, staked: true, claims: [{ week: 1n, reward: 75000000n }], last: 120000000n }),
      g(1, "Daily Questions", { total: 120n * U, mine: 10n * U, counted: 10n * U, share: 0.083, staked: true }),
      g(2, "Who Signs Block X", { total: 80n * U, last: 90000000n }),
    ],
    ...over,
  };
}
async function boot(d, { address = "1Abc", kind = "kondor" } = {}) {
  const html = fs.readFileSync(path.join(ROOT, "stake.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");
  const w = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/stake.html" }).window;
  open.push(w);
  w.fetch = async () => ({ json: async () => ({}) });
  w.KWallet = { address, kind, label: () => "Kondor", subscribe() {}, connect() {}, init() {} };
  w.eval(fs.readFileSync(path.join(ROOT, "stake-panel.js"), "utf8"));
  const sent = [];
  Object.assign(w.KStake, { overview: async () => d, send: async (action, a) => { sent.push({ action, a }); return "tx"; }, wallet: () => w.KWallet, badge() {} });
  w.eval(fs.readFileSync(path.join(ROOT, "stake-page.js"), "utf8"));
  await tick();
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
  // The words a player reads, one space between pieces (headings, numbers and buttons are separate elements).
  const text = (s) => { const n = $(s); if (!n) return ""; const out = [], it = w.document.createTreeWalker(n, 4); while (it.nextNode()) { const t = it.currentNode.textContent.trim(); if (t) out.push(t); } return out.join(" ").replace(/\s+/g, " ").replace(/ ([.,:])/g, "$1"); };
  const button = (scope, label) => [...(typeof scope === "string" ? $(scope) : scope).querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(label));
  const type = (v) => { const i = $("#hub-amt"); i.value = v; i.dispatchEvent(new w.Event("input")); };
  return { w, $, $$, text, button, type, sent };
}

test("summary: total staked, where, what's earning, wallet, and rewards with one Claim all", async () => {
  const p = await boot(data());
  const s = p.text(".hub-sum");
  assert.match(s, /You have staked 30 VHP in 2 games · 25 VHP earning this week/);
  assert.match(s, /In your wallet 42 VHP/);
  assert.match(s, /Rewards to claim 0\.75 VHP Claim all/);
  p.button(".hub-sum", "Claim all").click(); await tick();
  assert.deepEqual(p.sent.map((x) => x.action), ["claim"]);
  assert.deepEqual(p.sent[0].a.claims.map((c) => [c.game, String(c.week)]), [[7, "1"]]);
  assert.match(p.text("#hub-receipt"), /✓ Claimed 0\.75 VHP From Producer Race\. It's in your wallet\./);
});

test("where you're staked: each game with the amount, its share and whether it's earning, in plain words", async () => {
  const p = await boot(data());
  const race = p.text("#g7"), dq = p.text("#g1");
  assert.match(race, /Producer Race Earning this week · 5 VHP more starts Mon 9 Nov 20 VHP 4% of 500 VHP/);
  assert.match(race, /\+ Add Withdraw Move Claim 0\.75 VHP/);
  assert.match(dq, /Daily Questions Earning this week 10 VHP/);
  assert.match(dq, /Add, withdraw or claim on Daily Questions →/, "Daily Questions is managed on its own page");
  assert.ok(p.$("#g7").classList.contains("mine") && p.$("#g7").classList.contains("on"));
  const heads = p.$$("#hub-body h2").map((h) => h.textContent);
  assert.deepEqual(heads, ["Where you're staked", "Stake in another game"]);
  assert.match(p.text("#g2"), /Who Signs Block X Last week paid 0\.9 VHP per 100 staked 80 VHP staked by everyone Stake/);
});

test("a stake that hasn't started yet says the Monday it starts earning", async () => {
  const d = data(); Object.assign(d.games[0], { staked: false, counted: 0n, pending: 20n * U, pendingFrom: "Mon 9 Nov" });
  const p = await boot(d);
  assert.match(p.text("#g7"), /Starts earning Mon 9 Nov/);
  assert.ok(p.$("#g7").classList.contains("wait"));
});

test("Add: step 1 amount, then a sentence saying exactly what happens, then a button naming the amount", async () => {
  const p = await boot(data());
  p.button("#g7", "+ Add").click();
  assert.match(p.text("#g7 .hub-form"), /Add to Producer Race/);
  assert.match(p.text("#g7 .hub-form"), /Step 1: how much\? In your wallet: 42 VHP/);
  p.type("10");
  assert.match(p.text("#hub-review"), /You'll stake 10 VHP in Producer Race\. Your stake in Producer Race becomes 30 VHP: 5\.9% of the game\. It starts earning Mon 9 Nov\. You can withdraw any time\./);
  const go = p.button("#g7 .hub-form", "Stake 10 VHP");
  assert.ok(go && !go.disabled);
  go.click(); await tick();
  assert.equal(p.sent.length, 1);
  assert.equal(p.sent[0].action, "stake");
  assert.deepEqual([p.sent[0].a.game, String(p.sent[0].a.units), p.sent[0].a.koin], [7, String(10n * U), false]);
  assert.match(p.text("#hub-receipt"), /✓ Staked 10 VHP in Producer Race It starts earning Mon 9 Nov\./);
  assert.equal(p.$("#g7 .hub-form"), null, "the box closes after it's sent");
});

test("Add refuses decimals and more than the wallet holds, and sends nothing", async () => {
  const p = await boot(data());
  p.button("#g7", "+ Add").click();
  p.type("2.5"); assert.match(p.text("#hub-review"), /Stakes are whole numbers/);
  assert.ok(p.button("#g7 .hub-form", "Stake").disabled);
  p.type("43"); assert.match(p.text("#hub-review"), /You only have 42 VHP in your wallet\./);
  assert.ok(p.button("#g7 .hub-form", "Stake").disabled);
  assert.equal(p.sent.length, 0);
});

test("Withdraw: says what stays staked; below the minimum it warns before anything is sent (I-028)", async () => {
  const p = await boot(data());
  p.button("#g7", "Withdraw").click();
  p.type("15");
  assert.match(p.text("#hub-review"), /You'll take 15 VHP out of Producer Race, straight back to your wallet, right now\. 5 VHP stays staked in Producer Race\./);
  assert.doesNotMatch(p.text("#hub-review"), /Heads up/);
  p.type("19.5");
  assert.match(p.text("#hub-review"), /Heads up: this leaves less than 1 VHP in Producer Race, so you get no share of its rewards this week and no free prize\./);
  p.type("21"); assert.match(p.text("#hub-review"), /You only have 20 VHP staked in Producer Race\./);
  p.type("20"); assert.match(p.text("#hub-review"), /Nothing stays staked in Producer Race\./);
  p.button("#g7 .hub-form", "Withdraw 20 VHP").click(); await tick();
  assert.deepEqual([p.sent[0].action, p.sent[0].a.game, String(p.sent[0].a.units)], ["withdraw", 7, String(20n * U)]);
});

test("Move: pick the game, then the sentence names both games; Daily Questions is never a target", async () => {
  const p = await boot(data());
  p.button("#g7", "Move").click();
  const to = [...p.$$("#g7 .hub-to .chip")].map((b) => b.textContent);
  assert.deepEqual(to, ["Who Signs Block X"]);
  p.type("5"); assert.match(p.text("#hub-review"), /Pick the game to move it to\./);
  p.$("#g7 .hub-to .chip").click(); p.type("5");
  assert.match(p.text("#hub-review"), /You'll move 5 VHP from Producer Race to Who Signs Block X\. No tokens leave the vault\. It starts earning in Who Signs Block X Mon 9 Nov\./);
  p.button("#g7 .hub-form", "Move 5 VHP").click(); await tick();
  assert.deepEqual([p.sent[0].action, p.sent[0].a.game, p.sent[0].a.to], ["move", 7, 2]);
});

test("a new player: no 'Where you're staked', every game offered, Next payout shown", async () => {
  const d = data(); for (const g of d.games) Object.assign(g, { mine: 0n, staked: false, pending: 0n, claims: [], share: 0 });
  const p = await boot(d);
  assert.match(p.text(".hub-sum"), /You have staked 0 VHP Nothing staked yet: pick a game below\./);
  assert.match(p.text(".hub-sum"), /Rewards to claim 0 VHP Next payout Mon 9 Nov/);
  assert.deepEqual(p.$$("#hub-body h2").map((h) => h.textContent), ["Pick a game to stake in"]);
  assert.equal(p.$$("#hub-body .hub-row").length, 3);
});

test("not connected or a guest: a Connect button and the three steps, no stake buttons", async () => {
  for (const who of [{ address: null }, { address: "1Guest", kind: "guest" }]) {
    const p = await boot(data(), who);
    assert.match(p.text(".hub-connect"), /Pick a game.*Stake VHP.*Claim your rewards each week/);
    assert.ok(p.button(".hub-connect", "Connect wallet"));
    assert.equal(p.$$("#hub-body .hub-btns").length, 0);
  }
});

test("paused: no Add or Stake buttons; Withdraw and Claim stay", async () => {
  const p = await boot(data({ paused: true }));
  assert.equal(p.button("#g7", "+ Add"), undefined);
  assert.ok(p.button("#g7", "Withdraw") && p.button("#g7", "Claim"));
  assert.equal(p.button("#g2", "Stake"), undefined);
  assert.match(p.text("#hub-top"), /New stakes are paused right now\. Withdrawals and claims always work\./);
});

test("more than 10 rewards: one transaction claims the first 10", async () => {
  const d = data(); d.games[0].claims = Array.from({ length: 12 }, (_, i) => ({ week: BigInt(i), reward: U }));
  const p = await boot(d);
  p.button(".hub-sum", "Claim (10 at a time)").click(); await tick();
  assert.equal(p.sent[0].a.claims.length, 10);
  assert.match(p.text("#hub-receipt"), /2 more to claim: tap Claim again\./);
});
