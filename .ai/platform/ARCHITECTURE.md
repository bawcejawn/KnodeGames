# Knode Games — Architecture

> Purpose: How the pieces fit together. Describe, don't prescribe.
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions, Vault, Hub, Race and Block X chats), checked against branches `picks` and `main` on 2026-11-02.

**Legend:** ✅ verified in repo · 💬 chat only · ⚠️ conflict (see `DECISIONS.md`) · ❓ unknown

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
- Read RPC: ⚠️ C-04 (chat says `api.koinos.io`; `app.js`, `swap.js`, `header-wallet.js` hard-code `koinos.armana.io`)
- Chain reads queued 4 at a time — 💬
- Service worker never caches game or race data; strict CSP: no inline scripts or handlers, only pinned CDN scripts, content built with `textContent` only — 💬 Race chat

### Wallets
- **Kondor** (kondor-js 1.3.0, always loaded from CDN) — 💬
  - `window.kondor` always exists, so its presence proves nothing.
  - `getAccounts()` always opens Kondor's account-picker window (multi-select; auto-selects a single account). Cancel throws `"getAccounts cancelled"`; closing the window throws a "Connection lost"-style error.
  - Detect the extension silently with `kondor.provider.getChainId()`; no answer in ~4 s = not installed.
- **KOIN Vault** — chooses its own payer, so it cannot use the Mana sponsor — 💬
- **Guest** — see `guest.js` above.

### Smart Contracts
See `PLATFORM.md` → Core Components for addresses and hashes.
| Contract | Version | Upgradable? | Timelock | Confidence |
|----------|---------|-------------|----------|-----------|
| Game / Vault | v6 (upgraded in place from v5) | yes — 48 h notice for any vault upgrade (D-024) | 48 h (`timelockLength 172800000`) | ✅ |
| Desk | v2 | {{TBD}} | 48 h | ✅ |
| Sponsor | v3 per repo / v2 per chat | {{TBD}} | {{TBD}} | ⚠️ C-01 |
| Race | {{TBD}} | {{TBD}} | {{TBD}} | ✅ address only |
| Picks | {{TBD}} | {{TBD}} | {{TBD}} | ✅ address only |

Game timing (✅ `game-data/deployment.json`): genesis 2026-10-19 00:00 UTC (`GENESIS` 1792368000000), weeks Monday to Monday UTC, week = floor((t − genesis) / 7 days), so vault week 0 = Mon 19 Oct and week 2 = Mon 2 Nov (💬 Hub, Race; see C-08), close delay 12 h, settle 24 h, min stake 1 VHP (`100000000`), max sponsored Mana per tx 2 (`maxSponsorRc 200000000`).

### Mana Sponsor
- Sponsor covers: game, VHP, KOIN, race, picks contracts — ✅ `game-data/deployment.json` (`sponsor.covers`)
- Site payer: `payer: "sponsor"`, guest flag on — ✅
- `rcLimit` (answers): 1 Mana — ✅ / 💬 agree
- `rcLimitOther` (stake, approve, etc.): ⚠️ C-05 (repo 1 Mana; chat 3 Mana)
- Per-action limit: picks `pick` 0.2 Mana — ✅ (`rcLimits`, `sponsor-data/mana-limits.json`)
- Answer-only transactions are sponsored for any wallet within the free sub-cap; everything else is for real players only and fails closed — 💬
- Caps (per tx / player-day / player-week / everyone-day / free-day): 1 / 25 / 150 / 5,000 / 2,000; sponsor ON, vault switch off — 💬 Block X, as of 30 Oct (C-02 resolved)
- **Vault switch (v3):** `config.game_has_vault`. While off, the sponsor never calls `get_game_player` and refuses vault calls with `VAULT_NOT_LIVE`. The tool reads `get_state` `config.v6_rule_week_plus_one` from two nodes. — 💬 Vault chat
- **Caution:** a plain `config` resets the caps to defaults, so always pass the current caps. — 💬 Vault chat
- **Sponsor tool rules** (💬 Block X): `capsOf` keeps 0; `tighterCaps` takes the lowest of both nodes and the default; `allowedBuilds` mainnet [v3, v2]; `codeOn` checks two nodes; the SP-50 swap check runs only on v3; `mana-limit --limit X` needs X ≥ 1.25 × the observed most and ≤ the per-tx cap; `TESTNET_PICKS` / `TESTNET_PICKS_CARDS=yes` are testnet only.
- Sponsor v3 allows every vault player call, `move_stake` included. Per-action caps must be above 0, so blocking moves on chain would need a tiny cap (I-021). — 💬 Hub

