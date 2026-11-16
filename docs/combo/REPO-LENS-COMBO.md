# Repo Lens: Combo Card (vault game 8)

The one-document view of the Combo Card area: what it is, how it is built, what it depends on, what is left. Written
by the Combo Card chat on Thu 12 Nov 2026 for the Combo pull request and its Repo Lens round. Game rules for players
and decisions: `.ai/games/ComboCard.md`. Audit history: `docs/history/AUDIT-2026-10-30-combo-repolens.md`.

## 1. What it is
A parlay game for points, never money. A card holds 2 to 10 legs (owner, D-180) from two other games:
- **Race legs:** Win, Show (top 3) and Top half on a 6-hour Producer Race.
- **Block X legs:** "producer P signs target block T" (T a multiple of 2,400).

Every leg must hit. A miss scores 0, and a void leg is dropped. Points are base[legs] × the product of the leg worths,
with base 3, 7, 15, 30, 60, 120, 240, 480, 960 for 2–10 legs. Each leg's worth is clamp(0.5 ÷ chance, 0.25, 3) for a race leg and
clamp(0.25 ÷ chance, 0.25, 6) for a Block X leg (D-188), priced when the card is sent. The limits are 3 cards a UTC day, each changeable 3 times.

A week is each player's best 10 cards. There are two boards: Staked, and Free play (anyone, guests included). The
Staked board earns Combo's share of the Vault's weekly reward. The Free play board pays no VHP until the owner switches
game 8's free prize on (it ships OFF).

**Status (Sat 14 Nov):**
- Nothing is on mainnet or on the live site.
- The contract (Picks v2) is rated ready in every review.
- Repo Lens #G-37 (the delta round on `f41f5bec`): **GO with conditions**. Its conditions (G37-1, G37-2, the switch tied
  to the Race's) are built and tested.
- Repo Lens #G-51 (the #G-37 conditions, at `74d36ed4`): **GO with conditions**. Every #G-37 condition is met; G51-1
  (Low) is fixed.
- Since #G-51: last week's board in `L<week>` parts (Capacity; owner, 13 Nov), merges of `main` (Block X's `tighten`
  and Fantasy games 4 and 5 kept in `bot/picks.ts`), the admin cards for game 8, and the owner's leg limit (D-167
  item 6) written into `.ai/games/ComboCard.md`. These are for the PR's Repo Lens round.
- Realistic launch: **Mon 7 Dec 2026 (vault week 7)**, after the Picks owner handover (accepted Wed 25 Nov) and the
  Picks v2 upgrade.

## 2. What was built (and finished in this round)

| Part | State |
|---|---|
| Picks v2 contract (CARD type, kind 4) | Done; 71 contract tests; release sha256 `92d555d0…e1c3d`, 37,689 bytes; rated ready by every review |
| Page `combo.html` / `combo.js` | Done; on `main`'s menu, footer, CSP and PostHog counter; Staked and Free play boards; ruler text |
| Recorder `bot/games/combo.ts` | Done; hourly at :52 |
| Shared scoring `combo-math.js` (page + all jobs) and `bot/games/combo-score.mjs` (no packages) | Done |
| Verify job `tools/combo-verify.mjs` (+ `bot/games/vhp-inflows.mjs`) | Done; #G-16 FC4-1 and FC4-4 fixed; stale-publish alert; every node read has a 30 s timeout and the Vault budget cuts off a running read (G37-2) |
| Publish job (`.github/workflows/combo.yml`, Python) | Done; recomputes every leg, card, board and winner |
| Picks v2 upgrade commands in `bot/picks.ts` | Done; three mainnet gates (`--code` on all three); refuses during an owner handover |
| Game 8 pinned in `bot/picks.ts` (`COMBO_GAME`) | Done; the exact card-game config (tested against the recorder's leg types and the page's limits); announced only once the deployment file records v2 |
| The VHP ruler for race legs | Done (D-new A): on from Combo's first week |
| Capacity standard checks | Done: every file size-checked (rule 2), no silent drops (rule 3), last week's rows split into `L<week>` parts (rule 4; `board.json` at most ~0.93 MB at any size), budget in `.ai/games/ComboCard.md` (rule 1), pages read only what they need (rule 5) |

