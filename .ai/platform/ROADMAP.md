# Knode Games — Roadmap

> **Purpose:** milestones and the path each game takes to launch. A plan, not a promise.
> **Last updated:** 2026-11-02 (consolidated)
> **Sources:** all 12 chat exports, the owner's answers on 2 Nov, and the repo.
> Step-by-step owner actions live in `TODOS.md`; problems in `OPENISSUES.md`; the rules each step must meet in `../standards/`.

**Legend:** ✅ verified · 💬 from a chat · 👤 owner said so · ⚠️ open contradiction · ❓ unknown

**Ground rule (D-064):** nothing is announced to players until it is built, audited and ready — the best version only. Dates below are targets; readiness decides.

## Key dates
Times in UTC, with Pacific time where it helps.

| When | What | |
|------|------|-|
| Wed 4 Nov, 17:30 (9:30 AM PT) | Earliest time to remove old node data folders — only if `heal.log` is clean (I-008) | 💬 |
| Fri 6 Nov, 4 PM PT | **Target** to announce (`game-add`) the games that are ready (D-052, gated by D-064) | 👤 |
| Sun 8 Nov, 4 PM PT | Last moment to `game-apply` games announced by Friday, so they earn from Mon 9 Nov | 💬 |
| **Mon 9 Nov, 00:00** | **The vault starts:** v6 rules begin; 2 + 1 VHP free prizes begin on every free game (D-062); players see this as **"Week 1"** (D-063) | 👤 / 💬 |
| Tue 10 Nov, 12:00 (4 AM PT) | Questions game Week 3 winners final; the bot pays out ≈ 12:07. First week with the v5 split; free players get 1 + 1 VHP unless the owner upgrades first (I-067) | ✅ chain; ⚠️ C-25 |
| Sat 7 – Fri 13 Nov | Survivor announce window; apply Mon 9 – Sun 15 Nov | 💬 |
| **Mon 16 Nov** | **Survivor Season 1 starts** (D-065); first vault close at 12:00 | 👤 / 💬 |

## Now — launch week (2–8 Nov)
| Step | Who | Blocked by | |
|------|-----|-----------|-|
| Merge `vault-v6` into `picks`, so the admin page's vault buttons work | Vault chat (asked 2 Nov) | — | I-019 |
| Make the Questions game's free prize follow D-062 (no 1 + 1 before the vault starts) | owner | checked: the chain will pay 1 + 1 for Week 3; only an upgrade before Mon 9 Nov 12:00 UTC changes that | I-067 |
| Block X: confirm whether any on-chain announcement exists (cancel and redo, or apply when ready); step 8; Mana check; launch PR `picks` → `main` | owner + Block X chat | readiness (D-064, D-067) | I-040, I-070 |
| `game-add` → switch the sponsor to the vault (copy the caps exactly) → `game-apply`, for each ready game | owner | I-019 | D-061 |
| UI refresh: week of 9 Nov shown as "Week 1"; vault "not yet live" wording replaced | Hub + Race chats | — | I-069, I-027 |
| Wallet moves: hardware-wallet owner, cold treasury, retire the old operator | owner | — | I-001, I-045 |

## Next — each game's path to launch
| Game | Path | Waiting on |
|------|------|-----------|
| Producer Race (7) | `game-add 7` → apply → paid from vault start | ready (I-033/I-034 before staked prizes) |
| Block X (2) | step 8 → Mana check → `PINNED_PICKS`, launch PR (carries the Hub status bar and starts the VHP sampler) → announce → live prize-free → prizes after the I-042 fixes | I-040, I-070 |
| Block Golf (6) | practice: after `picks` merges, move Golf files to the site root, full suite, merge, `GOLF_ENABLED=true`. Staked: v6 merged into `golf` → register game 6 (48 h) → set `GOLF_STAKED_FROM_WEEK` | Block X live; I-060 |
| Survivor (3) | Repo Lens pass 4 → fixes + fix-check → testnet season → register game 3 on Picks → set `FIRST_DAY` = Mon 16 Nov, merge → menu + `games.json` live → `board.json` + Results adapter | I-050, I-056 |
| Last Node Standing (13) | clean round-3 review → `picks` in `main` (sampler starts) → announce game 13 on Picks, apply after 48 h → 48 h of sampler readings → `lastnode` → `main` → `LASTNODE_ENABLED=true` → watch day 1 | I-058, I-059 |
| Producer Bracket (9) | Repo Lens audit → fixes + fix-check → update from `main` → announce in Picks and the vault (48 h each) → sponsor allowlist row → `games.json` live | I-061 |
| Fantasy (4) + Rival (5) | fix-check → fixes → real-data simulation → a full test week → register Picks games 4 and 5 (48 h) → merge, `FANTASY_ENABLED=true`, menus, remove `noindex`; first price list the Saturday before launch | I-062 |
| Combo Card (8) | fix-check 4 → re-merge `picks` → Picks v2 upgrade after Block X (publish source + build → `upgrade-schedule --code 92d555d0` → 48 h → `upgrade-upload` → `upgrade-clear` → record in `picks-data/deployment.json` by PR → pick row 0.25 Mana) → announce game 8 (48 h) → `COMBO_ENABLED=true`, `"cards": true` | I-063 |

Order: the owner's goal is every game, each in its best version (D-052, D-064). Earlier chat orders (Hub, Golf, Vault) are superseded (C-14, C-23).

## After launch
- Block X and Race prize fixes before their staked prizes (I-033 – I-035, I-042).
- Race and Block X onto the VHP standard (D-058).
- Size the sponsor's KOIN from measured use (bot ~5–6 Mana a day, sponsor ~3 Mana per active player per day, hold 5 × daily use) and recheck the 25-a-day per-wallet cap for heavy players (D-028, D-061, I-060).
- Per-action Mana limits a day after Block X launches, and again a day after the sponsor's vault switch.
- Full platform audit when the owner gives the go-ahead (D-014).
- Launch announcement, analytics decision, ads, the SwarmTales listing (from the owner checklist) 💬.
- Write each game's spec into `.ai/games/` (rules now live in DECISIONS).

## Ideas, not scheduled
- Mana Station (shelved, D-053).
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
