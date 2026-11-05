# Knode Games — Status

> The one-page map of the whole system. **Snapshot: Thu 5 Nov 2026, ~17:20 UTC.** Details live in the linked docs; this page only points.
> Update it at the end of every library session and at the weekly review (Tuesdays). If this page and a linked doc disagree, the linked doc wins and this page gets fixed.

## Built and live
| Piece | Purpose | Code | Version / last change | Known limits |
|---|---|---|---|---|
| **Vault** `1Mpmf2…` | holds every stake, produces blocks as the Knode Games Pool, pays weekly rewards | `game/` | v6 (2 Nov); **v6.1 cleared**, upload Mon 9 ([CALENDAR](.ai/platform/CALENDAR.md)) | owner key hot until the cold-owner handover Tue 10 |
| **Swap Desk** `1FKTpX…` | VHP → KOIN, 3% fee | `desk/` | v2 (28 Oct) | owner is also its treasury until the weekend runbook |
| **Mana sponsor** `1ByDDS…` | pays players' Mana within caps (2.4 a transaction) | `sponsor/` | v3 guest fix (4 Nov) | one key controls it ([SPONSOR](.ai/platform/SPONSOR.md)) |
| **Picks** `1LmgqB…` / **Race picks** `1EN7xU…` | record picks, enforce locks on chain | `picks/`, `race/` | 30 Oct / 27 Oct | Picks owner handover tool built (#180, #191); date not set |
| **Daily Questions** (game 1) | quick questions, weekly board, staked + free | `generator.ts`, `resolver.ts`, `bot/bot.ts`, `app.js` | 5 a day now; **2 + 3 a day from Mon 9**; plain wording (#171) | **results recorder for the rule week not built (I-101)** |
| **Producer Race** (game 7) | pick the 6-hour race winner | `bot/race.ts`, `race.*` | weekly rhythm + Sunday fun races (#155) | **applied 5 Nov: pays from week 3** (Mon 9); gaps I-086, I-037 in #182 |
| **Who Signs Block X** (game 2) | pick who signs a target block | `bot/games/blockx.ts`, `blockx.*` | final Mon 00:00, fun Sundays (#175, #189) | **applied 5 Nov: pays from week 3** (Mon 9) |
| **Website** knodegames.com | every game page, Stake page, Results, Leaders, guest play, swap, names | repo root (`*.html/js/css`) | welcome page (#183), readability (#174), visit counting (#168) | served from the whole repo until the Pages allow-list (R-HUB-14) |
| **Hourly bot** | posts questions and results, seals vault weeks, chain watch, alerts | `bot/`, `.github/workflows/bot.yml` | v6 rules; D-127 (bot closes weeks) arrives with v6.1 | commits data to `main` (TD-03) |
| **Recorders** | read the chain, score, publish boards and vault files | `games.yml`, `race.yml`, `race-samples.yml` | two-node checks, pending → final, holds | — |
| **VHP ruler** | one fair measure of producer size for handicaps | `vhp-ruler.js`, `vhp_ruler.py`, `vhp-ruler.yml` | on `main` (#163), recording data only | **pays nothing** until all 11 simulations pass (D-111) |
| **Nodes + self-heal** | three producers on the owner's PC | `node/`, `bot/heal.mjs`, `watch.yml` | chain v1.5.2 | one machine (D-147) |
| **Library** | docs, decisions, standards | `.ai/` | D-001 – D-156 | big files ([HEALTHCHECK](.ai/platform/HEALTHCHECK.md)) |

## In progress
| Work | Where | Next step |
|---|---|---|
| Go-live of Week 1 | owner | ✅ games 2 and 7 applied and `PRIZES_FROM_WEEK = 3` set (5 Nov); left: announce v6.1 ([TODOS](.ai/platform/TODOS.md)) |
| Vault v6.1 | PR #114 | upload Mon 9, pin, handover 4a; accepts Tue 10; rule week Mon 16 |
| **Questions results recorder** (P1) | Questions chat | build, Repo Lens, merge by Sun 15 (R-Q-4) |
| VHP ruler v2.1 | `vhp-ruler-v21` | build A′ (D-154), re-run 11 sims (R-RULER-2) |
| Fantasy, Block Golf, Bracket (next launches, D-142) | PRs #188, #187, #186 | each its Repo Lens fix-check, then launch steps |
| Shared game kit (D-146) | Architecture chat | extract recorder + site libraries (R-ARCH-1) |
| Site: guest-first, live stats | PRs #181, #185 | Repo Lens, then merge; `STATS_ENABLED` |
| Run a Node page | PRs #173, #179 | Repo Lens fix-check, then merge |
| Vault: alert summaries, key backup scripts | PRs #177, #178 | Repo Lens, then merge |
| Race payout rule (D-152) | PR #182 | Repo Lens fix-check, then merge |
| Wallet moves | owner + Vault chat | weekend runbook (private) Fri 6 – Tue 10 |

## Planned but not started
- Career profile page (R-HUB-15), admin page refresh (R-HUB-17).
- Repo structure: website into `web/`, Questions into `questions/`, ruler into `ruler/` ([REPO_MAP](.ai/platform/REPO_MAP.md) §4).
- Data off `main`, one required CI check on every PR, tagged releases ([ARCHITECTURE](.ai/platform/ARCHITECTURE.md) A2, A3, A5).
- Last Node, then Survivor and Combo (paused, D-113). Ideas: Block Minute, Squads (R-LIB-7).
- The full platform audit (D-102).

## Blocked
| Item | Waiting on |
|---|---|
| Merge #114 (v6.1) | Monday's upload |
| #141 (VAULT_STANDARD for game 1) | v6.1 live |
| Questions paid like every game from Mon 16 | the results recorder (I-101) |
| Any game paying on the ruler (Race, Bracket's percentile) | all 11 simulations pass; owner's D-120 choice |
| Picks owner handover | owner picks a date (tool reviewed, #191) |
| Fantasy / Golf / Bracket launch | each its fix-check GO, sponsor rows, `game-add` (48 h, by Friday noon PT for the next Monday) |
| Website restructure | the Pages allow-list (R-HUB-14) |
| Removing old audit reports from git history | owner's yes, after Monday |

## Open decisions
| Decision | Options → consequence |
|---|---|
| **D-120 (steady throttlers in the ruler)** | 1: keep the 0.80 gate → throttlers sit out, nothing to game · 3: let them in unadjusted → they play but usually lose; also nothing to game |
| **Bracket on today's index** | launch now → earlier launch, ruler later · wait for v2.1 → later launch, one ruler from day 1 |
| **Bracket Sundays** | no fun round (knockout ends Saturday) → simpler · add one → matches D-129 for every game |
| **Picks handover date** | with the vault (Mon 9 / Tue 10) → one busy weekend · later → old owner keeps Picks longer |
| **Git history rewrite** | yes → old reports gone, everyone re-clones · no → they stay readable in history |
| **Play-first home page** | approve the mockup → Hub builds it, then A/B test · change it → another round |

## Open issues / tech debt that matters
| Item | Why it matters | Ref |
|---|---|---|
| Questions recorder missing | Questions stakers unpaid for the rule week if it's late | I-101 |
| Owner key hot until Tue 10; Desk treasury = owner | one key could move Desk funds | TD-01 |
| Bot pushes data to `main`; no required PR check | code on `main` decides payouts | TD-03, A2, A3 |
| Docs changes don't trigger tests | a docs edit can break a pinned test unseen | A2, R-HUB-23 |
| No ruler design passes all 11 simulations yet | handicapped games can't pay on it | R-RULER-2, D-154 |
| One PC runs every node | an outage stops production | TD-08, D-147 |
| Two copies of the game-1 claim rules | a fix in one can miss the other | I-092 |
| Sponsored batches over 2.4 Mana refused | players pay their own Mana on big batches | I-095 |
| Everything in the repo is public on the site | internal files downloadable | R-HUB-14 |

## Game standards (current state)
| Area | The rule | Doc | Inconsistent today |
|---|---|---|---|
| Week | play Mon–Sat, Sunday review + fun rounds, final ≥ Mon 00:00, claims Mon evening, backstop Thu | [WEEK_CYCLE](.ai/standards/WEEK_CYCLE.md) | Questions on its own timing until Mon 16; Bracket has no Sunday round |
| New game path | game file → branch → Repo Lens → go-live checklist | [NEW_GAME](.ai/standards/NEW_GAME.md), [GO_LIVE_CHECKLIST](.ai/standards/GO_LIVE_CHECKLIST.md) | — |
| Results | two nodes, recompute at publish, holds, finals locked, vault file fills `first`/`second`, `board.json` | [RECORDER_STANDARD](.ai/standards/RECORDER_STANDARD.md), [VAULT_STANDARD](.ai/standards/VAULT_STANDARD.md) | Golf lacks recompute and holds (I-098, I-099); Fantasy §4.1/§4.2 in progress |
| Rewards | 5% fee; staked share by stake; free 2 + 1 VHP where the switch is on; top 30% paid (D-152) | [WEEK_CYCLE](.ai/standards/WEEK_CYCLE.md) §3, [FREE_PRIZE_SWITCH](.ai/platform/FREE_PRIZE_SWITCH.md) | D-152 lands with #182 |
| Registration | Picks announce → apply (48 h); vault `game-add … --staked --free` → `game-apply` (48 h) | [GO_LIVE_CHECKLIST](.ai/standards/GO_LIVE_CHECKLIST.md) | — |
| Mana | every player action has a sponsor row under 2.4 | [SPONSOR](.ai/platform/SPONSOR.md) | rows missing for Fantasy (4, 5) and Bracket (9) |
| Handicaps | only through the VHP ruler | [VHP_RULER](.ai/standards/VHP_RULER.md) | Race and Bracket still use their own index until v2.1 |
| Page | Staked + Free boards, nicknames, stake badge, Sunday line | [GAME_STANDARD](.ai/standards/GAME_STANDARD.md), [LEADERBOARD](.ai/standards/LEADERBOARD_STANDARD.md) | — |
| Code layout | page `<game>.html/js` at the root, recorder in `bot/`, tests in `tests/audit/` | [REPO_MAP](.ai/platform/REPO_MAP.md) | each game's recorder is its own copy until the shared kit (D-146) |
| Security | Repo Lens before merge for payout code; fix every finding in one pass | [AUDITS](.ai/platform/AUDITS.md) | many PRs waiting on reviews (queue in AUDITS §2) |
| Work tracking | each chat's list in CHAT_REQUESTS; owner steps in TODOS; session-end report | [CHAT_REQUESTS](.ai/platform/CHAT_REQUESTS.md) | — |
