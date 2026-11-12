# Producer Bracket (game 9)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Producer Bracket chat), `DECISIONS.md` (D-019, D-057, D-058, D-062), the repo (branch `kg-09-bracket`). **Last updated:** 5 Nov 2026; previous version `../archive/2026-11-04b/games/ProducerBracket.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

> **Owner, 5 Nov (D-138):** reactivated as one of the next three games (D-142): "like the March madness with nodes head to head". **Shape (D-141, D-153; built on `kg-09-bracket` @ `ef146b2a`, PR #186):** up to **32** producers (5 rounds Tue–Sat; 16: Wed–Sat; 8: Thu–Sat; no byes), one round a day (a 24-hour sprint per matchup); seeding Sun 00:00 UTC, picks lock Mon 23:55; final Saturday; results final from Monday 00:00 after two agreeing runs; backstop Thu 00:00. Every Repo Lens #E-3 Critical / High / Medium fixed; fix-check next. Matchups use today's index until the ruler v2.1 percentile is ready (D-154; owner to confirm launching before it).

## Purpose
A weekly knockout tournament of Koinos block producers, like a March Madness bracket: predict who wins each head-to-head matchup, one round a day. This chat also built the platform-wide **VHP standard** every game uses to measure VHP the same way (D-058).

## Gameplay
- **Weekly cycle (as built):** seeding Saturday 12:00 UTC; picks lock Sunday 23:55 UTC (~36 h to pick); one round per UTC day from Monday. 💬 This schedule needs a new shape for the shared rhythm (D-125) before launch.
- **Size:** under 8 producers → no bracket; 8–11 → 8 (Mon–Wed); 12–15 → 16 with byes; 16–31 → top 16 (Mon–Thu); 32+ → 32 (Mon–Fri). 💬
- **Seeding:** average VHP over 28,800 blocks on two agreeing nodes; biggest = seed 1; not seeded within 24 h → the week is void. 💬
- **A pick is one number:** bit n = "the lower seed wins matchup n" (bye bits 0). Picks game: NUMBER kind, weekly rounds, ahead ≤ 36 h, 20 picks a day, 20 changes. 💬
- **Matchups:** baseline + credit; index = blocks credited ÷ blocks expected; an exact tie goes to the lower seed. **Forfeit:** a seed whose baseline is under 0.5 × its seeding VHP loses; if both forfeit, the index decides. No producer is left out unless below minimum production; Knode's own nodes play. The vault never forfeits (its VHP is players' stakes, recorded as `pooled`). 💬
- **To build (owner decisions 3 Nov, R-BR-2):** the Knode Games Pool stays in the field, protected: pooled producers are judged on the day's average or minimum effective VHP, not one block (D-086); forfeits are judged on the day's time-weighted average (H-5); same-block ties share the place, and the comment and page text are fixed (D-087, H-6). 👤

## Scoring
- **Points:** 1 / 2 / 4 / 8 / 16 by round, +2 for the champion (max 14 / 34 / 82 for 8 / 16 / 32). Byes score nothing. 💬
- **Tie-break:** points → a right champion → more right winners → who submitted first (last-change time); brackets in the same block share. 💬
- **Vault rows:** dense-ranked onto 1–255; past 255 distinct places the best 254 stay exact and the rest share 1. 💬
- **Timing:** `../standards/WEEK_CYCLE.md` (the one home for game timing; built as "final 12 h after the last round"). Final only once the close stake read is in; still unreadable 3 days after the week → final as `vault: "missed"`, no file. 💬

## Rewards
- **Staked:** at least the vault minimum (1 VHP) staked in game 9; staked at the week's start stays staked that week. 💬
- **Free play: no VHP prize for now.** The free-prize switch for game 9 is **OFF** (owner 11 Nov; `prize-settings` has it off from vault week 4). If it is switched on (`npm run prizes -- on 9 --send`, from the next vault week), the rule below applies: **2 VHP for 1st, 1 VHP for 2nd** (D-019, D-062). Tied for 1st share all 3 VHP; a single 1st → tied 2nd share 1 VHP; at most 10 per place (more than 10 tied → that place and below stay empty). Minimum play: one bracket with ≥ 1 point. Guests eligible. 1-week seasons. 💬 **⚠ This is today's code, not the rule: D-159 pays exactly 10 by earlier score time, then address, never zero for the cap (I-103, fixed in code separately).**

