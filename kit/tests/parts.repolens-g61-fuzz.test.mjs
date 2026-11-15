// Repo Lens #G-61 (PR #295 @ b10b5096): property / fuzz tests for kit/parts/parts.inline.mjs.
// ADAPTED in #G-62 for bb887ba0 (API changes only: checkParts now needs game/file/week/published and a folder named
// after the file; WARN_BYTES is ceil(0.6 x cap) = 1,258,292; j now accepts null-prototype objects). Logic unchanged.
// ADAPTED AGAIN in #G-63 for e1b91fab (API change only: `published: null` became `publishedRoot` (an existing, empty
// published-branch checkout = nothing published yet) + `rel`, in CK (F7) and in F9). Every assertion is unchanged.
// Paste into kit/tests/ (imports ../parts/parts.inline.mjs). EXPECTED TO PASS at e1b91fab: these confirm the
// canonical-bytes, j, name, hash-order and refusal claims. Seeded PRNG, so every run is the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import * as P from "../parts/parts.inline.mjs";

let seed = 0x6106;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i) => { const h = crypto.createHash("sha256").update(`g61-${i}`).digest(); let s = "1"; for (let k = 0; k < 33; k++) s += B58[h[k % 32] % 58]; return s; };
const NASTY = ["", "a", "é", " ", "\u0000", "\"\\/\b\f\n\r\t", "\ud800", "\udfff", "😀", "__proto__", "constructor", "１", "x".repeat(64), "﻿", "�"];
const ints = [0, -0, 1, -1, 9, 10, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 123456789];
function jVal(d = 0) {
  const r = rnd();
  if (d > 3 || r < 0.3) return pick([null, true, false, pick(ints), pick(NASTY)]);
  if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 3) }, () => jVal(d + 1));
  const o = {}; for (const k of ["b", "a", "10", "9", "__proto__", "constructor", "é", "😀", "\ud800"].filter(() => rnd() < 0.4)) Object.defineProperty(o, k, { value: jVal(d + 1), enumerable: true, writable: true, configurable: true });
  return o;
}
const COLS = [["p", "a"], ["q", "a"], ["i", "i"], ["s", "s"], ["n", "n"], ["b", "b"], ["j", "j"]];
function randRows() {
  const n = Math.floor(rnd() * 20);
  return Array.from({ length: n }, () => {
    let j = jVal(); while (Buffer.byteLength(JSON.stringify(j) || "") > 400) j = jVal();
    return [addr(Math.floor(rnd() * 5)), addr(Math.floor(rnd() * 5)), pick(ints), pick(NASTY), pick(["0", "1", "10", "9".repeat(40)]), pick([0, 1]), j];
  });
}
const enc = (rows, extra = {}) => P.encodePart({ game: "race", file: "T004", part: "d1", t0: 5, cols: COLS, rows, extra });
const reEncode = (d) => enc(d.rows.map((r) => COLS.map(([c]) => r[c])), d.header.extra);

test("G61-F1 fuzz: encode -> decode -> re-encode is byte-identical; shuffled input gives the same bytes", () => {
  for (let k = 0; k < 400; k++) {
    const rows = randRows();
    const a = enc(rows);
    const b = enc([...rows].reverse());
    assert.equal(a.text, b.text);
    const d = P.decodePart(a.text);
    assert.equal(reEncode(d).text, a.text);
    assert.equal(a.name, `d1.${crypto.createHash("sha256").update(Buffer.from(a.text, "utf8")).digest("hex").slice(0, 12)}.json`);
  }
});

