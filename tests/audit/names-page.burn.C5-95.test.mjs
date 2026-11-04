// tests/audit/names-page.burn.C5-95.test.mjs   (node --test)   Repo Lens #C-5, PR #95 findings N95-1..N95-4
// Runs names-page.js + names.html in jsdom with real koilib encoding and a fake Nicknames chain (only the owner can burn).
// Needs jsdom as a devDependency (npm i -D --save-exact jsdom@24.1.3). Written, not run here; adapted from the reviewer's
// harness, which reproduced each failure on 2926f95.
import { test } from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const koilib = require("koilib");
const { Serializer, utils } = koilib;
const ser = new Serializer(utils.nicknamesAbi.koilib_types);
const EP = Object.fromEntries(Object.entries(utils.nicknamesAbi.methods).map(([k, m]) => [m.entry_point, [k, m]]));
const hex = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const nameOf = (h) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const A = "17KkUk7RiLjwDCeXKQdLCVpntJC1YQNu1Y", B = "1H72X7JdkSL4m4GYzGJxetZokgoU7U4c77";

function makeChain() {
  const C = { owner: {}, main: {}, rpcDown: false };
  C.provider = { async readContract({ entry_point, args }) {
    const [m, def] = EP[entry_point];
    if (C.rpcDown) throw new Error("fetch failed");
    const a = await ser.deserialize(args, def.argument);
    let out = {};
    if (m === "get_main_token") { const n = C.main[a.value]; out = n ? { token_id: hex(n) } : {}; }
    else if (m === "get_tokens_by_address") out = { token_ids: Object.keys(C.owner).filter((n) => C.owner[n] === a.address).map(hex) };
    else if (m === "get_address") { const o = C.owner[a.value]; if (!o) throw new Error('{"message":"nickname does not exist"}'); out = { value: o }; }
    return { result: utils.encodeBase64url(await ser.serialize(out, def.return)) };
  } };
  C.apply = async (from, op) => {   // an owner-only NFT: anyone else's burn reverts
    const [m, def] = EP[op.call_contract.entry_point];
    const n = nameOf((await ser.deserialize(op.call_contract.args, def.argument)).token_id);
    if (C.owner[n] !== from) return { reverted: true };
    if (m === "burn") { delete C.owner[n]; if (C.main[from] === n) delete C.main[from]; }
    if (m === "set_main_token") C.main[from] = n;
    return { reverted: false };
  };
  return C;
}
async function boot(chain, wallet) {
  const html = fs.readFileSync(path.join(ROOT, "names.html"), "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");
  const w = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/names.html" }).window;
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.fetch = async () => ({ json: async () => ({ rpc: "https://rpc.test" }) });
  w.koilib = { ...koilib, Provider: function () { return chain.provider; } };
  w.KNames = { rules: { okNick: () => true }, short: (a) => a.slice(0, 6), load() {}, setLocal() {} };
  const listeners = new Set(); wallet.sent = [];
  w.KWallet = { get address() { return wallet.address; }, get kind() { return wallet.kind; }, subscribe: (f) => listeners.add(f), init() {}, connect() {},
    async send(label, ops) { wallet.sent.push({ label, from: wallet.address, ops }); return wallet.onSend ? wallet.onSend(label, ops) : "txid"; } };
  wallet.switchTo = (a, kind = "kondor") => { wallet.address = a; wallet.kind = a ? kind : null; for (const f of listeners) f(); };
  w.setTimeout = (fn, ms) => setTimeout(fn, wallet.fast ? Math.min(ms, wallet.fast) : ms);
  w.eval(fs.readFileSync(path.join(ROOT, "names-page.js"), "utf8"));
  await tick(50);
  return w;
}
const rows = (w) => [...w.document.querySelectorAll("#mine li")];
const btn = (w, n, text) => { const li = rows(w).find((x) => x.querySelector("b")?.textContent === "@" + n); return li && [...li.querySelectorAll("button")].find((b) => b.textContent.includes(text)); };
const msg = (w) => w.document.getElementById("mine-msg").textContent;

