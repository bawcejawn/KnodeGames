# Block Golf (game 6)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Block Golf chat), `DECISIONS.md` (D-056), the repo (branch `golf`). **Last updated:** 2026-11-02.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A platform-wide "course": every other live game is a par-4 hole, and how well you placed in each game's weekly board sets your strokes. It rewards playing across Knode Games, needs no picks of its own, and has no contract of its own.

## Gameplay
- Nothing to pick. Each week, every live game is a hole; your place on that game's weekly leaderboard sets your strokes on it (D-056). 💬
- Games join the course automatically from the Monday after they go live — no manual or contract change. 💬
- **Practice weeks** (free, no prizes) start with the Block X launch; staked weeks start after Vault v6 registration. Practice vs staked is fixed per week by `GOLF_STAKED_FROM_WEEK`. 💬
- The page shows the week on a score panel and a paper-style scorecard (birdie circled, bogey boxed), the mulligan, links to games not yet played this week, the shared Staked / Free play board and a share line. 💬

## Scoring
- **Strokes by place** (ties share the middle place): 1st (if scored) 1 · top 5% 2 · top 25% 3 · top 65% 4 · top 90% 5 · the rest or scored 0 → 6 · didn't play → 7 (lost ball). 💬
- **Mulligan:** the worst *played* hole is dropped; a lost ball can't be. All holes count the same. 💬
- **Practice holes:** every scorer counts; 3 players make a hole. **Staked holes:** only players staked in Golf count, weighted by VHP staked (your own stake never moves you); a hole needs **5 stakers AND 10 VHP** among its scorers (defaults — owner can change). 💬
- **Points to the vault:** 7 × counted holes − strokes; only players with ≥ 1 point; a week with no staked scorers still gets an empty file. 💬
- **Finality:** final 12 h after the week once every hole is final and the run had no read problem; a hole not final by 60 h is skipped; from 66 h a read problem no longer blocks; staked holes only after stakes are read post-week; final weeks are frozen. 💬

## Rewards
- **Staked only for now** (D-071) — only players staked in Block Golf that week count; a free option may be added later. 👤 Share of Golf's part of the vault's weekly reward. 💬
- **Practice weeks** have no prizes. 💬

## Dependencies
- Other games' published results: Questions (contract, two nodes), Race (`race-data` board), Block X (`games-data` board). Survivor and Bracket readers were removed after the audit; later games each add a reader. 💬
- **Block X live** (practice starts with it). 💬
- Vault v6 merged into the `golf` branch → register game 6 (48 h) → `GOLF_STAKED_FROM_WEEK`; results `games-data:golf/vault/W<n>.json` ✅ `vaultGames`.
- `golf.yml` (hourly at :57, off until `GOLF_ENABLED=true`), `bot/games/golf.ts`, `golf-math.js` (integer math). 💬
- The move of all pages to the site root before merging (`claude/site-at-root.md`). 💬

## Current status (2 Nov)
Branch `golf` @ `6b2200a` ✅ — pushed, **not merged, nothing deployed**; `games.json` "soon" ✅. Audit trail all fixed (first audit 5 High / 4 Medium / 5 Low, then fix-checks). Tests: 481 (471 pass, 0 fail). Owner checklist items left: t28 (review the "Block Golf Preview" artifact), t30 (turn on practice). No testnet run by design — practice weeks on mainnet are the trial.

## Known issues (I-060)
- Blocked on Block X going live.
- Every game branch must move to the site root before merging.
- Early practice fields will be tiny (3 holes leave 2 after the mulligan).
- `MIN_FIELD = 5` and `MIN_FIELD_VHP = 10` need revisiting with real stake data.
- Is 25 Mana a day enough for heavy players? Guests can't fall back to their own Mana.
- Optional: stop the hourly "vault file has no rows" line repeating.
- Accepted residual: extra wallets with real stake that score low nudge everyone above them up a little.

## Future plans
Practice: after `picks` merges, move Golf files to the root, run the full suite, merge, set `games.json` live, add to the nav, `GOLF_ENABLED=true`. Staked: register game 6 and set `GOLF_STAKED_FROM_WEEK`. Add each new game's hole reader as it launches (Survivor must recompute standings at the week's last season day; Bracket reads its W file).

## Update 3 Nov — Free play (D-081)
Every game now has a **Free play board**. This game gets one for **standings only — no free VHP prize** until the owner switches it on. The page must say so.
