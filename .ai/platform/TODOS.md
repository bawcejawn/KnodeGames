# Knode Games — To-Dos

> Purpose: The owner's action list — what to do today, this week and later.
> Rule: Tick items off, don't delete them; move finished items to "Done" with the date.
> Link each item to its issue or decision where one exists (I-XXX in OPENISSUES.md, D-XXX / C-XX in DECISIONS.md),
> so the details live in one place.
> Last updated: 2026-11-02
> Times are shown in UTC and in your time (PT).

**Priority:** P1 funds or security · P2 breaks a game or the site · P3 confusing or annoying · P4 nice to have

## Today
- [ ] Answer C-02: which sponsor caps are live — the chat's 1,000-a-day set or the code's 5,000-a-day set? — P1 — C-02, C-03, D-008
- [ ] Decide when Block X goes public (not announced to players yet), then step 8 — apply Block X on the Picks contract: `npm run picks -- apply 2 --send --mainnet`, then `npm run picks -- status --mainnet` must show 1 change (allowed since Sun 1 Nov, 1:23 PM PT; not reported done) — P2 — I-040
- [ ] Before Block X is published: `npm run sponsor -- mana-report` on mainnet; raise the pick row if mainnet is more than ~1.5× testnet — P2 — D-038
- [ ] Check that the "Knode question release" task's NextRunTime shows 3:45 AM local (11:45 UTC) after the 1 Nov clock change — P2 — D-047
- [ ] Tell the Hub the vault upgrade is done, so it checks the staking hub, bars and panels on mainnet — P2
- [ ] Ask the Vault and Hub chats to get `vault-v6` merged into `picks` (or confirm another way to run `game-add`) before Friday — P2 — I-019
- [ ] Run the push block so `main` gets the updated docs — P3

