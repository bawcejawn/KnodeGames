# The shared VHP ruler (code)

The design is `.ai/standards/VHP_RULER.md` (v2, approved D-111; data rules D-112). This page says which file does
what and how to run it. Built by the VHP Ruler chat (R-RULER-1) on branch `vhp-ruler`.

## Files
| File | What it is |
|---|---|
| `vhp-ruler.js` | The pure math every game uses (no network): exact effective VHP (`ledger`), `own`, `avg`, `total`, `k`, card credit, `form` (a gate), `trim`, entry, the pooled rule, quality, the random card time, `makeCard`, `scoreCard`, `recompute`, the canonical card JSON. Integers only (BigInt). |
| `vhp_ruler.py` | Its Python twin (byte-identical cards, tested), the data checks, and the publish job's check. The publish job runs this file, embedded in the workflow. |
| `vhp-data.js` | The `vhp-data` file format (one file per block-hour of 1,200 blocks, hash-chained, two-node live reads) and its checks: `checkHour`, `checkDay`, `timelineFrom`, `makeHour`, `makeDay`. |
| `bot/vhp-ruler.ts` | The hourly recorder: reads the next irreversible block-hours on two nodes, live reads of every anchored address, writes and checks the hour files. Read-only. |
| `bot/vhp-fill.ts` | The first fill (30 days): a plan, three parallel 10-day jobs, then one live read and the hour files ("rebuilt", the last one "live"). Read-only. |
| `.github/workflows/vhp-ruler.yml` | record (hourly at :12) · fill (by hand, once) · publish (runs no repo code; pushes only `vhp-data`). **Generated** by `tools/vhp-ruler-workflow.mjs`: run `node tools/vhp-ruler-workflow.mjs` after any change to `vhp_ruler.py` (a test fails otherwise). |
| `.github/workflows/vhp-fill-time.yml`, `vhp-ruler-sims.yml` | Read-only runs on the `vhp-ruler` branch: the fill timing, and the 11 simulations on 31 days of real data. Remove once the ruler is live. |
| `sims/ruler/` | The 11 simulations of §8 (`sims.mjs`, `faults.mjs`), the real-data run (`real.mjs`), and `sample.mjs` (the Bracket's 8-day sample as a timeline). |
| `tests/audit/vhp-ruler.*.test.mjs` | The tests: math, data format, recorder and fill (simulated nodes), workflow and publish job (run against a scratch repository), simulations. |

## How a game uses it
1. Read the `vhp-data` hours that cover its card: from 14 days before the card moment (form) to the end of its scoring window.
2. `KRuler.ledger(KVhpData.timelineFrom(hours, checks))`, then `KRuler.makeCard(L, { game, round, window: { W0, W1, L, S0, S1 }, c, ownRule, paying, pooled })` once the seed block (L + 20) is irreversible, and `KRuler.scoreCard(L, card)` once S1 is.
3. Score with **credited blocks** (`credited`), never raw blocks (§3.1), and the game's own formula.
4. In the game's publish job: `python3 vhp_ruler.py`'s `recompute_main([vhp-data dir, card file])` (embedded, like the ruler's own publish job) refuses any card the data doesn't give byte for byte.

## Turning it on (owner, after Repo Lens review 2)
1. Merge the PR (the owner merges).
2. Set the repository variable `VHP_RULER_ENABLED` to `true` (Settings → Secrets and variables → Actions → Variables).
3. Actions → "VHP ruler data" → Run workflow → mode `fill` (about 10–15 minutes: one day of blocks reads in about 1 minute per node).
4. From then on it records every hour by itself. No key, no Mana, no secret.
