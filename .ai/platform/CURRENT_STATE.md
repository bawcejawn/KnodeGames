# Knode Games — Current State

> **Purpose:** what exists and works **right now**, and the dates to watch. One page.
> **Snapshot:** Wednesday 4 Nov 2026, ~04:00 UTC (Tue 8 PM PT). Refresh after each launch step and at every weekly review; check the date before trusting it.
> **Where the rest lives:** work in progress and blockers → `ACTIVE_WORK.md`; what matters most → `PRIORITIES.md`; the owner's steps → `TODOS.md`; the chats' work → `CHAT_REQUESTS.md`; problems → `OPENISSUES.md`. Earlier versions: `../archive/`.

## Live on chain (Koinos mainnet)
- **Vault v6** at `1Mpmf2…` since Mon 2 Nov 02:33 UTC. It holds every stake and produces blocks as the **Knode Games Pool** (D-073). Holdings 21,133.83 VHP vs 21,124.07 owed (3 Nov). The emergency withdrawals-only build is ready (D-021).
- **Seed:** 21,050 VHP from a dedicated seed owner wallet (D-022).
- **Mana sponsor v3** at `1ByDDSB…`: 25,000 KOIN; caps 1 Mana per transaction, 25 a day and 150 a week per wallet, 5,000 a day in total, 2,000 a day for free players, released by the hour (D-061). **Vault switch OFF since 4 Nov ~04:15 UTC** (stopgap for the guest-pick trap: sponsor `b61ac238` traps decoding the vault's empty `get_game_player` answer). While off, a stake only in a vault game counts as free play, and the vault's own calls (deposit_to, withdraw_from, move_stake, claim_game, finalize_game_week) aren't sponsored. The fix `b84e1add…` passed Repo Lens; the rollout is PR #107 (R-BX-15). Picks pick row 1 Mana (D-104). Guest picks work again (4 Nov).
- **Picks contract** `1LmgqB…` since 30 Oct; **Block X (game 2) applied**, 1 change per pick (D-070).
- **Race picks contract** `1EN7xU…` and **Swap Desk v2** `1FKTpX…` (3% fee, no daily cap).
- **Vault games:** game 1 (Questions) is built in. **Games 2 (Block X) and 7 (Race) announced 3 Nov** (tx `0x122082c6…`, `0x1220d394…`), applicable from **Thu 5 Nov 15:51 UTC**.

## Live for players
- **Daily Questions (game 1):** five questions Mon–Sat at 12:00 UTC. Week 2 finalized and paid 3 Nov; 70 questions posted so far.
- **Producer Race (game 7):** four races a day, Staked and Free boards, status badge, nicknames.
- **Who Signs Block X (game 2):** live since 3 Nov on the Games page, home page, menus and Leaders page, with nicknames; recorder on (`GAMES_ENABLED`); prize-free until it pays from Mon 9 Nov (D-077).
- **Site:** knodegames.com on GitHub Pages: staking hub (its own **Stake** tab since 4 Nov, D-109), status bars, @names (Make main / Remove, PR #95), guest play, swap page, Leaders page (Questions, Race, Block X); "Week 1" labels from Mon 9 Nov (PR #94). The CI guard reads workflows' parsed YAML and expressions (PRs #99, #111).

## Running in the background
- **Bot:** hourly, plus the 11:48 UTC release run; recovers by itself from node hiccups. Since PR #74 it also checks each game's results before posting them (HOLD files, `board.json`, two-run rule, refusal alerts).
- **VHP sampler** (`race-samples.yml`): GitHub runs it about hourly; each run takes up to 12 samples (~48 per 6-h card, PR #67).
- **Free-prize switch** (D-082, PR #65): built, not used yet (the `prize-settings` branch appears with the first ON/OFF send). Guide: `FREE_PRIZE_SWITCH.md`.
- **Three mainnet nodes** on the owner's PC (desk, game/pool, personal): self-heal every 20 min, watchdog emails, question-release backup task.
- **Two-node checks:** Armana plus `api.koinosblocks.com`.
- **Weekly review:** Tuesdays 10 AM PT (`WEEKLY_REVIEW.md`), reminder at 9:45 AM PT. First review Tue 10 Nov.

## Library
- `.ai/`: start guide, platform docs, nine game files, seven standards (Game, Vault, Leaderboard, Token, Recorder, Go-live checklist, AI chat starter), the runbook, session-end and weekly-review processes; 102 decisions (D-001 – D-102), no open contradictions. Finished items live in `../archive/DONE.md` and `../archive/ISSUES_CLOSED.md`.

## Watch list
- **Thu 5 Nov 15:51 UTC (7:51 AM PT):** games 2 and 7 become applicable (reminder 9 AM PT). Apply before **Sun 8 Nov 4 PM PT**.
- **Before Mon 9 Nov 00:00 UTC (Sun 4 PM PT):** PR #80 (Block X before prizes) merged after its round-14 fix-check.
- **Fri 6 – Tue 10 Nov:** the wallet moves (`docs/WALLETS.md`).
- **Mon 9 Nov 00:00 UTC:** the vault starts paying Questions, Race and Block X; players see this week as "Week 1" (D-063).
- **Tue 10 Nov ~12:07 UTC:** first Questions payout under the v5 split; free players get 1 + 1 VHP for that week (D-069). First weekly review at 10 AM PT.
- **Mon 16 Nov 12:00 UTC:** first vault close with other games in it; check status, buckets, free prizes, the switch and the fee. Survivor Season 1 starts the same day.
- **PR #50** stays closed and unmerged (owner, 3 Nov); its useful parts are to be rebuilt (I-072).
