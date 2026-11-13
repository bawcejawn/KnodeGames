# Block Golf: how it works and how to turn it on

Block Golf is a golf course made of every other Knode Games game. Each live game is a par-4 hole, and a player's place on
that game's weekly leaderboard sets their strokes. There is nothing to pick, so Block Golf has **no contract, no picks and
costs players no Mana**. It only reads the results the other games already publish.

Rules: `golf-math.js` (the page and the recorder both run it). Week names on the page and in `npm run golf -- status` follow `weeks.js`
(D-063: vault week 4, from Mon 16 Nov, is "Week 1"; vault week 3, from Mon 9 Nov, is the "Test week" and pays nothing). Decisions: D-056 (rules), D-081 / D-082 (Free play board,
prize switch), D-125 / D-129 (weekly rhythm), D-138 (launch order). Game file: `.ai/games/BlockGolf.md`.

## The pieces

| Piece | File | What it does |
|---|---|---|
| Rules | `golf-math.js` | Place → strokes, the mulligan, points, places. |
| Recorder | `bot/games/golf.ts` | Every hour: builds every player's scorecard from each game's results and writes `games-data/golf/`. Reads only; holds no key. |
| Mainnet workflow | `.github/workflows/golf.yml` | Runs the recorder hourly at :57; its publish job pushes only `games-data/golf`. **Off until `GOLF_ENABLED` = `true`.** |
| Page | `golf.html`, `golf.js`, `golf.css` | Your scorecard, holes you haven't played, the Staked and Free play boards, the stake badge and panel (game 6), nicknames. |
| Listing | `games.json` → `golf` | `"status": "live"` (5 Nov); the board's columns, the Free play note and `free.byPlace` (medals by Golf's places). |

## How a game becomes a hole

