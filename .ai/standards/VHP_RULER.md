# Knode Games — The Shared VHP Ruler (design)

> **Status:** design **v2, approved by the owner 4 Nov (D-111)**; built by the VHP Ruler chat (R-RULER-1). v1 was reviewed by **Repo Lens #E-7** ("approve with changes", on 8 days of real mainnet data); v2 makes every change it asked for (the list is in §14). Each game then moves onto it, Race first (R-RACE-5).
> **Owner's decisions behind it:** D-058 (exact VHP from the chain's events), **D-090** (one ruler; each game keeps its own formula; checks at random moments within a window), D-091 (lower Last Node's bar), **D-093** (a look-back of about 2 weeks; fair to every producer, small and large; see §12 point 1: the review shows the 2-week average itself is unfair, so v2 asks to replace it), D-094, D-095, **D-101** (fair, with a bit of luck), **D-108**, **D-110**.
> **Built from:** `../archive/2026-11-05/HANDICAP_REVIEW.md`; `docs/VHP-STANDARD.md`, `vhp-standard.js`, `bot/vhp-chain.ts` on `kg-09-bracket`; `bot/race.ts`, `bot/games/blockx.ts`; Repo Lens #E-7 (private, artifact `63JUu9JWEt3hddhtzWzNVe`; its simulations: `claude/ruler/repolens-e7-sims/`).
> **What it isn't:** a scoring formula. Each game keeps its own. The ruler only says **how big each producer is, when, and how much each signed block counts**, the same way everywhere.

## 0. In plain words
Every game compares what a producer *actually* signs with what its size says it *should* sign. The ruler is one shared measuring tape:

- **It counts every block, not samples.** Each producer's real VHP is rebuilt from the chain's own records, block by block, on two nodes that must agree, with checkpoints that make a wrong data file detectable.
- **A producer is measured as it is at the measuring moment**, not by an old average. The review found that a 2-week average makes honest producers look too big, because every block burns about 4 VHP from its signer, so a producer that doesn't re-burn its rewards shrinks about 1% a day.
- **Card credit is what stops cheating.** A block signed with more VHP than the producer was measured with counts only in proportion. So hiding VHP to look small and then bringing it back gains nothing. In the review's simulations every hide and every top-up *lost* the cheater a little, for small, medium and large producers.
- **The measuring moment is random,** drawn from a block that comes after picks lock. Nobody knows it in advance; anyone can check it afterwards.
- **Everyone else is measured by averages,** so nobody can time a single moment.
- **"Form" (blocks signed vs expected) is only a warning light, never a bonus.** If it changed a producer's odds, skipping blocks on purpose would pay.
- **Luck is limited, not removed:** one entry bar and a luck trim in every game.

## 1. Goals and non-goals
**Goals**
1. One way to measure producer size for every game that handicaps by size (Race, Block X, Last Node, Fantasy, Combo, Bracket, Survivor from Season 2).
2. Hard to game: no strategy has a positive expected gain, **even assuming the hidden VHP costs nothing** (parked on a second producer). We don't rely on "it costs rewards" (§4).
3. Fair: every honest producer scores an expected index of 1.00 ± 0.01, including one that shrinks ~1% a day and never re-burns (§8).
4. Checkable by anyone; the publish job recomputes every number and can detect a wrong data file (§7).
5. Replaces the GitHub-timed sampler (I-059).

**Non-goals:** changing any game's formula, prizes or rules beyond the inputs in §6; any contract change (it runs off chain and costs no Mana); Questions (1) and Block Golf (6), which don't handicap by size.

## 2. Building blocks
### 2.1 Exact effective VHP (D-058, unchanged; confirmed sound by #E-7)
- **Source:** the VHP contract's events (transfers, mints, and the ~4.08 VHP each block burns from its signer, which comes back as KOIN; reverted transactions excluded), on **two nodes that must agree**.
- **Effective VHP:** `eff(a, H) = max(0, balance(a, before H) − VHP received by a in blocks H−19 … H−1)` (matches `vhp-standard.js` line 82).
- **Cross-check:** the contract's `effective_balance_of` at the hourly anchor block must match the rebuild (§7); a mismatch flags the producer.
- **Irreversible blocks only** (Koinos makes a block irreversible ~60 blocks later).
- **Network total** `N(H)` = Σ eff over producers that signed in the last 7,200 blocks. (L-7: a producer below ~0.014% drops in and out of this set; the effect is tiny. If a node can list every address with VHP and a registered key, use that instead.)

### 2.2 Time and windows
Windows are in **blocks** (≈ 3 s each; 1 h ≈ 1,200; 24 h ≈ 28,800). Each game names its **card window** `[W0, W1]` (where the measuring moment may fall), its **scoring window** `[S0, S1]` and its **lock** `L`.

### 2.3 The random measuring moment (D-090)
- **Seed:** the block ID of the first irreversible block at or after **`L + 20`**. It doesn't exist when picks close.
- **Moment:** `T = W0 + (uint64(sha256(seedBlockId ‖ gameId ‖ roundId)) mod (W1 − W0 + 1))`.
- **Exact recipe (D-112):** sha256 of the UTF-8 text `blockId|game|round` (the block id in lowercase hex exactly as the node returns it; game and round in decimal); the first 8 bytes read as one big-endian unsigned 64-bit number. A fixed test vector in both JavaScript and Python.
- Sizes are computed **after** the lock from recorded history.
- **Grinding (L-1):** the seed block's producer chooses which transactions to include and in what order, so it can try **many** block IDs, not one. Several seed blocks don't fix that (the last producer still sees the rest). On real data the effect is small: the best card time against the worst moved a producer's expected index by 0.14% at the median and 1.35% at most. The ruler logs the seed producer. If Koinos blocks carry a VRF output (to confirm with the Koinos developers), use it as an ungrindable seed.
- **Before the lock (L-4),** every game page shows an **estimated card** computed at the current block, labelled "estimate; the final card is taken at a random moment in the last N hours" (within ~1.4% of the final on real data).

## 3. What the ruler gives each game (outputs)
For producer `p`, a round with card window `[W0, W1]`, moment `T` and scoring window `[S0, S1]`:

| Output | Definition (v2) | Used for |
|---|---|---|
| **`own(p, T)`** own size | **the producer's effective VHP at `T`**, or a **short high just before `T`** (default: the highest `eff(p)` in the 1,200 blocks before `T`). Simulation 4 picks between spot, the 1-h high and the 24-h average (v1's 2-week average is removed, H-1) | a producer's **own** handicap, fixed by the moment `T` |
| **`avg(p, T)`** | time-weighted average of `eff(p)` over the 28,800 blocks before `T`, as `floor(Σ ÷ blocks)` in satoshi | **other** producers in anyone's formula: the top producer, totals, fields, seeding (S-2, F-3) |
| **`total(T)`** | Σ `avg(q, T)` over active producers | shares and expected blocks |
| **`k(p)`** expected blocks | `(S1 − S0 + 1) × own(p, T) ÷ total(T)`, in millionths, rounded down. Σk can exceed the window's blocks by a little (L-3); ranking games are unaffected; a game with a **fixed bar** (Fantasy's cap of 130) normalises: `k(p) × blocks ÷ Σk` | entry bar, luck trim, "should have signed" |
| **`credit(p, b)`** card credit | for each block `b` signed by `p` in `[S0, S1]`: `min(1, own(p, T) ÷ eff(p, b))`, in millionths, rounded down; a producer's credited blocks are the integer sum of these | **every size-handicapped score uses credited blocks, never raw blocks** (hard rule, §3.1) |
| **`form(p)`** production check | `signed ÷ expected` over the 403,200 blocks before `T`, expected from `eff(p, H) ÷ N(H)` block by block, in millionths | **a gate only:** below 0.80 the producer goes to the paddock or is flagged. **It never lowers a producer's expected blocks** (H-2) |
| **`trim(k)`** luck trim | `c ÷ √k`; each game states whether `c` is fixed or recalibrated per card (today `race-math.js` recalibrates per card) | "a bit of luck" (D-101); it also punishes looking small (smaller k, bigger trim) |
| **`entry(p)`** | `k(p) ≥ 10` expected blocks in the scoring window, and `form(p) ≥ 0.80`, and at least 24 h of history | who plays; others are shown in a **paddock** with how far they are from qualifying |
| **`pooled(p)`** | true for producers whose VHP others can move in and out at will: today the **Knode Games Vault** `1Mpmf2ER…` | the pool rule, §3.2 |
| **`quality(p)`** | `ok` only if both nodes agree on every number used and the anchors check out (§7); else `flagged` | a flagged producer's round is voided or held, never scored on a guess |

