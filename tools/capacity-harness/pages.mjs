#!/usr/bin/env node
/**
 * T3: page call counter (Capacity chat). FAKE CHAIN ONLY.
 * Loads the real Questions page (index.html and its scripts) in a simulated browser on this computer, with a fake
 * Koinos node that counts every call, and reports calls a minute to the node while the tab is visible and while it is
 * hidden. Nothing leaves this computer: the page's fetch only serves files from this folder, every network call in
 * this process is blocked, and it refuses to run if CONFIRM_MAINNET is set.
 *
 *   node tools/capacity-harness/pages.mjs                   the page as it is now (~2.5 minutes)
 *   node tools/capacity-harness/pages.mjs --ref 3d28446     app.js from an older commit (before the polling fix)
 *   node tools/capacity-harness/pages.mjs --live            with the live file switched on and fresh (step A4)
 *   node tools/capacity-harness/pages.mjs --secs 30         shorter windows (default 65 s each)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

if (process.env.CONFIRM_MAINNET) { console.error("CONFIRM_MAINNET is set in this window: refusing to run. Open a new window."); process.exit(2); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SECS = Number(opt("--secs", "65")), REF = opt("--ref", null), LIVE = args.includes("--live");
globalThis.fetch = () => { throw new Error("network calls are blocked (fake chain only)"); };

const read = (f) => (REF && f === "app.js" ? execFileSync("git", ["show", `${REF}:${f}`], { cwd: ROOT, encoding: "utf8" }) : fs.readFileSync(path.join(ROOT, f), "utf8"));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const calls = {};
const count = (k) => { calls[k] = (calls[k] || 0) + 1; };
// Start the fake chain just past the newest published question, so "the last nine days" means what it does live.
let height = (() => {
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "game-data/index.json"), "utf8"));
    const ends = (idx.days || []).slice(-42).flatMap((f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "game-data", f), "utf8")).questions || []; } catch { return []; } }).map((q) => Number(q.windowEnd)).filter(Number.isFinite);
    return ends.length ? Math.max(...ends) + 600 : 50_000_000;
  } catch { return 50_000_000; }
})();
const tick = setInterval(() => { height++; }, 3000);
const SIGNER = "1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz";

const dom = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""), { url: "https://knodegames.com/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
let hidden = false;
Object.defineProperty(w.document, "hidden", { get: () => hidden });
Object.defineProperty(w.document, "visibilityState", { get: () => (hidden ? "hidden" : "visible") });
w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
class Provider {
  async call(method, params) {
    count(`node ${method}`);
    if (method === "chain.get_head_info") return { head_topology: { height: String(height), id: "0x" + height.toString(16).padStart(16, "0") }, head_block_time: String(Date.now()), last_irreversible_block: String(height - 60) };
    if (method === "block_store.get_blocks_by_height") return { block_items: Array.from({ length: Number(params.num_blocks) }, (_, i) => ({ block_height: String(Number(params.ancestor_start_height) + i), block: { header: { signer: SIGNER, timestamp: String(Date.now()) } } })) };
    return {};
  }
  async getHeadInfo() { return this.call("chain.get_head_info", {}); }
}
// Answers shaped like the real game contract's, so the page caches what it really caches: every question is resolved
// (outcome 1) except about one in 25, which is closed and still waiting for its result (outcome 0), as after a round.
class Contract {
  constructor(o) {
    const p = o.provider;
    this.functions = new Proxy({}, { get: (_, name) => async (a = {}) => {
      await p.call("chain.read_contract", {});
      count(`  contract ${String(name)}`);
      if (name === "get_question") { const id = Number(a.id || 0); return { result: { question: { params_hash: "0x" + "11".repeat(32), outcome: id % 25 === 0 ? "0" : "1", lock_time: String(Date.now() - 3_600_000), window_start: "1", window_end: String(height), k: "4", data_hash: "" } } }; }
      return { result: {} };
    } });
  }
}
w.koinos = w.koilib = { Provider, Contract, Signer: class {}, utils: { formatUnits: (x) => String(x), parseUnits: (x) => String(x) } };
w.Response = Response;
w.fetch = async (u) => {
  const url = new URL(String(u), "https://knodegames.com/");
  if (url.href === "https://live.knodegames.com/live.json") {
    count("live file");
    const now = Date.now(), blocks = Array.from({ length: 24 }, (_, i) => ({ h: height - 23 + i, signer: SIGNER, time: now - (23 - i) * 3000 }));
    return new Response(JSON.stringify({ v: 1, at: now, head: { height, id: "0x" + height.toString(16).padStart(16, "0"), time: now }, blocks }), { status: 200 });
  }
  count(url.host === "knodegames.com" ? "file (this site)" : `file ${url.host}`);
  const local = url.host === "knodegames.com" ? path.join(ROOT, decodeURIComponent(url.pathname)) : null;
  if (local && local.startsWith(ROOT) && fs.existsSync(local) && fs.statSync(local).isFile()) return new Response(fs.readFileSync(local), { status: 200 });
  return new Response("{}", { status: 404 });
};
const errs = [];
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)) {
  const src = m[1];
  if (/^https?:/.test(src) || /posthog|analytics/.test(src)) continue;
  let code = read(src);
  if (src === "data-source.js" && LIVE) code = code.replace("var ON = { mirror: false, live: false };", "var ON = { mirror: false, live: true };");
  try { w.eval(code); } catch (e) { errs.push(`${src}: ${e.message}`); }
}
w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const diff = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, (b[k] || 0) - (a[k] || 0)]).filter(([, v]) => v));
const perMin = (d) => Object.values(d).reduce((s, v) => s + v, 0) * 60 / SECS;
console.log(`T3 page call counter: Questions page${REF ? ` (app.js from ${REF})` : ""}${LIVE ? ", live file ON" : ""}; ${SECS} s visible, then ${SECS} s hidden. Fake chain only.`);
await wait(5);
const a = { ...calls }; await wait(SECS); const b = { ...calls };
hidden = true; w.document.dispatchEvent(new w.Event("visibilitychange"));
await wait(2); const c = { ...calls }; await wait(SECS); const d = { ...calls };
const vis = diff(a, b), hid = diff(c, d);
const nodeOnly = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith("node ")));
console.log(`  visible tab: ${perMin(nodeOnly(vis)).toFixed(1)} node calls a minute   ${JSON.stringify(vis)}`);
console.log(`  hidden tab:  ${perMin(nodeOnly(hid)).toFixed(1)} node calls a minute   ${JSON.stringify(hid)}`);
if (errs.length) console.log(`  page script errors: ${errs.slice(0, 3).join(" | ")}`);
clearInterval(tick);
process.exit(0);
