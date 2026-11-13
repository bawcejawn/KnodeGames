#!/usr/bin/env node
/**
 * File sizer for any game file, old format or new (Capacity chat). FAKE ROWS ONLY; reads one sample file, writes nothing.
 * Give it a real or sample file and the list(s) that grow with players; it clones a row from that list with fresh fake
 * addresses, and reports the fixed part, bytes per player, the size at each player count, and the players that fit
 * under the publish cap (2 MB) and the 60% warning (1.2 MB). Use it for the "before" and the "after" of a format change.
 *
 *   node tools/capacity-harness/filesize.mjs --file <file.json> --rows <path> [--each 28] [--table <path>] [--sizes 1000,10000,100000]
 *   node tools/capacity-harness/filesize.mjs --git origin/race-data:W003.json --rows "races[*].result.picks" --each 28
 *
 *   --rows   where the per-player rows live: dotted path, [*] = every element ("races[*].result.picks", "rows", "parts[*].p")
 *   --each   rows per player (e.g. 28 races a week each picked once); default 1
 *   --table  (compact formats) an address table that gets one new address per new player ("players")
 *   --file / --git   a file on disk, or a git object like origin/race-data:W003.json (read-only)
 * Rows are spread over every matching list in turn. In a cloned row the template row's first address is replaced by the
 * new player's fake address; numbers are left as they are (for compact rows the index digits differ by a byte or two).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CAP = 2 * 1024 * 1024, WARN = Math.round(0.6 * CAP);
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const fake = (i) => { const h = crypto.createHash("sha256").update(`fs${i}`).digest(); let s = "1"; for (let k = 0; k < 33; k++) s += B58[h[k % 32] % 58]; return s; };
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const src = opt("--git") ? execFileSync("git", ["show", opt("--git")], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }) : opt("--file") ? fs.readFileSync(opt("--file"), "utf8") : null;
const rowsPath = opt("--rows");
if (!src || !rowsPath) { console.error("needs --file <file> (or --git <ref:path>) and --rows <path>. See the top of this file."); process.exit(2); }
const EACH = Number(opt("--each", "1")), TABLE = opt("--table"), SIZES = (opt("--sizes", "1000,10000,100000")).split(",").map(Number);
const base = JSON.parse(src);

// Every array the path points at ("a[*].b" = the b array of every element of a).
function lists(root, p) {
  let cur = [root];
  for (const seg of p.split(".")) {
    const all = seg.endsWith("[*]"), key = all ? seg.slice(0, -3) : seg;
    cur = cur.flatMap((o) => { const v = o == null ? undefined : (key ? o[key] : o); return all ? (Array.isArray(v) ? v : []) : v === undefined ? [] : [v]; });
  }
  return cur.filter(Array.isArray);
}
const firstAddr = (o) => { if (typeof o === "string") return ADDR.test(o) ? o : null; if (o && typeof o === "object") for (const v of Object.values(o)) { const a = firstAddr(v); if (a) return a; } return null; };
const swap = (o, from, to) => (typeof o === "string" ? (o === from ? to : o) : Array.isArray(o) ? o.map((v) => swap(v, from, to)) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, swap(v, from, to)])) : o);

const tpl = lists(base, rowsPath).find((l) => l.length)?.[0];
if (tpl === undefined) { console.error(`no rows found at "${rowsPath}" in this file (need at least one row to copy)`); process.exit(2); }
const who = firstAddr(tpl);
function build(players) {
  const f = structuredClone(base);
  const ls = lists(f, rowsPath);
  ls.forEach((l) => { l.length = 0; });
  const tbl = TABLE ? lists(f, TABLE)[0] : null;
  if (tbl) tbl.length = 0;
  let k = 0;
  for (let p = 0; p < players; p++) {
    const a = fake(p);
    if (tbl) tbl.push(a);
    const row = who ? swap(tpl, who, a) : tpl;
    for (let e = 0; e < EACH; e++) ls[k++ % ls.length].push(row);
  }
  return Buffer.byteLength(JSON.stringify(f) + "\n");
}
const b1 = build(100), b2 = build(1000), per = (b2 - b1) / 900, fixed = b1 - 100 * per;
const fit = (cap) => Math.max(0, Math.floor((cap - fixed) / per));
console.log(`File sizer: ${opt("--git") || opt("--file")}; rows "${rowsPath}" x ${EACH} a player${TABLE ? `, table "${TABLE}"` : ""} (fake rows).`);
console.log(`  this file as published: ${kb(Buffer.byteLength(src))}; fixed part ${kb(fixed)}; ${Math.round(per)} bytes a player`);
console.log("  " + SIZES.map((n) => { const est = fixed + per * n; const b = est > 32 * CAP ? est : build(n); return `${n.toLocaleString()}: ${kb(b)}${b > CAP ? " OVER" : b > WARN ? " (past 60%)" : ""}${est > 32 * CAP ? " (worked out)" : ""}`; }).join(" | "));
console.log(`  fits under 2 MB: about ${fit(CAP).toLocaleString()} players; the 60% warning (1.2 MB) at about ${fit(WARN).toLocaleString()}`);
