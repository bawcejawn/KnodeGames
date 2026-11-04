# Producer Bracket (game 9)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Producer Bracket chat), `DECISIONS.md` (D-019, D-057, D-058, D-062), the repo (branch `kg-09-bracket`). **Last updated:** 2026-11-03.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A weekly knockout tournament of Koinos block producers, like a March Madness bracket: predict who wins each head-to-head matchup, one round a day. This chat also built the platform-wide **VHP standard** every game uses to measure VHP the same way (D-058).

## Gameplay
- **Weekly cycle:** seeding Saturday 12:00 UTC; picks lock Sunday 23:55 UTC (~36 h to pick); one round per UTC day from Monday. 💬
- **Size:** under 8 producers → no bracket; 8–11 → 8 (Mon–Wed); 12–15 → 16 with byes; 16–31 → top 16 (Mon–Thu); 32+ → 32 (Mon–Fri). 💬
- **Seeding:** average VHP over 28,800 blocks on two agreeing nodes; biggest = seed 1; not seeded within 24 h → the week is void. 💬
- **A pick is one number:** bit n = "the lower seed wins matchup n" (bye bits 0). Picks game: NUMBER kind, weekly rounds, ahead ≤ 36 h, 20 picks a day, 20 changes. 💬
- **Matchups:** baseline + credit; index = blocks credited ÷ blocks expected; an exact tie goes to the lower seed. **Forfeit:** a seed whose baseline is under 0.5 × its seeding VHP loses; if both forfeit, the index decides. No producer is left out unless below minimum production; Knode's own nodes play. The vault never forfeits (its VHP is players' stakes, recorded as `pooled`). 💬

## Scoring
- **Points:** 1 / 2 / 4 / 8 / 16 by round, +2 for the champion (max 14 / 34 / 82 for 8 / 16 / 32). Byes score nothing. 💬
- **Tie-break:** points → a right champion → more right winners → who submitted first (last-change time); brackets in the same block share. 💬
- **Vault rows:** dense-ranked onto 1–255; past 255 distinct places the best 254 stay exact and the rest share 1. 💬
- Final 12 h after the last round once the close stake read is in; still unreadable 3 days after the week → final as `vault: "missed"`, no file. 💬

## Rewards
- **Staked:** at least the vault minimum (1 VHP) staked in game 9; staked at the week's start stays staked that week. 💬
- **Free play: 2 VHP for 1st, 1 VHP for 2nd** (D-019, D-062). Tied for 1st share all 3 VHP; a single 1st → tied 2nd share 1 VHP; at most 10 per place (more than 10 tied → that place and below stay empty). Minimum play: one bracket with ≥ 1 point. Guests eligible. 1-week seasons. 💬

## Dependencies
- **Picks contract:** announce game 9 (48 h). **Vault:** `game-add 9 "Producer Bracket" --staked --free --season 1` (48 h; when its fix-check passes, no 9 Nov target, D-088), free-prize switch ON (D-082); results `games-data:bracket/vault/W<week>.json` ✅ `vaultGames`.
- A **sponsor allowlist row** for game 9 picks. 💬
- The VHP standard (`vhp-standard.js`, `bot/vhp-chain.ts`) and the VHP contract's `effective_balance_of`. 💬
- Recorder `bot/games/bracket.ts` in `games.yml`; data branch `bracket-history` (keep) ✅.

## Current status (2 Nov)
Branch `kg-09-bracket` @ `ee676ea` ✅ — pushed, **not merged, nothing deployed**. Repo Lens audit not yet run (prompt `claude/audit-bracket-prompt.md`). Evidence: the VHP rebuild matched all 780 race-card readings; over 100 days the better seed won 54% of 113 matchups, and a "last week's form" bracket averaged 14.8 points vs 4.8 for random. The sampling branches are already deleted ✅.

## Known issues (I-061)
- `effective_balance_of` has never been seen live — pin the block it uses after the first real run.
- F-2 (accepted): hiding VHP on seeding day lowers a producer's forfeit bar.
- F-10: final weeks are re-scored on every load, so rule changes must apply only from a stated week; stake reads aren't pinned to a block.
- A whale withdrawing mid-day can sink the vault's matchup index (inherent, disclosed).
- A flaky test (`bot.vhp-read-failure.test.ts`).

## Future plans
Repo Lens audit → fixes and fix-check → update the branch from `main` → announce in Picks and the vault → sponsor row → `games.json` live. Then help move the Race and Block X onto the VHP standard. Block Golf will read the Bracket's weekly file (not the board, which is capped at 1,000 rows, `MAX_BOARD_ROWS` ✅).

## Audit 3 Nov — Repo Lens #E-3: fix first
- **Commit audited:** `5b2492e` (branch tip). The full report and the failing tests are private, in the Claude project (`claude/bracket/AUDIT-2026-11-03-E3.md`, `claude/bracket/repolens-e3-tests/`).
- **Found:** 2 Critical, 6 High, 10 Medium, plus Low/Info.
  - **Critical:** C-1 vault values past 255 places; C-2 the page can show a different bracket than it signs.
  - **High:** H-1 the page rejects the recorder's v4 week files, so nobody can play yet; H-2 points aren't recomputed by the publish job; H-3 no clock checks on new history; H-4 and H-5 matchup manipulation (the Pool; one-block forfeits); H-6 same-block ties.
- **Sound:** the one-number pick (3.36 M numbers, 0 failures), the effective-VHP rebuild, the vault-file rules, the publish job running no repo code, honest runs never held.
- **Owner decisions:**
  - D-086: the Pool stays in the field, protected; forfeits on a day-long average;
  - D-087: same-block ties share the place;
  - D-088: launch when the fix-check passes, no 9 Nov target.
- **Work list:** `platform/CHAT_REQUESTS.md` → Producer Bracket (R-BR-1 – R-BR-6).
