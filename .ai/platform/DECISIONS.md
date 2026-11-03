# Knode Games — Decision Log

> Purpose: Record of decisions made, newest first. This file wins over any other .ai file.
> Rule: Never delete a decision. If it changes, add a new entry and mark the old one "superseded by D-XXX" in the index.
> Consolidated 2026-11-02: the owner's answers to the open contradictions are recorded as D-061 – D-067.
> Last updated: 2026-11-02
> Sources: owner in chat (2026-11-02), `.ai/archive/CHAT_KNOWLEDGE.md` (all 12 chats), repo branches `picks` and `main`.

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
| D-008 | ❓ | Mana sponsor daily hard cap (1,000) | superseded by D-061 |
| D-009 | ❓ | Guest play on (web and mobile) | active |
| D-010 | ❓ | New prize rules start Week 3 | superseded by D-062 (free prizes) |
| D-011 | ❓ | Rules page in tabs; Race removed from footer; hourly VHP refresh | active |
| D-012 | ❓ | GitHub: one secret, no PR requirement | active |
| D-013 | ❓ | Wallet handovers done by owner | pending |
| D-014 | ❓ | Full platform audit waits for owner go-ahead | pending |
| D-015 | ❓ | How assistants communicate with the owner | active |
| D-016 | ❓ | Only the vault holds tokens; all staked VHP withdrawable at all times | active |
| D-017 | 2026-10-29 | Owner's own audit programs count as the audit | active |
| D-018 | ❓ | Every game is stakeable | active |
| D-019 | 2026-10-30 | Producer Bracket: staked + free prize, 1-week seasons | active |
| D-020 | ❓ | Survivor: 2-week seasons, Season 1 from Mon 16 Nov | active (date confirmed by D-065; prize ⚠️ C-24) |
| D-021 | ❓ | Keep a withdrawals-only emergency build | active |
| D-022 | 2026-10-30 | Vault seed: 20,000 VHP from a dedicated seed owner | active |
| D-023 | ❓ | Announce on a weekend, upload on Monday | active |
| D-024 | ❓ | Launch games as soon as ready; vault upgrades need 48 h notice | active |
| D-025 | ❓ | Branch hygiene for `vault-v6` | active |
| D-026 | ❓ | Merges only on the owner's explicit OK | active |
| D-027 | 2026-10-30 | Sponsor pays stake, withdraw and claim — never `move_stake` | active |
| D-028 | ❓ | Sponsor caps 25 Mana per wallet per day, 150 per week | active (see D-061) |
| D-029 | ❓ | Prize and liability rules | active |
| D-030 | 2026-10-30 | Names: one Koinos @name per wallet | active |
| D-031 | 2026-10-30 | Staking UX: simple, share %, badge on every game page | active |
| D-032 | ❓ | New games launch on Mondays, one at a time | superseded by D-052 |
| D-033 | 2026-10-27 | Build 2: Race Show scoring, home page, dapp name | active |
| D-034 | 2026-10-28/29 | Producer Race: stakes, ranking, ties, prizes, medals | active |
| D-035 | 2026-10-29 | The Race chat owns all Race files | active |
| D-036 | ❓ | Split launch: Block X live prize-free first | active |
| D-037 | 2026-10-30 | One change per pick | active |
| D-038 | ❓ | Picks sponsor row 0.2 Mana; 0.25 at Combo launch | active |
| D-039 | ❓ | The swap desk pays its own Mana | active |
| D-040 | ❓ | Block X: neighbour-time rule removed; BX-137 accepted | active |
| D-041 | ❓ | V4, B1-1, B1-5 shipped on the v6 upload day; status bar rides the Block X launch PR | active |
| D-042 | ❓ | Engineering standing rules | active |
| D-043 | 2026-10-28 | The repo stays public | active |
| D-044 | 2026-10-16 | Swap desk design | active |
| D-045 | ❓ | Questions game v5 rewards and schedule | active, except the free prize (superseded by D-062) |
| D-046 | 2026-10-28 | Who pays Mana: bot, players, game contract | active (see I-044) |
| D-047 | 2026-10-28 | Questions release at 12:00 UTC on the dot | active |
| D-048 | 2026-10-23 | Self-heal and alerts | active |
| D-049 | 2026-10-23 | Skip v4: game v5 with Desk v2 | done (superseded by Vault v6) |
| D-050 | ❓ | Site content trims | active |
| D-051 | 2026-10-27/30 | Survivor rules | active (pending audit pass 4) |
| D-052 | 2026-11-02 | Announce every game before Friday | target only — gated by D-064 |
| D-053 | 2026-11-02 | The Mana sponsor is the only payer; Mana Station shelved | active |
| D-054 | 2026-10-28/30 | Last Node Standing rules | active (pending round-3 review) |
| D-055 | 2026-10-30 | Last Node watch-and-hold and its accepted trade-off | active |
| D-056 | 2026-10-28 | Block Golf redesign and rules | active |
| D-057 | 2026-10-28/29 | Producer Bracket rules | active (pending audit) |
| D-058 | 2026-10-28 | The KnodeGames VHP standard | active |
| D-059 | 2026-10-27/29 | Fantasy Producers and Weekly Rival rules | active (pending fix-check) |
| D-060 | ❓ | Combo Card rules | active (pending fix-check 4) |
| D-061 | 2026-11-02 | Sponsor funding and daily cap | active |
| D-062 | 2026-11-02 | 2 + 1 VHP free prizes on every free game, from the vault's start | active |
| D-063 | 2026-11-02 | The week of 9 Nov is "Week 1"; earlier weeks don't pay | active |
| D-064 | 2026-11-02 | Announce only the built, audited, best version | active |
| D-065 | 2026-11-02 | Survivor Season 1 starts Mon 16 Nov | active |
| D-066 | 2026-11-02 | Public testnet only; three mainnet nodes | active |
| D-067 | 2026-11-02 | Block X: nothing announced yet; redo or apply only when ready | active |
| D-068 | 2026-11-02 | Free prizes are per week; multi-week seasons pay once, at season end | active |
| D-069 | 2026-11-02 | Questions game Week 3 pays its on-chain v5 free prize (1 + 1 VHP); no upgrade | active |

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

