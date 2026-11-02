# Knode Games — Open Issues

> Purpose: Everything unresolved: bugs, unanswered questions, conflicts, things waiting on someone.
> Rule: When an issue is resolved, move it to "Closed" with the date and where the answer was recorded
> (usually a D-XXX entry in DECISIONS.md). Never delete an issue.
> Last updated: 2026-11-02
> Sources: `ROADMAP.md`, `.ai/archive/CHAT_KNOWLEDGE.md` (Questions and Vault chats), repo branches `picks` and `main`.

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
| I-012 | P2 | Hub / stake panel | Five stake-panel fixes sent to the Hub: (1) `claimable()` must return `gw.prize_second` for 2nd place even when `first_n = 0`; (2) "Last week: new" shows for weeks that paid — mirror `weightFor` (needs `game_object` `next_stake` 13 and `next_week` 14); (3) no re-render after a wallet connects; (4) status bar and "Where to stake" don't refresh after an action; (5) testnet wallet's 1 tKOIN Mana cap hits code 104 on back-to-back actions — lower to ~0.5 and add a "wait a minute" message | Hub chat | 2026-11-02 | 💬 Vault chat |
| I-013 | P3 | Hub / admin page | Three admin-page fixes (PR #43): (1) "Add a game" needs a season field (Survivor uses `--season 2`); (2) "Vault v6 trial" buttons (`--testnet`) reach the local Harbinger node, not the testnet copy, and the copy's owner key isn't in `.env.testnet`; (3) wording "testnet/stake.html" → `stake-testnet.html` | Hub chat | 2026-11-02 | 💬 Vault chat |
| I-014 | P3 | bot / testnet | No bot support for the Koinos Foundation testnet copy. Planned: a flag that reads `testnet/vault.json`, added on `main` after v6 | Vault chat | 2026-11-02 | 💬 |
| I-015 | P3 | RPC | The `vault-v6` folder's `deployment.json` still names `api.koinos.io`; consider Armana | owner decision | 2026-11-02 | 💬 Vault chat ⚠️ C-04 |
| I-016 | P2 | games | Combo Card (8) and Last Node Standing (13): mainnet clearance unknown — needed to announce them with games 2, 7, 9 | Combo Card and Last Node chats | 2026-11-02 | 💬 |
| I-017 | P4 | testnet | The testnet copy's owner key (`testnet-v6/keys.json`, gitignored) was held only in the Vault chat's sandbox. If that sandbox is gone, the copy can't be administered | owner | 2026-11-02 | 💬 |

## Closed
| ID | Issue | Closed | Resolution / where recorded |
|----|-------|--------|-----------------------------|
| I-011 | Stale worktrees `C:\kg-combo-preview` and `C:\kprediction-vault` | 2026-11-02 | **Corrected, not an issue.** "Prunable" was an artifact of the AI's sandbox, which can't see Windows `C:\` paths. The Vault chat confirms `C:\kprediction-vault` is in use and frozen (D-025). Do not clean up either worktree. |
| I-018 | `.ai` library nested as `.ai/.ai/…` on `main` | 2026-11-02 | Fixed by the Vault chat at 13:03 PT (commit `30a5d90`) ✅ |
| — | Vault chat: `picks-data/deployment.json` showing as deleted in `C:\kprediction` | 2026-11-02 | Not seen: `git status` on 2026-11-02 shows no deleted files on `picks` ✅ |
