// Repo Lens #G-37 (Combo delta @ f41f5bec): G37-1. Place in tests/audit/ (next to combo-ruler.test.mjs).
// In an ON week (COMBO_RULER_FROM_WEEK) a race leg waits for the Race's ruler card (race-data R<week>.json). If that
// card never comes (the Race's ruler is off / later that week, or its vhp-data feed is down), the recorder's deadline
// check asks the WRONG source whether it gave up: raceSourcePast() looks at the handicap W file, which keeps
// publishing. So at the first run after the deadline every race leg of the week turns "unresolved" and every card is
// made FINAL VOID (0 points), irreversibly, in the same run that first raises the error. The Race itself keeps such a
// week open (bot/race-ruler.ts ruledResult returns null: "keeps the week open"), and RL-9 says an outage never voids.
// Expected: the card waits (pending) with an error, as for any other source outage.
// Combo chat, 12 Nov: adapted by one argument (raceRulerFrom: 3). #G-37's own condition now refuses Combo on the ruler
// before the Race; with the Race switched on for week 3 too, its R file is still missing here, which is this outage.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const F = await import(path.join(process.env.APP, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { run, M, C, H3, H4, ALICE, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`, rf = D3 * 4 + 3;
const legs = [{ code: C.SHOW, round: rf, producer: H4 }, { code: C.WIN, round: rf + 1, producer: H3 }];
const sent = D3 * M.DAY + 13 * 3600000;
const cards = (r) => (r === S0 ? [{ player: ALICE, legs, time: sent, height: heightAt(sent), changes: 0 }] : []);

test("G37-1 (Medium): an ON week whose ruler cards never arrive is not voided at the deadline (outage, RL-9)", async () => {
  const late = M.weekStart(4) + 2 * M.DAY + 3 * 3600000;          // past week 3's deadline (2 days after it ends)
  const out = tmp();
  // COMBO_RULER_FROM_WEEK = 3: week 3 is ON. race-data has the W files (final results, past the race) but no R003.json.
  await quiet(() => run({ p: node({ t: late, cards }), check: node({ t: late, cards }), out, raceDir: raceDir(), blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: late, vhpMovesOf: async () => 0n, rulerFrom: 3, raceRulerFrom: 3 })).catch(() => {});
  const card = read(out, dn(D3)).slots.find((s) => s.round === S0).cards[0];
  assert.notDeepEqual([card.state, card.outcome], ["final", "void"], `with no R file at all the card was made final void: legs ${JSON.stringify(card.legs.map((l) => l[4]))}`);
  assert.equal(card.state, "pending");
});
