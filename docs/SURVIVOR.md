# Survivor (game 3)

An elimination game in Knode Games. Each play day you pick one Koinos block producer that you think will stay out of the bottom of the day's ruler scores, the **out-zone**. You have two lives and can use each producer once a season. The last players standing win.

| | |
|---|---|
| Kind | A Staked board (weekly points from the vault's Survivor bucket) and a Free play board. The Knode Mana sponsor pays the Mana; no entry fee, no wager |
| Season | Two vault weeks: Monday to Saturday each, **12 play days**. Sundays rest (WEEK_CYCLE) |
| Scoring | The shared VHP ruler (RULE_VERSION 4, mode A): one ruler card per UTC day |
| Picks | One a day on the Knode Games Picks contract (game 3). Each day locks at 23:55 UTC the night before and opens 7 days ahead |
| Seasons | **Season 1: Mon 7 Dec 2026** (vault weeks 7–8), unpaid practice. **Season 2: Mon 21 Dec 2026** (weeks 9–10), the first paid season. Then every 2 weeks (owner, 12 and 14 Nov) |
| Free prize | **OFF** (D-081, D-082). The Free play board shows standings only |
| Code | `games/survivor/` (a Shared Game Kit module) and `survivor.html` / `survivor.js` (the page) |
| Status | **Built, in review.** One PR; it merges after the kit's PR #319. Then Repo Lens, Picks registration and the vault steps (below) |

Rules in plain language: `.ai/games/Survivor.md`. The rules in code: `games/survivor/math.js` (every number below comes from it).

## How to play
1. **Join a season by picking for its day 1** (its first Monday). Nobody joins later.
2. **Pick a producer for every play day**, Monday to Saturday. You can pick up to 7 days ahead and change a pick up to 5 times until it locks at 23:55 UTC the night before. There is nothing to pick on Sundays.
3. **Stay out of the out-zone.** After each day the day's ruler card says how lucky each producer was against its own expected blocks. The unluckiest ones are in the out-zone.
4. **Use each producer once a season.** There are about 18 producers and 12 play days, so plan ahead.

## The rules
- **The day's score.** Each producer's day score is its **fpct** on the day's ruler card: how its credited blocks compare with its own expected blocks, as a percentile of the field (0 = unluckiest, 1,000,000 = luckiest). Survivor keeps it to thousandths (0–999).
- **The field.** The card's producers with entry (expected blocks of at least 10, a form and a history) that aren't void.
- **The out-zone** grows from a quarter of the field on day 1 to half on day 12: `floor(field × (10 + n) ÷ 44)`. With 18 producers that is 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9. A producer is out when its score is below the score at the out-zone line; a tie at the line is safe.
- **Lives: 2.** You lose one for an out-zone pick, no pick, a producer not in the day's field, or a producer you already used this season.
- **A void producer** (its VHP moved more than −12% / +50% during the day) is out of that day's field only. **A pick on it costs no life, and the producer still counts as used** (owner, 12 Nov).
- **A day with no ruler card** 48 hours after it ends **doesn't count** (owner, 14 Nov; the platform's 48 h rule): nobody loses a life, no pick is used, and the next day is still the next season day. It is recorded in the week file's `fallbacks`, alerted, and never re-decided once published.
- **Two boards** (owner, 30 Oct). Wallets staked in Survivor in the season's **first** week play the Staked board for the whole season; everyone else plays Free play, including a wallet that stakes only in the second week (owner, 16 Nov, Repo Lens J12-1: a later stake never changes a day already published, and the second week pays only the Staked board). Each board has its own **safety net** and its own **end**:
  - Safety net: if nobody on a board is safe that day, nobody on that board loses a life for the out-zone. A pick that couldn't count (none, not in the field, reused) still costs its life. A void pick counts as safe for the net.
  - End: after the day that leaves 2 or fewer of the board's players in (if it started with more than 2), when none is left, or after day 12.
