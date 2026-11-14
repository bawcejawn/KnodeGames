// Repo Lens #G-72 (PR #311 "Race board: fixed VHP order, animal inside the bar on one scale, time ruler"): checks of
// the fixed producer order, the animal's position helper (POS) and a past 6-hour race opened with "View".
// Needs race-dom-harness.mjs next to it. Run: TZ=UTC node --import tsx --test --test-concurrency=1 <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as H from "./race-dom-harness.mjs";

const APP = fileURLToPath(new URL("../../", import.meta.url));
const js = fs.readFileSync(`${APP}race.js`, "utf8");
const { A, Bp, C, D } = H;

// The typed board's order block, exactly as race.js has it (rtBoard), run on its own.
function typedOrderFn() {
  const s = js.indexOf("let order = rtFixed.get(fkey);"), e = js.indexOf("const by = new Map((st || [])", s);
  assert.ok(s > 0 && e > s, "rtBoard order block found");
  return new Function("rtFixed", "fkey", "card", "st", `${js.slice(s, e)}; return order;`);
}
const cardOf = (pairs) => ({ field: pairs.map(([a, vhp]) => ({ a, vhp, h: 1, k: 20 })), paddock: [] });
const stOf = (as) => as.map((a, i) => ({ a, steps: 10 - i, blocks: 1, last: i }));

test("G72 #311 (2): typed board: biggest VHP first; ties by address; the order is kept while the field is the same", () => {
  const f = typedOrderFn(), m = new Map();
  assert.deepEqual(f(m, "3:1", cardOf([[A, 100], [Bp, 300], [C, 100]]), stOf([A, Bp, C])), [Bp, A, C]);
  // a later hour's card with other VHP: same producers, so the order is not rebuilt
  assert.deepEqual(f(m, "3:1", cardOf([[A, 900], [Bp, 1], [C, 5]]), stOf([C, A, Bp])), [Bp, A, C]);
});

// Repo Lens #G-72 G72-3 (Low): when a producer who was not in the order joins mid-race (it enters a later hour's
// field), the whole order is rebuilt and re-sorted by THAT hour's VHP, so producers already on the board can swap.
// Fails at a15267c5 (and 36250562): [A, Bp, C, D] expected, got [Bp, C, A, D] or similar.
test("G72-3: typed board: a newcomer mid-race goes last; the producers already shown keep their places", () => {
  const f = typedOrderFn(), m = new Map();
  assert.deepEqual(f(m, "4:7", cardOf([[A, 300], [Bp, 200], [C, 100]]), stOf([A, Bp, C])), [A, Bp, C]);
  const later = f(m, "4:7", cardOf([[A, 50], [Bp, 200], [C, 400], [D, 500]]), stOf([C, A, Bp, D]));
  assert.deepEqual(later.slice(0, 3), [A, Bp, C], `order during the race became ${later.map((a) => a[1]).join("")}`);
  assert.equal(later[3], D);
});

test("G72 #311 (2): typed board: no card yet: the order is not stored, so the card fixes it when it comes", () => {
  const f = typedOrderFn(), m = new Map();
  f(m, "1:5", null, stOf([C, A]));
  assert.equal(m.has("1:5"), false);
  assert.deepEqual(f(m, "1:5", cardOf([[A, 10], [C, 5]]), stOf([C, A])), [A, C]);
});

