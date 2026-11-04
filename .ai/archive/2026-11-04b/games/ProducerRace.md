# Producer Race (game 7)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Race "KG 02 · Hub + Race Show", Hub, Vault, Block X chats), `DECISIONS.md` (D-033 – D-035, D-062, D-063, D-078), the repo. **Last updated:** 2026-11-03.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A fun, fast race between Koinos block producers: four races a day, each a mini "horse race" where handicaps level the field so small producers can win too. It also feeds other games — Combo Card legs and a Block Golf hole.

## Gameplay
- **Four 6-hour races a day**, starting 00:00, 06:00, 12:00 and 18:00 UTC. Each race has six 1-hour legs with an hourly **handicap card** (races before 27 Oct had 3 cards). 💬
- Players pick producers ("horses"). Picks lock when a race starts; up to 5 picks a day, changes included. The sponsor pays the Mana. 💬
- A pick's time (`pick.at`) is its latest pick or change. 💬
- Results use only irreversible blocks that match on two nodes. 💬
- Owned entirely by the Race chat (D-035). Contract: Race picks `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` ✅.

## Scoring
- **Win 3 points, Show 1 point** (Show = 2nd or 3rd with at least one step) (D-033). 💬
- **Ranking:** points, then wins, then picks placed; wallets still tied share the place (D-034). 💬
- A race that won't finalize is skipped 12 hours after its week ends; its picks don't count and it is listed in `skipped`. 💬
- Vault file `race-data:vault/W<week>.json`: `rows` = staked players with ≥ 1 point, as 255, 254 … per tied group; `first` / `second` = free winners, at most 10 each. 💬

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
- The VHP sampler (`race-samples.yml`) feeds handicap cards for other games (I-059).

## Current status (3 Nov)
**Live as a game.** Vault `game-add 7` **sent 3 Nov** (tx `0x1220d394…`), applicable from Thu 5 Nov 15:51 UTC: applied by Sun 8 Nov 4 PM PT, it earns from vault week 3 (Mon 9 Nov). Free-prize switch: ON (D-082). `PRIZES_FROM_WEEK = 3` is on main (PR #56) ✅. The v6-ABI stake fix `d7fad7c` (B1-1) and the RV-1 process exit reached main with the Block X launch merge (PR #57, Repo Lens round 12 GO — the Race notes said 13; round 12 is what the owner and the other files record ❓) ✅. Nicknames on the page (D-078): **merged (PR #62)** ✅. 👤 / 💬

## Known issues
- **I-034 (P1 before prizes):** a final vault file is decided by one run and locked forever, with no 12-hour hold.
- **I-035:** free-prize farming with many empty wallets on sponsored picks — owner decision.
- **I-037:** a bad vault file can stop the whole race run; slow stake reads could lose an hour's cards.
- **I-028:** "Staked board" is based on `peak_stake` — a mid-week withdrawal below the minimum forfeits the week; the panel should explain this.
- **I-030:** with `RPC_CHECK` off, stakes are classified on one node without a warning. **I-029:** board reads grow with players.
- **I-027 / I-069:** page text still says the vault isn't live; week labels to refresh.
- **I-031:** Block X changes the same Race files; the Race chat merges them by hand.

## Future plans
- Move to the VHP standard (cardVhp `k` with card credit, averages for others) (D-058).
- Weekly checks that each `vault/W<week>.json` is final and sensible.
