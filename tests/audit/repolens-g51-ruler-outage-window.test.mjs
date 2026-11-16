// Repo Lens #G-51 (Combo @ 74d36ed4): G51-1 (Low). Place in tests/audit/ (next to repolens-g37-ruler-outage.test.mjs).
// After G37-1, a ruled race leg whose ruler card never comes waits until the Race's ruler publishes a card for a LATER
// race (rulerSourcePast, weeks w and w+1 only). If the ruler's data feed (vhp-data) stops for the rest of the week and
// stays down past Combo's Vault window (3 days after the week ends), no later card ever appears, the leg stays pending
// forever, the week is never "final", and Combo writes NO vault/W<week>.json at all: every staked player loses the
// week, including players whose cards were fully decided (BOB below). The Race itself does not wait: in an ON week it
// skips a race with no ruler card at its own deadline (bot/race.ts ~1142-1164, VAULT_SKIP_AFTER) and pays its week.
// Combo already has this exact edge for Block X holds (FC2-3: "the hold also ends 6 hours before the card's week's
// Vault window closes"); ruled race legs have none.
// Expected: 6 h before the Vault window closes, a ruled race leg whose race is final in the W file but has no ruler
// card is given up (unresolved, an error), so the week's Vault file can still be written for everyone else.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const F = await import(path.join(process.env.APP, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { run, M, C, H1, H2, H3, H4, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`;
const early = D3 * 4 + 1, rf = D3 * 4 + 3;               // Mon 06:00 (ruler card published), Mon 18:00 (feed already down)
const sent = D3 * M.DAY + 2 * 3600000;
const cards = (r) => (r === S0 ? [
  { player: ALICE, legs: [{ code: C.SHOW, round: rf, producer: H4 }, { code: C.WIN, round: rf + 1, producer: H3 }], time: sent, height: heightAt(sent), changes: 0 },
  { player: BOB, legs: [{ code: C.WIN, round: early, producer: H1 }, { code: C.SHOW, round: early, producer: H2 }], time: sent, height: heightAt(sent), changes: 0 },
] : []);
const cardText = JSON.stringify({ producers: [[H1, 900], [H2, 800], [H3, 700], [H4, 600]].map(([a, f]) => ({ a, entry: true, void: false, fpct: String(f), signed: 5 })) });
/** The Race's R003.json, ON: ruler cards up to (not including) race `until`; after that "not yet" (vhp-data stopped). */
function rulerUntil(dir, until) {
  const races = [];
  for (let t = M.weekStart(3); t < M.weekStart(4); t += M.RACE) {
    const i = M.raceIndex(t);
    races.push({ id: M.raceId(i), round: "x", window: { W0: 1, W1: 2, L: 2, S0: 3, S1: 4 }, card: i < until ? cardText : null, note: i < until ? null : "not yet: the ruler's data isn't available this run", placings: i < until ? [H1, H2, H3] : [] });
  }
  fs.writeFileSync(path.join(dir, "R003.json"), JSON.stringify({ v: 1, week: 3, rulerFrom: 3, mode: "on", shadow: false, races }));
  return dir;
}

test("G51-1 (Low): a ruler outage that outlasts the Vault window must not cost the whole week its Vault file", async () => {
  const at = M.weekStart(4) + 3 * M.DAY - 5 * 3600000;    // past the deadline and the FC2-3 edge, still inside the window
  const out = tmp(), race = rulerUntil(raceDir(), rf);
  await quiet(() => run({ p: node({ t: at, cards }), check: node({ t: at, cards }), out, raceDir: race, blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: at, vhpMovesOf: async () => 0n, rulerFrom: 3, raceRulerFrom: 3 })).catch(() => {});
  const cs = read(out, dn(D3)).slots.find((s) => s.round === S0).cards, bob = cs.find((c) => c.player === BOB), alice = cs.find((c) => c.player === ALICE);
  assert.equal(bob.state, "final", "precondition: BOB's card is decided by published ruler cards");
  assert.equal(bob.outcome, "hit", "precondition: BOB's card hit");
  assert.notEqual(alice.state, "pending", `ALICE's card still waits 5 h before the Vault window closes: legs ${JSON.stringify(alice.legs.map((l) => l[4]))}`);
  assert.ok(fs.existsSync(path.join(out, "vault", "W3.json")), "week 3's Vault file is written before the window closes");
});
