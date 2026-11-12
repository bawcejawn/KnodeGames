// Repo Lens fix-check 2 (port): the publish job's derive_seeding / vhp2 must accept exactly what bracket-math.js
// seeding(fieldOf(...)) writes. P-1: on the field line (7200·v / total = 10 exactly) the job sums the total in sorted
// order, fieldOf in signer order, so the two land either side of 10 and an honest seeding is held until the week voids.
// P-2: vhp2 rejects honest whole-hundredth values above ~86M VHP although the job documents 0.01 … 1e9.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
await import(path.resolve(APP, "vhp-standard.js")); await import(path.resolve(APP, "bracket-math.js"));
const V = globalThis.KVhp, B = globalThis.KBracketMath;
function checkSource() {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const s = y.findIndex((l) => l.includes('/usr/bin/python3 - "$IN/bracket"'));
  const ind = y[s + 1].match(/^ */)[0].length, out = [];
  for (let i = s + 1; y[i].trim() !== "PY"; i++) out.push(y[i].slice(ind));
  return out.join("\n").split("\ndef deepest(e):")[0];
}
function py(fn, cases) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "e3fc2-"));
  fs.writeFileSync(path.join(d, "lib.py"), checkSource());
  fs.writeFileSync(path.join(d, "c.json"), JSON.stringify(cases));
  fs.writeFileSync(path.join(d, "run.py"), `import json, sys
d = ${JSON.stringify(d)}
sys.argv = ["x", d + "/none"]; g = {}; exec(open(d + "/lib.py").read(), g)
print(json.dumps([${fn} for c in json.load(open(d + "/c.json"))]))`);
  const r = spawnSync("python3", ["-I", path.join(d, "run.py")], { encoding: "utf8", maxBuffer: 1 << 28 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const int = (n) => Math.floor(rnd() * n);
const A = (i) => "1" + "Kq" + String(100000 + i).replace(/0/g, "z").padEnd(31, "x");

test("P-1: a producer exactly on the field line is seeded the same by the job and by bracket-math.js", () => {
  const cases = [];
  for (let k = 0; k < 2000; k++) {
    const n = 9 + int(40), h = Array.from({ length: n - 1 }, () => 1 + int(5e8));   // averages in hundredths of VHP
    let S = h.reduce((t, x) => t + x, 0); h[0] += 719 - (S % 719); S += 719 - (S % 719);
    h.push(S / 719);                                                                   // 720·v = total: k = 10 exactly
    const rows = h.map((x, i) => [A(k * 64 + i), x]);
    for (let i = rows.length - 1; i > 0; i--) { const j = int(i + 1); [rows[i], rows[j]] = [rows[j], rows[i]]; }   // signer order
    const card = V.fieldOf(new Map(rows.map(([a, x]) => [a, x * 1e6])));
    const js = B.seeding(card, {});
    const raw = Object.fromEntries([...card.field, ...card.paddock].map((r) => [r.a, r.vhp]).sort((x, y) => (x[0] < y[0] ? -1 : 1)));
    cases.push({ raw, js: { size: js.size, seeds: js.seeds, vhp: js.vhp, out: js.out, outVhp: js.outVhp } });
  }
  const got = py('g["derive_seeding"](c["raw"], {})', cases.map((c) => ({ raw: c.raw })));
  const bad = cases.filter((c, i) => JSON.stringify(c.js) !== JSON.stringify(got[i])).length;
  assert.equal(bad, 0, `${bad} of ${cases.length} honest seedings on the field line would be held (and the week voided)`);
});

test("P-2: vhp2 accepts every whole-hundredth VHP up to the documented 1e9", () => {
  const vals = [552460488.93, 999999999.99, 123456789.01, 98765432.17];   // what Math.round(sat / 1e6) / 100 writes
  assert.deepEqual(py('g["vhp2"](c)', vals), vals.map(() => true));
});
