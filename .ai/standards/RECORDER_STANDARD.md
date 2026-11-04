# Knode Games — Recorder Standard

> **Purpose:** the rules every game's recorder (the keyless bot that turns chain blocks and picks into results) and its publish job (the step that checks files and pushes them to a data branch) must follow. These are lessons already paid for in audits. Writing them once stops each new game from re-learning them.
> **Applies to:** every game that publishes results: Race, Block X, Survivor, Bracket, Last Node, Fantasy, Combo, Golf, and any future game.
> **Last updated:** 2026-11-03 (first version)
> **Built from:** Block X and Race audits (BX-*, B1-*), Repo Lens #E-3 (Bracket), #D-3 (vault bot checks, PR #74), `VAULT_STANDARD.md` §6, `LEADERBOARD_STANDARD.md`. Each rule names the finding that taught it.
> **Words:** **must** = required before launch · **should** = expected · the audit id in brackets is the example to read.

## 1. Trust model (why these rules exist)
- The recorder **holds no keys**. Its output decides who gets paid, so a bad or tampered run must not be able to change a payout.
- Two layers check it: the **publish job** (runs no repo code; compares new files with what is already published) and the **vault bot** (re-checks stakes and winners on chain, cross-checks the board, holds on doubt).
- **The vault bot can't recompute points yet** (I-080). Until it can, **the publish job is the real guard on the points**.