### 3.1 Hard rules (every game, with a test in each)
1. **Card credit in every size-handicapped score.** A score that counts raw blocks against `own` is not allowed. Every use of `own` **without** credit must be listed in the game's file and shown harmless. Today's list: the entry bar (`k`), the luck trim, Fantasy prices, Block X's multiplier (its payout is then credited at the target block).
2. A producer's **own** number is `own(p)`; anything about **other** producers uses `avg(q)` (F-3).
3. Totals use averages, so VHP shuffled between one owner's addresses isn't counted twice (S-2).
4. No single block's reading as a size for forfeits, seeding or pools (Bracket H-5, D-086).
5. **Form never lowers expected blocks.** A game that keeps a form multiplier may use it only to **raise** expected blocks (form above 1), and must run a weekly watch like Last Node's (`watchWeek`, z ≥ 3.4) that flags a producer whose results are out of line.

### 3.2 Pooled producers (M-2)
Card credit only caps VHP *above* the measured size. If a pooled producer's VHP *falls* after `T`, because depositors withdraw, it is still expected to sign at `own`: anyone with a meaningful deposit could withdraw from the Knode Games Vault right after the card and re-deposit after the race, so the Vault almost never wins that race. Rule:
- **Expected blocks for a pooled producer use `min(own, eff at each block)`** over the scoring window. A minimum over `T` to the end of scoring neutralises the withdrawal. Simulate it first (§8 sim 7), because applied to everyone it would let a producer raise its own luck by shrinking during a race. So it applies **only** to `pooled` producers.
- **If simulation 7 fails,** the Vault is left out of size-handicapped fields, except the Bracket, where the owner chose to keep it and protect it with day averages or minimums (D-086).

