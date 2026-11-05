# Knode Games — Architecture

> Purpose: How the pieces fit together, the principles they follow, and the **target architecture** with the steps to get there. Rules live in `DECISIONS.md` and `../standards/`; the live contracts in `CONTRACTS.md`; the folder map and funds-risk tiers in `REPO_MAP.md`.
> Last updated: 5 Nov 2026 late (principles, target architecture and roadmap A1–A10; contract and workflow tables filled; earlier: status sync: sponsor numbers point to `SPONSOR.md`; Vault v6.1 in PR #114; Race payout safety #133; CI guard #99 / #111; claim flow removed #137). Code facts last re-checked on `main` 3 Nov.
> Sources: `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (all 12 chats), checked against branches `picks` and `main` on 2026-11-02.

**Legend:** ✅ verified in repo · 💬 chat only · ⚠️ conflict (see `DECISIONS.md`) · ❓ unknown

## Contents
0. Architecture principles · Target architecture and roadmap (A1–A10) · 1. System diagram · 2. Layers (frontend, wallets, contracts, Mana sponsor, bots, data, infrastructure) · 3. Game contract duties kept from v5 · 4. Desk contract · 5. Vault v6 (entry points, measured costs, Hub pages, publish checks, Survivor kit, VHP standard, Picks contract, CI guards) · 6. Stack & tooling · 7. Tests · 8. Repository layout · 9. Security boundaries · 10. Known constraints

## Architecture principles
1. **Funds in as few places as possible.** Only the vault holds stakes; the sponsor and the Desk hold KOIN for their one job; nothing else holds tokens (D-003, D-016). New features never add a token holder without an owner decision and an audit.
2. **Small, audited, timelocked contracts; everything else off chain.** Contracts store stakes, picks and results; scoring, boards and pages run off chain where a bug can be corrected before money moves.
3. **Fail closed, then correct.** A recorder or the bot that can't verify something holds the week instead of guessing; payouts wait for the Sunday review, two-node checks and a 24 h correction window (`standards/RECORDER_STANDARD.md`, D-125).
4. **One way to do each thing.** One week cycle (`standards/WEEK_CYCLE.md`), one VHP ruler, one place that builds transactions (`stake-panel.js`), one results-file format; games add their rules on top, never their own copy.
5. **Two independent sources for every chain fact that decides a payout** (Armana plus `api.koinosblocks.com`).
6. **Least privilege for keys and workflows.** Cold keys own contracts; the bot's key can post results but not move funds; workflows get only the permissions the CI guard allows.
7. **Reproducible and reviewable.** Every live hash rebuilds from a commit; every change to tier 1 or 2 code goes through a reviewed PR with its tests.
8. **Free to run.** $0 hosting (D-005): GitHub Pages and Actions, the owner's nodes.

## Target architecture and roadmap
Where the platform is going, and the steps that move the architecture score (7 today, `HEALTHCHECK.md`) to 9–10. Each step has a work item; the order is by risk removed per unit of effort.

| # | Step | Why (risk removed) | Work item | Status |
|---|---|---|---|---|
| A1 | **Cold-key ownership everywhere:** vault and Desk to `1LMV8E…` (Tue 10), cold Desk treasury, `RACE_WIF` offline, Picks handover (D-106); decide the sponsor's KOIN float (most KOIN cold, D-085 option) | one stolen hot key can't change a contract or move the Desk's or sponsor's KOIN | TODOS (weekend runbook), R-BX-3, owner decision | in progress (Tue 10) |
| A2 | **One required CI check on every PR**: run `npm run test:audit` and the contract tests with **no path filter**, and make it required on `main`. Today `test:audit` runs only when certain paths change; `.ai/` docs that tests read (RULES, GAME_STANDARD, VAULT_STANDARD, DECISIONS, RUNBOOK) don't trigger it | a docs or data change can't silently break a test that guards payouts | R-HUB-23 | open |
| A3 | **Separate game data from code:** the bot and recorders commit results to a data branch (as `vhp-data`, `prize-settings` already do) instead of `main`; then `main` can require reviewed PRs and code owners (C5-13) without blocking the bot | today anything that can push to `main` can change code the bot runs (TD-03) | R-VAULT-15 (with Hub, Race, Block X) | open (design first) |
| A4 | **Publish only the website** (Pages allow-list), then move it into `web/` | internal files stop being served; the root holds only project files | R-HUB-14, R-HUB-16 | open |
| A5 | **Reproducible, tagged releases:** each live contract build has a git tag (`vault-v6.1`, `sponsor-v3.1`…) and a register row (`CONTRACTS.md`) | anyone can rebuild and verify a live hash; audits pin an exact commit | R-VAULT-16 | open (start with v6.1) |
| A6 | **A shared game kit:** one recorder library (two-node reads, pending → final, holds, the vault file and `board.json` writers, Sunday fun rounds) and one site library (boards, stake panel, claim rules: I-092); each game supplies only its picks and scoring | new games are faster and safer; fixes land once for every game | R-ARCH-1 part 2 (with the Fantasy, Golf, Bracket chats) | open (owner to choose timing) |
| A7 | **VHP ruler v2.1 live** (all eleven simulations pass), then every handicap reads it | one fair, tested size measure; closes the Race's known tricks | R-RULER-2, R-RACE-5 | building |
| A8 | **No single machine:** a warm standby node and producer key procedure on a second machine (or a $0 fallback), rehearsed recovery | a home outage or dead PC no longer stops block production or the bot's checks | TD-08, TD-10, `RECOVERY.md` gaps #33 – #35 | open (owner decision: hardware) |
| A9 | **Observability:** one hourly status file (pool production, sponsor use, held weeks, bot health) feeding the admin page and a public stats strip; plain-language alerts | problems are seen in minutes, by the owner, without reading logs | R-VAULT-9, R-HUB-17, R-HUB-22 | open |
| A10 | **The full platform audit**, tier 1 against each live hash, then tier 2 | independent confidence before stake grows (D-102) | I-002 | after the core |

**Score path:** A1 + A2 + A4 + A5 → about 8.5; A3 + A7 + A9 → about 9.5; A6 + A8 + A10 → 10.

## System Diagram
```
Player browser (knodegames.com, GitHub Pages)
   │  wallet.js: Kondor / KOIN Vault / Guest
   ▼
Koinos RPC (read) ──────────────► Koinos mainnet contracts
   │                                vault v6 (= game contract, game 1 built in) · desk v2 · race · picks · sponsor v3
   ▼                                        ▲
Mana sponsor pays for game plays ───────────┘
                                            ▲
GitHub Actions bot (OPERATOR_WIF) ──────────┘
Owner PC: 3 Docker nodes (desk, game, personal) + self-heal
```

## Layers
### Frontend (repo root, static files)
| File | Role | Confidence |
|------|------|-----------|
| `wallet.js` (KWallet) | Kondor, KOIN Vault, Guest. `localStorage` holds only public data: `kw-accounts` (`{kind, address}` list), `kw-active`, `kw-kind` — never keys. Each page must call `KWallet.init({ provider, chainId, payer, sponsor })` from `game-data/deployment.json` (the header only does a default init). `sponsorFor()` uses the sponsor only when every operation is covered (`covers[0]` is the game); `move_stake` is never sponsored (D-027) | 💬 (file exists ✅) |
| `header-wallet.js` | shared header wallet menu; reuses `#connect` inside `.top-row`; list / switch / add / forget / disconnect | 💬 (file exists ✅) |
| `guest.js` | play-only browser key (IndexedDB first, `localStorage` fallback), pinned to the sponsor and game, never holds funds | 💬 (file exists ✅) |
| `sw.js` | network-first shell cache `knode-shell-v7`; site changes need no cache bump | ✅ |
| `app.js` | questions game UI; `legacyLabelsOk` rebuilds labels for pre-hashRule-2 questions; per-week question numbers; welcome page is landing; precise Mana errors | ✅ `legacyLabelsOk` present; rest 💬 |
| `board.js` (KBoard) | Today / This week / Last week / All time, with Staked and Free play tabs; `boardPlace` from audit BX-41; `freeWinners` decides Free play medals, optional `earned(row, weekly)` decides Staked medals | 💬 Race chat |
| `names.html` / `names.js` (KNames) | "Your Koinos @name": live `verify_valid_name` read while typing; Create mints `{to, token_id: hex(name)}` via `KWallet.send` with the player's own Mana; confirmed with `get_address`; `KNames.setLocal` shows it at once. Display order: pool name → older Knode Games name → Koinos @name (wins); short address always shown. Rules: `fold` (lookalikes cl/nn/rn/ri/ii/vv, cl→d re-run after digits), `reserved` (knode*, Koinos + Group/Team/Support/Admin/Official/…), `addressLike`, `okNick`, `okPool`. Pages ignore a `names.json` over 2 MB | files ✅, rest 💬 Hub |
| `games.html` / `games.js` / `games.json` | the Games hub list; `games.json` is validated | ✅ files |
| `tools/site-nav.mjs`, `tools/site-seo.mjs` | write the tab bar into every page (a test keeps copies identical) and the share tags | 💬 Race chat |
| `swap.js` | swap page; skips its own `#connect` handler when the header menu owns the button (`aria-haspopup="menu"`) | 💬 |

- Hosting: GitHub Pages from repo root, custom domain via `CNAME` — ✅
- Read RPC: `koinos.armana.io`, hard-coded in `app.js`, `swap.js`, `header-wallet.js` ✅ on `main` and `picks` (C-04 resolved). The bot reads repo variable `vars.RPC` (defaults to Armana); locally set `$env:RPC` 💬 Swap Desk
- The site re-reads chain state and questions every minute; from 12:00 UTC until the day's questions appear it shows "Today's questions are on their way", and "running late" after 2 hours 💬 Swap Desk
- Payer flow (`sendKondor`): sponsor is payer only if it covers every operation and `would_pay` says yes; otherwise the player's own wallet is payer; a transaction re-pointed to the game contract is refused 💬 Swap Desk
- Chain reads queued 4 at a time — 💬
- Design tokens (`styles.css`): moss `--violet` #2F6B4F, navy #14213D, sun #F2B33D, tang #FF8A4C, paper #F3F1EA; fonts Bricolage Grotesque (display), Atkinson Hyperlegible (body), Archivo with a width axis (numbers). CDN scripts pinned by integrity hash (koilib 9.4.1, kondor-js 1.3.0); one CSP meta tag per page; pages never added under `site/` (redirect stubs only). `wallet.js` `guestPicks` gives a sponsored guest wallet for picks. 💬 Fantasy, Bracket
- Service worker never caches game or race data; strict CSP: no inline scripts or handlers, only pinned CDN scripts, content built with `textContent` only — 💬 Race chat

### Wallets
- **Kondor** (kondor-js 1.3.0, always loaded from CDN) — 💬
  - `window.kondor` always exists, so its presence proves nothing.
  - `getAccounts()` always opens Kondor's account-picker window (multi-select; auto-selects a single account). Cancel throws `"getAccounts cancelled"`; closing the window throws a "Connection lost"-style error.
  - Detect the extension silently with `kondor.provider.getChainId()`; no answer in ~4 s = not installed.
- **KOIN Vault** — chooses its own payer, so it cannot use the Mana sponsor — 💬
- **Guest** — see `guest.js` above.

### Smart Contracts
Addresses, live hashes, owners and reviews: **`CONTRACTS.md`** (the one register).
| Contract | Version | Upgradable? | Timelock | Confidence |
|----------|---------|-------------|----------|-----------|
| Game / Vault | v6 (upgraded in place from v5); v6.1 in PR #114 (dates: `CALENDAR.md`) | yes — 48 h notice for any vault upgrade (D-024) | 48 h (`timelockLength 172800000`) | ✅ |
| Desk | v2 `309506cc…` (28 Oct) | yes — owner announces, 48 h, then uploads | 48 h | ✅ |
| Sponsor | v3 guest fix `b84e1add…` (since 4 Nov; history in `SPONSOR.md`) | yes, by its own key, no timelock | none | ✅ |
| Race picks | v1 `61e8f212…` (27 Oct) | yes — by its own key `RACE_WIF` (no overrides); settings by its owner `1LMV8E…` | none on code (key goes offline, A1) | ✅ |
| Picks | v1 `700c296a…` (30 Oct) | yes — `upgrade-schedule`, 48 h, `upgrade-upload` | 48 h | ✅ |

Game timing (✅ `game-data/deployment.json`): genesis 2026-10-19 00:00 UTC (`GENESIS` 1792368000000), weeks Monday to Monday UTC, week = floor((t − genesis) / 7 days), so vault week 0 = Mon 19 Oct and week 2 = Mon 2 Nov (💬 Hub, Race; week labels: `KOINOS.md` → Time and D-063), close delay 12 h, settle 24 h, min stake 1 VHP (`100000000`); the vault's own Mana limit for others is now 0 (D-099; the record's `maxSponsorRc` was 2). How each game's week runs: `../standards/WEEK_CYCLE.md`.