This round (Thu 12 Nov), on top of `ba2d9b30`:
1. **#G-16 fixes:**
   - FC4-1 (High): the verify job now asks the chain about "unresolved" Block X legs.
   - FC4-2 (Medium): Block X targets are looked up by block height.
   - FC4-3: more than 10 tied for a free place pays exactly 10 (D-159).
   - FC4-4: the verify job hands on its day results first, has a Vault-read budget and a 12-hour alert.
   - The Info items: `upgrade-schedule` refuses during a handover; `upgrade-clear` needs `--code` too.
   - Game 8 pinned in the Picks tool, so the announce is a reviewed, exact config (as game 9's #253).
   - Q1: an alert, and a failed run, when nothing has been published for over 3 hours.
2. **Three merges of `main`.** The 15 conflicts were resolved by #G-16's table, then two clean merges followed. Combo's
   publish job was added to the CI guard's write list (beside Golf's).
3. **The VHP ruler switch** (§4.5).
4. **The capacity standard:** every file the recorder writes is size-checked (a warning past 60% of 2 MB, an error past
   2 MB), and the size budget was measured.
5. **The page:** `bawcejawn/KnodeGames` everywhere (it still fetched from the old repo name), and `main`'s page
   standard.

## 3. Architecture

```
  player ──(card: legs)──► Picks contract v2 (game 8, kind 4 CARD) ◄── sponsor pays the Mana (Picks "pick" row)
                                   │ list_picks (two nodes)
  race-data: W<week>.json (results, handicap cards)  │      Vault v6 (stakes: staked/free; week stake, peak)
             R<week>.json (the Race's ruler cards)   │      │ two nodes
  games-data: blockx/W<week>.json (targets, signers) │      │
                     │                               ▼      ▼
                     └──────────────► record job (combo.ts + combo-score.mjs + combo-math.js)
                                        writes D<day>[-k].json, board.json, index.json, vault/W<week>.json
                                                     │ artifact (data only)
                                                     ▼
                                      verify job (combo-verify.mjs; no packages; read-only token)
                                        re-scores every changed day from the sources and both nodes;
                                        confirms Vault stake flags; outputs names + sha256 it approves
                                                     │ job output "approved"
                                                     ▼
                                      publish job (Python in combo.yml; no repository code)
                                        exact shapes, recompute of every leg/card/board/winner, write-once finals,
                                        only approved files, ruler switch check → push games-data/combo only
                                                     │
                     page (combo.html) ◄─────────────┘        Vault bot ◄── vault/W<week>.json (staked rows; first/second
                                                                             held back while the free prize is OFF)
```

### 3.1 Trust model
- **The record job is not trusted.** It can be wrong or tampered with; it only produces data.
- **The verify job** runs only the repository's own files with plain `node`, a read-only token and no packages. It
  re-scores every new or changed day from race-data, the Block X files and both nodes. Only it can set the `approved`
  output.
- **The publish job** runs no repository code. It needs `COMBO_VERIFY: required`, and it publishes only files that are
  on the approved list with matching sha256. Even then, it rechecks:
  - every shape;
  - every leg against the published sources;
  - every card's points, every board place and the free winners;
  - that published finals are write-once and Vault files never replaced.
- **Money impact is indirect.** Combo's Vault rows decide its share of the weekly reward. The publish job checks the
  Vault file against the published board, and a published Vault file is never replaced.

### 3.2 Data files (`games-data:combo/`)
- **`D<day>.json`:** part 0 of a UTC day: `v`, `day`, `start`, `parts`, `ruled`, `slots[]`. Each slot has `round`,
  `fixed` and `cards[]`. A card has `player`, `round`, `time`, `priceAt`, `changes`, `legs[[code, round, producer,
  worth, result]]`, `state`, `outcome`, `pts` and `settled`.
