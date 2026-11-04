# Knode Games — Chat Requests

> **Purpose:** the one work list for the chats. Each chat reads **its own section** at the start of every session and works the open items in order. (The owner's own steps are in `TODOS.md`.)
> **Owner's message to any chat is always the same** (§1). The library chat keeps this file current from session-end reports, decisions and audits.
> **Last updated:** 2026-11-04 (R-HUB-9 Stake tab; earlier: cleanup: finished items moved to `../archive/DONE.md`; the old TODOS "waiting on someone else" rows added here; guest-pick trap and Block X round 14 added)
> **Rules:**
> - Each item has an id (R-<chat>-<n>), a link (D-/I-/PR), what "done" means, and a status: **open** · **in progress**.
> - A chat reports finished items in its session-end report (`SESSION_END_PROCESS.md`). The library chat then **moves them to `../archive/DONE.md`** with the date. Ids are never reused.
> - **Private audit reports stay in the Claude project** (`claude/<area>/AUDIT-*.md`), never in this public repo. This file names the findings by id only.

## 1. The message the owner sends (same text to every chat)
```
Start of session. git pull main. Read .ai/START_HERE.md, then your section of .ai/platform/CHAT_REQUESTS.md. Work the open items in order, following .ai/standards/. Ask me before anything that sends to mainnet, spends funds or needs a decision. End with the session-end report (.ai/platform/SESSION_END_PROCESS.md).
```
New chats start with their starter prompt (`../standards/AI_CHAT_STARTER.md` §3), which points here too.

## 2. For every game chat
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-ALL-1 | **Free play on every game.** Your game has its own Staked **and** Free play boards, on its page and on the Leaders page (`games.json` → `board`). If your game's free prize is off for now, the Free play board says plainly that no VHP is paid | D-079, D-081, `LEADERBOARD_STANDARD.md` | both boards live; text checked | open |
| R-ALL-2 | **Your vault results file always fills `first` / `second`** with the free winners, even when the prize is off. The owner's free-prize switch decides whether they're paid | D-082, `FREE_PRIZE_SWITCH.md`, `VAULT_STANDARD.md` §6 | a sample file with free winners | open |
| R-ALL-3 | **Publish `board.json` for the vault check.** It sits next to your vault folder (or tell the library chat the path to set as `vaultGames.<id>.board`), has a `lastWeek` for the vault week, and each row has the wallet, `points` and a place, Staked and Free rows both. Every staked wallet with points must be in your vault file, and every file wallet must be on the board, in board order. Without this, the vault bot holds your weeks | I-079, PR #74, `VAULT_STANDARD.md` §6 | path + a sample row confirmed | open (done for Block X and Race ✅) |
| R-ALL-4 | **Nicknames** through `names.js` (`KNames.of`) everywhere a producer or player appears | D-078 | page loads `names.js` | open (done for Block X, Race ✅) |
| R-ALL-5 | **Vault registration** is always `game-add <id> "<name>" --staked --free --season <n>`. The owner sets the free-prize switch | D-082 | — | rule |
| R-ALL-6 | **Meet `standards/RECORDER_STANDARD.md`** (clock checks, points recomputed at publish, per-file holds, two nodes, write-once) and launch by **`standards/GO_LIVE_CHECKLIST.md`**. Review your recorder against its §8 checklist and list any gaps in your session-end report | RECORDER_STANDARD, GO_LIVE_CHECKLIST | gaps listed, then fixed before launch | open |
| R-ALL-7 | **Stake badge and panel:** every new game page mounts `KStake.badge` at the top of `<main>` and the full stake panel lower down | D-031 | page checked | rule |

## 3. By chat
### Vault
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-VAULT-4 | Recompute each game's points from on-chain picks in the bot | I-080 | a plan, then a build | plan written 4 Nov (`claude/vault/RECOMPUTE-PLAN.md`); **build after 16 Nov** |
| R-VAULT-5 | **Check `platform/RUNBOOK.md`:** confirm or correct every vault, Desk, sponsor and key step, especially those marked ❓ (§6 manual tick without an operator key, §7 hostile owner announcement and sponsor key, §9 withdrawals-only build). Edit it in your PR | DOCUMENTATION_GAPS #2 | runbook confirmed | open |
| R-VAULT-6 | **Vault upgrade for doubled Questions (D-092):** raise `MAX_QUESTIONS_PER_WEEK` from 30 to 60, plus anything the Questions plan (R-Q-1) needs on chain. Full upgrade path: audit, rehearsal, 48 h notice, weekend announce, Monday upload. Target after the first paid weeks (week of 23 or 30 Nov) | D-092, D-017, D-023 | plan, then build | open |
| R-VAULT-7 | **#D-4 follow-ups:** (1) make sure CI builds the sim before `bot/vault.test.ts`, since the VB tests are *skipped*, not failed, without it; (2) N-2 `capScope: "staked"` for game 9 before the Bracket nears 1,000 players; (3) N-3 treat a resource/rc revert as temporary; (4) add the Picks and Race picks handovers to the weekend runbook (D-096) | #D-4, D-096 | (1) and (4) before the weekend; (2), (3) before the Bracket launches | open |
| R-VAULT-8 | Bot support for the public-testnet vault copy (`testnet/vault.json`); retarget to the public testnet, or remove, `bot --testnet` and the admin page's "Vault v6 trial (local node)" | I-014, I-068 | flag built, or tools removed | open (low) |

### Daily Questions
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-Q-1 | **Plan doubled Questions (D-092):** 10 a day Mon–Sat, rounds at 12:00 and 00:00 UTC, the second opening when the first closes; starting after the first paid weeks. Plan: bot release/lock schedule, the release backup task, scoring and weekly points, question supply, Mana per player, site text. The contract cap (30 a week) is the Vault chat's part (R-VAULT-6) | D-092 | plan → owner OK | open |

### Block X (and Picks, and the Mana sponsor)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-BX-13 | Round-14 fix-check Lows (optional): L-1 measure the re-read deadline from the start of the run (~22 min) with 2 tries per read; L-2 a one-off release for a held week (`BLOCKX_RELEASE` variable = week + hash of the exact held reason); L-3 the same `ls-remote` check in `games-testnet.yml`. Still open from round 14: E4-4, E4-5, E4-6, E4-8 | fix-check `FR6TU3784dCN935iffWLjB` (private) | PR + tests | open (low) |
| R-BX-3 | **Picks owner handover (D-096):** build `owner-propose` / `owner-accept` / `owner-cancel` per PR #79, with tests, and `MAINNET_OWNER` read from `picks-data/deployment.json`. Coordinate the order with Survivor's game-3 Picks registration (a handover clears pending announcements and upgrades) | I-076, D-083, D-096 | merged by Fri 6 Nov | in progress (plan in PR #79) |
| R-BX-5 | Plan the next sponsor version: guest prize claims and the L-3 fix (plus the R-BX-0 fix, if it needs new contract code) | I-005 | a plan | open |
| R-BX-6 | After launch: B1-4 (a bad vault file stops the whole race run, cards included), B1-6, B1-7, B1-8 tidy-ups, then a short fix-check | I-037, I-038 | fixed + fix-check | open (low) |
| R-BX-7 | Move Block X onto the one VHP ruler, with the Race (R-RACE-5, R-ARCH-1) | D-058, D-090 | PR + Repo Lens | open |
| R-BX-8 | Publish check: run Block X's Python with `-I`, and drop `\|\| true` on listings (S3-21, S3-22); update the tests that pin those lines | I-054 | PR | open (low) |
| R-BX-9 | Runbook names: use `upgrade-schedule` / `upgrade-upload` / `upgrade-clear` in the Picks v2 runbook steps 2–4 (the Combo chat asked) | I-063 | runbook updated | open (low) |
| R-BX-10 | Testnet sponsor `1Dg8zKeH…` is OFF and still allowlists Combo's Picks v2. Before any Block X testnet use: `config --testnet --send` without the `TESTNET_PICKS*` variables | I-041 | config sent | open (low) |
| R-BX-12 | **Block X on the Results page** (owner, 4 Nov): `index.html#results` has tabs only for Daily Questions and the Race. Add a Block X tab: set `"results": true` for `blockx` in `games.json` and add its drawing in `results.js` (as the Race's: each recorded week from `games-data/blockx/index.json` + `W###.json`, each target with its signer, how the picks went, the player's own pick and points, voids with their reason; "Only mine" and search). Read-only, built with `textContent`, nicknames through `names.js`. `results.js` is a shared site file: tell the Hub chat | — | PR + site tests; tab live | open |
| R-BX-11 | Write the todo tests BXS-1, G-K-1, FC3-VHP-2, WEB3-23, WEB3-31 | I-039 | tests in | open (low) |

### Race
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-RACE-1 | The vault file must not be decided by a single run with no hold | I-034 | fixed before 16 Nov | open |
| R-RACE-3 | **Race picks owner change (D-096):** build the safe owner-change command (dry run, address entered twice, read-back) with tests; say whether a two-step handover is possible in a future upgrade and how `RACE_WIF` can stay offline | I-077, D-083, D-096 | merged by Fri 6 Nov | open — build now |
| R-RACE-4 | New free-prize wording on the Leaders page once game 7 is applied (today: "paid once the vault is live") | `games.json` | PR | open |
| R-RACE-5 | **Move onto the one VHP ruler (D-090)**, first the two known gaps: card credit (VHP added after a card gains nothing) and a longer highest-VHP look-back (the > 6-h hide). Coordinate with R-ARCH-1 | D-058, D-090, `HANDICAP_REVIEW.md` | PR + Repo Lens | open (raised: the Race pays from 9 Nov) |
| R-RACE-6 | Race page and the home page's Race rules: replace "vault not yet live" and update the free-prize wording (with the Hub's R-HUB-1) | I-027, I-069 | PR, before Mon 9 Nov | open |
| R-RACE-7 | **Race page error messages:** `race.js` turns any "used up" into "Today's picks are used up (changes count)". Show the real reason, as PR #66 did for `blockx.js` | I-082 | PR + test | open |
| R-RACE-8 | Confirm nothing is left of the Race-file conflicts from the `picks` merge (PR #57) | I-031 | confirmed | open (low) |

### Producer Bracket
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-BR-1 | Fix the Repo Lens #E-3 findings (report and failing tests in the project: `claude/bracket/AUDIT-2026-11-03-E3.md`, `claude/bracket/repolens-e3-tests/`). Order: H-1, C-2 + L-2, C-1, M-1, H-2 + H-3, M-3/M-4/M-9, then H-4 + H-5, then M-2, M-10, L-15. One finding per commit. Rerun the suites and the replay, then a fix-check | I-061 | all fixed; fix-check GO | open |
| R-BR-2 | **Owner decisions (3 Nov):** **keep the Knode Games Pool in the field and protect it** (judge pooled producers on the day's average or minimum effective VHP, not one block); judge **forfeits on the day's time-weighted average** (H-5); **accept same-block ties** and fix the comment and page text (H-6) | D-086, D-087 | built and tested | open |
| R-BR-3 | Merge `main` into `kg-09-bracket` before launch (16+ commits behind; the free-prize switch, nicknames standard, Leaders board) | L-16 | branch current | open |
| R-BR-4 | Confirm R-ALL-3 (board path and fields) for the vault check | I-079 | confirmed | open |
| R-BR-5 | **No 9 Nov target:** the Bracket launches when its fix-check passes | D-088 | — | rule |
| R-BR-7 | **Luck trim or cap (D-101):** the Bracket has neither. Add one, sized by simulation, with the #E-3 fixes | D-101, `HANDICAP_REVIEW.md` §5.2 | built + tested before launch | open |
| R-BR-6 | After the first live run, pin the block `effective_balance_of` uses (`effCheck` log) | I-061 (S-3/F-7) | pinned | open (after launch) |

### Survivor
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-SV-1 | Keep the Free play board; the 4 + 2 season prize is off for now (switch). Page says no VHP is paid on Free play; check whether "no prize" changes SV-A10 / SV-A19 | D-081, D-082 | page text + note | open |
| R-SV-2 | Repo Lens pass 4 → fix its findings, fix-check, push to `survivor` → update the brief, `claude/builds/04-survivor-plan.md` and checklist task t06 → testnet season → Picks registration → Season 1 Mon 16 Nov | I-050, I-053, D-065 | launched | open |
| R-SV-3 | **Vault check:** Survivor publishes no `board.json`, so PR #74 sets `vaultGames.3.board: "none"` for now. If Survivor later publishes a board with `lastWeek` (allowed in its publish allowlist), tell the Vault chat to remove "none" | I-079 | decided with the Vault chat before 16 Nov | open |
| R-SV-5 | **Luck trim or cap (D-101):** Survivor has neither, so a lucky small producer can top a day. Propose one (sized by simulation) and say whether it can go into Season 1 or waits for Season 2 | D-101, `HANDICAP_REVIEW.md` §5.2 | owner approves; built | open |
| R-SV-4 | Leaderboards and Results need a Survivor `board.json` and a Results adapter (with the Hub) | I-056 | live | open |

### Last Node Standing
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-LN-1 | Free play board **with** the 2 + 1 weekly prize: rule decided by the owner 3 Nov (guests need 1 VHP; 3 of 7 events; ties split) and built on `lastnode` @ `98a9896` (`claude/lastnode/FREE-PLAY-PROPOSAL.md`). Goes into the round-3 review with the round-2 fixes | D-081 | in the round-3 review; merged with the launch | in progress |
| R-LN-2 | Check whether the sampler as it runs now (PR #67: up to 12 samples a run) changes the 48 h readiness and the round-3 review | I-058 | answer | open |
| R-LN-3 | **Vault check (PR #74 VB-1):** when a held week is released (`LASTNODE_RELEASE_WEEKS`), publish `RELEASE-W<week>.json` next to the `HOLD-W` file (the publish job only adds files, so HOLD stays). Name the reason field `reason` (the bot reads `reason`; you write `why`). Keep every row with ≥ 1 point in `lastWeek` (VB-6) | I-064 | built + tested before launch | open — **without the RELEASE marker a released week stays held** |
| R-LN-4 | **Lower the entry bar (D-091):** today ≥ 20 expected blocks an hour (~1.7% share, top 23). Simulate a field with many small producers, propose a new bar (target: k ≥ 10 expected blocks in your scoring window) with a luck trim, and show the owner the results | D-091, `HANDICAP_REVIEW.md` §5.2 | owner approves the value; built | open |
| R-LN-5 | Launch path: fix the round-3 findings; restore `lastnode`'s 3-try push loop in `games.yml`; resync with `main`; prepare the game-13 announce/apply on mainnet Picks; confirm the sponsor covers game-13 picks; open the `lastnode` → `main` PR; write the GitHub-variable steps | I-058, I-065 | PR open; mainnet clearance confirmed to the owner | open |

### Fantasy Producers
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-FA-1 | Add a Free play board (no prize yet); say what it needs (picks contract, recorder, page) and how big the change is | D-081 | plan, then PR | open |
| R-FA-2 | Fix the Repo Lens findings, fix-check, a full test week (owner restarts practice in `C:\kprediction-fantasy`), the real-data simulation of the price formula; re-merge `main` | I-062 | done | open |
| R-FA-3 | **Card quality gate:** Fantasy uses Race cards without checking their sample count (≥ 12) or flags. Add the same gate Block X and Combo use (this settles the "flagged cards" question with the owner) | I-062, `HANDICAP_REVIEW.md` §5.1 #6 | PR + test, before launch | open |

### Combo Card
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-CO-1 | Let free players send cards and rank on a Free play board (no prize yet). Check whether that needs Picks v2, and how free cards meet the forged/unverified-card checks | D-081, I-074 | plan | open |
| R-CO-2 | Fix-check 4 and its findings; measure a live hourly run (record + verify) and pick the concurrency group or cron offset; testnet upgrade rehearsal (route B); re-merge `main` before the final merge; then the Picks v2 upgrade plan | I-063, D-060 | done; mainnet clearance confirmed to the owner | open |
| R-CO-3 | Confirm the vault floor: PR #74 set `vaultGames.8.minPts: 100` (your file needs ≥ 100 hundredths, 1 full point) | I-079 | confirmed | open (Combo to confirm) |

### Block Golf
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-GO-1 | Add a Free play board (no prize yet); say whether it affects practice with Block X or the Survivor hole reader | D-081 | plan | open |
| R-GO-2 | Confirm whether practice also waits for the sampler, or only for Block X (it's live) | I-060 | answer | open |
| R-GO-3 | Launch path: update `golf` from `main`, move the Golf files to the site root, full suite, PR, `GOLF_ENABLED=true`. Staked: register game 6, set `GOLF_STAKED_FROM_WEEK`. Revisit `MIN_FIELD=5` / `MIN_FIELD_VHP=10` with real stake data | I-060 | PR open | open |

### Hub (site)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-HUB-1 | "Week 1" refresh: show the week of Mon 9 Nov as Week 1 site-wide and replace "vault not yet live" text; write the week-label table (vault week, site label, file name) into `KOINOS.md` → Time | I-069, I-027, D-063 | live before Mon 9 Nov | in progress: PR #94 (new `weeks.js`; Race page text is R-RACE-6); merge before Mon 9 Nov 00:00 UTC |
| R-HUB-3 | **@names:** the mint doesn't set the main name (I-020). Also add two buttons on `names.html`: **"Make this my main @name"** (Nicknames `set_main_token`) and **"Remove an @name"** (`burn`), each from the wallet itself, with the player's own Mana. First use: the owner's producer `1DAHmrQJ…VdbBrd` shows `@primeprocuder` (typo) and should show `@primeproducer`. **Then put the names page in the Tools menu** (owner, 4 Nov): add "@names" → `names.html` to the Tools dropdown (`TOP`) and the phone More sheet's Tools group (`MORE_GROUPS`) in `tools/site-nav.mjs`, run `node tools/site-nav.mjs` and the site tests. Only after the owner has corrected his own @name with the new buttons and confirms it works | I-020, I-084 | fixed; both buttons live; owner confirms; names page in Tools | in progress: PR #95 (Make main + Remove). Cause confirmed on mainnet: `1DAHmr…` holds only `primeprocuder`, as main. Then the owner fixes it; then the Tools link |
| R-HUB-4 | **Guest wallet messages:** `wallet.js` shows "Free answers are used up" for *any* sponsor refusal, trap or unanswered `would_pay` check, so players see the wrong reason. Show the real reason (for a failed check: "the free Mana check failed; try a wallet with its own Mana"), as PR #66 did for the Block X page | I-082 | PR + test | in progress: PR #97 (`wallet.js`); the Race page is R-RACE-7 |
| R-HUB-5 | Remove the legacy name-claim workflow, issue template and claim CLI (drops the `issues` permissions; update `docs/NAMES.md`); add a YAML parser to the CI guard | I-026, I-022 | PR | part 1 in progress: PR #99 (YAML parser in the CI guard, `yaml` 2.6.1). Part 2 (remove the claim workflow, template, CLI and their tests) open |
| R-HUB-6 | Rebuild PR #50's useful parts on current `main` (`claude/handoff-pr50-salvage.md`) | I-072 | PR | open (P3) |
| R-HUB-8 | **Admin page refresh** (reviewed 4 Nov): `docs/ADMIN.md` still says `git checkout picks` (should be: stay on `main`); the Vault and Block X areas say "launching" (both live); the finished v6 upgrade steps ("is v6 ready / apply / clear") still show as live steps; vault-wide controls (pause deposits, the 5% fee, seed, upgrades, operator and owner handovers) sit under "Question game" though the game contract *is* the vault: move them to the Vault area; then add the Picks owner handover and Race owner change once R-BX-3 / R-RACE-3 land. The local-node trial is R-VAULT-8 | I-068 | PR + owner checks it on the PC | page refresh done (PR #88, `ed69025`); left: Picks owner handover and Race owner change buttons, after R-BX-3 / R-RACE-3 (#84 merged) |
| R-HUB-9 | **Staking hub as its own tab** (owner, 4 Nov): `stake.html` isn't linked from any menu today. Add a top-level **"Stake"** link in the top menu (`TOP` in `tools/site-nav.mjs`) and a **Stake** tab in the phone tab bar (`TABS`; keep the bar at 5 slots with More, propose which slot), run `node tools/site-nav.mjs` and the site tests. **First check it works and is up to date on mainnet** (with R-HUB-2): deposit, withdraw, move between games and claim against vault v6, with every live game listed (Questions, Race, Block X; games 2 and 7 stakeable from their `game-apply`, Thu 5 Nov), the minimum stake, the "Week 1" label (R-HUB-1) and the free-play vs staked wording. The rewards calculator is **not** wanted for now | R-HUB-2, I-069 | checked on mainnet; Stake tab live | open — not in the Hub session of 4 Nov 05:17 UTC (added after it started) |
| R-HUB-10 | **Top menu tidy** (owner, 4 Nov): remove the **Info** dropdown. Move **Get VHP** into **Tools** (top menu and the phone More sheet's Tools group). Info's other links stay reachable: Trust, Terms & risks and Install app are already in the footer (`FOOT`); put "New here? Quick tour" in the footer too, or on the "New to Koinos?" page. Then `node tools/site-nav.mjs` and the site tests. Do it with R-HUB-9 (Stake tab) in one PR | — | menus updated; no page left unlinked | open — with R-HUB-9 |
| R-HUB-7 | Explain on the stake panel that a wallet that withdrew below the minimum mid-week gets no bucket share and no free prize (`peak_stake`) | I-028 | text live | in progress: PR #100 (merge after #94; small rebase, same files) |

### Architecture (start a new chat with `AI_CHAT_STARTER.md` §3.5)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-ARCH-1 | **Shared game kit and the one VHP ruler (D-090, D-093):** look-back about 2 weeks (suggested: the higher of the 14-day time-weighted average and the 24-h high); prove fairness by simulation, including a field with many small producers. Design (1) the ruler: exact event-based effective VHP on two nodes, own handicap = highest VHP over a look-back long enough that hiding is costly, card credit, averages for others, a clamped form check, and **measurement points drawn at random within each game's window from a future block hash**; how it replaces the sampler; and how each game plugs its own formula into it. Start with the Race fix (`HANDICAP_REVIEW.md` §3). (2) One recorder and publish-check library every game uses: clock checks on new history, per-file holds, points recomputed in the publish job, board shape for the vault check, size caps. Today each game re-learns Block X's lessons (Bracket #E-3 H-2, H-3, M-3) | `HEALTHCHECK.md` §2 #3, #4 | design + migration plan, owner decides | open |

### Library (this chat)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-LIB-2 | Audit process; key and role inventory | DOCUMENTATION_GAPS #12, #3 | before the next launch | open |
| R-LIB-3 | Carry the chats' project docs into `.ai/`. (1) Carry the Vault chat's project docs into `.ai/`: `claude/vault-v6-live.md`, `claude/vault-v6-testnet-results.md`, `claude/handoff-*.md`, `claude/audit-vault-v6-*`, `docs/UPGRADE-V6.md`, `docs/V6-PLAN.md` — P3 — I-009 (2) Carry the Hub and Race chats' project docs into `.ai/`: `claude/launch-order.md`, `claude/stake-panel.md`, `claude/producer-names.md`, `claude/handoff-status-bar-testnet.md`, `claude/names-fixcheck*-prompt.md`, `claude/audit-names-prompt.md`, `claude/domain-knodegames.md`, `claude/site-at-root.md`, `claude/admin-page.md`, `claude/race-vault.md`, `claude/owners-race.md`, `claude/builds/02-hub-and-race-show.md`; repo `docs/NAMES.md`, `docs/ADMIN.md`, `race/README.md` (vault results section); Block X: `claude/blockx/FIXCHECK-PROMPT.md`, `claude/blockx/SPONSOR-TESTNET.md`, `claude/blockx/README.md`, repo `docs/blockx/MAINNET-LAUNCH.md`, `docs/blockx/TESTNET-RESULTS.md`, `docs/history/AUDIT-2026-10-28-repolens-blockx.md`; Survivor: `claude/audit-survivor-prompt.md`, `claude/builds/04-survivor-plan.md`, `claude/builds/04-survivor-sim.mjs`, repo `docs/SURVIVOR*.md`; Last Node `claude/lastnode/*`, `docs/lastnode/FIXCHECK-2-FIXES.md`; Golf `docs/GOLF.md`; Bracket `docs/bracket/README.md`, `docs/VHP-STANDARD.md`, `claude/vhp-standard.md`; Fantasy `docs/fantasy/*`, `claude/builds/05-fantasy-plan.md`, `claude/producer-names.md`; Combo `claude/audit-combo-fixcheck4-prompt.md`, `claude/combo/*` — P3 — I-009 | I-009 | filed | open (P3) |
| R-LIB-4 | Second cleanup pass: game files, ARCHITECTURE, PLATFORM, HEALTHCHECK, standards (same rule: one home per fact; done items to the archive) | — | PR | open |
