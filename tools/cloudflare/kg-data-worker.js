// Knode Games Cloudflare Worker "kg-data" (served at https://data.knodegames.com). Capacity steps A3 and A4.
// Source of truth: this file. To change the live Worker: Cloudflare -> Compute (Workers) -> kg-data -> Edit code ->
// paste this whole file -> Deploy. Steps: docs/capacity/OWNER-STEPS.md. Tests: tests/audit/capacity-worker.test.mjs.
//
// 1. Data mirror (A3). GET or HEAD /<branch>/<file>.json returns the same file, byte for byte, from
//    https://raw.githubusercontent.com/bawcejawn/KnodeGames/<branch>/<file>.json, kept for 5 minutes (the same 5 minutes
//    GitHub's raw server keeps it). Players' pages read game files from here, so GitHub sees about one request per file
//    per 5 minutes per Cloudflare location however many players there are. It never changes a file: pages still show
//    exactly what the recorders published (scores, cards and voids only from the published game files).
// 2. Live chain file (A4). PUT /_live/live.json with "Authorization: Bearer <LIVE_TOKEN>" stores a small "latest
//    blocks" file in the R2 bucket bound as LIVE; players read it from https://live.knodegames.com/live.json (the
//    bucket's own public address, not this Worker). Only the uploader on the owner's PC knows the token. The file is
//    for the live block strip and block counts only, never for scores.
// Refused: other methods and paths, branches not listed, anything but .json, "..", a PUT without the right token or
// with a body that isn't a small, well-formed live file. No keys are kept in this file: LIVE_TOKEN is a Worker secret.
const BRANCHES = new Set(["games-data", "race-data", "blocks-data", "names-data", "stats-data", "prize-settings"]);
const ORIGIN = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/";
const TTL = 300;               // seconds a mirrored file is kept
const LIVE_MAX = 32 * 1024;    // bytes; a real live file is about 3 KB
const LIVE_CACHE = "public, max-age=4";
const HEADERS = { "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;

const text = (body, status, extra = {}) => new Response(body, { status, headers: { ...HEADERS, "Cache-Control": "no-store", ...extra } });

// Same length or not, compare every byte (no early exit), so the token can't be guessed from timing.
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// The live file the uploader writes (tools/capacity-live/uploader.mjs, version 1).
function validLive(o, now = Date.now()) {
  if (!o || typeof o !== "object" || o.v !== 1) return "not a version 1 live file";
  if (!Number.isSafeInteger(o.at) || Math.abs(now - o.at) > 120_000) return "the file's time is more than 2 minutes off";
  const h = o.head;
  if (!h || !Number.isSafeInteger(h.height) || h.height < 1 || typeof h.id !== "string" || !/^0x[0-9a-f]{8,}$/i.test(h.id) || !Number.isSafeInteger(h.time)) return "bad head";
  if (!Array.isArray(o.blocks) || o.blocks.length < 1 || o.blocks.length > 50) return "blocks must be 1 to 50";
  let prev = 0;
  for (const b of o.blocks) {
    if (!b || !Number.isSafeInteger(b.h) || b.h <= prev || b.h > h.height || !ADDR.test(String(b.signer)) || !Number.isSafeInteger(b.time)) return "bad block row";
    prev = b.h;
  }
  if (prev !== h.height) return "the last block must be the head";
  return null;
}

async function putLive(request, env) {
  if (!env || !env.LIVE || !env.LIVE_TOKEN) return text("live file not set up\n", 503);
  const auth = request.headers.get("Authorization") || "";
  if (!sameSecret(auth.replace(/^Bearer\s+/i, ""), env.LIVE_TOKEN)) return text("not allowed\n", 403);
  const len = Number(request.headers.get("Content-Length") || "0");
  if (len > LIVE_MAX) return text("too big\n", 413);
  const body = await request.text();
  if (body.length > LIVE_MAX) return text("too big\n", 413);
  let o;
  try { o = JSON.parse(body); } catch { return text("not JSON\n", 400); }
  const why = validLive(o);
  if (why) return text(why + "\n", 400);
  await env.LIVE.put("live.json", JSON.stringify(o), { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: LIVE_CACHE } });
  return text("ok\n", 200);
}

async function mirror(request, ctx) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/([a-z-]+)\/([A-Za-z0-9_\-\/.]+\.json)$/);
  if (!m || !BRANCHES.has(m[1]) || m[2].includes("..") || m[2].startsWith("/") || m[2].includes("//")) return text("not found\n", 404);
  // One cache entry per file: the query string is ignored, so "?t=..." can't make every visit go to GitHub.
  const key = new Request(ORIGIN + m[1] + "/" + m[2], { method: "GET" });
  const cache = caches.default;
  let res = await cache.match(key);
  if (!res) {
    let up = null;
    try { up = await fetch(key, { cf: { cacheTtl: TTL, cacheEverything: true } }); } catch { up = null; }
    if (!up || !up.ok) return up && up.status === 404 ? text("not found\n", 404) : text("GitHub didn't answer; try again shortly\n", 502);
    res = new Response(up.body, { status: 200, headers: { ...HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${TTL}`, "X-KG-Mirror": "kg-data" } });
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  return request.method === "HEAD" ? new Response(null, { status: res.status, headers: res.headers }) : res;
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/_live/live.json") return request.method === "PUT" ? putLive(request, env) : text("write only\n", 405);
    if (request.method !== "GET" && request.method !== "HEAD") return text("read only\n", 405);
    return mirror(request, ctx);
  },
};
