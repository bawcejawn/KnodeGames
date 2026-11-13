#!/usr/bin/env node
/**
 * T5: the data mirror under load (Capacity chat). FAKE GITHUB ONLY.
 * Runs the real Worker code (tools/cloudflare/kg-data-worker.js) against a simulated crowd: VISITORS page loads spread
 * over one hour, across LOCATIONS Cloudflare locations (each keeps its own copy, 5 minutes, as on Cloudflare), each
 * page load asking for FILES game files. Counts how many requests would reach GitHub. Nothing leaves this computer.
 *
 *   node tools/capacity-harness/mirror-load.mjs                       100,000 page loads, 30 locations, 6 files (~10 s)
 *   node tools/capacity-harness/mirror-load.mjs --visitors 1000000 --locations 60
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (process.env.CONFIRM_MAINNET) { console.error("CONFIRM_MAINNET is set in this window: refusing to run. Open a new window."); process.exit(2); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const VISITORS = opt("--visitors", 100_000), LOCATIONS = opt("--locations", 30), FILES = opt("--files", 6), HOUR = 3_600_000;
const W = (await import(pathToFileURL(path.join(ROOT, "tools/cloudflare/kg-data-worker.js")).href)).default;

let now = 1_800_000_000_000;
const realNow = Date.now; Date.now = () => now;
let github = 0;
globalThis.fetch = async () => { github++; return new Response('{"rows":[]}', { status: 200 }); };
const stores = Array.from({ length: LOCATIONS }, () => new Map());
let here = 0;
globalThis.caches = { default: {
  match: async (k) => { const e = stores[here].get(k.url); return e && e.until > now ? e.res.clone() : undefined; },
  put: async (k, r) => { const age = Number((r.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 0); stores[here].set(k.url, { res: r, until: now + age * 1000 }); },
} };
const files = ["race-data/board.json", "games-data/questions/board.json", "games-data/blockx/board.json", "names-data/names.json", "blocks-data/recent-blocks.json", "stats-data/stats.json", "race-data/W004.json", "games-data/index.json"].slice(0, FILES);
const ctx = { waitUntil: (p) => p };
const t0 = realNow();
let served = 0, bad = 0;
for (let v = 0; v < VISITORS; v++) {
  now = 1_800_000_000_000 + Math.floor((v / VISITORS) * HOUR);
  here = v % LOCATIONS;
  for (const f of files) { const r = await W.fetch(new Request(`https://data.knodegames.com/${f}`), {}, ctx); served++; if (r.status !== 200) bad++; await r.arrayBuffer(); }
}
Date.now = realNow;
const most = LOCATIONS * files.length * Math.ceil(HOUR / 300_000);
console.log(`T5 data mirror under load: ${VISITORS.toLocaleString()} page loads in one hour, ${LOCATIONS} Cloudflare locations, ${files.length} files each (fake GitHub).`);
console.log(`  requests served by the mirror: ${served.toLocaleString()} (${bad} not 200)`);
console.log(`  requests that reached GitHub:  ${github.toLocaleString()} (at most ${most.toLocaleString()} = locations x files x 12 refreshes an hour; without the mirror: ${served.toLocaleString()})`);
console.log(`  GitHub load cut by ${(served / Math.max(1, github)).toFixed(0)}x; ${((realNow() - t0) / 1000).toFixed(1)} s here.`);
