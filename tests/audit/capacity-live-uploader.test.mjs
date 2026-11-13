// Capacity A4: tools/capacity-live/uploader.mjs (owner's PC) end to end with the real Worker code
// (tools/cloudflare/kg-data-worker.js) and the page reader (data-source.js): what the uploader writes, the Worker
// accepts and the pages use.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { pathToFileURL } from "node:url";

const U = await import(pathToFileURL(path.resolve("tools/capacity-live/uploader.mjs")).href);
const W = (await import(pathToFileURL(path.resolve("tools/cloudflare/kg-data-worker.js")).href)).default;
const TOKEN = "t".repeat(40);
const SIGNER = "1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz";

function chain(height = 5000) {
  const node = { height, calls: 0 };
  node.fetch = async (url, init) => {
    if (url.startsWith("https://data.knodegames.com/")) return W.fetch(new Request(url, init), env, { waitUntil: (p) => p });
    node.calls++;
    const { method, params } = JSON.parse(init.body);
    if (method === "chain.get_head_info") return Response.json({ result: { head_topology: { height: String(node.height), id: "0x" + "cd".repeat(32) }, head_block_time: String(Date.now()) } });
    if (method === "block_store.get_blocks_by_height") {
      const from = Number(params.ancestor_start_height);
      return Response.json({ result: { block_items: Array.from({ length: params.num_blocks }, (_, i) => ({ block_height: String(from + i), block: { header: { signer: SIGNER, timestamp: String(Date.now() - (params.num_blocks - i) * 3000) } } })) } });
    }
    return Response.json({ error: { message: "no" } });
  };
  const r2 = new Map();
  const env = { LIVE_TOKEN: TOKEN, LIVE: { put: async (k, v, o) => r2.set(k, { v, o }) } };
  return { node, r2 };
}

test("LU-1 settings: only LIVE_* lines are read from .env", () => {
  const s = U.readSettings("OWNER_KEY=5Jabc\nLIVE_RPC=http://127.0.0.1:8080\nLIVE_TOKEN=\"abc\"\nGITHUB_ALERT_TOKEN=x\n", {});
  assert.deepEqual(s, { LIVE_RPC: "http://127.0.0.1:8080", LIVE_TOKEN: "abc" });
});

test("LU-2 only a local node and only our Worker address are accepted", () => {
  for (const ok of ["http://127.0.0.1:8080", "http://localhost:8080/", "http://192.168.1.20:8080", "http://10.0.0.5:8080", "http://172.20.0.2:8080"]) assert.ok(U.localRpc(ok), ok);
  for (const no of ["https://koinos.armana.io", "http://8.8.8.8:8080", "ftp://127.0.0.1", "nonsense", "http://172.40.0.1:8080"]) assert.equal(U.localRpc(no), null, no);
  assert.ok(U.putUrl());
  for (const no of ["http://data.knodegames.com/_live/live.json", "https://evil.example/_live/live.json", "https://data.knodegames.com/other"]) assert.equal(U.putUrl(no), null, no);
});

test("LU-3 the file the uploader builds is accepted by the Worker and used by the pages", async () => {
  const { node, r2 } = chain(5000);
  const res = await U.run({ args: ["--once"], settings: { LIVE_RPC: "http://127.0.0.1:8080", LIVE_TOKEN: TOKEN }, fetchImpl: node.fetch });
  assert.equal(res.sent, 1);
  const stored = JSON.parse(r2.get("live.json").v);
  assert.equal(stored.head.height, 5000);
  assert.equal(stored.blocks.length, 24);
  assert.equal(stored.blocks[23].h, 5000);
  // The page side (data-source.js, live switch on) accepts exactly this file.
  const code = fs.readFileSync("data-source.js", "utf8").replace(/var ON = \{ mirror: (true|false), live: (true|false) \};/, "var ON = { mirror: false, live: true };");
  const window = { fetch: async () => ({ ok: true, status: 200, json: async () => stored }) };
  vm.runInNewContext(code, { window, Date, Promise, Number, JSON });
  assert.equal((await window.KGData.live()).head.height, 5000);
});

test("LU-4 the loop sends only when there is a new block and stops after 55 s", async () => {
  const { node, r2 } = chain(7000);
  let t = 1_800_000_000_000, sleeps = 0, puts = 0;
  const f = async (u, i) => { if (u.startsWith("https://data")) puts++; return node.fetch(u, i); };
  const sleep = async (ms) => { t += ms; sleeps++; if (sleeps % 2 === 0) node.height++; };
  const res = await U.run({ args: [], settings: { LIVE_RPC: "http://127.0.0.1:8080", LIVE_TOKEN: TOKEN }, fetchImpl: f, sleep, now: () => t });
  assert.equal(res.errors, 0);
  assert.ok(sleeps >= 9 && sleeps <= 11, `ran about 55 s of 5 s steps (${sleeps})`);
  assert.equal(res.sent, puts);
  assert.ok(res.sent < sleeps + 1, "not every step sends: only new blocks");
  const stored = JSON.parse(r2.get("live.json").v).head.height;
  assert.ok(stored > 7000 && stored <= node.height, `the newest block was sent (${stored})`);
});

test("LU-5 refuses to start without a local node or a token; --dry needs no token and sends nothing", async () => {
  await assert.rejects(U.run({ args: [], settings: { LIVE_RPC: "https://koinos.armana.io", LIVE_TOKEN: TOKEN } }), /LIVE_RPC/);
  await assert.rejects(U.run({ args: [], settings: { LIVE_RPC: "http://127.0.0.1:8080", LIVE_TOKEN: "short" } }), /LIVE_TOKEN/);
  const { node, r2 } = chain(42);
  const log = console.log; let out = ""; console.log = (s) => { out += s; };
  try { await U.run({ args: ["--dry"], settings: { LIVE_RPC: "http://127.0.0.1:8080" }, fetchImpl: node.fetch }); } finally { console.log = log; }
  assert.equal(JSON.parse(out).head.height, 42);
  assert.equal(JSON.parse(out).blocks.length, 24);
  assert.equal(r2.size, 0);
});

test("LU-6 the uploader source never prints or logs the token", () => {
  const src = fs.readFileSync("tools/capacity-live/uploader.mjs", "utf8");
  assert.doesNotMatch(src, /log\([^)]*LIVE_TOKEN/);
  assert.doesNotMatch(src, /console\.(log|error)\([^)]*(LIVE_TOKEN|token)/);
});

test("LU-7 (G31-1) the uploader sends nothing when its node's newest block is more than 30 s old", async () => {
  const { node, r2 } = chain(9000);
  const stale = async (u, i) => {
    const r = await node.fetch(u, i);
    if (u.startsWith("https://data")) return r;
    const j = await r.json();
    if (j.result && j.result.head_block_time) j.result.head_block_time = String(Date.now() - 60_000);
    return Response.json(j);
  };
  await assert.rejects(U.run({ args: ["--once"], settings: { LIVE_RPC: "http://127.0.0.1:8080", LIVE_TOKEN: TOKEN }, fetchImpl: stale }), /looks stuck/);
  assert.equal(r2.size, 0);
});
