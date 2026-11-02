# Knode Games — Platform Overview

> Purpose: One-page summary of what Knode Games is today.
> Owner: Owner (Questions chat also acts as Hub/site chat — ❓ confirm)
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions chat export, 2026-11-02), checked against the repo
> working copy on branch `picks` on 2026-11-02. GitHub `main` may differ from `picks`.

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
| Network | Koinos mainnet | ✅ `*-data/deployment.json` |

## Games
| Game | Type (Staked / Free play) | Status | Spec file |
|------|---------------------------|--------|-----------|
| Daily Questions (game 1, "Knode questions game") | {{TBD}} | live — contract v5 | ✅ `games.json`; spec `.ai/games/{{TBD}}.md` |
| Producer Race | {{TBD}} | live | ✅ `games.json` |
| Who Signs Block X | {{TBD}} | soon | ✅ `games.json` |
| Survivor | {{TBD}} | soon | ✅ `games.json` |
| Fantasy Producers | {{TBD}} | soon | ✅ `games.json` |
| Block Golf | {{TBD}} | soon | ✅ `games.json` |

Note: "Producer race" was removed from the site footer (💬); the game itself is still listed as live in `games.json` (✅).

## Core Components (Koinos mainnet)
| Component | Address | Code hash | Status | Confidence |
|-----------|---------|-----------|--------|-----------|
| Game (Kpred v5, questions; `Q_GAME = 1` in Vault) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `c17066ae…` | live, upgraded 2026-10-28 | ✅ `game-data/deployment.json`; Vault link ⚠️ C-09 |
| Swap Desk v2 | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506cc…` | live, upgraded 2026-10-28 | ✅ `desk-data/deployment.json` |
| Mana sponsor | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | v3 `b61ac238…` per repo; v2 `fa4659e6…` per chat | live | ⚠️ C-01 |
| Race | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f212…` | uploaded 2026-10-27 | ✅ `race-data/deployment.json` |
| Picks | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a…` | uploaded 2026-10-30 | ✅ `picks-data/deployment.json` |
| Vault (v6) | {{TBD}} | {{TBD}} | ❓ | ⚠️ C-09 |

## Fees & Economics (summary only — details in DECISIONS.md)
- Swap desk fee: 3% per swap, no daily payout cap — ✅ `desk-data/deployment.json` (`feeBps: 300`) / 💬
- Platform fee: {{TBD}}
- Reward distribution: 40/60 split from Week 3 (Mon 2 Nov) — 💬 (split details ❓)
- Free-play prize: 2 VHP from Week 3 — 💬
- Swap desk liquidity: ~1,050 KOIN; 3,001 VHP swapped so far (owner tested a 3,000 VHP swap) — 💬, snapshot 2026-11-02

## Wallets & Roles (public addresses only — never keys or secrets)
| Role | Purpose | Address | Confidence |
|------|---------|---------|-----------|
| Owner | contract owner (game, desk) | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | ✅ |
| Treasury (desk) | currently the same address as owner | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | ✅ — handover pending (D-013) |
| Operator / bot | `set_operator` target | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` | ✅ `game-data/deployment.json` |
| Mana sponsor | pays Mana for game plays | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | ✅; KOIN balance ⚠️ C-03 |
| New owner (hardware wallet) | {{TBD}} | {{TBD}} | ❓ pending |
| Cold treasury | {{TBD}} | {{TBD}} | ❓ pending |

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
| Sponsor v2 / Vault v6 chats | {{TBD}} | 💬 named in archive |
| {{TBD}} | {{TBD}} | |
