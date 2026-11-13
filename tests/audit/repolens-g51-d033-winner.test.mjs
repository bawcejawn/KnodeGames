// Repo Lens #G-51 (Combo @ 74d36ed4): question 3, D-033 on the ruler. Place in tests/audit/. Not a finding: it pins
// that combo-math.js legResult and the publish job's Python `expected` agree, exhaustively, on every leg type when the
// ruler's 1st place signed 0 blocks, for field sizes 1 to 6 and every position, and that Win / Show / Top half on a
// 0-signed 1st place hit (i == 0), while 2nd and lower with 0 signed miss. (The verify job scores with combo-math.js.)
// Also pins the existing edge: with a field of 1, Top half (floor(1/2) = 0 places) misses even for the winner (both).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const F = await import(path.join(process.env.APP, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { APP, M, C, H1, H2, H3, H4, ALICE, BOB, W3, tmp } = F;
const YML = fs.readFileSync(path.join(APP, ".github/workflows/combo.yml"), "utf8");
const rf = C.utcDay(W3) * 4 + 3, ALL = [H1, H2, H3, H4, ALICE, BOB];

test("D-033 on the ruler: JS = Python for a 0-signed winner and 0-signed others; i == 0 always counts", () => {
  const y = YML.split("\n");
  const from = y.findIndex((l) => l.startsWith("          def ruled_field(e):")), to = y.findIndex((l, k) => k > from && l.startsWith("              if not BX_TARGETS: return False"));
  assert.ok(from > 0 && to > from);
  const src = y.slice(from, to).map((l) => l.slice(10)).join("\n");
  const cases = [];
  for (let n = 1; n <= 6; n++) for (let zero = 0; zero < n; zero++) for (const code of [C.WIN, C.SHOW, C.HALF]) for (let at = 0; at < n; at++) {
    const field = ALL.slice(0, n), who = field[at];
    const card = JSON.stringify({ producers: field.map((a, k) => ({ a, entry: true, void: false, fpct: String(1000 - k * 10), signed: k === zero ? 0 : 4 })) });
    const entry = { id: M.raceId(rf), round: "x", window: { W0: 1, W1: 2, L: 2, S0: 3, S1: 4 }, card, note: null, placings: [] };
    const res = { final: true, checked: 2, standings: [] };
    const js = C.legResult({ code, round: rf, producer: who }, { result: res }, null, { entry });
    const need = code === C.WIN ? 1 : code === C.SHOW ? 3 : Math.floor(n / 2);
    const want = at > 0 && at === zero ? "miss" : at < need ? "hit" : "miss";
    assert.equal(js, want, JSON.stringify({ n, zero, code, at }));
    cases.push({ js, py: [code, rf, who], res, entry });
  }
  const py = `import json, re, sys
isaddr = lambda a: type(a) is str and re.fullmatch(r"1[1-9A-HJ-NP-Za-km-z]{25,34}", a) is not None
${src}
cases = json.load(sys.stdin); out = []
for c in cases:
    globals()["race_record"] = (lambda r, c=c: {"result": c["res"]}); globals()["ruler_record"] = (lambda r, c=c: c["entry"])
    out.append(expected(c["py"] + [0, "pending"], True))
print(json.dumps(out))`;
  const f = path.join(tmp(), "t.py"); fs.writeFileSync(f, py);
  const got = JSON.parse(execFileSync("python3", ["-I", f], { input: JSON.stringify(cases) }).toString());
  assert.deepEqual(got, cases.map((c) => c.js));
  // The three i == 0 cases the request names, explicitly: a 0-signed winner hits Win, Show and Top half (field of 4).
  const w0 = cases.filter((c) => c.py[2] === H1 && c.entry.card.includes(`"a":"${H1}","entry":true,"void":false,"fpct":"1000","signed":0`) && JSON.parse(c.entry.card).producers.length === 4);
  assert.deepEqual(w0.map((c) => c.js), ["hit", "hit", "hit"]);
});
