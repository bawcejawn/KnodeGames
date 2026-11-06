# Knode Games — Audits and the Merge Queue

> **Purpose:** how code gets reviewed before it reaches players or funds (Repo Lens), and the one list of **open PRs, in merge order**, with what each waits on.
> **Last updated:** 2026-11-05 (fix-fast rules D-140; open findings list)
> **Private by rule:** audit **reports and prompts** stay in the Claude project (`claude/<area>/…`), never in this public repo. This page names them by id and path only.

## 1. Repo Lens, step by step
Repo Lens is the outside reviewer the owner runs. One review = one prompt, on one **exact commit**.

1. **The building chat finishes and pushes** the branch, with tests green, and says the commit in its session-end report.
2. **The library chat writes the prompt** into the Claude project: `claude/<area>/REPOLENS-<PR or topic>-PROMPT.md`. A prompt always names: the repo and branch, the **exact commit**, what changed, what to attack, the standards it must meet, and the report format (findings with ids, severity, failing test where possible).
3. **The owner sends it** to Repo Lens and pastes the report back to the building chat. The report is filed privately (`claude/<area>/AUDIT-*.md`).
4. **The building chat fixes** every Critical, High and Medium, or the owner accepts one as a recorded decision (D-xxx). Lows: fixed or listed.
5. **Fix-check:** a short second prompt (`…-FIXCHECK-PROMPT.md`) on the fixed commit. Repeat until **GO**.
6. **Merge** once checks are green and the verdict is GO (D-133). Contract upgrades then follow announce → 48 h → upload.

**Verdicts:** **GO** · **GO with fixes** (fix, no new review needed unless the owner asks) · **fix first** (fix, then fix-check).
**Severity:** Critical / High = funds, payouts or security · Medium = wrong result in a real case · Low = edge or clarity · Info.
**What always needs Repo Lens:** contract code (vault, Picks, Race picks, sponsor, Desk), anything that decides payouts (recorders' finals, vault results files, the bot's post / seal), the CI guard and workflows that can write data, new games before launch. Docs-only PRs don't.

## 2. Repo Lens queue (send in this order)

| # | Review | Commit | Prompt (Claude project) | Why this order |
|---|---|---|---|---|
| 1 | **Race #182** (paid set past 255 scores; bad vault folder held alone) | `race-paid-cutoff` @ `bf372a02` | `claude/race/REPOLENS-PR182-PROMPT.md` | payout code; before the first paid close Mon 16 |
| 2 | **Hub #181** (guest play first, tap targets) | `hub-guest-first` @ `f587028d` | `claude/hub/REPOLENS-GUEST-FIRST-PROMPT.md` | touches the guest key flow every new player sees |
| 3 | **Run a Node #173 fix-check** | `run-node` @ `f68aa2f4` | `claude/node/REPOLENS-PR173-FIXCHECK-PROMPT.md` | NO-GO findings fixed; then #179 |
| 4 | **Run a Node #179** (one-node self-heal) | `run-node-heal` @ `2ae04c66` | `claude/node/REPOLENS-PR179-PROMPT.md` | scripts people run on their PCs |
| 5 | **Vault #178** (producer key backup / restore) | `vault-producer-keys` @ `fbbeff68` | Vault chat writes it (D-140) | handles producer keys |
| 6 | **Vault #177** (plain-language alert summaries) | `vault-alert-summaries` @ `27d60caf` | Vault chat writes it (D-140) | touches six workflows |
| 7 | **Golf v2** PR #187 (fix-check, if the first review ran) | `golf-v2` | `claude/golf/REPOLENS-GOLF-V2-PROMPT.md`, then `claude/golf/REPOLENS-GOLF-V2-FIXCHECK-PROMPT.md` | a new paying game |
| 7b | **Bracket #186 fix-check 3** (#E-3; fix-check 2 NO-GO, all fixed) | `kg-09-bracket` @ `3b46546f` | `claude/bracket/REPOLENS-E3-FIXCHECK3-PROMPT.md` | a new paying game (launches on the kit, D-160) |
| 7c | **Fantasy #188 fix-check** | `fantasy` | `claude/fantasy/REPOLENS-FANTASY-FIXCHECK-PROMPT.md` | a new paying game |
| 7d | **Hub #185 live stats** (before `STATS_ENABLED`) | `hub-live-stats` | `claude/hub/REPOLENS-LIVE-STATS-PROMPT.md` | a new workflow with write access |
| 7e | **Ruler v2.1** (after A′ is built) | `vhp-ruler-v21` | `claude/ruler/REPOLENS-V21-PROMPT.md` | the shared handicap |
| 8 | Block X #180 handover tool (before its first mainnet use) | `main` | `claude/blockx/REPOLENS-PR180-HANDOVER-PROMPT.md` | owner change on Picks |
| 9 | Block X #175 post-merge (optional) | `main` | `claude/blockx/REPOLENS-PR175-POSTMERGE-PROMPT.md` | merged already; a second look |
| 10 | Race #155 post-merge, Hub C5 after-the-fact (optional) | `main` | `claude/race/REPOLENS-PR155-POSTMERGE-PROMPT.md`, `claude/hub/REPOLENS-C5-FIXCHECK-PR95-PR111-PROMPT.md` | optional |

