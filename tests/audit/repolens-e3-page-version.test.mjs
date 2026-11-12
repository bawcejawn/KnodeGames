// Repo Lens #E-3 H-1 (Producer Bracket): the page must accept the week files the recorder writes. The review's test,
// moved to the shared constant: the version now lives once, in bracket-math.js (FILE_V), read by the recorder, the
// page and (as a literal it is checked against) the publish job.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));
const BM = globalThis.KBracketMath;

test("E3-H1: the page accepts the week files the recorder writes (same file version)", () => {
  const page = read("bracket.js");
  const start = page.indexOf("  function valid(j, w) {"), end = page.indexOf("\n  }\n", start) + 4;
  const isAddrSrc = page.match(/const isAddr = [^\n]+/);
  assert.ok(start > 0 && isAddrSrc, "valid() and isAddr found in bracket.js");
  const ctx = { BM }; vm.runInNewContext(`${isAddrSrc[0]}\n${page.slice(start, end)}\nthis.valid = valid;`, ctx);
  const seeds = Array.from({ length: 8 }, (_, i) => "1" + "A".repeat(32) + "123456789A"[i]);
  const week = { v: rec.FILE_V, week: 3, status: "open", seeding: { size: 8, seeds }, days: [], points: [] };
  assert.equal(ctx.valid(week, 3), true, `the recorder writes v:${rec.FILE_V}; the page must show those weeks`);
  assert.equal(ctx.valid({ ...week, v: rec.FILE_V - 1 }, 3), false, "an older file version is not shown");
});

test("E3-H1: one version everywhere: recorder = shared math, and the publish job checks the same number", () => {
  assert.equal(rec.FILE_V, BM.FILE_V);
  const yml = read(".github/workflows/games.yml");
  assert.match(yml, new RegExp(`\\n\\s+FILE_V = ${BM.FILE_V}\\n`), "the publish job's FILE_V");
  assert.match(read("bracket.js"), /j\.v !== BM\.FILE_V/, "the page reads the shared constant");
});
