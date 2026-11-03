# Knode Games — Platform Overview

> **Purpose:** the one-page picture of what Knode Games is today: games, contracts, money, wallets, machines, branches and who owns what.
> **Last updated:** 2026-11-02 (consolidated)
> **Sources:** the 12 chat exports in `.ai/archive/CHAT_KNOWLEDGE.md`, the owner's answers on 2 Nov, and the repo (`main` and `picks`, checked 2 Nov).
> **Rule:** if this file disagrees with `DECISIONS.md`, `DECISIONS.md` wins (D-002).

**Legend:** ✅ verified in the repo · 💬 from a chat, not verified · 👤 owner said so · ⚠️ open contradiction (see `DECISIONS.md`) · ❓ unknown

## The library
| File | Holds |
|------|-------|
| `CURRENT_STATE.md` | dated snapshot: completed, in progress, blockers, priorities |
| `PLATFORM.md` | this overview |
| `ARCHITECTURE.md` | how the pieces work: site, contracts, bots, workflows, data, tests |
| `DEPENDENCIES.md` | how vault, leaderboards, rewards, swap desk, wallets, games and user accounts connect |
| `DECISIONS.md` | every decision (D-xxx) and every contradiction (C-xx) |
| `RULES.md` | fund-safety, vault, withdrawal, reward, architecture and Koinos rules; what never changes casually |
| `ROADMAP.md` | milestones and launch paths |
| `OPENISSUES.md` / `TODOS.md` | problems (I-xxx) and the owner's action list |
| `KOINOS.md` | chain facts, testnet, gotchas |
| `PRIORITIES.md` | what to work on next — P1 / P2 / P3 by the value it creates |
| `TECHNICAL_DEBT.md` | shortcuts, unfinished systems, temporary fixes and risks, ranked by severity |
| `DOCUMENTATION_GAPS.md` | what's missing, contradictory or incomplete in this library, ranked |
| `FOUNDER_INTENT.md` | why the founder built it: why Koinos, why VHP, principles, success and failure |
| `VISION.md` | why, for whom, principles, brand |
| `../standards/` | rules every game and the vault must follow |
| `../archive/CHAT_KNOWLEDGE.md` | raw chat exports (an inbox, not a source of truth) |

## Summary
Knode Games runs free and staked prediction games on the Koinos blockchain, powered by its own block-producing nodes. Players pick producers, blocks and races; correct calls climb a weekly leaderboard for each game. All staked VHP sits in one vault that produces blocks. Each week's rewards, after a flat 5% fee, pay the free-game prizes (2 VHP for 1st, 1 VHP for 2nd) and are split across the staked games by each game's share of the stake. Funds safety comes first: only the vault holds tokens, and stakes are always withdrawable. 👤

## Live
| Item | Value | |
|------|-------|-|
| Website | https://knodegames.com — GitHub Pages, served from the repo root | ✅ `CNAME` |
| Domain & DNS | registered at Cloudflare; 4 A + 4 AAAA records on `@`, `www` CNAME → `bawcejawn.github.io`, all DNS-only (grey cloud) | 💬 |
| Repository | `github.com/bawcejawn/KnodeGames` (old names `Knode`, `kprediction` redirect); kept **public** so Actions and Pages stay free (D-043) | ✅ |
| Network | Koinos mainnet (chain facts: `KOINOS.md`) | ✅ |
| Live on the site | Daily Questions, Producer Race, the swap desk, the staking hub (`stake.html`), status bars, the @name page (`names.html`) | ✅ `games.json` / 💬 |

## Games
Vault ids and results sources: ✅ `game-data/deployment.json` → `vaultGames` on `main`. Every game is stakeable (D-018). **Free-play prizes on every free game — Questions, Block X, Survivor, Race, Bracket: 2 VHP for 1st, 1 VHP for 2nd, starting when the vault starts** (D-062); Fantasy and Last Node pay stakers only (D-071); **Combo, Golf and Survivor have no free play at all for now** (D-080); free play opens everywhere with a bigger seed. Nothing is announced to players until it's built, audited and ready (D-064).