test("G61-F2 j: integer-like keys, -0, non-BMP, lone surrogates, __proto__ give one canonical text", () => {
  const cols = [["p", "a"], ["j", "j"]];
  const one = (v) => JSON.parse(P.encodePart({ game: "race", file: "T004", part: "d1", cols, rows: [[addr(1), v]] }).text).rows[0][1];
  assert.equal(one({ b: 1, 10: 2, 9: 3, a: 4 }), '{"10":2,"9":3,"a":4,"b":1}');
  assert.equal(one(JSON.parse('{"a":1,"10":2}')), one(JSON.parse('{"10":2,"a":1}')));
  assert.equal(one(-0), "0");
  assert.equal(one("\ud800"), '"\\ud800"');
  assert.equal(one("😀"), '"😀"');
  assert.equal(one(JSON.parse('{"__proto__":1}')), '{"__proto__":1}');
  // the 512 limit is in UTF-8 bytes, not characters: 170 x "😀" = 170 chars... 680 bytes (+2 quotes) is refused
  assert.throws(() => one("😀".repeat(170)), /over 512 bytes/);
  assert.equal(Buffer.byteLength(one("é".repeat(255))), 512);
  assert.throws(() => one("é".repeat(256)), /over 512 bytes/);
});

test("G61-F3 decode refuses every non-canonical variant of a good part", () => {
  const good = enc([[addr(1), addr(2), 1, "é", "10", 1, { a: 1, b: [1, 2] }]], { tUnit: "s" }).text;
  const variants = [
    " " + good, good.replace("\n", ""), good + "\n", "﻿" + good, good.replace('"t0":5', '"t0":5.0'),
    good.replace('"t0":5', '"t0":5e0'), good.replace('"t0":5', '"t0":05'), good.replace("é", "\\u00e9"),
    good.replace('"kgparts":1,', '"kgparts":1,"kgparts":1,'), good.replace('{"kgparts":1,"game":"race"', '{"game":"race","kgparts":1'),
    good.replace('"{\\"a\\":1,\\"b\\":[1,2]}"', '"{\\"b\\":[1,2],\\"a\\":1}"'), good.replace('"{\\"a\\":1,\\"b\\":[1,2]}"', '"{\\"a\\":1, \\"b\\":[1,2]}"'),
    good.replace('"{\\"a\\":1,\\"b\\":[1,2]}"', '"{\\"a\\":1.0,\\"b\\":[1,2]}"'), good.replace('"{\\"a\\":1,\\"b\\":[1,2]}"', '"{\\"a\\":1,\\"a\\":1,\\"b\\":[1,2]}"'),
    good.replace(',1,"é"', ',1.0,"é"'), good.replace("\n", "\r\n"),
  ];
  for (const v of variants) { assert.notEqual(v, good); assert.throws(() => P.decodePart(v), /kit\/parts/, JSON.stringify(v.slice(0, 80))); }
});

test("G61-F4 encode refuses NaN, floats, unsafe integers, Infinity in i and j; s over 64 UTF-16 units", () => {
  const cols = [["p", "a"], ["i", "i"], ["j", "j"]];
  for (const bad of [NaN, 1.5, 2 ** 53, Infinity, "1", null]) assert.throws(() => P.encodePart({ game: "race", file: "T004", part: "d1", cols, rows: [[addr(1), bad, 0]] }));
  for (const bad of [NaN, 1.5, 2 ** 53, -Infinity, 10n, undefined, () => 1, new Map()]) assert.throws(() => P.encodePart({ game: "race", file: "T004", part: "d1", cols, rows: [[addr(1), 0, bad]] }));
});

test("G61-F5 names: every allowed unit accepted, lookalikes / traversal / case refused", () => {
  const ok = ["ref", "top", "wk", "d1", "d7", "r001", "r99999", "h01", "h20", "p/0", "p/ff"];
  const bad = ["d0", "d8", "r01", "r100000", "h00", "h21", "p/fff", "p/FF", "p/", "p/../x", "../d1", "/d1", "p\\0", "p%2f0", "REF", "Ref", "d１", "ｄ1", "d1\n", "d1 ", "p//0", "p/0/1", "manifest"];
  for (const p of ok) P.encodePart({ game: "race", file: "T004", part: p, cols: [["x", "i"]], rows: [] });
  for (const p of bad) assert.throws(() => P.encodePart({ game: "race", file: "T004", part: p, cols: [["x", "i"]], rows: [] }), /bad part/, p);
  for (const g of ["Race", "race\n", "../race", "r".repeat(33)]) assert.throws(() => P.encodePart({ game: g, file: "T004", part: "d1", cols: [["x", "i"]], rows: [] }), /bad game/);
});

