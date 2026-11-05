# Knode Games — Current State

> **Purpose:** what exists and works **right now**, and the dates to watch. One page.
> **Snapshot:** Thursday 5 Nov 2026, ~17:20 UTC (9:20 AM PT; games 2 and 7 applied in the vault). Whole system at a glance: [`../../STATUS.md`](../../STATUS.md). Refresh after each launch step and at every weekly review; check the date before trusting it.
> **Where the rest lives:** work in progress and blockers → `LAUNCH_BOARD.md`; dates → `CALENDAR.md`; what matters most → `PRIORITIES.md`; the owner's steps → `TODOS.md`; the chats' work → `CHAT_REQUESTS.md`; problems → `OPENISSUES.md`. Earlier versions: `../archive/`.

## Live on chain (Koinos mainnet)
- **Vault v6** at `1Mpmf2…` since Mon 2 Nov 02:33 UTC. It holds every stake and produces blocks as the **Knode Games Pool** (D-073). Holdings 21,133.83 VHP vs 21,124.07 owed (3 Nov). The emergency withdrawals-only build is ready (D-021).
- **Seed:** 21,050 VHP from a dedicated seed owner wallet (D-022).
- **Mana sponsor v3** at `1ByDDSB…`, code **`b84e1add…`** since 4 Nov 07:27 UTC (the guest-trap fix): switch ON, vault switch ON; caps **2.4 Mana per transaction** (D-131, tx `0x1220a593…1bfc`), 40 a day and 250 a week per player (D-105), 5,000 a day in total, 2,000 a day for free players. Per-action rows and measured costs: `SPONSOR.md`.
- **Picks contract** `1LmgqB…` since 30 Oct; **Block X (game 2) applied**, 1 change per pick (D-070).
- **Race picks contract** `1EN7xU…` and **Swap Desk v2** `1FKTpX…` (3% fee, no daily cap).
- **Vault games:** game 1 (Questions) is built in. **Games 2 (Block X) and 7 (Race) applied Thu 5 Nov** ✅: staked + free prize, **from week 3** (Mon 9 Nov, "Week 1"). `PRIZES_FROM_WEEK = 3` (repo variable) is the owner's last step.
- **Vault v6.1** (60 questions a week, Questions on the shared rules, the bot closes weeks): built and cleared (PR #114, release `11043e1f…`, Repo Lens #E-16 GO); announce Thu 5 Nov, upload Mon 9 (D-130).

## Live for players
- **Daily Questions (game 1):** five questions Mon–Sat at 12:00 UTC. Week 2 finalized and paid 3 Nov; 70 questions posted so far.
- **Producer Race (game 7):** four races a day, Staked and Free boards, status badge, nicknames; on the weekly rhythm (#149) with unscored Sunday fun races (#155, D-129); payout safety (#133); **in the vault from week 3** (applied 5 Nov).
- **Who Signs Block X (game 2):** live since 3 Nov with nicknames and a Results tab (#143); recorder on; on the weekly rhythm from Week 1 (#160; first rest day Sun 15 Nov); published finals can't be rewritten (#159); **in the vault from week 3** (applied 5 Nov): pays from Mon 9 Nov (D-077).
- **Site:** knodegames.com on GitHub Pages: staking hub (its own **Stake** tab since 4 Nov, D-109; manages Daily Questions too, #142, #150; claiming 2+ rewards asks free one-by-one or all at once with own Mana, #157, D-132), status bars, @names (Make main / Remove, PR #95), guest play, swap page, Leaders page (Questions, Race, Block X); "Week 1" labels from Mon 9 Nov (PR #94). The CI guard reads workflows' parsed YAML and expressions (PRs #99, #111).

## Running in the background
- **VHP ruler** (#163, merged 5 Nov): the shared ruler, its hourly recorder and simulations are on `main`, **off** until the owner sets `VHP_RULER_ENABLED`; then it records data only and pays nothing (D-111, D-128).
- **Bot:** hourly, plus the 11:48 UTC release run; recovers by itself from node hiccups. Since PR #74 it also checks each game's results before posting them (HOLD files, `board.json`, two-run rule, refusal alerts).
- **VHP sampler** (`race-samples.yml`): GitHub runs it about hourly; each run takes up to 12 samples (~48 per 6-h card, PR #67).
- **Free-prize switch** (D-082, PR #65): built, not used yet (the `prize-settings` branch appears with the first ON/OFF send). Guide: `FREE_PRIZE_SWITCH.md`.
- **Three mainnet nodes** on the owner's PC (desk, game/pool, personal): self-heal every 20 min, watchdog emails, question-release backup task.
- **Two-node checks:** Armana plus `api.koinosblocks.com`.
- **Weekly review:** Tuesdays 10 AM PT (`WEEKLY_REVIEW.md`), reminder at 9:45 AM PT. First review Tue 10 Nov.

## Library
- `.ai/`: start guide, platform docs, nine game files, ten standards (Game, Week cycle, New game, Vault, Leaderboard, Token, Recorder, VHP ruler, Go-live checklist, AI chat starter), the runbook, session-end and weekly-review processes; 134 decisions (D-001 – D-134); health check `HEALTHCHECK.md`; no open contradictions.

## Watch list
- **Thu 5 Nov 15:51 UTC (7:51 AM PT):** games 2 and 7 become applicable (reminder 9 AM PT). Apply before **Sun 8 Nov 4 PM PT**.
- **Vault v6.1 (D-130):** announce **Thu 5 Nov** (current owner `1635QU…`, keeps ≥ 95 KOIN); upload **Mon 9 from 9:00 AM PT**, then the pin and handover 4a; accepts Tue 10; rule week **Mon 16 Nov** (60 a week; Questions paid like every game). The week of Mon 9 is the switch-over week: old rules, the bot settles everyone.
- **Sun 8 Nov 23:48 UTC:** the first 00:00 Questions round (2 + 3 a day from Mon 9).
- **Fri 6 – Tue 10 Nov:** the wallet moves (`docs/WALLETS.md` §7; vault 4a moved to Mon 9 after the upload).
- **Sun 15 Nov:** Block X's first review day (no scoring).
- **Mon 9 Nov 00:00 UTC:** the vault starts paying Questions, Race and Block X; players see this week as "Week 1" (D-063).
- **Tue 10 Nov ~12:07 UTC:** first Questions payout under the v5 split; free players get 1 + 1 VHP for that week (D-069). First weekly review at 10 AM PT.
- **Mon 16 Nov 12:00 UTC:** first vault close with other games in it; check status, buckets, free prizes, the switch and the fee. (Survivor Season 1 no longer starts that day: core first, D-113.)
- **PR #50** stays closed and unmerged (owner, 3 Nov); its useful parts are to be rebuilt (I-072).
