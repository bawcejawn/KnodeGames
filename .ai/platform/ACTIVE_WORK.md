# Knode Games — Active Work

> **Purpose:** everything **in progress or blocked**, one short line each, by area, pointing to where the work is tracked (R-xxx in `CHAT_REQUESTS.md`, owner steps in `TODOS.md`). Detail lives there, not here.
> **Snapshot:** Wednesday 4 Nov 2026, ~04:00 UTC. Refresh at every weekly review and when something moves.
> **Not here:** what's already live (`CURRENT_STATE.md`); finished work (`../archive/DONE.md`). The previous version is `../archive/2026-11-04/ACTIVE_WORK.md`.
> **Legend:** **Owner:** the owner does it · 👤 owner said · ❓ not decided

## Urgent
- **Guest picks blocked** on Race and Block X: the sponsor's "will you pay?" check traps for picks since the vault switch (I-083). Block X chat finds the cause and the stopgap (R-BX-0); the site shows the wrong message (R-HUB-4, R-RACE-7).

## Vault and rewards
| Work | Where it stands | Next / tracked in |
|---|---|---|
| Games 2 and 7 into the vault | announced 3 Nov | **Owner, Thu 5 Nov after 7:51 AM PT:** `game-apply 2`, `game-apply 7`, `games`, `PRIZES_FROM_WEEK = 3`; deadline Sun 8 Nov 4 PM PT (TODOS) |
| Free-prize switch | merged (PR #65), not used yet | **Owner:** starting values + ruleset (TODOS, `FREE_PRIZE_SWITCH.md` §4) |
| Vault bot checks | merged (PR #74) | follow-ups R-VAULT-7; every staked game publishes `board.json` (R-ALL-3, I-079); points recompute after 16 Nov (R-VAULT-4) |
| First paid weeks (Questions, Race, Block X from Mon 9 Nov; first close Mon 16 Nov) | waiting on the Race hold (I-034, PR #85) and Block X PR #80 | R-RACE-1, R-BX-1; **Owner:** review and merge #85 and #80 (TODOS) |
| Doubled Questions (D-092) | planning | R-Q-1, R-VAULT-6 (after the first paid weeks) |
| Runbook check | open | R-VAULT-5 |

## Wallets and keys
| Work | Where it stands | Next / tracked in |
|---|---|---|
| Wallet moves (D-083, D-096) | runbook merged (`docs/WALLETS.md`, PR #73) | **Owner:** Fri step 0 → Sat sweep old operator → Sun handovers → Mon/Tue accept (TODOS) |
| Picks and Race picks handovers | tools being built | R-BX-3 (plan PR #79), R-RACE-3; due Fri 6 Nov |
| Contract still paying others' Mana | owner postponed (D-046) | **Owner:** decide `sponsor-limit 0` (I-044) |

## Games
| Game | Where it stands | Next / tracked in |
|---|---|---|
| Who Signs Block X (2) | live, prize-free until Mon 9 Nov | PR #80: round 14 **No-Go until E4-1** (R-BX-1) |
| Producer Race (7) | live | prize fixes R-RACE-1/2; one VHP ruler R-RACE-5; page text R-RACE-6 |
| Survivor (3) | branch `survivor` @ `a8a1979` | **Owner:** Repo Lens pass 4 → R-SV-2 → Season 1 **Mon 16 Nov** (D-065) |
| Producer Bracket (9) | branch `kg-09-bracket` @ `5b2492e`; Repo Lens #E-3: fix first | R-BR-1 – R-BR-6; launches when ready (D-088) |
| Last Node Standing (13) | branch `lastnode` @ `adf95be`; round-3 review | R-LN-1 – R-LN-5; lower entry bar (D-091) |
| Fantasy Producers (4) | branch `fantasy` @ `2bee805`; testnet practice deployed | R-FA-1 – R-FA-3 |
| Combo Card (8) | branch `combo` @ `c8c652e` | fix-check 4, then Picks v2 (R-CO-1 – R-CO-3) |
| Block Golf (6) | branch `golf` @ `6b2200a` | R-GO-1 – R-GO-3 (❓ whether practice also waits for the sampler) |
| Daily Questions (1) | live | R-Q-1 |

**Blocked:** every unlaunched game waits for its audit (D-064, I-065; **Owner** runs them, TODOS). Last Node also needs 48 h of sampler data (R-LN-2); Combo needs Picks v2 (D-060).

## Leaderboards and site
| Work | Where it stands | Next / tracked in |
|---|---|---|
| "Week 1" refresh before Mon 9 Nov | not started | R-HUB-1, R-RACE-6 (I-069, I-027) |
| Staked + Free boards on every game (D-079, D-081) | done for Questions, Race, Block X | R-ALL-1; free boards still to build for Fantasy, Last Node, Combo, Golf |
| Mainnet check of the staking hub | open | R-HUB-2 |
| @name mint | broken | R-HUB-3 (I-020) |

## Platform
| Work | Where it stands | Next / tracked in |
|---|---|---|
| One VHP ruler and a shared game kit (D-090, D-093) | design not started | R-ARCH-1 |
| Library: audit process, key inventory; second cleanup pass | open | R-LIB-2, R-LIB-4 |
| Fallback node | on hold (👤) | — |

## Swap Desk
| Work | Where it stands | Next / tracked in |
|---|---|---|
| Desk treasury is the owner's hot wallet (TD-01) | cold treasury move starts Fri 6 Nov (48 h timelock) | **Owner** (wallet moves, TODOS) |
| Old node folders and the desk's ~50 GB broken copy | allowed from Wed 4 Nov 17:30 UTC if `heal.log` is clean | **Owner** (I-008) |
