# Capacity standard: proposal for every game

Status: **proposal** from the Capacity chat (owner, Thu 12 Nov 2026: "the whole platform needs to meet capacity ... built
into standards for all games"). The Library files the adopted version as `.ai/standards/CAPACITY_STANDARD.md` and links
it from `GAME_STANDARD.md`, `RECORDER_STANDARD.md`, `GAME_KIT.md`, `NEW_GAME.md` and `GO_LIVE_CHECKLIST.md`; the
Architecture chat builds rules 2-4 into the Shared Game Kit. Evidence: [README.md](README.md) and `tools/capacity-harness/`.

## Proposed rules

**Goal:** no game breaks without weeks of warning on the way to 100,000 daily players, and every limit fails safely (no lost funds, no lost picks, no wrong payout).

1. **Every published file has a size budget.** Each game states, in its README, bytes per player at full play and the fixed part, for every file it publishes, and the player count at which each file reaches 2 MB (the publish cap). Measured with `tools/capacity-harness` (or the same method), before the game's first paid week and in every PR that changes a file's shape.
2. **Warn at 60%.** Every recorder warns in each run (an alert email) when any file it writes passes 60% of its cap (1.2 MB of 2 MB), naming the file and the size.
3. **Never drop data silently.** Any page loop, row cap or slice that could leave out picks, players or rows **throws** instead (the run fails with an alert; nothing is written). Found today: Race, Block X and Last Node `readPicks` (1,000 pages x 100); Golf `ptsRows` (100,000 rows). Bracket and Questions already stop loudly.
4. **Compact, split files** (kit: one shared module). Each fact once (fixed reference data such as cards in its own write-once file); players and producers listed once per file with picks as small numbers; one file per day or round; a top-100 board plus per-player shard files chosen by the start of the address. One hash over all parts; the publish job still recomputes every point, place and winner; finals still written once; the vault bot's double read unchanged.
5. **Pages read cheaply.** A page never polls the chain or a data file in a hidden tab; shares one chain-head read per page; reads published files through `data.knodegames.com` (falling back to GitHub raw), and live block counts from the "latest chain" file `live.knodegames.com` (falling back to a public node). **Scores, cards and voids only from the published game files, never worked out from the live file** (Ruler chat, 12 Nov).
6. **Recorders keep two independent nodes.** Our own read node may be one of them later, never both (Ruler chat, 12 Nov).
7. **Sponsor rows are sized.** Each new on-chain action states its measured Mana (through the sponsor) and its per-action limit; a game that adds daily actions states the new Mana per player-day, so the sponsor budget table stays true.
8. **No new schedules without a reason.** A new workflow schedule states why its frequency is needed; nothing more often than hourly without the owner's OK (GitHub load).

## Checklist lines for GO_LIVE_CHECKLIST.md
- [ ] File sizes measured; 2 MB player counts in the README (rule 1)
- [ ] 60% warning in the recorder (rule 2)
- [ ] No silent caps: page loops and row caps throw (rule 3)
- [ ] Pages: hidden-tab pause, shared head read, data through `data.knodegames.com` with fallback (rule 5)
- [ ] Mana per action and per player-day stated (rule 7)

## Dates
- Block X: file fix + loud `readPicks` **before Mon 23 Nov** (owner, 12 Nov: brought forward from Mon 30 Nov).
- Race: file fix + loud `readPicks` before Mon 7 Dec. Questions: compact format before ~2,000 weekly players. Last Node: rules 2-3 in its launch PR.
- Kit: rules 2-4 in the kit before the next kit game's first paid week.
- Golf, Bracket, Fantasy, Combo, Survivor: rule 1 measurement before their first paid week.