test("G61-F6 part-set hash: manifest parts sorted by part with plain code-unit order; KP-10 formula", () => {
  const mk = (p) => P.encodePart({ game: "race", file: "T004", part: p, cols: [["x", "i"]], rows: [[1]] });
  const m = P.buildManifest({ game: "race", file: "T004", week: 4, state: "pending", unit: "p", expect: [], writtenAt: 1 }, ["top", "p/a", "d2", "r010", "h01", "ref", "wk", "d1", "p/0"].map(mk));
  assert.deepEqual(m.parts.map((p) => p.part), ["d1", "d2", "h01", "p/0", "p/a", "r010", "ref", "top", "wk"]);
  let s = "kgparts1\nrace\nT004\n4\n"; for (const p of m.parts) s += `${p.part} ${p.sha256} ${p.bytes}\n`;
  assert.equal(m.hash, crypto.createHash("sha256").update(s).digest("hex"));
});

test("G61-F7 checkParts refusals: listed twice, unlisted part, header from another file, row-count mismatch, truncated, FIFO, dir named like a part, p/ symlink", () => {
  const COL = [["x", "i"]];
  const CK = { game: "race", file: "T004", week: 4, publishedRoot: fs.mkdtempSync(path.join(os.tmpdir(), "g61f7pub-")), rel: "race-data/T004" };
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "g61f7-"));
  const fresh = (name) => { const d = path.join(base, name, "T004"); P.writeParts(d, { game: "race", file: "T004", week: 4, state: "pending", unit: "d", expect: ["d1"], writtenAt: 1 }, [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COL, rows: [[1], [2]] })]); return d; };
  const M = (d) => JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf8"));
  const W = (d, m) => fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(m) + "\n");
  const fix = (m) => { m.hash = P.partSetHash(m, m.parts); m.rows = m.parts.reduce((s, p) => s + p.rows, 0); return m; };
  let d = fresh("twice"); let m = M(d); m.parts.push({ ...m.parts[0] }); W(d, fix(m)); assert.match(P.checkParts(d, CK).errors.join(" "), /not sorted or repeated/);
  d = fresh("unlisted"); const o = P.encodePart({ game: "race", file: "T004", part: "d2", cols: COL, rows: [] }); fs.writeFileSync(path.join(d, o.name), o.text); assert.match(P.checkParts(d, CK).errors.join(" "), /not listed/);
  d = fresh("otherfile"); m = M(d); const x = P.encodePart({ game: "race", file: "W004", part: "d1", cols: COL, rows: [[1], [2]] }); fs.rmSync(path.join(d, m.parts[0].name)); fs.writeFileSync(path.join(d, x.name), x.text);
  m.parts[0] = { part: "d1", name: x.name, bytes: x.bytes, sha256: x.sha256, rows: 2 }; W(d, fix(m)); assert.match(P.checkParts(d, CK).errors.join(" "), /header doesn't match/);
  d = fresh("rows"); m = M(d); m.parts[0].rows = 3; W(d, fix(m)); assert.match(P.checkParts(d, CK).errors.join(" "), /2 rows, manifest says 3/);
  d = fresh("trunc"); m = M(d); const f = path.join(d, m.parts[0].name); fs.writeFileSync(f, fs.readFileSync(f, "utf8").slice(0, -2)); assert.match(P.checkParts(d, CK).errors.join(" "), /bytes, manifest says/);
  d = fresh("dirpart"); m = M(d); fs.rmSync(path.join(d, m.parts[0].name)); fs.mkdirSync(path.join(d, m.parts[0].name)); assert.equal(P.checkParts(d, CK).ok, false);
  d = fresh("fifo"); m = M(d); fs.rmSync(path.join(d, m.parts[0].name)); execFileSync("mkfifo", [path.join(d, m.parts[0].name)]); assert.match(P.checkParts(d, CK).errors.join(" "), /not a plain file/);
  d = fresh("fifo2"); execFileSync("mkfifo", [path.join(d, "x.json")]); assert.match(P.checkParts(d, CK).errors.join(" "), /not listed/);
  d = fresh("plink"); fs.symlinkSync(os.tmpdir(), path.join(d, "p")); assert.match(P.checkParts(d, CK).errors.join(" "), /link is not allowed/);
  d = fresh("mlink"); fs.renameSync(path.join(d, "manifest.json"), path.join(d, "m.real")); fs.symlinkSync(path.join(d, "m.real"), path.join(d, "manifest.json")); assert.equal(P.checkParts(d, CK).ok, false);
  d = fresh("bom"); fs.writeFileSync(path.join(d, "manifest.json"), "﻿" + fs.readFileSync(path.join(d, "manifest.json"), "utf8")); assert.equal(P.checkParts(d, CK).ok, false);
  d = fresh("meta"); m = M(d); m.meta = { w: "x".repeat(4096 - 8) }; W(d, m); assert.equal(Buffer.byteLength(JSON.stringify(m.meta)), 4096); assert.equal(P.checkParts(d, CK).ok, true);
  m.meta = { w: "x".repeat(4097 - 8) }; W(d, m); assert.match(P.checkParts(d, CK).errors.join(" "), /meta over 4096/);
  m.meta = { w: "é".repeat(2045) }; W(d, m); assert.match(P.checkParts(d, CK).errors.join(" "), /meta over 4096/); // bytes, not chars
});

