# Fix-check prompt, round 13 (very short): RV-1 and the commits after the round-12 package

Copy everything below the line into Repo Lens. Give it the package `knode-fixcheck-14.zip` (the repository
`bawcejawn/KnodeGames` at the commit in `00-COMMIT.txt`, branch `picks`, with this prompt as `00-FIXCHECK-PROMPT.md`).

---

You are an independent security auditor. Your report "Race Stakes on v6: Round-12 Go/No-Go (Knode picks @ 4a6e872)"
said GO for d7fad7c and asked for two things: fix RV-1 soon, and review the five later commits (RV-5).

**RV-1, fixed:** `bot/race.ts` (run and `--sample`) and `bot/games/blockx.ts` now end their entry with
`.then(() => process.exit(process.exitCode ?? 0), (e) => { …; process.exit(1); })`, so a node that never answers can't
keep the process alive after the work is done. Test `tests/audit/repolens-r12-process-exit.test.mjs`: both entries,
and the mechanism with the repository's own `withRetry` against a hung TCP node in a separate process (alive without
the exit, ends with it).

**The commits after 4a6e872 (RV-5):**
- `games.yml` passes the repository variable `PRIZES_FROM_WEEK` to the Block X recorder. `prizesFromEnv` accepts only
  a plain week number 0–9999; unset or anything else means no prizes. Test: the last test in `blockx-recorder.test.mjs`.
- `bot/sponsor.ts` `mana-report` (read-only, sends nothing): `readBlocks` splits a 100-block range a node won't answer
  (it returned an HTML error page on mainnet, on both nodes) in halves down to single blocks, retries a single block 3
  times, and never skips a block (one that still fails stops the report). The second-node check uses it too. Test in
  `sponsor.tool.test.ts`.
- `wallet.js`: `PINNED_PICKS` = the mainnet Picks contract `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` (runbook step 9;
  guests may make KnodeGames picks only there). Test in `site.guest.test.mjs` pins it to `picks-data/deployment.json`.
- Docs: the round-11 and round-12 records, and the round-12 prompt.

**Context:** game 2 is applied on mainnet (1 change per pick). The Race chat is merging `picks` into `main` for the
Block X launch; the owner merges only after this round says GO.

**Scope: `git diff 4a6e872 HEAD -- bot wallet.js .github/workflows tests/audit`.** Send no transaction to any chain.

```
npm ci --ignore-scripts
npm run test:audit:serial
```

## The one question

**Block X launch from this commit (merge `picks` into `main`): go / no-go.** If no-go, name only what must be fixed.
Put everything else in one Low/Info table.