### Bots / Automation
| Bot / workflow | Trigger / schedule | What it does | Location | Confidence |
|----------------|--------------------|--------------|----------|-----------|
| Main bot | hourly GitHub Action | posts results, seals, finalizes 24 h after the seal, looks back 12 closed weeks; skips posting/closing/finalizing in safe mode; `pagePlayers()` stops on a repeated address; `upgradeGuard()` refuses a normal upgrade matching the safe build. Uses `koinos.armana.io`, `api.koinosblocks.com` as `RPC_CHECK` | `bot/bot.ts`, `bot/vault.ts`, `bot/chain.ts`, `.github/workflows/bot.yml` | files ✅, rest 💬 |
| Race recorder | hourly at minute 37 while `RACE_ENABLED=true` | Job `record` (read-only token, no secrets, runs repo code); job `publish` (write token, runs no repo code, shape-checks every file with embedded Python, pushes only to `race-data`). Only irreversible blocks count; blocks, picks and stakes must match on two nodes (`RPC`, `RPC_CHECK`). Files: `index.json`, `W<NNN>.json`, `board.json`, `vault/W<week>.json`. Fails if last run's files can't be read (fresh start only when the branch is missing). Refuses a `final` vault file before the week ends and any change to a final file. Fails closed (no final file) on missing ABI/contract, empty `get_state`, failed stake reads or node disagreement | `bot/race.ts`, `.github/workflows/race.yml`, shared rules in `race-math.js` | 💬 Race chat |
| Block X recorder | {{TBD}} | `canonicalTransferValue` / `NonCanonicalTransfer`; a target is voided at once only if both nodes report it, otherwise held and voided at the 3-day edge; reads short receipt pages on (BX-90); no vault file past its 3-day window (BX-92); reads only top-level `W###.json` race cards (`vault/` invisible to it) | `bot/games/blockx.ts`, `.github/workflows/games.yml` | 💬 Block X |
| Names bot | hourly | Jobs: check (read-only), publish (no repo code), reply; gated by `vars.NAMES_ENABLED`; scheduled only, never triggered by issues. 8 s read timeout (a node that times out is skipped for the run), 7-minute run deadline. Nicknames read 20 at a time within 240 s, named wallets and producers first; both nodes must agree; a failed read keeps the old value. Pool names from Fogata `get_pool_params` (entry 2396056273, field 1). `names.json` kept under 900 kB (publish limit 1 MB). Owner command: `npm run names -- remove <address>` | `bot/names.ts`, `.github/workflows/names.yml` ✅ | 💬 Hub |
| Bot `--testnet` | manual | targets the local Harbinger node (`127.0.0.1:8081`, `.env.testnet`, `testnet-data/`) — **not** the Koinos Foundation copy | `bot/bot.ts` | 💬 |
| Sponsor tool | manual | L-4 fix, default free cap 300 (⚠️ C-02), keeps guest flag, status shows VHP | `bot/sponsor.ts` | ⚠️ |
| Self-heal | every 20 min | repairs a crash-looping node via `node/repair-node-data.ps1` | `bot/heal.mjs` | file ✅, schedule 💬 |
| Other workflows | {{TBD}} | {{TBD}} | `.github/workflows/` (15 files) | ✅ list |

Node scripts present (✅): `node/repair-node-data.ps1`, `node/move-node-to-volume.ps1`; `node/repair-desk-data.ps1` removed.