## Dependencies
- **Picks contract:** announce game 9 (48 h). **Vault:** `game-add 9 "Producer Bracket" --staked --free --season 1` (48 h; `--free` keeps a free prize possible), free-prize switch **OFF** (owner 11 Nov; was ON under D-082); results `games-data:bracket/vault/W<week>.json` ✅ `vaultGames`.
- A **sponsor allowlist row** for game 9 picks. 💬
- The VHP standard (`vhp-standard.js`, `bot/vhp-chain.ts`) and the VHP contract's `effective_balance_of`. 💬
- Recorder `bot/games/bracket.ts` in `games.yml`; data branch `bracket-history` (keep) ✅.

## Current status (5 Nov)
- **▶ Reactivated 5 Nov (D-142): one of the next three games to launch. Its chat starts with `../platform/CHAT_REQUESTS.md` → R-ALL-9 (the catch-up on the 4–5 Nov standards), then its own section.**
- **Branch `kg-09-bracket` @ `3b46546f`, draft PR #186 (6 Nov):** Repo Lens fix-check 2 (at `8d3d942f`) was NO-GO; every finding fixed (PK-1 High, PK-2, R-1, F9-1, S-1, W-1, FL-1, P-2, I-1, T-1). Full `npm run test:audit` 1,135 pass, 0 fail; 6 of 6 mutations caught; the reviewer's 14 tests added (`tests/audit/repolens-e3fc2-*`). **Not merged, nothing deployed.** Next: fix-check 3 (`claude/bracket/REPOLENS-E3-FIXCHECK3-PROMPT.md`), then the port onto the kit before launch (D-158, D-160, R-ALL-11).
  - **Picks follow the two-run rule** (`picks.re`), like hours; stakes, final and the vault file need it. Picks still unconfirmed at the backstop → void.
  - **Late picks:** never after round 1's first hour, even under `BRACKET_RELEASE`.
  - **`BRACKET_RELEASE`:** set it only to correct a week; a week named in it can't go final, so the owner clears it after the correction. Picks can be corrected only until round 1's first hour, a seeding only within its 24 h.
  - **Per-week hold:** a bad Bracket week file is held on its own (with its vault file and board), not the whole game; the publish job downloads the Bracket artifact to its own folder.
  - **Page:** the KOIN Vault open-request lock is kept per account and week until KOIN Vault's expiry (else 30 min), and on a lost network answer. Shared `wallet.js` gained `openUntil` on three KOIN Vault errors (no behaviour change; Hub chat told).
  - Picks announce: `ahead` 46 h (RC-6). Waiting on other chats: Vault F8; Block X the sponsor row for game 9; Ruler v2.1 pct.
- **Repo Lens #E-3 (3 Nov), audited tip `5b2492e`:** 2 Critical, 6 High, 10 Medium, plus Low/Info — fixed on the branch, fix-check pending. Report and failing tests are private, in the Claude project (`claude/bracket/AUDIT-2026-11-03-E3.md`, `claude/bracket/repolens-e3-tests/`). No launch date (D-088).
- Evidence before the audit: the VHP rebuild matched all 780 race-card readings; over 100 days the better seed won 54% of 113 matchups, and a "last week's form" bracket averaged 14.8 points vs 4.8 for random. The sampling branches are already deleted ✅.
- Work list: `../platform/CHAT_REQUESTS.md` → Producer Bracket.

## Known issues (I-061)
- **Repo Lens #E-3 findings (fix first):**
  - **Critical:** C-1 vault values past 255 places; C-2 the page can show a different bracket than it signs.
  - **High:** H-1 the page rejects the recorder's v4 week files, so nobody can play yet; H-2 points aren't recomputed by the publish job; H-3 no clock checks on new history; H-4 and H-5 matchup manipulation (the Pool; one-block forfeits); H-6 same-block ties.
  - **Sound:** the one-number pick (3.36 M numbers, 0 failures), the effective-VHP rebuild, the vault-file rules, the publish job running no repo code, honest runs never held.
  - Fix order and decisions: R-BR-1, R-BR-2 (D-086, D-087).
- `effective_balance_of` has never been seen live — pin the block it uses after the first real run (R-BR-6).
- F-2 (accepted): hiding VHP on seeding day lowers a producer's forfeit bar.
- F-10: final weeks are re-scored on every load, so rule changes must apply only from a stated week; stake reads aren't pinned to a block.
- A whale withdrawing mid-day can sink the vault's matchup index (inherent, disclosed).
- A flaky test (`bot.vhp-read-failure.test.ts`).

## Future plans
Launch path: `../platform/ROADMAP.md` (fixes and fix-check → update the branch from `main` → announce in Picks and the vault → sponsor row → `games.json` live). Then help move the Race and Block X onto the one VHP ruler (D-090; the VHP standard is this chat's work, D-058). Block Golf will read the Bracket's weekly file (not the board, which is capped at 1,000 rows, `MAX_BOARD_ROWS` ✅).
