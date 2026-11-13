// Repo Lens #G-63 (PR #295 @ e1b91fab): one failing test per new finding in kit/parts/parts.inline.mjs.
// Paste into kit/tests/ (imports ../parts/). Every test here FAILS at e1b91fab and should pass once the matching fix
// lands. No exploit code: each only builds local temp folders. Severity: all Low or Info (none are reachable without a
// wrong caller input or an already-damaged published branch, and sweepFinals backs up most of the checkParts gaps).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as P from "../parts/parts.inline.mjs";

const COL = [["x", "s"]];
const REL = "race-data/T004";
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), "g63-"));
const M = (over = {}) => ({ game: "race", file: "T004", week: 4, state: "final", unit: "d", expect: ["d1"], writtenAt: 1, ...over });
const part = (v, file = "T004") => P.encodePart({ game: "race", file, part: "d1", cols: COL, rows: [[v]] });
const O = (over = {}) => ({ game: "race", file: "T004", week: 4, full: ["d1"], publishedRoot: root(), rel: REL, ...over });
const errs = (c) => c.errors.join(" | ");
const finalAt = (r, rel = REL, v = "final") => { const d = path.join(r, rel); P.writeParts(d, M({ file: path.basename(rel) }), [part(v, path.basename(rel))]); return d; };
// a published branch with a final at race-data/T004, and a new copy where that final was rewritten
const scene = () => { const pub = root(); finalAt(pub); const loc = root(); const re = finalAt(loc, REL, "rewritten"); return { pub, loc, re }; };

// G63-1 (Low) parts.inline.mjs:314-317. rel is split on both / and \ for validation, but path.join on Linux keeps "\"
// as a literal character, so rel "race-data\T004" passes validation, points at a folder that doesn't exist, and step
// 5b reads that as "nothing published yet": a rewritten final passes checkParts. The same happens for any rel that
// doesn't match where the folder really sits (a typo, "race-dat/T004", a lookalike letter), because checkParts can't
// see the local layout. Fix: refuse "\" in rel; and take localRoot (the same root given to sweepFinals) and require
// rel === path.relative(realpath(localRoot), realpath(baseDir)) (or derive rel from it). sweepFinals catches both
// cases today only if it is run, with the right roots.
test("G63-1 checkParts: a rel with a backslash, or a rel that isn't where the folder is, must not mean 'nothing published'", () => {
  const { pub, loc, re } = scene();
  assert.match(errs(P.checkParts(re, O({ publishedRoot: pub }))), /published copy is final/);   // control
  assert.equal(P.checkParts(re, O({ publishedRoot: pub, rel: "race-data\\T004" })).ok, false, "backslash rel must be refused");
  // proposed shape (Q2): with localRoot given, a rel that isn't baseDir's place in localRoot must be refused
  assert.equal(P.checkParts(re, O({ publishedRoot: pub, localRoot: loc, rel: "race-dat/T004" })).ok, false, "rel must be baseDir's path inside localRoot");
});

// G63-2 (Low) parts.inline.mjs:318-319 and 417-421. The "published copy is the folder being checked" guard compares
// path.resolve() strings, not real paths, and sweepFinals has no such guard at all. If publishedRoot is a link to the
// new copy (or a folder on the path is), both functions compare the new copy with itself and pass.
// Fix: realpath both sides (checkParts: realpath(pubDir) vs realpath(baseDir); sweepFinals: realpath(publishedRoot) vs
// realpath(localRoot)) and refuse equal or nested in either direction.
test("G63-2 the published copy and the new copy must be different folders, by real path, in checkParts and sweepFinals", () => {
  const { pub, loc, re } = scene();
  const ln = path.join(root(), "pub"); fs.symlinkSync(loc, ln);                       // "published" checkout is a link to the new copy
  assert.equal(P.checkParts(re, O({ publishedRoot: ln })).ok, false, "checkParts must not compare a folder with itself via a link");
  const anc = root(); fs.symlinkSync(path.join(loc, "race-data"), path.join(anc, "race-data"));   // a linked folder on the path
  assert.equal(P.checkParts(re, O({ publishedRoot: anc })).ok, false, "...or via a linked folder on the path");
  assert.equal(P.sweepFinals(pub, pub).ok, false, "sweepFinals(root, root) must hold");
  assert.equal(P.sweepFinals(loc, ln).ok, false, "sweepFinals must not compare a tree with itself via a link");
});

