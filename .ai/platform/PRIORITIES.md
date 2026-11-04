# Knode Games — Priorities

> **Purpose:** what to work on next, **ranked**, with the value each item creates. Status and steps are not repeated here: they live in `ACTIVE_WORK.md`, `TODOS.md` and `CHAT_REQUESTS.md`.
> **Last updated:** 2026-11-04 (cleanup: finished items moved to `../archive/DONE.md`; guest-pick trap added) · **Built from:** `FOUNDER_INTENT.md`, `CURRENT_STATE.md`, `TECHNICAL_DEBT.md`, `DECISIONS.md`.
> **North star (D-076):** over **1,000,000 VHP staked in the Knode Games Pool**, and free play so popular the Mana sponsor has to grow. Every item below should move toward that, or protect what gets us there.

**How value is created here:** players stake VHP → the pool produces more blocks → bigger weekly rewards → more players stake. Trust (funds never at risk, D-003) makes people stake; fun, free play brings them in (D-009, D-075); more games give them more reasons to stake (D-074).

## P1 — Critical (this week; blocks value or risks funds)
| # | Work | Value it creates | Owner | Refs |
|---|------|------------------|-------|------|
| 2 | **Put Block X and the Race in the vault:** `game-apply` Thu 5 – Sun 8 Nov, then `PRIZES_FROM_WEEK = 3` | Turns three games into **paying** games from Mon 9 Nov: the first real reason to stake | owner | D-077 |
| 3 | **Make the first paid week safe:** the Race vault-file hold (Block X's fixes merged, PR #80); watch the 24 h correction window after each seal | A wrong first payout would cost more trust than any feature earns | Block X, Race chats; owner | I-042, I-034, TD-02 |
| 4 | **Split the keys this weekend:** cold desk treasury, cold-key owner for the vault, Desk, Picks and Race picks; retire the old operator key | The desk's funds stop depending on one hot key; the safety story players can rely on | owner (+ Vault, Block X, Race chats for the tools) | TD-01, TD-04, I-001, D-083, D-096 |
| 6 | **Set the free-prize switch's starting values** and the `prize-settings` ruleset | Each game starts with the right free prize: on for 2, 7, 9, 13; off for 3, 4, 6, 8 | owner | D-082 |
| 7 | **Site "Week 1" refresh** before Mon 9 Nov | Players see one clear starting line for the vault era | Hub, Race chats | I-069, D-063 |

## P2 — Important (next 2–3 weeks; grows players and stake)
| # | Work | Value it creates | Owner | Refs |
|---|------|------------------|-------|------|
| 8 | **Launch Survivor on Mon 16 Nov** | A second staked + free game, a two-week hook that keeps players returning | Survivor chat + owner | D-065, I-050 |
| 9 | **Run the remaining audits and launch each game when it passes:** Bracket (after its fixes), Last Node, Fantasy, Combo, then Block Golf staked | Each game is a new reason to stake; multi-game staking is encouraged (D-074) | game chats + owner | D-064, I-065 |
| 10 | **The one VHP ruler, Race first** (card credit, a longer look-back) | Closes the Race's proved trick before stakes grow; one fix for every game | Race, Architecture chats | D-090, D-093, R-RACE-5, R-ARCH-1 |
| 11 | **Turn on Block Golf practice** now that Block X is live | Rewards playing across games at almost no cost: no contract, no picks | Golf chat | D-056, I-060 |
| 12 | **Tell players:** a launch announcement once the three paying games are in the vault | Players can't stake in a platform they haven't heard of | owner | ROADMAP |
| 13 | **Free-prize farming decision** before free prizes pay out | Free prizes reach real players, not wallet farms, and keep the sponsor for them | owner | I-035, TD-11 |
| 14 | **Fix nicknames** (the mint never sets the main name) | Players see their own name on the boards: identity drives engagement | Hub chat | I-020, TD-15 |
| 15 | **A Free play board and a Leaders entry for each new game** | One place to see every game's standings | each game chat | D-079, D-081, I-074 |
| 16 | **Measure sponsor use and plan top-ups** | Free play keeps working as it grows: the success signal of D-076 | owner | TD-12, D-061 |
| 17 | **Key and role inventory; audit process** | Faster, safer reactions; every launch audited the same way | library chat + owner | R-LIB-2 |
| 18 | **Protect `main`:** code reaches it only through reviewed PRs the owner merges | Results that decide payouts can't be changed by a stray push | owner + all chats | TD-03 |

## P3 — Nice to have (when the above are moving)
| # | Work | Value it creates | Refs |
|---|------|------------------|------|
| 19 | **Mobile free play:** ask the KOIN Vault developer for a dapp payer; polish the guest wallet and installable app | The founder's "massive missing link": players on phones | I-007, TD-16 |
| 20 | **Retention features:** streaks, a "Your week" card, a claim reminder, a weekly recap, badges | Players come back every day | ROADMAP |
| 21 | **Non-intrusive ads** (no adult content) and the "Built on Koinos" section | Revenue at $0 running cost; showcases the ecosystem | FOUNDER_INTENT |
| 22 | **Rebuild PR #50's useful parts:** fail-closed site, lighter polling | Fewer outages felt by players; less load on Armana | I-072 |
| 23 | **A fallback node** (on hold) and, later, a backup machine for the pool | Fewer red runs; production survives a home outage | TD-08, TD-10 |
| 24 | **One outside review of the vault** before stake nears 1,000,000 VHP | Independent confidence for big stakers | TD-09 |
| 25 | **Remaining documentation and tidy-ups** | Faster onboarding for every future chat | DOCUMENTATION_GAPS, TECHNICAL_DEBT (Low) |
| 26 | **Ideas parked:** Mana Station, a Knode Games token, compounding at a fixed time, a vault upgrade so an OFF free prize sets nothing aside | Revisit when the platform is growing | D-053, D-072, D-082, I-049 |

## Not a priority (by decision)
- Speed over quality: nothing is announced until it's built, audited and ready (D-064).
- Anything that makes play feel like gambling (D-075).
- Paid infrastructure (D-005).
