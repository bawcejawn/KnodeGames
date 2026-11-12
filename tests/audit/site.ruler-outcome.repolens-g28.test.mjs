// Repo Lens #G-28 G28-1: in an ON week the pages must show the Ruler's outcome for a pick, not the handicap one in W<week>.json.
// Hub chat: ruledPick returns outcome "void" (not "given back") for a race with no placings: the owner says picks are never returned (12 Nov).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const APP = new URL("../../", import.meta.url).pathname;
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(APP + "ruler-void.js", "utf8"), box);
const V = box.window.KRulerVoid;

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", D = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const card = JSON.stringify({ producers: [
  { a: B, entry: true, void: false, fpct: 900000, signed: 30 }, { a: C, entry: true, void: false, fpct: 800000, signed: 0 },
  { a: D, entry: true, void: false, fpct: 700000, signed: 12 }, { a: A, entry: true, void: true, fpct: 999999, signed: 50 }] });
const on = { v: 1, week: 4, mode: "on", shadow: false, races: [{ id: "r", card, placings: [B, C, D] }] };
const entry = on.races[0];

test("G28-1: ruledPick gives the Ruler's outcome in an ON week (handicap winner A is void, B won)", () => {
  assert.equal(typeof V.ruledPick, "function", "ruler-void.js needs ruledPick(entry, file, pick)");
  const W = (horse, right = 0, show = 0) => ["1Wallet111111111111111111111111111", horse, 0, right, 0, show];
  assert.equal(V.ruledPick(entry, on, W(A, 1)).outcome, "loss");       // handicap said win; the Ruler voided A
  assert.equal(V.ruledPick(entry, on, W(B)).outcome, "win");            // handicap said loss
  assert.equal(V.ruledPick(entry, on, W(C)).outcome, "loss");           // 2nd with 0 signed: no show (D-033)
  assert.equal(V.ruledPick(entry, on, W(D)).outcome, "show");
  const empty = { ...on, races: [{ id: "r", card, placings: [] }] };
  assert.equal(V.ruledPick(empty.races[0], empty, W(B)).outcome, "void");
  assert.equal(V.ruledPick({ id: "r", card: null, placings: [] }, on, W(B)).outcome, "waiting");
  const shadow = { ...on, mode: "shadow", shadow: true };
  assert.equal(V.ruledPick(entry, shadow, W(A, 1)), null);              // not ON: the W file decides
});

test("G28-1: results.js and race.js use ruledPick for win/show in ON weeks", () => {
  for (const f of ["results.js", "race.js"]) assert.match(fs.readFileSync(APP + f, "utf8"), /ruledPick\(/, `${f} should use KRulerVoid.ruledPick`);
});
