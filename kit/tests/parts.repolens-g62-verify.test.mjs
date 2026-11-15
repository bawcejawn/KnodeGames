// Repo Lens #G-62 (PR #295 @ bb887ba0): fix-check of #G-61 in kit/parts/parts.inline.mjs. EXPECTED TO PASS at
// bb887ba0: each test pins one #G-61 fix so it can't quietly regress. Paste into kit/tests/ (imports ../parts/).
// No exploit code: every test only builds local temp folders.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import * as P from "../parts/parts.inline.mjs";
// ADAPTED in #G-63 for e1b91fab. API change only: `published: <dir> | null` -> `publishedRoot` + `rel` (the published
// copy now lives at publishedRoot/race-data/T004; an empty root = nothing published), and the published-manifest
// error text is now "isn't a kgparts manifest" (was "can't be read"). Also: V1's loop over missing options had its
// body swallowed by a trailing comment in #G-62 (it ran the next line 3 times); fixed, and `game` added now that G62-1
// is fixed. V4's "a linked published copy works" line was dropped (see #G-63 G63-4: a link at rel should hold).

const COL = [["x", "s"]];
const base = () => fs.mkdtempSync(path.join(os.tmpdir(), "g62v-"));
const folder = (name = "T004") => { const d = path.join(base(), name); return d; };
const M = (over = {}) => ({ game: "race", file: "T004", week: 4, state: "final", unit: "d", expect: ["d1"], writtenAt: 1, ...over });
const part = (p, v, file = "T004") => P.encodePart({ game: "race", file, part: p, cols: COL, rows: [[v]] });
const REL = "race-data/T004";
const O = (over = {}) => ({ game: "race", file: "T004", week: 4, full: ["d1"], publishedRoot: base(), rel: REL, ...over });
const pubAt = () => { const r = base(); return { r, d: path.join(r, REL) }; };   // a published-branch checkout and this folder in it
const errs = (c) => c.errors.join(" | ");
const snap = (d) => { const o = {}; const walk = (x, r = "") => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const rel = r ? `${r}/${e.name}` : e.name; if (e.isSymbolicLink()) o[rel] = "link:" + fs.readlinkSync(path.join(x, e.name)); else if (e.isDirectory()) walk(path.join(x, e.name), rel); else o[rel] = fs.readFileSync(path.join(x, e.name)).toString("hex"); } }; walk(d); return o; };
const cp = (a, b) => fs.cpSync(a, b, { recursive: true });

