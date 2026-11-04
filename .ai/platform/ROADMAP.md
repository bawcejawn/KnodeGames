# Knode Games — Roadmap

> **Purpose:** milestones, key dates and the path each game takes to launch. A plan, not a promise.
> **Last updated:** 2026-11-04 (cleanup: past dates and done steps moved to `../archive/DONE.md`; this week's steps are in `TODOS.md`)
> **Sources:** all 12 chat exports, the owner's answers, and the repo. Owner steps: `TODOS.md`; chat work: `CHAT_REQUESTS.md`; problems: `OPENISSUES.md`; the rules each step must meet: `../standards/` (launches follow `GO_LIVE_CHECKLIST.md`).

**Legend:** ✅ verified · 💬 from a chat · 👤 owner said so · ❓ unknown

**Ground rule (D-064):** nothing is announced to players until it is built, audited and ready: the best version only. Dates below are targets; readiness decides.

## Key dates
Times in UTC, with Pacific time where it helps.

| When | What | |
|------|------|-|
| Wed 4 Nov, 17:30 (9:30 AM PT) | Earliest time to remove old node data folders, only if `heal.log` is clean (I-008) | 💬 |
| Thu 5 Nov, 15:51 (7:51 AM PT) | Games 2 and 7 become applicable in the vault; apply before Sun 8 Nov 4 PM PT. A game applied Wed 4 – Sun 8 Nov earns from vault week 3 (Mon 9 Nov) | ✅ tx, 💬 Vault |
| Fri 6 Nov, ~noon PT | Latest safe `game-add` for any game to pay from 9 Nov (the apply comes 48 h later and must land before Sun 4 PM PT; a Fri 4 PM `game-add` leaves no margin). No game is planned for it now (the Bracket launches when ready, D-088) | 👤 / 💬 Vault |
| Fri 6 – Tue 10 Nov | Wallet moves (`docs/WALLETS.md`; D-083, D-096) | 👤 |
| **Mon 9 Nov, 00:00** | **The vault starts paying:** v6 rules begin; 2 + 1 VHP free prizes on the games whose free prize is on (D-062, D-081, D-082); players see this as **"Week 1"** (D-063). PR #80 (Block X) must be merged before | 👤 / 💬 |
| Tue 10 Nov, 10 AM PT | First weekly review (`WEEKLY_REVIEW.md`) | owner + library chat |
| Tue 10 Nov, 12:00 (4 AM PT) | Questions Week 3 winners final; the bot pays out ≈ 12:07. First week with the v5 split; free players get 1 + 1 VHP (D-069) | ✅ chain, 👤 |
| Sat 7 – Fri 13 Nov | Survivor announce window; apply Mon 9 – Sun 15 Nov | 💬 |
| **Mon 16 Nov** | **Survivor Season 1 starts** (D-065); first vault close with other games in it, 12:00 | 👤 / 💬 |
| Week of 23 or 30 Nov | Doubled Questions vault upgrade (D-092, R-VAULT-6), after the first paid weeks | 👤 |

## Each game's path to launch
| Game | Path from here | Waiting on |
|------|------|-----------|
| Producer Race (7) | apply Thu–Sun → paid from Mon 9 Nov → the one VHP ruler (card credit, longer look-back) | I-034 / I-035 before its first paid week closes (Mon 16 Nov); R-RACE-5 |
| Block X (2) | apply Thu–Sun → PR #80 merged → prizes from Mon 9 Nov (D-077) | round-14 fix E4-1 (I-042); the one VHP ruler later |
| Block Golf (6) | practice: move Golf files to the site root, full suite, merge, `GOLF_ENABLED=true`. Staked: `main` merged into `golf` → register game 6 (48 h) → set `GOLF_STAKED_FROM_WEEK` | I-060; a Free board (no prize yet, D-081) |
| Survivor (3) | Repo Lens pass 4 → fixes + fix-check → testnet season → register game 3 on Picks → set `FIRST_DAY` = Mon 16 Nov, merge → menu + `games.json` live → `board.json` + Results adapter → vault `game-add 3 … --free --season 2` with its switch OFF | I-050, I-056 |
| Last Node Standing (13) | clean round-3 review → lower entry bar (D-091) → add the Free board with its prize (D-081) → announce game 13 on Picks, apply after 48 h → 48 h of sampler readings → `lastnode` → `main` → `LASTNODE_ENABLED=true` → watch day 1 | I-058 |
| Producer Bracket (9) | fixes (R-BR-1, R-BR-2) + fix-check → update from `main` → announce in Picks and the vault (48 h each) → sponsor allowlist row → `games.json` live; launches when ready (D-088) | I-061 |
| Fantasy (4) + Rival (5) | fix-check → fixes → real-data simulation → a full test week → register Picks games 4 and 5 (48 h) → merge, `FANTASY_ENABLED=true`, menus, remove `noindex`; first price list the Saturday before launch | I-062 |
| Combo Card (8) | fix-check 4 → re-merge `main` → Picks v2 upgrade (publish source + build → `upgrade-schedule --code 92d555d0` → 48 h → `upgrade-upload` → `upgrade-clear` → record in `picks-data/deployment.json` by PR → pick row 0.25 Mana) → announce game 8 (48 h) → `COMBO_ENABLED=true`, `"cards": true` | I-063 |

Order: the owner's goal is every game, each in its best version (D-052, D-064). Earlier chat orders (Hub, Golf, Vault) are superseded (C-14, C-23).

## After launch
- Race and Block X onto the one VHP ruler (D-058, D-090).
- Size the sponsor's KOIN from measured use (bot ~1.9–5.1 Mana a day measured 31 Oct – 2 Nov, `ARCHITECTURE.md`; earlier estimate ~5–6, sponsor ~3 Mana per active player per day, hold 5 × daily use) and recheck the 25-a-day per-wallet cap for heavy players (D-028, D-061, I-060).
- Per-action Mana limits a day after Block X launched, and again a day after the sponsor's vault switch.
- Full platform audit when the owner gives the go-ahead (D-014).
- **Multisig owner (2-of-3):** an audited smart-contract wallet as the owner of the vault, Desk, Picks and Race picks, so no single key can act alone; the tools learn to collect two signatures. The owner has built a multisig for another project, which may be the starting point ❓ (owner, 3 Nov; replaces the cold-key owner of `docs/WALLETS.md`, TD-01).
- Launch announcement, analytics decision, ads, the SwarmTales listing (from the owner checklist) 💬.
- Keep each game's file in `.ai/games/` current as games change.

## Ideas, not scheduled
- Mana Station (shelved, D-053).
- A fallback node for the bot: the owner's personal node reached through a Cloudflare Tunnel (outbound-only, no open ports, locked with a key), used only when Armana fails; `api.koinosblocks.com` stays the checker. **On hold** (owner, 3 Nov).
- A vault upgrade so a game whose free prize is OFF sets aside nothing (D-082, "Later").
- Next sponsor version: guest prize claims and the L-3 fix (I-005).
- Compound at a fixed time each day (I-049).
- A sponsor that also pays operator transactions (needs an audit).
- Retention: streaks, a "Your week" card, a claim reminder dot, a weekly recap page, badges next to names.
- Fantasy Telegram reminder; Last Node 4-week rolling form check.
- Bot support for the public-testnet vault copy (I-014).

## Done
Moved to `../archive/DONE.md` → "Roadmap: done milestones".
