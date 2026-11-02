# Knode Games — Decision Log

> Purpose: Record of decisions made, newest first. This file wins over any other .ai file.
> Rule: Never delete a decision. If it changes, add a new entry and mark the old one "Superseded by D-XXX".
> Last updated: 2026-11-02
> Sources: owner in chat (2026-11-02), `.ai/archive/CHAT_KNOWLEDGE.md` (Questions, Vault, Hub and Race chats), repo branches `picks` and `main`.

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
| D-010 | ❓ | New prize rules start Week 3 | ⚠️ disputed (C-10) |
| D-011 | ❓ | Rules page in tabs; Race removed from footer; hourly VHP refresh | active |
| D-012 | ❓ | GitHub: one secret, no PR requirement | active |
| D-013 | ❓ | Wallet handovers done by owner | pending |
| D-014 | ❓ | Full platform audit waits for owner go-ahead | pending |
| D-015 | ❓ | How assistants communicate with the owner | active |
| D-016 | ❓ | Only the vault holds tokens; all staked VHP withdrawable at all times | active |
| D-017 | 2026-10-29 | Owner's own audit programs count as the audit | active |
| D-018 | ❓ | Every game is stakeable | active |
| D-019 | 2026-10-30 | Producer Bracket: staked + free prize, 1-week seasons | active |
| D-020 | ❓ | Survivor: 2-week seasons, Season 1 from Mon 16 Nov | active |
| D-021 | ❓ | Keep a withdrawals-only emergency build | active |
| D-022 | 2026-10-30 | Vault seed: 20,000 VHP from a dedicated seed owner | active |
| D-023 | ❓ | Announce on a weekend, upload on Monday | active |
| D-024 | ❓ | Launch games as soon as ready; vault upgrades need 48 h notice | active |
| D-025 | ❓ | Branch hygiene for `vault-v6` | active |
| D-026 | ❓ | Merges only on the owner's explicit OK | active |
| D-027 | 2026-10-30 | Sponsor pays stake, withdraw and claim — never `move_stake` | active |
| D-028 | ❓ | Sponsor caps 25 Mana per wallet per day, 150 per week | active (feeds C-02) |
| D-029 | ❓ | Prize and liability rules | active |
| D-030 | 2026-10-30 | Names: one Koinos @name per wallet | active |
| D-031 | 2026-10-30 | Staking UX: simple, share %, badge on every game page | active |
| D-032 | ❓ | New games launch on Mondays, one at a time | ⚠️ disputed (C-14) |
| D-033 | 2026-10-27 | Build 2: Race Show scoring, home page, dapp name | active |
| D-034 | 2026-10-28/29 | Producer Race: stakes, ranking, ties, prizes, medals | active |
| D-035 | 2026-10-29 | The Race chat owns all Race files | active |

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
- **Conflict:** the Vault chat says the v6 rules and the 2 + 1 VHP free prizes start Mon 9 Nov. See C-10.

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

## D-016 — Only the vault holds tokens; all staked VHP withdrawable at all times
- **Decision:** Every staked VHP stays withdrawable at all times, and only the vault holds tokens. Extends D-003.
- **Source:** 💬 Vault chat

## D-017 — Owner's own audit programs count as the audit
- **Date:** 2026-10-29
- **Decision:** The owner's own audit programs count as the audit before contract upgrades. For v6: RepoLens fix-check 4 said "ready for the rehearsal"; the rehearsal and the testnet check passed.
- **Note:** D-014 (full platform audit) is a separate, still-pending step.
- **Source:** 💬 Vault chat

## D-018 — Every game is stakeable
- **Decision:** Every game is stakeable (Q15). Block X, Survivor, Race and Bracket are added with `--staked --free`.
- **Source:** 💬 Vault chat

## D-019 — Producer Bracket: staked + free prize, 1-week seasons
- **Date:** 2026-10-30 · **Decision:** Game 9 is staked plus a free prize (2 + 1 VHP), with 1-week seasons.
- **Source:** 💬 Vault chat (owner)

## D-020 — Survivor: 2-week seasons, Season 1 from Mon 16 Nov
- **Decision:** Game 3 uses `--season 2` (prizes 4 + 2 VHP). Season 1 starts Mon 16 Nov (vault week 4).
- **Source:** 💬 Vault chat

## D-021 — Keep a withdrawals-only emergency build
- **Decision:** A withdrawals-only vault build (`e84fec49…`) is kept ready so funds can never be locked. Emergency steps: `upgrade --safe`, sponsor limit 0, pause.
- **Source:** 💬 Vault chat; hash ✅ `main`

## D-022 — Vault seed: 20,000 VHP from a dedicated seed owner
- **Date:** 2026-10-30 · **Decision:** 20,000 VHP deposited (total 21,050 VHP); seed ownership handed to a new dedicated wallet `1K8VV…`.
- **Source:** 💬 Vault chat; seed owner ✅ `main`

