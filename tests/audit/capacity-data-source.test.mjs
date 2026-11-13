// Capacity A3/A4: data-source.js (mirror for published game files, live file for the block strip).
// Off by default; when on, it only reroutes GitHub raw game-file reads and always falls back to GitHub.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync("data-source.js", "utf8");
const RAW = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/";
function load({ mirror = false, live = false, answer } = {}) {
  const seen = [];
  const window = { fetch: async (u, init) => { seen.push(String(u)); return answer(String(u), init); } };
  const code = SRC.replace(/var ON = \{ mirror: (true|false), live: (true|false) \};/, `var ON = { mirror: ${mirror}, live: ${live} };`);
  vm.runInNewContext(code, { window, Date, Promise, Number, JSON });
  return { window, seen };
}
const resp = (status, body = "{}") => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) });

test("DS-1 shipped switches: mirror on (A3 checked 12 Nov), live off until A4; live() gives null", async () => {
  assert.match(SRC, /var ON = \{ mirror: true, live: false \};/);
  const orig = async () => resp(200);
  const window = { fetch: orig };
  vm.runInNewContext(SRC, { window, Date, Promise, Number, JSON });
  assert.notEqual(window.fetch, orig, "fetch is wrapped for the mirror");
  assert.equal(window.KGData.on.mirror, true);
  assert.equal(window.KGData.on.live, false);
  assert.equal(await window.KGData.live(), null);
});

test("DS-2 mirrorUrl: only allowed branches' .json files", () => {
  const { window } = load({ answer: () => resp(200) });
  const m = window.KGData.mirrorUrl;
  assert.equal(m(RAW + "race-data/board.json"), "https://data.knodegames.com/race-data/board.json");
  assert.equal(m(RAW + "games-data/blockx/W004.json?x=1"), "https://data.knodegames.com/games-data/blockx/W004.json");
  for (const u of [RAW + "main/game-data/deployment.json", RAW + "main/node/one/heal-one-node.ps1", RAW + "race-data/../main/a.json", RAW + "vhp-data/d/1.json", RAW + "testnet-data/x.json", "https://koinos.armana.io/", "game-data/deployment.json", null]) assert.equal(m(u), null, String(u));
});

test("DS-3 mirror on: game files go to the mirror; on failure GitHub as before, mirror skipped 10 minutes; nothing else rerouted", async () => {
  let mirrorUp = true;
  const { window, seen } = load({ mirror: true, answer: (u) => (u.startsWith("https://data.knodegames.com/") ? (mirrorUp ? resp(200) : resp(502)) : resp(200)) });
  await window.fetch(RAW + "race-data/board.json", { cache: "no-cache" });
  assert.deepEqual(seen, ["https://data.knodegames.com/race-data/board.json"]);
  await window.fetch("https://koinos.armana.io/"); await window.fetch("game-data/deployment.json"); await window.fetch(RAW + "main/x.json");
  assert.deepEqual(seen.slice(1), ["https://koinos.armana.io/", "game-data/deployment.json", RAW + "main/x.json"]);
  mirrorUp = false; seen.length = 0;
  const r = await window.fetch(RAW + "names-data/names.json");
  assert.equal(r.status, 200);
  assert.deepEqual(seen, ["https://data.knodegames.com/names-data/names.json", RAW + "names-data/names.json"]);
  seen.length = 0;
  await window.fetch(RAW + "names-data/names.json");
  assert.deepEqual(seen, [RAW + "names-data/names.json"]);
});

test("DS-4 mirror on: a network error falls back to GitHub; a 404 passes through (GitHub would say the same)", async () => {
  const { window, seen } = load({ mirror: true, answer: (u) => { if (u.includes("data.knodegames.com/race")) throw new Error("dns"); if (u.includes("data.knodegames.com")) return resp(404); return resp(200); } });
  assert.equal((await window.fetch(RAW + "games-data/missing.json")).status, 404);
  assert.equal((await window.fetch(RAW + "race-data/board.json")).status, 200);
  assert.deepEqual(seen, ["https://data.knodegames.com/games-data/missing.json", "https://data.knodegames.com/race-data/board.json", RAW + "race-data/board.json"]);
});

test("DS-5 live on: a fresh file is used and reused for 3 s; old or broken -> null and the chain for a minute", async () => {
  const now = Date.now();
  const good = { v: 1, at: now, head: { height: 101, id: "0xab", time: now }, blocks: [{ h: 100, signer: "1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz", time: now }, { h: 101, signer: "1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz", time: now }] };
  let body = JSON.stringify(good), n = 0;
  const { window } = load({ live: true, answer: () => { n++; return resp(200, body); } });
  assert.equal((await window.KGData.live()).head.height, 101);
  assert.equal((await window.KGData.live()).head.height, 101);
  assert.equal(n, 1);
  const old = load({ live: true, answer: () => resp(200, JSON.stringify({ ...good, at: now - 60_000 })) });
  assert.equal(await old.window.KGData.live(), null);
  const broken = load({ live: true, answer: () => resp(200, JSON.stringify({ ...good, blocks: [{ h: 5, signer: "x" }] })) });
  assert.equal(await broken.window.KGData.live(), null);
  let m = 0; const down = load({ live: true, answer: () => { m++; throw new Error("offline"); } });
  assert.equal(await down.window.KGData.live(), null);
  assert.equal(await down.window.KGData.live(), null);
  assert.equal(m, 1);
});

test("DS-6 every page with a CSP loads data-source.js before its other scripts and allows both addresses", () => {
  for (const p of fs.readdirSync(".").filter((f) => f.endsWith(".html"))) {
    const h = fs.readFileSync(p, "utf8");
    if (!/connect-src/.test(h) || /<meta name="kg-network" content="testnet">/.test(h)) continue;   // testnet pages never use the mainnet mirror
    const srcs = [...h.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(srcs[0], "data-source.js", `${p}: first script`);
    const conn = h.match(/connect-src ([^;"]*)/)[1].split(/\s+/);
    assert.ok(conn.includes("https://data.knodegames.com/"), `${p}: connect-src mirror`);
    assert.ok(conn.includes("https://live.knodegames.com/live.json"), `${p}: connect-src live`);
  }
});

test("DS-7 the Questions strip and Block X use the live file first and fall back to the node", () => {
  const app = fs.readFileSync("app.js", "utf8"), bx = fs.readFileSync("blockx.js", "utf8");
  assert.match(app, /else if \(window\.KGData && \(lv = await window\.KGData\.live\(\)\)\) \{/);
  assert.match(app, /\} else \{\n\s+const head = await S\.provider\.getHeadInfo\(\);/);
  assert.match(bx, /const lv = !TESTNET && window\.KGData \? await window\.KGData\.live\(\) : null;/);
  assert.match(bx, /const h = await provider\.getHeadInfo\(\);/);
});

test("DS-8 (G31-1) a stuck node's file looks stale even though it was uploaded just now", async () => {
  const now = Date.now();
  const stuck = { v: 1, at: now, head: { height: 101, id: "0xab", time: now - 45_000 }, blocks: [{ h: 101, signer: "1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz", time: now - 45_000 }] };
  const { window } = load({ live: true, answer: () => resp(200, JSON.stringify(stuck)) });
  assert.equal(await window.KGData.live(), null);
  const ok = load({ live: true, answer: () => resp(200, JSON.stringify({ ...stuck, head: { ...stuck.head, time: now - 5_000 } })) });
  assert.equal((await ok.window.KGData.live()).head.height, 101);
});
