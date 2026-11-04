# Knode Games — Health Check

> **Purpose:** a CTO-level read of where Knode Games stands: strengths, weaknesses, missing information, quality scores and the top 10 priorities. Repeat it monthly, or after a big launch.
> **Date:** Wednesday 4 Nov 2026 (replaces the 3 Nov check, kept at `../archive/2026-11-04/HEALTHCHECK-2026-11-03.md`).
> **Scope:** every file in `.ai/` (start guide, platform docs, nine game files, eight standards, runbook, processes, archive). Application code was not reviewed here; it is covered by the Repo Lens audits.
> **Method:** the Librarian read the library, and two independent reviewers read it separately without seeing each other's notes. Scores below are the Librarian's, checked against theirs (they gave 7 / 6 / 6).
> **Not a source of truth:** this page judges; it does not record status. For what is live see `CURRENT_STATE.md`; for the owner's steps `TODOS.md`; for the chats' work `CHAT_REQUESTS.md`; for problems `OPENISSUES.md`.

## Scores at a glance

| Area | 4 Nov | 3 Nov | Change | One line |
|---|---|---|---|---|
| Documentation quality | **7 / 10** | 7 | = | Thorough and plain-spoken, but status lines drift between files |
| Architecture quality | **6.5 / 10** | 6.5 | = | Strong vault and checks; still one PC, one hot sponsor key, one RPC node, and results the vault can't fully verify |
| Organization quality | **6 / 10** | 6.5 | −0.5 | The structure is right, but the same status lives in up to six files and they disagree |

**Size of the open load (4 Nov):** 56 open issues · 42 owner to-dos · 66 open chat requests (of 69) · 23 debt items · 18 documentation gaps · 111 decisions · 81 ❓ marks in `platform/`, 19 in games and standards (5 real unknowns).

---

## 1. Current strengths

**Library design**
- **One home per fact** (`START_HERE.md` table) and a clear source order when files disagree (D-002). Finished work leaves the active lists (`archive/DONE.md`, `archive/ISSUES_CLOSED.md`), so open lists show only what needs attention.
- **Consistent marks:** ✅ done, 💬 decided, 👤 owner step, ❓ unknown. A reader can see at a glance what is fact and what is a guess.
- **Decisions never get deleted.** `DECISIONS.md` quotes the owner, marks superseded decisions instead of removing them (D-038, D-093), and is the audit trail for "why is it like this".
- **Disciplined work lists:** one owner checklist (`TODOS.md`, D-100) and one chats' list (`CHAT_REQUESTS.md`), each item linked to an issue or decision.
- **Everything lives in GitHub, not in chats** (D-089): a new chat can start from `START_HERE.md` and `AI_CHAT_STARTER.md`.

**Operational writing**
- **`RUNBOOK.md` is written for 3 AM:** plain steps, dry run first, what to check after.
- **`DEPENDENCIES.md` has a blast-radius section:** what breaks if each piece goes down.
- **`FREE_PRIZE_SWITCH.md`** is a model of a single-purpose guide: what it does, starting values, how to roll back.
- **`GO_LIVE_CHECKLIST.md`** gives every game the same gate before it pays.

