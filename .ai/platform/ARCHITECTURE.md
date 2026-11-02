# Knode Games — Architecture

> Purpose: How the pieces fit together. Describe, don't prescribe.
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions chat), checked against branch `picks` on 2026-11-02.

**Legend:** ✅ verified in repo · 💬 chat only · ⚠️ conflict (see `DECISIONS.md`) · ❓ unknown

## System Diagram
```
Player browser (knodegames.com, GitHub Pages)
   │  wallet.js: Kondor / KOIN Vault / Guest
   ▼
Koinos RPC (read) ──────────────► Koinos mainnet contracts
   │                                game v5 · desk v2 · race · picks · sponsor · vault ❓
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
| Game (questions) | v5 | {{TBD}} | 48 h (`timelockLength 172800000`) | ✅ |
| Desk | v2 | {{TBD}} | 48 h | ✅ |
| Sponsor | v3 per repo / v2 per chat | {{TBD}} | {{TBD}} | ⚠️ C-01 |
| Race | {{TBD}} | {{TBD}} | {{TBD}} | ✅ address only |
| Picks | {{TBD}} | {{TBD}} | {{TBD}} | ✅ address only |
| Vault | v6 ❓ | {{TBD}} | {{TBD}} | ⚠️ C-09 |

Game timing (✅ `game-data/deployment.json`): genesis 2026-10-19 00:00 UTC, 7-day weeks, close delay 12 h, settle 24 h, min stake 1 VHP (`100000000`), max sponsored Mana per tx 2 (`maxSponsorRc 200000000`).

### Mana Sponsor
- Sponsor covers: game, VHP, KOIN, race, picks contracts — ✅ `game-data/deployment.json` (`sponsor.covers`)
- Site payer: `payer: "sponsor"`, guest flag on — ✅
- `rcLimit` (answers): 1 Mana — ✅ / 💬 agree
- `rcLimitOther` (stake, approve, etc.): ⚠️ C-05 (repo 1 Mana; chat 3 Mana)
- Per-action limit: picks `pick` 0.2 Mana — ✅ (`rcLimits`, `sponsor-data/mana-limits.json`)
- Answer-only transactions are sponsored for any wallet within the free sub-cap; everything else is for real players only and fails closed — 💬
- Caps (per tx / player-day / player-week / everyone-day / free-day): ⚠️ C-02

### Bots / Automation
| Bot / workflow | Trigger / schedule | What it does | Location | Confidence |
|----------------|--------------------|--------------|----------|-----------|
| Main bot | {{TBD}} | {{TBD}}; uses `koinos.armana.io`, `api.koinosblocks.com` as `RPC_CHECK` | `bot/bot.ts`, `.github/workflows/bot.yml` | files ✅, RPC 💬 |
| Sponsor tool | manual | L-4 fix, default free cap 300 (⚠️ C-02), keeps guest flag, status shows VHP | `bot/sponsor.ts` | ⚠️ |
| Self-heal | every 20 min | repairs a crash-looping node via `node/repair-node-data.ps1` | `bot/heal.mjs` | file ✅, schedule 💬 |
| Other workflows | {{TBD}} | {{TBD}} | `.github/workflows/` (15 files) | ✅ list |

Node scripts present (✅): `node/repair-node-data.ps1`, `node/move-node-to-volume.ps1`; `node/repair-desk-data.ps1` removed.

### Data
- On-chain state: {{TBD}}
- Off-chain: `game-data/`, `desk-data/` (has `v1UploadTx` ✅), `sponsor-data/`, `race-data/`, `picks-data/`, `games.json` — ✅

### Infrastructure
- Nodes: 3 on the owner's PC, Docker volumes — 💬 (details in `PLATFORM.md`)
- Old basedir folders kept until 2026-11-04 — 💬

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
- Armana caused browser CORS failures (likely burst rate limits) — 💬
- The proxy used by AI chats blocks GitHub branch deletion and log downloads (403); owner does those in the GitHub UI — 💬
