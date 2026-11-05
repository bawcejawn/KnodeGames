# Knode Games — Adding a New Game (step by step)

> **Purpose:** the one path from "I have a game idea" to "it pays every week", so adding a game is routine. Follow the steps in order; each names who does it and the page that holds the detail. Nothing here repeats a rule that has a home elsewhere — it points to it.
> **Decisions behind it:** D-134 (one standard, effortless onboarding), D-125 / D-129 (the week), D-064 (nothing announced until ready), D-074 (multi-game staking), D-079 / D-081 / D-082 (boards and free prizes), D-113 (core first: new games wait for the core work).
> **Last updated:** 2026-11-05 (first written)
> **Worked example:** Who Signs Block X (game 2) went this way on `main`: `blockx.html` + `blockx.js` + `blockx-math.js` (page), `bot/games/blockx.ts` (recorder), `.github/workflows/games.yml`, `tests/audit/blockx-recorder.test.mjs`, `.ai/games/BlockX.md`.

## Before you start (owner, 10 minutes)
- [ ] The core work is done or the owner says to start (D-113).
- [ ] One paragraph: what players pick, when a round locks, how a round scores. A game must be **fair, skill-based, not gambling** (D-075), and work on Koinos block-producer data.
- [ ] **Pick the next free game id** from `../platform/PLATFORM.md` → games table (in use: 1–9 and 13).
- [ ] Start a new chat with the **game starter** `AI_CHAT_STARTER.md` §3.2 (fill in the name, id and branch). Add the chat's section to `../platform/CHAT_REQUESTS.md` §3 (library chat).

## Step 1 — Write the game file (game chat, first session)
- [ ] Create `.ai/games/<GameName>.md` from the template in `GAME_STANDARD.md` §9: Purpose · Gameplay · Scoring · Rewards · Dependencies · Current Status · Known Issues · Future Plans.
- [ ] **Timing:** don't write your own week. Say "follows `WEEK_CYCLE.md`" and add your row to its **compliance table** (§4). Only game-specific locks (when one round closes) go in your file.
- [ ] **Rewards:** say "follows `WEEK_CYCLE.md` §3" (5% fee, Staked share, free 2 + 1 VHP if the switch is on).
- [ ] Owner reads it and answers the chat's questions; answers become D-xxx (library chat).

## Step 2 — Build on its own branch (game chat)
Never on `main`. One branch per game (e.g. `game-10-<name>`).

| Piece | What it must do | Standard |
|---|---|---|
| **Page** `<game>.html` + `<game>.js` (+ `<game>-math.js` for scoring shared with the recorder) | Staked and Free play boards; nicknames via `names.js` (`KNames.of`); stake badge at the top of `<main>` and the stake panel lower down; the Sunday line "Sunday is review day: results are checked and paid from Monday" | `GAME_STANDARD.md` §7, `LEADERBOARD_STANDARD.md`, D-031, D-078 |
| **Picks** | Picks go through the shared Picks contract (`1LmgqB…`) where the game has picks; locks enforced on chain | `GAME_STANDARD.md` §4–5 |
| **Recorder** `bot/games/<game>.ts` (or its own file) + a workflow | Clock checks, two nodes, points recomputed at publish, per-file holds, write-once finals; pending on Sunday, final no earlier than Mon 00:00 | `RECORDER_STANDARD.md`, `WEEK_CYCLE.md` §2 |
| **Vault results file** | Fail-closed; always fills `first` / `second` | `VAULT_STANDARD.md` §6 |
| **`board.json`** | Next to the vault folder; `lastWeek`, wallet, `points`, place; Staked and Free rows | `LEADERBOARD_STANDARD.md` §1, R-ALL-3 |
| **VHP / handicap** | Only through the shared VHP ruler | `VHP_RULER.md` |
| **Mana** | Each player action fits a sponsor row (measure it; ask the Block X chat for a row) | `../platform/SPONSOR.md` |
| **Tests** | `tests/audit/<game>*.test.mjs`; prove Sunday rounds stay out of weekly tallies | `GAME_STANDARD.md` §1 |

- [ ] `npm run test:audit` and `node --test tests/audit/site.*.test.mjs` pass on the branch.
- [ ] A testnet run (week or season) if the game has one.

## Step 3 — Audit (owner + Repo Lens)
- [ ] The library chat writes the Repo Lens prompt (`../platform/AUDITS.md` → how). Owner sends it on the **exact commit**.
- [ ] Reports stay **private** in the Claude project (`claude/<game>/`), never in the repo.
- [ ] Every Critical and High fixed (or accepted as a D-xxx); fix-check **GO**.

## Step 4 — Go live
Follow **`GO_LIVE_CHECKLIST.md` steps 3–6** exactly (merge, Picks register 48 h, free-prize switch, vault `game-add` → 48 h → `game-apply` before Sunday 4 PM PT, `games.json`, menus, announcement). Mind its **timing rule**: latest safe `game-add` is **Friday ~noon PT** to earn from the next Monday.

## Step 5 — Keep it on the standard
- [ ] Your row in `WEEK_CYCLE.md` §4 stays true.
- [ ] `../platform/LAUNCH_BOARD.md` shows your stage; `../platform/CURRENT_STATE.md` lists you once live.
- [ ] Every session ends with the session-end report (`../platform/SESSION_END_PROCESS.md`).

## Files a new game adds (checklist for the PR)
`.ai/games/<GameName>.md` · `<game>.html` · `<game>.js` · `<game>-math.js` (optional) · recorder in `bot/` · workflow in `.github/workflows/` (generated or reviewed by the CI guard) · `tests/audit/<game>*.test.mjs` · a `games.json` entry · its data folder (branch or `*-data/`) · sponsor row (Block X chat) · its `WEEK_CYCLE.md` row.