test("N95-1: Remove never says \"Done\" when the chain can't be read after the burn", async () => {
  const c = makeChain(); c.owner = { alice: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "kondor", fast: 20, onSend: async () => { c.rpcDown = true; return null; } };
  const w = await boot(c, wal);
  btn(w, "alice", "Remove").click(); btn(w, "alice", "Tap again").click(); await tick(400);
  assert.equal(c.owner.alice, A, "(the name still exists)");
  assert.doesNotMatch(msg(w), /Done/, `page says: ${msg(w)}`);
});
test("N95-2: a burn that reverts because the name moved meanwhile is never reported as removed", async () => {
  const c = makeChain(); c.owner = { alice: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "vault", fast: 20, onSend: async (l, ops) => { await c.apply(A, ops[0]); return "txid"; } };
  const w = await boot(c, wal);
  c.owner.alice = B;   // moved in another tab before the tap: the list is stale
  btn(w, "alice", "Remove").click(); btn(w, "alice", "Tap again").click(); await tick(400);
  assert.doesNotMatch(msg(w), /Done/, `page says: ${msg(w)}`);
});
test("N95-3: after a wallet switch the list never shows (or acts on) the previous wallet's names", async () => {
  const c = makeChain(); c.owner = { alice: A, bob: B }; c.main[A] = "alice"; c.main[B] = "bob";
  const wal = { address: A, kind: "kondor" }; const w = await boot(c, wal);
  c.rpcDown = true; wal.switchTo(B); await tick(80);
  assert.equal(btn(w, "alice", "Remove"), undefined, `wallet B shows A's names: ${rows(w).map((x) => x.textContent).join(" | ")}`);
});
test("N95-4: a double click (two clicks 0 ms apart) never burns", async () => {
  const c = makeChain(); c.owner = { alice: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "kondor" }; const w = await boot(c, wal);
  btn(w, "alice", "Remove").click(); const again = btn(w, "alice", "Tap again"); if (again) again.click();
  await tick(30);
  assert.equal(wal.sent.length, 0, "the second click of a double click sent the burn");
});

// ── Hub additions: the same cases with a real second tap (700 ms after the first), so they reach the burn itself ──
async function tapRemove(w, wal, n) {
  btn(w, n, "Remove").click(); await tick(700); btn(w, n, "Tap again").click(); wal.fast = 20; await tick(600);
}
test("Hub C5-2a: real two-tap Remove, chain unreadable after the burn: not \"Done\"", async () => {
  const c = makeChain(); c.owner = { alice: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "kondor", onSend: async () => { c.rpcDown = true; return null; } };
  const w = await boot(c, wal); await tapRemove(w, wal, "alice");
  assert.equal(wal.sent.length, 1);
  assert.doesNotMatch(msg(w), /Done/, `page says: ${msg(w)}`);
});
test("Hub C5-2b: name moved to another wallet before the second tap: nothing is sent", async () => {
  const c = makeChain(); c.owner = { alice: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "vault", onSend: async (l, ops) => { await c.apply(A, ops[0]); return "txid"; } };
  const w = await boot(c, wal); c.owner.alice = B; await tapRemove(w, wal, "alice");
  assert.equal(wal.sent.length, 0); assert.match(msg(w), /isn't in this wallet/);
});
test("Hub C5-2c: a burn that reverts (KOIN Vault reports nothing) is not \"Done\"", async () => {
  const c = makeChain(); c.owner = { alice: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "vault", onSend: async () => "txid" };   // the wallet says sent, the chain never changes
  const w = await boot(c, wal); await tapRemove(w, wal, "alice");
  assert.equal(wal.sent.length, 1); assert.doesNotMatch(msg(w), /Done/, `page says: ${msg(w)}`);
});
test("Hub C5-2d: a burn that worked says Done, sends the contract's own hex, and clears the list", async () => {
  const c = makeChain(); c.owner = { alice: A, alpha: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "kondor", onSend: async (l, ops) => { await c.apply(A, ops[0]); return "txid"; } };
  const w = await boot(c, wal); await tapRemove(w, wal, "alpha");
  assert.equal(c.owner.alpha, undefined); assert.match(msg(w), /Done: @alpha is removed/);
  assert.equal(btn(w, "alpha", "Remove"), undefined); assert.ok(btn(w, "alice", "Remove"));
});
test("Hub C5-3b: the list is cleared at once on a switch and B's own names show after its read", async () => {
  const c = makeChain(); c.owner = { alice: A, bob: B }; c.main[A] = "alice"; c.main[B] = "bob";
  const wal = { address: A, kind: "kondor" }; const w = await boot(c, wal);
  wal.switchTo(B); assert.equal(rows(w).length, 0, "cleared before B's read finishes"); await tick(80);
  assert.ok(btn(w, "bob", "Remove")); assert.equal(btn(w, "alice", "Remove"), undefined);
  wal.switchTo(null); await tick(30); assert.equal(rows(w).length, 0, "disconnected: no buttons (C5-5)");
});
test("Hub: Make main works and waits for a successful read", async () => {
  const c = makeChain(); c.owner = { alice: A, alpha: A }; c.main[A] = "alice";
  const wal = { address: A, kind: "kondor", fast: 20, onSend: async (l, ops) => { await c.apply(A, ops[0]); return "txid"; } };
  const w = await boot(c, wal); btn(w, "alpha", "Make main").click(); await tick(300);
  assert.equal(c.main[A], "alpha"); assert.match(msg(w), /Done: @alpha is your main/);
});
