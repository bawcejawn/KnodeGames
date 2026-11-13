// KG parts v1: split, compact game files with one hash over all parts (docs/capacity/PARTS-SPEC.md).
//
// ONE self-contained file (node:fs, node:path, node:crypto only), like kit/publish/check.inline.mjs: recorders import
// it, and a publish job that runs no repository code embeds it verbatim. Built by the Capacity chat; every game that
// moves a big file to parts (Race, Block X, Questions, Last Node, the kit games) uses this one tested copy.
//
// A logical file <base> (e.g. race-data/W004) becomes a folder:
//   <base>/manifest.json           the only file that changes between runs (written last)
//   <base>/<part>.<h12>.json       content-addressed parts: ref, top, wk, d1-d7, r001..., p/<xx> (per-player shards)
// <h12> = the first 12 hex of the part's own SHA-256, so a part's name changes whenever its bytes change and a cached
// old copy can never pass for the new one. The manifest lists every part with its bytes and SHA-256, and a part-set
// hash covers them all; checkParts() proves a folder is complete (no part missing, changed, extra or stale).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const PARTS_VERSION = 1;
export const MAX_PART_BYTES = 2 * 1024 * 1024;          // the publish jobs' cap (RECORDER_STANDARD §6.3)
export const WARN_BYTES = Math.round(0.6 * MAX_PART_BYTES); // the 60% warning (CAPACITY standard rule 2)
export const MAX_PARTS = 600;                            // a runaway split stops the run
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const GAME = /^[a-z][a-z0-9-]{0,31}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/;
const PART = /^(ref|top|wk|d[1-7]|r\d{3,5}|p\/[0-9a-f]{1,2})$/;   // wk: small week-level keys (Architecture A1)
const TYPES = new Set(["a", "i", "s", "n", "b"]);
const HEX64 = /^[0-9a-f]{64}$/;

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const fail = (msg) => { throw new Error(`kit/parts: ${msg}`); };
const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

function checkCols(cols) {
  if (!Array.isArray(cols) || cols.length < 1 || cols.length > 32) fail("cols must list 1 to 32 columns");
  const seen = new Set();
  for (const c of cols) {
    if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== "string" || !/^[a-z][a-zA-Z0-9_]{0,31}$/.test(c[0]) || !TYPES.has(c[1])) fail(`bad column ${JSON.stringify(c)}`);
    if (seen.has(c[0])) fail(`column ${c[0]} twice`);
    seen.add(c[0]);
  }
}
function checkValue(type, v, where) {
  if (type === "a") { if (typeof v !== "string" || !ADDR.test(v)) fail(`${where}: not an address`); return; }
  if (type === "i") { if (!Number.isSafeInteger(v)) fail(`${where}: not a whole number`); return; }
  if (type === "s") { if (typeof v !== "string" || v.length > 64) fail(`${where}: not a short string (64 max)`); return; }
  if (type === "n") { if (typeof v !== "string" || !/^(0|[1-9]\d{0,39})$/.test(v)) fail(`${where}: not a decimal string`); return; }
  if (type === "b") { if (v !== 0 && v !== 1) fail(`${where}: not 0 or 1`); return; }
}
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
function cmpRows(a, b) { for (let i = 0; i < a.length; i++) { const c = typeof a[i] === "number" && typeof b[i] === "number" ? a[i] - b[i] : cmp(String(a[i]), String(b[i])); if (c) return c; } return 0; }

/**
 * One part. rows: arrays in cols order, addresses as strings ("a" columns). Returns { name, part, text, bytes, sha256,
 * rows } where text is the canonical JSON (one line + "\n"). Rows are sorted, the address table is sorted, so the same
 * content always gives the same bytes.
 */
export function encodePart({ game, file, part, t0 = 0, cols, rows, extra = {} }) {
  if (!GAME.test(String(game))) fail(`bad game "${game}"`);
  if (!FILE.test(String(file))) fail(`bad file "${file}"`);
  if (!PART.test(String(part))) fail(`bad part "${part}" (ref, top, wk, d1-d7, r001..., p/<hex>)`);
  if (!Number.isSafeInteger(t0) || t0 < 0) fail("t0 must be a whole number of ms");
  checkCols(cols);
  if (!Array.isArray(rows)) fail("rows must be an array");
  if (!isObj(extra)) fail("extra must be an object");
  const addrs = new Set();
  rows.forEach((r, ri) => {
    if (!Array.isArray(r) || r.length !== cols.length) fail(`row ${ri}: needs ${cols.length} values`);
    cols.forEach(([n, t], ci) => { checkValue(t, r[ci], `row ${ri} ${n}`); if (t === "a") addrs.add(r[ci]); });
  });
  const a = [...addrs].sort();
  const ix = new Map(a.map((x, i) => [x, i]));
  const enc = rows.map((r) => cols.map(([, t], ci) => (t === "a" ? ix.get(r[ci]) : r[ci]))).sort(cmpRows);
  const text = JSON.stringify({ kgparts: PARTS_VERSION, game, file, part, t0, cols, a, rows: enc, extra }) + "\n";
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_PART_BYTES) fail(`part ${part} is ${bytes} bytes, over the ${MAX_PART_BYTES}-byte cap: split it by a smaller unit`);
  const h = sha256(text);
  return { part, name: partName(part, h), text, bytes, sha256: h, rows: enc.length };
}

