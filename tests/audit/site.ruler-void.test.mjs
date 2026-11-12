// Hub: the Void mark and the Ruler page. ruler-void.js reads one race's ruler entry (race-data R<week>.json); results.js
// shows it. Read-only, plain text. Offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const APP = new URL("../../", import.meta.url).pathname;
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(`${APP}ruler-void.js`, "utf8"), sandbox);
const rulerVoids = (...a) => JSON.parse(JSON.stringify(sandbox.window.KRulerVoid.rulerVoids(...a)));   // plain objects (the helper runs in its own realm)
const A = "1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv", B = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const card = (ps) => JSON.stringify({ producers: ps });

test("a producer with void: true is listed; void: false is not", () => {
  const r = rulerVoids({ card: card([{ a: A, void: true }, { a: B, void: false }]), placings: [B] });
  assert.deepEqual(r, { has: true, shadow: false, wholeVoid: false, voids: [A] });
});
test("empty placings with a card means the whole race is void", () => {
  const r = rulerVoids({ card: card([{ a: A, void: true }, { a: B, void: true }]), placings: [] });
  assert.equal(r.wholeVoid, true);
  assert.deepEqual(r.voids, [A, B]);
});
test("shadow: true on the entry or on the file marks it a trial", () => {
  assert.equal(rulerVoids({ card: card([{ a: A, void: true }]), placings: [B], shadow: true }).shadow, true);
  assert.equal(rulerVoids({ card: card([{ a: A, void: true }]), placings: [B] }, { shadow: true }).shadow, true);
  assert.equal(rulerVoids({ card: card([]), placings: [B] }, { shadow: false }).shadow, false);
});
test("no card yet, a card that is not JSON, or no producers: no marks and no error", () => {
  for (const e of [null, undefined, {}, { card: "" }, { card: null }, { card: "{not json" }, { card: "[]" }, { card: "{}" }, { card: card([]) , placings: undefined }]) {
    const r = rulerVoids(e);
    assert.equal(r.wholeVoid, false);
    assert.deepEqual(r.voids, []);
  }
  assert.equal(rulerVoids({ card: "{not json" }).has, false);
  assert.equal(rulerVoids({ card: card([]), placings: [] }).wholeVoid, true, "a card with nobody in the placings is a whole void race");
});
test("only real addresses are listed (no markup or junk from the data)", () => {
  const r = rulerVoids({ card: card([{ a: "<img src=x>", void: true }, { a: A, void: "true" }, { a: B, void: true }]), placings: [B] });
  assert.deepEqual(r.voids, [B]);
});

const js = fs.readFileSync(`${APP}results.js`, "utf8"), home = fs.readFileSync(`${APP}index.html`, "utf8"), page = fs.readFileSync(`${APP}ruler.html`, "utf8");
test("results.js reads race-data R<week>.json by week number, draws with textContent, and never errors when it is missing", () => {
  assert.match(js, /race-data\/R\$\{String\(w\)\.padStart\(3, "0"\)\}\.json/);
  assert.match(js, /KRulerVoid\.rulerVoids/);
  assert.match(js, /Trial, counts for nothing/);
  assert.match(js, /picks are given back/);
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|eval\(/);
  assert.ok(home.indexOf("ruler-void.js") > 0 && home.indexOf("ruler-void.js") < home.indexOf("results.js") && home.includes('ruler-void.js"></script>\n  <script src="race-math.js"'), "the helper loads before results.js");
});
test("the Ruler page: from Week 1, the limits, picks, and the whole-void line; no banned words", () => {
  assert.match(page, /from Week 1 \(Monday 16 November\)/);
  assert.match(page, /a whole void race gives picks back/);
  for (const t of ["5%", "25%", "10%", "12%", "50%", "15%", "100%"]) assert.ok(page.includes(t), t);
  const text = page.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /\b(bet|bets|betting|odds|gambl\w*|earn\w*|returns?|guarantee\w*)\b/i);
  assert.ok(home.includes('href="ruler.html"'), "linked from the More menu");
});

test("Get VHP: Wormhole (Solana to Ethereum) and Vortex (Ethereum to Koinos) each have their own link, and the page says which does what", () => {
  const g = fs.readFileSync(`${APP}get.html`, "utf8");
  assert.match(g, /href="https:\/\/portalbridge\.com"[^>]*rel="noopener"/);
  assert.match(g, /Open Wormhole \(Solana to Ethereum\)/);
  assert.match(g, /Open Vortex bridge \(Ethereum to Koinos\)/);
  assert.match(g, /Wormhole<\/b> moves tokens between <b>Solana and Ethereum/);
  assert.match(g, /Vortex<\/b> moves them between <b>Ethereum and Koinos/);
  assert.ok(g.indexOf("Open Wormhole") < g.lastIndexOf("Open Vortex bridge"), "Solana users see Wormhole first, then Vortex");
});

test("Get VHP tells Wormhole users to paste the vKOIN contract address for each network", () => {
  const g = fs.readFileSync(`${APP}get.html`, "utf8");
  assert.match(g, /paste its Solana address from step 2/);
  assert.match(g, /Ethereum address in step 2: check they match/);
});
