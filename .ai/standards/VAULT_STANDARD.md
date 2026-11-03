# Knode Games — Vault Standard

> **Purpose:** what must always be true about how Knode Games holds, accounts for and pays out staked VHP. **Funds safety comes first: when in doubt, don't move funds** (D-003, D-016).
> **Applies to:** the vault contract, the bot's vault code, and every game that sends results to the vault.
> **Last updated:** 2026-11-03 (games 2 and 7 announced; every results file fills free winners; D-081 / D-082)
> **Built from:** `platform/DECISIONS.md` (D-xxx), the Vault, Race, Survivor, Bracket, Golf, Last Node and Combo chats, and the repo. How the contract works in detail: `platform/ARCHITECTURE.md` → Vault v6. Tokens and keys: `TOKEN_STANDARD.md`.

**Words:** **must** = required · **should** = expected · ✅ verified in the repo · ❓ = not yet decided

## 1. The vault today
| Item | Value |
|------|-------|
| Contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` — the game contract, upgraded in place to Vault v6 on 2 Nov ✅ |
| Builds | live `eed38f7c…`; emergency withdrawals-only `e84fec49…` ✅ |
| Games | game 1 (Daily Questions) built in; results sources for 2, 3, 4, 6, 7, 8, 9, 13 in `vaultGames` ✅; games **2 (Block X) and 7 (Race) announced 3 Nov**, applicable Thu 5 Nov 15:51 UTC; the rest not yet added |
| Seed | 21,050 VHP, seed owner `1K8VV…` (D-022) |
| Producer | the **Knode Games Pool** = the vault address, via the game node (D-073) |
| First paying week | vault week 3 (Mon 9 Nov) for games applied Wed 4 – Sun 8 Nov (D-062, D-063) |

## 2. Invariants — must always be true
1. **Balances never fall below total liabilities** (D-029).
2. **Every staked VHP is withdrawable at all times** (D-016).
3. **Only the vault holds player tokens** (D-016; see TOKEN_STANDARD).
4. **A withdrawals-only emergency build is always ready**, so funds can never be locked (D-021).
5. **The seed takes the first loss** (`seedFree`); accounting uses checked u128 arithmetic.
6. **A prize shortfall is cut and never owed later**; free rewards are extra and come second to stakers (D-029).
7. **A results file published as final never changes.**

## 3. Money flow
1. **Deposit:** whole VHP only; KOIN may be burned 1:1 into VHP on deposit (`deposit_to`).
2. **Earn:** the vault's VHP produces blocks as the **Knode Games Pool** — the vault address `1Mpmf2…` is the producer (D-073), run by the game node; block rewards accrue to the vault.
3. **Fee:** a flat **5%** of gross rewards, collected with `claim-fee-vhp all`.
4. **Free prizes:** 2 + 1 VHP per week on each free game (D-062); multi-week seasons pay once at season end (D-068); every game has a Free play board, but Combo, Golf, Survivor and Fantasy pay no free prize until the owner switches it on (D-081) — they are still added **with** `--free`, and the owner's **free-prize switch** (D-082) keeps the prize off. An unwon or held prize rolls **fee-free into the next week's pot** (`rolled_over`), never leaving the vault ✅ (Vault chat, 3 Nov).
5. **Split:** the rest goes to the staked games by each game's staked weight for the week (`weightFor`).
6. **Within a game:** by the game's own rules from its results file (Race medals top 30%, Fantasy top 30%, Combo best 10 cards, Golf 7 × holes − strokes, Bracket / Last Node / Survivor by points).
7. **Claim:** `claim_game` per game and week; the site batches up to 10 claims and looks back 52 weeks.

## 4. Stakes
- Minimum **1 VHP** per staked game ✅ (`minStake`), read from `get_state` (`min_stake`, `min_stake_next`, `min_stake_next_week`), never below 1 VHP. **Staking in several games at once is allowed and encouraged** (D-074); each game needs its own 1 VHP minimum.
- **Staked** that week = `peak_stake` (or `active_stake` when there's no entry) at or above the minimum; **earning** = `week_stake` at or above it. A player staked at the week's start stays staked that week.
- **Withdraw** any amount at any time (`withdraw_from`; not used for game 1). **Move** with `move_stake` — refused while paused; the target must be active and staked.
- Withdrawing below the minimum mid-week forfeits that week's share and free prize; the panel should say so (I-028).

## 5. Mana sponsorship of vault calls
- The sponsor pays **stake, withdraw and claim**, never **`move_stake`** (D-027; the on-chain gap is I-021).
- Caps: 1 Mana per transaction, 25 a day and 150 a week per wallet, 5,000 a day for everyone, 2,000 a day for free players; the wallet holds 25,000 KOIN (D-028, D-061).
- Sponsor v3 refuses vault calls until its vault switch (`config.game_has_vault`) is on. **Switch it right after the first `game-add`**, passing the current caps exactly — a plain `config` resets them.

## 6. Results files (every game except game 1)
**Where:** the game's source in `game-data/deployment.json` → `vaultGames` (`<branch>:<folder>`), file `W<week>.json` with an unpadded vault week ✅ (`bot/vault.ts` reads `origin/<branch>:<folder>/W<week>.json`).

**Shape:**
```
{"game": <id>, "week": <n>, "final": true,
 "rows":   [{"player": "<address>", "points": 1..255}],
 "first":  ["<address>", …],   // free winners, ≤ 10
 "second": ["<address>", …],   // free winners, ≤ 10
 "skipped": [ … ]}             // optional: rounds left out
