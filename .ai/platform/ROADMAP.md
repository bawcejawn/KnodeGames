# Knode Games — Roadmap

> **Purpose:** milestones and the path each game takes to launch. A plan, not a promise.
> **Last updated:** 2026-11-03 (Block X launched; games 2 and 7 announced to the vault; finished steps moved to Done)
> **Sources:** all 12 chat exports, the owner's answers on 2 Nov, and the repo.
> Step-by-step owner actions live in `TODOS.md`; problems in `OPENISSUES.md`; the rules each step must meet in `../standards/`.

**Legend:** ✅ verified · 💬 from a chat · 👤 owner said so · ⚠️ open contradiction · ❓ unknown

**Ground rule (D-064):** nothing is announced to players until it is built, audited and ready — the best version only. Dates below are targets; readiness decides.

## Key dates
Times in UTC, with Pacific time where it helps.

| When | What | |
|------|------|-|
| Wed 4 Nov, 17:30 (9:30 AM PT) | Earliest time to remove old node data folders — only if `heal.log` is clean (I-008) | 💬 |
| Thu 5 Nov, 15:51 (7:51 AM PT) | Games 2 and 7 become applicable in the vault; apply before Sun 8 Nov 4 PM PT | ✅ tx |
| Fri 6 Nov, ~noon PT | **Latest** `game-add` for a game to pay from 9 Nov — Bracket, if its audit passes (D-052, gated by D-064). Why noon: the apply can only happen 48 h after the `game-add` and must land before Sun 4 PM PT (Mon 00:00 UTC). A `game-add` at Fri 4 PM PT (the Vault chat's latest time) becomes applicable exactly at Sun 4 PM, which leaves no margin; noon leaves ~4 h | 👤 / 💬 Vault |
| Wed 4 – Sun 8 Nov | Vault: a game applied in this window earns from vault week 3 (Mon 9 Nov); apply 48 h after its `game-add` | 💬 Vault |
| ~~Sun 8 Nov, ~21:23 (1:23 PM PT)~~ | ~~Block X's existing Picks announcement probably stops being applicable (I-070)~~ — moot: it was applied 2 Nov (D-070) | ✅ |
| **Mon 9 Nov, 00:00** | **The vault starts paying:** v6 rules begin; 2 + 1 VHP free prizes begin on the games whose free prize is on (D-062, D-081, D-082); players see this as **"Week 1"** (D-063) | 👤 / 💬 |
| Tue 10 Nov, 10 AM PT | First weekly review (`WEEKLY_REVIEW.md`) | owner + library chat |
| Tue 10 Nov, 12:00 (4 AM PT) | Questions game Week 3 winners final; the bot pays out ≈ 12:07. First week with the v5 split; free players get 1 + 1 VHP (D-069) | ✅ chain, 👤 |
| Sat 7 – Fri 13 Nov | Survivor announce window; apply Mon 9 – Sun 15 Nov | 💬 |
| Fri 13 Nov | Vault bot checks done (I-051, I-052, I-064) | 💬 Vault |
| **Mon 16 Nov** | **Survivor Season 1 starts** (D-065); first vault close with other games in it, 12:00 | 👤 / 💬 |

## Now — launch week (2–8 Nov)
| Step | Who | Blocked by | |
|------|-----|-----------|-|
| ~~Merge `vault-v6` into `picks`~~ — done (`e7887b6`) | Vault chat | — | I-019 ✅ |
| ~~Block X: confirm whether any on-chain announcement exists; step 8; Mana check; launch PR `picks` → `main`~~ — all done (D-070, PR #57, live 3 Nov) | owner + Block X chat | — | I-040, I-070 ✅ |
| ~~`game-add` games 2 and 7~~ ✅ 3 Nov → ~~sponsor vault switch~~ ✅ 3 Nov → **`game-apply 2` and `7`** Thu 5 – Sun 8 Nov → `PRIZES_FROM_WEEK = 3` | owner | timelock until Thu 5 Nov 15:51 UTC | D-061, D-077 |
| Free-prize switch: set the starting values for all eight games, then the GitHub ruleset | owner | — | D-082, `FREE_PRIZE_SWITCH.md` |
| Rewrite `docs/WALLETS.md` (it's stale) before the wallet moves | Vault chat + owner | — | I-001 |
| UI refresh: week of 9 Nov shown as "Week 1"; vault "not yet live" wording replaced | Hub + Race chats | — | I-069, I-027 |
| Wallet moves: hardware-wallet owner, cold treasury, retire the old operator | owner | — | I-001, I-045 |

## Next — each game's path to launch
| Game | Path | Waiting on |
|------|------|-----------|
| Producer Race (7) | ~~`game-add 7`~~ ✅ 3 Nov → apply Thu–Sun → paid from Mon 9 Nov | I-034 / I-035 before its first paid week closes (Mon 16 Nov) |
| Block X (2) | ~~step 8~~ ✅ → ~~Mana check, `PINNED_PICKS`, launch PR #57~~ ✅ → ~~sampler running~~ ✅ → ~~live prize-free~~ ✅ 3 Nov → ~~vault `game-add 2`~~ ✅ 3 Nov → apply Thu–Sun → prizes from Mon 9 Nov (D-077) | the I-042 list checked before the first paid week closes; sampler cadence (I-059) |
| Block Golf (6) | practice: ~~after `picks` merges~~ (merged 3 Nov), move Golf files to the site root, full suite, merge, `GOLF_ENABLED=true`. Staked: v6 merged into `golf` → register game 6 (48 h) → set `GOLF_STAKED_FROM_WEEK` | ~~Block X live~~ ✅; I-060; a Free board (no prize yet, D-081) |
| Survivor (3) | Repo Lens pass 4 → fixes + fix-check → testnet season → register game 3 on Picks → set `FIRST_DAY` = Mon 16 Nov, merge → menu + `games.json` live → `board.json` + Results adapter → vault `game-add 3 … --free --season 2` with its switch OFF | I-050, I-056 |
| Last Node Standing (13) | clean round-3 review → ~~`picks` in `main` (sampler starts)~~ ✅ 3 Nov → add the Free board with its prize (D-081) → announce game 13 on Picks, apply after 48 h → 48 h of sampler readings → `lastnode` → `main` → `LASTNODE_ENABLED=true` → watch day 1 | I-058, I-059 |
| Producer Bracket (9) | Repo Lens audit (requested 3 Nov) → fixes + fix-check → update from `main` → announce in Picks and the vault (48 h each; by Fri 6 Nov noon PT to pay from 9 Nov) → sponsor allowlist row → `games.json` live | I-061 |
| Fantasy (4) + Rival (5) | fix-check → fixes → real-data simulation → a full test week → register Picks games 4 and 5 (48 h) → merge, `FANTASY_ENABLED=true`, menus, remove `noindex`; first price list the Saturday before launch | I-062 |
| Combo Card (8) | fix-check 4 → re-merge `picks` → Picks v2 upgrade after Block X (publish source + build → `upgrade-schedule --code 92d555d0` → 48 h → `upgrade-upload` → `upgrade-clear` → record in `picks-data/deployment.json` by PR → pick row 0.25 Mana) → announce game 8 (48 h) → `COMBO_ENABLED=true`, `"cards": true` | I-063 |

Order: the owner's goal is every game, each in its best version (D-052, D-064). Earlier chat orders (Hub, Golf, Vault) are superseded (C-14, C-23).

## After launch
- Block X and Race prize fixes before their staked prizes (I-033 – I-035, I-042).
- Race and Block X onto the VHP standard (D-058).
- Size the sponsor's KOIN from measured use (bot ~1.9–5.1 Mana a day measured 31 Oct – 2 Nov, `ARCHITECTURE.md`; earlier estimate ~5–6, sponsor ~3 Mana per active player per day, hold 5 × daily use) and recheck the 25-a-day per-wallet cap for heavy players (D-028, D-061, I-060).
- Per-action Mana limits a day after Block X launches, and again a day after the sponsor's vault switch.
- Full platform audit when the owner gives the go-ahead (D-014).
- Launch announcement, analytics decision, ads, the SwarmTales listing (from the owner checklist) 💬.
- ~~Write each game's spec into `.ai/games/`~~ — done 2 Nov; keep them current as games change.

## Ideas, not scheduled
- Mana Station (shelved, D-053).
- A fallback node for the bot: the owner's personal node reached through a Cloudflare Tunnel (outbound-only, no open ports, locked with a key), used only when Armana fails; `api.koinosblocks.com` stays the checker. **On hold** (owner, 3 Nov).
- ~~A free option for Fantasy, Block Golf, Combo and Last Node (staked-only for now, D-071)~~ — decided: every game has Free play (D-081); free prizes switched per game (D-082).
- A vault upgrade so a game whose free prize is OFF sets aside nothing (D-082, "Later").
- Next sponsor version: guest prize claims and the L-3 fix.
- Compound at a fixed time each day (I-049).
- A sponsor that also pays operator transactions (needs an audit).
- Retention: streaks, a "Your week" card, a claim reminder dot, a weekly recap page, badges next to names.
- Fantasy Telegram reminder; Last Node 4-week rolling form check.
- Bot support for the public-testnet vault copy (I-014).

## Done
| What | When | |
|------|------|-|
| Self-heal and alerts | 23 Oct | 💬 |
| Desk node repaired after its crash loop | 24 Oct | 💬 |
| Operator rotated to `1HsM33…` | 26 Oct | 💬 |
| Race contract; Build 2 (rename, Games hub, Race Show) | 27 Oct | ✅ / 💬 |
| Game v5 + Desk v2; sponsor pays player Mana; on-time 12:00 UTC release | 28 Oct | ✅ |
| Domain live; site moved to the repo root | by 28 Oct | 💬 |
| Picks contract and sponsor v3 uploaded; staking hub, status bars, @name page live; seed 20,000 VHP deposited, seed owner moved | 30 Oct | ✅ / 💬 |
| Block X Repo Lens rounds 10 and 11: GO | by 1 Nov | 💬 |
| **Vault v6 uploaded** (02:33 UTC), holdings unchanged; merged into `main` (PR #51) | 2 Nov | ✅ |
| Stake panel fixes (PR #46), Race badge (PR #44), wallet provider fix (PR #49); admin fixes (PR #43, `picks`) | by 2 Nov | ✅ |
| `.ai/` library created; all 12 chats archived and filed; contradictions answered | 2 Nov | ✅ |
| Block X live (Repo Lens round 12 GO, PRs #57–#60, #63); Race nicknames (PR #62); sampler running | 3 Nov | ✅ |
| Vault `game-add` for games 2 and 7; sponsor vault switch on | 3 Nov | ✅ 👤 |
| Free play on every game (D-081); free-prize switch merged (D-082, PR #65) | 3 Nov | ✅ |
| Chat starter, session-end and weekly-review processes; weekly reminder set | 3 Nov | ✅ |
