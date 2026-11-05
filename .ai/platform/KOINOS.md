# Knode Games — Koinos Reference

> **Purpose:** the Koinos chain facts this project depends on. Verify anything time-sensitive before relying on it.
> **Last updated:** 5 Nov 2026 (status sync; consolidated 2 Nov)
> **Sources:** all 12 chat exports, the owner's answers on 2 Nov, and the repo. Project contract addresses live in `PLATFORM.md`; how the project's contracts work lives in `ARCHITECTURE.md`.

**Legend:** ✅ verified in the repo · 💬 from a chat · 👤 owner said so · ⚠️ open contradiction · ❓ unknown

## Mainnet
| Item | Value | |
|------|-------|-|
| Chain id | `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==` | ✅ |
| Primary RPC | `https://koinos.armana.io` — used by the site, bot and recorders (`main` switched 28 Oct) | ✅ `app.js`, `swap.js`, `header-wallet.js`, `game-data/deployment.json` |
| Check node (`RPC_CHECK`) | `https://api.koinosblocks.com` — every on-chain check must agree on both. Still in service: the bot and Race read it successfully on 3 Nov. It's a checker, not a fallback — if Armana fails the bot stops and retries next hour (e.g. Armana outage ~03:45–05:05 UTC, 3 Nov) | ✅ |
| `api.koinos.io` | unreliable: HTML error pages, stopped answering 28 Oct. Where a `deployment.json` still names it, override with `$env:RPC = "https://koinos.armana.io"` (I-006, I-015) | 💬 |
| Block time | ~3 s: ~1,200 blocks an hour, ~28,800 a day | 💬 |
| Block explorer | Koinosscan (linked in the site footer, D-050) | 💬 |

## Tokens and system contracts
| Item | Mainnet | Testnet | Notes |
|------|---------|---------|-------|
| KOIN | `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK` ✅ | tKOIN `1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju` 💬 | block rewards are paid in KOIN |
| VHP | `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq` ✅ | `17n12ktwN79sR6ia9DDgCfmw77EgpbTyBi` 💬 | `effective_balance_of` = entry `0x629f31e6` (never yet seen live by the project, I-061) |
| PoB (proof of burn) | `159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv` ✅ | ❓ | |
| Koinos Nicknames (@names) | `1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz` 💬 | ❓ | ~2,137 names on 30 Oct; reads `verify_valid_name`, `get_address`; mint `{to, token_id: hex(name)}` |
| Fogata pools | each pool's producer address is the pool contract | | pool name = `get_pool_params` (entry 2396056273), field 1 |
| Token entry points | `approve` 0x74e21680 · `balance_of` 0x5c721497 | | 💬 |

## How the chain behaves (what our games rely on)
- **Block production and VHP:** each block burns ~4.08 VHP from its signer; the reward is paid in KOIN. 💬
- **Effective VHP:** VHP received counts only after 20 blocks; VHP removed stops counting at once: `effective(a,H) = max(0, before(a,H) − received in H−19…H−1)`. PoB reads it before the block's own transactions. All games measure VHP this way (the VHP standard, D-058). 💬
- **Irreversible blocks only:** every recorder counts only irreversible blocks, matched on two nodes. 💬
- **Storage order:** the real chain orders keys bytewise (confirmed on testnet, audit V2-14); the MockVM needs `tools/mockvm-bytewise.cjs` to match. 💬
- **Mana:** the per-account resource that pays for transactions. Cost per call = ticks × compute price + disk bytes × disk price + network bytes × network price. Testnet prices (29 Oct): compute 6 per tick, disk 7,130 per byte, network 1,079 per byte; mainnet prices are higher (v6 upload: 46.84 KOIN of Mana on mainnet vs 7.53 on testnet). Upload estimate used by the tools: 1.2 Mana per KB + 10. Measured costs per action: `ARCHITECTURE.md`. 💬
- **Payer:** a transaction can name a payer contract; Knode Games uses its own Mana sponsor. KOIN Vault picks its own payer, so its users can't use the sponsor (I-007). 💬
- **Upgrades:** the project's contracts use schedule → 48 h → upload within 7 days → clear (details per contract in `ARCHITECTURE.md`). 💬
- **Time:** vault genesis = 1792368000 s = 1792368000000 ms = UTC day 20745 = Mon 19 Oct 2026 00:00 UTC; week = floor((t − genesis) / 7 days), Monday to Monday. Players will see the week of Mon 9 Nov as "Week 1" (D-063). How every game's week runs (play days, review day, final, payout): `../standards/WEEK_CYCLE.md`. ✅ / 💬
- **Three week labels — check which one a chat means:**

  | Week | Vault number (files, `W<n>.json`, contract) | Questions game label (v5, counts from 1) | What players will see (D-063) |
  |------|------|------|------|
  | 19–26 Oct | 0 | Week 1 | — |
  | 26 Oct – 2 Nov | 1 | Week 2 | — |
  | 2–9 Nov | 2 | Week 3 | — |
  | 9–16 Nov | 3 | Week 4 | Week 1 |
  | 16–23 Nov | 4 | Week 5 | Week 2 |

  On chain: `reward_rule_week_plus_one = 3` (v5 split from vault week 2) and `v6_rule_week_plus_one = 4` (v6 rules from vault week 3, Mon 9 Nov) ✅ read by the Questions chat, 2 Nov. 💬

