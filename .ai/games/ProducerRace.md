# Producer Race (game 7)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Race "KG 02 · Hub + Race Show", Hub, Vault, Block X chats), `DECISIONS.md` (D-033 – D-035, D-062, D-063, D-078, D-107, D-125, D-129), the repo. **Last updated:** 5 Nov 2026; previous version `../archive/2026-11-04b/games/ProducerRace.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A fun, fast race between Koinos block producers: four races a day, each a mini "horse race" where handicaps level the field so small producers can win too. It also feeds other games — Combo Card legs and a Block Golf hole.

## Gameplay
- **Four 6-hour races a day, Monday to Saturday** (D-125, from vault week 3 = Week 1): 24 races a week, starting 00:00, 06:00, 12:00 and 18:00 UTC. **Sunday UTC is the review day**, but its four races still run as **fun races** (D-129, PR #155 ✅): picked, scored and shown on the Today and All time boards, never on the week's board, medals, prizes or vault file. Handicap cards are taken on Sunday as on any day (Block X scores with them, Repo Lens #C-7 C7-2). Each race has six 1-hour legs with an hourly **handicap card** (races before 27 Oct had 3 cards). ✅
- Players pick producers ("horses"). Picks lock when a race starts; up to 5 picks a day, changes included. The sponsor pays the Mana. 💬
- A pick's time (`pick.at`) is its latest pick or change. 💬
- Results use only irreversible blocks that match on two nodes. 💬
- Owned entirely by the Race chat (D-035). Contract: Race picks `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` ✅.

## Scoring
- **Today: win 3 points, show 1 point** (show = 2nd or 3rd with at least one step) (D-033). 💬 **With the race types (D-173, owner 10 Nov): points per place, 1st / 2nd / 3rd:** 1- and 2-hour 3/2/1, 6-hour 4/2/1, daily 6/3/2, weekly 12/6/4. They arrive WITH the types, not before (`TYPES_ON_WEEK`): then the whole history is scored by the new table, except weeks already paid under the old one (`PRIZES_FROM_WEEK` <= week < the types' week), which keep their old points so a board never disagrees with what the vault paid. Ranking and payout rules (D-152, D-159) are unchanged; only the points per place change.
- **Ranking:** points, then wins, then picks placed; wallets still tied share the place (D-034). 💬
- A race that won't finalize is skipped; its picks don't count and it is listed in `skipped`. 💬 (The skip window was "12 h after the week ends" under the old hold; current value ❓.)
- Vault file `race-data:vault/W<week>.json`: `rows` = staked players with ≥ 1 point, as 255, 254 … per tied group; `first` / `second` = free winners, at most 10 each. 💬
- **Timing:** `../standards/WEEK_CYCLE.md` (the one home for game timing). The Race is on the weekly rhythm (D-125, PR #149 ✅; Sunday fun races D-129, PR #155 ✅).
- **How the Race closes a week:** from Sunday 00:00 UTC the recorder publishes the week as pending (`vault/PENDING-W<week>.json`) and checks each new pending file against the chain. It goes final at the first Monday run (≈ 00:37 UTC) once two runs an hour apart agree and the chain still matches; the publish job allows a final file only from Monday 00:00 UTC. It alerts if still not final 3 h after the week. The chain re-check confirms each race's stored heights with 4 block reads, 4 races at a time, with one 10-minute deadline for the whole run; running out waits, it never holds (C7-1, F-1). Sunday fun races aren't re-checked (nothing pays on them). ✅
- *Superseded:* the 12-hour hold after the week (I-034, 3 Nov) was replaced by the weekly rhythm from Week 1 (D-125).
- **Owner's hold:** the repo variable `RACE_HOLD_WEEKS` (e.g. `3`) holds a week; remove it to release. Each run's notes list the pending winners and flag free winners whose first race was that week (I-035, option A). While it names a week the alert (failed run and email) comes once a day, on the 16:37 UTC run (L-4, owner 4 Nov); a mismatch, unreadable stakes or any other system hold still alerts every hour. ✅
- **Payout safety (PR #133 ✅, D-107):** a held week fails the run and says what to do; the publish job recomputes the vault file's rows from the week files (I-085); published final race results are locked.

- **On the VHP ruler (owner, 11 Nov 2026; `bot/race-ruler.ts`; docs/VHP-RULER.md "Switching a game onto the ruler"):** switch `RACE_RULER_FROM_WEEK` (empty = off; N = shadow in N − 1, on from N; read strictly). Switch set to 4 (owner, 12 Nov): week 3 shadow, **on from Week 1 (vault week 4, Mon 16 Nov)**. The race types (option A, owner 12 Nov) are scored by the ruler from their first race and only in an ON week (`RULER_TYPES = [0, 1, 2, 3, 4]`, `R<week>-<type>.json`, blocks from the hour ledger, card windows 1,200 / 2,400 / 7,200 / 7,200 / 7,200 by type; shadow cleared from history, `claude/race/SHADOW-FROM-HISTORY-RACE-TYPES-2026-11-12.md`; in any other mode their picks count nothing). A race waiting only for its ruler card keeps an ON week open up to 48 h after the week ends (`RULER_GRACE`), and the owner is alerted 3 h after a race when its card is late (`RULER_FIX`, the Ruler chat's line). Settings (Ruler chat): game 7, c 500000, ownRule spot, minK 10, poolRule min, pooled = the Vault, paying; round = yyyymmddhh × 10 + type; window from the race's own recorded blocks [S0, S1] (its first and last block, about 7,200), L = S0 − 1 (the last block a pick can be in: the contract locks at the start), W1 = L, W0 = L − 7,199. ON: 1st / 2nd / 3rd = fpct order among the producers with entry and not void (equal fpct: by address); a pick on a void producer is a loss; a race whose whole field is void counts no pick; the points per place are unchanged. `R<week>.json` (every week, every mode): `{v, week, rulerFrom, mode, shadow, races: [{id, round, window, card, note, placings}]}`; the W files are unchanged (Block X, Combo and Golf read them; the handicap race is the page's live estimate). The publish job embeds `vhp_ruler.py` (`node tools/race-ruler-embed.mjs` after any change to it), rebuilds every new card from the Race's own settings (`recompute`), checks the placings, refuses a switch change that changes a started week (`switch_change`), and recounts an ON week's vault rows from the ruler's placings (a shadow week's never). 💬

## Rewards
- **Staked** (staked in game 7 that week): share the game's bucket; medals go to the vault's top 30% by headcount, rounded up, tied groups whole. 💬
- **Free play:** 2 VHP for 1st, 1 VHP for 2nd (D-062), from the vault's start. A tie for 1st shares all 3 VHP and 2nd stays empty; more than 10 tied → the 10 with the earliest first pick that week share. Any free player can win — no VHP or minimum play needed. Medals only on weekly boards. 💬 **⚠ This is today's code, not the rule: D-159 pays exactly 10 by earlier score time, then address, never zero for the cap (I-104, fixed in code separately).**
- **Weeks before the first paid week pay nothing** (owner, 10 Nov): the first paid week is vault week 4 (Mon 16 Nov = players' Week 1); week 3 (Mon 9 – Sun 15 Nov) is a practice week on the same schedule. The recorder and the publish job both read the repository variable `PRIZES_FROM_WEEK` (the one Block X reads; unset or not a plain week number = no prizes, fails closed), so the two games start together. The page's prize text names Mon 16 Nov: change it if the variable changes. 💬 Vault

## Dependencies
- Race picks contract and the recorder `bot/race.ts`, run by `race.yml` hourly at :37 while `RACE_ENABLED=true` ✅; shared rules `race-math.js`. 💬 Race picks owner: the new cold owner `1LMV8EcR…` since 4 Nov ✅.
- Two nodes (`RPC`, `RPC_CHECK`) and the `race-data` branch. ✅
- Vault v6: registration (`game-add 7`, then apply) before it earns; stake reads via `get_game_player`. ✅
- Site: `race.html` with `#stake-badge` (PR #44 ✅) and the shared panel; `board.js`; the Games page link to `race.html#stake`. ✅
- **Nicknames (D-078):** `race.html` loads `names.js` before `race.js` and allows `names-data` in its CSP. `race.js`'s `nameOf` shows `KNames.of(address)` (name · short address) for every producer and player: horses, card, paddock, feed, results, pick lists and both boards. It redraws on `KNames.onChange` and falls back to the old built-in names if `names.js` is missing. Display only. ✅ (merged, PR #62, 3 Nov)
- The VHP sampler (`race-samples.yml`) feeds the handicap cards here and in other games; it takes up to 12 samples a run (PR #67).
- The Mana sponsor's Race pick row (`../platform/SPONSOR.md`).

## Current status (5 Nov)
- **Live as a game.** Vault `game-add 7` sent 3 Nov (tx `0x1220d394…`); **`game-apply 7` done 5 Nov** ✅ (on chain `from_week` 3; the Race's week-3 file lists nothing to pay, see above). Free-prize switch: ON (D-082). First paid week 4 (Mon 16 Nov) by the `PRIZES_FROM_WEEK` variable. 👤 / 💬
- **Race types (D-166, built on `race-types`, off until `TYPES_FROM_WEEK`):** 1-hour (24 a day), 2-hour (12 a day), 6-hour, daily and weekly (Mon–Sat) races; points per place 3/2/1, 3/2/1, 4/2/1, 6/3/2, 12/6/4 (D-173; first version 2/1, 2/1, 3/1, 6/2, 12/4) on the one board; a toggle per type on the page. Contract v2: race = type × 2^48 + index, always below 2^53 so browsers send it exactly (type 0 = the 6-hour race, v1's numbers unchanged; the pick is still three fields, so the Mana sponsor needs no change), daily limit 0 = none. Recorder: the hour ledger (each producer's blocks per UTC hour, both nodes) and `T<week>.json` with the week's 260 typed races; W files and Block X unchanged. Turning it on: upload v2 (Monday 01:40–06:30 UTC), set `TYPES_FROM_WEEK`, `npm run racepicks -- limit 0 --send`. **Owner, 13 Nov: live from vault week 5 (Mon 23 Nov 2026, Week 2), all four types, Ruler mode A** (`TYPES_FROM_WEEK = 5`, merged only after the v2 upload and `limit 0`; v2 `9993581b…` pinned, Repo Lens #G-47; R-RACE-18 done in #287).
- **Who gets paid (D-152, ties across the line)** and the paid set past 255 scores (I-086): PR #182, Repo Lens fix-check next.
- **On the weekly rhythm** (#149, #155 merged) and **payout safety merged** (#133, test fix #153). ✅
- **Pays from 16 Nov (week 4) with its two known handicap gaps open** (the > 6-h hide and VHP added after a card) until the one VHP ruler lands (D-094, D-090, D-093).
- The v6-ABI stake fix `d7fad7c` (B1-1) and the RV-1 process exit are on `main` (PR #57, Repo Lens round 12 GO; the Race notes said 13, the owner and other files record 12 ❓) ✅. Nicknames on the page (PR #62) ✅.
- **Guest picks work** ✅ (I-083 closed); the page's wrong "used up" message is still open (I-082, R-RACE-7).
- Work list: `../platform/CHAT_REQUESTS.md` → Race.

## Known issues
- **I-035:** owner chose option A (3 Nov): accept the risk for now, flag new-wallet free winners in the run notes, use the review day and the hold; revisit (option B: hold ≥ 1 VHP at a random moment) if farming shows up.
- **I-037 B1-4 (fixed in PR #182):** a bad vault folder (an unexpected or nested file, over 2 MB, not in the recorder's own JSON form) is now held on its own with an alert; the race cards still publish. (B1-5 shipped with PR #57.)
- **Who gets paid (D-152, PR #182):** exactly the top 30% of earning stakers; a tie across the line lets in who reached the score first (latest scoring pick), the rest take the next place. Free prize: each place up to 10 wallets (D-159), same tie-break.
- **I-086 (fixed in PR #182):** past 255 different staked scores, the vault values keep the paid set (top 30%) apart: unpaid wallets get 1, paid groups never share it (`rowValues`; the publish job's recompute mirrors it using the board's `earns`).
- **I-028:** "Staked board" is based on `peak_stake` — a mid-week withdrawal below the minimum forfeits the week; the panel should explain this.
- **I-030:** with `RPC_CHECK` off, stakes are classified on one node without a warning. **I-029:** board reads grow with players.
- **I-027 / I-069:** page text still says the vault isn't live; week labels to refresh.
- **I-031:** the Race files Block X changed came into `main` with PR #57; the Race chat confirms nothing is left (R-RACE-8).
- **I-082:** wrong "Today's picks are used up" message on the page for any sponsor refusal.
- **Handicap gaps (D-094, `../archive/2026-11-05/HANDICAP_REVIEW.md`):** hiding VHP for > 6 h then restoring it pays (proved 60 of 60 races); VHP added after a card earns more blocks at the old handicap for ~1–1.5 h.
- *Closed:* I-034 (superseded by the weekly rhythm), I-085 and I-087 (PR #133), I-083 (sponsor guest fix).

## Future plans
- Move to the one VHP ruler (D-058, D-090, D-093): card credit, highest VHP over a ~2-week look-back, averages for others (R-RACE-5, R-ARCH-1).
- Weekly checks that each `vault/W<week>.json` is final and sensible.
