# Knode Games — Done and Decided

> **Purpose:** finished work, settled items and superseded plans, moved out of the working files so those only show what still needs attention. **Nothing here needs action.** Read it only to check history.
> **How it grows:** when an item in `platform/TODOS.md`, `platform/CHAT_REQUESTS.md`, `platform/PRIORITIES.md`, `platform/ROADMAP.md`, `platform/DOCUMENTATION_GAPS.md` or `platform/TECHNICAL_DEBT.md` is done, the library chat moves it here under the date it was moved, newest first. Closed issues go to `ISSUES_CLOSED.md`.
> **Full copies:** the working files as they stood before the 4 Nov cleanup are in `2026-11-04/`.

## Moved 2026-11-04 (evening)
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
| Stale copy `C:\Users\alcat\repos\Knode` deleted | ≤ 2026-11-02 | Questions chat |
| Set a desk daily payout cap — **cancelled** (no cap, D-007) | 2026-11-02 | C-17 |
