# Knode Games — The Shared VHP Ruler (design)

> **Status:** design, v1 (4 Nov 2026), written by the library chat (R-LIB-5). **Owner to approve** (§12), then Repo Lens reviews the design and a new, dedicated VHP Ruler chat builds it (R-RULER-1, D-110) and each game moves onto it (Race first, R-RACE-5).
> **Decided by the owner (the inputs to this design):** D-058 (exact VHP from the chain's events), **D-090** (one ruler for every game; each game keeps its own formula; checks at random moments within a window), D-091 (lower Last Node's bar), **D-093** (a look-back of about 2 weeks; fair to every producer, small and large), D-094 (the Race pays meanwhile with its two gaps open), D-095 (Survivor S1 stays on blocks), **D-101** (fair, with a bit of luck: a luck trim or a cap in every game), **D-108** (build it).
> **Built from:** `../platform/HANDICAP_REVIEW.md` (how every game measures VHP today, the gaps, §5 recommendations), `docs/VHP-STANDARD.md` and `vhp-standard.js` on `kg-09-bracket` (the Bracket's exact rebuild), `bot/race.ts` (the Race card and sampler), the Repo Lens findings named below.
> **What it isn't:** a scoring formula. Each game keeps its own (a race, a multiplier, a knockout, a price). The ruler only says **how big each producer is, when, and what a VHP move is worth**, the same way everywhere.

## 0. In plain words
Every game compares what a producer *actually* signs with what its size says it *should* sign. Today each game measures "size" its own way, and a trick blocked in one game works in another. The ruler is one shared measuring tape:

- **It counts every block, not samples.** It rebuilds each producer's real VHP from the chain's own records, block by block, on two nodes that must agree.
- **Your size is hard to fake.** A producer's own size is the higher of its **2-week average** and its **highest VHP in the last 24 hours**. Hiding VHP to look small costs about two weeks of real block rewards, and "look small right now" doesn't work.
- **Adding VHP after the measure gains nothing.** A block signed with more VHP than you were measured with counts only in proportion (card credit).
- **Everyone else is measured by averages,** so nobody can time a single moment.
- **The moment of measurement is random,** picked from a block hash that nobody knows in advance and anyone can check afterwards.
- **Luck is limited, not removed.** Small producers can win, but one lucky hour can't decide a week.

## 1. Goals and non-goals
**Goals**
1. One way to measure producer size, used by every game that handicaps by size (Race, Block X, Last Node, Fantasy, Combo, Bracket, Survivor from Season 2).
2. Hard to game: every known trick in `HANDICAP_REVIEW.md` §3 either fails or costs more in lost block rewards than it can win.
3. Fair to small and large producers alike (D-093): the same entry bar everywhere, a luck trim or cap, and no penalty for honestly losing stakers.
4. Checkable by anyone: every number can be recomputed from the chain and the published files; the publish job recomputes it before anything pays (RECORDER_STANDARD §4).
5. Replaces the GitHub-timed sampler (I-059), which depends on how often GitHub runs a schedule.

**Non-goals**
- Changing any game's scoring formula, prize split or rules beyond the inputs listed in §6.
- Any contract change. The ruler runs off chain, in the recorders and publish jobs, reading the chain; it costs no Mana.
- Questions (game 1) and Block Golf (6) don't handicap by size and don't use it.

## 2. Building blocks
### 2.1 Exact effective VHP (from D-058, unchanged)
- **Source:** the VHP contract's events (transfers, mints, and the ~4 VHP each block burns from its signer; reverted transactions excluded), anchored by balance reads pinned to one block, on **two nodes that must agree** (`bot/vhp-chain.ts`, `vhpBook`).
- **Effective VHP** is what block production uses: received VHP counts after 20 blocks; removed VHP stops at once:
  `eff(a, H) = max(0, balance(a, before H) − VHP received by a in blocks H−19 … H−1)`.
- **Cross-check:** the contract's `effective_balance_of` at a pinned block must match the rebuild; a mismatch flags the producer (S-3).
- **Only irreversible blocks** are used (`last_irreversible_block`), so a reorg can't change a number after it's published.
- **The network total** `N(H)` = Σ eff over all producers that signed in the last 7,200 blocks (`activeAt`).

### 2.2 Time and windows
All windows are counted in **blocks** (one Koinos block ≈ 3 s; 1 h ≈ 1,200 blocks, 24 h ≈ 28,800, 14 days ≈ 403,200). Wall-clock times are only for display. Each game names its windows by height: its **card time** `T` (when sizes are fixed), its **scoring window** `[S0, S1]` (the blocks that score) and its **lock** `L` (when picks close).

### 2.3 The random measurement point (D-090)
A game's card time is not a fixed, guessable moment. It is drawn inside a **card window** the game defines (for example, the last 6 hours before the lock):

- **Seed:** the block ID of the first irreversible block at least **20 blocks after the lock** `L` (`seedBlock = L + 20`). Nobody knows it when picks are made; anyone can read it afterwards.
- **Point:** `T = W0 + (uint64(sha256(seedBlockId ‖ gameId ‖ roundId)) mod (W1 − W0 + 1))`, where `[W0, W1]` is the card window in heights.
- **Why it works:** sizes are computed **after** the lock from recorded history, so there is no need to know `T` beforehand. A producer can't know which block will count, so it would have to look small for the whole window, which the 2-week average (§3.1) already punishes.
- **Grinding:** the only party with any say over a block ID is the producer that signs `seedBlock`, and its only choice is to not sign it (the next producer signs instead), worth one re-roll at the cost of a block reward. The ruler logs the seed producer; a game whose prize could be swayed by one re-roll may use several seeds (`L+20 … L+24`, hashed together).
- **Games without a lock** (rolling scoring, e.g. Last Node hourly rounds) draw one point per round the same way, seeded 20 blocks after the round closes.

## 3. What the ruler gives each game (the outputs)
For producer `p`, a game round with card window `[W0, W1]`, card time `T` (§2.3) and scoring window `[S0, S1]`:

| Output | Definition (defaults; §9 sets the final values) | Used for |
|---|---|---|
| **`own(p, T)`** own size | `max(TWA₁₄(p, T), HIGH₂₄(p, T))`: the time-weighted average of `eff(p)` over the 403,200 blocks before `T`, or the highest `eff(p)` in the 28,800 blocks before `T`, whichever is higher (D-093) | a producer's **own** handicap or multiplier, fixed before scoring |
| **`avg(p, T)`** average size | the time-weighted average of `eff(p)` over the 28,800 blocks before `T` | **other** producers in anyone's formula: the top producer, totals, fields, seeding (S-2, F-3) |
| **`total(T)`** | Σ `avg(q, T)` over active producers | shares and expected blocks |
| **`k(p)`** expected blocks | `(S1 − S0 + 1) × own(p, T) ÷ total(T)` | the entry bar, the luck trim, "should have signed" |
| **`credit(p, b)`** card credit | for a block `b` signed by `p` in `[S0, S1]`: `min(1, own(p, T) ÷ eff(p, b))` | each scored block counts this much; VHP added after the measure gains nothing (S-1) |
| **`form(p)`** production check | `clamp(signed ÷ expected, 0.8, 1.2)` over the 403,200 blocks before `T`, with expected from `eff(p, H) ÷ N(H)` block by block | a producer whose blocks and VHP disagree (offline, or signing more than its VHP allows) is pulled back toward its real production |
| **`trim(k)`** luck trim | `c ÷ √k`, with `c` fixed per game by simulation (Race and Last Node already use this shape) | keeps "a bit of luck" (D-101) |
| **`entry(p)`** | `k(p) ≥ k_min`, default **k_min = 10** expected blocks in the game's scoring window (`HANDICAP_REVIEW.md` §5.2) | who plays; below it, the producer is shown in a **paddock** with how far it is from qualifying |
| **`quality(p)`** | `ok` only if both nodes agree on `eff(p)` at every block used and `effective_balance_of` matches at the pinned block; else `flagged` | a flagged producer's round is voided or held, never scored on a guess |

**Rules that come with the outputs** (from the audits; a game takes them together, never one alone):
1. A producer's **own** number is `own(p)`; anything about **other** producers uses `avg(q)` (F-3). A multiplier built from an average reopens the long hide.
2. Card credit is always on (S-1).
3. Totals use averages, so VHP shuffled between one owner's addresses isn't counted twice (S-2).
4. A game may not use a single block's reading as a size (Bracket H-5). Forfeits, seeding and pool rules use day averages or minimums (D-086).

## 4. How every known trick fares
| Trick (`HANDICAP_REVIEW.md` §3) | Today | With the ruler |
|---|---|---|
| Move VHP away just before the measure | caught by the 6-h high in most games | caught: `HIGH₂₄` |
| Hide VHP for more than 6 h, bring it back for the game | **pays** in the Race (proved 60 of 60), Fantasy, Combo Race legs, Survivor | costs about two weeks: `TWA₁₄` falls only in proportion to how long the VHP was away, and while it's away the producer signs fewer blocks. A 1-day hide lowers `own` by about 1/14 of the hidden share and costs a full day's rewards on it |
| Add VHP after the measure, during the scoring window | **pays** in the Race (~1–1.5 h), Fantasy | gains nothing: `credit(p, b)` caps each block at the measured size |
| Learn the measure time and time a move | the Race card is at :37 every hour | the time is drawn from a future block hash (§2.3) |
| Suppress blocks for a week (Survivor's blocks handicap) | pays | Survivor moves onto `own` + `form` from Season 2 (D-095); `form` is clamped, so a week of suppression shifts it at most to 0.8 |
| Swing the Knode Games Pool by deposits around the start (Bracket H-4) | could force a loss | pooled producers are judged on day averages or minimums (D-086, rule 4) |
| A lagging or lying node | handled per game | both nodes must agree on every number used, or the producer is flagged (§3 `quality`) |

**Cost to a cheater:** every hide still costs real block rewards for as long as it lasts, now for up to two weeks of weight. The simulations in §8 must show the expected gain from any strategy is below its cost in rewards, for producers of every size.

## 5. Fairness to small producers (D-093, D-101)
- **One entry bar:** k ≥ 10 expected blocks in the game's own scoring window. Below ~10 blocks a result is mostly luck. Last Node's bar comes down to this (D-091, R-LN-4).
- **A luck trim in every game** (`c ÷ √k`, sized by simulation), or at least a cap. Survivor and the Bracket add one (R-SV-5, R-BR-7).
- **Honest shrinking is fair:** a producer that genuinely loses stakers sees `own` follow its `TWA₁₄` down day by day. That's why the rule isn't a pure 14-day **maximum**, which would keep it looking big for two weeks.
- **New producers** (less than 14 days of history): `TWA` over the history they have, with missing days counted at their **first** observed VHP (so arriving big and hiding later can't help), and a "new" label on the page. At least 24 h of history is required to enter a round.
- **A visible paddock:** every game shows producers below the bar and how far they are from qualifying.

## 6. How each game plugs in (each keeps its own formula)
| Game | Today | On the ruler | When |
|---|---|---|---|
| **Producer Race (7)** | sampled 6-h high; h = kTop ÷ k with trim c ÷ √k; k ≥ 10 | `k` from `own` and `total`; kTop from **`avg`** of the top producer; card time random in the 6 h before each race's lock; card credit on every scored block; `form` replaces today's "3 standard deviations" production floor | **first** (R-RACE-5), as soon as the library passes Repo Lens |
| **Who Signs Block X (2)** | the Race card ≤ 3 h before the lock and the first card after the block; min(3, top ÷ yours) | multiplier `min(3, avg(top) ÷ own(p))` at a random point in the 3 h before the lock; the "card after" check is replaced by `credit(p, b)` at the target block | with or right after the Race |
| **Last Node Standing (13)** | the Race card × form (0.8–1.2); ≥ 20 expected blocks an hour | `own`, `form` (same clamp), `trim`; entry `k ≥ 10` in its scoring window (D-091); one random point per round | before its launch if possible (R-LN-4) |
| **Fantasy (4) + Rival (5)** | Race card shares; index cap 130; no card-quality gate | `own` shares; `quality` gate (R-FA-3); keep the cap or swap it for a trim by simulation | before its launch |
| **Combo Card (8)** | Race card per leg; factor clamp(0.5 ÷ chance, 0.25, 3) | each leg reads the ruler as its game does; Race legs get card credit | with the Picks v2 upgrade |
| **Producer Bracket (9)** | exact rebuild (its home); 1-day average seeding; credit vs baseline | already closest: switch its baseline to `own`, keep day averages for seeding and forfeits (D-086, D-087); add a trim (R-BR-7) | after R-RULER-1, with its #E-3 fixes |
| **Survivor (3)** | blocks signed over days d−8 … d−2 | Season 2: `own` + `form` + `trim` (D-095) | Season 2 |
| Questions (1), Block Golf (6) | no size handicap | not used | — |

A game's own file (`games/<Game>.md`, Scoring) states exactly which outputs it uses and its parameters (`c`, the card window, any cap).

## 7. Where it runs and what it publishes
- **One library**, `vhp-ruler.js` (pure functions, shared by the recorders, the publish jobs and the site), grown from `vhp-standard.js`; and one data step, `bot/vhp-ruler.ts`, that reads the chain.
- **Data branch `vhp-data`:** every hour a recorder run appends that hour's VHP **change points** (only the blocks where some producer's effective VHP changed, plus each block's signer), read on two nodes and written once. A rolling **15-day** window is kept (14 days + a margin); older hours are dropped from the working file and kept as compressed day files. Expected size: change points are sparse (a few hundred a day), so a few MB at most.
- **The first fill** reads the last 15 days once (~430,000 blocks, in batches) on two nodes; after that each run only reads the last hour's blocks, which the recorders already read. No polling, no Mana.
- **Every game's card** records, per producer: `own`, `avg`, `k`, the card time `T`, the seed block and its producer, and `quality`; the publish job **recomputes each card from `vhp-data`** and refuses any difference (RECORDER_STANDARD §4).
- **The sampler** (`race-samples.yml`) keeps running during the move as a cross-check (a sample above the ruler's own size at the same height is a bug alarm), and is retired once every game is on the ruler.

## 8. Proving it's fair (simulations, before anything pays)
The VHP Ruler chat runs these with the real last-15-days data plus synthetic fields; results go to the owner with the parameters:
1. **Honest field:** each producer's long-run win share in each game tracks its VHP share within the luck band the game wants (D-101).
2. **Many small producers:** a field of 100+ producers under 1% each: small producers qualify, win sometimes, and no tiny lucky node tops a week more than the trim allows.
3. **Every trick in §4:** short hide, long hide (1 h … 14 days), in-window add, timed moves, pool swings. Pass = the expected gain is below the block rewards the trick costs, for producers of 0.2%, 2% and 20% share.
4. **Honest shrink and growth:** a producer losing half its stake isn't over-handicapped for more than a few days; one gaining doesn't get a bonus.
5. **Node faults:** one node lagging or wrong flags, never mis-scores.
6. **Seed grinding:** one re-roll per round changes no week's winner in more than a negligible share of cases (else use several seeds, §2.3).

## 9. Parameters (defaults; simulation sets the final values)
| Parameter | Default | Set by |
|---|---|---|
| Own-size look-back | 14 days (TWA) and 24 h (high) | D-093; simulation 3, 4 |
| Average look-back for others | 24 h (28,800 blocks) | simulation 1 |
| Form window and clamp | 14 days; 0.8 – 1.2 | Last Node's existing clamp; simulation 1 |
| Entry bar | k ≥ 10 in the scoring window | `HANDICAP_REVIEW.md` §5.2 |
| Luck trim `c` | per game | each game's simulation (Race and Last Node have simulators) |
| Card window | per game (Race 6 h before lock; Block X 3 h) | each game |
| Seed delay | 20 blocks after the lock | §2.3 |
| Minimum history to enter | 24 h | simulation 4 |

## 10. Build and migration plan
1. **Owner approves this design** (§12).
2. **The VHP Ruler chat (R-RULER-1, D-110):** `vhp-ruler.js` + `bot/vhp-ruler.ts` + `vhp-data` recorder and publish check, with tests (including a line-by-line copy of the VHP contract's snapshot code, as `vhp-standard` has) and the simulations of §8. Repo Lens audit.
3. **Race (R-RACE-5):** the Race card moves onto the ruler. The two known gaps close. A Race fix-check, then the Race pays on the ruler from the next Monday.
4. **Block X, then Last Node, Fantasy, Combo, Bracket** as each is ready; **Survivor** from Season 2.
5. **Retire the sampler** once no game reads it.
Until a game moves, it keeps today's method (D-094); nothing changes for players mid-week (a switch takes effect from a Monday).

## 11. Risks and how the design handles them
| Risk | Handling |
|---|---|
| A bug in the shared library hits every game at once | Repo Lens on the library; each game's publish job recomputes from `vhp-data`; games move one at a time, Race first |
| The first fill is heavy for the nodes | read once, in batches, outside busy hours; after that one hour at a time |
| A producer changes its producer address or key | the ruler follows the VHP-holding address that signs; a new address is a new producer (history starts again, §5 "new") |
| The seed producer re-rolls | logged; several seeds if a game's simulation shows it matters |
| Effective-balance rule changes in a Koinos upgrade | the `effective_balance_of` cross-check catches it at once (flag, no scoring) |

## 12. For the owner to approve
1. The core rule: **own size = the higher of the 14-day average and the 24-hour high**; others measured by **24-hour averages**; **card credit** always on.
2. **Random card time** from a block 20 blocks after the lock.
3. **One entry bar** (k ≥ 10) and **a luck trim in every game** (each game's `c` by simulation).
4. **Build order:** a dedicated VHP Ruler chat builds it (D-110); the **Race moves first**; the sampler retires at the end.
5. **New producers** need 24 h of history and are labelled "new".

## 13. Interface (for the builder)
```ts
type Height = number; type Addr = string;
interface RulerData { /* change points + signers for the last 15 days, from vhp-data, both nodes agreed */ }
interface Card {
  game: number; round: string; T: Height; seedBlock: Height; seedProducer: Addr;
  window: { W0: Height; W1: Height; S0: Height; S1: Height };
  producers: { a: Addr; own: bigint; avg: bigint; k: number; form: number; entry: boolean; quality: "ok" | "flagged"; isNew: boolean }[];
  total: bigint;
}
function cardTime(seedBlockId: string, game: number, round: string, W0: Height, W1: Height): Height;
function makeCard(d: RulerData, game: number, round: string, w: Card["window"], seedBlockId: string, kMin?: number): Card;
function credit(d: RulerData, card: Card, a: Addr, b: Height): number;   // min(1, own ÷ eff at b)
function trim(k: number, c: number): number;                             // c ÷ √k
function recompute(d: RulerData, published: Card): { same: boolean; diff?: string };  // for the publish job
```
All arithmetic on VHP is in integer satoshis (`bigint`); ratios are computed once at the end and rounded the same way in the recorder, the publish job and the site.
