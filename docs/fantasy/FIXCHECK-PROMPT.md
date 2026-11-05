# Repo Lens: Fantasy Producers fix-check (games 4 and 5, branch fantasy)

Paste everything below the line.

---

Please review **the draft PR from `fantasy` into `main`** in `bawcejawn/KnodeGames`. Report only: don't push, merge, deploy or send anything, and send no transaction to any chain.
- **Branch:** `fantasy` at the head of the draft PR (current with `main` @ `0fcb768`).
- **Diff:** `git diff origin/main...origin/fantasy`. It touches:
  - code: `bot/games/fantasy.ts`, `fantasy-math.js`, `fantasy.html`, `fantasy.js`, `fantasy.css`, `.github/workflows/games.yml` (Fantasy's record step and publish check, added next to Block X's), `games.json` (Fantasy stays `"soon"`), `package.json` (scripts), `terms.html`, `bot/race.ts` (three read helpers exported, no behaviour change);
  - practice kit: `bot/fantasy-test.ts`, `tools/fantasy-testnet/*`; simulation: `tools/fantasy-sim/price-sim.mjs` (offline, read-only);
  - tests: `tests/audit/fantasy-math.test.mjs`, `fantasy-recorder.test.mjs`, `fantasy-publish.test.mjs` (new), `fantasy-testnet.test.mjs`, `site.fantasy.test.mjs`, `names.test.mjs` (page list), `blockx-recorder.test.mjs` (one assertion: the alert job's trigger also covers a failed Fantasy step);
  - docs: `docs/fantasy/README.md` (the rules), `docs/fantasy/TESTNET.md`, `.ai/standards/WEEK_CYCLE.md` (Fantasy's row).

**The game.** A player drafts five Koinos block producers from a weekly price list (budget 100); the first is the captain (×2). The week plays Monday to Saturday (UTC). Each play day a producer scores `100 × blocks signed ÷ blocks expected`, at most 130; expected comes from the Producer Race's hourly VHP cards. One change a day. Picks go to the audited Picks contract (game 4 = team, game 5 = Weekly Rival, records only). A read-only recorder publishes results to `games-data/fantasy/`, including one vault file per final week. Staked players (in game 4) rank on a Staked board and share Fantasy's vault bucket (top 30%); everyone else on a Free play board (no VHP prize for now; the vault file still lists `first` / `second`, D-082). Rules: `docs/fantasy/README.md`.

**History.** The first audit (28 Oct, FX-1 to FX-10) found no Critical and no direct way to cheat; fixes were committed, **never independently checked**, and much changed after. Please confirm FX-1 to FX-10 and review everything below as new.

**Top rule:** fail closed. Fantasy must never publish a final week, or a vault file, that a later correct run would read differently, and a Fantasy problem must never stop Block X publishing.

## 1. Race card quality gate (R-FA-3)
`F.usableCard`: a card counts only with `samples ≥ 12`, a non-empty field, no `flagged` producer and no `topInDoubt` (Block X's BX-38 / BX-55 / BX-73 rule). `F.cardAt` treats an unusable card as missing (leg positions kept): the latest earlier good card within 24 h is used; none → the hour is uncovered and the day can't go final.
**Please check:** can anyone make a card unusable on purpose to fall back to an older card that suits their team? Does a run of bad cards stall days fairly, and does the 3-day vault deadline still hold?

## 2. The weekly cycle (`WEEK_CYCLE.md`, D-125, D-135) — replaces the Monday 12:00 final
- A week can settle only from Monday 00:00 UTC. The first run that can settle it writes `pending = { hash, at }` (sha256 of the players' rows and rival matches); it goes final only when a run at least an hour later (`AGREE_GAP`) computes the same hash **and** the week re-checks from the chain (§3). A changed result restarts the wait.
- **Sunday fun round (D-150):** each player's Saturday team plays Sunday; it scores on the Today board and is added to All time once (`alltime.json` → `sundays`), never to the week's points, board, medals or vault file. No Sunday picks exist.
**Please check:** can a week go final on one run (first run after a gap, a planted or stale `pending` in the previous files, a missing `prev`)? Is the hash stable between identical runs? Can a Sunday fun score ever reach the week, the boards' weekly views or the vault file, or be added twice?

## 3. Re-check from the chain before final (RECORDER_STANDARD §4.2)
`verifyWeek` in `bot/games/fantasy.ts`: in the run that makes a week final, every play day's heights are re-found from its times, its blocks re-read on **both** nodes at those heights, and its day index recomputed from the same cards; each must equal the stored day. Every play day's team picks and the rival challenges are re-read on both Picks nodes and must equal the week's. A mismatch holds the week with an `ALERT`; a read failure or the 10-minute budget means "wait" (as the Race's `verifyWeek`).
**Please check:** anything the vault file depends on that isn't re-checked (cards come from the published race-data branch: is relying on the Race's own checks acceptable?); can the budget path be abused to never finalize; is blocks-irreversible-on-both-nodes (the lower lib) used everywhere?

## 4. The publish job re-scores everything itself (§4.1, §3.3)
The inline Python in `games.yml` (runs no repository code) has a port of the scorer between `# ── Fantasy scorer` and `# ── end of the Fantasy scorer ──`: day score (130 cap, captain ×2, JavaScript rounding), team rules (5 different, on the list, within budget, one change a day, no team vanishing), places, vault points, free winners. Every new or changed week file is re-scored from `days.json` alone; a new vault file must equal its re-scored week's stakers and free winners; `board.json` week / lastWeek must match the week files; a published final day can't change; the publish clock refuses a final week or vault file before the week's end and week files more than 8 days ahead.
**Please check:** a file this check accepts that the honest recorder would not write (or the reverse, which would block honest runs); differences between the port and `fantasy-math.js` the differential test (3,000 random weeks) could miss; whether teams should also be re-derived from the picks (today the check proves each stored team is legal and scores correctly, not that it is the player's pick; the recorder's §3 re-check covers the picks).

## 5. Vault points and the paid set (§4.3)
`F.vaultPoints` works out the vault's paid set first (top `ceil(30%)` of staked rows with points, tied groups whole) and, past 255 distinct scores, gives every unpaid score 1 and paid scores never below 2. A test replays the contract's own cutoff walk (`finalizeGameStep`) on 7 to 1,000 rows.
**Please check** against `game/assembly/Kpred.ts`: is `eligible_players` the same count the file's rows give? Do the board's medals (`stakedEarners`) always equal what the vault pays?

## 6. Earlier work never reviewed
- Free play board and `first` / `second` (D-081, D-082); the stakes read on both nodes with Block X's vault reader.
- Monday-to-Saturday weeks; the page and practice kit never offer Sunday picks.
- Career profile stats in `alltime.json` (`bestPlace`, `medals`) that can't go backwards (D-137).
- The page: KnodeGames data URLs and CSP, the second node `api.koinosblocks.com`, nicknames (`names.js`), the stake badge and panel for game 4, the shared nav, analytics.

## 7. Questions we'd like your view on
1. **Small producers and prices:** 3 blocks when due 2 is 150 (capped 130). A first look with real data (`node tools/fantasy-sim/price-sim.mjs <race-data> --form 4`, only 8 full days exist yet) shows price ~ next score ρ ≈ 0.5 and cheap-swingy teams *below* random teams. Any edge we're missing?
2. **Throwaway wallets on Free play:** no prize is paid there for now; anything that would bite when the switch turns on?
3. **Out of scope (coming next, separately):** moving Fantasy's shares to the shared VHP ruler (`VHP_RULER.md` §6: `own` shares, credited blocks, normalised `k`) waits for ruler v2.1. Please say only if anything in this PR would make that move unsafe.

**Out of scope:** the Vault contract, the Picks contract's code, the Mana sponsor, Block X and the Race themselves, `stake-panel.js` (audited with the site). Only how Fantasy uses them is in scope.

## Our tests
- `npm ci --ignore-scripts && npm run test:audit` (Linux): 1,087 pass, 0 fail (5 skipped, 5 existing TODOs); Fantasy 58/58; the Picks contract's own tests pass.
- `node --import tsx tools/fantasy-testnet/rehearse.mjs` (about 5 minutes, offline, fake chains).

**Format:** the verdict first (**GO** or **fix first**). Then any findings, each with: an ID (FC-1, FC-2, …), severity, file and line, a concrete scenario, a fix (a failing `node:test` where you can). Then FX-1 to FX-10, one line each (fixed / not fixed / partly). Then what you couldn't check. We fix every finding in one pass, with a test each (D-140).
