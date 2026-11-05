# Knode Games — Keys and Roles

> **Purpose:** every wallet and contract Knode Games depends on: its **public address**, its **role**, and what its owner can do and how long each power waits. Safe for a public repo.
> **Private:** where each key is stored, backups, the key-compromise order and the owner's accepted risks are **not** in this repo. They're in the owner's private notes (Claude project `claude/private/`). Never write a private key, recovery words or storage details here.
> **One home:** this page is the public inventory of **who controls what**. Live contract builds and reviews: `CONTRACTS.md`. Moving a wallet (handovers): `../../docs/WALLETS.md` (public steps) and the private runbook.
> **Last updated:** Thu 5 Nov 2026 (made public-safe: storage details moved to the owner's private notes). Built from the deployment files (`game-data/`, `desk-data/`, `sponsor-data/`, `race-data/`, `picks-data/`), `PLATFORM.md` and the decisions D-012, D-022, D-061, D-083, D-084, D-096, D-099, D-105, D-106.
> **Update rule:** change a row the same day an owner, treasury or operator changes. Check this page in every weekly review.
> **Marks:** ✅ checked in the repo or on chain · 👤 the owner said · 💬 a chat reported · ❓ not verified.

---

## 1. People's wallets

| Wallet | Address | Role |
|---|---|---|
| **Owner** | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` ✅ | Vault owner, Desk owner, Picks owner (on chain ✅, read 5 Nov), and the Desk treasury until the cold treasury is set. Hands the vault and the Desk to the cold owner on Tue 10 Nov (`CALENDAR.md`) |
| **Cold owner** | `1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd` ✅ | Race picks owner since 4 Nov (tx `0x1220bd9c…`); owner of the vault and the Desk from the handover accepts (Tue 10 Nov); Picks later (D-106) |
| **Seed owner** | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` ✅ (since 30 Oct, D-022) | The vault's seed (21,050 VHP ✅). Seed withdrawals wait 48 h and pay the current seed owner |
| **Operator (bot)** | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` ✅ (since 26 Oct) | Posts and resolves questions; posts, seals and finalizes game results. **Can't move funds.** Its key is a GitHub environment secret used only by the bot (D-084, D-012) |
| **Old operator** (retired) | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` ✅ (retired 26 Oct) | Controls nothing; its leftover KOIN is swept this weekend (I-045) |
| **Cold treasury** (planned) | set during the weekend runbook | Will receive every Desk withdrawal; it only receives |
| **Personal producer** | `1DAHmrQJMAbn4FmMMrew78wPUizjVdbBrd` ✅ (`@primeprocuder`, fix to `@primeproducer`, I-084) | The owner's own block production; not Knode Games funds |

**Rule:** the owner and the treasury are always different wallets with nothing in common (D-083).

---

## 2. Contracts

| Contract | Address | Live build | Owner (who can change it) |
|---|---|---|---|
| **Vault v6** (the game contract; the **Knode Games Pool** producer, D-073) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` ✅ | `eed38f7c…` (withdrawals-only `e84fec49…` ready); v6.1 next (`CONTRACTS.md`) | Owner `1635QU…` ✅ → cold owner from Tue 10 |
| **Swap Desk v2** (Knode Swap) | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` ✅ | `309506cc…` | Owner and treasury `1635QU…` ✅ → cold owner and cold treasury |
| **Picks** (Block X; later the other picks games) | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` ✅ | `700c296a…` | `1635QU…` ✅. Handover tool built (#180); date: owner |
| **Race picks** | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` ✅ | `61e8f212…` | `1LMV8EcR…` ✅ (4 Nov) |
| **Mana sponsor v3** | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | `b84e1add…` | itself (its own key changes its settings): see `SPONSOR.md` |

### Outside contracts we rely on (no keys of ours)

| Contract | Address | Used for |
|---|---|---|
| KOIN token | `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK` ✅ | Mana, block rewards, swaps, compounding |
| VHP token | `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq` ✅ | stakes; `effective_balance_of` for every handicap (entry `0x629f31e6`) |
| Proof of Burn (PoB) | `159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv` ✅ | block production; registered producer keys |
| Koinos Nicknames (@names) | `1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz` 💬 | player @names (`names.html`, `bot/names.ts`) |

Chain id (mainnet): `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==` ✅.

**Never send KOIN or VHP to a contract address** (vault, Desk, Picks, Race picks, sponsor, tokens): it can get stuck. `tools/send-koin.ts` refuses them.

---

## 3. Owner powers, contract by contract

What only the owner can do, how long it waits, and how to undo it. These rules are in the contracts' code, so anyone can check them.

### Vault v6 (`1Mpmf2…`)
| Power | Wait | Undo / note |
|---|---|---|
| `propose_game` → `apply_game` (add or re-activate a game) | 48 h, then apply within 7 days | a game applied in week W earns from W+1 |
| `deactivate_game` (`game-stop`) | immediate | earns through this week; stakes stay withdrawable; restart needs a new `game-add` |
| Correct points, remove a free winner, void a week (`game-correct`, `game-unprize`, `game-void`) | from the week's end until 24 h after the seal; never once finalizing starts | — |
| Pause new deposits (`pause on`) | immediate | `pause off`. **Never** `admin set_paused paused=false` (text "false" counts as on) |
| Set the operator (`set_operator`) | immediate | set it again |
| Register the pool's producer key (`register-key node`) | immediate (about a minute) | register the old key again |
| Vault upgrade (`upgrade schedule` → `apply`, incl. the withdrawals-only build) | 48 h | a new owner accept wipes a pending upgrade |
| Owner handover (`propose_owner` → `accept_owner`) | 28,800 blocks (~1 day), no expiry | no cancel: propose **your own address** again to replace a pending one |
| Contract Mana limit (`set_sponsor_limit`) | immediate | now **0**: the vault pays Mana for no one (D-099) |
| Claim the 5% fee (`claim-fee-vhp all`) | after each close | — |
| Minimum stake | from the next week | — |

### Swap Desk v2 (`1FKTpX…`)
| Power | Wait | Undo / note |
|---|---|---|
| Fee (≤ 10%, now 3%), daily payout cap, node key | **lower fee, higher cap or new node key: 48 h**, then `settings apply`; a higher fee or lower cap applies at once ✅ | every announcement must be carried out within 7 days |
| Pause swaps | immediate | `pause off` |
| Withdraw KOIN/VHP | immediate, **always to the treasury** | — |
| Treasury change (`schedule_treasury` → `apply_treasury`) | 48 h, then within 7 days | `treasury cancel` |
| Upgrade | 48 h | — |
| Owner handover (`propose_owner` → `accept_owner`) | 48 h, then within 7 days; the accept wipes pending treasury, upgrade and settings | `owner cancel` |

### Picks (`1LmgqB…`)
| Power | Wait | Undo / note |
|---|---|---|
| Announce a game → apply | 48 h | a Picks owner handover **kills every pending announcement and upgrade** |
| Pause a game (`picks -- pause <id> --mainnet`) | immediate | restarting needs a new announcement and 48 h |
| Upgrade (announced code) | 48 h | Picks v2 (CARD type) planned for Combo (D-060) |
| Owner handover (`owner-propose` → `owner-accept`, #180) | 48 h, then within 7 days | `owner-cancel` |

### Race picks (`1EN7xU…`)
| Power | Wait | Undo / note |
|---|---|---|
| `set_config`: on/off, picks per day, **owner** | **none, immediate** | a wrong owner address loses control at once; always use `npm run racepicks -- owner` (it double-checks) |

### Mana sponsor (`1ByDDS…`)
| Power | Wait | Undo / note |
|---|---|---|
| `config` (caps, vault switch, per-action limits), `enable` / `disable`, `upload` code | **immediate** (its own key) | see `SPONSOR.md` §6 (rollback) |

---

## 4. Block-producer public keys

Producer keys sign blocks. They **can't move funds or redirect rewards**: blocks are always credited to the registered address.

| Node | Produces for | Public key (safe to share) | Re-register |
|---|---|---|---|
| **Game / pool** | Vault `1Mpmf2…` (Knode Games Pool) | `Ak0vGklNyfkjroA5_nT04sfBy_IkloaNbXYiOClcjMm3` ✅ | owner, `npm run bot -- register-key node --send`, **immediate** |
| **Desk** | Swap Desk `1FKTpX…` | `AzCYCDLDa49PPVHKk60xQbOErS6XY1TcEA8bkSo8Sk6E` ✅ | owner, `npm run desk -- register-key node --send`, then **48 h** and `settings apply` |
| **Personal** | `1DAHmr…` (owner's own) | ❓ (`npm run bot -- node-key personal`) | `producer.html` from Kondor, immediate |

**Never delete a node's `block_producer` folder.**

---

## 5. Rules for every key

- **Never paste a private key or recovery words** into a chat, an email, a screenshot or GitHub. A key that leaks is replaced at once.
- Every mainnet tool is a **dry run until `--send`**, and also needs `CONFIRM_MAINNET=yes` (D-004).
- **Never run `npm run bot -- keys`** (or `desk -- keys`, `picks -- keys`): they create new random keys for any missing entry.
- **GitHub:** only the owner has write access; the operator key is the only secret, in the `bot` environment; any personal access token is fine-grained, this repo only, never Contents: write.
- **Later (roadmap):** a 2-of-3 **multisig owner**, so one key can't act alone.

---

## 6. Testnet (worthless test coins; listed so they're never confused with mainnet)

| What | Address |
|---|---|
| Vault v6 test copy | `1MXay5pSvPNzc8sBcZAMWfqaY4T9DkBvLn` (owner = operator = seed = `1GtQHbDsC2yAEguR6uNQpjksuon2kxyJbr`, I-017) |
| Picks (Block X, Last Node tests) | `12xNetHpajRi8Xrv4ub8MbMWWjC2q7VrX5` |
| Picks v2 (Combo, game 98) | `1PQZWWHbGnzHQW99frzJLmQLZ4Lwpjj8rX` (test player `19B9gUwbD9aJeDYRjJGMLzQ8PnRhCmpNX3`) |
| Picks (Fantasy, games 4 and 5) | `1DZX8RVrXmG6VBYBHZi9QF3VyM7CYwSsPw` |
| Mana sponsor (test, OFF) | `1Dg8zKeHFRvEZeF1o4thSUs6eC2zHNg7qC` |
| tKOIN / test VHP | `1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju` / `17n12ktwN79sR6ia9DDgCfmw77EgpbTyBi` |

## 7. Public keys that belong in the page
- **PostHog project key** (`phc_mheGAgU6…`): a public, write-only key meant to be in the page (visit counting, D-143). The owner holds the PostHog account login; it is not in the repo.
