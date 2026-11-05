# Knode Games — Repo Map, Funds Risk and Structure Plan

> **Purpose:** what every top-level part of the repo is, **how much it could cost if it were wrong**, how it is checked, and the plan to make the layout clean for the public. Read this before asking "is every line safe?".
> **Last updated:** 2026-11-05 (first written; 617 tracked files, 84 of them at the root)
> **Rule:** a new top-level folder or root file is added here in the same PR.

## 1. The honest answer: how we know the code is safe
No one can prove every line of 617 files is bug-free. What protects funds is **layers**, so a bug in most files can't lose money:

1. **Only the vault holds stakes** (D-003, D-016). Players' VHP sits in one contract; every stake is always withdrawable, and a **withdrawals-only build** is ready (D-021). The Mana sponsor holds KOIN for fees, and the Swap Desk holds KOIN for swaps; nothing else holds tokens.
2. **So the money-critical code is small:** five contracts (§2, tier 1), the keys that control them, and the bot code that posts weekly results (tier 2). Everything else (pages, recorders, tools, docs) can show a wrong number or stop a week, but **can't move tokens**.
3. **Every contract change** is audited by Repo Lens on the exact build, fix-checked to GO, announced 48 h ahead on chain, then uploaded, with the hash checked against the audited build (`AUDITS.md`).
4. **Payout safety nets** (tier 2): results are re-checked on two nodes, published as pending on the Sunday review day, held on any mismatch, and correctable 24 h after the seal; the vault bot refuses a results file that disagrees with `board.json` (`standards/RECORDER_STANDARD.md`, `VAULT_STANDARD.md`).
5. **Keys:** never in the repo or chats; mainnet sends need `--send` **and** `CONFIRM_MAINNET=yes` (D-004); the owner role moves to a cold key on Tue 10 Nov (D-096). `KEYS_AND_ROLES.md`.
6. **The CI guard** stops workflows from gaining write access or secrets they shouldn't have (`tests/audit/site.ci-deps.test.mjs`, #99, #111).
7. **Still to do for full confidence:** the full platform audit, once the core is done (D-014, D-102, I-002), tier 1 first, then tier 2, with the commit of every live contract listed in §3.

## 2. The map

| Part | What it is | Tier | Can it lose funds? |
|---|---|---|---|
| `game/` | The vault contract (stakes, rewards, Daily Questions) | **1** | **Yes**: holds every stake |
| `desk/` | Knode Swap contract (VHP → KOIN, 3% fee) | **1** | Yes: holds swap KOIN |
| `sponsor/` | Mana sponsor contract (pays players' fees within caps) | **1** | Yes: holds 25,000 KOIN |
| `picks/` | Picks contract (records picks, enforces locks) | **1** | No tokens; a bug could change who wins |
| `race/` | Race picks contract | **1** | No tokens; same as Picks |
| `bot/` | Hourly bot: questions, results, posting and sealing vault weeks; the owner's tools | **2** | Indirectly: wrong results → wrong payouts (held by the checks in §1.4) |
| `.github/workflows/` | The bot, recorders, tests (GitHub Actions) | **2** | Indirectly: a workflow with write access could change results |
| `game-data/`, `*-data/`, `testnet/` | Public game files and deployment records | **2** | Records only; contracts don't read them |
| `node/` | Scripts for the owner's Koinos nodes (self-heal, repair) | **3** | No (block production uptime only) |
| Root `*.html`, `*.js`, `*.css`, `media/`, `ads/`, `games.json`, `sw.js`, `manifest.webmanifest` | The website (GitHub Pages) | **3** | Only by tricking a player into signing; transactions are built in one place (`stake-panel.js`, `wallet.js`) and checked by site tests |
| `generator.ts`, `resolver.ts`, `common.ts`, `backtest.ts`, `export-blocks.ts`, `data/` | Build and score Daily Questions | **2** | Indirectly (question answers) |
| `vhp-ruler.js`, `vhp-data.js`, `vhp_ruler.py`, `sims/` | The shared VHP ruler and its simulations | **2** | Not yet: pays nothing until all 11 simulations pass (D-111) |
| `tools/` | Build and site helpers | **3** | No |
| `tests/` | 155 security and regression tests from the reviews | — | Protects the rest |
| `admin/` | Local admin page (inert on the public site) | **3** | No |
| `site/` | Redirects from old `/site/…` links only | **3** | No |
| `docs/` | Runbooks for the code (upgrades, wallets, Block X) | — | No |
| `.ai/` | This library | — | No |

**Tier 1** = holds or controls tokens: always audited, timelocked upgrades. **Tier 2** = decides who gets paid: audited when changed, guarded by holds and two-node checks. **Tier 3** = can confuse or inconvenience, never move tokens.

## 3. Audit coverage of the live contracts
| Contract | Live build | Last review | Status |
|---|---|---|---|
| Vault v6 `1Mpmf2…` | v6 (2 Nov) | Vault v6 audit + fix-checks 1–4 (29 Oct) | ✅ live; **v6.1** (`11043e1f…`) Repo Lens #E-16 GO, upload Mon 9 |
| Mana sponsor v3 `1ByDDSB…` | `b84e1add…` | sponsor v3 audit (27 Oct) + guest-fix #C-3 GO | ✅ |
| Picks `1LmgqB…` | 30 Oct | Picks audit + fix-check (27 Oct) | ✅ |
| Race picks `1EN7xU…` | — | Race picks audit (27 Oct) | ✅ |
| Swap Desk v2 `1FKTpX…` | v2 | the v5/Desk v2 audit (Oct) | ✅ (Desk re-check in the full audit) |

Reports are private in the Claude project (`claude/repo-history/`, `claude/<area>/`). The full platform audit (§1.7) re-checks each against its exact live hash.

## 4. Structure plan (to a clean public layout, nothing breaks)
The root holds 84 files because GitHub Pages serves the repo root. The fix is to publish the site from a build step, then tidy:

| Step | What | Who | Safe because |
|---|---|---|---|
| 1 | **Pages allow-list deploy** (`pages.yml` publishes only the site files) | Hub chat, R-HUB-14 | page URLs unchanged; undo = one setting |
| 2 | **Move the website into `web/`** (all root `*.html` / `*.js` / `*.css`, `media/`, `ads/`, `games.json`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `CNAME`); the deploy copies `web/` to the site root | Hub chat, R-HUB-16 (after step 1) | URLs unchanged; site tests updated in the same PR |
| 3 | **Move the Questions builder** (`generator.ts`, `resolver.ts`, `common.ts`, `backtest.ts`, `export-blocks.ts`, `resolver.test.ts`) into `questions/` | Questions + Vault chats, R-Q-6 | bot imports and workflows updated in the same PR; tests prove it |
| 4 | **Ruler files** (`vhp-ruler.js`, `vhp-data.js`, `vhp_ruler.py`, `sims/`) into `ruler/` (the deploy copies the browser files) | Ruler chat, with R-RULER-2 | same |
| 5 | **Retire `site/` redirects** after 30 days of no traffic, and `LAUNCH.md` into `docs/` (tests read it: update them in the same PR) | Hub, library | owner OK first |

After steps 1–4 the root holds only: `README.md`, `LICENSE`, `SECURITY.md`, `package.json`, `package-lock.json`, `.gitignore`, `.gitattributes`, and the folders above.
