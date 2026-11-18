# Survivor: a walk through the code

Survivor is four small files on top of the Shared Game Kit. The kit (`kit/`) does every chain read on two nodes, the clock, the files, pending → final, holds, boards and the vault file. Survivor only says what a season is and how a day is scored.

| # | File | What it is |
|---|---|---|
| 1 | `games/survivor/math.js` | The rules. Pure arithmetic: no internet, no clock, no wallet. The page and the recorder both load it |
| 2 | `games/survivor/recorder.ts` | The kit module: the season's rounds, each day's ruler card, the carried picks, the points |
| 3 | `games/survivor/game.json` | The manifest: game 3, seasons of 2 weeks, the first week (7), the live week, parts |
| 4 | `survivor.js` (with `survivor.html`) | The page: reads the kit's files, sends your pick |

## 1. `math.js`: the rules
- **The calendar.** `GENESIS` is vault week 0 (Mon 19 Oct 2026). `FIRST_WEEK` = 7 (Mon 7 Dec 2026). `seasonOfWeek(w)` says which season a week is in and whether it is the season's first or second week. `playDaysOf(w)` lists Monday to Saturday with their season day numbers 1–12; Sunday is never a play day. `lockTime(day)` is 23:55 UTC the night before (the Picks contract's lead of 5 minutes).
- **A day from its card.** `dayFromCard(card, n)` takes the scored ruler card: producers with entry and not void make the field, each with its `fpct` in thousandths (`scoreOf`). `outOf(field, n)` marks the out-zone: `outSize(m, n) = floor(m × (10 + n) ÷ 44)` producers, everyone strictly below the line's score (ties safe). `skipDay(round, n)` is a day that doesn't count (no ruler card after 48 h).
- **A season.** `playSeason(days, picks, staked)` walks the days in order. For each player still in: no pick, a reused producer, a void producer, one not in the field, out-zone or safe (`CODE`). Each board (staked, free) gets its own safety net and end. A skipped day changes nobody. Each player ends with `lives`, `days`, `total`, `outN`, `used` and a one-letter-a-day `log`.
- **The points.** `standingOf(x) = (days × 3 + lives) × 16384 + total`. `roundPoints(...)` is the standing after a day minus before it (the week's first play day carries the whole standing). So a week's points add up to the standing at its end, and ranking by points is ranking by the rules. `decodeStanding` turns a standing back into days, lives and total (the page uses it).
- **The free prize switch** (`freePrizeOn`): the page's strict reading of the owner's switches file. The prize is OFF.

## 2. `recorder.ts`: the kit module
- **`roundsFor(week)`:** one round per play day, id `d<yyyymmdd>`, Picks round = the UTC day number. Weeks outside a season have none.
- **`settingsFor(day, blockAt)`:** the day's ruler card window from block heights: `S0` (first block of the day), `S1` (last), `L` (last block a pick can land in), and the 7,200 blocks ending at `L`.
- **`dayResult(day, n, ctx, decide)`:** the card (`ctx.vhp.card`), or a skipped day. A skip needs the kit's `ctx.decided` (K9: how each published round of the season was decided): a day published as skipped stays skipped; a day decided with its card is never skipped; otherwise a skip only after the first block 48 hours past the day's end exists, with this run's ruler data loaded. In `resultOf` the skip is recorded through the kit's `ctx.fallback`.
- **`inputsFor`:** every play day of the season so far, stopping at the first one that isn't ready. **`resultOf`** waits (NotYet) until the inputs hold every earlier day.
- **`carryIn` / `nextState`:** each wallet's picks for the season. A pick for day 1 joins; later picks only count for wallets in the season; the second week carries the first week's picks; a new season starts empty.
- **`scoreRound`:** needs the kit's season context (`seasonStaked`, and the season's first week, which must equal `math.js`'s, or the run stops). It plays the season to that day with `math.js` and returns each wallet's points.
- **`partCols`:** the page's display column `pk`, each wallet's pick that day.

## 3. `game.json`
`seasonWeeks: 2`, `firstWeek: 7` (weeks before Season 1 are never recorded), `liveWeek: true` (an open copy of the current week every hour), `parts: "d"` (KG parts v1, one part a day), `vhpData: true` (the ruler), `maxRoundPoints: 638975`. The payout fields are pinned in `game-data/deployment.json` `vaultGames.3.kit` (KC-26).

## 4. `survivor.js`: the page
- **Reading.** `loadWeek(w)` fetches `W<NNN>/manifest.json` and its parts (or `W<NNN>.json`), `decodePart` checks and decodes each part, `weekFromParts` rebuilds the week. `seasonView(weeks)` adds up each player's points day by day into standings (`decodeStanding`), which give lives, days, score, the out day and a day log (safe, lost a life, didn't count, waiting). `placesOf` ranks a board with `math.js` `rank`.
- **Picking.** The page reads your picks for the season from the Picks contract (`get_pick`, `get_usage`), offers the open play days (more than 2 minutes before the lock), blocks producers you picked for another day of the season, and sends one `pick` operation that you confirm in your wallet. If game 3's settings on chain aren't the page's, picking stays off.
- **Safety.** Everything on screen is built with `textContent`; the only data it trusts is the published files and the chain. `tests/page.test.ts` runs these functions on files the kit's real recorder wrote.