```
- `rows`: staked players with ≥ 1 point, dense-ranked onto 255 … 1 (ties share; past 255 places the best 254 stay exact and the rest share 1). A week with no qualifying players may still get a file with empty rows.
- **Every game fills `first` and `second`** with its free winners, even when its free prize is off. The owner's free-prize switch (D-082, `platform/FREE_PRIZE_SWITCH.md`) decides whether the bot posts them. ~~Staked-only games leave `first` and `second` empty~~ (D-071, superseded by D-081 / D-082).

**Every results file must:**
- be published **only after the week ends**, and for staked rows only after the stakes are read once the week has ended;
- be **due 3 days** after the week ends — still unreadable then → final as missed, no file;
- be **written once**; later runs copy published weeks forward unchanged; any change to a final file refuses the whole run;
- **fail closed** — no final file if the ABI or contract is missing, `get_state` is empty, any stake read fails, or the two nodes disagree; a read failure is never "not staked" (V4);
- pass the publish job's checks: right game id, ordered rows with points 1–255, ≤ 10 per free place, no wallet twice, canonical bytes, ≤ 2 MB, no nested folders; a failing vault file is held on its own while the game's other files still publish.

**Holds:** a game may publish `HOLD-W<week>.json` instead of paying (Last Node watch-and-hold, released by `LASTNODE_RELEASE_WEEKS`, D-055). Forged or unverified cards, or a stake disagreement, block that week's file (Combo).

**Before any game pays from its file:**
- the final file must not hinge on a single run with no hold (I-034);
- the vault recomputes what it can from the chain, since `games-data` files can't prove their own days or stake lists (I-051);
- the vault bot honours HOLD files, verifies that every staked board player is in the file, and alerts on a refused prize post (I-052, I-064).

## 7. Timing
- A game applied in week W earns from W + 1; results are posted for registered games only, for weeks they earn (`from_week <= w`) ✅.
- Results are due 3/7 of a week after the week ends; finalizing starts after `seal + 2 × close_delay` and `last_change + close_delay`; corrections and voids are allowed for 24 h after each seal and refused once finalizing starts.

## 8. Admin powers
| Action | Who | Safeguards |
|--------|-----|-----------|
| Add a game (`propose_game` → `apply_game`) | owner | 48 h timelock; apply within 7 days; earns from the next week; at most 12 games besides game 1 |
| Deactivate a game | owner | earns through the current week; stake stays withdrawable |
| Post / seal / finalize / correct / void results | operator (bot) | correction window; skipped in safe mode |
| Upgrade the vault | owner | 48 h notice (D-024); old builds refused (`PRE_VAULT_CODE`); a normal upgrade can't load the safe build (`upgradeGuard`) |
| Emergency: `upgrade --safe`, sponsor limit 0, pause | owner | withdrawals stay open (D-021) |
| Seed withdrawal | seed owner | 48 h timelock; paid to the current seed owner |
| Change the seed owner | seed owner | two steps, 28,800 blocks apart; cancels a pending seed withdrawal |
| Collect the 5% fee | owner | `claim-fee-vhp all` |

## 9. Checklists
**Adding a game**
- [ ] The game meets `GAME_STANDARD.md` (audited, ready — D-064)
- [ ] `vaultGames` source set; results file produced and fail-closed as in §6
- [ ] Page shows the badge and stake panel (D-031)
- [ ] `game-add` with `--staked --free --season N` (every game, D-082)
- [ ] Free-prize switch set (D-082): **off** for games without a free prize yet — before the game's first week
- [ ] Sponsor vault switch on (first game only), caps passed exactly
- [ ] `game-apply` 48 h later, within 7 days
- [ ] First week's file checked final and sensible

**Upgrading the vault**
- [ ] Owner's audits pass (D-017); rehearsal on a snapshot and a public-testnet check pass
- [ ] Code fingerprint checked; build branch frozen, backup pushed (D-025)
- [ ] Announce on a weekend, upload on a Monday, 48 h notice (D-023, D-024)
- [ ] After upload: chain-check, holdings unchanged
- [ ] Emergency path ready (D-021)
