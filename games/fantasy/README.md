# Fantasy Producers (game 4) and Weekly Rival (game 5)

The first game on the Shared Game Kit (D-158 #4). The rules are in `.ai/games/FantasyProducers.md`. The decisions are in
the Claude project under `claude/fantasy/` (the sim and rules note, the port prep note, the G7 lock confirmation, and
the dated plan).

| File | What |
|---|---|
| `math.js` | Every rule, pure and in whole numbers (the page uses the same file). It holds the price list, the points (cap 150, captain ×2, void 0, a quiet or offline day as earned), one change a day (a producer swapped in may take the captaincy from anyone) and Weekly Rival. |
| `ruler-view.ts` | Turns a UTC day into a VHP Ruler card: `ctx.blockAt` finds the day's blocks and the lock block, and `ctx.vhp.card()` gives the real ruler's scored card. |
| `recorder.ts` | The kit `GameModule`: 7 rounds a week (Monday to Saturday play, plus the Sunday fun round), the write-once price list (`inputsFile`), each day's result from its ruler card, the carried team, and the Rival records (`weekExtras`). |
| `game.json` | The manifest: `vhpData`, `inputsFile`, `inputsLeadHours: 48`, payout rule `d152`/`dense255`. It is pinned in `game-data/deployment.json` → `vaultGames.4.kit` (KC-26). |
| `tests/math.test.mjs` | The rules: 12 tests. |
| `tests/recorder.test.ts` | The module with a fake ruler and block clock (10 tests), and end to end on the real ruler over the Race's made-up 24-day chain (2 tests). |
| `tests/page.test.mjs` | The page: it loads `math.js`, every element the script uses exists, no HTML strings, only the kit's files, the Picks rounds, and the 11 Nov rule text. |
| `../../fantasy.html`, `.js`, `.css` | The game page (hidden: `noindex`, not in the menus until launch). |

## How a day is scored
1. `ctx.blockAt` gives the day's first block `S0`, its last block `S1` (the block before the next day's first), and the
   lock block `L` (the block before the first one at or after 5 minutes before the day). `L` is the last block that can
   still hold a pick (Picks.ts).
2. `ctx.vhp.card({ game: 4, round: yyyymmdd, window: { W0: L − 7199, W1: L, L, S0, S1 }, … })` is the real ruler's card.
3. Each listed producer's day = min(150, 100 × credited ÷ expected), kept in hundredths. A void day is 0.
4. A team's day is the sum of its producers', with the captain counted twice.
5. The day stays PENDING when:
   - the kit's `NotYet` says the data or the block isn't there yet;
   - the card is flagged;
   - a listed producer has no row (the ruler's G6 `include` will give every listed producer one).

## Points
Points are kept in hundredths: a producer's day is at most 15,000 (= 150.00), and a team's day at most 90,000.

## Status
- **Waits on two pieces from other chats:**
  - kit **G7** (`ctx.blockAt`, branch `kit-blockat`). Until it's merged, the price list waits and every day is pending.
  - the ruler's **G6** (`include`). Until it's merged, a day with a listed producer missing from its card stays pending.
- **The workflow job is rendered:** `record-fantasy` and `publish-kit` in `games.yml`. Both run only when
  `FANTASY_ENABLED` is `true`.
