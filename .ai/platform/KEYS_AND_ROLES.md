# Knode Games — Keys and Roles

> **Purpose:** every wallet, contract and key that Knode Games depends on: its **public address**, what it can do, where its key lives (hot, cold, offline, GitHub), who uses it and when, and what to do if it's lost or stolen. **No private key, recovery words or token value is ever written here** — only addresses, public keys and the *names* of `.env` entries and GitHub secrets.
> **One home:** this page is the inventory of **who controls what, today**. How to *move* a wallet safely (the weekend runbook) stays in `../../docs/WALLETS.md`; what to do when a key leaks stays in `RUNBOOK.md` §7.
> **Last updated:** Thu 5 Nov 2026 (status sync: the v6.1 upload comes before the vault handover; dates now in `CALENDAR.md`). Built 4 Nov from `docs/WALLETS.md` (3 Nov), `game-data/deployment.json`, `desk-data/deployment.json`, `sponsor-data/deployment.json`, `race-data/deployment.json`, `picks-data/deployment.json`, `PLATFORM.md`, `KOINOS.md`, `ARCHITECTURE.md` and the decisions D-012, D-022, D-061, D-083 – D-085, D-096, D-099, D-105, D-106.
> **Update rule:** change a row the same day a wallet, owner, treasury, operator or key location changes (a send, an accept, a `.env` clean-up). Then update `docs/WALLETS.md` §1 and the deployment files' records (the Vault chat's PR). Check this page in every weekly review.
> **Marks:** ✅ checked in the repo or on chain · 👤 the owner said · 💬 a chat reported · ❓ not verified. **Hot** = on the owner's PC in `.env` all the time · **Action-day** = loaded into `.env` only for an owner action, then removed · **Cold** = paper only · **GitHub** = a GitHub secret, never on the PC.

---

## 1. At a glance: the five keys that matter most

| Rank | Key | Can do, if stolen | Where it lives today | Planned |
|---|---|---|---|---|
| 1 | **Mana sponsor** `SPONSOR_WIF` | move the sponsor's **25,000 KOIN at once**, no wait | **Hot** (`.env`) + paper | accepted risk (D-085); option: most KOIN cold, small float (owner to decide) |
| 2 | **Owner** `OWNER_WIF` (`1635QU…`, until the handover; then the cold `1LMV8E…`) | announce vault / Desk upgrades and owner changes (48 h or ~1 day notice, you get an email); **order Desk withdrawals to the treasury, which is the same wallet today**; pause; correct results | **Hot** (`.env`) + paper | `1635QU…` signs the v6.1 announce and upload first; then the cold owner `1LMV8E…` takes the vault and the Desk (propose after the upload, accepts Tue 10; dates: `CALENDAR.md`; D-083) |
| 3 | **Seed owner** `SEED_WIF` (`1K8VV…`) | start a withdrawal of the 21,050 VHP seed (48 h wait) | **Hot** (`.env`) + paper | unchanged (D-022) |
| 4 | **Race picks contract** `RACE_WIF` | **replace the Race picks code** (it was uploaded with no overrides) | **Hot** (`.env`) ❓ | offline at the weekend clean-up (TODOS; `docs/WALLETS.md` step 6) |
| 5 | **Operator (bot)** `OPERATOR_WIF` (`1HsM33…`) | post wrong results (correctable for 24 h after a seal); can't move funds | **GitHub** secret, environment `bot` | unchanged (D-084) |

---

## 2. People's wallets (each has its own key)