/** A part file's text -> { header, rows: [{ col: value }] } with addresses resolved. Refuses anything malformed. */
export function decodePart(text) {
  let o;
  try { o = JSON.parse(text); } catch { fail("part is not JSON"); }
  if (!isObj(o) || o.kgparts !== PARTS_VERSION) fail("not a kgparts v1 part");
  const keys = Object.keys(o).join(",");
  if (keys !== "kgparts,game,file,part,t0,cols,a,rows,extra") fail(`part keys out of order or unexpected: ${keys}`);
  if (!GAME.test(o.game) || !FILE.test(o.file) || !PART.test(o.part) || !Number.isSafeInteger(o.t0)) fail("bad part header");
  checkCols(o.cols);
  if (!Array.isArray(o.a) || !Array.isArray(o.rows) || !isObj(o.extra)) fail("bad part body");
  for (let i = 0; i < o.a.length; i++) { if (!ADDR.test(o.a[i])) fail(`address table ${i}: not an address`); if (i && !(o.a[i - 1] < o.a[i])) fail("address table not sorted or has repeats"); }
  if (JSON.stringify(o) + "\n" !== text) fail("part is not in canonical form");
  const rows = o.rows.map((r, ri) => {
    if (!Array.isArray(r) || r.length !== o.cols.length) fail(`row ${ri}: wrong length`);
    const out = {};
    o.cols.forEach(([n, t], ci) => {
      if (t === "a") { if (!Number.isSafeInteger(r[ci]) || r[ci] < 0 || r[ci] >= o.a.length) fail(`row ${ri} ${n}: bad address index`); out[n] = o.a[r[ci]]; }
      else { checkValue(t, r[ci], `row ${ri} ${n}`); out[n] = r[ci]; }
    });
    return out;
  });
  for (let i = 1; i < o.rows.length; i++) if (cmpRows(o.rows[i - 1], o.rows[i]) > 0) fail("rows not sorted");
  const { kgparts, game, file, part, t0, cols, extra } = o;
  return { header: { kgparts, game, file, part, t0, cols, extra }, rows };
}

export function partName(part, sha) { return `${part}.${String(sha).slice(0, 12)}.json`; }

/** The per-player shard of an address: the first 1 (16 shards) or 2 (256) hex digits of SHA-256(address). */
export function shardOf(address, shards) {
  if (!ADDR.test(String(address))) fail("shardOf: not an address");
  if (shards !== 16 && shards !== 256) fail("shards must be 16 or 256");
  return sha256(Buffer.from(address, "utf8")).slice(0, shards === 16 ? 1 : 2);
}

/** The part-set hash (PARTS-SPEC §3): covers every listed part's bytes (through its SHA-256), the set, the order, the week. */
export function partSetHash({ game, file, week }, parts) {
  let s = `kgparts1\n${game}\n${file}\n${week}\n`;
  for (const p of parts) s += `${p.part} ${p.sha256} ${p.bytes}\n`;
  return sha256(s);
}

export function buildManifest({ game, file, week, state, unit, expect, shards = 0, writtenAt }, encoded) {
  if (!GAME.test(String(game)) || !FILE.test(String(file))) fail("bad game or file");
  if (!Number.isSafeInteger(week) || week < 0) fail("bad week");
  if (state !== "pending" && state !== "final") fail("state must be pending or final");
  if (!/^[dr]$/.test(String(unit))) fail("unit must be d or r");
  if (!Array.isArray(expect) || expect.some((e) => !PART.test(e))) fail("bad expect list");
  if (shards !== 0 && shards !== 16 && shards !== 256) fail("shards must be 0, 16 or 256");
  if (!Number.isSafeInteger(writtenAt)) fail("bad writtenAt");
  if (encoded.length > MAX_PARTS) fail(`more than ${MAX_PARTS} parts`);
  const parts = [...encoded].sort((x, y) => cmp(x.part, y.part)).map(({ part, name, bytes, sha256: h, rows }) => ({ part, name, bytes, sha256: h, rows }));
  for (let i = 1; i < parts.length; i++) if (parts[i].part === parts[i - 1].part) fail(`part ${parts[i].part} twice`);
  const rows = parts.reduce((s, p) => s + p.rows, 0);
  return { kgparts: PARTS_VERSION, game, file, week, state, writtenAt, unit, expect: [...expect], shards, parts, rows, hash: partSetHash({ game, file, week }, parts) };
}