- **`D<day>-<k>.json`:** parts 1+, at most 1,000 cards each. Part 0 lists every slot.
- **`board.json`:** `v`, `updated`, `rulerFrom`, `today`, `week`, `lastWeek`, `allTime`. A row has `a`, `place`,
  `boardPlace`, `pts`, `hits`, `cards`, `best`, `days`, `lastHit`, `staked`, `free` and `ranked`. `lastWeek` holds the top
  100 and `parts` (the count of its `L<week>` parts).
- **`L<week>.json`, `L<week>-<k>.json`:** last week's full board (everyone with a point, and the top 2,000), in board
  order, at most 2,000 rows a part. Part 0: `v`, `week`, `start`, `final`, `parts`, `rows`; other parts: `v`, `week`,
  `part`, `rows`. The Vault file is made from, and judged against, these parts; the publish job holds the board and the
  parts together unless they agree, and removes parts a week no longer has.
- **`vault/W<week>.json`:** `{game: 8, week, final, rows: [{player, points}], first, second}`. Written once, in the
  Vault's 3-day window.
- **`index.json`:** the known days.
- Size budget: `.ai/games/ComboCard.md` → "Size budget".

### 3.3 When a card is final
- A card is final once its slot is fixed and every leg is decided, or as soon as a leg misses.
- "Unresolved" (a source never decided) voids a card unless a leg misses.
- A held leg ends 6 h before its week's Vault window closes.
- Kept final cards are re-checked every run against the sources (FC2-1, FC3-1).

### 3.4 How a race leg is decided
- **Weeks before the ruler** (none planned): the Race's handicap standings in `W<week>.json`.
- **On the ruler** (§4.5): the Race's ruler card in `R<week>.json`.
- Either way, a missed race, or one not checked on two nodes, is unresolved.
- **Block X legs:** the target block's signer once checked on both nodes. A leg on a producer whose VHP moved in
  unusually is checked on the chain (FC4-1).

## 4. Key decisions
| Ref | Decision |
|---|---|
| Build 8 brief, D-180 | 2–10 legs (D-180, 14 Nov; was 2–6); worth clamp 0.25–3 (race legs); 3 cards/day, 3 changes; no points cap; locks race 25 min, Block X 500 blocks; ≥ 1 point to count |
| D-188 | Block X leg worth = 0.25 ÷ chance, ×0.25 to ×6 (owner, 15 Nov); race legs unchanged. The publish job's `WORTH_MAX` matches `WORTH100` |
| D-060 | Cards on mainnet wait for Picks v2 |
| RL-15 / RL-16 | A horse missing from the field = void leg |
| C-W-3 / FC-13 | One sponsor row for picks and cards: 0.2 → 0.25 Mana at Combo launch |
| FC3-3 | The independent verify job |
| D-081 / D-082 | Free play for everyone; no free prize for now (switch OFF) |
| D-083 | The Picks owner handover clears pending upgrades: never overlap them |
| D-159 / I-103 | Free-prize ties: up to 10 share; more than 10 tied pays exactly 10 (address order) |
| D-164 | On the ruler, a pick on a voided producer counts as a loss |
| **D-new A** (Library, 12 Nov) | Every game on the ruler ASAP; Combo launches on the ruler from its first week, one week rule for race legs |

### 4.5 The VHP ruler
- **The switch:** `COMBO_RULER_FROM_WEEK` = N, an Actions variable read strictly by all three jobs.
  - The recorder and the verify job read it with `KRuler.switchFrom`.
  - The publish job uses an exact copy of `vhp_ruler.py`'s switch functions, tested line for line.
- **One week rule:** a card whose UTC day is in an ON week (vault week ≥ N) has every race leg decided by the Race's
  ruler card:
  - **The field:** entry, not void, sorted by fpct, highest first, then address.
  - **Results:** Win = 1st; Show = top 3; Top half = top ⌊n/2⌋ of the field. A voided producer = a loss (D-164). Not
    in the field = void (RL-16). An empty field = void. As the Race (D-033): the ruler's winner always counts; any other
    place needs at least 1 signed block.
- **Shadow weeks** (N − 1) score as off. Combo has no played week before launch; its shadow evidence is the Race's own
  R files.
