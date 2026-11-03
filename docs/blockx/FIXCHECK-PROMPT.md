# Fix-check prompt, round 12 (very short): the v6-day Race stake change

Copy everything below the line into Repo Lens. Give it the package `knode-fixcheck-13.zip` (the repository
`bawcejawn/KnodeGames` at the commit in `00-COMMIT.txt`, branch `picks`, with this prompt as `00-FIXCHECK-PROMPT.md`).

---

You are an independent security auditor. Your report "Block X Prize-Free: Round-11 Go/No-Go (Knode picks @ 3472d8c)"
said GO and left three items for the day Vault v6 went live: B1-1 (race.ts read stakes with the v5 ABI), V4 (a chain
that isn't v6 read as "not staked" without an error) and B1-5 (per-wallet retries could push the hourly run past its
time limit and lose that hour's race cards).

**Vault v6 is now live on mainnet** (2026-11-02). `picks` merged the vault branch (e7887b6); `game/abi/kpred.koilib.json`
is now the v6 ABI, byte-identical to `kpred-v6.koilib.json` (which Block X reads).

**The change (d7fad7c, `bot/race.ts` and one test):**
- B1-1: stakes are read with the deployed ABI (`kpred.koilib.json`); a test checks it equals `kpred-v6.koilib.json`.
- V4: the early `return { staked: false }` when `v6_rule_week_plus_one` is 0 is gone. Right after the upload that field
  stays 0 until v6's first transaction, but `get_game_player` already answers then (no stake, which is true).
  `stakedFrom` / `earningFrom` keep their own guard.
- B1-5: `get_state` and `get_game_player` take 2 tries (about 2 s), not 6. The first failure on a node marks it down
  for the rest of the run: every other stake read on it fails at once with one warning. A failed read counts as not
  staked on the boards and keeps the vault file from being final; the race files are still written and published.
- Test: a v5-like chain (every contract read fails) with players. The run finishes fast, makes at most 4 reads, gives
  one warning, writes the race files (they pass the publish check) and leaves the vault file not final. It fails on
  e7887b6.

**Context, not a question:** before this change, `main` already had the v6 ABI but not V4. Its recorder published
`race-data/vault/W1.json` as final at 2026-11-02 23:17 UTC: `rows: []` plus free-play first and second. Nobody could
stake that week. Whether week 1 is paid is the Vault's `PRIZES_FROM_WEEK` decision.

**Scope: `git diff e7887b6 HEAD -- bot/race.ts tests/audit`.** Send no transaction to any chain.

```
npm ci --ignore-scripts
npm run test:audit:serial
```

## The one question

**Can this change stop or delay the race cards Block X scores with, or make a vault file final when it shouldn't be?**
Go / no-go for merging it to `main`. If no-go, name only what must be fixed. Put everything else in one Low/Info table.