function listFiles(dir, rel = "") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isSymbolicLink()) out.push({ rel: r, link: true });
    else if (e.isDirectory()) out.push(...listFiles(path.join(dir, e.name), r).map((x) => x), { rel: r, dir: true });
    else out.push({ rel: r });
  }
  return out;
}

/**
 * The writer without the file system (Architecture A2): given the parts and the previous manifest (or null), returns
 * what to write: { manifest, manifestText, hash, files: [{ name, text }] (parts first, "manifest.json" last),
 * unchanged: true when the folder is final and this set is the same (write nothing), warnings }. Throws when the
 * folder is final and the set differs. The caller (the kit's Out, a game's recorder) writes `files` and removes
 * every other file in the folder for a pending week.
 */
export function planParts(meta, encoded, prev = null) {
  const manifest = buildManifest(meta, encoded);
  if (prev && prev.state === "final") {
    if (prev.hash !== manifest.hash) fail(`the folder is final and this run's part set differs (hash ${String(prev.hash).slice(0, 12)} vs ${manifest.hash.slice(0, 12)}): stopping`);
    return { manifest: prev, manifestText: JSON.stringify(prev) + "\n", hash: prev.hash, files: [], unchanged: true, warnings: sizeWarnings(prev.parts.map((p) => ({ name: p.name, bytes: p.bytes }))) };
  }
  const manifestText = JSON.stringify(manifest) + "\n";
  const files = [...encoded.map((p) => ({ name: p.name, text: p.text })), { name: "manifest.json", text: manifestText }];
  return { manifest, manifestText, hash: manifest.hash, files, unchanged: false, warnings: sizeWarnings(files.map((f) => ({ name: f.name, bytes: Buffer.byteLength(f.text) }))) };
}

/**
 * Writes a logical file as parts + manifest into baseDir (created if needed). parts: encodePart() results. A final
 * folder is never changed: if baseDir holds a final manifest, the run must produce the same part-set hash (then
 * nothing is written) or it throws. For a pending folder, parts no longer listed are removed (same commit). The
 * manifest is written last. Returns { manifest, warnings, written }.
 */