- **Ranking** (per board): lasted longest, then more lives, then the higher total of your counted picks' scores. Equal on all three share a place.
- **Staked weekly points** come from the season standings at each week's end. The vault's weekly Survivor bucket pays the top 30% of that week's staked players (D-152, the kit's paid set), from Season 2.
- **Free prize (OFF):** 4 + 2 VHP a season, paid only in the season's last vault week (`--season 2`). Before it can be switched on, the kit must also apply four conditions (kit needs K3, K5): held 1 VHP at every daily check; free in both weeks; not knocked out by a pick that couldn't count; at least 3 such players with 2+ valid picks.

## How it works: Survivor on the Shared Game Kit
The kit does every chain read on two nodes, the stakes, the clock, the files, pending → final, holds, boards, the vault file and alerts (`.ai/standards/GAME_KIT.md`). Survivor supplies `games/survivor/recorder.ts`:

| Part | What Survivor does |
|---|---|
| Rounds | One per play day, id `d<yyyymmdd>`, Picks round = the UTC day number. `locksAt` is the kit's day key (the end of its own day); the 5-minute lock is the Picks contract's, on chain |
| Result | The day's ruler card from `ctx.vhp.card`, with Survivor's settings (`math.js` `CARD`). Window from block heights (`ctx.blockAt`): `S0` = the first block at or after 00:00 UTC, `S1` = the last before the next 00:00, `L` = the last block before the 23:55 lock, size window `W0 … W1` = the 7,200 blocks ending at `L` |
| No card | After the 48 h grace, through the kit's `ctx.fallback` (K8): the day doesn't count. Only with the kit's record of how each of the season's rounds was decided (`ctx.decided`, kit need **K9**), so a skip never flips once published. Until K9 is in the kit, a day with no card stays pending (never a guess) |
| Inputs | Every play day of the season so far: a day's points depend on the season's earlier days. A round waits until its earlier days are all in |
| State | Each wallet's picks for the season (`[[n, producer], …]`), carried from the season's first week to its second; a new season starts empty |
| Points | The day's change in the wallet's **season standing** = (days × 3 + lives) × 2^14 + total. The week's first play day carries the whole standing, so a week's points add up to the standing at the week's end, which orders players exactly as the ranking does. Never negative, at most 638,975 (`maxRoundPoints`) |
| Season | The kit's season context (K1): the Staked board = the season's first week's stakers (`seasonStaked` in week 1, `firstStaked` from week 2, K1b) and the season's first week. Every round checks that the kit's season start is `math.js`'s; if not, the run stops (no mis-scored season) |
| Live week | `liveWeek` (K4): the current week's open copy is written every hour, so players see each day's result the next morning |
| Files | KG parts v1, one part a day (`parts: "d"`), with a display column `pk` (each player's pick that day) |

The publish job runs no game code: it rebuilds every ruler card a week file lists (G3), checks every parts folder, and re-checks the week's tally from the per-round points.

## Capacity (CAPACITY_STANDARD rule 1)
Measured with the kit's own `weekToParts` on a season's second week (each wallet carrying 6 picks in and 12 out):

| Players in a season | As one file | Largest part (parts "d") | All parts |
|---|---|---|---|
| 1,500 | 1.45 MB (over the 60% warning) | 0.11 MB | 1.90 MB |
| 4,500 | 4.36 MB (over the 2 MB cap) | 0.29 MB | 5.70 MB |
| 9,000 | 8.73 MB | 0.57 MB | 11.42 MB |

About 1,020 bytes per player. As one file Survivor would stop at about 1,900 players; with parts the largest part reaches the 60% warning (1.2 MB) at about 19,000 players and the 2 MB cap at about 31,000. A season's players are those who picked for day 1.

## Kit needs
| Id | Need | State |
|---|---|---|
| K1 | `scoreRound`'s 6th argument `{ seasonStaked, seasonStart, seasonWeek }` | In #319 (`kit-next`). **Two fixes needed** (sent to Architecture): the runtime reads the stakes for K1 before a Picks game's stakes are read (it crashes for every Picks-contract season game), and the conformance child doesn't pass the season context to `scoreRound` |
| G7 | `ctx.blockAt(ms)` | On `main` (#280) |
| K4 | `liveWeek` | In #319 |
| K8 | `ctx.fallback` | In #319 |
| K1b | `firstStaked` in the season context: the wallets with a counted stake in the season's first week; and the kit's paid set in a season's later weeks limited to them (owner 16 Nov, Repo Lens J12-1) | **Asked of Architecture** (16 Nov). Needed before Season 1's second week (week 8, Mon 14 Dec); until then a second week's run stops instead of guessing a board |
| K9 | `ctx.decided` in `inputsFor` and `resultOf`: each of the season's published rounds by id, decided with its `"card"` or by the game's `"fallback"` | **Asked of Architecture** (14 Nov). Needed only for the no-card rule; until then a day with no card stays pending |
| Pin | `vaultGames.3.kit` (with `liveWeek: true`, `seasonWeeks: 2`) | In this PR; the Vault chat confirms |
| K3, K5 | Free-prize conditions | Later; the free prize is OFF |
| K6 | The ruler's `mode` in card settings | In #319; Survivor stays on mode A for Season 1 (Ruler chat, 13 Nov) |

## Simulations (real ruler data)
`sims/survivor/make-cards.mjs` makes real RULE_VERSION 4 cards from the published `vhp-data` branch (20 days, 12 Nov 2026). `sims/survivor/season-sim.mjs` plays 400 seasons per row:

| Ruler mode | Players | Board ends (median) | Left after day 12 (median) | Wins by "informed" players |
|---|---|---|---|---|
| A (today) | 10 | day 11 | 2 | 90% |
| A | 50 | day 12 | 7 | 96% |
| A | 200 | day 12 | 26 | 98% |
| D (even odds) | 50 | day 12 | 4 | 85% |

**Finding (decided for Season 1).** Under mode A two steady under-signing producers sat in the out-zone about every day, and six never. The Ruler chat (13 Nov): accept it for Season 1 (avoiding unreliable nodes is a fair skill, and each producer's form is public), record Season 1's out-zone rates, and decide a two-sided mode "E" for Season 2 at a later review (owner decision).

## Files
| File | What |
|---|---|
| `games/survivor/math.js` | The rules (pure). The page and the recorder share it |
| `games/survivor/recorder.ts` | The kit module |
| `games/survivor/game.json` | The manifest (`npm run game:check -- survivor`) |
| `games/survivor/tests/` | Rule and property tests, the module and end-to-end tests, the page test, the conformance sample week |
| `sims/survivor/` | The season simulation on real ruler cards |
| `survivor.html`, `survivor.js` | The page (reads the kit's files, sends picks to Picks game 3) |

The old recorder (`bot/games/survivor.ts`, `survivor-math.js`), its testnet kit (`bot/survivor-test.ts`, `tools/survivor-testnet/`) and their tests were removed in this PR (owner, 14 Nov). **No testnet season** (owner, 14 Nov): Season 1 is unpaid practice on mainnet and does that job; the fake-node season tests cover the code (`docs/SURVIVOR-TESTNET.md`).

## Launch steps (nothing before the Repo Lens GO; each with its dry run first)
Steps with commands: `docs/SURVIVOR-RUNBOOK.md`.
1. #319 merges (with the two K1 fixes), then this PR, after its Repo Lens GO.
2. **By Sat 28 Nov:** register game 3 on Picks: kind 1, list_size 1, lock_mode 2, round_size 86,400,000, round_offset 0, lead 300,000, ahead 604,800,000, max_changes 5, 20 picks a day, enabled. Announce, then apply 48 h later, so picks for day 1 (Mon 7 Dec) open on Mon 30 Nov. Add the sponsor allowlist row for game 3 picks.
3. Free-prize switch OFF for game 3 (`npm run prizes -- off 3`, then `--send`) before week 7.
4. `SURVIVOR_ENABLED` = true, before Mon 7 Dec 00:00 UTC. Weeks before week 7 are never recorded (`firstWeek`).
5. `games.json`: Survivor live, menus and sitemap (Hub).
6. **For Season 2 (by about Sat 12 Dec):** vault `game-add 3 "Survivor" --staked --free --season 2` with **`from_week` = 9** (Season 2's first week; checked twice: a wrong week silently loses the season prize), then `game-apply` 48 h later, inside week 8. Set `SURVIVOR_PRIZES_FROM_WEEK` = 9.

**No `SURVIVOR_RULER_FROM_WEEK`.** Survivor scores on the ruler from Season 1, its first season ever. The unpaid Season 1 does the job of a shadow week.
