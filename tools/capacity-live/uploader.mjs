#!/usr/bin/env node
/**
 * Knode Games live-file uploader (Capacity step A4). Runs on the owner's PC only.
 *
 * Every 5 seconds it reads the owner's OWN node on this PC (LIVE_RPC, a local address only), builds the small
 * "latest blocks" file (head + the last 24 blocks' signers) and, when there is a new block, sends it to the Cloudflare
 * Worker (LIVE_PUT_URL), which stores it in the free storage bucket; players' pages read it from
 * https://live.knodegames.com/live.json instead of asking a public node. For the live block strip and block counts only:
 * never scores, cards or voids. Nothing connects in to this PC; it only sends out.
 *
 *   node tools/capacity-live/uploader.mjs --dry      read the node once and print the file; sends nothing, no token needed
 *   node tools/capacity-live/uploader.mjs --once     read and send once
 *   node tools/capacity-live/uploader.mjs            read and send for 55 seconds, then stop (the scheduled task starts it
 *                                                    every minute: node/install-live-uploader.ps1)
 *
 * Settings (from .env in the repo folder; only LIVE_* lines are read):
 *   LIVE_RPC      your node's JSON-RPC address on this PC, e.g. http://127.0.0.1:8080 (local addresses only)
 *   LIVE_TOKEN    the long random secret you also saved as the Worker's LIVE_TOKEN secret (never paste it in a chat)
 *   LIVE_PUT_URL  optional; default https://data.knodegames.com/_live/live.json
 * Log: node/live-uploader.log (kept under 200 KB; the token is never written).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_PUT = "https://data.knodegames.com/_live/live.json";
export const N_BLOCKS = 24, EVERY_MS = 5000, RUN_MS = 55_000, CALL_MS = 4000, LOG_MAX = 200 * 1024;
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;

// Only LIVE_* settings are taken from .env; nothing else in that file is read into this program.
export function readSettings(envText = "", env = process.env) {
  const out = {};
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*(LIVE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  for (const k of ["LIVE_RPC", "LIVE_TOKEN", "LIVE_PUT_URL"]) if (env[k]) out[k] = env[k];
  return out;
}

// The node must be on this PC or the home network (so the uploader never leans on a public node).
export function localRpc(u) {
  let url; try { url = new URL(u); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const h = url.hostname.replace(/^\[|\]$/g, "");
  const ok = h === "localhost" || h === "::1" || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "host.docker.internal";
  return ok ? url.href : null;
}
export function putUrl(u = DEFAULT_PUT) {
  let url; try { url = new URL(u); } catch { return null; }
  return url.protocol === "https:" && url.hostname === "data.knodegames.com" && url.pathname === "/_live/live.json" ? url.href : null;
}

async function rpc(fetchImpl, node, method, params) {
  const r = await fetchImpl(node, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(CALL_MS) });
  if (!r.ok) throw new Error(`${method}: node answered ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message || "node error"}`);
  return j.result;
}

// Reads the head and the last 24 blocks; returns the live file (version 1) or throws.
export async function buildLive(fetchImpl, node, now = Date.now()) {
  const head = await rpc(fetchImpl, node, "chain.get_head_info", {});
  const height = Number(head?.head_topology?.height), id = String(head?.head_topology?.id || ""), time = Number(head?.head_block_time);
  if (!Number.isSafeInteger(height) || height < 1 || !/^0x[0-9a-f]{8,}$/i.test(id) || !Number.isSafeInteger(time)) throw new Error("the node's head looks wrong");
  const n = Math.min(N_BLOCKS, height);
  const res = await rpc(fetchImpl, node, "block_store.get_blocks_by_height", { head_block_id: id, ancestor_start_height: String(height - n + 1), num_blocks: n, return_block: true, return_receipt: false });
  const blocks = (res?.block_items || []).map((it) => ({ h: Number(it.block_height), signer: String(it.block?.header?.signer || ""), time: Number(it.block?.header?.timestamp) }))
    .filter((b) => Number.isSafeInteger(b.h) && ADDR.test(b.signer) && Number.isSafeInteger(b.time)).sort((a, b) => a.h - b.h);
  if (!blocks.length || blocks[blocks.length - 1].h !== height) throw new Error("the node didn't return the head block");
  for (let i = 1; i < blocks.length; i++) if (blocks[i].h <= blocks[i - 1].h) throw new Error("blocks out of order");
  return { v: 1, at: now, head: { height, id, time }, blocks };
}

export async function send(fetchImpl, url, token, live) {
  const r = await fetchImpl(url, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(live), signal: AbortSignal.timeout(CALL_MS) });
  if (r.status !== 200) throw new Error(`the Worker answered ${r.status}: ${(await r.text().catch(() => "")).trim().slice(0, 80)}`);
}

function logger(file) {
  return (msg) => {
    const line = `${new Date().toISOString()} ${msg}\n`;
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > LOG_MAX) { const keep = fs.readFileSync(file, "utf8").slice(-LOG_MAX / 2); fs.writeFileSync(file, keep); }
      fs.appendFileSync(file, line);
    } catch { /* logging must never stop the uploader */ }
    if (process.stdout.isTTY) process.stdout.write(line);
  };
}

export async function run({ args = [], settings, fetchImpl = fetch, log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now() }) {
  if (process.env.CONFIRM_MAINNET) throw new Error("CONFIRM_MAINNET is set in this window; the uploader never needs it. Close this window and open a new one.");
  const node = localRpc(settings.LIVE_RPC || "");
  if (!node) throw new Error("LIVE_RPC must be your own node's address on this PC (e.g. http://127.0.0.1:8080) in .env");
  const dry = args.includes("--dry"), once = args.includes("--once") || dry;
  const url = putUrl(settings.LIVE_PUT_URL || DEFAULT_PUT);
  if (!dry && !url) throw new Error(`LIVE_PUT_URL must be ${DEFAULT_PUT}`);
  if (!dry && !(settings.LIVE_TOKEN && settings.LIVE_TOKEN.length >= 32)) throw new Error("LIVE_TOKEN (32+ characters) isn't in .env");
  const end = now() + (once ? 0 : RUN_MS);
  let last = 0, sent = 0, errors = 0;
  do {
    const t0 = now();
    try {
      const live = await buildLive(fetchImpl, node, Date.now());   // the file's own time is always the real clock
      if (dry) { console.log(JSON.stringify(live, null, 1)); return { sent: 0, errors: 0, live }; }
      if (live.head.height !== last) { await send(fetchImpl, url, settings.LIVE_TOKEN, live); last = live.head.height; sent++; }
    } catch (e) { errors++; log(`error: ${e.message}`); if (once) throw e; }
    const wait = EVERY_MS - (now() - t0);
    if (!once && now() + wait < end) await sleep(Math.max(0, wait));
    else break;
  } while (now() < end);
  log(`ok: sent ${sent}, errors ${errors}, last block ${last || "-"}`);
  return { sent, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envFile = path.join(ROOT, ".env");
  const settings = readSettings(fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "");
  const log = logger(path.join(ROOT, "node", "live-uploader.log"));
  run({ args: process.argv.slice(2), settings, log }).then(() => process.exit(0), (e) => { log(`stopped: ${e.message}`); console.error(e.message); process.exit(1); });
}