// G63-3 (Low) parts.inline.mjs:439-440. sweepFinals stops at 6 levels and skips folders starting with ".", silently.
// checkParts accepts any depth and ".x" segments in rel, so a game can publish a final the sweep never sees; if that
// final later goes missing from the new copy, nothing notices. Fix: make the two agree. Either checkParts refuses a
// rel deeper than 6 segments or with a segment starting with "." (simplest), or sweepFinals errors ("too deep:
// holding") when it would skip a subfolder, skipping only ".git".
test("G63-3 a final checkParts accepts must be one sweepFinals sees", () => {
  for (const rel of ["a/b/c/d/e/f/T004", ".data/T004"]) {
    const pub = root(); finalAt(pub, rel);
    const loc = root(); const d = finalAt(loc, rel);
    const accepted = P.checkParts(d, O({ publishedRoot: pub, rel })).ok;
    const swept = P.sweepFinals(pub, root()).ok === false;                          // the final is gone from an empty new copy
    assert.ok(!accepted || swept, `${rel}: checkParts accepts it (${accepted}) but the sweep doesn't see it go missing`);
  }
});

// G63-4 (Info) parts.inline.mjs:380-382. A published copy at rel that is a link (to an empty folder, or broken) is
// followed or read as "nothing published": step 5b passes. The writer and checkParts refuse links for the folder being
// written/checked (G62-5) but not for the published copy. Fix: if lstat(pubDir) is a link, hold.
test("G63-4 a published copy at rel that is a link holds", () => {
  const { re } = scene();
  for (const target of [root(), "/nonexistent/g63"]) {
    const pub = root(); fs.mkdirSync(path.join(pub, "race-data")); fs.symlinkSync(target, path.join(pub, REL));
    assert.equal(P.checkParts(re, O({ publishedRoot: pub })).ok, false, `published copy linked to ${target} must hold`);
  }
});

// G63-5 (Info) parts.inline.mjs:430-435. sweepFinals checks that every published final file is present and equal,
// but not the reverse: extra files, or a link in place of a part file (same bytes), in a local final folder pass.
// checkParts step 4 catches these only for folders being published this run. Fix: in the sweep, compare the two file
// lists both ways and refuse links (lstat) in the local final folder.
test("G63-5 sweepFinals: a local final must hold exactly the published files, no extras, no links", () => {
  const pub = root(); finalAt(pub);
  const extra = root(); fs.cpSync(pub, extra, { recursive: true }); fs.writeFileSync(path.join(extra, REL, "notes.txt"), "x");
  assert.equal(P.sweepFinals(pub, extra).ok, false, "an extra file beside a final");
  const linked = root(); fs.cpSync(pub, linked, { recursive: true });
  const d = path.join(linked, REL); const f = fs.readdirSync(d).find((n) => n.startsWith("d1."));
  const elsewhere = path.join(root(), "copy"); fs.copyFileSync(path.join(d, f), elsewhere); fs.rmSync(path.join(d, f)); fs.symlinkSync(elsewhere, path.join(d, f));
  assert.equal(P.sweepFinals(pub, linked).ok, false, "a link in place of a final's part");
});

// G63-6 (Info) parts.inline.mjs:423-441. A published folder holding part files but no manifest.json (a damaged
// branch) is walked past by the sweep; step 5b holds the same case ("has files but no manifest.json: holding").
// Fix: in the walk, a folder with part-shaped files and no manifest is an error.
test("G63-6 sweepFinals holds a published folder with part files but no manifest", () => {
  const pub = root(); const d = finalAt(pub); fs.rmSync(path.join(d, "manifest.json"));
  assert.equal(P.sweepFinals(pub, root()).ok, false);
});
