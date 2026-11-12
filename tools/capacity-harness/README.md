# Capacity harness (fake players only)

Measures how many players each part of Knode Games can hold, using **fake players on your own computer**. It runs the
real Daily Questions recorder code against a fake chain node, fills real Race and Block X week files with fake picks,
and works out sponsor Mana from the measured per-action costs.

**It never touches:** the live chain, testnet, the sponsor, the vault, any wallet or key, or GitHub. Every network call
inside it is blocked, it refuses to run if `CONFIRM_MAINNET` is set, and it writes only to a temporary folder outside the
repository.

## Run it (PowerShell)

```powershell
cd C:\kprediction
git branch --show-current
git fetch origin race-data:refs/remotes/origin/race-data games-data:refs/remotes/origin/games-data
npx tsx tools/capacity-harness/harness.ts --dry
npx tsx tools/capacity-harness/harness.ts
```

- `git fetch …` only downloads the published week files it uses as templates (read-only, once).
- `--dry` is the harness's own dry run: 50 players, about 5 seconds. It must end with `Done. Report: …`.
- The full run (50, 1,000, 10,000, 100,000 players) takes about 2 minutes. Files far over the cap (over ~32 MB) are worked out from a straight-line fit instead of built, so the run never runs out of memory. Other sizes: `--sizes 50,500,5000`.
- The report is saved in a temporary folder (the last line shows where). Delete that folder whenever you like.

## Results on `main` @ 3d28446 (12 Nov 2026)

| Part | Largest that fits | What happens past it |
|---|---|---|
| Questions week file (60 answers) | ~3,200 players (585 bytes each) | No file, the week waits; picks safe on chain |
| Questions, any count over 20,000 | stops on purpose (`MAX_PLAYERS`) | Same, safe stop |
| Race week, every race | ~695 players | Publish refused, board freezes, payout waits |
| Race week, 10 races a week | ~1,950 players | Same |
| Block X week (hourly), every target | ~150 players | Same |
| Block X week, 20 picks a week | ~1,100 players | Same |
| Sponsor, typical player (12 Mana counted) | ~166 guests / ~416 players a day | Free plays stop until 00:00 UTC |
