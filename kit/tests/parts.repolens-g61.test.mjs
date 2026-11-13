// Repo Lens #G-61 (PR #295 @ b10b5096): one failing test per finding in kit/parts/parts.inline.mjs and
// tools/capacity/limits.mjs. Paste into kit/tests/ (imports ../parts/ and ../../tools/capacity/). Every test here
// FAILS at b10b5096 and passes once the matching fix lands. No exploit code: each only builds a local temp folder.
// ADAPTED in #G-63 for e1b91fab. Since G61-1 was fixed, checkParts(dir) with no options fails closed for that reason
// alone, so G61-1/3/4/4b passed vacuously. Each now passes every required option (game, file = folder name, week,
// full, publishedRoot = an empty checkout, rel) except the one under test, asserts the untampered folder passes first,
// and asserts the specific refusal. Folders are named after their file. Scenarios unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as P from "../parts/parts.inline.mjs";
import { runsPerDay } from "../../tools/capacity/limits.mjs";

const COL = [["x", "s"]];
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `g61-${n}-`));
const M = (over = {}) => ({ game: "race", file: "T004", week: 4, state: "final", unit: "d", expect: ["d1"], writtenAt: 1, ...over });
const part = (p, v, file = "T004") => P.encodePart({ game: "race", file, part: p, cols: COL, rows: [[v]] });
const named = (n, file = "T004") => path.join(tmp(n), file);
const CK = (file = "T004", over = {}) => ({ game: "race", file, week: 4, full: ["d1"], publishedRoot: tmp("pub"), rel: `race-data/${file}`, ...over });
const errs = (c) => c.errors.join(" | ");

// G61-1 (Medium): checkParts on a FINAL manifest without `full` passes even when the final misses units.
test("G61-1 checkParts refuses a final manifest when the game's full unit list isn't given", () => {
  const dir = named("g1");
  P.writeParts(dir, M({ expect: ["d1"] }), [part("d1", "a")]);           // a "final" holding only day 1 of 7
  const o = CK(); delete o.full;
  const c = P.checkParts(dir, o);                                         // publish job forgot `full`
  assert.equal(c.ok, false, "a final must be checked against the game's full list (full is required for final)");
  assert.match(errs(c), /full unit list/);
  assert.match(errs(P.checkParts(dir, CK("T004", { full: ["d1", "d2", "d3", "d4", "d5", "d6", "d7"] }))), /doesn't expect d2/);
  assert.equal(P.checkParts(dir, CK()).ok, true);                         // control: a 1-unit game passes
});

// G61-2 (Medium): a final whose manifest.json can't be parsed is treated as "no previous manifest":
// writeParts rewrites the folder and DELETES the final's parts.
test("G61-2 writeParts never rewrites a folder whose existing manifest.json is unreadable", () => {
  const dir = named("g2");
  P.writeParts(dir, M(), [part("d1", "final-data")]);
  const finalPart = fs.readdirSync(dir).find((f) => f.startsWith("d1."));
  const mp = path.join(dir, "manifest.json");
  fs.writeFileSync(mp, "<<<<<<< HEAD\n" + fs.readFileSync(mp, "utf8") + "=======\n>>>>>>> other\n"); // e.g. a merge conflict / torn write
  let threw = false;
  try { P.writeParts(dir, M({ state: "pending" }), [part("d1", "new-data")]); } catch { threw = true; }
  assert.ok(fs.existsSync(path.join(dir, finalPart)), "the final's part file must not be deleted");
  assert.equal(threw, true, "an unreadable existing manifest must stop the run");
});

// G61-3 (Low): the hash is taken over the UTF-8 *decoded* text, not the bytes on disk. A file whose bytes differ
// (an invalid UTF-8 sequence of the same length in place of U+FFFD) passes checkParts.
test("G61-3 checkParts hashes the exact bytes on disk", () => {
  const dir = named("g3");
  P.writeParts(dir, M({ state: "pending" }), [part("d1", "�")]);
  assert.equal(P.checkParts(dir, CK()).ok, true, "control: untouched passes");
  const f = path.join(dir, fs.readdirSync(dir).find((x) => x.startsWith("d1.")));
  const buf = fs.readFileSync(f);
  const i = buf.indexOf(Buffer.from([0xef, 0xbf, 0xbd]));
  buf[i] = 0xf0; buf[i + 1] = 0x9f; buf[i + 2] = 0x98;                // same length, different bytes, invalid UTF-8
  fs.writeFileSync(f, buf);
  const c = P.checkParts(dir, CK());
  assert.equal(c.ok, false, "different bytes than the manifest's sha256 must be refused");
  assert.doesNotMatch(errs(c), /required/, "refused for the bytes, not for a missing option");
});

// G61-4 (Low): checkParts doesn't hold the manifest to buildManifest's rules: unknown keys, bad unit/shards,
// negative week, more than MAX_PARTS parts all pass.
test("G61-4 checkParts refuses manifest fields buildManifest would never write", () => {
  const dir = named("g4");
  P.writeParts(dir, M({ state: "pending" }), [part("d1", "a")]);
  assert.equal(P.checkParts(dir, CK()).ok, true, "control: untouched passes");
  const mp = path.join(dir, "manifest.json");
  const m = JSON.parse(fs.readFileSync(mp, "utf8"));
  m.scores = { winner: "1PohKjqT17jHKXsF5MbBbZbmsZ9ws7hHMM" }; m.unit = "zz"; m.shards = 7;
  fs.writeFileSync(mp, JSON.stringify(m) + "\n");
  const c = P.checkParts(dir, CK());
  assert.equal(c.ok, false, "unknown key / bad unit / bad shards must be refused");
  assert.doesNotMatch(errs(c), /required/, "refused for the manifest, not for a missing option");
});

test("G61-4b checkParts refuses more than MAX_PARTS (600) parts", () => {
  const dir = named("g4b", "W004"); fs.mkdirSync(dir);
  const parts = Array.from({ length: 601 }, (_, i) => part(`r${String(i + 1).padStart(3, "0")}`, "a", "W004"));
  // buildManifest refuses 601, so hand-write a manifest the way a buggy recorder could
  for (const p of parts) fs.writeFileSync(path.join(dir, p.name), p.text);
  const list = parts.map(({ part: q, name, bytes, sha256, rows }) => ({ part: q, name, bytes, sha256, rows }));
  const m = { kgparts: 1, game: "race", file: "W004", week: 4, state: "pending", writtenAt: 1, unit: "r", expect: [], shards: 0, parts: list, rows: 601 };
  m.hash = P.partSetHash(m, list);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(m) + "\n");
  const c = P.checkParts(dir, CK("W004", { full: undefined }));
  assert.equal(c.ok, false, "601 parts must be refused by the check too");
  assert.doesNotMatch(errs(c), /required/, "refused for the count, not for a missing option");
});

