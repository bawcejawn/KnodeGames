# Knode Games — Platform Overview

> Purpose: One-page summary of what Knode Games is today.
> Owner: Owner (Questions chat also acts as Hub/site chat — ❓ confirm)
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions and Vault chat exports, 2026-11-02), checked against the repo
> on branch `picks` and on GitHub `main` (as fetched 2026-11-02 13:01 PT). Where they differ, the branch is named.

**Legend:** ✅ verified in repo (file named) · 💬 from chat only, not verified · ⚠️ conflict, see `DECISIONS.md` → Contradictions · ❓ unknown

## Summary
Knode Games is a set of node-based games on the Koinos blockchain, served as a static site.
{{TBD: 2–3 sentence public description}}

## Live Links
| Item | Value | Confidence |
|------|-------|-----------|
| Website | https://knodegames.com (GitHub Pages, served from repo root) | ✅ `CNAME` |
| Repository | `github.com/bawcejawn/KnodeGames` (old names `Knode`, `kprediction` redirect) | ⚠️ C-06 |
| Local folder | `C:\kprediction` (stale copy `C:\Users\alcat\repos\Knode` deleted) | 💬 |
| Vault build folder | `C:\kprediction-vault`: Git worktree on `vault-v6`, used only for vault builds and uploads; `.env` copied from `C:\kprediction`; frozen (D-025) | 💬 Vault chat |
| Testnet staking page | `stake-testnet.html` | 💬 |
| Network | Koinos mainnet | ✅ `*-data/deployment.json` |

## Games
Vault ids and results sources ✅ `game-data/deployment.json` (`vaultGames`, `main`). Every game is stakeable (D-018).

| Vault id | Game | Type (Staked / Free play) | Status | Site list (`games.json`, `picks`) |
|----------|------|---------------------------|--------|-----------------------------------|
| 1 | Daily Questions ("Knode questions game") | {{TBD}} | live, built into the vault | live |
| 2 | Who Signs Block X | Staked + Free | Picks contract live; ready to announce 💬 | soon |
| 3 | Survivor | Staked + Free; 2-week seasons, prizes 4 + 2 VHP (D-020) | announce 7–13 Nov, Season 1 from Mon 16 Nov 💬 | soon |
| 4 | Fantasy Producers | Staked; free ❓ | in audits 💬 | soon |
| 5 | ❓ not listed anywhere | | | |
| 6 | Block Golf | Staked; free ❓ | in audits 💬 | soon |
| 7 | Producer Race | Staked + Free | ready to announce 💬 | live ⚠️ C-12 |
| 8 | Combo Card | Staked; free ❓ | in audits 💬 | not listed |
| 9 | Producer Bracket | Staked + Free; 1-week seasons, prizes 2 + 1 VHP (D-019) | ready to announce 💬 | not listed |
| 10–12 | ❓ unused | | | |
| 13 | Last Node Standing | Staked; free ❓ | in audits, rows only 💬 | not listed |

Game specs go in `.ai/games/{{TBD}}.md`.

Note: "Producer race" was removed from the site footer (💬); the game itself is still listed as live in `games.json` (✅).

## Core Components (Koinos mainnet)
| Component | Address | Code hash | Status | Confidence |
|-----------|---------|-----------|--------|-----------|
| Game / Vault v6 (questions game built in as game 1) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `eed38f7c…` (v5 `c17066ae…` before) | live, upgraded in place 2026-11-02 02:29 UTC | ✅ `game-data/deployment.json` on `main` (C-09 resolved) |
| Vault emergency build (withdrawals only, not deployed) | — | `e84fec49…` | standby (D-021) | ✅ `safeWasmSha256` on `main` |
| Swap Desk v2 | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506cc…` | live, upgraded 2026-10-28 | ✅ `desk-data/deployment.json` |
| Mana sponsor | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | v3 `b61ac238…` per `picks` + Vault chat; v2 `fa4659e6…` per Questions chat and `main`'s record | live | ⚠️ C-01 |
| Race | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f212…` | uploaded 2026-10-27 | ✅ `race-data/deployment.json` |
| Picks | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a…` | uploaded 2026-10-30 | ✅ `picks-data/deployment.json` |

## Fees & Economics (summary only — details in DECISIONS.md)
- Swap desk fee: 3% per swap, no daily payout cap — ✅ `desk-data/deployment.json` (`feeBps: 300`) / 💬
- Platform fee: 5%, collected from the vault with `claim-fee-vhp all` — 💬 Vault chat
- Reward distribution: 40/60 split from Week 3 (Mon 2 Nov) — 💬 (split details ❓)
- Free-play prize: 2 VHP from Week 3 (Questions chat) vs 2 + 1 VHP from Mon 9 Nov (Vault chat) — ⚠️ C-10
- Seed: 20,000 VHP deposited 2026-10-30, total 21,050 VHP; vault holdings 21,120.07528353 at the v6 upload — 💬 Vault chat, snapshot
- Swap desk liquidity: ~1,050 KOIN; 3,001 VHP swapped so far (owner tested a 3,000 VHP swap) — 💬, snapshot 2026-11-02

## Wallets & Roles (public addresses only — never keys or secrets)
| Role | Purpose | Address | Confidence |
|------|---------|---------|-----------|
| Owner | contract owner (game, desk) | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | ✅ |
| Treasury (desk) | currently the same address as owner | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | ✅ — handover pending (D-013) |
| Operator / bot | `set_operator` target | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` | ✅ `game-data/deployment.json` |
| Mana sponsor | pays Mana for game plays | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | ✅; KOIN balance ⚠️ C-03 |
| Seed owner | owns the vault seed (two-step handover, done 2026-10-30) | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` | ✅ `seedOwner` on `main` |
| Bot wallet | {{TBD}} | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` | ⚠️ C-11 |
| New owner (hardware wallet) | {{TBD}} | {{TBD}} | ❓ pending |
| Cold treasury | {{TBD}} | {{TBD}} | ❓ pending |

## Testnet
- Koinos Foundation testnet holds a Vault v6 test copy: `1MXay5pSvPNzc8sBcZAMWfqaY4T9DkBvLn` (10-minute weeks). Settings: `testnet/vault.json` on `main`. Details belong in `KOINOS.md` (not yet filed). — 💬 Vault chat

## Nodes (owner's PC, Docker — no IPs or ports recorded)
| Node | Folder | Confidence |
|------|--------|-----------|
| Desk | `C:\kpred-desk-node` | 💬 |
| Game | `C:\kpred-node` | 💬 |
| Personal | `C:\koinos-personal` | 💬 |

All three use Docker volumes `<project>-basedir` via `docker-compose.override.yml` (💬). Owner reported ~96% of expected blocks produced (💬, snapshot).

## Chats / Workstreams
| Chat name | Owns which files/areas | Confidence |
|-----------|------------------------|-----------|
| Questions | game 1, site, Mana sponsor, guest play, nodes and operations | 💬 |
| Race (KG 02 · Hub + Race Show) | {{TBD}} | ❓ |
| Vault | Vault v6 contract, seed, game registry, bot vault code, testnet copy | 💬 |
| Block X | Block X / Picks; ships V4, B1-1, B1-5 after the vault upload | 💬 |
| Hub | stake panel and admin page | 💬 |
| Combo Card, Last Node Standing | those games | 💬 |
| Sponsor v2 chat | {{TBD}} | 💬 named in archive |
| {{TBD}} | {{TBD}} | |
