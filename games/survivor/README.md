# Survivor (game 3) on the Shared Game Kit

Survivor is a two-week elimination game. Each play day a player picks one block producer. A producer that lands in the day's out-zone costs one of the player's 2 lives, and each producer can be used only once a season. The rules are in `.ai/games/Survivor.md` (plain language) and `math.js` (code). The season's timing follows `.ai/standards/WEEK_CYCLE.md`: Monday to Saturday, Sundays rest.

**Status: building.** It is not in any workflow, it publishes nothing, and nothing pays from it. It needs three things before it can run (see "Before it can run").

## Files
| File | What it is |
|---|---|
| `math.js` | Every rule (pure): the calendar, a day from its ruler card, lives, boards, safety nets, the ranking, and the points the kit adds up. The page loads it too. |
| `recorder.ts` | The kit module (`GameModule`): rounds, each day's ruler card, the carried picks and the scoring. `makeGame(firstWeek)` builds it; `game` is mainnet's (no rounds until `math.js` `FIRST_WEEK` is set). |
| `game.json` | The manifest (`npm run game:check -- survivor`). |
| `tests/math.test.mjs` | One test per rule, plus property tests over 6,500 random seasons. |
| `tests/recorder.test.ts` | The module on its own, and a whole week through the kit's real recorder and publish check on fake nodes and the ruler's test chain. |

Season simulations on real ruler cards are in `sims/survivor/` (`make-cards.mjs`, `season-sim.mjs`).

## How a season maps onto the kit
- **Rounds:** one per play day (Monday to Saturday), id `d<yyyymmdd>`. The Picks round is the UTC day number (Picks game 3, `round_size` one day). `locksAt` is the kit's day key, the end of the round's own day. The real lock (5 minutes before the day starts) is the Picks contract's, enforced on chain.
- **Result:** the day's VHP ruler card, made by the kit (`ctx.vhp.card`) with Survivor's settings (`math.js` `CARD`). The window comes from block heights:
  - `S0` is the day's first block and `S1` its last;
  - `L` is the last block a pick can land in;
  - the size window is the 7,200 blocks ending at `L`.
- **Inputs:** every play day of the season so far, from the same cards. A player's lives depend on the earlier days.
- **State:** each wallet's picks for the season. A pick for day 1 joins the season. The state carries from the season's first week to its second, and a new season starts empty.
- **Points:** a round's points are the day's change in the wallet's season standing (`math.js` "POINTS FOR THE KIT"). The week's first play day carries the whole standing. So the kit's weekly tally ranks the board exactly as the season stands at the week's end, and the kit's own paid set (D-152), vault file and boards work unchanged.

## What it publishes once enabled (branch `games-data`, folder `survivor/`)
- the kit's files: `W<NNN>.json` (one per vault week, with the ruler cards it used), `board.json`, `alltime.json`, `vault/W<w>.json`, and `vault/HOLD-` / `RELEASE-` files.

## Before it can run (kit needs; owners named in `docs/SURVIVOR.md`)
1. **K1 (Architecture):** `scoreRound` receives the wallets on the season's staked board, `{ seasonStaked }`. Until then `scoreRound` refuses to guess and stops the run.
2. **G7 (Architecture, branch `kit-blockat`):** `ctx.blockAt(ms)` in `inputsFor` and `resultOf`. Until then every day stays PENDING.
3. **Vault pin (Vault chat):** `game-data/deployment.json` `vaultGames.3.kit`, the payout pin. Until then the kit refuses to load the game.
4. **Live days (Architecture, K4):** the kit records a week only after it ends, but a Survivor player needs each day's result during the week. The page needs an open copy of the current week (`liveWeek`).

The free prize stays OFF until the kit can also apply the free board's extra conditions (K3, K5 in `docs/SURVIVOR.md`).
