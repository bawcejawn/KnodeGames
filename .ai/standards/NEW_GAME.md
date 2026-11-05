# Knode Games — Adding a New Game

> **Purpose:** the one path from "I have a game idea" to "it pays every week": **copy → fill → check → review → go live**. Each step names who does it and the page that holds the detail; nothing here repeats a rule that has a home elsewhere.
> **Decisions behind it:** D-157 (the Game Standard and Contract Standard), D-134 (one weekly standard), D-146 (the shared game kit), D-125 / D-129 (the week), D-064 (nothing announced until ready), D-079 / D-081 / D-082 (boards and free prizes).
> **Last updated:** 2026-11-05 (rewritten for D-157: template, manifest, `game:new` and `game:check`)
> **Today's games** still use their old file locations until each is moved into `games/<slug>/` (one PR per game, D-157 migration). New games start in the new layout.

## The game folder (Game Standard, D-157)
```
games/<slug>/
  game.json     the manifest: the ONE place a game's settings live (schema: tools/game-manifest.mjs)
  README.md     a short pointer page; the rules live in .ai/games/<Game>.md
  SECURITY.md   the filled security checklist
  math.js       scoring shared by the page and the recorder (pure, tested)
  recorder.ts   only the game's own part; the shared kit (D-146) does reads, holds, finals, vault files
  tests/        math, recorder and page tests
```
A game holds no tokens and no keys. It almost never needs its own contract: it registers on Picks (or uses the vault) and in the vault. A game that does need a contract also follows `CONTRACT_STANDARD.md`.

## 1. Copy (game chat, first session; owner approves the idea first)
```powershell
cd C:\kprediction
git branch --show-current
git switch -c game-<slug> origin/main
npm run game:new -- <slug> --id <vault game id> --name "<Display name>"
```
- Pick the next free vault game id from `../platform/PLATFORM.md` (in use: 1–9, 13; `game:new` refuses a used one).
- Start the chat with `AI_CHAT_STARTER.md` §3.2; add its section to `../platform/CHAT_REQUESTS.md` (library chat).

## 2. Fill (game chat)
| Fill | Where | Rules from |
|---|---|---|
| every `{{…}}` in `game.json` | `games/<slug>/game.json` | the schema prints what each field needs |
| the rules (purpose, gameplay, scoring, rewards, status) | `.ai/games/<Game>.md` (template: `GAME_STANDARD.md` §9) | `GAME_STANDARD.md` |
| scoring | `math.js` + `tests/` | the rules file |
| the game's recorder part | `recorder.ts` | `RECORDER_STANDARD.md`, the shared kit |
| the page (Staked + Free boards, nicknames, stake badge and panel, the Sunday line) | page files | `GAME_STANDARD.md` §7, `LEADERBOARD_STANDARD.md` |
| its row in the week-cycle table | `WEEK_CYCLE.md` §4 | `WEEK_CYCLE.md` |
| a sponsor row for each player action (measured on testnet, ≤ 2.4 Mana) | Block X chat adds it on chain | `../platform/SPONSOR.md` |
| the security checklist | `SECURITY.md` | this page's rules + `../platform/REPO_MAP.md` |

## 3. Check (game chat, before asking for review)
```powershell
npm run game:check -- <slug>
npm run test:audit
```
`game:check` must end "All required checks passed": manifest valid and unique, required files present, rules doc present, the week-cycle row, tests present; from status `review` on, also listed in `games.json` with its page.

## 4. Review (owner + Repo Lens)
The chat writes the Repo Lens prompt (`../platform/AUDITS.md`), the owner sends it on the exact commit, the chat fixes **every finding in one pass** (D-140), then a fix-check to GO. Reports stay private.

## 5. Go live (owner + chats)
Follow `GO_LIVE_CHECKLIST.md` steps 3–6: merge; Picks announce → apply (48 h); free-prize switch; `game-add <id> "<name>" --staked --free --season <n>` → 48 h → `game-apply` before Sunday 4 PM PT (latest safe `game-add`: Friday ~noon PT); the prize-start and `*_ENABLED` variables; `games.json` and menus; the announcement. Then set `"status": "live"` in `game.json`.

**"Live" means all true:** `game:check` passes · Repo Lens GO on the merged commit · Picks applied (if it uses Picks) · `game-apply` done and the prize-start week set · sponsor rows live · recorder on and its first hourly run green · free-prize switch set · listed on the site · the first paid week sealed and claimed with no correction.

## 6. Keep it on the standard
`game.json` stays true (status, rows, variables); `WEEK_CYCLE.md` §4 row stays true; `../platform/LAUNCH_BOARD.md` shows the stage; every session ends with the session-end report.
