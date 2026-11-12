// Repo Lens #G-15 (race-ruler @ 4438026 on main bfa4ed3): G15-1. Place in tests/audit/. Fails today (Low).
// G15-1: the Race's rule (ProducerRace.md, D-033; unchanged by D-173): a 2nd or 3rd place scores a show only if that
// producer signed at least one block. In an ON week the placings come from the ruler card (fpct order among entry && !void)
// and neither bot/race-ruler.ts ruledResult / placingsOf nor race.yml's recount checks `signed`, so in a thin field a
// producer that signed nothing can be 2nd or 3rd and pay show points. Fix (both sides alike): a pick on placings[1] or [2]
// is a show only if that producer's card row has signed >= 1 (keep the place order as is).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RR = await import(path.join(ROOT, "bot/race-ruler.ts"));
const A = "1" + "A".repeat(33), B = "1" + "B".repeat(33), C = "1" + "C".repeat(33), P1 = "1" + "P".repeat(33), P2 = "1" + "Q".repeat(33);

test("G15-1 (Low): in an ON week a 2nd / 3rd place that signed no block scores no show", () => {
  // A thin field: three producers with entry, none void; C signed nothing but is 3rd by fpct.
  const card = { producers: [
    { a: A, entry: true, void: false, fpct: "900000", signed: 12 },
    { a: B, entry: true, void: false, fpct: "500000", signed: 9 },
    { a: C, entry: true, void: false, fpct: "100000", signed: 0 },
  ] };
  const pl = RR.placingsOf(card);
  assert.deepEqual(pl, [A, B, C]);
  const entry = { id: "r", round: "x", window: { W0: 0, W1: 0, L: 0, S0: 1, S1: 2 }, card: JSON.stringify(card), note: null, placings: pl };
  const result = { final: true, picks: [[P1, B, 1, 0, 0, 0], [P2, C, 2, 0, 0, 0]] };
  const r = RR.ruledResult(result, entry);
  assert.equal(r.picks.find((x) => x[0] === P1)[5], 1, "B (2nd, signed 9) is a show");
  assert.equal(r.picks.find((x) => x[0] === P2)[5], 0, "C (3rd) signed no block: no show (D-033)");
});

// The publish job's side (race.yml, the ON recount): its own lines, run on the same card, drop the 3rd place that signed nothing.
test("G15-1, publish side: race.yml's recount counts a show only for a 2nd / 3rd that signed a block (its own lines, run in Python)", async () => {
  const fs = await import("node:fs"), { execFileSync } = await import("node:child_process");
  const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/race.yml"), "utf8");
  const take = (re) => { const m = yml.match(re); assert.ok(m, String(re)); return m[0].trim(); };
  const sg = take(/^\s*sg = \{q\.get\("a"\): q\.get\("signed"\).*$/m), sh = take(/^\s*sh = \[a for a in pl\[1:3\].*$/m), pk = take(/^\s*pk = \[\] if not pl else .*$/m);
  assert.match(pk, /p\[1\] in sh else 0/);
  const card = { producers: [{ a: A, signed: 12 }, { a: B, signed: 9 }, { a: C, signed: 0 }] };
  const py = ["import json, sys", "e = json.loads(sys.argv[1]); pl = json.loads(sys.argv[2]); res0 = json.loads(sys.argv[3])", sg, sh, pk, "print(json.dumps(pk))"].join("\n");
  const out = JSON.parse(execFileSync("python3", ["-I", "-c", py, JSON.stringify({ card: JSON.stringify(card) }), JSON.stringify([A, B, C]), JSON.stringify({ picks: [[P1, B, 1, 0, 0, 0], [P2, C, 2, 0, 0, 0], [P1, A, 3, 0, 0, 0]] })]).toString());
  assert.deepEqual(out.map((x) => [x[1], x[3], x[5]]), [[B, 0, 1], [C, 0, 0], [A, 1, 0]], "B shows, C (signed 0) doesn't, A wins");
});