## D-023 — Announce on a weekend, upload on Monday
- **Decision:** Announce on a weekend and upload on Monday, so games start the same Monday as the rules. (v6 actual upload: Mon 2 Nov 02:33 UTC.)
- **Source:** 💬 Vault chat

## D-024 — Launch games as soon as ready; vault upgrades need 48 h notice
- **Decision:** Launch as many games as possible as soon as they're ready and upgrade game contracts during the week. The vault itself needs a 48 h notice for any upgrade.
- **Source:** 💬 Vault chat

## D-025 — Branch hygiene for `vault-v6`
- **Decision:** Freeze `vault-v6` after the fingerprint check; don't rebuild or pull in `C:\kprediction-vault` before an upload. Pushing the backup branch `vault-v6-next` is established practice.
- **Source:** 💬 Vault chat

## D-026 — Merges only on the owner's explicit OK
- **Decision:** One branch and PR per build. Merge only on the owner's explicit "merge N"; AI chats never push to `main` or deploy otherwise.
- **Source:** 💬 Hub, Race chats

## D-027 — Sponsor pays stake, withdraw and claim — never `move_stake`
- **Date:** 2026-10-30 (owner) · **Source:** 💬 Hub. On-chain gap: see I-021.

## D-028 — Sponsor caps 25 Mana per wallet per day, 150 per week
- **Decision:** 25 Mana per wallet per day and 150 per week, with no extra cap. The sponsor's KOIN is sized from measured use once everything is live.
- **Note:** matches `bot/sponsor.ts` defaults; the everyone-per-day and free-per-day totals remain open in C-02.
- **Source:** 💬 Hub

## D-029 — Prize and liability rules
- **Decision:** A prize shortfall is cut and never owed later. Balances always cover total liabilities. Free-game rewards are extra and come second to stakers. No free-game prizes until the vault is fully live (⚠️ timing: C-10).
- **Source:** 💬 Hub. Standard: `standards/VAULT_STANDARD.md`

## D-030 — Names: one Koinos @name per wallet
- **Date:** 2026-10-30 (owner)
- **Decision:** One name per wallet: the Koinos @name. The signed Knode Games name claim + GitHub step was removed from the site; older claims are still honoured. Producers show their pool names. Lookalike false positives are accepted (Clover/Dover, Mario/Mano; "Node 123456" refused as address-like).
- **Source:** 💬 Hub

## D-031 — Staking UX: simple, share %, badge on every game page
- **Date:** 2026-10-30 (owner-approved)
- **Decision:** Stake, withdraw, move and claim take a couple of taps; show the share % against the game total. The status badge sits at the top of every game page, with the full panel lower down.
- **Source:** 💬 Hub, Race chats

## D-032 — New games launch on Mondays, one at a time ⚠️
- **Decision (Hub):** new games launch on Mondays, one at a time.
- **Conflict:** the Vault chat plans to add games 2, 7 and 9 (plus 8 and 13 if cleared) together this week (D-024). See C-14.

## D-033 — Build 2: Race Show scoring, home page, dapp name
- **Date:** 2026-10-27
- **Decision:** Race Show scores win 3, show 1 (2nd or 3rd with at least one step). The welcome page stays the home page and lists every game. No "New" tag on games. The KOIN Vault dapp name stays "Knode", with connect text "approve Knode (KnodeGames)", until the KOIN Vault developer is asked (I-007).
- **Source:** 💬 Race chat

## D-034 — Producer Race: stakes, ranking, ties, prizes, medals
- **Stakes (28 Oct):** the Race is set up as `--staked --free`. Staked = staked in game 7 that week; everyone else (guests included) plays free. Staked players share the game's bucket; free players play for 2 VHP and 1 VHP; any free player can win (no holding or minimum play).
- **Ranking (28 Oct):** points, then wins, then picks placed; wallets still tied share the place. Daily Questions tie-breaks dropped (option A).
- **Ties:** a tie for 1st shares all 3 VHP and 2nd stays empty. More than 10 tied for a place: the 10 with the earliest first pick that week share it; the rest get nothing.
- **Unfinalized race:** skipped 12 hours after its week ends; its picks don't count; listed in `skipped`.
- **Medals (29 Oct):** only wallets that earn, only on weekly boards. Free play: paid 1st and 2nd. Staked: the vault's top 30% by headcount, rounded up, tied groups taken whole.
- **Source:** 💬 Race chat. Full game spec belongs in `.ai/games/` (not yet written).

## D-035 — The Race chat owns all Race files
- **Date:** 2026-10-29 · **Decision:** The Race chat owns all Race files (list in `PLATFORM.md` → Chats); other chats send Race requests through the owner. Written rule: `claude/owners-race.md`.
- **Source:** 💬 Race, Hub chats

---

## Contradictions Register
Repo wins per D-002 unless the owner rules otherwise. "Ruling" = what the docs currently say.

