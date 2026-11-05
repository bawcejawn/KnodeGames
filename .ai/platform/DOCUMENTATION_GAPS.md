# Knode Games — Documentation Gaps

> **Purpose:** what's still missing, contradictory or incomplete in the `.ai/` library, ranked, so it can be fixed in order. **Open gaps only:** closed ones move to `../archive/DONE.md` ("Documentation gaps closed").
> **Reviewed:** 2026-11-03 (every file, twice, with an independent cross-check); cleaned 2026-11-04 (closed rows moved; numbers kept, so #3 is still #3); status sync 5 Nov 2026. The previous version is `../archive/2026-11-04/DOCUMENTATION_GAPS.md`.
> **Status:** 🔧 in progress · nothing = open.
> **Rank:** **P1** could put funds or this week's launch at risk · **P2** needed before launch or misleads readers · **P3** slows onboarding or future work · **P4** nice to have.
> **Type:** **C** contradictory · **M** missing · **I** incomplete. Items marked ⚡ are quick fixes (minutes).

## Ranked list
| # | Rank | Type | Gap | Where | Fix |
|---|------|------|-----|-------|-----|
| 9 | P2 | M | **The Swap Desk has no document of its own** — the only live product without one (rules, fee, treasury, liquidity, its node, status, known issues) | `games/` covers games only | New `platform/SWAP_DESK.md` |
| 11 | P2 | I | **Scoring gaps in two game files:** points per correct answer (Daily Questions) and points per correct pick (Block X) were never written down | `games/Questions.md`, `games/BlockX.md` | Take them from the contract / `docs/blockx/MAINNET-LAUNCH.md` |
| 14 | P3 | I | **ARCHITECTURE's remaining blanks:** repository folder map, what the 15 workflows each do, the Block X recorder schedule, on-chain state | `ARCHITECTURE.md` (3 TBDs) | Fill in from the repo |
| 15 | P3 | M | **Data formats beyond vault files** — each game's `board.json` columns, `index.json`, Race `W###.json`, the `games-data` folders, `names.json` | LEADERBOARD_STANDARD covers shared columns only | A data-formats section, or one line per game in its file |
| 18 | P4 | I | **KOINOS unknowns:** Kondor on mobile, KOIN Vault on desktop, PoB and Nicknames on testnet, markets and community links | `KOINOS.md` (6 ❓) | Fill in when known |
| 19 | P4 | I | **About 30 decisions have no date** (marked ❓) | `DECISIONS.md` index | Date them from the archive where possible |
| 20 | P4 | M | **No version history** — contract versions, hashes and upload dates in one table (partly in `archive/DONE.md` → Roadmap: done milestones) | — | A "Releases" table in ROADMAP or ARCHITECTURE |
| 21 | P4 | M | **Growth plans have no documents:** non-intrusive ads (no adult content), the installable mobile app and guest play, the "Built on Koinos" section, the KOIN Vault developer request | FOUNDER_INTENT mentions them only | A short plan each when work starts |
| 23 | P4 | I ⚡ | **TODOS has items without due dates** (Kondor retest) | `TODOS.md` | Owner to set |
| 33 | P2 | I | **`docs/MIGRATION.md` is out of date:** it clones the old repo name (`bawcejawn/knode`), covers only two nodes (no Desk node) and expects 47 game tests | `docs/MIGRATION.md`; `RECOVERY.md` §8 | Vault chat refreshes it |
| 34 | P2 | M | **The Desk node's rebuild steps aren't written anywhere** (folder, Docker project, `register-key`, 48 h, `settings apply`) | `RECOVERY.md` §4 step 6 | Vault / Swap Desk chat |
| 35 | P3 | I | **`RECOVERY.md` is not rehearsed:** its times are estimates | `RECOVERY.md` | a dry rehearsal on a spare machine (no key registered) |
| 29 | P3 | M | **No announcements process**: D-064 says *when* to announce, not where (site, X, Telegram?), who writes it, or the checklist | — | Owner decision, then a short section in the go-live checklist |
| 32 | P4 | C | **Mixed date headers** ("Last updated", "Reviewed", "Snapshot") with no rule for when each is refreshed | — | Rule: snapshot files (CURRENT_STATE, LAUNCH_BOARD) at each weekly review; every other file whenever its content changes |

## Closed since 4 Nov (move to `../archive/DONE.md` at the next cleanup)
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

## Systems not fully defined
These need a decision or a design, not just writing. Each has an owner.

| System | What's missing | Who | By |
|---|---|---|---|
| Free boards for Fantasy, Combo, Golf, Last Node (D-081) | No design yet; Combo may need Picks v2 before free players can send cards | each game chat | before each launch (paused, D-113) |
| Free-prize switch starting values | Branch not created ❓ (check `npm run prizes -- list`); the GitHub ruleset waits for it | owner | this week |
| Week labels (I-069) | Three schemes live; "Week 1" = vault week 3 = Mon 9 Nov, decided (D-063); site-wide display ❓ | Hub chat | before Mon 9 Nov |
| Growth to 1,000,000 VHP (D-076) | No plan for how to get there | owner | later |
| Fallback node | On hold; no plan | owner | later |

## Action plan (updated 5 Nov, highest priority first)
**P1 / P2: before Mon 16 Nov (v6.1's rule week)**
1. ✅ CALENDAR, AUDITS, GLOSSARY, WEEK_CYCLE, NEW_GAME written (5 Nov); #8, #12, #13, #30 closed.
2. Swap desk doc (#9); scoring gaps (#11). Library chat with the owning chats.
3. `docs/MIGRATION.md` (#33) and the Desk node rebuild steps (#34). Vault / Swap Desk chat.

**P3: next two weeks**

4. Announcements process (#29).
5. ARCHITECTURE blanks (#14); data formats (#15). (VISION folded, ✅ 5 Nov.)
6. Second cleanup pass: game files, ARCHITECTURE, PLATFORM, standards (R-LIB-4; D-113 repo cleanup).
7. Free-board designs for Fantasy, Combo, Golf, before each paused game restarts. Game chats + owner.

**P4: later**

10. #18 – #21, #23, #32; growth plan; fallback node plan.

## What's in good shape
- **No open contradictions** in `DECISIONS.md`: all 25 are settled, and 129 decisions are recorded (D-001 – D-129).
- **All 12 chat exports are filed**; nothing in the archive is unsorted.
- **Every game has a full eight-section file**, and the standards, RULES, DEPENDENCIES and FOUNDER_INTENT have no blanks. Eight standards now (Game, Vault, Leaderboard, Token, Recorder, VHP ruler, Go-live checklist, AI chat starter), plus the runbook, alerts, recovery, keys and roles, sponsor and three process files (session end, weekly review, free-prize switch).
- One home per fact: sponsor numbers in `SPONSOR.md`, game timing in `standards/WEEK_CYCLE.md`, v6.1 dates in `CALENDAR.md`; other files point there. 2 + 1 free prizes; free play on every game, with prizes per the switch (D-081, D-082); new games paused (D-113); public testnet only.
