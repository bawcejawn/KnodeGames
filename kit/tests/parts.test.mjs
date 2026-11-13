// KG parts v1 (kit/parts/parts.inline.mjs): round trips, canonical bytes, the part-set hash, and every refusal of the
// publish-side check (docs/capacity/PARTS-SPEC.md §4). Capacity chat.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import * as P from "../parts/parts.inline.mjs";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i) => { const h = crypto.createHash("sha256").update(`p${i}`).digest(); let s = "1"; for (let k = 0; k < 33; k++) s += B58[h[k % 32] % 58]; return s; };
const COLS = [["player", "a"], ["race", "i"], ["pick", "a"], ["t", "i"]];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "kgparts-"));
const rowsFor = (n, race = 1) => Array.from({ length: n }, (_, i) => [addr(i), race, addr(1000 + (i % 25)), 60 * i]);
const meta = (over = {}) => ({ game: "race", file: "T004", week: 4, state: "pending", unit: "d", expect: ["d1", "d2"], writtenAt: 1795737600000, ...over });

test("KP-1 round trip: rows come back as written, addresses resolved", () => {
  const rows = rowsFor(50);
  const p = P.encodePart({ game: "race", file: "T004", part: "d1", t0: 1795564800000, cols: COLS, rows, extra: { tUnit: "s" } });
  const d = P.decodePart(p.text);
  assert.equal(d.rows.length, 50);
  assert.equal(d.header.extra.tUnit, "s");
  const back = new Set(d.rows.map((r) => `${r.player}|${r.race}|${r.pick}|${r.t}`));
  for (const r of rows) assert.ok(back.has(r.join("|")));
  assert.equal(p.name, `d1.${p.sha256.slice(0, 12)}.json`);
});

test("KP-2 canonical: the same content in any order gives the same bytes and name", () => {
  const rows = rowsFor(30);
  const a = P.encodePart({ game: "race", file: "T004", part: "d1", cols: COLS, rows });
  const b = P.encodePart({ game: "race", file: "T004", part: "d1", cols: COLS, rows: [...rows].reverse() });
  assert.equal(a.text, b.text);
  assert.equal(a.name, b.name);
  assert.throws(() => P.decodePart(a.text.replace('"kgparts":1,"game"', '"game":"race","kgparts":1,"x"')), /kit\/parts/);
  assert.throws(() => P.decodePart(JSON.stringify(JSON.parse(a.text), null, 1)), /canonical/);
});

test("KP-3 compact: each address once per part; picks are small numbers", () => {
  // 20,000 different players, one pick each (one race): the address is the cost, ~60 bytes a row (today ~104).
  const one = P.encodePart({ game: "race", file: "W004", part: "r001", cols: COLS, rows: rowsFor(20_000) });
  assert.ok(one.bytes / 20_000 < 65, `bytes a row ${one.bytes / 20_000}`);
  assert.ok(one.bytes < P.WARN_BYTES);
  // 2,000 players with 24 picks each in one part (a day of hourly targets): ~20 bytes a pick.
  const many = [];
  for (let i = 0; i < 2000; i++) for (let k = 0; k < 24; k++) many.push([addr(i), k, addr(1000 + ((i + k) % 25)), 3600 * k + i]);
  const day = P.encodePart({ game: "blockx", file: "W004", part: "d1", cols: [["player", "a"], ["target", "i"], ["pick", "a"], ["t", "i"]], rows: many });
  assert.ok(day.bytes / many.length < 25, `bytes a pick ${day.bytes / many.length}`);
});

