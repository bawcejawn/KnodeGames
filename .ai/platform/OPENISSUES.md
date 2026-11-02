# Knode Games — Open Issues

> Purpose: Everything unresolved: bugs, unanswered questions, conflicts, things waiting on someone.
> Rule: When an issue is resolved, move it to "Closed" with the date and where the answer was recorded
> (usually a D-XXX entry in DECISIONS.md). Never delete an issue.
> Last updated: 2026-11-02
> Sources: `ROADMAP.md`, `.ai/archive/CHAT_KNOWLEDGE.md` (Questions, Vault, Hub and Race chats), repo branches `picks` and `main`.

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
| I-007 | P3 | wallets | KOIN Vault picks its own payer, so its users can't use the Mana sponsor. Owner to send the message to the KOIN Vault developer — also ask whether the dapp name can change from "Knode" to "Knode Games" (D-033, checklist t27) | owner | 2026-11-02 | 💬 |
| I-008 | P3 | nodes | Delete old node basedir folders on or after Wed 4 Nov, 17:30 UTC, only if `heal.log` is clean | owner | 2026-11-02 | 💬 |
| I-009 | P3 | docs | Only the Questions chat is archived. Vault v6, Race, sponsor and new-game chats still need exporting into `CHAT_KNOWLEDGE.md` | owner | 2026-11-02 | |
| I-010 | P4 | GitHub | Delete the `diag-health` branch in the GitHub UI (AI proxy blocks branch deletion) | owner | 2026-11-02 | 💬 |
| I-014 | P3 | bot / testnet | No bot support for the Koinos Foundation testnet copy. Planned: a flag that reads `testnet/vault.json`, added on `main` after v6 | Vault chat | 2026-11-02 | 💬 |
| I-015 | P3 | RPC | The `vault-v6` folder's `deployment.json` still names `api.koinos.io`; consider Armana | owner decision | 2026-11-02 | 💬 Vault chat ⚠️ C-04 |
| I-016 | P2 | games | Combo Card (8) and Last Node Standing (13): mainnet clearance unknown — needed to announce them with games 2, 7, 9 | Combo Card and Last Node chats | 2026-11-02 | 💬 |
| I-017 | P4 | testnet | The testnet copy's owner key (`testnet-v6/keys.json`, gitignored) was held only in the Vault chat's sandbox. If that sandbox is gone, the copy can't be administered | owner | 2026-11-02 | 💬 |
| I-019 | P2 | admin / vault | Admin page vault buttons answer "Unknown command" until `vault-v6` is merged into `picks`. Verified: PR #51 is on `main` but not in `picks` ✅. This week's `game-add` / `game-apply` steps depend on it (or must run another way) | Vault + Hub chats | 2026-11-02 | 💬 Hub, ✅ repo |
| I-020 | P3 | names | PN-30: the @name mint hasn't been confirmed end to end with a real wallet. Owner was retrying "primeproducer" after PR #49; result not recorded | owner | 2026-11-02 | 💬 Hub |
| I-021 | P3 | sponsor | Sponsor v3 would still pay for a `move_stake` sent outside the site (D-027). Blocking it on chain needs a tiny per-action cap | owner decision | 2026-11-02 | 💬 Hub |
| I-022 | P1 | security / CI | PN-8 / C2-4: the CI guard is regex-based and misses rare YAML spellings (indent digits, tags, anchors). Add a YAML parser before anyone else gets write access | Hub chat | 2026-11-02 | 💬 Hub |
| I-023 | P4 | names | Info: a node that is slow once is skipped for the whole names run (C2-3); nickname updates freeze near 1 MB (C1-7) | — | 2026-11-02 | 💬 Hub |
| I-024 | P4 | stake panel | The "Connect wallet after connecting" race is fixed by reasoning (generation counter) and was never reproduced | — | 2026-11-02 | 💬 Hub |
| I-025 | P3 | CI | When `picks` merges `main`, keep both testnet-wallet exceptions in the guard tests | whoever merges | 2026-11-02 | 💬 Hub |
| I-026 | P4 | names / CI | Legacy name-claim workflow, issue template and claim CLI still exist; `docs/NAMES.md` still documents them. Removing them drops the `issues` permissions | Hub chat | 2026-11-02 | 💬 Hub |
| I-027 | P3 | site copy | Race page and `index.html` Race rules still call the vault "not yet live"; free-prize wording across the site needs updating | Race chat | 2026-11-02 | 💬 Race ⚠️ C-10 |
| I-028 | P3 | stake panel | The "Staked board" label is based on `peak_stake`: a wallet that withdrew below the minimum mid-week gets no bucket share and no free prize. The shared panel should explain this | Hub chat | 2026-11-02 | 💬 Race |
| I-029 | P4 | Race / scale | The board reads `get_game_player` once per wallet per run across All time — fine now, grows with players | Race chat | 2026-11-02 | 💬 Race |
| I-030 | P3 | Race / RPC | If `RPC_CHECK` is turned off, stakes are classified on one node only, with no warning | Race chat | 2026-11-02 | 💬 Race |
| I-031 | P3 | merges | Block X (on `picks`) changes the same Race files (`bot/race.ts`, `race.yml`, `tests/audit/race-recorder.test.mjs`). The Race chat resolves the conflicts by hand when Block X is ready to merge | Race + Block X chats | 2026-11-02 | 💬 Race |
| I-032 | P3 | docs | Two owner checklists exist: `.ai/platform/TODOS.md` and the Race chat's checklist artifact (with its own `tasks` database). Decide which one is the source of truth (D-002 suggests the repo) | owner | 2026-11-02 | 💬 Race |

## Closed
| ID | Issue | Closed | Resolution / where recorded |
|----|-------|--------|-----------------------------|
| I-012 | Five stake-panel fixes | 2026-11-02 | Done in PR #46 ✅ merged on `main` (busy-Mana message and 0.5 cap, `weightFor`, wallet race, refresh after actions, 2nd-place prize) |
| I-013 | Three admin-page fixes | 2026-11-02 | Done in PR #43 ✅ merged into `picks` (season field, local-node wording, `stake-testnet.html`) |
| — | Race chat: "PR #44 (status bar) not merged yet" | 2026-11-02 | Out of date: PR #44 ✅ merged on `main`; `#stake-badge` is on `race.html` |
| I-011 | Stale worktrees `C:\kg-combo-preview` and `C:\kprediction-vault` | 2026-11-02 | **Corrected, not an issue.** "Prunable" was an artifact of the AI's sandbox, which can't see Windows `C:\` paths. The Vault chat confirms `C:\kprediction-vault` is in use and frozen (D-025). Do not clean up either worktree. |
| I-018 | `.ai` library nested as `.ai/.ai/…` on `main` | 2026-11-02 | Fixed by the Vault chat at 13:03 PT (commit `30a5d90`) ✅ |
| — | Vault chat: `picks-data/deployment.json` showing as deleted in `C:\kprediction` | 2026-11-02 | Not seen: `git status` on 2026-11-02 shows no deleted files on `picks` ✅ |