| Id | Game | Play | Rules | Status (2 Nov) | Code |
|----|------|------|-------|----------------|------|
| 1 | Daily Questions | Staked + Free | D-045, D-047, D-062 | live; built into the vault | `main` |
| 2 | Who Signs Block X | Staked + Free | D-036 – D-041, D-070 | **applied on the Picks contract** (2 Nov 👤); not announced to players (D-064); launches prize-free first; next: round-12 fix-check, launch PR, vault `game-add 2` | `picks` |
| 3 | Survivor | **Staked only** (D-080 — free play paused until a bigger seed); 2-week seasons | D-051, D-065, D-080 | Season 1 **Mon 16 Nov** (D-065); audit pass 4, testnet season, Picks registration still to do (I-050); register **without `--free`** | `survivor` @ `a8a1979` ✅ |
| 4 | Fantasy Producers | Staked only (D-071) | D-059 | fix-check, full test week, real-data simulation to do | `fantasy` @ `2bee805` ✅ |
| 5 | Weekly Rival | records only, no prize; not a vault game ✅ | D-059 | ships with Fantasy | `fantasy` |
| 6 | Block Golf | Staked only (D-071); free practice weeks, no prize | D-056 | practice with Block X; staked after `game-add 6` | `golf` @ `6b2200a` ✅ |
| 7 | Producer Race | Staked + Free | D-033 – D-035 | live as a game; vault `game-add 7` pending | `main` |
| 8 | Combo Card | Staked only (D-071) | D-060 | fix-check 4; needs the Picks v2 upgrade after Block X | `combo` @ `c8c652e` ✅ |
| 9 | Producer Bracket | Staked + Free, 1-week seasons | D-019, D-057 | audit not yet run | `kg-09-bracket` @ `ee676ea` ✅ |
| 13 | Last Node Standing | Staked only (D-071) | D-054, D-055 | round-3 review; needs 48 h of sampler data (I-059) | `lastnode` @ `adf95be` ✅ |

Full per-game documentation: `.ai/games/` (Questions, ProducerRace, BlockX, Survivor, FantasyProducers, BlockGolf, ComboCard, ProducerBracket, LastNodeStanding). Ids 10–12 are unused. All unlaunched branches are pushed, not merged, and nothing from them is deployed ✅. Launch paths per game: `ROADMAP.md`. Readiness gaps: I-065.