**Architecture and safety**
- **Vault safety first:** withdrawals always open, timelocks on owner changes, an emergency withdrawals-only build ready (D-021), only the vault holds tokens.
- **Fail-closed results:** `RECORDER_STANDARD.md` says a game that can't prove its results holds rather than pays; it is tied directly to audit findings.
- **Layered pay checks:** HOLD files, `board.json`, the two-run rule and refusal alerts (PR #74), plus two-node reads (Armana and `api.koinosblocks.com`).
- **The VHP ruler v2** (`VHP_RULER.md`, D-111) is backed by evidence: 11 simulations on real data, Repo Lens #E-7 findings fixed, integer-only math, write-once hash-chained data.
- **Fairness thinking is documented:** the `HANDICAP_REVIEW` matrix and the ruler explain why each game is fair "with a bit of luck".
- **Good judgment on holds:** Block X re-read its results before prizes; the Race held a payout rather than guess.

---

## 2. Current weaknesses

### 2a. Platform risks (ranked)

| # | Weakness | Why it matters | Where tracked |
|---|---|---|---|
| 1 | **The owner's home PC is a single point of failure:** three mainnet nodes, the release backup, the owner keys used on action days | A dead disk, power cut or stolen PC stops block production (and so rewards) and the question backup | TD-08 |
| 2 | **The Mana sponsor holds 25,000 KOIN behind a hot key with no timelock** | A leaked key drains it at once; no delay to react | D-085 |
| 3 | **The vault pays from result files it can't fully verify on chain** | A wrong or forged results file could pay the wrong players; the checks reduce this but don't remove it | I-051, I-080, I-085 |
| 4 | **One RPC node for writes and most reads** | If it goes down or lies, the bot and site stop or read wrong data | TD-10 |
| 5 | **Crowded timing, 5–16 Nov:** `game-apply` (Thu–Sun), wallet moves (Fri–Tue), the first paid week (Mon 9), Survivor start and the first multi-game close (Mon 16) | Several P1 owner actions in one week; a mistake in one can block another | TODOS, ACTIVE_WORK |
| 6 | **Heavy owner load:** 42 open to-dos, and Repo Lens runs only when the owner runs it | Work queues behind one person; audits wait | TD-09 |
| 7 | **The bot pushes straight to `main`** | A bad bot commit lands on the live site without review | TD-03 |
| 8 | **The Swap Desk treasury is still the owner's hot wallet `1635QU…`** | Desk funds share the risk of a daily-use key | I-001, `docs/WALLETS.md` |

### 2b. Documentation weaknesses

**Status drift** (the biggest single problem; the same fact is stale in some files and current in others):
- PR #80, PR #85 and I-034 still read as open in some files though they are merged or closed.
- The old sponsor numbers (25 / 150 / 1 caps, 0.2 Mana pick row, code `b61ac238`) remain in `PLATFORM`, `ARCHITECTURE`, `DEPENDENCIES`, `RULES`, `RUNBOOK` §8, `KOINOS`, `VAULT_STANDARD` §5 and some game files. Current: 1.5 / 40 / 250, 1.2 row, code `b84e1add` (D-105).
- The Picks wallet timing (moved later, D-106) is not yet reflected in `ACTIVE_WORK`, I-001, TD-01 and `PLATFORM`.
- I-020 and I-022 are fixed but still listed as open.
- Counts are out of date: `CURRENT_STATE` says 102 decisions and seven standards; the true numbers are 111 and eight.
- `DECISIONS.md` has a few entries out of order and index statuses that don't match the entries.
- Game files still describe the old ruler (form multiplier, 2-week average, no card credit) instead of v2, and some still carry the old guest-pick wording and old work-list ranges.
- `AI_CHAT_STARTER.md` lists only 4 of the 8 standards.

**Contradictions:**
- **Safety wording:** `START_HERE.md` said the bot, desk and sponsor tools "need only `--send`", but every mainnet send also needs `CONFIRM_MAINNET=yes` in `.env` (confirmed in `bot/sponsor.ts`). **Fixed in the same PR as this page.**
- **Vault values:** `VAULT_STANDARD.md` §6's 255-places rule conflicts with `RECORDER_STANDARD.md` §4.3 (found by the Bracket audit, C-1; also affects Survivor and the Race, I-086).

**Gaps in existing pages:**
- `RUNBOOK.md` §3 lacks the per-game "held week" options the owner can choose (D-107 says an alert must name the owner's actions).

---

## 3. Missing information

| Missing | What it would hold | Why it's needed | Ref |
|---|---|---|---|
| **KEYS_AND_ROLES** | Every key and wallet, what it can do, where it lives (hot, cold, offline), who uses it, when (never the keys themselves) | The wallet moves and any incident depend on it | Gap #3 |
| **PC disaster recovery** | How to rebuild the nodes and backup task on another machine, from what, in how long | Weakness #1 | TD-08 |
| **Owner-powers table** | Each contract's owner-only actions, timelocks and how to undo | Safe owner days; reviewers asked for it | — |
| **`SPONSOR.md`** | The sponsor in one page: caps, switch, top-ups, rollback, the Mana report | Sponsor facts are spread across eight files (part of the drift above) | R-BX-18 |
| **`SWAP_DESK.md`** | Fee, treasury, limits, owner steps | No single home today | — |
| **Audit process** | When Repo Lens runs, prompt format, where reports go (private, in the Claude project), how fixes are checked | Audits are ad hoc and wait on the owner | Gap #12, TD-09 |
| **Monitoring catalogue** | Every alert: what triggers it, who gets it, what the owner does | D-107 | I-087 |
| **Data formats** | The shape of every bot file (question files, `board.json`, HOLD files, `vhp-data`) | Chats and auditors re-derive them from code | — |
| **Release history** | Which contract code and site version went live when | Rollbacks and audits | — |
| **GitHub access control** | Who can push, rulesets, secrets and environments | `OPERATOR_WIF` placement, C5-13 | D-012 |
| **Announcements process** | How players are told about changes, holds and new games | First paid weeks | — |
| **Each game's ruler move plan** | When and how each game moves to ruler v2 (Race first) | D-110, D-111 | R-RULER-1 |
| **Open scoring points** | The ❓ scoring rules still undecided in Block X and Questions | Must be settled before those prizes grow | Game files |

---

## 4. Quality scores, explained

### Documentation quality: 7 / 10 (unchanged)
- **Up:** the ruler standard (v2) is the best-evidenced document in the library; `CHAT_REQUESTS` and `TODOS` were cleaned of finished items; plain language throughout.
- **Down:** the cleanup moved status into its proper homes, but older copies of the same facts in reference files (`PLATFORM`, `ARCHITECTURE`, `RUNBOOK`, the game files) were not all updated. A reader who trusts the wrong file gets old caps or old PR states.
- **To reach 8:** one status-sync pass (priority 3), and the missing safety pages (KEYS_AND_ROLES, SPONSOR).

### Architecture quality: 6.5 / 10 (unchanged)
- **Up:** the vault checks merged; the sponsor guest-trap fix is live and verified; the ruler is designed with tamper-evident data; the vault's own Mana limit is 0 (D-099).
- **Down:** none of the four structural risks moved this week: the single PC, the hot sponsor key, results the vault can't fully verify, one RPC node.
- **To reach 7.5:** a fallback RPC, a written PC recovery plan, most sponsor KOIN kept cold, and the vault recomputing points from the chain (I-080).

### Organization quality: 6 / 10 (down 0.5)
- **Up:** the one-home table and archive rule are right; work lists are disciplined.
- **Down:** status still lives in up to six places (`CURRENT_STATE`, `ACTIVE_WORK`, `PRIORITIES`, `ROADMAP`, `TODOS`, the game files) and they drift apart within a day of busy work. The open load is large (56 issues, 66 chat requests, 42 to-dos), which makes "what matters now" hard to see. The score is lower than on 3 Nov because the drift is now measurable across more files, not because the structure got worse.
- **To reach 7:** reference files point to the status homes instead of repeating status; an id check (every I-, D-, R-, TD- number in a change is still correct) added to session-end filing.

---

## 5. Top 10 priorities

| # | Priority | Owner / chat | When | Why first |
|---|---|---|---|---|
| 1 | **Apply games 2 and 7:** `game-apply 2`, `game-apply 7`, check `games`, set `PRIZES_FROM_WEEK = 3`, then merge PR #86 | Owner | Thu 5 Nov after 7:51 AM PT; deadline Sun 8 Nov 4 PM PT | Without it Block X and the Race don't pay from 9 Nov (D-077) |
| 2 | **Wallet moves** for the vault and Desk (`docs/WALLETS.md`), kept off apply day | Owner + Vault chat | Fri 6 – Tue 10 Nov | Moves owner powers off hot keys (I-001) |
| 3 | **Library status-sync pass** (all items in §2b) plus an id-reference check in session-end filing | Librarian | This week | Stale safety numbers are a real risk to owner steps |
| 4 | **KEYS_AND_ROLES and PC recovery pages**, and an owner decision on keeping most sponsor KOIN cold with a small working float | Librarian + owner decision | Before 16 Nov | Weaknesses #1 and #2 |
| 5 | **Payout safety before the 16 Nov close:** Race hold alerts that name the owner's actions (R-RACE-13, I-087), Race vault-row recompute (I-085), Block X release fix B3-1 (R-BX-13) | Race, Block X chats | Before Mon 16 Nov | First close with several games in it |
| 6 | **Settle the vault-value rule** (255 places in `VAULT_STANDARD` §6 vs `RECORDER_STANDARD` §4.3) | Vault chat + Librarian | Before Survivor joins | Bracket C-1; affects Survivor and the Race (I-086) |
| 7 | **Survivor readiness** for Season 1 on 16 Nov (Repo Lens pass 4, announce 7–13 Nov, apply 9–15 Nov), or decide to slip | Owner + Survivor chat | Announce by Fri 13 Nov | D-065; not ready today |
| 8 | **Build the VHP ruler** (R-RULER-1) and move the Race onto it first | VHP Ruler chat | Start this week | D-110, D-111; 11 simulations must pass before it pays |
| 9 | **The vault recomputes points from the chain** instead of trusting result files | Vault chat | After 16 Nov | Weakness #3 (I-080) |
| 10 | **Fallback RPC node and less owner load:** a second RPC, `SPONSOR.md`, the Mana report (R-BX-18) | Hub / Block X chats + Librarian | November | Weaknesses #4 and #6 |

---

## 6. Game readiness (snapshot, 4 Nov)

| Game | State |
|---|---|
| Daily Questions (1) | Live and paying |
| Who Signs Block X (2) | Live, prize-free; pays from Mon 9 Nov after `game-apply 2` |
| Producer Race (7) | Live; pays from Mon 9 Nov after `game-apply 7` |
| Survivor (3) | Not ready for 16 Nov yet (audit pass 4 pending) |
| Block Golf | Practice close |
| Fantasy, Combo, Bracket, Last Node | Not ready; audits pending |

**Next health check:** after the first multi-game close (Mon 16 Nov), or by 4 Dec.
