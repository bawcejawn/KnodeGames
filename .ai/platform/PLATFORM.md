# Knode Games — Platform Overview

> Purpose: One-page summary of what Knode Games is today.
> Owner: Owner (Questions chat also acts as Hub/site chat — ❓ confirm)
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions, Vault, Hub, Race, Block X and Swap Desk chat exports, 2026-11-02; Swap Desk facts date from 16–28 Oct), checked against the repo
> on branch `picks` and on GitHub `main` (as fetched 2026-11-02 13:37 PT). Where they differ, the branch is named.

**Legend:** ✅ verified in repo (file named) · 💬 from chat only, not verified · ⚠️ conflict, see `DECISIONS.md` → Contradictions · ❓ unknown

## Summary
Knode Games is a set of node-based games on the Koinos blockchain, served as a static site.
{{TBD: 2–3 sentence public description}}

## Live Links
| Item | Value | Confidence |
|------|-------|-----------|
| Website | https://knodegames.com (GitHub Pages, served from repo root) | ✅ `CNAME` |
| Domain & DNS | registered at Cloudflare; GitHub Pages serves the repo root (PR #30 domain, PR #31 removed `/site/`). DNS: 4 A + 4 AAAA records on `@`, `www` CNAME → `bawcejawn.github.io`, all DNS only (grey cloud) | 💬 Hub |
| Repository | `github.com/bawcejawn/KnodeGames` (old names `Knode`, `kprediction` redirect) | ✅ GitHub "repository moved" notice on push, 2026-11-02 (C-06 resolved) Kept **public** so Actions and Pages stay free (D-043) |
| Local folder | `C:\kprediction` (stale copy `C:\Users\alcat\repos\Knode` deleted) | 💬 Always check the branch before running tools (`git checkout picks`, `git log --oneline -1`): a tool once ran old code from `lastnode` 💬 Block X |
| Vault build folder | `C:\kprediction-vault`: Git worktree on `vault-v6`, used only for vault builds and uploads; `.env` copied from `C:\kprediction`; frozen (D-025) | 💬 Vault chat |
| Combo checkout | `C:\kg-combo-preview`: a second Git checkout for Combo | 💬 Block X |
| Testnet staking page | `stake-testnet.html` | 💬 |
| Owner checklist (artifact) | a Claude artifact with a Today list, backed by its `tasks` database — https://claude.ai/artifact/Qjk951Qvntsa15yrhJ2db6 | 💬 Race chat ⚠️ I-032 |
| Network | Koinos mainnet | ✅ `*-data/deployment.json` |

## Games
Vault ids and results sources ✅ `game-data/deployment.json` (`vaultGames`, `main`). Every game is stakeable (D-018).

| Vault id | Game | Type (Staked / Free play) | Status | Site list (`games.json`, `picks`) |
|----------|------|---------------------------|--------|-----------------------------------|
| 1 | Daily Questions ("Knode questions game") | {{TBD}} | live, built into the vault; stake buttons stay on `index.html`; `withdraw_from` doesn't apply to game 1 💬 Hub | live Five questions Mon–Sat at 12:00 UTC (types: producer quartiles, group block counts, transactions in a window, largest gap, average interval; templates M1, M4, M5, M7, M10; model v5; `hashRule` 2; at most 30 a week). Answers close 00:00 UTC; Sunday is results day; corrections until Mon 12:00; winners final Tue 12:00 when on time. Rewards: see D-045 💬 Swap Desk |
| 2 | Who Signs Block X | Staked + Free | Picks contract live; ready to announce; status bar on `blockx.html` (`picks`); reaches `main` with the Block X launch PR after game 2 is applied 💬 | soon Picks contract: announced with 1 change per pick; `apply` allowed from Sun 1 Nov 21:23 UTC — not yet reported done (I-040). Split launch: goes live prize-free first (D-036). Repo Lens round 10 GO (`a55390f`), round 11 GO (`3472d8c`). Runbook `docs/blockx/MAINNET-LAUNCH.md` ✅ on `picks` |
| 3 | Survivor | Staked + Free (⚠️ C-13); 2-week seasons, prizes 4 + 2 VHP (D-020) | announce 7–13 Nov, Season 1 from Mon 16 Nov; testnet season and audit on branch `survivor` 💬 | soon |
| 4 | Fantasy Producers | Staked; free ❓ | in audit fix-checks, after the vault 💬 | soon |
| 5 | Rival (Picks only) | Staked | in audit fix-checks, after the vault 💬 Hub | not listed |
| 6 | Block Golf | Staked (after the vault); free ❓ | in audits. No contract of its own: scored from every game's board; practice scorecards ship with Block X 💬 | soon |
| 7 | Producer Race | Staked + Free (D-034) | live with status bar (PR #44 ✅ merged on `main`); vault `game-add` pending (C-12 resolved) | live |
| 8 | Combo Card | Staked; free ❓ | in audits; last in line, needs the Picks v2 CARD upgrade 💬 | not listed Picks v2 release `92d555d0…` (37,689 bytes); testnet contract `1PQZWWHb…` (game 98); upgrade commands on branch `combo` @ `5052fa6` 💬 Block X |
| 9 | Producer Bracket | Staked + Free; 1-week seasons, prizes 2 + 1 VHP (D-019) | ready to announce 💬 | not listed |
| 10–12 | ❓ unused | | | |
| 13 | Last Node Standing | Staked; free ❓ | in audits, rows only 💬 | not listed |

Launch order and pace: ⚠️ C-14. Game specs go in `.ai/games/{{TBD}}.md`.

Live on the site since 30 Oct (💬 Hub): staking hub (`stake.html`), status bars, the @name page (`names.html`, `NAMES_ENABLED=true`).

Note: "Producer race" was removed from the site footer (💬); the game itself is still listed as live in `games.json` (✅).

## Core Components (Koinos mainnet)
| Component | Address | Code hash | Status | Confidence |
|-----------|---------|-----------|--------|-----------|
| Game / Vault v6 (questions game built in as game 1) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `eed38f7c…` (v5 `c17066ae…` before) | live, upgraded in place 2026-11-02 02:29 UTC | ✅ `game-data/deployment.json` on `main` (C-09 resolved) |
| Vault emergency build (withdrawals only, not deployed) | — | `e84fec49…` | standby (D-021) | ✅ `safeWasmSha256` on `main` |
| Swap Desk v2 | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506cc…` | live, upgraded 2026-10-28 | ✅ `desk-data/deployment.json` |
| Mana sponsor | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | v3 `b61ac238…`, upload tx `0x122040b7…` (2026-10-30) | live, ON; vault switch off (as of 30 Oct) | ✅ `picks` record; C-01 resolved. `main`'s record still says v2 (I-043) |
| Race | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f212…` | uploaded 2026-10-27 | ✅ `race-data/deployment.json` |
| Picks | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a…` | uploaded 2026-10-30 | ✅ `picks-data/deployment.json`. Upload tx `0x12207d67…d809` ✅. Owner `1635QU…`; the upload key was deleted after upload; `authorize` refuses everything except an owner-approved upgrade 💬 Block X |

## Fees & Economics (summary only — details in DECISIONS.md)
- Swap desk fee: 3% per swap, no daily payout cap — ✅ `desk-data/deployment.json` (`feeBps: 300`) / 💬
- Platform fee: 5%, collected from the vault with `claim-fee-vhp all` — 💬 Vault chat
- Reward distribution: 40/60 split from Week 3 (Mon 2 Nov) — 💬 (split details ❓)
- Free-play prize: 2 VHP from Week 3 (Questions chat) vs 2 + 1 VHP from Mon 9 Nov (Vault chat) — ⚠️ C-10
- Cost model (💬 Swap Desk): public repo is free; a private repo would need ~15–18k Actions minutes a month (~$75–120 a month, estimate) plus Pro for Pages and environments; the domain costs ~$10–20 a year.
- Snapshot 2026-10-28 13:41 UTC (💬 Swap Desk): game held VHP 21,622 + KOIN 546.6 against 22,151.7 owed (stakes 21,011; seed 1,050 = 1,000 VHP + 50 KOIN; producer fee 4.54; pots 86.17). Week 1: gain 90.71, pot 86.17, 1 winner. Desk: 478.18 KOIN, 20,720 VHP producing; 2 swaps, 3,001 VHP in, 2,910.97 KOIN out, 90.03 VHP fees.
- Seed: 20,000 VHP deposited 2026-10-30, total 21,050 VHP; vault holdings 21,120.07528353 at the v6 upload — 💬 Vault chat, snapshot
- Swap desk liquidity: ~1,050 KOIN; 3,001 VHP swapped so far (owner tested a 3,000 VHP swap) — 💬, snapshot 2026-11-02

## Wallets & Roles (public addresses only — never keys or secrets)
| Role | Purpose | Address | Confidence |
|------|---------|---------|-----------|
| Owner | contract owner (game, desk) | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | ✅ |
| Treasury (desk) | currently the same address as owner; withdrawals go only here; changing it has a 48 h timelock | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | ✅ — handover pending (D-013) |
| Operator / bot | `set_operator` target | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` | ✅ `game-data/deployment.json` Rotated in 2026-10-26; pays its own Mana, target 50 KOIN (D-046) 💬 Swap Desk |
| Mana sponsor | pays Mana for game plays | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | ✅; KOIN balance ⚠️ C-03 |
| Seed owner | owns the vault seed (two-step handover, done 2026-10-30) | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` | ✅ `seedOwner` on `main` |
| Old operator (retired 2026-10-26) | replaced by `1HsM33…`; its key is still in the owner's local `.env`; leftover KOIN to move to the owner | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` | 💬 Swap Desk (C-11 resolved) |
| New owner (hardware wallet) | {{TBD}} | {{TBD}} | ❓ pending |
| Cold treasury | {{TBD}} | {{TBD}} | ❓ pending |

## Branches — 💬 Hub, Vault chats
- `main`: the live site. `picks`: development; merges `main` from time to time; the admin page lives there. `vault-v6` (frozen) and its backup `vault-v6-next`. `survivor`: Survivor testnet season and audit.
- Data branches: `race-data`, `race-samples` (`vhp-samples.json`), `blocks-data`, `games-data`, `names-data` (`names.json`), `testnet-data`.
- Other work branches: `combo` (Picks v2 upgrade commands), `lastnode`. AI chats may push to `picks` (several do), so always pull before pushing; `main` changes only through PRs the owner merges (D-026). 💬 Block X
- `vault-v6` is merged into `main` (PR #51 ✅) but **not into `picks`** ✅ — see I-019.

## Testnet
- Koinos Foundation testnet holds a Vault v6 test copy and a Picks test contract; addresses and settings in `KOINOS.md`. — 💬 Vault, Hub

## Nodes (owner's PC, Docker — no IPs or ports recorded)
| Node | Folder | Confidence |
|------|--------|-----------|
| Desk | `C:\kpred-desk-node` | 💬 |
| Game | `C:\kpred-node` | 💬 |
| Personal | `C:\koinos-personal` | 💬 |

All three use Docker volumes `<project>-basedir` via `docker-compose.override.yml` (💬). Docker Compose on Windows; images chain v1.5.2, block_store v1.1.0, p2p v1.3.0, block_producer v1.3.1 (💬 Swap Desk, as of Oct). **Never delete `basedir\block_producer`: it holds `private.key`.** Producer public keys: desk `AzCYCDLD…`, game `Ak0vGklN…` ✅ deployment files. Ports are deliberately not recorded here (public repo).

### Automation on the owner's PC — 💬 Swap Desk
- Windows scheduled tasks, both via `conhost --headless` (no window): "Knode self-heal" every 20 min; "Knode question release" daily 11:45–14:05 UTC every 5 min, stored in UTC so daylight saving can't move it.
- `GITHUB_ALERT_TOKEN` (in `.env`): fine-grained PAT for this repo only, Actions read/write; used by `heal.mjs` and `release-kick.mjs`. Owner reported ~96% of expected blocks produced (💬, snapshot).

## Chats / Workstreams
| Chat name | Owns which files/areas | Confidence |
|-----------|------------------------|-----------|
| Questions | game 1, site, Mana sponsor, guest play, nodes and operations | 💬 |
| Race (KG 02 · Hub + Race Show, session `0173PPUtFZWbkCLXcA57bDGS`) | all Race files: `bot/race.ts`, `race.html`, `race.js`, `race-math.js`, `race.yml`, `race/`, the `race-data` branch, Race tests (D-035). Rule written in `claude/owners-race.md` | 💬 |
| Vault | Vault v6 contract, seed, game registry, bot vault code, testnet copy | 💬 |
| Block X and Picks | Block X (game 2), the Picks contract, Mana sponsor v3, publish checks for race and Block X data, Repo Lens rounds | 💬 |
| Hub (site / captain chat, session `0173PPUsRKcFfG89XdWYy7LD`) | shared site files: `board.js`, `stake-panel.js`, `styles.css`, `games.*`, the tab bar, `stake.html`; the admin page; names; cross-chat coordination | 💬 |
| Survivor, Fantasy, Combo Card, Bracket, Last Node Standing | one chat per game | 💬 |
| Repo Lens | the owner's AI audit chat: receives a zip (`00-COMMIT.txt` + `00-FIXCHECK-PROMPT.md`), returns a Claude Docs report | 💬 |
| Unnamed chat (session `0173PPUrAJx3x5GM6g8LJmND`) | changed the tab bar and guest-wallet text | 💬 Race chat |
| Sponsor v2 chat | {{TBD}} | 💬 named in archive |
| {{TBD}} | {{TBD}} | |
