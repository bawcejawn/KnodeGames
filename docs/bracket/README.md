# Producer Bracket (game 9) — how it works, for reviewers

A weekly knockout of Koinos block producers, head to head (D-141): one round a day, the final on Saturday. Players
pick every winner of the whole bracket by Monday night, as **one number** on the Knode Games Picks contract (game 9).
A keyless recorder turns the chain's blocks and picks into results, points, boards and one weekly file for the Vault
(v6), which pays the Bracket's stake bucket and its free-play prize. Nothing in this game holds or moves tokens.
Timing follows `.ai/standards/WEEK_CYCLE.md`; the recorder follows `.ai/standards/RECORDER_STANDARD.md`.

## The week (all times UTC)
| When | What |
|---|---|
| Sunday 00:00 (before the week) | **Seeding**: every producer's exact effective VHP averaged over the 28,800 blocks before; each producer's seeding VHP is the **lower** of that and its average at the last seeding up to 4 weeks back, **0 if it wasn't there** (#E-3 M-6, fix-check RC-1; only the very first bracket uses today's average alone); the field = producers expected to sign ≥ 10 blocks in a 6-hour race on that VHP; biggest = seed 1. It counts only once a **later run reads it again** on both nodes and finds the same (fix-check F2). Picks open. Not seeded within 24 h → the week is void. |
| Monday 23:55 | Picks lock (Picks `lead` 5 min, `ahead` **46 h** recommended so picks open after the seeding is published (fix-check RC-6; the recorder accepts ≤ 48 h), TIME lock, `round_size` 7 days, target = Tuesday 00:00, round = week + 2,963). Picks are recorded from two nodes within **3 h of the lock**, or the week closes at the backstop (fix-check F3, RC-4). Like hours, they count only once a **later run reads them the same** (`picks.re`); stakes are read and the week goes final only after that (fix-check 2 PK-1). |
| one round a day, final Saturday | **32** (32+ producers) Tue–Sat; **16** (16–31) Wed–Sat; **8** (8–15) Thu–Sat; under 8 → no bracket. No byes. Capped at 32 so the bracket fits one Picks number (31 matchups). |
| Sunday | Review day: every recorded hour is read again on both nodes in a later run (the two-run rule); results are **pending**. Picks for the next week open. |
| Monday 00:00 (after the week) | Final, once every result is in, every hour is re-read, and the Vault's end-of-week stakes have read **the same in two runs** on both nodes (fix-check F1). Not done by **Thursday 00:00** → closed without a vault file (`vault: "missed"`, or void if the results never completed). |

## A matchup (bracket-math.js, on the VHP standard in vhp-standard.js and docs/VHP-STANDARD.md)
- **baseline** = the seed's effective VHP just before the day's first block (received VHP counts after 20 blocks).
- **expected** = baseline × Σ over the day's blocks of 1 ÷ (effective VHP of every producer active in the 7,200 blocks before).
- **credited** = Σ over the blocks it signed of min(1, baseline ÷ its effective VHP at that block).
- index = credited ÷ expected; higher wins; exact tie → the lower seed (underdog). The shared Σ cancels within a matchup,
  so gifts and top-ups are neutral and moving VHP away only lowers a producer's own chances.
