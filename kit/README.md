# Shared Game Kit (`kit/`)

One implementation of the recorder rules every Knode Games game follows (`.ai/standards/RECORDER_STANDARD.md`), so a game
supplies only its own rounds, results and scoring. The standard is `.ai/standards/GAME_KIT.md` (D-146, D-158, D-160).

**Holds no keys, signs nothing, sends nothing.** It reads the chain on two nodes and writes files that the publish job checks.

| Folder | What |
|---|---|
| `recorder/types.ts` | the `GameModule` a game implements (`games/<slug>/recorder.ts`) |
| `recorder/runtime.ts` | one hourly run of one game: clock → source on both nodes → rounds → results → week file → board → vault file |
| `recorder/clock.ts` | vault weeks, the round's day (`dayOf`), Sunday, results due (Thu 00:00), chain time |
| `recorder/nodes.ts` | two-node reads (`agree`), read budgets, retries on network errors only, a read-only koilib node |
| `recorder/sources/` | where picks come from: `vault-answers` (game 1), `vault-stakes`, `picks-contract`, `race-picks`, `published` |
| `recorder/store.ts` | last run's files (refuses without the fetch mark or with an unreadable file), writes under the 2 MB cap |
| `recorder/lifecycle.ts` | open → pending → final (Mon 00:00, re-read, two runs ≥ 1 h apart), holds and releases |
| `recorder/boards.ts`, `payout.ts`, `vaultfile.ts`, `alerts.ts` | board.json, the paid set and vault values, the vault file, alerts |
| `recorder/manifest.ts`, `recorder/cli.ts` | a game's settings from its `game.json`; `npm run kit -- <slug>` |
| `publish/check.inline.mjs` | the publish job's check AND the week tally the recorder uses (one copy); imports only `node:fs/path/crypto` |
| `publish/render.mjs` | renders a data branch's kit jobs; `npm run kit:render` writes them into the workflow |
| `testing/` | fake nodes and clock, hour-by-hour replay through the real publish check, the conformance suite, the `kit-example` test fixture |
| `tests/` | the kit's own tests (run by `npm run test:audit` through `tests/audit/kit-suite.test.ts`) |

**Week file** (`W<NNN>.json`): `{ v, game, week, start, end, min, state, seen: {hash, at}, rounds, players }` with every round as
`[id, day, fun, status, [[wallet, points, at], …]]` — rows for every wallet that took part, so the publish job recounts the week
(entry rule included) without a per-game scorer (D-158 #3).

**Changing the kit:** Repo Lens on every change; tests with every change; `npm run kit:render` after a change to `publish/`
(a test fails if a committed workflow differs). Games never edit `kit/` (D-035): ask the Architecture chat through the owner.
