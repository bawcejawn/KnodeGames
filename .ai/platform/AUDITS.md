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

| # | Review | Commit | Prompt (Claude project) | Status |
|---|---|---|---|---|
| 1 | Race #155 post-merge (optional) | `9fc79b53` + `c1011e58` | `claude/race/REPOLENS-PR155-POSTMERGE-PROMPT.md` | optional |
| 2 | Hub C5 after-the-fact fix-check (#95, #111) | `main` | `claude/hub/REPOLENS-C5-FIXCHECK-PR95-PR111-PROMPT.md` | optional, P2 |

Done recently: Questions #152 fix-check #E-17 fixes → **#152 merged** (5 Nov); Vault v6.1 round 2 #E-16 **GO** (4 Nov); Race #155 #B-7 **GO**; Hub #142 fix-check **GO**; VHP ruler #B-6 re-check **GO** → #163 merged (5 Nov).

## 3. Open PRs, in merge order

| Order | PR | What | Waits on | Who merges |
|---|---|---|---|---|
| 1 | **#114** `vault-questions-60` @ `affbde0` | Vault v6.1 (60 a week, Questions on the shared rules, the bot closes weeks) | **The Mon 9 upload**; then the Vault chat's records PR and merging `main` into #114 (keeps its two settle-skip lines and #152's switch-over logic, now on `main`) | owner |
| 2 | **#141** `vault-standards-v61` | `VAULT_STANDARD` for game 1 | v6.1 live (any day after Mon 9); rebase on the 5 Nov docs sync (it touches the same lines) | owner, or library chat |

Merged 5 Nov: #152 (Questions shared rules, page and bot side), #163 (VHP ruler, off until turned on). Closed unmerged, kept for salvage: #50 (R-HUB-6).

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
| Vault #E-16 | watch | many week R−1 stakers and unsponsored settles: 10 per run may not reach everyone; #152's uncapped switch-over settles cover it | Vault chat | watch Mon 9–16 |

## 6. Where the reports are
`claude/<area>/` in the Claude project: `vault/`, `questions/`, `race/`, `blockx/`, `hub/`, `ruler/`, `sponsor/`; older reports in `claude/repo-history/`. The owner can ask the library chat for any of them.
