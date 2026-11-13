// KG parts v1: split, compact game files with one hash over all parts (docs/capacity/PARTS-SPEC.md).
//
// ONE self-contained file (node:fs, node:path, node:crypto only), like kit/publish/check.inline.mjs: recorders import
// it, and a publish job that runs no repository code embeds it verbatim. Built by the Capacity chat; every game that
// moves a big file to parts (Race, Block X, Questions, Last Node, the kit games) uses this one tested copy.
//
// A logical file <base> (e.g. race-data/W004) becomes a folder:
//   <base>/manifest.json           the only file that changes between runs (written last)
//   <base>/<part>.<h12>.json       content-addressed parts: ref, top, wk, d1-d7, r001..., h01-h20, p/<xx> (per-player shards)
// <h12> = the first 12 hex of the part's own SHA-256, so a part's name changes whenever its bytes change and a cached
// old copy can never pass for the new one. The manifest lists every part with its bytes and SHA-256, and a part-set
// hash covers them all; checkParts() proves a folder is complete (no part missing, changed, extra or stale).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const PARTS_VERSION = 1;
export const MAX_PART_BYTES = 2 * 1024 * 1024;          // the publish jobs' cap (RECORDER_STANDARD §6.3)
export const WARN_BYTES = Math.ceil(0.6 * MAX_PART_BYTES);  // the 60% warning (CAPACITY standard rule 2); exact at 60% (G61 info)
export const MAX_PARTS = 600;                            // a runaway split stops the run
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const GAME = /^[a-z][a-z0-9-]{0,31}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/;
const PART = /^(ref|top|wk|d[1-7]|r\d{3,5}|h(0[1-9]|1\d|20)|p\/[0-9a-f]{1,2})$/;   // wk: week-level keys (Architecture A1); h01-h20: Golf holes
const PART_FILE = /^(?:(?:ref|top|wk|d[1-7]|r\d{3,5}|h(?:0[1-9]|1\d|20))|p\/[0-9a-f]{1,2})\.[0-9a-f]{12}\.json$/;   // what a parts folder may hold (G61-7)
const MANIFEST_KEYS = "kgparts,game,file,week,state,writtenAt,unit,expect,shards,parts,rows,hash";
const TYPES = new Set(["a", "i", "s", "n", "b", "j"]);
const STATES = new Set(["pending", "open", "final"]);   // open: a kit liveWeek copy (Architecture C1); may later be written as final, never back
export const MAX_J_BYTES = 512;                           // a "j" value (Architecture C3)
export const MAX_META_BYTES = 4096;                       // manifest.meta, outside the hash (Architecture C2)
/** Canonical JSON for a "j" value: arrays, objects (keys sorted), strings, safe integers, booleans, null; depth <= 8. */
function canonJ(v, d = 0) {
  if (d > 8) fail("j value nested too deep");
  if (v === null || typeof v === "boolean") return JSON.stringify(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") { if (!Number.isSafeInteger(v)) fail("j value: numbers must be safe integers"); return JSON.stringify(v); }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (!(i in v)) fail("j value: an array has a hole"); return "[" + v.map((x) => canonJ(x, d + 1)).join(",") + "]"; }
  if (isPlain(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonJ(v[k], d + 1)).join(",") + "}";
  fail("j value: not a JSON value");
}
/** Canonical JSON for a part's `extra` (G61-5): like canonJ, keys sorted at every level, but any finite number; depth <= 16. */
function canonX(v, d = 0) {
  if (d > 16) fail("extra nested too deep");
  if (v === null || typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") { if (!Number.isFinite(v)) fail("extra: numbers must be finite"); return JSON.stringify(v); }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (!(i in v)) fail("extra: an array has a hole"); return "[" + v.map((x) => canonX(x, d + 1)).join(",") + "]"; }
  if (isPlain(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonX(v[k], d + 1)).join(",") + "}";
  fail("extra: not a JSON value");
}
/** A part's canonical text (one line + "\n"): fixed header key order, then `extra` with sorted keys. */
function partText({ game, file, part, t0, cols, a, rows, extra }) {
  const head = JSON.stringify({ kgparts: PARTS_VERSION, game, file, part, t0, cols, a, rows });
  return head.slice(0, -1) + ',"extra":' + canonX(extra) + "}\n";
}
/** Reads a file as bytes and as strict UTF-8 (G61-3): invalid UTF-8 is refused, never replaced. */
function readStrict(f) {
  const buf = fs.readFileSync(f);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf); } catch { fail(`${path.basename(f)}: not valid UTF-8`); }
  return { buf, text };
}
function jText(v, where) { let t; try { t = canonJ(v); } catch (e) { fail(`${where}: ${String(e.message).replace(/^kit\/parts: /, "")}`); } if (Buffer.byteLength(t) > MAX_J_BYTES) fail(`${where}: j value over ${MAX_J_BYTES} bytes`); return t; }
const HEX64 = /^[0-9a-f]{64}$/;

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const fail = (msg) => { throw new Error(`kit/parts: ${msg}`); };
const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const isPlain = (o) => isObj(o) && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
const isName = (re, v) => typeof v === "string" && re.test(v);   // never String(v): "undefined" would pass (G62-1)
/** The writer's test for "this is a kgparts manifest" (used by the writer, step 5b and the sweep: G62-3). */
const isManifest = (m) => isPlain(m) && m.kgparts === PARTS_VERSION && STATES.has(m.state) && HEX64.test(String(m.hash)) && Array.isArray(m.parts) && isName(GAME, m.game) && isName(FILE, m.file) && Number.isSafeInteger(m.week) && m.week >= 0;
/** A parts folder must be a real folder, not a link (G62-5). Returns "absent", "dir", or throws. */
function folderState(dir, who) {
  let st;
  try { st = fs.lstatSync(dir); } catch { return "absent"; }
  if (st.isSymbolicLink()) fail(`${who}: ${dir} is a link, not a folder: stopping`);
  if (!st.isDirectory()) fail(`${who}: ${dir} is not a folder: stopping`);
  return "dir";
}
/** Reads a folder's manifest.json: null when absent; throws when present but not a kgparts manifest. */
function readManifestAt(dir, who) {
  const mp = path.join(dir, "manifest.json");
  if (!fs.existsSync(mp)) return null;
  let m = null;
  try { m = JSON.parse(readStrict(mp).text); } catch { m = null; }
  if (!isManifest(m)) fail(`${who}: ${mp} exists but isn't a kgparts manifest: holding`);
  return m;
}
function checkMeta(meta, bad) {
  if (!isObj(meta)) return bad("meta must be a plain object");
  let t; try { t = JSON.stringify(meta); } catch { return bad("meta is not JSON"); }
  if (Buffer.byteLength(t) > MAX_META_BYTES) bad(`meta over ${MAX_META_BYTES} bytes`);
}

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
  if (type === "j") { jText(v, where); return; }
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
  if (!PART.test(String(part))) fail(`bad part "${part}" (ref, top, wk, d1-d7, r001..., h01-h20, p/<hex>)`);
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
  const enc = rows.map((r) => cols.map(([, t], ci) => (t === "a" ? ix.get(r[ci]) : t === "j" ? jText(r[ci], "j") : r[ci]))).sort(cmpRows);
  const text = partText({ game, file, part, t0, cols, a, rows: enc, extra });
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
  let canon; try { canon = partText(o); } catch (e) { fail(`part: ${String(e.message).replace(/^kit\/parts: /, "")}`); }
  if (canon !== text) fail("part is not in canonical form");
  const rows = o.rows.map((r, ri) => {
    if (!Array.isArray(r) || r.length !== o.cols.length) fail(`row ${ri}: wrong length`);
    const out = {};
    o.cols.forEach(([n, t], ci) => {
      if (t === "a") { if (!Number.isSafeInteger(r[ci]) || r[ci] < 0 || r[ci] >= o.a.length) fail(`row ${ri} ${n}: bad address index`); out[n] = o.a[r[ci]]; }
      else if (t === "j") {
        if (typeof r[ci] !== "string") fail(`row ${ri} ${n}: j value not stored as text`);
        let v; try { v = JSON.parse(r[ci]); } catch { fail(`row ${ri} ${n}: j value not JSON`); }
        if (jText(v, `row ${ri} ${n}`) !== r[ci]) fail(`row ${ri} ${n}: j value not canonical`);
        out[n] = v;
      }
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

export function buildManifest({ game, file, week, state, unit, expect, shards = 0, writtenAt, meta }, encoded) {
  if (!GAME.test(String(game)) || !FILE.test(String(file))) fail("bad game or file");
  if (!Number.isSafeInteger(week) || week < 0) fail("bad week");
  if (!STATES.has(state)) fail("state must be pending, open or final");
  if (meta !== undefined) checkMeta(meta, fail);
  if (!/^[drhp]$/.test(String(unit))) fail("unit must be d, r, h or p");
  if (!Array.isArray(expect) || expect.some((e) => !PART.test(e))) fail("bad expect list");
  if (shards !== 0 && shards !== 16 && shards !== 256) fail("shards must be 0, 16 or 256");
  if (!Number.isSafeInteger(writtenAt)) fail("bad writtenAt");
  if (encoded.length > MAX_PARTS) fail(`more than ${MAX_PARTS} parts`);
  const parts = [...encoded].sort((x, y) => cmp(x.part, y.part)).map(({ part, name, bytes, sha256: h, rows }) => ({ part, name, bytes, sha256: h, rows }));
  for (let i = 1; i < parts.length; i++) if (parts[i].part === parts[i - 1].part) fail(`part ${parts[i].part} twice`);
  const rows = parts.reduce((s, p) => s + p.rows, 0);
  const m = { kgparts: PARTS_VERSION, game, file, week, state, writtenAt, unit, expect: [...expect], shards, parts, rows, hash: partSetHash({ game, file, week }, parts) };
  if (meta !== undefined) m.meta = meta;   // outside the hash: lifecycle notes only (seen, why)
  return m;
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
 * every other file in the folder for a pending or open week.
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
 * nothing is written) or it throws. For a pending or open folder, parts no longer listed are removed (same commit). The
 * manifest is written last. Returns { manifest, warnings, written }.
 */
export function writeParts(baseDir, meta, encoded) {
  const mPath = path.join(baseDir, "manifest.json");
  folderState(baseDir, "writeParts");                                         // G62-5
  // G61-7: a parts folder holds only manifest.json, part-shaped files and p/. Anything else means a wrong folder: stop
  // before deleting anything.
  const present = listFiles(baseDir);
  for (const f of present) {
    if (f.link) fail(`${baseDir}: ${f.rel} is a link: stopping (nothing written or removed)`);
    if (f.dir) { if (f.rel !== "p") fail(`${baseDir}: ${f.rel}/ is not a parts folder: stopping (wrong folder?)`); continue; }
    if (f.rel !== "manifest.json" && !PART_FILE.test(f.rel)) fail(`${baseDir}: ${f.rel} is not a part: stopping (wrong folder?)`);
  }
  // G61-2: never treat an unreadable manifest, or parts with no manifest, as an empty folder.
  let prev = null;
  if (fs.existsSync(mPath)) {
    try { prev = JSON.parse(readStrict(mPath).text); } catch { prev = null; }
    if (!isManifest(prev)) fail(`${baseDir}: manifest.json exists but can't be read as a kgparts manifest: stopping (nothing written or removed; restore it from the published branch)`);
    if (prev.game !== meta.game || prev.file !== meta.file || prev.week !== meta.week) fail(`${baseDir}: this folder holds ${prev.game} ${prev.file} week ${prev.week}, not ${meta.game} ${meta.file} week ${meta.week}: stopping (wrong folder?)`);   // G62-4
  } else if (present.some((f) => !f.dir)) fail(`${baseDir}: part files but no manifest.json: stopping (copy the folder back from the published branch)`);
  let plan;
  try { plan = planParts(meta, encoded, prev); } catch (e) { fail(`${baseDir}: ${String(e.message).replace(/^kit\/parts: /, "")}`); }
  const warnings = plan.warnings.map((w) => ({ ...w, name: `${baseDir}/${w.name}`, message: `${baseDir}/${w.message}` }));
  if (plan.unchanged) return { manifest: plan.manifest, warnings, written: 0 };
  fs.mkdirSync(baseDir, { recursive: true });
  let written = 0;
  for (const f of plan.files.filter((x) => x.name !== "manifest.json")) {
    const full = path.join(baseDir, f.name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const want = Buffer.from(f.text, "utf8");
    if (!fs.existsSync(full) || !fs.readFileSync(full).equals(want)) { fs.writeFileSync(full, want); written++; }
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
 * The publish-side check (PARTS-SPEC §4, steps 1-5 and 5b): proves baseDir holds exactly the manifest's parts,
 * unchanged, complete for its state, and (step 5b) that a folder already published as final is byte-identical.
 * Returns { ok, errors, manifest, parts: [{ part, header, rows }] }; parts are decoded only when everything else passed.
 * Required (fail closed, G61-1 / G62-1 / G62-2): game, file (must equal the folder's name), week, publishedRoot (the
 * published branch's checkout; it must exist) and rel (this folder's path inside the branch, ending in file). The
 * check finds the published copy itself at publishedRoot/rel. `full` (the game's full unit list, a non-empty list of
 * part names) is required when the manifest is final. Run sweepFinals() too, once per publish (§4 step 8).
 */
export function checkParts(baseDir, opts) {
  const errors = [];
  const err = (m) => { errors.push(m); };
  const o = isObj(opts) ? opts : {};
  const { game, file, week, full, publishedRoot, rel } = o;
  if (!isName(GAME, game)) err("checkParts: game is required");
  if (!isName(FILE, file)) err("checkParts: file is required");
  else if (path.basename(path.resolve(baseDir)) !== file) err(`checkParts: file ${file} doesn't match the folder name ${path.basename(path.resolve(baseDir))}`);
  if (!Number.isSafeInteger(week) || week < 0) err("checkParts: week is required");
  try { folderState(baseDir, "checkParts"); } catch (e) { err(String(e.message).replace(/^kit\/parts: /, "")); }   // G62-5
  // G62-2: the published copy is found here, from the branch root, never taken from the caller as a bare path
  let pubDir = null;
  if (typeof publishedRoot !== "string" || !publishedRoot.length) err("checkParts: publishedRoot is required (the published branch's checkout)");
  else {
    let st = null; try { st = fs.statSync(publishedRoot); } catch { st = null; }
    if (!st || !st.isDirectory()) err(`checkParts: publishedRoot ${publishedRoot} doesn't exist: holding (branch not fetched?)`);
  }
  if (typeof rel !== "string" || !rel.length || path.isAbsolute(rel) || rel.split(/[\\/]/).some((x) => !x || x === "." || x === "..")) err("checkParts: rel is required (this folder's path inside the branch, e.g. race/W004)");
  else if (isName(FILE, file) && rel.split(/[\\/]/).pop() !== file) err(`checkParts: rel ${rel} doesn't end in ${file}`);
  if (!errors.length) {
    pubDir = path.join(publishedRoot, rel);
    const a = path.resolve(pubDir), b = path.resolve(baseDir);
    if (a === b || b.startsWith(a + path.sep) || a.startsWith(b + path.sep)) err("checkParts: the published copy is the folder being checked: holding");
  }
  if (full !== undefined && full !== null && (!Array.isArray(full) || !full.length || full.some((u) => !PART.test(String(u))))) err("checkParts: full must be a non-empty list of part names");
  const mPath = path.join(baseDir, "manifest.json");
  let m = null, mText = null;
  try {
    const st = fs.lstatSync(mPath);
    if (!st.isFile()) err("manifest.json is not a plain file");
    else if (st.size > MAX_PART_BYTES) err("manifest.json is over the cap");
    else { mText = readStrict(mPath).text; m = JSON.parse(mText); }
  } catch { err("manifest.json missing, not UTF-8 or not JSON"); }
  if (!isPlain(m)) return { ok: false, errors: errors.length ? errors : ["manifest.json is not an object"], manifest: null, parts: [] };
  // G61-4: the manifest must be exactly what buildManifest writes (keys, order, fields, bytes)
  const keys = Object.keys(m).join(",");
  if (keys !== MANIFEST_KEYS && keys !== MANIFEST_KEYS + ",meta") err(`manifest keys unexpected or out of order: ${keys}`);
  if (m.kgparts !== PARTS_VERSION) err("not a kgparts v1 manifest");
  if (!GAME.test(String(m.game)) || !FILE.test(String(m.file))) err("manifest: bad game or file");
  if (!Number.isSafeInteger(m.week) || m.week < 0) err("manifest: bad week");
  if (!STATES.has(m.state)) err("bad state");
  if (!Number.isSafeInteger(m.writtenAt)) err("manifest: bad writtenAt");
  if (!/^[drhp]$/.test(String(m.unit))) err("manifest: bad unit");
  if (m.shards !== 0 && m.shards !== 16 && m.shards !== 256) err("manifest: bad shards");
  if (m.meta !== undefined) checkMeta(m.meta, err);
  if (game !== undefined && m.game !== game) err(`manifest game ${m.game}, expected ${game}`);
  if (file !== undefined && m.file !== file) err(`manifest file ${m.file}, expected ${file}`);
  if (week !== undefined && m.week !== week) err(`manifest week ${m.week}, expected ${week}`);
  if (!Array.isArray(m.parts) || !Array.isArray(m.expect)) { err("manifest parts/expect missing"); return { ok: false, errors, manifest: m, parts: [] }; }
  if (m.parts.length > MAX_PARTS) err(`manifest lists more than ${MAX_PARTS} parts`);
  if (m.expect.some((e) => !PART.test(String(e)))) err("manifest: bad expect list");
  if (mText !== null && mText !== JSON.stringify(m) + "\n") err("manifest.json is not in canonical form");
  const names = new Set();
  let prev = "";
  for (const p of m.parts) {
    if (!isPlain(p) || Object.keys(p).join(",") !== "part,name,bytes,sha256,rows" || !PART.test(String(p.part)) || !HEX64.test(String(p.sha256)) || !Number.isSafeInteger(p.bytes) || p.bytes < 0 || !Number.isSafeInteger(p.rows) || p.rows < 0) { err(`bad manifest entry ${JSON.stringify(p)}`); continue; }
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
    if (sha256(fs.readFileSync(f)) !== p.sha256) err(`${p.name}: SHA-256 doesn't match the manifest`);   // over the bytes on disk (G61-3)
  }
  const have = new Set(m.parts.map((p) => p && p.part));
  for (const u of m.expect) if (!have.has(u)) err(`missing part ${u}`);
  if (m.state === "final") {
    if (!Array.isArray(full) || !full.length) err("a final manifest needs the game's full unit list (full)");
    else for (const u of full) if (!m.expect.includes(u)) err(`final manifest doesn't expect ${u}`);
  }
  for (const f of listFiles(baseDir)) {
    if (f.link) err(`${f.rel}: a link is not allowed`);
    else if (f.dir) { if (f.rel !== "p") err(`${f.rel}: no folders except p/`); }
    else if (f.rel !== "manifest.json" && !names.has(f.rel)) err(`${f.rel}: not listed in the manifest (stale or extra)`);
  }
  if (Number.isSafeInteger(m.week) && typeof m.game === "string" && typeof m.file === "string" && m.hash !== partSetHash(m, m.parts)) err("part-set hash doesn't match");
  if (m.rows !== m.parts.reduce((s, p) => s + ((p && p.rows) || 0), 0)) err("row total doesn't match");
  // Step 5b (G61-2, G62-2, G62-3): a folder already published as final must come back byte-identical, nothing removed.
  if (pubDir) {
    let pst = null; try { pst = fs.lstatSync(pubDir); } catch { pst = null; }
    if (pst && !pst.isDirectory() && !pst.isSymbolicLink()) err(`the published copy ${rel} is not a folder: holding`);
    else if (pst) {
      let pub = null;
      try { pub = readManifestAt(pubDir, "published copy"); } catch (e) { err(String(e.message).replace(/^kit\/parts: /, "")); pub = undefined; }
      if (pub === null && listFiles(pubDir).some((f) => !f.dir)) err("the published copy has files but no manifest.json: holding");
      if (pub && (pub.game !== m.game || pub.file !== m.file || pub.week !== m.week)) err(`the published copy at ${rel} is ${pub.game} ${pub.file} week ${pub.week}, not ${m.game} ${m.file} week ${m.week}: holding`);
      if (pub && pub.state === "final") {
        if (m.state !== "final") err("the published copy is final; this one is not");
        if (m.hash !== pub.hash) err(`the published copy is final with set hash ${String(pub.hash).slice(0, 12)}; this one is ${String(m.hash).slice(0, 12)}`);
        for (const f of listFiles(pubDir)) {
          if (f.dir) continue;
          const mine = path.join(baseDir, f.rel);
          if (f.link || !fs.existsSync(mine)) { err(`${f.rel}: in the published final, missing here`); continue; }
          if (!fs.readFileSync(path.join(pubDir, f.rel)).equals(fs.readFileSync(mine))) err(`${f.rel}: differs from the published final`);
        }
      }
    }
  }
  if (errors.length) return { ok: false, errors, manifest: m, parts: [] };
  const parts = [];
  for (const p of m.parts) {
    try {
      const d = decodePart(readStrict(path.join(baseDir, p.name)).text);
      if (d.header.game !== m.game || d.header.file !== m.file || d.header.part !== p.part) err(`${p.name}: its header doesn't match the manifest`);
      if (d.rows.length !== p.rows) err(`${p.name}: ${d.rows.length} rows, manifest says ${p.rows}`);
      parts.push({ part: p.part, header: d.header, rows: d.rows });
    } catch (e) { err(`${p.name}: ${e.message}`); }
  }
  return { ok: errors.length === 0, errors, manifest: m, parts: errors.length ? [] : parts };
}

/**
 * The branch-wide sweep (PARTS-SPEC §4 step 8, Repo Lens #G-62 Q2): every final parts folder on the published branch
 * must still be in the new copy, byte-identical. Step 5b only sees folders being published; this catches a final that
 * went missing. Returns { ok, errors, finals }. Both roots must exist. Walks at most 6 levels; links are not followed.
 */
export function sweepFinals(publishedRoot, localRoot) {
  const errors = [];
  let finals = 0;
  for (const [r, who] of [[publishedRoot, "publishedRoot"], [localRoot, "localRoot"]]) {
    let st = null; try { st = typeof r === "string" && r.length ? fs.statSync(r) : null; } catch { st = null; }
    if (!st || !st.isDirectory()) return { ok: false, errors: [`sweepFinals: ${who} ${r} doesn't exist: holding`], finals };
  }
  const walk = (rel, depth) => {
    const dir = path.join(publishedRoot, rel);
    if (fs.existsSync(path.join(dir, "manifest.json"))) {
      let m = null;
      try { m = readManifestAt(dir, "sweep"); } catch (e) { errors.push(String(e.message).replace(/^kit\/parts: /, "")); return; }
      if (m.state !== "final") return;
      finals++;
      for (const f of listFiles(dir)) {
        if (f.dir || f.link) continue;
        const mine = path.join(localRoot, rel, f.rel);
        if (!fs.existsSync(mine)) errors.push(`${rel}/${f.rel}: a published final file is missing from the new copy`);
        else if (!fs.readFileSync(path.join(dir, f.rel)).equals(fs.readFileSync(mine))) errors.push(`${rel}/${f.rel}: differs from the published final`);
      }
      return;
    }
    if (depth >= 6) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith(".")) walk(rel ? `${rel}/${e.name}` : e.name, depth + 1);
  };
  walk("", 0);
  return { ok: errors.length === 0, errors, finals };
}