## 2. Reading the chain
1. **Two nodes must agree** on everything that decides a result: blocks, picks, VHP and stakes. A disagreement means no final file (V4).
2. **Count irreversible blocks only.** Use the *lower* of the two nodes' last irreversible block (lib), not one node's (#E-3 M-8).
3. **A failed read is never "zero" or "not staked."** It stops the step; nothing is recorded from it (V4).
4. **Stakes come from the vault's own rule:** staked = `week_stake ≥` the week's minimum and not voided, read with the `v6_rule_week_plus_one` gate. Reuse Block X's vault reader; don't write a new one (#E-3 M-1, L-11).
5. **Read stakes only after the week has ended**, and write the vault file only then (#E-3 M-1b, L-8).
6. **Bounded work per run:** at most 6 hours of chain per run, limited parallel reads, a hard stop on runaway paging (#E-3 L-11). Exit when done (Repo Lens RV-1).
7. **VHP** follows the VHP standard (D-058, `docs/VHP-STANDARD.md`). Check events come from the VHP contract only; a decoder miss must be caught by end-to-end checks between balance reads, not just near them (#E-3 M-7).

## 3. Time and history
1. **Every new file is checked against the clock**, in the recorder and again in the publish job (BX-96, BX-97, BX-98; #E-3 H-3):
   - new week files and index weeks only for the current week ± 1, and an index week only together with its file;
   - a seeding or card only after its time;
   - picks only after their lock;
   - an hour only after it ends;
   - "final" only after the game's settle time (e.g. 12 h after the last round).
2. **Use the publish job's own clock**, not the recorder's (a recorder run can be wrong or forged).
3. **No going backwards:** locked → void, staked list → null, final → not final are refused (#E-3 H-3).
4. **Missing last-run files stop the run** ("refusing to write: it would wipe that week"). But one planted index entry must not stall the recorder forever: reject unknown index weeks at publish (#E-3 H-3).
5. **Device clocks are never trusted on pages:** lock guards use chain time and are re-checked at send (#E-3 L-2).

## 4. Points, ranks and the vault file
1. **The publish job recomputes points** from published inputs (seeding, hours, checked picks), with a ported scorer that is differential-tested against the game's math file over thousands of random weeks. Any mismatch holds that game (BX-79, BX-88; #E-3 H-2).
2. **Re-read the week's end on both nodes** before finalizing (BX-97 / BX-88).
3. **Vault values follow the vault's payout rule.** Work out the paid set first (top `ceil(30%)` of rows, tied groups whole), then map to 255 … 1 so unpaid rows can't share a paid value (#E-3 C-1). Test with the vault's cutoff, not just "values in 1–255".
4. **`first` / `second` always filled** with free winners, never a staked or held wallet (D-082, `VAULT_STANDARD.md` §6). Ties share; at most 10 a place.
5. **One file version**, shared between recorder, publish job and page. A page test loads a real recorder-shaped file (#E-3 H-1).
6. **Medals and prize marks come from the same rows the vault pays**: none for a missed week or held players (#E-3 M-2; BX-14).
7. **Final files are write-once.** Later runs copy them forward unchanged; a changed final file refuses the run (`VAULT_STANDARD.md` §6), and the vault bot holds it for good (#D-3).

## 5. The leaderboard (`board.json`)
1. Published next to the game's vault folder, in the shape the vault check reads (`LEADERBOARD_STANDARD.md` §1, I-079): `lastWeek` = the vault week; rows with wallet, `points`, place; Staked and Free.
2. **Same staking rule and floor as the vault file.** If the file has a points floor (Combo: 100 hundredths), declare it (`vaultGames.<id>.minPts`) (#D-3 VB-5).
3. **Keep every row with at least 1 point in `lastWeek`**, or the vault check can't find file rows past the board's cap (#D-3 VB-6).
4. A game with no board must say so (`vaultGames.<id>.board: "none"`) rather than publish nothing (#D-3 VB-4).
5. **HOLD and RELEASE:** a game that can hold a week publishes `HOLD-W<n>.json` (reason in a field named `reason`), and on release publishes `RELEASE-W<n>.json`. The publish job only adds files, so a HOLD is never lifted by deleting it (#D-3 VB-1).

## 6. The publish job
1. **Runs no repository code** (no checkout, npm or tsx next to the write token); its checks are inline in the workflow.
2. **Compares with the published branch** it fetched itself; tells "branch absent" apart from "fetch failed" (#E-3 L-7).
3. **Strict shape checks:** right version, types, number spelling, no duplicate keys, sizes ≤ 2 MB, names and folders allow-listed. It must apply the recorder's own load rules, so a file the recorder would reject never gets published (#E-3 M-9).
4. **One bad file holds only its own game,** never the whole job or another game (per-file try/except, per-game size and name checks) (#E-3 M-3).
5. **Recorder steps are independent** (`continue-on-error` on each), and a final step fails the run *after* publishing if any recorder failed, so the owner gets an email (#E-3 M-4).
6. **Single push, no force**; one concurrency group per data branch.
7. **Size caps on the recorder side** so a large field never pushes a file past 2 MB (#E-3 M-3).

## 7. Pages that read recorder files
1. Data is text only (`textContent`), never HTML; strict CSP; links built from fixed prefixes.
2. **What the page shows is what it signs:** freeze `{number, account, week}` at review; refuse the send if any changed; build every pop-up from the signed value; make the page behind the pop-up inert (#E-3 C-2).
3. Contract ids are pinned to the mainnet deployment, not taken from a data file (#E-3 L-13).
4. Behaviour tests (a fake wallet, real-shaped files), not only regex checks (#E-3 L-14).

## 8. Checklist for a recorder review
- [ ] §2 two nodes, min lib, read-failure ≠ zero, vault stake rule, reads after week end
- [ ] §3 clock checks in recorder **and** publish job; no backwards changes; planted index can't stall
- [ ] §4 points recomputed at publish (differential-tested); vault values follow the paid set; `first`/`second` filled; one file version
- [ ] §5 `board.json` shape, floor declared, rows kept, HOLD/RELEASE
- [ ] §6 no repo code; per-file holds; independent steps with a final failing step; size caps
- [ ] §7 page shows what it signs; pinned ids; behaviour tests

**Later (architecture, R-ARCH-1):** a shared "game kit" library that implements §2–§6 once, so each game only writes its own scoring.
