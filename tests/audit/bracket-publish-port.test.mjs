// The publish job's Python port of bracket-math.js (Repo Lens #E-3 H-2: the job recomputes every result and point
// itself, running no repository code) must give EXACTLY the recorder's numbers. Thousands of random weeks — every size,
// forfeits, the pooled rate index, ties, invalid numbers, unfinished rounds — scored both ways and compared.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const rec = await import(path.resolve(APP, "bot/games/bracket.ts"));
const B = globalThis.KBracketMath;

function checkSource() {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const s = y.findIndex((l) => l.includes('/usr/bin/python3 - "$IN/bracket"'));
  const ind = y[s + 1].match(/^ */)[0].length, out = [];
  for (let i = s + 1; y[i].trim() !== "PY"; i++) out.push(y[i].slice(ind));
  return out.join("\n");
}
// a small seeded random (the same weeks every run)
let seed = 20261105;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const int = (n) => Math.floor(rnd() * n);
const addr = (i) => "1" + "Kq" + String(100000 + i).replace(/0/g, "z").padEnd(31, "x");

function randomWeek(k) {
  const size = [8, 16, 32][k % 3], R = B.roundsOf(size);
  const seeds = Array.from({ length: size }, (_, i) => addr(k * 64 + i));
  // fix-check B-2: every fifth week uses mainnet-sized VHP (sums far past 2^53) with seeds held exactly at, or one
  // satoshi under, half their seeding VHP all day: the forfeit line itself
  const big = k % 5 === 3;
  const vhp = seeds.map(() => (big ? Math.round((1e5 + rnd() * 5e7) * 100) / 100 : 1 + int(1000))).sort((a, b) => b - a);
  const pooled = rnd() < 0.5 ? [seeds[int(size)]] : [];
  const known = int(R + 1);   // rounds whose 24 hours are all in
  // per round day and seed: about 1 in 5 hold well under their seeding VHP all day, around the forfeit line
  const tieWeek = k % 10 === 7;   // every matchup an exact tie: the underdog goes through
  const low = Array.from({ length: R }, () => seeds.map(() => (rnd() < 0.2 ? 0.3 + 0.4 * rnd() : 0)));
  const days = Array.from({ length: R }, (_, r) => Array.from({ length: 24 }, (_, h) => {
    if (r > known || (r === known && h >= int(24))) return null;
    const by = {}, cr = {}, w = {}, rr = {}, av = {};
    let n = 0;
    for (const [i, a] of seeds.entries()) {
      const b = int(4); by[a] = b; n += b;
      cr[a] = rnd() < 0.2 ? b : Math.round(b * rnd() * 1e9) / 1e9;
      w[a] = rnd() < 0.05 ? 0 : Math.round(vhp[i] * 1e8 * (0.3 + rnd()));          // some start under half (forfeits)
      rr[a] = Math.round(b * 1e7 / Math.max(1, vhp[i]) * (0.5 + rnd()) * 1e9) / 1e9;
      av[a] = Math.round(vhp[i] * 1e8 * (low[r][i] ? low[r][i] * (0.95 + 0.1 * rnd()) : 0.6 + rnd()));
      if (big && low[r][i]) av[a] = Number(BigInt(Math.round(vhp[i] * 100)) * 1000000n / 2n) - (h === 0 && i % 2 ? 1 : 0);
    }
    if (rnd() < 0.03) for (const a of seeds) { by[a] = 0; cr[a] = 0; rr[a] = 0; }     // an hour nobody signed
    if (tieWeek) for (const a of seeds) { by[a] = 1; cr[a] = 1; rr[a] = 1; av[a] = vhp[0] * 1e8; w[a] = vhp[0] * 1e8; }   // dead heats
    n = Object.values(by).reduce((t, x) => t + x, 0);
    return { from: 1000 * r + h, to: 1000 * r + h + n - 1, n, by, cr, w: h === 0 ? w : null, q: Math.round(rnd() * 3 * 1e9) / 1e9, r: rr, av, checked: 2 };
  }));
  // one baseline a day (hour 0's), like the recorder
  for (const d of days) { const w0 = d[0] ? d[0].w : null; for (const hr of d) if (hr) hr.w = w0 || Object.fromEntries(seeds.map((a) => [a, 1e8])); }
  const picks = Array.from({ length: 1 + int(30) }, (_, i) => {
    const n = rnd() < 0.1 ? 2 ** (size - 1) + int(5) : rnd() < 0.2 ? 0 : int(2 ** (size - 1));
    return [addr(900000 + k * 40 + i), n, 1000 + int(5) * 3000, B.decode(n, size, size) ? 1 : 0];
  }).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const wf = { v: B.FILE_V, week: 3, seeding: { size, seeds, vhp, pooled }, picks: { checked: 2, rows: picks }, days };
  const sc = rec.scoreWeek(wf);
  const atLine = big ? low.flat().filter(Boolean).length : 0;
  return { wf, js: { results: sc.results, points: sc.points }, atLine };
}

test("the publish job's port scores every random week exactly like bracket-math.js (H-2)", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "port-")), src = checkSource();
  // everything above the check's own run (the port's functions), with harmless arguments
  fs.writeFileSync(path.join(d, "lib.py"), src.split("\ndef deepest(e):")[0]);
  fs.writeFileSync(path.join(d, "run.py"), `import json, sys
f = sys.argv[1]
sys.argv = ["x", ${JSON.stringify(path.join(d, "none"))}]
g = {}
exec(open(${JSON.stringify(path.join(d, "lib.py"))}).read(), g)
out = []
for j in json.load(open(f)):
    r, p = g["rescore"](j)
    out.append({"results": r, "points": p})
print(json.dumps(out))
`);
  let bad = 0, firstBad = null, total = 0, withResults = 0, pooled = 0, forfeitsAtLine = 0;
  for (let batch = 0; batch < 20; batch++) {
    const weeks = Array.from({ length: 150 }, (_, k) => randomWeek(batch * 150 + k));
    const f = path.join(d, "weeks.json"); fs.writeFileSync(f, JSON.stringify(weeks.map((x) => x.wf)));
    const r = spawnSync("python3", ["-I", path.join(d, "run.py"), f], { encoding: "utf8", maxBuffer: 1 << 28 });
    assert.equal(r.status, 0, r.stderr);
    const py = JSON.parse(r.stdout);
    for (let i = 0; i < weeks.length; i++, total++) {
      if (JSON.stringify(weeks[i].js) !== JSON.stringify(py[i])) { bad++; firstBad = firstBad ?? `${JSON.stringify(weeks[i].js).slice(0, 300)}\nPY ${JSON.stringify(py[i]).slice(0, 300)}`; }
      if (weeks[i].js.results.rounds.length) withResults++;
      if (weeks[i].wf.seeding.pooled.length) pooled++;
      forfeitsAtLine += weeks[i].atLine;
    }
  }
  assert.equal(bad, 0, `${bad} of ${total} weeks differ; first:\nJS ${firstBad}`);
  assert.equal(total, 3000);
  assert.ok(withResults > 1500 && pooled > 1000, "the random weeks really exercise results and pooled producers");
  assert.ok(forfeitsAtLine > 50, `the forfeit line itself is exercised (${forfeitsAtLine} seeds at or a satoshi under half)`);
});
