# Daily Questions (game 1): the results recorder

From Vault v6.1's rule week (**Mon 16 Nov 2026**, D-116) the vault pays Daily Questions from a weekly results file, like every vault game. This folder builds that file. Weeks before the rule week keep the old rules (settle and claim in the contract), and this recorder leaves them alone.

The game itself (questions, answers, the page) is unchanged: `index.html`, `app.js`, `bot/bot.ts` (posting and resolving), `game-data/questions/`. The rules are in `.ai/games/Questions.md`; the week's timing in `.ai/standards/WEEK_CYCLE.md`.

## Files
| File | What it is |
|---|---|
| `math.js` | Every scoring rule (pure). The publish job runs its own copy of it (Python, in `games.yml`); `tests/math.test.mjs` checks they agree on 3,000 random weeks. |
| `recorder.ts` | The hourly run: two-node reads, pending → final, files. `npm run questions`. |
| `parts.inline.mjs` | From vault week 6: the week as KG parts v1 (`kit/parts`): encode, decode, and the publish job's parts check. The publish job embeds it with kit/parts, byte for byte (`node tools/questions-parts-embed.mjs`; `-- --check` and `tests/parts.test.ts` keep them the same). |
| `game.json` | The manifest (`npm run game:check -- questions`). `prizesFromVar` isn't used: Daily Questions' free prize follows the free-prize switch (D-136). |
| `tests/` | Scoring, recorder and end-to-end tests (the publish check's own tests are `tests/audit/questions-publish.test.ts`). |

## What it publishes (branch `games-data`, folder `questions/`)
- **From vault week 6 (Sun 29 Nov 2026 7 PM ET on): `W<NNN>/`, a KG parts v1 folder** (`docs/capacity/PARTS-SPEC.md`) instead of `W<NNN>.json`. Weeks 4 and 5 stay single files (a week already paid is never converted).
  - `manifest.json`: written last; `state` pending or final; `meta.seen` = `{ hash, at }` with `hash` the part-set hash (it replaces the snapshot hash: final after two matching runs an hour apart, as before).
  - `wk.<h12>.json`: the week's questions `[id, outcome, lock]`; `extra` `{ start, end, min }`.
  - `p/<x>.<h12>.json`: 16 player shards (`x` = the first hex digit of SHA-256 of the address). Each row `[player, stake, peak, voided, ans]`; `ans` has one character per question of the week, in id order: `.` = no answer, `0`–`f` = the option. All 17 parts are always written (a shard may be empty).
  - Decoded, the players list is exactly the old file's (answers in question order), so `math.js` and the publish job's Python copy score it unchanged.
- `W<NNN>.json` (weeks 4 and 5): the week's inputs, as read on both nodes: `questions` `[id, outcome, lock time]`, `players` `[address, stake, peak stake, voided, [[question, option], …]]`, `min` (the week's minimum stake), `seen` (`hash` of the inputs and `at`, the chain time a run first read them) and `final`.
- `board.json`: `lastWeek` and the prize winners. The vault bot checks the results file against it. Weeks 4 and 5 (`v: 1`): both boards' rows (`a`, `board` staked/free, `place`, `points`, `counted`, `answers`, `ranked`). From week 6 (`v: 2`): the Staked board's rows only, `{ a, place, pts, ranked }` (a Free board row is never in a vault file; the vault bot reads only these columns).
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
| `QUESTIONS_FROM_WEEK` | Set it to the vault week of v6.1's rule week (4 if v6.1 is uploaded in time for Mon 16 Nov; `npm run bot -- status` shows it). Set it only once v6.1 is uploaded (Repo Lens QF-4). From that week, a week the vault reads as "not shared" fails the run, so you're emailed, instead of rolling over quietly (Repo Lens C11-1; for example if v6.1 is live but #114's ABI isn't on main). |
| `QUESTIONS_HOLD` / `QUESTIONS_HOLD_REASON` / `QUESTIONS_RELEASE` | The owner's hold and release of a week. |

## Alerts (the run fails and GitHub emails you)
- A failed read (including a node that doesn't answer within 30 s, 3 tries: Repo Lens QF-1), or the two nodes disagree (the next hour reads again).
- A week from `QUESTIONS_FROM_WEEK` on that reads as not shared.
- Under 24 hours before the results are due and the week still isn't final: the message names the unresolved questions (resolve or void them) (Repo Lens C11-4). The run's files still go out (the recorder exits 3, "late"), so a week you resolve now can still go final an hour later (Repo Lens QF-2).
- The runs of the first 3 hours past the deadline when no final was written (the stakers' share rolls over) (Repo Lens QF-5).
- On any failed run, the owner's HOLD and RELEASE files still go out; nothing else from that run does (Repo Lens QF-3).
- The publish job held a file for a reason other than "not yet".

## Size
- Cap: 2 MiB per file (the publish job's `find -size +2048k`); every run logs a `::warning::` for any file from 60% (1.2 MB, kit/parts' base) and the run's alert step emails.
- Weeks 4 and 5 (single file, 1.9 MB stop): about 4,200 weekly players answering all 48 questions; the warning from about 2,500.
- From week 6 (measured with fake data, every player answering all 48; `claude/questions/SIZER-QUESTIONS-PR-A-2026-11-15.md`): at 9,000 weekly players the biggest shard is about 71 KB (3%) and `board.json` 136 KB (7%) with 20% staked, 688 KB (34%) with everyone staked. The board passes 60% only above about 15,000 all-staked weekly players; past that, split it into `top` + shards (PARTS-SPEC §5) in its own PR. `MAX_PLAYERS` (20,000) still stops a runaway listing.

## Running it by hand
- `npm run questions -- --week <n>`: read-only. Reads any week on both nodes, scores it and compares it with the contract's own settled points (old-rules weeks). Nothing is written. Needs `RPC` and `RPC_CHECK` to be two different nodes (defaults: Armana and koinosblocks).
