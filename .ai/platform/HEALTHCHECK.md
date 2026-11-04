# Knode Games — Health Check

> **Purpose:** a CTO-level read of where Knode Games stands: strengths, weaknesses, missing information, quality scores and the top 10 priorities. Repeat it monthly, or after a big launch.
> **Reviewed:** 2026-11-03, by the library chat acting as CTO and architect. Covers every file under `.ai/`: 21 platform files, 5 standards, 9 game files and the archive (not re-read; filed). It also draws on today's audits: Repo Lens on PR #65, PR #73 (independent check), PR #74 and the Bracket (#E-3).
> **Library size:** 89 decisions (D-001 – D-089), ~80 issues (I-001 – I-080), 27 debt items, 32 documentation gaps; 99 open ❓ marks.
> **Scores:** out of 10. 5 = workable with known risks; 7 = solid for this stage; 9 = mature.

## Scores at a glance
| Area | Score | One line |
|---|---|---|
| **Documentation quality** | **7 / 10** | Thorough and cross-linked, with one decision log that wins. Heavy to read, goes stale fast, and lacks runbooks and a glossary |
| **Architecture quality** | **6.5 / 10** | Strong money design (one vault, fail closed, write-once, timelocks, emergency build). Held back by hot keys on one home PC, each game rebuilding its own recorder, and the bot trusting recorder-computed points |
| **Organization quality** | **6.5 / 10** | A working system as of today: starter prompts, chat requests, session-end reports, weekly review, one owner who merges. Still young: 12 parallel chats, branches far behind `main`, and coordination through the owner |

## 1. Current strengths
**Money and safety design**
- **One vault holds every stake** and is itself the producer (D-016, D-073). Stakes are always withdrawable; a withdrawals-only emergency build is ready (D-021). Holdings ≥ liabilities (21,133.83 vs 21,124.07 VHP, 3 Nov).
- **Safety rules are real, written and enforced in code:**
  - 48 h timelocks for upgrades, games, seed and treasury;
  - fail-closed results;
  - write-once files;
  - two nodes that must agree;
  - recorders that hold no keys;
  - publish jobs that run no repo code.
- **Prize money can only shrink, never grow, by mistake:**
  - a shortfall is cut, never owed (D-029);
  - the free-prize switch can only hold back (D-082);
  - the contract re-checks every winner and stake.
- **Not gambling** (D-075): no wagers and no player-funded pots; stakes are never at risk.

