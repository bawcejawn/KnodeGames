# Knode Games — Priorities

> **Purpose:** what to work on next, ranked by the value it creates for players, for the Knode Games Pool and for trust in the platform.
> **Last updated:** 2026-11-03, afternoon (finished items struck through and kept; new items from today added) · **Built from:** `FOUNDER_INTENT.md`, `CURRENT_STATE.md`, `TECHNICAL_DEBT.md`, `DECISIONS.md`.
> **North star (D-076):** over **1,000,000 VHP staked in the Knode Games Pool**, and free play so popular the Mana sponsor has to grow. Every item below should move toward that — or protect what gets us there.

**How value is created here:** players stake VHP → the pool produces more blocks → bigger weekly rewards → more players stake. Trust (funds never at risk, D-003) makes people stake; fun, free play brings them in (D-009, D-075); more games give them more reasons to stake (D-074).

## P1 — Critical (this week; blocks value or risks funds)
| # | Work | Value it creates | Owner | Refs |
|---|------|------------------|-------|------|
| 1 | **Put Block X and the Race in the vault** — ~~`game-add`~~ ✅ 3 Nov, ~~sponsor vault switch~~ ✅ 3 Nov, **`game-apply` Thu 5 – Sun 8 Nov**, then `PRIZES_FROM_WEEK = 3` | Turns three games into **paying** games from Mon 9 Nov — the first real reason to stake | owner | D-077 |
| 2 | **Make the first paid week safe** — vault bot checks (staked lists, HOLD files, refused-post alerts, recompute; due Fri 13 Nov, Vault chat prompt ready); Race vault-file hold (I-034); watch the 24 h correction window after each seal | A wrong first payout would cost more trust than any feature earns | Vault, Race chats | TD-02, I-034, I-064 |
| 3 | **Split the keys** — rewrite `docs/WALLETS.md` first (it's stale; Vault chat prompt ready), then cold desk treasury, owner on a hardware wallet, retire the old operator key | The desk's funds stop depending on one hot key; the safety story players can rely on | owner (+ a chat for the doc) | TD-01, TD-04, I-001 |
| 4 | **Stop the contract paying other people's Mana** (`sponsor-limit 0`) | Every day it runs costs compounding — pool rewards players never see (~317 KOIN by 28 Oct) | owner | TD-05, I-044 |
| 5 | ~~**Confirm the VHP sampler is running**~~ — running since 3 Nov 15:58 UTC ✅. Now: **decide the sampler cadence** (GitHub may run it only hourly) | Unlocks Block X's handicap cards, then Last Node, Combo and Fantasy pricing | Block X chat | TD-07, I-059 |
| 5b | **Set the free-prize switch's starting values** and the `prize-settings` ruleset | Each game starts with the right free prize: on for 2, 7, 9, 13; off for 3, 4, 6, 8 | owner | D-082, `FREE_PRIZE_SWITCH.md` |
| 6 | **Site "Week 1" refresh** before Mon 9 Nov | Players see one clear starting line for the vault era | Hub chat | I-069, D-063 |

## P2 — Important (next 2–3 weeks; grows players and stake)
| # | Work | Value it creates | Owner | Refs |
|---|------|------------------|-------|------|
| 7 | **Launch Survivor on Mon 16 Nov** — audit pass 4, testnet season, register game 3 (announce Sat 7 – Fri 13 Nov) | A second staked + free game, a two-week hook that keeps players returning | Survivor chat | D-065, I-050 |
| 8 | **Run the remaining audits and launch each game when it passes** — Producer Bracket (requested 3 Nov; to try for 9 Nov), Last Node, Fantasy, Combo, then Block Golf staked | Each game is a new reason to stake; multi-game staking is encouraged (D-074) | game chats + owner | D-064, I-065 |
| 9 | **Turn on Block Golf practice** now that Block X is live (❓ whether it also waits for the sampler — Golf chat) | Rewards playing across games at almost no cost — no contract, no picks | Golf chat | D-056, I-060 |
| 10 | **Tell players** — a launch announcement once the three paying games are in the vault | Players can't stake in a platform they haven't heard of | owner | ROADMAP |
| 11 | **Block X "before prizes" fixes** | Fair Block X results as prize money flows | Block X chat | I-042, TD-13 |
| 12 | **Free-prize farming decision** before free prizes pay out | Free prizes reach real players, not wallet farms — and keep the sponsor for them | owner | I-035, TD-11 |
| 13 | **Fix nicknames** (mint never sets the main name) | Players see their own name on the boards — identity drives engagement | Hub chat | I-020, TD-15 |
| 14 | ~~**Block X on the Leaders page**~~ — done (PR #63). Next: a Free play board and a Leaders entry for each new game (D-079, D-081) | One place to see every game's standings | each game chat | I-074 |
| 15 | **Measure sponsor use and plan top-ups** | Free play keeps working as it grows — the success signal of D-076 | owner | TD-12, D-061 |
| 16 | **Operations runbooks** — an emergency runbook, a game go-live checklist, keys and roles | Faster, safer reactions when something breaks | a chat + owner | DOCUMENTATION_GAPS #2–#5 |
| 17 | **Protect `main`** — code reaches it only through reviewed PRs the owner merges | Results that decide payouts can't be changed by a stray push | owner + all chats | TD-03 |

## P3 — Nice to have (when the above are moving)
| # | Work | Value it creates | Refs |
|---|------|------------------|------|
| 18 | **Mobile free play** — ask the KOIN Vault developer for a dapp payer; polish the guest wallet and installable app | The founder's "massive missing link": players on phones | I-007, TD-16 |
| 19 | **Retention features** — streaks, a "Your week" card, a claim reminder, a weekly recap, badges | Players come back every day | ROADMAP |
| 20 | **Non-intrusive ads** (no adult content) and the "Built on Koinos" section | Revenue at $0 running cost; showcases the ecosystem | FOUNDER_INTENT |
| 21 | **Rebuild PR #50's useful parts** — fail-closed site, lighter polling | Fewer outages felt by players; less load on Armana | I-072 |
| 22 | **A fallback node** (on hold) and, later, a backup machine for the pool | Fewer red runs; production survives a home outage | TD-08, TD-10 |
| 23 | **Race and Block X onto the VHP standard** | One fair way to measure VHP in every game | D-058 |
| 24 | **One outside review of the vault** before stake nears 1,000,000 VHP | Independent confidence for big stakers | TD-09 |
| 25 | **Remaining documentation and tidy-ups** | Faster onboarding for every future chat | DOCUMENTATION_GAPS, TECHNICAL_DEBT (Low) |
| 26 | **Ideas parked:** Mana Station, a Knode Games token, compounding at a fixed time, a vault upgrade so an OFF free prize sets nothing aside. (~~Free boards for staked-only games~~ — decided: every game has Free play, D-081.) | Revisit when the platform is growing | D-053, D-072, D-082, I-049 |

## Not a priority (by decision)
- Speed over quality — nothing is announced until it's built, audited and ready (D-064).
- Anything that makes play feel like gambling (D-075).
- Paid infrastructure (D-005).
