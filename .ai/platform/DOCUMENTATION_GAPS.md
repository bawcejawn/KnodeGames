# Knode Games — Documentation Gaps

> **Purpose:** what's missing, contradictory or incomplete in the `.ai/` library, ranked by importance, so it can be fixed in order.
> **Reviewed:** 2026-11-03 — every file under `.ai/` (27 files), plus `docs/WALLETS.md` because `TODOS.md` points to it.
> **Rank:** **P1** could put funds or this week's launch at risk · **P2** needed before launch or misleads readers · **P3** slows onboarding or future work · **P4** nice to have.
> **Type:** **C** contradictory · **M** missing · **I** incomplete. Items marked ⚡ are quick fixes (minutes).

## Ranked list
| # | Rank | Type | Gap | Where | Fix |
|---|------|------|-----|-------|-----|
| 1 | P1 | C | **The wallet-move procedure is out of date** and is the one this weekend's P1 task points to. It still treats the owner as the **seed owner** and plans to hand the seed to the new owner — but the seed already has its own dedicated wallet (`1K8VV…`, D-022) and should stay separate. It also refers to the "live v3 game" (now Vault v6) and a sponsor of "≥ 5,000 KOIN" (now 25,000, D-061). Following it could put the seed back on the owner's key | `docs/WALLETS.md` (repo, 26 Oct); `TODOS.md` | Rewrite before the weekend from D-013, D-022, D-061 (the salvage notes in `claude/handoff-pr50-salvage.md` help). Keep its caution that a desk owner handover clears a pending treasury change |
| 2 | P1 | M | **No emergency or incident runbook.** The steps for a vault emergency (`upgrade --safe`, sponsor limit 0, pause), a compromised key, a node or Armana outage, red bot runs, a late question release, or a bad results file are scattered across chats and three files | — | New `platform/RUNBOOK.md`: one section per incident — how to tell, what to run (PowerShell, dry run first), what to check after |
| 3 | P1 | M | **No single key and role inventory.** Which keys exist (`OWNER_WIF`, `OPERATOR_WIF`, `SEED_WIF`, `SPONSOR_WIF`, desk / race / Picks keys), where each lives, what each can do, and the rotation status are spread over PLATFORM, TOKEN_STANDARD and chat notes | — | New `platform/KEYS_AND_ROLES.md` (names and locations only — never keys) |
| 4 | P2 | I | **Admin powers and upgrade paths are documented only for the vault.** For the desk, sponsor, Race and Picks contracts, "upgradable?" and the timelocks are blank — which also matters for knowing what the owner wallet move changes | `ARCHITECTURE.md` contract table (6 TBDs) | Fill in one row per contract: owner, what the owner can do, timelock, upgrade path |
| 5 | P2 | M | **No launch-week runbook.** The exact `game-add` → sponsor vault switch → `game-apply` commands, in order, with dry runs and checks, exist only as outlines (TODOS) and a Vault chat handoff | `TODOS.md`; project `claude/handoff-sponsor-v6-day.md` | Copy-paste steps into `RUNBOOK.md` (or a launch section) before Fri 6 Nov |
| 6 | P2 | C ⚡ | **Stale launch items:** ROADMAP still lists Block X step 8 and the announcement window as pending (done, D-070); I-065 says Block X is ready "once step 8" is done; TODOS still asks to "confirm which sponsor version is live (v2 or v3)" (settled, C-01) | `ROADMAP.md` lines 20, 30, 39; `OPENISSUES.md` I-065; `TODOS.md` | Mark done / remove |
| 7 | P2 | C ⚡ | **Settled items still flagged:** the DECISIONS index shows D-020 "prize ⚠️ C-24" (settled by D-068); D-008 and D-032 headings still carry ⚠️ though superseded; README calls the archive "not yet sorted" (all filed) | `DECISIONS.md`; `README.md` | Remove the flags; update the README line |
| 8 | P2 | C | **VISION.md overlaps FOUNDER_INTENT.md** and is now behind it: its mission is still marked unconfirmed and its success targets are `{{TBD}}`, while FOUNDER_INTENT has the confirmed versions (D-075, D-076). Two sources will drift | `VISION.md` (3 TBDs, 5 ❓) | Fold VISION into FOUNDER_INTENT, or keep VISION for brand and audience only |
| 9 | P2 | M | **The Swap Desk has no document of its own** — the only live product without one (rules, fee, treasury, liquidity, its node, status, known issues) | `games/` covers games only | New `platform/SWAP_DESK.md` |
| 10 | P2 | M | **The Mana sponsor has no document of its own.** Its allowlist rows, per-action limits (the pick row 0.2 → 0.25 at Combo), caps, the config and vault-switch procedure ("a plain `config` resets the caps"), the testnet sponsor and budgeting are spread over six files | ARCHITECTURE, DECISIONS, VAULT_STANDARD, TOKEN_STANDARD, KOINOS, PLATFORM | New `platform/SPONSOR.md` |
| 11 | P2 | I | **Scoring gaps in two game files:** points per correct answer (Daily Questions) and points per correct pick (Block X) were never written down | `games/Questions.md`, `games/BlockX.md` | Take them from the contract / `docs/blockx/MAINNET-LAUNCH.md` |
| 12 | P3 | M | **The audit and release process isn't written down** — how a Repo Lens round works (package, prompt, report, GO, fix-check), and what "audited" means for GAME_STANDARD's release gate | `ARCHITECTURE.md` "Audit process: {{TBD}}" | Short section in GAME_STANDARD or a new `AUDITS.md` |
| 13 | P3 | M | **No glossary.** VHP, effective VHP, Mana, the pool, the seed, cardVhp, staked vs free — and the three week-numbering schemes, which already caused confusion | — | New `GLOSSARY.md` (link from START_HERE) |
| 14 | P3 | I | **ARCHITECTURE's remaining blanks:** repository folder map, what the 15 workflows each do, the Block X recorder schedule, on-chain state | `ARCHITECTURE.md` (3 TBDs) | Fill in from the repo |
| 15 | P3 | M | **Data formats beyond vault files** — each game's `board.json` columns, `index.json`, Race `W###.json`, the `games-data` folders, `names.json` | LEADERBOARD_STANDARD covers shared columns only | A data-formats section, or one line per game in its file |
| 16 | P3 | C | **"New games launch on a Monday" (D-059) reads as a rule** in GAME_STANDARD, while the owner's later decisions are "announce when ready" with a Friday target (D-052, D-064). They're compatible — a game applied mid-week earns from the next Monday — but it isn't explained | `GAME_STANDARD.md` §4 | Reword: "a game starts earning on the Monday after it's applied" |
| 17 | P3 | I | **Two owner checklists** (TODOS.md and the claude.ai checklist artifacts) — which is the source of truth is still undecided | I-032 | Owner decision |
| 18 | P4 | I | **KOINOS unknowns:** Kondor on mobile, KOIN Vault on desktop, PoB and Nicknames on testnet, markets and community links | `KOINOS.md` (6 ❓) | Fill in when known |
| 19 | P4 | I | **About 30 decisions have no date** (marked ❓) | `DECISIONS.md` index | Date them from the archive where possible |
| 20 | P4 | M | **No version history** — contract versions, hashes and upload dates in one table (partly in ROADMAP → Done) | — | A "Releases" table in ROADMAP or ARCHITECTURE |
| 21 | P4 | M | **Growth plans have no documents:** non-intrusive ads (no adult content), the installable mobile app and guest play, the "Built on Koinos" section, the KOIN Vault developer request | FOUNDER_INTENT mentions them only | A short plan each when work starts |
| 22 | P4 | I | **CURRENT_STATE has no upkeep rule**, so it will go stale | `CURRENT_STATE.md` | Add "refresh after each launch step or weekly" to START_HERE |
| 23 | P4 | I ⚡ | **TODOS has items without due dates** (Kondor retest) | `TODOS.md` | Owner to set |

## What's in good shape
- **No open contradictions** in `DECISIONS.md` — all 25 are settled, and 76 decisions are recorded.
- **All 12 chat exports are filed**; nothing in the archive is unsorted.
- **Every game has a full eight-section file**, and the four standards, RULES, DEPENDENCIES and FOUNDER_INTENT have no blanks.
- Numbers agree across files: sponsor 25,000 KOIN / 5,000 a day; 2 + 1 free prizes; staked-only games; Survivor 16 Nov; public testnet only.

## Suggested order
1. **Before the weekend:** #1 (wallet procedure), #3 (keys and roles), #4 (who owns what).
2. **Before Friday's `game-add`:** #5 (launch runbook), #6 – #7 (quick fixes), #10 (sponsor).
3. **This week:** #2 (incident runbook), #8 (VISION), #9 (swap desk), #11 (scoring).
4. **Later:** #12 – #23.
