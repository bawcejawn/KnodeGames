// Capacity steps A3/A4: the Cloudflare Worker "kg-data" (tools/cloudflare/kg-data-worker.js).
// Mirror: same bytes as GitHub raw, one GitHub read per file per 5 minutes, refuses anything that isn't a published
// .json file on an allowed branch. Live file: PUT only with the right token and a well-formed small file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const W = (await import(pathToFileURL(path.resolve("tools/cloudflare/kg-data-worker.js")).href)).default;
function world() {
  const store = new Map(); const ups = [];
  globalThis.caches = { default: { match: async (k) => store.get(k.url)?.clone(), put: async (k, r) => { store.set(k.url, r); } } };
  globalThis.fetch = async (k) => { ups.push(k.url); if (k.url.endsWith("missing.json")) return new Response("x", { status: 404 }); if (k.url.endsWith("down.json")) throw new Error("network"); return new Response(`{"from":"${k.url}"}`, { status: 200 }); };
  const r2 = new Map();
  const env = { LIVE_TOKEN: "s3cret-token-0123456789", LIVE: { put: async (k, v, o) => { r2.set(k, { v, o }); } } };
  const ctx = { waitUntil: (p) => p };
  const go = (u, init = {}) => W.fetch(new Request("https://data.knodegames.com" + u, init), env, ctx);
  return { go, ups, r2, env };
}
const live = (over = {}) => {
  const now = Date.now();
  const blocks = Array.from({ length: 24 }, (_, i) => ({ h: 1000 + i, signer: "1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz", time: now - (23 - i) * 3000 }));
  return { v: 1, at: now, head: { height: 1023, id: "0x" + "ab".repeat(32), time: now }, blocks, ...over };
};

test("CW-1 mirror: same bytes, CORS, and GitHub asked once for many reads (query strings ignored)", async () => {
  const { go, ups } = world();
  const a = await go("/race-data/board.json");
  assert.equal(a.status, 200);
  assert.equal(a.headers.get("access-control-allow-origin"), "*");
  assert.equal(a.headers.get("x-kg-mirror"), "kg-data");
  assert.equal(await a.text(), '{"from":"https://raw.githubusercontent.com/bawcejawn/KnodeGames/race-data/board.json"}');
  for (let i = 0; i < 50; i++) await go(`/race-data/board.json?t=${i}`);
  assert.equal(ups.length, 1);
  const h = await go("/race-data/board.json", { method: "HEAD" });
  assert.equal(h.status, 200); assert.equal(await h.text(), "");
});

test("CW-2 mirror refuses other branches, non-JSON, '..', and writes", async () => {
  const { go, ups } = world();
  for (const u of ["/main/README.md", "/main/game-data/deployment.json", "/race-data/../main/x.json", "/race-data//x.json", "/race-data/x.txt", "/", "/vhp-data/d/1.json"]) assert.equal((await go(u)).status, 404, u);
  assert.equal((await go("/race-data/board.json", { method: "POST", body: "x" })).status, 405);
  assert.equal(ups.length, 0);
});

test("CW-3 mirror passes 404 through and answers 502 (not cached) when GitHub is down", async () => {
  const { go, ups } = world();
  assert.equal((await go("/games-data/missing.json")).status, 404);
  assert.equal((await go("/games-data/down.json")).status, 502);
  assert.equal((await go("/games-data/down.json")).status, 502);
  assert.equal(ups.length, 3);
});

test("CW-4 live file: stored only with the right token and a well-formed body", async () => {
  const { go, r2 } = world();
  const put = (body, tok = "s3cret-token-0123456789") => go("/_live/live.json", { method: "PUT", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  assert.equal((await put(live(), "wrong")).status, 403);
  assert.equal((await put(live(), "")).status, 403);
  assert.equal((await put("not json")).status, 400);
  assert.equal((await put(live({ v: 2 }))).status, 400);
  assert.equal((await put(live({ at: Date.now() - 600_000 }))).status, 400);
  assert.equal((await put({ ...live(), blocks: [] })).status, 400);
  const bad = live(); bad.blocks[3].signer = "<script>"; assert.equal((await put(bad)).status, 400);
  const order = live(); order.blocks[5].h = 999; assert.equal((await put(order)).status, 400);
  assert.equal((await put("x".repeat(40_000))).status, 413);
  assert.equal(r2.size, 0);
  const ok = await put(live());
  assert.equal(ok.status, 200);
  assert.equal(r2.get("live.json").o.httpMetadata.cacheControl, "public, max-age=4");
  assert.equal(JSON.parse(r2.get("live.json").v).head.height, 1023);
  assert.equal((await go("/_live/live.json")).status, 405);
});

test("CW-5 live file not set up: 503, nothing stored", async () => {
  const { go, env } = world();
  delete env.LIVE_TOKEN;
  assert.equal((await go("/_live/live.json", { method: "PUT", headers: { Authorization: "Bearer x" }, body: JSON.stringify(live()) })).status, 503);
});

test("CW-6 (G31-1) the Worker refuses a file whose head block is more than 30 s older than the upload", async () => {
  const { go, r2 } = world();
  const stuck = live(); stuck.head.time = stuck.at - 45_000; stuck.blocks[23].time = stuck.head.time;
  const r = await go("/_live/live.json", { method: "PUT", headers: { Authorization: "Bearer s3cret-token-0123456789" }, body: JSON.stringify(stuck) });
  assert.equal(r.status, 400);
  assert.match(await r.text(), /node stuck/);
  assert.equal(r2.size, 0);
});