test("G61-F8 size boundaries: 2 MiB exactly accepted, +1 refused; the warning starts at 1,258,292 bytes", () => {
  const head = (n) => P.encodePart({ game: "race", file: "T004", part: "d1", cols: [["x", "s"]], rows: [], extra: { pad: "x".repeat(n) } });
  const base = head(0).bytes;
  assert.equal(head(P.MAX_PART_BYTES - base).bytes, P.MAX_PART_BYTES);
  assert.throws(() => head(P.MAX_PART_BYTES - base + 1), /over the 2097152-byte cap/);
  assert.equal(P.WARN_BYTES, 1258292);
  assert.equal(P.sizeWarnings([{ name: "a", bytes: 1258291 }]).length, 0);
  assert.equal(P.sizeWarnings([{ name: "a", bytes: 1258292 }]).length, 1);
});

test("G61-F9 finals: same set writes nothing and keeps the first meta; a different set (any state) is refused; pending -> final allowed", () => {
  const COL = [["x", "i"]];
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "g61f9-")), "T004");
  const M = (over) => ({ game: "race", file: "T004", week: 4, state: "final", unit: "d", expect: ["d1"], writtenAt: 1, ...over });
  const a = [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COL, rows: [[1]] })];
  const b = [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COL, rows: [[2]] })];
  P.writeParts(dir, M({ state: "pending" }), b);
  P.writeParts(dir, M({ meta: { why: "first" } }), a);                       // pending -> final with different parts
  const before = fs.readFileSync(path.join(dir, "manifest.json"), "utf8");
  assert.equal(P.writeParts(dir, M({ meta: { why: "second" }, writtenAt: 2 }), a).written, 0);
  assert.equal(P.writeParts(dir, M({ state: "open" }), a).written, 0);       // final -> open: silently kept final
  assert.equal(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"), before);
  for (const st of ["final", "pending", "open"]) assert.throws(() => P.writeParts(dir, M({ state: st }), b), /is final/);
  assert.equal(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"), before);
  assert.equal(P.checkParts(dir, { game: "race", file: "T004", week: 4, full: ["d1"], publishedRoot: fs.mkdtempSync(path.join(os.tmpdir(), "g61f9pub-")), rel: "race-data/T004" }).ok, true);
});