test("KP-4 bad values and names are refused", () => {
  const ok = { game: "race", file: "T004", part: "d1", cols: COLS, rows: rowsFor(2) };
  assert.throws(() => P.encodePart({ ...ok, part: "d8" }), /bad part/);
  assert.throws(() => P.encodePart({ ...ok, part: "../x" }), /bad part/);
  assert.throws(() => P.encodePart({ ...ok, game: "Race!" }), /bad game/);
  assert.throws(() => P.encodePart({ ...ok, rows: [["notanaddress", 1, addr(1), 0]] }), /not an address/);
  assert.throws(() => P.encodePart({ ...ok, rows: [[addr(1), 1.5, addr(2), 0]] }), /whole number/);
  assert.throws(() => P.encodePart({ ...ok, cols: [["x", "q"]], rows: [] }), /bad column/);
  assert.throws(() => P.encodePart({ ...ok, cols: [["s", "s"]], rows: Array.from({ length: 40_000 }, (_, i) => ["x".repeat(55) + i]) }), /over the .* cap/);
});

test("KP-5 write + check: a good folder passes and decodes", () => {
  const dir = path.join(tmp(), "T004");
  const parts = [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COLS, rows: rowsFor(10, 1) }), P.encodePart({ game: "race", file: "T004", part: "d2", cols: COLS, rows: rowsFor(12, 2) })];
  const { manifest } = P.writeParts(dir, meta(), parts);
  assert.equal(manifest.rows, 22);
  const c = P.checkParts(dir, { game: "race", file: "T004", week: 4 });
  assert.deepEqual(c.errors, []);
  assert.equal(c.ok, true);
  assert.equal(c.parts.length, 2);
  assert.equal(c.parts[1].rows.length, 12);
});

test("KP-6 the check refuses: missing unit, changed part, extra file, renamed part, folder, wrong week", () => {
  const base = tmp();
  const mk = (name, extraMeta = {}) => { const dir = path.join(base, name); P.writeParts(dir, meta(extraMeta), [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COLS, rows: rowsFor(5) })]); return dir; };
  // expect d1 and d2, only d1 written
  let d = mk("a");
  assert.match(P.checkParts(d).errors.join(" "), /missing part d2/);
  // a part's bytes changed
  d = mk("b", { expect: ["d1"] });
  const f = fs.readdirSync(d).find((x) => x.startsWith("d1."));
  fs.writeFileSync(path.join(d, f), fs.readFileSync(path.join(d, f), "utf8").replace('"t0":0', '"t0":1'));
  assert.match(P.checkParts(d).errors.join(" "), /SHA-256 doesn't match/);
  // an extra (stale) file
  d = mk("c", { expect: ["d1"] });
  fs.writeFileSync(path.join(d, "d2.aaaaaaaaaaaa.json"), "{}\n");
  assert.match(P.checkParts(d).errors.join(" "), /not listed in the manifest/);
  // a renamed part
  d = mk("d", { expect: ["d1"] });
  const g = fs.readdirSync(d).find((x) => x.startsWith("d1."));
  fs.renameSync(path.join(d, g), path.join(d, "d1.000000000000.json"));
  assert.match(P.checkParts(d).errors.join(" "), /missing/);
  // a folder other than p/
  d = mk("e", { expect: ["d1"] });
  fs.mkdirSync(path.join(d, "x")); fs.writeFileSync(path.join(d, "x", "y.json"), "{}");
  assert.match(P.checkParts(d).errors.join(" "), /no folders except p\//);
  // wrong week asked
  d = mk("f", { expect: ["d1"] });
  assert.match(P.checkParts(d, { week: 5 }).errors.join(" "), /manifest week 4, expected 5/);
  // a tampered manifest (hash)
  d = mk("g", { expect: ["d1"] });
  const m = JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf8")); m.week = 9; fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(m) + "\n");
  assert.match(P.checkParts(d).errors.join(" "), /part-set hash doesn't match/);
});

test("KP-7 a final folder never changes: same set is a no-op, a different set stops", () => {
  const dir = path.join(tmp(), "W004");
  const p1 = [P.encodePart({ game: "race", file: "W004", part: "r001", cols: COLS, rows: rowsFor(5) })];
  P.writeParts(dir, meta({ file: "W004", unit: "r", expect: ["r001"], state: "final" }), p1);
  const again = P.writeParts(dir, meta({ file: "W004", unit: "r", expect: ["r001"], state: "final" }), p1);
  assert.equal(again.written, 0);
  const p2 = [P.encodePart({ game: "race", file: "W004", part: "r001", cols: COLS, rows: rowsFor(6) })];
  assert.throws(() => P.writeParts(dir, meta({ file: "W004", unit: "r", expect: ["r001"], state: "pending" }), p2), /is final/);
  assert.equal(P.checkParts(dir, { full: ["r001"] }).ok, true);
  assert.match(P.checkParts(dir, { full: ["r001", "r002"] }).errors.join(" "), /doesn't expect r002/);
});

test("KP-8 a pending folder drops parts that are no longer listed (in the same write)", () => {
  const dir = path.join(tmp(), "T004");
  P.writeParts(dir, meta({ expect: ["d1"] }), [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COLS, rows: rowsFor(3) })]);
  P.writeParts(dir, meta({ expect: ["d1"] }), [P.encodePart({ game: "race", file: "T004", part: "d1", cols: COLS, rows: rowsFor(4) })]);
  assert.equal(fs.readdirSync(dir).filter((x) => x.startsWith("d1.")).length, 1);
  assert.equal(P.checkParts(dir).ok, true);
});

