// Repo Lens #G-35 (PR B picks-tool-2 @ d45bfb98): tighten --lead on a game a recorder scores with a pinned lead.
// Run from the repository root (PR B applied): TZ=UTC node --import tsx --test /home/claude/g1/tests-g35/repolens-g35-picks.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve(process.env.APP || ".");

test("G35-3: tighten refuses a lead the game's recorder doesn't score (game 12: lead 100 is pinned in blockx-math.js and checked on chain)", async () => {
  const { tightenConfig } = await import(path.join(APP, "bot/picks.ts"));
  // The recorder stops recording a started game whose on-chain lead isn't its own (bot/games/blockx.ts, BX-33/BX-46):
  const rec = fs.readFileSync(path.join(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(rec, /Number\(gc\.lead\) !== G\.LEAD\) why = /);
  const g = { id: 12, name: "Who Signs Block X (hourly)", kind: 1, list_size: 1, number_min: "0", number_max: "0", lock_mode: 1, round_size: "1200", round_offset: "0", lead: "100", ahead: "28900", max_picks_per_day: 48, max_changes: 1, enabled: true };
  const pinned = { id: 12, round: 1200, offset: 0, lead: 100, ahead: 28900, picksPerDay: 48, maxChanges: 1 };   // the tool's gameOf(net, 12)
  // Candidate fix: tightenConfig(g, want, pinned) refuses --lead unless the pinned (recorder) lead is changed first.
  assert.throws(() => (tightenConfig as any)(g, { lead: 200 }, pinned), /lead/, "a longer lead on game 12 silently stops Block X's recorder");
  // per-day / changes / ahead stay allowed
  assert.doesNotThrow(() => (tightenConfig as any)(g, { max_picks_per_day: 24 }, pinned));
});
