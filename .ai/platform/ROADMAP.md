# Knode Games — Roadmap

> **Purpose:** milestones, key dates and the path each game takes to launch. A plan, not a promise.
> **Last updated:** 2026-11-05 (dates moved to `CALENDAR.md`; the old dates table is in `../archive/DONE.md` → "Moved 2026-11-05 (status-sync, evening)"; paused games marked)
> **Sources:** all 12 chat exports, the owner's answers, and the repo. Owner steps: `TODOS.md`; chat work: `CHAT_REQUESTS.md`; problems: `OPENISSUES.md`; the rules each step must meet: `../standards/` (launches follow `GO_LIVE_CHECKLIST.md`).

**Legend:** ✅ verified · 💬 from a chat · 👤 owner said so · ❓ unknown

**Ground rule (D-064):** nothing is announced to players until it is built, audited and ready: the best version only. Dates below are targets; readiness decides.

## Key dates
Dates and times live in **one place: `CALENDAR.md`** (this week, the v6.1 upgrade, the weekly cycle, the first paid weeks). This page keeps the longer path.

## Each game's path to launch
| Game | Path from here | Waiting on |
|------|------|-----------|
| Producer Race (7) | apply Thu 5 – Sun 8 → paid from Mon 9 Nov → the one VHP ruler (card credit, longer look-back) | R-RACE-5 (waits on the ruler's §16 design, D-111) |
| Block X (2) | apply Thu 5 – Sun 8 → prizes from Mon 9 Nov (D-077); final moves to Mon 00:00 UTC (D-135) | the one VHP ruler later |
| Block Golf (6) | practice: move Golf files to the site root, full suite, merge, `GOLF_ENABLED=true`. Staked: `main` merged into `golf` → register game 6 (48 h) → set `GOLF_STAKED_FROM_WEEK` | I-060; a Free board (no prize yet, D-081) |
| Survivor (3) | Repo Lens pass 4 → fixes + fix-check → testnet season → register game 3 on Picks → set `FIRST_DAY` (a Monday, date ❓ after D-113), merge → menu + `games.json` live → `board.json` + Results adapter → vault `game-add 3 … --free --season 2` with its switch OFF | I-050, I-056 |
| Last Node Standing (13) | clean round-3 review → lower entry bar (D-091) → add the Free board with its prize (D-081) → announce game 13 on Picks, apply after 48 h → 48 h of sampler readings → `lastnode` → `main` → `LASTNODE_ENABLED=true` → watch day 1 | I-058 |
| Producer Bracket (9) | fixes (R-BR-1, R-BR-2) + fix-check → update from `main` → announce in Picks and the vault (48 h each) → sponsor allowlist row → `games.json` live; launches when ready (D-088) | I-061 |
| Fantasy (4) + Rival (5) | fix-check → fixes → real-data simulation → a full test week → register Picks games 4 and 5 (48 h) → merge, `FANTASY_ENABLED=true`, menus, remove `noindex`; first price list the Saturday before launch | I-062 |
| Combo Card (8) | fix-check 4 → re-merge `main` → Picks v2 upgrade (publish source + build → `upgrade-schedule --code 92d555d0` → 48 h → `upgrade-upload` → `upgrade-clear` → record in `picks-data/deployment.json` by PR → pick row 0.25 Mana) → announce game 8 (48 h) → `COMBO_ENABLED=true`, `"cards": true` | I-063 |

**Reactivated 5 Nov (D-142): Fantasy (#188), Block Golf (#187), Bracket (#186)** are the next three launches; **paused (D-113):** Survivor, Last Node and Combo wait for the core work; then Last Node, Survivor and Combo; Survivor's 16 Nov start no longer holds. Each adopts `../standards/WEEK_CYCLE.md` and follows `../standards/NEW_GAME.md` before launch.

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