## This Week
- [ ] Ask the Combo Card and Last Node Standing chats whether they're cleared for mainnet — P2 — I-016
- [ ] `game-add` games 2, 7 and 9 (`--staked --free --send`), plus 8 and 13 if cleared — P2 — D-024 — due Fri 6 Nov, 4 PM PT
- [ ] Right after the first `game-add`: switch the sponsor to the vault — `npm run sponsor -- status`, copy the caps exactly, run the `config` preview (must show "vault (v6) live: no → yes" with caps unchanged), then `--send`, then `status` again — P1 — C-02 (a plain `config` resets caps)
- [ ] `game-apply` each game 48 h after announcing — P2 — due before Sun 8 Nov, 4 PM PT
- [ ] Merge the Block X launch PR (`picks` → `main`) when the Block X chat opens it; then send the Hub the PR link and confirm the phone-width bar screenshot reached it — P2
- [ ] Optional (Repo Lens asked): on the PC, `npm ci --ignore-scripts && npm run test:audit:serial` — P4
- [ ] Retry creating an @name on `names.html` and report the result — P3 — I-020
- [ ] Check the Race status badge on the live Race page at phone width (PR #44 is already merged) — P4
- [ ] Delete old node basedir folders, only if `heal.log` is clean — P3 — I-008 — on or after Wed 4 Nov, 17:30 UTC (9:30 AM PT)
- [ ] Retest "+ Add another account" with the real Kondor extension — P2 — I-004 — due {{TBD}}
- [ ] Confirm which sponsor version is live on chain (v2 or v3) — P2 — C-01 (unblocks I-005) — due {{TBD}}
- [ ] Wallet handovers per `docs/WALLETS.md`: new owner on a hardware wallet, cold treasury — P1 — I-001, D-013 — target this weekend ❓ (7–8 Nov)
- [ ] Remove the old operator key (`1JSTwo…`) from `.env` and move its leftover KOIN to the owner — P1 — I-045
- [ ] Top up the bot wallet `1HsM33…` to ~50 KOIN and confirm its Mana — P3 — I-046
- [ ] Watch `node\release-kick.log` and `node\heal.log` for the first few days — P3
- [ ] Confirm `reward_rule_week_plus_one=3` on chain — P2 — I-003, D-010 — due before Tue 10 Nov, 21:00 UTC (1:00 PM PT), the first v5 payout

## Later
- [ ] Give the go-ahead for the full platform audit — P1 — I-002, D-014
- [ ] Decide the site's read RPC (Armana or `api.koinos.io`) — P3 — I-006, C-04
- [ ] Send the message to the KOIN Vault developer — P3 — I-007
- [ ] Export the Vault v6, Race, sponsor and new-game chats into `CHAT_KNOWLEDGE.md` — P3 — I-009
- [ ] Confirm the GitHub repo name (`KnodeGames` or `Knode`) — P4 — C-06
- [ ] Explain the 21:00 UTC week boundary — P4 — C-08
- [ ] Delete the `diag-health` branch in the GitHub UI — P4 — I-010
- [ ] Survivor: announce Sat 7–Fri 13 Nov, `game-apply` Mon 9–Sun 15 Nov — P2 — D-020
- [ ] After the first vault close (Mon 16 Nov, 12:00 UTC / 4:00 AM PT): check status, the buckets, the free prizes, and collect the fee with `claim-fee-vhp all` — P1
- [ ] Then Fantasy, Golf, Combo and Last Node as each clears audits — P3
- [ ] Carry the Vault chat's project docs into `.ai/`: `claude/vault-v6-live.md`, `claude/vault-v6-testnet-results.md`, `claude/handoff-*.md`, `claude/audit-vault-v6-*`, `docs/UPGRADE-V6.md`, `docs/V6-PLAN.md` — P3 — I-009

- [ ] Decide launch pace and order (C-14) and Survivor's type (C-13) — P2
- [ ] Decide which owner checklist is the source of truth (I-032) — P3
- [ ] Before game 7 prizes: decide B1-2 (I-034), B1-3 free-prize farming (I-035), and back-fill vs "no prize" for not-final weeks (I-033) — P1
- [ ] Step 10: a full day after Block X launches, set per-action Mana limits (`mana-report --save`, `site-limits --send`, a PR, `config --send`); again a day after the sponsor's vault switch (`claude/handoff-sponsor-v6-day.md`) — P3
- [ ] Combo launch: Picks v2 upgrade (see ROADMAP), then raise the pick row to 0.25 and check with `mana-report` — P3 — D-038
- [ ] Decide `sponsor-limit 0` for the game/vault contract (stop it paying Mana for others) — P2 — I-044
- [ ] Recompute the daily Mana budget from `manaByDay` and `npm run sponsor -- status` after a week of play (`claude/mana-budget.md`) — P3
- [ ] Possibly already done ❓: compare `npm run bot -- status` with `before-upgrade.txt`; check the first "Kpred bot" run after v5 was green — P4
- [ ] Optional: decide the on-chain `move_stake` sponsor cap (I-021); pick retention features (see ROADMAP) — P4
- [ ] From the Race chat's owner checklist: empty the old bot and test wallets (C-11); pin the Desk node key; clean up the stale folder/branch (which one ❓); move the seed and Desk owner (⚠️ C-15); launch announcement; analytics decision; ads and the SwarmTales listing — P3
- [ ] Carry the Hub and Race chats' project docs into `.ai/`: `claude/launch-order.md`, `claude/stake-panel.md`, `claude/producer-names.md`, `claude/handoff-status-bar-testnet.md`, `claude/names-fixcheck*-prompt.md`, `claude/audit-names-prompt.md`, `claude/domain-knodegames.md`, `claude/site-at-root.md`, `claude/admin-page.md`, `claude/race-vault.md`, `claude/owners-race.md`, `claude/builds/02-hub-and-race-show.md`; repo `docs/NAMES.md`, `docs/ADMIN.md`, `race/README.md` (vault results section); Block X: `claude/blockx/FIXCHECK-PROMPT.md`, `claude/blockx/SPONSOR-TESTNET.md`, `claude/blockx/README.md`, repo `docs/blockx/MAINNET-LAUNCH.md`, `docs/blockx/TESTNET-RESULTS.md`, `docs/history/AUDIT-2026-10-28-repolens-blockx.md` — P3 — I-009

## Waiting on Someone Else
| Item | Waiting on | Since | Link |
|------|------------|-------|------|
| Next sponsor version: guest prize claims and the L-3 fix | sponsor + Vault v6 chats (after C-01) | 2026-11-02 | I-005 |
| Verify staking on mainnet after v6 | Hub chat (after you tell it) | 2026-11-02 | — |
| Remove the legacy claim workflow; add a YAML parser to the CI guard | Hub chat | 2026-11-02 | I-026, I-022 |
| Update Race page and home-page rules for the live vault | Race chat | 2026-11-02 | I-027 |
| Merge `picks` into `main` with Race files resolved when Block X is ready; weekly check of `vault/W<week>.json` and `race.yml` runs | Race chat | 2026-11-02 | I-031 |
| Set `PINNED_PICKS` to `1LmgqB…`, record Repo Lens round 11, open the Block X launch PR (`picks` → `main`) after game 2 is applied | Block X chat | 2026-11-02 | I-040 |
| v6-day fixes: `GAME_ABI` → `kpred-v6.koilib.json`, drop the early return, fail-fast v6 check, a 50-player v5-chain test, a fix-check | Block X chat (told 2 Nov) | 2026-11-02 | I-033, I-036 |
| After launch: B1-4, B1-6, B1-7, B1-8, then a short fix-check | Block X chat | 2026-11-02 | I-037, I-038 |
| Every new game page mounts `KStake.badge` at the top of `<main>`, full panel lower | each game chat | 2026-11-02 | D-031 |
| Bot support for the testnet copy (`testnet/vault.json`) | Vault chat | 2026-11-02 | I-014 |
| Ship V4, B1-1, B1-5 | Block X chat (after you tell it) | 2026-11-02 | — |

## Done
| Item | Done | Link |
|------|------|------|
| `.ai/` library created | 2026-11-02 | — |
| Platform docs generated from the Questions chat; contradictions logged | 2026-11-02 | DECISIONS.md → Contradictions |
| `OPENISSUES.md` filled | 2026-11-02 | OPENISSUES.md |
| C-09 answered: the vault is the game contract | 2026-11-02 | C-09 (from the Vault chat) |
| `C:\kprediction-vault` check — answered by the Vault chat; folder in use | 2026-11-02 | I-011 |
| Clean up stale Git worktrees — **cancelled**, not needed | 2026-11-02 | I-011 |
| Vault v6 uploaded (Mon 2 Nov, 02:33 UTC) | 2026-11-02 | D-023 |
| `.ai/.ai/` nesting on `main` fixed (by the Vault chat) | 2026-11-02 | I-018 |
| Vault chat knowledge filed into the platform docs | 2026-11-02 | — |
| Five stake-panel fixes (PR #46) and three admin fixes (PR #43) | 2026-11-02 | I-012, I-013 |
| Race status badge merged (PR #44) | 2026-11-02 | — |
| Repo name confirmed: `bawcejawn/KnodeGames` | 2026-11-02 | C-06 |
| Block X chat knowledge filed; sponsor version and caps settled | 2026-11-02 | C-01, C-02 |
| Block X chat told the vault upload is done (it ships V4, B1-1, B1-5) | 2026-11-02 | owner |
| Swap Desk chat knowledge filed; C-04, C-05, C-11, C-17 settled | 2026-11-02 | — |
| Real swap tested on the site (3,000 VHP) | ≤ 2026-11-02 | Questions chat |
| Stale copy `C:\Users\alcat\repos\Knode` deleted | ≤ 2026-11-02 | Questions chat |
| Set a desk daily payout cap — **cancelled** (no cap, D-007) | 2026-11-02 | C-17 |
