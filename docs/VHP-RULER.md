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
Usually nothing to do by hand. More than 3 hours behind (`BEHIND_ALERT` = 3,600 blocks; a normal run is 1 to 2 hours
behind), each run shows a red `::error::` "the VHP ruler is N hours behind", and the same words in plain language at the
top of the run page (GitHub's job summary). A failed run puts its error there too. Both end with the owner's one-line
step (`OWNER_STEP` in `bot/vhp-ruler.ts`; the Race's alert quotes it word for word): "GitHub → Actions → VHP ruler data:
if the latest run is red, click Re-run all jobs; missed hours are read back from the chain by themselves, and if it is
red again the next hour, send its error text to the VHP Ruler chat." More than about 5 hours behind, it writes **chained** hours (balances carried forward from the hour before,
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
**Read with the last section, "Rules for every race length" (RULE_VERSION 4), which replaces the void's ±10%, the
pooled-only `min` rule and the raw-block yardstick described here.**
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

## Switching a game onto the ruler (owner, 11 Nov 2026; a D-new, numbered by the Library)
Every game is meant to score on the ruler. Each one switches by **its own PR, made by its own chat**, with its own Repo
Lens GO (it is a money path). Order: by what is proven fair at the game's race length (project doc
`claude/ruler/FAIRNESS-BY-RACE-LENGTH-2026-11-11.md`): the Race's 6-hour race, Block X, then day-long games once the
daily-length fix passes; Last Node and Combo at launch; Survivor from Season 2 (`.ai/standards/VHP_RULER.md` §6). Merging v2.1 itself switches no one.

**The switch: one repository variable per game, `<GAME>_RULER_FROM_WEEK`** (for example `BRACKET_RULER_FROM_WEEK`).
- **Unset or empty:** every week scores with the game's own method, as today (D-094).
- **Set to vault week N:** week N − 1 is the **shadow week** and every week from N is **on**.
  - Shadow: the game makes and scores the ruler's cards and publishes the ruler's result **beside** its real one. It
    counts for nothing, isn't shown as a score, and never reaches a vault file. The ruler's weekly summary (`node
    tools/vhp-ruler-week.mjs`) for that week is checked before week N starts.
  - On: the ruler's cards decide the round (credited blocks, `fpct`, voids, as in the v2.1 section above).
- **Shared code, the same in both languages** (`vhp-ruler.js` / `vhp_ruler.py`, so the game's publish job, which embeds
  `vhp_ruler.py`, runs exactly the rule the recorder ran):
  - `switchFrom(v)` / `switch_from(v)`: reads the variable strictly. Empty → null; `1`…`999999` → the week; anything
    else (a space, `07`, a word) stops the run loudly. Never guess.
  - `rulerMode(week, from)` / `ruler_mode(week, from)`: `"off"`, `"shadow"` or `"on"`.
  - `switchChange(prev, next, week)` / `switch_change(prev, next, week)`: null, or why a change is refused. **A week that
    has started never changes whether the ruler scores it.** So a first switch-on during week w can be N = w + 1 (from
    next Monday); an "on" week never goes back; off and shadow may swap mid-week (shadow counts for nothing). A
    missing previous value counts as unset. Shadow data for any race length is also available from
    `node tools/vhp-ruler-shadow.mjs <vhp-data folder>` (the real ruler code on live data, read-only).
- **What each game's switch PR must do:**
  1. Read its `<GAME>_RULER_FROM_WEEK` with `switchFrom`, and record the value it used (`rulerFrom`) and the week's mode
     (`rulerMode`) in every week file it publishes.
  2. Its publish job compares the previous published week file's `rulerFrom` with this run's using `switch_change`, and
     holds the run (with an alert) if it is refused.
  3. Shadow: publish the ruler's cards (`makeCard` / `scoreCard`) and the result they'd give, marked `"shadow": true`,
     in their own file; the vault-file check refuses any row that came from a shadow week.
  4. On: score from the ruler's cards; the publish job rebuilds every card with `recompute_main` from the game's own
     settings (never the card's).
  5. Page text in the same PR: what the ruler measures, that a pick on a voided producer counts as a loss (D-164), and
     from which calendar Monday.
  6. Tests: the three modes, the refused changes, a shadow row never reaching a vault file, JS = Python.
- **Before setting the variable (owner):** `node tools/vhp-ruler-switch.mjs <N>` prints each week's mode with its
  calendar Monday and says OK or REFUSED. It reads the clock only.
- **Going back:** a week already played never changes method. If the ruler misbehaves in an "on" week, the game holds that
  week with its existing hold. Turning a game off for future weeks would need a later decision (an end week); there is
  none today.

## Rules for every race length (RULE_VERSION 4; owner, 11 Nov 2026; a D-new, numbered by the Library; on main since #260 and #262)
Until 11 Nov the eleven simulations had only been run on 6-hour races. Run at every length, v2.1 was fair from 1 to 6
hours and not at a day (win chances 0.65–1.45 of fair). Four changes, both languages byte for byte, make one rule set
for 1-hour, 2-hour, 6-hour, 1-day and 6-day races (results: project doc `claude/ruler/FAIR-RULES-EVERY-LENGTH-2026-11-11.md`):
1. **Expected blocks follow each producer's VHP block by block, capped at the card's own size, for every producer**
   (§3.2's pooled rule, now for all; `pooled` changes no number). The natural burn (about 1% a day), a withdrawal or a
   re-burn no longer leaves a producer measured against a stale size.
2. **The yardstick counts credited blocks**, the same blocks the expected blocks are for. Counting raw signed blocks
   against capped expected blocks raised every expectation a little whenever a member's VHP was above its card size;
   the same relative lift costs a producer in proportion to √(its blocks), so big producers lost and small ones gained,
   more the longer the race. This was the 1.2–1.25 edge left at daily length.
3. **The void band depends on the race's length, down and up apart** (`voidBand(blocks)` / `void_band`):

   | Race | Down | Up |
   |---|---|---|
   | 1–2 hours (up to 3,000 blocks) | 5% | 25% |
   | 6 hours (up to 9,000) | 10% (as D-164) | 25% |
   | 1 day (up to 36,000) | 12% | 50% |
   | longer (the 6-day race) | 15% | 100% |

   Each class reaches a quarter past its nominal length, so a race on UTC clock boundaries (about, not exactly,
   1,200 blocks an hour) stays in its class.

   Down is tight because shrinking once the luck is good ("stop when ahead") is the one mid-race move that gains: up to
   15% it gains nothing measurable, at 50% about +0.15 of fair, at 97% about +0.5 (`sims/ruler/midrace.mjs`); it must
   clear the natural burn (≈ 1% a day, ≈ 6% over six days without a re-burn). Up is wide because VHP added in the race
   is capped by card credit: it lowers the producer's own win chance and moves no one else. A void is for that race only
   (D-164); a pick on a void producer counts as a loss. On 30 days of live data no producer that only produced blocks and
   re-burned was void at any length; every void was a real stake move of 6% or more, all but two of 27% or more
   (`sims/ruler/moves.mjs`).
4. **The luck cap** (`LUCK_CAP`, 1,000 expected blocks): above it, a share of the window's blocks counts for that
   producer (`sample`, millionths, on every scored row; block H counts when the first 8 bytes of
   sha256("sample|" + seedBlockId + "|" + H), mod 1,000,000, are below `sample`; one draw a block, so the sets are
   nested). In a long race a big producer signs thousands of blocks, its luck all but disappears, and a 1% difference in
   uptime decides everything (±1% gave 0.18–2.90 of fair at a day and 0.00–5.90 at six days; with the cap, the same
   0.5–1.7 as a 6-hour race, `sims/ruler/lengths.mjs`). Short races are untouched unless a producer has more than about
   14% of the network in a 6-hour race.
- **No mid-race rebalance in any game.** Rule 1 already follows every producer down block by block. Re-measuring a
  producer UP during a race would let an unlucky producer add VHP and start over, so it is not done: VHP added in a race
  counts in full from the next race's card. The band is measured against the card's own size for the whole race and
  starts again with the next card.
- **Pass mark proposed for every length:** each honest producer signing in full within 0.90–1.10 of fair on a clean
  field (a result within 0.01 of a line passes, owner 6 Nov), and the averages of the big (> 5%) and small (< 1%)
  producers each within 0.95–1.05. On real history, where fewer cards carry each producer: 0.84–1.16 (D-170).
- **Block X** uses the card's `own` and `avg`, not `fpct`: with multiplier = the biggest full-signing producer's `avg` ÷
  `own`, credited at the target block, every full-signing producer's pick has the same expected payout. A cap on the
  multiplier breaks that for producers smaller than top ÷ cap (cap 3: under about 6% of the network).
- Row order now ends `… quality, sample, expected, signed, credited, pct, void, moves, core, z, setAside, fpct`.
- Design tools: `sims/ruler/lengths.mjs`, `midrace.mjs`, `moves.mjs`; `RULER_SIM_RACE=<blocks>` runs `v21.mjs` at any
  length with `--configs "v4 (as built)"`.

## Scoring modes A–D and the admin's mode schedule (owner, 11 Nov 2026; a D-new, numbered by the Library)
The owner wants fairness, the feeling that anyone can run a node and see it win, and enough variety that players can't
settle into a pattern: "build 3 additional VHP ruler formulas which can run alongside the active ruler method and allow
the admin the ability to shift future weeks". Live cards showed why: producers don't sign in line with their VHP. The
biggest nodes sign about 4–6% above their share (faster, better connected), several small ones below. Size is neutral
in the ruler, but in a race a few percent of signing decides the winner.

**What a mode changes:** only each producer's **target**, the blocks it must beat (row field `target` = `expected` ×
`lift` ÷ 1,000,000), and in D the luck cap. The entry bar, the card, the core (by 14-day form), the band and the voids
are the same in every mode (the core by 14-day form in RULE_VERSION 4; see RULE_VERSION 5 below). `expected` stays the VHP-based number, so games that read it (Fantasy, Block X) are untouched
unless they choose to use `target`.

| Mode | Name | Target | Luck cap |
|---|---|---|---|
| **A** | VHP only | `expected` (RULE_VERSION 4 as merged) | 1,000 blocks |
| **B** | clear edge, raise only | The node's record over the **11 days before the last 3** (`[T − 14 d, T − 3 d)`) is read **day by day**. Each day's measure is `(signed − 2√signed) ÷ expected share` (two standard deviations of luck taken off), against the field's expected-weighted median form that day. `lift` = the best day's ratio, never below 1; `target = expected × lift`. Only a clear edge raises a node; nobody's target is ever lowered | 1,000 |
| **C** | best day, raise only | as B with **one** standard deviation taken off (`LIFT_SD`), so a smaller edge raises the target | 1,000 |
| **D** | even odds | `expected` | **100 blocks**: every producer is scored on about 100 blocks' worth at most, so a race is mostly luck and node quality matters less |

- **Why no mode lowers a target.** A discount for a node that signed below its share was built and tested ("own pace,
  bounded": a target no lower than 97% of the VHP share). Any discount based on past signing can be steered (D-120):
  an 18% producer that signed 20% less for three days and then in full in a 6-hour race doubled its win chance under
  that 3% discount. So every mode is raise-only; the way for a weak signer to win more is to sign its share.
- **Why B and C read stretches, and not the last 3 days (Repo Lens #G-19).** A raise read on the recent past can be
  escaped the same way: sign less before the race, then in full in it. The first B (14-day form) and C (3-day pace) let
  an 18% node escape half its raise with three days of signing 6% less. Now:
  - the last 3 days (`LIFT_SKIP` = 86,400 blocks) are not read at all, so a steer just before a race changes nothing;
  - the raise is the **best** day, so a node escapes it only by signing less on **every** one of the 11 days
    (`LIFT_SPAN` = 316,800 blocks), which costs it far more blocks than the raise is worth;
  - two (B) or one (C) standard deviations of luck are taken off each day, so a lucky day doesn't raise a node that signs
    its share (tested on a field where every node signs exactly its share: no mode moves anyone's win chance).
  - Tried and dropped: three 3.7-day stretches for B (an 8-day steer escaped 40% of the raise); a raise from the node's
    size class (others' form; unsteerable, but less fair than mode A).
  Measured (`sims/ruler/steer.mjs`, the exact code; the lab study on real vhp-data is in the project doc
  `claude/ruler/MODES-B-C-REWORK-G19-2026-11-12.md`).
- **A card without a mode** is byte-identical to RULE_VERSION 4. A card with a mode records `mode` after `poolRule`
  and each scored row carries `lift` and `target` (millionths) after `moves`. `pct` and `fpct` use the target.
- **Mode A with the key present** gives the same numbers as no mode (lift 1), only the extra keys.
- **The game's settings** may carry `mode` (optional, one of A–D); `recompute` requires the card's mode to match the
  settings, and refuses any other value.
- **Measured on live cards** (`tools/vhp-ruler-shadow.mjs … --modes A,B,C,D`, 60 recent races): see the project doc
  `claude/ruler/MODES-A-D-2026-11-11.md`.

**The admin's schedule, one repository variable per game, `<GAME>_RULER_MODE`:** week:mode pairs with rising weeks,
like `5:B,8:C` (mode B from vault week 5, C from week 8). Before the first pair, or when the variable is unset, the mode
is A.
- `modeSchedule(v)` / `mode_schedule(v)`: strict parsing; anything odd stops the run.
- `modeAt(week, schedule)` / `mode_at`: the mode of a vault week.
- `modeChange(prev, next, week)` / `mode_change`: null, or why a change is refused. **A week that has started never
  changes mode**, so the admin can only shift future weeks. A game's publish job compares the previous published week
  file's recorded schedule with this run's, like the switch.
- **Before setting it:** `node tools/vhp-ruler-mode.mjs "6:C"` prints each week's mode with its calendar Monday and OK or
  REFUSED.
- **What a game does with it:** read the variable, take `modeAt(week, schedule)` for the round's vault week, pass it as
  `mode` in the card's settings, and record the schedule and the week's mode in the week file. The publish job's
  `recompute_main` settings file must carry the same `mode`.
- **Players aren't told which mode a week uses** (owner, 11 Nov). The card records it for audit.

## The kit's `include` option (Repo Lens #G-13 G6; owner, 11 Nov 2026)
A game whose players pick from a fixed list (Fantasy's price list) needs a row for every listed producer every day,
even one with no block in the 6 hours before T. The owner's rule: only a VHP move outside the band is a void; a quiet or
offline day scores what it earned and counts in form.
- **The setting:** `include`, a non-empty list of addresses in rising order with no repeats (`checkInclude` /
  `check_include`). The card records it (top-level `include`, after `mode`), and `recompute` requires the settings to
  carry the same list. Without `include` the card is byte for byte as before.
- **A listed producer that isn't active at T** gets a row from the same code: own, avg, k, form, expected, credited, void,
  fpct. Its `entry` also needs at least one block in its form window, plus the usual form gate (or steady) and minK. An
  offline day: expected > 0, credited 0. In the core, the band sets it aside, so it moves no one else.
- **The network total is unchanged** (Σ avg over active(T)), so every other producer's row is unchanged.
- **An address the data doesn't know** (no VHP, no block) is refused ("unknown address"), and the game holds the day.
- Not a RULE_VERSION change.

## RULE_VERSION 5: the core judged on the window that skips the last 3 days (owner, 12 Nov 2026; a D-new)
In RULE_VERSION 4, a node joins the core when its **14-day** form is at least `CORE_LINE` (0.97) of the field's median. A
node that signs far less for a few days before a race (for example half as much for 3 days) falls below the line, leaves
the core, and its race score rises in every mode (measured in `sims/ruler/steer.mjs`: about 0.58 → 0.65 in mode A, at a
cost of 5,100–14,700 blocks).
- **Version 5** judges the core on the form over `[T − 14 d, T − 3 d)`, the window modes B and C read: the median of that
  form over the field (weighted by expected blocks, an exact tie taking the lower value) and the 0.97 line. Each row of a
  version 5 card shows it as `coreForm`. The entry gate, expected blocks, the band, the voids and fpct's method are
  unchanged. A dip inside the last 3 days no longer moves anyone in or out of the core.
- **How a game takes it, per game, from a future week:** the settings carry `version` (4 or 5; 4 when absent). The card's
  `ruleVersion` records it, and `recompute` requires the two to match, so a version 4 card recomputes byte for byte forever.
- **The schedule, one repository variable per game, `<GAME>_RULER_VERSION`:** week:version pairs with rising weeks, like
  `6:5` (version 5 from vault week 6). Version 4 before the first pair and when unset. `versionSchedule` /
  `version_schedule` (strict), `versionAt` / `version_at`, `versionChange` / `version_change` (a started week never
  changes version), exactly like the mode schedule. Before setting it: `node tools/vhp-ruler-mode.mjs --version "6:5"`.
- **A game reads the variable every run,** records the schedule and the week's version in its week file, checks every
  change with `versionChange` against the last published value, and passes `version: versionAt(week, schedule)` in the
  card settings (and the same in the publish job's settings).
- **A season game** (Survivor) pins one version and one mode at the season's first week, for the whole season.
- **Plan:** shadow on Week 1 and Week 2's real races (`sims/ruler/steer.mjs <seeds> 5`, `tools/vhp-ruler-shadow.mjs`),
  the owner decides at the Tue 24 Nov review, and it is on from **Week 3 (vault week 6, Mon 30 Nov)** at the earliest.
