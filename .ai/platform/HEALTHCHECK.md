# Knode Games — Library Health Check

> **Purpose:** a CTO / architect review of the whole `.ai/` library and what it says about the platform: strengths, weaknesses, missing information, three quality scores and the top 10 priorities. A **dated snapshot**; for the whole system at a glance read [`../../STATUS.md`](../../STATUS.md); for live status read `LAUNCH_BOARD.md`, `CALENDAR.md` and `AUDITS.md`.
> **Reviewed:** Fri 6 Nov 2026, ~05:00 UTC (Thu 5 Nov 9 PM PT), on `main` after PR #236. Every file in `.ai/` outside `archive/`: 54 files, ~790 KB.
> **Previous checks:** `../archive/2026-11-05/HEALTHCHECK-2026-11-05-afternoon.md` (8.5 / 8 / 8), `…-morning.md` (8.5 / 7.5 / 8), `…/HEALTHCHECK-2026-11-04-evening.md` (7 / 7 / 5.5).

**Open load:** 66 open issues · 51 owner to-dos · 78 chat requests (75 open) · 19 debt items · 14 documentation gaps · 170 decision numbers (D-001 – D-170; 168 entries: D-152 lands with #182, D-166 with #216) · 113 ❓ marks · 16 open PRs · 43 remote branches (222 old ones deleted 5 Nov).

## 1. Current strengths
- **Funds safety is designed, written and checked on chain.** Only the vault holds stakes; stakes are always withdrawable; a withdrawals-only build is pinned per vault version. v6.1 was announced on chain with the reviewed build (`11043e1f…`), replacing an older announcement that would not have matched. `CONTRACTS.md` registers every live contract, hash, timelock and owner.
- **One map, kept current.** `STATUS.md` (top of the repo) is linked first from every entry point; the session-end process requires updating it; it was refreshed tonight (#228).
- **A complete, consistent standards set.** Game, contract, new-game, week, recorder, kit, leaderboard, vault, token and go-live standards; onboarding docs now point every chat to the kit and D-157 – D-160 (#228).
- **Payout rules unified and locked.** Who gets paid (D-152) and the one free-prize tie rule (D-159, with the owner's three answers) are written in every standard; games that differ are filed (I-103, I-104) and the Race already fixed its copy in #182.
- **Owner-in-the-loop works in practice.** "Any rule ambiguity stops the build" (D-160) was used three times tonight (free-prize score time, the ruler's yardstick, the ruler's marks) and each answer became a decision the same hour (D-159, D-165, D-170).
- **No double work by design.** Every new game launches on the Shared Game Kit (D-158, D-160); Golf is held for it (D-161); the kit's core is in review (#210).
- **Repository hygiene.** 222 merged or abandoned branches deleted with a lease check (nothing lost; restore list in the Claude project); public files keep roles and addresses only, key details stay private.

## 2. Current weaknesses
- **Decision numbers collide between chats.** Twice tonight a chat used a number already taken on `main` (#216 "D-161", #222 "D-162"). The library renumbered (#225, #226), but #216 still carries "D-161" until the Race chat renames it.
- **The library still trails the owner by hours on some actions.** The v6.1 announcement was only ticked in `TODOS.md`, `CALENDAR.md` and `CONTRACTS.md` with this check.
- **The review queue is the bottleneck:** 16 open PRs; the three with deadlines (#203 Questions by Sun 15, #182 Race before Mon 16, #210 the kit) all wait on a Repo Lens send.
- **Work continues on held items.** Golf has two more open PRs (#218 go-live, #234 fixes) while D-161 holds it; fixes are allowed, but a go-live PR open on a held game invites a wrong merge.
- **Big files keep growing:** `DECISIONS.md` 140 KB (+10 KB today), `CHAT_REQUESTS.md` 51 KB, `ARCHITECTURE.md` 47 KB, `VHP_RULER.md` 39 KB.
- **References to missing files remain** (10 mentions of `docs/VHP-STANDARD.md`, `vhp-standard.js`, `bot/vhp-chain.ts`) and the ❓ count hasn't moved (113).
- **Architecture risks still open (recorded):**
  - five hand-built recorders until the kit migrations;
  - the owner key is hot until the handover (Tue 10);
  - the bot pushes data to `main`, and no PR check is required (TD-03, A2, A3);
  - the whole repo is served as the website (R-HUB-14; allow-list proposed 6 Nov);
  - one PC runs all nodes (D-147);
  - the ruler pays nothing until its re-judged sims and fix-check are GO (D-111, D-170);
  - the full platform audit hasn't run (D-102).
- **The weekly review hasn't run yet** (first: Tue 10 Nov).

## 3. Missing information
| Missing | Where it should live | Why it matters |
|---|---|---|
| **A decision-number rule** (only the library assigns D-numbers; chats propose "D-new") | `SESSION_END_PROCESS.md`, `AI_CHAT_STARTER.md` §1 | stops tonight's collisions |
| **Data formats** (week files, `index.json`, `board.json`, pending / final, HOLD / RELEASE, vault file, prize files) | `standards/DATA_FORMATS.md` | the kit implements them now; payouts depend on them |
| **The Pages allow-list** (patterns proposed 6 Nov) | `REPO_MAP.md` and the Hub chat's R-HUB-14 | internal files are downloadable from the site |
| **Each game's "score time"** for the free-prize tie-break (D-159) | each game file (R-ALL-12) | written for Questions and the Race only |
| **Swap Desk** page (rules, fee, treasury, liquidity, its node) | `platform/SWAP_DESK.md` | the only funds-holding product without one |
| **Desk node rebuild; stale `docs/MIGRATION.md`** | `RECOVERY.md` | recovery after losing the PC |
| **Measurable targets** (players a week, VHP staked) | `FOUNDER_INTENT.md` | the north star can't be tracked |

## 4. Scores (out of 10)
| Area | Score | Was (5 Nov afternoon) | Why |
|---|---|---|---|
| **Documentation quality** | **8.5** | 8.5 | gained: onboarding on the kit, every owner ruling filed the same hour, v6.1 recorded; held back by number collisions, missing `DATA_FORMATS.md`, references to missing files, 113 ❓ |
| **Architecture quality** | **8** | 8 | the kit's core is built and in review, the ruler's gaming hole is closed (E) with settled marks, the free-prize rule is one; held back until shipped: hand-built recorders, open payout mismatches (Block X, Bracket), hot owner key, bot pushes to `main`, whole-repo site, one PC, no full audit |
| **Organization quality** | **8.5** | 8 | branches 265 → 43, onboarding and status current, held items labelled; held back by 16 open PRs, four very large files, decision-number collisions |

**To reach 10:** documentation — the decision-number rule, `DATA_FORMATS.md`, `SWAP_DESK.md`, clear the missing references and ❓; architecture — merge the kit and move every game onto it, fix I-103, then ARCHITECTURE A1 – A10 (cold keys, a required CI check, data off `main`, the Pages allow-list, tagged releases, a standby machine, the full audit); organization — clear the PR queue, retire `ROADMAP.md`, move done rows out of `CHAT_REQUESTS.md`, split `ARCHITECTURE.md`.

## 5. Top 10 priorities
| # | Priority | Who | When |
|---|---|---|---|
| 1 | **Vault v6.1 upload** Mon 9 from 9:00 AM PT → pin `04c27c1a…` → handover 4a; accepts Tue 10; merge #114, then #141 | Owner, Vault chat, Library | Mon 9 – Tue 10 |
| 2 | **Repo Lens #203** (Questions recorder) → merge by Sun 15; hard limit Thu 26 Nov | Owner, Questions chat | now |
| 3 | **Repo Lens #182** (Race payouts, I-104 fixed) → merge before Mon 16; then #216 (rename "D-161" → D-166, contract review) | Owner, Race chat | now |
| 4 | **Repo Lens #210** (kit core, #B-12 fix-check) → merge; then the ports of Fantasy, Golf, Bracket and Questions' #203 | Owner, Architecture chat | this week |
| 5 | **VHP ruler:** re-judge sims 1 and 8 on D-170's marks, Repo Lens E fix-check, then the PR | Ruler chat, owner | this week |
| 6 | **Decision-number rule:** only the library assigns D-numbers; chats write "D-new" in PRs and handoffs | Library | next docs PR |
| 7 | **Clear the rest of the queue:** #177 / #178 (Vault prompts first), #231 play-first home page, #232 Combo limits, #235 sponsor register-key; keep #218 / #234 / #187 unmerged under D-161 | Owner, chats | this week |
| 8 | **Security architecture:** cold keys Tue 10; Pages allow-list (R-HUB-14); a required CI check (A2); data off `main` (A3) | Owner, Hub, Architecture | Nov |
| 9 | **Write the missing references:** `DATA_FORMATS.md`, `SWAP_DESK.md`, each game's score time (R-ALL-12); fix the 10 references to missing files | Library, game chats | this week |
| 10 | **Slim the library:** retire `ROADMAP.md`, move done rows out of `CHAT_REQUESTS.md`, split `ARCHITECTURE.md`; the first weekly review Tue 10; then the full platform audit (D-102) | Library, owner | Tue 10, then after the core |
