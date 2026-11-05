# Knode Games — Game Kit Standard

> **Purpose:** how every game's recorder, publish job and page use the shared game kit (`kit/`), so the rules in `RECORDER_STANDARD.md` are implemented once and a game supplies only its own rounds, results and scoring.
> **Decisions behind it:** D-158 (this design and its eight choices), D-146 (build the shared kit), D-157 (game folder and manifest), D-125 / D-129 / D-135 (the week), D-152 (who gets paid), D-082 (first / second always filled).
> **Status:** adopted 5 Nov 2026 (D-158); **the kit is not built yet** (Architecture chat, R-ARCH-3). Until a game is migrated it keeps its own recorder and still follows `RECORDER_STANDARD.md` directly.
> **Last updated:** 2026-11-05 (adopted)
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
| `roundsFor(week, ctx)` | must | every round locking in the week; pure |
| `inputsFor(week, ctx)` | should, if the game publishes inputs before picks (cards, seeding, prices) | read through the given reader; frozen before picks lock |
| `picks.source` | must | `picks-contract`, `race-picks`, `vault-answers` or `none` |
| `resultOf(round, read)` | must | chain reads only through `read`; returns `Pending` until decided, never a guess |
| `same(a, b)` | may | default canonical-JSON equality |
| `scoreRound(round, picks, result, inputs)` | must | pure; uses the game's `math.js` (the page's copy); returns points and the scoring pick's time per wallet |
| `entryRule(wallet, picks)` | may | e.g. Questions' minimum answers |
| `columns` | may | extra board columns |

A module **must not**: use the network, the clock, files, randomness or environment variables except through what the kit passes; write any file; change a published round.

## 3. What the kit guarantees (so the game doesn't have to)
- Every value that decides a result is read on **two nodes** and must agree; the lower last-irreversible block is used; a failed read is never zero or "not staked" (RECORDER §2).
- Stakes come from the vault's own rule, read only after the week ends (RECORDER §2.4–2.5).
- Every new file passes the clock checks; Sunday UTC rounds are **fun rounds**: Today and All time only (WEEK_CYCLE §2, D-129).
- **Pending → final** only after Mon 00:00 UTC, the week-end re-read and re-score of every counted round on both nodes, and two runs at least 1 h apart that agree (D-135); Thursday 00:00 backstop.
- Published rounds are append-only; final weeks, prize files and vault files are write-once (RECORDER §3.3, §4.7).
- Holds: `HOLD-W<n>.json` / `RELEASE-W<n>.json`; owner holds by `<SLUG>_HOLD_WEEKS`; release of one exact hold by `<SLUG>_RELEASE = "<week>:<code>"`.
- The paid set by the game's `payoutRule` (`legacy-tied-whole` or `d152`), vault values 255 → 1, `first` / `second` always filled by the one free-prize rule (D-159: up to 10 a place; more than 10 → exactly 10 by earlier score time, then address; never empty because of the cap), the 3-day results window, `board.json` in the LEADERBOARD §1 shape.
- The publish job re-checks all of this with its own clock and recomputes each game's week from published per-round points (the generic recount: week tally → paid set → vault values → winners); per-round scoring is proven by the recorder's two-node re-score of every round before final, so no per-game scorer port lives in the publish job (D-158). One bad game holds only itself.

## 4. Manifest fields the kit reads (`game.json`)
`slug`, `vaultGameId`, `kinds`, `seasonWeeks`, `freePrizeDefault`, `picks`, `week.sundayFunRound`, `week.finalNotBefore`, `data.board`, `data.vaultFolder`, `workflow.enabledVar`, `workflow.prizesFromVar`, and (added with the kit) `payoutRule`, `minPts`, `rowCap`, `budgets` (optional overrides of read budgets). Schema: `tools/game-manifest.mjs`.

## 5. Checks
- `npm run game:check -- <slug>` runs the kit's conformance suite on the game's module (purity, determinism, `Pending` not guessed, Sunday rounds tagged, a sample week end to end on fake nodes).
- `npm run test:audit` runs the kit's own tests and the rendered-workflow check (the committed publish steps equal the kit's).

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