1. The game is marked `"status": "live"` in `games.json`.
2. `bot/games/golf.ts` has a reader for it (today: `questions`, `race`, `blockx`). Last Node, Fantasy, Bracket, Survivor
   and the other games add theirs when they launch, with a test (Survivor's should recompute the standings at the
   week's last season day with `survivor-math.js`, not keep a snapshot: audit H4). **Or the standard reader:** a game
   that publishes the shared board at `games-data/<id>/board.json` (Block X's shape, with `lastWeek.final`) adds
   `"golf": "standard"` to its `games.json` entry and needs no reader of its own. It is opt-in on purpose: a game's
   board is trusted as a hole only after its own chat and Repo Lens say so. Its id must be a plain lower-case name
   (the workflow and the recorder both refuse anything else), and it must be in `COURSE_ORDER` in `golf-math.js`.
3. It plays from the **Monday after** it went live, so nobody loses strokes on a game that didn't exist all week.

What each hole waits for (a hole is final only when its game's own week is final):

| Hole | Read from | Final when |
|---|---|---|
| Daily Questions | the game contract, on two nodes that must agree | the week is closed and every question resolved. Every wallet that answered at least one question has played the hole; with no correct answer it scores 6 strokes, not a lost ball (owner, 28 Oct and 6 Nov). |
| Producer Race | `race-data/board.json` and `race-data/vault/W<w>.json` | every race is final **and** the Race's own vault file for the week is final (its two-run check, chain re-check and `RACE_HOLD_WEEKS`; Repo Lens G-3). A Race week you hold past 60 hours makes Golf skip the Race hole for everyone that week (Repo Lens I-2). |
| Who Signs Block X | `games-data/blockx/board.json` | its `lastWeek.final` (set after Block X's own two-run check and week-end re-read). |

No contract, vault or sponsor change is needed to add a hole. A game with the shared board adds one line to `games.json`; any other game's build adds its reader and a test.

The Clubhouse hole (a hole scored by how many different platform features a wallet used) is planned in `claude/golf/CLUBHOUSE-PLAN-2026-11-06.md` and is **not built yet**: each feature chat must first say how its action shows up as a public wallet record.

## The week (D-125, D-129; the one home for timing is `.ai/standards/WEEK_CYCLE.md`)

- Block Golf has no rounds of its own. Each hole is that game's **weekly** board, which already leaves out Sunday fun
  rounds, so Sunday never counts in Golf either.
- **Pending** until the week ends (Monday 00:00 UTC), Sunday's review day included.
- **Final** no earlier than Monday 00:00 UTC, once every hole is final (or skipped), the run had no read problem, and
  **two runs at least an hour apart read exactly the same week**. The first such run stamps a fingerprint (`check` in
  the week file, over the holes, the cards and `notFree`); the next matching run makes the week final. Any change
  starts the check again.
- **Every hole is read again on every run** until the week is final (Repo Lens G-2), and in staked weeks the Block
  Golf stakes are read again for every wallet on the week's holes. A hole that was already final keeps its standings
  only when this run can't read it (a read error, a missing file, or a board that has moved past the week), so a later
  bad read never undoes it; a fresh reading that differs replaces it and restarts the check, and a game that no longer
  shows the week as final makes its hole wait.
- **A game's file that can't be read** (missing, not JSON, a link, over 20 MB) is reported on the run and holds the
  week (Repo Lens F-3); a hole already final keeps its standings, with a note. A week whose results keep changing from
  run to run is reported every hour from 48 hours after it ends (I-1), since it would otherwise roll over at Thursday's
  deadline.
- **The owner's hold:** the repository variable `GOLF_HOLD_WEEKS` (`5`, or `5,6`) keeps those weeks from going final,
  so no vault file is written and the vault bot waits. Remove the week to let it go final (the vault takes results
  until Thursday 00:00 UTC; after that the week rolls over). A value that isn't a plain list (`W5`, `5 6`) holds every
  week waiting to go final, until it's fixed.
- A hole whose game isn't final 60 hours after the week is skipped for everyone (never guessed); from 66 hours a read
  problem no longer holds the week, so its points reach the vault before the Thursday 00:00 UTC backstop.
- Daily Questions goes final later than the other games (about Tuesday 12:00 UTC until Vault v6.1's rule week), so in
  practice a Golf week goes final on Tuesday and claims open about 24 hours after the vault bot seals it; once Questions
  follows the shared rhythm (its rule week, Mon 16 Nov) Golf can go final on Monday. The recorder reads Questions
  straight from the game contract, which works before and after Vault v6.1. From the rule week the operator bot closes
  Questions weeks (D-127): if it stalls past 60 hours, the Questions hole is skipped for that week.
- A final week never changes.

## What the publish job checks

The publish job runs no repository code; its checks are inline in `golf.yml` and use its own clock:
- **Shape:** every file in the recorder's exact shape; only `golf/` files are pushed.
- **Clock (RECORDER_STANDARD §3.1):** no week from the future; no final week or vault file before the week ends; a
  `check` stamp only between the week's end and now.
- **Recompute (§4.1):** every scorecard is rebuilt from the published hole rows with a Python port of `golf-math.js`
  (strokes, places, the mulligan, points, order, Staked / Free play) and must match exactly; the port is
  differential-tested against `golf-math.js` on random weeks. The vault file's rows and `first`/`second` are rebuilt
  from the cards.
- **History:** a final week never changes; the list of weeks only grows; a game's joining week and the first staked
  week never change; and a week turns final only if the published file before it carried the `check` stamp of exactly
  that week, at least an hour old (Repo Lens G-5).

## Turn on practice scorecards

Practice weeks are free, pay nothing and are Block Golf's trial on mainnet (no testnet run, owner 28 Oct). Golf is
already listed as live in `games.json` and the menus, so the page and its Leaders tab appear as soon as the PR merges.

1. The owner merges both Block Golf PRs (`golf-v2`, then `golf-launch`; the second adds the `npm run golf` script the
   hourly recorder runs, so turn the recorder on only after it).
2. GitHub → Settings → Secrets and variables → Actions → Variables → New variable: `GOLF_ENABLED` = `true`.
3. GitHub → Actions → "Block Golf recorder" → Run workflow. It should finish green.
4. Check from `C:\kprediction` (read-only):

   ```powershell
   cd C:\kprediction
   git branch --show-current
   git pull
   npm run golf -- status
   ```

   It lists the course, each week's state (in play / results being checked / waiting for its second matching run /
   FINAL), each hole and why it is waiting, and the three switches below.

The first run puts every game that is already live on the course straight away (this week is a practice week).

## The switches (GitHub repository variables)

| Variable | Value | What it does | When |
|---|---|---|---|
| `GOLF_ENABLED` | `true` | turns the hourly recorder on (`false` or deleted: off; the page keeps the last published files) | once, after the merge |
| `GOLF_STAKED_FROM_WEEK` | a vault week, e.g. `5` | the first staked week; earlier weeks are practice | once, **after** `game-apply 6` succeeds (`games` shows "from week N") and **before** that week's first run (Monday 00:57 UTC = Sunday 7:57 PM ET in winter, 8:57 PM ET in summer); never change it afterwards (the publish job refuses a change) |
| `GOLF_HOLD_WEEKS` | `5` or `5,6` | holds those weeks from going final (no vault file) | any time you want to look at a week before it pays; delete it, or remove the week, to release it (the vault takes results until Thursday 00:00 UTC) |

## Staked Block Golf

Order: practice running → free-prize switch OFF → register game 6 → 48 h → apply → set `GOLF_STAKED_FROM_WEEK`.

- Free prize switch first (D-082): `npm run prizes -- off 6 --send` (admin panel → Knode Vault → Free prizes), so the
  Free play board pays nothing until the owner switches it on.
- Register in the vault (48-hour notice, then apply within 7 days): `game-add 6 "Block Golf" --staked --free --season 1`.
  A game earns from the vault week after its `game-apply`.
  **Timing (Week 2 launch):** `game-add 6` was sent Thu 12 Nov 2026 at about 3:16 PM ET. The apply opens 48 h later and
  the announcement expires 7 days after that. To earn from vault week 5 (Week 2, Mon 23 Nov) the apply must land in
  vault week 4: **after Sun 15 Nov 7:00 PM ET (Mon 16 Nov 00:00 UTC) and before Sat 21 Nov 3:16 PM ET**. An apply before
  Sun 15 Nov 7:00 PM ET lands in vault week 3 and makes the game earn in Week 1, when Golf is practice-only. Check with
  `npm run bot -- games`: it must show `game 6 Block Golf: staked + free prize, from week 5`.
- Set `GOLF_STAKED_FROM_WEEK` (a GitHub variable) to that first earning week: the number in the W file names, e.g. `5`
  for `W005.json` (vault week 5, site "Week 2", Mon 23 Nov 2026). It can't change once a week has been published with it.
- Two boards (D-081): **Staked** = staked in Block Golf that week (`week_stake` at least the vault's minimum);
  **Free play** = everyone else, ranked the same way. A wallet whose Block Golf stake reached the minimum **at any
  point** that week (`peak_stake`, as Block X reads it) is never on the Free play prize list, even if it withdrew
  (Repo Lens G-1); it shows with the week's stakers on the board and is listed in the week file's `notFree`.
  The vault file always lists the Free play board's 1st and 2nd in `first`/`second` (ties share; 2nd only when 1st is
  untied; more than 10 tied leaves that place empty); the vault bot holds them back while game 6's switch is off.
  Practice weeks: everyone is on the Free play board.
- For each final staked week the recorder writes the Vault's file `games-data:golf/vault/W<week>.json` (game 6; every
  player staked in Block Golf that week, `week_stake` at least that week's Vault minimum, with 1+ points, 1–255; empty
  rows when nobody staked scored; `first`/`second` from the Free play board). The hourly vault bot posts it, and checks it
  against `games-data:golf/board.json`. `game-data/deployment.json` → `vaultGames` already has
  `"6": { "name": "Block Golf", "results": "games-data:golf/vault" }`. File names have no padding (`W57.json`). A sent
  file can't be changed by the recorder (the publish job refuses it); corrections go through the owner's 24-hour
  correction window on the Vault.

## Practice and staked weeks

- Until `GOLF_STAKED_FROM_WEEK` is set, every week is practice: every player who scored on a game counts, and 3 make a hole.
- From that week a hole's field is the players **staked in Block Golf** that week (at least 1 VHP, read from the vault on
  two nodes) who scored on that game, **counted by whole VHP staked, not by wallets** (owner, 2026-10-28). Your own stake
  never moves you, so moving VHP into idle wallets changes nothing. A hole needs at least 5 Block Golf stakers AND 10 VHP
  of Block Golf stake among its scorers (`MIN_FIELD` and `MIN_FIELD_VHP` in `golf-math.js`; to revisit with real stake
  data, I-060). A week with no staked scorecards gets a vault file with empty rows, so the Vault rolls that bucket over.
- The question game hole keeps Block Golf's simple rule (owner, 2026-10-28).
- A hole in a staked week becomes final only after the stakes are read once the week has ended; if they still can't be
  read 66 hours after the week, the hole is skipped rather than scored on older reads.
- The vault takes only scorecards with at least 1 point.
- **The mulligan** (owner, 6 Nov; Repo Lens C13-L1): each week the worst hole of any kind is dropped, a missed game
  included. Playing a game never scores worse than skipping it; a play that scores nothing (6 strokes) is worth at
  most 1 point, so it can't shield a good hole from the mulligan.

## Running it on your PC (optional)

With the race and games files copied into two folders:

```powershell
cd C:\kprediction
git branch --show-current
$env:RACE_DATA = "C:\temp\race-data"; $env:GAMES_DATA = "C:\temp\games-data"; $env:GOLF_OUT = "C:\temp\golf"
npm run golf
```

It prints each week's holes and how many scorecards it made. It only reads; it never sends a transaction.