## Testnet
The project uses **only the public Koinos Foundation testnet**; the owner runs no testnet nodes (D-066).

| Item | Value | |
|------|-------|-|
| RPC | `https://testnet.koinosfoundation.org` (public API) | 💬 |
| Chain id | `EiAIKVvm6-V2qmsmUvPJy09vCCLbtn9lHFpwrJbcTIEWRQ==` | 💬 |
| Producers | only one block producer | 💬 |
| Faucet | Telegram @KoinosTestnetFaucetBot: `/faucet <address>` = 100 test KOIN a day (a contract upload ~50; ~6 per test player) | 💬 |
| Vault v6 test copy | `1MXay5pSvPNzc8sBcZAMWfqaY4T9DkBvLn` — 10-minute weeks; close delay and notice 2 min; min stake 1 VHP; owner = operator = seed = `1GtQHbDsC2yAEguR6uNQpjksuon2kxyJbr` (key only in the Vault chat's sandbox, I-017); games 2 and 7 active; no bot; settings `testnet/vault.json` | 💬 |
| Picks (Block X; also Last Node test games 94 and 33) | `12xNetHpajRi8Xrv4ub8MbMWWjC2q7VrX5` | 💬 |
| Picks v2 (Combo, game 98) | `1PQZWWHbGnzHQW99frzJLmQLZ4Lwpjj8rX` — build `83b251bb…`; test player `19B9gUwbD9aJeDYRjJGMLzQ8PnRhCmpNX3` | 💬 |
| Picks (Fantasy, games 4 and 5) | `1DZX8RVrXmG6VBYBHZi9QF3VyM7CYwSsPw` — test genesis 1793293200000 | 💬 |
| Mana sponsor | `1Dg8zKeHFRvEZeF1o4thSUs6eC2zHNg7qC` — OFF; still allowlists Combo's Picks v2 (I-041) | 💬 |
| Local "Harbinger" node | **not used** — `bot --testnet` and the admin page's "Vault v6 trial (local node)" still point at one (I-068) | 👤 D-066 |

## Wallets
| Wallet | Desktop | Mobile | Notes |
|--------|---------|--------|-------|
| Kondor | browser extension | ❓ | detection and error handling: `ARCHITECTURE.md` → Wallets |
| KOIN Vault | ❓ | ✅ ❓ | its own payer, so no sponsor; dapp name still "Knode" (D-033, I-007) |
| Guest (the site's own) | yes | yes | play-only browser key, never holds funds |

## Ecosystem
- **Bridge:** Vortex (D-006).
- **Markets / community:** ❓

## Gotchas
- **koilib 9.4.1 in the browser** puts `Provider`, `Signer` and `utils` on `window`, not `window.koinos` — fall back to `window` (PR #49 fixed "getChainId of null"). 💬
- **Kondor `signMessage`** signs sha256 of the text — verify with `Signer.recoverAddress`. 💬
- **Busy Mana (code 104,** "insufficient pending account resources") on back-to-back actions — wait a minute and retry. 💬
- **Sponsor caps count each transaction's Mana *limit*** (the per-action row), not the Mana actually burned (rows and measured costs: `SPONSOR.md`). 💬
- **Koinos node traffic is blocked** from the AI cloud workspace and the linked-PC sandbox (DNS / proxy 403): live chain reads run only in GitHub Actions or on the owner's own shell. 💬
- **Armana** has shown browser CORS failures under bursts (likely rate limits); the site queues reads 4 at a time. 💬
