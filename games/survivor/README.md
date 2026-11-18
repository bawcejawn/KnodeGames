# Survivor (game 3) on the Shared Game Kit

Survivor is a two-week elimination game. Each play day a player picks one block producer. A producer that lands in the day's out-zone costs one of the player's 2 lives, and each producer can be used only once a season. The rules are in `.ai/games/Survivor.md` (plain language) and `math.js` (code). The season's timing follows `.ai/standards/WEEK_CYCLE.md`: Monday to Saturday, Sundays rest.

**Status: built, in review.** Season 1 starts Mon 7 Dec 2026 (vault week 7, unpaid practice); Season 2 (week 9) is the first paid season. Launch steps: `docs/SURVIVOR-RUNBOOK.md`.

## Files
| File | What it is |
|---|---|
| `math.js` | Every rule (pure): the calendar, a day from its ruler card, a skipped day, lives, boards, safety nets, the ranking, and the points the kit adds up. The page loads it too. |
| `recorder.ts` | The kit module (`GameModule`). `makeGame(firstWeek)` builds it; `game` is mainnet's (`math.js` `FIRST_WEEK` = 7). |
| `game.json` | The manifest (`npm run game:check -- survivor`). |
| `tests/math.test.mjs` | One test per rule, plus property tests over thousands of random seasons. |
| `tests/recorder.test.ts` | The module, the no-card rule, the season check, and a whole week through the kit's real recorder and publish check. |
| `tests/page.test.ts` | The page's code reading the parts folders the kit wrote. |
| `tests/sample.ts` | The conformance sample week (Season 1's first week, on the kit's ruler test chain). |

Season simulations on real ruler cards are in `sims/survivor/`.

## How a season maps onto the kit
- **Rounds:** one per play day, id `d<yyyymmdd>`, Picks round = the UTC day number (Picks game 3). The lock (23:55 UTC the night before) is the Picks contract's, on chain.
- **Result:** the day's VHP ruler card (`ctx.vhp.card`, Survivor's settings in `math.js` `CARD`), its window from block heights (`ctx.blockAt`). No card 48 h after the day: the day doesn't count, through `ctx.fallback` (K8), only with the kit's `ctx.decided` (K9); until then such a day stays pending.
- **Inputs:** every play day of the season so far.
- **State:** each wallet's picks for the season, carried from the first week to the second.
- **Points:** the day's change in the wallet's season standing, so the kit's weekly tally ranks the season as it stands at the week's end.
- **Season:** the kit's `seasonStaked` and season start (K1); the start must be `math.js`'s or the run stops.

## What it publishes once enabled (branch `games-data`, folder `survivor/`)
`W<NNN>/` (KG parts v1: `manifest.json`, `wk`, `d1`–`d6`, `p/<x>` shards), the current week's open copy, `board.json`, `alltime.json`, `vault/W<w>.json` (from week 9), and `vault/HOLD-` / `RELEASE-` files.

## Capacity (CAPACITY_STANDARD rule 1)
About **1,020 bytes per player** in a season's second week. One file would reach the 2 MB cap at about 1,900 players, so Survivor writes parts: at 9,000 players the largest part is 0.57 MB (the 60% warning is at 1.2 MB; about 19,000 players). Measured with the kit's `weekToParts` (`docs/SURVIVOR.md`).
