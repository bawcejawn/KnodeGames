// Repo Lens #B-10 (VHP ruler v2.1 @ faa9757), area 2: the producer void (owner, 5 Nov).
// Run: node --import tsx --test tests/audit/vhp-ruler.*.test.mjs tests/audit/repolens-e12-recompute-settings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R, PY, toJson, fieldFpct } from "./vhp-ruler.fixture.mjs";
import { M, chain, game, win } from "./vhp-ruler.repolens-b10-chain.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-b10v-"));
const py = (code, data) => { const f = path.join(dir, `in${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, toJson(data)); return PY(`j = json.load(open(${JSON.stringify(f)}))\n${code}`); };
const score = (g, extra) => { const { tl, ps } = chain({ extra }), L = R.ledger(tl); return { tl, ps, L, s: R.scoreCard(L, R.makeCard(L, g)) }; };

test("B10-V1 (owner, 5 Nov: \"The Vault and Pool should share the same rule as the other producers ... void applies\"): a pooled producer whose VHP moves more than 10% during the race is void for it (both languages)", () => {
  const base = chain(), gP = { ...game, pooled: [base.ps[2]] };
  const { tl, ps, s } = score(gP, [{ h: win.S0 + 3600, i: 2, v: 2n * 10n ** 15n }]), p = s.producers.find((x) => x.a === ps[2]);
  const out = JSON.parse(py(`L = V.Ledger(j["tl"]); g = j["g"]
c = V.score_card(L, V.make_card(L, g["game"], g["round"], g["window"], g["c"], g["ownRule"], g["paying"], g["pooled"], g["minK"], g["poolRule"]))
r = next(r for r in c["producers"] if r["a"] == j["a"]); print(json.dumps([r["void"], r["fpct"]]))`, { tl, g: gP, a: ps[2] }));
  assert.deepEqual(out, [p.void, p.fpct === null ? null : String(p.fpct)], "JS = Python");
  assert.equal(p.pooled, true);
  assert.equal(p.void, true, "the same rule as every producer");
  assert.equal(p.fpct, null);
  const quiet = score(gP, []).s.producers.find((x) => x.a === ps[2]);
  assert.equal(quiet.void, false, "and in the race when its VHP holds");
});

test("B10-V2 (owner, 5 Nov: picks on a void producer count as a loss): a late self-void takes the producer out of the race; the others are scored on the field without it", () => {
  // nothing pays a pick on a void producer (each game counts it as a loss, never a refund), so voiding a losing producer
  // late turns no loss into a refund; the field's other members are scored as if it hadn't been in the field
  const late = score(game, [{ h: win.S1 - 1, i: 4, v: -(10n ** 15n * 66n) / 100n }]), a = late.ps[4], after = late.s.producers.find((x) => x.a === a);
  assert.equal(after.void, true, "an 11% move in the race's last blocks voids it, as any move during the race");
  assert.equal(after.fpct, null);
  const want = fieldFpct(late.s.producers);
  for (const x of late.s.producers) if (x.entry && !x.void) assert.equal(x.fpct, want[x.a]);
});

test("B10-V3 (as built, owner: \"any time\"): void compares eff during the race with the card's own size, whatever caused the gap: avg24h with a deposit 12 h before T, spot with a deposit between T and S0", () => {
  // a gap between own and eff in the race means each block is credited at own ÷ eff, which bunches the producer's result
  // (the sim 7 problem the void exists for), so the void applies whether the move came during the race or before it
  const T = R.makeCard(R.ledger(chain().tl), game).T;
  const a = score({ ...game, ownRule: "avg24h", paying: false }, [{ h: T - 14400, i: 2, v: 12n * 10n ** 14n }]), pa = a.s.producers.find((x) => x.a === a.ps[2]);
  assert.equal(pa.void, true, `avg24h: own ${pa.own} is more than 10% below its VHP in the race`);
  const b = score({ ...game, paying: false }, [{ h: T + 10, i: 2, v: 12n * 10n ** 14n }]), pb = b.s.producers.find((x) => x.a === b.ps[2]);
  assert.equal(pb.void, true, "spot: a deposit after the card is made");
  const c = score({ ...game, paying: false }, [{ h: T + 10, i: 2, v: 2n * 10n ** 14n }]), pc = c.s.producers.find((x) => x.a === c.ps[2]);
  assert.equal(pc.void, false, "a +5% move is inside the band");
});
