// Combo Card: the Block X leg worth (owner D-188, Sun 15 Nov 2026). A Block X leg is worth 0.25 ÷ chance, from ×0.25
// to ×6; race legs are unchanged (0.5 ÷ chance, ×0.25 to ×3). These tests pin both families at every edge, check that
// the publish job's Python (combo.yml) accepts exactly the worths the JS can give, and that the biggest card stays an
// exact integer.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await import(path.resolve(APP, "race-math.js"));
await import(path.resolve(APP, "blockx-math.js"));
await import(path.resolve(APP, "combo-math.js"));
const C = globalThis.KCombo;

const H1 = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", H2 = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", H3 = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
/** The old single rule, kept here only to show race legs didn't move. */
const oldF100 = (ch) => (ch > 0 ? Math.min(300, Math.max(25, Math.floor(50 / ch + 1e-9))) : 300);

test("D-188: the worth rules by family (hundredths): race 50 / chance in 25..300, Block X 25 / chance in 25..600", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(C.WORTH100)), { race: { num: 50, min: 25, max: 300 }, block: { num: 25, min: 25, max: 600 } });
  assert.equal(C.PREF, 0.5); assert.equal(C.F_MIN, 0.25); assert.equal(C.F_MAX, 3);
  assert.equal(C.BLOCK_PREF, 0.25); assert.equal(C.BLOCK_F_MAX, 6);
  assert.ok(Object.isFrozen(C.WORTH100) && Object.isFrozen(C.WORTH100.block));
  assert.throws(() => C.factorOf(0.1, "window"), /no worth rule/);
});

test("race legs are unchanged: the same worth as before at every chance from 0 to 1 (step 0.0001)", () => {
  for (let i = 0; i <= 10000; i++) {
    const ch = i / 1e4;
    assert.equal(C.factorOf(ch), oldF100(ch) / 100, `chance ${ch}`);
    assert.equal(C.factorOf(ch, "race"), oldF100(ch) / 100, `chance ${ch}`);
  }
});

test("Block X worth at its edges: ×0.25 floor, the owner's table, the ×6 cap and where it starts, rounded down", () => {
  // The floor: 0.25 ÷ chance ≥ 0.25 for any chance ≤ 1, so the floor is reached only at a chance of 1 (one producer).
  assert.equal(C.factorOf(1, "block"), 0.25);
  assert.equal(C.factorOf(0.9999, "block"), 0.25);
  // The owner's table (TO-CHATS-BLOCKX-WORTH-AND-BLOCK-GAMES, 15 Nov): rounded down to the hundredth (RL-17).
  assert.equal(C.factorOf(0.178, "block"), 1.40);
  assert.equal(C.factorOf(0.134, "block"), 1.86);   // the table's ×1.87 rounded; the rule rounds down
  assert.equal(C.factorOf(0.095, "block"), 2.63);
  assert.equal(C.factorOf(0.069, "block"), 3.62);
  assert.equal(C.factorOf(0.049, "block"), 5.10);
  assert.equal(C.factorOf(0.025, "block"), 6);
  // ×1 at a 25% share; above ×3 (the old cap) below 8.33%.
  assert.equal(C.factorOf(0.25, "block"), 1);
  assert.equal(C.factorOf(0.0834, "block"), 2.99); assert.equal(C.factorOf(0.0833, "block"), 3.00); assert.equal(C.factorOf(0.0832, "block"), 3.00);
  assert.equal(C.factorOf(0.0830, "block"), 3.01);
  // The ×6 cap starts at a share of 25 / 600 = 4.1667%: 4.17% → 5.99, 4.16% → 6.
  assert.equal(C.factorOf(0.0418, "block"), 5.98);
  assert.equal(C.factorOf(0.0417, "block"), 5.99);
  assert.equal(C.factorOf(0.0416, "block"), 6);
  assert.equal(C.factorOf(0.0001, "block"), 6);
  assert.equal(C.factorOf(0, "block"), 6, "a chance of 0 gets the family's cap, as the race rule");
  // Every Block X worth sits in 25..600 and never above the race rule's doubled cap.
  for (let i = 0; i <= 10000; i++) {
    const f = Math.round(C.factorOf(i / 1e4, "block") * 100);
    assert.ok(Number.isInteger(f) && f >= 25 && f <= 600, `chance ${i / 1e4}: ${f}`);
  }
});

