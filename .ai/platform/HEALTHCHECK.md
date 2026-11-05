# Knode Games — Health Check
> **Superseded status:** this is a dated snapshot (4 Nov evening). For current status read `LAUNCH_BOARD.md`, `CALENDAR.md` and `AUDITS.md` (v6.1 timing is D-130, not Path 2).

> **Purpose:** a CTO-level read of where Knode Games stands: strengths, weaknesses, missing information, quality scores and the top 10 priorities. Repeat it monthly, or after a big launch.
> **Date:** Wednesday 4 Nov 2026, evening PT (Thu 5 Nov UTC). Replaces the morning check of the same day (`../archive/2026-11-05/HEALTHCHECK-2026-11-04.md`), because about 30 PRs and 16 decisions (D-113 – D-128) landed in between.
> **Scope:** all 47 files in `.ai/` outside the archive (about 5,000 lines), every PR they mention checked against GitHub. Application code is covered by the Repo Lens audits, not here.
> **Method:** the Librarian's own read plus one independent reviewer who read every file without seeing the Librarian's notes. Scores below are the Librarian's, checked against the reviewer's (7 / 6.5 / 5.5).
> **Not a source of truth:** this page judges; it does not record status. Live status: `CURRENT_STATE.md`; the owner's steps: `TODOS.md`; the chats' work: `CHAT_REQUESTS.md`; problems: `OPENISSUES.md`.

## Scores at a glance

| Area | Now | Morning 4 Nov | Change | One line |
|---|---|---|---|---|
| Documentation quality | **7 / 10** | 7 | = | Four strong new safety pages and a public README, but ~60 status lines went stale within a day of merges |
| Architecture quality | **7 / 10** | 6.5 | +0.5 | Payout safety merged, the ruler built and tested on real data, the bot closes weeks; the single points of failure are unchanged |
| Organization quality | **5.5 / 10** | 6 | −0.5 | The structure is right, but status is copied into 8–10 files that drift apart within hours |

