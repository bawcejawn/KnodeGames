// R-BR-7 (the Producer Bracket on the shared VHP ruler, owner 11 Nov 2026): the matchup rule with a day's ruler card
// (bracket-math otherWins / results), and the publish job's copy of the ruler switch (switch_from, ruler_mode,
// switch_change in .github/workflows/games.yml) against vhp_ruler.py and vhp-ruler.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const APP = process.env.APP || ".";
await import(path.resolve(APP, "vhp-standard.js")); await import(path.resolve(APP, "bracket-math.js"));
const B = globalThis.KBracketMath;
const box = { window: {} }; vm.runInNewContext(fs.readFileSync(path.resolve(APP, "vhp-ruler.js"), "utf8"), box);
const R = box.window.KRuler;

const seeds = Array.from({ length: 8 }, (_, i) => "1Seed" + "ABCDEFGH"[i] + "x".repeat(28));
// every seed on the day index at 1.0 (credited = expected), so the index alone gives every matchup to the lower seed
const day = () => new Map(seeds.map((a) => [a, { credited: 100, expected: 100, avg: 1e14, rate: 0, q: 0 }]));   // avg in satoshi
const days = () => [day(), day(), day()];
const rulerDay = (f) => new Map(seeds.map((a, i) => [a, f(i)]));

test("no ruler card: exactly as before (the day index; an exact tie goes to the lower seed)", () => {
  const r = B.results(seeds, 8, days());
  assert.deepEqual(r.rounds, [[8, 5, 6, 7], [8, 7], [8]], "every index tie: the lower seed");
  assert.deepEqual(B.results(seeds, 8, days(), undefined, undefined, undefined), r);
});

test("with a ruler card: the higher fpct wins; equal fpct goes to the lower seed", () => {
  const top = rulerDay((i) => String(900000 - i * 1000));   // higher seeds luckier: every favourite wins
  const r = B.results(seeds, 8, days(), undefined, undefined, [top, top, top]);
  assert.deepEqual(r.rounds, [[1, 4, 3, 2], [1, 2], [1]]);
  assert.equal(r.done, true);
  const flat = rulerDay(() => "500000");
  assert.deepEqual(B.results(seeds, 8, days(), undefined, undefined, [flat, flat, flat]).rounds, B.results(seeds, 8, days()).rounds, "a tie: the lower seed, as an index tie");
});

test("the backup after the 48-hour grace (owner, 12 Nov): the seed rule, so the better seed goes through, after forfeits", async () => {
  const BR = await import(path.resolve(APP, "bot/games/bracket.ts"));
  const day = BR.seedRuleDay(seeds);
  assert.deepEqual(B.results(seeds, 8, days(), undefined, undefined, [day, day, day]).rounds, [[1, 4, 3, 2], [1, 2], [1]], "every favourite wins");
  const ix = days(); ix[0].set(seeds[0], { credited: 100, expected: 100, avg: 1, rate: 0, q: 0 });   // seed 1 under half its seeding VHP
  assert.equal(B.results(seeds, 8, ix, seeds.map(() => 1000), undefined, [day, null, null]).rounds[0][0], 8, "a forfeit still comes first");
});

test("a void seed (no fpct) loses; both void: the day index decides; a seed missing from the card counts as void", () => {
  const ix = days();
  ix[0].set(seeds[0], { credited: 200, expected: 100, avg: 1e14, rate: 0, q: 0 });   // seed 1 has the better index
  const oneVoid = rulerDay((i) => (i === 0 ? null : "10"));
  assert.equal(B.results(seeds, 8, ix, undefined, undefined, [oneVoid, null, null]).rounds[0][0], 8, "seed 1 void: seed 8 goes through");
  const bothVoid = rulerDay((i) => (i === 0 || i === 7 ? null : "10"));
  assert.equal(B.results(seeds, 8, ix, undefined, undefined, [bothVoid, null, null]).rounds[0][0], 1, "both void: the index (seed 1 better)");
  const missing = new Map([...rulerDay(() => "10")].filter(([a]) => a !== seeds[7]));
  assert.equal(B.results(seeds, 8, ix, undefined, undefined, [missing, null, null]).rounds[0][0], 1, "seed 8 not on the card: it loses");
  for (const bad of ["-1", "1.5", "", "99999999", "1000001", 7]) assert.equal(B.results(seeds, 8, ix, undefined, undefined, [rulerDay((i) => (i === 7 ? bad : "10")), null, null]).rounds[0][0], 1, `fpct ${JSON.stringify(bad)} isn't a percentile: void`);
});

