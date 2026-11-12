# Combo Card (game 8)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Combo Card, Block X and Picks chats), `DECISIONS.md` (D-038, D-060), the repo (branch `combo`). **Last updated:** 5 Nov 2026; previous version `../archive/2026-11-04b/games/ComboCard.md`.
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
- **Staked:** staked players share Combo's part of the vault's weekly reward (D-060). A player needs at least 1 full point in the week (the vault check uses `minPts: 100` hundredths, R-CO-3). 👤 / 💬
- **Free play:** a Free play board for **standings only — no free VHP prize** until the owner switches it on (D-081, D-082; was staked-only, D-071). The page says so, and anyone can send a card (D-081; I-074 fixed on `combo`). More than 10 tied for a free place: exactly 10 are paid, by address (D-159 / I-103; Repo Lens FC4-3). 👤

## Dependencies
- **Picks v2** (CARD type, release `92d555d0…`, 37,689 bytes): schedule → 48 h → upload within 7 days → clear, after Block X launches (D-060). 💬
- A sponsor row for card picks, sized by measurement before launch (rows: `../platform/SPONSOR.md`; D-038's 0.2 → 0.25 plan is out of date); sponsor v3 takes 640 argument bytes. 💬
- Race data with `samples` from the VHP sampler: a card without samples is void (FC-12); the sampler runs since 3 Nov and takes up to 12 samples a run (PR #67). 💬
- Block X results; `combo.yml` (record, **verify**, publish) hourly at :52; `"cards": true` in `picks-data/deployment.json` and `COMBO_ENABLED=true`. 💬
- Vault v6 stake reads; results `games-data:combo/vault/W<week>.json` ✅ `vaultGames`.
- **The VHP ruler (D-new A; the Library, 12 Nov: on the ruler from Combo's first week).** `COMBO_RULER_FROM_WEEK` = N, read strictly by the record, verify and publish jobs: every race leg of a card whose UTC day is in an ON week is decided by the Race's own ruler card (`race-data` `R<week>.json`, by fpct; a voided producer = a loss, D-164; not in the race = a void leg, RL-16). Worths stay the handicap card's. Block X legs unchanged. Day files carry `ruled`, `board.json` carries `rulerFrom`; a change that would change a started week is refused. Needs the Race on the ruler (its R files) for every ON week. 💬
- Block X targets are looked up by block height: Block X publishes hourly targets since vault week 3 (FC4-2). 💬

## Current status (12 Nov)
- Repo Lens #G-16 (fix-check 4 @ `ba2d9b30`): fix first; FC4-1..4 fixed, `main` merged, the ruler switch built, on a local branch (not pushed). A delta round is next. Realistic launch Mon 7 Dec, after the Picks owner handover and the v2 upgrade (`upgrade-schedule` refuses while a handover is planned or proposed).
- Branch `combo` @ `ba2d9b30` on GitHub — **not merged, nothing deployed**.
- Testnet contract `1PQZWWHb…` (game 98); sponsored card costs were measured on testnet only — re-measure on mainnet before setting the row.
- Repo Lens fix-check 4 pending. Last in the launch line; the Picks v2 upgrade waits with the pause (D-060, D-113).
- Work list: `../platform/CHAT_REQUESTS.md` → Combo Card.

## Known issues
- **I-063:** live run time (record + verify) unmeasured; nothing writes v2's `wasmSha256` automatically (runbook step 5); the verify job's design is unreviewed; a local `picks` merge (`b301bfa`) may not be pushed; `bot/picks.ts` changed on `combo` (Block X told).
- Accepted: FC3-9 (a lagging check node stops recording), FC2-19 (clock edges can hold a file one run).

## Future plans
Launch path: `../platform/ROADMAP.md` (fix-check 4 → re-merge `main` → merge `combo` → Picks v2 upgrade → set the card row per `../platform/SPONSOR.md` and check with `mana-report` → testnet upgrade rehearsal → announce game 8 (48 h) → set `COMBO_RULER_FROM_WEEK` to the first week (`node tools/vhp-ruler-switch.mjs <N>` first) → `COMBO_ENABLED=true`). Block Golf adds a Combo hole once it launches. Race legs move to the one VHP ruler with the Race (D-090).
