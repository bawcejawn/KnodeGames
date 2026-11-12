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
| `picks` | must | one source, or a list: the **first** is scored; the others (another Picks game, e.g. Fantasy's Weekly Rival) reach only `weekExtras`. Sources: `picks-contract`, `race-picks`, `vault-answers` or `none`. A `picks-contract` game's rounds each carry `pickRound` (the Picks contract round); its stakes come from the vault's `get_game_player` |
| `extraPickRounds(week, source)` | may | the Picks rounds an extra source is read at; pure |
| `resultOf(round, read)` | must | chain reads only through `read`; returns `Pending` until decided, never a guess |
| `same(a, b)` | may | default canonical-JSON equality |
| `scoreRound(round, picks, result, inputs)` | must | pure; uses the game's `math.js` (the page's copy); returns points for **every** wallet that picked (0 included) and, when it has points, the score time (D-159's tie-break) |
| `carryIn(last, week, inputs)` / `nextState(state, picks, round, inputs)` | may (together) | **carried state** (FC-5), e.g. a Fantasy team. `nextState` runs for every round in lock order; `scoreRound` then gets each wallet's state and must score every wallet with a state, picked that round or not. A week is recorded only once the week before it is **final** (else nothing is written and the owner is alerted). A missing week file is a fresh start only for the game's first week or after the owner sets `<SLUG>_RESET_FROM_WEEK` to that week (#G-13 G13-1); otherwise the week waits. Each state is JSON, at most 4 KB |
| `weekExtras(week, ctx)` | may | records-only JSON in the week file (`extras`, at most 256 KB); never paid from |
| `columns` | may | extra board columns |

`ctx.published` (in `inputsFor` and `roundsFor`): the game's own published **final** weeks, and those of up to 4 other kit games on the same data branch named in `game.json` `published`. Read-only, loaded by the kit.

**Write-once inputs file (FC-9, `inputsFile: true`):** the kit makes `inputs/W<week>.json` = `{game, week, data}` from `inputsFor`, on both nodes, `inputsLeadHours` before the week opens (default 48 = Saturday 00:00 UTC). The publish check takes it only before the week opens (and at most a week early) and never changes it. The week is scored on the published file; its week file carries the file's sha256 (`inputs`); the recorder recounts `inputsFor` on both nodes at the week's end and **holds** the week if the recount differs. A week with no inputs file published in time isn't scored. The publish job still runs no game code.

The entry rule is declared, not coded: `game.json` `entry: { minRounds, minPoints }` (Questions: 2 counted answers, 1 point), so the publish job can re-check it.

A module **must not**: use the network, the clock, files, processes, randomness or environment variables except through what the kit passes; import Node built-ins or packages; import dynamically; write any file; change a published round. It may use `Date` only as `new Date(<time>)`, `Date.UTC` or `Date.parse`, and `Math` only for its pure functions (never aliased, passed on or read by brackets, #E-24 NE-1). It must not change how stack traces work, reach a constructor or prototype, or reach Node's modules at run time. The conformance suite scans **every file the module imports**, resolved the way tsx resolves them (`./x.js` → `x.ts`, `./x`, `./dir` → `dir/index.ts`; an import that resolves to nothing fails), and runs the module only in a sandboxed child process: Node's permission model (reads only in the repo, the game's folder and a temp folder, never `/proc`; writes only in the temp folder), every clock, randomness, worker and process entry point trapped, stack traces frozen so the traps can't be switched off; once the game's module starts loading, **every** trapped call is the game's (no kit helper, timer or promise route around it), except Node reading its own settings, the repo's own TypeScript loader reading the clock for its cache, and esbuild starting its own transform worker. Each of those is recognised by where its code lives, never by a function's name (which a game can choose), and each exception covers its one trap only. The kit's own clocks are taken before the traps, and no game can reach them (JavaScript `#private` fields). The global object can't be reached by name (`globalThis`, `global`, `self`), a property name can't be built out of strings, and no game file may live under a `node_modules` folder. Words inside strings don't trip the rules. The sandbox uses `--permission` on Node 24 (`--experimental-permission` on older Node), and allows child processes only where the TypeScript loader needs them to start. That's decided once, before any game code runs, by a canary that loads one kit file: a game can't ask for it by failing, and the game runs once. Child processes stay trapped for the game. A game may import only `kit/recorder/types.ts`, `kit/recorder/clock.ts` and `kit/recorder/sources/*` from the kit. The static scan reads comments, strings, templates and regex literals the way JavaScript does.

**The VHP ruler's data (Phase 1b, `vhpData: true`):** the rendered workflow fetches the public `vhp-data` branch read-only; the kit loads it once a run into one checked ledger (the ruler's own hour checks, as `bot/race-ruler.ts` does) and hands games `ctx.vhp` in `inputsFor` / `roundsFor` and as `resultOf`'s fourth argument. `ctx.vhp.card(settings)` makes and scores one ruler card (`makeCard` + `scoreCard`, the game's own settings, never read from a card) and returns it parsed; while the data doesn't reach the card's window plus the ruler's delay it throws `NotYet`, and the kit keeps that round **pending** (or the inputs file waits). Data that can't be loaded this run leaves every ruler round pending, with a warning; data that should be there and isn't (past retention) is a read failure, never a changed result. Games never import `vhp-ruler.js` or `vhp-data.js`: only `kit/recorder/sources/vhp-ruler.ts`. Every card a week file's results used, and every card its inputs file's price list used, is listed in its `cards` (`[settings, sha256 of cardJson]`, sorted by round). **Open (G3):** the publish job's rebuild of those cards from `vhp-data` with an inline copy of the ruler's scoring waits on the Ruler chat; until then the card list is shape-checked and covered by the hash, and a ruler game must not be paid from the kit.

**Week file optional keys** (after `players`, in this order): `inputs`, `carry` and `next` (together), `extras`, `cards` (ruler games). A week file without them is byte- and hash-identical to before. The hash covers them.

## 3. What the kit guarantees (so the game doesn't have to)
- Every value that decides a result is read on **two nodes** and must agree; a failed read is never zero or "not staked" (RECORDER §2). The run's clock is the lower of the two chain times; the run **stops** if they are more than 5 minutes apart or both are more than 15 minutes behind the runner's clock (a stalled node never silently loses a week).
- Stakes come from the vault's own rule, read only after the week ends (RECORDER §2.4–2.5); a week's "voided" is the week's own entry, as the contract's `resultEntry` reads it.
- Every new file passes the clock checks; Sunday UTC rounds are **fun rounds**: Today and All time only (WEEK_CYCLE §2, D-129).
- **Pending → final** only after Mon 00:00 UTC, the week-end re-read and re-score of every counted round on both nodes, and runs at least **2 h** apart that agree: a pending copy can reach the branch up to an hour after it was read, so this keeps D-135's full hour after it is published; Thursday 00:00 backstop. A week first read before its end (an open copy, `liveWeek`) is stamped again once it ends.
- Published rounds are never dropped and a decided round never changes, except, for a game with `roundsCorrectable: true` (owner corrections on chain, Questions), its status and points (Sunday fun rounds may be corrected in any game: they never count); final weeks, prize files and vault files are write-once (RECORDER §3.3, §4.7). A game without the flag **stops with an alert** naming the round if a decided round changes on chain.
- The stability hour is measured on the publish job's own clock: a new week hash must be first read within 60 minutes of the job (15 min of chain lag plus the 45 min publish-kit can wait on the hand-written record and publish jobs; the render refuses a workflow whose timeouts don't fit) and after the week's end; an unchanged hash keeps its first-read time exactly.
- What the publish check **can't** do: it can't read the chain, so it checks a run's files for consistency with what is published (no dropped round, no decided round moved or reopened, no player swapped), not whether they are true. A bad run could still add a scored round, flip `voided`, zero a stake or set `min` to 0 while the hash changes; the two-node reads, the stability wait and the HOLD on a changed final are what stop that (#B-12 NK-18).
- Holds: `HOLD-W<n>.json` / `RELEASE-W<n>.json`. A HOLD is written only after a **full, healthy** re-read on both nodes finds a final week changed (Sunday fun rounds never count), and it alerts every run until released. Nodes that disagree on a final week's round are an owner alert every run too (change detection never goes quiet); a plain read failure is a warning. Owner holds by `<SLUG>_HOLD_WEEKS`; release of one exact hold by `<SLUG>_RELEASE = "<week>:<code>"` (hyphens in the slug become `_`). The publish job reads the release variable itself, so a recorder run can never release its own hold; both sides read the value with one parser (week without leading zeros).
- The paid set by the game's `payoutRule` (`legacy-tied-whole` or `d152`) over exactly the rows posted (staked, at least 1 point and at least `minPts`), checked against a port of the contract's own walk (no vault file if they ever differ); vault values 255 → 1 (`dense255`) or the real points (`points`, game 1); under d152 the paid part of a tie split at the line takes its own board place, `first` / `second` always filled by the one free-prize rule (D-159: up to 10 a place, ties share; more than 10 → exactly 10 by earlier score time, then address; never empty because of the cap; a tie for 1st leaves 2nd empty; wallets cut by the cap get nothing), the 3-day results window, `board.json` in the LEADERBOARD §1 shape.
- The publish job re-checks all of this with its own clock and recomputes each game's week from published per-round points (the generic recount: week tally → paid set → vault values → winners); per-round scoring is proven by the recorder's two-node re-score of every round before final, so no per-game scorer port lives in the publish job (D-158). One bad game holds only itself.

