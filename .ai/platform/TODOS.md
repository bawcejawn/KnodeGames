# Knode Games — To-Dos

> Purpose: The owner's action list — what to do today, this week and later.
> Rule: Tick items off, don't delete them; move finished items to "Done" with the date.
> Link each item to its issue or decision where one exists (I-XXX in OPENISSUES.md, D-XXX / C-XX in DECISIONS.md),
> so the details live in one place.
> Last updated: 2026-11-02
> Times are shown in UTC and in your time (PT).

**Priority:** P1 funds or security · P2 breaks a game or the site · P3 confusing or annoying · P4 nice to have

## Today
- [x] ~~Block X round-12 fix-check~~ — GO; PR #57 merged (3 Nov) — I-033
- [ ] **Vault: apply Block X (2) and the Race (7)** — announced 3 Nov (tx `0x122082c6…` and `0x1220d394…`), applicable from **Thu 5 Nov 15:51 UTC (7:51 AM PT)**; apply before Sun 8 Nov 4 PM PT; then repo variable `PRIZES_FROM_WEEK = 3` — P1 — D-077 (reminder Thu 9 AM PT)
- [ ] Ask the Race chat to add producer nicknames to the Race page (D-078, I-073) — P3
- [ ] Ask the Block X chat which items on its "before prizes" list (I-042) could mispay in the first paid week, and watch the 24 h correction window after each seal — P1 — D-077
- [ ] Tell the Hub the vault upgrade is done, so it checks the staking hub, bars and panels on mainnet — P2
- [ ] Run the push block so `main` gets the updated docs — P3

