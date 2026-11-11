// Repo Lens #G-4 (kg-09-bracket @ d19a8f19). Place in tests/audit/. Fails today.
// G4-1: game 9 is to be added to the vault with --free (docs/UPGRADE-V6.md:94, .ai/games/ProducerBracket.md:30) while its
//       free-prize switch is OFF (owner 11 Nov). The stake panel's line (stake-panel.js explain) promises "the 2 + 1 VHP
//       prize" whenever the vault's game has free_prize, so the Bracket page would promise a prize that isn't paid.
//       Fix: explain(game, min, opts) says only the staked sentence when opts.freePrize === false, mount passes its opts
//       through, and bracket.js mounts with { game: BM.GAME_ID, freePrize: false } while the switch is off.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("G4-1 (Low): the stake panel can be told the free prize is off, and the Bracket page tells it", () => {
  const src = read("stake-panel.js");
  const start = src.indexOf("function explain(");
  assert.ok(start > 0, "explain() found");
  const end = src.indexOf("\n  }\n", start);
  const body = src.slice(start, end + 4);
  const explain = new Function("exact", "UNIT", `${body}; return explain;`)((x) => String(x), 100000000n);
  const game9 = { staked: true, free_prize: true, season_weeks: 1 };
  const line = explain(game9, 100000000n, { freePrize: false });
  assert.doesNotMatch(line, /2 \+ 1 VHP|4 \+ 2 VHP|free players play for/, "with the free prize off, no prize is promised: " + line);
  assert.match(explain(game9, 100000000n), /free players play for the 2 \+ 1 VHP prize/, "other games are unchanged");
  assert.match(src, /explain\(g, min, opts\)/, "mount passes its options to explain");
  assert.match(read("bracket.js"), /KStake\.mount\(\$\("bracket-stake"\), \{ game: BM\.GAME_ID, freePrize: false \}\)/, "the Bracket page says its free prize is off");
});