### Mana Sponsor
- Sponsor covers: game, VHP, KOIN, race, picks contracts — ✅ `game-data/deployment.json` (`sponsor.covers`)
- Site payer: `payer: "sponsor"`, guest flag on — ✅
- What the site asks per action: `rcLimit` (the fallback), `rcLimitOther` (stake, withdraw, claim) and the per-action rows in `sponsor-data/mana-limits.json` (`rcLimits`) ✅. **Live values, caps and measured costs: `SPONSOR.md`** (the one home).
- Answer-only transactions are sponsored for any wallet within the free sub-cap; everything else is for real players only and fails closed — 💬
- Sponsor ON; **vault switch ON** (`SPONSOR.md` §2).
- **Vault switch (v3):** `config.game_has_vault`. While off, the sponsor never calls `get_game_player` and refuses vault calls with `VAULT_NOT_LIVE`. The tool reads `get_state` `config.v6_rule_week_plus_one` from two nodes. — 💬 Vault chat
- **Caution:** a plain `config` resets the caps to defaults, so always pass the current caps. — 💬 Vault chat
- **Sponsor tool rules** (💬 Block X): `capsOf` keeps 0; `tighterCaps` takes the lowest of both nodes and the default; `allowedBuilds` mainnet [v3, v2]; `codeOn` checks two nodes; the SP-50 swap check runs only on v3; `mana-limit --limit X` needs X ≥ 1.25 × the observed most and ≤ the per-tx cap; `TESTNET_PICKS` / `TESTNET_PICKS_CARDS=yes` are testnet only.
- Sponsor v3 allows every vault player call, `move_stake` included. Per-action caps must be above 0, so blocking moves on chain would need a tiny cap (I-021). — 💬 Hub

