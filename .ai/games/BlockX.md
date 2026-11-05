# Who Signs Block X (game 2)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Block X and Picks, Race, Bracket, Combo, Vault chats), `DECISIONS.md` (D-036 – D-041, D-062, D-064, D-067), the owner's status checks, the repo. **Last updated:** 2026-11-03; cleaned 2026-11-04; previous version `../archive/2026-11-04b/games/BlockX.md`.
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
- Exact points per correct pick: ❓ (not in the chat exports — see `docs/blockx/MAINNET-LAUNCH.md` on `main`).
- The recorder (`bot/games/blockx.ts`) voids a target at once only if both nodes report a non-canonical transfer; otherwise it holds and voids at the 3-day edge. Published cards never change (BX-44). 💬

## Rewards
- **Launched prize-free** on 3 Nov (D-036). Prizes start with the week of Mon 9 Nov (D-077), once game 2 is applied in the vault; the "before prizes" fixes (I-042, PR #80) must be merged before that week starts.
- Then: staked share of the bucket, and the free prize **2 VHP 1st, 1 VHP 2nd** (D-062); Free play board live, free-prize switch ON (D-081, D-082). 💬 / 👤

## Dependencies
- **Picks contract** `1LmgqB…` (code `700c296a…`) ✅ — **game 2 applied 2 Nov** 👤.
- Race handicap cards (`race-data`) and the VHP sampler (`race-samples.yml`, running since 3 Nov 15:58 UTC; GitHub runs it about hourly, so each run takes up to 12 samples, ~48 per 6-h card, PR #67; `MIN_SAMPLES` stays 12). ✅
- `games.yml` (on: `GAMES_ENABLED=true`) and its publish checks. ✅
- The Mana sponsor's Picks row (0.2 Mana). ✅ Guest picks go through the sponsor's `would_pay` check, which traps for picks since the vault switch (I-083).
- `PINNED_PICKS = 1LmgqB…` and the Hub status bar are on `main` (launch PR #57, 3 Nov). ✅
- Vault v6 `game-add 2` for staking. ✅ registry entry exists

## Current status (4 Nov)
- **Live for players** ✅ since 3 Nov: Games page (PR #58), menus and home page (PR #59), Leaders tab (PR #63), nicknames (PR #60, D-078); `GAMES_ENABLED = true`. Every target was void on 3 Nov ("no handicap card", 24/24) until the sampler change (PR #67). ✅
- **Vault:** `game-add 2 "Who Signs Block X" --staked --free` announced 3 Nov (tx `0x122082c6…e71760e3`), applicable from Thu 5 Nov 15:51 UTC. After the apply: repo variable `PRIZES_FROM_WEEK = 3` (Settings → Secrets and variables → Actions → Variables). 👤
- **Pays from vault week 3** (Mon 9 – Mon 16 Nov); the bot posts and seals within 3 days (the Block X chat expects the first seal ~Tue 17 Nov), then the owner has 24 h to correct (D-077).
- **PR #80 (before prizes, I-042)**: Repo Lens round 14 No-Go → E4-1, E4-2, E4-3, E4-7 fixed (`baeb2c6`) → **fix-check GO** (4 Nov). Built: week-end re-read on both nodes (BX-88, BX-97, BX-98, G-K-1), race card clock (BX-118), void alert (BX-72), RV-2; BX-105 (board freeze, display only) is accepted, not built. **Repo Lens round 14: No-Go until E4-1** (a failed race-data fetch can void targets for good); merge before Mon 9 Nov 00:00 UTC.
  - *Re-read:* before a final week's prize list is frozen (and its vault file written), every target is read again from both nodes and compared whole: signer and times, picks, Staked flags, the cards in force, and every pick's points recomputed; any difference holds the week (no prize list, no vault file, an alert) and it is tried again next run. Not re-scanned: the VHP moved into a signer (BX-53, read on both nodes when recorded). Since round 14 it also re-checks each void's reason, and a run stops if the race-data fetch fails.
  - *Board freeze (BX-105), not built:* once a week's prize list is published no new round of that week is accepted and published targets never change, so the board can't change either; the vault reads its own write-once file, and the vault bot holds a week whose board and file disagree.
  - *A held week* can't be released without a code change (round-14 fix-check L-2, Low); the run fails and emails each hour while it's held (L-5).
- **Guest picks blocked** (I-083). Work list: `../platform/CHAT_REQUESTS.md` → Block X (R-BX-0 – R-BX-11).

**Check in the correction window** (game-correct / game-unprize / game-void): non-standard-transfer voids (BX-72), every void and its reason (round 14 E4-6), moved VHP on an explorer (E4-5), the free-prize winners for many-wallet farming (BXS-1), close finishes where a ~1% card shift could swap places (BX-115), and void rows near the week edge (BX-120). SP-59 and BX-116 can't mispay.

## Known issues
- **I-042:** the before-prizes list, in PR #80 (above).
- **I-083:** sponsor `would_pay` traps for picks; guests can't pick.
- **I-037 / I-038:** B1-4 vault-file edge cases; B1-6 stale header; B1-7 `\d` in `bot.yml`; B1-8 test-clock names.
- **I-054:** Python check without `-I`, `|| true` on listings (S3-21, S3-22).
- **I-031:** shared Race files came into `main` with PR #57 (Race chat to confirm, R-RACE-8).
- **Flaky test:** `bot.vhp-read-failure.test.ts` fails now and then in the full parallel run, passes alone.

## Future plans
- Per-action Mana limits a day after launch (step 10).
- Move to the one VHP ruler (D-058, D-090, D-093; R-BX-7).
- Block Golf practice scorecards ship with Block X (D-056).
- The Picks v2 (CARD) upgrade for Combo comes after Block X launches.
