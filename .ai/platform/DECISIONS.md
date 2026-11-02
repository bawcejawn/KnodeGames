# Knode Games — Decision Log

> Purpose: Record of decisions made, newest first. This file wins over any other .ai file.
> Rule: Never delete a decision. If it changes, add a new entry and mark the old one "Superseded by D-XXX".
> Last updated: 2026-11-02
> Sources: owner in chat (2026-11-02), `.ai/archive/CHAT_KNOWLEDGE.md` (Questions chat), repo branch `picks`.

**Legend:** ✅ verified in repo · 💬 chat only · ⚠️ conflict · ❓ unknown

## Index
| ID | Date | Title | Status |
|----|------|-------|--------|
| D-001 | 2026-11-02 | Platform name is "Knode Games" | active |
| D-002 | 2026-11-02 | Repository `.ai/` documents are the source of truth | active |
| D-003 | ❓ | Funds safety first; keys never leave `.env` | active |
| D-004 | ❓ | Mainnet sends are opt-in | active |
| D-005 | ❓ | Hosting costs $0 | active |
| D-006 | ❓ | Never mention Chainge; Vortex is the bridge | active |
| D-007 | ❓ | Swap desk: 3% fee, no daily payout cap | active |
| D-008 | ❓ | Mana sponsor daily hard cap | ⚠️ disputed (C-02) |
| D-009 | ❓ | Guest play on (web and mobile) | active |
| D-010 | ❓ | New prize rules start Week 3 | active |
| D-011 | ❓ | Rules page in tabs; Race removed from footer; hourly VHP refresh | active |
| D-012 | ❓ | GitHub: one secret, no PR requirement | active |
| D-013 | ❓ | Wallet handovers done by owner | pending |
| D-014 | ❓ | Full platform audit waits for owner go-ahead | pending |
| D-015 | ❓ | How assistants communicate with the owner | active |

---

## D-001 — Platform name is "Knode Games"
- **Date:** 2026-11-02 · **Status:** active · **Area:** platform / brand
- **Decision:** The platform is called "Knode Games" (two words) from now on.
- **Context:** Earlier names: Kprediction → Knode → "KnodeGames" (one word, still used in the archive and some repo strings such as `sponsor-data/mana-limits.json`).
- **Consequences:** New docs use "Knode Games". Repo names/identifiers are not changed by this decision. ❓ Whether code strings should change is a separate decision.
- **Source:** owner, this chat

## D-002 — Repository `.ai/` documents are the source of truth
- **Date:** 2026-11-02 · **Status:** active · **Area:** process
- **Decision:** Facts in `.ai/` override chat memory. Where the archive conflicts with repo files, the repo file wins and the conflict is logged below.
- **Consequences:** Chats read `.ai/` first and file new knowledge through `archive/CHAT_KNOWLEDGE.md`.
- **Source:** owner, this chat

## D-003 — Funds safety first; keys never leave `.env`
- **Decision:** Funds must never be at risk; token security comes first. Never paste private keys or seed phrases into chat. Keys live only in `.env` on the owner's PC.
- **Source:** 💬 Questions chat

## D-004 — Mainnet sends are opt-in
- **Decision:** Mainnet sends require `CONFIRM_MAINNET=yes`. Every command is a dry run unless `--send` is given.
- **Source:** 💬 Questions chat

## D-005 — Hosting costs $0
- **Decision:** Hosting must cost nothing (GitHub Pages).
- **Source:** 💬 Questions chat; Pages + `CNAME` ✅

## D-006 — Never mention Chainge; Vortex is the bridge
- **Source:** 💬 Questions chat

## D-007 — Swap desk: 3% fee, no daily payout cap
- **Decision:** 3% fee per swap; no daily payout cap; if KOIN is available it can be swapped for VHP; swaps grow the desk node's production.
- **Source:** 💬 Questions chat; 3% ✅ `desk-data/deployment.json` (`feeBps: 300`)

## D-008 — Mana sponsor daily hard cap ⚠️
- **Decision (chat):** hard cap of 1,000 Mana a day for everyone.
- **Conflict:** repo `bot/sponsor.ts` records owner decisions of 2026-10-28/29 for 5,000 a day. See C-02.
- **Status:** disputed until the owner confirms.

