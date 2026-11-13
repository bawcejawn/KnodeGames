# Capacity runbook: what to do when a limit is hit (Capacity chat, Fri 13 Nov 2026)

Daily check (read-only, 1 minute):
```powershell
cd C:\kprediction
git branch --show-current
git pull
foreach ($b in "games-data","race-data","blocks-data","names-data","stats-data","vhp-data") { git fetch --quiet --depth 1 origin "${b}:refs/remotes/origin/$b" }
node tools/capacity/limits.mjs
npm run sponsor -- status
```
The daily workflow "Capacity limits" runs the same report at 8:23 AM ET and **fails (GitHub emails you) when any
published file is at 60% or more of its cap.** Green under 60%, amber 60-85%, red 85% and up.

| Limit | How you notice | What happens to players | What you do | Time to fix |
|---|---|---|---|---|
| A game's weekly file (2 MB; Questions 1.9 MB) | daily report amber; then a failed publish run email | at 100%: board freezes, that week's payout waits; picks safe on chain | amber: tell the game's chat (its KG parts move is planned, see GATE). Red before the move lands: the game's chat holds the week (owner hold) and ships the parts PR; the week is paid when it lands | under a day once the game is on KG parts (more parts are automatic); before that, the game's PR (days) |
| Sponsor Mana (v3: 5,000 a day counted, 2,000 for guests) | "free play used up for today"; `npm run sponsor -- status` | guests then players can't play free until 00:00 UTC; funds safe | raise the guest share or the day cap inside 5,000 (one `config` send, dry run first); top up KOIN; v4 removes the fixed day cap | minutes (config send) |
| Sponsor Mana (v4: live Mana floors) | `would_pay` reasons; status shows live Mana vs floors | guests stop first, withdrawals last | top up KOIN (more Mana refills at once and holds more); lower the guest floor | minutes |
| Public node (Armana) refusing | pages say they can't reach the Koinos network | pages retry; nothing is sent | switch the live file on (A4); spread reads to a second public node | hours (live file) |
| Cloudflare Worker free requests (100,000 a day) | Cloudflare -> Workers -> kg-data -> Metrics near 100,000 | pages fall back to GitHub by themselves until midnight UTC | take the Workers plan ($5 a month) | minutes |
| GitHub raw / Pages load | a GitHub notice; slow data | site still up (Cloudflare) | mirror is on; check the cache rule; tell the Library before any bulk action | minutes |
| Scheduled runs (~626 a day, target ~300) | daily report row (not alerted until the cut lands) | late recorder runs during GitHub incidents | the Race and Architecture chats cut Race samples to 15 min and the idle testnet job | a day |
| Your PC (block production) | heartbeat email | players unaffected; vault production drops | power/internet: wait for it; Docker Desktop: restart it; dead PC: new machine + producer key backup (see GATE §d) | 20 min to 3 days |
| Recorder run time (30-minute job limit) | failed recorder run email | results wait for the next run | not a near-term limit (~2.4 min at 20,000 players); the game's chat reads only new picks | a day |
