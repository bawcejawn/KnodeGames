# Producer Race (game 7)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Race "KG 02 · Hub + Race Show", Hub, Vault, Block X chats), `DECISIONS.md` (D-033 – D-035, D-062, D-063, D-078), the repo. **Last updated:** 2026-11-03; cleaned 2026-11-04; previous version `../archive/2026-11-04b/games/ProducerRace.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A fun, fast race between Koinos block producers: four races a day, each a mini "horse race" where handicaps level the field so small producers can win too. It also feeds other games — Combo Card legs and a Block Golf hole.

## Gameplay
- **Four 6-hour races a day, Monday to Saturday** (D-125, from vault week 3 = Week 1): 24 races a week, starting 00:00, 06:00, 12:00 and 18:00 UTC. **Sunday UTC is the review day**: no race, no card, and a Sunday slot is recorded as "review day, no race". Each race has six 1-hour legs with an hourly **handicap card** (races before 27 Oct had 3 cards). 💬
- Players pick producers ("horses"). Picks lock when a race starts; up to 5 picks a day, changes included. The sponsor pays the Mana. 💬
- A pick's time (`pick.at`) is its latest pick or change. 💬
- Results use only irreversible blocks that match on two nodes. 💬
- Owned entirely by the Race chat (D-035). Contract: Race picks `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` ✅.

## Scoring
- **Win 3 points, Show 1 point** (Show = 2nd or 3rd with at least one step) (D-033). 💬
- **Ranking:** points, then wins, then picks placed; wallets still tied share the place (D-034). 💬
- A race that won't finalize is skipped 12 hours after its week ends; its picks don't count and it is listed in `skipped`. 💬
- Vault file `race-data:vault/W<week>.json`: `rows` = staked players with ≥ 1 point, as 255, 254 … per tied group; `first` / `second` = free winners, at most 10 each. 💬
- **Hold before final (I-034, owner 3 Nov):** while a week settles, the recorder publishes `vault/PENDING-W<week>.json` (the file it would make final, and when it first saw it). `W<week>.json` goes final only **12 h after the week ends** and once that pending file has stayed **exactly the same for 1 h** across runs. The publish job checks the same rule on its own clock. A new pending file is dated at the end of its run. On the hourly schedule the two runs are an hour apart; a run started by hand can bring that down to about 25 minutes (the publish job accepts a pending file dated up to 35 minutes back), never to one run. The owner can hold a week by hand with the repo variable `RACE_HOLD_WEEKS` (e.g. `3`); remove it to release. Each run's notes list the pending winners and flag free winners whose first race was that week (I-035, option A). ✅ PR (R-RACE-1)
- **Weekly close on the rhythm (D-125, owner 4 Nov; replaces the 12 h hold from Week 1):** from Sunday 00:00 UTC the recorder publishes the week as pending and checks each new pending file against the chain. It goes final at the first Monday run (≈ 00:37 UTC) once two runs an hour apart agree and the chain still matches; the publish job allows a final file only from Monday 00:00 UTC. It alerts if still not final 3 h after the week. Rewards are claimable ~24 h after the vault seals (≈ Mon 5 PM PT).

## Rewards
- **Staked** (staked in game 7 that week): share the game's bucket; medals go to the vault's top 30% by headcount, rounded up, tied groups whole. 💬
- **Free play:** 2 VHP for 1st, 1 VHP for 2nd (D-062), from the vault's start. A tie for 1st shares all 3 VHP and 2nd stays empty; more than 10 tied → the 10 with the earliest first pick that week share. Any free player can win — no VHP or minimum play needed. Medals only on weekly boards. 💬
- **Weeks 1 and 2 pay nothing:** the vault never reads them (D-063). The site should show prizes from vault week 3 only (`PRIZES_FROM_WEEK = 3`). 💬 Vault

## Dependencies
- Race picks contract and the recorder `bot/race.ts`, run by `race.yml` hourly at :37 while `RACE_ENABLED=true` ✅; shared rules `race-math.js`. 💬
- Two nodes (`RPC`, `RPC_CHECK`) and the `race-data` branch. ✅
- Vault v6: registration (`game-add 7`, then apply) before it earns; stake reads via `get_game_player`. ✅
- Site: `race.html` with `#stake-badge` (PR #44 ✅) and the shared panel; `board.js`; the Games page link to `race.html#stake`. ✅
- **Nicknames (D-078):** `race.html` loads `names.js` before `race.js` and allows `names-data` in its CSP. `race.js`'s `nameOf` shows `KNames.of(address)` (name · short address) for every producer and player: horses, card, paddock, feed, results, pick lists and both boards. It redraws on `KNames.onChange` and falls back to the old built-in names if `names.js` is missing. Display only. ✅ (merged, PR #62, 3 Nov)
- The VHP sampler (`race-samples.yml`) feeds the handicap cards here and in other games; it takes up to 12 samples a run (PR #67).

## Current status (4 Nov)
- **Live as a game.** Vault `game-add 7` sent 3 Nov (tx `0x1220d394…`), applicable from Thu 5 Nov 15:51 UTC; applied by Sun 8 Nov 4 PM PT, it earns from vault week 3 (Mon 9 Nov). Free-prize switch: ON (D-082). `PRIZES_FROM_WEEK = 3` is on `main` (PR #56) ✅. 👤 / 💬
- **Pays from 9 Nov with its two known handicap gaps open** (the > 6-h hide and VHP added after a card) until the one VHP ruler lands (D-094, D-090, D-093).
- The v6-ABI stake fix `d7fad7c` (B1-1) and the RV-1 process exit are on `main` (PR #57, Repo Lens round 12 GO; the Race notes said 13, the owner and other files record 12 ❓) ✅. Nicknames on the page (PR #62) ✅.
- **Guest picks are blocked** by the sponsor check (I-083), and the page shows "Today's picks are used up" for it (I-082, R-RACE-7).
- Work list: `../platform/CHAT_REQUESTS.md` → Race (R-RACE-1 – R-RACE-8).

## Known issues
- **I-034 (P1 before prizes):** a final vault file is decided by one run and locked forever, with no 12-hour hold. **Fixed in the R-RACE-1 PR** (12 h hold + pending file + owner hold); closes when merged.
- **I-035:** owner chose option A (3 Nov): accept the risk for now, flag new-wallet free winners in the run notes, use the hold to review; revisit (option B: hold ≥ 1 VHP at a random moment) if farming shows up.
- **I-037:** a bad vault file can stop the whole race run (B1-4; the slow-stake-reads part, B1-5, shipped with PR #57).
- **I-028:** "Staked board" is based on `peak_stake` — a mid-week withdrawal below the minimum forfeits the week; the panel should explain this.
- **I-030:** with `RPC_CHECK` off, stakes are classified on one node without a warning. **I-029:** board reads grow with players.
- **I-027 / I-069:** page text still says the vault isn't live; week labels to refresh.
- **I-031:** the Race files Block X changed came into `main` with PR #57; the Race chat confirms nothing is left (R-RACE-8).
- **I-083 / I-082:** guest picks blocked by the sponsor check; wrong message on the page.
- **Handicap gaps (D-094, `../platform/HANDICAP_REVIEW.md`):** hiding VHP for > 6 h then restoring it pays (proved 60 of 60 races); VHP added after a card earns more blocks at the old handicap for ~1–1.5 h.

## Future plans
- Move to the one VHP ruler (D-058, D-090, D-093): card credit, highest VHP over a ~2-week look-back, averages for others (R-RACE-5, R-ARCH-1).
- Weekly checks that each `vault/W<week>.json` is final and sensible.
