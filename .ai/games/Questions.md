# Daily Questions (game 1)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Questions, Swap Desk, Vault, Hub chats), `DECISIONS.md` (D-045, D-047, D-062, D-069, D-092, D-099, D-114, D-116, D-121, D-127), the repo. **Last updated:** 5 Nov 2026 (library sync after #152 merged; Questions chat 4 Nov: two rounds, cap-driven 4 + 4, shared rules page side); previous version `../archive/2026-11-04b/games/Questions.md`.
> **Legend:** ✅ verified in the repo or on chain · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
The original Knode game: daily questions about what the Koinos chain will do, scored on a weekly leaderboard. It is built into the vault contract as game 1, so it was live before the other games and stays the anchor of the platform. From the rule week (Mon 16 Nov) it plays by the same rules as every other game (D-116).

## Gameplay
- **Until Sun 8 Nov:** five questions a day, Monday to Saturday, released at 12:00 UTC on the dot (D-047); 30 a week. Sunday is results day. ✅
- **From Mon 9 Nov (week 3): two rounds a day** (D-092, D-114): 2 questions at 00:00 UTC (answers close 12:00) and 3 at 12:00 UTC (answers close 00:00), 30 a week. Files `W###-D#-00.json` (00:00) and `W###-D#.json` (12:00). ✅ `bot/bot.ts` SCHEDULE, PRs #98 #119 #122 #125 #126
- **4 + 4 (48 a week)**, under the on-chain cap of 60 ("60 a week" elsewhere means the cap), comes in by itself for the first week whose on-chain cap is 60 (`get_state.questions_cap` / `questions_cap_next`, Vault v6.1); only 30 or 60 are believed. Producers may then be in up to 7 questions a week (`--max-uses`). ✅
- Release runs: GitHub at 11:48 and 23:48 UTC (they wait for the hour); the PC task "Knode question release" (`release-kick.mjs`) covers 11:45–14:05 and 23:45–02:05 UTC (re-installed 4 Nov). ✅
- Question types: producer quartiles, group block counts, transactions in a window, largest gap, average interval (templates M1, M4, M5, M7, M10; model v5; `hashRule` 2). 💬
- Answers close at 00:00 UTC. Answer-only transactions are sponsored for any wallet within the free sub-cap, so guests can play without Mana. 💬
- Staking is on the shared Stake page (`stake.html#g1`, D-116): the Questions page has no own Stake / Withdraw buttons (#152 merged 5 Nov; Stake page #142, #150, #157). ✅
- The site re-reads questions every minute and shows "Today's questions are on their way" from 12:00 UTC until they appear ("running late" after 2 hours). 💬

## Scoring
- Each correct answer scores points on the week's board; a player needs at least 1 point to place. Exact per-question points: ❓ (not in the chat exports).
- **Timing (old rules, up to the switch-over week):** a week ends Mon 00:00 UTC, closes Mon 12:00 (the bot closes it; since the v6.1 Mana fix no player action does), settles 24 h, and is final **Tue 12:00 UTC**; the hourly bot pays at about 12:07 (I-066, C-08). The bot settles every staked player of the switch-over week itself. ✅
- **Timing (shared rules, from the v6.1 rule week, D-116):** no settle step; the bot closes the week; the results file is due Thu 00:00 UTC, correctable 24 h after the seal, then final; claims on the Stake page (`claim_game`). Detected from `config.q60_rule_week_plus_one` (week + 1 ≥ it). 💬 Vault chat
- **How questions are shown (D-144, #171):** the page words each question plainly (one block in `app.js` between `// question-words:start` and `:end`, tested by `site.question-words.test.mjs` for every line); `q.text` on chain is unchanged and stays in the tooltip. If `generator.ts` wording changes, update `networkWords` and the Race view's matching too.
- **Where the week's timing lives:** `../standards/WEEK_CYCLE.md` (Daily Questions joins it at the rule week, Mon 16 Nov).

## Rewards
- 5% platform fee first. 💬
- **Staked, until the rule week:** the rest splits 40% to basket A (place weight × stake, capped at 10 VHP per wallet) and 60% to basket B (place weight × full stake). Winners are the top 30% of staked players with at least 1 point; minimum stake 1 VHP (D-045). 💬
- **Staked, from the rule week (Mon 16 Nov, D-116):** paid like every game: a results file (and `board.json`), no settle, `claim_game`; the shared vault rule replaces the 40 / 60 baskets. The week of Mon 9 is the switch-over week (R−1): old rules, and the bot settles every staked player itself (D-127). 💬
- **Free players:** week of 2–9 Nov (the game's "Week 3") pays the v5 rule fixed on chain — up to 1 + 1 VHP, accepted by the owner (D-069). From Mon 9 Nov the vault rule applies: **2 VHP 1st, 1 VHP 2nd** (D-062). A free player never staked that week, had at least 2 answers counted, and scored ≥ 1 point. **Ties (owner, 5 Nov):** up to 10 wallets per place share it; a tie for 1st leaves 2nd empty; more than 10 qualifying for one place → exactly 10 are paid, by the earlier score time (the lock time of the question that gave the last point), then address — never zero because of the cap. In practice many players get their last point on the same Saturday questions, so ties at the cap often fall through to address order (Repo Lens C11-5; said on the page). Applies from the rule week (the results recorder); weeks before it are paid by the contract's own rule. Free prizes come out of the week's pot, not new money. ✅ / 💬

## Dependencies
- The game / Vault v6 contract `1Mpmf2…` (game 1 built in) ✅; on-chain `reward_rule_week_plus_one = 3`, `v6_rule_week_plus_one = 4` ✅. **Vault v6.1** (PR #114, open) brings the 60-a-week cap, the shared rules and **the bot closing weeks, not players** (D-127).
- The bot (`bot.yml`, hourly at :07 plus release runs before each round) and its wallet `1HsM33…`, which pays its own Mana (D-046). ✅
- The owner's PC: the "Knode question release" task and `release-kick.mjs` as a backup starter. 💬
- The Mana sponsor (its answers row and the shared vault calls: `../platform/SPONSOR.md`) and the read RPC (Armana). ✅

## Current status (5 Nov)
- **Live and paying** on Vault v6 since 2 Nov. Week 2 finalized and paid 3 Nov. First v5-rule payout Tue 10 Nov ~12:07 UTC. ✅ / 💬
- **The results recorder (I-101) is built, waiting for Repo Lens:** `games/questions/` (`math.js`, `recorder.ts`, tests) and its steps in `games.yml`. From the rule week (Mon 16) the vault pays game 1 only from its file (`games-data:questions/vault/W<w>.json`, first file due Thu 26 Nov 00:00 UTC). Merge after #114 and by Sun 15 (R-Q-4). Daily Questions has no Sunday rounds: nothing scores on Sunday (D-129), only Saturday's last round resolves then. 💬
- **5 questions a day now; two rounds a day from Mon 9 Nov** (2 + 3, 30 a week): merged. The first two-round week is watched by R-Q-3. ✅
- **Vault v6.1 (PR #114, open; Repo Lens round 2 GO to announce):** announce Thu 5 Nov, upload Mon 9 Nov, rule week **Mon 16 Nov** — from then 60 a week and the shared vault rules (D-116). 👤
- **PR #152 ✅ merged 5 Nov** (the shared rules, page and bot side, including the settle pass for the switch-over week; Repo Lens #E-17 fixes). 1 is live.
- **Managed on the Stake page** (D-121): ✅ merged (#142, #150, #157).
- Guest answers work. ✅
- Work list: `../platform/CHAT_REQUESTS.md` → Daily Questions.

## Known issues
- **I-044 ✅ closed by D-099:** the vault no longer pays Mana for other people's transactions (`max_sponsor_rc` = 0).
- **I-049:** daily compounding drifts ~1 hour later each day (a 28,800-block "day").
- **I-046:** the bot wallet's KOIN/Mana. 10 Nov: 30 KOIN, Mana 28.7. At 5 questions a day the bot used 3.7 to 5.7 Mana a day (`bot-state` `manaByDay`, all its transactions); the wallet refills about its KOIN balance over 5 days (30 KOIN = about 6 a day). A 48-question week (4 + 4 a day, Mon to Sat) needs about 8 to 12 a day (estimate). The owner added 45 KOIN on 10 Nov: **75 KOIN in all** (confirmed on chain, Mana 74.3; 75.00 on 12 Nov), refilling about 15 a day. The KOIN is not spent. To confirm after the first 4+4 week (Mon 16 Nov) from `npm run bot -- status`. The alert for a low bot wallet is at 2 Mana (`bot/bot.ts` health pass).
- **I-048:** `npm run bot -- status` "last produced" reads a cached file.
- **I-004:** the "+ Add another account" Kondor fix needs a real-extension retest.
- **I-082:** the guest wallet shows "Free answers are used up" for any sponsor refusal, so players can see the wrong reason (R-HUB-4).

## Future plans
- Players will see the week of 9 Nov as "Week 1" (D-063, I-069).
- Optional: compound at a fixed time each day.
- Block Golf (reactivated, D-142; PR #187) will use this game as a hole, read straight from the contract on two nodes (D-056).