test("priceLeg uses the Block X rule for Block X legs only; a producer missing from the card stays ×1", () => {
  // 7 producers: H1 17.8% of VHP, H2 2.5%, H3 4.9%, the rest share the remainder.
  const card = { at: 0, samples: 12, field: [{ a: H1, vhp: 1780, k: 600, h: 1 }, { a: H3, vhp: 490, k: 200, h: 3 }],
    paddock: [{ a: H2, vhp: 250 }, { a: "1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", vhp: 7480 }] };
  const bx = (who) => C.priceLeg(card, { code: C.BLOCK, round: 1, producer: who });
  assert.deepEqual(bx(H1), { chance: 0.178, factor: 1.40, f100: 140 });
  assert.deepEqual(bx(H3), { chance: 0.049, factor: 5.10, f100: 510 });
  assert.deepEqual(bx(H2), { chance: 0.025, factor: 6, f100: 600 });
  assert.deepEqual(bx("1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"), { chance: null, factor: 1, f100: C.MISSING_F100 });
  // A race leg on the same card is still priced by the race rule.
  const win = C.priceLeg(card, { code: C.WIN, round: 1, producer: H1 });
  assert.ok(win && win.f100 === oldF100(win.chance) && win.f100 <= 300);
  // finalWorth's 10% rule works the same on the new scale (worth at sending 600; the lock card's counts only if more
  // than 10% lower).
  const lock = { ...card, paddock: [{ a: H2, vhp: 275 }, card.paddock[1]] };   // H2's share 2.75% → 0.25 / 0.0275 = 909 → 600
  assert.equal(C.finalWorth(card, lock, { code: C.BLOCK, round: 1, producer: H2 }), 600, "still capped: no change");
  const grown = { ...card, paddock: [{ a: H2, vhp: 700 }, card.paddock[1]] };  // 700 of 10,450 = 6.7% → 373, more than 10% lower
  assert.equal(C.finalWorth(card, grown, { code: C.BLOCK, round: 1, producer: H2 }), 373);
});

test("the biggest card stays exact: 10 Block X legs at ×6 on base 960, and a week of 10 such cards", () => {
  const top = C.pointsFor(new Array(10).fill(600));
  assert.equal(top, 960 * 100 * 6 ** 10);            // 5,804,752,896,000 hundredths
  assert.equal(top, 5804752896000);
  assert.ok(Number.isSafeInteger(top) && Number.isSafeInteger(top * 10), "a week is the best 10 cards");
  // BigInt and the plain product agree at the edge (no rounding anywhere on the way).
  assert.equal(BigInt(top), 96000n * 6n ** 10n);
  assert.equal(C.pointsFor([600, 300]), 3 * 100 * 6 * 3);
  assert.equal(C.pointsFor([25, 600]), Math.floor(300 * 25 * 600 / 10000));
});

