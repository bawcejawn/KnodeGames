# Knode Games — Vault Standard

> Purpose: Rules for how games hold, account for and pay out VHP/KOIN.
> Funds safety is the top priority. When in doubt, don't move funds.
> Last updated: 2026-11-02
> Sources: `DECISIONS.md` (D-003, D-016, D-018 – D-029, D-034, D-036), Vault, Hub, Race, Block X and Survivor chats.
> How the contract does it (entry points, formulas, timing) lives in `platform/ARCHITECTURE.md` → Vault v6. This file says what must be true.

**Legend:** ✅ verified in repo · 💬 chat only · ⚠️ conflict · ❓ unknown

## Current Vault
| Item | Value |
|------|-------|
| Contract version | v6 — live build `eed38f7c…`, emergency build `e84fec49…` ✅ |
| Address | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (the game contract, upgraded in place) ✅ |
| Games connected | game 1 (Daily Questions) built in. Registered ids for 2–9 and 13 in `vaultGames` ✅; `game-add` / `game-apply` pending this week |
| Seed | 21,050 VHP; seed owner `1K8VV…` (D-022) |

## Core Invariants (must always be true)
1. Vault balances never fall below total liabilities. (D-029)
2. Every staked VHP is withdrawable at all times. (D-016)
3. Only the vault holds player tokens. (D-016)
4. A withdrawals-only emergency build is always ready, so funds can never be locked. (D-021)
5. A prize shortfall is cut and never owed later. (D-029)
6. Free-game rewards are extra and second to stakers. (D-029)
7. A results file published as final can never change. 💬 Race, Vault

## Money Flow
1. **Player deposits:** whole VHP only; KOIN may be burned 1:1 into VHP on deposit.
2. **Rewards earned by node:** {{TBD: which producer(s) earn for the vault}}
3. **Platform fee:** 5% of gross rewards, collected with `claim-fee-vhp all`. 💬 Vault
4. **Split between games:** by each game's staked weight for the week (`weightFor`).
5. **Staked players:** share their game's bucket; Race-style medals for the top 30% by headcount (D-034). {{TBD: per-game rule}}
6. **Free-play prizes:** fixed VHP per game (Race 2 + 1, Bracket 2 + 1, Survivor 4 + 2); start date ⚠️ C-10.
7. **Player claims:** `claim_game` per week; the site batches up to 10 claims in one transaction and looks back 52 weeks.

## Stake Rules
- Minimum stake per staked game: 1 VHP ✅ (`minStake`). Staking in several games at once: {{TBD}}.
- Every game is stakeable (D-018). Staked = met that week's minimum; earning = `week_stake` at or above the minimum. 💬 Race
- Withdraw: any amount, any time (`withdraw_from`; not used for game 1). Move: `move_stake`, refused while paused; target game must be active and staked.
- A wallet that withdraws below the minimum mid-week loses that week's bucket share and free prize (I-028).

## Mana Sponsorship
- **Sponsored:** stake, withdraw, claim; never `move_stake` (D-027). The on-chain gap is I-021.
- **Per-wallet limits:** 25 Mana a day, 150 a week (D-028). Daily totals: ⚠️ C-02.
- **Vault switch:** sponsor v3 refuses vault calls until `config.game_has_vault` is on. When changing config, always pass the current caps.

## Results Files (every game except game 1)
- **Location:** each game's source string in `game-data/deployment.json` → `vaultGames` (e.g. `race-data:vault`, `games-data:<game>/vault`); files are `W<week>.json` with an unpadded week number. ✅ sources
- **Shape (Race reference):** `{"game", "week", "final", "rows": [{"player", "points"}], "first": [], "second": [], "skipped": []}`. 💬 Race
  - `rows`: staked players with at least 1 point, as 255, 254, … per tied group.
  - `first` / `second`: free players, at most 10 each.
  - `skipped`: rounds left out.
- **Timing:** due 3 days after the week ends; corrections allowed for 24 h after each seal and refused once finalizing starts.
- **Fail closed:** publish no final file if the contract or ABI is missing, `get_state` is empty, any stake read fails, or two nodes disagree. 💬 Race
- **Never final early:** refuse `final` for a week that hasn't ended; refuse any change to a published final file — such a change refuses the whole run.
- **Publish checks** (`vault_ok`, 💬 Block X): correct game id; rows ordered with points 1–255; `first` / `second` ≤ 10; no wallet twice; final only after the week ends. Bytes must be canonical (`JSON.stringify(JSON.parse(text))+"\n"`), ≤ 2 MB, no nested folders. A vault file that fails is held on its own with a warning, while the game's other files still publish. General publish rules: `platform/ARCHITECTURE.md` → Publish checks.
- **v6 reads:** stake reads must use the v6 ABI and fail fast on a non-v6 chain; never treat a read failure as "not staked" (V4, I-036).
- **Before any game pays prizes from its file:** the final file must not hinge on a single run with no hold (I-034).
- **Write once, copy forward:** each week's vault file is written once; later runs copy published weeks forward unchanged; a file whose stakes were read late is held. 💬 Survivor
- **Points:** places beyond 255 collapse to 1 point. 💬 Survivor
- **Trust boundary:** files in `games-data` can't prove their own days or stake lists, so the vault must recompute each season from the chain before paying (I-051). Refused prize posts must raise an alert (I-052).
- **Stake test** must match the vault's `post_results` / `post_prize_winners` and `bot/vault.ts`. Staked: `peak_stake` (or `active_stake` when there's no entry) is at least that week's minimum (`min_stake`, or `min_stake_next` from `min_stake_next_week`). 💬 Race

## Admin Powers
| Action | Who can do it | Safeguards |
|--------|---------------|------------|
| Add a game (`propose_game` → `apply_game`) | owner | 48 h timelock; apply within 7 days; earns from the next week |
| Deactivate a game | owner | earns through the current week; stake stays withdrawable |
| Post / seal / finalize / correct / void results | operator (bot) | correction window; refused once finalizing starts; skipped in safe mode |
| Vault upgrade | owner | 48 h notice (D-024); `PRE_VAULT_CODE` refuses old builds; `upgradeGuard()` refuses the safe build on a normal upgrade |
| Emergency: `upgrade --safe`, sponsor limit 0, pause | owner | withdrawals stay open (D-021) |
| Seed withdrawal | seed owner | 48 h timelock; paid to the current seed owner |
| Seed owner change | seed owner | two-step, 28,800 blocks between propose and accept |
| Collect the 5% fee | owner | `claim-fee-vhp all` |

## Adding a Game to the Vault
- [ ] Game passes `GAME_STANDARD.md`, including audit (D-017)
- [ ] Results source added to `vaultGames` and the file format above produced and fail-closed
- [ ] Game page mounts `KStake.badge` at the top of `<main>` and `KStake.mount` lower (D-031)
- [ ] `game-add` (with `--staked`, `--free`, `--season` as needed), announced
- [ ] After the switch to the vault: sponsor vault calls verified
- [ ] `game-apply` 48 h later, within 7 days
- [ ] First week's results file checked final and sensible

## Upgrade Procedure
- [ ] Audit by the owner's audit programs passes (D-017)
- [ ] Rehearsal on a snapshot and testnet check pass
- [ ] Code fingerprint checked; build branch frozen (D-025); backup branch pushed
- [ ] Announce on a weekend; upload on a Monday (D-023); 48 h notice
- [ ] After upload: chain-check, holdings unchanged
- [ ] Rollback / emergency path ready (D-021)