## D-036 — Split launch: Block X live prize-free first
- **Decision:** Contracts first. Block X goes live prize-free; the scoring fixes happen off-chain before Vault v6 prizes (fix list: I-042).
- **Source:** 💬 Block X

## D-037 — One change per pick
- **Date:** 2026-10-30 (owner) · **Decision:** One change per pick instead of 5; the page says "change it once". ✅ `blockx-math.js` `maxChanges: 1` on `picks`.
- **Source:** 💬 Block X

## D-038 — Picks sponsor row 0.2 Mana; 0.25 at Combo launch
- **Decision:** The Picks `pick` row is 0.2 Mana (chain row and the site's `rcLimits`). Raise it to 0.25 at Combo launch, not now: testnet 6-leg and 10-leg cards used 0.1313 and 0.1457 Mana, only 1.37× under 0.2, below the 1.5× headroom rule. Block X single picks (0.116 Mana) are fine at 0.2.
- **Source:** 💬 Block X

## D-039 — The swap desk pays its own Mana
- **Decision:** The swap pays its own Mana (PR #39); picks are sponsored (PR #40); sponsor-only change in PR #38. ✅ `desk-data/deployment.json` `payer: self`.
- **Source:** 💬 Block X

## D-040 — Block X: neighbour-time rule removed; BX-137 accepted
- **Decision:** The neighbour-time rule was removed because it caused honest stalls; the BX-97 week-end re-read moved to before prizes. BX-137 accepted: the test clock variables aren't refused in GitHub Actions, because CI runs the tests there.
- **Source:** 💬 Block X

## D-041 — V4, B1-1, B1-5 on the v6 upload day; status bar rides the Block X launch PR
- **Decision:** V4, B1-1 and B1-5 were held until the v6 upload day (any earlier change would be outside the Repo Lens GO, and it is race-card code). The Hub's status bar goes to `main` in the Block X launch PR, not a separate PR.
- **Source:** 💬 Block X

## D-042 — Engineering standing rules
- **Decision:** Root-cause fixes, and a blind review before each Repo Lens round. Mainnet steps one at a time, as PowerShell blocks for `C:\kprediction`. If a key or WIF is ever pasted, tell the owner to rotate it. (Merging and pushing rules: D-026. Keys: D-003.)
- **Source:** 💬 Block X

## D-043 — The repo stays public
- **Date:** 2026-10-28 · **Decision:** `bawcejawn/KnodeGames` stays public, so GitHub Actions and Pages cost nothing (a private repo would cost ~$75–120 a month, estimate).
- **Source:** 💬 Swap Desk

## D-044 — Swap desk design
- **Date:** 2026-10-16
- **Decision:** A separate contract with a flat 3% fee. The desk node's VHP (fees included) produces blocks, which refills the KOIN on offer ("burn without burning"). Kept separate from game and personal funds. The treasury stays the owner wallet for now; changing it has a 48 h timelock.
- **Source:** 💬 Swap Desk

## D-045 — Questions game v5 rewards and schedule
- **Schedule:** five questions Monday–Saturday at 12:00 UTC (D-047); answers close at 00:00 UTC; Sunday is results day; corrections until Monday 12:00; winners final Tuesday 12:00 when everything runs on time. At most 30 questions a week. Types: producer quartiles, group block counts, transactions in a window, largest gap, average interval (templates M1, M4, M5, M7, M10; model v5; `hashRule` 2). 💬 Swap Desk
- **Superseded part:** the 1 + 1 VHP free prize from 2 Nov is replaced by D-062.
- **Decision (from the week starting Mon 2 Nov):** take the 5% fee; take a 2 VHP free-player prize (1 VHP each to the best 2 free players); split the rest 40% to basket A (place weight × stake, capped at 10 VHP per wallet) and 60% to basket B (place weight × full stake). Winners are the top 30% of staked players with at least 1 point; minimum stake 1 VHP.
- **Note:** this is the "40/60 split" of D-010. Applies to game 1; free prizes for every game now follow D-062.
- **Source:** 💬 Swap Desk

## D-046 — Who pays Mana: bot, players, game contract
- **Date:** 2026-10-28
- **Decision:** The bot wallet pays its own Mana (post, resolve, compound, settle); the owner tops up its KOIN, target 50. The sponsor pays for every player transaction; past the caps, players pay their own (PR #28). The owner chose not to set the game contract's `max_sponsor_rc` to 0 for now — it stays 2 KOIN ✅ on chain record and in `deployment.json`.
- **Finding behind it:** adding seed KOIN does not increase producing VHP; at steady state idle KOIN ≈ 5 × the daily Mana spend; the fix is to stop others spending the contract's Mana (I-044).
- **Source:** 💬 Swap Desk

## D-047 — Questions release at 12:00 UTC on the dot
- **Date:** 2026-10-28 · **Decision:** For the site's integrity, questions come out at exactly 12:00 UTC: an 11:48 release run, the bot waiting for 12:00, and a backup starter on the owner's PC. The PC task runs only 11:45–14:05 UTC and is stored in UTC so daylight saving can't move it.
- **Source:** 💬 Swap Desk; release cron ✅ `bot.yml`

## D-048 — Self-heal and alerts
- **Date:** 2026-10-23 · **Decision:** Nodes are checked every 20 minutes and every heal emails the owner; the down-alert watchdog is based on the personal node.
- **Source:** 💬 Swap Desk

## D-049 — Skip v4: game v5 with Desk v2
- **Date:** 2026-10-23 · **Decision:** Go straight to game v5 together with Desk v2 (live 28 Oct ~19:25 UTC; game v5 replaced v3 `917708a7…`, Desk v2 replaced v1 `05039d74…`). Game v5 has since been upgraded to Vault v6.
- **Source:** 💬 Swap Desk; hashes ✅ deployment files

## D-050 — Site content trims
- **Decision:** Koinosscan replaced the KoinosProof footer link; the song was removed from the Learn page; the "Swap now or wait" calculator and the "added since you opened" stat were removed.
- **Source:** 💬 Swap Desk

## D-051 — Survivor rules
- **27 Oct:** the handicap comes from recent blocks, not VHP: h = kTop ÷ k, where k is the producer's own blocks over days d−8 … d−2 (a VHP handicap would put producers signing only 75–80% of their share in the out-zone ~90% of days). Ties at the out-zone line are safe. A prize needs 1 VHP (or a stake) at every daily check. Knode's two producers stay in the field, disclosed on the page. Launch waits for the other launch pieces.
- **28 Oct:** a season needs 3+ players with 2+ valid picks; a player knocked out by a missed pick gets no prize; no promise that Knode-run wallets stay out (open market); testnet first, then the audit bot; Survivor is the second new game to launch.
- **29 Oct:** a staked board and a free board; the free prize goes only to players free in both weeks of the season (still needs 1 VHP); staked weekly points come from season standings at each week's end; Survivor waits for the Hub's shared stake panel.
- **30 Oct:** SV-A2 — the 3-player minimum stays. SV-A10 — free players must not reduce staked players' chances or get more than the free prize; each board has its own safety net and end, and the free board counts only wallets that can still win. SV-A19 — a knockout by an invalid pick (not in the field, or already used) can't win.
- **Game rules as built:** 14 UTC-day seasons, Monday to Monday. One producer per UTC day; picks lock 5 min before 00:00 UTC and open 7 days ahead; up to 5 changes and 20 picks a day; join by picking day 1. Out-zone = floor(field × (12 + day) ÷ 52) (17 producers: 4,4,4,5,5,5,6,6,6,7,7,7,8,8). Field = producers with 280+ blocks in the 7-day window. 2 lives; a life is lost for an out-zone pick, no pick, a producer not in the field, or one already used (each producer once a season). Each board's safety net saves only out-zone losses; a board ends after the day that leaves 2 or fewer counted players (if more than 2 started), when none is left, or after day 14; the final comes 12 h after both boards end. Ranking: lasted longest, then lives, then total score. Free prize 4 / 2 VHP, ties split, only for players free in both weeks, holding 1 VHP at every check, not knocked out by a missed or invalid pick, in a season with 3+ such players. Staked vault points come from the staked board; points collapse to 1 beyond 255 places.
- **Simulation** (field of 17, `claude/builds/04-survivor-sim.mjs`): 10 players → ends about day 11; 50 → about day 13; 200 → ~4 still in on day 14, ranking decides.
- **Source:** 💬 Survivor. Full spec belongs in `.ai/games/` (not yet written); repo `docs/SURVIVOR.md` ✅ on branch `survivor`.

## D-052 — Announce every game before Friday
- **Date:** 2026-11-02 (owner, this chat)
- **Decision:** Get all the games announced before Friday 6 Nov, so everything is upgraded and available to play the following week.
- **Effect:** settles C-14 in favour of launching together this week (over D-032's one game per Monday). Readiness differs per game: see I-050 (Survivor), I-016 (Combo, Last Node), I-019 (admin vault buttons).
- **Source:** owner

## D-053 — The Mana sponsor is the only payer; Mana Station shelved
- **Date:** 2026-11-02 (owner) · **Decision:** Use the Mana sponsor for now — it is the easiest and best solution. The Mana Station idea is scratched for now, to revisit another time.

## D-054 — Last Node Standing rules
- **Field:** from the race card at 12:00 UTC the day before (or the next leg's card if taken before picks open); nodes at ≥ 20 blocks an hour by VHP, at most 23; h = (kTop/k)(1 − c/√k)/(1 − c/√kTop), 4 decimals, c on a 0–2.5 grid from 20,000 seeded simulations.
- **Form:** 48 h of blocks ÷ the blocks the VHP share gives, hour by hour against that hour's average VHP from 5-minute samples; kept within 0.80–1.20; at least 24 usable hours. **Launch gate:** no field without form on mainnet unless `LASTNODE_ALLOW_NO_FORM=true`; the owner chose to wait for the sampler.
- **Picks:** one per event: a start node plus an optional backup, before the start; the backup takes over at the start node's first cut if still standing (one jump). Cuts hourly from 14:00 UTC; rounds target 13:55 UTC; picks open 24 h ahead, lock 13:50 UTC.
- **Points:** 1 per cut survived, +5 for riding the last node without jumping or +3 after a jump. Board: points, then rides, then fewer jumps; exact ties share. The field grows organically.
- **Race-time cut:** VHP added after the field card can only lower a multiplier; each window is judged by the first race card at or after its end (with none 2 h later, the latest card by its end); hours recorded ~30 min after they end.
- **Process:** wait for clean reviews and audits before any merge to `main`; don't touch `picks/assembly/Picks.ts`.
- **Source:** 💬 Last Node

## D-055 — Last Node watch-and-hold and its accepted trade-off
- **Decision:** Flag a node at weekly z ≥ 3.4 with at least 2 wins, or z ≥ 5 in one event it won (blocks count in every window, also after the cut; noise = leave-one-out over-dispersion). The vault file is held until released with `LASTNODE_RELEASE_WEEKS` (digits and commas only), enforced by the publish job too.
- **Accepted (owner, 30 Oct, N-6):** a 3% form-skimmer is caught in ~13% of weeks, one gamed event in ~98%, and honest weeks are held 1–1.5% of the time; tests pin these rates.
- **Source:** 💬 Last Node

## D-056 — Block Golf redesign and rules
- **Date:** 2026-10-28 (owner) · **Decision:** Every live game is a par-4 hole; a player's place on that game's weekly board sets their strokes: 1st (if scored) 1, top 5% 2, top 25% 3, top 65% 4, top 90% 5, the rest or scored 0 → 6, didn't play → 7 (lost ball); ties share the middle place. The 27 Oct "guess the block gap" design is dropped (on real data, gaps were luck).
- **Mulligan:** the worst *played* hole is dropped (not a lost ball). All holes count the same. The question-game hole keeps Golf's simpler rule.
- **Practice:** free scorecards from the Block X launch week, no prizes; every scorer counts; 3 players make a hole. No testnet run — practice weeks on mainnet are the trial. Games join the course automatically from the Monday after they go live.
- **Staked weeks:** only players staked in Block Golf count, weighted by VHP staked (a player's own stake never moves them); a hole needs 5 stakers AND 10 VHP (Claude's defaults; owner can change). Points = 7 × counted holes − strokes; rows only with ≥ 1 point; a week with no staked scorers still gets an empty file.
- **Finality:** final 12 h after the week, once every hole is final and the run had no read problem; a hole not final by 60 h is skipped; from 66 h a read problem no longer blocks; a staked hole is final only after stakes are read after the week ends. `GOLF_STAKED_FROM_WEEK` fixes practice vs staked per week, can't change once published, refused until the v6 ABI is merged.
- **Source:** 💬 Block Golf

## D-057 — Producer Bracket rules
- **Bracket:** the whole bracket is one number (bit n = "the lower seed wins matchup n"; bye bits 0; sizes 8/16/32; `NUMBER_MAX` 2³¹−1). Seeding Saturday 12:00 UTC; lock Sunday 23:55 UTC; one round per UTC day from Monday. Under 8 producers → no bracket; 8–11 → 8; 12–15 → 16 with byes; 16–31 → top 16; 32+ → 32.
- **Seeding and matchups:** averageVhp over 28,800 blocks on two agreeing nodes (biggest = seed 1; not seeded within 24 h → void). Matchup by baseline + credit; index = credited ÷ expected; exact tie → lower seed. Forfeit (S-5, owner yes): a seed whose baseline is under 0.5 × its seeding VHP loses; both forfeit → the index decides. No producer left out unless below minimum production; Knode's own nodes play (29 Oct). The vault never forfeits (its VHP is players' stakes, recorded as `pooled`).
- **Points:** 1/2/4/8/16 by round, +2 for the champion; byes score nothing. Tie-break: points → right champion → more right winners → who submitted first (last-change time, 29 Oct); same block shares.
- **Players:** staked = at least the vault minimum (1 VHP) in this game; staked at the week's start stays staked that week. Free prize 2 + 1 VHP; tied 1st share all 3; a single 1st → tied 2nd share 1; at most 10 per place; minimum play one bracket with ≥ 1 point; guests eligible. Free play board shows the top 6.
- **Source:** 💬 Bracket

## D-058 — The KnodeGames VHP standard
- **Date:** 2026-10-28 · **Decision:** Option A — exact VHP from the chain's own events. Every game measures VHP the same way (`vhp-standard.js`); multipliers stay game-specific. Details: `ARCHITECTURE.md` → VHP standard.
- **Source:** 💬 Bracket

## D-059 — Fantasy Producers and Weekly Rival rules
- **Team (27–29 Oct):** pick 5 different producers costing ≤ 100 from the week's price list; first is captain ×2. Each day a producer scores 100 × signed ÷ expected, at most 130; the week is the sum of 7 days. One change a day (swap one, or move the captain); picks lock 5 min before each day; a team that breaks a rule is ignored and the previous team plays; late joiners score 0 for earlier days. Each week starts fresh; last week's team carries into Monday only if it fits the new prices.
- **Prices:** 20 + 1.5 × (form − median form), clamped 8–40; published with its sha256 Saturday 00:00 UTC from the previous 7 days, never remade. Teams can be planned up to 7 days ahead. Knode's two nodes stay in the pool, disclosed.
- **Prizes:** the top 30% of Fantasy stakers with ≥ 1 point share Fantasy's part; vault points 255 for the best week, one less per lower distinct score, never below 1, ranked among stakers only. A week is final 12 h after it ends.
- **Weekly Rival:** one challenge a week (changeable until the week's first lock); a match counts only if both had a team all 7 days and both are staked; records keep made and received apart; no prize. An all-time table (total, weeks played, best week), no prize.
- **Other:** practice on the testnet scored on mainnet blocks (1 test day = 1 hour, with robots); the page must feel inviting, professional and fun, and explain every number; Terms section 3 (`terms.html`). Standing rule from this chat: new games launch on a Monday.
- **Producer names:** the Fantasy chat's signed-claim plan was superseded by D-030 (Koinos @names).
- **Source:** 💬 Fantasy

## D-060 — Combo Card rules
- **Legs:** Win, Show, Top half (on 6-hour Race races) and Block X; up to 3 legs per race (one of each); one leg per producer per card. Race legs lock 25 min before the start, open 24 h ahead; Block X legs lock 500 blocks before the target, open 28,800 ahead.
- **Cards:** 3 a day, each changeable up to 3 times; the game runs at 6 legs (contract allows 10). Worth = clamp(0.5 / chance, 0.25, 3); Block X keeps ×3 as its cap. Points by legs: 2→3, 3→7, 4→15, 5→30, 6→60 (… 10→960); no point cap. 10% rule kept (RL-16); a horse missing from standings is void, dropped (RL-15).
- **Players:** stake-only; at least 1 full point in the week; a week = best 10 cards; ties: more hits, the earlier last hit, address. Vault points by board rank.
- **Order and security:** the CARD upgrade goes on chain after Block X launches. Build the verify job (owner, 30 Oct, FC3-3). Unresolved legs never let a card score. Vault files are write-once; published final cards are immutable.
- **Source:** 💬 Combo

---

## D-061 — Sponsor funding and daily cap
- **Date:** 2026-11-02 (owner) · **Decision:** The Mana sponsor wallet holds 25,000 KOIN, with a daily cap of 5,000 Mana for everyone. Per-wallet caps stay 25 a day and 150 a week (D-028); 1 per transaction; 2,000 a day for free players (✅ `bot/sponsor.ts` defaults).
- **Note:** when switching the sponsor to the vault, pass these caps exactly — a plain `config` resets them (ARCHITECTURE → Mana sponsor).

## D-062 — 2 + 1 VHP free prizes on every free game, from the vault's start
- **Date:** 2026-11-02 (owner) · **Decision:** Every free game pays 2 VHP for 1st and 1 VHP for 2nd, and they all start when the vault starts (the v6 rules week, Mon 9 Nov). Supersedes the Questions game's 1 + 1 from 2 Nov (D-045) and D-010.
- **Survivor:** settled by D-068 (C-24). The Questions game's Week 3 (2–9 Nov) pays its on-chain 1 + 1 VHP; the owner accepted it (D-069).

## D-063 — The week of 9 Nov is "Week 1"; earlier weeks don't pay
- **Date:** 2026-11-02 (owner) · **Decision:** A UI refresh makes the week starting Mon 9 Nov the real "Week 1" for players. Weeks before it — including the Race's final week-1 vault file with free winners — pay no free prizes.
- **How (to confirm with the Hub chat):** on-chain and file week numbers stay as they are (vault week 0 = 19 Oct, so 9 Nov is vault week 3); only what players see changes (I-069). ❓

## D-064 — Announce only the built, audited, best version
- **Date:** 2026-11-02 (owner) · **Decision:** Don't announce anything until we're confident it is built and ready to release, so we announce only the correct and best version. Friday 6 Nov (D-052) stays the target, not a deadline.

## D-065 — Survivor Season 1 starts Mon 16 Nov
- **Date:** 2026-11-02 (owner) · **Decision:** Survivor's Season 1 starts Monday 16 Nov 2026 (`FIRST_DAY`), subject to D-064 and its open prerequisites (I-050).

## D-066 — Public testnet only; three mainnet nodes
- **Date:** 2026-11-02 (owner) · **Decision:** The project uses only the public Koinos Foundation testnet. There are no testnet nodes on the owner's PC — only the three mainnet nodes. Tooling that targets a local "Harbinger" testnet node is unused (I-068).

## D-067 — Block X: nothing announced yet; redo or apply only when ready
- **Date:** 2026-11-02 (owner) · **Decision:** Nothing about Block X has been announced to players. If an earlier on-chain announcement of game 2 exists on the Picks contract (the Block X chat reported one, applicable from Sun 1 Nov 21:23 UTC), either cancel it and announce again, or apply it only when the best build is ready (I-070).

## D-068 — Free prizes are per week; multi-week seasons pay once, at season end
- **Date:** 2026-11-02 (owner) · **Decision:** The free prize is 2 + 1 VHP per week. A game with a 2-week season, like Survivor, pays 4 + 2 VHP for the season, paid once to the season's winners when the season ends — not split into weekly payouts. Confirms D-020 and D-051.

## D-069 — Questions game Week 3 pays its on-chain v5 free prize
- **Date:** 2026-11-02 (owner) · **Decision:** Accept it. The Questions game's Week 3 (Mon 2 – Mon 9 Nov, paid Tue 10 Nov ≈ 12:07 UTC) pays free players the v5 free prize already fixed on chain (`reward_rule_week_plus_one=3`): up to 2 VHP from that week's pot — best score 1 VHP, the 2nd score's players share 1 VHP (a tie for best splits all 2; a lone free scorer gets 1 and the other 1 goes to basket B; nobody qualifies → all to basket B). No contract upgrade. This is a one-week exception to D-062/D-063 for game 1 only; every free game, game 1 included, pays 2 + 1 VHP from Mon 9 Nov (v6). Resolves C-25 and I-067.

---

## Contradictions
Repo wins over chats (D-002); the owner's answers win over both.

### Open
| ID | Topic | What disagrees | Next step |
|----|-------|----------------|-----------|

### Resolved
| ID | Topic | Resolution | How |
|----|-------|-----------|-----|
| C-25 | Questions game free prize on chain | Week 3 pays the v5 1 + 1 VHP as fixed on chain; v6 2 + 1 from Mon 9 Nov | owner, 2026-11-02 (D-069) |
| C-08 | Questions payout time | Tue 12:00 UTC on time (≈ 12:07 when the hourly bot finalizes); 21:00 came from a chat check-in reminder, not code | chain + repo, Questions chat 2026-11-02 (I-066) |
| C-01 | Sponsor version | v3 `b61ac238…` is live; `main`'s record is stale (I-043) | repo + 3 chats |
| C-02 | Sponsor caps | 1 / 25 / 150 / 5,000 / 2,000 Mana; the 1,000/day set was the v2 era | owner (D-061), repo |
| C-03 | Sponsor KOIN | 25,000 KOIN in the wallet | owner (D-061) |
| C-04 | Site read RPC | Armana everywhere | repo |
| C-05 | `rcLimitOther` | 1 Mana (3 was the v2-era value) | repo |
| C-06 | Repo name | `bawcejawn/KnodeGames` | GitHub |
| C-07 | Platform name | "Knode Games" | owner (D-001) |
| C-09 | Vault | Vault v6 is the game contract; game 1 built in | repo |
| C-10 | Prize start | every free game 2 + 1 from the vault's start | owner (D-062) |
| C-11 | "Bot wallet" `1JSTwo…` | the old operator, retired 26 Oct | Swap Desk chat |
| C-12 | Race status | live as a game; vault registration pending | Hub chat |
| C-13 | Survivor type | staked board + free board | Survivor chat |
| C-14 | Launch pace | every game, each when ready | owner (D-052, D-064) |
| C-15 | "Move the seed" | stale — the seed owner moved 30 Oct | owner |
| C-16 | Race week 1 free winners | not paid; 9 Nov becomes Week 1 | owner (D-063) |
| C-17 | Desk payout cap | no daily cap | later decision (D-007) |
| C-18 | Survivor Season 1 | Mon 16 Nov | owner (D-065) |
| C-19 | Testnet node | none; public testnet only | owner (D-066) |
| C-20 | Bracket readiness | not announced until audited and ready | owner (D-064) |
| C-21 | Producer names | Koinos @names | later decision (D-030) |
| C-22 | Fantasy results path | same place: the vault bot reads `games-data:fantasy/vault/W<week>.json`, which is where Fantasy writes | code ✅ (`bot/vault.ts`, `bot/games/fantasy.ts`) |
| C-23 | Launch order | superseded by D-052 / D-064 | owner |
| C-24 | Survivor free prize | 2 + 1 per week = 4 + 2 per 2-week season, paid once at season end | owner (D-068) |