test("G62-V1 (G61-1) options fail closed: none, {}, missing game/file/week/published, bad full", () => {
  const d = folder(); P.writeParts(d, M(), [part("d1", "a")]);
  assert.equal(P.checkParts(d, O()).ok, true, errs(P.checkParts(d, O())));
  assert.equal(P.checkParts(d).ok, false);
  assert.equal(P.checkParts(d, {}).ok, false);
  assert.equal(P.checkParts(d, null).ok, false);
  for (const k of ["game", "file", "week", "publishedRoot", "rel"]) { const o = O(); delete o[k]; assert.equal(P.checkParts(d, o).ok, false, `missing ${k}`); }
  for (const bad of [undefined, null, "", 0, false, {}]) assert.equal(P.checkParts(d, O({ publishedRoot: bad })).ok, false, `publishedRoot ${String(bad)}`);
  for (const bad of [undefined, null, "", 0, false, {}, ".", "..", "/race-data/T004", "race-data//T004", "race-data/T004/", "race-data/./T004", "x/../race-data/T004", "race-data/T003", "T004x"]) assert.equal(P.checkParts(d, O({ rel: bad })).ok, false, `rel ${String(bad)}`);
  const fin = O(); delete fin.full; assert.match(errs(P.checkParts(d, fin)), /full unit list/);
  for (const bad of ["d1", [], ["zz"], [null], [1]]) assert.equal(P.checkParts(d, O({ full: bad })).ok, false, JSON.stringify(bad));
  assert.match(errs(P.checkParts(d, O({ full: ["d1", "d2"] }))), /doesn't expect d2/);   // a d1-only final vs a 2-day game
  assert.equal(P.checkParts(d, O({ full: ["d1", "d1"] })).ok, true);                      // duplicates: harmless
  // a pending folder doesn't need full
  const p = folder(); P.writeParts(p, M({ state: "pending" }), [part("d1", "a")]);
  const o = O(); delete o.full; assert.equal(P.checkParts(p, o).ok, true, errs(P.checkParts(p, o)));
});

test("G62-V2 (G61-1) file must equal the folder name; trailing slash and ./ still match", () => {
  const d = folder(); P.writeParts(d, M(), [part("d1", "a")]);
  assert.equal(P.checkParts(d + "/", O()).ok, true);
  assert.equal(P.checkParts(path.join(d, "."), O()).ok, true);
  const other = path.join(path.dirname(d), "X004"); fs.renameSync(d, other);
  assert.match(errs(P.checkParts(other, O())), /doesn't match the folder name/);
  // a link named T004 pointing at a folder of another file: the manifest's own file still has to match
  const b = base(); const w = path.join(b, "W004"); P.writeParts(w, M({ file: "W004" }), [part("d1", "a", "W004")]);
  fs.symlinkSync(w, path.join(b, "T004")); assert.equal(P.checkParts(path.join(b, "T004"), O()).ok, false);
});

test("G62-V3 (G61-2 writer) unreadable or foreign manifest, or parts with no manifest: stop, nothing changed", () => {
  for (const bad of ["<<<<<<< HEAD\n{}\n=======\n>>>>>>> x\n", '{"kgparts":1,"state":"fi', "{}\n", "[]\n", "null\n", '{"kgparts":1,"state":"final","hash":"x","parts":[]}\n', "﻿"]) {
    const d = folder(); P.writeParts(d, M(), [part("d1", "final")]);
    const mp = path.join(d, "manifest.json");
    fs.writeFileSync(mp, bad.startsWith("﻿") ? "﻿" + fs.readFileSync(mp, "utf8") : bad);
    const before = snap(d);
    assert.throws(() => P.writeParts(d, M({ state: "pending" }), [part("d1", "new")]), /stopping/, JSON.stringify(bad));
    assert.deepEqual(snap(d), before);
  }
  const d = folder(); P.writeParts(d, M(), [part("d1", "final")]); fs.rmSync(path.join(d, "manifest.json")); const before = snap(d);
  assert.throws(() => P.writeParts(d, M({ state: "pending" }), [part("d1", "new")]), /no manifest/); assert.deepEqual(snap(d), before);
  const e = folder(); fs.mkdirSync(e, { recursive: true }); P.writeParts(e, M({ state: "pending" }), [part("d1", "x")]);   // empty folder OK
  const f = folder(); P.writeParts(f, M({ state: "pending" }), [part("d1", "x")]);                                         // absent folder OK
  assert.equal(P.checkParts(f, O()).ok, true);
});

test("G62-V4 (G61-2 step 5b) a published final must come back byte-identical", () => {
  const { r: pr, d: pub } = pubAt(); P.writeParts(pub, M(), [part("d1", "final")]);
  const ok = folder(); cp(pub, ok);
  assert.equal(P.checkParts(ok, O({ publishedRoot: pr })).ok, true, errs(P.checkParts(ok, O({ publishedRoot: pr }))));
  const re = folder(); P.writeParts(re, M(), [part("d1", "rewritten")]);
  assert.equal(P.checkParts(re, O()).ok, true);                                       // self-consistent alone
  assert.match(errs(P.checkParts(re, O({ publishedRoot: pr }))), /published copy is final/);
  const pe = folder(); P.writeParts(pe, M({ state: "pending" }), [part("d1", "final")]);
  assert.match(errs(P.checkParts(pe, O({ publishedRoot: pr }))), /this one is not/);
  const mt = folder(); cp(pub, mt); const m = JSON.parse(fs.readFileSync(path.join(mt, "manifest.json"), "utf8")); m.meta = { why: "later" };
  fs.writeFileSync(path.join(mt, "manifest.json"), JSON.stringify(m) + "\n");
  assert.match(errs(P.checkParts(mt, O({ publishedRoot: pr }))), /manifest.json: differs/);   // meta on an unchanged final is kept (spec §3)
  const xp = folder(); cp(pub, xp); const extra = part("d2", "x"); fs.writeFileSync(path.join(xp, extra.name), extra.text);
  assert.match(errs(P.checkParts(xp, O({ publishedRoot: pr }))), /not listed/);           // an extra file beside a published final
  const pu = pubAt(); cp(pub, pu.d); fs.writeFileSync(path.join(pu.d, "manifest.json"), "<<<<");
  assert.match(errs(P.checkParts(ok, O({ publishedRoot: pu.r }))), /published copy: .*isn't a kgparts manifest/);
  const pn = pubAt(); cp(pub, pn.d); fs.rmSync(path.join(pn.d, "manifest.json"));
  assert.match(errs(P.checkParts(ok, O({ publishedRoot: pn.r }))), /files but no manifest/);
  const pb = pubAt(); cp(pub, pb.d); fs.writeFileSync(path.join(pb.d, "manifest.json"), "﻿" + fs.readFileSync(path.join(pub, "manifest.json"), "utf8"));
  assert.match(errs(P.checkParts(ok, O({ publishedRoot: pb.r }))), /isn't a kgparts manifest/);
});

test("G62-V5 (G61-2 step 5b) shards in p/ compared; a published pending may be replaced; missing file caught", () => {
  const shard = (h, v) => P.encodePart({ game: "race", file: "T004", part: `p/${h}`, cols: COL, rows: [[v]] });
  const { r: pr, d: pub } = pubAt(); P.writeParts(pub, M({ shards: 16 }), [part("d1", "f"), shard("0", "a"), shard("1", "b")]);
  const ok = folder(); cp(pub, ok); assert.equal(P.checkParts(ok, O({ publishedRoot: pr })).ok, true);
  const mi = folder(); cp(pub, mi); const pf = fs.readdirSync(path.join(mi, "p"))[0]; fs.rmSync(path.join(mi, "p", pf));
  assert.match(errs(P.checkParts(mi, O({ publishedRoot: pr }))), /missing here/);
  const { r: ppr, d: pp } = pubAt(); P.writeParts(pp, M({ state: "pending" }), [part("d1", "old")]);
  const nf = folder(); P.writeParts(nf, M(), [part("d1", "new")]);
  assert.equal(P.checkParts(nf, O({ publishedRoot: ppr })).ok, true);            // open/pending -> final allowed
  const nf2 = folder(); P.writeParts(nf2, M({ state: "pending" }), [part("d1", "newer")]);
  assert.equal(P.checkParts(nf2, O({ publishedRoot: ppr })).ok, true);           // pending -> pending allowed
  const empty = pubAt(); fs.mkdirSync(empty.d, { recursive: true });
  assert.equal(P.checkParts(nf, O({ publishedRoot: empty.r })).ok, true);    // an empty published folder = none
});

test("G62-V6 (G61-3) bytes are hashed; a BOM on a part or the manifest fails", () => {
  const d = folder(); P.writeParts(d, M(), [part("d1", "a")]);
  const m = JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf8"));
  const f = path.join(d, m.parts[0].name);
  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(f)]);
  // rewrite the manifest so size and hash match the BOM'd bytes: only the canonical/UTF-8 checks can stop it
  {
    const h = crypto.createHash("sha256").update(withBom).digest("hex");
    const name = P.partName("d1", h); fs.rmSync(f); fs.writeFileSync(path.join(d, name), withBom);
    m.parts[0] = { part: "d1", name, bytes: withBom.length, sha256: h, rows: 1 }; m.hash = P.partSetHash(m, m.parts);
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(m) + "\n");
    assert.equal(P.checkParts(d, O()).ok, false, "a leading BOM on a part must fail");
    fs.writeFileSync(path.join(d, "manifest.json"), "﻿" + JSON.stringify(m) + "\n");
    assert.equal(P.checkParts(d, O()).ok, false, "a leading BOM on the manifest must fail");
  }
});

test("G62-V7 (G61-4) manifest must be exactly what buildManifest writes", () => {
  const d = folder(); P.writeParts(d, M({ meta: { why: "x" } }), [part("d1", "a")]);
  const mp = path.join(d, "manifest.json"); const good = fs.readFileSync(mp, "utf8"); const m0 = JSON.parse(good);
  assert.equal(P.checkParts(d, O()).ok, true);
  const tryM = (fn, re) => { const m = structuredClone(m0); const t = fn(m); fs.writeFileSync(mp, t ?? JSON.stringify(m) + "\n"); const c = P.checkParts(d, O()); fs.writeFileSync(mp, good); assert.equal(c.ok, false, String(re)); if (re) assert.match(errs(c), re); };
  tryM((m) => { const { kgparts, ...r } = m; return JSON.stringify({ ...r, kgparts }) + "\n"; }, /out of order/);
  tryM((m) => { const { meta, ...r } = m; return JSON.stringify({ meta, ...r }) + "\n"; }, /out of order/);
  tryM((m) => { m.scores = 1; });
  tryM((m) => JSON.stringify(m, null, 1) + "\n", /canonical/);
  tryM((m) => JSON.stringify(m), /canonical/);
  tryM((m) => { m.unit = "x"; }, /bad unit/);
  tryM((m) => { m.shards = 8; }, /bad shards/);
  tryM((m) => { m.writtenAt = "1"; }, /writtenAt/);
  tryM((m) => { m.writtenAt = 1.5; }, /writtenAt/);
  tryM((m) => { m.week = -1; });
  tryM((m) => { m.expect = ["d9"]; });
  tryM((m) => { m.parts[0] = { ...m.parts[0], extra: 1 }; }, /bad manifest entry/);
  tryM((m) => { const { rows, ...r } = m.parts[0]; m.parts[0] = { rows, ...r }; }, /bad manifest entry/);
  tryM((m) => { m.parts[0].bytes = -1; }, /bad manifest entry/);
  tryM((m) => { m.meta = []; });
  assert.equal(P.MAX_PARTS, 600);
  assert.throws(() => P.buildManifest(M({ expect: [] }), Array.from({ length: 601 }, (_, i) => ({ part: `r${String(i + 1).padStart(3, "0")}`, name: "x", bytes: 1, sha256: "a".repeat(64), rows: 0 }))), /more than 600/);
});

test("G62-V8 (G61-5/6) canonX: string key order, nested, -0, big numbers, escapes; holes refused", () => {
  const e = (extra) => P.encodePart({ game: "race", file: "T004", part: "d1", cols: COL, rows: [], extra });
  const a = e({ 10: 1, 9: 2, b: [{ z: 1, a: 2 }, [{ y: 0, x: -0 }]] });
  const b = e({ b: [{ a: 2, z: 1 }, [{ x: 0, y: 0 }]], 9: 2, 10: 1 });
  assert.equal(a.text, b.text);
  assert.match(a.text, /"extra":\{"10":1,"9":2,"b":\[\{"a":2,"z":1\},\[\{"x":0,"y":0\}\]\]\}/);
  for (const ex of [{ big: 2 ** 60 }, { f: 0.1 + 0.2 }, { e: 1e21 }, { s: "\"\\\n \ud800😀" }, { "": 1 }]) {
    const p = e(ex); const d = P.decodePart(p.text); assert.equal(e(d.header.extra).text, p.text, JSON.stringify(ex));
  }
  const good = e({ s: "A" }).text;
  assert.throws(() => P.decodePart(good.replace('"A"', '"\\u0041"')), /canonical/);
  assert.throws(() => P.decodePart(e({ a: 1, b: 2 }).text.replace('{"a":1,"b":2}', '{"b":2,"a":1}')), /canonical/);
  for (const bad of [{ x: NaN }, { x: Infinity }, { x: undefined }, { x: new Date(0) }, { x: [, 1] }, { x: () => 1 }, { x: 1n }]) assert.throws(() => e(bad), JSON.stringify(Object.keys(bad)));
  assert.throws(() => P.encodePart({ game: "race", file: "T004", part: "d1", cols: [["j", "j"]], rows: [[[, 1]]] }), /hole/);
});

test("G62-V9 (G61-5) sorted extras give the same bytes as b10b5096's JSON.stringify", () => {
  // the b10b5096 text was JSON.stringify({kgparts,...,extra}) + "\n"; for an already-sorted extra it must be unchanged
  const ex = { a: 1, b: { c: [1, { d: 2, e: "x" }] }, z: null };
  const p = P.encodePart({ game: "race", file: "T004", part: "d1", t0: 3, cols: COL, rows: [["v"]], extra: ex });
  const o = JSON.parse(p.text); assert.equal(JSON.stringify(o) + "\n", p.text);
});

test("G62-V10 (G61-7) writer stops in a wrong folder; a real folder still cleans stale parts", () => {
  const mk = (setup) => { const d = folder(); P.writeParts(d, M({ state: "pending" }), [part("d1", "a")]); setup(d); return d; };
  const cases = {
    notes: (d) => fs.writeFileSync(path.join(d, "notes.txt"), "x"),
    w003json: (d) => fs.writeFileSync(path.join(d, "W003.json"), "{}"),
    bak: (d) => fs.writeFileSync(path.join(d, "manifest.json.bak"), "{}"),
    subdir: (d) => fs.mkdirSync(path.join(d, "W003")),
    link: (d) => fs.symlinkSync(os.tmpdir(), path.join(d, "lnk")),
    pfile: (d) => { fs.mkdirSync(path.join(d, "p")); fs.writeFileSync(path.join(d, "p", "notes.txt"), "x"); },
    pdeep: (d) => fs.mkdirSync(path.join(d, "p", "q"), { recursive: true }),
  };
  for (const [n, setup] of Object.entries(cases)) { const d = mk(setup); const before = snap(d); assert.throws(() => P.writeParts(d, M({ state: "pending" }), [part("d1", "b")]), /stopping/, n); assert.deepEqual(snap(d), before, n); }
  // the parent of a parts folder
  const parent = base(); P.writeParts(path.join(parent, "W003"), M({ file: "W003", state: "pending" }), [part("d1", "a", "W003")]); const before = snap(parent);
  assert.throws(() => P.writeParts(parent, M({ state: "pending" }), [part("d1", "b")]), /stopping/); assert.deepEqual(snap(parent), before);
  // a real folder: stale part-shaped files removed, empty p/ removed
  const d = folder(); P.writeParts(d, M({ state: "pending", shards: 16 }), [part("d1", "a"), P.encodePart({ game: "race", file: "T004", part: "p/0", cols: COL, rows: [["x"]] })]);
  P.writeParts(d, M({ state: "pending", expect: ["d1", "d2"] }), [part("d1", "b"), part("d2", "c")]);
  assert.deepEqual(fs.readdirSync(d).sort().filter((f) => f !== "manifest.json").length, 2);
  assert.equal(P.checkParts(d, O({ full: undefined })).ok, true, errs(P.checkParts(d, O({ full: undefined }))));
});

test("G62-V11 (info) WARN_BYTES = ceil(0.6 x cap): the first byte count at or over 60%", () => {
  assert.equal(P.WARN_BYTES, Math.ceil(0.6 * P.MAX_PART_BYTES));
  assert.equal(P.WARN_BYTES, 1258292);
  assert.ok((P.WARN_BYTES - 1) / P.MAX_PART_BYTES < 0.6 && P.WARN_BYTES / P.MAX_PART_BYTES >= 0.6);
});

test("G62-V12 self-contained: only fs/path/crypto, no dynamic import, require or eval; no heredoc terminator", () => {
  const src = fs.readFileSync(new URL("../parts/parts.inline.mjs", import.meta.url), "utf8");
  assert.deepEqual([...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]), ["node:fs", "node:path", "node:crypto"]);
  assert.doesNotMatch(src, /\bimport\s*\(|\brequire\s*\(|\beval\s*\(|new Function|process\.env/);
  assert.doesNotMatch(src, /^EOF$/m);
});