// ── JS = Python ──
/** The publish job's own Python (combo.yml), the lines this change touches, run with python3. */
function python(script) {
  const y = fs.readFileSync(path.resolve(APP, ".github/workflows/combo.yml"), "utf8").split("\n");
  const grab = (start, stop) => {
    const i = y.findIndex((l) => l.trim().startsWith(start));
    assert.ok(i >= 0, `combo.yml has ${start}`);
    const ind = y[i].length - y[i].trimStart().length, out = [y[i].slice(ind)];
    for (let k = i + 1; k < y.length && (stop ? !y[k].trim().startsWith(stop) : y[k].length - y[k].trimStart().length > ind); k++) out.push(y[k].slice(ind));
    return out.join("\n");
  };
  const src = [
    "SAFE = 2 ** 53 - 1",
    "nat = lambda x: type(x) is int and 0 <= x <= SAFE",
    "import re",
    "isaddr = lambda a: type(a) is str and re.fullmatch(r'1[1-9A-HJ-NP-Za-km-z]{25,34}', a) is not None",
    grab("RESULTS = "), grab("BASE = "), grab("WORTH_MIN = "), grab("WORTH_MAX = "), grab("def leg_ok(l):"), grab("def points(fs):"),
    // The FC3-3 hit-leg check, as a function over one leg (its line, verbatim).
    "def hit_ok(l):",
    "    legs = [l]",
    "    " + y.find((l) => l.includes('l[4] == "hit" and not (l[3] == 0 or')).trim().replace(/^if /, "return not (").replace(/: return False$/, ")"),
    script,
  ].join("\n");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "combo-worth-py-")), f = path.join(d, "t.py");
  fs.writeFileSync(f, src);
  try { return JSON.parse(execFileSync("python3", ["-I", f], { stdio: "pipe" }).toString()); }
  finally { fs.rmSync(d, { recursive: true, force: true }); }
}

test("JS = Python: the publish job's worth caps are combo-math.js WORTH100, by leg code", () => {
  const py = python("import json; print(json.dumps({'min': WORTH_MIN, 'max': {str(k): v for k, v in WORTH_MAX.items()}}))");
  assert.equal(py.min, C.WORTH100.race.min); assert.equal(py.min, C.WORTH100.block.min);
  assert.deepEqual(Object.keys(py.max).map(Number).sort(), [...C.CODES].sort());
  for (const code of C.CODES) assert.equal(py.max[code], C.WORTH100[C.FAMILY[code]].max, `code ${code}`);
});

test("JS = Python at every worth edge: leg_ok and the hit check accept exactly what f100Of can give", () => {
  const edges = [0, 1, 24, 25, 26, 100, 299, 300, 301, 302, 599, 600, 601, 1000];
  const legs = [];
  for (const code of C.CODES) for (const w of edges) legs.push([code, 1234, H1, w, "hit"], [code, 1234, H1, w, "miss"]);
  const py = python(`import json; L = json.loads(${JSON.stringify(JSON.stringify(legs))}); print(json.dumps([[leg_ok(l), hit_ok(l)] for l in L]))`);
  legs.forEach((l, i) => {
    const w = C.WORTH100[C.FAMILY[l[0]]];
    const jsLeg = l[3] >= 0 && l[3] <= w.max;                                  // the recorder writes 0 or f100Of's value
    const jsHit = l[4] !== "hit" || l[3] === 0 || (l[3] >= w.min && l[3] <= w.max);
    assert.deepEqual(py[i], [jsLeg, jsHit], `code ${l[0]} worth ${l[3]} ${l[4]}`);
  });
  // And every worth the JS can actually produce passes the Python, both families (sampled at every 0.0001 of chance).
  const made = new Set();
  for (let i = 0; i <= 10000; i++) for (const code of C.CODES) made.add(`${code}:${Math.round(C.factorOf(i / 1e4, C.FAMILY[code]) * 100)}`);
  const all = [...made].map((s) => { const [c, w] = s.split(":").map(Number); return [c, 1, H1, w, "hit"]; });
  const ok = python(`import json; L = json.loads(${JSON.stringify(JSON.stringify(all))}); print(json.dumps(all(leg_ok(l) and hit_ok(l) for l in L)))`);
  assert.equal(ok, true);
});

test("JS = Python: points at the edges, the biggest card included", () => {
  const cases = [[25, 25], [300, 600], [600, 600], new Array(10).fill(600), new Array(10).fill(300), [140, 263, 362, 510, 600, 25]];
  const py = python(`import json; print(json.dumps([points(f) for f in ${JSON.stringify(cases)}]))`);
  assert.deepEqual(py, cases.map((f) => C.pointsFor(f)));
});
