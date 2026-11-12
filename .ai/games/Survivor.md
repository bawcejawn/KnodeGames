# Survivor (game 3)

> **Sources:** owner decisions D-020, D-051, D-062, D-068, D-081, D-082, D-095 and 12 Nov 2026 (Season 1 option C, Sundays rest, void pick; D-new, numbered by the Library); `claude/survivor/HANDOFF-SURVIVOR-FINAL-2026-11-10.md`; the repo (branch `survivor`, `games/survivor/`). **Last updated:** 12 Nov 2026; previous version `../archive/2026-11-04b/games/Survivor.md` and git history.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A two-week elimination game: pick one producer a day and avoid the day's unluckiest ones. The last players standing win. Each producer can be used only once a season, so planning matters.

## Gameplay
- **Season:** two vault weeks, Monday to Saturday each: **12 play days**. Sundays rest: no pick, no life lost (WEEK_CYCLE; owner 12 Nov). 👤
- **Seasons:** Season 1 is **unpaid practice**, Season 2 the **first paid season** (owner 12 Nov, option C). Dates are decided by Mon 7 Dec. Until then `games/survivor/math.js` `FIRST_WEEK` is null. 👤
- **Picks:** one producer per play day on the Picks contract, game 3 (round = the UTC day number). Picks open 7 days ahead and lock at 23:55 UTC the night before; up to 5 changes and 20 picks a day. A player joins by picking for day 1. ✅ `math.js`
- **Scoring:** the shared VHP ruler (RULE_VERSION 4), one ruler card per UTC day, from Season 1 (option C: the old blocks handicap is dropped). A producer's day score is its fpct (luck against its own expected blocks, as a field percentile). ✅ `math.js`
- **Field:** the card's producers with entry that aren't void. Knode's own producers stay in, disclosed on the page; open market (D-051). 👤
- **Out-zone:** floor(field × (10 + day) ÷ 44): a quarter on day 1 to half on day 12 (18 producers: 4,4,5,5,6,6,6,7,7,8,8,9). A tie at the line is safe. ✅ `math.js`, sims
- **Lives:** 2. You lose a life for an out-zone pick, no pick, a producer not in the field, or one already used. ✅
- **Void producer** (VHP moved more than −12% / +50% in the day): out of that day's field only. **A pick on it costs no life; the producer still counts as used** (owner 12 Nov). 👤 ✅
- **Boards:** Staked (staked in Survivor in either week of the season) and Free play. Each has its own safety net and its own end (SV-A10):
  - safety net: nobody safe on that board means nobody loses a life for the out-zone; a pick that can't count still costs its life;
  - end: after the day that leaves 2 or fewer in (if more than 2 started), when none is left, or after day 12. ✅

## Scoring
- **Ranking:** lasted longest, then lives left, then total of counted picks' scores. ✅
- **Staked weekly points:** the Staked board's standings at each week's end. The kit's tally of per-day points equals the season standing by construction. The vault pays the top 30% (D-152). ✅ tests
- Simulations on real ruler cards: seasons run the full 12 days from about 50 players; players who avoid recently unlucky producers win 80–98% (`docs/SURVIVOR.md`). ✅
- **Open finding:** under ruler mode A two steady under-signing producers were in the out-zone every day of 20 real days, and six never (mode D: about 90%). The owner and the Ruler chat decide (a mode for Survivor needs kit K6). ❓

## Rewards
- **Free play: standings only.** The 4 + 2 VHP season prize (D-068) is **OFF** (D-081, D-082), registered with `--free --season 2` so it can be switched on later. It can't be switched on until the kit applies the free board's conditions (kit needs K3, K5):
  - held 1 VHP at every daily check;
  - free in both weeks;
  - not knocked out by a pick that couldn't count;
  - 3+ such players. 👤
- **Staked:** weekly points to the vault from the Staked board, from Season 2 (Season 1 earns nothing: the vault's `from_week` is Season 2's first week). 👤

## Dependencies
- **Shared Game Kit** (`games/survivor/`, D-158). Kit needs before it can run (`docs/SURVIVOR.md`):
  - K1: the staked board in `scoreRound`;
  - G7: `ctx.blockAt`;
  - K4: live days;
  - the Vault chat's `vaultGames.3.kit` pin;
  - for the free prize: K3, K5;
  - for a ruler mode: K6. 💬
- **Picks contract:** game 3 registration (kind 1, list 1, lock mode 2, round 86,400,000 ms, lead 300,000 ms, ahead 604,800,000 ms, 5 changes, 20 picks a day). Not yet registered. ✅
- **Vault v6** for staked points; results `games-data:survivor/vault/W<week>.json`. ✅ `vaultGames`
- **The page** (`survivor.html`, `survivor.js`): its data loading waits on K4.

## Current status (12 Nov)
- D-113 lifted for **local work only** (owner 12 Nov): no push, no PR and no Repo Lens before Tue 24 Nov. No Picks registration or `game-add` before a Repo Lens GO. 👤
- Branch `survivor`, local on the Survivor chat's workspace. It merges main `3161f593` and adds the kit module, tests and sims. **Not pushed.** ✅
- `games.json` shows "soon". Game 3 is not registered on Picks or in the vault. ✅
- The old recorder (`bot/games/survivor.ts`, `survivor-math.js`, its `games.yml` step) is replaced. Its `games.yml` step is gone with the merge; its files stay until the owner confirms they can be removed. ✅

## Known issues
- **I-050:** launch prerequisites (kit needs, Repo Lens pass 4, testnet season, registration).
- **I-051:** the vault can't recompute points from the chain yet.
- **I-053:** pass-4 questions (mid-season board changes, cheap-wallet gaming of nets or ends), now on the kit module.
- **I-055** (the old recorder's accepted residuals): mostly gone with the kit (file split by week, the kit's budgets and clock checks). "VHP read at each node's head" and "a blockless day" are now the ruler's and the kit's.
- **New:** the ruler mode A finding above.

## Future plans
In order:
1. kit needs;
2. page rewire to the kit's files;
3. one PR, after Tue 24 Nov, and Repo Lens pass 4;
4. a testnet season;
5. registration;
6. Season 1 (practice), then Season 2 (first paid).
