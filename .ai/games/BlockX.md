# Who Signs Block X (game 2)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Block X and Picks, Race, Bracket, Combo, Vault chats), `DECISIONS.md` (D-036 – D-041, D-062, D-064, D-067, D-104, D-117, D-125, D-129), the owner's status checks, the repo. **Last updated:** 5 Nov 2026; previous version `../archive/2026-11-04b/games/BlockX.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
Guess which block producer will sign a future target block. Simple to play, rooted in how Koinos production really works, and the first game on the shared Picks contract — the foundation the later games (Survivor, Last Node, Bracket, Fantasy, Combo) build on.

## Gameplay
- Targets every **2,400 blocks** (about 2 hours) on Picks game 2, until Sun 8 Nov 2026 (hourly game 12 from Mon 9 Nov): height = round × 2,400 + 0. Picks open up to 28,900 blocks ahead and lock 100 blocks before the target ✅ (`blockx-math.js` `MAINNET_GAME`).
- **Hourly from Mon 9 Nov 2026 00:00 UTC (vault week 3, site "Week 1")** (R-BX-25, owner 5 Nov; moved up from Mon 16 after Repo Lens #E-21 GO; `docs/blockx/HOURLY-TARGETS-PLAN.md`): Picks **game 12**, every **1,200 blocks**, the same lead and ahead (24 open targets), **48 picks a day**, one change per pick (`MAINNET_HOURLY`, `MAINNET_SCHEDULE`). A game's round size can't change on the Picks contract (`sameShape`), so it is a new game entry in the same contract (no new contract). The vault game stays **2** (stakes, prize and vault files). A target belongs to the game whose weeks its block's real time falls in. Points per right pick are the same as on 2-hour targets. 🔨 owner: `announce 12` now, `apply 12` 48 h later, **before Mon 9 Nov 00:00 UTC**.
- **Multiplier cap ×5 from Week 1** (owner 5 Nov: more for picking a less likely producer): min(5, top VHP ÷ your producer's VHP), by the target's time; ×3 before Mon 9 Nov (`capAt`, `CAP_NEW`).
- **Pick popup** (owner 5 Nov): tapping a producer opens one box with **Pick** / **Choose another** and an ✕. Tab stays inside it and focus returns to the producer (E-23 I-4).
- **A late apply** (Repo Lens #E-23 L-1): if every node says game 12 is not on the Picks contract once its weeks start, its targets are recorded with no picks (nobody could pick), so the week can still go final. Apply it before Mon 9 00:00 UTC anyway.
- Up to **30 picks a day** on game 2, with **one change per pick** (D-037) ✅ — "change it once" on the page.
- **Weekly rhythm from Week 1** (D-125, D-129; PRs #160 and #175 ✅): the week counts Mon–Sat; Sunday (UTC) targets are fun rounds, offered (labelled "Fun round · not the week") and scored for Today and All time only, never the week's board, prizes or vault file. First Sunday of fun rounds: Sun 15 Nov. The week-end re-read checks a Sunday target's block only (a play-day target given a Sunday time holds the week).
- A target with no usable handicap card is voided. 💬
- Sponsored picks, guests included, within the caps (rows: `../platform/SPONSOR.md`). ✅

## Scoring
- A producer's chance is its VHP share; the handicap rewards picking smaller producers. Under the VHP standard the multiplier becomes min(cap, topAvg ÷ your cardVhp) (D-058; cap 5 from Week 1). 💬
- Exact points per correct pick: ❓ (not in the chat exports — see `docs/blockx/MAINNET-LAUNCH.md` on `main`).
- The recorder (`bot/games/blockx.ts`) voids a target at once only if both nodes report a non-canonical transfer; otherwise it holds and voids at the 3-day edge. Published cards never change (BX-44). 💬
- **Published final results can't be rewritten** (PR #159 ✅, R-BX-20).
- **Timing:** `../standards/WEEK_CYCLE.md` (the one home for game timing). Block X follows it fully: final **from Mon 00:00 UTC** once two runs at least an hour apart read the same week and the re-read passes (D-135, PR #175; the 12-h final is gone). In practice the last Sunday run and the first Monday run agree, so the week is final around Mon 00:10–01:10 UTC.

## Rewards
- **Launched prize-free** on 3 Nov (D-036). Prizes start with the week of Mon 9 Nov (D-077), once game 2 is applied in the vault. The "before prizes" fixes (I-042, PR #80) are merged ✅.
- Then: staked share of the bucket, and the free prize **2 VHP 1st, 1 VHP 2nd** (D-062); Free play board live, free-prize switch ON (D-081, D-082). 💬 / 👤

## Dependencies
- **Picks contract** `1LmgqB…` (code `700c296a…`) ✅ — **game 2 applied 2 Nov** 👤. The Picks owner handover comes later (D-106; plan `docs/blockx/OWNER-HANDOVER-PLAN.md`, #79).
- Race handicap cards (`race-data`) and the VHP sampler (`race-samples.yml`, running since 3 Nov 15:58 UTC, up to 12 samples a run, ~48 per 6-h card, PR #67; `MIN_SAMPLES` stays 12). Cards keep being taken on Sunday. ✅
- `games.yml` (on: `GAMES_ENABLED=true`) and its publish checks. ✅
- The Mana sponsor's Picks row (`../platform/SPONSOR.md`). ✅
- `PINNED_PICKS = 1LmgqB…` and the Hub status bar are on `main` (launch PR #57, 3 Nov). ✅
- Vault v6 `game-add 2` for staking. ✅ registry entry exists

## Current status (5 Nov)
- **Live for players** ✅ since 3 Nov: Games page (PR #58), menus and home page (PR #59), Leaders tab (PR #63), nicknames (PR #60, D-078), **Results tab** (PR #143 ✅); `GAMES_ENABLED = true`.
- **Vault:** `game-add 2 "Who Signs Block X" --staked --free` announced 3 Nov (tx `0x122082c6…e71760e3`); **`game-apply 2` done 5 Nov** ✅: staked + free prize from vault week 3. Repo variable `PRIZES_FROM_WEEK = 3` set ✅ 👤 (5 Nov).
- **Pays from vault week 3** (site "Week 1", Mon 9 – Mon 16 Nov); final from Mon 16 00:00 UTC (D-135), then the vault bot posts and seals, then the owner has 24 h to correct (D-077).
- **PR #80 (before prizes, I-042): merged ✅.** Built: week-end re-read on both nodes (BX-88, BX-97, BX-98, G-K-1), race card clock (BX-118), void alert (BX-72), RV-2, and the round-14 fixes (E4-1, E4-2, E4-3, E4-7); BX-105 (board freeze, display only) is accepted, not built.
  - *Re-read:* before a final week's prize list is frozen (and its vault file written), every target is read again from both nodes and compared whole: signer and times, picks, Staked flags, the cards in force, and every pick's points recomputed; any difference holds the week (no prize list, no vault file, an alert) and it is tried again next run. Not re-scanned: the VHP moved into a signer (BX-53, read on both nodes when recorded). It also re-checks each void's reason, and a run stops if the race-data fetch fails.
  - *Board freeze (BX-105), not built:* once a week's prize list is published no new round of that week is accepted and published targets never change, so the board can't change either; the vault reads its own write-once file, and the vault bot holds a week whose board and file disagree.
  - *A held week* can't be released without a code change (round-14 fix-check L-2, Low); the run fails and emails each hour while it's held (L-5).
- **Guest picks work** ✅ (I-083 closed: sponsor guest fix `b84e1add…`, vault switch on).
- Work list: `../platform/CHAT_REQUESTS.md` → Block X (and Picks, and the Mana sponsor).

**Check in the correction window** (game-correct / game-unprize / game-void): non-standard-transfer voids (BX-72), every void and its reason (round 14 E4-6), moved VHP on an explorer (E4-5), the free-prize winners for many-wallet farming (BXS-1), close finishes where a ~1% card shift could swap places (BX-115), and void rows near the week edge (BX-120). SP-59 and BX-116 can't mispay.

## Known issues
- **I-037 / I-038:** B1-4 vault-file edge cases; B1-6 stale header; B1-7 `\d` in `bot.yml`; B1-8 test-clock names.
- **I-054:** Python check without `-I`, `|| true` on listings (S3-21, S3-22).
- **I-031:** shared Race files came into `main` with PR #57 (Race chat to confirm, R-RACE-8).
- **Flaky test:** `bot.vhp-read-failure.test.ts` fails now and then in the full parallel run, passes alone.

## Future plans
- Tighten the sponsor rows after a week of play (`mana-report`, R-BX-18; `../platform/SPONSOR.md`).
- Move to the one VHP ruler (D-058, D-090, D-093; R-BX-7).
- Block Golf practice scorecards (paused, D-113).
- The Picks v2 (CARD) upgrade for Combo (paused, D-113).
