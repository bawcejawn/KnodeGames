# Knode Games — To-Dos (the owner's own steps)

> **Purpose:** the **one owner checklist** (D-100): what the owner does: sends, merges, decisions, checks on the PC. Work for the chats is in `CHAT_REQUESTS.md`, not here.
> **Rule:** when an item is done, move it to `../archive/DONE.md` with the date (don't strike it through here). Link each item to its issue or decision (I-xxx in `OPENISSUES.md`, D-xxx in `DECISIONS.md`).
> **Last updated:** 2026-11-05 (v6.1 timeline D-130: announce Thu 5, upload Mon 9, rule week Mon 16; finished steps moved to `../archive/DONE.md`). Dates and times at a glance: `CALENDAR.md`.
> Times are UTC, with your time (PT) where it helps.

**Priority:** P1 funds or security · P2 breaks a game or the site · P3 confusing or annoying · P4 nice to have

## Today — Thu 5 Nov
- [ ] **Merge PR #162** if it still shows open (docs only: the weekend runbook with the new dates) — P2 — D-130
- [ ] **Check `1635QU…` holds at least 95 KOIN** in Kondor (compare the full address). Short? Send KOIN now so its Mana is there by Monday. **Don't move its KOIN until after Monday's upload** — P1 — D-130
- [ ] **Announce vault v6.1** (starts the 48 hours), signed by the current owner `1635QU…`: build and check on `vault-questions-60` (hashes `11043e1f…` and `04c27c1a…`, `chain-check` all ✔), then `upgrade schedule` dry run → CONFIRM ON → `--send` → CONFIRM OFF → delete `OWNER_WIF` from `.env`. Steps: the Vault handoff (`claude/vault/HANDOFF-2026-11-05.md`) and `docs/UPGRADE-V61.md` on #114. Paste the output to the Vault chat — P1 — D-130
- [ ] **After 7:51 AM PT:** `npm run bot -- game-apply 2` and `game-apply 7` (dry run, then `--send`); `games` must show "staked + free prize, from week 3"; then repo variable `PRIZES_FROM_WEEK = 3`. Deadline **Sun 8 Nov 4 PM PT** — P1 — D-077
- [ ] Optional Repo Lens: Race #155 post-merge (`claude/race/REPOLENS-PR155-POSTMERGE-PROMPT.md`). Nothing else is waiting on Repo Lens now (#152 and #163 merged 5 Nov). Queue: `AUDITS.md` — P4
- [ ] Email filter: rename "Kpred bot" → "Knode Games bot" (the workflow name since #131) — P4

## This week
- [ ] **Pages allow-list:** when the Hub chat's PR (R-HUB-14) is merged and its test run is checked: GitHub → Settings → Pages → Source: **GitHub Actions**; then open knodegames.com and two game pages. Undo = set Source back to "Deploy from a branch: main / root" — P2 — D-115
- [ ] **Daily Questions free prize ON from Mon 16** (D-136): run the command the Vault chat gives (R-VAULT-14) during the week of Mon 9 — P2
- [ ] **Turn the VHP ruler's recorder on** (data only, pays nothing, D-128): repo variable `VHP_RULER_ENABLED = true`, then the first fill (`docs/VHP-RULER.md` "Turning it on"); tell the Ruler chat — P2 — D-128
- [ ] **Fri 6 Nov:** wallet runbook step 0 (read-only check; paste to the Vault chat), then the weekend steps in `docs/WALLETS.md` §7 — **with two changes:** vault 4a moves to Mon 9 after the upload; `1635QU…`'s KOIN stays put until then — P1 — D-083, D-096, D-130
- [ ] **Mon 9 Nov from 9:00 AM PT** (never before Sun 8, 4 PM PT): `upgrade apply` dry run → CONFIRM ON → `--send` → CONFIRM OFF; `status` must say "this week 30, next week 60"; pin `safeWasmSha256 = 04c27c1a…` in `game-data\deployment.json`; then vault handover **4a** by 4:30 PM PT; delete `OWNER_WIF`; paste everything to the Vault chat — P1 — D-130
- [ ] **Tue 10 Nov:** handover accepts 4b and 5b (new cold owner `1LMV8E…`) — P1 — D-096
- [ ] **Merge order:** ✅ #152 merged (5 Nov) → #114 (after the upload and the Vault chat's records PR / merge of `main`) → #141 (once v6.1 is live). Mon 16 at the latest — P1
- [ ] **Before Mon 16:** tell players: 60 questions a week; Daily Questions staking and rewards work like every vault game; claims are per game and week (your text; the Questions chat has the site wording) — P2
- [ ] **Mainnet stake check** on the Stake page with small amounts: deposit, withdraw, move, claim; try "Free" with 2+ rewards once; tell the Hub and Block X chats (R-HUB-9, R-BX-18) — P2
- [ ] **Free-prize switch: set the starting values** — ON for 2, 7, 9, 13; OFF for 3, 4, 6, 8 (`FREE_PRIZE_SWITCH.md` §4–5); then the GitHub ruleset on `prize-settings` (no deletion, no force-push) — P1 — D-082
- [ ] Delete the 145 merged branches with the script `claude/BRANCH-CLEANUP-2026-11-04.md` (protect the data branches first) — P3 — D-115
- [ ] Send Repo Lens `claude/hub/REPOLENS-C5-FIXCHECK-PR95-PR111-PROMPT.md` anyway (#95 and #111 merged before their fix-check) — P2
- [ ] Optional: delete the old branch `hub-ci-yaml` in GitHub (an unused copy; safe once #111 is merged, which it is) — P4
- [ ] Every PowerShell window for tools: `$env:RPC = "https://koinos.armana.io"` first (the deployment files still name `api.koinos.io`, I-015) — P3
- [ ] Send Repo Lens `claude/blockx/ROUND-14-LOWS-FIXCHECK-PROMPT.md` (Block X Lows, branch `blockx-lows`) — P3
- [ ] After #95: on `names.html`, from the producer wallet `1DAHmr…`, create `@primeproducer`, tap Make main, optionally Remove `@primeprocuder`; tell the Hub it works (then the Tools link goes in) — P3 — I-084
- [ ] In GitHub → Settings → Secrets and variables → Actions, confirm `OPERATOR_WIF` exists only in the `bot` environment; delete any repo-level copy — P2 — D-012 (from MKKtXR t18)
- [ ] **Weekend:** move `RACE_WIF` (the Race contract's own key) offline (weekend runbook) — P1
- [ ] Optional (Repo Lens asked): on the PC, `npm ci --ignore-scripts && npm run test:audit:serial` — P4
- [ ] Check the Race status badge on the live Race page at phone width — P4
- [ ] Delete old node basedir folders and the desk's ~50 GB broken copy, **only if `heal.log` is clean** — on or after Wed 4 Nov, 17:30 UTC (9:30 AM PT) — P3 — I-008
- [ ] Retest "+ Add another account" with the real Kondor extension — P2 — I-004 — due {{TBD}}
- [ ] Top up the bot wallet `1HsM33…` to ~50 KOIN and confirm its Mana — P3 — I-046
- [ ] Watch `node\release-kick.log` and `node\heal.log` for the first few days — P3
- [ ] Confirm the phone-width status-bar screenshot reached the Hub chat — P4

## Before the first paid weeks close (Mon 16 Nov)
- [ ] ⏸ **Paused (D-113): Survivor** (Season 1 no longer 16 Nov; restarts after the core work): run Repo Lens pass 4 in `C:\kprediction-test` (`git pull`, `npm ci`, check `git log -1 --oneline` shows `a8a1979` or the Survivor chat's newer commit) and send back `AUDIT-SURVIVOR-REPORT-4.md`; then announce Sat 7 – Fri 13 Nov, `game-apply` Mon 9 – Sun 15 Nov; vault `game-add 3 "Survivor" --staked --free --season 2` with its free-prize switch OFF — P2 — I-050, D-064
- [ ] ⏸ **Paused (D-113): the other game audits**: Last Node round 3 (`claude/lastnode/FIXCHECK-3-PROMPT.md`; branch `lastnode`, `adf95be` or newer), Fantasy fix-check (`knode-fantasy-fixcheck.zip`), Combo fix-check 4 (`claude/audit-combo-fixcheck4-prompt.md`), Bracket fix-check once R-BR-1 is done — P1 — I-065
- [ ] **Mon 16 Nov, 12:00 UTC (4 AM PT):** after the first vault close, check status, the buckets, the free prizes, and collect the fee with `claim-fee-vhp all` — P1

## Later
- [ ] When you have a USB stick: once R-VAULT-10's script exists, back up the three producer keys (game/pool, Desk, personal) to it and keep it offline, apart from your wallet paper — P2 — TD-08
- [ ] C5-13 (CODEOWNERS + ruleset): **go** (owner, 5 Nov). Wait for the Hub chat (R-HUB-14): the bot commits game data to `main` every hour, so the ruleset must let the bot and you bypass it, or the games stop updating. The Hub chat gives the exact clicks — P3
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
- [ ] Possibly already done ❓: compare `npm run bot -- status` with `before-upgrade.txt`; check the first "Knode Games bot" run after v5 was green — P4
- [ ] Optional: decide the on-chain `move_stake` sponsor cap (I-021); pick retention features (see ROADMAP) — P4
- [ ] From the Race chat's owner checklist: pin the Desk node key; clean up the stale folder/branch (which one ❓); launch announcement; analytics decision; ads and the SwarmTales listing — P3
- [ ] Then Fantasy, Golf, Combo and Last Node as each clears audits (`../standards/GO_LIVE_CHECKLIST.md`) — P3