### Data
- On-chain state: {{TBD}}
- Off-chain: `game-data/`, `desk-data/` (has `v1UploadTx` ✅), `sponsor-data/`, `race-data/`, `picks-data/`, `games.json` — ✅
- Vault results: `W${week}.json` (unpadded) from each game's `vaultGames` source — ✅ sources on `main`; naming 💬. Branch `games-data` holds folders blockx, survivor, fantasy, combo, bracket, lastnode, golf — 💬
- Race: `race.yml` holds back a vault `W<week>.json` that fails `vault_ok`, with a warning; a final vault file can never change — 💬
- Race pick row: `[player, horse, time, won 0/1, 0, show 0/1]` (field 5 always 0 now; pre-Show picks back-filled). `board.json` rows: `{a, pts, correct, shows, picks, ranked, boardPlace, earns}` — `ranked` = on the Staked board; `boardPlace` shared by ties (1, 1, 3…); `earns` 1/2 = free-prize place, 3 = staked bucket share, 0 = nothing (nonzero only on This week / Last week) — 💬 Race chat
- Vault results file format and the stake test: see `standards/VAULT_STANDARD.md`

### Infrastructure
- Nodes: 3 on the owner's PC, Docker volumes — 💬 (details in `PLATFORM.md`)
- Old basedir folders kept until 2026-11-04 — 💬

## Vault v6 (the game contract) — 💬 Vault chat unless marked
- **Builds:** live `eed38f7c…` (86,114 bytes) ✅; emergency withdrawals-only `e84fec49…` (84,688 bytes) ✅ `safeWasmSha256`, built with `npm run build:safe`, which flips `SAFE_MODE` in `game/assembly/Mode.ts`.
- **Safe mode:** 14 entry points refused. Result recording stays open (settle, resolve/correct questions, `post_results`, `post_prize_winners`, seal, correct, void). `advance()` does nothing, `sponsorOk` is false, `get_state.safe_mode` (field 12) is true.
- **Accounting:** u128 liabilities, checked subtraction `less()`; the seed takes the first loss (`seedFree`).
- **Per-week claim caps:** game week `(rolled_over ? 0 : bucket) + prize_first·first_n + prize_second·second_n`; question week `rolled_over ? pot_free : pot`.
- **Results timing (other games):** due 3/7 of a week after the week ends (`RESULTS_DAYS = 3`, 3 days on mainnet). Finalize starts after `seal + 2·close_delay` and `last_change + close_delay`. Corrections and voids are refused once finalizing starts.
- **Registry:** up to 12 games besides game 1. `propose_game`, then `apply_game` after the timelock (48 h mainnet) and within 7 days. A game applied in week W earns from W+1. `deactivate_game`: earns through the current week; stake stays withdrawable. Restart before the last earning week ends keeps the game running but can't change season length; restart after a gap needs `weeks_closed >= last_week_plus_one`.
- **Closing:** `advance()` closes one week and does one finalize step per call; `close_week` is open to anyone; a deposit, claim or move triggers `advance`.
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

### Measured on testnet (see `docs/TESTNET-V6-RESULTS.md`)
Heaviest player call 4.63 M ticks (a deposit closing a 13-game week, 1.6% of the per-transaction limit); 16-row post 1.50 M; finalize of 16 places 1.75 M; claim 2.44 M; withdraw 1.72 M; upload disk 86,257 B. Upper bounds: 50 rows ≈ 4.7 M ticks; 500-place finalize ≈ 55 M (19%). v6 upload cost 46.84 KOIN of Mana on mainnet vs 7.53 on testnet.
Mana cost per call = ticks × compute price + disk bytes × disk price + network bytes × network price.

