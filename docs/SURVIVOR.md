# Survivor (game 3)

An elimination game in Knode Games. Each play day you pick one Koinos block producer that you think will stay out of the bottom of the day's ruler scores, the **out-zone**. You have two lives and can use each producer once a season. The last players standing win.

| | |
|---|---|
| Kind | A Staked board (weekly points from the vault's Survivor bucket) and a Free play board. The Knode Mana sponsor pays the Mana; no entry fee, no wager |
| Season | Two vault weeks: Monday to Saturday each, **12 play days**. Sundays rest (WEEK_CYCLE) |
| Scoring | The shared VHP ruler (RULE_VERSION 4): one ruler card per UTC day |
| Picks | One a day on the KnodeGames Picks contract (game 3). Each day locks at 23:55 UTC the night before and opens 7 days ahead |
| Seasons | Season 1 is unpaid practice and Season 2 is the first paid season (owner, 12 Nov, option C). Dates are decided by Mon 7 Dec |
| Free prize | **OFF** (D-081, D-082). The Free play board shows standings only |
| Code | `games/survivor/` (a Shared Game Kit module) and `survivor.html` / `survivor.js` (the page) |
| Status | **Building, not launched.** It waits on the kit needs below, Repo Lens pass 4 (not before Tue 24 Nov), a testnet season, Picks registration and the vault steps |

Rules in plain language: `.ai/games/Survivor.md`. The rules in code: `games/survivor/math.js` (every number below comes from it).

## How to play
1. **Join a season by picking for its day 1** (its first Monday). Nobody joins later.
2. **Pick a producer for every play day**, Monday to Saturday. You can pick up to 7 days ahead and change a pick up to 5 times until it locks at 23:55 UTC the night before. There is nothing to pick on Sundays.
3. **Stay out of the out-zone.** After each day the day's ruler card says how lucky each producer was against its own expected blocks. The unluckiest ones are in the out-zone.
4. **Use each producer once a season.** There are about 18 producers and 12 play days, so plan ahead.

## The rules
- **The day's score.** Each producer's day score is its **fpct** on the day's ruler card: how its credited blocks compare with its own expected blocks, as a percentile of the field (0 = unluckiest, 1,000,000 = luckiest). Survivor keeps it to thousandths (0–999). Big and small producers have the same chance; the ruler's daily fairness runs measured 0.94–1.07 of fair.
- **The field.** The card's producers with entry (expected blocks of at least 10, form of at least 0.80 or steady, a history) that aren't void.
- **The out-zone** grows from a quarter of the field on day 1 to half on day 12: `floor(field × (10 + n) ÷ 44)`. With 18 producers that is 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9. A producer is out when its score is below the score at the out-zone line; a tie at the line is safe.
- **Lives: 2.** You lose one for:
  - an out-zone pick;
  - no pick;
  - a producer not in the day's field;
  - a producer you already used this season.
- **A void producer** (its VHP moved more than −12% / +50% during the day, the ruler's daily band) is out of that day's field only. **A pick on it costs no life, and the producer still counts as used** (owner, 12 Nov).
- **Two boards** (owner, 30 Oct). Wallets staked in Survivor in either week of the season play the Staked board; everyone else plays Free play. Each board has its own **safety net** and its own **end**:
  - Safety net: if nobody on a board is safe that day, nobody on that board loses a life for the out-zone. A pick that couldn't count (none, not in the field, reused) still costs its life. A void pick counts as safe for the net: it isn't a loss.
  - End: after the day that leaves 2 or fewer of the board's players in (if it started with more than 2), when none is left, or after day 12.
- **Ranking** (per board): lasted longest, then more lives, then the higher total of your counted picks' scores. Equal on all three share a place.
- **Staked weekly points** come from the Staked board's standings at each week's end. The vault's weekly Survivor bucket pays the top 30% (D-152, the kit's paid set).
- **Free prize (OFF):** 4 + 2 VHP a season, paid only in the season's last vault week (`--season 2`). Before it can be switched on, the kit must also apply four conditions (kit needs K3, K5):
  - held 1 VHP at every daily check;
  - free in both weeks;
  - not knocked out by a pick that couldn't count;
  - at least 3 such players with 2+ valid picks.

## How it works: Survivor on the Shared Game Kit
The kit does every chain read on two nodes, the stakes, the clock, the files, pending → final, holds, boards, the vault file and alerts (`.ai/standards/GAME_KIT.md`). Survivor supplies `games/survivor/recorder.ts`:

| Part | What Survivor does |
|---|---|
| Rounds | One per play day, id `d<yyyymmdd>`, Picks round = the UTC day number. `locksAt` is the kit's day key (the end of its own day); the 5-minute lock is the Picks contract's, on chain |
| Result | The day's ruler card from `ctx.vhp.card`, with Survivor's settings (`math.js` `CARD`: game 3, c 500000, minK 10, pool rule min, own rule spot, paying, the Knode Games Pool pooled). Window from block heights: `S0` = the first block at or after 00:00 UTC, `S1` = the last before the next 00:00, `L` = the last block before the 23:55 lock, size window `W0 … W1` = the 7,200 blocks ending at `L` |
| Inputs | Every play day of the season so far, from the same cards: a day's points depend on the season's earlier days |
| State | Each wallet's picks for the season (`[[n, producer], …]`), carried from the season's first week to its second; a new season starts empty |
| Points | The day's change in the wallet's **season standing** = (days × 3 + lives) × 2^14 + total. The week's first play day carries the whole standing. A week's points therefore add up to the standing at the week's end, which orders players exactly as the ranking does (tested on 5,000 random seasons). The kit's tally, D-152 paid set, vault file and boards then work unchanged. Points are never negative and at most 638,975 (`maxRoundPoints`) |

The publish job runs no game code: it rebuilds every ruler card a week file lists (G3) and re-checks the week's tally from the per-round points.

## Kit needs (before Survivor can run)
| Id | Need | Owner | Why |
|---|---|---|---|
| **K1** | `scoreRound` gets the wallets on the season's staked board: `{ seasonStaked }` (staked in Survivor in either week of the season so far, by the vault's rule) | Architecture | Each board has its own safety net and end, so a day's lives depend on who is staked. The kit already reads the stakes before scoring; it doesn't pass them on. Without it `scoreRound` refuses to guess and stops the run |
| **G7** | `ctx.blockAt(ms)` in `inputsFor` and `resultOf` | Architecture (branch `kit-blockat`, built, not merged) | A UTC day's ruler window needs block heights. Without it every day stays PENDING |
| **Pin** | `game-data/deployment.json` `vaultGames.3.kit` = `{ payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, sundayFunRound: false, roundsCorrectable: false, liveWeek: false }` | Vault chat | The kit refuses to load a vault game without its payout pin (KC-26) |
| **K4** | An open copy of the current week (`liveWeek`), written every run during the week | Architecture | The kit records a week only after it ends, but a Survivor player must see each day's result (lives, the out-zone) the next morning, not a week later |
| **K3** | For a game with `seasonWeeks` > 1: fill `first` / `second` only in the season's last vault week (the vault refuses winners in other weeks), and rank the free board from wallets free in every week of the season | Architecture | Only for the free prize, which is OFF |
| **K5** | A per-day "held 1 VHP" check of every free-board wallet, on two nodes | Architecture | Only for the free prize, which is OFF |
| **K6** | The ruler's `mode` in the kit's card settings (`SURVIVOR_RULER_MODE`) | Architecture with the Ruler chat | So the owner can pick a scoring mode for Survivor (see the finding below) |