| ID | Topic | Archive (chat) says | Repo says | Ruling / action |
|----|-------|---------------------|-----------|-----------------|
| C-01 | Sponsor version on chain | Questions: v2 `fa4659e6`. Vault: v3 `b61ac238` live (PR #38 merged) | `picks` record: v3 uploaded 2026-10-30. `main` record (`sponsor-data/deployment.json`): still v2, uploaded 2026-10-27 | Likely v3; `main`'s record looks stale. ❓ Confirm with `npm run sponsor -- status` |
| C-02 | Sponsor caps (per tx / player-day / player-week / all-day / free-day) | 3 / 10 / 65 / 1,000 / 300 | `bot/sponsor.ts` defaults: 1 / 25 / 150 / 5,000 / 2,000 (owner 2026-10-28/29); v2 rollback can't exceed 1,000/day | **Owner decision needed.** Live on-chain values unknown Hub (D-028): 25 / 150 per wallet, "no extra cap" — per-wallet values now agreed by repo + Hub; everyone-day and free-day totals still ❓ |
| C-03 | Sponsor wallet KOIN | 5,000 KOIN | `bot/sponsor.ts` comment: at least 25,000 KOIN to fund 5,000/day | Tied to C-02. ❓ Check balance Hub: KOIN to be sized from measured use once everything is live |
| C-04 | Site read RPC | Questions: site uses `api.koinos.io` (Armana CORS failures). Vault: Armana is default (`main` switched 2026-10-28); `api.koinos.io` returns HTML errors | `app.js`, `swap.js`, `header-wallet.js` all hard-code `koinos.armana.io`; game/desk/race deployments use Armana, sponsor/picks use `api.koinos.io` | Repo (`picks` branch): Armana. ❓ GitHub `main` may differ (branch `armana-rpc` exists) |
| C-05 | `rcLimitOther` | 3 Mana | `game-data/deployment.json`: 1 Mana (audit SP-17); game `maxSponsorRc` 2 Mana | Repo: 1 Mana |
| C-06 | Repo name | Questions: `bawcejawn/KnodeGames`. Vault: `bawcejawn/Knode` | local `origin` still `bawcejawn/Knode.git` | ✅ Resolved 2026-11-02: GitHub says the repo moved to `bawcejawn/KnodeGames` (old URL redirects) |
| C-07 | Platform name | "KnodeGames" | mixed | Resolved by D-001: "Knode Games" |
| C-08 | Week boundary time | Week 2 closes Mon 2 Nov 21:00 UTC | genesis Mon 19 Oct 00:00 UTC, 7-day weeks, 12 h close delay, 24 h settle | ❓ Explain where 21:00 UTC comes from (bot schedule?). Vault chat's first vault close is Mon 16 Nov 12:00 UTC, which matches genesis + close delay Hub/Race: weeks run Mon–Mon 00:00 UTC, week 0 = Mon 19 Oct, so vault week 2 = Mon 2 Nov — the Questions chat's "Week 3" is the same week counted from 1. The 21:00 UTC time is still unexplained |
| C-09 | Vault | questions game is `Q_GAME = 1` in the Vault | `main`: Vault v6 is the game contract `1Mpmf2…`, upgraded in place 2026-11-02 (`eed38f7c…`) | ✅ Resolved 2026-11-02: game 1 is built into the vault |
| C-10 | When new prize rules start | Questions: 40/60 split + 2 VHP free prize from Week 3 (Mon 2 Nov), `reward_rule_week_plus_one=3`. Vault: v6 rules + 2 + 1 VHP free prizes from Mon 9 Nov (`v6_rule_week_plus_one`) | not checked | ❓ Are these two different rules (v5 reward rule vs v6 rules)? Which free prize applies to the questions game, and from when? Hub (D-029): no free-game prizes until the vault is fully live. Race: its week 1 vault file is final with 1st/2nd free winners, while the Race page still says prizes start once the vault is live |
| C-11 | Bot wallet | Vault: "bot wallet" `1JSTwo…` | `docs/history/AUDIT-2026-10-19.md` lists `1JSTwo…` as the Operator; current operator is `1HsM33…` | ❓ Is `1JSTwo…` the old operator, or still in use? Race chat's owner checklist says "empty the old bot and test wallets" — supports old-operator reading |
| C-12 | Race status | Vault: game 7 "ready to announce" | `games.json`: Race "live"; PR #44 badge ✅ merged | ✅ Resolved 2026-11-02 (Hub): Race is live as a game; its vault registration (`game-add 7`) is pending |
| C-13 | Survivor type | Hub: "a free game" | Vault (D-018): Survivor added `--staked --free` | ❓ Staked + free, or free only? |
| C-14 | Launch pace and order | Hub: Mondays, one at a time; order Block X + Race → Block X live → Survivor → Golf staked → LNS → Bracket → Fantasy → Combo. Vault: announce 2, 7, 9 (+8, 13 if cleared) together by Fri 6 Nov; launch as many as are ready (D-024) | — | ❓ Owner decision |
| C-15 | Seed owner move | Race chat's owner checklist: "move the seed and Desk owner" | Vault: seed owner already handed to `1K8VV…` on 30 Oct ✅ `seedOwner` on `main` | ❓ Stale checklist item, or a further move (e.g. to the hardware wallet)? |