Done recently: Questions #152 fix-check #E-17 fixes → **#152 merged** (5 Nov); Vault v6.1 round 2 #E-16 **GO** (4 Nov); Race #155 #B-7 **GO**; Hub #142 fix-check **GO**; VHP ruler #B-6 re-check **GO** → #163 merged (5 Nov).

## 3. Open PRs, in merge order

| Order | PR | What | Waits on | Who merges |
|---|---|---|---|---|
| 1 | **#182** Race | paid set past 255; bad folder held alone | Repo Lens (queue 1) | library on GO |
| 2 | **#181** Hub | guest play first, tap targets | Repo Lens (queue 2) | library on GO |
| 3 | **#173** then **#179** Run a Node | the guide, then the one-node self-heal | fix-check / review (queue 3–4) | library on GO |
| 4 | **#178**, **#177** Vault | key backup scripts; alert summaries | Repo Lens (queue 5–6) | library on GO |
| 4b | **#187** Golf, **#186** Bracket, **#188** Fantasy | the next three games | each its review (queue 7–7c) | library on GO; then the owner's launch steps |
| 4c | **#185** Hub live stats | hourly stats file + panel | Repo Lens (queue 7d) | library on GO; owner sets `STATS_ENABLED` |
| 5 | **#114** Vault v6.1 | the upgrade | **Monday's upload**, then the records PR and `main` merged in | owner |
| 6 | **#141** | `VAULT_STANDARD` for game 1 | v6.1 live | owner or library |

Merged 5 Nov: #183 (welcome page, free play first), #175 (Block X fun rounds, Mon 00:00 final), #180 (Picks handover tool), #152 (Questions shared rules, page and bot side), #163 (VHP ruler, off until turned on). Closed unmerged, kept for salvage: #50 (R-HUB-6).

## 4. Fixing fast (D-140)
- **One pass:** the building chat fixes every Critical, High and Medium **in one PR, the same session**, each with the review's failing test or a new one. Lows go in the same pass unless the owner defers them.
- **The chat writes its own fix-check prompt** (exact commit, finding ids, the tests that prove each fix) and saves it to `claude/<area>/`; the owner sends it the same day.
- **No drip-feeding:** don't open a second PR for the rest of a review's findings, and don't wait for a reply before fixing what's clearly broken.
- **Can't fix one?** Say so in the session-end report the same day, with the reason and what's needed (an owner decision becomes a D-xxx).
- **Accepted as-is** needs the owner's word and is listed below.

## 5. Open findings (until closed)
| Review | Finding | What | Owner | Status |
|---|---|---|---|---|
| Ruler #E-14 | M-1 "stronger" | the publish job also re-reads burns, VHP events and balances | owner to decide | open (later) |
| Ruler | L-5, L-6 | one backend under two names, no response-size limit; an undecodable block stops the ruler | Ruler chat | open |
| Race #B-7 | B7-3, B7-5 | deadline from run start; Sunday results not re-checked | owner | accepted as-is (5 Nov) |
| Bracket #E-3 fix-check 2 | PK-1 (High), PK-2, R-1, F9-1, S-1, W-1, FL-1, P-2, I-1, T-1 | picks two-run, late picks, release can't finalize, per-week hold, open-request lock | Bracket chat | fixed at `3b46546f` 6 Nov; fix-check 3 pending |
| Vault #E-16 | watch | many week R−1 stakers and unsponsored settles: 10 per run may not reach everyone; #152's uncapped switch-over settles cover it | Vault chat | watch Mon 9–16 |

## 6. Where the reports are
`claude/<area>/` in the Claude project: `vault/`, `questions/`, `race/`, `blockx/`, `hub/`, `ruler/`, `sponsor/`; older reports in `claude/repo-history/`. The owner can ask the library chat for any of them.