### Bots / Automation
| Bot / workflow | Trigger / schedule | What it does | Location | Confidence |
|----------------|--------------------|--------------|----------|-----------|
| Main bot ("Knode Games bot", was "Kpred bot"; `bot.yml`) | hourly at :07, plus a daily release run `48 11 * * 1-6` ✅ | Jobs: blocks-in, tick, publish, blocks-out. Tick order: resolve → post → close/finalize → health checks → settle → compound, then publishes `game-data/`. Release: within 12 min of release, `postPass` waits for 12:00 UTC (`releaseWaitMs`), one bounded retry. Records its own Mana per UTC day in `game-data/bot-state.json` → `manaByDay` (60 days) ✅. Settles: asks the contract to pay first; if it declines the bot pays, up to `MAX_BOT_PAID_SETTLES` (10 per run), lifted in the last hours before `settle_end`; `BOT_MANA_FLOOR` still applies 💬 Swap Desk | **Vault duties:** posts results, seals, finalizes 24 h after the seal, looks back 12 closed weeks; skips posting/closing/finalizing in safe mode; `pagePlayers()` stops on a repeated address; `upgradeGuard()` refuses a normal upgrade matching the safe build. Uses `koinos.armana.io`, `api.koinosblocks.com` as `RPC_CHECK` | `bot/bot.ts`, `bot/vault.ts`, `bot/chain.ts`, `.github/workflows/bot.yml` | files ✅, rest 💬 |
| Race recorder | hourly at minute 37 while `RACE_ENABLED=true` | Job `record` (read-only token, no secrets, runs repo code); job `publish` (write token, runs no repo code, shape-checks every file with embedded Python, pushes only to `race-data`). Only irreversible blocks count; blocks, picks and stakes must match on two nodes (`RPC`, `RPC_CHECK`). Files: `index.json`, `W<NNN>.json`, `board.json`, `vault/W<week>.json`. Fails if last run's files can't be read (fresh start only when the branch is missing). Refuses a `final` vault file before the week ends and any change to a final file. Fails closed (no final file) on missing ABI/contract, empty `get_state`, failed stake reads or node disagreement. Payout safety (#133): held weeks fail the run, the vault file is recomputed from the chain, published final race results are locked; on the weekly rhythm (#149, #155) | `bot/race.ts`, `.github/workflows/race.yml`, shared rules in `race-math.js` | 💬 Race chat |
| Block X recorder | hourly at :47 (`games.yml`) ✅ | on the weekly rhythm from Week 1 (#160); published final results can't be rewritten (#159); `canonicalTransferValue` / `NonCanonicalTransfer`; a target is voided at once only if both nodes report it, otherwise held and voided at the 3-day edge; reads short receipt pages on (BX-90); no vault file past its 3-day window (BX-92); reads only top-level `W###.json` race cards (`vault/` invisible to it) | `bot/games/blockx.ts`, `.github/workflows/games.yml` | 💬 Block X |
| Survivor recorder (not deployed; paused, D-113) | with `games.yml` | No keys. Mainnet seasons need two nodes, compared on settings only; a down check node doesn't stop the run, days seen by one node are re-checked later. 8-min budget (`SURVIVOR_BUDGET_MS`), hard stop for chain reads 4 min later. Stages output in a side folder, keeps the old as `.survivor-old-<hash>`, `recoverOut` repairs an interrupted swap. Writes v2 season files with a `stakes` array, keeping every player's picks. Vault reads: `vaultSettings`, `vaultMismatch`, `readStaked`, `readRanked` (`get_player` → `stake_other`) | `bot/games/survivor.ts`, shared rules `survivor-math.js` (`KSurvivor`), page `survivor.html` / `survivor.js` | 💬 Survivor (branch `survivor`) |
| Last Node recorder (not deployed; paused) | `lastnode.yml` | Read-only, no keys; two nodes, irreversible blocks, must match. Writes `games-data/lastnode/` `D<day>.json`, `index.json`, `board.json`, `vault/W<week>.json`, `vault/HOLD-W<week>.json`. Testnet mode `--testnet --game N` writes only in `testnet-data/`. Record job: read-only token, no secrets; fetches race-data, games-data and race-samples (a snapshot every 6 h, 60 h back). Publish job runs no repo code: a Python shape check, then `histcheck.py` with Python ports of the scoring, plus its own stdlib Koinos JSON-RPC client (`get_head_info`, `get_blocks_by_height` in 200-block pages, `read_contract` `list_picks` entry 2118033200), 20-min timeout; re-checks new hours, hour-0 picks and new fields on two nodes. Still trusted to the record job: c, form r, the staked list | `bot/games/lastnode.ts`, `lastnode-math.js` (`KLastNode`) | 💬 Last Node |
| Block Golf recorder (not deployed; paused) | `golf.yml` hourly at :57, group `knode-golf`, off until `GOLF_ENABLED=true` | No picks: reads other games' published results (Questions contract on two nodes, Race board, Block X board). Refuses to start if last run's files exist but can't be read. Writes `games-data/golf/` `index.json`, `W###.json`, `board.json`, `vault/W<n>.json`. Publish job runs no repo code; rebuilds vault rows from the W cards; refuses rewriting a final week, a shrinking week list, changed join weeks, a changed `stakedFromWeek`, or changing a sent vault file; push retried 3 times | `bot/games/golf.ts` (`npm run golf`), `site/golf-math.js` (`KGolf`, integer math), `docs/GOLF.md` | 💬 Block Golf |
| Bracket recorder (not deployed; paused) | `games.yml` step (`continue-on-error`) | At most 6 hours of chain a run, 4 parallel reads; refuses to write if last run's files are missing; fetch errors stop the run. Week file v4 with seeding (`hash` SHA-256 covering `pooled`), hours, boards (≤ 1,000 rows each, `MAX_BOARD_ROWS` ✅ on `kg-09-bracket`), `bracket/vault/W<week>.json` | `bot/games/bracket.ts`, `bracket-math.js` (`KBracketMath`), `docs/bracket/README.md` | 💬 Bracket |
| Fantasy recorder (not deployed; paused) | `games.yml` step behind `FANTASY_ENABLED`, `continue-on-error` | Read-only, no key. Day final only when every hour with blocks has a race card (FX-5); week final when all 7 days, rivals and stakes are read and 12 h have passed (FX-1); `ALERT` if not final 2 days after the week; unfinished weeks retried 8 weeks (FX-6). Publishes `games-data/fantasy/` `index.json` (`vaultBasis`), `days.json`, `W###.json`, `rivals.json`, `alltime.json`, `board.json`, `vault/W<week>.json`; Fantasy files may be up to 8 MB | `bot/games/fantasy.ts`, `fantasy-math.js` (`KFantasyMath`), `docs/fantasy/` | 💬 Fantasy |
| Combo recorder + verify (not deployed; paused) | `combo.yml` hourly at :52 (after race :37, Block X :47), shares the `knode-games` group | Three jobs: record (read-only, runs the recorder), **verify** (read-only, installs nothing, `tools/combo-verify.mjs` confirms each new fixed slot against `list_picks` on two nodes and re-scores new final cards), publish (no repo code; byte checks, per-file holds, immutability; only verify-confirmed day files, `COMBO_VERIFY: required`). Slot fixed when both nodes' irreversible block is past its day; head = the slower node; a node 30+ min behind stops the run. "Forged" cards leave the boards and block that week's vault file. Output `games-data/combo/` with day parts (≤ 1,000 cards), boards, `vault/W<week>.json` | `bot/games/combo.ts`, `bot/games/combo-score.mjs`, `combo-math.js` (`KCombo`), `bot/games/vhp-inflows.mjs` (kept identical to Block X's decoder by a test) | 💬 Combo |
| Names bot | hourly | Jobs: check (read-only), publish (no repo code), reply; gated by `vars.NAMES_ENABLED`; scheduled only, never triggered by issues. 8 s read timeout (a node that times out is skipped for the run), 7-minute run deadline. Nicknames read 20 at a time within 240 s, named wallets and producers first; both nodes must agree; a failed read keeps the old value. Pool names from Fogata `get_pool_params` (entry 2396056273, field 1). `names.json` kept under 900 kB (publish limit 1 MB). Owner command: `npm run names -- remove <address>` | `bot/names.ts`, `.github/workflows/names.yml` ✅ | 💬 Hub |
| Bot `--testnet` | manual | targets the local Harbinger node (`127.0.0.1:8081`, `.env.testnet`, `testnet-data/`) — **not** the Koinos Foundation copy | `bot/bot.ts` | 💬 **Unused: the owner runs no testnet node** (D-066, I-068) |
| Sponsor tool | manual | L-4 fix, default free cap 2,000 a day in v3 (300 was v2-era; D-061), keeps guest flag, status shows VHP | `bot/sponsor.ts` | ✅ / 💬 |
| Watchdog | every 15 min ✅ | emails once if `vars.PERSONAL_PRODUCER` hasn't produced for 30+ min, then every 3 hours | `.github/workflows/watch.yml` | 💬 Swap Desk |
| Release kick (owner's PC) | 11:50–14:00 UTC | 11:50–11:58 starts `bot.yml` unless a run is active; 12:06–14:00 checks `game-data/questions/W###-D#.json` is on `main` (public API, no token), restarts the bot at most every 12 min, emails once at 12:20, marks the day done when the file appears. Day labels `W{week:03}-D{day}`, Monday = D1, no questions Sunday | `bot/release-kick.mjs` | 💬 Swap Desk |
| Heal alert | started by the owner's PC | fails on purpose so GitHub emails the owner | `.github/workflows/heal-alert.yml` | 💬 Swap Desk |
| Self-heal | every 20 min | repairs a crash-looping node via `node/repair-node-data.ps1` | `bot/heal.mjs` | file ✅, schedule 💬 Restarts a node (`docker compose down`, `up -d`) when 200+ blocks behind and not moving, or silent on two checks; 50-min cooldown; stops after 3 restarts in 6 h and emails "check by hand"; a block store started 3+ times in 20 min is a crash loop (emails; auto-repair added later); every heal emails via `heal-alert.yml` 💬 Swap Desk |
| Test workflows | on push / PR, by path | `test.yml` (vault contract), `desk-test.yml`, `sponsor-test.yml`, `picks-test.yml`, `race-test.yml`, `vault-bot-test.yml`, `status-test.yml`, `resolver-test.yml` (runs `npm run test:audit`), `workflow-guard.yml` (CI guard). **Path-filtered: a change outside their paths runs none of them (A2)** | `.github/workflows/` (18 files) | ✅ |
| Other scheduled | hourly / 5–15 min | `names.yml` (:04, @names), `race-samples.yml` (every 5 min, VHP samples), `vhp-ruler.yml` (:12, off until `VHP_RULER_ENABLED`), `games-testnet.yml` (Block X testnet, every 20 min), `watch.yml` (every 15 min), `heal-alert.yml` (started by the PC) | `.github/workflows/` | ✅ |

Node scripts present (✅): `node/repair-node-data.ps1` (general repair), `node/move-node-to-volume.ps1`; `node/repair-desk-data.ps1` (copied the game node's `block_store\db` and `chain\blockchain` onto the desk node, kept old data as `…-broken-<stamp>`, never touched keys/p2p/config) was later removed.

### Data
- On-chain state: the vault (stakes per wallet and game, week records, posted results, free winners, seals, config including the v6.1 rule week), Picks (each game's picks and locks), Race picks (race picks), the sponsor (caps, rows, daily and weekly use), the Desk (KOIN balance, fee, treasury); read-only tools: `npm run bot -- status`, `chain-check`, `npm run sponsor -- status`, `npm run picks -- status` ✅
- Scheduled workflows run only from `main`. `race-samples.yml` runs from `main` since 3 Nov 15:58 UTC ✅. GitHub runs its 5-minute schedule only about hourly, so each run takes up to 12 samples, ≥ 4 min apart (PR #67). 💬 Last Node
- Off-chain: `game-data/`, `desk-data/` (has `v1UploadTx` ✅), `sponsor-data/`, `race-data/`, `picks-data/`, `games.json` — ✅
- Vault results: `W${week}.json` (unpadded) from each game's `vaultGames` source — ✅ sources on `main`; naming 💬. Branch `games-data` holds folders blockx, survivor, fantasy, combo, bracket, lastnode, golf — 💬
- Race: `race.yml` holds back a vault `W<week>.json` that fails `vault_ok`, with a warning; a final vault file can never change — 💬
- Race pick row: `[player, horse, time, won 0/1, 0, show 0/1]` (field 5 always 0 now; pre-Show picks back-filled). `board.json` rows: `{a, pts, correct, shows, picks, ranked, boardPlace, earns}` — `ranked` = on the Staked board; `boardPlace` shared by ties (1, 1, 3…); `earns` 1/2 = free-prize place, 3 = staked bucket share, 0 = nothing (nonzero only on This week / Last week) — 💬 Race chat
- Vault results file format and the stake test: see `standards/VAULT_STANDARD.md`

### Infrastructure
- Nodes: 3 mainnet nodes on the owner's PC, Docker Compose on Windows, Docker volumes; no testnet nodes (D-066). Images (as of Oct): chain v1.5.2, block_store v1.1.0, p2p v1.3.0, block_producer v1.3.1 — 💬 (folders in `PLATFORM.md`)
- `GITHUB_ALERT_TOKEN` (in the local `.env`): a fine-grained token for this repo only, Actions read/write, used by `heal.mjs` and `release-kick.mjs` — 💬
- Old basedir folders kept until 2026-11-04 — 💬

## Game contract duties kept from v5 — 💬 Swap Desk (✅ where marked)
- Daily `compound` burns returned KOIN into VHP, keeping `seed_koin + creator_fee` as KOIN; capped by the contract's own Mana (minted KOIN arrives with equal Mana). The bot's "day" is 28,800 blocks, so compounds drift ~1 hour later each day. ~317 KOIN went uncompounded by 28 Oct because others' transactions spent the contract's Mana (I-044).
- `set_sponsor_limit(max, min)`: owner only, immediate; `max_sponsor_rc = 0` means the contract pays for no one. Still in the v6 code ✅ (`game/assembly/Kpred.ts`, at most 10 KOIN per free transaction); now **0**, the vault pays Mana for no one (D-099; the record's `maxSponsorRc` said 2).

## Desk contract (Knode Swap) — 💬 Swap Desk
- Swaps VHP → KOIN 1:1 minus the fee (3%, capped at 10%); a swap pays at most min(desk KOIN, desk Mana).
- `authorize` refuses every outside token move and every Mana payment; the desk refuses its own address as owner or treasury.
- Withdrawals go to the treasury only; treasury and code changes have a 48 h timelock.
- Desk v2 adds a two-step owner handover, a daily payout cap (starts uncapped; D-007), 48 h waits for a lower fee, higher cap or new key, and a 7-day expiry on announcements.
- The desk node's VHP (fees included) produces blocks, refilling the KOIN on offer (D-044).

## Vault v6 (the game contract) — 💬 Vault chat unless marked
- **Builds:** live `eed38f7c…` (86,114 bytes) ✅; emergency withdrawals-only `e84fec49…` (84,688 bytes) ✅ `safeWasmSha256`, built with `npm run build:safe`, which flips `SAFE_MODE` in `game/assembly/Mode.ts`.
- **Safe mode:** 14 entry points refused. Result recording stays open (settle, resolve/correct questions, `post_results`, `post_prize_winners`, seal, correct, void). `advance()` does nothing, `sponsorOk` is false, `get_state.safe_mode` (field 12) is true.
- **Accounting:** u128 liabilities, checked subtraction `less()`; the seed takes the first loss (`seedFree`).
- **Per-week claim caps:** game week `(rolled_over ? 0 : bucket) + prize_first·first_n + prize_second·second_n`; question week `rolled_over ? pot_free : pot`.
- **Results timing (other games):** due 3/7 of a week after the week ends (`RESULTS_DAYS = 3`, 3 days on mainnet). Finalize starts after `seal + 2·close_delay` and `last_change + close_delay`. Corrections and voids are refused once finalizing starts.
- **Registry:** up to 12 games besides game 1. `propose_game`, then `apply_game` after the timelock (48 h mainnet) and within 7 days. A game applied in week W earns from W+1. `deactivate_game`: earns through the current week; stake stays withdrawable. Restart before the last earning week ends keeps the game running but can't change season length; restart after a gap needs `weeks_closed >= last_week_plus_one`.
- **Closing:** `advance()` closes one week and does one finalize step per call; `close_week` is open to anyone; a deposit, claim or move triggers `advance`. **v6.1 (PR #114, D-127):** no player action closes or finalizes a week; the bot does.
- **Rule start:** `v6_rule_week_plus_one` is set by the first v6 write; rules start the following Monday (it stayed 0 after the upload until v6's first transaction).
- **Stakes:** `deposit_to` takes whole numbers only and can burn KOIN 1:1 into VHP; `withdraw_from` any amount, any time; `move_stake` refused while paused, target game must be active and staked.
- **2nd place** is paid even when nobody placed 1st (audit V6-9); 1st's share returns to the pool.
- **Week weight:** `weight_set` is saved only when a game moves past that week; otherwise `weightFor` uses live `week_stake` / `next_stake`.
- **Seed:** two-step handover (`propose_seed_owner`, then `accept_seed_owner` 28,800 blocks later); accepting cancels any pending seed withdrawal; seed withdrawals have a 48 h timelock and pay the current seed owner.
- **Upgrade guard:** `PRE_VAULT_CODE` refuses the old hashes `ff4207b4…`, `917708a7…`, `c17066ae…`.

### Pinned entry points (used by other tools)
| Group | Entry points |
|-------|--------------|
| Vault calls | `deposit_to` 0x7bb5c436 · `withdraw_from` 0x5b0aaef8 · `move_stake` 0x7c268e69 · `claim_game` 0x4107e3ab · `finalize_game_week` 0xec300c11 |
| Reads | `get_game_player` 0x0feb472b · `get_player` 0x37ce3085 · `get_state` 0x3d02a349 · `list_games` 0x02efa793 · `get_game` 0x6f8d72cf · `list_players` 0x44d79744 (💬 Hub) |

Player-call arguments (💬 Hub): `deposit_to {from, game, amount, koin}` · `withdraw_from {to, game, amount}` · `move_stake {player, from_game, to_game, amount}` · `claim_game {player, game, week}`. The vault is live when `config.v6_rule_week_plus_one > 0`. `game_object` fields: `next_stake` 13, `next_week` 14.
| Token | `approve` 0x74e21680 · `balance_of` 0x5c721497 |

### Measured on testnet (the old `docs/TESTNET-V6-RESULTS.md`, now in the Claude project: `claude/repo-history/docs-TESTNET-V6-RESULTS.md`)
Heaviest player call 4.63 M ticks (a deposit closing a 13-game week, 1.6% of the per-transaction limit); 16-row post 1.50 M; finalize of 16 places 1.75 M; claim 2.44 M; withdraw 1.72 M; upload disk 86,257 B. Upper bounds: 50 rows ≈ 4.7 M ticks; 500-place finalize ≈ 55 M (19%). v6 upload cost 46.84 KOIN of Mana on mainnet vs 7.53 on testnet.
Measured on mainnet (💬 Swap Desk, Oct): simple call ~0.21; each write ~0.02; answer or pick ~0.3; `deposit_koin` ~1.38; `compound` ~1.08; game v5 upload 26.8; `cancel_upgrade` ~0.25 Mana. Bot spend from `manaByDay` ✅: ~1.9–5.1 Mana a day (31 Oct – 2 Nov).
Combo cards on testnet (player-paid): 2 legs 0.0588, 6 legs 0.0726, 10 legs 0.0916, a change 0.0538; Picks v2 upload 3.2528 on testnet, ~55 estimated on mainnet (💬 Combo). Sponsored figures: D-038.
Mana cost per call = ticks × compute price + disk bytes × disk price + network bytes × network price.

### Hub pages
- Stake panel: `stake-panel.js`, `stake-page.js`, `stake-testnet*.js`, `stake.html`, `stake-testnet.html` (PRs #32, #33, #35, #41, #42, #46 ✅); matches the v6 ABI field for field (script-checked). — files ✅, rest 💬
  - `KStake` API: `mount(el, {game})` (Stake = approve + `deposit_to`; Withdraw always offered; Move; Claim), `mountList`, `badge(el, {game})` ("Staked · X VHP / Playing free" bar), `status`, `overview(who)`, `send(action, a)` (up to 10 claims per transaction), `sayError`.
  - After any action it fires `kstake:changed`; only the latest refresh renders (generation counter). `per100()` uses the vault's `weightFor` until a week's weight is saved. Claims follow the vault's `claimableG` / `rewardOfG` and look back 52 weeks, including weeks before a restart. `claimable()`: 2nd place gets `prize_second` as is; 0 when 1st is tied. Busy-Mana (code 104) says "wait a minute and try again". On a `kg-network=testnet` page it uses `testnet/vault.json` and `KTestStakeWallet`.
  - `stake.html` (staking hub; manages Daily Questions too, D-121, #142 / #150 / #157; with 2+ rewards the player chooses how to claim, `SPONSOR.md`): summary (staked, in wallet, rewards); Games tab with one card per game (your stake, game total, share % and bar, status chip); inline Stake / Withdraw / Move forms with quick amounts (1/10/100/Max; 25%/50%/All); Rewards tab with Claim all; `#g<id>` opens that game's Stake form; wallet set up with the sponsor.
  - `stake-testnet.html`: public, noindex; `stake-testnet-wallet.js` signs only the 4 vault player calls on the test vault plus an approve right before `deposit_to`; refuses mainnet; signed operations must equal the built ones; Mana capped at 0.5 per transaction.
  - `race.html`: `#stake-badge` at the top of `<main>` (✅), `#stake` panel lower; the Games page links to `race.html#stake`, so that id must stay.
- Admin page: `admin/actions.ts`, `admin/server.ts`, `admin/index.html` (PR #43 ✅ merged into `picks`); mainnet "Knode Vault (v6)" buttons match the bot's commands. — 💬
  - Start on the owner's PC: in `C:\kprediction` on `main`: `git pull`, `npm ci`, `npm run admin`; opens a local link with a one-time key. Docs: `docs/ADMIN.md` (its start steps still say `git checkout picks`: stale, R-HUB-8).
  - Tools: bot, desk, sponsor, picks, racepicks, names. Vault area: Sunday upgrade steps (status, apply, clear); Add a game (with season field); post / seal / finalize; correct / unprize / void; collect the 5% VHP fee. Also Wallet names, and "Vault v6 trial (local node)" (`--testnet` reaches only the local Harbinger node).
  - The Vault area's buttons work on `main`. Since 3 Nov it also has **Free prizes: list / ON / OFF** (D-082).

### Publish checks (`games.yml`, `games-testnet.yml`, `race.yml`, `race-samples.yml`) — 💬 Block X
Recorders are JavaScript writing `JSON.stringify(x)+"\n"`; publish checks are Python. Every publish job:
1. `find` refusals: symlinks, unexpected files or folders, files over 2 MB (`race.yml` allows only `$IN/vault` and `vault/W[0-9]{1,4}.json`).
2. An inline `node -e` check: raw bytes must equal `JSON.stringify(JSON.parse(text))+"\n"` (regular files only, path after `--`, walks subfolders).
3. Python checks: `js_safe` (numbers within ±2^53−1, finite, no integer-valued floats, depth ≤ 64); type-strict `isaddr`, `one()`, `same()`; ASCII `[0-9]` only, never `\d` (a guard test enforces this, including `python3 -c` / `python3 -I -c` one-liners).
4. `setup-node` 22, SHA-pinned.
- **Append-only history:** a published card never changes (BX-44); index weeks are append-only, a new week only for cw−1..cw (race: cw−1..cw+1); W targets only for the current or just-ended week, never after P is published; height = round × 2400 + 0, its time ≤ now and inside the week. A run that rewrites history is held whole.
- **`race.yml` record job:** `git ls-remote --exit-code refs/heads/race-data` (exit 2 = first run; any other error stops); `ls-tree -r -z` into a file, then a `read -d ''` loop; fetches W / index / board / `vault/`, plus `race-samples`.
- **`race.ts`:** samples and cards take the lower of the two nodes' reads; `topInDoubt` re-runs the floor with 0.5% tolerance; supply cap, clock check (BX-89), early check-head (BX-114), lag bound (BX-101). Boards rank by vault stake (`stakedOf`); the old "holds 1 VHP" read (`rawRead`) was removed. `readStaked` uses `game/abi/kpred.koilib.json`, the v6 interface (has `get_game_player`) ✅ (fixed 3 Nov, TD-06).

- **`games.yml` gates and limits** (💬 Survivor): the whole workflow stays off until `GAMES_ENABLED=true`. Job limit 45 min; Block X step 25 min; Survivor step 15 min, run only `if: !cancelled() && steps.prev.outcome == 'success'` (so a Block X publish failure also stops Survivor). A failed recorder's files are left out; a single failing file is dropped on its own (exit 3); files over 2 MB are dropped with an alert; published vault files aren't checked again. For Survivor, Python replays every season (play, rank, prizes, `week_rows`) to mirror the JS and refuses any other result; everything is checked against the job's own clock (`CHECK_NOW_MS`) with 1 h slack; a vault file whose stakes were read late is held; the index's season list is append-only.

### Survivor page and testnet kit — 💬 Survivor (branch `survivor`)
- Page: shows the chain clock; pauses picking until picks are read cleanly or while settings are paused; `canPickDay` false once the season or the player's board has ended; sent picks tracked per wallet and day, dropped after 3 min unseen; warns before picking your own producer; no-field and guest notes.
- `survivor-math.js`: `KSurvivor.withConfig` (test clock; tests pin mainnet values), `playSeason(days, staked)` → `ends: {staked, free}`, `weekRows(days, k, staked, board)`, `outByMissing` (knockouts logged `n`/`f`/`u` can't win).
- Testnet kit `npm run survivor-test` (`bot/survivor-test.ts`, `tools/survivor-testnet/fake-testnet.mjs`, `rehearse.mjs`): refuses mainnet by node name and chain id; reproduces the audited build before patching two constants (test owner, 10-min admin wait); game 3 on testnet uses 1-hour rounds, 50 picks a day; six test players (p1 owner's, p2–p6 robots, p6 skips every third round); the local server keeps test keys and signs only Survivor picks; 1 test KOIN stands in for 1 VHP; exclusive `wx` lock; refuses device names and symlinks; strips `PICKS_*` env vars.
- Docs ✅ on `survivor`: `docs/SURVIVOR.md`, `SURVIVOR-TESTNET.md`, `SURVIVOR-CODE-WALKTHROUGH.md`, `SURVIVOR-RUNBOOK.md`.

### The KnodeGames VHP standard (D-058) — 💬 Bracket
- `vhp-standard.js` (`KVhp`, repo root; docs `docs/VHP-STANDARD.md`, project `claude/vhp-standard.md`) and shared reads in `bot/vhp-chain.ts` (`chainNode`, `heightAt`, `bookFor`; ~400 blocks/s with 4 parallel reads).
- VHP is rebuilt block by block from the VHP contract's events; reverted transactions skipped; anchors are balance reads pinned to one block on two agreeing nodes; a fork check compares block ids. Effective VHP rules: `KOINOS.md`.
- Constants: `DELAY_BLOCKS` 20, `ACTIVE_BLOCKS` 7200, `CARD_BLOCKS` 7200, `SEED_BLOCKS` 28800, `MIN_K` 10, `Q_SCALE` 1e15.
- **cardVhp + card credit + average totals, always together:** a producer's own numbers set its multiplier (`vhp` = highest effective VHP over 7,200 blocks, or `k = 7200 × cardVhp ÷ Σavg`); each scored block is worth multiplier × `min(1, cardVhp ÷ effective then)`; anything about other producers uses averages (total, `topAvg`, `kAvg`). Never use cardVhp alone; never take a multiplier from an average-based number.
- **Baseline + credit** (judging after the fact): baseline = effective VHP at window start; expected = baseline × Σ 1 ÷ active set's effective VHP; credited = Σ over signed blocks of `min(1, baseline ÷ VHP then)`. `averageVhp` over 28,800 blocks for seeding and fields.
- Evidence: the rebuild matched all 780 race-card VHP readings; 100 days of history showed 0 node disagreements. Race and Block X are not on the standard yet (to switch: cardVhp `k` with card credit; Block X becomes min(3, topAvg ÷ your cardVhp); cardVhp replaces the random-sample check in `claude/handicap-anti-gaming.md`).
- Race cards today (BX-38): a card's VHP is the highest effective VHP over 6 hours of samples (`windowHigh`); a card from fewer than 12 samples is flagged with `samples`; Block X skips flagged cards, Fantasy uses them (I-062), Combo needs ≥ 12 samples and ≤ 3 h age (`usableCard`). 💬 Fantasy, Combo

### Picks contract — 💬 Block X
- **Pick kinds:** 1 = one address, 2 = a list of 2–10, 3 = a number, 4 = CARD (Picks v2 only: 2..`max_legs` legs `{code, round, producer}`, each leg type with its own lock clock; `tighten_game` can switch off, lock earlier, open later or lower `max_legs`). Lock mode 2 (time): target = round × round_size + offset; picks refused from target − lead (lead ≥ 5 min or 100 blocks); open `ahead` before (≤ 35 days). Hard limits: 50 picks per game per day, 50 changes, 32 games, list size 10. `announce_game` needs a `name` of 1–40 bytes. Holds no tokens and never pays Mana. 💬 Golf, Fantasy, Combo
- **Registered or planned games:** 2 Block X; 3 Survivor; 4 Fantasy team (list of 5, captain first, daily rounds, lock 5 min before the day, open 7 days ahead); 5 Weekly Rival (one address, round = the week's Monday day number); 8 Combo (CARD, 3 cards a day); 9 Bracket (NUMBER, TIME lock, 7-day rounds, `round_offset` = GENESIS mod WEEK, round = week + 2963, lead ≥ 5 min, ahead ≤ 36 h, 20 picks a day, 20 changes); 13 Last Node (kind 2, list 2, 1-day rounds, lead 5 min, ahead 24 h, 5 changes, 10 picks a day). Only Block X is scripted for mainnet in `bot/picks.ts` so far. 💬 each game chat
- **Fingerprints:** audited build `700c296a…c594` ✅; Picks v2 ABI `cea9b073…`, v1 ABI `8efa3ad4…` 💬 Combo; audited `Picks.ts` source `444209c1…83d6`; protoc 21.12 💬 Survivor.
- **Game 3 registration (planned):** kind 1, list_size 1, lock_mode 2, round_size 86,400,000, round_offset 0, lead 300,000, ahead 604,800,000, max_changes 5, 20 picks a day, enabled 💬 Survivor.
- **Upgrade path:** owner `schedule_upgrade(sha256)` → 48 h → owner-signed upload within 7 days → `schedule_upgrade` with an empty hash. The three overrides stay on.
- **Site:** `blockx-math.js` `MAINNET_GAME = {id:2, round:2400, offset:0, lead:100, ahead:28900, picksPerDay:30, maxChanges:1}` ✅; `wallet.js` `PINNED_PICKS = "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm"` ✅ on `main` (3 Nov; was `""` until publish); `blockx.html` calls `KStake.badge(…, {game: 2})` in `setupStake`, mainnet only; the Block X testnet page uses `testnet-wallet.js`.

### CI guards — 💬 Hub
- `tests/audit/site.ci-deps.test.mjs` (run by `workflow-guard.yml` ✅): bans issue triggers, `write-all`, `secrets: inherit` and `toJSON(secrets)` in any case; refuses any `issues` permission since the claim flow was removed (#137, D-118). Parses each workflow since #99 / #111 (was regex-based, I-022).
- `bot/workflow.test.ts`: no `${{ }}` inside run scripts; no job output named `run`.

## Stack & Tooling — 💬 Vault chat
- AssemblyScript (`@koinos/sdk-as` 1.5.1), as-pect with MockVM, koilib 9.4.1, protoc 21.12 (pinned and checksummed by `tools/protoc-pin.cjs`), Node 22, tsx.
- `tools/mockvm-bytewise.cjs`: patches MockVM so keys order bytewise (`BytewiseMap`, `getNextObject`/`getPrevObject`, copy on `putObject`); the real chain orders bytewise (audit V2-14).
- `npm run bot -- testnet-v6`: one-command testnet check → `testnet-v6/report.md`.
- `bot/rehearse-v6.ts`: rehearsal on a snapshot (`vault-snapshot`, then `rehearse-v6`).
- `tools/mode-switch.cjs`: one shared parser for `Mode.ts`.
- `npm run bot` (💬 Swap Desk): status, chain-check, upgrade, sponsor-limit, node-status… · `npm run desk`: status, node-status, key-status, fund, withdraw, daily-cap, upgrade, treasury… · `npm run heal` · `npm run admin`.
- `npm run picks` (💬 Block X): keys, build-testnet, status, upload, announce, apply, pause, lock-test, mana-test; on branch `combo` only: upgrade-schedule, upgrade-upload, upgrade-clear. `npm run sponsor`: status, upload, config, enable, disable, mana-report, mana-limit, site-limits, watch, payer. All dry runs by default. Sending needs `--send` and `CONFIRM_MAINNET=yes` in `.env`; only `npm run picks` also needs `--mainnet` ✅ (code checked 3 Nov).

## Tests
How to run: `npm run test:audit` (also `test:audit:serial`, `test:resolver`, `cd sponsor && npm test`); tests are built for Linux — on Windows several games' tests fail or skip by design. CI "Resolver tests" runs `npm run test:audit` on Linux for pushes to `lastnode`. `yarn protoc` sometimes fails with EAGAIN — rerun.

| Branch / commit | Result (as reported) | |
|-----------------|----------------------|-|
| Questions chat (latest run) | `tests/audit/*` 531 pass, 0 fail, 3 TODO (`tests/audit/` has 110 files ✅) | 💬 |
| `picks` (Block X, 30 Oct) | 644 tests: 634 pass, 0 fail, 5 todo, 5 skipped (pwsh-only) | 💬 |
| `survivor` @ `a8a1979` | site 201 pass; serial 673 (663 pass, 0 fail); rehearsal reproduces the audited build; 150-season fuzz 0 Python/JS disagreements | 💬 |
| `lastnode` @ `adf95be` | 718 tests, 708 pass, 0 fail; Last Node 109 on Linux | 💬 |
| `golf` | 481 tests, 471 pass, 0 fail | 💬 |
| `kg-09-bracket` @ `ee676ea` | serial 457 (447 pass), site 176 | 💬 |
| `fantasy` (merged with `picks`) | 522 pass, 1 fail (`site.mobile-nav.test.mjs`, from `picks`, I-062) | 💬 |
| `combo` @ `c8c652e` | `test:audit` 747 pass, 0 fail; contract 71; browser 7; guard 8 | 💬 |
| Vault v6 | 162/162 specs, 38/38 node tests | 💬 |

## Repository Layout
The folder map, with each part's funds-risk tier and the plan to tidy the root: **`REPO_MAP.md`** ✅.

## Security Boundaries
- Keys live only in `.env` on the owner's PC; never pasted in chat — 💬 (D-003)
- GitHub: only `OPERATOR_WIF` stored, in environment `bot`; the main workflow uses it — 💬
- Branch ruleset: restrict deletions, block force pushes; no PR requirement yet, because the bot commits data to `main` (A3 removes that blocker) — 💬
- Mainnet sends need `CONFIRM_MAINNET=yes`; commands are dry runs unless `--send` — 💬 (D-004)
- Audit process: `AUDITS.md` (fix-fast rules D-140); the starter audit prompt is `../standards/AI_CHAT_STARTER.md` §3.3

## Known Constraints
- Hosting must cost $0 — 💬
- Armana caused browser CORS failures (likely burst rate limits) — 💬 Questions chat. RPC endpoints: `KOINOS.md`
- The proxy used by AI chats blocks GitHub branch deletion and log downloads (403); owner does those in the GitHub UI — 💬
