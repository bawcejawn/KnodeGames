# Combo Card (game 8)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Combo Card, Block X and Picks chats), `DECISIONS.md` (D-038, D-060), the repo (branch `combo`). **Last updated:** 2026-11-02.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A staked "parlay" game: combine several predictions from the Producer Race and Block X into one card. Every leg must hit, so longer cards are riskier but worth far more. It is the most advanced game and needs its own upgrade of the Picks contract (the CARD type).

## Gameplay
- **Legs:** Win, Show and Top half on 6-hour Producer Race races, plus Block X legs. Up to 3 legs per race (one of each kind); one leg per producer per card, Block X included. 💬
- **Cards:** 3 a day (a card's round is its slot: UTC day × 3 + slot); each can be changed up to 3 times, only on its own day. The game runs at **6 legs** (the contract allows 10). 💬
- **Locks:** race legs lock 25 minutes before the race and open 24 h ahead; Block X legs lock 500 blocks before the target and open 28,800 blocks ahead. The chain refuses a card unless every leg is open, and refuses changes once any stored leg has locked. 💬
- The page blocks sending for guests, unstaked wallets, stale data and the last 2 minutes of a UTC day. 💬

## Scoring
- **Worth per leg:** clamp(0.5 ÷ chance, 0.25, 3); Block X keeps ×3 as its cap. Race chances come from a seeded simulation (16,000 trials); a Block X chance is the producer's VHP share. 💬
- **Points by number of legs:** 2→3, 3→7, 4→15, 5→30, 6→60 (up to 10→960); no point cap. 💬
- **Results:** a race leg is unresolved if the race was missed, voided or not checked on two nodes; a Block X leg is decided by the target's signer once checked on both nodes. Unresolved legs never let a card score — a miss decides, otherwise void. No usable price card in the 3 h before sending → the card is void. The 10% rule (RL-16) and void-on-missing-horse (RL-15) stand. 💬
- **A week** = a player's best 10 cards; ties: more hits, the earlier last hit, address. Vault points by board rank. 💬

## Rewards
- **Staked only for now** — no free prize (D-060, D-071); a free option may be added later. 👤 A player needs at least 1 full point in the week. Share of Combo's part of the vault's weekly reward. 💬

## Dependencies
- **Picks v2** (CARD type, release `92d555d0…`, 37,689 bytes): schedule → 48 h → upload within 7 days → clear, after Block X launches (D-060). 💬
- The Picks `pick` sponsor row rises from 0.2 to **0.25 Mana** at Combo launch (D-038); sponsor v3 takes 640 argument bytes. 💬
- Race data with `samples` from the VHP sampler — until it runs, every card is void (FC-12, I-059). 💬
- Block X results; `combo.yml` (record, **verify**, publish) hourly at :52; `"cards": true` in `picks-data/deployment.json` and `COMBO_ENABLED=true`. 💬
- Vault v6 stake reads; results `games-data:combo/vault/W<week>.json` ✅ `vaultGames`.

## Current status (2 Nov)
Branch `combo` @ `c8c652e` ✅ — pushed, **not merged, nothing deployed**. Tests: 747 pass, contract 71. Testnet contract `1PQZWWHb…` (game 98); measured sponsored card costs 0.1313 (6 legs) and 0.1457 (10 legs) Mana. Repo Lens fix-check 4 pending. Last in the launch line, after Block X.

## Known issues
- **I-063:** live run time (record + verify) unmeasured; nothing writes v2's `wasmSha256` automatically (runbook step 5); the verify job's design is unreviewed; a local `picks` merge (`b301bfa`) may not be pushed; `bot/picks.ts` changed on `combo` (Block X told).
- **I-059:** void cards until the sampler runs.
- Accepted: FC3-9 (a lagging check node stops recording), FC2-19 (clock edges can hold a file one run).

## Future plans
Fix-check 4 → re-merge `picks` → merge `combo` → Picks v2 upgrade (after Block X) → raise the pick row to 0.25 and check with `mana-report` → testnet upgrade rehearsal → announce game 8 (48 h) → `COMBO_ENABLED=true`. Block Golf adds a Combo hole once it launches.

## Update 3 Nov — Free play (D-081)
Every game now has a **Free play board**. This game gets one for **standings only — no free VHP prize** until the owner switches it on. The page must say so.
Today Combo's page lets only staked wallets send cards (I-074); it must accept free players for the board to fill.
