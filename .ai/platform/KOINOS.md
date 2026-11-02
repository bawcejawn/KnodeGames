# Knode Games — Koinos Reference

> Purpose: Koinos chain facts this project depends on. Verify before relying on anything time-sensitive.
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (all 12 chats), repo branches `picks` and `main`.
> Project contract addresses live in `PLATFORM.md`; vault mechanics in `ARCHITECTURE.md`.

**Legend:** ✅ verified in repo · 💬 chat only · ⚠️ conflict (see `DECISIONS.md`) · ❓ unknown

## Network
| Item | Value | Last verified |
|------|-------|---------------|
| Mainnet chain id | `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==` | ✅ `*-data/deployment.json` |
| Mainnet RPC (default) | `https://koinos.armana.io` — `main` switched to it 2026-10-28 | ✅ `game-data/deployment.json` on `main` ⚠️ C-04 |
| Mainnet RPC (alternative) | `https://api.koinos.io` — returns HTML error pages intermittently; override with `$env:RPC = "https://koinos.armana.io"` where a `deployment.json` still names it | 💬 Vault ⚠️ C-04 |
| Second node for cross-checks (`RPC_CHECK`) | `https://api.koinosblocks.com` | 💬 Questions |
| Testnet (Koinos Foundation) RPC | `https://testnet.koinosfoundation.org` | 💬 Vault |
| Testnet chain id | `EiAIKVvm6-V2qmsmUvPJy09vCCLbtn9lHFpwrJbcTIEWRQ==` | 💬 Vault |
| Local test node | Harbinger on the owner's PC, `127.0.0.1:8081` (used by `bot --testnet`, `.env.testnet`, `testnet-data/`) | 💬 Vault ⚠️ C-19: the Survivor chat says the owner has no testnet node and uses the public API |
| Block explorer | {{TBD}} | |

## Tokens & System Contracts
| Item | Mainnet address | Testnet address | Notes |
|------|-----------------|-----------------|-------|
| KOIN | `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK` ✅ | tKOIN `1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju` 💬 | testnet faucet: @KoinosTestnetFaucetBot on Telegram, `/faucet <address>` gives 100 test KOIN a day — enough for a 50 KOIN contract upload plus ~6 KOIN per test player 💬 Vault, Survivor |
| VHP | `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq` ✅ | `17n12ktwN79sR6ia9DDgCfmw77EgpbTyBi` 💬 | |
| PoB (proof of burn) | `159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv` ✅ | {{TBD}} | |
| Koinos Nicknames (@names) | `1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz` 💬 | {{TBD}} | ~2,137 names on 30 Oct; reads used: `verify_valid_name`, `get_address`; mint `{to, token_id: hex(name)}` 💬 Hub |
| Fogata pools | each pool's producer address is the pool contract | | pool name: `get_pool_params` (entry 2396056273), field 1 💬 Hub |

## Project Contracts on Testnet
| Contract | Address | Notes |
|----------|---------|-------|
| Vault v6 test copy | `1MXay5pSvPNzc8sBcZAMWfqaY4T9DkBvLn` | 10-minute weeks; close delay and notice 2 min; min stake 1 VHP. Owner = operator = seed = `1GtQHbDsC2yAEguR6uNQpjksuon2kxyJbr` (key in gitignored `testnet-v6/keys.json`, I-017); ~129 tKOIN after top-up 30 Oct. Games 2 and 7 active; 3–6 and 8–13 ("Test game N") stopped. No bot: a week closes only when a player acts or someone calls `close_week`. Settings: `testnet/vault.json` on `main`. 💬 Vault |
| Picks (testnet, Block X) | `12xNetHpajRi8Xrv4ub8MbMWWjC2q7VrX5` | 💬 Hub, Block X |
| Picks v2 (testnet, Combo) | `1PQZWWHbGnzHQW99frzJLmQLZ4Lwpjj8rX` | game 98 "Combo test"; testnet build `83b251bb…`; test player `19B9gUwbD9aJeDYRjJGMLzQ8PnRhCmpNX3` 💬 Block X, Combo |
| Picks (testnet, Fantasy) | `1DZX8RVrXmG6VBYBHZi9QF3VyM7CYwSsPw` | games 4 and 5; test genesis 1793293200000 (test week 1 began Thu 29 Oct 10:00 AM PT) 💬 Fantasy |
| Last Node test games | on the Block X testnet Picks | game 94 = fast game (20-min cuts), game 33 = real timing (`testnet/lastnode.json`) 💬 Last Node |
| Testnet Mana sponsor | `1Dg8zKeHFRvEZeF1o4thSUs6eC2zHNg7qC` | OFF; still allowlists Combo's Picks v2 (I-041) 💬 Block X |