## D-009 — Guest play on (web and mobile)
- **Source:** 💬 Questions chat; `guest: true` ✅ `game-data/deployment.json`

## D-010 — New prize rules start Week 3
- **Decision:** The 40/60 split and the 2 VHP free prize start in Week 3 (Mon 2 Nov 2026). `reward_rule_week_plus_one=3` is set on chain.
- **Uncertain:** exact meaning of the 40/60 split ❓; on-chain value not verified 💬.

## D-011 — Site: Rules tabs, footer, VHP refresh
- **Decision:** Rules page simplified into tabs (Knode Game, Race, Swap); "Producer race" removed from the footer; VHP balance refreshes every hour.
- **Source:** 💬 Questions chat

## D-012 — GitHub: one secret, no PR requirement
- **Decision:** Only `OPERATOR_WIF` is stored on GitHub (environment `bot`). Ruleset restricts deletions and blocks force pushes only; a PR requirement would block the bot.
- **Source:** 💬 Questions chat

## D-013 — Wallet handovers done by owner (pending)
- **Decision:** The owner moves ownership to a new hardware-wallet owner and sets up a cold treasury.
- **Target:** "hopefully this weekend" (❓ likely 7–8 Nov 2026).
- **Context:** Owner and desk treasury are currently the same address ✅.

## D-014 — Full platform audit waits for owner go-ahead (pending)
- **Source:** 💬 Questions chat

## D-015 — How assistants communicate with the owner
- **Decision:** Explain steps simply, give a "Today" checklist, keep asking questions.
- **Source:** 💬 Questions chat

---

## Contradictions Register
Repo wins per D-002 unless the owner rules otherwise. "Ruling" = what the docs currently say.

| ID | Topic | Archive (chat) says | Repo says | Ruling / action |
|----|-------|---------------------|-----------|-----------------|
| C-01 | Sponsor version on chain | v2 `fa4659e6` | `sponsor-data/deployment.json`: v3 `b61ac238` uploaded 2026-10-30; `bot/sponsor.ts` keeps v2 as rollback | Repo: v3. ❓ Confirm on chain |
| C-02 | Sponsor caps (per tx / player-day / player-week / all-day / free-day) | 3 / 10 / 65 / 1,000 / 300 | `bot/sponsor.ts` defaults: 1 / 25 / 150 / 5,000 / 2,000 (owner 2026-10-28/29); v2 rollback can't exceed 1,000/day | **Owner decision needed.** Live on-chain values unknown |
| C-03 | Sponsor wallet KOIN | 5,000 KOIN | `bot/sponsor.ts` comment: at least 25,000 KOIN to fund 5,000/day | Tied to C-02. ❓ Check balance |
| C-04 | Site read RPC | site uses `api.koinos.io`; only `header-wallet.js` still on Armana | `app.js`, `swap.js`, `header-wallet.js` all hard-code `koinos.armana.io`; game/desk/race deployments use Armana, sponsor/picks use `api.koinos.io` | Repo (`picks` branch): Armana. ❓ GitHub `main` may differ (branch `armana-rpc` exists) |
| C-05 | `rcLimitOther` | 3 Mana | `game-data/deployment.json`: 1 Mana (audit SP-17); game `maxSponsorRc` 2 Mana | Repo: 1 Mana |
| C-06 | Repo name | `bawcejawn/KnodeGames` | local `origin` still `bawcejawn/Knode.git` | ❓ Confirm rename on GitHub |
| C-07 | Platform name | "KnodeGames" | mixed | Resolved by D-001: "Knode Games" |
| C-08 | Week boundary time | Week 2 closes Mon 2 Nov 21:00 UTC | genesis Mon 19 Oct 00:00 UTC, 7-day weeks, 12 h close delay, 24 h settle | ❓ Explain where 21:00 UTC comes from (bot schedule?) |
| C-09 | Vault | questions game is `Q_GAME = 1` in the Vault | no vault deployment on `picks`; `game-data` has no vault link; vault work on branch `vault-v6` | ❓ Vault address and whether game 1 already runs through it |
