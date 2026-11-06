# Knode Games — Library Health Check

> **Purpose:** a CTO / architect review of the whole `.ai/` library and what it says about the platform: strengths, weaknesses, missing information, three quality scores and the top 10 priorities. A **dated snapshot**; for the whole system at a glance read [`../../STATUS.md`](../../STATUS.md); for live status read `LAUNCH_BOARD.md`, `CALENDAR.md` and `AUDITS.md`.
> **Reviewed:** Thu 5 Nov 2026, ~20:30 UTC (12:30 PM PT), on `main` after PR #208. Every file in `.ai/` outside `archive/`: 54 files, ~670 KB.
> **Previous checks:** `../archive/2026-11-05/HEALTHCHECK-2026-11-05-morning.md` (8.5 / 7.5 / 8), `../archive/2026-11-05/HEALTHCHECK-2026-11-04-evening.md` (7 / 7 / 5.5).

**Open load:** 66 open issues (I-103, I-104 new today) · 51 owner to-dos · 75 chat requests (69 open) · 19 debt items · 14 documentation gaps · 160 decisions (D-001 – D-160; 159 entries, D-152's lands with PR #182) · 113 ❓ marks (41 in `DECISIONS.md`, 12 in `RECOVERY.md`) · 7 `{{TBD}}` · 11 open PRs.

## 1. Current strengths
- **Funds design is sound, written and mapped.** Only the vault holds stakes; stakes are always withdrawable; a withdrawals-only build is pinned for each vault version (D-003, D-016, D-021). `REPO_MAP.md` sorts the repo by funds risk; `CONTRACTS.md` is the register of every live contract, its hash, timelock and owner.
- **One page for the whole system.** `STATUS.md` (top of the repo) is linked first from `README.md`, `.ai/README.md` and `START_HERE.md`, and the session-end process now requires keeping it true (#200).
- **The standards are now a complete set.** `GAME_STANDARD` (what a game must be), `CONTRACT_STANDARD` (contracts), `NEW_GAME` (copy → fill → check → review → go live, with `game:new` / `game:check`, D-157), `WEEK_CYCLE` (one week for every game), `RECORDER_STANDARD` (the rules), `GAME_KIT` (one implementation of those rules, D-158 / D-160), `LEADERBOARD`, `VAULT`, `TOKEN`, `GO_LIVE_CHECKLIST`.
- **Payout rules are unified and written once.** Who gets paid (D-152) and the free-prize tie rule (D-159: up to 10 a place, more than 10 → exactly 10 by earlier score time then address, never empty) sit in every standard; games that differ are filed as mismatches (I-103, I-104), not copied.
- **Decisions are complete, ordered and quote the owner.** 160 decisions, index and entries match; corrections are new entries (D-160 corrects D-158), nothing deleted.
- **Owner-in-the-loop is explicit.** "Any rule ambiguity stops the build and goes to the owner" (D-160); mainnet sends need `--send` + `CONFIRM_MAINNET`; contract code is audited on the exact build, announced 48 h ahead and hash-checked (v6.1 announced 5 Nov with `11043e1f…`).
- **Privacy split works.** Public files keep roles and addresses only; key-storage details live only in the Claude project's `claude/private/` (#193).
- **Archive discipline.** Finished items go to `../archive/DONE.md`, closed issues to `../archive/ISSUES_CLOSED.md`, replaced files to dated folders.

## 2. Current weaknesses
- **The library lags the owner's actions by hours.** The v6.1 announcement (5 Nov, uploadable from Sat 7 19:01 UTC) is not yet recorded in `TODOS.md`, `CALENDAR.md`, `CURRENT_STATE.md` or `STATUS.md`.
- **Onboarding docs don't yet reflect D-157 – D-160.** `START_HERE.md`, `AI_CHAT_STARTER.md` and `NEW_GAME.md` don't mention `GAME_KIT.md`, R-ALL-11 / R-ALL-12 or "no own recorder"; `AI_CHAT_STARTER.md` §3.5 still says the architecture chat is "design only, no building", while it now builds the kit; `ARCHITECTURE.md` still lists the Fantasy, Golf and Bracket recorders as "paused".
- **References to files that don't exist:** `docs/VHP-STANDARD.md` (in `ARCHITECTURE.md`, `CHAT_REQUESTS.md`, `VHP_RULER.md`), `vhp-standard.js` (7 mentions), `bot/vhp-chain.ts` (4). An AI following them finds nothing.
- **Status still lives in many lists:** `STATUS`, `CURRENT_STATE`, `LAUNCH_BOARD`, `PRIORITIES`, `ROADMAP`, `TODOS`, `CHAT_REQUESTS`, `OPENISSUES`, `CALENDAR`. A busy day needs 5–7 edits to stay true; `ROADMAP` mostly repeats the others.
- **Big files keep growing:** `DECISIONS.md` 130 KB, `CHAT_REQUESTS.md` 49 KB, `ARCHITECTURE.md` 47 KB, `VHP_RULER.md` 36 KB.
- **The review queue is the bottleneck:** 11 open PRs, most waiting on a Repo Lens run (`AUDITS.md` §2).
- **Architecture risks still open (recorded, not hidden):**
  - five hand-built recorders (Block X, Race on `main`; Bracket, Golf, Fantasy on branches) repeat the same ~15 rules; the kit is designed but not built (R-ARCH-3);
  - payout mismatches in live or pending code (I-103 Block X and Bracket, I-104 Race #182);
  - the owner key is hot until the cold-key handover (Tue 10 Nov);
  - the bot pushes data to `main` and no PR check is required (TD-03, A2, A3);
  - the whole repo is served as the site until the Pages allow-list (R-HUB-14);
  - one PC runs all nodes (TD-08, D-147);
  - the VHP ruler pays nothing until v2.1 passes all 11 simulations (R-RULER-2, D-120 open);
  - the full platform audit hasn't run (D-102, I-002).
- **The weekly review hasn't run yet** (`reviews/` holds only its README); the first is Tue 10 Nov.

## 3. Missing information
| Missing | Where it should live | Why it matters |
|---|---|---|
| **Data formats:** week files, `index.json`, `board.json`, pending / final, HOLD / RELEASE, the vault file, `P###` prize files | `standards/DATA_FORMATS.md` (gap #15) | the kit (R-ARCH-3) implements them now; payouts depend on them |
| **The v6.1 announcement record:** tx `0x1220a4a9…`, build `11043e1f…`, uploadable Sat 7 19:01 UTC, expires ~Sat 14 | `CALENDAR.md`, `TODOS.md`, `CONTRACTS.md` §2 | Monday's upload and the handover depend on it |
| **Each game's "score time"** for the free-prize tie-break (D-159) | each game file (R-ALL-12) | only Questions has one; Block X, Race, Bracket, Fantasy, Golf must write theirs |
| **Swap Desk** rules, fee, treasury, liquidity, its node | `platform/SWAP_DESK.md` (gap #9) | the only live product holding funds without its own page |
| **Testing standard** (required tests per game) | folded into `GAME_KIT.md` §5 / the kit's conformance suite | today each game's tests follow audit rounds, not a list |
| **Desk node rebuild steps; `docs/MIGRATION.md` is stale** | `RECOVERY.md` (gaps #33, #34) | recovery after losing the PC |
| **Measurable targets** (players a week, VHP staked) | `FOUNDER_INTENT.md` | the north star (D-076) can't be tracked |
| **Open unknowns** in decisions and recovery (41 + 12 ❓) | resolve or mark "accepted unknown" | an AI can't tell a gap from a fact |

## 4. Scores (out of 10)
| Area | Score | Was (5 Nov morning) | Why |
|---|---|---|---|
| **Documentation quality** | **8.5** | 8.5 | gained a complete standards set, `STATUS.md`, `CONTRACTS.md`, one payout rule everywhere; held back by onboarding docs not yet on D-157 – D-160, references to missing files, the unrecorded v6.1 announcement and the ❓ count |
| **Architecture quality** | **8** | 7.5 | the Shared Game Kit (D-158 / D-160) removes the biggest structural risk on paper, payout rules are unified (D-152, D-159), contracts registered; held back until built: five hand-built recorders, open payout mismatches, hot owner key until Tue, bot pushes to `main`, whole-repo site, one PC, ruler not paying, no full audit |
| **Organization quality** | **8** | 8 | clean archive, ordered decisions, public / private split, one status map; held back by overlapping status lists, four very large files, 11 open PRs and stale references |

**To reach 10:** documentation — update the onboarding docs for D-157 – D-160, write `DATA_FORMATS.md` and `SWAP_DESK.md`, remove references to missing files, record owner actions the same day; architecture — build and adopt the kit (R-ARCH-3), fix I-103 / I-104, then ARCHITECTURE A1–A10 (cold keys, required CI, data off `main`, Pages allow-list, tagged releases, standby machine, ruler v2.1, the full audit); organization — retire `ROADMAP.md` into `PRIORITIES` / `CALENDAR`, move done rows out of `CHAT_REQUESTS.md`, split `ARCHITECTURE.md` (now vs target), clear the PR queue.

## 5. Top 10 priorities
| # | Priority | Who | When |
|---|---|---|---|
| 1 | **Vault v6.1:** upload Mon 9 from 9:00 AM PT → pin `04c27c1a…` → handover 4a; accepts Tue 10; rule week Mon 16. Record the 5 Nov announcement (tx, window) in `TODOS`, `CALENDAR`, `CURRENT_STATE`, `STATUS` today | Owner, Vault chat, Library | Thu 5 – Tue 10 |
| 2 | **Daily Questions recorder, PR #203:** Repo Lens, merge `main` (keep main's `OPENISSUES` / `RECORDER_STANDARD`), merge by Sun 15; hard limit Thu 26 Nov | Questions chat, owner | by Sun 15 |
| 3 | **Race PR #182:** fix I-104 (free-prize places per D-159), fix-check, merge; D-152's entry lands with it | Race chat, owner | before Mon 16 |
| 4 | **Build the kit's core** (R-ARCH-3, `GAME_KIT.md`): start the Architecture chat from `claude/architecture/KIT-BUILD-PROMPT-2026-11-05.md`; Fantasy, Golf and Bracket launch only on it | Architecture chat | start now |
| 5 | **Bring the onboarding docs to D-157 – D-160:** `START_HERE`, `AI_CHAT_STARTER` (§3.2 kit + R-ALL-11 / 12; §3.5 "builds the kit"), `NEW_GAME` (recorder = GameModule, no own runner), `ARCHITECTURE` recorder rows | Library | next docs PR |
| 6 | **Clear the review queue:** #181, #185, #173 / #179, #177 / #178, then #186 – #188 after their kit ports (`AUDITS.md` §2) | Owner + Repo Lens | this week |
| 7 | **Security architecture:** cold keys Tue 10; Pages allow-list (R-HUB-14); one required CI check on every PR (A2); data off `main` (A3) | Owner, Hub chat, Architecture chat | Nov |
| 8 | **Write the missing references:** `DATA_FORMATS.md` (the kit needs it), `SWAP_DESK.md`, each game's score time (R-ALL-12); fix the references to `docs/VHP-STANDARD.md`, `vhp-standard.js`, `bot/vhp-chain.ts` | Library, game chats | this week |
| 9 | **VHP ruler v2.1:** build A′, re-run the 11 simulations; owner's D-120 choice | Ruler chat, owner | now |
| 10 | **Slim the library:** retire `ROADMAP.md`, move done rows out of `CHAT_REQUESTS.md`, split `ARCHITECTURE.md`; first weekly review Tue 10; then the full platform audit, tier 1 first (D-102) | Library, owner | Tue 10, then after the core |