## 4. How every known trick fares (from #E-7's simulations)
**What stops cheating is card credit, not cost.** A missed block costs only its **net** reward, about **0.16 KOIN**, because the ~4.08 VHP it would have burned stays with the producer and the rest comes back as KOIN. VHP parked on a second producer costs about nothing. So v1's "hiding costs two weeks of rewards" was wrong (M-1). The design must hold even if every trick is free.

| Trick | With the ruler (credit on) |
|---|---|
| Hide VHP for 25 h, 7 days, or lower it slowly over 2 weeks, then bring it back | **loses a little** at 0.2%, 2% and 20% (e.g. 2%: win chance 0.055 → 0.053 for a full 25-h hide; 0.045 for a 7-day half hide). Without credit the same tricks would pay hugely (0.24, 0.80) |
| Add VHP during the scoring window | **loses** (2%: 0.055 → 0.033): more blocks at partial credit, less luck |
| Time the card | gains nothing: random moment, and with credit a small card gains nothing anyway |
| Split VHP across addresses / collude with another producer | gains nothing: credit makes the hide useless; moving VHP between producers moves every handicap together |
| Flash moves around the 20-block delay | handled: effective VHP follows the contract's rule |
| Grind the seed block | ≤ 1.35% on an expected index; logged (§2.3) |
| Skip blocks to lower form | **closed in v2**: form is a gate, never a lower expectation (H-2: in v1, a 2% producer skipping 20% of its blocks for 2 weeks won a race ~12× as often, for ~258 KOIN) |
| Withdraw from the Vault right after the card | closed by the pool rule (§3.2) |
| A lagging or lying node | flagged, never scored (§3 quality, §7 anchors) |

