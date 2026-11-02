# Knode Games — Architecture

> Purpose: How the pieces fit together. Describe, don't prescribe.
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions and Vault chats), checked against branch `picks` and GitHub `main` on 2026-11-02.

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
| `wallet.js` (KWallet) | Kondor, KOIN Vault, Guest. `localStorage` holds only public data: `kw-accounts` (`{kind, address}` list), `kw-active`, `kw-kind` — never keys | 💬 (file exists ✅) |
| `header-wallet.js` | shared header wallet menu; reuses `#connect` inside `.top-row`; list / switch / add / forget / disconnect | 💬 (file exists ✅) |
| `guest.js` | play-only browser key (IndexedDB first, `localStorage` fallback), pinned to the sponsor and game, never holds funds | 💬 (file exists ✅) |
| `sw.js` | network-first shell cache `knode-shell-v7`; site changes need no cache bump | ✅ |
| `app.js` | questions game UI; `legacyLabelsOk` rebuilds labels for pre-hashRule-2 questions; per-week question numbers; welcome page is landing; precise Mana errors | ✅ `legacyLabelsOk` present; rest 💬 |
| `swap.js` | swap page; skips its own `#connect` handler when the header menu owns the button (`aria-haspopup="menu"`) | 💬 |

- Hosting: GitHub Pages from repo root, custom domain via `CNAME` — ✅
- Read RPC: ⚠️ C-04 (chat says `api.koinos.io`; `app.js`, `swap.js`, `header-wallet.js` hard-code `koinos.armana.io`)
- Chain reads queued 4 at a time — 💬

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

Game timing (✅ `game-data/deployment.json`): genesis 2026-10-19 00:00 UTC, 7-day weeks, close delay 12 h, settle 24 h, min stake 1 VHP (`100000000`), max sponsored Mana per tx 2 (`maxSponsorRc 200000000`).

### Mana Sponsor
- Sponsor covers: game, VHP, KOIN, race, picks contracts — ✅ `game-data/deployment.json` (`sponsor.covers`)
- Site payer: `payer: "sponsor"`, guest flag on — ✅
- `rcLimit` (answers): 1 Mana — ✅ / 💬 agree
- `rcLimitOther` (stake, approve, etc.): ⚠️ C-05 (repo 1 Mana; chat 3 Mana)
- Per-action limit: picks `pick` 0.2 Mana — ✅ (`rcLimits`, `sponsor-data/mana-limits.json`)
- Answer-only transactions are sponsored for any wallet within the free sub-cap; everything else is for real players only and fails closed — 💬
- Caps (per tx / player-day / player-week / everyone-day / free-day): ⚠️ C-02
- **Vault switch (v3):** `config.game_has_vault`. While off, the sponsor never calls `get_game_player` and refuses vault calls with `VAULT_NOT_LIVE`. The tool reads `get_state` `config.v6_rule_week_plus_one` from two nodes. — 💬 Vault chat
- **Caution:** a plain `config` resets the caps to defaults, so always pass the current caps. — 💬 Vault chat

### Bots / Automation
| Bot / workflow | Trigger / schedule | What it does | Location | Confidence |
|----------------|--------------------|--------------|----------|-----------|
| Main bot | hourly GitHub Action | posts results, seals, finalizes 24 h after the seal, looks back 12 closed weeks; skips posting/closing/finalizing in safe mode; `pagePlayers()` stops on a repeated address; `upgradeGuard()` refuses a normal upgrade matching the safe build. Uses `koinos.armana.io`, `api.koinosblocks.com` as `RPC_CHECK` | `bot/bot.ts`, `bot/vault.ts`, `bot/chain.ts`, `.github/workflows/bot.yml` | files ✅, rest 💬 |
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
| Reads | `get_game_player` 0x0feb472b · `get_player` 0x37ce3085 · `get_state` 0x3d02a349 · `list_games` 0x02efa793 · `get_game` 0x6f8d72cf |
| Token | `approve` 0x74e21680 · `balance_of` 0x5c721497 |

### Measured on testnet (see `docs/TESTNET-V6-RESULTS.md`)
Heaviest player call 4.63 M ticks (a deposit closing a 13-game week, 1.6% of the per-transaction limit); 16-row post 1.50 M; finalize of 16 places 1.75 M; claim 2.44 M; withdraw 1.72 M; upload disk 86,257 B. Upper bounds: 50 rows ≈ 4.7 M ticks; 500-place finalize ≈ 55 M (19%). v6 upload cost 46.84 KOIN of Mana on mainnet vs 7.53 on testnet.
Mana cost per call = ticks × compute price + disk bytes × disk price + network bytes × network price.

### Hub pages
- Stake panel: `stake-panel.js`, `stake-page.js`, `stake-testnet*.js`, `stake.html`, `stake-testnet.html` (PRs #41, #42); matches the v6 ABI field for field (script-checked). — files ✅, rest 💬
- Admin page: `admin/actions.ts` (PR #43 into `picks`); mainnet "Knode Vault (v6)" buttons match the bot's commands. — 💬

## Stack & Tooling — 💬 Vault chat
- AssemblyScript (`@koinos/sdk-as` 1.5.1), as-pect with MockVM, koilib 9.4.1, protoc 21.12 (pinned and checksummed by `tools/protoc-pin.cjs`), Node 22, tsx.
- `tools/mockvm-bytewise.cjs`: patches MockVM so keys order bytewise (`BytewiseMap`, `getNextObject`/`getPrevObject`, copy on `putObject`); the real chain orders bytewise (audit V2-14).
- `npm run bot -- testnet-v6`: one-command testnet check → `testnet-v6/report.md`.
- `bot/rehearse-v6.ts`: rehearsal on a snapshot (`vault-snapshot`, then `rehearse-v6`).
- `tools/mode-switch.cjs`: one shared parser for `Mode.ts`.

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
- Armana caused browser CORS failures (likely burst rate limits) — 💬 Questions chat
- `api.koinos.io` returns HTML error pages intermittently; override with `$env:RPC = "https://koinos.armana.io"` where a `deployment.json` still names it — 💬 Vault chat (⚠️ C-04)
- The proxy used by AI chats blocks GitHub branch deletion and log downloads (403); owner does those in the GitHub UI — 💬
