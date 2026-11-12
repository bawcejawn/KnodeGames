# Repo Lens pack: Capacity (Knode Games scale-up, Phase A + tests)

Owner: Capacity chat. Written Thu 12 Nov 2026. Scope: everything the Capacity chat built or changed. One page for a
reviewer, a new chat or the owner: what exists, how it fits, what is left, and what to check.

## 1. Goal and the three kinds of users
Reach six-digit daily visitors, free for players, with every limit warning weeks ahead and failing safely (no lost funds,
no lost picks, no wrong payout). "Users" are measured separately: (a) browsing, (b) picks and answers (sponsored
writes), (c) claims, stakes and withdrawals (sponsored transactions). Plan, model and ranked list: project docs
`claude/capacity/CAPACITY-MODEL-2026-11-11.md`, `BOTTLENECKS-2026-11-12.md`, `TEST-PLAN-2026-11-12.md`.

## 2. What was built
| # | Change | Files | Live effect | Where |
|---|---|---|---|---|
| 1 | Polling diet: shared head read (3 s), 12 s strip, hidden tabs ask nothing | `app.js`, `tests/audit/capacity-polling.test.mjs` | live since PR #271 (12 Nov) | merged |
| 2 | Fake-player harness: file sizes, sponsor Mana (T0-T2) | `tools/capacity-harness/harness.ts`, `README.md` | tool only | merged (#271) |
| 3 | Harness: big sizes worked out, not built (no out-of-memory); T4 recorder run time (`--latency`) | `harness.ts` | tool only | this PR |
| 4 | Questions re-read: every minute only while a question waits for its result, else every 10 minutes | `app.js` (`checkFiles`), CAP-6 | on merge | this PR |
| 5 | Page data switch: mirror + live file, both **off** | `data-source.js`, 22 pages (`<script>` first + `connect-src`), `capacity-data-source.test.mjs` | none until switched on | this PR |
| 6 | Live strip from the live file (falls back to the node) | `app.js` `ticker`, `blockx.js` `readHead` | none until switched on | this PR |
| 7 | Cloudflare Worker `kg-data`: data mirror + authorized live-file PUT | `tools/cloudflare/kg-data-worker.js`, `capacity-worker.test.mjs` | none until the owner deploys it (A3) | this PR |
| 8 | Live-file uploader + Windows task installer | `tools/capacity-live/uploader.mjs`, `node/install-live-uploader.ps1`, `capacity-live-uploader.test.mjs`, `.gitignore` | none until A4 | this PR |
| 9 | T3 page call counter, T5 mirror under load | `tools/capacity-harness/pages.mjs`, `mirror-load.mjs` | tools only | this PR |
| 10 | Docs: overview, owner steps, standard proposal, this pack | `docs/capacity/*` | none | this PR |
| 11 | Cloudflare in front of the site (A2) + cache rule (A2b) | Cloudflare dashboard (owner) | live since 12 Nov | done |

## 3. Architecture after Phase A
```
Player's browser
  pages, scripts, images ──> Cloudflare (cache, 10 min, from GitHub's own max-age) ──> GitHub Pages (main)
  game files (boards, weeks) ──> data-source.js ──> data.knodegames.com (Worker kg-data, 5 min copy) ──> GitHub raw
                                         └─ on any mirror failure: GitHub raw directly, as before (10 min)
  live block strip ──> data-source.js ──> live.knodegames.com/live.json (R2 bucket kg-live, 4 s cache)
                                         └─ older than 20 s or unreadable: the public node, as before (1 min)
  picks, answers, claims, stakes ──> wallet ──> public node ──> chain (unchanged; the sponsor pays, caps apply)
Owner's PC: own node ──(local)──> uploader (every 5 s, new blocks only) ──PUT + token──> Worker ──> R2 live.json
Recorders, publish jobs, vault bot: unchanged (two independent nodes, files on data branches, all checks as before)
```
Key decisions:
- **Off by default, safe fallback everywhere.** Both page switches ship `false`; when on, any failure goes back to
  today's path by itself. Switching on is one line; switching off is that line or removing a Cloudflare custom domain.
- **Same bytes.** The mirror never edits a file; the publish jobs and the vault bot keep reading GitHub, so no payout
  path depends on Cloudflare.
- **The live file is display only.** Strip and block counts; scores, cards and voids only from published game files
  (Ruler chat, 12 Nov). The Worker checks its shape (24 blocks, ordered, last = head, real addresses, time within 2 min).
- **The owner's node, never exposed.** The uploader reads a local address only and only sends out; no port is opened.
- **One secret, never in a chat.** `LIVE_TOKEN` is made on the owner's PC, saved in `.env` and as a Worker secret. The
  uploader reads only `LIVE_*` lines from `.env` and never logs the token. The Worker compares it without early exit.
- **Questions re-read slower, check unchanged.** Every question file is still hashed and compared with the chain's
  `params_hash`; only how often an already-known, not-waiting question is re-read changed (results still within a
  minute; an owner correction within 10 minutes).

## 4. Measured results (12 Nov; fake players, chain or GitHub; real code and file formats)
- Node calls per open Questions tab: before 11 Nov 54.5/min visible and hidden; now 14.8 visible, 0 hidden; 6.5 with the
  live file (T3, `pages.mjs`, `--ref 3d28446` for "before").
- GitHub load for game files: 100,000 page loads in an hour across 30 locations -> 2,160 GitHub reads instead of
  600,000 (T5).
- File limits: Block X ~150-1,100 weekly players, Race ~695-1,950, Questions ~3,200 (T1); Last Node ~5,900 per event
  (Last Node chat). Recorder run time ~2.4 min at 20,000 players, ~10 min at 100,000 (T4; 30-minute limit).
- Sponsor: typical player 12 Mana counted / 8.3 burned a day -> ~166 guests / ~416 players on today's caps (T2).

## 5. What to review (Repo Lens questions)
1. `data-source.js`: can the fetch wrapper ever send a non-game-file request elsewhere, change a request, or lose an
   error? With both switches `false`, is behaviour byte-identical to before (DS-1)?
2. `kg-data-worker.js`: can a path reach anything but `raw.githubusercontent.com/bawcejawn/KnodeGames/<allowed
   branch>/...json`? Is the cache key safe (query ignored)? Is the PUT check complete (token compare, size cap, shape)?
   Any way to store a live file that a page would accept but that is wrong in a harmful way? (Worst case is a wrong
   block strip for up to 20 s; no score or payout reads it.)
3. `uploader.mjs`: local-node check, token handling (never logged), timeouts, behaviour when the node is down.
4. `install-live-uploader.ps1`: same pattern as `install-release-kick.ps1`; dry run before registering; no secrets in
   the task.
5. `app.js` `checkFiles`: the `waiting` rule (answers closed and no outcome) and the 10-minute re-read; confirm the hash
   check is unchanged and results still appear within a minute.
6. CSP: the two new `connect-src` entries on 22 pages (`https://data.knodegames.com/`,
   `https://live.knodegames.com/live.json`), nothing wider.

## 6. Remaining gaps and debt (owned elsewhere or later stages)
| Gap | Owner | When |
|---|---|---|
| Block X file compaction + loud `readPicks` | Block X chat | before Mon 23 Nov |
| Race file + loud `readPicks` (patch sent) | Race chat | before Mon 7 Dec |
| Questions compact format | Questions chat | before ~2,000 weekly players |
| Last Node 60% warning + loud `readPicks` | Last Node chat | its launch PR |
| Golf, Bracket, Fantasy, Combo, Survivor file sizes measured | each game chat | before first paid week |
| Capacity standard adopted; rules 2-4 in the kit | Library + Architecture | proposal in `STANDARD-PROPOSAL.md` |
| Sponsor v4 (higher ceiling, withdraw + claim reserves) and KOIN plan | Capacity proposal Mon 23 Nov; contract by the sponsor chat with Repo Lens + testnet | Stage 1 |
| Workers paid plan ($5/month) before ~2,500-3,000 daily visitors | owner | Stage 1 cost proposal |
| Block X page still polls the node every 6 s for its countdown when the live file is off | Capacity (switch-on brings it to the live file) | with A4b |
| Other pages (Race, Bracket, Node) read the chain directly for their own strips | Capacity, page by page, after the live file is proven | Stage 1 |
| Scheduled GitHub runs ~636 a day (Race samples every 5 min) | workflow owners + Library | Stage 1 |
| Batched picks, signed free picks, Merkle payouts, second node | Stages 2-3 (contracts: Repo Lens + timelocks) | Stage 2+ |
| Testnet trials T7 (sponsor under load) and T8 (claim cost with unclaimed weeks) | Capacity + owner test wallets | Week 2 |

## 7. Dependencies and integration points
- **Cloudflare** (owner's account, free plan): proxy + cache rule (done), Worker `kg-data`, R2 bucket `kg-live`, custom
  domains `data.` and `live.knodegames.com`. Billing alert on.
- **GitHub raw** stays the origin for the mirror; data branches and publish jobs are unchanged.
- **Owner's node** (local JSON-RPC, `LIVE_RPC`) feeds only the live file; recorders still use Armana + koinosblocks.
- **Pages**: every page with a CSP loads `data-source.js` first (DS-6 guards it). Pages that don't fetch data are
  unaffected by the switches.
- **Other chats**: Ruler (live file display-only rule), Questions (`checkFiles` timing, its page), Block X (`readHead`
  live path), Hub (pages and CSP), Node chat (`LIVE_RPC` port), Library (standard, PR scheduling).

## 8. Tests
`node --test tests/audit/capacity-*.test.mjs` (CAP-1..6, DS-1..7, CW-1..5, LU-1..6) and the full audit suite. Tools:
`tools/capacity-harness/README.md` (T0-T5) with the 12 Nov results.