## 5. Fairness
- **Honest shrinking is fair in v2.** Measured at `T`, a producer that shrinks ~1% a day (block burns, never re-burns) scores 1.00. On real data the v2 rule ("VHP at the card time") gave an honest mean index of 1.000 (lowest 0.972) and Race win chances of 0.79–1.10 of fair, against 0.955 (lowest 0.379) and 0.00–1.77 for v1's 2-week average.
- **A sudden honest loss** (half the stake leaves at once) is measured at its new size from the next card; simulation 4 must show the expected index back within 0.02 of 1.00 within 24 h.
- **Honest growth** is capped by credit and gives no gain (expected index stays ~1.00).
- **New producers:** at least 24 h of history to enter; labelled "new" (exact windows as built: §15). "First observed VHP" (L-5) = the producer's VHP at its **first signed block**.
- **Small producers:** one bar, k ≥ 10 (Last Node's comes down to it, D-091, R-LN-4: in an hourly round that admits producers from ~0.83%, against 1.7% today), a luck trim in every game, and a visible paddock. The per-game simulations must show a producer with k near 10, which gets the largest trim, stays within the luck band.
- **A pick on a producer that falls below the bar at `T` (L-4):** each game states its rule in its file. Default: **the pick is void and its slot can be re-picked if the game allows changes; otherwise it scores 0 points and the game's page says so before picking.** Combo prices are set before sending, and the ruler's card comes after the lock: Combo shows the estimated factor and voids a leg whose producer falls out.

## 6. How each game plugs in (each keeps its own formula; credit in every row)
| Game | On the ruler | Honest players should know | When |
|---|---|---|---|
| **Race (7)** | `k` from `own` (at a random moment in the 6 h before each race's lock) and `total`; kTop from `avg` of the top producer; **credited blocks**; `form` as an entry check (replaces today's "3 standard deviations" floor) | shrinking producers no longer lose more often; the field is decided at the random moment | **first** (R-RACE-5) |
| **Block X (2)** | multiplier `min(3, avg(top) ÷ own(p))` at a random moment in the 3 h before the lock; **credit at the target block** replaces the "card after" check | a pick's expected payout is top ÷ network total whatever the producer does with its VHP | with or right after the Race |
| **Last Node (13)** | `own`, **credited blocks**, `trim`; entry k ≥ 10 in its round; **form as a gate only** (today's `r.kh × r.r` multiplier is replaced); keep its weekly watch | the steering trick closes; smaller nodes can enter | before its launch if possible |
| **Fantasy (4) + Rival (5)** | `own` shares, **credited blocks**, `quality` gate (R-FA-3); normalise `k` (fixed cap of 130) | indexes sit a little lower; flagged cards no longer count | before its launch |
| **Combo (8)** | each leg reads the ruler as its game does, **credited blocks** on every leg | the price shown is an estimate; a leg whose producer falls out is void (§5) | with Picks v2 |
| **Bracket (9)** | baseline → `own`, **credited blocks**; seeding and forfeits stay on day averages / minimums (D-086, D-087; seeding needs to be known before picks); add a trim (R-BR-7) | — | after R-RULER-1, with its #E-3 fixes |
| **Survivor (3)** | Season 2: `own`, **credited blocks**, `trim`, **form as a gate** (D-095) | moves from blocks signed to VHP: different survivors | Season 2 |
| Questions (1), Block Golf (6) | not used | — | — |

## 7. Data: where it runs, and how a wrong file is caught (M-3)
- **One library**, `vhp-ruler.js` (pure functions shared by recorders, publish jobs and the site), grown from `vhp-standard.js`; one data step, `bot/vhp-ruler.ts`.
- **Branch `vhp-data`, one file per hour, written once, never rewritten, hash-chained** (each file carries the previous file's sha256). Each hour stores, compactly, **every block's signer and its burn** (every block changes its signer's VHP, so change points aren't sparse, L-2), the hour's other VHP events, and **an anchor: both nodes' `effective_balance_of` (and the plain balance, D-112) for every active producer at the hour's last block**.
- **Anchors for past hours (D-112):** a node can only read balances at the block it is on now, so the first fill's hours carry anchors **rebuilt** backwards from one real read (`"source": "rebuilt"`); live hours carry both nodes' real reads (`"live"`) with the height each read landed on. **No card that pays may depend on a rebuilt hour.** If the first live read fails or the nodes disagree, the hour is not ok and no card is made (audit S-3). About 0.30 MB gzipped for 15 days (measured).
- **The publish job checks each hour:** the hash chain; exactly one signer and one burn per block; the previous anchor plus the hour's events gives the next anchor; both nodes' anchors agree. A file with one burn removed must be refused (a test).
- **It recomputes every card from `vhp-data` and refuses any difference**, reading older day files when a card's history reaches back that far.
- **Retention:** the look-back (with v2's own size, at most 24 h for `avg`, 14 days for `form`) plus the longest re-check (a week frozen up to ~a week later): **about 22 days**, kept as hourly files then day files. **At the start keep 30 days** (the simulations need 29), then about 22 (D-112). Each day file lists its hours' sha256, so the hash chain still checks after a rollup.
- **First fill (L-6):** a **separate, resumable job** that saves progress, reads the history once in batches on two nodes outside busy hours; normal runs then read one hour at a time (blocks the recorders already read). No polling, no Mana.
- **The sampler** keeps running as a cross-check during the move, then retires.

## 8. Proving it's fair (before anything pays)
**Data:** at least **29 days** of real history (14 days of form look-back plus two weeks of cards), plus synthetic fields. **Pass marks** (from #E-7):

| # | Simulation | Pass mark |
|---|---|---|
| 1 | Honest field, including a producer that never re-burns (shrinks ~1%/day) and one that re-burns hourly | every honest producer's expected index within **1.00 ± 0.01**; Race win chances within **0.85–1.15 of fair** over ≥ 10,000 races |
| 2 | 100+ producers under 1% | the same marks; no producer under 1% tops more than its fair share plus D-101's luck band |
| 3 | Every trick in §4, **assuming the hidden VHP is parked for free** | expected gain **≤ 0** (within simulation error) at 0.2%, 2%, 20% |
| 4 | Honest shrink and growth; choose own's window (spot, 1-h high, 24-h average) | after losing half its stake, expected index back within **0.02** of 1.00 within 24 h; growth gives ≤ +0.01 |
| 5 | Node faults (lag, wrong answer, outage at the card moment) | **100% flagged, 0 scored** |
| 6 | Seed grinding with **free choice** of card time | expected index moves ≤ **0.5% at the 90th percentile** |
| 7 | Vault deposit swings (the pool rule, §3.2), with its real history | no withdrawal pattern changes the Vault's win chance beyond the luck band |
| 8 | Form steering and outage recovery | skipping blocks never raises a win chance; an honest 3-day outage gives no boost afterwards |
| 9 | A producer joining or leaving mid-week; the network total jumping (a large mint, a big producer leaving) | honest indexes stay within ±0.01 |
| 10 | A pick on a producer that falls below the bar at `T` | handled by each game's stated rule (§5) |
| 11 | JavaScript vs Python on real data | **byte-identical cards** |

## 9. Parameters (defaults; simulation sets the final values)
| Parameter | v2 default | Set by |
|---|---|---|
| Own size | eff at `T`, or the highest eff in the 1,200 blocks before `T` | simulation 4 |
| Average for others | 24 h (28,800 blocks) | simulation 1 |
| Form | 14 days; **gate at 0.80**, no multiplier | simulation 8 |
| Entry bar | k ≥ 10 in the scoring window; 24 h of history | `../archive/2026-11-05/HANDICAP_REVIEW.md` §5.2; simulation 4 |
| Luck trim `c` | per game, fixed or per card (each game states which) | each game's simulation |
| Card window | per game (Race 6 h before lock; Block X 3 h) | each game |
| Seed | the first irreversible block at or after `L + 20` (a VRF output if available); exact byte recipe D-112 | §2.3 |
| Pooled producers | the Vault; `min(own, eff at each block)` | simulation 7 |

## 10. Build and migration plan
1. Owner approved v2: approved 4 Nov (D-111).
2. **The VHP Ruler chat (R-RULER-1, D-110):** `vhp-ruler.js` + `bot/vhp-ruler.ts` + the `vhp-data` recorder (hash-chained, anchored) and publish check + the first-fill job; tests (including a line-by-line copy of the VHP contract's snapshot code, as `vhp-standard` has); the 11 simulations of §8 on 29+ days of data; Repo Lens.
3. **Race (R-RACE-5)** moves first; its two known gaps close. A fix-check, then it pays on the ruler from the next Monday.
4. Block X, then Last Node, Fantasy, Combo, Bracket as each is ready; Survivor from Season 2.
5. Retire the sampler once no game reads it.
Until a game moves, it keeps today's method (D-094); a switch takes effect from a Monday.

## 11. Risks
| Risk | Handling |
|---|---|
| A bug in the shared library hits every game | Repo Lens; each publish job recomputes from anchored data; games move one at a time, Race first |
| A wrong or partial `vhp-data` file | write-once, hash-chained hours; two-node anchors; continuity check (§7) |
| The first fill is heavy | a separate resumable job, in batches, off-peak |
| A producer changes address or key | a new address is a new producer ("new", §5) |
| The seed producer grinds | logged; ≤ 1.35% measured; a VRF seed if available |
| An effective-balance rule change in a Koinos upgrade | the hourly `effective_balance_of` anchor catches it (flag, no scoring) |
| Recorder and publish job round differently | integers and fixed point everywhere; a JS-vs-Python byte test (§13) |

## 12. What the owner approved (v2, in plain words; D-111)
1. **Measure a producer as it is at the measuring moment** (or its highest in the hour before), not by a 2-week average. Others are measured by 24-hour averages, and **card credit is always on**. *This replaces the 2-week look-back of D-093.* The review showed that the average makes honest producers look too big, because every block burns VHP from its signer, so they would lose more often. Card credit is what really stops hiding. Recommended: approve.
2. **A random measuring moment** from a block 20 blocks after the lock. The block's producer can nudge it slightly, but by about 1% at most on real data. Recommended: approve.
3. **One entry bar and a luck trim in every game, and form only as a warning light**: it can bench or flag a producer, never change its odds. Otherwise skipping blocks on purpose would pay. Recommended: approve.
4. **Build order:** a dedicated VHP Ruler chat builds it (D-110); the Race moves first; **nothing pays on it until the data file has its checkpoints and all 11 simulations pass** on at least 29 days of data. Recommended: approve.
5. **New producers** need 24 h of history and a "new" label, measured from their first signed block. **The Knode Games Vault** gets a special rule, so depositors can't make it lose a race by withdrawing mid-race; if that rule fails its simulation, the Vault stays out of handicapped fields (except the Bracket, D-086). Recommended: approve.

## 13. Interface (for the builder)
```ts
type Height = number; type Addr = string;
type Milli = bigint;        // fixed point: millionths, always rounded down
type Sat = bigint;          // VHP in satoshi (1 VHP = 1e8)
interface Anchor { height: Height; node: "a" | "b"; source: "live" | "rebuilt"; eff: Record<Addr, Sat>; bal: Record<Addr, Sat> }    // effective_balance_of and plain balance; "rebuilt" hours never pay (D-112)
interface RulerHour { from: Height; to: Height; prevHash: string; signers: Addr[]; burns: Sat[]; events: unknown[]; anchors: Anchor[] }
interface RulerData { hours: RulerHour[] }
interface Card {
  ruleVersion: 2; game: number; round: string;
  T: Height; seedBlock: Height; seedBlockId: string; seedProducer: Addr;
  window: { W0: Height; W1: Height; S0: Height; S1: Height };
  c: Milli; total: Sat;
  producers: { a: Addr; own: Sat; avg: Sat; k: Milli; form: Milli; entry: boolean; pooled: boolean; isNew: boolean;
               quality: "ok" | "flagged"; expected?: Milli; signed?: number; credited?: Milli }[];
}
function cardTime(seedBlockId: string, game: number, round: string, W0: Height, W1: Height): Height;
function makeCard(d: RulerData, game: number, round: string, w: Card["window"], seedBlockId: string): Card;
function credit(d: RulerData, card: Card, a: Addr, b: Height): Milli;   // min(1, own ÷ eff at b), millionths, floor
function trim(k: Milli, c: Milli): Milli;                                 // c ÷ √k, millionths, floor
function checkHour(prev: RulerHour, h: RulerHour): { ok: boolean; why?: string };   // chain, one signer + one burn per block, anchor + events = next anchor
function recompute(d: RulerData, published: Card): { same: boolean; diff?: string };
```
- **Every number is an integer:** VHP in satoshi; averages = `floor(Σ ÷ blocks)`; `k`, `credit`, `form`, `trim` in millionths, rounded down; credited blocks = the integer sum of per-block credits. Ratios are never computed in floating point. **Each block's share is rounded down first, then the integers are added** (D-112); the loss is under 1 millionth per block, and a test checks the bound.
- **A test** that the JavaScript library and a Python re-implementation produce **byte-identical cards** on real data (§8 sim 11).

## 14. What changed from v1 (Repo Lens #E-7)
| Finding | v2 |
|---|---|
| **H-1** (High) the 2-week average under-scores honest, shrinking producers | own = eff at `T` (or a short high before it); 2-week average removed; "shrinks 1%/day, never re-burns" is a standard honest case (§3, §5, §8) |
| **H-2** (High) form can be steered where it lowers expected blocks | form is a gate only; a kept multiplier may only raise; weekly watch required (§3, §3.1, §6) |
| **M-1** hiding cost overstated | card credit is the protection; net reward ~0.16 KOIN/block; tricks must fail even if free; credit in every §6 row (§0, §4) |
| **M-2** VHP leaving mid-race; the Vault | `pooled` producers: `min(own, eff)`; else out of fields except the Bracket (§3.2) |
| **M-3** a wrong data file passes; 15 days too short | write-once, hash-chained, two-node anchors, continuity checks; ~22 days kept (§7) |
| **M-4** rounding | integers / millionths everywhere; Card fields added; JS-vs-Python byte test (§13) |
| **L-1 … L-7** | many-ID grinding + VRF option; compact per-block storage; Σk normalisation; picks below the bar + estimated card; first observed VHP; resumable first fill; active-set note |
| §8 | 29+ days of data, pass marks, five more simulations |

## 15. As built (VHP Ruler chat, 4 Nov 2026; on `main` since PR #163, merged 5 Nov at `978c96b`; off until `vars.VHP_RULER_ENABLED`)
- **Data (§7):** hour files are **block-hours of 1,200 blocks**; each holds per-address live reads `[height, balance, eff]` (a node answers only at its head); kinds **live / rebuilt / chained** (#D-10 M-2 catch-up); block ids stored (~77% of each ~110 KB hour; ~2.7 MB a day, ~0.9 GB a year, I-094); **the publish job re-reads every new block's id and signer on the second node (`RPC_CHECK`) before publish** (#D-10 M-1; no third node, D-126). A chained hour's anchor is max(its end, the previous anchor) (#E-14 N-1); the oldest kept hour may be chained; **a live run reads once, for its newest hour, and writes the run's older hours chained** (#B-6 D-1), which keeps every day file about 3–5 MB, far under the publish job's 16 MiB limit. Audit S-3 answered on mainnet: `effective_balance_of` reads match the rebuild at **the block after** each read ("next").
- **Interface (§13):** `Card` gains `formFrom`; `recompute(L, card, game)` takes the game's own settings (#E-12 M-1); **a paying card needs 14 days + 6 h of data** (#E-12 L-1); `quality` is per card (#E-12 L-2).
- **Simulations (§8), 31 days, 60 race cards × 2,500 races:** pass 3, 4, 5, 8, 10, 11 (40 / 40 real cards byte-identical); miss 1, 2, 6, 7, 9 (I-091; proposals D-119, D-120, D-122).
- **Windows and labels (§13):** rebuilt / pending checks start 19 blocks early (#B-5 N-7, #B-6 B6-1); a paying card is "not yet … (from block N)" while unverified chained hours are in its windows (#B-5 N-3, #B-6 B6-3). **"New" (decided by the library chat, 5 Nov, #B-6 B6-5):** the standard follows the build — *new* = no signed block in [T − 410,400, T − 403,201]; *history* (what entry uses) = a signed block in [T − 410,400, T − 28,800]. A long-standing producer that signs rarely can be labelled new; that is only a label (entry uses history), so it is accepted.
- **Repo Lens:** #E-12, #D-10, #E-14, #B-5, #B-6 all fixed; the #B-6 re-check is **GO** (its notes F-1, I-1, I-2 fixed in `0d103a6`). Not done, owner's choice: #E-14 M-1 "stronger" (also re-read burns, VHP events and balances). Open Lows: L-5 (one backend under two names; no response-size limit), L-6 (a permanently undecodable block stops the ruler).
- **Timing:** one day of blocks reads in about 1 min per node; the 30-day first fill about 30 min per node (10–15 min over three parallel jobs).

## 16. v2.1: fixing the five missed simulations (library chat design, 4 Nov 2026; to simulate)
Owner's rulings (to the VHP Ruler chat, 4 Nov): **"Platform nodes should never be withheld from games unless specifically stated"** (D-123: §3.2's fallback, leaving the Vault out, is rejected; the pool rule must pass sim 7); sims 1, 2, 6 and 9 go to the library chat for design or pass-mark changes (D-122).

**The common cause of sims 1, 2 and 7.** A producer with few expected blocks has a noisier result. Ranking producers by handicapped blocks (blocks × multiplier, or blocks ÷ expected) gives the noisy ones more extreme scores, so they win too often or too rarely depending on the game's win rule. The Vault after a big withdrawal (fewer expected blocks at a bigger multiplier) is the same effect: 1.94× fair in sim 7. The luck trim `c ÷ √k` only partly corrects it.

**Fix A (preferred): rank by luck percentile, not by raw ratio.** The ruler adds one output per producer and scoring window:
- `pct(p)` = the producer's **mid-p Poisson percentile**: P(X < x) + ½·P(X = x), where x = its credited blocks and X ~ Poisson(expected blocks), in millionths, rounded down.
- For an honest producer it's spread evenly between 0 and 1 **whatever its size**, so every honest producer wins its fair share; a pooled producer's lower expected blocks after a withdrawal (`min(own, eff)`, §3.2) no longer buys extra wins.
- Games that rank producers against each other (Race, Last Node, Bracket matchups) rank by `pct`; ties broken by the card's seed. Games that pay by size (Block X's multiplier) keep their formula; the ruler's job there is only an honest `own`.
- Integer math: the Poisson terms by the recursion p(i+1) = p(i)·λ/(i+1) on a wide fixed-point scale (e.g. 2^1024, so λ up to the largest one-hour expectation stays exact), floor at each step; JavaScript and Python byte-identical (sim 11).

**Fix B (fallback, if A changes the games too much): tune, don't redesign.** Re-run sims 1 and 2 with the entry bar at k ≥ 15, 20 and 30 and the trim `c` recalibrated; pick the lowest bar that passes. For sim 7, a pooled producer's expected blocks use its **time-weighted average** eff over the scoring window instead of the minimum, and its `c` is set from that average.

**Sim 6 (grinding, +0.62% vs 0.5% at the 90th percentile):** accept as a known residual (a fraction of one percent of one producer's expected blocks); keep logging the seed producer; move to a VRF seed if Koinos offers one. Re-measure under Fix A.

**Sim 9 (a network-wide jump moves every index together ×1.10–1.27; rankings hold):** the ±0.01 mark stays for **one** producer joining or leaving. For a jump in the whole network, the mark becomes **relative win chances within 0.85–1.15 of fair** (Fix A makes this nearly automatic: percentiles move together).

**Form for producers that throttle on purpose (D-120, owner to choose):** the owner notes JGA Pool #2 throttles its own production on purpose and steadily. Options for the Ruler chat to simulate:
1. **Keep the 0.80 gate** (v2 as approved): a steady 0.66 producer stays out.
2. **A consistency gate:** gate on a producer's form *falling* below 0.80 × its own 14-day form, not on the level; and its expected blocks use `own × its 14-day form` (capped at 1), so a steady throttler is handicapped at the size it really plays. Sim 8 must still pass (steering must never pay: lowering form for 14 days to get a softer handicap costs real block rewards, and the simulation has to show it never wins more).
3. **Let it in unadjusted**, with its form shown on the card (it would usually lose).
**Owner chose option 2 (D-120).** Design to build and simulate:
- **Long-run rate:** `rate(p)` = the producer's signed blocks ÷ its expected blocks over the last **14 days** (form's window), in millionths, capped at 1; expected blocks for the card use `own × rate`.
- **Only steady producers get it:** the rate is used only if each of the last 14 daily rates is within ±0.15 of the 14-day rate; otherwise rate = 1 (v2 as approved) and the 0.80 gate applies as before.
- **Steering cap (the #E-7 H-2 protection):** in the scoring window, blocks signed above `own × rate × (1 + luck band)` earn no extra credit, the same way card credit caps VHP added after the card. So skipping blocks for two weeks to lower the rate, then signing in full during a race, can't pay beyond the luck band.
- **Sim 8 must pass with it:** skipping blocks never raises a win chance; a 3-day outage gives no boost; a steady throttler (JGA Pool #2's real history) wins its fair share.

**Rebuilt hours (D-119, owner to choose):** (a) **as D-112 is written**: only the 24 h before the card and the scoring window must be live, so paying cards can start about a day after the first fill; form's older days may use rebuilt hours (built from two-node-checked blocks, and the first live read matched the rebuild exactly, S-3); or (b) **strict**: no rebuilt hour anywhere in the 14-day look-back, so paying cards start ~15 days after the first fill. **Owner chose (a) (D-119)**; built (`0d0f35d`).

**Order of work (R-RULER-1):** implement `pct` and Fix B side by side, re-run all eleven simulations, report both; the owner picks; then the fix-check and the PR. Nothing pays until all eleven pass (D-111).

