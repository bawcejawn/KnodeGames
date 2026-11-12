# Combo Card (game 8)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Combo Card, Block X and Picks chats), `DECISIONS.md` (D-038, D-060), the repo (branch `combo`). **Last updated:** 12 Nov 2026 (Combo chat, with the PR); previous version `../archive/2026-11-04b/games/ComboCard.md`. Full picture: `../../docs/combo/REPO-LENS-COMBO.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A staked "parlay" game: combine several predictions from the Producer Race and Block X into one card. Every leg must hit, so longer cards are riskier but worth far more. It is the most advanced game and needs its own upgrade of the Picks contract (the CARD type).

## Gameplay
- **Legs:** Win, Show and Top half on 6-hour Producer Race races, plus Block X legs. Up to 3 legs per race (one of each kind); one leg per producer per card, Block X included. 💬
- **Cards:** 3 a day (a card's round is its slot: UTC day × 3 + slot); each can be changed up to 3 times, only on its own day. The game runs at **6 legs** (the contract allows 10). 💬
- **Locks:** race legs lock 25 minutes before the race and open 24 h ahead; Block X legs lock 500 blocks before the target and open 28,800 blocks ahead. The chain refuses a card unless every leg is open, and refuses changes once any stored leg has locked. 💬
- Anyone can send a card, guests included (D-081); the stake decides the board. The page blocks sending on stale data and in the last 2 minutes of a UTC day. 💬

## Scoring
- **Worth per leg:** clamp(0.5 ÷ chance, 0.25, 3); Block X keeps ×3 as its cap. Race chances come from a seeded simulation (16,000 trials); a Block X chance is the producer's VHP share. 💬
- **Points by number of legs:** 2→3, 3→7, 4→15, 5→30, 6→60 (up to 10→960); no point cap. 💬
- **Results (handicap weeks, before the ruler):** a race leg is unresolved if the race was missed, voided or not checked on two nodes; a Block X leg is decided by the target's signer once checked on both nodes. Unresolved legs never let a card score — a miss decides, otherwise void. No usable price card in the 3 h before sending → the card is void. The 10% rule (RL-16) and void-on-missing-horse (RL-15) stand. 💬
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
- Repo Lens #G-16 (fix-check 4 @ `ba2d9b30`): fix first; FC4-1..4 and its Info items fixed, `main` merged, the ruler switch built, the capacity standard's checks added. The delta round is next; then one PR. **Not merged, nothing deployed.**
- Picks calendar (Block X chat, 12 Nov): owner handover proposed Mon 23 Nov, accepted Wed 25 Nov; Combo's v2 `upgrade-schedule` Wed 25 – Thu 26 Nov; upload from 48 h later; announce game 8 after v2; **realistic launch Mon 7 Dec (vault week 7)**. `upgrade-schedule` refuses while a handover is planned or proposed.
- Testnet contract `1PQZWWHb…` (game 98); sponsored card costs were measured on testnet only — re-measure on mainnet before setting the row.
- Work list: `../platform/CHAT_REQUESTS.md` → Combo Card.

## Size budget (the capacity standard, 12 Nov; measured on the recorder's own output)
| File | Fixed part | Per item | Reaches 1.2 MB (warning) / 2 MB (cap) |
|---|---|---|---|
| `D<day>[-<k>].json` (a day part) | about 0.2 KB | 306 B (2 legs) to 532 B (6 legs) a card; at most 1,000 cards a part | never: a part holds at most about 0.53 MB; more cards make more parts (3 cards × players a day ÷ 1,000) |
| `board.json` | about 0.3 KB | 181 B a row: Today and This week top 2,000 each, all-time top 1,000, last week every player with a point (to 6,000) | about 1,900 scoring players last week (warning; the 5,000 display rows take about 0.9 MB) / 6,000 (the recorder stops: an error and no Vault file, before the 2 MB cap) |
| `vault/W<week>.json` | about 60 B | about 60 B a staked row | about 20,000 staked scorers (warning); board.json's 6,000 comes first |
| `index.json` | small | 6 B a day | never |
Every file the recorder writes is checked: past 60% a warning in every run, past 2 MB an error. **Debt:** past about 6,000 scoring players a week, `board.json`'s last-week rows need their own split files (capacity rule 4). That touches the Vault path, so it gets its own Repo Lens round; it isn't needed at launch size.

## Known issues
- **I-063:** live run time (record + verify) unmeasured (FC-11); nothing writes v2's `wasmSha256` automatically (runbook step 5, FC2-13); Golf's and Combo's publish jobs can push to `games-data` at the same time (the second push fails and retries next run; FC2-14: a shared concurrency group is a platform change). `bot/picks.ts` is shared with Block X (they were told).
- The verify job alerts (a failed run) when nothing has been published for over 3 hours, and in the last 12 hours of a Vault file's window.
- Accepted: FC3-9 (a lagging check node stops recording), FC2-19 (clock edges can hold a file one run).

## Future plans
Launch path: `../platform/ROADMAP.md` (fix-check 4 → re-merge `main` → merge `combo` → Picks v2 upgrade → set the card row per `../platform/SPONSOR.md` and check with `mana-report` → testnet upgrade rehearsal → announce game 8 (48 h) → set `COMBO_RULER_FROM_WEEK` to the first week (`node tools/vhp-ruler-switch.mjs <N>` first) → `COMBO_ENABLED=true`). Block Golf adds a Combo hole once it launches. Race legs are on the one VHP ruler from Combo's first week (D-new A).
