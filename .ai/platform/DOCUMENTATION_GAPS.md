# Knode Games — Documentation Gaps

> **Purpose:** what's still missing, contradictory or incomplete in the `.ai/` library, ranked, so it can be fixed in order. **Open gaps only:** closed ones move to `../archive/DONE.md` ("Documentation gaps closed").
> **Reviewed:** 2026-11-03 (every file, twice, with an independent cross-check); cleaned 2026-11-04 (closed rows moved; numbers kept, so #3 is still #3). The previous version is `../archive/2026-11-04/DOCUMENTATION_GAPS.md`.
> **Status:** 🔧 in progress · nothing = open.
> **Rank:** **P1** could put funds or this week's launch at risk · **P2** needed before launch or misleads readers · **P3** slows onboarding or future work · **P4** nice to have.
> **Type:** **C** contradictory · **M** missing · **I** incomplete. Items marked ⚡ are quick fixes (minutes).

## Ranked list
| # | Rank | Type | Gap | Where | Fix |
|---|------|------|-----|-------|-----|
| 3 | P1 | M | **No single key and role inventory.** Which keys exist (`OWNER_WIF`, `OPERATOR_WIF`, `SEED_WIF`, `SPONSOR_WIF`, desk / race / Picks keys), where each lives, what each can do, and the rotation status are spread over PLATFORM, TOKEN_STANDARD and chat notes | — | New `platform/KEYS_AND_ROLES.md` (names and locations only — never keys) |
| 4 | P2 | I | **Admin powers and upgrade paths are documented only for the vault.** For the desk, sponsor, Race and Picks contracts, "upgradable?" and the timelocks are blank — which also matters for knowing what the owner wallet move changes | `ARCHITECTURE.md` contract table (6 TBDs) | Fill in one row per contract: owner, what the owner can do, timelock, upgrade path |
| 8 | P2 | C | **VISION.md overlaps FOUNDER_INTENT.md** and is now behind it: its mission is still marked unconfirmed and its success targets are `{{TBD}}`, while FOUNDER_INTENT has the confirmed versions (D-075, D-076). Two sources will drift | `VISION.md` (3 TBDs, 5 ❓) | Fold VISION into FOUNDER_INTENT, or keep VISION for brand and audience only |
| 9 | P2 | M | **The Swap Desk has no document of its own** — the only live product without one (rules, fee, treasury, liquidity, its node, status, known issues) | `games/` covers games only | New `platform/SWAP_DESK.md` |
| 10 | P2 | M | **The Mana sponsor has no document of its own.** Its allowlist rows, per-action limits (the pick row 0.2 → 0.25 at Combo), caps, the config and vault-switch procedure ("a plain `config` resets the caps"), the testnet sponsor and budgeting are spread over six files | ARCHITECTURE, DECISIONS, VAULT_STANDARD, TOKEN_STANDARD, KOINOS, PLATFORM | New `platform/SPONSOR.md` |
| 11 | P2 | I | **Scoring gaps in two game files:** points per correct answer (Daily Questions) and points per correct pick (Block X) were never written down | `games/Questions.md`, `games/BlockX.md` | Take them from the contract / `docs/blockx/MAINNET-LAUNCH.md` |
| 12 | P3 | M | **The audit and release process isn't written down** — how a Repo Lens round works (package, prompt, report, GO, fix-check), and what "audited" means for GAME_STANDARD's release gate | `ARCHITECTURE.md` "Audit process: {{TBD}}" | Short section in GAME_STANDARD or a new `AUDITS.md` **— 🔧 open; the starter audit prompt is in `standards/AI_CHAT_STARTER.md` §3.3** |
| 13 | P3 | M | **No glossary.** VHP, effective VHP, Mana, the pool, the seed, cardVhp, staked vs free — and the three week-numbering schemes, which already caused confusion | — | New `GLOSSARY.md` (link from START_HERE) |
| 14 | P3 | I | **ARCHITECTURE's remaining blanks:** repository folder map, what the 15 workflows each do, the Block X recorder schedule, on-chain state | `ARCHITECTURE.md` (3 TBDs) | Fill in from the repo |
| 15 | P3 | M | **Data formats beyond vault files** — each game's `board.json` columns, `index.json`, Race `W###.json`, the `games-data` folders, `names.json` | LEADERBOARD_STANDARD covers shared columns only | A data-formats section, or one line per game in its file |
| 17 | P3 | I | **Two owner checklists** (TODOS.md and the claude.ai checklist artifacts) — which is the source of truth is still undecided | I-032 | Owner decision |
| 18 | P4 | I | **KOINOS unknowns:** Kondor on mobile, KOIN Vault on desktop, PoB and Nicknames on testnet, markets and community links | `KOINOS.md` (6 ❓) | Fill in when known |
| 19 | P4 | I | **About 30 decisions have no date** (marked ❓) | `DECISIONS.md` index | Date them from the archive where possible |
| 20 | P4 | M | **No version history** — contract versions, hashes and upload dates in one table (partly in `archive/DONE.md` → Roadmap: done milestones) | — | A "Releases" table in ROADMAP or ARCHITECTURE |
| 21 | P4 | M | **Growth plans have no documents:** non-intrusive ads (no adult content), the installable mobile app and guest play, the "Built on Koinos" section, the KOIN Vault developer request | FOUNDER_INTENT mentions them only | A short plan each when work starts |
| 23 | P4 | I ⚡ | **TODOS has items without due dates** (Kondor retest) | `TODOS.md` | Owner to set |
| 29 | P3 | M | **No announcements process**: D-064 says *when* to announce, not where (site, X, Telegram?), who writes it, or the checklist | — | Owner decision, then a short section in the go-live checklist |
| 30 | P3 | M | **No week-label spec**: three numbering schemes are still live; the plan for "9 Nov = Week 1" site-wide isn't written (I-069) | — | Hub chat: one table (vault week, site label, file name) in `KOINOS.md` → Time |
| 32 | P4 | C | **Mixed date headers** ("Last updated", "Reviewed", "Snapshot") with no rule for when each is refreshed | — | Rule: snapshot files (CURRENT_STATE, ACTIVE_WORK) at each weekly review; every other file whenever its content changes |

## Systems not fully defined
These need a decision or a design, not just writing. Each has an owner.

| System | What's missing | Who | By |
|---|---|---|---|
| Free boards for Fantasy, Combo, Golf, Last Node (D-081) | No design yet; Combo may need Picks v2 before free players can send cards | each game chat | before each launch |
| Last Node free-winner rule | The prize itself is decided (ON, D-081); **how winners are picked** (minimum days, ties, staked vs free) is still open: proposal in `claude/lastnode/FREE-PLAY-PROPOSAL.md`, not yet decided or filed | owner + Last Node chat | before its launch |
| Race prize safety (I-034) and farming (I-035) | The single-run hold and the free-prize farming answer | Race chat + owner | before Mon 16 Nov |
| Free-prize switch starting values | Branch not created; the GitHub ruleset waits for it | owner | this week |
| Week labels (I-069) | Three schemes live; "9 Nov = Week 1" not specced | Hub chat | before Mon 9 Nov |
| Growth to 1,000,000 VHP (D-076) | No plan for how to get there | owner | later |
| Fallback node | On hold; no plan | owner | later |

## Action plan (updated 4 Nov, highest priority first)
**P1 / P2: before Mon 16 Nov and the next launches**
1. Key and role inventory (#3). Library chat (R-LIB-2).
2. Audit process (#12). Library chat (R-LIB-2).
3. Last Node free-prize rule; free-board designs for Fantasy, Combo, Golf. Game chats + owner.
4. Race I-034 / I-035. Race chat + owner.
5. Admin powers per contract (#4); sponsor (#10) and swap desk (#9) docs; scoring gaps (#11). Library chat with the owning chats.
6. The Vault chat checks the runbook's ❓ steps (R-VAULT-5).

**P3: next two weeks**

7. Glossary (#13); week-label spec (#30); announcements process (#29).
8. Fold VISION into FOUNDER_INTENT (#8); ARCHITECTURE blanks (#14); data formats (#15).
9. Second cleanup pass: game files, ARCHITECTURE, PLATFORM, standards (R-LIB-4).

**P4: later**

10. #17 – #21, #23, #32; growth plan; fallback node plan.

## What's in good shape
- **No open contradictions** in `DECISIONS.md`: all 25 are settled, and 96 decisions are recorded (D-001 – D-096).
- **All 12 chat exports are filed**; nothing in the archive is unsorted.
- **Every game has a full eight-section file**, and the standards, RULES, DEPENDENCIES and FOUNDER_INTENT have no blanks. Seven standards now (Game, Vault, Leaderboard, Token, Recorder, Go-live checklist, AI chat starter), plus the runbook and three process files (session end, weekly review, free-prize switch).
- Numbers agree across files: sponsor 25,000 KOIN / 5,000 a day; 2 + 1 free prizes; free play on every game, with prizes per the switch (D-081, D-082); Survivor 16 Nov; public testnet only.
