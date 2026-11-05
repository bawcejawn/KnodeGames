# Knode Games — Contract Register

> **Purpose:** the one table of every live Knode Games contract (the only code that can hold or control tokens, tier 1 in `REPO_MAP.md`): address, the build that's live, when it went up, how it can change, who controls it, and its last review. Start every audit, upgrade or rollback here.
> **Last updated:** 2026-11-05 (first written, from the `*-data/deployment.json` files, `KEYS_AND_ROLES.md` and the review history)
> **Rule:** every upload changes this page **in the same records PR** that updates the deployment file. A hash here must match the deployment file and the chain (`npm run bot -- chain-check`, `npm run sponsor -- status`, `npm run picks -- status`).

## 1. Live contracts
| Contract | Address | Live build (sha256) | Uploaded | How it can change | Controlled by | Last review |
|---|---|---|---|---|---|---|
| **Vault v6** (stakes, rewards, Daily Questions; the Knode Games Pool producer) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` | 2 Nov 2026 (v5 → v6 in place) | announce → **48 h** → upload (`timelockLength` 172,800,000 ms) | owner `1635QU…` → cold `1LMV8E…` from Tue 10 Nov (D-096) | Vault v6 audit + fix-checks 1–4 (29 Oct) |
| **Swap Desk v2** (VHP → KOIN, 3% fee) | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506ccfaadd3427e937aa88cd34c9ea2a9e6088e49e51f014d546489dd5f35` | 28 Oct 2026 | announce → **48 h** → upload; treasury changes 48 h | owner and treasury `1635QU…` (cold owner from the handover; cold treasury planned) | the v5 / Desk v2 audit (Oct); re-check in the full audit |
| **Mana sponsor v3** (pays players' Mana within caps) | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | `b84e1add3ffa14a7d1933d5ce5a4ad33caa4bca887a489f87f710b3c121c83a6` | 4 Nov 2026 07:27 UTC | **its own key, no timelock** (settings and code) | itself (`SPONSOR_WIF`, hot, D-085) | sponsor v3 audit (27 Oct) + guest-fix #C-3 GO |
| **Picks** (Block X; later the other picks games) | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a1064b904299c156061d6caf8fcabd0b1765968903f29d89d2426c594` | 30 Oct 2026 | `upgrade-schedule` → **48 h** → `upgrade-upload` | owner `1635QU…` (handover later, D-106) | Picks audit + fix-check (27 Oct) |
| **Race picks** | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f21230e8b4bdb165bacfe7281517a5adf78f6c6b1b8a0d84ce41537afac5` | 27 Oct 2026 | settings by its owner; **code by its own key `RACE_WIF`** (uploaded with no overrides) | owner `1LMV8E…` (cold, since 4 Nov); `RACE_WIF` goes offline this weekend | Race picks audit (27 Oct) |

## 2. Builds ready but not live
| Contract | Build | Purpose | Status |
|---|---|---|---|
| Vault v6 withdrawals-only | `e84fec492d47e08f583c352bb26e3d36dc0149926c0482d0820b0dbd97af9fe3` | emergency: players can only withdraw (D-021) | pinned today as `safeWasmSha256` |
| **Vault v6.1** release | `11043e1fde1d8d7dbac75e9e5e788d058a7116b0dab6149fc09ecdc7b1c4258b` | 60-question cap, Questions on the shared rules, the bot closes weeks | Repo Lens #E-16 GO; announce Thu 5, upload Mon 9 (D-130) |
| **Vault v6.1** withdrawals-only | `04c27c1acde570b97a430dea403d41aab47e083ae30115353ee5f89932dad0bb` | the emergency build for v6.1 | pinned right after Monday's upload; **the only rollback once the rule week starts** |

## 3. History (the builds that were live)
| Contract | Build | Live | Note |
|---|---|---|---|
| Vault | v3 → v5 → **v6** `eed38f7c…` | v6 since 2 Nov | v6.1 next |
| Swap Desk | v1 `05039d74…` → **v2** `309506cc…` | v2 since 28 Oct | — |
| Mana sponsor | v2 `fa4659e6…` → v3 `b61ac238…` → **v3 guest fix** `b84e1add…` | since 4 Nov | never re-upload `b61ac238…` while the vault switch is on (it trapped guests) |
| Picks | **v1** `700c296a…` | since 30 Oct | Picks v2 (CARD type) for Combo, later |
| Race picks | **v1** `61e8f212…` | since 27 Oct | — |

## 4. Rules for every contract change
1. Build from a **tagged commit** (`<contract>-<version>`, e.g. `vault-v6.1`) so anyone can rebuild the hash (target; tags start with v6.1, ARCHITECTURE "Target architecture" A5).
2. Repo Lens on that commit, fix-check GO (`AUDITS.md`).
3. Announce (where the contract has a timelock), wait, upload; check the hash on chain.
4. Pin the matching withdrawals-only build (the vault).
5. The records PR: deployment file + this page + `CALENDAR.md`.
