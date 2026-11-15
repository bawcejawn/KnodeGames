// Repo Lens #G-62 (PR #295 @ bb887ba0): one failing test per new finding in kit/parts/parts.inline.mjs.
// Paste into kit/tests/ (imports ../parts/). Every test here FAILS at bb887ba0 and passes once the matching fix lands.
// No exploit code: each only builds local temp folders.
// ADAPTED in #G-63 for e1b91fab (checkParts: `published` -> `publishedRoot` + `rel`). Unchanged, all five passed at
// e1b91fab VACUOUSLY (every call lacked publishedRoot/rel, so ok was false for that reason). Now every call passes
// valid options, each test has a passing control, and each refusal is matched by its reason. Mapping for G62-2:
// "published path missing" -> publishedRoot missing; "published = this folder" -> publishedRoot = the local root;
// "another week's folder" -> a week-3 manifest at rel. Scenarios otherwise unchanged. EXPECTED TO PASS at e1b91fab.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as P from "../parts/parts.inline.mjs";

const COL = [["x", "s"]];
const folder = (name = "T004") => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "g62f-")), name);
const M = (over = {}) => ({ game: "race", file: "T004", week: 4, state: "final", unit: "d", expect: ["d1"], writtenAt: 1, ...over });
const part = (p, v, file = "T004", game = "race") => P.encodePart({ game, file, part: p, cols: COL, rows: [[v]] });
const REL = "race-data/T004";
const root = () => fs.mkdtempSync(path.join(os.tmpdir(), "g62r-"));   // a published-branch checkout (empty = nothing published)
const O = (over = {}) => ({ game: "race", file: "T004", week: 4, full: ["d1"], publishedRoot: root(), rel: REL, ...over });
const errs = (c) => c.errors.join(" | ");

// G62-1 (Low): `game` is "required", but the check is GAME.test(String(game)) and String(undefined) is "undefined",
// which matches the game pattern. A caller that forgets `game` (or passes null) checks nothing about the game:
// another game's folder with the same file name and week passes.
test("G62-1 checkParts refuses a missing or null game", () => {
  const d = folder(); P.writeParts(d, M({ game: "blockx" }), [part("d1", "a", "T004", "blockx")]);
  assert.equal(P.checkParts(d, O({ game: "blockx" })).ok, true, "control");
  const noGame = O({ game: "blockx" }); delete noGame.game;
  assert.match(errs(P.checkParts(d, noGame)), /game is required/, "game is required (fail closed)");
  for (const g of [null, 0, [], { toString: () => "blockx" }]) assert.match(errs(P.checkParts(d, O({ game: g }))), /game is required/, String(g));
  assert.match(errs(P.checkParts(d, O({ game: "race" }))), /manifest game blockx, expected race/);
  for (const f of [undefined, null, 0, [], { toString: () => "T004" }]) assert.match(errs(P.checkParts(d, O({ game: "blockx", file: f }))), /file is required/, String(f));
});

// G62-2 (Low): `published` given as a path that doesn't exist (a typo, the wrong checkout, a branch not fetched) is
// treated exactly like `published: null` ("there is none"), so a rewritten final passes step 5b. Same when the caller
// passes this folder itself, or another file's/week's published folder. Fail closed: a string must be an existing
// folder (or its parent must exist), must not be baseDir, and its manifest (if any) must be this game/file/week.
test("G62-2 checkParts refuses a published path that is missing, is this folder, or is another week's folder", () => {
  const pubRoot = root();
  const pub = path.join(pubRoot, REL); P.writeParts(pub, M(), [part("d1", "final")]);
  const loc = root(); const re = path.join(loc, REL); P.writeParts(re, M(), [part("d1", "rewritten")]);
  assert.equal(P.checkParts(re, O()).ok, true, "control: alone it passes");
  assert.match(errs(P.checkParts(re, O({ publishedRoot: pubRoot }))), /published copy is final/);   // control: caught
  assert.match(errs(P.checkParts(re, O({ publishedRoot: path.join(pubRoot, "nope") }))), /doesn't exist/, "a missing root must not mean 'none'");
  assert.match(errs(P.checkParts(re, O({ publishedRoot: loc }))), /is the folder being checked/, "the published copy must not be the folder being checked");
  const r3 = root(); P.writeParts(path.join(r3, REL), M({ week: 3, state: "pending" }), [part("d1", "x")]);
  assert.match(errs(P.checkParts(re, O({ publishedRoot: r3 }))), /week 3/, "the published copy must be this file's folder");
  assert.match(errs(P.checkParts(re, O({ publishedRoot: pubRoot, rel: "race-data/T003" }))), /doesn't end in T004/);
});

// G62-3 (Low): step 5b holds only on a published manifest that fails JSON.parse. Valid JSON that isn't a kgparts
// manifest (`{}`, `null`, `[]`, a manifest whose state was damaged) is treated as "not final" and the run goes on,
// while the writer (line 240) refuses exactly these. The publish side should use the same test.
test("G62-3 a published manifest that parses but isn't a kgparts manifest holds the run", () => {
  const re = folder(); P.writeParts(re, M(), [part("d1", "rewritten")]);
  assert.equal(P.checkParts(re, O()).ok, true, "control");
  for (const bad of ["{}\n", "null\n", "[]\n", '{"kgparts":1,"state":"FINAL"}\n']) {
    const r = root(); const pub = path.join(r, REL); P.writeParts(pub, M(), [part("d1", "final")]);
    fs.writeFileSync(path.join(pub, "manifest.json"), bad);
    assert.match(errs(P.checkParts(re, O({ publishedRoot: r }))), /isn't a kgparts manifest/, `published manifest ${bad.trim()} must hold`);
  }
});

// G62-4 (Low): the writer checks that the folder holds only part-shaped files (G61-7) but not that it is THIS file's
// folder. Given another week's pending folder (W003 for a W004 run), it writes W004's parts there and deletes W003's.
// Fix: path.basename(baseDir) === meta.file, and an existing manifest's game/file/week must equal meta's.
test("G62-4 writeParts refuses another file's or week's parts folder", () => {
  const w3 = folder("T003"); P.writeParts(w3, M({ file: "T003", week: 3, state: "pending" }), [part("d1", "week3", "T003")]);
  const before = fs.readdirSync(w3).sort();
  assert.throws(() => P.writeParts(w3, M({ state: "pending" }), [part("d1", "week4")]), /stopping|folder/);
  assert.deepEqual(fs.readdirSync(w3).sort(), before, "week 3's parts must not be removed");
});

// G62-5 (Info): the folder itself may be a symlink. checkParts refuses links INSIDE the folder (§4 step 4) but not a
// linked base, and writeParts writes through one. A publish job that commits race-data/T004 would commit the link,
// not the checked files. Fix: lstat(baseDir) must be a real directory (checkParts) / a real directory or absent (writer).
test("G62-5 a parts folder that is itself a symlink is refused", () => {
  const real = folder("REAL"); fs.mkdirSync(real, { recursive: true });
  const ln = path.join(path.dirname(real), "T004"); fs.symlinkSync(real, ln);
  assert.throws(() => P.writeParts(ln, M({ state: "pending" }), [part("d1", "x")]), /link/);
  const real2 = folder("T004"); P.writeParts(real2, M({ state: "pending" }), [part("d1", "x")]);
  const ln2 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "g62l-")), "T004"); fs.symlinkSync(real2, ln2);
  const o = O(); delete o.full;
  assert.equal(P.checkParts(real2, o).ok, true, "control: the real folder passes");
  assert.match(errs(P.checkParts(ln2, o)), /is a link/, "a linked base must not pass step 4");
});
