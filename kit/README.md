# Shared Game Kit (`kit/`)

One implementation of the recorder rules every Knode Games game follows (`.ai/standards/RECORDER_STANDARD.md`), so a game
supplies only its own rounds, results and scoring. The standard is `.ai/standards/GAME_KIT.md` (D-146, D-158, D-160).
Owner: the Architecture chat. Games never edit `kit/` (D-035): they ask through the owner.

**Holds no keys, signs nothing, sends nothing.** It reads the chain on two nodes and writes files that the publish job checks.
The publish job runs no repository code: its check (`publish/check.inline.mjs`) and, for ruler games, the whole
`vhp_ruler.py` are written into the workflow byte for byte, and tests keep those copies equal to the files.

## Where it stands (12 Nov 2026)
| Piece | PR | State |
|---|---|---|
| Core: two-node reads, open → pending → final week, holds, boards, payout (D-152, D-159), vault file, publish check | #210 | merged 9 Nov (Repo Lens #F-5 GO) |
| Phase 1 (Fantasy): FC-13 clock cap, FC-26 earning weeks, all-time board and medals, carried state (FC-5), picks sources + `weekExtras`, `ctx.published`, write-once inputs file (FC-9) | #261 | merged 11 Nov (#G-13, #G-14 GO) |
| Phase 1b: the VHP ruler as a source (`ctx.vhp`), card lists, the publish job rebuilding every card with the embedded `vhp_ruler.py` (G3), `cardPerRound` | #267 | merged 12 Nov (#G-24, #G-26 GO) |
| `ctx.blockAt` / `lastPickBlock` (G7), `game:check` for every Phase 1 / 1b hook, the Fantasy-shaped fixture, render tests that survive `main` moving | this PR | see the PR |

**No game runs on the kit yet.** Fantasy (games 4 and 5) is the first (PR #266, the Fantasy chat), then new games (Last Node,
Combo, Survivor). Games already live on their own recorders (Block X, the Race, Daily Questions, Bracket, Golf) stay there
unless the owner decides to move one (GAME_KIT §6: replay, two shadow weeks with zero differences, then a switch PR).

## Files
| Folder | What |
|---|---|
| `recorder/types.ts` | the `GameModule` a game implements (`games/<slug>/recorder.ts`), its contexts, `PENDING` / `VOID` / `NotYet` |
| `recorder/runtime.ts` | one hourly run of one game: clock → inputs → carried state → rounds → picks and stakes on both nodes → results → week file → board, all-time, vault file |
| `recorder/clock.ts` | vault weeks, the round's day (`dayOf`), Sunday, results due (Thu 00:00), chain time |
| `recorder/nodes.ts` | two-node reads (`agree`), read budgets, retries on network errors only, a read-only koilib node (vault, other contracts, `head`, `blockTime`) |
| `recorder/sources/` | `vault-answers` (game 1), `vault-stakes`, `picks-contract`, `race-picks`, `published` (other kit games' finals), `vhp-ruler` (`ctx.vhp`), `block-at` (`ctx.blockAt`, `lastPickBlock`) |
| `recorder/store.ts` | last run's files (refuses without the fetch mark or with an unreadable file), writes under the 2 MB cap |
| `recorder/lifecycle.ts` | open → pending → final (Mon 00:00, re-read, two runs ≥ 1 h apart), holds and releases |
| `recorder/boards.ts`, `payout.ts`, `vaultfile.ts`, `alerts.ts` | board.json, the paid set and vault values, the vault file, alerts |
| `recorder/manifest.ts`, `recorder/cli.ts` | a game's settings from its `game.json`; `npm run kit -- <slug>` |
| `publish/check.inline.mjs` | the publish job's check AND the week tally the recorder uses (one copy); imports only `node:fs/path/crypto` |
| `publish/render.mjs` | renders a data branch's kit jobs (record jobs, the ruler step, the publish job); `npm run kit:render` writes them into the workflow |
| `testing/` | fake nodes and clock, hour-by-hour replay through the real publish check, the conformance suite, the ruler test chain, the `kit-example` and `kit-ruler-example` fixtures |
| `tests/` | the kit's own tests (run by `npm run test:audit` through `tests/audit/kit-suite.test.ts`) |

## How one hour works
1. **Clock.** `now` = the lower of the two nodes' chain times, capped at the runner's clock (FC-13); stalled or far-apart nodes stop the run.
2. **Inputs.** A game with an inputs file (FC-9) makes next week's `inputs/W<w>.json` inside its window before the week opens, on both nodes. The ended week is scored on its published file and recounted; a recount that differs holds the week.
3. **Carried state** (FC-5). The week before must be final; its `next` passes through `carryIn`. A missing week file stops the chain unless it's the game's first week or the owner sets `<SLUG>_RESET_FROM_WEEK` (G13-1).
4. **Rounds, picks, stakes.** `roundsFor`; picks from the Picks contract for every `pickRound` (and extra sources for `weekExtras`); stakes from the vault for every wallet that picked or carries a state. Both nodes must agree.
5. **Results.** `resultOf` per round on both nodes, with `ctx.vhp` (ruler cards) and `ctx.blockAt` (a block at a UTC time). `NotYet` = pending; a difference between the nodes = pending with an alert. Ruler games need a card per decided round (`cardPerRound`).
6. **Files.** The week file (rows for every wallet, hash over everything that decides money), board.json, alltime.json, the vault file only for a week the game earns in the vault (FC-26), HOLD files when a final week reads differently.
7. **Publish job.** Rebuilds every new ruler card from the published `vhp-data` with the embedded `vhp_ruler.py` (G3), then the inline check: shapes, write-once, recounts, the hour after the pending copy, the results window. Anything wrong is held with an alert; other games still publish.

## Key decisions
| Decision | What it means |
|---|---|
| D-146, D-158, D-160 | One shared kit; every new game launches on it; the kit core shipped alone |
| D-152, D-159 | Paid set and free places are computed once, here |
| D-135 | Final only after a 2 h stability wait (an hour after the pending copy could be published) |
| FC-9 (owner, 6 Nov) | Inputs (Fantasy's price list) are a write-once file, never game code in the publish job |
| G3 (owner + Ruler chat, 11–12 Nov) | The publish job embeds the whole `vhp_ruler.py` and rebuilds every new card; published files aren't rebuilt again |
| G13-1 | A gap in a game's weeks never silently resets carried state |
| `cardPerRound` (Library, 12 Nov) | On by default for ruler games; no extra pin |
| G7 (Block X + Fantasy, 12 Nov) | A time-locked round's last pick block is `blockAt(lock) − 1` (`lastPickBlock`) |

## Known gaps (none block Fantasy's port)
- The ruler's optional `include` (G6) and `mode` card settings aren't in the kit's strict card settings yet: they join with the Ruler PRs that bring them (until then such a card fails closed).
- A ruler game can't decide a round without a card except by `cardPerRound: false` (GAME_KIT §3).
- The publish job's card rebuild hasn't been timed on the real `vhp-data` (about 30 days); 15 days of made-up data took about 4 s. Watch the first Fantasy publish runs (10-minute job limit).
- `ctx.blockAt` reads aren't counted in the run's read budget; each search is capped at 80 reads and memoized.
- On Windows (Node 24) a few bash-only tests skip, and the symlink part of one publish test skips when Windows refuses symlinks. CI is Linux.

## Changing the kit
Repo Lens on every change; tests with every change; `npm run kit:render` after a change to `publish/` or to `vhp_ruler.py`
(a test fails if a committed workflow differs). One PR at a time; `git add` with explicit paths; tell the Library first.
