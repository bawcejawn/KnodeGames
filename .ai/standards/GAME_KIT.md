# Knode Games — Game Kit Standard

> **Purpose:** how every game's recorder, publish job and page use the shared game kit (`kit/`), so the rules in `RECORDER_STANDARD.md` are implemented once and a game supplies only its own rounds, results and scoring.
> **Decisions behind it:** D-158 (this design and its eight choices), D-146 (build the shared kit), D-157 (game folder and manifest), D-125 / D-129 / D-135 (the week), D-152 (who gets paid), D-082 (first / second always filled).
> **Status:** adopted 5 Nov 2026 (D-158). **The kit's core is built (PR #210, Repo Lens #B-11 fixes in); no game is on it yet.** Until a game is moved it keeps its own recorder and still follows `RECORDER_STANDARD.md` directly.
> **Last updated:** 2026-11-05 (core built; #B-11 fixes)
> **Related:** `RECORDER_STANDARD.md` (the rules), `WEEK_CYCLE.md` (timing), `LEADERBOARD_STANDARD.md` (boards), `NEW_GAME.md` (copy → fill → check → review → go live), design notes in the Claude project (`claude/library/GAME-KIT-DESIGN-2026-11-05.md`).

## 1. What the kit is
| Part | Path | Does |
|---|---|---|
| Recorder runtime | `kit/recorder/` | two-node reads, stakes, clock checks, store, pending → final, holds, boards, payout, vault file, alerts |
| Publish check | `kit/publish/check.inline.mjs` | the publish job's checks, rendered into each data branch's workflow (the job still runs no repository code) |
| Site pieces | `kit-page.js`, `kit-claims.js` (site root) | data loading, week labels, the Sunday line, results rows, stake badge/panel mount; the one copy of the claim rules |
| Test harness | `kit/testing/` | fake nodes and clocks, history replay, the conformance suite `game:check` runs |

The kit holds no keys, signs nothing and sends nothing. It is owned by the Architecture chat; games never edit `kit/` (D-035): they ask through the owner.

## 2. What a game supplies (`games/<slug>/recorder.ts`)
A `GameModule` (`kit/recorder/types.ts`):
| Member | Required | Rule |
|---|---|---|
| `slug` | must | equals `game.json` `slug` |
| `roundsFor(week, ctx)` | must | every round counting for the week; pure; each round's `day` must be `dayOf(locksAt)` (a round closing at exactly Sun 00:00 is Saturday's) |
| `inputsFor(week, ctx)` | should, if the game publishes inputs before picks (cards, seeding, prices) | read through the given reader; frozen before picks lock |
| `picks.source` | must | `picks-contract`, `race-picks`, `vault-answers` or `none` |
| `resultOf(round, read)` | must | chain reads only through `read`; returns `Pending` until decided, never a guess |
| `same(a, b)` | may | default canonical-JSON equality |
| `scoreRound(round, picks, result, inputs)` | must | pure; uses the game's `math.js` (the page's copy); returns points for **every** wallet that picked (0 included) and, when it has points, the score time (D-159's tie-break) |
| `columns` | may | extra board columns |

The entry rule is declared, not coded: `game.json` `entry: { minRounds, minPoints }` (Questions: 2 counted answers, 1 point), so the publish job can re-check it.

A module **must not**: use the network, the clock, files, processes, randomness or environment variables except through what the kit passes; import Node built-ins or packages; import dynamically; write any file; change a published round. The conformance suite scans **every file the module imports** and runs the module only in a sandboxed child process (Node's permission model, every clock and randomness entry point trapped).

## 3. What the kit guarantees (so the game doesn't have to)
- Every value that decides a result is read on **two nodes** and must agree; a failed read is never zero or "not staked" (RECORDER §2). The run's clock is the lower of the two chain times; the run **stops** if they are more than 5 minutes apart or both are more than 30 minutes behind the runner's clock (a stalled node never silently loses a week).
- Stakes come from the vault's own rule, read only after the week ends (RECORDER §2.4–2.5).
- Every new file passes the clock checks; Sunday UTC rounds are **fun rounds**: Today and All time only (WEEK_CYCLE §2, D-129).
- **Pending → final** only after Mon 00:00 UTC, the week-end re-read and re-score of every counted round on both nodes, and two runs at least 1 h apart that agree (D-135); Thursday 00:00 backstop.
- Published rounds are never dropped and a decided round never changes, except, for a game with `roundsCorrectable: true` (owner corrections on chain, Questions), its status and points; final weeks, prize files and vault files are write-once (RECORDER §3.3, §4.7). A game without the flag **stops with an alert** naming the round if a decided round changes on chain.
- The stability hour is measured on the publish job's own clock: a new week hash must be first read within 40 minutes of the job (and after the week's end), and an unchanged hash keeps its first-read time exactly.
- Holds: `HOLD-W<n>.json` / `RELEASE-W<n>.json`. A HOLD is written only after a **full, healthy** re-read on both nodes finds a final week changed (Sunday fun rounds never count), and it alerts every run until released. Owner holds by `<SLUG>_HOLD_WEEKS`; release of one exact hold by `<SLUG>_RELEASE = "<week>:<code>"` (hyphens in the slug become `_`). The publish job reads the release variable itself, so a recorder run can never release its own hold.
- The paid set by the game's `payoutRule` (`legacy-tied-whole` or `d152`) over exactly the rows posted (staked, at least 1 point and at least `minPts`), checked against a port of the contract's own walk (no vault file if they ever differ); vault values 255 → 1 (`dense255`) or the real points (`points`, game 1); under d152 the paid part of a tie split at the line takes its own board place, `first` / `second` always filled by the one free-prize rule (D-159: up to 10 a place, ties share; more than 10 → exactly 10 by earlier score time, then address; never empty because of the cap; a tie for 1st leaves 2nd empty; wallets cut by the cap get nothing), the 3-day results window, `board.json` in the LEADERBOARD §1 shape.
- The publish job re-checks all of this with its own clock and recomputes each game's week from published per-round points (the generic recount: week tally → paid set → vault values → winners); per-round scoring is proven by the recorder's two-node re-score of every round before final, so no per-game scorer port lives in the publish job (D-158). One bad game holds only itself.

## 4. Manifest fields the kit reads (`game.json`)
`slug`, `name` (one plain line), `vaultGameId`, `kinds`, `seasonWeeks`, `freePrizeDefault`, `picks`, `week.sundayFunRound`, `week.finalNotBefore`, `data.board`, `data.vaultFolder` (branch `games-data`, `race-data` or `games-data-testnet`), `workflow.enabledVar`, `workflow.prizesFromVar`, and the kit's own:
| Field | Rule |
|---|---|
| `payoutRule` | `legacy-tied-whole` or `d152` (a migration keeps the game's current rule) |
| `vaultValues` | `dense255`, or `points` where the vault takes real points (game 1); d152 needs dense255 |
| `entry` | `{ minRounds ≥ 1, minPoints ≥ 1 }` |
| `minPts` | the vault file's points floor (0 = none); must equal `vaultGames.<id>.minPts` |
| `rowCap` | most board rows (0 = none); over it board.json keeps every ranked row and the best others |
| `budgets` | optional read budgets, at most 200,000 reads and 20 minutes (a game's record job has 25) |
| `roundsCorrectable`, `liveWeek`, `maxRoundPoints` | optional |

Once the vault pays a game (`vaultGames.<id>` exists in `game-data/deployment.json`), `vaultGames.<id>.kit` must pin `payoutRule`, `vaultValues`, `entry`, `week.sundayFunRound`, `roundsCorrectable` and `liveWeek` with the same values, so a payout change is a deployment change, never a one-line `game.json` edit. A manifest that repeats a key is refused. Schema: `tools/game-manifest.mjs`.

**Limits:** 10,000 rounds and 20,000 wallets with an entry a week; a week file up to 2 MB (rows are about 10 bytes: ~2,000 wallets answering 60 questions), with a warning past 75%.

## 5. Checks
- `npm run game:check -- <slug>` runs the kit's conformance suite on the game's module (purity, determinism, `Pending` not guessed, Sunday rounds tagged, a sample week end to end on fake nodes).
- `npm run test:audit` runs the kit's own tests and the rendered-workflow check (the committed kit jobs equal the kit's render).
- The rendered workflow gives **each game its own record job** (25-minute timeout, its own artifact, its own variable); the publish job takes each game's files only from that game's artifact and runs when any game recorded. One slow or broken game stops only itself.

## 6. New games, and moving a live game onto the kit (never changes payouts)
**Every new game launches on the kit; no game gets its own recorder again (D-158, D-160).** Order: the kit's core only (R-ARCH-3); Fantasy, Block Golf and Bracket ported to GameModules before they launch; Daily Questions' recorder (PR #203, the Mon 16 delivery) ported onto the kit with a byte-compatible replay and its scoring unchanged; then Block X and the Race by the steps below; then the publish jobs and the site files. **Any rule ambiguity stops the build and goes to the owner (D-160).** Data stays on today's branches (`games-data`, `race-data`) until ARCHITECTURE A3.

For a live game (today Block X and the Race):
1. Write `games/<slug>/recorder.ts` with the game's current `payoutRule`.
2. **Replay** its published history through the kit: every file byte-identical, or each difference explained and approved.
3. **Shadow** for two full final weeks with **zero differences** (the kit's output compared hourly with the live recorder's, never published; D-158).
4. **Switch** in one PR (Repo Lens); keep the old recorder one more week as fallback, then remove it.
A payout-rule change (e.g. to D-152) is always its own PR with its own review.

## 7. Changing the kit
The kit decides payouts for every game, so: Repo Lens on every kit change; every change ships with tests; the golden replays of every migrated game must stay byte-identical unless the PR says why and the owner approves.
