# Survivor (game 3)

> **Sources:** owner decisions D-020, D-051, D-062, D-068, D-081, D-082, D-095, 12 Nov 2026 (Season 1 option C, Sundays rest, void pick) and 14 Nov 2026 (Season 1 on Mon 7 Dec, the no-card rule, old recorder and testnet kit removed, no testnet season; D-new, numbered by the Library); the repo (`games/survivor/`). **Last updated:** 14 Nov 2026; previous version `../archive/2026-11-04b/games/Survivor.md` and git history.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A two-week elimination game: pick one producer a day and avoid the day's unluckiest ones. The last players standing win. Each producer can be used only once a season, so planning matters.

## Gameplay
- **Season:** two vault weeks, Monday to Saturday each: **12 play days**. Sundays rest: no pick, no life lost (WEEK_CYCLE; owner 12 Nov). 👤
- **Seasons:** Season 1 is **unpaid practice** from **Mon 7 Dec 2026** (vault weeks 7–8); Season 2, the **first paid season**, from Mon 21 Dec (weeks 9–10); then every 2 weeks (owner 12 and 14 Nov). `math.js` `FIRST_WEEK` = 7. 👤
- **Picks:** one producer per play day on the Picks contract, game 3 (round = the UTC day number). Picks open 7 days ahead and lock at 23:55 UTC the night before; up to 5 changes and 20 picks a day. A player joins by picking for day 1. ✅ `math.js`
- **Scoring:** the shared VHP ruler (RULE_VERSION 4), one ruler card per UTC day, from Season 1 (option C: the old blocks handicap is dropped). A producer's day score is its fpct (luck against its own expected blocks, as a field percentile). ✅ `math.js`
- **Field:** the card's producers with entry that aren't void. Knode's own producers stay in, disclosed on the page; open market (D-051). 👤
- **Out-zone:** floor(field × (10 + day) ÷ 44): a quarter on day 1 to half on day 12 (18 producers: 4,4,5,5,6,6,6,7,7,8,8,9). A tie at the line is safe. ✅ `math.js`, sims
- **Lives:** 2. You lose a life for an out-zone pick, no pick, a producer not in the field, or one already used. ✅
- **Void producer** (VHP moved more than −12% / +50% in the day): out of that day's field only. **A pick on it costs no life; the producer still counts as used** (owner 12 Nov). 👤 ✅
- **No ruler card** 48 hours after a day ends: **the day doesn't count** — no life lost, no pick used (owner 14 Nov; the platform's 48 h rule). Recorded and alerted. 👤
- **Boards:** Staked (staked in Survivor in either week of the season) and Free play. Each has its own safety net and its own end (SV-A10):
  - safety net: nobody safe on that board means nobody loses a life for the out-zone; a pick that can't count still costs its life;
  - end: after the day that leaves 2 or fewer in (if more than 2 started), when none is left, or after day 12. ✅

## Scoring
- **Ranking:** lasted longest, then lives left, then total of counted picks' scores. ✅
- **Staked weekly points:** the Staked board's standings at each week's end. The kit's tally of per-day points equals the season standing by construction. The vault pays the top 30% (D-152). ✅ tests
- Simulations on real ruler cards: seasons run the full 12 days from about 50 players; players who avoid recently unlucky producers win 80–98% (`docs/SURVIVOR.md`). ✅
- **Ruler finding:** under mode A two steady under-signing producers were in the out-zone almost every day of 20 real days. Accepted for Season 1 (Ruler chat, 13 Nov: a fair skill, form is public); out-zone rates recorded; a two-sided mode "E" for Season 2 is an owner decision. 💬

## Rewards
- **Free play: standings only.** The 4 + 2 VHP season prize (D-068) is **OFF** (D-081, D-082), registered with `--free --season 2` so it can be switched on later. It can't be switched on until the kit applies the free board's conditions (kit needs K3, K5):
  - held 1 VHP at every daily check;
  - free in both weeks;
  - not knocked out by a pick that couldn't count;
  - 3+ such players. 👤
- **Staked:** weekly points to the vault from the Staked board, from Season 2 (Season 1 earns nothing: the vault's `from_week` is Season 2's first week). 👤

## Dependencies
- **Shared Game Kit** (`games/survivor/`, D-158): K1 seasons, G7 `ctx.blockAt`, K4 live week, K8 fallback (in #319, with two K1 fixes asked of Architecture); K9 `ctx.decided` for the no-card rule (asked; until then a day with no card stays pending). The vault pin `vaultGames.3.kit` is in the Survivor PR. 💬
- **Picks contract:** game 3 registration (kind 1, list 1, lock mode 2, round 86,400,000 ms, lead 300,000 ms, ahead 604,800,000 ms, 5 changes, 20 picks a day), by Sat 28 Nov. Not yet registered. ✅
- **Vault v6** for staked points from week 9; results `games-data:survivor/vault/W<week>.json`. ✅ `vaultGames`
- **The page** (`survivor.html`, `survivor.js`): on the kit's files. ✅

## Current status (14 Nov)
- Built: rules, kit module, page, tests, docs. One PR, merging after #319; Repo Lens before merge. ✅
- `games.json` shows "soon". Game 3 is not registered on Picks or in the vault. ✅
- The old recorder (`bot/games/survivor.ts`, `survivor-math.js`), its testnet kit and their tests are removed (owner 14 Nov). **No testnet season**: Season 1 is the rehearsal (owner 14 Nov). 👤

## Known issues
- **I-050:** launch prerequisites (#319 with its fixes, Repo Lens, Picks registration by Sat 28 Nov, the vault steps for week 9).
- **I-051:** the vault can't recompute points from the chain yet.
- **I-053:** pass-4 questions (mid-season board changes, cheap-wallet gaming of nets or ends), on the kit module.
- **K9:** until the kit passes `ctx.decided`, a day with no ruler card stays pending instead of being skipped.

## Future plans
In order:
1. #319 merges, then the Survivor PR (Repo Lens GO);
2. Picks registration (by Sat 28 Nov), `SURVIVOR_ENABLED`, `games.json` live;
3. Season 1 (Mon 7 Dec, practice);
4. vault `game-add` from week 9, then Season 2 (Mon 21 Dec, first paid);
5. later: the free prize (K3, K5) and a ruler mode for Survivor.
