# Knode Games — Calendar

> **Purpose:** every date and time that matters, in **one** list, so no other file has to repeat them. Other files point here. How a normal week runs is in `../standards/WEEK_CYCLE.md`; the owner's steps for each date are in `TODOS.md`.
> **Last updated:** 2026-11-05 (first written; v6.1 timing D-130)
> **Times:** UTC first, Pacific (PST, UTC − 8) after. Daylight time returns 14 Mar 2027.
> **Rule:** when a date moves, change it **here** and in the decision that moved it; remove past rows to `../archive/DONE.md` at the weekly review.

## This week and next

| When (UTC) | Pacific | What | Who | Source |
|---|---|---|---|---|
| **Thu 5 Nov** | morning | **Announce vault v6.1** (starts the 48 h), signed by the current owner `1635QU…` | Owner | D-130 |
| Thu 5 Nov, 15:51 | 7:51 AM | Games 2 (Block X) and 7 (Race) become applicable: `game-apply 2`, `game-apply 7`, then `PRIZES_FROM_WEEK = 3` | Owner | D-077 |
| Fri 6 Nov | ~noon | Latest safe `game-add` for any game to earn from Mon 9 (none planned) | Owner | `GO_LIVE_CHECKLIST` timing rule |
| Fri 6 Nov | — | Wallet runbook step 0 (read-only), then the weekend steps; `1635QU…` keeps ≥ 95 KOIN until the upload | Owner + Vault chat | `docs/WALLETS.md` §7, D-096 |
| **Sun 8 Nov, 24:00** | **Sun 4 PM** | Deadline for `game-apply 2` / `7`. v6.1 upload **never before** this time | Owner | D-077, D-130 |
| Sun 8 Nov, 23:48 | 3:48 PM | First 00:00 Questions round released (2 + 3 a day from Mon 9) | Bot | R-Q-3 |
| **Mon 9 Nov, 00:00** | Sun 4 PM | **Week 1** (vault week 3) starts: the vault pays Questions, Race and Block X; 2 + 1 VHP free prizes where switched on | — | D-062, D-063 |
| **Mon 9 Nov, from 17:00** | **from 9:00 AM** | **Upload v6.1** (`1635QU…`), then pin `safeWasmSha256 = 04c27c1a…`, then vault handover **4a** (by 4:30 PM PT) | Owner | D-130 |
| Mon 9 – Sun 15 Nov | — | **Switch-over week (R − 1):** Questions on the old rules; the bot settles everyone | Bot | D-127, #152 |
| **Tue 10 Nov** | — | Handover accepts **4b** and **5b** (new cold owner `1LMV8E…`) | Owner | D-096 |
| Tue 10 Nov, ~12:07 | ~4 AM | Questions Week 3 paid (v5 split; free 1 + 1 VHP) | Bot | D-069 |
| Tue 10 Nov | 10 AM | First weekly review | Owner + library chat | `WEEKLY_REVIEW.md` |
| Sun 15 Nov | — | Block X's first review day (no scoring); Race fun races | Recorders | #160, D-129 |
| **Mon 16 Nov, 00:00** | Sun 15, 4 PM | **v6.1 rule week:** 60 questions a week; Daily Questions paid like every game (results file, `claim_game`). #152 ✅ merged 5 Nov; #114 merged by now | Vault, owner | D-116, D-130 |
| Mon 16 Nov, 12:00 | 4 AM | First vault close with Block X and the Race in it; check status, buckets, free prizes; `claim-fee-vhp all` | Owner | TODOS |
| Mon 16 Nov | ~6–8 PM | First Block X / Race claims | Players | `WEEK_CYCLE.md` |

## Every week (from Week 1)
See `../standards/WEEK_CYCLE.md` §2: play Mon 00:00 → Sat 24:00 UTC; Sunday review day (fun rounds); final no earlier than Mon 00:00; claims about Mon 6–8 PM PT; held weeks roll over Thu 00:00. Weekly review Tuesdays 10 AM PT.

## Later (no date yet)
- After v6.1 is live: merge #141 (`VAULT_STANDARD` for game 1).
- After 16 Nov: R-VAULT-4 (recompute in the bot).
- VHP ruler merged (#163, 5 Nov): the owner turns the recorder on, data only (D-128); paying waits for all 11 simulations (D-111).
- After the core work (D-113): the paused games, one at a time (`../standards/NEW_GAME.md`).
- Picks owner handover (D-106), when its tool is ready.
- Before stake nears 1,000,000 VHP: the full platform audit (D-102).
- Before the first year of `vhp-data` ends: the yearly archive (D-124).