**All-time board** (`alltime.json`, FC-16 / FC-18, D-137): rebuilt every run from all the game's published final weeks, and rebuilt the same way by the publish check. `pts` counts every scored round, Sunday fun rounds included; medals (`gold`, `silver` = the paid free 1st / 2nd; `earned` = in the staked paid set) count only for weeks whose vault file was published (D-034); `best` = best weekly place.

**FC-13 / FC-26:** `now` is the lower chain time, capped at the runner's clock; a vault file is written only for a week the game earns in the vault (`get_game`: from its `from_week`, before its last week, or a week the vault closed with it).

## 4. Manifest fields the kit reads (`game.json`)
`slug`, `name` (one plain line), `vaultGameId`, `kinds`, `seasonWeeks`, `freePrizeDefault`, `picks`, `week.sundayFunRound`, `week.finalNotBefore`, `data.board`, `data.vaultFolder` (branch `games-data`, `race-data` or `games-data-testnet`), `workflow.enabledVar`, `workflow.prizesFromVar`, and the kit's own:
| Field | Rule |
|---|---|
| `payoutRule` | `legacy-tied-whole` or `d152` (a migration keeps the game's current rule) |
| `vaultValues` | `dense255`, or `points` where the vault takes real points (game 1); d152 needs dense255 |
| `entry` | `{ minRounds ≥ 1, minPoints ≥ 1 }` |
| `minPts` | the vault file's points floor (0 = none); must equal `vaultGames.<id>.minPts` |
| `rowCap` | most board rows (0 = none); over it board.json keeps every ranked row, every free prize winner and the best others. board.json also keeps to 1.5 MB the same way |
| `budgets` | optional read budgets, at most 200,000 reads and 20 minutes (a game's record job has 30: the budget, a last read's retries and setup) |
| `roundsCorrectable`, `liveWeek`, `maxRoundPoints` | optional |
| `inputsFile`, `inputsLeadHours` | optional: the write-once inputs file (FC-9); lead 1–96 h, default 48 (#G-13 G13-2) |
| `published` | optional: up to 4 other kit games on the same data branch whose final weeks this game reads (`ctx.published`) |
| `vhpData` | optional: the game scores from the VHP ruler's published data (`ctx.vhp`; week and inputs files list their `cards`) |

Once the vault pays a game (`vaultGames.<id>` exists in `game-data/deployment.json`), `vaultGames.<id>.kit` must pin `payoutRule`, `vaultValues`, `entry`, `week.sundayFunRound`, `roundsCorrectable` and `liveWeek` with the same values, so a payout change is a deployment change, never a one-line `game.json` edit. A manifest that repeats a key is refused. Schema: `tools/game-manifest.mjs`.

**Limits:** 10,000 rounds and 20,000 wallets with an entry a week. One week file, written up to 1.9 MB (a scored row is about 19 bytes, a score time stored as ms after the week's start: ~1,900 wallets answering all 60 questions, or ~20,000 at one round); a warning from 60% of 2 MB and an owner alert every run from 85%. A game that grows past that needs its week split across files, a format change agreed first (#B-12 NK-3). **The 85% owner alert (about 1.7 MB) means: split that game's files before the next week** — a week that reaches the 1.9 MB stop never goes final, and the vault's backstop pays nothing for it (#E-24 NE-2). If board.json's ranked and prize rows alone pass the cap, the week and vault files are still written, the board waits and the owner is alerted; a ranked-row board cap needs the vault bot's agreement (NK-4). A row's score time must lie between the week's start and its results deadline.

## 5. Checks
- `npm run game:check -- <slug>` runs the kit's conformance suite on the game's module (purity, determinism, `Pending` not guessed, Sunday rounds tagged, a sample week end to end on fake nodes).
- **The gate is a test, not a security boundary** (Repo Lens #F-2 F2-7). In production a game's module runs in the normal recorder job with no sandbox, and the static scan is a lint that a determined author can get around. So **every game PR still needs a Repo Lens review**, and the gate runs with no secrets. A symlinked or hoisted `node_modules` (pnpm, a parent folder) sits outside the sandbox's readable folders, so the sandbox then fails closed for every game: use `npm ci` in the repo.
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
