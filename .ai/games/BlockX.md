# Who Signs Block X (game 2)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Block X and Picks, Race, Bracket, Combo, Vault chats), `DECISIONS.md` (D-036 – D-041, D-062, D-064, D-067), the owner's status checks, the repo. **Last updated:** 2026-11-03.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
Guess which block producer will sign a future target block. Simple to play, rooted in how Koinos production really works, and the first game on the shared Picks contract — the foundation the later games (Survivor, Last Node, Bracket, Fantasy, Combo) build on.

## Gameplay
- Targets every **2,400 blocks** (about 2 hours): height = round × 2,400 + 0. Picks open up to 28,900 blocks ahead and lock 100 blocks before the target ✅ (`blockx-math.js` `MAINNET_GAME`).
- Up to **30 picks a day**, with **one change per pick** (D-037) ✅ — "change it once" on the page.
- A target with no usable handicap card is voided; expect ~6 hours of voided targets right after launch while samples fill. 💬
- Sponsored: a pick costs ~0.116 Mana against a 0.2 Mana sponsor row (D-038). 💬

## Scoring
- A producer's chance is its VHP share; the handicap rewards picking smaller producers. Under the VHP standard the multiplier becomes min(3, topAvg ÷ your cardVhp) (D-058). 💬
- Exact points per correct pick: ❓ (not in the chat exports — see `docs/blockx/MAINNET-LAUNCH.md` on `picks`).
- The recorder (`bot/games/blockx.ts`) voids a target at once only if both nodes report a non-canonical transfer; otherwise it holds and voids at the 3-day edge. Published cards never change (BX-44). 💬

## Rewards
- **Launched prize-free** on 3 Nov (D-036). Prizes start with the week of Mon 9 Nov (D-077), once game 2 is applied in the vault. The "before prizes" list (I-042) must be checked before that first paid week closes (Mon 16 Nov). ~~Prizes start only after the I-042 fixes~~ (superseded by D-077).
- Then: staked share of the bucket, and the free prize **2 VHP 1st, 1 VHP 2nd** (D-062). 💬 / 👤

## Dependencies
- **Picks contract** `1LmgqB…` (code `700c296a…`) ✅ — **game 2 applied 2 Nov** 👤.
- Race handicap cards (`race-data`) and the VHP sampler (`race-samples.yml`, on `main` since 3 Nov; running since 15:58 UTC; GitHub may run it only about hourly — cadence to decide, I-059). ✅
- `games.yml` (off until `GAMES_ENABLED=true`) and its publish checks. ✅
- The Mana sponsor's Picks row (0.2 Mana). ✅
- The launch PR `picks` → `main` — **merged 3 Nov** (PR #57): `PINNED_PICKS = 1LmgqB…` and the Hub status bar are on `main`. ✅
- Vault v6 `game-add 2` for staking. ✅ registry entry exists

## Current status (3 Nov)
- **Live for players** ✅: Games page (PR #58), menus and home page (PR #59); `GAMES_ENABLED = true`. The recorder's first run (16:12 UTC, by hand) was green in both jobs; its first week files hold 19 past targets, all void ("no handicap card") — expected until cards and samples fill. ✅
- **Vault:** `game-add 2 "Who Signs Block X" --staked --free` announced 3 Nov (tx `0x122082c6…e71760e3`), applicable from Thu 5 Nov 15:51 UTC. After the apply: repo variable `PRIZES_FROM_WEEK = 3` (Settings → Secrets and variables → Actions → Variables). 👤
- **Pays from vault week 3** (Mon 9 – Mon 16 Nov), the week closes Mon 16 Nov; the bot posts and seals the results within 3 days, then the owner has 24 h to correct (D-077). The I-042 items are ranked by what could mispay in that week; see "Before the first paid week" below.
- **Nicknames (D-078, I-073):** `blockx.html` loads `names.js`; every producer and player shows as `KNames.of` (name · short address, wrapped, never cut off). **Merged (PR #60)** ✅
## Before the first paid week (I-042, D-077)
Fixes planned before the week-3 seal (each with a test and a Repo Lens fix-check):
1. **Week-end re-read** (BX-88, BX-97, BX-98, G-K-1): before a week's prize file is first written, every target of the week is re-read from both nodes and compared whole (signer, time, picks, points, void, card); any difference holds the prize file.
2. **Race card clock** (BX-118): the race publish job refuses a new card dated in the future.
3. **Board freeze** (BX-105): once a week's prize file exists, that week's board can't change.
4. **Void alert** (BX-72): every target voided for a non-standard VHP transfer is listed in the run's warnings, so they can be checked in the 24-hour correction window.

Check in the correction window (game-correct / game-unprize / game-void): non-standard-transfer voids (BX-72), the free-prize winners for many-wallet farming (BXS-1), close finishes where a ~1% card shift could swap places (BX-115), and void rows near the week edge (BX-120). SP-59 and BX-116 can't mispay.

## Known issues
- **I-042:** see above.
- **I-037 / I-038:** B1-4 vault-file edge cases; B1-6 stale header; B1-7 `\d` in `bot.yml`; B1-8 test-clock names.
- **I-054:** Python check without `-I`, `|| true` on listings (S3-21, S3-22).
- **I-062 (mobile-nav):** passes on `main` since the launch merge ✅ (`site.mobile-nav.test.mjs`).
- **I-031:** shares Race files; merged by hand.
- **Flaky test:** `bot.vhp-read-failure.test.ts` fails now and then in the full parallel run, passes alone.

## Future plans
- ~~Launch PR~~ (merged, PR #57) and per-action Mana limits a day after launch (step 10).
- A Free play board is live; the free prize is ON (D-081, D-082).
- Move to the VHP standard (D-058).
- Block Golf practice scorecards ship with Block X (D-056).
- The Picks v2 (CARD) upgrade for Combo comes after Block X launches.
