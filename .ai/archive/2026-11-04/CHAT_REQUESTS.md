# Knode Games — Chat Requests

> **Purpose:** the one place where work is handed to each chat. Instead of the owner sending a different message to every chat, each chat reads **its own section here** at the start of every session and works the open items in order.
> **Owner's message to any chat is always the same** (§1). The library chat keeps this file current from session-end reports, decisions and audits.
> **Last updated:** 2026-11-04 (decisions D-093 – D-096; Repo Lens #D-4 GO)
> **Rules:**
> - Each item has an id (R-<chat>-<n>), a link (D-/I-/PR), what "done" means, and a status: **open** · **in progress** · **done (date)**.
> - A chat reports finished items in its session-end report (`SESSION_END_PROCESS.md`), and the library chat marks them done. Items are never deleted.
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
| R-ALL-6 | **Meet `standards/RECORDER_STANDARD.md`** (clock checks, points recomputed at publish, per-file holds, two nodes, write-once) and launch by **`standards/GO_LIVE_CHECKLIST.md`**. Review your recorder against its §8 checklist and list any gaps in your session-end report | RECORDER_STANDARD, GO_LIVE_CHECKLIST | gaps listed, then fixed before launch | open |
| R-ALL-5 | **Vault registration** is always `game-add <id> "<name>" --staked --free --season <n>`. The owner sets the free-prize switch | D-082 | — | rule |

## 3. By chat
### Vault
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-VAULT-1 | Fix PR #73 (`docs/WALLETS.md` + weekend runbook): 3 High, 6 Medium, 5 Low from the independent check. The full list was sent 3 Nov (`claude/prompts-2026-11-03-boards-owners-vault-reply.md`) | I-001, D-083 | fixes pushed; owner merges before Fri 6 Nov | done 4 Nov — PR #73 merged (`docs/WALLETS.md` + weekend runbook) |
| R-VAULT-2 | **PR #74 — Repo Lens #D-3 (3 Nov): fix first.** Report (private): `claude/audit-vault-bot-checks-D3-report.md`. Fix on `vault-bot-checks`, one finding per commit, each with a test that fails on `eaa47b0` and passes after: **VB-2** (High) `vaultFinalizePass` treats `{ok:false}` as success → `if (!sent(await send(...)).ok \|\| ctx.dryRun) break;`, and route every `Send` through `sent()`; **VB-3** (Medium) record a refusal only for a chain revert (`reverted:`), retry network / Mana / "not seen in a block" next run; **VB-4** (High) optional `vaultGames.<id>.board: "none"` that skips the staked-list check (logged), set for game 3 (Survivor) unless Survivor publishes a board (R-SV-3); **VB-5** (Medium) optional `vaultGames.<id>.minPts`, 100 for game 8 (Combo); **VB-1** (High, before Last Node launches) a `HOLD-W<n>.json` holds unless `RELEASE-W<n>.json` exists; read `why` as well as `reason`; Lows if quick: VB-10 (alert when a file is first seen with < 2 h left), VB-8 (read only `ranked: true` rows), VB-6 (skip rows past the board's cap or ask games to keep every ≥ 1-point row), VB-7 (use max(min, 1 VHP)) | I-051, I-052, I-064 | fixes pushed → Repo Lens fix-check GO → owner merges **by Fri 13 Nov** (VB-2 and VB-3 are enough for Race and Block X on 16 Nov) | **Repo Lens fix-check #D-4 (3 Nov): GO to merge by Fri 13 Nov** (report private: `claude/audit-vault-bot-checks-D4-fixcheck.md`). Follow-ups: R-VAULT-7 |
| R-VAULT-3 | `tools/sweep-old-bot.ts`: honour `$env:RPC`, default to Armana | I-078 | before the Sat 7 Nov sweep | done 4 Nov (in PR #73; test `tools.sweep-rpc`) |
| R-VAULT-5 | **Check `platform/RUNBOOK.md`** (new, 3 Nov): confirm or correct every vault, Desk, sponsor and key step, especially those marked ❓ (§6 manual tick without an operator key, §7 hostile owner announcement and sponsor key, §9 withdrawals-only build). Edit it in your PR | DOCUMENTATION_GAPS #2 | runbook confirmed | open |
| R-VAULT-6 | **Vault upgrade for doubled Questions (D-092):** raise `MAX_QUESTIONS_PER_WEEK` from 30 to 60, plus anything the Questions plan (R-Q-1) needs on chain. Full upgrade path: audit, rehearsal, 48 h notice, weekend announce, Monday upload. Target after the first paid weeks (week of 23 or 30 Nov) | D-092, D-017, D-023 | plan, then build | open |
| R-VAULT-7 | **#D-4 follow-ups:** (1) make sure CI builds the sim before `bot/vault.test.ts`, since the VB tests are *skipped*, not failed, without it; (2) N-2 `capScope: "staked"` for game 9 before the Bracket nears 1,000 players; (3) N-3 treat a resource/rc revert as temporary; (4) add the Picks and Race picks handovers to the weekend runbook (D-096) | #D-4, D-096 | (1) and (4) before the weekend; (2), (3) before the Bracket launches | open |
| R-VAULT-4 | Plan: recompute each game's points from on-chain picks in the bot | I-080 | a plan | plan written 4 Nov (`claude/vault/RECOMPUTE-PLAN.md`); build after 16 Nov |

### Daily Questions
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-Q-1 | **Plan doubled Questions (D-092):** 10 a day Mon–Sat, rounds at 12:00 and 00:00 UTC, the second opening when the first closes; starting after the first paid weeks. Plan: bot release/lock schedule, the release backup task, scoring and weekly points, question supply, Mana per player, site text. The contract cap (30 a week) is the Vault chat's part (R-VAULT-6) | D-092 | plan → owner OK | open |

### Block X (and Picks)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-BX-1 | The "before prizes" list: which items could mispay in the first paid week (closes Mon 16 Nov), fixes for those | I-042, D-077 | fixed or accepted by the owner before 16 Nov | in progress — built in **PR #80** (week-end re-read, BX-72 voids, future-card refusal BX-118, RV-2); BX-105 not built (display only, accepted). Needs **Repo Lens round 14 GO**, then the owner merges **before Mon 9 Nov 00:00 UTC** |
| R-BX-2 | Sampler cadence: GitHub may run the 5-min sampler only about hourly. Decide whether `MIN_SAMPLES = 12` per 6 h card still fits, or change the schedule | I-059 | a decision + PR if needed | decided 4 Nov: `MIN_SAMPLES` stays 12; the sampler takes up to 12 samples a run (PR #67, merged 4 Nov) |
| R-BX-3 | Plan (don't build yet) a safe Picks owner handover: propose/accept commands with dry runs, the 48 h wait, when nothing is pending (it clears announcements and upgrades), and `MAINNET_OWNER` read from the deployment file instead of hard-coded | I-076, D-083 | a plan with tests | **build now (D-096):** the owner wants Picks moved this weekend, then the Picks v2 upgrade. Build `owner-propose` / `owner-accept` / `owner-cancel` per PR #79 with tests, by Fri 6 Nov; coordinate the order with Survivor's game-3 Picks registration |
| R-BX-4 | Ship-check: confirm V4, B1-1, B1-5 shipped with PR #57 | TODOS → Waiting | confirmed | done 4 Nov: V4, B1-1, B1-5 (`d7fad7c`) and RV-1 are on `main` |

### Race
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-RACE-1 | The vault file must not be decided by a single run with no hold | I-034 | fixed before 16 Nov | open |
| R-RACE-2 | A short recommendation on free-prize farming by many empty wallets (owner decides) | I-035 | recommendation sent | open |
| R-RACE-3 | Plan (don't build yet) a safe Race picks owner change: dry run, address entered twice, read-back; whether a two-step handover is possible in a future upgrade; how `RACE_WIF` can stay offline | I-077, D-083 | a plan with tests | **build now (D-096):** the owner wants Race picks moved this weekend. Build the safe owner-change command (dry run, address entered twice, read-back) with tests, by Fri 6 Nov |
| R-RACE-4 | New free-prize wording on the Leaders page once game 7 is applied (today: "paid once the vault is live") | `games.json` | PR | open |
| R-RACE-5 | **Move onto the one VHP ruler (D-090)**, first the two known gaps: card credit (VHP added after a card gains nothing) and a longer highest-VHP look-back (the > 6-h hide). Coordinate with R-ARCH-1 | D-058, D-090, `HANDICAP_REVIEW.md` | PR + Repo Lens | open (raised: the Race pays from 9 Nov) |

### Producer Bracket
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-BR-1 | Fix the Repo Lens #E-3 findings (report and failing tests in the project: `claude/bracket/AUDIT-2026-11-03-E3.md`, `claude/bracket/repolens-e3-tests/`). Order: H-1, C-2 + L-2, C-1, M-1, H-2 + H-3, M-3/M-4/M-9, then H-4 + H-5, then M-2, M-10, L-15. One finding per commit | I-061 | all fixed; fix-check GO | open |
| R-BR-2 | **Owner decisions (3 Nov):** **keep the Knode Games Pool in the field and protect it** (judge pooled producers on the day's average or minimum effective VHP, not one block); judge **forfeits on the day's time-weighted average** (H-5); **accept same-block ties** and fix the comment and page text (H-6) | D-086, D-087 | built and tested | open |
| R-BR-3 | Merge `main` into `kg-09-bracket` before launch (16+ commits behind; the free-prize switch, nicknames standard, Leaders board) | L-16 | branch current | open |
| R-BR-4 | Confirm R-ALL-3 (board path and fields) for the vault check | I-079 | confirmed | open |
| R-BR-5 | **No 9 Nov target:** the Bracket launches when its fix-check passes | D-088 | — | rule |

### Survivor
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-SV-1 | Keep the Free play board; the 4 + 2 season prize is off for now (switch). Page says no VHP is paid on Free play; check whether "no prize" changes SV-A10 / SV-A19 | D-081, D-082 | page text + note | open |
| R-SV-2 | Repo Lens pass 4 → fixes → testnet season → Picks registration → Season 1 Mon 16 Nov | I-050, D-065 | launched | open |
| R-SV-3 | **Vault check (PR #74 VB-4):** Survivor publishes no `board.json`, so every staked week would be held. Either publish a board with `lastWeek` (and allow it in your publish allowlist), or confirm the Vault chat should set `board: "none"` for game 3 | I-079 | decided with the Vault chat before 16 Nov | partly done: PR #74 sets `vaultGames.3.board: "none"` for now; Survivor may publish a board later, then remove "none" |

### Last Node Standing
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-LN-1 | Add the Free play board **with** the 2 + 1 weekly prize. Decide the free-winner rule with the owner (proposal: `claude/lastnode/FREE-PLAY-PROPOSAL.md`), working with HOLD files | D-081 | rule decided; built | open |
| R-LN-2 | Check whether an hourly sampler (I-059) changes the 48 h readiness and the round-3 review | I-059, I-058 | answer | open |
| R-LN-3 | **Vault check (PR #74 VB-1):** when a held week is released (`LASTNODE_RELEASE_WEEKS`), publish `RELEASE-W<week>.json` next to the `HOLD-W` file (the publish job only adds files, so HOLD stays). Name the reason field `reason` (the bot reads `reason`; you write `why`). Keep every row with ≥ 1 point in `lastWeek` (VB-6) | I-064 | built + tested before launch | open — **without the RELEASE marker a released week stays held** (PR #74 now requires it) |
| R-LN-4 | **Lower the entry bar (D-091):** today ≥ 20 expected blocks an hour (~1.7% share, top 23). Simulate a field with many small producers, propose a new bar (target: k ≥ 10 expected blocks in your scoring window) with a luck trim, and show the owner the results | D-091, `HANDICAP_REVIEW.md` §5.2 | owner approves the value; built | open |

### Fantasy Producers
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-FA-1 | Add a Free play board (no prize yet); say what it needs (picks contract, recorder, page) and how big the change is | D-081 | plan, then PR | open |
| R-FA-2 | Fix-check, a full test week, the real-data simulation | I-062 | done | open |
| R-FA-3 | **Card quality gate:** Fantasy uses Race cards without checking their sample count (≥ 12) or flags. Add the same gate Block X and Combo use | `HANDICAP_REVIEW.md` §5.1 #6 | PR + test, before launch | open |

### Combo Card
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-CO-1 | Let free players send cards and rank on a Free play board (no prize yet). Check whether that needs Picks v2, and how free cards meet the forged/unverified-card checks | D-081, I-074 | plan | open |
| R-CO-2 | Fix-check 4; then the Picks v2 upgrade plan | I-063, D-060 | done | open |
| R-CO-3 | **Vault check (PR #74 VB-5):** your vault file needs ≥ 100 hundredths (1 full point); the Vault chat adds `minPts: 100` for game 8. Confirm the floor | I-079 | confirmed | done in PR #74 (`vaultGames.8.minPts: 100`); Combo chat to confirm the floor |

### Block Golf
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-GO-1 | Add a Free play board (no prize yet); say whether it affects practice with Block X or the Survivor hole reader | D-081 | plan | open |
| R-GO-2 | Confirm whether practice also waits for the sampler, or only for Block X (it's live) | I-060 | answer | open |

### Hub (site)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-HUB-1 | "Week 1" refresh: show the week of Mon 9 Nov as Week 1 site-wide and replace "vault not yet live" text; write the week-label table (vault week, site label, file name) into `KOINOS.md` → Time | I-069, I-027, D-063 | live before Mon 9 Nov | open |
| R-HUB-2 | Check the staking hub, status bars and panels on mainnet now that the vault is live | — | checked | open |
| R-HUB-3 | @name mint not showing the main name | I-020 | fixed | open |
| R-HUB-4 | **Guest wallet messages:** `wallet.js` shows "Free answers are used up" for *any* sponsor refusal or an unanswered `would_pay` check, so players see the wrong reason (Block X found it 3 Nov; the owner's own failed pick). Show the real reason, as PR #66 did for the Block X page | I-082 | PR + test | open |

### Architecture (start a new chat with `AI_CHAT_STARTER.md` §3.5)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-ARCH-1 | **Shared game kit and the one VHP ruler (D-090, D-093):** look-back about 2 weeks (suggested: the higher of the 14-day time-weighted average and the 24-h high); prove fairness by simulation, including a field with many small producers. design (1) the ruler: exact event-based effective VHP on two nodes, own handicap = highest VHP over a look-back long enough that hiding is costly, card credit, averages for others, a clamped form check, and **measurement points drawn at random within each game's window from a future block hash**; how it replaces the sampler; and how each game plugs its own formula into it. Start with the Race fix (`HANDICAP_REVIEW.md` §3). (2) One recorder and publish-check library every game uses: clock checks on new history, per-file holds, points recomputed in the publish job, board shape for the vault check, size caps. Today each game re-learns Block X's lessons (Bracket #E-3 H-2, H-3, M-3) | `HEALTHCHECK.md` §2 #3, #4 | design + migration plan, owner decides | open |

### Library (this chat)
| Id | Request | Link | Done when | Status |
|---|---|---|---|---|
| R-LIB-1 | Emergency runbook with monitoring and alerts | DOCUMENTATION_GAPS #2, #26 | before Mon 16 Nov | done (3 Nov): `RUNBOOK.md`; the Vault chat checks it (R-VAULT-5) |
| R-LIB-2 | Game go-live checklist; audit process; key and role inventory | #25, #12, #3 | before the next launch | in progress: `GO_LIVE_CHECKLIST.md` and `RECORDER_STANDARD.md` done (3 Nov); audit process and key inventory open |
