// Repo Lens #G-19 (vhp-ruler-modes c2fa0f6, tree f2c18fcb, on e94d051b): G19-1. Place in tests/audit/.
// G19-1: mode C's raise-only lift is a discount a producer can steer. A producer whose recent pace is above the field's
// median gets target = expected × pace ÷ median. By signing less for the 3 days before the card (C_DAYS) it drops its
// pace to or below the median, its lift falls toward 1, and its target toward expected: exactly the "own pace, bounded" discount
// the docs (VHP-RULER.md "Why no mode lowers a target") say can be steered (D-120), here worth the producer's whole edge.
// The race itself (S0..S1) is signed the same in both chains, so the only difference is the steer before the card.
// Fix (one option): in C, lift = max(lift on the 14-day form, lift on the 3-day pace), so a 3-day steer can't go below
// B's raise; or drop C. Run: node --import tsx --test tests/audit/vhp-ruler.repolens-g19.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { R } from "./vhp-ruler.fixture.mjs";
import { chain, game } from "./vhp-ruler.repolens-b10-chain.mjs";
const M = 1000000n;

// ps[0] takes every 5th of ps[1]'s blocks over the whole chain, so its 14-day form and 3-day pace are above the median.
function base() {
  const x = chain({ n: 445000 + 15000 });
  for (let k = 0; k < x.tl.signers.length; k++) {
    const h = x.tl.from + k;
    if (x.tl.signers[k] === x.ps[1] && k % 5 === 0) { x.tl.signers[k] = x.ps[0]; const d = x.tl.deltas[k]; if (d.h === h && d.a === x.ps[1]) x.tl.deltas[k] = { ...d, a: x.ps[0] }; }
  }
  return x;
}
const score = (tl) => { const L = R.ledger(tl), g = { ...game, paying: false, mode: "C" }; return R.scoreCard(L, R.makeCard(L, g)); };

test("G19-1 (Medium): in mode C a producer can't lower its own target by signing less in the 3 days before the card", () => {
  const honest = base(), T = R.makeCard(R.ledger(honest.tl), { ...game, paying: false }).T;
  const hot = honest.ps[0], h = score(honest.tl).producers.find((p) => p.a === hot);
  assert.ok(h.lift > M, "precondition: its honest 3-day pace is above the field's median, so its target is raised");
  // The steer: in [T - 3 days, T - 6 h) it lets half its blocks go to ps[2]; it keeps signing in the last 6 h (still active).
  const steered = base();
  let n = 0;
  for (let k = 0; k < steered.tl.signers.length; k++) {
    const hh = steered.tl.from + k;
    if (hh >= T - R.C_DAYS * R.AVG && hh < T - 7200 && steered.tl.signers[k] === hot && (n++ % 2 === 0)) {
      steered.tl.signers[k] = steered.ps[2]; const d = steered.tl.deltas[k]; if (d.h === hh && d.a === hot) steered.tl.deltas[k] = { ...d, a: steered.ps[2] };
    }
  }
  const s = score(steered.tl).producers.find((p) => p.a === hot);
  assert.equal(s.credited, h.credited, "the race itself is signed the same");
  assert.ok(s.target >= h.target, `three days of signing less lowered its target from ${h.target} to ${s.target} (lift ${h.lift} -> ${s.lift}); fpct ${h.fpct} -> ${s.fpct}`);
});
