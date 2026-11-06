# Daily Questions (game 1): the results recorder

From Vault v6.1's rule week (**Mon 16 Nov 2026**, D-116) the vault pays Daily Questions from a weekly results file, like every vault game. This folder builds that file. Weeks before the rule week keep the old rules (settle and claim in the contract), and this recorder leaves them alone.

The game itself (questions, answers, the page) is unchanged: `index.html`, `app.js`, `bot/bot.ts` (posting and resolving), `game-data/questions/`. The rules are in `.ai/games/Questions.md`; the week's timing in `.ai/standards/WEEK_CYCLE.md`.

## Files
| File | What it is |
|---|---|
| `math.js` | Every scoring rule (pure). The publish job runs its own copy of it (Python, in `games.yml`); `tests/math.test.mjs` checks they agree on 3,000 random weeks. |
| `recorder.ts` | The hourly run: two-node reads, pending → final, files. `npm run questions`. |
| `game.json` | The manifest (`npm run game:check -- questions`). `prizesFromVar` isn't used: Daily Questions' free prize follows the free-prize switch (D-136). |
| `tests/` | Scoring, recorder and end-to-end tests (the publish check's own tests are `tests/audit/questions-publish.test.ts`). |

## What it publishes (branch `games-data`, folder `questions/`)
- `W<NNN>.json`: the week's inputs, as read on both nodes: `questions` `[id, outcome, lock time]`, `players` `[address, stake, peak stake, voided, [[question, option], …]]`, `min` (the week's minimum stake), `seen` (`hash` of the inputs and `at`, the chain time a run first read them) and `final`.
- `board.json`: `lastWeek` with both boards' rows (`a`, `board` staked/free, `place`, `points`, `counted`, `answers`, `ranked`) and the prize winners. The vault bot checks the results file against it.
- `vault/W<w>.json`: the results file (`VAULT_STANDARD.md` §6): staked rows with their real points (the contract checks points ≤ answers), and `first` / `second`, which are always filled. Written once, when the week is final.
  - **Free-prize ties (owner, 5 Nov):** up to 10 wallets per place, ties share; a tie for 1st leaves 2nd empty. More than 10 qualifying for one place: exactly 10 are paid, by the **earlier score time**, then the address. A place is never left empty because of the cap. A player's score time is the lock time of the question that gave them their last point: entries on chain don't store when an answer was sent.
- `vault/HOLD-W<w>.json` / `RELEASE-W<w>.json`: the owner's hold and release (repo variables `QUESTIONS_HOLD`, `QUESTIONS_HOLD_REASON`, `QUESTIONS_RELEASE`).

## When
| Step | When (UTC) |
|---|---|
| Recording starts | Mon 00:00, when the week has ended. Every hour at :47. |
| Pending | Until every question that counts is resolved (Saturday's last round resolves on Sunday's blocks). |
| Final | The inputs read the same on both nodes, in two runs at least an hour apart. |
| The vault bot posts | After it has read the same file twice, at least 30 minutes apart; then seal, then the 24-hour correction window. |
| Deadline | Thu 00:00 (week end + 3 days). Without a file the stakers' share rolls over: no funds at risk. |

## Repo variables (Settings → Secrets and variables → Actions → Variables)
| Variable | What it does |
|---|---|
| `QUESTIONS_FROM_WEEK` | **Set it to `4`** (the week of Mon 16 Nov). From that week, a week the vault reads as "not shared" fails the run, so you're emailed, instead of rolling over quietly (Repo Lens C11-1; for example if v6.1 is live but #114's ABI isn't on main). |
| `QUESTIONS_HOLD` / `QUESTIONS_HOLD_REASON` / `QUESTIONS_RELEASE` | The owner's hold and release of a week. |

## Alerts (the run fails and GitHub emails you)
- A failed read, or the two nodes disagree (the next hour reads again).
- A week from `QUESTIONS_FROM_WEEK` on that reads as not shared.
- Under 24 hours before the results are due and the week still isn't final: the message names the unresolved questions (resolve or void them) (Repo Lens C11-4).
- The first run past the deadline when no final was written (the stakers' share rolls over).
- The publish job held a file for a reason other than "not yet".

## TODO: size (Repo Lens C11-2, plan only)
- Today a player's row is `[address, stake, peak, voided, [[question, option], …]]`, about 615 bytes at 60 answers, so the 1.9 MB cap fits about 3,000 players answering everything (5,500 at 30 answers). Past it every run stops with an alert, and no week is paid.
- Plan: store answers as one string per player, one character per question of the week in id order (`"-"` = not answered, `"0"`–`"9"` = the option): 60 characters instead of about 480. A row is then about 120 bytes, so 1.9 MB fits about 15,000 players. For more, split the inputs into `W<NNN>-<part>.json` files with the hash over all parts.
- `MAX_PLAYERS` (20,000) now counts only players who answered that week (done).
- Change the format before the player count passes about 2,000, with the publish job's copy and its tests in the same PR.

## Running it by hand
- `npm run questions -- --week <n>`: read-only. Reads any week on both nodes, scores it and compares it with the contract's own settled points (old-rules weeks). Nothing is written. Needs `RPC` and `RPC_CHECK` to be two different nodes (defaults: Armana and koinosblocks).
