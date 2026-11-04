# Knode Games — Handicap and VHP Review

> **Purpose:** how every game measures a producer's size (VHP or blocks), when it measures it, how it turns that into a handicap, what VHP changes do to it, and how it treats small producers. Then recommendations: what should become one standard and what should stay per game.
> **Reviewed:** 2026-11-03/04, from the code on each game's branch (main for Race, Block X, Questions; `survivor`, `kg-09-bracket`, `lastnode`, `fantasy`, `combo`, `golf`). File and line references are in the review notes; the audit ids name where each weakness was found. Owner question, 3 Nov.
> **Status:** owner decided 4 Nov: **one ruler** for every game, each game keeps its own formula, checks at random moments within a window (D-090); **lower Last Node's bar** (D-091). Still open: §6 questions 2 (luck trim/cap everywhere), 3 (the Race's known gaps for the first paid weeks) and 4 (Survivor).

## 1. The idea all games share
A producer's chance of signing a block is its **effective VHP** ÷ the total of all producers' effective VHP. Received VHP counts after 20 blocks; removed VHP stops counting at once. Each game compares what a producer *actually* signs with what its size says it *should* sign, so small and large producers can compete. That ratio is the **handicap**.

Two things decide whether a handicap is fair and hard to game:
1. **The ruler:** how size is measured and when (one read, samples, an average, an exact rebuild).
2. **The rule for changes:** what happens if VHP moves before, at, or during the game's window.

## 2. Game by game
| Game | Size measured as | When | Handicap | VHP changes | Small producers | Uses the VHP standard? |
|---|---|---|---|---|---|---|
| **Race (7)** | effective VHP, **sampled** (~every 5 min, really ~hourly) | highest sample in the 6 h before each hourly card (:37), plus a production floor | h = kTop ÷ k, with a luck trim c ÷ √k | looking small just before a card: **caught** (6-h high). VHP **added after the card**: more blocks at a fixed h until the next card (~1–1.5 h): **not resisted**. Hiding VHP **> 6 h** then restoring: **not resisted** (proved 60 of 60 races, VHP-STANDARD) | k ≥ 10 expected blocks per 6-h race (~0.14% share) to race; below = "paddock"; luck trim; no h cap | No |
| **Block X (2)** | the Race card | card ≤ 3 h before the lock, **and** the first card after the block | min(3, top VHP ÷ yours) | additions caught: the lower of the two cards, plus VHP moved in is added. Looking small: caught by the 6-h high. Long hide: mostly caught by the after card | any producer can be picked; **×3 cap** | No |
| **Bracket (9)** | **exact** effective VHP, rebuilt from events on two nodes | seeding: a 1-day average (Sat); each round: the baseline at the day's first block | credited ÷ expected, with a **credit** min(1, baseline ÷ VHP-at-block) | additions **neutral** (credit). Drops at the start: neutral, but > 50% = forfeit (a one-block rule: Repo Lens H-5; the Pool H-4 → D-086) | average VHP big enough for k ≥ 10 per 6 h; top 32/16/8; no smoothing | **Yes** (its home) |
| **Survivor (3)** | **blocks signed**, not VHP | own blocks over days d−8 … d−2 | h = kTop ÷ k, no luck trim, no cap | VHP isn't read. Lowering VHP during the 7-day window (fewer blocks → bigger h) and restoring it on day d **pays**; it costs a week of real block rewards | ≥ 280 blocks in 7 days (~40/day, ~0.14% share); no trim, no cap | No (own method) |
| **Last Node (13)** | the Race card × **form** (blocks ÷ expected over 48 h, from sample averages) | field: the 12:00 card the day before; form: the 48 h before | Race formula with form clamped 0.8–1.2; luck trim from 20k simulations | additions after the field card **caught** (each hour checked against the next card; h only lowered). Watch-and-hold flags outliers | **≥ 20 expected blocks an hour** (~1.7% share): a **high bar**; top 23 only | No |
| **Fantasy (4)** | the Race card's VHP share per hour | hourly; prices from the 7 days before Saturday | index = 100 × signed ÷ expected; **cap 130**; price 20 + 1.5 × (form − median), 8–40 | looking small: caught by the card. Additions after a card: **not resisted** (until the next card). **Doesn't check sample counts or flags** on the cards it uses | only Race-field producers (k ≥ 10); cap 130 | No |
| **Combo (8)** | the Race card | priced ≤ 3 h before sending; checked at each leg's lock (+ after card for Block X legs) | factor = clamp(0.5 ÷ chance, 0.25, 3) | the lowest worth across check cards if it fell > 10%; moved VHP added. Race legs inherit the Race's gaps | Race legs: field only; Block X legs: any, ×3 max | No |
| **Golf (6)** | — (ranks players by places in other games) | weekly | place bands → strokes | inherits each hole game's gaps | — | n/a |
| **Questions (1)** | plain VHP balance (no handicap) | release vs readings in the window | — (rates from blocks) | question **voided** if any subject's VHP swings > 10% | — | n/a |

