# Knode Games — Platform Overview

> **Purpose:** the one-page picture of what Knode Games is today: games, contracts, money, wallets, machines, branches and who owns what.
> **Last updated:** 5 Nov 2026 (status sync: sponsor v3 guest fix live, Vault v6.1 in PR #114, new games paused (D-113), VHP Ruler chat, library and standards lists)
> **Sources:** the 12 chat exports in `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private), the owner's answers on 2 Nov, and the repo (`main` and `picks`, checked 2 Nov).
> **Rule:** if this file disagrees with `DECISIONS.md`, `DECISIONS.md` wins. The full order of sources is in D-002.

**Legend:** ✅ verified in the repo · 💬 from a chat, not verified · 👤 owner said so · ⚠️ open contradiction (see `DECISIONS.md`) · ❓ unknown

## The library
| File | Holds |
|------|-------|
| `CURRENT_STATE.md` | dated snapshot: what's live now, and the dates to watch |
| `CALENDAR.md` | every dated step in one place (the Vault v6.1 announce, upload, handover and rule week; game-apply deadlines) |
| `RUNBOOK.md` | what to do when something breaks: alerts, held weeks, a misbehaving game, nodes, keys, the withdrawals-only build |
| `HEALTHCHECK.md` | CTO health check: strengths, weaknesses, missing information, quality scores, top 10 priorities |
| `CHAT_REQUESTS.md` | the chats' one work list (D-089); the owner's one start message for every chat |
| `PLATFORM.md` | this overview |
| `ARCHITECTURE.md` | how the pieces work: site, contracts, bots, workflows, data, tests |
| `DEPENDENCIES.md` | how vault, leaderboards, rewards, swap desk, wallets, games and user accounts connect |
| `DECISIONS.md` | every decision (D-xxx) and every contradiction (C-xx) |
| `RULES.md` | fund-safety, vault, withdrawal, reward, architecture and Koinos rules; what never changes casually |
| `ROADMAP.md` | milestones and launch paths |
| `LAUNCH_BOARD.md` | every game's launch stage on one page, and what moves it on |
| `KEYS_AND_ROLES.md` | every wallet, contract and key: address, powers, where the key lives, if lost or stolen (no keys) |
| `SPONSOR.md` | the Mana sponsor: live caps and limits, what it pays for, how to check, change, roll back and switch it off |
| `ALERTS.md` | every alert the platform sends: trigger, channel, what it means, what the owner does |
| `RECOVERY.md` | PC disaster recovery: what keeps running, what stops, how to rebuild, a stolen PC |
| `OPENISSUES.md` / `TODOS.md` | open problems (I-xxx) and the owner's own steps |
| `KOINOS.md` | chain facts, testnet, gotchas |
| `CONTRACTS.md` | the register of every live contract: address, live build, upload date, how it can change, who controls it, last review |
| `REPO_MAP.md` | every top-level folder, its funds-risk tier, audit coverage, and the structure plan |
| `GLOSSARY.md` | the words: VHP, effective VHP, Mana, the pool, the seed, staked vs free, the week numbers |
| `AUDITS.md` | how an audit works (Repo Lens package, prompt, report, GO, fix-check) and the list of audits |
| `PRIORITIES.md` | what to work on next — P1 / P2 / P3 by the value it creates |
| `TECHNICAL_DEBT.md` | shortcuts, unfinished systems, temporary fixes and risks, ranked by severity |
| `DOCUMENTATION_GAPS.md` | what's missing, contradictory or incomplete in this library, ranked |
| `FOUNDER_INTENT.md` | why the founder built it: why Koinos, why VHP, principles, success and failure |
| `FREE_PRIZE_SWITCH.md` | how free play, free prizes and staked prizes differ; the per-game switch; starting settings |
| `SESSION_END_PROCESS.md` | the five-part report every AI session writes before ending |
| `WEEKLY_REVIEW.md` · `reviews/` | the Tuesday review process and its dated entries |
| `../games/` | one file per game: rules, scoring, rewards, status, issues |
| `../standards/` | the 10 standards: `GAME_STANDARD.md`, `VAULT_STANDARD.md`, `LEADERBOARD_STANDARD.md`, `TOKEN_STANDARD.md`, `RECORDER_STANDARD.md` (recorder and publish-job rules), `VHP_RULER.md` (the shared VHP ruler), `GO_LIVE_CHECKLIST.md` (every launch, in order) and `AI_CHAT_STARTER.md` (how every chat starts). `WEEK_CYCLE.md` (the one home for every game's weekly timing) and `NEW_GAME.md` (step-by-step onboarding for a new game) |
| `../archive/` | history: `DONE.md` (finished items), `ISSUES_CLOSED.md`, dated copies from before each cleanup. The raw chat exports moved to the private Claude project (`claude/repo-history/`, D-115) |

## Summary
Knode Games runs free and staked prediction games on the Koinos blockchain, powered by its own block-producing nodes. Players pick producers, blocks and races; correct calls climb a weekly leaderboard for each game. All staked VHP sits in one vault that produces blocks. Each week's rewards, after a flat 5% fee, pay the free-game prizes (2 VHP for 1st, 1 VHP for 2nd) and are split across the staked games by each game's share of the stake. Funds safety comes first: only the vault holds tokens, and stakes are always withdrawable. 👤

## Live
| Item | Value | |
|------|-------|-|
| Website | https://knodegames.com — GitHub Pages, served from the repo root | ✅ `CNAME` |
| Domain & DNS | registered at Cloudflare; 4 A + 4 AAAA records on `@`, `www` CNAME → `bawcejawn.github.io`, all DNS-only (grey cloud) | 💬 |
| Repository | `github.com/bawcejawn/KnodeGames` (old names `Knode`, `kprediction` redirect); kept **public** so Actions and Pages stay free (D-043) | ✅ |
| Network | Koinos mainnet (chain facts: `KOINOS.md`) | ✅ |
| Live on the site | Daily Questions, Who Signs Block X, Producer Race, the swap desk, the staking hub (`stake.html`, Daily Questions too: #142, #150, #157), Results (with a Block X tab, #143), status bars, the @name page (`names.html`) | ✅ `games.json` / 💬 |

## Games
Vault ids and results sources: ✅ `game-data/deployment.json` → `vaultGames` on `main`. Every game is stakeable (D-018). **Every game has Free play (a Free play board) — D-081.** Free VHP prizes (2 for 1st, 1 for 2nd per week, from the vault's start, D-062) are on for Questions, Block X, Race, Bracket and Last Node; **Combo, Golf, Survivor and Fantasy have a Free board with no prize** until the owner switches it on. Last Node pays the free prize from the start. Nothing is announced to players until it's built, audited and ready (D-064). **Core first (D-113):** no new game launches until the Vault, the sponsor, the Questions upgrade, the VHP ruler and the repo cleanup are done; the paused games keep their branches. Every game's week follows `../standards/WEEK_CYCLE.md` (D-125, D-129).

| Id | Game | Play | Rules | Status (5 Nov) | Code |
|----|------|------|-------|----------------|------|
| 1 | Daily Questions | Staked + Free | D-045, D-047, D-062, D-116 | live and paying; built into the vault. Vault v6.1 (PR #114) brings 60 questions a week and the shared game rules from its rule week (dates: `CALENDAR.md`) | `main` |
| 2 | Who Signs Block X | Staked + Free | D-036 – D-041, D-070, D-077 | **live since 3 Nov**; vault `game-apply` window Thu 5 – Sun 8 Nov, then `PRIZES_FROM_WEEK = 3`: pays from Mon 9 Nov ("Week 1"); published final results can't be rewritten (#159) | `main` |
| 3 | Survivor | Staked + Free board, **no free prize yet** (D-081); 2-week seasons | D-051, D-065, D-081 | **paused (D-113)**: Season 1 no longer starts Mon 16 Nov; when it restarts: audit pass 4, testnet season, Picks registration (I-050), register **with `--free`**, free-prize switch off (D-082) | `survivor` @ `a8a1979` ✅ |
| 4 | Fantasy Producers | Staked + Free board, **no free prize yet** (D-081) | D-059 | **paused (D-113)**; then fix-check, full test week, real-data simulation | `fantasy` @ `2bee805` ✅ |
| 5 | Weekly Rival | records only, no prize; not a vault game ✅ | D-059 | ships with Fantasy (paused) | `fantasy` |
| 6 | Block Golf | Staked + Free board, **no free prize yet** (D-081); free practice weeks | D-056 | **paused (D-113)**; then practice with Block X, staked after `game-add 6` | `golf` @ `6b2200a` ✅ |
| 7 | Producer Race | Staked + Free | D-033 – D-035 | live; on the weekly rhythm (#149, #155); payout safety merged (#133); vault `game-apply` window Thu 5 – Sun 8 Nov, then pays from Mon 9 Nov | `main` |
| 8 | Combo Card | Staked + Free board, **no free prize yet** (D-081) | D-060 | **paused (D-113)**; then fix-check 4 and the Picks v2 upgrade | `combo` @ `c8c652e` ✅ |
| 9 | Producer Bracket | Staked + Free, 1-week seasons | D-019, D-057 | **paused (D-113)**; Repo Lens #E-3: fix first; launches when ready (D-088) | `kg-09-bracket` @ `ee676ea` ✅ |
| 13 | Last Node Standing | Staked + Free, **free prize from the start** (D-081) | D-054, D-055 | **paused (D-113)**; then round-3 review (I-059) | `lastnode` @ `adf95be` ✅ |

Full per-game documentation: `.ai/games/` (Questions, ProducerRace, BlockX, Survivor, FantasyProducers, BlockGolf, ComboCard, ProducerBracket, LastNodeStanding). Ids 10–12 are unused. All unlaunched branches are pushed, not merged, and nothing from them is deployed ✅. Launch paths per game: `ROADMAP.md`. Readiness gaps: I-065.

## Contracts (Koinos mainnet)
| Contract | Address | Code | State | |
|----------|---------|------|-------|-|
| Game / **Vault v6** (game 1 built in) — also the **Knode Games Pool** producer (D-073) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `eed38f7c…` (was v5 `c17066ae…`) | live, upgraded in place 2026-11-02 02:29 UTC. **v6.1** release `11043e1f…` (PR #114, Repo Lens #E-16 GO to announce): announce, upload and rule week in `CALENDAR.md` | ✅ |
| Vault emergency build | — | `e84fec49…` (withdrawals only; v6.1's is `04c27c1a…`) | standby, not deployed (D-021) | ✅ |
| Mana sponsor v3 guest fix | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | `b84e1add…` (since 4 Nov) | live; switch and vault switch ON (live values: `SPONSOR.md`) | ✅ |
| Picks | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a…` (v2 `92d555d0…` planned for Combo) | uploaded 2026-10-30; only an owner-approved upgrade is accepted | ✅ |
| Race picks | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f212…` | uploaded 2026-10-27 | ✅ |
| Swap Desk v2 | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506cc…` | live since 2026-10-28 | ✅ |

## Money
- **Platform fee:** a flat 5% of gross rewards, collected with `claim-fee-vhp all` (rules: D-029, `standards/VAULT_STANDARD.md`).
- **Free-play prizes:** 2 VHP 1st, 1 VHP 2nd on every free game, from the vault's start (D-062). Nothing is paid for weeks before that (D-063).
- **Staked rewards:** split across staked games by each game's share of stake; each game ranks its own stakers (per-game rules in DECISIONS).
- **Mana sponsor:** pays players' Mana for stake, withdraw, claim and plays — never `move_stake` (D-027), within its caps (live values: `SPONSOR.md`). Mana Station is shelved (D-053).
- **Swap desk:** VHP → KOIN at a flat 3% fee, no daily payout cap (D-007, D-044); liquidity ~1,050 KOIN on 2 Nov 💬.
- **No Knode Games token** for now (D-072).
- **Running costs:** $0 hosting (D-005); domain ~$10–20 a year 💬.
- **Snapshots** 💬 (dated, will go stale):
  - 2 Nov, at the v6 upload: vault holdings 21,120.07528353; seed 21,050 VHP.
  - 28 Oct, game v5: VHP 21,622 + KOIN 546.6 held vs 22,151.7 owed (stakes 21,011; seed 1,050; fee 4.54; pots 86.17). Desk: 478.18 KOIN, 20,720 VHP producing; 2 swaps (3,001 VHP in, 2,910.97 KOIN out).

## Wallets (public addresses only — never keys)
| Role | Address | State | |
|------|---------|-------|-|
| Owner (game/vault, desk, Picks) | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | hands the vault and the Desk to the new cold owner `1LMV8E…` (D-083; dates: `CALENDAR.md`); signs the v6.1 announce and upload first. Picks handover later (D-106) | ✅ |
| Desk treasury | same as owner | to move to a cold treasury, 48 h timelock (I-001) | ✅ |
| Seed owner | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` | dedicated wallet since 30 Oct — done | ✅ |
| Operator (bot) | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` | rotated in 26 Oct; pays its own Mana, target 50 KOIN (D-046); balance unconfirmed (I-046); **GitHub-only** (D-084) | ✅ |
| Mana sponsor | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | 25,000 KOIN (D-061); its own key (D-085, D-148) | ✅ / 👤 |
| Old operator (retired) | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` | retired; ~100 KOIN left, swept this weekend (I-045) | 💬 |
| New owner (cold key, D-083) | `1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd` | exists; owns Race picks since 4 Nov (tx `0x1220bd9c…`); takes the vault and the Desk at the handover accepts | ✅ |
| Cold treasury | ❓ | not created yet | |
| Producer public keys | desk `AzCYCDLD…`, game `Ak0vGklN…` | — | ✅ |

Procedure for moves: `docs/WALLETS.md` (roles, on-chain rules, never-list, the weekend outline); the step-by-step runbook is private. Who controls what today: `KEYS_AND_ROLES.md`. Key storage: the owner's private notes.

## The owner's PC
- **Folders:** `C:\kprediction` (main checkout; scheduled tasks — always check the branch first) · `C:\kprediction-vault` (worktree on `vault-v6`, frozen, D-025) · `C:\kg-combo-preview` (Combo) · `C:\kprediction-test` (testnet and audits) · `C:\kprediction-fantasy` (Fantasy practice only). 💬
- **Nodes:** three mainnet nodes in Docker on Windows — desk `C:\kpred-desk-node`, game `C:\kpred-node`, personal `C:\koinos-personal` — and **no testnet nodes** (D-066). Volumes `<project>-basedir`. **Never delete `basedir\block_producer`: it holds `private.key`.** Ports are deliberately not written down (public repo). 💬 / 👤
- **Scheduled tasks:** "Knode self-heal" every 20 min; "Knode question release" 11:45–14:05 UTC every 5 min, stored in UTC (next run checked 2 Nov: 3:45 AM local ✅ 👤).

## Branches
- `main`: the live site; changes only through PRs the owner merges (D-026). Scheduled workflows run only from here.
- `picks`: was the development branch (Block X, Picks tooling, the admin page, the VHP sampler). `vault-v6` was merged into it on 2 Nov (I-019), and **all of `picks` reached `main` with PR #57 on 3 Nov** ✅ (`picks` has no commits that `main` lacks). The owner's folder runs the tools from `main` ✅ (4 Nov).
- Game branches (paused, D-113): `survivor`, `fantasy`, `golf`, `kg-09-bracket`, `combo`, `lastnode`. Vault: `vault-v6` (frozen), `vault-v6-next` (backup), `vault-questions-60` (v6.1, PR #114). Ruler: `vhp-ruler`.
- Data branches: `race-data`, `games-data`, `blocks-data`, `names-data`, `testnet-data`, `bracket-history` (keep). `race-samples` (created by the sampler's first run, 3 Nov ✅). `prize-settings` (the free-prize switch, D-082) appears after its first send.

## Chats and ownership
| Chat | Owns |
|------|------|
| Library (Project Librarian) | the `.ai/` library: files session-end reports, keeps docs consistent, runs the weekly review with the owner, writes prompts for other chats |
| Daily Questions | game 1, site basics, guest play, nodes and operations |
| Hub (site / captain) | shared site files (`board.js`, `stake-panel.js`, `styles.css`, `games.*`, tab bar, `stake.html`), the admin page, names, repo cleanup and public-readiness |
| Race (KG 02 · Hub + Race Show) | every Race file (D-035) |
| Vault | Vault v6 / v6.1, seed, game registry, the bot's vault code |
| Block X and Picks | Block X, the Picks contract, the Mana sponsor and its tool, publish checks |
| VHP Ruler | the shared VHP ruler (D-110; `../standards/VHP_RULER.md`), branch `vhp-ruler` |
| Swap Desk | the desk, nodes, self-heal, question release (ran 16–28 Oct) |
| Survivor · Last Node Standing · Block Golf · Producer Bracket · Fantasy (+ Rival) · Combo Card (+ Picks v2) | their game and branch — **paused (D-113)** |

No other chats exist 👤. The work list for each is `CHAT_REQUESTS.md`. **Repo Lens is not part of Knode Games** — it is the owner's separate audit project that game chats send packages to 👤.
