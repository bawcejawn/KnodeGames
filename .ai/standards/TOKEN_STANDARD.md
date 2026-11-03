# Knode Games — Token Standard

> **Purpose:** how Knode Games handles KOIN, VHP, Mana and keys — which contracts may hold tokens, how amounts are measured and shown, and how every send is kept safe.
> **Applies to:** every contract, bot, tool and page in the project.
> **Last updated:** 2026-11-02 (first written)
> **Built from:** `platform/DECISIONS.md` (D-xxx), `platform/KOINOS.md`, the chats' standing rules and the repo. Related: `VAULT_STANDARD.md`.

**Words:** **must** = required · **should** = expected · ✅ verified in the repo · ❓ = not yet decided

## 1. The tokens
| Token | Mainnet contract | Used for |
|-------|------------------|----------|
| **VHP** | `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq` ✅ | stakes, the seed, prizes, the platform fee, block production |
| **KOIN** | `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK` ✅ | block rewards; Mana (every account's Mana comes from its KOIN); swap-desk payouts; can be burned 1:1 into VHP on deposit |
| **Mana** | — (a resource, not a token) | pays for transactions; the sponsor and the bot spend their own |

Knode Games has **no token of its own** (D-072). The possibility stays open for the future; adding one would need a new decision and updates to this standard.

## 2. Who may hold tokens
| Contract / wallet | May hold | Rule |
|-------------------|----------|------|
| **Vault** (`1Mpmf2…`) | players' staked VHP, the seed, rewards | the **only** contract that holds player tokens (D-016) |
| **Swap desk** (`1FKTpX…`) | its own KOIN float and the VHP it receives | refuses outside token moves and Mana payments; pays out at most min(its KOIN, its Mana); withdrawals only to the treasury (D-044) |
| **Mana sponsor** (`1ByDDS…`) | its own KOIN, for Mana only | never holds player funds (D-061) |
| **Picks, Race picks** | nothing | hold no tokens and never pay Mana ✅ |
| **Guest wallets** | nothing | play-only keys; never hold funds |
| Owner, treasury, seed owner, operator | their own funds | separate wallets for separate roles; moves follow `docs/WALLETS.md` |

New contracts **must not** hold player tokens unless the owner decides otherwise and the vault standard's invariants are kept.

## 3. Amounts
- **Units:** VHP and KOIN use 8 decimals: 1 VHP = 100,000,000 base units (`minStake` = 100000000 = 1 VHP ✅). Mana limits use the same units (0.2 Mana = 20,000,000).
- **Deposits** are whole VHP (`deposit_to`); withdrawals and moves may be any amount.
- **On chain and in code**, amounts are integers in base units; never floating point. In published JSON, numbers must be JS-safe (within ±2⁵³−1, finite, no integer-valued floats).
- **On the page**, show VHP and KOIN in whole units with sensible decimals, and Mana as a small decimal; explain what each amount means (D-059).

## 4. Measuring VHP
- Every game measures VHP the same way — the **VHP standard** (D-058): VHP rebuilt from the VHP contract's events, anchored by balance reads on two agreeing nodes.
- **Effective VHP:** received VHP counts only after 20 blocks; removed VHP stops counting at once (`effective_balance_of`, entry `0x629f31e6`).
- Own numbers (`cardVhp`, card credit) set a producer's multiplier; anything about other producers uses averages. Never use `cardVhp` alone; never take a multiplier from an average.

## 5. Moving tokens
- **Staking** is approve + `deposit_to`: the player approves the vault, then deposits. The token entry points are `approve` 0x74e21680 and `balance_of` 0x5c721497.
- **Prizes and rewards** are claimed by the player (`claim_game`); the vault never pushes funds to wallets.
- **The fee** is collected by the owner with `claim-fee-vhp all`.
- **The swap desk** trades VHP → KOIN at a flat 3%, with no daily payout cap (D-007, D-044).
- **Mana payment:** the sponsor pays stake, withdraw, claim and game plays — never `move_stake` (D-027). KOIN Vault users pay their own Mana (it picks its own payer).

## 6. Keys and sends
- **Keys** live only in `.env` on the owner's PC; never pasted into chat or GitHub; never printed, stored or asked for by an AI chat. A key that is pasted anywhere is rotated (D-003, D-042).
- GitHub holds **one** secret: `OPERATOR_WIF`, in the `bot` environment, usable only from `main` (D-012).
- **Every mainnet send** is a dry run unless `--send`, needs `--mainnet` on the command line and `CONFIRM_MAINNET=yes` in `.env`, and runs one step at a time (D-004, D-042).
- Testnet tools must refuse mainnet (by node name and chain id); test keys are play money only, and test wallets are emptied and retired after launch.
- A retired key is removed only after its wallet's leftover funds are moved (I-045).

## 7. Testnet
- Only the public Koinos Foundation testnet (D-066). In test kits, **1 test KOIN stands in for 1 VHP** where the real VHP flow can't be reproduced.
- Test funding comes from the faucet bot (100 test KOIN a day).

## 8. Open questions
- None. (No platform token: D-072. The vault's producer: the Knode Games Pool, D-073.)