test("forfeits still come first, on the day's averages (D-086, D-087)", () => {
  const ix = days();
  ix[0].set(seeds[0], { credited: 100, expected: 100, avg: 1, rate: 0, q: 0 });   // seed 1 under half its seeding VHP
  const luckyFav = rulerDay((i) => (i === 0 ? "999999" : "1"));
  assert.equal(B.results(seeds, 8, ix, seeds.map(() => 1000), undefined, [luckyFav, null, null]).rounds[0][0], 8, "seed 1 forfeits, whatever its fpct");
});

test("a round is known only once both its day and its card are", () => {
  const c = rulerDay((i) => String(900000 - i));
  const r = B.results(seeds, 8, days(), undefined, undefined, [c, null, c]);
  assert.equal(r.rounds.length, 1); assert.equal(r.done, false);
});

// ── the publish job's copy of the switch ──
// (the embedded vhp_ruler.py, phase 2, is left out: it is tested byte for byte in games-ruler-embed.test.mjs)
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8").replace(/# BEGIN vhp_ruler\.py\n[\s\S]*?# END vhp_ruler\.py\n/, "");
const copy = (() => {
  const i = yml.indexOf("          SWITCH_MAX = 999999\n"), j = yml.indexOf("          def ruler_fields(j):", i);
  assert.ok(i > 0 && j > i, "the switch copy in the Bracket's publish check");
  return yml.slice(i, j).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n");
})();

test("the publish job's switch functions are vhp_ruler.py's, line for line (docstrings aside)", () => {
  const src = fs.readFileSync(path.resolve(APP, "vhp_ruler.py"), "utf8");
  const body = (text, name) => {
    const m = text.match(new RegExp(`^def ${name}\\([^)]*\\):\\n((?:(?: {4}.*)?\\n)+)`, "m"));
    assert.ok(m, name);
    return m[1].split("\n").filter((l) => l.trim() && !/^\s+"""/.test(l)).map((l) => l.trimEnd()).join("\n");
  };
  for (const f of ["switch_from", "_switch_week", "_mode_of", "ruler_mode", "switch_change"]) assert.equal(body(copy, f), body(src, f), f);
});

test("JS = Python: switchFrom, rulerMode and switchChange over a grid (the copy, vhp_ruler.py and vhp-ruler.js)", () => {
  const vals = ["", "1", "3", "4", "5", "6", "12", "999999", "07", " 4", "x", "0", "1000000"];
  const weeks = [0, 1, 2, 3, 4, 5, 6, 7, 11];
  const js = (f) => { try { return f(); } catch { return "ERR"; } };
  const want = {
    from: vals.map((v) => js(() => R.switchFrom(v))),
    mode: vals.flatMap((v) => weeks.map((w) => js(() => R.rulerMode(w, v)))),
    change: vals.flatMap((p) => vals.flatMap((n) => weeks.map((w) => js(() => R.switchChange(p, n, w) === null ? null : "REFUSED")))),
  };
  const harness = (prelude) => `${prelude}
import json, sys
vals, weeks = json.loads(sys.argv[1]), json.loads(sys.argv[2])
def ok(f):
    try: return f()
    except Exception: return "ERR"
print(json.dumps({"from": [ok(lambda: switch_from(v)) for v in vals],
  "mode": [ok(lambda: ruler_mode(w, v)) for v in vals for w in weeks],
  "change": [ok(lambda: None if switch_change(p, n, w) is None else "REFUSED") for p in vals for n in vals for w in weeks]}))`;
  for (const [what, prelude] of [["the workflow's copy", "import os, re, time\n" + copy], ["vhp_ruler.py", `import sys; sys.path.insert(0, ${JSON.stringify(path.resolve(APP))})\nfrom vhp_ruler import switch_from, ruler_mode, switch_change`]]) {
    const out = JSON.parse(execFileSync("python3", ["-c", harness(prelude), JSON.stringify(vals), JSON.stringify(weeks)]).toString());
    assert.deepEqual(out, want, what);
  }
});