export function writeParts(baseDir, meta, encoded) {
  const mPath = path.join(baseDir, "manifest.json");
  let prev = null;
  if (fs.existsSync(mPath)) { try { prev = JSON.parse(fs.readFileSync(mPath, "utf8")); } catch { prev = null; } }
  let plan;
  try { plan = planParts(meta, encoded, prev); } catch (e) { fail(`${baseDir}: ${String(e.message).replace(/^kit\/parts: /, "")}`); }
  const warnings = plan.warnings.map((w) => ({ ...w, name: `${baseDir}/${w.name}`, message: `${baseDir}/${w.message}` }));
  if (plan.unchanged) return { manifest: plan.manifest, warnings, written: 0 };
  fs.mkdirSync(baseDir, { recursive: true });
  let written = 0;
  for (const f of plan.files.filter((x) => x.name !== "manifest.json")) {
    const full = path.join(baseDir, f.name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (!fs.existsSync(full) || fs.readFileSync(full, "utf8") !== f.text) { fs.writeFileSync(full, f.text); written++; }
  }
  const keep = new Set(plan.files.map((f) => f.name));
  for (const f of listFiles(baseDir)) if (!f.dir && !keep.has(f.rel)) { fs.rmSync(path.join(baseDir, f.rel), { force: true }); }
  for (const f of listFiles(baseDir).filter((x) => x.dir).reverse()) { const d = path.join(baseDir, f.rel); if (!fs.readdirSync(d).length) fs.rmdirSync(d); }
  fs.writeFileSync(mPath, plan.manifestText);
  return { manifest: plan.manifest, warnings, written: written + 1 };
}

/** Files at or over 60% of the cap: [{ name, bytes, pct, message }]. Every recorder alerts on these (rule 2). */
export function sizeWarnings(files) {
  return files.filter((f) => f.bytes >= WARN_BYTES).map((f) => ({ ...f, pct: Math.round((100 * f.bytes) / MAX_PART_BYTES), message: `${f.name} is ${(f.bytes / 1048576).toFixed(2)} MB, ${Math.round((100 * f.bytes) / MAX_PART_BYTES)}% of the 2 MB cap` }));
}

/**
 * The publish-side check (PARTS-SPEC §4, steps 1-5): proves baseDir holds exactly the manifest's parts, unchanged,
 * complete for its state. Returns { ok, errors, manifest, parts: [{ part, header, rows }] }; parts are decoded only
 * when everything else passed. `full` = the game's full unit list, required when the manifest is final.
 */
export function checkParts(baseDir, { game, file, week, full = null } = {}) {
  const errors = [];
  const err = (m) => { errors.push(m); };
  const mPath = path.join(baseDir, "manifest.json");
  let m = null;
  try {
    const st = fs.lstatSync(mPath);
    if (!st.isFile()) err("manifest.json is not a plain file");
    else if (st.size > MAX_PART_BYTES) err("manifest.json is over the cap");
    else m = JSON.parse(fs.readFileSync(mPath, "utf8"));
  } catch { err("manifest.json missing or not JSON"); }
  if (!m) return { ok: false, errors, manifest: null, parts: [] };
  if (m.kgparts !== PARTS_VERSION) err("not a kgparts v1 manifest");
  if (game !== undefined && m.game !== game) err(`manifest game ${m.game}, expected ${game}`);
  if (file !== undefined && m.file !== file) err(`manifest file ${m.file}, expected ${file}`);
  if (week !== undefined && m.week !== week) err(`manifest week ${m.week}, expected ${week}`);
  if (!Array.isArray(m.parts) || !Array.isArray(m.expect)) { err("manifest parts/expect missing"); return { ok: false, errors, manifest: m, parts: [] }; }
  if (m.state !== "pending" && m.state !== "final") err("bad state");
  const names = new Set();
  let prev = "";
  for (const p of m.parts) {
    if (!p || !PART.test(String(p.part)) || !HEX64.test(String(p.sha256)) || !Number.isSafeInteger(p.bytes) || !Number.isSafeInteger(p.rows)) { err(`bad manifest entry ${JSON.stringify(p)}`); continue; }
    if (p.part <= prev) err(`parts not sorted or repeated at ${p.part}`);
    prev = p.part;
    if (p.name !== partName(p.part, p.sha256)) err(`${p.part}: name ${p.name} doesn't match its hash`);
    names.add(p.name);
    const f = path.join(baseDir, p.name);
    let st = null;
    try { st = fs.lstatSync(f); } catch { err(`${p.name}: missing`); continue; }
    if (!st.isFile()) { err(`${p.name}: not a plain file`); continue; }
    if (st.size !== p.bytes) { err(`${p.name}: ${st.size} bytes, manifest says ${p.bytes}`); continue; }
    if (st.size > MAX_PART_BYTES) { err(`${p.name}: over the 2 MB cap`); continue; }
    const text = fs.readFileSync(f, "utf8");
    if (sha256(text) !== p.sha256) err(`${p.name}: SHA-256 doesn't match the manifest`);
  }
  const have = new Set(m.parts.map((p) => p.part));
  for (const u of m.expect) if (!have.has(u)) err(`missing part ${u}`);
  if (m.state === "final" && Array.isArray(full)) for (const u of full) if (!m.expect.includes(u)) err(`final manifest doesn't expect ${u}`);
  for (const f of listFiles(baseDir)) {
    if (f.link) err(`${f.rel}: a link is not allowed`);
    else if (f.dir) { if (f.rel !== "p") err(`${f.rel}: no folders except p/`); }
    else if (f.rel !== "manifest.json" && !names.has(f.rel)) err(`${f.rel}: not listed in the manifest (stale or extra)`);
  }
  if (Number.isSafeInteger(m.week) && typeof m.game === "string" && typeof m.file === "string" && Array.isArray(m.parts) && m.hash !== partSetHash(m, m.parts)) err("part-set hash doesn't match");
  if (m.rows !== m.parts.reduce((s, p) => s + (p.rows || 0), 0)) err("row total doesn't match");
  if (errors.length) return { ok: false, errors, manifest: m, parts: [] };
  const parts = [];
  for (const p of m.parts) {
    try {
      const d = decodePart(fs.readFileSync(path.join(baseDir, p.name), "utf8"));
      if (d.header.game !== m.game || d.header.file !== m.file || d.header.part !== p.part) err(`${p.name}: its header doesn't match the manifest`);
      if (d.rows.length !== p.rows) err(`${p.name}: ${d.rows.length} rows, manifest says ${p.rows}`);
      parts.push({ part: p.part, header: d.header, rows: d.rows });
    } catch (e) { err(`${p.name}: ${e.message}`); }
  }
  return { ok: errors.length === 0, errors, manifest: m, parts: errors.length ? [] : parts };
}
