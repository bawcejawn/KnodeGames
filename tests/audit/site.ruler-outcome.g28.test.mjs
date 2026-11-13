// Repo Lens #G-28 G28-1 (Medium) / G28-2 (Low): in a week the VHP ruler is ON for, the pages show the result the board
// pays (the ruler's 1st / 2nd / 3rd), not the handicap race's. ruler-void.js ruledOutcome / ruledPick, wired into
// results.js (the Hub's results) and race.js (the Race page's pick rows, 6-hour and typed). Offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const APP = new URL("../../", import.meta.url).pathname;
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(`${APP}ruler-void.js`, "utf8"), sandbox);
const KV = sandbox.window.KRulerVoid, plain = (x) => JSON.parse(JSON.stringify(x));
const A = "1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv", B = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr", C = "1DAHmrQJMAbn4FmMMrew78wPUizjVdbBrd", D = "15NZhQ8vD7hQgvZ1SHY3VvHsM33pF8DbXP";
const card = (ps) => JSON.stringify({ producers: ps });
const ON = { mode: "on", shadow: false }, SHADOW = { mode: "shadow", shadow: true };
const entry = { card: card([{ a: A, signed: 4 }, { a: B, signed: 2 }, { a: C, signed: 0 }, { a: D, signed: 3, void: true }]), placings: [A, B, C] };

test("G28-1: not a ruler-scored race (no file, off or shadow) gives null: the race's own standings stand", () => {
  assert.equal(KV.ruledOutcome(entry, null), null);
  assert.equal(KV.ruledOutcome(entry, { mode: "off" }), null);
  assert.equal(KV.ruledOutcome(entry, SHADOW), null);
});
test("G28-1: an ON week: 1st = placings[0]; a show = the ruler's 2nd or 3rd that signed a block (G15-1); a voided producer is a loss", () => {
  const o = plain(KV.ruledOutcome(entry, ON));
  assert.deepEqual(o, { pending: false, placings: [A, B, C], first: A, shows: [B], standings: [{ a: A }, { a: B }, { a: C }] });
  const R = KV.ruledOutcome(entry, ON);
  assert.deepEqual(plain(KV.ruledPick(R, A)), { win: true, show: false });
  assert.deepEqual(plain(KV.ruledPick(R, B)), { win: false, show: true });
  assert.deepEqual(plain(KV.ruledPick(R, C)), { win: false, show: false }, "3rd with 0 blocks signed: no show");
  assert.deepEqual(plain(KV.ruledPick(R, D)), { win: false, show: false }, "void: a loss");
});
test("G28-1: an ON week whose card hasn't come in is pending; an empty field scores no pick", () => {
  for (const e of [null, {}, { card: "" }, { card: "{bad", placings: [] }]) assert.deepEqual(plain(KV.ruledOutcome(e, ON)), { pending: true });
  const empty = KV.ruledOutcome({ card: card([{ a: A, void: true }]), placings: [] }, ON);
  assert.equal(empty.first, null); assert.deepEqual(plain(KV.ruledPick(empty, A)), { win: false, show: false });
});
test("G28-1: results.js scores a ruled race with the ruler's places (and waits while the ruler's card is pending)", () => {
  const js = fs.readFileSync(`${APP}results.js`, "utf8");
  assert.match(js, /KV\.ruledOutcome\(re, rf\)/);
  assert.match(js, /isWin = ruled \? \(p\) => KV\.ruledPick\(RO, p\[1\]\)\.win/);
  assert.match(js, /isShow = ruled \? \(p\) => KV\.ruledPick\(RO, p\[1\]\)\.show/);
  assert.match(js, /if \(status === "final" && RO && RO\.pending\) status = "ruler"/);
  assert.match(js, /M\.pagePick\(0, r\.start, st, my\[1\], isWin\(my\), isShow\(my\)\)/, "points from the ruled standings");
});
test("G28-1: race.js's finished pick rows (6-hour and typed) use the ruler's places in an ON week", () => {
  const js = fs.readFileSync(`${APP}race.js`, "utf8");
  assert.match(js, /function pickOutcome\(r, type, res, p\)/);
  assert.match(js, /const o = pickOutcome\(r, 0, r\.result, p\);/, "6-hour rows");
  assert.match(js, /const o = pickOutcome\(r, rtype, res, p\);/, "typed rows");
  assert.match(js, /KV\.ruledOutcome\(j\.races\.find\(\(e\) => e && e\.id === r\.id\), j\)/);
  assert.doesNotMatch(js, /\$\{nameOf\(r\.result\.winner \|\| ""\)\} won`/, "no handicap winner line left on the 6-hour rows");
});
test("G28-2: switching back to the 6-hour tab doesn't bring back the history table the Ruler's table replaces", () => {
  const js = fs.readFileSync(`${APP}race.js`, "utf8");
  assert.match(js, /h\.hidden = t !== 0 \|\| rulerHidesHistory/);
  assert.doesNotMatch(js, /\["live", "pick-zone", "history"\]/);
});
test("owner, 12 Nov: one result per race: in an ON week the Results table's winner is the ruler's 1st (Checking until its card is in), never the handicap race's", () => {
  const js = fs.readFileSync(`${APP}race.js`, "utf8"), h = js.slice(js.indexOf("function renderHistory"), js.indexOf("$(\"hist-rows\").replaceChildren"));
  assert.match(h, /const RO = status === "final" \? ruledFor\(r, 0\) : null;/);
  assert.match(h, /if \(RO && RO\.pending\) status = "checking";/);
  assert.match(h, /if \(ruled\) st = RO\.first \? \[\{ a: RO\.first \}\] : \[\];/);
  assert.match(js, /renderPicks\(\); renderHistory\(\);/, "redrawn once the ruler's files are in");
});
test("Repo Lens #G-45 G45-1: no handicap result while the ruler's file is missing for a week it may score (before load, failed fetch, or not in yet)", () => {
  const js = fs.readFileSync(`${APP}race.js`, "utf8"), rs = fs.readFileSync(`${APP}results.js`, "utf8");
  assert.match(js, /if \(!rulerReady\) return \{ pending: true \};/, "before the first ruler load");
  assert.match(js, /return rulerFailed\.has\(w\) \|\| \(Number\.isInteger\(from\) && w >= from\) \? \{ pending: true \} : null;/);
  assert.match(js, /if \(String\(e && e\.message\) !== "404"\) failed\.add\(x\)/, "a failed fetch (not a 404) counts as unknown");
  assert.match(rs, /this\.rulerFailed\.has\(this\.week\) \|\| \(Number\.isInteger\(this\.rulerFrom\) && this\.week >= this\.rulerFrom\) \? \{ pending: true \} : null/);
  assert.match(rs, /this\.rulerFailed\.add\(w\); this\.rtried\.delete\(w\);/, "tried again next time");
});
