# Repo Lens final audit: Combo Card + Picks v2, 2026-10-30, and the fixes

Audit of branch `combo` at 32fae49 (report: the owner's Repo Lens doc "Combo Card + Picks v2: Final Audit"; failing
tests: `knode-combo-audit-failing-tests.zip`). Verdict: **Picks v2 contract ready for mainnet** (release `92d555d0…`
reproduced; ~600,000 fuzzed cards, 180,000 owner sequences, 20,000 v1 records: no problem). **Combo game (scoring,
recorder, page, CI): fix first**: 7 High, 5 Medium, 12 Low, 9 Info, none in the contract. Root cause: Combo branched
from `picks` before the Block X fix rounds 2 to 4 and still handled Block X legs, stakes and publishing the old way.

**The fix round rebuilds Combo on the current `picks` branch** (RL-10): the Combo files on top of it, the page at the
site root, the root math files, `picks`' own Block X recorder, workflows and build pinning unchanged. The contract source
is unchanged: the release is still `92d555d0…` (37,689 bytes), now built with `picks`' full protoc and protobufjs pinning.

Owner decisions 2026-10-30: keep the 10% rule (RL-16); keep void legs for a horse missing from the standings (RL-15);
score bands for the Vault file (RL-18), see the note there.

## High and Medium

