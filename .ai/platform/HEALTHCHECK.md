# Knode Games — Library Health Check

> **Purpose:** a CTO / architect review of the whole `.ai/` library and what it says about the platform: strengths, weaknesses, missing information, three quality scores and the top 10 priorities. A **dated snapshot**; for the whole system at a glance read [`../../STATUS.md`](../../STATUS.md); for live status read `LAUNCH_BOARD.md`, `CALENDAR.md` and `AUDITS.md`.
> **Reviewed:** Thu 5 Nov 2026, ~05:45 UTC; architecture re-scored ~07:00 UTC after the target architecture was written (Wed 9:45 PM PT), after PRs #165, #166, #167 and #169. Every file in `.ai/` outside `archive/` (51 files, ~620 KB).
> **Previous checks:** `../archive/2026-11-05/HEALTHCHECK-2026-11-04-evening.md` (7 / 7 / 5.5) and earlier copies in `../archive/`.

**Figures refreshed 5 Nov ~18:30 UTC:** 157 decisions (D-001 – D-157; 156 entries, D-152 indexed and its entry lands with PR #182). **Open load as of the review (~05:45 UTC):** 57 open issues · 51 owner to-dos · 78 chat requests · 19 debt items · 14 documentation gaps · 125 ❓ marks · 11 `{{TBD}}` placeholders · 2 open PRs (#114 after Monday's upload, #141 after v6.1 is live).

## 1. Current strengths
- **Funds design is sound and written down.** Only the vault holds stakes; every stake is withdrawable; a withdrawals-only build is ready (D-003, D-016, D-021). `REPO_MAP.md` now sorts every part of the repo by funds risk (tier 1 contracts, tier 2 payout code, tier 3 the rest).
- **One home per fact, and it holds.** Timing → `standards/WEEK_CYCLE.md`; sponsor numbers → `SPONSOR.md`; dates → `CALENDAR.md`; reviews and merge order → `AUDITS.md`; stages → `LAUNCH_BOARD.md`. Other files point instead of copying.
- **Decisions are complete and in order.** 157 decisions (156 entries; D-152 with #182), oldest first, every one indexed, superseded ones marked, no open contradictions. The owner's words are quoted in each new entry.
- **The library is current.** Every working file was synced on 5 Nov from the chats' handoffs; finished items are in `../archive/DONE.md`, closed issues in `../archive/ISSUES_CLOSED.md`.
- **Onboarding is a path, not a pile.** `START_HERE.md` opens with an "I want to…" map; a new game follows `standards/NEW_GAME.md` → `GO_LIVE_CHECKLIST.md`; every chat starts from `standards/AI_CHAT_STARTER.md` and ends with `SESSION_END_PROCESS.md`.
- **Safety process is real.** Mainnet sends need `--send` and `CONFIRM_MAINNET`; contract upgrades are audited on the exact build, announced 48 h ahead, hash-checked; recorders publish pending results on the Sunday review day and hold on any mismatch.
- **Operations are covered:** `RUNBOOK.md`, `ALERTS.md`, `RECOVERY.md`, `KEYS_AND_ROLES.md`, `FREE_PRIZE_SWITCH.md`.
- **Standing rules for speed and quality:** push when ready (D-133), fix every review finding in one pass (D-140), one weekly standard for every game (D-134).

## 2. Current weaknesses
- **Status still lives in several lists.** `CHAT_REQUESTS` (78 rows, 41 KB), `TODOS` (51 items), `OPENISSUES` (57), `PRIORITIES`, `LAUNCH_BOARD` and `CALENDAR` overlap. Each has its job, but a busy day still needs 5–6 edits to stay true.
- **Big files are hard to scan:** `DECISIONS.md` (113 KB), `ARCHITECTURE.md` (41 KB), `CHAT_REQUESTS.md` (41 KB), `VHP_RULER.md` (35 KB).
- **Many unknowns:** 125 ❓ marks and 11 `{{TBD}}`, mostly in `ARCHITECTURE.md` (contract versions, workflows, the folder map), `KOINOS.md` and `FOUNDER_INTENT.md` (measurable targets).
- **The repo layout looks crowded** (84 files at the root, because GitHub Pages publishes the root). Fixed by `REPO_MAP.md` §4, not yet done.
- **Architecture risks still open** (they're recorded, not hidden):
  - the owner key is hot until the cold-key handover (Tue 10 Nov);
  - the bot pushes straight to `main` (TD-03);
  - the site is served from the whole repo until the Pages allow-list (R-HUB-14);
  - two copies of the game-1 claim rules (I-092);
  - one PC runs all three nodes (TD-08, TD-10);
  - the VHP ruler pays nothing until v2.1 passes all eleven simulations (R-RULER-2);
  - the full platform audit hasn't run (I-002, D-102).
- **Review loops have been slow:** findings fixed a few at a time over several fix-checks. D-140 now requires one pass.
- **Two standards lag a day:** `VAULT_STANDARD.md` waits on #141; `SESSION_END_PROCESS.md` (3 Nov) doesn't yet name D-140's "fix it in one pass" step.

## 3. Missing information
| Missing | Where it should live | Why it matters |
|---|---|---|
| **A register of live contracts:** address, live build hash, upload date, last audit and its commit, upgrade timelock, owner | one table (suggested `platform/CONTRACTS.md`) | tier-1 safety and the full audit start here; today it's split over `ARCHITECTURE.md` (TBDs), `REPO_MAP.md` §3 and the deployment files |
| **Data formats:** each game's results file, `board.json`, week files, `index.json`, `names.json`, `vhp-data` hours | `platform/DATA_FORMATS.md` (gap #15) | payouts depend on these files; every new game must match them |
| **Swap Desk** rules, fee, treasury, liquidity, its node | `platform/SWAP_DESK.md` (gap #9) | the only live product holding funds without its own page |
| **Announcement process:** where, who, the checklist | `GO_LIVE_CHECKLIST.md` (gap #29) | Week 1 is announced this week |
| **Measurable targets** (players a week, VHP staked, daily transactions) | `FOUNDER_INTENT.md` | the north star (D-076) can't be tracked without them |
| **Points per correct answer / pick** (Questions, Block X) | the game files (gap #11) | players and the profile page (D-137) need them |
| **Desk node rebuild steps; `docs/MIGRATION.md` is stale** | `RECOVERY.md` (gaps #33, #34) | recovery after losing the PC |
| **Contract version history** (all hashes and dates) | the contract register | audits and rollbacks |

## 4. Scores (out of 10)
| Area | Score | Was (4 Nov eve) | Why |
|---|---|---|---|
| **Documentation quality** | **8.5** | 7 | current, plain-language, one home per fact, onboarding path, glossary, calendar; held back by the ❓ / TBD count and the three missing references in §3 |
| **Architecture quality** | **7.5** | 7 | funds isolation, audited timelocked contracts, two-node checks and holds are strong; now written as principles, a contract register (`CONTRACTS.md`) and a dated target architecture (ARCHITECTURE A1–A10); held back until those steps land: hot owner key until Tue, bot pushes to `main`, whole-repo site, one PC, ruler not yet paying and no full audit hold it back |
| **Organization quality** | **8** | 5.5 | decisions ordered, overlap retired, archive clean, paused work set aside, funds-risk map; held back by the crowded root, the size of three files and the overlapping status lists |

**To reach 10:** documentation — write the three files in §3's top rows and clear the TBDs; architecture — ARCHITECTURE "Target architecture" A1–A10 (cold keys Tue 10, required CI on every PR, data off `main`, Pages allow-list, tagged releases, the shared game kit, ruler v2.1, a standby machine, observability, the full audit); organization — `REPO_MAP.md` §4 steps 1–4, then split `DECISIONS.md` by year or area once it passes ~150 entries.

## 5. Top 10 priorities
| # | Priority | Who | When |
|---|---|---|---|
| 1 | **Go live in order:** `game-apply 2` and `7` (Thu after 7:51 AM PT) → announce v6.1 → upload Mon 9 → pin + handover 4a → accepts Tue 10 → rule week Mon 16 (`TODOS.md`, `CALENDAR.md`) | Owner, Vault chat | Thu 5 – Mon 16 |
| 2 | **Merge #114 after the upload and #141 after v6.1 is live**; Block X final at Mon 00:00 (R-BX-24) and Questions' free prize on the switch (R-VAULT-14) before Mon 16 | Library, Block X, Vault | by Mon 16 |
| 3 | **VHP ruler v2.1: build and simulate** (R-RULER-2), recorder on, data only | Ruler chat, owner | now |
| 4 | **Pages allow-list** (R-HUB-14), then the CODEOWNERS ruleset with the bot and the owner as bypass | Hub chat, owner | this week |
| 5 | **Fix fast (D-140):** every review finding in one pass; `AUDITS.md` §5 tracks the open ones | every chat | standing |
| 6 | **Write the contract register, the data formats and the Swap Desk page** (§3) | Library | next |
| 7 | **Career profile from day 1** (R-HUB-15) | Hub chat | after the core |
| 8 | **Repo structure:** move the website into `web/`, the Questions builder into `questions/`, the ruler into `ruler/` (`REPO_MAP.md` §4) | Hub, Questions, Ruler | after R-HUB-14 |
| 9 | **The next games** in order: Last Node, Block Golf, Fantasy, Bracket (D-138, D-141), each by `NEW_GAME.md` | game chats | after the core |
| 10 | **The full platform audit**, tier 1 first, against each contract's live hash (D-102, I-002) | Owner + Repo Lens | once the core is live |
