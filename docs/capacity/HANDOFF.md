# Capacity: handoff (living file; Capacity chat closes when every row is done or owned)

Goal (owner + Library, 13 Nov): every game supports 1,500 daily players (~4,500 a week) with no hard wall; tested at
3,000 daily. Plan of record: `claude/capacity/GATE-1500-2026-11-13.md` (Library accepted, Fri 13 Nov).

## "Capacity is done" checklist (owner's, Fri 13 Nov)
| # | Item | State (Fri 13 Nov) |
|---|---|---|
| 1 | #286 merged, live check passed | **done** (site serves `mirror: true`; mirror 200) |
| 2 | Gate all green at 1,500, or every amber/red has a dated fix | dated (GATE) |
| 3 | `kit/parts` merged; Block X, Race, Questions on compact files; Race silent cap loud | `kit/parts` in the capacity PR (Repo Lens by Mon 16, merge Tue 17); Race loud stop done (#276); Block X loud stop done locally (Block X chat); files: Block X Sat 21, Race + Questions Mon 30 Nov |
| 4 | Free play for 1,500 typical a day covered, KOIN float stated | batched picks Phase 1 (no contract change) + sponsor v4 + 50,000 KOIN; testnet numbers Wed 18 Nov |
| 5 | Daily limits command + 60% email | `tools/capacity/limits.mjs` + workflow "Capacity limits" in the capacity PR |
| 6 | Runbook | `RUNBOOK.md` in the capacity PR |
| 7 | Costs proposal | `COSTS-PROPOSAL.md` in the capacity PR |
| 8 | This handoff | this file |

## Who owns what after Capacity closes
| Item | Owner |
|---|---|
| Block X / Race / Questions / Last Node files on KG parts | each game's chat |
| Kit games on parts; how the kit calls `kit/parts` | Architecture |
| Site "send my picks" (multi-operation batching) | Hub, with Capacity's spec |
| Sponsor v4 contract | the sponsor's owner chat (Block X chat) |
| Scheduled-run cut (~626 -> ~300) | Race chat (Race samples), Architecture (testnet job) |
| Daily limits report, runbook | owner (runs it); Library (keeps it current) |
| Data-branch size over time (retention) | owner decision, Library (nothing deleted without a firm OK) |