| ID | Sev | Finding | Done |
|---|---|---|---|
| RL-1 | High | A Block X leg on a producer missing from the race card was worth ×3. | ×1, as Block X's BX-3 (`combo-math.js` `MISSING_F100`). Test C-S-1. |
| RL-2 | High | VHP moved into a producer after the lock card was never priced. | A Block X leg that hits is checked against the lock card AND the first card after the block, both with the VHP moved into the producer between its lock card and the block (read from receipts on both nodes, the higher; Block X's `scoringVhpMoves`), lowest worth under the 10% rule. Tests C-S-2, "RL-2" in `combo-recorder.test.mjs`. |
| RL-3 | High | A Block X miss was dodged when Block X voided the target for its own reasons. | A Block X leg is decided by the signer whenever the target is final and checked on two nodes, whatever `void` says. Test C-R-2. |
| RL-4 | High | The stake-only rule never ran (old Vault ABI). | Page and recorder read the Vault v6 through `kpred-v6.koilib.json` after its `get_state` check (Block X's pattern). Recorder: both nodes, the lower stake wins; unknown → no Vault file that run (error). Page: Send off for unstaked or unknown, re-checked in `sendCard`. Tests C-W-2, "RL-4" browser test, recorder tests. |
| RL-5 | High | The deadline used one node's head time; errors didn't fail the run. | Time = the slower of both nodes, checked against the runner's clock (no fixing or voiding if ahead); nothing voided on one node; the recorder exits 1 after writing its files when it raised an error (the job turns red, its files are still published). Test C-R-1. |
| RL-6 | High | One busy week passed 2 MB and stopped all publishing. | One file per UTC day (`D<day>.json`); an oversized file is held alone with an alert, the rest (Vault file included) is published. Test C-R-4. |
| RL-7 | High | The publish job checked shapes only; the recorder trusted previous files. | The recorder reads EVERY slot of last week and this week from the chain each run (earlier files only for older days, and for display when a read fails). The publish job: a published fixed slot keeps its cards and a published final card never changes (else the whole run is held, with an alert); Vault files are write-once, only for the week that just ended within 3 days by the job's clock, and must equal the PUBLISHED final board's staked players with 1+ point in order. Tests C-R-5, C-R-5b, the publish-check test. |
| RL-8 | Medium | Stale or flagged race cards priced cards. | Block X's rule: at most 3 hours old, at least 12 VHP samples, nothing flagged, top not in doubt (`usableCard`, `priceCard`, `cardAfter`). No usable card at sending: the card is void; the page won't send without a fresh card. Tests C-S-3, C-R-3. |
| RL-9 | Medium | A race recorder that stopped mid-week voided legs silently. | A pending leg is voided at the deadline only when its source has published past it (a later race with a result, a later Block X target); otherwise `::error::` and wait. Test C-R-6. |
| RL-10 | Medium | Merging into `picks` broke Combo and invited a rollback. | Rebuilt on `picks` (above). Tests C-W-1, C-R-7. |
| RL-11 | Medium | Cards share Block X's Mana row. | Owner, 2026-10-30: one Picks `pick` row of 0.2 Mana at launch (admin action `sponsor-picks-limit`), from the testnet measurement (10 legs 0.0916 Mana; `claude/combo/TESTNET-RESULTS.md`). Test C-W-3 (adapted: the limit sent is at least 2× a 10-leg card, and the launch sets 0.2). |
| RL-12 | Medium | Only half of the build pinning. | Built from `picks`' pinning (all 10 protobufjs helpers, fails closed); README says `npm ci --ignore-scripts`. Test C-K-1. |

## Low and Info

| ID | Done |
|---|---|
| RL-13 | Legs are sent sorted by (lock time, code, round, producer) (`sortLegs`). |
| RL-14 | Contract tests added: CR-2 completed, v1 records read by v2, an announced loosening changes nothing for 48 h, P-2 on a card game. 71 contract tests. |
| RL-15 | Kept (owner): a horse missing from the final standings makes its leg void. |
| RL-16 | Kept (owner): 10%. |
| RL-17 | 16,000 simulated races (was 4,000) and factors rounded down to the hundredth. |
| RL-18 | **Kept the rank mapping.** The owner chose score bands, but the Vault ranks by points and only the order counts (top 30% win, weights 1/√rank: `claude/handoff-vault-results.md`), so bands would turn close scores at the top into ties and change who wins. The rank mapping keeps the exact order of the top 254 distinct scores, which covers every prize place up to 846 staked players. To be confirmed with the owner. |
| RL-19 | `ls-remote` exit 2 = no branch; anything else stops the run. |
| RL-20 | Exact key sets and ranges, safe integers, unique legs and producers per card, slot rounds of the file's day, no fixed slot before its day ends, outcomes and points recounted. |
| RL-21 | `sending` set before the first await; the day re-checked after every wait. |
| RL-22 | Guest, stake and fresh-card refusals repeated in `sendCard`. |
| RL-23 | The testnet build and the tool check the owner in the compiled code (UTF-16 string literal), not only in the source lines or the manifest. |
| RL-24 | The browser harness serves `"cards": true` and a live Vault; 7 browser tests. |
| RL-25 | The recorder records nothing unless game 8's leg types on both nodes lock exactly as `combo-math.js` (and the page) price them. |
| RL-26 | The page won't send in the last 2 minutes of a UTC day. |
| RL-27 | C-R-1 runs the recorder's two-node head path. |
| RL-28 | `scoreCard` removed (the recorder's `recount` is the one rule). |
| RL-29 | Noted: the Top-half cut uses the field at pricing and the standings at the result (not seen to differ in live data). |
| RL-30 | Accepted: the page signs only `pick` on game 8; the contract id comes from this site's own deployment file. |
| RL-31 | Share text, canonical and share URLs: `knodegames.com/combo.html`. |
| RL-32 | Race-data producers are checked as addresses before they reach the board or a card. |
| RL-33 | `keys --fresh` writes `.env.testnet` with mode 600 where the system has modes. |

**Block X admin tool (BX-19 / BX-21):** on this branch `bot/picks.ts` accepts the audited v2 code on chain and the v2
ABI for owner calls, besides v1 (Block X's calls encode the same bytes with either). Agree with the Block X chat before
merging.

**Tests:** contract 71 (as-pect); site and audit suite 625 passing (Combo: recorder 25, Repo Lens 13, page and math 17,
testnet 3, merge 4); browser 7.

## Fix-check (Repo Lens, 2026-10-30, at e0330a1) and the fixes

Verdict "fix first": contract still ready (92d555d0… reproduces, source byte-identical); RL-10 and RL-12 fixed; 6 High and
5 Medium new, none in the contract. Most came from Combo's own copies of Block X logic that `picks` had since fixed, and
from "hold the whole run" in the publish job. First `picks` was merged again (rounds 6-7, the mainnet Picks upload).

| ID | Sev | Finding | Done |
|---|---|---|---|
| FC-1 | High | A race leg kept its send worth when no usable card was in force at its lock. | No usable lock card (for that producer) makes the leg "unresolved", as for Block X: the card is void unless another leg missed. Test D-S-1. |
| FC-2 | High | A leg its source never resolved was dropped, so a losing card could score. | New leg result "unresolved" (a Block X target without an agreed signer, or a leg undecided at the deadline): a miss elsewhere still decides; otherwise the whole card is void, with an error. `recount` in the recorder and the publish check. Tests D-S-6, D-R-2. |
| FC-3 | High | One node's "0 staked" or a huge minimum dropped players from the write-once Vault file. | Any disagreement (live, minimum, any wallet's stake) is unknown: no Vault file and an error, as Block X. Test D-R-1. |
| FC-4 | High | One node's non-canonical-transfer report voided a winning Block X leg (BX-100 not ported). | Each node read on its own: both report it → unresolved; only one, or a failed read → held, unresolved after Block X's 3-day edge (with an error). Tests D-S-2, D-R-3, D-C-5. |
| FC-5 | High | One wrong final card made every honest run be held whole. | The publish job holds only the file that differs (alert); the recorder keeps a published fixed slot and its final cards as published while the chain still holds exactly those cards, so honest runs never look like rewrites. Test D-C-4. |
| FC-6 | High | The published board was never checked against the published final cards. | Before a Vault file is accepted, last week's ranking (points, hits, last hit, places) is recomputed from the PUBLISHED day files' final cards and must match the published board. Test D-C-1. |
| FC-7 | Med–High | A moved-VHP read that kept failing left a card pending, the Vault file lost silently. | Held, then unresolved at the 3-day edge with an error; an error whenever last week still has pending cards a day after it ended. Test D-S-3. |
| FC-8 | Medium | Any flag on a card made it unusable. | Block X's rule: a card is unusable for a producer's leg only if it flags that producer or the top is in doubt (`flagsFor`; `priceCard`/`cardAfter` take the producer). Test D-S-4. |
| FC-9 | Medium | Degraded honest runs un-fixed published slots and were held whole. | As FC-5: published fixed slots and final cards are kept when a read fails, a node is down or a clock is ahead. Tests D-R-4, D-C-3. |
| FC-10 | Medium | board.json had no size bound. | All time: top 1,000; Today and This week: top 2,000; Last week: everyone with 1+ point plus the top of the rest to 2,000. Test D-C-6. |
| FC-11 | Medium | Re-reading everything every run may not fit 30 minutes. | Cards final on published fixed slots are never re-priced (no receipt reads for them). Live timing still to measure. Test D-R-5. |
| FC-12 | Low | Live race-data has no samples: every card would be void. | The recorder raises an error while the newest race card has no samples. Launch gate. |
| FC-13 | Low | The 0.2 row was checked against a player-paid card. | Open: a sponsored testnet pick used 0.116 Mana (admin action text), so a sponsored 10-leg card must be measured before cards go live. |
| FC-14 | Low | `sortLegs` used an estimated Block X time. | By code, round, producer only. Test D-W-1. |
| FC-15 | Low | The loosening test was refused for the wrong reason. | The reviewer's corrected test (stored-leg path). 71 contract tests. |
| FC-16 | Low | After a wallet switch, Send could use the old wallet's stake. | Stake, slots and usage cleared when the wallet changes. |
| FC-17 | Low | The Vault file tied equal points the board separates. | Mapped by board place (as Block X). Repo Lens agreed the rank mapping is right for an order-only Vault (RL-18). |
| FC-18 | Low | `readCards` stopped silently after 1,000 pages. | Throws. |
| FC-20 | Info | The workflow guard didn't run Combo's tests. | It does. |
| FC-21 | Info | An empty Vault file could be written before v6 is live. | No Vault file until v6 is live. |
| FC-22 | Info | The page didn't check the leg types' clocks. | It does (same values as the recorder). |
| FC-23 | Low | index.json wasn't append-only. | Published days must stay; new days only last week or this week (else that file is held). |
| FC-24 | Low | Type-loose compares. | `same()` (types included) for published content and headers. |
| FC-25 | Info | Tests passing for the wrong reason. | C-R-1 now sets the runner's clock past the lie; C-R-5b writes a day file; the stake browser test runs with a live Vault; C-W-3 uses the site's real sponsor block. |
| FC-26 | Info | The recorder didn't filter race-card producers. | Filtered as on the page. |
| FC-27 | Info | `bot/picks.ts` would accept v1 after v2 is live. | Once picks-data/deployment.json records the v2 code, only v2 is accepted. |
| FC-19 | Info | Clock-edge holds for one run. | Accepted. |

The reviewer's fixtures were adapted, each change commented: real addresses (koilib's encoder checks them), a fake node
that also speaks koilib's provider interface, and the publish Python cut from combo.yml instead of a copy.

**Tests:** contract 71; site and audit suite 664 passing (5 todo, 5 skipped); browser 7; workflow guard 8.

## Fix-check 2 (Repo Lens, 2026-10-30, at c8bd49f) and the fixes

Verdict "fix first": the round-1 fixes mostly hold (FC-1, FC-3, FC-4, FC-5, FC-6; the Python recount matched the
JavaScript in 63,602 cases), but keeping published final cards opened a silent path, and missed races were not
"unresolved". `picks` merged again (rounds 8-9, the mainnet Block X announce).

| ID | Sev | Finding | Done |
|---|---|---|---|
| FC2-1 | High | A forged final card was kept by every honest run; the Vault paid it. | Every run re-checks each kept card against the race-data and Block X files (same results; race worths equal; Block X worths at most the worth without moved VHP). A mismatch: error, the card left out of the boards, no Vault file for its week. The publish job re-checks every NEW final card's leg results against the published race-data and Block X files, and holds its day (alert) on a mismatch or when the sources can't be read. Tests E-C-1a, E-C-1b. |
| FC2-2 | High | A missed race dropped the leg. | A race that is missed, void, or not checked on two nodes is "unresolved" (FC2-9 too), in `legResult` and the publish recount. Test E-S-1. |
| FC2-3 | Medium | One node could hold a card past the Vault window; cards that missed were held. | A card with a miss is final as soon as its slot is fixed; a held leg ends 6 hours before its week's Vault window closes. Tests E-S-2a, E-S-2b. |
| FC2-4 | Medium | A lagging check node rewound the recorder silently. | The recorder refuses to record (nothing written, the run fails) when a node's head is more than 30 minutes behind the runner's clock; the publish job holds a board for another week than the job's. Test E-R-1. |
| FC2-5 | Medium | Day files had no size bound. | A day is written in parts of at most 1,000 cards (`D<day>.json`, `D<day>-1.json`, ...), read back and checked as one day; last week's board capped at 10,000 rows. Test E-C-2. |
| FC2-6 | Low | The published index.json was never copied in. | Copied; the append-only check runs. Test E-C-3. |
| FC2-7 | Low | A published final card was never looked at again. | FC2-1's re-check. |
| FC2-8 | Low | The page priced legs on a card that flags their producer. | The page prices each leg as the recorder does (`priceCard(races, now, producer)`). |
| FC2-9 | Info | One-node race results decided legs. | Unresolved unless `checked === 2`. |
| FC2-10 | Info | Unicode digits in regexes. | ASCII `[0-9]`. |
| FC2-11 | Info | An empty Vault file could still be written before v6. | Liveness read on both nodes before any Vault file. |
| FC2-12 | Info | Stake agreement compared amounts. | Compares staked-or-not per node, as Block X. |
| FC2-13 | Info | Nothing records v2 after the upgrade. | Open: the upgrade step must write `wasmSha256` in picks-data/deployment.json (runbook). |
| FC2-14 | Info | Shared concurrency group with games.yml. | Open: measure a live run (FC-11) first. |
| FC2-15 | Info | Stale header comment. | Updated. |
| FC2-16 | Info | Behind picks round 8. | Merged; Block X's exact-JSON (byte-form) check ported to combo.yml, with Node pinned in the publish job. |

The reviewer's stricter tests (D-S-1 strict, E-S-2b, E-R-T3, E-R-T4, D-C-1 corrected) pass. C-R-1 runs with the true
clock again: a clock set past the lie now makes the honest node "days behind" and the run is refused (FC2-4). The
browser tests wait out the last minutes of a UTC day (the page refuses to send then; RL-26).

**Tests:** contract 71; site and audit suite 716 passing (5 todo, 5 skipped); browser 7; workflow guard 8.

## Fix-check 3 (Repo Lens, 2026-10-30, at 8f54c8c) and the fixes

Verdict "fix first": most of fix-check 2 holds (FC2-2, -4, -5, -6, -8..-12, -16). The new kept-card re-check (FC2-1)
was too strict on honest cards and too loose on forged ones, and the publish job checked only leg results.

| ID | Sev | Finding | Done |
|---|---|---|---|
| FC3-1 | High | The re-check called honest cards forged: a miss with a leg still pending, a Block X leg left unresolved by the chain (non-standard transfer on both nodes, a read held to its edge). | `recheck()` accepts exactly what an honest run leaves: a miss is checked on a leg it shows as a miss; a Block X leg the chain left unresolved is accepted where the files show a hit; the deadline and hold edge are judged by chain time alone (FC3-10). Sources not there yet (an outage): "unchecked", an error and no Vault file this run, the card stays. Tests G-S-1a..d, G-R-1, G-R-1b, G-C-3. |
| FC3-2 | High | A lowered Block X worth passed. | Block X worths both ways: the worth with moved VHP counted as 0, or, if lower, exactly the worth with this run's moved-VHP reads (read only for those cards). Tests G-S-2, G-R-2, G-C-1. |
| FC3-3 | High | The publish job checked only leg results. | For every NEW final card, against the published race-data and Block X files: the price card (the latest usable race card before it was sent), each result, "unresolved" only with a reason the files show (or, for a Block X leg the files show as a hit, the chain's), a hit worth 0 only for a horse not in the field when sent, hit worths 0.25-3, a hit's settled time, and final only on a fixed slot. **Open:** the card's existence on chain and its exact race and Block X worths need the chain and the race simulation; see "Open" below. Tests G-C-1b, G-C-2, E-C-1a (corrected). |
| FC3-4 | High | `settled` was never checked. | The re-check compares it on hits; the publish job recomputes it (the time the last leg was decided) for new final hits. Tests G-S-3, G-R-2. |
| FC3-5 | Medium | Day parts could be added and never removed. | Part 0 names its count (`parts`); a day is read only as exactly those parts, and is published only with exactly those parts; published parts a day no longer has are removed in the same commit. Test G-C-4. |
| FC3-6 | Low | board.json could pass 2 MB from last week's rows. | Last week capped at 6,000 rows; more players with a point than that is an error and no Vault file. |
| FC3-7 | Low | Quadratic matching of kept cards. | A Map by chain key. |
| FC3-8 | Low | A non-list `cards` crashed the publish check. | Types checked first. |
| FC3-9 | Info | A lagging check node stops recording. | Accepted (safe). |
| FC3-10 | Info | The re-check used this run's agreed/late. | Part of FC3-1. |
| FC3-11 | Info | Dead branch for missing Block X files. | Checks that targets were read. |
| FC3-12 | Info | One node could lower a rival's Block X worth. | Covered by the FC3-2 lower bound with two-node reads (the higher of the two counts). |
| FC3-13 | Info | Stale comments. | Updated (combo-math.js VOID LEGS, combo.ts header items 5 and 7, loadDay). |

Test changes of ours: the hand-written day files in four tests name their parts (`parts: 1`); G-C-2 now also checks
that the day is held by the card check, not by the missing count.

**FC3-3, the rest: the verify job (owner, 2026-10-30: "build the checking step").** `combo.yml` now has three jobs:
record → **verify** → publish. The verify job has a read-only token and installs nothing: it runs plain `node` on this
repository's own files (`tools/combo-verify.mjs`, the shared scoring `bot/games/combo-score.mjs`, and
`bot/games/vhp-inflows.mjs`, a copy of Block X's moved-VHP decoder that a test keeps identical to blockx.ts's). For
each day file it confirms, on two nodes and from the published race-data and Block X files:
- a slot fixed for the first time holds exactly the Picks contract's cards for it (who, legs, time, changes), once the
  day is irreversibly over on both nodes, and the nodes agree;
- every card that turns final is what the recorder's own scoring gives (`recheck(card, day, chain = true)`): price
  card, results, worths (Block X with the moved VHP read on both nodes), settled; a Block X leg left unresolved for the
  chain's reasons must still read so.
It hands on the names and sha256 of the confirmed day files as a job output (only that job can set it). The publish
job (`COMBO_VERIFY: required`) publishes no other day file. Not confirmable this run (a node down or behind, a read
failing): held without blame, retried next run. The recorder's scoring moved into `bot/games/combo-score.mjs` (no
dependencies) so the recorder and the verify job run the same code. Tests: `tests/audit/combo-verify.test.mjs` (10).

**Tests (fix-check 3 round, 118e621):** contract 71 (source unchanged, 92d555d0…); site and audit suite 737 passing
(5 todo, 6 skipped, 0 failing); browser 7; workflow guard 8.

**Tests (with the verify job, fbdd8eb):** contract 71 (source unchanged); site and audit suite 747 passing (5 todo,
6 skipped, 0 failing); browser 7; workflow guard 8.

## Free play (owner, 2026-11-03: D-081, D-082)

Every game has a Free play board. For the Combo Card:
- **Anyone can send a card.** The page no longer refuses guests or unstaked wallets (I-074). The stake only decides the
  board: staked in the Combo Card that week → the Staked board (the Vault file's `rows`), everyone else → the Free play
  board. The page says which, and that the Free play board pays no VHP for now. Picks v1 on mainnet has no cards at all,
  so free cards, like every card, wait for the Picks v2 upgrade (D-060); the contract never checks stakes.
- **The Free play board's top 2** are the Vault file's `first` / `second` (combo-math.js `freeWinners`), always
  computed; the Vault bot holds them back while the owner's free-prize switch for game 8 is off (D-082, PR #65).
  Eligible (Block X's rule, BX-14): never staked in the Combo Card at any point that week (`free`, from the peak
  stake), at least 1 full point, cards on 3 or more days. Ranked as the board; ties share; 2nd only when one wallet
  holds 1st; a place over 10 wallets stays empty.
- **board.json rows** gain `boardPlace` (the place on the player's own board) and `free`.
- **Checks:** every card check (recorder re-check, verify job, publish job) is the same for free and staked cards.
  New: the publish job recomputes `first` / `second` from the published day files and board; the verify job confirms a
  new Vault file only if the published board's stake flags (`staked`, `free`) are the Vault's own, read on both nodes
  (before, those flags were the recorder's word alone), and the publish job publishes no unconfirmed Vault file.
- **Vault registration (owner):** set game 8's free-prize switch OFF first (`npm run prizes -- off 8 --send`, once
  PR #65 is merged), then `game-add 8 "Combo Card" --staked --free --season 1`.
- `main` merged into `combo` (67e1bc2): conflicts only in `workflow-guard.yml` and `package.json` (both sides kept);
  sitemap regenerated.

**Tests (with Free play and the main merge, a2bf8b4):** contract 71 (source unchanged, 92d555d0…); site and audit suite
852 passing (5 todo, 6 skipped, 0 failing); browser 8; workflow guard 8.

## Fix-check 4 (Repo Lens #G-16 at ba2d9b30, 11 Nov 2026: "fix first", 1 High, 1 Medium, 2 Low)

FC3: fixed FC3-1, -2, -4 to -8, -10 to -13; FC3-3 partly (FC4-1); FC3-9 accepted. No regressions found.
- **FC4-1 (High), a forged void past the verify job.** The verify job called `recheck(c, day, true)`, but `recheck`
  took no third argument, so an "unresolved" Block X leg the files show as a hit was never checked on the chain. Fix
  (the reviewer's diff): `recheck(c, day, chain)`; with `chain` the leg is re-scored with both nodes' moved-VHP reads,
  and "unresolved" stands only if that re-score is unresolved too (a read still holding: try again next run). The
  publish job (no chain) still accepts it only because the verify job has confirmed the day. Test: `repolens-fc4-verify`.
- **FC4-2 (Medium), hourly Block X targets.** Since vault week 3 Block X publishes a target every 1,200 blocks (Picks
  game 12), so its files number rounds by 1,200. Combo looked targets up by its own 2,400-block round and found none:
  every Block X leg would end unresolved. Fix: targets are keyed by block height (`blockTargets`, the publish job's
  `BX_TARGETS`), a leg is looked up by `X.target(round)`, and the deadline "past" check compares heights. The leg type
  keeps its 2,400-block round (every 2,400th block is also an hourly target). Test: `repolens-fc4-verify`.
- **FC4-3 (Low), ties.** D-159 / I-103: more than 10 tied for a free-prize place pays exactly 10 (the earlier score
  time, which tied wallets share, then address), never zero. Both `freeWinners` and the publish job's copy. Test:
  `repolens-fc4-ties`; the D-081 site test now expects 10, not an empty place.
- **FC4-4 (Low), a big Free play board.** The verify job gives the day results to its caller (and writes them) before
  any Vault read, reads stakes 8 at a time on both nodes in parallel, stops the Vault reads after an 8-minute budget
  (the file waits for the next run), and alerts while a Vault file is unconfirmed in the last 12 hours of its 3-day
  window. Test: `combo-verify` "FC4-4".
- **Info, handover:** `upgrade-schedule` must refuse while a Picks owner handover is planned or proposed (accepting it
  clears the announcement). Done with the `main` merge, which brings the handover code (#D-12).

## The `main` merges and the VHP ruler (12 Nov 2026; for the delta round after #G-16)
- **Merges.** `main` at `e0d29f5f` (15 conflicts, resolved by #G-16's table), then `99de3402` (no conflicts: the Race
  ruler #264, Vault shadow rows #265). `bot/picks.ts` keeps `main`'s handover, owner check and Bracket game 9 whole, plus
  Combo's upgrade commands; new `handoverBlocksUpgrade`: `upgrade-schedule` refuses while the deployment file has a
  `nextOwner` or the chain a `pending_owner` (#G-16 Info). `combo.yml publish` added to the CI guard's write list
  (`site.ci-deps.test.mjs`, as `golf.yml`). The page on `main`'s tab bar, footer, icons and PostHog counter, and on
  `bawcejawn/KnodeGames` (its data URLs and CSP still named `bawcejawn/Knode`).
- **The ruler (D-new A; the Library 12 Nov: on the ruler from Combo's first week; #G-16 Q6).** One week rule:
  `COMBO_RULER_FROM_WEEK` read with `KRuler.switchFrom` in the recorder and the verify job and with an identical copy of
  `vhp_ruler.py`'s `switch_from` / `ruler_mode` / `switch_change` in the publish job (a test compares them line for line).
  A card whose UTC day is in an ON week has every race leg decided by the Race's ruler card (`race-data` `R<week>.json`,
  recomputed by the Race's own publish job): the field (entry, not void) by fpct, then address; Win = 1st, Show = top 3,
  Top half = top half of the field; a voided producer = a miss (D-164); not on the card = void (RL-16); an empty field =
  void; signed nothing = a miss; no card yet = pending (unresolved at the deadline once race-data is past it). Worths stay
  the handicap card's. Shadow weeks score as off: Combo has no played week before launch, so its shadow evidence is the
  Race's own R files. Day part 0 carries `ruled`, `board.json` `rulerFrom`; the recorder and the publish job refuse a
  switch change that would change a started week; the verify job and the publish job refuse a day whose `ruled` mark
  isn't the switch's. Tests: `tests/audit/combo-ruler.test.mjs` (modes, refused changes, the leg rule, JS = Python on 300
  random cards, the recorder, the verify job and the publish job end to end).

## Finishing the PR (12 Nov 2026, after the delta prompt)
- `main` merged again (`f3151b92`; one conflict, `sitemap.xml`: `main`'s, Combo joins it at launch).
- **#G-16 Info:** `upgrade-clear` needs `--code` on mainnet, like `upgrade-schedule` and `upgrade-upload`; its dry run
  names it. Test: "all three upgrade commands need --code".
- **#G-16 Q1:** the verify job alerts when the published board is over 3 hours old (nothing got through). Alerts now
  fail the verify job in a last step, after its approved list is handed to the publish job (which runs `always()`), so
  an alert sends the failed-run email without holding confirmed files.
- **Game 8 pinned** in `bot/picks.ts` (`COMBO_GAME`, kind 4): list_size 10, max_legs 6, 3 cards a day, 3 changes, 12
  sends a day, and the four leg types the recorder requires (tested equal to `expectedLegTypes()` and `combo-math.js`).
  `cardConfig` applies every `checkCardGame` limit; `pendingProblem` compares leg types field by field before an apply;
  `announce 8` is refused on mainnet until `picks-data/deployment.json` records v2. The Block X game-count test now
  expects 4 games.
- **The capacity standard** (Capacity chat, 12 Nov): every file the recorder writes goes through `put()`, a warning past
  60% of the 2 MB cap and an error past it; the size budget is in `.ai/games/ComboCard.md` (`board.json` is the first
  file to fill: a warning from about 1,900 scoring players a week, the recorder's own stop at 6,000).
- The runbook (`docs/blockx/MAINNET-LAUNCH.md`): step 0 (not during a handover), `--code` on the clear, the game 8
  commands. Overview: `docs/combo/REPO-LENS-COMBO.md`.

## Repo Lens #G-37 (the delta round on `f41f5bec`, 12 Nov 2026): GO with conditions
FC4-1 to FC4-4 and the handover refusal: fixed.
- **G37-1 (Medium, confirmed by a second reviewer).** In a ruled week, a race leg whose ruler card never came was given
  up at the deadline by `raceSourcePast` (the handicap W file keeps publishing), so every card became a write-once
  final void; a late R file then made the re-check call it "forged" and held the week's Vault file. Fix (the reviewer's
  diff): in a ruled week "past" means the Race's ruler has published a card for a later race (`rulerSourcePast`);
  until then the card waits with an error (RL-9). Test `tests/audit/repolens-g37-ruler-outage.test.mjs`, adapted by
  one argument (`raceRulerFrom: 3`) because #G-37's own condition below now refuses Combo on the ruler without the Race.
- **Condition: the switch tied to the Race's.** `rulerPairProblem`: the recorder (throws, nothing read or written), the
  verify job (nothing confirmed, an alert) and the publish job (exit 1) refuse `COMBO_RULER_FROM_WEEK` set while
  `RACE_RULER_FROM_WEEK` is unset or later. All three jobs get `RACE_RULER_FROM_WEEK` from `vars`. Test in
  `combo-ruler.test.mjs`.
- **G37-2 (Low).** `rpcNode`'s fetch now has a 30-second timeout, and the Vault budget cuts off a read already running
  (the reviewer's diff). Test `tests/audit/repolens-g37-vault-hang.test.mjs`.
- **Info, done:** `weeks.js` was loaded twice on the page (now once). The Win leg now follows the Race exactly (D-033):
  the ruler's winner counts without a signed block; 2nd and lower need one (Show, Top half). JS and the publish job's
  Python both changed; the JS = Python test covers it.
- **Info, left:** a false "forged" alert can follow an edge hold and clears on the next run (accepted, as FC2-19).
- **Owner:** set `COMBO_RULER_FROM_WEEK` = 7 by Sun 6 Dec 23:59 UTC, with or before `COMBO_ENABLED`, and keep
  `RACE_RULER_FROM_WEEK` at 7 or lower.

## Last week's board in parts (the capacity standard; owner, 13 Nov: in the Combo PR)
The Capacity chat's sizer (on samples from Combo's own recorder, `claude/combo/samples/`) found `board.json` AMBER at
1,500 daily players and RED at 3,000 (last week held every scoring player, to 6,000).
- **Recorder:** `board.json`'s `lastWeek` keeps the top 100 and `parts`. Every row (everyone with a point, and the top
  2,000) goes in `L<week>.json` (part 0: `v`, `week`, `start`, `final`, `parts`, `rows`) and `L<week>-<k>.json`, at most
  2,000 rows each. FC3-6's 6,000-row cap inside `board.json` is replaced: past 1,000 parts (2,000,000 rows), an error and
  no Vault file. The Vault file is made from every row.
- **Publish job:**
  - Each part's exact shape.
  - Every part the board names must be there and the recorder's cut: every part but the last exactly 2,000 rows; each
    wallet once; places in order.
  - Part 0's week, start, final and count must be the board's, and the board's top 100 must be the parts' first rows.
    Otherwise the board and the parts are held together, with an alert.
  - Parts for any other week are held.
  - Published parts the week no longer has are removed (as day parts, FC3-5).
  - The Vault check reads every row from the published parts.
  - The file filter and the published-file copy admit `L` files.
- **Verify job:** the Vault stake-flag check reads every row from the published parts (`lastRows`); the published-file
  copy admits `L` files.
- **Page:** a connected player outside the top 100 gets their own last-week row from the parts (read one at a time until
  found).
- **Tests:** `tests/audit/combo-lastweek.test.mjs` (the recorder; a hand-made 2,001-row week in two parts published; a
  missing part, a wrong top 100, a short part 0, a wallet twice, a part of another week; a part past the count removed;
  the jobs' file copies). Repo Lens's D-C-1 tests (both copies) and the D-081 verify test now forge the `L` parts with
  the board, commented, so the same checks (FC-6, the stake flags) still catch the forgery.
- **Sizes:** `board.json` at most 5,100 rows, about 0.93 MB at any player count. An `L` part is at most about 0.37 MB
  (183 B a row): 3 parts at 4,500 weekly, 5 at 9,000.

## Repo Lens #G-51 (the #G-37 conditions, at `74d36ed4`, 13 Nov 2026): GO with conditions
Every #G-37 condition is met.
- **G51-1 (Low), fixed** (`bot/games/combo-score.mjs`, Repo Lens's diff as given). In a ruled week, a race leg whose
  race is final in the W file but whose ruler card never comes is now given up ("unresolved", with an alert) at the
  FC2-3 edge, 6 h before the week's Vault window closes, as the Race itself skips such a race. Before this, a ruler feed
  down past the window left the card pending and the week with no Vault file, so fully decided winning cards went
  unpaid. The verify job scores with the same code; the publish job already accepts an unresolved leg after the
  deadline.
- **Tests (Repo Lens's, unchanged, in `tests/audit/`):** `repolens-g51-ruler-outage-window.test.mjs` (fails before the
  fix, passes after) and `repolens-g51-d033-winner.test.mjs` (D-033 the same in JS and Python, every leg type, fields of
  1 to 6).
- **Info, left:** a switch-pair refusal stops every Combo file, including a past week's Vault file (intended and loud;
  only after an illegal change to the Race's switch). The publish job accepts any unresolved race leg after the
  deadline; only the verify job checks that the source published past it. A Python copy of that rule is worth adding
  later.