test("KP-9 shards and size warnings", () => {
  const counts = new Map();
  for (let i = 0; i < 1600; i++) { const s = P.shardOf(addr(i), 16); counts.set(s, (counts.get(s) || 0) + 1); }
  assert.equal(counts.size, 16);
  for (const n of counts.values()) assert.ok(n > 60 && n < 140, `shard size ${n}`);
  assert.equal(P.shardOf(addr(1), 256).length, 2);
  const w = P.sizeWarnings([{ name: "a", bytes: 1_300_000 }, { name: "b", bytes: 1_000_000 }]);
  assert.equal(w.length, 1);
  assert.match(w[0].message, /62% of the 2 MB cap/);
});

test("KP-10 the part-set hash is pinned (any change to the formula is deliberate)", () => {
  const h = P.partSetHash({ game: "race", file: "T004", week: 4 }, [{ part: "d1", sha256: "a".repeat(64), bytes: 10 }, { part: "d2", sha256: "b".repeat(64), bytes: 20 }]);
  const want = crypto.createHash("sha256").update(`kgparts1\nrace\nT004\n4\nd1 ${"a".repeat(64)} 10\nd2 ${"b".repeat(64)} 20\n`).digest("hex");
  assert.equal(h, want);
});

test("KP-11 self-contained: imports only node:fs, node:path, node:crypto", () => {
  const src = fs.readFileSync(new URL("../parts/parts.inline.mjs", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["node:crypto", "node:fs", "node:path"]);
});

test("KP-12 planParts (Architecture A2): the files to write, no file system; same hash as writeParts", () => {
  const parts = [P.encodePart({ game: "fantasy", file: "W006", part: "d1", cols: COLS, rows: rowsFor(4) }), P.encodePart({ game: "fantasy", file: "W006", part: "wk", cols: [["k", "s"]], rows: [["carry"]], extra: { carry: 0 } })];
  const m = { game: "fantasy", file: "W006", week: 6, state: "pending", unit: "d", expect: ["d1"], writtenAt: 1 };
  const plan = P.planParts(m, parts, null);
  assert.equal(plan.files.at(-1).name, "manifest.json");
  assert.equal(plan.files.length, 3);
  assert.ok(plan.files.some((f) => f.name.startsWith("wk.")));
  const dir = path.join(tmp(), "W006");
  const w = P.writeParts(dir, m, parts);
  assert.equal(w.manifest.hash, plan.hash);
  const fin = P.planParts({ ...m, state: "final" }, parts, null);
  assert.equal(P.planParts({ ...m, state: "final" }, parts, fin.manifest).unchanged, true);
  assert.throws(() => P.planParts(m, [parts[0]], fin.manifest), /final/);
});
