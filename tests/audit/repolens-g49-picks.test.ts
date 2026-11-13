// Repo Lens #G-49: PR B picks-tool-2 @ 2a9e6305: G35-3 and the Fantasy games 4 / 5 configs vs picks/assembly/Picks.ts.
// Run from the PR B root: TZ=UTC node --import tsx --test --test-concurrency=1 /home/claude/g1/tests-g49/repolens-g49-picks.test.ts
// All pass at 2a9e6305 (confirmations; the last one documents an Info point).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const APP = path.resolve(process.env.APP || ".");
let T: any;
test.before(async () => { T = await import(path.join(APP, "bot/picks.ts")); });

/** picks/assembly/Picks.ts checkGame, ported line by line (lock_mode 2 = time). */
function checkGame(g: any) {
  const n = (x: any) => BigInt(x);
  if (!(g.id >= 1 && g.id <= 1000000)) return "id";
  const nb = Buffer.byteLength(g.name); if (!(nb >= 1 && nb <= 40)) return "name";
  if (g.kind === 1) { if (!(g.list_size === 1 && n(g.number_min) === 0n && n(g.number_max) === 0n)) return "kind1"; }
  else if (g.kind === 2) { if (!(g.list_size >= 2 && g.list_size <= 10 && n(g.number_min) === 0n && n(g.number_max) === 0n)) return "kind2"; }
  else return "kind";
  if (!(g.lock_mode === 1 || g.lock_mode === 2)) return "lock";
  if (!(n(g.round_size) >= 1n && n(g.round_offset) < n(g.round_size))) return "round";
  const minLead = g.lock_mode === 1 ? 100n : 300000n, maxAhead = g.lock_mode === 1 ? 1008000n : 35n * 86400000n;
  if (!(n(g.lead) >= minLead)) return "lead";
  if (!(n(g.ahead) > n(g.lead) && n(g.ahead) <= maxAhead)) return "ahead";
  if (!(g.max_picks_per_day >= 1 && g.max_picks_per_day <= 50)) return "perday";
  if (!(g.max_changes <= 50)) return "changes";
  return null;
}

test("games 4 and 5: the tool's configs pass the contract's checkGame; kind 2 list 5 / kind 1 list 1; time lock, 1 day, offset 0", () => {
  for (const g of [T.FANTASY_TEAM_GAME, T.FANTASY_RIVAL_GAME]) {
    const c = T.buildGameConfig(g);
    assert.equal(checkGame(c), null, `game ${g.id}`);
    assert.deepEqual([c.lock_mode, c.round_size, c.round_offset, c.lead, c.ahead], [2, "86400000", "0", "300000", "604800000"]);
  }
  assert.deepEqual([T.buildGameConfig(T.FANTASY_TEAM_GAME).kind, T.buildGameConfig(T.FANTASY_TEAM_GAME).list_size], [2, 5]);
  assert.deepEqual([T.buildGameConfig(T.FANTASY_RIVAL_GAME).kind, T.buildGameConfig(T.FANTASY_RIVAL_GAME).list_size], [1, 1]);
});

test("Fantasy's lock rule L = blockAt(target − lead) − 1 needs lead 5 min: tighten --lead is refused on games 4 and 5 (G35-3 pin)", () => {
  for (const g of [T.FANTASY_TEAM_GAME, T.FANTASY_RIVAL_GAME]) {
    const c = T.buildGameConfig(g);
    assert.throws(() => T.tightenConfig(c, { lead: 600000 }, g), /recorder scores lead 300000/);
    assert.doesNotThrow(() => T.tightenConfig(c, { max_picks_per_day: 5 }, g));
  }
  // the contract's pick(): accepted while head time < target − lead, so the last block a pick lands in has time < target − 5 min,
  // which is blockAt(target − lead) − 1 (blockAt = the first block at or after a time). Round 20780: locks Sun 22 Nov 23:55 UTC.
  assert.equal(20780 * 86400000 - 300000, Date.parse("2026-11-22T23:55:00Z"));
  assert.equal(new Date(20787 * 86400000).getUTCDay(), 1, "20787 is a Monday (Weekly Rival's round = its week's first day)");
});

test("Info: once applied, the contract also takes picks on rounds before 20780 (any day within 7 days); only the recorder/page ignore them", () => {
  const rs = T.timeRounds(T.FANTASY_TEAM_GAME, Date.parse("2026-11-15T12:00:00Z"), 3);
  assert.equal(rs[0].round, 20773, "a game applied on Sun 15 Nov opens round 20773 (Mon 16 Nov) at once");
});