### Hub pages
- Stake panel: `stake-panel.js`, `stake-page.js`, `stake-testnet*.js`, `stake.html`, `stake-testnet.html` (PRs #32, #33, #35, #41, #42, #46 ✅); matches the v6 ABI field for field (script-checked). — files ✅, rest 💬
  - `KStake` API: `mount(el, {game})` (Stake = approve + `deposit_to`; Withdraw always offered; Move; Claim), `mountList`, `badge(el, {game})` ("Staked · X VHP / Playing free" bar), `status`, `overview(who)`, `send(action, a)` (up to 10 claims per transaction), `sayError`.
  - After any action it fires `kstake:changed`; only the latest refresh renders (generation counter). `per100()` uses the vault's `weightFor` until a week's weight is saved. Claims follow the vault's `claimableG` / `rewardOfG` and look back 52 weeks, including weeks before a restart. `claimable()`: 2nd place gets `prize_second` as is; 0 when 1st is tied. Busy-Mana (code 104) says "wait a minute and try again". On a `kg-network=testnet` page it uses `testnet/vault.json` and `KTestStakeWallet`.
  - `stake.html` (staking hub): summary (staked, in wallet, rewards); Games tab with one card per game (your stake, game total, share % and bar, status chip); inline Stake / Withdraw / Move forms with quick amounts (1/10/100/Max; 25%/50%/All); Rewards tab with Claim all; `#g<id>` opens that game's Stake form; wallet set up with the sponsor.
  - `stake-testnet.html`: public, noindex; `stake-testnet-wallet.js` signs only the 4 vault player calls on the test vault plus an approve right before `deposit_to`; refuses mainnet; signed operations must equal the built ones; Mana capped at 0.5 per transaction.
  - `race.html`: `#stake-badge` at the top of `<main>` (✅), `#stake` panel lower; the Games page links to `race.html#stake`, so that id must stay.
- Admin page: `admin/actions.ts`, `admin/server.ts`, `admin/index.html` (PR #43 ✅ merged into `picks`); mainnet "Knode Vault (v6)" buttons match the bot's commands. — 💬
  - Start on the owner's PC: in `C:\kprediction`, `git checkout picks`, `git pull`, `npm ci`, `npm run admin`; opens a local link with a one-time key. Docs: `docs/ADMIN.md` (on `picks` ✅).
  - Tools: bot, desk, sponsor, picks, racepicks, names. Vault area: Sunday upgrade steps (status, apply, clear); Add a game (with season field); post / seal / finalize; correct / unprize / void; collect the 5% VHP fee. Also Wallet names, and "Vault v6 trial (local node)" (`--testnet` reaches only the local Harbinger node).
  - The vault buttons answer "Unknown command" until `vault-v6` is merged into `picks` (I-019).

### Publish checks (`games.yml`, `games-testnet.yml`, `race.yml`, `race-samples.yml`) — 💬 Block X
Recorders are JavaScript writing `JSON.stringify(x)+"\n"`; publish checks are Python. Every publish job:
1. `find` refusals: symlinks, unexpected files or folders, files over 2 MB (`race.yml` allows only `$IN/vault` and `vault/W[0-9]{1,4}.json`).
2. An inline `node -e` check: raw bytes must equal `JSON.stringify(JSON.parse(text))+"\n"` (regular files only, path after `--`, walks subfolders).
3. Python checks: `js_safe` (numbers within ±2^53−1, finite, no integer-valued floats, depth ≤ 64); type-strict `isaddr`, `one()`, `same()`; ASCII `[0-9]` only, never `\d` (a guard test enforces this, including `python3 -c` / `python3 -I -c` one-liners).
4. `setup-node` 22, SHA-pinned.
- **Append-only history:** a published card never changes (BX-44); index weeks are append-only, a new week only for cw−1..cw (race: cw−1..cw+1); W targets only for the current or just-ended week, never after P is published; height = round × 2400 + 0, its time ≤ now and inside the week. A run that rewrites history is held whole.
- **`race.yml` record job:** `git ls-remote --exit-code refs/heads/race-data` (exit 2 = first run; any other error stops); `ls-tree -r -z` into a file, then a `read -d ''` loop; fetches W / index / board / `vault/`, plus `race-samples`.
- **`race.ts`:** samples and cards take the lower of the two nodes' reads; `topInDoubt` re-runs the floor with 0.5% tolerance; supply cap, clock check (BX-89), early check-head (BX-114), lag bound (BX-101). Boards rank by vault stake (`stakedOf`); the old "holds 1 VHP" read (`rawRead`) was removed. `readStaked` still loads `GAME_ABI` = v5 (`game/abi/kpred.koilib.json`) ✅ on `main` and `picks`, so stake reads throw "still v5" (I-033).

### Picks contract — 💬 Block X
- **Upgrade path:** owner `schedule_upgrade(sha256)` → 48 h → owner-signed upload within 7 days → `schedule_upgrade` with an empty hash. The three overrides stay on.
- **Site:** `blockx-math.js` `MAINNET_GAME = {id:2, round:2400, offset:0, lead:100, ahead:28900, picksPerDay:30, maxChanges:1}` ✅; `wallet.js` `PINNED_PICKS = ""` ✅, set at publish; `blockx.html` calls `KStake.badge(…, {game: 2})` in `setupStake`, mainnet only; the Block X testnet page uses `testnet-wallet.js`.

### CI guards — 💬 Hub
- `tests/audit/site.ci-deps.test.mjs` (run by `workflow-guard.yml` ✅): bans issue triggers, `write-all`, `secrets: inherit` and `toJSON(secrets)` in any case; issue permissions only in `names.yml`. Regex-based (I-022).
- `bot/workflow.test.ts`: no `${{ }}` inside run scripts; no job output named `run`.

## Stack & Tooling — 💬 Vault chat
- AssemblyScript (`@koinos/sdk-as` 1.5.1), as-pect with MockVM, koilib 9.4.1, protoc 21.12 (pinned and checksummed by `tools/protoc-pin.cjs`), Node 22, tsx.
- `tools/mockvm-bytewise.cjs`: patches MockVM so keys order bytewise (`BytewiseMap`, `getNextObject`/`getPrevObject`, copy on `putObject`); the real chain orders bytewise (audit V2-14).
- `npm run bot -- testnet-v6`: one-command testnet check → `testnet-v6/report.md`.
- `bot/rehearse-v6.ts`: rehearsal on a snapshot (`vault-snapshot`, then `rehearse-v6`).
- `tools/mode-switch.cjs`: one shared parser for `Mode.ts`.
- `npm run picks` (💬 Block X): keys, build-testnet, status, upload, announce, apply, pause, lock-test, mana-test; on branch `combo` only: upgrade-schedule, upgrade-upload, upgrade-clear. `npm run sponsor`: status, upload, config, enable, disable, mana-report, mana-limit, site-limits, watch, payer. All dry runs by default; mainnet needs `--send --mainnet`.
- Tests (💬 Block X, as of 30 Oct): `npm run test:audit` — 644 tests, 634 pass, 0 fail, 5 todo, 5 skipped (pwsh-only); also `test:audit:serial`, `test:resolver`, `cd sponsor && npm test`.

## Repository Layout
{{TBD: full folder map}} — top level includes site files at root, `bot/`, `game/`, `desk/`, `sponsor/`, `race/`, `picks/`, `node/`, `tests/`, `docs/`, `*-data/` (✅).

## Security Boundaries
- Keys live only in `.env` on the owner's PC; never pasted in chat — 💬 (D-003)
- GitHub: only `OPERATOR_WIF` stored, in environment `bot`; the main workflow uses it — 💬
- Branch ruleset: restrict deletions, block force pushes; no PR requirement (it would block the bot) — 💬
- Mainnet sends need `CONFIRM_MAINNET=yes`; commands are dry runs unless `--send` — 💬 (D-004)
- Audit process: {{TBD}}
- Tests: `node --import tsx --test --test-concurrency=1 tests/audit/*.test.ts tests/audit/*.test.mjs` — last reported 531 pass / 0 fail / 3 TODO (💬, not re-run; `tests/audit/` has 110 files ✅)

## Known Constraints
- Hosting must cost $0 — 💬
- Armana caused browser CORS failures (likely burst rate limits) — 💬 Questions chat. RPC endpoints: `KOINOS.md`
- `api.koinos.io` returns HTML error pages intermittently; override with `$env:RPC = "https://koinos.armana.io"` where a `deployment.json` still names it — 💬 Vault chat (⚠️ C-04)
- The proxy used by AI chats blocks GitHub branch deletion and log downloads (403); owner does those in the GitHub UI — 💬
