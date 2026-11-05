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
| `sims/ruler/` | The 11 simulations of §8 (`sims.mjs`, `faults.mjs`), the real-data run (`real.mjs`), `dump.mjs` (a logged history back into a timeline), and `sample.mjs` (the Bracket's 8-day sample as a timeline). |
| `tests/audit/vhp-ruler.*.test.mjs` | The tests: math, data format, recorder and fill (simulated nodes), workflow and publish job (run against a scratch repository), simulations. |

## How a game uses it
1. Read the `vhp-data` hours that cover its card: from 14 days before the card moment (form) to the end of its scoring window.
2. `KRuler.ledger(KVhpData.timelineFrom(hours, checks))`, then `KRuler.makeCard(L, { game, round, window: { W0, W1, L, S0, S1 }, c, ownRule, paying, pooled })` once the seed block (L + 20) is irreversible, and `KRuler.scoreCard(L, card)` once S1 is.
3. Score with **credited blocks** (`credited`), never raw blocks (§3.1), and the game's own formula.
4. In the game's publish job: `python3 vhp_ruler.py`'s `recompute_main([vhp-data dir, card file, settings file])` (embedded, like the ruler's own publish job) refuses any card the data doesn't give byte for byte. The settings file is the game's own `{game, round, window, c, minK, poolRule, ownRule, paying, pooled}`, every key, from the game's code, never from the card.
5. A paying card isn't made, or scored, while a chained catch-up hour that no live hour has checked yet is in its windows ("not yet"): try again after the next live hour.

## Turning it on (owner, after Repo Lens review 2)
1. Merge the PR (the owner merges).
2. Optional: a repository variable `RPC_VERIFY` naming a third Koinos node. The publish job (which runs no repo code)
   reads every new block's id and signer again itself, on `RPC_VERIFY` if set, else on `RPC_CHECK` (Repo Lens #D-10 M-1).
3. Set the repository variable `VHP_RULER_ENABLED` to `true` (Settings → Secrets and variables → Actions → Variables).
4. Actions → "VHP ruler data" → Run workflow → mode `fill` (about 10–15 minutes of reading: one day of blocks reads in about 1 minute per node; the publish job then checks every block again, up to about an hour).
5. From then on it records every hour by itself. No key, no Mana, no secret.

## If it falls behind (a node down, the ruler switched off, a GitHub outage)
Usually nothing to do by hand. More than 12 hours behind, each run shows a red `::error::` "the VHP ruler is N hours
behind". More than about 5 hours behind, it writes **chained** hours (balances carried forward from the hour before,
blocks checked on both nodes, no reads), up to 48 a run, until it is about 2 hours behind; the next run then reads live
again. A live run reads once, for its newest hour; the older hours of that run are chained and checked by it in the same
publish. So every hour file holds its own blocks plus at most about an hour more, and a day file stays near 3–5 MB, far
under the publish job's 16 MiB limit (Repo Lens #B-6 D-1). A chained hour's anchor is its own last block, or the previous
hour's anchor when that one is later. Chained hours with no live hour after them are unverified: a paying card that
would read one waits ("not yet … from block N"). A node that can't answer a read stops the run without writing anything;
the next run tries again. If a run fails the same way hour after hour (a red error each hour), or a day can't be rolled
up ("over the … byte limit"), that needs a look: send the error to the VHP Ruler chat. A day that can't be rolled up
keeps its hour files, and retention doesn't remove them, until that is handled.

## v2.1 (R-RULER-2, branch `vhp-ruler-v21`; not on main, nothing pays on it)
Built from `.ai/standards/VHP_RULER.md` §16 and the owner's rulings of 5 Nov, both languages byte for byte (`RULE_VERSION` 3):
- **`pct(λ, x)`** (Fix A): the mid-p Poisson percentile of credited blocks against expected blocks, millionths, exact
  integers; below 1 unless λ = 0 (#B-9 B9-3).
- **`fpct(n, a, b, x)`** (A′): the mid-p binomial percentile of credited blocks among the field's own signed blocks (the
  field = producers with entry that aren't void). A jump that moves the whole network moves no one's percentile.
  **The field's totals (#B-10 F1):** n and b come from the field's *core*, its members at form ≥ 0.80. Each producer's
  b counts the other core members at expected × `rate` and itself at full size. A member below 0.80 (a steady
  throttler) is scored against the core plus itself at full size and counts in no one else's totals, so a throttled or
  parked address can't lift anyone's percentile, and can't move them by suddenly signing in full.
- **`void`** (owner, 5 Nov): a producer whose effective VHP is outside the card's own × (1 ± 10%) at any block of the
  scoring window is void for that race (out of A′'s field, `fpct` null); the next race it plays as usual. Whatever caused
  the gap counts ("any time": a move after the card, or with `avg24h` a move in the 24 h before T). **Pools and the
  Vault get the same rule** (owner, 5 Nov). About 1–1.6% of producer-races on real days.
- **What a void means for picks** (owner, 5 Nov; for every game that uses the ruler): a pick on a void producer **counts
  as a loss**, never a refund, so voiding a losing producer late gains nothing (#B-10 V2). A whole round or race that
  is void gives players their pick back; the Mana spent on it is not refunded.
- **Throttlers** (owner, 5 Nov, D-120): a steady producer (every daily rate within ±0.15 of its 14-day rate) is in the
  field whatever its form; everyone is expected at full size (any expectation lowered to a producer's own throttling can
  be beaten on purpose, #B-9 B9-2); `rate` is shown on the card only.
- **Settings** `minK` (entry bar, whole blocks; 10) and `poolRule` (`min` only; `twa` removed, #B-9 B9-1), required in
  `recompute`.
- Simulations: `sims/ruler/v21.mjs` (each race drawn as on chain: a chain of exact binomials), `sim11.mjs`, `voids.mjs`,
  `jumps.mjs`. Results: project doc `claude/ruler/V21-SIM-REPORT.md`.
