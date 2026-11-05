# Block Golf: how it works and how to turn it on

Block Golf is a golf course made of every other Knode Games game. Each live game is a par-4 hole, and a player's place on
that game's weekly leaderboard sets their strokes. There is nothing to pick, so Block Golf has **no contract, no picks and
costs players no Mana**. It only reads the results the other games already publish.

Rules: `golf-math.js` (the page and the recorder both run it). Decisions: D-056 (rules), D-081 / D-082 (Free play board,
prize switch), D-125 / D-129 (weekly rhythm), D-138 (launch order). Game file: `.ai/games/BlockGolf.md`.

## The pieces

| Piece | File | What it does |
|---|---|---|
| Rules | `golf-math.js` | Place → strokes, the mulligan, points, places. |
| Recorder | `bot/games/golf.ts` | Every hour: builds every player's scorecard from each game's results and writes `games-data/golf/`. Reads only; holds no key. |
| Mainnet workflow | `.github/workflows/golf.yml` | Runs the recorder hourly at :57; its publish job pushes only `games-data/golf`. **Off until `GOLF_ENABLED` = `true`.** |
| Page | `golf.html`, `golf.js`, `golf.css` | Your scorecard, holes you haven't played, the Staked and Free play boards, the stake badge and panel (game 6), nicknames. |
| Listing | `games.json` → `golf` | `"status": "soon"` until launch; the board's columns and the Free play note. |

## How a game becomes a hole

1. The game is marked `"status": "live"` in `games.json`.
2. `bot/games/golf.ts` has a reader for it (today: `questions`, `race`, `blockx`). Last Node, Fantasy, Bracket, Survivor
   and the other games add theirs when they launch, with a test (Survivor's should recompute the standings at the
   week's last season day with `survivor-math.js`, not keep a snapshot: audit H4).
3. It plays from the **Monday after** it went live, so nobody loses strokes on a game that didn't exist all week.

No contract, vault or sponsor change is needed to add a hole. A new game's own build adds its reader and a test.

## The week (D-125, D-129; the one home for timing is `.ai/standards/WEEK_CYCLE.md`)

- Block Golf has no rounds of its own. Each hole is that game's **weekly** board, which already leaves out Sunday fun
  rounds, so Sunday never counts in Golf either.
- **Pending** until the week ends (Monday 00:00 UTC), Sunday's review day included.
- **Final** no earlier than Monday 00:00 UTC, once every hole is final (or skipped), the run had no read problem, and
  **two runs at least an hour apart read exactly the same week**. The first such run stamps a fingerprint (`check` in
  the week file); the next matching run makes the week final. Any change starts the check again.
- A hole whose game isn't final 60 hours after the week is skipped for everyone (never guessed); from 66 hours a read
  problem no longer holds the week, so its points reach the vault before the Thursday 00:00 UTC backstop.
- Daily Questions goes final later than the other games (about Tuesday 12:00 UTC until Vault v6.1's rule week), so in
  practice a Golf week goes final on Tuesday and claims open about 24 hours after the vault bot seals it; once Questions
  follows the shared rhythm (its rule week, Mon 16 Nov) Golf can go final on Monday. The recorder reads Questions straight from the game contract, which works
  before and after Vault v6.1.
- A final week never changes.

## Turn on practice scorecards

Practice weeks are free, pay nothing and are Block Golf's trial on mainnet (no testnet run, owner 28 Oct).

1. The owner merges the Block Golf PR.
2. In `games.json`, change Block Golf's line to `"status": "live", "href": "golf.html"`; in `tools/site-nav.mjs` add
   `["Block Golf", "golf.html"]` to the Games menu and the Play group of the More sheet; run the nav tool and the site
   tests (a small PR):

   ```powershell
   cd C:\kprediction
   git branch --show-current
   node tools/site-nav.mjs
   node --test tests/audit/site.*.test.mjs
   ```

3. GitHub → Settings → Secrets and variables → Actions → Variables → New variable: `GOLF_ENABLED` = `true`.
4. GitHub → Actions → "Block Golf recorder" → Run workflow. It should finish green. Then open
   `https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/golf/index.json`: it lists the course.

The first run puts every game that is already live on the course straight away.

## Staked Block Golf

Order: practice running → free-prize switch OFF → register game 6 → 48 h → apply → set `GOLF_STAKED_FROM_WEEK`.

- Free prize switch first (D-082): `npm run prizes -- off 6 --send` (admin panel → Knode Vault → Free prizes), so the
  Free play board pays nothing until the owner switches it on.
- Register in the vault (48-hour notice, then apply within 7 days): `game-add 6 "Block Golf" --staked --free --season 1`.
  A game earns from the vault week after its `game-apply`.
- Set `GOLF_STAKED_FROM_WEEK` (a GitHub variable) to that first earning week: the number in the W file names, e.g. `5`
  for `W005.json` (site "Week 3"). It can't change once a week has been published with it.
- Two boards (D-081): **Staked** = staked in Block Golf that week; **Free play** = everyone else, ranked the same way.
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
- The vault takes only scorecards with at least 1 point (a player who played a single hole has it dropped by the
  mulligan and scores 0).

## Running it on your PC (optional)

With the race and games files copied into two folders:

```powershell
cd C:\kprediction
git branch --show-current
$env:RACE_DATA = "C:\temp\race-data"; $env:GAMES_DATA = "C:\temp\games-data"; $env:GOLF_OUT = "C:\temp\golf"
npm run golf
```

It prints each week's holes and how many scorecards it made. It only reads; it never sends a transaction.