| Wallet | Address | What it controls | Key: where it lives | Used by / when | If lost | If stolen |
|---|---|---|---|---|---|---|
| **Owner** | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` ✅ | Vault owner, Desk owner, Picks owner (built into `bot/picks.ts` as `MAINNET_OWNER` ✅; on chain ✅ `1635QU…`, read 5 Nov; after the handover, read from `picks-data/deployment.json` `"owner"`); **also the Desk treasury** ✅ | `.env` `OWNER_WIF` 👤 (hot) + paper 👤 | Owner: every owner action (fee claim, `game-add`, `game-apply`, corrections, pause, upgrades); signs the v6.1 announce and upload (`CALENDAR.md`) | Restore from paper. Without paper: no new games, no upgrades, no corrections; stakes stay withdrawable | `RUNBOOK.md` §7: you have the notice period (48 h Desk/upgrades, ~1 day vault owner) to propose your own address again |
| **Desk treasury** | same as the owner, `1635QU…H717` ✅ | Receives every Desk withdrawal. One key both orders and receives a withdrawal, with no wait (TD-01) | same as owner | — | as owner | as owner; the main reason for the weekend move |
| **Seed owner** | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` ✅ (since 30 Oct, D-022) | The vault's seed, 21,050 VHP ✅. Deposits; withdrawals wait 48 h and pay the current seed owner | `.env` `SEED_WIF` 👤 + paper | Owner, rarely (seed top-ups) | Restore from paper; the seed stays in the vault and keeps producing | Vault chat at once; seed owner change is two steps 28,800 blocks apart; a pending seed withdrawal can be cancelled by a seed-owner change |
| **Operator (bot)** | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` ✅ (since 26 Oct) | Posts and resolves questions; posts, seals and finalizes game results. Can't move funds. Pays its own Mana (target ~50 KOIN, I-046) | **GitHub only**: secret `OPERATOR_WIF` in environment `bot` (D-084, D-012) | The hourly bot | Owner sets a new operator: `npm run bot -- admin set_operator operator=<new> --as owner`, then updates the secret | Same as lost, then correct any bad results within 24 h of each seal |
| **Old operator** (retired) | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` ✅ (retired 26 Oct) | Nothing. About 100 KOIN left ❓ | **Still in `.env`**, most likely as `OPERATOR_WIF` ✅ | Nobody | — | Only its ~100 KOIN; sweep Sat 7 Nov (`tools/sweep-old-bot.ts`, I-045), then delete the line |
| **New owner (cold)** — today the **Race picks owner** | `1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd` ✅ (created by the owner; Race picks moved to it 4 Nov, tx `0x1220bd9c…`) | Race picks settings now (`set_config`: on/off, picks per day, owner — **one step, immediate**). **Becomes the owner of the vault and the Desk** at the handover accepts (Tue 10 Nov; `CALENDAR.md`); Picks later (D-106) | **Paper only** (own recovery words, two copies); in `.env` as `OWNER_WIF` only on owner-action days (D-083, option A); `NEW_OWNER_WIF` removed 4 Nov 👤 | Owner, on action days | Restore from its paper | Before the handover: Race picks settings at once (tell the Race chat). After: as the owner row (§7 of `RUNBOOK.md`) |
| **Personal producer** | `1DAHmrQJMAbn4FmMMrew78wPUizjVdbBrd` ✅ (nickname `@primeprocuder`, fix to `@primeproducer`, I-084) | The owner's own VHP and block production (not Knode Games funds) | Kondor (owner's own recovery words) 👤 | Owner | Restore from recovery words | Owner's own funds; not a platform risk. Watched by the node watchdog (`PERSONAL_PRODUCER` variable) |
| **Cold treasury** (planned) | ❓ created Fri 6 Nov | Will receive Desk withdrawals | **Paper only**, own recovery words, separate Chrome profile deleted after creation; never loaded except once to confirm its address | Nobody (it only receives) | — | — |

**The owner and the cold treasury must never share recovery words, a browser profile or a hiding place for their paper** (`docs/WALLETS.md` §2).

---

## 3. Contracts

Each contract is also an account with its own key. With the upload rules on, most of those keys have no power left; one still does.

| Contract | Address | Code on chain | Owner (who can change it) | Its own key: `.env` name · power today | Where that key should live |
|---|---|---|---|---|---|
| **Vault v6** (the game contract; also the **Knode Games Pool** producer, D-073) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` ✅ | `eed38f7c…` ✅ (withdrawals-only build `e84fec49…` ready); v6.1 `11043e1f…` (PR #114) next, withdrawals-only `04c27c1a…` pinned after its upload (`CALENDAR.md`) | Owner `1635QU…` ✅ | `CONTRACT_WIF` · none (uploads need the owner's announced upgrade) ✅ | offline / paper (to move out of `.env` Tue 10 Nov) |
| **Swap Desk v2** (Knode Swap) | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` ✅ | `309506cc…` ✅ (since 28 Oct) | Owner `1635QU…` ✅; treasury `1635QU…` ✅ | `DESK_CONTRACT_WIF` · none ✅ | offline / paper |
| **Picks** (Block X; later Survivor, Bracket, Fantasy, Last Node, Combo) | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` ✅ | `700c296a…` ✅ (since 30 Oct) | `1635QU…` ✅ (on chain, read 5 Nov). Handover tool built (#180); date: owner (suggested propose Mon 9 / accept Tue 10, after its Repo Lens and testnet run) | `PICKS_WIF` · none (uploads need the owner, the announced code and 48 h) ✅ | offline / paper |
| **Race picks** | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` ✅ | `61e8f212…` ✅ (since 27 Oct) | `1LMV8EcR…` ✅ (4 Nov) | `RACE_WIF` · **can replace the code** (uploaded with no overrides) ✅ | **offline at the weekend clean-up** (P1) |
| **Mana sponsor v3** | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | `b84e1add…` ✅ (since 4 Nov 07:27 UTC) | **itself**: its own key changes settings and code | `SPONSOR_WIF` · **full**: settings, code, and its 25,000 KOIN | **hot by decision** (D-085); see `SPONSOR.md` |

