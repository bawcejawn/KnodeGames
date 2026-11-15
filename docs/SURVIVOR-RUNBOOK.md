# Survivor runbook (game 3)

How to launch Survivor and look after it. The rules are in `docs/SURVIVOR.md`; the code in `games/survivor/`. Survivor runs on the Shared Game Kit: the hourly `games.yml` job records it and the kit's publish job publishes it to `games-data:survivor/`. Nothing here needs a key except the Picks and vault steps, which run on the owner's PC.

Every PowerShell block starts in the owner's folder and checks the branch, because several chats share it.

## Before launch (in order)
1. **The PRs.** #319 (`kit-next`) merges first, then the Survivor PR after its Repo Lens GO. The owner merges.
2. **Picks game 3 (by Sat 28 Nov).** On `main`, dry run first:
   ```powershell
   cd C:\kprediction
   git branch --show-current
   git pull
   npm run picks -- games
   ```
   Check game 3 isn't registered. The Block X / Picks chat gives the exact `announce 3` and `apply 3` commands with game 3's values (kind 1, list 1, lock mode 2, round 86,400,000 ms, offset 0, lead 300,000 ms, ahead 604,800,000 ms, 5 changes, 20 picks a day, enabled). Announce, wait 48 hours, apply, within 7 days. Registering a shape is permanent: compare every value with `docs/SURVIVOR.md` before sending. Applying by Mon 30 Nov opens day 1 (Mon 7 Dec) for picks on time.
3. **Sponsor row** for Picks game 3 `pick` (the Mana sponsor chat).
4. **Free prize OFF** for game 3, before week 7:
   ```powershell
   cd C:\kprediction
   git branch --show-current
   npm run prizes -- off 3
   ```
   It prints what it would send. Then run it again with `--send`.
5. **Switch the recorder on:** GitHub, Settings, Secrets and variables, Actions, Variables: `SURVIVOR_ENABLED` = `true`. Weeks before week 7 are never recorded, so it can be set any time before Mon 7 Dec 00:00 UTC.
6. **The page:** the Hub chat sets Survivor live in `games.json`, the menus and the sitemap.

## Season 2 (the first paid season): the vault
Do these during Season 1 (by about Sat 12 Dec), on the owner's PC:
1. `game-add 3 "Survivor" --staked --free --season 2` with **from week 9**. The Vault chat gives the exact command and its dry run. Read the dry run's `from_week` twice: a wrong week silently loses the season prize, and vault weeks can't be undone.
2. `game-apply` 48 hours later, inside week 8 (a game applied in week W earns from W + 1).
3. Check with `npm run bot -- games` that game 3 shows from week 9.
4. GitHub variable `SURVIVOR_PRIZES_FROM_WEEK` = `9`.

## Every week (nothing to do unless an email comes)
- Each play day's result is published the morning after (UTC) in the live week copy. Each week goes final from Monday about 02:00 UTC, after two runs at least 2 hours apart agree.
- The kit emails an alert when something needs you. The common ones:

| Alert | What it means | What to do |
|---|---|---|
| "no ruler card 48 h after it ended, so it was decided by the game's fallback rule" | The ruler's data stopped; that day doesn't count for anyone | Nothing for Survivor. Tell the Ruler chat the data stopped |
| "waits on week N, which isn't final" | The season's first week is held or pending, so its second week waits | Find out why week N isn't final (the email before this one) |
| "the kit's season … isn't math.js's" | The season start drifted (a reset or `firstWeek` changed) | Stop: ask the Survivor chat. Never guess a reset week |
| "week N is held … release it with SURVIVOR_RELEASE" | A final week reads differently on chain | Ask the Survivor chat to check it; only then set the release value it prints |

## Switches (the admin page lists each)
- `SURVIVOR_ENABLED`: `true` runs the recorder; `false` stops it (stakes are untouched).
- `SURVIVOR_HOLD_WEEKS`: weeks kept pending (nothing pays for them). A held first week also holds its season's second week.
- `SURVIVOR_RELEASE`: `<week>:<code>`, lets one held week through once.
- `SURVIVOR_RESET_FROM_WEEK`: a fresh season start, only at a season's first week (7, 9, 11 …). Ask the Survivor chat first.
- `SURVIVOR_PRIZES_FROM_WEEK`: the first week the vault pays (9).

## Changing the season dates
Only before Season 1 starts: `games/survivor/math.js` `FIRST_WEEK` and `games/survivor/game.json` `firstWeek` must change together (a test checks), in a reviewed PR. Once week 7 is recorded, never move `firstWeek` past it.
