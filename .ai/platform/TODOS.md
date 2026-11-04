# Knode Games — To-Dos (the owner's own steps)

> **Purpose:** the **one owner checklist** (D-100): what the owner does: sends, merges, decisions, checks on the PC. Work for the chats is in `CHAT_REQUESTS.md`, not here.
> **Rule:** when an item is done, move it to `../archive/DONE.md` with the date (don't strike it through here). Link each item to its issue or decision (I-xxx in `OPENISSUES.md`, D-xxx in `DECISIONS.md`).
> **Last updated:** 2026-11-04 (cleanup: done items, and items that were really chat work, moved out; the full previous version is `../archive/2026-11-04/TODOS.md`)
> Times are UTC, with your time (PT) where it helps.

**Priority:** P1 funds or security · P2 breaks a game or the site · P3 confusing or annoying · P4 nice to have

## Today
- [ ] **Delete `NEW_OWNER_WIF` from `.env`** now that the Race picks owner change is done; keep the new Race owner key (`1LMV8EcR…`) offline, loaded only on owner-action days — P1 — D-083
- [ ] **Free-prize switch: set the starting values** — ON for 2, 7, 9, 13; OFF for 3, 4, 6, 8 (`FREE_PRIZE_SWITCH.md` §4–5); then the GitHub ruleset on `prize-settings` (no deletion, no force-push) — P1 — D-082
- [ ] **Message the Hub chat** (start message): its list has the Stake tab (R-HUB-9), the admin follow-ups (R-HUB-8), @names (R-HUB-3) and the guest-wallet messages (R-HUB-4) — P2
- [ ] **Send every chat the same start message** (`CHAT_REQUESTS.md` §1) — P2 — D-089

## This week
- [ ] **Sponsor rollout (R-BX-15):** steps in `claude/sponsor/ROLLOUT-STEPS-2026-11-04.md`. Before step 0: the Block X chat must **push** `sponsor-limits-1-2` (it isn't on GitHub yet), and put `CONFIRM_MAINNET=yes` in `.env` before the `--send` steps (take it out after) — P1
- [ ] After Repo Lens reviews the ruler design: approve it, then start the new VHP Ruler chat (the library chat writes its first prompt) — P2 — D-110
- [ ] **Read and approve the VHP ruler design v2** (`standards/VHP_RULER.md`: §0 in plain words, §12 the five points; Repo Lens #E-7 changes in §14) — P2 — D-108
- [ ] Send Repo Lens `claude/hub/REPOLENS-C5-FIXCHECK-PR95-PR111-PROMPT.md` anyway (#95 and #111 merged before their fix-check) — P2
- [ ] Optional: delete the old branch `hub-ci-yaml` in GitHub (an unused copy; safe once #111 is merged, which it is) — P4
- [ ] Later (on hold, your call): the GitHub CODEOWNERS / ruleset step (C5-13). Don't require code-owner review without a bypass for yourself — P3
- [ ] Every PowerShell window for tools: `$env:RPC = "https://koinos.armana.io"` first (the deployment files still name `api.koinos.io`, I-015) — P3
- [ ] Send Repo Lens `claude/blockx/ROUND-14-LOWS-FIXCHECK-PROMPT.md` (Block X Lows, branch `blockx-lows`) — P3
- [ ] After #95: on `names.html`, from the producer wallet `1DAHmr…`, create `@primeproducer`, tap Make main, optionally Remove `@primeprocuder`; tell the Hub it works (then the Tools link goes in) — P3 — I-084
- [ ] In GitHub → Settings → Secrets and variables → Actions, confirm `OPERATOR_WIF` exists only in the `bot` environment; delete any repo-level copy — P2 — D-012 (from MKKtXR t18)
- [ ] After `game-apply 7` on Thu: merge **PR #86** (Race page wording) — P2
- [ ] **Weekend:** move `RACE_WIF` (the Race contract's own key) offline (weekend runbook) — P1
- [ ] **Thu 5 Nov after 7:51 AM PT:** `npm run bot -- game-apply 2`, `game-apply 7` (dry run, then `--send`), then `games` must show "staked + free prize, from week 3"; then repo variable `PRIZES_FROM_WEEK = 3`. Deadline **Sun 8 Nov 4 PM PT** — P1 — D-077 (reminder Thu 9 AM PT)
- [ ] **Wallet moves** per `docs/WALLETS.md` (D-083, D-096): **Fri 6 Nov** step 0 (read-only check; paste the output to the Vault chat), create the cold-key owner and cold treasury, start the treasury move (48 h) → **Sat** sweep the old operator `1JSTwo…` (I-045) → **Sun** after every `game-apply`, start the vault and Desk handovers → Mon/Tue accept. Race picks already moved (4 Nov); **Picks later** (D-106) — P1 — I-001
- [ ] Optional (Repo Lens asked): on the PC, `npm ci --ignore-scripts && npm run test:audit:serial` — P4
- [ ] Retry creating an @name on `names.html` and report the result — P3 — I-020
- [ ] Check the Race status badge on the live Race page at phone width — P4
- [ ] Delete old node basedir folders and the desk's ~50 GB broken copy, **only if `heal.log` is clean** — on or after Wed 4 Nov, 17:30 UTC (9:30 AM PT) — P3 — I-008
- [ ] Retest "+ Add another account" with the real Kondor extension — P2 — I-004 — due {{TBD}}
- [ ] Top up the bot wallet `1HsM33…` to ~50 KOIN and confirm its Mana — P3 — I-046
- [ ] Watch `node\release-kick.log` and `node\heal.log` for the first few days — P3
- [ ] Confirm the phone-width status-bar screenshot reached the Hub chat — P4

## Before the first paid weeks close (Mon 16 Nov)
- [ ] **Survivor** (Season 1 Mon 16 Nov, D-065): run Repo Lens pass 4 in `C:\kprediction-test` (`git pull`, `npm ci`, check `git log -1 --oneline` shows `a8a1979` or the Survivor chat's newer commit) and send back `AUDIT-SURVIVOR-REPORT-4.md`; then announce Sat 7 – Fri 13 Nov, `game-apply` Mon 9 – Sun 15 Nov; vault `game-add 3 "Survivor" --staked --free --season 2` with its free-prize switch OFF — P2 — I-050, D-064
- [ ] **Run the other pending Repo Lens audits** and return the reports: Last Node round 3 (`claude/lastnode/FIXCHECK-3-PROMPT.md`; branch `lastnode`, `adf95be` or newer), Fantasy fix-check (`knode-fantasy-fixcheck.zip`), Combo fix-check 4 (`claude/audit-combo-fixcheck4-prompt.md`), Bracket fix-check once R-BR-1 is done — P1 — I-065
- [ ] **Mon 16 Nov, 12:00 UTC (4 AM PT):** after the first vault close, check status, the buckets, the free prizes, and collect the fee with `claim-fee-vhp all` — P1

## Later
- [ ] The full platform audit: only once everything is confidently ready (D-102) — P1 — I-002
- [ ] Compare the Desk node's blocks signed with what its VHP should give over 7 days (it was ~78%); if still under ~90%, check `heal.log` restarts — P3 — TD-08 (from the old checklist 5Rc9KF t05)
- [ ] Decide the site's read RPC (Armana or `api.koinos.io`), and the `vault-v6` folder's node — P3 — I-006, I-015
- [ ] Send the message to the KOIN Vault developer — P3 — I-007
- [ ] Delete the `diag-health` branch in the GitHub UI — P4 — I-010
- [ ] Restart Fantasy practice in `C:\kprediction-fantasy` until one test week is final, then send `npm run fantasy-test -- status` to the Fantasy chat — P3 — I-062
- [ ] Golf owner checklist items: t28 (review the "Block Golf Preview" artifact) and t30 (turn on Golf practice, with Block X) — P3
- [ ] Per-action Mana limits (step 10): a full day after Block X launched, and again a day after the sponsor's vault switch: `mana-report --save`, `site-limits --send`, a PR, `config --send` (`claude/handoff-sponsor-v6-day.md`) — P3
- [ ] Recompute the daily Mana budget from `manaByDay` and `npm run sponsor -- status` after a week of play (`claude/mana-budget.md`) — P3
- [ ] Combo launch: after the Picks v2 upgrade (see ROADMAP), raise the pick row to 0.25 and check with `mana-report` — P3 — D-038
- [ ] After launch: empty and retire the test wallets (Fantasy practice wallets; old bot/test wallets from the owner checklist) — P3
- [ ] Possibly already done ❓: compare `npm run bot -- status` with `before-upgrade.txt`; check the first "Kpred bot" run after v5 was green — P4
- [ ] Optional: decide the on-chain `move_stake` sponsor cap (I-021); pick retention features (see ROADMAP) — P4
- [ ] From the Race chat's owner checklist: pin the Desk node key; clean up the stale folder/branch (which one ❓); launch announcement; analytics decision; ads and the SwarmTales listing — P3
- [ ] Then Fantasy, Golf, Combo and Last Node as each clears audits (`../standards/GO_LIVE_CHECKLIST.md`) — P3