The end-to-end test (`games/survivor/tests/recorder.test.ts`) supplies K1 and G7 the way the kit will, around the unchanged module. It proves a whole week goes final through the kit's real recorder and publish check, with each wallet's week points equal to its season standing.

## Simulations (real ruler data)
`sims/survivor/make-cards.mjs` makes real RULE_VERSION 4 cards from the published `vhp-data` branch (20 days of 28,800 blocks, 12 Nov 2026). `sims/survivor/season-sim.mjs` plays 400 seasons per row from those days:

| Ruler mode | Players | Board ends (median) | Left after day 12 (median) | Wins by "informed" players (half the field) |
|---|---|---|---|---|
| A (today) | 10 | day 11 | 2 | 90% |
| A | 50 | day 12 | 7 | 96% |
| A | 200 | day 12 | 26 | 98% |
| D (even odds) | 10 | day 10 | 2 | 80% |
| D | 50 | day 12 | 4 | 85% |
| D | 200 | day 12 | 16 | 83% |

An "informed" player avoids producers that landed in the out-zone on earlier days. Seasons run their full 12 days from about 50 players up, and the ranking decides.

**Finding (owner and Ruler chat to decide).** Under mode A, producers at the 1,000-block luck cap are scored almost without luck. Over the 20 days:
- two producers were in the out-zone **every day** and six **never**;
- under mode D the same two were out about 90% of days.

