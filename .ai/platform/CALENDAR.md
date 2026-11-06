# Knode Games — Calendar

> **Purpose:** every date and time that matters, in **one** list, so no other file has to repeat them. Other files point here. How a normal week runs is in `../standards/WEEK_CYCLE.md`; the owner's steps for each date are in `TODOS.md`.
> **Last updated:** 2026-11-05 late (weekend steps, ruler recorder, Questions free prize, Block X final time added)
> **Times:** UTC first, Pacific (PST, UTC − 8) after. Daylight time returns 14 Mar 2027.
> **Rule:** when a date moves, change it **here** and in the decision that moved it; remove past rows to `../archive/DONE.md` at the weekly review.

## This week and next

| When (UTC) | Pacific | What | Who | Source |
|---|---|---|---|---|
| Thu 5 Nov, 15:51 | 7:51 AM | Games 2 (Block X) and 7 (Race) become applicable: `game-apply 2`, `game-apply 7`, then `PRIZES_FROM_WEEK = 3` | Owner | D-077 |
| **Thu 5 Nov** | ✅ ~11:01 AM PT | **Vault v6.1 announced** ✅ (`11043e1f…`, tx `0x1220a4a9…66b0`, signed by `1635QU…`; replaced the 4 Nov `399171a2…` announcement); uploadable from Sat 7 19:01 UTC | Owner | D-130 |
| Thu 5 Nov | after the apply | Tell players: Week 1 starts Mon 9 (three games paying, two Questions rounds a day, free prizes) | Owner | D-064 |
| Thu 5 Nov | any time | Turn the VHP ruler's recorder on (`VHP_RULER_ENABLED = true`; data only) | Owner | D-128 |
| Fri 6 Nov | ~noon | Latest safe `game-add` for any game to earn from Mon 9 (none planned) | Owner | `GO_LIVE_CHECKLIST` timing rule |
| Fri 6 Nov | — | Wallet runbook step 0 (read-only), then the weekend steps; `1635QU…` keeps ≥ 95 KOIN until the upload | Owner + Vault chat | `docs/WALLETS.md` §7, D-096 |
| Sat 7 – Sun 8 Nov | — | Weekend steps (`docs/WALLETS.md` §7): cold treasury, sweep the old operator `1JSTwo…`, `RACE_WIF` offline, Desk 5a on Sunday. **Vault 4a moves to Mon 9** after the upload | Owner + Vault chat | D-096, D-130 |
| **Sun 8 Nov, 24:00** | **Sun 4 PM** | Deadline for `game-apply 2` / `7`. v6.1 upload **never before** this time | Owner | D-077, D-130 |
| Sun 8 Nov, 23:48 | 3:48 PM | First 00:00 Questions round released (2 + 3 a day from Mon 9) | Bot | R-Q-3 |
| **Mon 9 Nov, 00:00** | Sun 4 PM | **Week 1** (vault week 3) starts: the vault pays Questions, Race and Block X; 2 + 1 VHP free prizes where switched on | — | D-062, D-063 |
| **Mon 9 Nov, from 17:00** | **from 9:00 AM** | **Upload v6.1** (`1635QU…`), then pin `safeWasmSha256 = 04c27c1a…`, then vault handover **4a** (by 4:30 PM PT) | Owner | D-130 |
| Mon 9 Nov | after the upload | Tell players: 60 questions a week (4 + 4 a day) and Daily Questions staking and rewards like every game, from Mon 16 | Owner | D-064, D-130 |
| Mon 9 – Fri 13 Nov | — | Set Daily Questions' free prize **ON** with the Vault chat's command (counts from Mon 16); merge #114 after the records PR | Owner, Vault chat, library | D-136, R-VAULT-14 |
| Mon 9 – Sun 15 Nov | — | **Switch-over week (R − 1):** Questions on the old rules; the bot settles everyone | Bot | D-127, #152 |
| **Tue 10 Nov** | — | Handover accepts **4b** and **5b** (new cold owner `1LMV8E…`) | Owner | D-096 |
| Tue 10 Nov, ~12:07 | ~4 AM | Questions Week 3 paid (v5 split; free 1 + 1 VHP) | Bot | D-069 |
| Tue 10 Nov | 10 AM | First weekly review | Owner + library chat | `WEEKLY_REVIEW.md` |
| Sun 15 Nov | — | Block X's first review day (no scoring); Race fun races | Recorders | #160, D-129 |
| by Sun 15 Nov | — | ✅ Block X goes final at Mon 00:00 (#175 merged 5 Nov) | Block X chat | D-135 |
| **by Sun 15 Nov** | — | **Daily Questions results recorder merged** (needed for Questions' rule-week payout; R-Q-4, I-101) | Questions chat → Repo Lens → library | D-116 |
| Sun 15 Nov, 23:48 | 3:48 PM | First 4 + 4 round released (the 60 cap from Mon 16) | Bot | R-Q-3 |
| **Mon 16 Nov, 00:00** | Sun 15, 4 PM | **v6.1 rule week:** the 60-question cap (4 + 4 rounds a day, 48 a week); Daily Questions paid like every game (results file, `claim_game`). #152 ✅ merged 5 Nov; #114 merged by now | Vault, owner | D-116, D-130 |
| Mon 16 Nov, 12:00 | 4 AM | First vault close with Block X and the Race in it; check status, buckets, free prizes; `claim-fee-vhp all` | Owner | TODOS |
| Mon 16 Nov | ~6–8 PM | First Block X / Race claims | Players | `WEEK_CYCLE.md` |

## Every week (from Week 1)
See `../standards/WEEK_CYCLE.md` §2: play Mon 00:00 → Sat 24:00 UTC; Sunday review day (fun rounds); final no earlier than Mon 00:00; claims about Mon 6–8 PM PT; held weeks roll over Thu 00:00. Weekly review Tuesdays 10 AM PT.

## Later (no date yet)
- After v6.1 is live: merge #141 (`VAULT_STANDARD` for game 1).
- After 16 Nov: R-VAULT-4 (recompute in the bot).
- VHP ruler merged (#163, 5 Nov): the owner turns the recorder on, data only (D-128); paying waits for all 11 simulations (D-111).
- Fantasy, Block Golf, Bracket (reactivated 5 Nov, D-142): each launches when its go-live checklist is done; earliest earning week is the Monday after its `game-apply` (`game-add` by Friday ~noon PT the week before).
- Picks owner handover (D-106), when its tool is ready.
- Before stake nears 1,000,000 VHP: the full platform audit (D-102).
- Before the first year of `vhp-data` ends: the yearly archive (D-124).
