# Knode Games — Active Work

> **Purpose:** what is being worked on right now, what is stuck, and what comes next — one page per area.
> **Snapshot:** Tuesday 3 Nov 2026, ~17:00 UTC (9 AM PT). Goes stale fast: update it when something moves, and check the date before trusting it.
> **Sources:** `CURRENT_STATE.md`, `PRIORITIES.md`, `TODOS.md`, `OPENISSUES.md` (I-xxx), `DECISIONS.md` (D-xxx), `TECHNICAL_DEBT.md` (TD-xx), open PRs and workflow runs checked 3 Nov. Detail lives there; this is the summary.
> **Legend:** 👤 owner does it · 💬 a game chat does it · ❓ not decided

---

## Platform
### Current Work
- **Block X is live** on the Games page, home page and menus (PRs #58, #59); recorder `games.yml` green.
- **VHP sampler** (`race-samples.yml`) — first run 3 Nov 15:58 UTC; owner ran it by hand ~17:15 UTC, all green; watching how often GitHub really runs it (I-059).
- **Nicknames on every game** (D-078) — Block X done (PR #60); Race next.
- **`.ai/` library** kept current (this file, D-081).

### Blocked Work
- **Sampler cadence** — GitHub runs this repo's frequent schedules about hourly, not every 5 min. Too few samples would flag Block X cards and slow Last Node's 48 h (I-059, TD-07). 👤 one manual "Run workflow", then recheck.
- **`docs/WALLETS.md`** is stale and would hand the seed back to the owner — must be rewritten **before** the weekend wallet moves (DOCUMENTATION_GAPS #1).
- **PR #50** — closed, **not to be merged** (👤); useful parts to be rebuilt (I-072).

### Next Work
- Site **"Week 1" refresh** before Mon 9 Nov (I-069, I-027).
- 👤 **Wallet moves this weekend:** owner to a hardware wallet, cold desk treasury, move the old operator's KOIN and remove its key (I-001, I-045, TD-01).
- Fallback node (Cloudflare Tunnel) — **on hold** (👤).

## Games
### Current Work
| Game | Where it stands |
|------|-----------------|
| Daily Questions (1) | live; releases 12:00 UTC Mon–Sat |
| Producer Race (7) | live; nicknames to add (💬 Race chat) |
| Who Signs Block X (2) | live, prize-free until it pays from Mon 9 Nov |
| Survivor (3) | branch `survivor`; Season 1 **Mon 16 Nov** (D-065) |
| Last Node Standing (13) | branch `lastnode`; round-3 review |
| Fantasy Producers (4) | branch `fantasy`; fix-check, test week |
| Combo Card (8) | branch `combo`; fix-check 4 |
| Producer Bracket (9) | branch `kg-09-bracket`; audit not yet run |
| Block Golf (6) | branch `golf`; practice with Block X |

### Blocked Work
- **Repo Lens audits** (👤 runs them): Survivor pass 4, Last Node round 3, Bracket, Fantasy fix-check, Combo fix-check 4. Nothing is announced until each passes (D-064).
- **Last Node** needs 48 h of sampler data (I-059).
- **Combo** needs the Picks v2 upgrade (D-060), and its page lets only staked wallets send cards (I-074).
- **D-081 changes (every game has Free play):** Fantasy and Last Node branches have no free board yet; Survivor keeps its free board with the prize off.

### Next Work
- 💬 Send the D-081 note to the Survivor, Fantasy, Last Node, Combo and Golf chats (TODOS).
- 💬 Block X chat: its "before prizes" list (I-042).
- Survivor: pass 4 → testnet season → register game 3 on Picks → launch Mon 16 Nov.

## Vault
### Current Work
- **Vault v6** live since 2 Nov at `1Mpmf2…` (also the Knode Games Pool producer, D-073).
- **Games 2 (Block X) and 7 (Race) announced** 3 Nov; applicable from **Thu 5 Nov 15:51 UTC (7:51 AM PT)**.
- Sponsor vault switch **on** (caps unchanged).

### Blocked Work
- `game-apply 2` and `7` **can't run before Thu 5 Nov 15:51 UTC** (48 h timelock). Reminder set for Thu 9 AM PT.
- **Vault bot checks** before paying other games: honour HOLD files, verify staked lists, alert on refused prize posts (I-052, I-064); recompute from the chain (I-051).
- **Free-prize switch** (D-082) built on **PR #65**, not merged — Repo Lens first (funds-related). Vault side checked ✅ (3 Nov): unwon prizes roll fee-free into the next week's pot; no effect on liabilities or the seed.
- **Vault bot checks** (I-051, I-052, I-064) are due **Fri 13 Nov**. The Vault chat offers to build them; owner to decide who.

### Next Work
- 👤 Thu–Sun: `npm run bot -- game-apply 2 --send`, `game-apply 7 --send`, `games`; then repo variable `PRIZES_FROM_WEEK = 3`. Deadline **Sun 8 Nov 4 PM PT**.
- Each other game: `game-add` once audited, **always with `--free`**; set its free-prize switch off first where no prize yet (D-082). Survivor: `game-add 3 "Survivor" --staked --free --season 2`.
- **Producer Bracket (9)** could pay from 9 Nov only if `game-add 9` goes out by **Fri 6 Nov 4 PM PT**. Its audit hasn't run, and nothing is added before it passes (D-064), so it most likely starts a week later.
- **Mon 16 Nov 12:00 UTC:** first vault close with other games in it — check status, buckets, free prizes, fee.

## Leaderboards
### Current Work
- **Block X on the Leaders page** — **PR #63** (points in hundredths shown as 1.79; last week's medals from the frozen prize list). 👤 review and merge.
- Standard: **every game has its own Staked and Free play boards**, on its page and on the Leaders page (D-079, D-081).

### Blocked Work
- Leaders entries for Survivor, Fantasy, Last Node, Combo, Golf, Bracket wait for each game to launch (and for each recorder's `board.json`).
- Fantasy and Last Node need free boards built first (D-081).

### Next Work
- Boards without a free prize (Combo, Golf, Survivor, Fantasy) must say plainly "no VHP paid" on the Free play board (D-081).
- Show 9 Nov as "Week 1" on every board (I-069).

## Rewards
### Current Work
- **Questions:** Week 2 paid 3 Nov; week of 2–9 Nov pays its on-chain 1 + 1 VHP on **Tue 10 Nov ~12:07 UTC** (D-069).
- Questions, Race and Block X **pay from the week of Mon 9 Nov** (D-077): 5% fee first, free prize 2 + 1 VHP, the rest split across staked games by stake.

### Blocked Work
- **Race prizes** need I-034 (no final file from a single run without a hold) and the free-prize farming question I-035 (❓ owner) before the first paid week.
- Free prizes on Combo, Golf, Survivor and Fantasy are **off** until the owner switches them on (D-081) — with the admin switch once PR #65 is in (D-082). Last Node pays it from the start.

### Next Work
- Watch the first paid week's seal and its 24 h correction window (Mon 16 Nov).
- Growth target: over 1,000,000 VHP in the pool (D-076).

## Swap Desk
### Current Work
- **Swap Desk v2** live at `1FKTpX…`: 3% fee, no daily payout cap (D-007); runs from the desk node.

### Blocked Work
- **Desk treasury = the owner's hot wallet** `1635QU…` (TD-01). The cold treasury waits for the `docs/WALLETS.md` rewrite.

### Next Work
- 👤 This weekend: cold desk treasury (48 h timelock), owner on a hardware wallet (I-001).
- 👤 On or after **Wed 4 Nov 17:30 UTC**: delete the old node folders and the desk's ~50 GB broken copy, **only if `heal.log` is clean** (I-008).
- ❓ `sponsor-limit 0` on the game contract (I-044, postponed, D-046); bot wallet KOIN check (I-046).