**Process**
- **Every change goes through audits.** Repo Lens rounds with blind verifiers, fix-checks, and independent checks of risky docs (PR #73). Today's audits found real issues before money moved, which is the process working.
- **The owner merges everything** (D-026); mainnet tools are dry runs by default.
- **Documentation is the source of truth** (D-002, with one precedence order), one decision log (D-001 – D-089), contradictions logged and resolved (C-01 – C-25, none open).
- **New today:**
  - one start message for every chat, with each chat's work list in GitHub (D-089, `CHAT_REQUESTS.md`);
  - the five-part session-end report;
  - the weekly review, with a Tuesday reminder;
  - the free-prize switch guide.

**Product**
- Three live games (Questions, Race, Block X), with six more in the pipeline.
- Free play on every game (D-081), a clear success target (D-076), $0 hosting (D-005), and nicknames everywhere (D-078).

## 2. Current weaknesses
| # | Weakness | Area | Risk | Refs |
|---|---|---|---|---|
| 1 | **Hot keys on one home PC.** One owner key controls the vault, Desk, Picks and Race picks and is the Desk treasury. The sponsor key (25,000 KOIN, no timelock) and contract keys sit in the same `.env` | security | Critical until the weekend moves; the sponsor risk is accepted (D-085) | TD-01, I-001, D-083 – D-085 |
| 2 | **One machine, one internet line** for all three producers and the release backup | operations | High: an outage stops production and the backup together | TD-08 |
| 3 | **Each game builds its own recorder and publish checks.** The same lessons keep being re-learned: clock checks, recompute-in-publish and per-file holds were hardened for Block X, then missing again in the Bracket (#E-3 H-2, H-3, M-3) | architecture | High: every new game repeats old bugs | #E-3, BX-79/88/96–98 |
| 4 | **The vault bot can't recompute points**; it trusts what the recorder writes. Only some publish jobs recompute | architecture | High: a recorder that's consistently wrong passes | I-080, PR #74 review |
| 5 | **GitHub Actions as the clock.** Frequent schedules run late (the 5-min sampler and 15-min watchdog run about hourly) | architecture | Medium: thin samples, slower alerts | I-059, PR #67 |
| 6 | **Matchup and pick manipulation is possible**: VHP timed around round starts, copied picks in one block, wallet farms | game design | Medium: unfair prizes; stakes safe | #E-3 H-4 – H-6, I-035 |
| 7 | **Push access is the real trust boundary** for results, names and the switch (data branches). Only `main` has a ruleset | security | Medium | FP-1, TD-03 |
| 8 | **Branches drift far behind `main`** (Bracket 16+ commits) and merge late | organization | Medium: late merge surprises | #E-3 L-16 |
| 9 | **Docs are long and go stale within hours** on busy days; many lines carry history (~~struck~~ text) | documentation | Medium: new chats read outdated lines | today's cleanup (PR #72) |
| 10 | **Coordination runs through the owner.** Twelve chats, and each finding needs the owner to relay it | organization | Medium: slow, error-prone; eased by D-089 | D-089 |
| 11 | **The PC's operator key is probably the old one**, so PC operator commands fail | operations | Low: the bot on GitHub does the work | D-084 |

## 3. Missing information
**On chain or on the PC (a read-only check answers these)**
- The live owners of the Picks and Race picks contracts, and which key `OPERATOR_WIF` on the PC really is (wallet runbook step 0, Fri 6 Nov).
- The bot wallet's KOIN and Mana (I-046), and the old operator's leftover KOIN (~100, I-045).
- Whether the deployed vault matches `Kpred.ts` byte for byte, rebuilt independently (Repo Lens "not checked").

**Chain behaviour, still unverified**
- Live `effective_balance_of` against the rebuild (Bracket L-9).
- Whether events from failed nested calls are dropped (L-1).
- Whether mainnet nodes expose pending transactions (H-6).
- Whether Kondor's "show private key" output is a WIF the tools accept.

**Measurements**
- Real sampler cadence over a week (I-059).
- Real sponsor use per player and per day (TD-12, D-061).
- Mana cost of reverted sends.

**Decisions still open**
- Last Node's free-winner rule.
- Free-prize farming (I-035).
- Which owner checklist is the source of truth (I-032).
- The announcements channel and process.
- The growth plan to 1,000,000 VHP (D-076).

**Documents**
- Emergency runbook with monitoring.
- Game go-live checklist.
- Audit process.
- Key and role inventory.
- Glossary.
- Admin powers per contract (desk, sponsor, Race, Picks).
- Data formats.

`DOCUMENTATION_GAPS.md` ranks them. About 30 decisions have no date.

## 4. Quality scores, explained
**Documentation: 7 / 10**
- **+** Every decision is numbered and traceable. Contradictions are logged and settled. Each game has an eight-section file. Standards exist for games, vault, leaderboards, tokens and chats. Processes exist for session ends and weekly reviews.
- **−** Long, dense files, and history kept inline makes reading slow. Snapshot files go stale the same day. Operating documents are missing (runbook, go-live, keys, glossary). 99 open ❓.
- **To reach 8:** the four missing operating docs; a glossary; move history out of the live files (a "History" section or archive) so current text reads clean.

**Architecture: 6.5 / 10**
- **+** Sound money design: one vault, timelocks, fail-closed, write-once, two-node agreement, keyless recorders, publish jobs that run no repo code, an emergency build, and a contract that re-checks every row and winner.
- **−** Hot keys on one PC (until the moves); one home machine; each game builds its own recorder and publish checks; points are not recomputed outside the recorder; GitHub cron timing; game-design manipulation paths.
- **To reach 8:**
  - the wallet moves, then a multisig owner;
  - a **shared game kit**: one recorder and publish-check library with clock checks, per-file holds and points recompute, which every game uses;
  - the bot's on-chain points recompute (I-080);
  - a second machine or hosted backup;

**Organization: 6.5 / 10**
- **+** One owner who merges; one library; one start message; per-chat work lists; session-end reports; weekly review; audit before every launch.
- **−** Twelve chats in parallel; relaying through the owner; branches drifting; project notes (`claude/*.md`) and repo docs in two places; many prompt files.
- **To reach 8:** run the D-089 loop for two weeks (requests → session-end report → library update), keep branches merged with `main` weekly, and retire one-off prompt files in favour of `CHAT_REQUESTS.md`.

## 5. Top 10 priorities
| # | Priority | Why now | Owner | Refs |
|---|---|---|---|---|
| 1 | **Do the wallet moves safely**: fix PR #73, merge, follow the runbook Fri 6 – Tue 10 Nov | Removes the biggest risk (one hot key for everything) | Vault chat + owner | TD-01, I-001, D-083 |
| 2 | **Make the first paid week safe:** apply games 2 and 7 (Thu–Sun); fix PR #74 (VB-2, VB-3), Repo Lens fix-check, merge by Fri 13 Nov; Race I-034; Block X I-042 | Real VHP starts flowing from Mon 9 Nov; the first close is Mon 16 Nov | owner, Vault, Race, Block X chats | D-077, I-034, I-042, I-064 |
| 3 | **Emergency runbook with monitoring and alerts** | Before money flows to several games, everyone needs to know what to do when something breaks | library chat + Vault chat | DOCUMENTATION_GAPS #2, #26 |
| 4 | **Set the free-prize switch values, plus rulesets** on `prize-settings` and the data branches (no deletion; no force-push where possible) | Each game starts with the right prize, and the data that decides payouts is harder to tamper with | owner | D-082, FP-1, TD-03 |
| 5 | **Sampler cadence** (PR #67 in review) | Block X cards, Last Node, Combo and Fantasy depend on it | Block X chat | I-059 |
| 6 | **Survivor launch on Mon 16 Nov** with a board the vault check accepts (VB-4) | The next staked + free game; the date is set | Survivor + Vault chats | D-065, I-050, I-079 |
| 7 | **A shared game kit standard**: one recorder and publish-check library (clock checks, per-file holds, points recompute, board shape) | Stops every game re-learning Block X's lessons (Bracket #E-3); makes audits faster | architecture chat (new) | §2 #3, #4 |
| 8 | **Keep game branches merged with `main` every week**, and run each game's fix-check on the merged branch | Branches drift 16+ commits behind and merge late with surprises (Bracket #E-3 L-16); weekly merges keep audits valid | each game chat + owner | §2 #8 |
| 9 | **Bracket fixes and fix-check** (2 Critical, 6 High), with the Pool protection (D-086) | The next audited game; launches when ready | Bracket chat | D-086 – D-088 |
| 10 | **Reduce single points of failure**: a backup machine or hosted node for the pool, the fallback node (on hold), and a plan to shrink the sponsor's hot-key exposure as it grows | Production and the sponsor's 25,000 KOIN shouldn't depend on one PC | owner + architecture chat | TD-08, D-085 |

Next health check: early December, or after the first month of paid weeks.
