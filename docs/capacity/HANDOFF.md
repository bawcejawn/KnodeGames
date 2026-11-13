# Capacity: handoff (Capacity chat closes Fri 13 Nov 2026, ~1:45 PM ET)

Goal (owner + Library, 13 Nov): every game supports 1,500 daily players (~4,500 a week) with no hard wall, tested at
3,000 daily (~9,000 a week). Plan of record: `claude/capacity/GATE-1500-2026-11-13.md` plus
`claude/capacity/GATE-1500-UPDATE-2026-11-13-PM.md` (the update wins). Specs: this folder.
The project store is full, so later Capacity notes live in this folder (`messages/`).

## "Capacity is done" checklist (owner's, Fri 13 Nov)
| # | Item | State at close |
|---|---|---|
| 1 | #286 merged, live check passed | **done** (site serves `mirror: true`; mirror 200) |
| 2 | Gate green at 1,500, or each amber/red has a dated fix | **dated** (table below) |
| 3 | `kit/parts` merged; Block X, Race, Questions on compact files; Race silent cap loud | `kit/parts` in #295 (Repo Lens by Mon 16, merge Tue 17); Race loud stop done (#276); Block X loud stop in its PR; files dated below |
| 4 | Free play for 1,500 typical players a day, KOIN float stated | batched picks Phase 1 (no contract change; Hub, Mon 23 Nov) + sponsor v4 (Mon 30 Nov, fallback Mon 7 Dec) + **50,000 KOIN** float |
| 5 | Daily limits command + 60% email | `tools/capacity/limits.mjs` + workflow "Capacity limits" in #295 |
| 6 | Runbook | `RUNBOOK.md` in #295 |
| 7 | Costs proposal | `COSTS-PROPOSAL.md` in #295 (owner review Mon 23 Nov) |
| 8 | This handoff | this file |

## Dated fixes (gate)
| Game | Status at 1,500 / 3,000 daily | Fix | Owner | Date (ET) |
|---|---|---|---|---|
| Block X | RED | week + board on parts, loud `readPicks`, rolling re-read | Block X chat | merge Sat 21 Nov (after #292) |
| Golf (9 holes, owner) | RED (3.8 / 7.6 MB) | PR A: reads Block X's parts board (loud guard); PR B: one part per hole `h01`-`h09` | Golf chat | A Fri 20 Nov; B Mon 30 Nov |
| Race (W, T, R) | RED | parts PR (`ref`, `r001`-`r028`, `d1`-`d7`) | Race chat | Sun 29 Nov night slot |
| Questions | RED | PR A: compact weekly file + board split on parts | Questions chat | merge Fri 27 Nov (applies from vault week 6) |
| Bracket | GREEN / AMBER (95%) | week on parts (`ref`, `d<n>`, `p/<xx>`) | Bracket chat | Mon 7 Dec (sooner past 3,000 weekly or a 32 field) |
| Combo | board AMBER / RED | `lastWeek` → `L<week>` parts, in the Combo PR (owner decision) | Combo chat | before launch (Mon 7 Dec at the earliest) |
| Kit games (Fantasy, Survivor) | RED (E) | kit Out on `kit/parts` (C1-C3 in #295) | Architecture | kit PR opens Fri 20 Nov |
| Last Node | GREEN | - | - | - |
| Scheduled runs (~636/day) | AMBER | Race samples cut #296 (−192); testnet job off when idle (−72); watch/stats cuts | Race; Architecture | Mon 23 Nov |

## Owner decisions (Fri 13 Nov)
- No daily pick limit on Race (or any game). Protection lives in the sponsor.
- Sponsor v4 may drop the 5,000-a-day ceiling, replaced by: sponsor pays only wallets with < 25 own Mana; one bucket
  (the sponsor's live Mana); a per-wallet rolling allowance (40); an hourly pace limit (10%); a withdrawal reserve
  (2,000, so withdrawals never fail); an owner pause per wallet; a low-Mana warning (no countdown).
- Golf: 9 holes at full build.
- Combo: fix the board in the Combo PR.

## Who owns what after Capacity closes
| Item | Owner |
|---|---|
| Game files on KG parts | each game's chat |
| `kit/parts` changes after #295 | Architecture (Repo Lens for each change) |
| Site "send my picks" (batching) + own-Mana check + low-Mana warning | Hub, with BATCHED-PICKS-SPEC / SPONSOR-V4-SPEC |
| Testnet batching measurement (T7) | owner runs it (script to be written by Hub or Block X; Capacity's spec) |
| Sponsor v4 contract | Block X chat (sponsor owner) |
| Daily limits report, runbook | owner (reads the email); Library (keeps them current) |
| Cloudflare A4 (live file, needs the card) | owner, when ready: `OWNER-STEPS.md` A4a/A4b |
| Workers paid plan ($5) | owner, once daily players pass ~1,000 (costs proposal) |
| Data-branch growth (retention) | owner decision; nothing deleted without a firm OK |
| Producer-key offline backup | owner, right after Week 1 |