### Outside contracts we rely on (no keys of ours)

| Contract | Address | Used for |
|---|---|---|
| KOIN token | `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK` ✅ | Mana, block rewards, swaps, compounding |
| VHP token | `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq` ✅ | stakes; `effective_balance_of` for every handicap (entry `0x629f31e6`) |
| Proof of Burn (PoB) | `159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv` ✅ | block production; registered producer keys |
| Koinos Nicknames (@names) | `1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz` 💬 | player @names on the site (`names.html`, `bot/names.ts`) |

Chain id (mainnet): `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==` ✅.

**Never send KOIN or VHP to a contract address** (vault, Desk, Picks, Race picks, sponsor, tokens): it can get stuck. `tools/send-koin.ts` refuses them (`docs/WALLETS.md` §4).

---

## 4. Owner powers, contract by contract

What only the owner can do, how long it waits, and how to undo it. "Owner" means the key in `.env` `OWNER_WIF` on that day.

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
| Fee (≤ 10%, now 3%), daily payout cap, node key | **lower fee, higher cap or new node key: 48 h**, then `settings apply`; a higher fee or lower cap applies at once ✅ (`docs/UPGRADE-V5.md`) | every announcement must be carried out within 7 days |
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
| Owner handover | 48 h | no tool yet (R-BX-3, PR #79); later (D-106) |

### Race picks (`1EN7xU…`)
| Power | Wait | Undo / note |
|---|---|---|
| `set_config`: on/off, picks per day, **owner** | **none, immediate** | a wrong owner address loses control at once; the contract key `RACE_WIF` can also replace the code |

### Mana sponsor (`1ByDDS…`)
| Power | Wait | Undo / note |
|---|---|---|
| `config` (caps, vault switch, per-action limits), `enable` / `disable`, `upload` code, move its KOIN | **none, immediate** (its own key) | see `SPONSOR.md` §6 (rollback) |

---

## 5. Block-producer keys (on the PC)

Producer keys sign blocks. They **can't move funds or redirect rewards**: blocks are always credited to the registered address. Losing one stops that node's production until a new key is registered.

| Node | Produces for | Public key (safe to share) | Private key file | Re-register | Watched by |
|---|---|---|---|---|---|
| **Game / pool** | Vault `1Mpmf2…` (Knode Games Pool) | `Ak0vGklNyfkjroA5_nT04sfBy_IkloaNbXYiOClcjMm3` ✅ | `C:\kpred-node\basedir\block_producer\private.key` (or its Docker volume) | owner, `npm run bot -- register-key node --send`, **immediate** | self-heal task |
| **Desk** | Swap Desk `1FKTpX…` | `AzCYCDLDa49PPVHKk60xQbOErS6XY1TcEA8bkSo8Sk6E` ✅ | `C:\kpred-desk-node\basedir\block_producer\private.key` | owner, `npm run desk -- register-key node --send`, then **48 h** and `settings apply` | self-heal task |
| **Personal** | `1DAHmr…` (owner's own) | ❓ (`npm run bot -- node-key personal`) | `C:\koinos-personal\…\block_producer\private.key` | `producer.html` from Kondor, immediate | self-heal + **Node watchdog** (GitHub) |

**Never delete a `basedir\block_producer` folder.** Pinning the Desk node key is still an owner to-do (TODOS → Later).

---

## 6. Secrets and tokens outside `.env` keys

| Name | Where | Power | Used by | Rule |
|---|---|---|---|---|
| `OPERATOR_WIF` | GitHub → Settings → Environments → **`bot`** | the operator key (§2) | `bot.yml` and the game workflows that sign | **the only GitHub secret**; confirm no repo-level copy exists (TODOS, D-012) |
| `GITHUB_ALERT_TOKEN` | PC `.env` | fine-grained, this repo only, **Actions: read and write**, never Contents: write | `bot/heal.mjs`, `bot/release-kick.mjs` (start workflows → alert emails) | if leaked: revoke in GitHub → Settings → Developer settings; it can only start the repo's own workflows |
| GitHub account | the owner | push to `main`, merge, secrets, rulesets | owner only | add no collaborators; `main` blocks deletion and force-push only (the bot must push) |
| Repo variables (not secrets) | GitHub → Variables | none: settings only | e.g. `RPC`, `PERSONAL_PRODUCER`, `PRIZES_FROM_WEEK`, `GAMES_ENABLED` | safe to read; changing them changes behaviour |

---

## 7. `.env` on the PC: every key entry, by name

| Entry | Wallet | Today | After the weekend (Tue 10 Nov) |
|---|---|---|---|
| `OWNER_WIF` | owner `1635QU…` | present (hot) | **new** owner key, **only on action days**; old owner key only for a Picks action |
| `NEW_OWNER_WIF` | — | **absent** ✅ (removed 4 Nov 👤) | only during Tue's two accepts, then removed |
| `SEED_WIF` | seed owner `1K8VV…` | present | unchanged |
| `SPONSOR_WIF` | sponsor `1ByDDS…` | present | unchanged (D-085) |
| `OPERATOR_WIF` | most likely the **old** operator `1JSTwo…` | present ❓ | **removed** after Sat's sweep (D-084) |
| `CONTRACT_WIF`, `DESK_CONTRACT_WIF`, `PICKS_WIF`, `RACE_WIF` | the four contracts | present ❓ | removed; paper / offline only |
| `GITHUB_ALERT_TOKEN` | — (GitHub token) | present | unchanged |
| `CONFIRM_MAINNET` | — (safety switch) | should be **absent** | add `=yes` right before a send, remove right after (`SPONSOR.md` §5) |

**Never run `npm run bot -- keys`** (or `desk -- keys`, `picks -- keys`): they create new random keys for any missing entry.

---

## 8. Testnet (worthless test coins; listed so they're never confused with mainnet)

| What | Address |
|---|---|
| Vault v6 test copy | `1MXay5pSvPNzc8sBcZAMWfqaY4T9DkBvLn` (owner = operator = seed = `1GtQHbDsC2yAEguR6uNQpjksuon2kxyJbr`, key only in the Vault chat's sandbox, I-017) |
| Picks (Block X, Last Node tests) | `12xNetHpajRi8Xrv4ub8MbMWWjC2q7VrX5` |
| Picks v2 (Combo, game 98) | `1PQZWWHbGnzHQW99frzJLmQLZ4Lwpjj8rX` (test player `19B9gUwbD9aJeDYRjJGMLzQ8PnRhCmpNX3`) |
| Picks (Fantasy, games 4 and 5) | `1DZX8RVrXmG6VBYBHZi9QF3VyM7CYwSsPw` |
| Mana sponsor (test, OFF) | `1Dg8zKeHFRvEZeF1o4thSUs6eC2zHNg7qC` |
| tKOIN / test VHP | `1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju` / `17n12ktwN79sR6ia9DDgCfmw77EgpbTyBi` |

Fantasy practice wallets and old test wallets: to empty and retire after launch (TODOS → Later).

---

## 9. Open questions about keys

- ❓ Is Picks' on-chain owner `1635QU…`? (Step 0 of the weekend runbook prints it: `npm run picks -- status`.)
- ❓ Exactly which contract keys are still in `.env` (step 0 / `npm run bot -- status` shows only addresses).
- ❓ The personal node's public key.
- ✅ Owner decided (4 Nov): back up all three producer `private.key` files offline (USB), once the backup script exists (R-VAULT-10); see `RECOVERY.md` §2.
- ❓ Owner decision: keep most of the sponsor's 25,000 KOIN in a cold wallet with a working float (`SPONSOR.md` §7).
- Later (roadmap): a 2-of-3 **multisig owner**, so one stolen key can't act alone.

## Public keys that belong in the page
- **PostHog project key** (`phc_mheGAgU6…`): a public, write-only key meant to be in the page (visit counting, D-143). The owner holds the PostHog account login; it is not in the repo.
