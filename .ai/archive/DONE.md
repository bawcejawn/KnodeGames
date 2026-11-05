# Knode Games — Done and Decided

> **Purpose:** finished work, settled items and superseded plans, moved out of the working files so those only show what still needs attention. **Nothing here needs action.** Read it only to check history.
> **How it grows:** when an item in `platform/TODOS.md`, `platform/CHAT_REQUESTS.md`, `platform/PRIORITIES.md`, `platform/ROADMAP.md`, `platform/DOCUMENTATION_GAPS.md` or `platform/TECHNICAL_DEBT.md` is done, the library chat moves it here under the date it was moved, newest first. Closed issues go to `ISSUES_CLOSED.md`.
> **Full copies:** the working files as they stood before the 4 Nov cleanup are in `2026-11-04/`.

## Moved 2026-11-05 (~08:00 UTC)
- Merged 5 Nov: #174 (readability), #175 (Block X Sunday fun rounds, final Mon 00:00), #176 (target architecture, CONTRACTS), #180 (Picks owner handover tool) — 2026-11-05
- Owner's nodes checked: chain v1.5.2, block producer v1.3.1, jsonrpc v1.2.0 — 2026-11-05
- PostHog visit counting checked live by the owner — 2026-11-05
| R-BX-23 | **From the Race chat (5 Nov):** check that Block X Sunday targets count for All time only (#160), and that `results.js`'s Block X **week total skips Sunday** | D-129, #155, #160 | checked or a small PR | ✅ covered by #175 (Sunday fun rounds, All time only; week totals skip Sunday) |
| R-BX-24 | **Block X goes final at Mon 00:00 UTC (D-135, owner 5 Nov):** drop the 12-h final (Mon 12:00 UTC); final no earlier than Mon 00:00 once the week-end re-reads pass, like the Race; keep the Sunday hold rules; update tests, `games/BlockX.md` and `standards/WEEK_CYCLE.md` §4 | D-135, D-125 | PR, before the first paid week ends (Mon 16) | ✅ #175 merged 5 Nov (final from Mon 00:00 UTC, D-135); optional post-merge Repo Lens `claude/blockx/REPOLENS-PR175-POSTMERGE-PROMPT.md` |
| R-BX-3 | **Picks owner handover (D-096):** build `owner-propose` / `owner-accept` / `owner-cancel` per the plan `docs/blockx/OWNER-HANDOVER-PLAN.md` (PR #79, merged 4 Nov; its two owner questions still open), with tests, and `MAINNET_OWNER` read from `picks-data/deployment.json`. Coordinate the order with Survivor's game-3 Picks registration (a handover clears pending announcements and upgrades) | I-076, D-083, D-096 | merged by Fri 6 Nov | ✅ tool built: #180 merged 5 Nov (`owner-propose` / `owner-accept` / `owner-cancel`); the owner runs the handover when ready (D-106; Repo Lens prompt `claude/blockx/REPOLENS-PR180-HANDOVER-PROMPT.md` before the first mainnet use) |
| R-RACE-15 | **After #155:** confirm the first production Race run on `e64be6a5` is green (owner checks GitHub); optional post-merge Repo Lens of `9fc79b53` + `c1011e58` (`claude/race/REPOLENS-PR155-POSTMERGE-PROMPT.md`). Accepted as-is: B7-3 (deadline from run start), B7-5 (Sunday results not re-checked) | #155, #B-7 | first run green | ✅ production Race runs green on #155 (04:34, 05:38 UTC, 5 Nov) |
| R-FA-1 | Add a Free play board (no prize yet); say what it needs (picks contract, recorder, page) and how big the change is | D-081 | plan, then PR | ✅ Free play board built (3 Nov) and its vault-check compatibility tested (`fantasy` @ `9b63675`) |
| R-FA-3 | **Card quality gate:** Fantasy uses Race cards without checking their sample count (≥ 12) or flags. Add the same gate Block X and Combo use (this settles the "flagged cards" question with the owner) | I-062, `../archive/2026-11-05/HANDICAP_REVIEW.md` §5.1 #6 | PR + test, before launch | ✅ card quality gate built and tested (`fantasy-math.js` `usableCard`) |
| R-GO-1 | Add a Free play board (no prize yet); say whether it affects practice with Block X or the Survivor hole reader | D-081 | plan | ✅ Free play board built (`def0edb`, carried into `golf-v2`); no effect on practice or a Survivor hole |
| R-GO-2 | Confirm whether practice also waits for the sampler, or only for Block X (it's live) | I-060 | answer | ✅ answered: practice doesn't wait for the sampler; Golf reads only published boards |

## Moved 2026-11-05 (late)
- Merged 5 Nov: #164 (token addresses), #165 (status-sync), #166 (owner answers), #167 (D-137 – D-140, REPO_MAP), #168 (visit counting), #169 (go-live order), #170 (HEALTHCHECK), #171 (question wording), #172 (three games reactivated) — 2026-11-05
- Owner: `1635QU…` holds over 100 KOIN (enough for Monday's upload) — 2026-11-05

Finished chat requests:
| R-RULER-1 | **Build the shared VHP ruler** from `../standards/VHP_RULER.md` (its §7 data, §8 simulations, §10 plan, §13 interface), starting from the Bracket's `vhp-standard.js` / `bot/vhp-chain.ts` (branch `kg-09-bracket`): `vhp-ruler.js`, `bot/vhp-ruler.ts`, the `vhp-data` recorder and publish check, tests and the 11 simulations of §8; then Repo Lens. Fold in any changes from the design review | D-108, D-110, R-LIB-5 | library + tests + simulations + Repo Lens GO; the Race chat then moves first (R-RACE-5) | ✅ merged to `main` (#163 @ `978c96b`; #B-6 re-check GO). Recorder on: owner sets `VHP_RULER_ENABLED` (data only, D-128). The v2.1 build is **R-RULER-2** |
| R-HUB-18 | Official token addresses card on Get VHP and New to Koinos (KOIN, VHP, vKOIN on Ethereum and Solana; owner confirmed the addresses) | owner 4–5 Nov | PR | ✅ #164 merged 5 Nov |
| R-HUB-19 | Cookieless visit counting with PostHog (our own pinned copy, page views only, Terms §8) | owner 4 Nov, D-143 | PR | ✅ #168 merged 5 Nov |
| R-HUB-20 | Daily Questions in plain words, display only (on-chain wording, hash and scoring unchanged) | owner 4 Nov, D-144 | PR | ✅ #171 merged 5 Nov |

Owner steps done:
- [x] `1635QU…` holds at least 95 KOIN (owner, 5 Nov: "over 100 koin"). Don't move it until after Monday's upload.

Technical debt paid down (as it stood):
- **TD-02, the vault paying from files it can't fully verify (Race):** fixed by the Race hold (#85), the payout safety PR #133 (held-week alerts, the vault file recomputed from the chain, published final race results locked) and the Sunday review day (D-125). Block X's published finals are locked too (#159). The general bot-side points recompute for every game stays I-080 (`../standards/RECORDER_STANDARD.md` §1).
- **TD-13, Block X's "before prizes" fix list:** PR #80 merged.
- **TD-15, nicknames don't stick:** fixed by PR #95 (I-020).
- **TD-24, the legacy name-claim workflow's `issues` permissions:** removed with the claim flow (#137, D-118); the CI guard now refuses any `issues` permission.

Documentation gaps closed (as they stood):
- **Keys and roles** (#3): `KEYS_AND_ROLES.md`.
- **Sponsor** (#10): `SPONSOR.md`, the one home for its live values.
- **PC recovery**: `RECOVERY.md` (its own open points are #33 – #35).
- **Alerts**: `ALERTS.md`; #36 closed too (`docs/WALLETS.md` §6 lists the other expected emails, 4 Nov).
- **README and `SECURITY.md`**: the root README describes the whole platform and `SECURITY.md` says how to report a problem (D-115, PR #131).

## Closed 5 Nov (library sync)
- Gap 8: closed 5 Nov — VISION folded into `FOUNDER_INTENT.md` (old file in `../archive/2026-11-05/`)
- Gap 12: closed 5 Nov — `AUDITS.md` written
- Gap 13: closed 5 Nov — `GLOSSARY.md` written
- Gap 30: closed 5 Nov — `../standards/WEEK_CYCLE.md` §1 and `GLOSSARY.md` hold the week labels

## Written 5 Nov (was: being written)
`platform/CALENDAR.md` (every dated step), `platform/AUDITS.md` (closes #12), `platform/GLOSSARY.md` (closes #13), `standards/WEEK_CYCLE.md` (the one home for every game's weekly timing), `standards/NEW_GAME.md` (step-by-step onboarding for a new game).

## Moved 2026-11-05 (status-sync, evening)
- Merged 4–5 Nov: #142, #150, #157 (Stake page manages Daily Questions; gentle reads; claim choice D-132), #143 (Block X Results tab), #154 (one sponsored claim per transaction, fallback), #155 (Race Sunday fun races, D-129; L-4 daily), #158 (site Mana limits at the 2.4 cap, D-131), #159 (Block X finals locked, tests), #160 (Block X on the weekly rhythm), #161 (HEALTHCHECK), #162 (v6.1 weekend runbook dates, D-130) — 2026-11-05
- Sponsor config on mainnet: cap 2.4 and 8 rows, switch ON, vault switch ON (tx `0x1220a593…1bfc`, owner) — 2026-11-04
- Vault v6.1 Repo Lens round 2 (#E-16): GO to announce; N-1 fixed in `3f74a33` — 2026-11-04
- VHP ruler Repo Lens #E-14, #B-5, #B-6 findings fixed (`a26571d`, `b7259a3`); #B-6 re-check GO; **PR #163 merged** at `978c96b` (off until turned on) — 2026-11-05
- Race #155 merged (Sunday fun races D-129, L-4 daily owner-hold email, Repo Lens #B-7 GO); R-RACE-13, R-RACE-14 done — 2026-11-05
Owner steps done or replaced (from TODOS, as they last stood):
- [ ] **Message the Hub chat** (start message): its list has the Stake tab (R-HUB-9), the admin follow-ups (R-HUB-8), @names (R-HUB-3) and the guest-wallet messages (R-HUB-4) — P2
- [ ] **Send every chat the same start message** (`CHAT_REQUESTS.md` §1) — P2 — D-089
- [ ] **Vault upgrade, Path 2 (D-116):** Repo Lens round 1 (and round 2) → **Tue 10 Nov, after the handover accept: announce, signed by `1LMV8E…`** → **Thu 12: upload** (the new owner needs ≥ 95 KOIN of Mana) → merge #114, then #141 and #142. Don't announce earlier — P1 — D-116
- [ ] Try one small sponsored stake on the live site (staking now asks 1.5 Mana) and tell the Block X chat it worked (R-BX-18, I-088) — P2
- [ ] **Repo Lens queue, in this order:** (1) the vault upgrade #114 on its latest commit (ask the Vault chat for the prompt), before the Tue 10 announce; (2) Questions #152 `claude/questions/REPOLENS-PR152-PROMPT.md` (before the Thu 12 upload); (3) the ruler re-check `claude/ruler/REPOLENS-FIXCHECK-E14-B5-PROMPT.md`; (4) Race #155 `claude/race/REPOLENS-PR155-PROMPT.md`; (5) Stake page #154 (ask the Hub chat) — P1
- [ ] Decide: move the audit reports and raw chat exports out of the public repo (doesn't touch `CHAT_REQUESTS.md`) — P2 — D-115
- [ ] Later (on hold, your call): the GitHub CODEOWNERS / ruleset step (C5-13). Don't require code-owner review without a bypass for yourself — P3
- [ ] Paste the D-112 answers to the VHP Ruler chat (OK the plan; push to branch `vhp-ruler`) — P2 — D-112
- [ ] Once R-VAULT-10's script exists: back up the three producer keys (game/pool, Desk, personal) to a USB stick kept offline, apart from your wallet paper — P2 — TD-08
- [ ] **Thu 5 Nov after 7:51 AM PT:** `npm run bot -- game-apply 2`, `game-apply 7` (dry run, then `--send`), then `games` must show "staked + free prize, from week 3"; then repo variable `PRIZES_FROM_WEEK = 3`. Deadline **Sun 8 Nov 4 PM PT** — P1 — D-077 (reminder Thu 9 AM PT)
- [ ] **Wallet moves** per `docs/WALLETS.md` (D-083, D-096): **Fri 6 Nov** step 0 (read-only check; paste the output to the Vault chat), create the cold-key owner and cold treasury, start the treasury move (48 h) → **Sat** sweep the old operator `1JSTwo…` (I-045) → **Sun** after every `game-apply`, start the vault and Desk handovers → Mon/Tue accept. Race picks already moved (4 Nov); **Picks later** (D-106) — P1 — I-001
- [ ] Retry creating an @name on `names.html` and report the result — P3 — I-020

Priorities done (from PRIORITIES):
| 7 | **Site "Week 1" refresh** before Mon 9 Nov | Players see one clear starting line for the vault era | Hub, Race chats | I-069, D-063 |
| 14 | **Fix nicknames** (the mint never sets the main name) | Players see their own name on the boards: identity drives engagement | Hub chat | I-020, TD-15 | (done: #94, #95, owner fixed his @name)

ROADMAP's key-dates table as it last stood (now `platform/CALENDAR.md`; Survivor 16 Nov and the 23/30 Nov Questions upgrade are superseded by D-113 and D-130):

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


Finished chat requests (rows as they last stood):
| R-RACE-13 | **A held Race week fails the run and says what to do (D-107):** make the I-034 hold / `RACE_HOLD_WEEKS` / held-file cases `::error::` after publishing (like Block X's E4-7), with a message naming the week, why, the deadline and the owner's options (wait; `RACE_HOLD_WEEKS` to hold longer; how to release; `game-void`). Add the Race's lines to `RUNBOOK.md` §3 | I-087, D-107 | PR + tests | ✅ done: #133 (test fix #153); L-4 "daily" owner-hold email built in #155 (`OWNER_HOLD_ALERT_HOUR` 16; chain checks still run under the hold); Repo Lens #B-7 GO |
| R-VAULT-5 | **Check `platform/RUNBOOK.md`:** confirm or correct every vault, Desk, sponsor and key step, especially those marked ❓ (§6 manual tick without an operator key, §7 hostile owner announcement and sponsor key, §9 withdrawals-only build). Edit it in your PR | DOCUMENTATION_GAPS #2 | runbook confirmed | ✅ #105 merged |
| R-VAULT-7 | **#D-4 follow-ups:** (1) make sure CI builds the sim before `bot/vault.test.ts`, since the VB tests are *skipped*, not failed, without it; (2) N-2 `capScope: "staked"` for game 9 before the Bracket nears 1,000 players; (3) N-3 treat a resource/rc revert as temporary; (4) take the Picks handover **out** of this weekend's runbook (D-106: later, once its tool is ready), and record that the **Race picks owner already moved** on 4 Nov to `1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd` (tx `0x1220bd9c…`), with `RACE_WIF` going offline at the weekend | #D-4, D-096 | (1) and (4) before the weekend; (2), (3) before the Bracket launches | ✅ #106, #108 merged |
| R-Q-1 | **Plan doubled Questions (D-092):** 10 a day Mon–Sat, rounds at 12:00 and 00:00 UTC, the second opening when the first closes; starting after the first paid weeks. Plan: bot release/lock schedule, the release backup task, scoring and weekly points, question supply, Mana per player, site text. The contract cap (30 a week) is the Vault chat's part (R-VAULT-6) | D-092 | plan → owner OK | ✅ #98 merged with the Repo Lens #D-6 fixes; step 2 (60 a week) is R-VAULT-6 |
| R-BX-12 | **Block X on the Results page** (owner, 4 Nov): `index.html#results` has tabs only for Daily Questions and the Race. Add a Block X tab: set `"results": true` for `blockx` in `games.json` and add its drawing in `results.js` (as the Race's: each recorded week from `games-data/blockx/index.json` + `W###.json`, each target with its signer, how the picks went, the player's own pick and points, voids with their reason; "Only mine" and search). Read-only, built with `textContent`, nicknames through `names.js`. `results.js` is a shared site file: tell the Hub chat | — | PR + site tests; tab live | ✅ #143 merged |
| R-BX-20 | **Check the Race #E-11 H-1 class in Block X:** can `games.yml` rewrite a published final **target result** (not only the vault file)? `games.yml` already holds a changed write-once file and a rewrite of published history (BX-88); confirm with a test that a final target result can't change, per `RECORDER_STANDARD.md` §3.3 (new line, 4 Nov) | I-093 | test or fix before Mon 16 Nov | ✅ #159 (tests; no gap found) |
| R-BX-21 | **Sponsor check for Daily Questions on the shared calls (from the Hub, 4 Nov; read-only first):** from the v6.1 rule week the Stake page sends game 1 through `deposit_to` / `withdraw_from` / `claim_game` (PR #142; claims batched up to 10, mixing games). Confirm: (1) with the vault switch on, does `Sponsor.ts` (`gamesOfOps`, any per-game list, `checkOperation`) pay those calls for game 1; (2) the `rcLimits` rows cover them with game 1 and a 10-claim batch, and the old calls (`deposit_vhp`, `deposit_koin`, `withdraw`, `claim`) stay covered; (3) `move_stake` is never sponsored, into or out of game 1. Any change: dry run first, nothing to mainnet without the owner's OK. Needed before Thu 12 Nov | D-116, D-121, PR #142 | answer + any config / PR before the upload | ✅ #154 + the 2.4 cap (#158 and the owner's config send, D-131); the Stake page asks the player (#157, D-132) |
| R-BX-22 | **The weekly rhythm (D-125, PR #148) for Block X (R-ALL-8):** play Mon–Sat, Sunday is the review day, final from Monday 00:00 UTC; Sunday targets stay, scored for All time only (D-129), from Week 1 | D-125 | PR + tests | ✅ #160 (first rest day Sun 15 Nov) |
| R-RACE-14 | **Race onto the weekly rhythm (D-125):** Sunday races are fun races, All time only (D-129; 24 count a week); pending through Sunday, re-checked on chain; final from Mon 00:00 UTC (replaces the 12 h hold); page shows Sunday as review day with fun races | D-125 | PR + Repo Lens | ✅ #149, #155 (D-129) |
| R-HUB-3 | **@names:** the mint doesn't set the main name (I-020). Also add two buttons on `names.html`: **"Make this my main @name"** (Nicknames `set_main_token`) and **"Remove an @name"** (`burn`), each from the wallet itself, with the player's own Mana. First use: the owner's producer `1DAHmrQJ…VdbBrd` shows `@primeprocuder` (typo) and should show `@primeproducer`. **Then put the names page in the Tools menu** (owner, 4 Nov): add "@names" → `names.html` to the Tools dropdown (`TOP`) and the phone More sheet's Tools group (`MORE_GROUPS`) in `tools/site-nav.mjs`, run `node tools/site-nav.mjs` and the site tests. Only after the owner has corrected his own @name with the new buttons and confirms it works | I-020, I-084 | fixed; both buttons live; owner confirms; names page in Tools | ✅ owner fixed his @name (4 Nov); Tools link #115 |

## Moved 2026-11-05
- Merged 4 Nov: #133 (Race payout safety), #153 (test fix), #148 (weekly rhythm standard, D-125), #149 (Race on the rhythm), #150 (Stake page gentle reads) — 2026-11-04
- PC updated to `main` @ `23dd23d`; self-heal dry run: all three nodes OK, 0 behind — 2026-11-04
- L-4 decided: daily emails for the owner's own Race hold — 2026-11-04

## Moved 2026-11-04 (night)
| R-RACE-11 | After #85 merges, the merge check's optional items: L-1 date the pending file at the end of the run; I-1 a run started by hand makes "an hour apart" really ~25 minutes; I-2 a doubled bracket in a `race.yml` comment | #85 merge check | PR | **in PR #133** (L-1 end-of-run date, I-1, I-2; 1 test) |
| R-HUB-5 | Remove the legacy name-claim workflow, issue template and claim CLI (drops the `issues` permissions; update `docs/NAMES.md`); add a YAML parser to the CI guard | I-026, I-022 | PR | ✅ part 2 merged (#137, D-118). Left: the after-the-fact Repo Lens fix-check of #95/#111/#99; widen the guard's WRITES list when a game adds a publish job; C5-13 on hold |
- R-HUB-5 part 2 live (#137); R-HUB-11 parts 1–4 live (#131); #131 and #137 merged on the owner's "merge both" — 2026-11-04
- VHP ruler steps (a)–(f) built on `vhp-ruler` @ `f85466b`; Repo Lens #E-12 GO with one fix, #D-10 fix first: all fixed — 2026-11-04

## Moved 2026-11-04 (late)
| R-BX-14 | `blockx.html` / `blockx.js` still say "once the vault is live": use the site's Week 1 wording (`weeks.js`, PR #94), like the Race (#86) | I-069 | PR | **PR #132** (`blockx-week1-wording` @ `8bf940a`); site tests pass. Owner merges |
| R-BX-17 | Push `sponsor-sr1` @ `acee3d7` (Repo Lens #D-7 SR-1: the upload guard over v2 code) and open a PR | #D-7 | PR | **PR #129** (`sponsor-sr1` @ `acee3d7`); 37 sponsor tool tests pass. Owner merges |
| R-BX-19 | **Sponsored staking Mana (urgent, before Thursday's `game-apply`) — built in PR #138, owner decided (D-117):** stake / withdraw / claim calls ask `rcLimitOther` = **1 Mana**, while the sponsor's own check costs ~0.75; a two-operation stake (approve + `deposit_to`) may fail for lack of Mana. If the owner OKs D-117: a site PR raising `rcLimitOther` to **1.5** (the per-transaction cap; no chain send), then measure the first real sponsored stake. Then, separately, the Picks row 1.2 → 1.3 (a `config` send + site PR, sponsor first) | I-088, D-117 | PR merged; first sponsored stake measured | **PR #138**: owner sends the sponsor `config` from `sponsor-limits-1-3` first, then merges; then measure the first sponsored stake |
| R-BX-13 | Round-14 fix-check Lows (optional): L-1 measure the re-read deadline from the start of the run (~22 min) with 2 tries per read; L-2 a one-off release for a held week (`BLOCKX_RELEASE` variable = week + hash of the exact held reason); L-3 the same `ls-remote` check in `games-testnet.yml`. Still open from round 14: E4-4, E4-5, E4-6, E4-8 | fix-check `FR6TU3784dCN935iffWLjB` (private) | PR + tests | **PR #128** (`blockx-lows` @ `2afe6d8`): Repo Lens re-check **GO** (3 Infos: I-1 no code for the "can't be recomputed" hold, I-2 a flag-plus-points test, I-3 missing race files on a scored target as a passing hold — a small follow-up). Owner merges before Mon 16 Nov |
| R-HUB-11 | **Public-readiness, site side (D-113, D-115):** (1) the site still fetches data and sets its CSP through the old repo name `raw.githubusercontent.com/bawcejawn/Knode/…` (8 js files, 9 html CSP lines, 5 tests): change to `KnodeGames` (works today only through GitHub's rename redirect); (2) **"Open source" on 16 pages → "Source-available"** (owner, D-115; the license stays proprietary); (3) branding: bare "Knode" → "Knode Games" (blockx.html brand and footer first, names.js, trust.html), package names and descriptions `kprediction`, the workflow name "Kpred bot", `KPRED_DEMO` (never the on-chain `kpred` namespace); (4) `admin/index.html` is published at `/admin/`: move it under a non-served path or leave it inert; (5) a plan (not a build) for deploying Pages from an allow-listed folder so `bot/`, `docs/`, `.ai/` aren't downloadable from knodegames.com, with no page URL changes. The README, LICENSE and SECURITY.md are done (library, D-115) | D-113, D-115 | PRs green; old name 0 hits in site code | **PR #131** (`hub-public-ready` @ `1c8cd57`, green): parts 1–4 (old repo name 0 hits, "Source-available", branding, package names `knode-games*`, workflow "Knode Games bot", `KNODE_DEMO`, admin page inert off localhost + robots). Part 5 plan: `claude/hub/PAGES-ALLOWLIST-PLAN.md`. #131 and #137 touch the same two test files: merge one, then check the other |
- Merged 4 Nov: #128 (Block X round-14 Lows), #129 (sponsor upload guard), #132 (Block X Week-1 wording), #131 (site public-readiness, R-HUB-11 parts 1–4), #137 (claim flow removed, D-118), #138 (sponsor limits, D-117; the owner sent the `config`), #135 (self-heal network retry) — 2026-11-04

## Moved 2026-11-04 (evening, session-ends)
| R-RACE-10 | In the sponsor switch-on run (R-BX-15 step SG-2) the Race picks row also goes to 1.2 Mana: check the Race page asks the same `rcLimit` | R-BX-15, R-BX-16 | checked with the site PR | open |
| R-RACE-4 | New free-prize wording on the Leaders page once game 7 is applied (today: "paid once the vault is live") | `games.json` | PR | covered by PR #86 (same change as R-RACE-6) |
| R-RACE-6 | Race page and the home page's Race rules: replace "vault not yet live" and update the free-prize wording (with the Hub's R-HUB-1) | I-027, I-069 | PR, before Mon 9 Nov | in progress: PR #86 updated (`race-page-wording` @ `d88d263`, local): "from Week 1, the week of Mon 9 Nov"; site tests 210/210. Owner pushes, then merges **after** Thu's `game-apply 7` |
| R-HUB-1 | "Week 1" refresh: show the week of Mon 9 Nov as Week 1 site-wide and replace "vault not yet live" text; write the week-label table (vault week, site label, file name) into `KOINOS.md` → Time | I-069, I-027, D-063 | live before Mon 9 Nov | in progress: PR #94 (new `weeks.js`; Race page text is R-RACE-6); merge before Mon 9 Nov 00:00 UTC |
- R-RACE-10 done: checked, no change (the Race page asks 1.2 Mana via `rcLimits`) — 2026-11-04
- R-HUB-1 done: PR #94 merged 4 Nov 05:21 UTC — 2026-11-04
- R-RACE-4 / R-RACE-6 done: PR #86 merged — 2026-11-04
- Hub (3–4 Nov, owner-merged): #115 "Get an @name" in Tools; #118 Stake page overhaul — 2026-11-04

## Moved 2026-11-04 (morning)
- Questions rounds: PRs #119, #122 (Repo Lens #E-9 ready to merge), #125, #126 (#E-10) merged; R-Q-2 done — 2026-11-04
- PR #79 (Picks owner handover plan, docs) merged — 2026-11-04
- Repo Lens #D-8 (#114 fix-check): announce now is fine; two measurements before the upload — 2026-11-04
- New root README (Knode Games platform), SECURITY.md, LICENSE holder "Knode Games", `node/README.md` (D-115) — 2026-11-04
- PR #86 (Race page prize wording) merged — 2026-11-04
- PR #120, #121, #123 (health check, launch board, keys and roles, sponsor, recovery, alerts, D-112) merged — 2026-11-04
- Repo Lens fix-check of PR #108 (vault-n2-n3 @ 5bb7b9b): GO; C7-1 fixed, C7-2 Info open; #108 merged — 2026-11-04
- Repo Lens #B-4 of PR #114 (v6.1): GO to announce; its three conditions done by the Vault chat (testnet measurement: 60th answer 0.061 Mana, settle with 60 answers 0.124) — 2026-11-04
- Owner started the VHP Ruler chat with `claude/ruler/START-PROMPT.md`; its build plan came back and was answered (D-112) — 2026-11-04
- Owner deleted `NEW_OWNER_WIF` from `.env` (Race picks owner change done; the new Race owner key `1LMV8EcR…` stays offline) — 2026-11-04 — D-083

## Moved 2026-11-04 (night)
- **Sponsor rollout done** (Block X handoff): upload `b84e1add…` (tx `0x122093bb…c340`, 07:27 UTC; settings and usage carried over); config with the vault off: per-tx 1 → 1.5, Picks row 1.2, new Race row 1.2 (tx `0x122075ac…d5c4`); PR #117 merged 07:30 UTC (site asks 1.2; upload record); switch-on config: vault on, 40 / 250 per player (tx `0x12208deb…6f81`). Checks: `would_pay` ok and free for `[]`, `[2]`, `[7]`, `[2,7]` (guest and a never-seen wallet); live guest picks paid by the sponsor: Race 0.888 Mana (block 40,783,161), Block X change 0.864 (block 40,783,173); the vault read adds ~0.13 Mana a pick.
- Ruler design v2 approved (D-111); PR #116 merged.
  | R-LIB-5 | **Design the shared VHP ruler (D-108):** from R-ARCH-1, `HANDICAP_REVIEW.md`, D-090, D-091, D-093, D-101: the ruler's interface, its data (exact event rebuild on two nodes), the look-back, card credit, averages, form, the luck trim/cap, random check points from a future block hash; how each game plugs in; how it replaces the sampler; a migration order (Race first) and the simulations that prove fairness. Owner approves; then R-RULER-1 builds it (new VHP Ruler chat) | D-108 | design doc → owner OK | design **v2** written (4 Nov) after Repo Lens #E-7 ("approve with changes"; every change made, `standards/VHP_RULER.md` §14). **Owner to approve §12** (point 1 replaces D-093's 2-week average) |
  | R-BX-15 | **Sponsor guest-trap fix: upload before staking in games 2 and 7 opens.** Repo Lens #C-3: **GO** for `b84e1add…` (`sponsor-guest-trap` @ `1ac3ef9`). Today the vault switch is **OFF** (stopgap `config --vault off`, 4 Nov), so vault-game stakes count as free play and the vault's own calls (deposit_to, withdraw_from, move_stake, claim_game, finalize_game_week) aren't sponsored. Steps: (1) merge the stopgap `86280c2` into `sponsor-guest-trap` (C3-1, so `--vault off` stays the rollback) and push; (2) owner rebuilds (hash must be `B84E1ADD3FFA14A7…`), `upload` dry run → `--send`; (3) `config` with today's caps (and any cap change the owner decides, R-BX-16) → only `vault (v6) live no → yes` changes → `--send`; (4) read-only `would_pay` for games `[2]`, `[7]`, `[2,7]` answers ok, then one guest pick on each page. Rollback: `config --vault off --send`. Optional: C3-2 (an exhaustive vault-shape test), C3-3 (add "re-check `sponsor.proto` against `kpred.proto`" to the vault upgrade checklist), C3-4 | I-005, #C-3 (private, `Nn47kwCG3kNbFcSi9PQvGU`); `claude/sponsor/handoff-2026-11-04-guest-picks.md` | uploaded, switch on, checks ok; before Thu 5 Nov's `game-apply` if possible | in progress: **PR #107 merged** (4 Nov; owner, after prompt 3). Next, the rollout from `main` (steps 0–12, Repo Lens artifact `NdHBXc9wcHbgiEFAiRuLAx`): upload `b84e1add`, per-tx 1.5 on chain, then the site PR raising `sponsor.rcLimit` and the Picks + Race rows to 1.2, then `config` with **40 a day / 250 a week per player (D-105)** to switch the vault back on; then the `would_pay` and guest-pick checks. Write the owner's exact commands, one step at a time |
  | R-BX-16 | **Mana caps for real pick costs** (measured 4 Nov: Race pick 0.76, Block X pick 0.84 Mana; more once the switch is back on). Propose numbers for the owner: `--per-tx` (1 is tight: the tool's 1.25× rule needs ≥ 1.053 for a Picks pick; suggestion 2), the Picks row (1.25–2 × measured), and the per-player day/week caps (25 a day ≈ 25 actions, while Block X allows 30 picks a day). Then `mana-report` after the switch is on | D-061, D-104 | numbers proposed → owner decides → config | decided (D-105): per player 40 a day / 250 a week; with the rollout's per-tx 1.5 and rows 1.2. Then `mana-report` after the switch is on |
  - [ ] **Sponsor rollout (R-BX-15):** steps in `claude/sponsor/ROLLOUT-STEPS-2026-11-04.md`. Before step 0: the Block X chat must **push** `sponsor-limits-1-2` (it isn't on GitHub yet), and put `CONFIRM_MAINNET=yes` in `.env` before the `--send` steps (take it out after) — P1
  - [ ] After Repo Lens reviews the ruler design: approve it, then start the new VHP Ruler chat (the library chat writes its first prompt) — P2 — D-110
  - [ ] **Read and approve the VHP ruler design v2** (`standards/VHP_RULER.md`: §0 in plain words, §12 the five points; Repo Lens #E-7 changes in §14) — P2 — D-108

## Moved 2026-11-04 (evening)
- R-BR-8 replaced by R-RULER-1 (D-110: a dedicated chat builds the ruler).
  | R-BR-8 | **Build the shared VHP ruler (D-108)** from the library chat's design (R-LIB-5), extending the VHP standard you own (D-058, `docs/VHP-STANDARD.md`): one library every game reads, with tests and simulations; after your #E-3 fixes | D-108, R-ARCH-1 | library + tests + Repo Lens; Race moves first (R-RACE-5) | open: build from `standards/VHP_RULER.md` once the owner approves it, after your #E-3 fixes (its §7, §8, §10, §13) |
- Hub session-end (06:55 UTC): #95, #110, #111 merged (by the Hub chat on the owner's OK); main checks and Pages deploy green on `ba5b1ab`. R-HUB-10 done.
  | R-HUB-10 | **Top menu tidy** (owner, 4 Nov): remove the **Info** dropdown. Move **Get VHP** into **Tools** (top menu and the phone More sheet's Tools group). Info's other links stay reachable: Trust, Terms & risks and Install app are already in the footer (`FOOT`); put "New here? Quick tour" in the footer too, or on the "New to Koinos?" page. Then `node tools/site-nav.mjs` and the site tests. Do it with R-HUB-9 (Stake tab) in one PR | — | menus updated; no page left unlinked | built in PR #110: Info menu removed, Get VHP in Tools, Quick tour in the footer |
- Hub session-end (06:45 UTC) filed: #95 updated, #110 (Stake tab, menus), #111 (guard follow-up). R-HUB-4 done (PR #97 merged), R-HUB-7 done (PR #100 merged; #94 and #100 were already merged before the report).
  | R-HUB-4 | **Guest wallet messages:** `wallet.js` shows "Free answers are used up" for *any* sponsor refusal, trap or unanswered `would_pay` check, so players see the wrong reason. Show the real reason (for a failed check: "the free Mana check failed; try a wallet with its own Mana"), as PR #66 did for the Block X page | I-082 | PR + test | in progress: PR #97 (`wallet.js`); the Race page is R-RACE-7 |
  | R-HUB-7 | Explain on the stake panel that a wallet that withdrew below the minimum mid-week gets no bucket share and no free prize (`peak_stake`) | I-028 | text live | in progress: PR #100 (merge after #94; small rebase, same files) |
- Owner, 22:29 PT: merged #99 (CI guard step), #85 (Race hold, I-034 closed), #109 (R-RACE-9), #107 (sponsor rollout code); decisions D-105 – D-108.
  | R-RACE-1 | The vault file must not be decided by a single run with no hold | I-034 | fixed before 16 Nov | in progress: PR #85 @ `20845a0` — **Repo Lens merge check GO** (per the Race chat, 4 Nov; check `XQ7qKZk3…`). Waiting for the owner's merge (before Mon 16 Nov 00:00 UTC). After the merge, follow-up R-RACE-11 |
  | R-RACE-9 | **C4-3 tidy-up** (Repo Lens #C-4 on #93, Info): in `changeOwner`, if either node returns no race config (`{}`, e.g. a wrong race address), `Number(undefined)` is NaN on both sides and the message wrongly says the nodes "disagree about picks per day (NaN; NaN)". Check for a missing config first and stop with "no race settings on chain at <node>", with a test | #C-4 (private, `Q6oA86PGVHVoD46fxUtEpc`) | PR + test | built: **PR #109** (`race-owner-missing-config` @ `015dd8f`): each node's race settings are checked before comparing; test fails on `main`, passes on the branch; owner tests 15/15, Race tests 110/110. Owner merges |
  - [ ] **Merge PR #85** (Race hold; merge check GO) and **PR #109** (Race owner-change tidy-up) — P1
  - [ ] Decide: should a held Race week fail its run and email you, like Block X (I-087)? — P3
  - [ ] Decide for R-RACE-5 (the Race's two handicap gaps): wait for the shared VHP ruler design (R-ARCH-1, no chat started yet), or ask the Race chat for a Race-only plan now — P2
  - [ ] **Repo Lens prompt 3** for the sponsor rollout (`claude/sponsor/rollout-sg1-fixcheck-prompt.md`, PR #107); on GO, merge #107 and follow the rollout steps (R-BX-15) — P1
  - [ ] **Decide the sponsor caps** (R-BX-16): Repo Lens suggests per transaction 1.5 Mana, Picks/Race rows 1.2, per player 40 a day / 250 a week — P2
  - [ ] **Decide when the Picks contract changes owner** (R-BX-3 isn't built; it was due Fri). A handover clears pending Picks announcements, so it must not overlap Survivor's game-3 registration (announce Sat 7 – Fri 13, apply by Sun 15) — P1
  - [ ] **Merge PR #99** (CI guard step; Repo Lens #C-5: ready to merge) — your OK — P2
- Race session-end (06:40 UTC) filed: R-RACE-7 done (PR #103 merged), R-RACE-8 done (confirmed; I-031 closed), R-ALL-6 review done for the Race (gaps → R-RACE-12).
  | R-RACE-7 | **Race page error messages:** `race.js` turns any "used up" into "Today's picks are used up (changes count)". Show the real reason, as PR #66 did for `blockx.js` | I-082 | PR + test | built on `race-pick-errors` @ `a545114` (local): only RACE: contract messages get game wording; test fails on `main`, passes on the branch; site tests 211/211. Owner OKs the push, then a PR |
  | R-RACE-8 | Confirm nothing is left of the Race-file conflicts from the `picks` merge (PR #57) | I-031 | confirmed | open (low) |
- R-LIB-4 done: second cleanup pass merged (PR #87).
  | R-LIB-4 | Second cleanup pass: game files, ARCHITECTURE, PLATFORM, HEALTHCHECK, standards (same rule: one home per fact; done items to the archive) | — | PR | open |
- Race session-end (05:45 UTC) filed. R-RACE-3 done: #84 and #93 merged and used; Race picks owner → `1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd` (tx `0x1220bd9c…`, both nodes); picks on/off and per-day unchanged. The C4-3 tidy-up moved to R-RACE-9.
  | R-RACE-3 | **Race picks owner change (D-096):** build the safe owner-change command (dry run, address entered twice, read-back) with tests; say whether a two-step handover is possible in a future upgrade and how `RACE_WIF` can stay offline | I-077, D-083, D-096 | merged by Fri 6 Nov | done except a tidy-up: #84 merged (Repo Lens GO) and #93 merged (#C-4 GO). Left: C4-3, stop with "no race settings on chain at <node>" when a node returns no config, with a test |
- Hub session-end (4 Nov 05:17 UTC) filed. R-HUB-2 done: the staking hub reads the live vault on mainnet (week 2, minimum 1 VHP, game 1 only until Thu's `game-apply`); the Questions status bar shows "Staked · 1 VHP"; the Race bar's old text is fixed by PR #94.
  | R-HUB-2 | Check the staking hub, status bars and panels on mainnet now that the vault is live | — | checked | open |
- Owner, 21:15 PT: `sponsor-limit 0 --send` done (tx `0x12209299478ad245a288e103eab3a195358c9572b8b355872a5ccc3ce7e43f2e548f`); `chain-check`: everything matches, vault and Desk `authorizes_*` all true, no pending transfers, upgrades or seed withdrawal, Desk holds 1,823.54 KOIN + 19,425.45 VHP. Guest picks on Race and Block X tested by the owner: they work.
  - [ ] **Stop the vault paying others' Mana** (D-099): `npm run bot -- sponsor-limit 0` (dry run, then `--send`), then merge PR #89 (`maxSponsorRc: "0"`) right after — P2 — I-044
  - [ ] **Read-only check:** the authorize/upload protections are on for the vault and the Desk (`npm run bot -- chain-check`; Repo Lens rated the Desk Critical if they're off); paste the result to the Vault chat — P1 (from the old checklist MKKtXR t12, D-100)
  | 5 | **Stop the contract paying other people's Mana** (`sponsor-limit 0`) | Every day it runs costs compounding: pool rewards players never see (~317 KOIN by 28 Oct) | owner | TD-05, I-044 |
  | TD-05 | 📜 | **The game/vault contract still pays Mana for other people's transactions** (`max_sponsor_rc` = 2 KOIN) | ~317 KOIN of compounding lost by 28 Oct; the drain continues while it's on | `sponsor-limit 0` with `maxSponsorRc: "0"` in the same change | I-044, D-046 |
- R-BX-0 done: PR #90 merged; the owner confirmed guest picks work again (also removed: TODOS "guest picks blocked", PRIORITIES #1 "Unblock guest picks", ACTIVE_WORK "Urgent") (I-083 closed). PR #89 merged (`maxSponsorRc: "0"`, D-099); PR #84 merged (Race owner-change command, Repo Lens GO); PR #92 merged.
  | R-BX-0 | **URGENT: guest picks are blocked.** Sponsor v3 `would_pay` **traps** ("module exited due to trap") for a guest with games `[7]` or `[2]`; with games `[]` (an answer) it returns ok. Seen on both nodes, 4 Nov ~03:50 UTC; most likely since the vault switch (`game_has_vault`) went on, 3 Nov. Find which side traps (the vault's `get_game_player`, or the sponsor reading its answer); check whether `authorize` traps the same way; give the exact stopgap command (switch off with every cap passed unchanged; dry run only) and the proper fix, with a test against the real vault's answer, not a mock | I-083 | cause found; stopgap ready; fix + test | **open — first** |
- From TODOS: **PR #80** (Block X before prizes): wait for the round-14 fix (E4-1) and a fix-check GO, then merge **before Sun 8 Nov 4 PM PT** — P1 — I-042
- R-BX-1 done: PR #80 merged (`4d372da`) after the round-14 fix-check GO at `baeb2c6` (E4-1 a+b, E4-2, E4-3, E4-7 fixed). The fix-check's condition 1 (Block X recording on mainnet) checked ✅: `games-data` has `blockx/W001.json`, `W002.json`, `board.json`, `index.json`, last record 04:36 UTC 4 Nov, `games.yml` runs green.
  | R-BX-1 | **Before prizes (PR #80):** Repo Lens round 14 (3 Nov) is **No-Go until E4-1 is fixed**: (a) stop the Block X step when the race-data fetch fails; (b) the week-end re-read re-checks each void's reason. Tests as in the report. Also this week if easy: E4-2 (catch a failing re-read: hold, keep publishing), E4-3 (read 4 at a time + a time budget), E4-7 (a held week fails the run); later E4-4 (a sampler run past 58 min loses its samples, Low). Then a short fix-check. BX-105 (board freeze, display only) stays accepted | I-042, D-077; summary (private): `claude/blockx/ROUND-14-2026-11-03.md` | fix-check GO; owner merges **before Mon 9 Nov 00:00 UTC (Sun 4 PM PT)** | in progress |

## Moved 2026-11-04 (owner decisions D-097 – D-102)
- R-RACE-2 (farming recommendation) — **not needed**: the owner accepted farming for now (D-097).
  | R-RACE-2 | A short recommendation on free-prize farming by many empty wallets (owner decides) | I-035 | recommendation sent | open |
- From TODOS, settled by the decisions (the B1-2 fix itself stays open as I-034 / PR #85):
- [ ] **Race prizes:** decide B1-2 (I-034, the Race chat builds the fix), B1-3 free-prize farming (I-035, after the Race chat's recommendation) and back-fill vs "no prize" for past not-final weeks (I-033) — P1
- [ ] Give the go-ahead for the full platform audit — P1 — I-002, D-014
- [ ] Decide `sponsor-limit 0` for the game/vault contract (stop it paying Mana for others) — P2 — I-044
- [ ] Decide which owner checklist is the source of truth — P3 — I-032
- The old owner checklist artifacts (Qjk951, AuEhQT, KZSbd4, TDWD6H, 3bSxzS, 5Rc9KF, MKKtXR) were read on 4 Nov; their three untracked open items moved into TODOS (the vault/Desk protections check, the repo-level `OPERATOR_WIF` check, the Desk node's low block share). Everything else in them was already tracked, done or superseded. Those artifacts are retired (D-100).

## Moved 2026-11-04 (cleanup)

### Owner steps finished 3–4 Nov (from TODOS)
| Item | Done | Link |
|------|------|------|
| Switch the PC folder to `main` (`git branch --show-current` printed `main`) | 2026-11-03 | — |
| PR #73 (`docs/WALLETS.md` + weekend runbook) fixed by the Vault chat and merged; this also settles "get `docs/WALLETS.md` rewritten before the wallet moves" (DOCUMENTATION_GAPS #1) | 2026-11-04 | I-001, D-083 |
| PR #74 (vault bot checks) through Repo Lens #D-3 → fixes → #D-4 GO, merged | 2026-11-04 | I-051, I-052, I-064 |
| PR #67 (sampler: up to 12 samples a run), #66 (Block X pick errors), #75–#78, #81, #82 (docs) merged | 2026-11-04 | I-059 |
| `game-add 9` (Bracket) by Fri 6 Nov — **superseded**: the Bracket audit said fix first; it launches when ready, no 9 Nov target (D-088) | 2026-11-03 | D-064, D-088 |
| "Ask the Combo Card and Last Node chats whether they're cleared for mainnet" — **folded into** the audits list in TODOS and their work lists (R-CO-2, R-LN-5) | 2026-11-04 | I-016, I-065 |
| "Tell the game chats about D-081" — **replaced** by their CHAT_REQUESTS rows (R-ALL-1, R-SV-1, R-LN-1, R-FA-1, R-CO-1, R-GO-1); prompts were in `claude/prompts-2026-11-03-free-play.md` | 2026-11-04 | I-074 |
| "Ask the Block X chat about its before-prizes list" — **replaced** by R-BX-1 (built in PR #80) | 2026-11-04 | I-042 |
| "Tell the Hub the vault upgrade is done" — **replaced** by R-HUB-2 | 2026-11-04 | — |
| "Tell the Block X chat about S3-21 / S3-22, and the Vault chat that `vault.ts` should alert on a refused prize post" — S3-21/22 → R-BX-8; the refusal alert was built in PR #74 | 2026-11-04 | I-054, I-052 |
| "Tell the Block X chat: the mobile-nav test failing on `picks`, its files moved to the repo root on the Bracket branch, and the `upgrade-*` names in runbook steps 2–4" — the mobile-nav test passes on `main` (4 Nov); the Bracket branch update is R-BR-3; the runbook names are R-BX-9 | 2026-11-04 | I-062, I-063 |
| "Tell the Vault chat: Fantasy's source (C-22), Last Node's vault file format and HOLD files, verify staked lists" — HOLD files and staked lists done in PR #74; C-22 checked in code 2 Nov; Last Node's side is R-LN-3 | 2026-11-04 | I-064 |
| "Carry the chats' project docs into `.ai/`" (two I-009 items) — **moved** to the library's work list (R-LIB-3) | 2026-11-04 | I-009 |
| "Waiting on someone else" table — **replaced** by the chats' rows in CHAT_REQUESTS (R-BX-5, R-BX-6, R-BX-7, R-HUB-5, R-RACE-6, R-VAULT-8, R-LN-5, R-GO-3, R-BR-6, R-FA-2, R-CO-2, R-SV-2, R-ALL-7); "Ship V4, B1-1, B1-5" was confirmed done (R-BX-4) | 2026-11-04 | — |

TD-11 (moved to "Accepted on purpose", D-097), as it stood:
| TD-11 | 📈 | **Free prizes can be farmed with many empty wallets**, and they share the sponsor's first-come free pool | Real players can find the free pool empty; prizes go to farmers | Owner decision before Race and Block X free prizes | I-035 |

Ticked lines that were still in TODOS:
- [x] ~~Send the Vault chat its two prompts~~ — sent 3 Nov; answers: PR #73 (wallets) and PR #74 (vault bot checks)
- [x] ~~Send the Bracket audit prompt to Repo Lens~~ — done; report 3 Nov: fix first (R-BR-1); decisions D-086 – D-088
- [x] ~~Merge the docs cleanup PR~~ — #72 merged 3 Nov

### Chat requests finished (from CHAT_REQUESTS)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-VAULT-1 | Fix PR #73 (`docs/WALLETS.md` + weekend runbook): 3 High, 6 Medium, 5 Low from the independent check. The full list was sent 3 Nov (`claude/prompts-2026-11-03-boards-owners-vault-reply.md`) | I-001, D-083 | fixes pushed; owner merges before Fri 6 Nov | done 4 Nov — PR #73 merged (`docs/WALLETS.md` + weekend runbook) |
| R-VAULT-2 | **PR #74 — Repo Lens #D-3 (3 Nov): fix first.** Report (private): `claude/audit-vault-bot-checks-D3-report.md`. Fix on `vault-bot-checks`, one finding per commit, each with a test that fails on `eaa47b0` and passes after: **VB-2** (High) `vaultFinalizePass` treats `{ok:false}` as success → `if (!sent(await send(...)).ok \|\| ctx.dryRun) break;`, and route every `Send` through `sent()`; **VB-3** (Medium) record a refusal only for a chain revert (`reverted:`), retry network / Mana / "not seen in a block" next run; **VB-4** (High) optional `vaultGames.<id>.board: "none"` that skips the staked-list check (logged), set for game 3 (Survivor) unless Survivor publishes a board (R-SV-3); **VB-5** (Medium) optional `vaultGames.<id>.minPts`, 100 for game 8 (Combo); **VB-1** (High, before Last Node launches) a `HOLD-W<n>.json` holds unless `RELEASE-W<n>.json` exists; read `why` as well as `reason`; Lows if quick: VB-10 (alert when a file is first seen with < 2 h left), VB-8 (read only `ranked: true` rows), VB-6 (skip rows past the board's cap or ask games to keep every ≥ 1-point row), VB-7 (use max(min, 1 VHP)) | I-051, I-052, I-064 | fixes pushed → Repo Lens fix-check GO → owner merges **by Fri 13 Nov** (VB-2 and VB-3 are enough for Race and Block X on 16 Nov) | **Repo Lens fix-check #D-4 (3 Nov): GO to merge by Fri 13 Nov** (report private: `claude/audit-vault-bot-checks-D4-fixcheck.md`). Follow-ups: R-VAULT-7 |
| R-VAULT-3 | `tools/sweep-old-bot.ts`: honour `$env:RPC`, default to Armana | I-078 | before the Sat 7 Nov sweep | done 4 Nov (in PR #73; test `tools.sweep-rpc`) |
| R-BX-2 | Sampler cadence: GitHub may run the 5-min sampler only about hourly. Decide whether `MIN_SAMPLES = 12` per 6 h card still fits, or change the schedule | I-059 | a decision + PR if needed | decided 4 Nov: `MIN_SAMPLES` stays 12; the sampler takes up to 12 samples a run (PR #67, merged 4 Nov) |
| R-BX-4 | Ship-check: confirm V4, B1-1, B1-5 shipped with PR #57 | TODOS → Waiting | confirmed | done 4 Nov: V4, B1-1, B1-5 (`d7fad7c`) and RV-1 are on `main` |
| R-LIB-1 | Emergency runbook with monitoring and alerts | DOCUMENTATION_GAPS #2, #26 | before Mon 16 Nov | done (3 Nov): `RUNBOOK.md`; the Vault chat checks it (R-VAULT-5) |

### Priorities finished (from PRIORITIES)
| # | Work | Value it creates | Owner | Refs |
|---|------|------------------|-------|------|
| 5 | ~~**Confirm the VHP sampler is running**~~ — running since 3 Nov 15:58 UTC ✅. Now: **decide the sampler cadence** (GitHub may run it only hourly) | Unlocks Block X's handicap cards, then Last Node, Combo and Fantasy pricing | Block X chat | TD-07, I-059 |
| 14 | ~~**Block X on the Leaders page**~~ — done (PR #63). Next: a Free play board and a Leaders entry for each new game (D-079, D-081) | One place to see every game's standings | each game chat | I-074 |
- Old numbering (3 Nov PRIORITIES): #2's vault bot checks: built and merged (PR #74, 4 Nov). #3's `docs/WALLETS.md` rewrite: merged (PR #73, 4 Nov). #16's emergency runbook and go-live checklist: written 3 Nov (`RUNBOOK.md`, `GO_LIVE_CHECKLIST.md`); the keys inventory is still open (R-LIB-2).

### Documentation gaps closed (from DOCUMENTATION_GAPS)
| # | Rank | Type | Gap | Where | Fix |
|---|------|------|-----|-------|-----|
| 3 | P1 | M | **No single key and role inventory.** Which keys exist (`OWNER_WIF`, `OPERATOR_WIF`, `SEED_WIF`, `SPONSOR_WIF`, desk / race / Picks keys), where each lives, what each can do, and the rotation status are spread over PLATFORM, TOKEN_STANDARD and chat notes | — | New `platform/KEYS_AND_ROLES.md` (names and locations only — never keys) — **Closed 2026-11-04: `platform/KEYS_AND_ROLES.md`.** |
| 4 | P2 | I | **Admin powers and upgrade paths are documented only for the vault.** For the desk, sponsor, Race and Picks contracts, "upgradable?" and the timelocks are blank — which also matters for knowing what the owner wallet move changes | `ARCHITECTURE.md` contract table (6 TBDs) | Fill in one row per contract: owner, what the owner can do, timelock, upgrade path — **Closed 2026-11-04: owner powers for every contract in `platform/KEYS_AND_ROLES.md` §4.** |
| 10 | P2 | M | **The Mana sponsor has no document of its own.** Its allowlist rows, per-action limits (the pick row 0.2 → 0.25 at Combo), caps, the config and vault-switch procedure ("a plain `config` resets the caps"), the testnet sponsor and budgeting are spread over six files | ARCHITECTURE, DECISIONS, VAULT_STANDARD, TOKEN_STANDARD, KOINOS, PLATFORM | New `platform/SPONSOR.md` — **Closed 2026-11-04: `platform/SPONSOR.md`.** |
| 2 | P1 | M | **No emergency or incident runbook.** The steps for a vault emergency (`upgrade --safe`, sponsor limit 0, pause), a compromised key, a node or Armana outage, red bot runs, a late question release, or a bad results file are scattered across chats and three files | — | New `platform/RUNBOOK.md`: one section per incident — how to tell, what to run (PowerShell, dry run first), what to check after — ✅ `platform/RUNBOOK.md` (3 Nov); Vault chat checking the ❓ steps (R-VAULT-5) |
| 6 | P2 | C ⚡ | **Stale launch items:** ROADMAP still lists Block X step 8 and the announcement window as pending (done, D-070); I-065 says Block X is ready "once step 8" is done; TODOS still asks to "confirm which sponsor version is live (v2 or v3)" (settled, C-01) | `ROADMAP.md` lines 20, 30, 39; `OPENISSUES.md` I-065; `TODOS.md` | Mark done / remove **— ✅ fixed in the 3 Nov cleanup (ROADMAP, I-065, TODOS)** |
| 7 | P2 | C ⚡ | **Settled items still flagged:** the DECISIONS index shows D-020 "prize ⚠️ C-24" (settled by D-068); D-008 and D-032 headings still carry ⚠️ though superseded; README calls the archive "not yet sorted" (all filed) | `DECISIONS.md`; `README.md` | Remove the flags; update the README line **— ✅ fixed in the 3 Nov cleanup (index statuses and legend; README)** |
| 16 | P3 | C | **"New games launch on a Monday" (D-059) reads as a rule** in GAME_STANDARD, while the owner's later decisions are "announce when ready" with a Friday target (D-052, D-064). They're compatible — a game applied mid-week earns from the next Monday — but it isn't explained | `GAME_STANDARD.md` §4 | Reword: "a game starts earning on the Monday after it's applied" **— ✅ fixed in the 3 Nov cleanup (GAME_STANDARD and D-059 now say it's superseded and how the two fit)** |
| 22 | P4 | I | **CURRENT_STATE has no upkeep rule**, so it will go stale | `CURRENT_STATE.md` | Add "refresh after each launch step or weekly" to START_HERE **— ✅ upkeep set: CURRENT_STATE is refreshed at each weekly review (`WEEKLY_REVIEW.md`) and after each launch step** |
| 24 | P1 | M | **How the free-prize switch works and its starting values** were only in D-082 | — | ✅ `platform/FREE_PRIZE_SWITCH.md` (3 Nov). Owner still to set the values |
| 25 | P2 | M | **No game go-live checklist**: audit → merge → Leaders entry → `game-add … --free` → switch → `game-apply` → `games.json` live → announce. The steps are spread over GAME_STANDARD, VAULT_STANDARD §9, ROADMAP and chat notes | — | New `standards/GO_LIVE_CHECKLIST.md` (folds in #5) — ✅ `standards/GO_LIVE_CHECKLIST.md` (3 Nov) |
| 26 | P2 | M | **No monitoring and alerts guide**: what each workflow, the watchdog email and the bot's "problems" mean, and what to do | — | Section in the emergency runbook (#2), or `platform/MONITORING.md` — ✅ alerts table in `RUNBOOK.md` §1 |
| 27 | P2 | C | **Which source wins** was worded three ways (START_HERE, D-002, AI_CHAT_STARTER) | — | ✅ one order in D-002 (3 Nov), confirmed by the owner; START_HERE and the chat starter point to it |
| 28 | P3 | C | **Two names for saved notes**: `claude/handoff-<topic>.md` (instructions for another chat) and `claude/<area>/HANDOFF-<date>.md` (session-end reports) | — | ✅ both kept and explained in `SESSION_END_PROCESS.md` |
| 31 | P3 | C | **The 👤 mark meant two things** ("owner said" vs "owner does it" in ACTIVE_WORK) | — | ✅ ACTIVE_WORK now says "Owner:" for actions; 👤 always means "owner said" |
| 33 | P2 | M | **No recorder standard**: the rules that Block X's audits taught (clock checks, recompute at publish, per-file holds) weren't written down, so the Bracket re-learned them (#E-3) | — | ✅ `standards/RECORDER_STANDARD.md` (3 Nov) |

Also closed: #1 (`docs/WALLETS.md` rewritten and merged, PR #73, 4 Nov); #5 folded into #25 (go-live checklist). From "Systems not fully defined": sampler cadence (decided, PR #67), vault bot checks (PR #74 merged), wallet split (runbook in `docs/WALLETS.md`, PR #73). The 3 Nov action plan's done steps (WALLETS rewrite, library cleanup, runbook, free-prize guide, go-live checklist, sampler cadence, vault bot checks) are in `2026-11-04/DOCUMENTATION_GAPS.md`.

#### Suggested order (2 Nov; superseded by the 3 Nov action plan, kept for the record)
1. **Before the weekend:** #1 (wallet procedure), #3 (keys and roles), #4 (who owns what).
2. **Before Friday's `game-add`:** #5 (launch runbook), #6 – #7 (quick fixes), #10 (sponsor).
3. **This week:** #2 (incident runbook), #8 (VISION), #9 (swap desk), #11 (scoring).
4. **Later:** #12 – #23.

### Technical debt paid down (from TECHNICAL_DEBT)
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-06 | 🚧 | ~~Race staking reads still use the old contract interface on `main`~~ — **paid down 3 Nov:** the v6 fix (`d7fad7c`) reached `main` with PR #57 | — | — | I-033 |
| TD-07 | 🚧 | ~~The VHP sampler isn't running~~ — **running since 3 Nov 15:58 UTC** (first run green) | Last Node's 48 h clock started | Keep an eye on its runs — **only 1 run by 16:41 UTC**, then a green manual run ~17:15; GitHub throttles `*/5` schedules (watch `*/15` runs ~hourly), so samples may fall short of 12 per 6 h. Block X chat to decide the cadence | I-059 |
- TD-07 follow-up, 4 Nov: PR #67 merged (up to 12 samples a run, ≥ 4 min apart; ~48 per 6-h card); `MIN_SAMPLES` stays 12 (R-BX-2).

### Roadmap: done milestones (from ROADMAP)
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
| PR #73 (wallets runbook), PR #74 (vault bot checks), PR #67 (sampler) merged | 4 Nov | ✅ |

Struck-through ROADMAP lines that were moved: "Merge `vault-v6` into `picks`" (done, `e7887b6`, I-019); "Block X: confirm whether any on-chain announcement exists; step 8; Mana check; launch PR `picks` → `main`" (all done, D-070, PR #57, live 3 Nov); "Sun 8 Nov ~21:23: Block X's Picks announcement probably stops being applicable" (moot: applied 2 Nov, D-070); "Write each game's spec into `.ai/games/`" (done 2 Nov); the free option for Fantasy, Golf, Combo and Last Node (decided: every game has Free play, D-081).

### Owner steps finished before 4 Nov (the old TODOS "Done" table)
| Item | Done | Link |
|------|------|------|
| Free-prize switch (D-082): Repo Lens GO (FP-2 fixed), **merged PR #65** | 2026-11-03 | D-082 |
| Block X on the Leaders page (PR #63) and the sampler docs (PR #61) merged | 2026-11-03 | I-074, I-059 |
| Race nicknames merged (PR #62; conflict with Block X's test resolved) | 2026-11-03 | I-073 ✅ |
| "Run the push block so `main` gets the docs" — **cancelled**: docs now go to `main` only through PRs the owner merges (D-026); 3 Nov docs went in as PRs #61, #64, #68–#71 | 2026-11-03 | TD-03 |
| `game-add` games 2 and 7 sent (applicable Thu 5 Nov 15:51 UTC). The original item also listed 9, and 8 and 13 "if cleared" (D-024, due Fri 6 Nov 4 PM PT): 9 is tracked in This Week; 8 and 13 wait for their audits (I-016) | 2026-11-03 | D-077, D-024 |
| Sponsor switched to the vault, caps unchanged ("Vault (v6): live"). Steps used: `npm run sponsor -- status`, copy the caps exactly (D-061), `config` preview showing "vault (v6) live: no → yes" with caps unchanged, then `--send`, then `status` again | 2026-11-03 | D-061 |
| Confirm which sponsor version is live (v2 or v3) — settled: v3 `b61ac238…` (C-01; unblocked I-005) | 2026-11-02 | C-01 |
| Block X launch PR (#57, `picks` → `main`) merged; Hub told via the Block X prompt | 2026-11-03 | I-040 |
| All chats exported and filed (the I-009 export item) | 2026-11-02 | I-009 ✅ |
| Merge `picks` into `main` with Race files resolved when Block X is ready; weekly check of `vault/W<week>.json` and `race.yml` runs — done with PR #57 (the weekly `vault/W<week>.json` and `race.yml` check continues in the weekly review) | 2026-11-03 | I-031 |
| Set `PINNED_PICKS` to `1LmgqB…`, record Repo Lens round 11, open the Block X launch PR (`picks` → `main`) after game 2 is applied — done: `PINNED_PICKS` set ✅ on `main`, launch PR #57 merged | 2026-11-03 | I-040 |
| v6-day fixes: `GAME_ABI` → `kpred-v6.koilib.json`, drop the early return, fail-fast v6 check, a 50-player v5-chain test, a fix-check — `GAME_ABI` now the v6 interface on `main` ✅ (TD-06); fix-check was round 12 | 2026-11-03 | I-033, I-036 |
| Producer nicknames on the Block X page (load `names.js`, CSP for names-data, `KNames.of` on every producer) — owner request — done (PR #60) | 2026-11-03 | I-073 |
| `reward_rule_week_plus_one=3` confirmed on chain | 2026-11-02 | I-003 |
| Accepted Week 3's 1 + 1 VHP free prize for the Questions game (no upgrade) | 2026-11-02 | D-069 |
| Block X recorder (`games.yml`) run by hand: green | 2026-11-03 | — |
| Block X in the top Games menu, the phone More sheet and on the home page (PR #59, deployed 16:09 UTC) | 2026-11-03 | D-077 |
| Vault: games 2 and 7 announced (`game-add`, 3 Nov); sponsor switched to the vault — "Vault (v6): live", caps unchanged; VHP sampler running (first run 15:58 UTC ✅) | 2026-11-03 | D-077, I-059 |
| Block X live on the Games page (PR #58); `GAMES_ENABLED = true` set — recorder runs hourly at :47 | 2026-11-03 | D-077 |
| **Block X Repo Lens round 12 GO; launch PR #57 merged** (sampler + Race v6 fix now on `main`) | 2026-11-03 | I-033, I-059 |
| Block X Picks status checked: announced 30 Oct, applicable since 1 Nov, not applied | 2026-11-02 | I-070 |
| **Block X applied on the Picks contract** (step 8) and its follow-ups (status, Mana check) | 2026-11-02 | D-070, I-040 |
| `vault-v6` merged into `picks`; Block X pushed `d7fad7c` | 2026-11-02 | I-019, I-033 |
| Game documentation written (`.ai/games/`, 9 files) | 2026-11-02 | — |
| Race: `PRIZES_FROM_WEEK = 3` merged (PR #56) | 2026-11-02 | I-069 ✅ |
| Payout time settled: Tue 12:00 UTC (≈ 12:07 with the bot); the 21:00 was a reminder time | 2026-11-02 | I-066, C-08 |
| Answered C-02, C-03, C-10, C-15, C-16, C-18, C-19, C-20; C-22 checked in code | 2026-11-02 | D-061 – D-067 |
| Survivor Season 1 date chosen: Mon 16 Nov | 2026-11-02 | D-065 |
| Survivor prize settled: 4 + 2 per season, paid at season end | 2026-11-02 | D-068 |
| `.ai/` library created | 2026-11-02 | — |
| Platform docs generated from the Questions chat; contradictions logged | 2026-11-02 | DECISIONS.md → Contradictions |
| `OPENISSUES.md` filled | 2026-11-02 | OPENISSUES.md |
| C-09 answered: the vault is the game contract | 2026-11-02 | C-09 (from the Vault chat) |
| `C:\kprediction-vault` check — answered by the Vault chat; folder in use | 2026-11-02 | I-011 |
| Clean up stale Git worktrees — **cancelled**, not needed | 2026-11-02 | I-011 |
| Vault v6 uploaded (Mon 2 Nov, 02:33 UTC) | 2026-11-02 | D-023 |
| `.ai/.ai/` nesting on `main` fixed (by the Vault chat) | 2026-11-02 | I-018 |
| Vault chat knowledge filed into the platform docs | 2026-11-02 | — |
| Five stake-panel fixes (PR #46) and three admin fixes (PR #43) | 2026-11-02 | I-012, I-013 |
| Race status badge merged (PR #44) | 2026-11-02 | — |
| Repo name confirmed: `bawcejawn/KnodeGames` | 2026-11-02 | C-06 |
| Block X chat knowledge filed; sponsor version and caps settled | 2026-11-02 | C-01, C-02 |
| Block X chat told the vault upload is done (it ships V4, B1-1, B1-5) | 2026-11-02 | owner |
| Survivor chat knowledge filed; C-13, C-14 settled | 2026-11-02 | D-051, D-052 |
| All 12 chats archived and filed (Last Node, Golf, Bracket, Fantasy, Combo last) | 2026-11-02 | — |
| Bracket sampling branches deleted (`bracket-history` kept) | ≤ 2026-11-02 | ✅ |
| Question-release task checked: NextRunTime 3:45 AM local (11:45 UTC) after the clock change | 2026-11-02 | D-047 |
| Swap Desk chat knowledge filed; C-04, C-05, C-11, C-17 settled | 2026-11-02 | — |
| Real swap tested on the site (3,000 VHP) | ≤ 2026-11-02 | Questions chat |
| Stale copy `C:\Users\<you>\repos\Knode` deleted | ≤ 2026-11-02 | Questions chat |
| Set a desk daily payout cap — **cancelled** (no cap, D-007) | 2026-11-02 | C-17 |