## Contracts (Koinos mainnet)
| Contract | Address | Code | State | |
|----------|---------|------|-------|-|
| Game / **Vault v6** (game 1 built in) — also the **Knode Games Pool** producer (D-073) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `eed38f7c…` (was v5 `c17066ae…`) | live, upgraded in place 2026-11-02 02:29 UTC | ✅ |
| Vault emergency build | — | `e84fec49…` (withdrawals only) | standby, not deployed (D-021) | ✅ |
| Mana sponsor v3 | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | `b61ac238…` (v2 `fa4659e6…` kept as rollback) | live; vault switch still off | ✅ `picks` record (`main`'s record stale, I-043) |
| Picks | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a…` (v2 `92d555d0…` planned for Combo) | uploaded 2026-10-30; only an owner-approved upgrade is accepted | ✅ |
| Race picks | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f212…` | uploaded 2026-10-27 | ✅ |
| Swap Desk v2 | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506cc…` | live since 2026-10-28 | ✅ |

## Money
- **Platform fee:** a flat 5% of gross rewards, collected with `claim-fee-vhp all` (rules: D-029, `standards/VAULT_STANDARD.md`).
- **Free-play prizes:** 2 VHP 1st, 1 VHP 2nd on every free game, from the vault's start (D-062). Nothing is paid for weeks before that (D-063).
- **Staked rewards:** split across staked games by each game's share of stake; each game ranks its own stakers (per-game rules in DECISIONS).
- **Mana sponsor:** 25,000 KOIN in the wallet; 5,000 Mana a day for everyone; 25 a day and 150 a week per wallet; 1 per transaction; 2,000 a day for free players (D-061, D-028). It pays stake, withdraw, claim and plays — never `move_stake` (D-027). Mana Station is shelved (D-053).
- **Swap desk:** VHP → KOIN at a flat 3% fee, no daily payout cap (D-007, D-044); liquidity ~1,050 KOIN on 2 Nov 💬.
- **No Knode Games token** for now (D-072).
- **Running costs:** $0 hosting (D-005); domain ~$10–20 a year 💬.
- **Snapshots** 💬 (dated, will go stale):
  - 2 Nov, at the v6 upload: vault holdings 21,120.07528353; seed 21,050 VHP.
  - 28 Oct, game v5: VHP 21,622 + KOIN 546.6 held vs 22,151.7 owed (stakes 21,011; seed 1,050; fee 4.54; pots 86.17). Desk: 478.18 KOIN, 20,720 VHP producing; 2 swaps (3,001 VHP in, 2,910.97 KOIN out).

## Wallets (public addresses only — never keys)
| Role | Address | State | |
|------|---------|-------|-|
| Owner (game/vault, desk, Picks) | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | to move to a hardware wallet (I-001) | ✅ |
| Desk treasury | same as owner | to move to a cold treasury, 48 h timelock (I-001) | ✅ |
| Seed owner | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` | dedicated wallet since 30 Oct — done | ✅ |
| Operator (bot) | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` | rotated in 26 Oct; pays its own Mana, target 50 KOIN (D-046); balance unconfirmed (I-046) | ✅ |
| Mana sponsor | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | 25,000 KOIN (D-061) | ✅ / 👤 |
| Old operator (retired) | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` | key still in local `.env`; move its leftover KOIN, then remove the key (I-045) | 💬 |
| New owner (hardware) | ❓ | not created yet | |
| Cold treasury | ❓ | not created yet | |
| Producer public keys | desk `AzCYCDLD…`, game `Ak0vGklN…` | — | ✅ |

Procedure for moves: `docs/WALLETS.md` ✅.

## The owner's PC
- **Folders:** `C:\kprediction` (main checkout; keys in `.env`; scheduled tasks — always check the branch first) · `C:\kprediction-vault` (worktree on `vault-v6`, frozen, D-025) · `C:\kg-combo-preview` (Combo) · `C:\kprediction-test` (testnet and audits) · `C:\kprediction-fantasy` (Fantasy practice only). 💬
- **Nodes:** three mainnet nodes in Docker on Windows — desk `C:\kpred-desk-node`, game `C:\kpred-node`, personal `C:\koinos-personal` — and **no testnet nodes** (D-066). Volumes `<project>-basedir`. **Never delete `basedir\block_producer`: it holds `private.key`.** Ports are deliberately not written down (public repo). 💬 / 👤
- **Scheduled tasks:** "Knode self-heal" every 20 min; "Knode question release" 11:45–14:05 UTC every 5 min, stored in UTC (next run checked 2 Nov: 3:45 AM local ✅ 👤).

## Branches
- `main`: the live site; changes only through PRs the owner merges (D-026). Scheduled workflows run only from here.
- `picks`: development — Block X, Picks tooling, the admin page, the VHP sampler. Not yet merged into `main`; `vault-v6` not yet merged into it (I-019).
- Game branches: `survivor`, `fantasy`, `golf`, `kg-09-bracket`, `combo`, `lastnode`. Vault: `vault-v6` (frozen), `vault-v6-next` (backup).
- Data branches: `race-data`, `games-data`, `blocks-data`, `names-data`, `testnet-data`, `bracket-history` (keep). `race-samples` doesn't exist yet ✅ (I-059).

## Chats and ownership
| Chat | Owns |
|------|------|
| Questions | game 1, site basics, guest play, nodes and operations |
| Hub (site / captain) | shared site files (`board.js`, `stake-panel.js`, `styles.css`, `games.*`, tab bar, `stake.html`), the admin page, names, coordination |
| Race (KG 02 · Hub + Race Show) | every Race file (D-035) |
| Vault | Vault v6, seed, game registry, the bot's vault code |
| Block X and Picks | Block X, the Picks contract, sponsor v3, publish checks |
| Swap Desk | the desk, nodes, self-heal, question release (ran 16–28 Oct) |
| Survivor · Last Node Standing · Block Golf · Producer Bracket (+ VHP standard) · Fantasy (+ Rival) · Combo Card (+ Picks v2) | their game and branch |

No other chats exist; sponsor work was spread across these 👤. **Repo Lens is not part of Knode Games** — it is the owner's separate audit project that game chats send packages to 👤.
