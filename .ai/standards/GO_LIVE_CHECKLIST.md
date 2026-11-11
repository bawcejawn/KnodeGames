# Knode Games — Game Go-Live Checklist

> **Purpose:** the one ordered list every game follows from "built" to "paying", so no launch step is missed. Use it for each new game, and for a game restarting after a stop.
> **Applies to:** every game (today's next launches: Fantasy, Block Golf and Producer Bracket, reactivated 5 Nov, D-142; Survivor, Last Node and Combo stay paused, D-113; and any future game). A new game starts with `NEW_GAME.md` (copy → fill → check → review → go live, D-157), which leads here.
> **Last updated:** 5 Nov 2026 (header current: D-142 reactivations; `game:check` required in Step 1; free-prize defaults live in each `game.json`, D-157)
> **Built from:** `GAME_STANDARD.md`, `VAULT_STANDARD.md` §9, `LEADERBOARD_STANDARD.md`, `RECORDER_STANDARD.md`, `../platform/FREE_PRIZE_SWITCH.md`, decisions D-064, D-077 – D-082, D-089.
> **How to use:** copy the checklist into the game's work list (`../platform/CHAT_REQUESTS.md`) or the game file, tick items as they're done, and paste the ticked list into the session-end report.

## The timing rule (read first)
- A game **earns from the vault week after it's applied** (weeks start Monday 00:00 UTC = Sunday 4 PM PT). How the game's own week runs once live: `WEEK_CYCLE.md`.
- `game-add` starts a **48 h** notice; `game-apply` must follow **within 7 days**.
- So to earn from Monday *M*: `game-apply` before Sunday 4 PM PT, which means `game-add` **at least 48 h earlier, with a margin**. Latest safe `game-add` is **Friday ~noon PT**. A Friday 4 PM `game-add` becomes applicable exactly at the deadline, which leaves no room.
- The free-prize switch, like any change, counts from **next** Monday. Set it **the same week as `game-add` or earlier**.
- **Nothing is announced to players until every item in steps 1–4 is done** (D-064).

## Step 1 — Ready (game chat)
- [ ] Rules written in the game's file (`.ai/games/<Game>.md`): purpose, gameplay, scoring, rewards, dependencies, status.
- [ ] Meets `GAME_STANDARD.md`:
  - stakeable with a 1 VHP minimum;
  - Staked + Free play boards (D-079, D-081);
  - nicknames through `names.js` (D-078);
  - the VHP standard where VHP is measured (D-058);
  - plain page text that matches the code;
  - the weekly timing in `WEEK_CYCLE.md`, with the game's row in its compliance table.
- [ ] Recorder meets `RECORDER_STANDARD.md` (clock checks, recompute at publish, per-file holds, two nodes, write-once).
- [ ] Vault results file per `VAULT_STANDARD.md` §6, **always filling `first` / `second`** (D-082).
- [ ] `board.json` in the shape the vault check reads (`LEADERBOARD_STANDARD.md` §1, I-079), or the board path agreed with the Vault chat.
- [ ] **`npm run game:check -- <slug>` ends "All required checks passed"** (D-157; manifest, files, rules doc, week-cycle row, tests). Today's games not yet moved into `games/<slug>/` note "not migrated yet" here.
- [ ] Tests pass: `npm run test:audit` and `node --test tests/audit/site.*.test.mjs`.
- [ ] A testnet run (week or season) where the game has one.

## Step 2 — Audited (owner + Repo Lens)
- [ ] Repo Lens audit run on the exact commit; report saved **privately** in the project (`claude/<game>/AUDIT-*.md`), never in the repo.
- [ ] Every Critical and High fixed (or accepted by the owner as a recorded decision); fix-check **GO**.
- [ ] Owner decisions from the audit recorded as D-xxx.

## Step 3 — Merged (game chat, owner merges)
- [ ] `main` merged into the game branch, and the full test suite re-run on the merged branch.
- [ ] One PR into `main`; GitHub checks green; **owner merges** (D-026).
- [ ] Recorder workflow enabled (the game's `*_ENABLED` repo variable, set by the owner), and its first hourly run green in **Actions**.
- [ ] First `board.json` and week files visible on the data branch.

## Step 4 — On chain (owner, PowerShell; dry run first every time)
- [ ] **Picks contract** (picks-based games): `npm run picks -- announce <id> --mainnet` → 48 h → `npm run picks -- apply <id> --mainnet` (each: dry run, then `--send`). Sponsor allowlist row for its picks, if needed.
- [ ] **Free-prize switch** set to the game's starting setting (its `game.json` `freePrizeDefault`; today's games: `../platform/FREE_PRIZE_SWITCH.md` §4). Command: `npm run prizes -- on <id>` or `off <id>`, then `--send`.
- [ ] **Vault, step 1:** `npm run bot -- game-add <id> "<Name>" --staked --free --season <weeks>` (every game gets `--free`, D-082). The bot emails about the 48 h notice; that's expected.
- [ ] **Vault, step 2:** 48 h later, before Sunday 4 PM PT: `npm run bot -- game-apply <id>`.
- [ ] Check: `npm run bot -- games` shows the game as "staked + free prize, from week <n>".
- [ ] The game's prize-start variable if it has one (e.g. `PRIZES_FROM_WEEK`, `BRACKET_PRIZES_FROM_WEEK`) set to that week (repo variable, owner).
- [ ] The vault check's per-game settings, if any (`vaultGames.<id>.board`, `minPts`), merged by the Vault chat.

## Step 5 — Live for players (Hub + game chat)
- [ ] `games.json`: status `live`, `href`, and the `board` entry for the Leaders page.
- [ ] Site menus and home page (`node tools/site-nav.mjs`), with site tests passing.
- [ ] Page shows the stake badge and panel (D-031), and says plainly whether its Free play board pays VHP.
- [ ] Announcement to players (owner), only now (D-064).

## Step 6 — First week watch (owner + game chat + Vault chat)
- [ ] Monday after the first paid week: the recorder's final file and `board.json` published.
- [ ] The bot posts and seals within 3 days. Watch the alerts (`../platform/RUNBOOK.md` §3).
- [ ] 24 h correction window after the seal: spot-check the top rows against the board.
- [ ] Finalized; claims work; the weekly review covers the game (`../platform/WEEKLY_REVIEW.md`).
- [ ] Once the game is actually paying (first paid week sealed and claimed, no correction): set `"status": "live"` in `games/<slug>/game.json` (D-157; games not yet migrated: note it in the game file).
- [ ] The library chat updates `CURRENT_STATE.md`, the game file and `CHAT_REQUESTS.md`.

## Stopping or restarting a game
- Stop: `npm run bot -- game-stop <id>` (players keep their stake; earns through this week). Picks games can also `npm run picks -- pause <id> --mainnet`. See `../platform/RUNBOOK.md` §4.
- Restart: a new `game-add` → 48 h → `game-apply`, after the vault has closed the game's last earning week. A season length can't change while the game is still running (Repo Lens FP-6).
