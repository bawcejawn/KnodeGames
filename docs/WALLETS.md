# Knode wallets: roles, overlaps, and the lock-tight map

Never paste a private key or recovery words into a chat, an email or GitHub (except `OPERATOR_WIF` as a GitHub
secret). Keys live only in `.env` on your PC, or on paper for cold wallets.

## Rule for an additive game platform

Each **role** gets its own key. Compromise of one role must not empty another role’s funds.

| Layer | Shared across games? | Examples |
|---|---|---|
| Platform ops (owner) | Yes — one ops key for game / desk / race settings / vault | Pause, correct, upgrade announce |
| Seed / pool capital | Separate from ops | Game seed owner |
| Desk treasury | Cold only — never = owner | Where Desk KOIN/VHP can be withdrawn |
| Mana sponsor | Shared float for free play | Pays Mana within caps |
| Bot operator | Shared | Posts/resolves only — cannot move funds |
| Per-game deploy keys | Per contract | `RACE_WIF`, picks/vault upload key |
| Contracts themselves | N/A | Game, Desk, Race, Picks addresses — not operator wallets |

New games add a **contract + optional deploy key**. They reuse ops, sponsor, and operator. They never reuse the
cold treasury or seed key.

## Today (live mainnet addresses)

| Wallet | Address | Roles it holds now | Overlap? |
|---|---|---|---|
| Ops / admin | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` | Game owner, Desk owner, **Desk treasury** | **Yes — treasury = owner (fix this week)** |
| Seed | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` | Game seed owner only | OK — already split from ops |
| Operator (bot) | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` | Posts / resolves questions | OK — keep separate |
| Mana sponsor | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | Pays player Mana (keep ≥5,000 KOIN) | OK — never on GitHub |
| Game contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | Holds player stakes | Not a human wallet |
| Desk contract | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | Swap liquidity | Not a human wallet |
| Race picks | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | Stores picks (no funds) | Deploy key = `RACE_WIF` (offline after upload) |
| Vault / picks | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | Multi-game vault surface | Keep deploy key offline |

## What to create this cleanup week

You create wallets in **Kondor on your PC** (or KOIN Vault). This repo never stores new WIFs. After you have each
**address**, you run the on-chain commands below and we record the address in `*-data/deployment.json`.

### Create now (before / during Vault ship week)

| # | New wallet | Purpose | Export WIF? | Fund with |
|---|---|---|---|---|
| **1** | **Cold Desk treasury** | Only address Desk withdrawals can go to | **No** — paper recovery only; never connect to a site | Nothing required to receive |
| **2** | *(Optional this week)* **Ops owner rotate** | Fresh game + Desk + race settings owner if `1635QU…` ever touched a browser | Yes → `.env` as `OWNER_WIF` | ~100 KOIN Mana for admin txs |
| — | Seed | Already live as `1K8VV…` | Keep as `SEED_WIF` | Already funded |
| — | Operator | Already live as `1HsM33…` | Keep as GitHub `OPERATOR_WIF` | ~5 KOIN |
| — | Sponsor | Already live as `1ByDDS…` | Keep as `SPONSOR_WIF` only in `.env` | ≥5,000 KOIN |

**Minimum for lock-tight this week: create wallet #1 (cold treasury).** That removes the only high-impact overlap
(Desk owner == treasury). Owner rotation (#2) is additive hardening after Vault week if you want a clean ops key.

### Do not create / do not merge

- Do **not** put sponsor, seed, treasury, race, or owner keys on GitHub.
- Do **not** reuse the cold treasury as owner, seed, sponsor, or operator.
- Do **not** use one WIF for “everything admin” once treasury is cold — owner may still govern, but cannot silently
  equal the receive address for Desk drains without a 48 h public treasury change.

## Creating a wallet (Kondor), step by step

1. Chrome → new browser profile just for Knode ops (top-right profile → Add). Install Kondor in that profile.
2. Kondor → **Create new wallet** → strong password.
3. Write recovery words **on paper**, twice, two places. No photos, no cloud, no chat.
4. Copy the **address** (starts with `1`). Sharing the address is safe — send that address in chat / PR comments.
5. Export WIF **only** for roles that must sign from `.env` (owner, operator, sponsor, race deploy). Paste straight
   into `.env` on your PC. Never into GitHub Issues, Slack, or this repository.
6. **Cold treasury:** stop after step 4. Never export its key. Never connect it to knodegames.com or any dapp.

## On-chain steps once you have the cold treasury address

Replace `<COLD>` with the new address.

```text
# 1) Announce (dry run first)
npm run desk -- treasury schedule <COLD>
npm run desk -- treasury schedule <COLD> --send

