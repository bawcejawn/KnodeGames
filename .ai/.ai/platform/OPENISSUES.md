# Knode Games — Open Issues

> Purpose: Everything unresolved: bugs, unanswered questions, conflicts, things waiting on someone.
> Rule: When an issue is resolved, move it to "Closed" with the date and where the answer was recorded
> (usually a D-XXX entry in DECISIONS.md). Never delete an issue.
> Last updated: 2026-11-02
> Sources: `ROADMAP.md`, `.ai/archive/CHAT_KNOWLEDGE.md` (Questions chat), repo branch `picks`.

**Legend:** ✅ verified · 💬 chat only · ⚠️ conflict · ❓ unknown
**Priority:** P1 funds or security · P2 breaks a game or the site · P3 confusing or annoying · P4 nice to have

## Contradictions
Tracked in `DECISIONS.md` → Contradictions Register (C-01 to C-XX). Not duplicated here.

## Open
| ID | Priority | Area | Issue | Waiting on | Opened | Source |
|----|----------|------|-------|------------|--------|--------|
| I-001 | P1 | wallets | Wallet handovers: move ownership to a new hardware-wallet owner and set up a cold treasury. Owner and desk treasury are currently the same address (`1635QU…`) ✅ | owner | 2026-11-02 | 💬 D-013; target "this weekend" ❓ |
| I-002 | P1 | security | Give the go-ahead for the full platform audit | owner | 2026-11-02 | 💬 D-014 |
| I-003 | P2 | game 1 | Confirm `reward_rule_week_plus_one=3` is set on chain before the first v5 payout (Tue 10 Nov, 21:00 UTC) | owner | 2026-11-02 | 💬 D-010; not verified on chain |
| I-004 | P2 | site / wallet | Retest "+ Add another account" with the real Kondor extension (fix `80cef45` is live; create or import the 2nd account in Kondor first) | owner | 2026-11-02 | 💬 |
| I-005 | P2 | sponsor | Next sponsor version: guest prize claims and the L-3 fix. Blocked until the live sponsor version is confirmed (C-01) | sponsor + Vault v6 chats | 2026-11-02 | 💬 ⚠️ C-01 |
| I-006 | P3 | site / RPC | Read provider still on Armana (browser CORS failures seen). Consider moving to `api.koinos.io` — in `picks`, `app.js` and `swap.js` use Armana too, not only `header-wallet.js` | owner decision | 2026-11-02 | 💬 ⚠️ C-04 |
| I-007 | P3 | wallets | KOIN Vault picks its own payer, so its users can't use the Mana sponsor. Owner to send the message to the KOIN Vault developer | owner | 2026-11-02 | 💬 |
| I-008 | P3 | nodes | Delete old node basedir folders on or after Wed 4 Nov, 17:30 UTC, only if `heal.log` is clean | owner | 2026-11-02 | 💬 |
| I-009 | P3 | docs | Only the Questions chat is archived. Vault v6, Race, sponsor and new-game chats still need exporting into `CHAT_KNOWLEDGE.md` | owner | 2026-11-02 | |
| I-010 | P4 | GitHub | Delete the `diag-health` branch in the GitHub UI (AI proxy blocks branch deletion) | owner | 2026-11-02 | 💬 |
| I-011 | P4 | repo | Two stale Git worktrees are marked "prunable" (folder missing or moved): `C:\kg-combo-preview` and `C:\kprediction-vault` (branch `vault-v6`). Check that no Vault v6 work is only in that folder before cleaning up | owner | 2026-11-02 | ✅ `git worktree list` |

## Closed
| ID | Issue | Closed | Resolution / where recorded |
|----|-------|--------|-----------------------------|
| {{TBD}} | {{TBD}} | {{TBD: YYYY-MM-DD}} | {{TBD}} |
