# Knode Games — Decision Log

> Purpose: Record of decisions made, newest first. This file wins over any other .ai file.
> Rule: Never delete a decision. If it changes, add a new entry and mark the old one "superseded by D-XXX" in the index.
> Consolidated 2026-11-02: the owner's answers to the open contradictions are recorded as D-061 – D-067.
> Last updated: 2026-11-03 (cleanup: statuses brought up to date; nothing removed — superseded entries are marked, not deleted)
> Sources: owner in chat (2026-11-02), `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (all 12 chats), repo branches `picks` and `main`.

**Legend:** ✅ verified in repo · 💬 chat only · 👤 owner said · ⚠️ was a conflict (see the C-xx named next to it; all are resolved unless listed under Open) · ❓ unknown

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
| D-020 | ❓ | Survivor: 2-week seasons, Season 1 from Mon 16 Nov | active (date confirmed by D-065; prize settled by D-068 — C-24 resolved; free prize off for now, D-081) |
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
| D-036 | ❓ | Split launch: Block X live prize-free first | done — Block X went live prize-free (3 Nov); prizes from 9 Nov per D-077 |
| D-037 | 2026-10-30 | One change per pick | active |
| D-038 | ❓ | Picks sponsor row 0.2 Mana; 0.25 at Combo launch | superseded by D-104 |
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
| D-052 | 2026-11-02 | Announce every game before Friday | target only — gated by D-064 (each game launches when audited and ready) |
| D-053 | 2026-11-02 | The Mana sponsor is the only payer; Mana Station shelved | active |
| D-054 | 2026-10-28/30 | Last Node Standing rules | active (pending round-3 review) |
| D-055 | 2026-10-30 | Last Node watch-and-hold and its accepted trade-off | active |
| D-056 | 2026-10-28 | Block Golf redesign and rules | active |
| D-057 | 2026-10-28/29 | Producer Bracket rules | active (pending audit) |
| D-058 | 2026-10-28 | The KnodeGames VHP standard | active |
| D-059 | 2026-10-27/29 | Fantasy Producers and Weekly Rival rules | active (pending fix-check); its "launch on a Monday" line is superseded by D-052 / D-064 |
| D-060 | ❓ | Combo Card rules | active (pending fix-check 4) |
| D-061 | 2026-11-02 | Sponsor funding and daily cap | active |
| D-062 | 2026-11-02 | 2 + 1 VHP free prizes on every free game, from the vault's start | active |
| D-063 | 2026-11-02 | The week of 9 Nov is "Week 1"; earlier weeks don't pay | active |
| D-064 | 2026-11-02 | Announce only the built, audited, best version | active |
| D-065 | 2026-11-02 | Survivor Season 1 starts Mon 16 Nov | active |
| D-066 | 2026-11-02 | Public testnet only; three mainnet nodes | active |
| D-067 | 2026-11-02 | Block X: nothing announced yet; redo or apply only when ready | done — applied on Picks (D-070), live 3 Nov, vault `game-add 2` sent 3 Nov |
| D-068 | 2026-11-02 | Free prizes are per week; multi-week seasons pay once, at season end | active (rule); Survivor's free prize was paused by D-080, now off for now under D-081 (held by the D-082 switch) |
| D-069 | 2026-11-02 | Questions game Week 3 pays its on-chain v5 free prize (1 + 1 VHP); no upgrade | active |
| D-070 | 2026-11-02 | Apply Block X (game 2) on the Picks contract now | done |
| D-071 | 2026-11-02 | Fantasy, Last Node, Combo and Golf are staked-only for now | superseded by D-081 (every game has Free play) |
| D-072 | 2026-11-02 | No Knode Games token for now | active |
| D-073 | 2026-11-02 | The vault produces blocks as the Knode Games Pool | active |
| D-074 | 2026-11-02 | Multi-game staking is allowed and encouraged | active |
| D-075 | 2026-11-03 | Knode Games is not gambling | active |
| D-076 | 2026-11-03 | Success targets: 1,000,000 VHP in the pool; sponsor outgrown | active |
| D-077 | 2026-11-03 | Questions, Race and Block X pay from next week's results; add more games as they launch | active |
| D-078 | 2026-11-03 | Every game shows producer nicknames | active |
| D-079 | 2026-11-03 | Every game has its own Free play and Staked leaderboards | active — on every game again (D-081) |
| D-080 | 2026-11-03 | No free play for Combo, Block Golf or Survivor for now; free play everywhere once the seed is bigger | superseded by D-081 (same day) |
| D-081 | 2026-11-03 | Every game has Free play; free VHP prizes only on some games until the owner switches them on | active |
| D-082 | 2026-11-03 | A free-prize on/off switch per game in the admin panel, effective from the next week | active — merged (PR #65, 3 Nov) |
| D-083 | 2026-11-03 | New contract owner = a cold key (option A); multisig later | active — runbook in PR #73 |
| D-084 | 2026-11-03 | The operator key stays on GitHub only; removed from the PC | active — runbook in PR #73 |
| D-085 | 2026-11-03 | The sponsor keeps its 25,000 KOIN (may grow); the hot-key risk is accepted for now | active |
| D-086 | 2026-11-03 | Bracket: the Knode Games Pool stays in the field and is protected; forfeits judged on a day-long average | active — to build (R-BR-2) |
| D-087 | 2026-11-03 | Bracket: same-block identical picks share the place; text fixed; commit-reveal maybe later | active |
| D-088 | 2026-11-03 | Bracket launches when its fix-check passes; no 9 Nov target | active |
| D-089 | 2026-11-03 | Work is handed to chats through `CHAT_REQUESTS.md` in the repo, not by separate chat messages | active |
| D-090 | 2026-11-04 | One VHP ruler for every game; each game keeps its own scoring formula; checks at random moments within a window | active — design (R-ARCH-1) |
| D-091 | 2026-11-04 | Lower Last Node Standing's entry bar | active — value to set by simulation (R-LN-4) |
| D-092 | 2026-11-04 | Daily Questions twice a day: 10 a day Mon–Sat, rounds at 00:00 and 12:00 UTC, after the first paid weeks (needs a vault upgrade) | active — plan (R-Q-1, R-VAULT-6) |
| D-093 | 2026-11-04 | The VHP ruler looks back about 2 weeks; handicaps must be fair to every producer, proven by simulation | own-size rule superseded by D-111 (fairness aim stands) |
| D-094 | 2026-11-04 | The Race starts paying on 9 Nov with its two known gaps open until the ruler fix | active |
| D-095 | 2026-11-04 | Survivor Season 1 keeps its blocks-based handicap | active |
| D-096 | 2026-11-04 | Move every contract (vault, Desk, Picks, Race picks) to the new wallets this weekend, before any public announcement; Picks handover before the Picks v2 upgrade | active |
| D-097 | 2026-11-04 | Free-prize farming by many empty wallets is accepted for now | active |
| D-098 | 2026-11-04 | No back-fill for Race weeks before the vault paid it: those weeks have no prize | active |
| D-099 | 2026-11-04 | The vault pays no one else's Mana (`sponsor-limit 0`); the Mana sponsor pays players | active (supersedes D-046's "not for now") |
| D-100 | 2026-11-04 | `TODOS.md` is the one owner checklist; open items from the old checklist artifacts move into it, without duplicates | active |
| D-101 | 2026-11-04 | Every game is fair with a bit of luck: each uses a luck trim (preferred) or a cap | active |
| D-102 | 2026-11-04 | The full platform audit runs only once everything is confidently ready | active |
| D-103 | 2026-11-04 | A new Race pending file may be dated up to 35 minutes back (was 15) | active |
| D-104 | 2026-11-04 | The sponsor's Picks pick row is 1 Mana (was 0.2); the site asks 1 Mana; vault switch off until the guest-trap fix is uploaded | active |
| D-105 | 2026-11-04 | Sponsor per-player caps 40 Mana a day and 250 a week (were 25 / 150); not higher, for spam | active |
| D-106 | 2026-11-04 | The Picks owner handover waits until its tool is built and checked, after Survivor's game 3 is applied; not this weekend | active (amends D-096 for Picks) |
| D-107 | 2026-11-04 | A held week fails its run and emails the owner, and the alert names what the owner can do about it | active |
| D-108 | 2026-11-04 | Build the shared VHP ruler (R-ARCH-1); the Race's two gaps are closed by it, not by a Race-only fix | active |
| D-109 | 2026-11-03 | Phone tab bar: Games · Leaders · Stake · Results · More; Swap moves into More | active |
| D-110 | 2026-11-04 | A new, dedicated VHP Ruler chat builds the shared ruler (not the Bracket chat), after Repo Lens reviews the design | active (amends D-108's builder) |
| D-116 | 2026-11-04 | Daily Questions follows the shared game rules (staking, payouts through a results file, timing), folded into the same vault upgrade as the 60-question cap; v6.1 isn't announced on its own | active (supersedes D-114's "announce now"; amends D-092) |
| D-115 | 2026-11-04 | Public face: "source-available" (license stays proprietary), copyright "Knode Games", a new platform README and SECURITY.md, merged branches deleted | active |
| D-114 | 2026-11-04 | Doubled Questions as soon as possible: announce Vault v6.1 now, 60 a week allowed from Mon 9 Nov if the fix-check passes | active (supersedes D-092's "after the first paid weeks" timing) |
| D-113 | 2026-11-04 | Core first: finish the Vault, the sponsor, the Questions upgrade and the VHP ruler, and clean the whole repo (docs and organization to 10/10, public-ready), before any additional game launches | active (Survivor's 16 Nov start slips, D-065) |
| D-112 | 2026-11-04 | VHP ruler data details: "rebuilt" anchors for backfilled hours never pay; plain balance in anchors; exact seed recipe; round each block down then add; 30 days kept at first | active |
| D-111 | 2026-11-04 | VHP ruler design v2 approved: own size at the card moment, card credit always on, form as a gate, random moment, one bar + trim, the Vault rule, nothing pays until 11 simulations pass | active (supersedes D-093's 2-week own-size rule) |

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
- **Consequences:** Chats read `.ai/` first and file new knowledge through `claude/repo-history/CHAT_KNOWLEDGE.md (Claude project, private)`.
- **Clarified 3 Nov (library cleanup; one wording for every file — confirmed by the owner 3 Nov ✅ 👤):** when sources disagree, the order is:
  1. the owner's own words;
  2. `DECISIONS.md`;
  3. what is verified in the code or on chain (✅) — for facts about what is actually built;
  4. the other `.ai/` files;
  5. the repo's `docs/` runbooks;
  6. chat notes and handoffs (`claude/*.md`, `archive/`).

  A disagreement is logged as a C-xx and the lower source is fixed.
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
- **Status:** ~~disputed until the owner confirms~~ — **superseded by D-061** (5,000 a day; C-02 resolved).

## D-009 — Guest play on (web and mobile)
- **Source:** 💬 Questions chat; `guest: true` ✅ `game-data/deployment.json`

## D-010 — New prize rules start Week 3
- **Decision:** The 40/60 split and the 2 VHP free prize start in Week 3 (Mon 2 Nov 2026). `reward_rule_week_plus_one=3` is set on chain.
- **Uncertain:** exact meaning of the 40/60 split ❓; on-chain value not verified 💬.
- **Conflict:** the Vault chat says the v6 rules and the 2 + 1 VHP free prizes start Mon 9 Nov. See C-10. **Resolved:** superseded by D-062 (2 + 1 from the vault's start, Mon 9 Nov) and D-069 (the Questions game's Week 3 pays its on-chain v5 prize).

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
- **Note:** matches `bot/sponsor.ts` defaults. The everyone-per-day and free-per-day totals were open in C-02 — **settled by D-061** (5,000 and 2,000 a day).
- **Source:** 💬 Hub

## D-029 — Prize and liability rules
- **Decision:** A prize shortfall is cut and never owed later. Balances always cover total liabilities. Free-game rewards are extra and come second to stakers. No free-game prizes until the vault is fully live (timing settled by D-062: from the vault's start; C-10 resolved).
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
- **Source:** 💬 Race chat. Full game spec: `.ai/games/ProducerRace.md`.

## D-035 — The Race chat owns all Race files
- **Date:** 2026-10-29 · **Decision:** The Race chat owns all Race files (the list is in `claude/owners-race.md`; `PLATFORM.md` → Chats and ownership names the chat); other chats send Race requests through the owner. Written rule: `claude/owners-race.md`.
- **Source:** 💬 Race, Hub chats

## D-036 — Split launch: Block X live prize-free first
- **Decision:** Contracts first. Block X goes live prize-free; the scoring fixes happen off-chain before Vault v6 prizes (fix list: I-042).
- **Outcome (3 Nov):** done — Block X went live prize-free. D-077 then set its prizes to start with the week of Mon 9 Nov; the I-042 list is what must be checked before that first paid week closes (Mon 16 Nov).
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
- **Source:** 💬 Survivor. Full spec: `.ai/games/Survivor.md`; repo `docs/SURVIVOR.md` ✅ on branch `survivor`. **Note (3 Nov):** the free prize 4 / 2 VHP is off for now (D-081); the rule is kept for when it's switched on.

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
- **Other:** practice on the testnet scored on mainnet blocks (1 test day = 1 hour, with robots); the page must feel inviting, professional and fun, and explain every number; Terms section 3 (`terms.html`). Standing rule from this chat: new games launch on a Monday — **superseded by D-052 / D-064** (each game launches when audited and ready; vault weeks still start on Mondays).
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
- **How (confirmed by the Vault chat, 2 Nov):** on-chain and file week numbers stay as they are. The vault posts results only for games registered in it and only for weeks they earn (`earnedWeek`: `from_week <= w`), so it never reads Race weeks 1 or 2. A game applied Wed 4 – Sun 8 Nov earns from vault week 3 (Mon 9 Nov). The site should set `PRIZES_FROM_WEEK = 3` (I-069). Week labels differ by source — see `KOINOS.md` → Time.

## D-064 — Announce only the built, audited, best version
- **Date:** 2026-11-02 (owner) · **Decision:** Don't announce anything until we're confident it is built and ready to release, so we announce only the correct and best version. Friday 6 Nov (D-052) stays the target, not a deadline.

## D-065 — Survivor Season 1 starts Mon 16 Nov
- **Date:** 2026-11-02 (owner) · **Decision:** Survivor's Season 1 starts Monday 16 Nov 2026 (`FIRST_DAY`), subject to D-064 and its open prerequisites (I-050).

## D-066 — Public testnet only; three mainnet nodes
- **Date:** 2026-11-02 (owner) · **Decision:** The project uses only the public Koinos Foundation testnet. There are no testnet nodes on the owner's PC — only the three mainnet nodes. Tooling that targets a local "Harbinger" testnet node is unused (I-068).

## D-067 — Block X: nothing announced yet; redo or apply only when ready
- **Date:** 2026-11-02 (owner) · **Decision:** Nothing about Block X has been announced to players. If an earlier on-chain announcement of game 2 exists on the Picks contract (the Block X chat reported one, applicable from Sun 1 Nov 21:23 UTC), either cancel it and announce again, or apply it only when the best build is ready (I-070).
- **Outcome:** done — applied on Picks 2 Nov (D-070); Repo Lens round 12 GO; live on the site 3 Nov (PRs #57–#59); vault `game-add 2` sent 3 Nov (applicable Thu 5 Nov 15:51 UTC).

## D-068 — Free prizes are per week; multi-week seasons pay once, at season end
- **Date:** 2026-11-02 (owner) · **Decision:** The free prize is 2 + 1 VHP per week. A game with a 2-week season, like Survivor, pays 4 + 2 VHP for the season, paid once to the season's winners when the season ends — not split into weekly payouts. Confirms D-020 and D-051.

## D-069 — Questions game Week 3 pays its on-chain v5 free prize
- **Date:** 2026-11-02 (owner) · **Decision:** Accept it. The Questions game's Week 3 (Mon 2 – Mon 9 Nov, paid Tue 10 Nov ≈ 12:07 UTC) pays free players the v5 free prize already fixed on chain (`reward_rule_week_plus_one=3`): up to 2 VHP from that week's pot — best score 1 VHP, the 2nd score's players share 1 VHP (a tie for best splits all 2; a lone free scorer gets 1 and the other 1 goes to basket B; nobody qualifies → all to basket B). No contract upgrade. This is a one-week exception to D-062/D-063 for game 1 only; every free game, game 1 included, pays 2 + 1 VHP from Mon 9 Nov (v6). Resolves C-25 and I-067.


## D-070 — Apply Block X (game 2) on the Picks contract now
- **Date:** 2026-11-02 (owner) · **Decision:** Apply the existing Picks announcement (made 30 Oct) inside its window rather than letting it lapse. Done the same day, with the follow-up steps. This puts game 2's settings in force on the Picks contract only; announcing to players and the vault `game-add 2` still follow D-064.


## D-071 — Fantasy, Last Node, Combo and Golf are staked-only for now
- **Date:** 2026-11-02 (owner) · **Decision:** Fantasy Producers (4), Block Golf (6), Combo Card (8) and Last Node Standing (13) are staked-only for now: no free board prize. Keep the design open so a free option can be added later. The free 2 + 1 VHP prize (D-062) applies to the free games: Daily Questions, Block X, Survivor (per season, D-068), Producer Race and Producer Bracket. Weekly Rival stays records-only.
- **Superseded by D-081 (3 Nov):** every game now has a Free play board. Free VHP prizes: on for Questions, Block X, Race, Bracket, Last Node; off for now (board only) for Combo, Golf, Survivor, Fantasy — the D-082 switch holds them. Weekly Rival is still records-only.


## D-072 — No Knode Games token for now
- **Date:** 2026-11-02 (owner) · **Decision:** Knode Games has no token of its own. The possibility stays open for the future.

## D-073 — The vault produces blocks as the Knode Games Pool
- **Date:** 2026-11-02 (owner) · **Decision:** The **Knode Games Pool** is the block producer for the vault. Its address is the vault contract itself, `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (the Bracket chat also records the vault as its own producer, its VHP shown as `pooled`). It produces through the game node on the owner's PC (`C:\kpred-node`, producer key `Ak0vGklN…` ✅ `game-data/deployment.json`).


## D-074 — Multi-game staking is allowed and encouraged
- **Date:** 2026-11-02 (owner) · **Decision:** A player may stake in any number of games at the same time, and the site should encourage it. Each game needs its own minimum of 1 VHP; stakes are kept per game in the vault, and `move_stake` moves VHP between games (not sponsored, D-027). The staking hub shows every game a wallet is staked in, each game's total and the wallet's share (D-031).


## D-075 — Knode Games is not gambling
- **Date:** 2026-11-03 (owner) · **Decision:** No wagers, odds or player-funded pots, on any game; stakes are never at risk. Rewards come only from the vault's block production, never from other players' losses. Extends the Race's rule to the whole platform. See `FOUNDER_INTENT.md`.

## D-076 — Success targets
- **Date:** 2026-11-03 (owner) · **Decision:** First target: **over 1,000,000 VHP staked in the Knode Games Pool** (more is welcome). A second sign of success: needing to enlarge the free Mana sponsor because of overwhelming demand.


## D-077 — Questions, Race and Block X pay from next week's results
- **Date:** 2026-11-03 (owner) · **Decision:** Daily Questions (game 1, built into the vault), Producer Race (7) and Who Signs Block X (2) are all in the vault so paying begins with the week of **Mon 9 Nov** (vault week 3). Other games are added as they launch.
- **How:** `game-add 2` and `game-add 7` (`--staked --free`) → sponsor vault switch → 48 h → `game-apply 2` and `game-apply 7` before Mon 9 Nov 00:00 UTC (`docs/UPGRADE-V6.md` §6–7); then set the repo variable `PRIZES_FROM_WEEK = 3` for Block X.
- **Changes D-036:** Block X no longer stays prize-free until its "before prizes" list (I-042) is done. Safety net: the owner has 24 h after each seal to correct, unprize or void results before they finalize.


## D-078 — Every game shows producer nicknames
- **Date:** 2026-11-03 (owner) · **Decision:** Every game page shows producers (and players) by their nickname — pool name or Koinos @name — with the short address beside it, using the shared names system (`names.js`, `KNames.of`). It's a standard, not an option: new games ship with it, and existing pages without it (Block X, Producer Race) get it.


## D-079 — Every game has its own Free play and Staked leaderboards
- **Date:** 2026-11-03 (owner) · **Decision:** Every game has its **own** two leaderboards — **Staked** and **Free play** — built directly from that game's own results and players' picks. This is a standard for every game, including the staked-only games (Fantasy, Block Golf, Combo, Last Node): their Free play board ranks free players even though it pays no prize for now (D-071). Each game's boards also appear on the Leaders page.
- **Update (D-081, same day):** "staked-only games" no longer exists. Every game has Free play; the free prize is on for Last Node, and off for now for Fantasy, Golf, Combo and Survivor (held by the D-082 switch).
- **Open:** Combo's page currently lets only staked wallets send cards, so its Free play board would stay empty unless free play is allowed there (I-074).


## D-080 — No free play for Combo, Block Golf or Survivor for now
- **Date:** 2026-11-03 (owner) · **Decision:** **Combo Card, Block Golf and Survivor have no free play for now** — no Free play board and no free prize; only staked players play and rank. **Free play will open on all the games once a bigger VHP seed is in place**, so every free reward is covered.
- **Changes:** Survivor was Staked + Free with a 4 + 2 VHP season prize (D-051, D-068) — it is now **staked only**: register it as `game-add 3 "Survivor" --staked --season 2` (**no `--free`**, unlike `docs/UPGRADE-V6.md`), and its free board is switched off. D-079's "both boards on every game" excludes these three for now.
- **Free play today:** Daily Questions, Block X, Producer Race, Producer Bracket (Free board + 2 + 1 VHP prize); Fantasy and Last Node (Free board, no prize — ❓ owner to confirm).
- **Superseded the same day by D-081:** free play (the board) comes back on every game; what stays off is the free **VHP prize**.

## D-081 — Every game has Free play; free VHP prizes only where the owner has switched them on
- **Date:** 2026-11-03 (owner, replaces D-080) · **Decision:** **All games have a Free play mode** — free players can play and rank on that game's own Free play leaderboard (D-079 applies to every game again). **Not every game pays free VHP prizes yet:** the games the owner had marked "no free play" — **Combo Card, Block Golf, Survivor and Fantasy Producers** — have Free play for **leaderboard standings only, no free VHP prize**. When the seed is ready, the owner **switches on the free prize** for those games one at a time.
- **Free VHP prize (2 + 1 per week) now:** Daily Questions, Block X, Producer Race, Producer Bracket, Last Node Standing.
- **Free board, no prize (for now):** Combo Card, Block Golf, Survivor, Fantasy Producers.
- **Last Node Standing:** Free play + Staked, **with the 2 + 1 VHP free prize from the start** (owner, 3 Nov).
- **Changes:** Survivor keeps its free board but its free prize stays off (no 4 + 2 season prize for now). ~~Register it without `--free`~~ — **superseded by D-082:** every game is added **with** `--free`, and the switch keeps the prize off. Fantasy and Last Node branches were built without free boards — their chats must add one. Combo's page lets only staked wallets send cards today (I-074), so it needs a change to accept free players.
- **Staked play is unchanged:** each game joins the vault for staked rewards when it's audited and ready (D-064).
- ~~❓ How "switching on" works on chain~~ — **answered (code ✅ `Kpred.ts`):** the vault fixes `free_prize` when a game is applied; changing it means deactivate → `propose_game` → 48 h → `apply_game`, which can cost stakers a week. Hence D-082.

## D-082 — A free-prize switch per game, from the next week
- **Date:** 2026-11-03 (owner) · **Decision:** the admin panel gets an easy **Free prize ON / OFF** for every game; the owner can give or take away free-play VHP prizes at any time, and a change **only takes effect from the following week**.
- **How (owner chose the bot switch, not a contract change):** every game is added to the vault **with** the free prize allowed (`game-add … --free`). The switch is `free-prizes.json` on the `prize-settings` branch (the owner's git login, like names-data). The vault bot posts a week's free winners only if the switch is on; **off** → it seals with no winners and the vault returns that prize to the pool. A change made in week W counts from W + 1; a change dated after its week started never counts; a 2-week season pays only if the switch was on for both weeks. If the switch can't be read, the bot still posts the staked players' points, holds only the free winners and the seal, and reports it; under 6 h before the results deadline it seals without winners, so stakers never lose a week (Repo Lens FP-2, fixed before merge).
- **Limits:** the switch can only hold back a prize the vault allows, never pay more. While off, the vault still sets aside that game's 3 VHP a week from the seed's part and then returns it to the pool; in a seed shortfall the set-aside shrinks the other games' prizes in proportion. Anyone with push access could edit the branch (the same trust as the results files).
- **Commands:** admin panel → Knode Vault → Free prizes; or `npm run prizes -- list | on <game> | off <game> [--send]`.
- **Vault check (Vault chat, 3 Nov, against the live v6 code ✅):** a sealed week with 0 winners finalizes cleanly. `finishGameWeek` moves the prize from `pots_outstanding` to `rolled_over`, and the next close counts it **fee-free** into the next week's pot. Nothing on chain requires winners before a seal or finalize. The stake bucket is separate and unaffected. Season games hold the prize through the season. No effect on liabilities, `seed_vhp` or `seedFree`; the VHP never leaves the vault. The shortfall effect is acceptable for now: the seed is ~99.9% of producing VHP, so its part (~85–90 VHP a week after the fee) far exceeds 9 games × 3 VHP = 27. A cut needs weekly rewards under ~30 VHP or stakes rivaling the seed. Games not applied yet cost nothing.
- **Later, if needed:** a vault upgrade (48 h notice) could read a per-game switch at the close, so an "off" game sets aside 0.
- **Audit:** Repo Lens review 3 Nov — GO after FP-2 (fixed) and FP-1 (a GitHub ruleset on `prize-settings`: no deletion, no force-push — owner to add once the branch exists). Also fixed: no publishing within 30 min of Monday 00:00 UTC (FP-3/FP-4), strict UTC times (FP-7).
- **Status:** **merged 3 Nov (PR #65).** The `prize-settings` branch is created by the first ON/OFF send. Starting settings and how to use it: `FREE_PRIZE_SWITCH.md`.

## D-083 — The new contract owner is a cold key; multisig later
- **Date:** 2026-11-03 (owner, through the Vault chat) · **Decision:** option A. The new owner wallet is created in Kondor in a fresh Chrome profile, with its recovery words on paper (two copies). Its key goes into `.env` only on the day of an owner action, then comes out again. A 2-of-3 multisig owner goes on the roadmap.
- **Why not a hardware wallet:** nothing available today can sign these owner actions from one. All the tools sign with a key from `.env`; Kondor has no Ledger or Trezor support; Manuscript (Ledger/Trezor through MetaMask) isn't released or verified for contract calls (❓); a separate machine (option B) was judged more effort. Answers I-075 (💬 Vault chat, 3 Nov).
- **Trade-off:** owner actions (fee claim, `game-add`, sponsor limits, emergency pause) are slower, because the key must be loaded first. Malware running during an owner action could still take it.
- **Runbook:** `docs/WALLETS.md` (PR #73, not merged yet).

## D-084 — The operator stays on GitHub only
- **Date:** 2026-11-03 (owner, through the Vault chat) · **Decision:** the operator key (`1HsM33…`) lives only in the GitHub secret `OPERATOR_WIF`. The PC keeps no operator key.
- **Found on the way (💬 Vault chat):** `npm run bot -- status` on the PC printed "Bot wallet 1JSTwo…" (30 Oct – 2 Nov). So the PC's `OPERATOR_WIF` is most likely the **old** operator key, and operator commands from the PC are refused on chain ("operator only") ❓ (to confirm in step 0 of the runbook).
- **Consequence:** the admin page's weekly vault buttons (manual `game-post`, `game-seal`, `game-finalize`) won't work from the PC; the hourly bot on GitHub does that work.

## D-085 — The sponsor keeps 25,000 KOIN; its hot-key risk is accepted for now
- **Date:** 2026-11-03 (owner, through the Vault chat) · **Decision:** the Mana sponsor wallet (`1ByDDS…`) keeps its 25,000 KOIN, which may grow (D-061, D-076). The risk is recorded and accepted for now: `SPONSOR_WIF` is always on the PC and has no timelock, so anyone holding it could move the KOIN at once. A lower balance with weekly top-ups was offered as an option and not taken for now.

## D-086 — Bracket: the Knode Games Pool stays in the field, protected
- **Date:** 2026-11-03 (owner, after Repo Lens #E-3) · **Decision:** the Knode Games Pool (the vault, a block producer) stays in the Producer Bracket field. It is protected against vault deposits and withdrawals timed around a round's start (H-4): a pooled producer is judged on the day's average or minimum effective VHP, not a single block. Forfeits for every producer are judged on the day's time-weighted average effective VHP (H-5), so throwing a matchup costs a day of real VHP. The page text is fixed to match.
- **Not chosen:** keeping the Pool out of the field (the auditor's simplest option).
- **Needs:** the Bracket chat builds it with tests (R-BR-2); the fix-check reviews it.

## D-087 — Bracket: same-block copies share the place
- **Date:** 2026-11-03 (owner) · **Decision:** keep "the earlier pick wins" as the tie-break. Identical brackets picked in the same block share the place (including a vault value and a free-prize place). Low risk in practice. Fix the code comment and the page text that say otherwise (H-6). A copy-proof commit-reveal scheme may come later with a Picks contract upgrade.

## D-088 — Bracket: launches when ready
- **Date:** 2026-11-03 (owner) · **Decision:** no 9 Nov target. The Producer Bracket launches (vault `game-add 9`, free-prize switch ON) when its Repo Lens #E-3 fixes pass a fix-check, and `BRACKET_PRIZES_FROM_WEEK` is set after the fixes, before its first paying week ends. Replaces the "try for 9 Nov" plan (3 Nov).

## D-089 — Chats get their work from `CHAT_REQUESTS.md`
- **Date:** 2026-11-03 (owner) · **Decision:** "the source of everything lives in GitHub, not in chats." Each chat's open work is listed in `.ai/platform/CHAT_REQUESTS.md`. The owner sends every chat the same short start message (§1 of that file). Chats report back with the session-end report, and the library chat keeps the file current. Rules that apply to every game go into the standards, not into messages.
- **Private audit reports** stay in the Claude project, since the repo is public; the repo names findings by id only.

## D-090 — One VHP ruler for every game
- **Date:** 2026-11-04 (owner, after `HANDICAP_REVIEW.md`) · **Decision:** every game measures producer VHP **the same way**, with the method that is hardest to game, fair and accurate. **Each game keeps its own scoring system and formula** (§5.1 of the review). Checks are made **at random moments within a window**, so nobody can learn to time them.
- **The ruler (recommended, to be designed in R-ARCH-1):** the VHP standard (D-058) extended:
  - exact effective VHP rebuilt from VHP events on two nodes (every block counted, not samples);
  - a producer's own handicap uses its **highest** VHP over a look-back long enough that hiding costs real rewards;
  - **card credit** (VHP added after the measure gains nothing);
  - averages for other producers and totals;
  - a clamped production check (form);
  - the measurement points drawn at random within the game's window from a future block's hash: unpredictable in advance, checkable by anyone afterwards.
- **Race fix:** the ruler closes both Race gaps (`HANDICAP_REVIEW.md` §3): card credit closes in-leg additions; a longer highest-VHP look-back closes the > 6-h hide.

## D-091 — Lower Last Node's entry bar
- **Date:** 2026-11-04 (owner) · **Decision:** lower Last Node Standing's entry bar (today ≥ 20 expected blocks an hour, ~1.7% share, top 23), so smaller nodes can play. The new value is set by the Last Node chat from simulations with many small producers, using a luck trim, and approved by the owner (R-LN-4). Target: the platform bar of k ≥ 10 expected blocks in the game's scoring window (`HANDICAP_REVIEW.md` §5.2).

## D-092 — Daily Questions twice a day
- **Date:** 2026-11-04 (owner) · **Decision:** **10 questions a day, Mon–Sat** (60 a week), in two rounds: one opens at **12:00 UTC** (4 AM PT, as today), the second at **00:00 UTC** (4 PM PT) when the earlier round closes. It starts **after the first paid weeks** (9 and 16 Nov) have paid cleanly, likely the week of 23 or 30 Nov.
- **Needs a vault upgrade:** the contract allows at most 30 questions a week (`MAX_QUESTIONS_PER_WEEK = 30`, `Kpred.ts` ✅), which 5 a day × 6 days already fills. Raising it means the vault upgrade path: audits, 48 h notice, announce on a weekend, upload on a Monday (D-017, D-023, D-024). Also to plan: the bot's release schedule (`RELEASE_HOUR`, `LOCK_HOUR`), the release backup task, scoring and weekly points, Mana per player, and the site.

## D-093 — The ruler's look-back is about 2 weeks; handicaps must be fair
- **Date:** 2026-11-04 (owner) · **Decision:** the VHP ruler (D-090) looks back **about 2 weeks** when sizing a producer's own handicap, so hiding VHP costs about two weeks of real block rewards. Handicaps must be **fair to the game and to every producer**, small and large.
- **Library recommendation (for R-ARCH-1 to test):** a producer's own size = the **higher of its 14-day time-weighted average VHP and its highest VHP in the last 24 h**. The average makes a hide cost in proportion to how long it lasts; the 24-h high stops "look small right now". A pure 14-day *maximum* would be harsh on a producer that genuinely loses stakers (it would look too big for 2 weeks). The final rule and window are set by simulation, including a field with many small producers, and approved by the owner.
- **Under review (4 Nov):** Repo Lens #E-7 found the 2-week average makes honest producers look too big (every block burns ~4 VHP from its signer, so a producer that doesn't re-burn shrinks ~1% a day) and that card credit, not the look-back, is what stops hiding. Ruler design v2 (`standards/VHP_RULER.md` §12 point 1) proposes measuring a producer at the card moment instead; **Superseded by D-111 (owner approved v2, 4 Nov)** for the own-size rule.
- **Load:** the exact rebuild reads each block once (the recorders already read them hourly), looking for VHP transfer events. Reads cost no Mana. Random checks are computed from data already read; nothing polls the chain every minute.

## D-094 — The Race starts paying on 9 Nov
- **Date:** 2026-11-04 (owner) · **Decision:** the Producer Race pays from the week of Mon 9 Nov as planned (D-077), with its two known handicap gaps (VHP added after a card; a > 6-h hide) open until the ruler fix (R-RACE-5). Each trick costs the producer real block rewards while it hides VHP.

## D-095 — Survivor Season 1 on blocks
- **Date:** 2026-11-04 (owner) · **Decision:** Survivor Season 1 (Mon 16 Nov) keeps its blocks-based handicap (h = kTop ÷ k over days d−8 … d−2). Later seasons move onto the one VHP ruler (D-090).

## D-096 — Every contract moves to the new wallets this weekend
- **Date:** 2026-11-04 (owner) · **Decision:** move the vault, the Desk, **the Picks contract and the Race picks contract** to the new owner wallet (D-083) this weekend, once each step checks out, and before any real public announcement. For Picks: **hand over first, then the Picks v2 upgrade** for Combo (answers PR #79).
- **Needs:** the Picks owner-handover commands (R-BX-3) and the Race picks owner-change command (R-RACE-3) built and tested in time; the Vault chat adds both to the weekend runbook (`docs/WALLETS.md`).
- **Ordering to watch:** a Picks handover clears pending game announcements on Picks. Survivor's game-3 Picks registration (R-SV-2) must come **after** the Picks accept, and still in time for Season 1 (Mon 16 Nov).

## D-097 — Free-prize farming is accepted for now
- **Date:** 2026-11-04 (owner: "accept it") · **Decision:** one person running many empty wallets to win free prizes (B1-3, I-035) is accepted for now, as on 28 Oct ("one person running many free wallets"). No minimum activity or stake rule beyond each game's own (for example Last Node's 1 VHP for guests). The owner can still remove a farmed wallet's prize in the 24 h correction window (`game-unprize`). Revisit if farming shows up in the first paid weeks.

## D-098 — No back-fill for early Race weeks
- **Date:** 2026-11-04 (owner: "currently no prizes for race because staking isn't available for it") · **Decision:** Race weeks before game 7 is applied in the vault have no prize and are not back-filled (I-033). The Race pays from the week of Mon 9 Nov (D-094), like week 1 being unpaid (D-063).

## D-099 — The vault pays no one else's Mana
- **Date:** 2026-11-04 (owner: "the sponsor should be paying … so the game pool can max compound") · **Decision:** set the vault contract's own Mana limit to 0 (`npm run bot -- sponsor-limit 0`, then `maxSponsorRc: "0"` in `game-data/deployment.json`, PR #89), so all its Mana stays for compounding. The Mana sponsor pays players' Mana within its caps; past the caps players pay their own (as D-046). Supersedes D-046's "not for now" (I-044).

## D-100 — One owner checklist
- **Date:** 2026-11-04 (owner) · **Decision:** `.ai/platform/TODOS.md` is the one owner checklist (I-032). Still-open items from the older checklist artifacts (Race chat's launch checklist, the Fantasy chat's owner checklist and the others) move into it, with no duplicates; those artifacts are then retired (not edited further).

## D-101 — Fair, with a bit of luck
- **Date:** 2026-11-04 (owner: "games should be fair with a bit of a luck") · **Decision:** every game keeps some luck but limits it: a luck trim sized by simulation (as Race and Last Node use, preferred) or at least a cap (as Block X, Fantasy, Combo). Survivor and the Bracket, which have neither, add one (`HANDICAP_REVIEW.md` §5.2 #2; R-SV-5, R-BR-7). Part of the one ruler (D-090).

## D-105 — Sponsor caps: 40 a day, 250 a week per player
- **Date:** 2026-11-04 (owner: "okay to raise the caps to 40 and 250. I just don't want them too high because of spam concerns") · **Decision:** per player 40 Mana a day and 250 a week (were 25 / 150, D-061). Everyone's total stays 5,000 a day and the free players' pool 2,000 a day, which bound what spam can cost. The rollout's technical settings from Repo Lens (per transaction 1.5 Mana; Picks and Race rows 1.2) go with it, so one sponsored pick fits (R-BX-15, R-BX-16). Don't raise further without a new decision.

## D-106 — Picks handover: when ready, not this weekend
- **Date:** 2026-11-04 (owner: "B, we can be patient and do it when we are ready") · **Decision:** the vault, the Desk (and the Race picks, done 4 Nov) move this weekend as planned; **the Picks contract moves later**, once `owner-propose` / `owner-accept` / `owner-cancel` are built, tested on testnet and pass Repo Lens (R-BX-3), and **after Survivor's game 3 is applied on Picks** (a handover clears pending announcements). Target the weekend of 14–15 Nov or later, when no Picks announcement is pending. Then the Picks v2 upgrade. Amends D-096 for Picks only.

## D-107 — A held week alerts, and says what to do
- **Date:** 2026-11-04 (owner: "yes, make sure I can do something about it, not just be notified") · **Decision:** in every game, a held results week **fails its run** (so GitHub emails the owner) and the alert names: the game and week, why it's held, the deadline (3 days after the week), and the owner's options with the exact command or setting (wait for it to clear by itself; release it once after checking, where the game has a release; hold it longer; or void it with `game-void`). Block X already fails the run (E4-7) and has a one-off release (R-BX-13); the Race does neither yet (I-087, R-RACE-13). `RUNBOOK.md` §3 lists each game's options.

## D-108 — Build the shared VHP ruler
- **Date:** 2026-11-04 (owner: "Let's do the shared VHP ruler. This needs to be built") · **Decision:** build the one VHP ruler of D-090 / D-093 (R-ARCH-1) rather than a Race-only fix; the Race's two known gaps (the > 6-h hide, VHP added after a card) are closed when the Race moves onto it (R-RACE-5). Design by the library chat (it holds the handicap review and the owner's decisions); build in the Bracket chat, which owns the VHP standard (D-058); each game then plugs its own formula in.

## D-111 — The VHP ruler design v2 is approved
- **Date:** 2026-11-04 (owner: "approve v2") · **Decision:** build the shared ruler as `standards/VHP_RULER.md` v2 (after Repo Lens #E-7), all five §12 points: (1) a producer's own size is its effective VHP at the card moment (or its highest in the hour before), others by 24-hour averages, **card credit always on**; (2) a random moment from the first irreversible block at or after L + 20; (3) one entry bar (k ≥ 10) and a luck trim in every game, **form only as a gate**; (4) a dedicated VHP Ruler chat builds it, the Race moves first, **nothing pays on it until the data checkpoints exist and all 11 simulations pass on 29+ days of data**; (5) new producers need 24 h of history and a "new" label; the Vault's pooled rule. **Supersedes D-093's own-size rule** (the 2-week average): Repo Lens showed it makes honest, shrinking producers look too big, and that card credit is what stops hiding. D-093's aim (fair to every producer; hiding mustn't pay) stands.

## D-112 — VHP ruler data details (answers to the VHP Ruler chat's build plan)
- **Date:** 2026-11-04 (owner: "okay to make D-112", on the library chat's answers to the VHP Ruler chat's five questions) · **Decision:**
  1. **Anchors for past hours.** A node can read `effective_balance_of` only at the block it is on now, so the first fill's hours can't have real two-node anchors. Backfilled hours carry anchors **rebuilt** backwards from one real read, labelled `"source": "rebuilt"`; live hours carry real reads from both nodes, labelled `"live"`, with the block height each read landed on. **No card that pays may depend on a rebuilt hour** (cards look back at most 24 h, so about a day after live recording starts every paying card uses live anchors only); rebuilt hours serve the simulations and history. The first live read is itself a test (audit S-3: the read was never seen live): if it fails or the two nodes disagree, the hour is not ok and no card is made (fail closed).
  2. **Each anchor stores the plain balance as well as the effective balance**, so "previous anchor + the hour's events = next anchor" can be checked exactly.
  3. **Seed recipe, to the byte:** sha256 of the UTF-8 text `blockId|game|round` (the block id in lowercase hex exactly as the node returns it; game and round in decimal); the first 8 bytes read as one big-endian unsigned 64-bit number; `T = W0 + (that number mod (W1 − W0 + 1))`. The seed block stays the first irreversible block at or after `L + 20`. A fixed test vector in both JavaScript and Python.
  4. **Rounding:** each block's share (form, expected blocks, credit) is rounded down to millionths, then the integers are added. The loss is under 1 millionth per block (under ~0.03 of a block a day); the bound is written down and tested. This is what makes JavaScript and Python agree byte for byte.
  5. **Retention:** keep **30 days** at the start (the simulations need 29), then about 22. Rolling hours up into day files must keep the hash chain checkable: each day file lists its hours' sha256.
  Also: the ruler chat pushes each step to its own branch `vhp-ruler` (never to `main`; D-089), with a Repo Lens check after the math (`vhp-ruler.js`, `vhp_ruler.py` and their tests) and another before the hourly job writes to `vhp-data` on mainnet. Recorded in `standards/VHP_RULER.md` §2.3, §7, §9, §13.

## D-116 — Daily Questions plays by the same rules as every other game
- **Date:** 2026-11-04 (owner: "i want to upgrade the questions game to align with all the other games. Now that its not the only game, it should share all the same rules the other games share … mainly in general but also the staking / unstaking is different"; answers: staking "Yes, same as others", payouts "Same as other games", timing "Yes, same timing", when "Fold into v6.1") · **Decision:** Daily Questions (game 1) moves onto the shared vault rules: (1) **staking** like every other game: the Stake hub, the same calls (`deposit_to` / `withdraw_from` / `move_stake`), the same same-week counting and the same withdraw rule (`VAULT_STANDARD.md` §4); (2) **payouts** like every other game: Questions publishes a results file (and `board.json`) per `VAULT_STANDARD.md` §6 and `RECORDER_STANDARD.md`, and the vault pays it with the shared rule, replacing the 40 / 60 baskets; (3) **timing** like every other game: no settle step, the shared 3-day results window. Free prizes are already the shared 2 + 1 VHP from Mon 9 Nov. (4) **Questions is a regular vault game everywhere** (owner: "make sure the vault is also now including Questions with the other games"): the same reward split by staked weight, in `vaultGames`, checked and posted by the vault bot, and shown in the Stake hub, Leaders and Results like the others; no special cases for game 1 beyond keeping old stakes and rewards safe. **Folded into one vault upgrade with the 60-question cap** (PR #114's branch grows; one new build, testnet, Repo Lens, 48 h announce). So **v6.1 is not announced on its own** (supersedes D-114's "announce now"), doubled Questions waits for that upgrade (the bot stays on 2 + 3, 30 a week, which works today), **Timing (owner, 4 Nov: "we are going to get it done today or tomorrow and announce when complete with passed audits"):** build Wed 4 – Thu 5, announce as soon as the build, the testnet run and Repo Lens pass; upload 48 h later. Signer: the current owner `1635QU…` if the whole announce → upload fits **before** the handover propose (step 4a, Sun 8); otherwise the new owner `1LMV8E…` **after** the accept (4b, Tue 10). **Never announce between 4a and 4b** (the accept wipes a pending upgrade). If the handover would get in the way, the owner may move the handover a few days instead. 60 a week starts the Monday after the upload (an upload confirmed before Sun 8 Nov 4 PM PT gives Mon 9). **Must hold throughout:** every existing game-1 stake stays withdrawable at every moment, including across the switch-over; the week of the switch keeps the rules it started with.

## D-115 — The public face of the repo
- **Date:** 2026-11-04 (owner: "1. yes" to keeping the license proprietary and saying "source-available"; "3. Use Knode Games"; "4. yes give me the script and steps"; "Update the README to align with the entire platform. It should read as Knode Games") · **Decision:** the license stays proprietary (all rights reserved), and the site and README call the code **source-available**, never "open source"; the copyright holder is written as **Knode Games** (LICENSE, README); the root README describes the whole platform (the vault, the games, the sponsor, the contracts and how to verify them) and a root `SECURITY.md` says how to report a problem privately; the 145 merged or abandoned branches are deleted by the owner with a checked script, after the four unprotected data branches get delete protection. **Done 4 Nov (owner: "ok to move"):** the audit reports (formerly `docs/history/`), three Block X audit prompts and the raw chat exports (formerly `.ai/archive/CHAT_KNOWLEDGE.md`) moved to the Claude project, `claude/repo-history/`; the repo keeps no copy (git history still has them; no keys were ever in them). Personal Windows paths were removed.

## D-113 — Core first, then new games
- **Date:** 2026-11-04 (owner: "i want to get everything with Vault, the sponsors, the questions upgrade, the VHP ruler build complete. before adding in any additional games" … "clean up stale code that can be removed. Clean up the files with open items. lets get our documentation up to 10/10 and our organization up to 10/10 … as these improve it should naturally help our architecture and we can focus on that last" … "go through all the files … on the entire repo … ready to be on display as well as a public repo when i start my marketing") · **Decision:** the order of work is (1) the open core PRs (Vault v6.1, the Questions rounds, the Picks handover plan) and the sponsor follow-ups; (2) the VHP ruler build; (3) a whole-repo cleanup: stale files and branches removed, every file's status current, documentation and organization to 10/10, the public repo presentable (README, license wording, branding, nothing private); (4) architecture last. **No additional game launches until then:** Survivor, Fantasy, Last Node, Combo, Golf and Bracket chats pause new-game work (their branches stay); Survivor Season 1 no longer starts Mon 16 Nov (amends D-065). The live games (Questions, Block X, Race) keep their payout-safety work (Race hold alerts R-RACE-13, I-085; Block X R-BX-13). Plan: `CHAT_REQUESTS.md` §0.

## D-114 — Doubled Questions as soon as possible
- **Date:** 2026-11-04 (owner: "lets push this ASAP for the double questions", on Repo Lens #B-4 for PR #114) · **Decision:** announce Vault v6.1 (`399171a2…`, unchanged since #B-4's GO to announce) **now**, with the current owner key `1635QU…`; upload 48 h later once Repo Lens's fix-check of `94015ad..23dfd78` says GO (`claude/vault/REPOLENS-PR114-FIXCHECK-PROMPT.md`), then `pause off` at once, so 60 a week is allowed from **Mon 9 Nov**. All of this happens before the vault owner handover is proposed (weekend step 4a, Sun 8 Nov), because an accept wipes a pending upgrade. The Questions PRs #119 (then #122 after its fix-check) are merged before **Sun 8 Nov 23:48 UTC**, so the bot posts 4 + 4 from Mon 9 when the chain allows 48. If the fix-check isn't GO by Sat 7 Nov, the upload slips a week and the bot stays on 2 + 3 (30 a week) with nothing broken. Supersedes D-092's "after the first paid weeks".

## D-110 — A dedicated chat builds the VHP ruler
- **Date:** 2026-11-04 (owner chose option A) · **Decision:** the shared VHP ruler (`standards/VHP_RULER.md`) is built by a **new chat that does only that**, starting from the Bracket's existing VHP-standard code (`vhp-standard.js`, `bot/vhp-chain.ts` on `kg-09-bracket`). It starts once Repo Lens has reviewed the design (`claude/REPOLENS-VHP-RULER-DESIGN-PROMPT.md`) and the owner has approved it. No game owns the ruler; each game chat moves its game onto it (Race first). Amends D-108, which named the Bracket chat.

## D-109 — The phone tab bar
- **Date:** 2026-11-03 (owner, to the Hub chat: "Stake is a tab, just like Leaders; Swap belongs in More") · **Decision:** the phone tab bar is **Games · Leaders · Stake · Results · More**; Swap moves into the More sheet. The top menu gets a Stake link; Info is removed, Get VHP moves to Tools (R-HUB-9, R-HUB-10; PR #110).

## D-104 — Picks pick row 1 Mana; vault switch off for now
- **Date:** 2026-11-04 (owner sent both configs; Block X chat) · **Decision:** the sponsor's per-action limit for a Picks pick is **1 Mana** (was 0.2 from one testnet sample, D-038, now superseded); the site asks 1 Mana (PR #90). The sponsor's vault switch is **off** (`config --vault off`) until the guest-trap fix (`b84e1add…`, Repo Lens #C-3 GO) is uploaded, then turned back on (R-BX-15). Measured on mainnet 4 Nov: a guest Race pick 0.76 Mana, a guest Block X pick 0.84. **Until the fix is uploaded, anyone running `npm run sponsor -- config` must pass `--vault off`**, or guest picks break again. Open: the per-transaction and per-player caps (R-BX-16).

## D-103 — Race pending files: a 35-minute window
- **Date:** 2026-11-04 (owner: "widen it to 35 minutes so a slower run never holds an hour back") · **Decision:** the Race publish job accepts new pending content dated up to 35 minutes before its clock (the 30-minute record job plus 5), up to 5 minutes ahead (Repo Lens #C-4 C4-1; PR #85). It still closes the old 2-hour back-date route.

## D-102 — The full platform audit waits until everything is ready
- **Date:** 2026-11-04 (owner) · **Decision:** the full platform audit (I-002, D-014) runs only once everything is confidently ready: the launch-wave games live and their own audits passed. Until then, each part is audited on its own (D-064).

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
| C-16 | Race week 1 free winners | not paid: the vault never reads Race weeks 1–2 (game 7 isn't registered yet and earns from vault week 3); `rows: []` was expected because nobody can stake in the Race before game 7 is applied | owner (D-063), Vault chat |
| C-17 | Desk payout cap | no daily cap | later decision (D-007) |
| C-18 | Survivor Season 1 | Mon 16 Nov | owner (D-065) |
| C-19 | Testnet node | none; public testnet only | owner (D-066) |
| C-20 | Bracket readiness | not announced until audited and ready | owner (D-064) |
| C-21 | Producer names | Koinos @names | later decision (D-030) |
| C-22 | Fantasy results path | same place: the vault bot reads `games-data:fantasy/vault/W<week>.json`, which is where Fantasy writes | code ✅ (`bot/vault.ts`, `bot/games/fantasy.ts`) |
| C-23 | Launch order | superseded by D-052 / D-064 | owner |
| C-24 | Survivor free prize | 2 + 1 per week = 4 + 2 per 2-week season, paid once at season end | owner (D-068) |