// POS: the animal's centre on one scale; the animal is 40 px wide and drawn at calc(POS(f) - 20px).
function posFn() {
  const m = /const POS = (\(f\) => `[^`]*`);/.exec(js);
  assert.ok(m, "POS helper found");
  return new Function(`return ${m[1]};`)();
}
test("G72 #311 (1): POS keeps the animal inside the bar for any progress (below 0, above 1, huge)", () => {
  const POS = posFn();
  for (const f of [-5, -0.01, 0, 0.5, 1, 1.0001, 7, 1e12]) {
    const k = Number(/\* (-?[\d.]+)\)$/.exec(POS(f))[1]);
    assert.ok(k >= 0 && k <= 1, `f=${f} gives ${POS(f)}`);   // left edge = (100% - 40px) * k, inside [0, 100% - 40px]
  }
  assert.equal(POS(0), "calc(20px + (100% - 40px) * 0.0000)");
  assert.equal(POS(1), "calc(20px + (100% - 40px) * 1.0000)");
  assert.match(js, /\.pr-horse"\)\.style\.left = `calc\(\$\{POS\(xf\)\} - 20px\)`/, "6-hour board uses POS");
  assert.match(js, /left:calc\(\$\{POS\(x \/ 100\)\} - 20px\)/, "typed board uses POS");
  assert.match(js, /pr-nowline"\)\.style\.left = POS\(frac\)/, "6-hour Now line on the same scale");
  assert.match(js, /pr-nowline", style: `left:\$\{POS\(frac\)\}`/, "typed Now line on the same scale");
});

// Repo Lens #G-72 G72-5 (Info): a non-number progress (a stored standing without steps gives NaN in KRaceMath.track)
// makes POS write "NaN" into the CSS; the browser drops the rule and the animal falls back to the left edge.
// Harmless (never past the bar) but a one-word guard makes it explicit. Fails at a15267c5.
test("G72-5: POS of NaN is a number (0), not 'NaN'", () => {
  assert.doesNotMatch(posFn()(NaN), /NaN/);
});

const field = [[A, 100, 1], [Bp, 300, 0.5], [C, 50, 1.2]];
const st = [{ a: A, steps: 30, blocks: 30, last: 1 }, { a: Bp, steps: 25, blocks: 50, last: 2 }, { a: C, steps: 10, blocks: 8, last: 3 }];

test("G72 #311 (2)/(3): past 6-hour race from View: lanes by first-leg VHP, a producer not in that card goes last, no Pick columns, no errors", async () => {
  const wf = H.weekFile(3, "2026-11-14T12", "2026-11-14T18", [...st, { a: D, steps: 40, blocks: 4, last: 4 }], field);
  wf.races[0].cards[3] = H.card([...field, [D, 999, 1]], 0);   // D only from leg 4
  const p = await H.boot({ app: APP, now: Date.parse("2026-11-14T19:00:00Z"), files: { "W003.json": wf, "R003.json": "404", "R002.json": "500" } });
  await p.viewRace("2026-11-14T12");
  assert.deepEqual(p.lanes().map((l) => l.a), [Bp, A, C, D]);
  assert.equal(p.doc.querySelectorAll("#track .rt-pk").length, 0, "no Pick columns on a past race");
  assert.deepEqual(p.errors, []);
});

test("G72 #311 (3): past 6-hour race from View with no cards stored and no R files (404): draws, no errors", async () => {
  const wf = H.weekFile(3, "2026-11-14T12", "2026-11-14T18", st, field);
  delete wf.races[0].cards;
  const p = await H.boot({ app: APP, now: Date.parse("2026-11-14T19:00:00Z"), files: { "W003.json": wf, "R002.json": "404", "R003.json": "404" } });
  await p.tick(6000);   // the next refresh redraws the Results table (a 404-only ruler load returns before redrawing it)
  await p.viewRace("2026-11-14T12");
  assert.equal(p.lanes().length, 3);
  assert.equal(p.doc.querySelectorAll("#track .rt-pk").length, 0);
  assert.deepEqual(p.errors, []);
});

// Repo Lens #G-72 G72-4 (Low): the 6-hour board's "fixed" order comes from the race's first card; while the race runs
// on the page's provisional card (before the recorder publishes one), that card is remade every 10 minutes from fresh
// VHP, and again when the recorder's card arrives, so the line-up can reshuffle mid-race. Fails at a15267c5.
test("G72-4: live 6-hour race on a provisional card: the order does not change when the provisional card is remade", async () => {
  const now0 = Date.parse("2026-11-16T07:00:00Z");
  const blocks = (T) => { const ts = [], sig = []; for (let t = T - 7 * 3600000, i = 0; t <= T; t += 30000, i++) { ts.push(t); sig.push(i % 3); } return { ts, sig, signers: [A, Bp, C], from: 1, top: ts.length }; };
  const vhp = { [A]: 100, [Bp]: 300, [C]: 200 };
  const p = await H.boot({ app: APP, now: now0, files: { "W004.json": { v: 1, week: 4, races: [] } }, vhp, blocks });
  const first = p.lanes().map((l) => l.a);
  assert.deepEqual(first, [Bp, C, A]);
  vhp[A] = 1000;   // A's VHP grows during the race
  await p.tick(11 * 60000);
  assert.deepEqual(p.lanes().map((l) => l.a), first, "the line-up reshuffled mid-race");
});

test("G72 #311: time ruler marks per race length, and the places pill is hidden when nothing moved", () => {
  const m = /function rulerEl\(len, step\) \{[\s\S]*?\n  \}/.exec(js);
  assert.ok(m);
  const ticks = (len, step) => { const out = []; for (let t = step; t < len - 1; t += step) out.push(t); return out.length; };
  assert.equal(ticks(6 * 3600000, 3600000), 5);       // 1h..5h, then "finish"
  assert.equal(ticks(3600000, 15 * 60000), 3);        // 15m, 30m, 45m
  assert.equal(ticks(7200000, 30 * 60000), 3);        // 30m, 60m, 90m
  assert.equal(ticks(86400000, 6 * 3600000), 3);      // 6h, 12h, 18h
  assert.match(js, /\{ 1: 15 \* 60000, 2: 30 \* 60000, 3: 6 \* HOURMS, 4: DAYMS \}\[rtype\]/);
  assert.match(js, /pill\.hidden = dd == null \|\| dd === 0;/);
  assert.match(js, /before\.get\(a\) !== rk\)/);
});