## This Week
- [ ] Ask the Combo Card and Last Node Standing chats whether they're cleared for mainnet — P2 — I-016
- [ ] `game-add` games 2, 7 and 9 (`--staked --free --send`), plus 8 and 13 if cleared — P2 — D-024 — due Fri 6 Nov, 4 PM PT
- [ ] Right after the first `game-add`: switch the sponsor to the vault — `npm run sponsor -- status`, copy the caps exactly (D-061), run the `config` preview (must show "vault (v6) live: no → yes" with caps unchanged), then `--send`, then `status` again. If `status` already warns "the game is Vault v6 now, but the sponsor still treats it as v5", doing it before the first `game-add` is harmless too (Vault chat) — P1
- [ ] `game-apply` each game 48 h after announcing — P2 — due before Sun 8 Nov, 4 PM PT
- [ ] Merge the Block X launch PR (`picks` → `main`) when the Block X chat opens it; then send the Hub the PR link and confirm the phone-width bar screenshot reached it — P2
- [ ] Optional (Repo Lens asked): on the PC, `npm ci --ignore-scripts && npm run test:audit:serial` — P4
- [ ] Retry creating an @name on `names.html` and report the result — P3 — I-020
- [ ] Check the Race status badge on the live Race page at phone width (PR #44 is already merged) — P4
- [ ] Delete old node basedir folders, only if `heal.log` is clean — P3 — I-008 — on or after Wed 4 Nov, 17:30 UTC (9:30 AM PT)
- [ ] Retest "+ Add another account" with the real Kondor extension — P2 — I-004 — due {{TBD}}
- [ ] Confirm which sponsor version is live on chain (v2 or v3) — P2 — C-01 (unblocks I-005) — due {{TBD}}
- [ ] **Before the wallet moves:** get `docs/WALLETS.md` rewritten — it's from 26 Oct and would hand the seed back to the owner (DOCUMENTATION_GAPS #1) — P1
- [ ] Wallet moves per `docs/WALLETS.md` (once updated) — P1 — I-001, D-013 — target this weekend ❓ (7–8 Nov):
  - new **owner** on a hardware wallet — the owner wallet `1635QU…` currently owns the game/vault, the desk and the Picks contract (each change is two-step or timelocked);
  - a **cold treasury** for the desk (48 h timelock);
  - the seed is **already moved** (`1K8VV…`, 30 Oct) — nothing to do
- [ ] Old operator `1JSTwo…`: move its leftover KOIN to the owner first, then remove its key from `.env` — P1 — I-045
- [ ] After launch: empty and retire the test wallets (Fantasy practice wallets; old bot/test wallets from the owner checklist) — P3
- [ ] Top up the bot wallet `1HsM33…` to ~50 KOIN and confirm its Mana — P3 — I-046
- [ ] Watch `node\release-kick.log` and `node\heal.log` for the first few days — P3

## Later
- [ ] Give the go-ahead for the full platform audit — P1 — I-002, D-014
- [ ] Decide the site's read RPC (Armana or `api.koinos.io`) — P3 — I-006, C-04
- [ ] Send the message to the KOIN Vault developer — P3 — I-007
- [ ] Export the Vault v6, Race, sponsor and new-game chats into `CHAT_KNOWLEDGE.md` — P3 — I-009
- [ ] Confirm the GitHub repo name (`KnodeGames` or `Knode`) — P4 — C-06
- [ ] Delete the `diag-health` branch in the GitHub UI — P4 — I-010
- [ ] Survivor: announce Sat 7–Fri 13 Nov, `game-apply` Mon 9–Sun 15 Nov, Season 1 Mon 16 Nov — P2 — D-065; only once I-050 is done (D-064)
- [ ] Survivor: in `C:\kprediction-test`, `git pull`, `npm ci`, check `git log -1 --oneline` shows `a8a1979`, run Repo Lens pass 4 and send back `AUDIT-SURVIVOR-REPORT-4.md` — P2 — I-050
- [ ] Tell the Block X chat about S3-21 / S3-22 (python `-I`, `|| true`) and the Vault chat that `vault.ts` should alert on a refused prize post — P3 — I-054, I-052
- [ ] After the first vault close (Mon 16 Nov, 12:00 UTC / 4:00 AM PT): check status, the buckets, the free prizes, and collect the fee with `claim-fee-vhp all` — P1
- [ ] Then Fantasy, Golf, Combo and Last Node as each clears audits — P3
- [ ] Carry the Vault chat's project docs into `.ai/`: `claude/vault-v6-live.md`, `claude/vault-v6-testnet-results.md`, `claude/handoff-*.md`, `claude/audit-vault-v6-*`, `docs/UPGRADE-V6.md`, `docs/V6-PLAN.md` — P3 — I-009

- [ ] Decide which owner checklist is the source of truth (I-032) — P3
- [ ] Run the pending Repo Lens audits and return the reports: Survivor pass 4 (above), Last Node round 3 (`claude/lastnode/FIXCHECK-3-PROMPT.md`; branch `lastnode`, expect `adf95be` or newer), Bracket (`claude/audit-bracket-prompt.md` → `AUDIT-BRACKET-REPORT.md`), Fantasy fix-check (`knode-fantasy-fixcheck.zip`), Combo fix-check 4 (`claude/audit-combo-fixcheck4-prompt.md`) — P1 — I-065 — **starting tomorrow (3 Nov)**
- [ ] Restart Fantasy practice in `C:\kprediction-fantasy` until one test week is final, then send `npm run fantasy-test -- status` — P3 — I-062
- [ ] Golf owner checklist items: t28 (review the "Block Golf Preview" artifact) and t30 (turn on Golf practice, with Block X) — P3
- [ ] Tell the Block X chat: the mobile-nav test failing on `picks` (I-062), its files moved to the repo root on the Bracket branch, and name `upgrade-schedule` / `upgrade-upload` / `upgrade-clear` in runbook steps 2–4 (Combo asked) — P3
- [ ] Tell the Vault chat: Fantasy's source (C-22), Last Node's vault file format and HOLD files, and to verify staked lists (I-064) — P2
- [ ] Before game 7 prizes: decide B1-2 (I-034), B1-3 free-prize farming (I-035), and back-fill vs "no prize" for not-final weeks (I-033) — P1
- [ ] Step 10: a full day after Block X launches, set per-action Mana limits (`mana-report --save`, `site-limits --send`, a PR, `config --send`); again a day after the sponsor's vault switch (`claude/handoff-sponsor-v6-day.md`) — P3
- [ ] Combo launch: Picks v2 upgrade (see ROADMAP), then raise the pick row to 0.25 and check with `mana-report` — P3 — D-038
- [ ] Decide `sponsor-limit 0` for the game/vault contract (stop it paying Mana for others) — P2 — I-044
- [ ] Recompute the daily Mana budget from `manaByDay` and `npm run sponsor -- status` after a week of play (`claude/mana-budget.md`) — P3
- [ ] Possibly already done ❓: compare `npm run bot -- status` with `before-upgrade.txt`; check the first "Kpred bot" run after v5 was green — P4
- [ ] Optional: decide the on-chain `move_stake` sponsor cap (I-021); pick retention features (see ROADMAP) — P4
- [ ] From the Race chat's owner checklist: pin the Desk node key; clean up the stale folder/branch (which one ❓); move the Desk owner (part of the wallet moves above; the seed is already done, C-15); launch announcement; analytics decision; ads and the SwarmTales listing — P3
- [ ] Carry the Hub and Race chats' project docs into `.ai/`: `claude/launch-order.md`, `claude/stake-panel.md`, `claude/producer-names.md`, `claude/handoff-status-bar-testnet.md`, `claude/names-fixcheck*-prompt.md`, `claude/audit-names-prompt.md`, `claude/domain-knodegames.md`, `claude/site-at-root.md`, `claude/admin-page.md`, `claude/race-vault.md`, `claude/owners-race.md`, `claude/builds/02-hub-and-race-show.md`; repo `docs/NAMES.md`, `docs/ADMIN.md`, `race/README.md` (vault results section); Block X: `claude/blockx/FIXCHECK-PROMPT.md`, `claude/blockx/SPONSOR-TESTNET.md`, `claude/blockx/README.md`, repo `docs/blockx/MAINNET-LAUNCH.md`, `docs/blockx/TESTNET-RESULTS.md`, `docs/history/AUDIT-2026-10-28-repolens-blockx.md`; Survivor: `claude/audit-survivor-prompt.md`, `claude/builds/04-survivor-plan.md`, `claude/builds/04-survivor-sim.mjs`, repo `docs/SURVIVOR*.md`; Last Node `claude/lastnode/*`, `docs/lastnode/FIXCHECK-2-FIXES.md`; Golf `docs/GOLF.md`; Bracket `docs/bracket/README.md`, `docs/VHP-STANDARD.md`, `claude/vhp-standard.md`; Fantasy `docs/fantasy/*`, `claude/builds/05-fantasy-plan.md`, `claude/producer-names.md`; Combo `claude/audit-combo-fixcheck4-prompt.md`, `claude/combo/*` — P3 — I-009

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
| Ship V4, B1-1, B1-5 | Block X chat (told 2 Nov) | 2026-11-02 | — |
| Producer nicknames on the Block X page (load `names.js`, CSP for names-data, `KNames.of` on every producer) — owner request | Block X chat (prompt sent 3 Nov) | 2026-11-03 | I-073 |
| Last Node: fix round-3 findings; prepare game-13 announce/apply for mainnet Picks; confirm the sponsor covers game-13 picks; resync with `main` after the `picks` merge; open the `lastnode` → `main` PR; write the GitHub-variable steps | Last Node chat | 2026-11-02 | I-058, I-059 |
| Golf: rebase `golf` after `picks` merges, move to site root, full suite, PR; at v6 register game 6 and set `GOLF_STAKED_FROM_WEEK` | Golf chat | 2026-11-02 | I-060 |
| Bracket: fix audit findings, rerun suites and replay, fix-check; update `kg-09-bracket` from `main`; after the first live run pin the `effCheck` | Bracket chat | 2026-11-02 | I-061 |
| Fantasy: fix Repo Lens findings; decide flagged cards with owner; real-data simulation; re-merge `picks` | Fantasy chat | 2026-11-02 | I-062 |
| Combo: fix FC4 findings; measure a live hourly run; testnet upgrade rehearsal (route B); re-merge `picks` before the final merge | Combo chat | 2026-11-02 | I-063 |
| Race and Block X: adopt the VHP standard (cardVhp `k` + card credit, averages for others) | Race, Block X chats | 2026-11-02 | D-058 |
| Fix pass-4 findings, fix-check, push to `survivor`; update the brief, `claude/builds/04-survivor-plan.md` and checklist artifact task t06 | Survivor chat | 2026-11-02 | I-050 |

## Done
| Item | Done | Link |
|------|------|------|
| `reward_rule_week_plus_one=3` confirmed on chain | 2026-11-02 | I-003 |
| Accepted Week 3's 1 + 1 VHP free prize for the Questions game (no upgrade) | 2026-11-02 | D-069 |
| Block X recorder (`games.yml`) run by hand: green | 2026-11-03 | — |
| Block X in the top Games menu, the phone More sheet and on the home page (PR #59, deployed 16:09 UTC) | 2026-11-03 | D-077 |
| Vault: games 2 and 7 announced (`game-add`, 3 Nov); sponsor switched to the vault — "Vault (v6): live", caps unchanged; VHP sampler running (first run 15:58 UTC ✅) | 2026-11-03 | D-077, I-059 |
| Block X live on the Games page (PR #58); `GAMES_ENABLED = true` set — recorder runs hourly at :47 | 2026-11-03 | D-077 |
| **Block X Repo Lens round 12 GO; launch PR #57 merged** (sampler + Race v6 fix now on `main`) | 2026-11-03 | I-033, I-059 |
| Block X Picks status checked: announced 30 Oct, applicable since 1 Nov, not applied | 2026-11-02 | I-070 |
| **Block X applied on the Picks contract** (step 8) and its follow-ups (status, Mana check) | 2026-11-02 | D-070, I-040 |
| `vault-v6` merged into `picks`; Block X pushed `d7fad7c` | 2026-11-02 | I-019, I-033 |
| Game documentation written (`.ai/games/`, 9 files) | 2026-11-02 | — |
| Race: `PRIZES_FROM_WEEK = 3` merged (PR #56) | 2026-11-02 | I-069 ✅ |
| Payout time settled: Tue 12:00 UTC (≈ 12:07 with the bot); the 21:00 was a reminder time | 2026-11-02 | I-066, C-08 |
| Answered C-02, C-03, C-10, C-15, C-16, C-18, C-19, C-20; C-22 checked in code | 2026-11-02 | D-061 – D-067 |
| Survivor Season 1 date chosen: Mon 16 Nov | 2026-11-02 | D-065 |
| Survivor prize settled: 4 + 2 per season, paid at season end | 2026-11-02 | D-068 |
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
| Survivor chat knowledge filed; C-13, C-14 settled | 2026-11-02 | D-051, D-052 |
| All 12 chats archived and filed (Last Node, Golf, Bracket, Fantasy, Combo last) | 2026-11-02 | — |
| Bracket sampling branches deleted (`bracket-history` kept) | ≤ 2026-11-02 | ✅ |
| Question-release task checked: NextRunTime 3:45 AM local (11:45 UTC) after the clock change | 2026-11-02 | D-047 |
| Swap Desk chat knowledge filed; C-04, C-05, C-11, C-17 settled | 2026-11-02 | — |
| Real swap tested on the site (3,000 VHP) | ≤ 2026-11-02 | Questions chat |
| Stale copy `C:\Users\alcat\repos\Knode` deleted | ≤ 2026-11-02 | Questions chat |
| Set a desk daily payout cap — **cancelled** (no cap, D-007) | 2026-11-02 | C-17 |