**In one line:** six different rulers (samples, exact rebuild, blocks, form, card shares), five different protections, and four different entry bars for small producers.

## 3. How a VHP change at each moment affects each game
| A producer moves VHP… | Race | Block X | Bracket | Survivor | Last Node | Fantasy | Combo |
|---|---|---|---|---|---|---|---|
| **away just before** the measure (to look small, bigger handicap) | caught (6-h high) | caught | neutral (baseline drops too); > 50% = forfeit | **pays** if done for days (blocks window) | caught | caught | caught |
| **away for > 6 h**, back for the game | **pays** (proved) | mostly caught (after card) | neutral (credit) | **pays** (it's the blocks window) | caught (later cards) | **pays** | Race legs: **pays** |
| **in after** the measure (more blocks at the old handicap) | **pays** for ~1–1.5 h | caught | neutral | n/a (blocks) | caught | **pays** until the next card | caught |
| **brief swing** around the start, by someone else (e.g. vault deposits) | n/a | n/a | the Pool could be forced to lose (H-4, fix D-086) | n/a | n/a | n/a | n/a |

**Cost to the cheater:** every trick that hides VHP costs the producer real block rewards while hidden (it signs fewer blocks). So most tricks are expensive, but not impossible, and a producer who also plays (or is paid by a player) can still profit.

## 4. Small producers (many are expected at launch)
What each game does today:
- **Entry bars differ a lot:** k ≥ 10 expected blocks per 6-h race (Race, Bracket, Fantasy via the Race field: ~0.14% share), ≥ 280 blocks a week (Survivor: also ~0.14%), but **≥ 20 blocks an hour (Last Node: ~1.7%)**, which keeps out almost every small node.
- **Luck:** a small producer signs few blocks, so its ratio swings wildly. Race and Last Node trim this (c ÷ √k, sized by simulation): the right tool. Block X (×3), Fantasy (130), Combo (×3) **cap** the upside instead. Survivor and Bracket do **neither**.
- **Visibility:** the Race "paddock" shows producers below the bar; most other games just leave them out.

**What happens with many small nodes:** the total VHP spreads out, so the top producer's share falls and more producers clear k ≥ 10. Fields grow (Bracket stops at 32, Last Node at 23). Without a trim or cap, a tiny lucky node can top a day (Survivor, Bracket). With too high a bar (Last Node), small nodes never get in.

## 5. Recommendations
### 5.1 One ruler for every game, separate formulas per game
**Standardise how size is measured and how changes are treated. Keep each game's own scoring formula and timing.** Games are different (a race, a multiplier, a knockout, a price), so their formulas should differ. But they should all read **the same VHP numbers** and follow **the same rules about VHP moves**, so a trick blocked in one game is blocked in all, and a fix lands once.

That means extending the existing VHP standard (D-058, `docs/VHP-STANDARD.md`, today used only by the Bracket) into a platform standard every game must use, with **game-specific parameters** (window lengths, lock times) and **standard primitives**:
1. **Exact effective VHP**, rebuilt from VHP events on two nodes (the Bracket's method). It doesn't depend on GitHub's unreliable cron timing, so it would replace the sampler over time.
2. **A producer's own handicap uses its highest VHP** over a look-back long enough to cover a "hide" (the standard's `cardVhp` = max over 7,200 blocks; review whether 6 h is long enough: the Race's > 6-h hide is proved).
3. **Card credit:** a block signed with more VHP than at the card counts only in proportion (min(1, card ÷ VHP-at-block)). Adding VHP after the card then gains nothing. This closes the Race and Fantasy in-leg gap.
4. **Other producers and totals use averages**, never one moment someone can time.
5. **One production sanity check (form)**, clamped (like Last Node's 0.8–1.2), so a producer whose VHP and blocks disagree is pulled back.
6. **A sample/flag gate:** any card used must meet the minimum quality (≥ 12 samples or the exact rebuild) and not be flagged. Fantasy is missing this today.
7. **No single-block decisions:** forfeits and seeding use day averages or minimums (Bracket H-5, M-6; D-086).

### 5.2 One small-producer policy
1. **One entry bar** across games: **k ≥ 10 expected blocks in the game's own scoring window.** It's statistical (fewer than ~10 blocks is mostly luck) and already used by Race, Bracket and Fantasy. Review **Last Node's 20 blocks an hour** against it, since it shuts out small nodes.
2. **Every game uses a luck trim or a cap** (Race/Last Node trim, sized by simulation, preferred; a cap at minimum). Add one to Survivor and the Bracket.
3. **A visible "paddock"** on every game: producers below the bar are shown, with how far they are from qualifying, so small nodes have a clear path in.
4. **Re-run each game's simulations** with a field of many small producers before launch (Race, Last Node and Bracket already have simulators).

### 5.3 Survivor uses blocks, not VHP
Survivor's blocks-based handicap was chosen because some producers sign only 75–80% of their VHP share. But it is the easiest to steer (suppress blocks for a week, then restore). Recommendation: move it to the standard (VHP card + clamped form), which covers the 75–80% case through form. Not before Season 1 on 16 Nov; for Season 2.

### 5.4 What to do now vs later
| When | What | Why |
|---|---|---|
| **Before Mon 9 Nov** | Merge PR #67 (sampler: up to 12 samples a run) | without it, every Block X target is void in the first paid week |
| **Before 16 Nov** | Fantasy: check card sample counts and flags (R-FA-3) | a cheap, clear gap before it launches |
| **Owner decision now** | Race pays from 9 Nov with two known gaps (the > 6-h hide and in-leg additions). Accept for the first weeks (each trick costs the producer real rewards) or delay Race staked prizes until card credit is in | Race is the only paying game with a proved trick |
| **Next 2–4 weeks** | Race and Block X onto the VHP standard (card credit first) (R-RACE-5) | closes the proved Race trick |
| **With the shared game kit (R-ARCH-1)** | One "VHP cards" service every game reads: exact rebuild, cardVhp, credit, averages, form, gate | one ruler, one fix; retires the GitHub-timed sampler |
| **Each new game** | must use the standard and the small-producer policy (go-live checklist step 1) | no new rulers |

## 6. Open questions for the owner
1. **Standard ruler, game-specific formulas** (§5.1): agree?
2. **One entry bar** of k ≥ 10 expected blocks in the game's window, plus a luck trim or cap in every game (§5.2): agree? Including lowering Last Node's bar?
3. **Race's known gaps for the first paid weeks** (§5.4): accept and fix within weeks, or hold Race staked prizes?
4. **Survivor on blocks** for Season 1, moving to the standard for Season 2 (§5.3): agree?