// G61-5 (Low): `extra` keeps the caller's key order, so the same logical part can have two different byte texts,
// and decodePart accepts both.
test("G61-5 extra is canonical: key order doesn't change the bytes", () => {
  const a = P.encodePart({ game: "race", file: "T004", part: "d1", cols: COL, rows: [], extra: { tUnit: "s", id: 1 } });
  const b = P.encodePart({ game: "race", file: "T004", part: "d1", cols: COL, rows: [], extra: { id: 1, tUnit: "s" } });
  assert.equal(a.text, b.text);
});

// G61-6 (Low): a sparse array in a j value encodes to "[,1]" (not JSON), so the writer produces a part the check refuses.
test("G61-6 encodePart refuses a j value its own decoder would refuse (sparse array)", () => {
  // eslint-disable-next-line no-sparse-arrays
  const v = [, 1];
  assert.throws(() => P.encodePart({ game: "race", file: "T004", part: "d1", cols: [["j", "j"]], rows: [[v]] }));
});

// G61-7 (Low): writeParts deletes every unlisted file under baseDir, recursively, with no limit to part-shaped names.
// Pointed at a parent folder (a wrong base), it wipes other weeks, finals included.
test("G61-7 writeParts never deletes files that aren't part files of this folder", () => {
  const base = tmp("g7");
  P.writeParts(path.join(base, "T003"), M({ week: 3, file: "T003" }), [part("d1", "a", "T003")]);  // last week's final
  try { P.writeParts(base, M({ state: "pending" }), [part("d1", "b")]); } catch { /* refusing is the fix */ } // wrong baseDir
  assert.ok(fs.existsSync(path.join(base, "T003", "manifest.json")), "another week's final must survive");
});

// G61-8 (Info): runsPerDay counts commented-out cron lines.
test("G61-8 runsPerDay ignores commented-out cron lines", () => {
  assert.equal(runsPerDay('on:\n  schedule:\n    # - cron: "*/5 * * * *"\n    - cron: "0 1 * * *"\n'), 1);
});
