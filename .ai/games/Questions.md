# Daily Questions (game 1)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Questions, Swap Desk, Vault, Hub chats), `DECISIONS.md` (D-045, D-047, D-062, D-069), the repo. **Last updated:** 2026-11-03; cleaned 2026-11-04; previous version `../archive/2026-11-04b/games/Questions.md`.
> **Legend:** ✅ verified in the repo or on chain · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
The original Knode game: five daily questions about what the Koinos chain will do, scored on a weekly leaderboard. It is built into the vault contract as game 1, so it was live before the other games and stays the anchor of the platform.

## Gameplay
- **Five questions a day, Monday to Saturday, released at 12:00 UTC on the dot** (D-047); at most 30 a week. Sunday is results day. 💬
- Question types: producer quartiles, group block counts, transactions in a window, largest gap, average interval (templates M1, M4, M5, M7, M10; model v5; `hashRule` 2). 💬
- Answers close at 00:00 UTC. Answer-only transactions are sponsored for any wallet within the free sub-cap, so guests can play without Mana. 💬
- Stake buttons stay on `index.html`; `withdraw_from` doesn't apply to game 1. 💬
- The site re-reads questions every minute and shows "Today's questions are on their way" from 12:00 UTC until they appear ("running late" after 2 hours). 💬

## Scoring
- Each correct answer scores points on the week's board; a player needs at least 1 point to place. Exact per-question points: ❓ (not in the chat exports).
- **Timing:** a week ends Mon 00:00 UTC, closes Mon 12:00, settles 24 h, and is final **Tue 12:00 UTC**; the hourly bot pays at about 12:07 (I-066, C-08). Corrections are allowed until Mon 12:00. ✅ chain

## Rewards
- 5% platform fee first. 💬
- **Staked players:** the rest splits 40% to basket A (place weight × stake, capped at 10 VHP per wallet) and 60% to basket B (place weight × full stake). Winners are the top 30% of staked players with at least 1 point; minimum stake 1 VHP (D-045). 💬
- **Free players:** week of 2–9 Nov (the game's "Week 3") pays the v5 rule fixed on chain — up to 1 + 1 VHP, accepted by the owner (D-069). From Mon 9 Nov the vault rule applies: **2 VHP 1st, 1 VHP 2nd** (D-062). A free player never staked that week, had at least 2 answers counted, and scored ≥ 1 point. Free prizes come out of the week's pot, not new money. ✅ / 💬

## Dependencies
- The game / Vault v6 contract `1Mpmf2…` (game 1 built in) ✅; on-chain `reward_rule_week_plus_one = 3`, `v6_rule_week_plus_one = 4` ✅.
- The bot (`bot.yml`, hourly at :07 plus a release run at 11:48 UTC) and its wallet `1HsM33…`, which pays its own Mana (D-046). ✅
- The owner's PC: the "Knode question release" task and `release-kick.mjs` as a backup starter. 💬
- The Mana sponsor (answers row) and the read RPC (Armana). ✅

## Current status (4 Nov)
- **Live** on Vault v6 since 2 Nov. Week 2 finalized and paid 3 Nov. First v5-rule payout Tue 10 Nov ~12:07 UTC. ✅ / 💬
- Guest **answers** work; guest picks in other games are blocked (I-083).
- **Doubled Questions decided (D-092):** 10 a day Mon–Sat (rounds at 12:00 and 00:00 UTC), after the first paid weeks; needs a vault upgrade (cap 30 → 60 a week).
- Work list: `../platform/CHAT_REQUESTS.md` → Daily Questions (R-Q-1); the vault part is R-VAULT-6.

## Known issues
- **I-044:** the contract still pays Mana for other people's transactions (`max_sponsor_rc` = 2 KOIN ✅); ~317 KOIN went uncompounded by 28 Oct. Fix postponed by the owner.
- **I-049:** daily compounding drifts ~1 hour later each day (a 28,800-block "day").
- **I-046:** the bot wallet's KOIN/Mana hasn't been confirmed (target 50 KOIN).
- **I-048:** `npm run bot -- status` "last produced" reads a cached file.
- **I-004:** the "+ Add another account" Kondor fix needs a real-extension retest.
- **I-082:** the guest wallet shows "Free answers are used up" for any sponsor refusal, so players can see the wrong reason (R-HUB-4).

## Future plans
- Players will see the week of 9 Nov as "Week 1" (D-063, I-069).
- Doubled Questions (D-092): 60 a week, after the first paid weeks.
- Optional: compound at a fixed time each day.
- Block Golf will use this game as a hole, read straight from the contract on two nodes (D-056).
