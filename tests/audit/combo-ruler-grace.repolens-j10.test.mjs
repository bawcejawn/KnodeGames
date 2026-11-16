// Repo Lens #J-10 (PR #338 @ e0ec0346): the 48 h give-up applies only to a race that is FINAL in the Race's W file.
// A race whose W result never came (the Race's own recorder stalled) still waits past the Race's skip time (RL-9),
// even though the R file lists it with no ruler card. Mutation check: deleting
// `&& raceRecord(RACE, l[1])?.result?.final === true` in bot/games/combo-score.mjs makes this test fail; no other
// test catches it. Put in tests/audit/. Uses the same fixtures as combo-ruler-grace.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const F = await import(path.join(process.env.APP, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { run, M, C, H1, H2, H3, H4, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const { RULER_GRACE } = await import(path.join(process.env.APP, "bot/race.ts"));

const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`;
const early = D3 * 4 + 1, rf = D3 * 4 + 3;
const sent = D3 * M.DAY + 2 * 3600000;
const cards = (r) => (r === S0 ? [
  { player: ALICE, legs: [{ code: C.SHOW, round: rf, producer: H4 }, { code: C.WIN, round: rf + 1, producer: H3 }], time: sent, height: heightAt(sent), changes: 0 },
  { player: BOB, legs: [{ code: C.WIN, round: early, producer: H1 }, { code: C.SHOW, round: early, producer: H2 }], time: sent, height: heightAt(sent), changes: 0 },
] : []);
const cardText = JSON.stringify({ producers: [[H1, 900], [H2, 800], [H3, 700], [H4, 600]].map(([a, f]) => ({ a, entry: true, void: false, fpct: String(f), signed: 5 })) });
function rulerUntil(dir, until) {
  const races = [];
  for (let t = M.weekStart(3); t < M.weekStart(4); t += M.RACE) {
    const i = M.raceIndex(t);
    races.push({ id: M.raceId(i), round: "x", window: { W0: 1, W1: 2, L: 2, S0: 3, S1: 4 }, card: i < until ? cardText : null, note: i < until ? null : "not yet: the ruler's data isn't available this run", placings: i < until ? [H1, H2, H3] : [] });
  }
  fs.writeFileSync(path.join(dir, "R003.json"), JSON.stringify({ v: 1, week: 3, rulerFrom: 3, mode: "on", shadow: false, races }));
  return dir;
}

test("J10-1: a ruled leg whose race has no final W result is NOT given up at the Race's skip time (it waits, RL-9)", async () => {
  const at = M.weekStart(4) + RULER_GRACE + 60000;
  const out = tmp(), race = rulerUntil(raceDir({ noResult: new Set([rf, rf + 1]) }), rf);
  await quiet(() => run({ p: node({ t: at, cards }), check: node({ t: at, cards }), out, raceDir: race, blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: at, vhpMovesOf: async () => 0n, rulerFrom: 3, raceRulerFrom: 3 })).catch(() => {});
  const cs = read(out, dn(D3)).slots.find((s) => s.round === S0).cards;
  const alice = cs.find((c) => c.player === ALICE), bob = cs.find((c) => c.player === BOB);
  assert.equal(bob.state, "final", "precondition: BOB's card is decided by published ruler cards");
  assert.equal(alice.state, "pending", `no W result for its races: the card waits; legs ${JSON.stringify(alice.legs.map((l) => l[4]))}`);
  assert.ok(!alice.legs.some((l) => l[4] === "unresolved"));
});
