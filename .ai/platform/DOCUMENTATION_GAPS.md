# Knode Games — Documentation Gaps

> **Purpose:** what's missing, contradictory or incomplete in the `.ai/` library, ranked by importance, so it can be fixed in order.
> **Reviewed:** 2026-11-03, twice. Morning: every file under `.ai/` (27 files), plus `docs/WALLETS.md`. Afternoon: all 35 files, cross-checked by an independent reviewer against `DECISIONS.md`. The stale and contradicting lines it found were fixed in the 3 Nov cleanup PR (marked superseded, nothing removed).
> **Status:** noted at the end of each row's Fix cell: ✅ done · 🔧 in progress · nothing = open.
> **Rank:** **P1** could put funds or this week's launch at risk · **P2** needed before launch or misleads readers · **P3** slows onboarding or future work · **P4** nice to have.
> **Type:** **C** contradictory · **M** missing · **I** incomplete. Items marked ⚡ are quick fixes (minutes).

## Ranked list
| # | Rank | Type | Gap | Where | Fix |
|---|------|------|-----|-------|-----|
| 1 | P1 | C | **The wallet-move procedure is out of date** and is the one this weekend's P1 task points to. It still treats the owner as the **seed owner** and plans to hand the seed to the new owner — but the seed already has its own dedicated wallet (`1K8VV…`, D-022) and should stay separate. It also refers to the "live v3 game" (now Vault v6) and a sponsor of "≥ 5,000 KOIN" (now 25,000, D-061). Following it could put the seed back on the owner's key | `docs/WALLETS.md` (repo, 26 Oct); `TODOS.md` | Rewrite before the weekend from D-013, D-022, D-061 (the salvage notes in `claude/handoff-pr50-salvage.md` help). Keep its caution that a desk owner handover clears a pending treasury change |
| 2 | P1 | M | **No emergency or incident runbook.** The steps for a vault emergency (`upgrade --safe`, sponsor limit 0, pause), a compromised key, a node or Armana outage, red bot runs, a late question release, or a bad results file are scattered across chats and three files | — | New `platform/RUNBOOK.md`: one section per incident — how to tell, what to run (PowerShell, dry run first), what to check after |
| 3 | P1 | M | **No single key and role inventory.** Which keys exist (`OWNER_WIF`, `OPERATOR_WIF`, `SEED_WIF`, `SPONSOR_WIF`, desk / race / Picks keys), where each lives, what each can do, and the rotation status are spread over PLATFORM, TOKEN_STANDARD and chat notes | — | New `platform/KEYS_AND_ROLES.md` (names and locations only — never keys) |
| 4 | P2 | I | **Admin powers and upgrade paths are documented only for the vault.** For the desk, sponsor, Race and Picks contracts, "upgradable?" and the timelocks are blank — which also matters for knowing what the owner wallet move changes | `ARCHITECTURE.md` contract table (6 TBDs) | Fill in one row per contract: owner, what the owner can do, timelock, upgrade path |
| 5 | P2 | M | **No launch-week runbook.** The exact `game-add` → sponsor vault switch → `game-apply` commands, in order, with dry runs and checks, exist only as outlines (TODOS) and a Vault chat handoff | `TODOS.md`; project `claude/handoff-sponsor-v6-day.md` | Copy-paste steps into `RUNBOOK.md` (or a launch section) before Fri 6 Nov — 🔧 widened to a game go-live checklist (#25); the 2 and 7 steps are in `CURRENT_STATE.md` |
| 6 | P2 | C ⚡ | **Stale launch items:** ROADMAP still lists Block X step 8 and the announcement window as pending (done, D-070); I-065 says Block X is ready "once step 8" is done; TODOS still asks to "confirm which sponsor version is live (v2 or v3)" (settled, C-01) | `ROADMAP.md` lines 20, 30, 39; `OPENISSUES.md` I-065; `TODOS.md` | Mark done / remove **— ✅ fixed in the 3 Nov cleanup (ROADMAP, I-065, TODOS)** |
| 7 | P2 | C ⚡ | **Settled items still flagged:** the DECISIONS index shows D-020 "prize ⚠️ C-24" (settled by D-068); D-008 and D-032 headings still carry ⚠️ though superseded; README calls the archive "not yet sorted" (all filed) | `DECISIONS.md`; `README.md` | Remove the flags; update the README line **— ✅ fixed in the 3 Nov cleanup (index statuses and legend; README)** |
| 8 | P2 | C | **VISION.md overlaps FOUNDER_INTENT.md** and is now behind it: its mission is still marked unconfirmed and its success targets are `{{TBD}}`, while FOUNDER_INTENT has the confirmed versions (D-075, D-076). Two sources will drift | `VISION.md` (3 TBDs, 5 ❓) | Fold VISION into FOUNDER_INTENT, or keep VISION for brand and audience only |
| 9 | P2 | M | **The Swap Desk has no document of its own** — the only live product without one (rules, fee, treasury, liquidity, its node, status, known issues) | `games/` covers games only | New `platform/SWAP_DESK.md` |
| 10 | P2 | M | **The Mana sponsor has no document of its own.** Its allowlist rows, per-action limits (the pick row 0.2 → 0.25 at Combo), caps, the config and vault-switch procedure ("a plain `config` resets the caps"), the testnet sponsor and budgeting are spread over six files | ARCHITECTURE, DECISIONS, VAULT_STANDARD, TOKEN_STANDARD, KOINOS, PLATFORM | New `platform/SPONSOR.md` |
| 11 | P2 | I | **Scoring gaps in two game files:** points per correct answer (Daily Questions) and points per correct pick (Block X) were never written down | `games/Questions.md`, `games/BlockX.md` | Take them from the contract / `docs/blockx/MAINNET-LAUNCH.md` |
| 12 | P3 | M | **The audit and release process isn't written down** — how a Repo Lens round works (package, prompt, report, GO, fix-check), and what "audited" means for GAME_STANDARD's release gate | `ARCHITECTURE.md` "Audit process: {{TBD}}" | Short section in GAME_STANDARD or a new `AUDITS.md` **— 🔧 open; the starter audit prompt is in `standards/AI_CHAT_STARTER.md` §3.3** |
| 13 | P3 | M | **No glossary.** VHP, effective VHP, Mana, the pool, the seed, cardVhp, staked vs free — and the three week-numbering schemes, which already caused confusion | — | New `GLOSSARY.md` (link from START_HERE) |
| 14 | P3 | I | **ARCHITECTURE's remaining blanks:** repository folder map, what the 15 workflows each do, the Block X recorder schedule, on-chain state | `ARCHITECTURE.md` (3 TBDs) | Fill in from the repo |
| 15 | P3 | M | **Data formats beyond vault files** — each game's `board.json` columns, `index.json`, Race `W###.json`, the `games-data` folders, `names.json` | LEADERBOARD_STANDARD covers shared columns only | A data-formats section, or one line per game in its file |
| 16 | P3 | C | **"New games launch on a Monday" (D-059) reads as a rule** in GAME_STANDARD, while the owner's later decisions are "announce when ready" with a Friday target (D-052, D-064). They're compatible — a game applied mid-week earns from the next Monday — but it isn't explained | `GAME_STANDARD.md` §4 | Reword: "a game starts earning on the Monday after it's applied" **— ✅ fixed in the 3 Nov cleanup (GAME_STANDARD and D-059 now say it's superseded and how the two fit)** |
| 17 | P3 | I | **Two owner checklists** (TODOS.md and the claude.ai checklist artifacts) — which is the source of truth is still undecided | I-032 | Owner decision |
| 18 | P4 | I | **KOINOS unknowns:** Kondor on mobile, KOIN Vault on desktop, PoB and Nicknames on testnet, markets and community links | `KOINOS.md` (6 ❓) | Fill in when known |
| 19 | P4 | I | **About 30 decisions have no date** (marked ❓) | `DECISIONS.md` index | Date them from the archive where possible |
| 20 | P4 | M | **No version history** — contract versions, hashes and upload dates in one table (partly in ROADMAP → Done) | — | A "Releases" table in ROADMAP or ARCHITECTURE |
| 21 | P4 | M | **Growth plans have no documents:** non-intrusive ads (no adult content), the installable mobile app and guest play, the "Built on Koinos" section, the KOIN Vault developer request | FOUNDER_INTENT mentions them only | A short plan each when work starts |
| 22 | P4 | I | **CURRENT_STATE has no upkeep rule**, so it will go stale | `CURRENT_STATE.md` | Add "refresh after each launch step or weekly" to START_HERE **— ✅ upkeep set: CURRENT_STATE is refreshed at each weekly review (`WEEKLY_REVIEW.md`) and after each launch step** |
| 23 | P4 | I ⚡ | **TODOS has items without due dates** (Kondor retest) | `TODOS.md` | Owner to set |
| 24 | P1 | M | **How the free-prize switch works and its starting values** were only in D-082 | — | ✅ `platform/FREE_PRIZE_SWITCH.md` (3 Nov). Owner still to set the values |
| 25 | P2 | M | **No game go-live checklist**: audit → merge → Leaders entry → `game-add … --free` → switch → `game-apply` → `games.json` live → announce. The steps are spread over GAME_STANDARD, VAULT_STANDARD §9, ROADMAP and chat notes | — | New `standards/GO_LIVE_CHECKLIST.md` (folds in #5) |
| 26 | P2 | M | **No monitoring and alerts guide**: what each workflow, the watchdog email and the bot's "problems" mean, and what to do | — | Section in the emergency runbook (#2), or `platform/MONITORING.md` |
| 27 | P2 | C | **Which source wins** was worded three ways (START_HERE, D-002, AI_CHAT_STARTER) | — | ✅ one order in D-002 (3 Nov), confirmed by the owner; START_HERE and the chat starter point to it |
| 28 | P3 | C | **Two names for saved notes**: `claude/handoff-<topic>.md` (instructions for another chat) and `claude/<area>/HANDOFF-<date>.md` (session-end reports) | — | ✅ both kept and explained in `SESSION_END_PROCESS.md` |
| 29 | P3 | M | **No announcements process**: D-064 says *when* to announce, not where (site, X, Telegram?), who writes it, or the checklist | — | Owner decision, then a short section in the go-live checklist |
| 30 | P3 | M | **No week-label spec**: three numbering schemes are still live; the plan for "9 Nov = Week 1" site-wide isn't written (I-069) | — | Hub chat: one table (vault week, site label, file name) in `KOINOS.md` → Time |
| 31 | P3 | C | **The 👤 mark meant two things** ("owner said" vs "owner does it" in ACTIVE_WORK) | — | ✅ ACTIVE_WORK now says "Owner:" for actions; 👤 always means "owner said" |
| 32 | P4 | C | **Mixed date headers** ("Last updated", "Reviewed", "Snapshot") with no rule for when each is refreshed | — | Rule: snapshot files (CURRENT_STATE, ACTIVE_WORK) at each weekly review; every other file whenever its content changes |

## Systems not fully defined
These need a decision or a design, not just writing. Each has an owner.

| System | What's missing | Who | By |
|---|---|---|---|
| Sampler cadence (I-059) | GitHub may run the 5-min schedule only hourly; Block X cards want 12 samples per 6 h; Last Node needs 48 h | Block X chat | before Mon 16 Nov |
| Vault bot checks (I-051, I-052, I-064) | HOLD files, staked-list check, refused-post alerts, recompute from the chain | Vault chat (prompt ready) | Fri 13 Nov |
| Free boards for Fantasy, Combo, Golf, Last Node (D-081) | No design yet; Combo may need Picks v2 before free players can send cards | each game chat | before each launch |
| Last Node free-winner rule | The prize itself is decided (ON, D-081); **how winners are picked** (minimum days, ties, staked vs free) is still open: proposal in `claude/lastnode/FREE-PLAY-PROPOSAL.md`, not yet decided or filed | owner + Last Node chat | before its launch |
| Race prize safety (I-034) and farming (I-035) | The single-run hold and the free-prize farming answer | Race chat + owner | before Mon 16 Nov |
| Free-prize switch starting values | Branch not created; the GitHub ruleset waits for it | owner | this week |
| Week labels (I-069) | Three schemes live; "9 Nov = Week 1" not specced | Hub chat | before Mon 9 Nov |
| Wallet split (I-001, I-045) | No written plan for the hardware owner, cold treasury, retiring the old operator | Vault chat (prompt ready) + owner | before the moves |
| Growth to 1,000,000 VHP (D-076) | No plan for how to get there | owner | later |
| Fallback node | On hold; no plan | owner | later |

## Action plan (3 Nov, highest priority first)
**P1: this week, before money moves**
1. Rewrite `docs/WALLETS.md` before any wallet move (#1). Vault chat + owner.
2. ✅ Library cleanup: stale and contradicting lines fixed; superseded decisions marked (#6, #7, #16, #27, #28, #31). Library chat, 3 Nov.
3. Emergency runbook, with monitoring and alerts (#2, #26), before Mon 16 Nov. Library chat drafts; Vault chat checks the vault steps.
4. Free-prize switch: ✅ guide (#24); the owner sets the starting values and the ruleset.

**P2: before Mon 16 Nov and the next launches**

5. Key and role inventory (#3). Library chat.
6. Game go-live checklist (#25, folds in #5). Library chat.
7. Audit process (#12). Library chat.
8. Last Node free-prize rule; free-board designs for Fantasy, Combo, Golf. Game chats + owner.
9. Sampler cadence. Block X chat.
10. Vault bot checks. Vault chat.
11. Race I-034 / I-035. Race chat + owner.
12. Admin powers per contract (#4); sponsor (#10) and swap desk (#9) docs; scoring gaps (#11). Library chat with the owning chats.

**P3: next two weeks**

13. Glossary (#13); week-label spec (#30); announcements process (#29).
14. Fold VISION into FOUNDER_INTENT (#8); ARCHITECTURE blanks (#14); data formats (#15).

**P4: later**

15. #17 – #21, #23, #32; growth plan; fallback node plan.

## What's in good shape
- **No open contradictions** in `DECISIONS.md`: all 25 are settled, and 82 decisions are recorded (D-001 – D-082).
- **All 12 chat exports are filed**; nothing in the archive is unsorted.
- **Every game has a full eight-section file**, and the standards, RULES, DEPENDENCIES and FOUNDER_INTENT have no blanks. Five standards now (Game, Vault, Leaderboard, Token, AI chat starter), plus three process files (session end, weekly review, free-prize switch).
- Numbers agree across files: sponsor 25,000 KOIN / 5,000 a day; 2 + 1 free prizes; free play on every game, with prizes per the switch (D-081, D-082); Survivor 16 Nov; public testnet only. ("Staked-only games" was listed here on 2 Nov; superseded by D-081.)

## Suggested order (2 Nov; superseded by the action plan above, kept for the record)
1. **Before the weekend:** #1 (wallet procedure), #3 (keys and roles), #4 (who owns what).
2. **Before Friday's `game-add`:** #5 (launch runbook), #6 – #7 (quick fixes), #10 (sponsor).
3. **This week:** #2 (incident runbook), #8 (VISION), #9 (swap desk), #11 (scoring).
4. **Later:** #12 – #23.
