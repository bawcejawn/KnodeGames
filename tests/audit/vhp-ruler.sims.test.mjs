// The VHP ruler's simulations (sims/ruler/): §8 sim 5 (node faults through the real data path) passes, and the
// simulation suite runs and refuses to give a verdict on fewer than 29 days of data. The 29+-day run on real mainnet
// history is sims/ruler/real.mjs (run by hand; it reads mainnet).
import { test } from "node:test";
import assert from "node:assert/strict";
import { R, D, makeChain } from "./vhp-ruler.fixture.mjs";
import { sim5 } from "../../sims/ruler/faults.mjs";
import { run } from "../../sims/ruler/sims.mjs";

test("sim 5: every node fault leaves the cards that read it flagged or not made — none scored", () => {
  const r = sim5({ cards: 12 });
  assert.equal(r.pass, true, r.metric);
  for (const v of Object.values(r.detail)) assert.match(v, /^12 of 12 cards/);
  assert.match(r.detail["control, no fault"], /made and scored/);
});

test("the simulation suite runs, and on fewer than 29 days every result is a dry run (no verdict)", () => {
  const g = makeChain({ seed: 5, hours: 40, np: 6, busy: 0.01 });
  const L = R.ledger(D.timelineFrom(g.texts.map((t) => JSON.parse(t))));
  const out = run(L, { cards: 2, races: 200, only: [1, 4, 6, 9, 10], log: () => {} });
  assert.equal(out.dry, true);
  assert.ok(out.results.length >= 4 && out.results.every((x) => x.pass === null), "no PASS or FAIL on 1.7 days of data");
});
