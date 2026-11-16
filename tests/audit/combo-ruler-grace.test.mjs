// Combo Card: a ruled race leg with no ruler card is given up when the Race skips that race (owner, 15 Nov; Repo Lens
// #G-91 section 7): the race's week end + the Race's own RULER_GRACE (48 h), never earlier. For a next-week race (a
// Sunday card's Monday race) the Race skips it a week later, so Combo gives up at its own Vault edge instead (G51-1).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const F = await import(path.join(process.env.APP, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { run, M, C, H1, H2, H3, H4, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const S = await import(path.join(process.env.APP, "bot/games/combo-score.mjs"));
const { RULER_GRACE } = await import(path.join(process.env.APP, "bot/race.ts"));

const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`;
const early = D3 * 4 + 1, rf = D3 * 4 + 3;                 // Mon 06:00 (ruler card published), Mon 18:00 (feed down)
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
async function aliceAt(at) {
  const out = tmp(), race = rulerUntil(raceDir(), rf);
  await quiet(() => run({ p: node({ t: at, cards }), check: node({ t: at, cards }), out, raceDir: race, blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: at, vhpMovesOf: async () => 0n, rulerFrom: 3, raceRulerFrom: 3 })).catch(() => {});
  const cs = read(out, dn(D3)).slots.find((s) => s.round === S0).cards;
  return { alice: cs.find((c) => c.player === ALICE), bob: cs.find((c) => c.player === BOB), vault: fs.existsSync(path.join(out, "vault", "W3.json")) };
}

test("Combo's grace is the Race's own RULER_GRACE (48 h), so both give up in the same run", () => {
  assert.equal(S.RACE_RULER_GRACE_MS, RULER_GRACE);
  assert.equal(S.RACE_RULER_GRACE_MS, 48 * 3600000);
  // A same-week race: Combo gives up exactly when the Race skips it (bot/race.ts: now >= week end + RULER_GRACE).
  assert.equal(S.ruledGiveUp(D3, rf, true), M.weekStart(4) + RULER_GRACE);
  assert.equal(S.raceRulerSkip(rf), M.weekStart(4) + RULER_GRACE);
  // No ruler file from the Race at all (its outage): the card waits to the Vault edge (RL-9, G37-1, G51-1).
  assert.equal(S.ruledGiveUp(D3, rf, false), S.comboVaultEdge(D3));
});

test("a next-week race (a Sunday card's Monday race): Combo gives up at its own Vault edge, the Race a week later", () => {
  const sunday = C.utcDay(M.weekStart(4) - 3600000), monday = M.raceIndex(M.weekStart(4));
  assert.equal(M.weekOf(sunday * M.DAY), 3);
  assert.equal(M.weekOf(M.raceStart(monday)), 4);
  assert.equal(S.ruledGiveUp(sunday, monday, true), M.weekStart(4) + S.VAULT_WINDOW_MS - 6 * 3600000);
  assert.ok(S.ruledGiveUp(sunday, monday, true) < S.raceRulerSkip(monday));
});

test("ruler outage: the leg still waits 1 minute before the Race's skip, and is given up 1 minute after", async () => {
  const before = await aliceAt(M.weekStart(4) + RULER_GRACE - 60000);
  assert.equal(before.bob.state, "final", "precondition: BOB's card is decided by published ruler cards");
  assert.equal(before.alice.state, "pending", "never given up earlier than the Race skips the race");
  const after = await aliceAt(M.weekStart(4) + RULER_GRACE + 60000);
  assert.notEqual(after.alice.state, "pending", `given up with the Race's skip: legs ${JSON.stringify(after.alice.legs.map((l) => l[4]))}`);
  assert.ok(after.alice.legs.some((l) => l[4] === "unresolved"));
  assert.equal(after.bob.outcome, "hit");
  assert.ok(after.vault, "week 3's Vault file is written, 24 h before its window closes");
});