## Concepts Used by Knode Games
- **Mana:** the per-account resource that pays for transactions. Testnet resource prices (2026-10-29): compute 6 per tick, disk 7,130 per byte, network 1,079 per byte; mainnet prices are higher. Cost formula and measured costs: `ARCHITECTURE.md` → Measured on testnet. 💬 Vault. Mainnet upload Mana pricing used by the sponsor tool: 1.2 per KB + 10. 💬 Block X
- **Block production / VHP:** blocks ~3 s apart (~1,200 an hour, ~28,800 a day). Each block burns ~4.08 VHP from its signer; the block reward is paid in KOIN. **Effective VHP:** received VHP counts only after 20 blocks; removed VHP stops at once — `effective(a,H) = max(0, before(a,H) − received in H−19…H−1)`; PoB reads it before the block's own transactions. VHP contract entry `effective_balance_of` = `0x629f31e6` (never yet seen live by the project, I-061). 💬 Bracket, Golf
- **Contract payer / sponsorship:** a transaction can name a payer contract; Knode Games uses its own Mana sponsor (see `ARCHITECTURE.md`). KOIN Vault picks its own payer, so it can't use the sponsor. 💬
- **Koinos Foundation testnet** has only one block producer. 💬 Fantasy
- **Irreversible blocks:** Knode Games results count only irreversible blocks, matched on two nodes. 💬 Race
- **Storage ordering:** the real chain orders keys bytewise (confirmed on testnet, audit V2-14); MockVM needs `tools/mockvm-bytewise.cjs` to match. 💬 Vault
- **Contract upgrades:** project contracts use a schedule → 48 h → upload-within-7-days pattern (vault: `ARCHITECTURE.md` → Vault v6; Picks: `ARCHITECTURE.md` → Picks contract).
- **Time units:** vault genesis is 1792368000 in seconds (1792368000000 in milliseconds) = UTC day 20745 = Mon 19 Oct 2026 00:00 UTC. 💬 Block X, Hub, Survivor

## Wallets Supported
| Wallet | Desktop | Mobile | Notes |
|--------|---------|--------|-------|
| Kondor | browser extension | ❓ | see `ARCHITECTURE.md` → Wallets |
| KOIN Vault | ❓ | yes ❓ | uses its own payer (no sponsor); dapp name currently "Knode" (D-033) |
| Guest (site's own) | yes | yes | play-only browser key; never holds funds |

## Ecosystem Links
- Bridges: Vortex is the bridge (D-006).
- Markets: {{TBD}}
- Community: Telegram testnet faucet bot (above). {{TBD}}

## Gotchas
- **koilib 9.4.1 in the browser** puts `Provider`, `Signer` and `utils` on `window` itself, not on `window.koinos` — code must fall back to `window` (the cause of "getChainId of null", fixed in PR #49 ✅). 💬 Hub
- **Kondor `signMessage`** signs sha256 of the text — verify with `Signer.recoverAddress`. 💬 Hub. (Kondor detection and errors: `ARCHITECTURE.md` → Wallets.)
- **Koinos node traffic is blocked** from the cloud workspace and from the owner's linked PC sandbox (DNS / proxy 403): live chain reads run only in GitHub Actions. 💬 Bracket
- **`api.koinos.io` stopped answering on 28 Oct** (Golf: "dead"); see C-04. 💬 Golf, Bracket
- **Sponsor caps count each transaction's Mana *limit*** (1 per action), not the Mana it burns (~0.3). 💬 Golf
- **Testnet Mana (Combo cards):** player-paid card 2 legs 0.0588, 6 legs 0.0726, 10 legs 0.0916, change 0.0538; Picks v2 upload 3.2528 on testnet, ~55 estimated on mainnet. 💬 Combo
- **Busy Mana (code 104, "insufficient pending account resources")** on back-to-back actions — wait a minute and retry. 💬 Vault, Hub