- **Unchanged:** worths stay the handicap card's; Block X legs are unaffected.
- **Recording:** day files carry `ruled`, `board.json` carries `rulerFrom`.
- **Guards:**
  - The recorder and the publish job refuse a change that would change a started week (`switchChange`).
  - The verify job and the publish job refuse a day whose `ruled` mark isn't the switch's.
- **Tied to the Race (Repo Lens #G-37):** Combo is never on the ruler before the Race. The recorder, the verify job and
  the publish job each refuse `COMBO_RULER_FROM_WEEK` < `RACE_RULER_FROM_WEEK`, or a Combo switch with the Race's unset.
- **A ruler card that never comes is an outage, not a void.** In a ruled week, a race leg whose ruler card hasn't
  come waits, with an error, as for any other source outage (RL-9). At the deadline it is given up ("unresolved"):
  - **when the Race itself has skipped the race** (Repo Lens #J-10, J10-2): the Race's own final Vault file for the
    race's week (`race-data` `vault/W<week>.json`) lists the race in `skipped`. Combo reads it in the same hour, so it
    never counts a race the Race skipped and never gives up one the Race counts (for example a ruler card that landed
    while the Race's week was held). The three Combo jobs copy those files from `race-data`;
  - **otherwise 6 h before the card's week's Vault window closes** (G51-1), if the race is final in the W file, so the
    week keeps its Vault file. That covers a next-week race (a Sunday card's Monday race), a Race week still held then,
    and the Race's own outage.

  Before #J-10 it was predicted from the clock (week end + the Race's `RULER_GRACE`, 48 h, #338; and G37-1, a ruler card
  for a later race). `ruledGiveUp` and `raceSkipped` in `bot/games/combo-score.mjs`; the publish job holds a card given
  up any earlier (its own copy, J10-4). Tests: `tests/audit/combo-ruler-grace.test.mjs`,
  `tests/audit/combo-ruler-grace.repolens-j10.test.mjs`.
- **At launch (Plan A, D-207; O-28):** N = 6, so free play (vault week 6, from Mon 30 Nov) is on the ruler from its
  first week, as the Race. Set it before week 6 starts (by Sun 29 Nov 6 PM ET), with or before `COMBO_ENABLED`.
  `RACE_RULER_FROM_WEEK` (4) must stay 6 or lower. Check first with `node tools/vhp-ruler-switch.mjs 6`.

## 5. Dependencies and integration points
| With | What Combo needs | Where |
|---|---|---|
| **Picks contract** (Block X chat administers) | v2 code on chain; game 8 announced and applied | `bot/picks.ts` (shared with Block X: their code is kept byte for byte), `picks/`, runbook `docs/blockx/MAINNET-LAUNCH.md` "Later: the Picks v2 upgrade" |
| **Producer Race** | race-data `W<week>.json` with final, two-node-checked results and handicap cards with `samples` (FC-12); `R<week>.json` ruler cards for every Combo week | `combo-score.mjs` `raceRecord` / `rulerRecord` |
| **Block X** | `games-data:blockx/W<week>.json` targets with `height`, `signer`, `final` (hourly since vault week 3) | `blockTargets` (by height) |
| **Vault v6** (Vault chat) | stake reads (staked/free, week stake, peak); `game-add 8 "Combo Card" --staked --free`, `game-apply`; free-prize switch OFF | `vault/W<week>.json`, `npm run prizes -- off 8 --send` |
| **Sponsor** | the Picks `pick` row at 0.25 Mana | runbook step 7 |
| **VHP ruler** (Ruler chat) | `vhp-ruler.js` / `vhp_ruler.py` switch functions | §4.5 |
| **Site** (Hub chat) | `games.json` / `index.html` entries ("soon" until launch); `weeks.js` labels; nav from `tools/site-nav.mjs`; the sitemap line at launch | |
| **CI guard** | `combo.yml publish` on the write list | `tests/audit/site.ci-deps.test.mjs` |
| **Capacity** (Capacity chat) | the capacity standard; `data.knodegames.com` reads once it exists | §7 |

## 6. Launch runbook (ET; each step only after the one before, dry run first, the owner sends)
1. Repo Lens delta round → GO → the Library's OK → one push → one PR `combo` → `main` → the owner merges.
2. **Mon 23 Nov:** propose the Picks owner handover. **Wed 25 Nov:** accept it (new generation; `OWNER_WIF` = the new
   owner's key).
3. **Wed 25 – Thu 26 Nov:** `npm run picks -- upgrade-schedule --send --mainnet --code 92d555d0` (refused while a
   handover is pending).
4. **From 48 h later, within 7 days:** `upgrade-upload --send --mainnet --code 92d555d0`, then
   `upgrade-clear --send --mainnet --code 92d555d0`.
5. A PR writing `wasmSha256` / `uploadTx` / `uploadedAt` into `picks-data/deployment.json`; then
   `npm run picks -- status --mainnet`.
6. Sponsor row 0.25 (runbook step 7) and its site PR; then `config --send`.
7. `npm run picks -- announce 8` (dry run: check the printed shape), then `--send --mainnet`; 48 h; `apply 8`. The
   config is pinned in this PR (`COMBO_GAME`) and can never change once applied. The tool refuses it until step 5 is
   merged.
8. Vault: `npm run prizes -- off 8 --send`; `game-add 8 "Combo Card" --staked --free --season 1`; 48 h;
   `game-apply 8` within 7 days.
9. By Sun 6 Dec 23:59 UTC: `node tools/vhp-ruler-switch.mjs 7`, then set `COMBO_RULER_FROM_WEEK` = 7 (with
   `RACE_RULER_FROM_WEEK` at 7 or lower); set `COMBO_ENABLED = true` and
   `"cards": true` in `picks-data/deployment.json`; add Combo to the sitemap; `games.json` status live.
10. Watch the first runs; time record + verify (FC-11); `npm run sponsor -- mana-report` a day after launch.

## 7. Remaining gaps and technical debt
| Item | Risk | Plan |
|---|---|---|
| FC-11: live run time of record + verify unmeasured | A slow run holds files for an hour | Time the first live runs; FC4-4's budget keeps the verify job inside its 20 minutes |
| FC2-14: Golf's and Combo's publish jobs can push to `games-data` together | The second push fails and retries next run | A shared concurrency group is a platform change (Library / Capacity) |
| FC2-13: `wasmSha256` written by hand (runbook step 5) | Forgetting it leaves the tool accepting v1 | Its own PR in the runbook |
| Pages read GitHub raw directly | Rate limits at scale | Move to `data.knodegames.com` once the Capacity chat ships it |
| Worths on the ruler | Prices still come from the handicap card | A re-pricing from the ruler's cards can follow, by its own PR |
| Sponsor Mana measured on testnet only | The row may be off | `mana-report` after launch |
| `docs/blockx/MAINNET-LAUNCH.md` edits | Shared with Block X | Told the Block X chat |

## 8. Tests
- `npm run test:audit` (the whole platform).
- Combo's own tests:
  - `tests/audit/site.combo.test.mjs`
  - `tests/audit/combo-recorder.test.mjs` and `tests/audit/repolens-combo-recorder.test.mjs`
  - `tests/audit/combo-verify.test.mjs`
  - `tests/audit/combo-ruler.test.mjs`
  - `tests/audit/repolens-fc-combo/*` (Repo Lens's tests from every round, kept unchanged unless a comment says why)
  - `tests/audit/picks.tool.test.ts`
- `npm run test:browser`: `combo-page`, `repolens-combo-stake`.
- Contract: `cd picks; npm ci --ignore-scripts; npm test; npm run check` (71 tests, sha256 `92d555d0…`).

## 9. Files
`combo.html`, `combo.js`, `combo-math.js`, `bot/games/combo.ts`, `bot/games/combo-score.mjs`,
`bot/games/vhp-inflows.mjs`, `tools/combo-verify.mjs`, `.github/workflows/combo.yml`, `picks/` (v2 source),
`bot/picks.ts` (upgrade commands), `games.json`, `index.html`, `.ai/games/ComboCard.md`, this file, and the tests above.
