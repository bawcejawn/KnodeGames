# Fantasy Producers (game 4) and Weekly Rival (game 5)

> **Sources:** the Fantasy chat's notes in the Claude project (`claude/fantasy/SIM-FANTASY-ON-RULER-2026-11-11.md`, `claude/fantasy/TO-ARCHITECTURE-FANTASY-PORT-PREP-2026-11-11.md`), `DECISIONS.md` (D-059, D-081, D-150, D-158), the repo (`games/fantasy/`; the old recorder stays on branch `fantasy` @ `a60da0b` as the reference). **Last updated:** 11 Nov 2026 (the kit port and the owner's 11 Nov rules); previous version `../archive/2026-11-04b/games/FantasyProducers.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
Fantasy football for block producers: draft five producers under a salary cap, captain one, and score daily on how reliably they sign their blocks. Weekly Rival adds a friendly head-to-head challenge on top. It must feel inviting, professional and fun, and explain every number in plain words (D-059).

## Gameplay
- **Team (game 4):** pick 5 different producers from the week's price list, costing **100 or less** (more only if the five cheapest cost more); the first is captain (×2). A team carries on until changed. Picks lock 5 minutes before each UTC day; teams can be planned up to 7 days ahead. 💬
- **One change a day:** swap one producer, or move the captain's armband to a producer already on the team. A producer swapped in may also become captain as part of that same swap, from whichever producer wore the armband (FC-22, 👤 11 Nov). Monday's team may be any valid team. A pick that breaks a rule is ignored and the previous team plays. Late joiners score 0 for earlier days. 💬
- **Picks are public on chain before the lock** for the first week(s), and the Terms say so (👤 11 Nov). Hidden-until-lock picks (FC-14) go in as soon as the Picks contract supports them. 👤
- **Prices:** a write-once price list, published **Saturday 00:00 UTC** before the week and never changed (FC-9). The pool is every producer that passes the VHP Ruler's **80% form gate** (`entry`) on the last form day's card (👤 11 Nov). Form = the producer's credited ÷ expected blocks over the 7 UTC days from the Friday to the Thursday before the list (void days left out). Price = 20 + 1.5 × (form − the pool's median form), rounded half up, between 8 and 40; no form → 20. Each week starts fresh; last week's team carries into Monday only if it fits the new list. 💬
- **Weekly Rival (game 5):** one challenge a week, changeable until the week's first lock; anyone can challenge you. 💬

## Scoring
- **Measured by the VHP Ruler** (RULE_VERSION 4), one daily card per UTC day: each producer's `credited` and `expected` blocks. A producer's day = **100 × credited ÷ expected, at most 150** (👤 11 Nov; was 130); the captain counts double. Kept in hundredths on the kit (15000 = 150.00). 💬
- **Void only for a VHP move:** a producer whose VHP leaves the ruler's daily band (−12% / +50%) is void **that day only**: it scores 0 and that day is left out of its form. 👤 11 Nov
- **A quiet or offline day is not a void:** it scores what it earned (possibly 0) and counts in its form, so the price reflects downtime. A listed producer is never out of the game for any other reason. 👤 11 Nov
- A week's score is the sum of its 6 play days (Monday–Saturday). **Sunday fun round:** the Saturday team plays on; it counts on Today and All time only (D-150). 💬
- **Timing:** `../standards/WEEK_CYCLE.md`; on the kit, final from Mon 00:00 UTC after the week-end re-read on both nodes (`GAME_KIT.md`). 💬
- **Rival:** a match counts when both players are staked and both scored; records only. 💬

## Rewards
- **Staked:** D-152 (the top 30% of Fantasy stakers with at least 1 point; a tie across the line goes to who reached the score first). Vault values dense 255 → 1. 💬
- **Free play:** a Free play board; **no free VHP prize** until the owner switches it on (free-prize switch OFF, D-081). 💬
- **Weekly Rival and All time:** records only, no prize. 💬

## Dependencies
- **Shared Game Kit:** PR #261 (Phase 1), then **kit Phase 1b** (the ruler source: `vhp-data` read-only as `ctx.vhp`, a kit wrapper for `vhp-ruler.js`, the publish check's inline copy of the ruler's scoring). 💬
- **VHP Ruler:** PR #260 (merged), PR #262 (void-band length classes, so a UTC day keeps the daily band), and **G6** (a row on every day's card for every listed producer, whatever its activity in the 6 hours before the day). 💬
- **Picks contract:** register games 4 (list of 5, daily rounds) and 5 (one address, weekly), 48 h wait; a sponsor row for `pick` (limit 1.3 Mana, to measure). 💬
- **Vault:** `game-add 4 "Fantasy Producers" --staked --free --season 1`, free-prize switch OFF; `vaultGames.4` with its `boardCap`. 💬
- **Switches:** `FANTASY_ENABLED`; `FANTASY_RULER_FROM_WEEK` = the first live week (the practice week is the shadow week). 💬

## Current status (11 Nov)
- **The kit port is built in PR #266** (12 Nov): the rules (`games/fantasy/math.js`), the kit module (`recorder.ts`, `ruler-view.ts`) on kit Phase 1b's ruler source (#267, merged) and the planned `ctx.blockAt` (G7), the page (`fantasy.html`/`.js`/`.css`) on the kit's files, the rendered workflow jobs, the `vaultGames.4.kit` pin, and tests (end to end on the real ruler). Until G7 merges it makes no price list and decides no day (nothing is guessed). 💬
- **Still open:** the kit's conformance sample for a ruler game (needs G7 in the runtime), the #B-10 failing tests (the owner's zip), per-producer day scores on the page (kit G8). 💬
- PR #188 (old recorder) is closed unmerged; branch `fantasy` @ `a60da0b` is kept as the reference. 💬

## Known issues
- The "biggest producers only" edge (+28 points a day in the 14-day sim): several small producers sign below their share. Watch it in the practice week; if it stays, weight form more in the price.
- Score time for D-152 ties: when the team in force was picked (never before the week started), so between equal weeks the team picked earlier wins. Built as recommended; ❓ owner to confirm.
- The page can't show each producer's day score yet: the kit publishes only each card's sha256 (kit G8 asked).

## Future plans
Launch path: kit Phase 1b → G6 and #262 → this port PR (Repo Lens) → one practice (shadow) week → Picks registration of games 4 and 5 → vault `game-add 4` → `FANTASY_ENABLED`, `games.json`, menus. Open question for the owner: a Telegram reminder as well as the on-page one? Producer names are shared across games (Koinos @names, D-030).
