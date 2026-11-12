# Capacity harness (fake players, fake chain, fake GitHub only)

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

## The other tests (same safety rules: nothing leaves this computer)

```powershell
cd C:\kprediction
git branch --show-current
npx tsx tools/capacity-harness/harness.ts --sizes 1000,10000,20000 --latency 20
node tools/capacity-harness/pages.mjs
node tools/capacity-harness/pages.mjs --ref 3d28446
node tools/capacity-harness/pages.mjs --live
node tools/capacity-harness/mirror-load.mjs
```

| Test | What it measures | Runtime |
|---|---|---|
| T4 `harness.ts --latency 20` (section 4) | The real Questions recorder against a slow fake node: minutes per run, scaled to 300 ms a read, vs the 30-minute job limit | ~20 s |
| T3 `pages.mjs` | The real Questions page in a simulated browser with a counting fake node: node calls a minute, visible and hidden tab. `--ref <commit>` loads an older `app.js`; `--live` switches the live file on | ~2.5 min each |
| T5 `mirror-load.mjs` | The real Cloudflare Worker against a simulated crowd: how many requests reach GitHub | ~20 s |

### Results on 12 Nov 2026
- **T3 (node calls a minute per open Questions tab):** before 11 Nov (`3d28446`): 54.5 visible, 54.5 hidden. Now: 14.8 visible, 0 hidden. With the live file on: 6.5 visible, 0 hidden.
- **T4:** 10,000 players ~1.4 min, 20,000 ~2.4 min, 100,000 ~10 min (worked out) at 300 ms a read: well inside the 30-minute limit. File size, not run time, is the limit.
- **T5:** 100,000 page loads in an hour across 30 locations, 6 files each: 600,000 served, 2,160 reached GitHub (278x less). Worker requests count toward Cloudflare's free 100,000 a day (about 3,000 daily visitors); past that the pages fall back to GitHub until the $5 Workers plan is on.