# 2) Wait 48 hours (bot will email the announcement)

# 3) Apply
npm run desk -- treasury apply
npm run desk -- treasury apply --send

# 4) Record in the repo (PR): desk-data/deployment.json "treasury": "<COLD>"
# 5) Confirm
npm run desk -- status
npm run bot -- chain-check
```

### Desk daily swap cap (same week)

`daily_cap == 0` means uncapped. After you pick a KOIN/day number (example: `500` if liquidity is a few thousand KOIN):

```text
npm run desk -- daily-cap 500
npm run desk -- daily-cap 500 --send
# If the command says it waits 48 h (raising/removing a cap), later:
npm run desk -- settings apply --send
```

Lowering a cap applies immediately; raising or removing waits 48 h then `settings apply`.

## Target map (after treasury move)

| Wallet | Role | Where the key lives |
|---|---|---|
| **Ops owner** | Game owner, Desk owner, race/vault settings | `.env` `OWNER_WIF` + paper. Never a website |
| **Seed owner** | Game seed only (`1K8VV…` today) | `.env` `SEED_WIF` + paper |
| **Cold treasury** | Desk withdrawal destination only | Paper only |
| **Operator** | Bot post/resolve | GitHub env `bot` → `OPERATOR_WIF` + `.env` |
| **Mana sponsor** | Player Mana float | `.env` `SPONSOR_WIF` only |
| **Race deploy** | Upload race bytecode | `.env` `RACE_WIF` offline after upload |
| **Game / Desk / Race / Vault contracts** | On-chain accounts | Contract WIFs offline backups only |

## Order and timing (ship week)

| When | What | Notes |
|---|---|---|
| **Today** | Create cold treasury; `treasury schedule` | 48 h clock starts — apply mid-week |
| **Today** | Set or confirm Desk `daily-cap` | Liquidity guard, not theft prevention |
| Vault afternoon | Do **not** rotate ops/sponsor mid-announcement | Keep wallet.js / sponsor pins stable |
| Mid-week (+48 h) | `treasury apply`; update `desk-data/deployment.json` | Then `chain-check` |
| Later (optional) | Rotate ops owner to a fresh Kondor wallet | After Vault week; use propose/accept flows |
| Sundays only | Operator rotate if needed | Independent of treasury |

### Operator rotate (Sunday only)

1. Fund new operator ~5 KOIN.
2. `npm run bot -- admin set_operator operator=<new> --as owner`, then `--send`.
3. GitHub → Environments → `bot` → update `OPERATOR_WIF` immediately.
4. Update `.env`; record address in `game-data/deployment.json` `"operator"`.
5. Run Kpred bot workflow once; move leftover KOIN off the old operator.

### Owner handovers (optional hardening, after ship week)

1. Game: `npm run bot -- admin propose_owner new_owner=<new> --as owner --send`
2. Seed: only if you also want a new seed — usually **keep** `1K8VV…`
3. Desk: `npm run desk -- owner propose <new> --send`
4. `.env`: `NEW_OWNER_WIF` for accept steps only
5. ~1 day later: game/seed `accept_*`; 48 h after Desk propose: `npm run desk -- owner accept --send`
6. Point `OWNER_WIF` at the new key; update both `deployment.json` owner fields; `chain-check`
7. Empty old `1635QU…` into ops or cold treasury; keep old recovery until verified, then retire

**Finish Desk treasury before any Desk owner handover** — accepting a new Desk owner clears a pending treasury change.

## GitHub: what protects `main`

The hourly bot pushes `game-data/` to `main`, so `main` cannot require PRs yet. Controls that matter:

- Only you have write access. No extra collaborators.
- Personal tokens (e.g. heal alerts): **Actions** only — never **Contents: write**.
- Only `OPERATOR_WIF` lives in GitHub (environment `bot`, main only).

Later: bot output on a data branch → then `main` can require reviewed PRs.