**Open load:** 62 open issues · 46 owner to-dos · 76 chat requests · 23 debt items · 19 documentation gaps · 128 decisions · 129 ❓ marks · 7 open PRs (#114, #141, #152, #155, #157, #158, #159).

---

## 1. Current strengths

**Safety and operations pages (new today)**
- **`KEYS_AND_ROLES.md`**: every wallet, contract and key by public address, what each can do, where its key lives, and what to do if it's lost or stolen. No keys anywhere.
- **`SPONSOR.md`**: the sponsor's live settings, full command lines, rollback and emergency steps.
- **`RECOVERY.md`**: what keeps running without the PC, the rebuild order, and the stolen-PC order.
- **`ALERTS.md`**: every alert email with what to do, including the alerts that are silent today.
- These four are the model for the rest: one page, safe to act on, plain words.

**Public face (new today)**
- A new README that describes the whole platform, a security policy file, the license holder named as Knode Games, "source-available" wording on the site.
- The private audit reports and raw chat exports moved to the Claude project (D-115).
- No keys or secrets anywhere in the repo (checked across all 610 files).

**Library design**
- **One home per fact** (`START_HERE.md` table) and a stated source order (D-002).
- **The decision log quotes the owner and never deletes**, so it doubles as an audit trail.
- **Finished work leaves the active lists** (`archive/DONE.md`, `archive/ISSUES_CLOSED.md`); ids are never reused.
- The ✅ / 💬 / 👤 / ❓ marks show what's fact and what's a guess.

**Architecture**
- **Funds safety:** only the vault holds tokens, withdrawals are always open, a withdrawals-only build is ready, 48 h timelocks; the v6.1 plan (Path 2) even avoids the handover accept wiping a pending upgrade.
- **Layered payout checks:** HOLD files, two-run rule, two nodes, the Sunday review day (D-125), the correction window, and now **published final results are locked and paid weeks re-scored from the chain** (RECORDER_STANDARD, Race #133).
- **The VHP ruler is built and tested on 31 days of real mainnet data**, integer-only, JavaScript and Python byte-identical, and **nothing pays on it until all 11 simulations pass** (D-111).
- **Decisions made with real measurements:** sponsor limits from mainnet costs (D-117); the bot closes weeks after testnet showed a player's first action could cost 1.12 Mana (D-127).
- **Daily Questions joins the shared game rules** (D-116), removing the biggest special case in the vault.

---

## 2. Current weaknesses

### 2a. Platform risks (ranked)

| # | Weakness | Why it matters | Tracked |
|---|---|---|---|
| 1 | **The owner's PC runs all three block producers** and the release backup | A dead PC stops block production (smaller rewards); recovery is written but not rehearsed, and the Desk's re-register waits 48 h | TD-08, `RECOVERY.md`, R-VAULT-10 |
| 2 | **The sponsor's 25,000 KOIN sits behind a hot key**, no timelock | A leaked key drains it at once | D-085 |
| 3 | **The vault pays from result files it can't recompute from the chain** | The checks are layered but a recorder bug that writes the board and the file wrong the same way still pays (Questions closes this for itself under D-116) | I-051, I-080 |
| 4 | **One read/write RPC node**, and the ruler runs on two nodes only | An outage stops the bot; a lying node is caught only by the second | TD-10, D-126 |
| 5 | **A crowded fortnight:** game-apply (Thu 5), wallet moves (Fri 6 – Tue 10), the v6.1 announce (Tue 10) and upload (Thu 12), the first multi-game close (Mon 16) | Several P1 owner steps in a row; one slip can block the next | TODOS |
| 6 | **Every send, merge and audit runs through one person** | The owner is the bottleneck; Repo Lens runs only when he runs it | TD-09 |
| 7 | **The bot still pushes straight to `main`** | A bad bot commit reaches the live site without review | TD-03 |

### 2b. Documentation weaknesses
- **Status drift, worse than this morning.** The snapshot files were written ~04:00 UTC; ~30 PRs merged after. `ACTIVE_WORK`, `PRIORITIES`, `ROADMAP`, `LAUNCH_BOARD`, `TECHNICAL_DEBT`, `PLATFORM` and the game files still show PRs #80, #85, #86, #95, #99, #119, #133 as open, Survivor on 16 Nov, the old Picks timing and the old v6.1 timeline.
- **Old sponsor numbers** (code `b61ac238`, caps 1 / 25 / 150, rows 1 and 0.2) remain in about nine files although `SPONSOR.md` is their home. Open PR #158 would change the stake-call row again.
- **Issues fixed but still open:** I-085, I-087, I-090 (fixed by #133), I-020, I-022.
- **Game files describe old rules:** Questions "five a day, at most 30"; Race's 12-hour hold beside the new weekly close; Block X's 0.2 row and blocked guest picks.
- **The decision log is out of order** (it says "newest first" but isn't), several index statuses don't match their entries (D-065, D-092, D-114, D-061, D-104, D-117), and **D-129 (Sunday fun races) is cited but missing**.
- **Broken references:** `archive/CHAT_KNOWLEDGE.md` (moved), one path lost in R-LIB-6, branch-only files named without their branch.
- **`AI_CHAT_STARTER.md` lists 4 of 8 standards**; the VHP Ruler chat is missing from `PLATFORM.md`'s chat list.

---

## 3. Missing information

| Missing | What it would hold | Why now |
|---|---|---|
| **One dated calendar** | Every date for the next weeks in one place: game-apply, wallet moves, v6.1 announce / upload / rule week, the first D-125 close, when players can claim | Five files hold these dates today and disagree |
| **An audit (Repo Lens) process + merge queue** | When a PR needs Repo Lens, the prompt format, where reports go (private), the current open PRs in merge order, "config first, then merge" rules | Dozens of prompts and seven open PRs; the order lives in PR titles |
| **A glossary** | VHP, effective VHP, Mana, card, pool, seed, staked vs free, and the week numbers (vault week 3 = site "Week 1") | The week numbers already caused confusion; marketing readers will need it |
| A Swap Desk page | Fee, treasury, limits, its node, owner steps | The only live product without a page |
| A release history | Each contract's code hash, upload date and PR | Verification and rollbacks; the README table is the only list |
| Data formats | Each game's files (`board.json`, vault files, `vhp-data`) | Chats and auditors re-derive them from code |
| A snapshot-refresh rule and an id check | When CURRENT_STATE etc. are refreshed; a check that every PR, D-, I-, R- number cited is current | The cause of the drift above |
| If the owner is unavailable | What waits, what keeps running, who can do what | Single-person risk (2a #6) |

The four pages missing this morning (keys and roles, sponsor, PC recovery, alert catalogue) now exist.

---

## 4. Quality scores, explained

### Documentation: 7 / 10 (unchanged)
- **Up:** the four safety pages, the public README and security policy; the ruler design (§15–16) records what was built and why; owner decisions carry their words.
- **Down:** about 60 stale status lines after one day of merges, some in pages the owner could act from (sponsor numbers, Picks timing, the v6.1 dates); a missing decision and an unreliable decision index.
- **To reach 9:** one status-sync pass, then pointers instead of copies (see Organization), the glossary and the calendar.

### Architecture: 7 / 10 (up 0.5)
- **Up:** Race payout safety merged (hold alerts, recompute, locked finals); the ruler built with tamper-evident data and simulations as the gate; the bot closes weeks so players never pay for it; Questions moving onto the shared rules removes a special case; sponsor limits set from real costs.
- **Down:** the same structural risks: one PC for all producers, the hot sponsor key, results the vault can't recompute, one RPC node.
- **To reach 8:** a rehearsed PC recovery with producer key backups, most sponsor KOIN cold, the vault (or each game's publish job) recomputing points from the chain, a fallback RPC.

### Organization: 5.5 / 10 (down 0.5)
- **Up:** the folder layout, the one-home table and the archive rule are right; the chats' work list (§0) gives a clear order.
- **Down:** status is copied into 8–10 files that drift within hours; four ranked lists overlap (PRIORITIES, this page's top 10, the gaps plan, CHAT_REQUESTS §0); `ACTIVE_WORK` mostly repeats CHAT_REQUESTS and TODOS; `DECISIONS.md` (760 lines) is out of order; `CHAT_REQUESTS.md` has grown into 34 KB of very long cells.
- **To reach 8:** retire `ACTIVE_WORK` (or fold it into `LAUNCH_BOARD`); make `ROADMAP` the dated calendar only; make reference files (`PLATFORM`, `ARCHITECTURE`, `RULES`, game files) point to the status homes instead of repeating numbers; reorder the decision index; move paused games' requests to a backlog section.

---

## 5. Top 10 priorities

| # | Priority | Who | When | Why |
|---|---|---|---|---|
| 1 | **Apply games 2 and 7** (`game-apply 2`, `game-apply 7`, `games`, `PRIZES_FROM_WEEK = 3`) | Owner | Thu 5 Nov after 7:51 AM PT; deadline Sun 8 Nov 4 PM PT | Without it Block X and the Race don't pay from Mon 9 |
| 2 | **Wallet moves** (`docs/WALLETS.md` §7): step 0 Fri, treasury, handover propose Sun, accept Tue | Owner + Vault chat | Fri 6 – Tue 10 Nov | Moves owner powers to the cold key `1LMV8E…`, which signs the v6.1 upgrade |
| 3 | **Vault v6.1, Path 2:** Repo Lens on #114's latest commit and Questions #152; announce Tue 10, upload Thu 12, rule week Mon 16; then #141 | Vault + Questions chats, owner | Reviews before Tue 10; upload Thu 12 | Doubled Questions and Questions on the shared rules (D-116) |
| 4 | **Library status-sync and de-duplication**: fix the ~60 stale lines, close fixed issues, add D-129, reorder the decision index, replace copied status with pointers, retire `ACTIVE_WORK` | Librarian | This week | The drift is now the biggest documentation risk |
| 5 | **The first multi-game close (Mon 16) is safe:** Block X never rewrites a published result (#159, R-BX-20), Block X on the weekly rhythm (R-BX-22), the sponsor rows for vault calls (#158), the first sponsored stake measured | Block X chat, owner | Before Mon 16 Nov | First week with several games paid |
| 6 | **The VHP ruler:** Repo Lens re-check, PR, the recorder on early, data only (D-128); then §16's fixes and all 11 simulations | VHP Ruler chat | This week; simulations next | The Race's two known handicap gaps close only on the ruler |
| 7 | **Three new docs:** a dated calendar, the audit process with a merge queue, a glossary | Librarian | This week | See §3; they remove the main sources of confusion |
| 8 | **PC resilience:** producer key backups (R-VAULT-10, when there's a USB stick) and a recovery rehearsal | Vault chat, owner | November | Weakness #1 |
| 9 | **Sponsor key risk:** decide whether to keep most of the 25,000 KOIN in a cold wallet with a working float | Owner | November | Weakness #2 |
| 10 | **Finish the repo cleanup:** run the branch script, remove the stale `docs/` files, review the `npm audit` warnings with tests, plan Pages from an allow-listed folder (R-HUB-11 part 5) | Owner, Librarian, Hub | November | Public-readiness before marketing (D-113, D-115) |

**Next health check:** after the first multi-game close (Mon 16 Nov).