They look like the steady under-signers the ruler keeps at full size on purpose (D-163). In Survivor that makes them a known trap and the reliable producers a known list, the pattern recognition the owner wanted to avoid. The options are a mode for Survivor (D is the most even here; needs K6), an out-zone measure other than fpct, or accepting it.

## Files
| File | What |
|---|---|
| `games/survivor/math.js` | The rules (pure). The page and the recorder share it |
| `games/survivor/recorder.ts` | The kit module |
| `games/survivor/game.json` | The manifest (`npm run game:check -- survivor`) |
| `games/survivor/tests/` | 16 rule and property tests; 7 module and end-to-end tests |
| `sims/survivor/` | The season simulation on real ruler cards |
| `survivor.html`, `survivor.js` | The page. Its rules text is current. Its data loading still reads the old recorder's files and is rewired to the kit's files once K4 exists |
| `bot/games/survivor.ts`, `survivor-math.js` and their tests | **The old recorder and rules (14-day seasons, blocks handicap)**, replaced by `games/survivor/`. No workflow runs them; they are kept until the owner confirms they can be removed |
| `bot/survivor-test.ts`, `tools/survivor-testnet/` | The testnet kit, built around the old recorder. To be moved to the kit module for the testnet season |

## Launch steps (after the kit needs; nothing before a Repo Lens GO)
1. Repo Lens pass 4 on the one Survivor PR (not before Tue 24 Nov), fixes, fix-check.
2. A testnet season (`docs/SURVIVOR-TESTNET.md`, refreshed for the kit module).
3. Register game 3 on Picks: kind 1, list_size 1, lock_mode 2, round_size 86,400,000, round_offset 0, lead 300,000, ahead 604,800,000, max_changes 5, 20 picks a day, enabled (48 h timelock). Add the sponsor allowlist row for game 3 picks.
4. Free-prize switch OFF for game 3 before Season 1's first vault week (`npm run prizes -- off 3`, then `--send`).
5. Vault: `game-add 3 "Survivor" --staked --free --season 2`, with `from_week` = Season 2's first vault week (Season 1 is practice and earns nothing). Then `game-apply` 48 h later, within 7 days; a game applied in week W earns from W + 1.
6. Set `math.js` `FIRST_WEEK` to Season 1's first vault week, render the kit workflow, set `SURVIVOR_ENABLED` and `SURVIVOR_PRIZES_FROM_WEEK` = Season 2's first week, then `games.json` live.

**No `SURVIVOR_RULER_FROM_WEEK`.** Survivor scores on the ruler from Season 1, its first season ever, so there is no old method to switch from. The unpaid practice Season 1 does the job of D-new A's shadow week: the ruler's results are published and nothing is paid from them. This is a D-new for the Library to file.
