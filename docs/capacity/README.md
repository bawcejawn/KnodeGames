# Capacity: how Knode Games scales (and what to read first)

Owner's goal: six-digit daily visitors, free for players, nothing breaking without weeks of warning, funds always
safe. This folder is the source of truth for the capacity work. Plan and numbers: `claude/capacity/` in the KnodeGames
project; steps for the owner: [OWNER-STEPS.md](OWNER-STEPS.md); the proposed standard for every game:
[STANDARD-PROPOSAL.md](STANDARD-PROPOSAL.md); the shared file format: [PARTS-SPEC.md](PARTS-SPEC.md); the review pack: [REPOLENS.md](REPOLENS.md).

## Three kinds of "users" and where each one lands
| Kind | What it costs today | Where it goes after Phase A |
|---|---|---|
| (a) **Browsing** (page views) | GitHub Pages; GitHub raw for game files; public node Armana for live data | Cloudflare's cache (pages); the data mirror `data.knodegames.com` (game files); the live file `live.knodegames.com/live.json` (block strip) |
| (b) **Picks and answers** | One sponsored transaction each (~0.8-0.9 Mana burned, 1.2-1.3 counted against the caps) | Same; the limit is the sponsor's daily Mana (Stage 1: sponsor v4 + more KOIN; Stage 2: batched picks) |
| (c) **Claims, stakes, withdrawals** | Sponsored transactions (claim 2.0, stake 2.4, withdraw 1.55 counted) | Same; sponsor v4 adds withdraw and claim reserves |

## The pieces in this repository
| Piece | File | What it does | Switch |
|---|---|---|---|
| Polling diet | `app.js` | Hidden tabs ask nothing; one shared head read (3 s); block strip every 12 s; questions re-read every minute only while waiting for a result, otherwise every 10 minutes | always on |
| Page data switch | `data-source.js` (first script on every page) | Mirror: GitHub raw game files -> `data.knodegames.com`, falling back to GitHub. Live: `KGData.live()` gives the live file when fresh (< 20 s), else null | `ON = { mirror, live }`, both `false` until the owner's checks |
| Data mirror | `tools/cloudflare/kg-data-worker.js` (Cloudflare Worker `kg-data`) | Same bytes as GitHub raw, kept 5 minutes; refuses anything that isn't a published `.json` on an allowed branch; stores the live file on an authorized PUT | Cloudflare custom domain |
| Live-file uploader | `tools/capacity-live/uploader.mjs`, `node/install-live-uploader.ps1` | On the owner's PC: reads the owner's own node every 5 s, sends the live file when there is a new block | Windows task "Knode live uploader" |
| Tests on fake data | `tools/capacity-harness/` | T0-T2 file sizes and sponsor Mana, T3 page calls, T4 recorder run time, T5 mirror under load | run by hand |
| Audit tests | `tests/audit/capacity-*.test.mjs` | Polling, data source, Worker, uploader end to end | CI |

Rules that hold everywhere: scores, cards and voids come only from the published game files, never from the live file
(Ruler chat); recorders keep two independent nodes; nothing here holds or moves tokens; the only secret is the live
file's upload token (Worker secret + the owner's `.env`).

## Measured on 12 Nov 2026 (fake players, real code and formats)
| Limit | Where it breaks | Fix and owner |
|---|---|---|
| Block X weekly file (hourly targets) | ~150 weekly players if all pick every target; ~1,100 at 20 picks a week | Compact/split files + loud `readPicks`, before Mon 23 Nov (Block X chat) |
| Race weekly file | ~695 to ~1,950 | Same, before Mon 7 Dec (Race chat) |
| Questions weekly file | ~3,200 (stops on purpose above 20,000) | Compact format before ~2,000 weekly (Questions chat) |
| Last Node day file | ~5,900 players in one event | 60% warning + loud `readPicks` in its launch PR |
| Sponsor daily Mana | ~166 guests / ~416 players a day (typical 12 Mana counted) | Sponsor v4 + KOIN (Stage 1 proposal, Mon 23 Nov) |
| Node calls per open Questions tab | 54.5 a minute visible and hidden (before 11 Nov) -> 14.8 visible, 0 hidden; 6.5 with the live file | done; live file after A4b |
| GitHub reads for game files | one per player page load -> one per file per 5 minutes per Cloudflare location (278x less at 100,000 page loads an hour) | after A3 + switch |
| Recorder run time | ~2.4 min at 20,000 players, ~10 min at 100,000 (30-minute limit) | not a near-term limit |
| Cloudflare free Worker requests | 100,000 a day (~2,500-3,000 daily visitors) | $5 Workers plan before then (cost proposal) |
