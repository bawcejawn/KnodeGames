# Block Golf (game 6)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Block Golf chat), `DECISIONS.md` (D-056), the repo (branch `golf-v2`, PR #187; old branch `golf`). **Last updated:** 5 Nov 2026; previous version `../archive/2026-11-04b/games/BlockGolf.md`.
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
- **Timing:** `../standards/WEEK_CYCLE.md` (the one home for game timing). `golf-v2` holds the week pending until Mon 00:00 and goes final after two matching runs (D-125). Its own finality rules stand: every hole final and no read problem; a hole not final by 60 h is skipped; from 66 h a read problem no longer blocks; staked holes only after stakes are read post-week; final weeks are frozen. 💬

## Rewards
- **Staked:** only players staked in Block Golf that week count for the staked prize; they share Golf's part of the vault's weekly reward. 👤 / 💬
- **Free play:** a Free play board for **standings only — no free VHP prize** until the owner switches it on (D-081, D-082; was staked-only, D-071). The page must say so. 👤
- **Practice weeks** have no prizes. 💬

## Dependencies
- Other games' published results: Questions (contract, two nodes), Race (`race-data` board), Block X (`games-data` board). Survivor and Bracket readers were removed after the audit; later games each add a reader. 💬
- **Block X** (practice starts with it): live since 3 Nov ✅. Whether practice also waits for the sampler: ❓ (R-GO-2).
- `main` (with Vault v6) merged into the `golf-v2` branch → register game 6 (48 h) → `GOLF_STAKED_FROM_WEEK`; results `games-data:golf/vault/W<n>.json` ✅ `vaultGames`.
- `golf.yml` (hourly at :57, off until `GOLF_ENABLED=true`), `bot/games/golf.ts`, `golf-math.js` (integer math). 💬
- The move of all pages to the site root before merging (`claude/site-at-root.md`). 💬

## Current status (5 Nov)
- **⏸ Held for the Shared Game Kit (D-161, owner 5 Nov: "hold on golf wait for the kit").** No launch on the hand-built recorder; `GOLF_ENABLED` stays off. `golf-launch` @ `02c86e1` (go-live + fix-check F-1 – F-3, I-1 – I-3) and PR #187 are kept as the source for the port to `games/golf/recorder.ts` once the kit's core merges (R-ARCH-3, R-ALL-11).
- **Branch `golf-v2` @ `6ce7b5d`, PR #187 (5 Nov):** site root, weekly rhythm (pending to Mon 00:00, two-run check), Free play board, the current page frame; Golf 60/60, full suite 1,082 / 0. Next: Repo Lens, then I-098 / I-099 (recompute at publish, holds) before launch; launch steps in `docs/GOLF.md`.
- **▶ Reactivated 5 Nov (D-142): one of the next three games to launch. Its chat starts with `../platform/CHAT_REQUESTS.md` → R-ALL-9 (the catch-up on the 4–5 Nov standards), then its own section.**
- **Not merged, nothing deployed**; `games.json` "soon" ✅. The old branch `golf` @ `6b2200a` (audit trail all fixed) is kept for history.
- No testnet run by design: practice weeks on mainnet are the trial. Owner checklist items left: t28 (review the "Block Golf Preview" artifact), t30 (turn on practice).
- Work list: `../platform/CHAT_REQUESTS.md` → Block Golf.

## Known issues (I-060)
- Every game branch must move to the site root before merging.
- Early practice fields will be tiny (3 holes leave 2 after the mulligan).
- `MIN_FIELD = 5` and `MIN_FIELD_VHP = 10` need revisiting with real stake data.
- Are the sponsor's per-player caps (`../platform/SPONSOR.md`) enough for heavy players? Guests can't fall back to their own Mana.
- Optional: stop the hourly "vault file has no rows" line repeating.
- Accepted residual: extra wallets with real stake that score low nudge everyone above them up a little.

## Future plans
Launch path: `../platform/ROADMAP.md` (practice: move Golf files to the root, run the full suite, merge, set `games.json` live, add to the nav, `GOLF_ENABLED=true`; staked: register game 6 and set `GOLF_STAKED_FROM_WEEK`). Add each new game's hole reader as it launches (Survivor must recompute standings at the week's last season day; Bracket reads its W file).
