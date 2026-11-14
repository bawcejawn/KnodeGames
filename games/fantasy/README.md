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
| `tests/recorder.test.ts` | The module with a fake ruler and block clock (10 tests), and end to end on the real ruler over the Race's made-up chain (2 tests). |
| `tests/g42-*.test.ts` | Repo Lens #G-42's tests, run through the kit's own Replay (locksAt, pickers without a team, Rival size, flagged cards). |
| `tests/g52-fixes.test.ts` | #G-52 G52-3 and G52-4, the week's list as `include`, and the 48-hour no-card rule. |
| `tests/sample.ts` | The sample week for the kit's conformance suite (`npm run game:check -- fantasy`). |
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
   - a listed producer has no row. Fantasy passes the week's list as the card's `include` (the ruler's G6), so every
     listed producer gets a row once the kit carries `include` into the card (Architecture's next kit PR).
6. A **flagged** card (a bad or rebuilt hour in the ruler's data) waits until Tuesday 00:00 UTC after the week. If it is
   still flagged then, the day counts as 0 for every team (owner, 12 Nov). The cutoff is read from the chain
   (`blockAt`), so both nodes decide alike, and the week still goes final before the vault's Thursday backstop.
   In the price list, a flagged form day is left out of every producer's form. If all 7 form days are flagged, the
   price list waits (pending, retried each hour) and alerts from 6 hours before the week (#G-52 G52-3).
7. **No ruler card at all** for a day (the ruler's data never reached it): the day waits 48 hours after it ends. Then
   it counts 0 for every team, recorded and alerted (owner, 13 Nov). This uses the kit's `ctx.fallback` (Architecture's
   `kit-next` PR, opening Fri 20 Nov); until it is merged, such a day stays pending and the kit's Thursday backstop applies.

## Repo Lens #G-42 (FIX FIRST on `81a0343`): fixed
- **G42-1:** `locksAt = day + 1`, so the kit's `dayOf(locksAt)` is the day (KC-30).
- **G42-2:** a wallet that picked without a valid team scores 0.
- **G42-3:** Weekly Rival is capped at 2,500 matches (under the 256 KB extras cap).
- **G42-4:** a flagged form card no longer stops the run.
- **G42-5:** the owner's flagged-day rule above.
- **Info:** `big()` refuses negatives; the page carries your Saturday team into next Monday.
- The Repo Lens tests are kept in `tests/g42-*.test.ts`.

## Repo Lens #G-52 (GO with conditions on `1f8110c`)
- **G52-1:** `main` merged in; the kit job re-rendered.
- **G52-3:** all 7 form cards flagged → the price list waits (NotYet), never a plain error.
- **G52-4:** above 2,500 Rival matches, the ones with the most points between the two players are kept (ties by
  address) and the week file says how many were left out (`rivalDropped`).
- **Sample week:** `tests/sample.ts` for `npm run game:check -- fantasy`.

## Points
Points are kept in hundredths: a producer's day is at most 15,000 (= 150.00), and a team's day at most 90,000.

## Status
- Kit **G7** (`ctx.blockAt`, #280) is merged.
- **Waits on kit pieces from Architecture:**
  - the kit carrying the ruler's **G6** `include` into card settings (Fantasy already passes it). Until then, a day
    with a listed producer missing from its card stays pending.
  - a kit `ctx.fallback` for the 48-hour no-card rule, and a `checkAt` for the conformance sample (an inputs-file game
    can't have a decided day at hour 0, which is before the week).
  - All three are in Architecture's `kit-next` PR (opens Fri 20 Nov, merge by Fri 27 Nov).
- **Before live (vault week 7):** a small Fantasy PR adds `"parts": "d"` to `game.json` and the `partCols` declaration
  (a 9,000-player day is about 0.7 MB on parts, under the 1.2 MB warning).
- **The workflow job is rendered:** `record-fantasy` and `publish-kit` in `games.yml`. Both run only when
  `FANTASY_ENABLED` is `true`.
