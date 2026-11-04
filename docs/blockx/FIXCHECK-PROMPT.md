# Fix-check prompt, round 14: Block X before its first paid week (I-042) and the sampler

Copy everything below the line into Repo Lens. Give it the package `knode-fixcheck-15.zip` (the repository
`bawcejawn/KnodeGames` at the commit in `00-COMMIT.txt`, branch `blockx-before-prizes`, with this prompt as
`00-FIXCHECK-PROMPT.md`).

---

You are an independent security auditor. Block X (game 2, "Who Signs Block X") is live prize-free. It starts paying
from vault week 3 (Mon 9 – Mon 16 Nov 2026, D-077). A week's prize list (`P<week>.json`) and its vault results file
(`vault/W<week>.json`) are written once, 12 hours after the week ends, and the vault pays from that file. Your round-13
report "Block X Launch: Round-13 Go/No-Go (Knode picks @ 61daab0)" said GO for prize-free. This round is the "before
prizes" list.

**The changes (`git diff e505d5f HEAD`):**
1. **Week-end re-read** (`bot/games/blockx.ts`, `reverify`; BX-88, BX-97, BX-98, G-K-1). Before a final week's prize list
   is frozen, every target of the week is read again and compared whole:
   - each round is its target block and irreversible;
   - a recorded target's signer and the times of block X and its lock block, on both nodes;
   - its picks (player, producer, time) and each player's Staked flag, on both nodes;
   - for a scored target: the same lock card and first card after X, and every pick's points recomputed.

   Any difference holds the week: no prize list, no vault file, an alert, and a retry next run. Void rows are checked
   only for their round, height and zero points.
   Not re-scanned: the VHP moved into a signer (BX-53). It was read on both nodes when recorded, and the points are
   recomputed with the recorded amount (the stored signer VHP less the lock card's own).
2. **Non-standard-transfer voids listed** (BX-72): when a week becomes final, each target voided for a non-standard VHP
   transfer gets a warning line for the owner's 24-hour correction window.
3. **No race card from the future** (`.github/workflows/race.yml` publish; BX-118): a card's `at` must be at most 60 s
   after the check's clock.
4. **RV-2** (`bot/race.ts`): a stake read the node answers with an error stops every stake read of the run, with its
   own warning. The Vault chat confirms `get_game_player` never reverts for a valid address, so such an error means a
   wrong contract, interface file or arguments. Only an unreachable node (`isTransportError`) is skipped on its own.
5. **The sampler** (`.github/workflows/race-samples.yml`, record job only; I-059). GitHub runs its `*/5` schedule about
   hourly, and a race card needs `MIN_SAMPLES = 12` in its 6 hours, or Block X never scores with it (on 3 Nov all 24
   Block X targets were void; cards had 4 to 9 samples). Each run now:
   - takes up to 12 samples, at least 4 minutes apart, for at most 48 minutes;
   - skips a failed sample and keeps the rest;
   - publishes them together.

   The 4-minute gap keeps 8 hours within `SAMPLE_MAX` (120), however often GitHub starts it. The publish job is unchanged.
6. **Not changed, by design (BX-105):** `board.json`'s last week isn't frozen separately. Once a week's prize list is
   published, no new round of that week is accepted and published targets never change, so the recomputed board can't
   change. The vault bot holds a week whose board and file disagree.

**Tests:**
- `tests/audit/blockx-recorder.test.mjs` (the last five tests: an honest week passes; six kinds of tampering are held;
  G-K-1; one node reading differently at the week's end; BX-72);
- `race-recorder.test.mjs` (BX-118, RV-2);
- `race-samples-batch.test.mjs` (runs the workflow's own step script);
- the round-7 test now runs with a clock after its own week-3 cards.

Disabling the re-read makes three of the new tests fail.

**Scope:** `git diff e505d5f HEAD -- bot .github/workflows tests/audit`. Send no transaction to any chain.

```
npm ci --ignore-scripts
npm run test:audit:serial
```

## The questions

1. **Can anything in week 3 still pay the wrong wallet or the wrong amount?** Look first at a target that could slip
   past the re-read, a re-read that could hold an honest week for good (so nothing is paid), and the vault file being
   written without the re-read.
2. **Can the sampler change stop the samples, or let a sample set make a card Block X scores wrongly?**

Go / no-go for merging before Mon 9 Nov 00:00 UTC. If no-go, name only what must be fixed. Put everything else in one
Low/Info table, marked with what to check in the 24-hour correction window where it belongs.
