# Who Signs Block X (game 2)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Block X and Picks, Race, Bracket, Combo, Vault chats), `DECISIONS.md` (D-036 – D-041, D-062, D-064, D-067), the owner's status checks, the repo. **Last updated:** 2026-11-02.
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
- **Launches prize-free** (D-036). Prizes start only after the "before prizes" fixes (I-042) and its vault registration.
- Then: staked share of the bucket, and the free prize **2 VHP 1st, 1 VHP 2nd** (D-062). 💬 / 👤

## Dependencies
- **Picks contract** `1LmgqB…` (code `700c296a…`) ✅ — **game 2 applied 2 Nov** 👤.
- Race handicap cards (`race-data`) and the VHP sampler, which starts when `picks` merges into `main` (I-059). 💬
- `games.yml` (off until `GAMES_ENABLED=true`) and its publish checks. ✅
- The Mana sponsor's Picks row (0.2 Mana). ✅
- The launch PR `picks` → `main` (sets `PINNED_PICKS`, brings the Hub status bar). ✅ `PINNED_PICKS = ""` today
- Vault v6 `game-add 2` for staking. ✅ registry entry exists

## Current status (2 Nov)
- **Applied on the Picks contract** — owner completed step 8 and the follow-ups 👤. Not yet announced to players (D-064, D-067).
- Repo Lens rounds 10, 11 and **12: GO** 👤. **Launch PR #57 merged into `main` on 3 Nov** ✅ — the page, `PINNED_PICKS` and the Race v6 fix are live code; `games.json` still says "soon" ✅.
- Next: the VHP sampler running, `GAMES_ENABLED` for the recorder ❓, the announcement, and the vault `game-add 2`.

## Known issues
- **I-042 (before prizes):** BX-97/BX-88 week-end re-read on both nodes, BX-105 board freeze, BX-72 VHP decoder, BX-118 race card clock, BX-115, BX-116, BX-120, SP-59, G-K-1.
- **I-037 / I-038:** B1-4 vault-file edge cases; B1-6 stale header; B1-7 `\d` in `bot.yml`; B1-8 test-clock names.
- **I-054:** Python check without `-I`, `|| true` on listings (S3-21, S3-22).
- **I-062:** `site.mobile-nav.test.mjs` fails on `picks` (`nav.js` must load after the wallet scripts on `blockx.html`).
- **I-031:** shares Race files; merged by hand.

## Future plans
- Launch PR and per-action Mana limits a day after launch (step 10).
- Move to the VHP standard (D-058).
- Block Golf practice scorecards ship with Block X (D-056).
- The Picks v2 (CARD) upgrade for Combo comes after Block X launches.