- **The Knode Games Pool** (the vault, `pooled` in the seeding; D-086, #E-3 H-4) stays in the field and is judged on a
  **rate index**: Σ over the blocks it signed of 1 ÷ its effective VHP then, divided by the same Σ q. Its expected value
  is 1 for any VHP path, so deposits and withdrawals timed around 00:00 can't move it. It never forfeits.
- **Forfeit** (#E-3 H-5): the seed's effective VHP **averaged over its round's day** (over the day's blocks) < 0.5 × its
  seeding VHP → it loses the matchup (both forfeit → the index decides). A one-block dip at midnight forfeits nothing.
  Compared in exact integers everywhere: 2 × Σ(av × n) < seeding satoshi × Σ n (fix-check B-1: float sums pass 2^53).
- **Disclosed (fix-check RC-2):** no rule can stop a producer from losing on purpose (e.g. signing from a second address
  of its own); it can never make itself win. The Knode Games Pool's rate index can be moved only by a depositor holding
  almost all of the pool (RC-5, ≥ 99.9%). Matchups are mostly luck by design (RC-7: the underdog wins 44–52%; D-141
  moves them to the ruler's luck percentile).
- D-141: matchups move to the VHP ruler's luck percentile once ruler v2.1 passes its simulations (R-RULER-2).

## Scoring and ranking
- 1 / 2 / 4 / 8 / 16 points by round, +2 for the right champion.
- The number: bit n = "the lower seed wins matchup n"; any number ≥ 2^(size − 1) scores nothing.
- Order: points → a right champion → more right winners → **the earlier bracket** (its last change's time, from the
  Picks contract, i.e. its block's time) → still tied shares the place. Identical brackets sent in the **same block
  share the place** (D-087, #E-3 H-6): a producer that also plays could put its copy in the same block as the original.
  The all-time board shares ties.

## Players, boards and the Vault file
- **Staked player**: the Vault's own rule (Block X's reader, with the `v6_rule_week_plus_one` gate): `week_stake` (the
  lowest that week; 0 if everything was withdrawn) ≥ the week's minimum stake (1 VHP today). Read on both nodes during
  the week for the boards, and **again after the week has ended** for the vault file (#E-3 M-1, L-8).
- **Free player**: anyone else, guests included. A player the Vault would refuse a free prize (peak stake that week ≥
  the minimum) is "held" and is shown on the Staked board, where it earns nothing (#E-3 M-2).
- `vault/W<week>.json` = `{game: 9, week, final: true, rows, first, second}`:
  - `rows`: staked players with ≥ 1 point. The groups the Vault must pay (its top 30% by headcount, ceil, ties whole,
    worked out first) get 255, 254, … in the order above; every other row gets 1, so the Vault's own cutoff pays exactly
    those groups whatever the number of places (#E-3 C-1). More than 254 paid groups: the lowest share 2.
  - `first` / `second`: free players with ≥ 1 point (the vault bot posts them only when game 9's free-prize switch is
    on: `npm run prizes`; it is **off** from vault week 4, owner 11 Nov).
  - Free-play medals on the boards (`earns` 1 / 2) and `lastWeek.prizes` follow the same switch: the record job copies
    `free-prizes.json` from the `prize-settings` branch (`BRACKET_FREE_SWITCHES`), and the recorder uses the vault bot's
    rule (`prizeOn`, game 9). No readable file = no free medals (fails closed). The page and Leaders say no free prize
    is paid; a week before `BRACKET_PRIZES_FROM_WEEK` shows a practice notice. One player in 1st → those tied next are 2nd. Several tied for 1st →
    they share all 3 VHP, no 2nd. More than 10 tied at a place → that place and below stay empty (back to the pool).
  - Written only when the week is final, from Monday 00:00 to Thursday 00:00 UTC after it.

## Data flow and trust model
1. `bot/games/bracket.ts` (GitHub Actions, `.github/workflows/games.yml`, no secrets) reads **irreversible** blocks with
   receipts on **two** nodes (`bot/vhp-chain.ts`); every decision uses the **lower** of the two nodes' irreversible
   blocks and its time, read on both (#E-3 M-8).
2. Exact VHP is rebuilt from the VHP contract's events (reverted transactions skipped), anchored by balance reads pinned
   to one block; fork check on block ids; no balance below zero at any point of the walk; cross-check against the
   contract's `effective_balance_of` (3 tries, then skipped with a warning — not yet seen live, R-BR-6). Known limits
   (#E-3 M-7, L-1, L-9) are written in `bot/vhp-chain.ts`.
3. Both nodes must produce identical hours, seeding, picks and stakes, or nothing is written. Every hour is read again
   in a later run before the week can go final.
4. The publish job runs **no repo code**, and a bad Bracket file holds only the Bracket (never Block X, #E-3 M-3):
   - every file must be exactly the recorder's own JSON form and JavaScript-safe; names and sizes are checked per game;
   - the recorder's own load rules (seeding hash, sizes, sorted lists, hour fields; #E-3 M-9);
   - **results and points are recomputed in the job** from the published seeding, hours and checked picks, with a port
     of `bracket-math.js` differential-tested against it (`tests/audit/bracket-publish-port.test.mjs`; #E-3 H-2);
   - **the job's own clock bounds new history** (#E-3 H-3): new weeks only last/this/next week and never final; index
     weeks only with their file; seeding after its time; picks after the lock; an hour after it ends, and marked re-read
     only in a later run; stakes after the week starts, the end-of-week read after it ends; final no earlier than
     Monday 00:00 UTC after the week; nothing goes backwards (no locked → void before the backstop, no stakes → null);
   - **published history is kept**: a published seeding, recorded hour, checked pick list or final week never changes;
   - a **Vault file** must equal what the final week gives (in the same run that makes it final, #E-3 M-5), within its
     window; Vault files are write-once.
5. The page (`bracket.html`, `bracket.js`) reads only those published files and the pinned Picks contract (#E-3 L-13);
   it signs only a `pick` for game 9's round, and only the exact bracket, account and week shown in the check pop-up
   (frozen at review, re-checked at send, the page behind made inert; the lock guard uses the chain's clock; #E-3 C-2,
   L-2).
6. The Vault bot (`bot/vault.ts`) reads `games-data:bracket/vault/W<week>.json` and posts it.
7. A recorder failure fails the run after publishing (the alert job), so the owner gets an email (#E-3 M-4).

## Fix-check of 5 Nov (Repo Lens, PR #186) and how each finding is closed
| Finding | Closed by |
|---|---|
| B-1 forfeit float vs integer | exact integers on page, recorder and job; strict "under half"; threshold and 2^53+ cases in `bracket-publish-port` |
| F1 stakes trusted | end-of-week stakes must read the same in two runs; the job takes a final week only with stakes an earlier run published |
| F2 seeding trusted | the job re-derives seeds, VHP and size from `seeding.raw` and the last seeding's; a later run must re-read the seeding (`re`); no first seeding after 24 h; only the Pool may be pooled |
| F3 late picks | two-node picks only; first recorded within 3 h of the lock (job's clock), never changed |
| F4 forged hour can't be repaired | `BRACKET_RELEASE` (repo variable, weeks): a disagreeing two-node re-read may replace seeding (before picks), hours or end-of-week stakes; the new reading is re-read again before final |
| F5 hash text | seeding VHP values are whole hundredths, 0.01–1e9, on both sides |
| F6 size gap | one limit: 2048 KiB |
| F7 file flood | at most 12 Bracket files a run |
| F9 shared job | the Bracket records in its own job and artifact |
| RC-1 fresh address | missing from the last seeding → 0 |
| RC-2 throwing | disclosed (above, page) |
| RC-3 open KOIN Vault request | reported as still open, and no new send while it may still be approved (see W-1 below) |
| RC-4 picks never recorded | void at the backstop |
| RC-6 bots first | `ahead` 46 h recommended |
| F8 (Low) | the vault bot skips rows it can't post; our rows use the same stake rule, so a skip means a stake changed on chain: Vault chat to confirm |
| B-3 (Low) | single values > 2^53 satoshi need a producer with ~90M VHP: more than all VHP that exists; refused (held) if ever |

## Fix-check 2 of 5 Nov (at 8d3d942f) and how each finding is closed
| Finding | Closed by |
|---|---|
| PK-1 picks a one-run fact (High) | the two-run rule for picks: a later run's equal two-node reading adds `picks.re`; stakes, final and the vault file need it; unconfirmed by the backstop → void |
| PK-2 late picks under release | picks (first or replacement) never after round 1's first hour, release or not |
| R-1 release + two forged runs | no final (so no vault file) while `BRACKET_RELEASE` names the week: every replaced item is read again by a run outside the release first. **Clear the variable before the week can close.** |
| F9-1 one download folder | the Bracket's artifact downloads to its own folder; only its `bracket/` folder is taken; anything else in it holds the Bracket (alert) and never reaches Block X; Bracket files in Block X's artifact are dropped |
| S-1 late seeding repair | the recorder never replaces a seeding after its 24 h (as the job); a failing week file is held on its own (with its vault file and the board), not every Bracket file |
| W-1 KOIN Vault double send | the page's lock is kept in browser storage per account and week, lasts until KOIN Vault's own expiry of the request (else 30 min), and is also set when a send's answer was lost on the network |
| FL-1 field line | field membership in whole cents (7200 × cents ≥ 10 × total cents) on both sides |
| P-2 big VHP | the job checks hundredths on the number's text, not v × 100 |
| I-1 release parser | plain spaces and digits only, the same on both sides; never crashes the job |
| T-1 | the port test also runs half + 1 sat |

## Fix-check 3 (#B-15, 6 Nov, at 3b46546f) and how each finding is closed
| Finding | Closed by |
|---|---|
| B15-2 release residual | a week goes final only when the **published** copy already carries every hour's and the picks' `re` (and the same stakes, F1): the run that confirms an item never also closes the week; the recorder goes final one run after its last re-read |
| B15-1 32-seed picks window | the "round 1's first hour" limit applies only under release, on both sides; without one, picks are taken until lock + 3 h; the recorder no longer suggests a release that can't help |
| B15-4 lock while approving | the page writes the lock **before** asking the wallet (30 min, extended to KOIN Vault's expiry when known) and clears it on a definite answer (on the chain, refused, rejected) |
| B15-3 held week as last seeding | an incoming week file that failed this run is never used as the last seeding; the published copy is |

## Leaderboards (leaderboard standard)
- Rows `{a, place, boardPlace, pts, champion, correct, ranked, earns}`: places on the player's own board (ties share);
  `earns` 1 / 2 = the free prize's 1st / 2nd, 3 = paid from the Staked bucket — **from exactly the vault file's rows**,
  only for a final week that wasn't missed and only from `BRACKET_PRIZES_FROM_WEEK` (a repository variable: the first
  week the Vault pays game 9; unset → no medals, no prize lists).
- `lastWeek.prizes` (once final): `[{player, place, vhp}]` by the Vault's payout rule (Leaders page medals).
- **Final weeks are frozen**: a later run keeps a final week's stored results and points as published.
- `games.json` has the Bracket's `board` entry (`earns: true`, `hide: ["today"]`); `leaders.js` reads both options.

## Launch (owner, only after the Repo Lens audit passes — D-064)
1. Announce game 9 in Picks (48 h): kind NUMBER, TIME lock, `round_size` 7 days, `round_offset` = Tuesday 00:00 UTC
   (`ROUND_OFFSET` in bracket-math.js), `lead` 5 min, `ahead` 46 h (owner 11 Nov), `number_max` 2^31 − 1.
2. Vault: `game-add 9 "Producer Bracket" --staked --free --season 1` (48 h). `--free` keeps a free prize possible; the
   free-prize switch for game 9 is **OFF** (owner 11 Nov; `npm run prizes -- on 9 --send` turns it on from the next week,
   and the free-prize texts in `games.json`, `bracket.js` and `bracket.html` change with it).
3. Set `BRACKET_PRIZES_FROM_WEEK` to game 9's first paying week: **5** (owner 11 Nov: Week 1, Mon 16 Nov, is practice).
4. Sponsor allowlist row for game 9 picks.
5. `games.json`: Bracket `status` → `live`, `href` → `bracket.html` (its Leaders board then shows).

## Review history
- Card-era audit and two fix-checks → replaced by exact VHP (option A).
- Option A audit (A-1 … A-5) and gift findings (G-1, G-2) → baseline + credit.
- VHP standard audit (S-1 … S-5) → card credit, average totals, skippable cross-check, page text, forfeit rule.
- Fix-check 2026-10-29 (F-1 … F-10) → Vault exempt from forfeit, own-vs-average card numbers, first-submitted tie-break,
  board fixes, page text, Vault minimum stake, 255 fallback. Open, low: F-2, F-7, F-10 (see the project docs).

## Evidence on real mainnet
- 8-day sample (`data/bracket-vhp-sample.json.gz`): the rebuild matched all 780 race-card VHP readings;
  `tools/sim/bracket/replay.mjs` runs the real recorder over it as one week.
- 100 days (branch `bracket-history`): 0 node disagreements; the better seed won 54.0% of 113 matchups.
- Repo Lens #E-3 (3 Nov) → every Critical, High and Medium fixed in one pass with D-141's shape (5 Nov); fix-check next.
