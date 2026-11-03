# Knode Games — Chat Knowledge Archive

> Purpose: Raw facts and decisions pulled from past chats, waiting to be sorted
> into the right .ai file. This is an inbox, not a source of truth.
> Rule: Once an item is moved to its proper file, mark it "Filed → <file>".

## How to Add an Entry
Copy the block below. One entry per fact or decision.

---

### {{TBD: short title}}
- **Date:** {{TBD: YYYY-MM-DD}}
- **Source chat:** {{TBD}}
- **Category:** {{TBD: decision / fact / idea / open question / warning}}
- **Content:** {{TBD}}
- **Status:** {{TBD: unsorted / Filed → path}}

---

## Chat: Questions (exported 2026-11-02)

The Knode questions game (game 1), the site, the Mana sponsor, guest play, the nodes and their operations.

---

### Questions: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Questions
- **Category:** fact
- **Content:**
  - **Identity and hosting**
    - The project was renamed from Knode to KnodeGames. The live site is https://knodegames.com, set up with a CNAME on GitHub Pages and served from the repo root.
    - The repo is `github.com/bawcejawn/Knode`, now `bawcejawn/KnodeGames`. The old name `kprediction` still redirects.
    - The local folder on the owner's PC is `C:\kprediction`. The stale copy at `C:\Users\alcat\repos\Knode` was deleted.
    - Hosting must cost nothing.
  - **Chain and contracts (Koinos mainnet)**
    - Game, Kpred v5: `c17066ae…`, live since 28 Oct. This is the original questions game, `Q_GAME = 1` in the Vault.
    - Desk v2 (the swap desk): `309506cc…`, live.
    - Mana sponsor: wallet `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8`, holding 5,000 KOIN. The on-chain code is sponsor v2, `fa4659e6`, which includes Race picks (built by another chat).
    - Operator key: `set_operator` points to `1HsM33…`.
  - **RPC**
    - Bot: uses `koinos.armana.io`, with `api.koinosblocks.com` as `RPC_CHECK`.
    - Site: uses `api.koinos.io`, with chain reads queued 4 at a time. Armana caused CORS failures in browsers, probably from burst rate limits.
    - `header-wallet.js` still uses Armana as its read-only provider. Watch this.
  - **Nodes on the owner's PC (Docker)**
    - There are 3 nodes: Desk `C:\kpred-desk-node`, Game `C:\kpred-node`, Personal `C:\koinos-personal`.
    - All three now run on Docker volumes named `<project>-basedir`, set up through `docker-compose.override.yml`.
    - The old basedir folders are kept until Nov 4. Delete them only if `heal.log` is clean.
    - Self-heal: `bot/heal.mjs` runs every 20 minutes and auto-repairs a crash-looping node with `node/repair-node-data.ps1`.
    - The owner reported about 96% of expected blocks produced.
  - **GitHub**
    - Only `OPERATOR_WIF` is stored on GitHub, in the environment `bot`. The main workflow uses that environment.
    - Ruleset: restrict deletions and block force pushes only. A pull-request requirement would block the bot.
    - The `diag-health` branch may be deleted. The owner must do it in the GitHub UI, because the proxy blocks branch deletion and log downloads (403).
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, DECISIONS.md (2026-11-02)

---

### Questions: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Questions
- **Category:** fact
- **Content:**
  - **Site files (repo root)**
    - `wallet.js` (KWallet): supports Kondor, KOIN Vault and Guest. Only public data goes in `localStorage`: `kw-accounts` (a list of `{kind, address}`), `kw-active` and `kw-kind`. Never keys or secrets.
    - `header-wallet.js`: the shared header wallet menu. It reuses `#connect` inside `.top-row`, lists accounts, and offers switch, add, forget and disconnect.
    - `guest.js`: a play-only key stored in the browser (IndexedDB first, `localStorage` as fallback). It is pinned to the sponsor and the game, and never holds funds.
    - `sw.js`: a network-first shell cache (`knode-shell-v7`), so site changes need no cache-version bump.
    - `app.js`: has a `legacyLabelsOk` fallback, which rebuilds labels for pre-hashRule-2 questions. It numbers questions per week (shown once per card), uses the welcome page as the landing page, and shows precise Mana errors.
  - **Sponsor rules**
    - Caps: 3 Mana per transaction, 10 per player per day, 65 per player per week, 1,000 for everyone per day (a hard cap), 300 free per day.
    - Site payer settings: `payer: "sponsor"`. `rcLimit` is 1 Mana for answers; `rcLimitOther` is 3 Mana for other actions such as stake.
    - Answer-only transactions are sponsored for any wallet, within the free sub-cap. All other actions are for real players only, and fail closed.
    - KOIN Vault chooses its own payer, so it cannot use the sponsor.
  - **Kondor integration facts** (from the kondor-js 1.3.0 and extension sources)
    - The site always loads kondor-js from the CDN, so `window.kondor` exists even when the extension is not installed. Its presence proves nothing.
    - `getAccounts()` always opens Kondor's "Select the account to use on this site" window. It allows multiple selection and auto-selects when there is only one account. Cancel throws `"getAccounts cancelled"`; closing the window throws a "Connection lost"-style error.
    - To detect the extension without opening a popup, use `kondor.provider.getChainId()`: if there is no answer within about 4 seconds, the extension is absent.
  - **Bot and tools**
    - `bot/sponsor.ts`: L-4 fix applied, default free cap 300, guest flag preserved, status output shows VHP.
    - `node/repair-node-data.ps1` and `node/move-node-to-volume.ps1` were added. `node/repair-desk-data.ps1` was removed.
    - `desk-data/deployment.json` now has `v1UploadTx`.
    - Tests: `node --import tsx --test --test-concurrency=1 tests/audit/*.test.ts tests/audit/*.test.mjs`. The latest run gave 531 pass, 0 fail, 3 TODO.
- **Status:** Filed → platform/ARCHITECTURE.md (2026-11-02)

---

### Questions: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Questions
- **Category:** decision
- **Content:**
  - **Security (standing rules)**
    - Funds must never be at risk; token security comes first.
    - Never paste private keys or seed phrases in chat. Keys live only in `.env` on the PC.
    - Mainnet sends need `CONFIRM_MAINNET=yes`. Every command is a dry run unless `--send` is given.
  - **Communication**
    - Never mention Chainge; Vortex is the bridge.
    - Explain steps simply, give a "Today" checklist, and keep asking questions.
  - **Product**
    - Desk: no daily payout cap. If KOIN is available, it can be swapped for VHP. The fee is 3% per swap, and swaps grow the desk node's production.
    - Sponsor: a hard daily cap of 1,000 Mana for everyone.
    - Guest play: on, for web browsers and mobile.
    - Prize rules: the 40/60 split and the 2 VHP free prize start in Week 3 (Mon 2 Nov). `reward_rule_week_plus_one=3` is set on chain.
    - Site: the Rules page was simplified into tabs (Knode Game, Race, Swap); "Producer race" was removed from the footer; the VHP balance refreshes every hour.
    - Wallet handovers (new owner on a hardware wallet, cold treasury): the owner will do them, hopefully this weekend.
    - Full platform audit: waits until the owner says everything is ready.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Questions: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Questions
- **Category:** fact
- **Content:**
  - **Knode questions game (game 1)**
    - The v5 upload went through, and v5 is live.
    - Today's legacy questions are accepted through `legacyLabelsOk`.
  - **Swap desk**
    - The owner tested a 3,000 VHP→KOIN swap.
    - Liquidity is about 1,050 KOIN, and 3,001 VHP has been swapped so far.
  - **Wallet: "+ Add another account" fix** (commit `80cef45`, live)
    - Causes found:
      - The old code waited only 15 seconds for Kondor. Unlocking Kondor and picking an account took longer, so the answer was dropped while the dialog had already closed.
      - When Kondor returned only an account the site already had, nothing visible happened.
      - The "found" tag was misleading, because kondor-js is always loaded.
    - Fixes:
      - A "Connect Kondor" dialog stays open with instructions and waits up to 5 minutes.
      - The site checks that the extension actually answers.
      - Cancel and a closed Kondor window each get a clear message.
      - If no new account comes back, the dialog explains how to create or import one in Kondor first.
      - A newly shared account becomes the active one, with an "Added N account(s)" notice.
      - The "found" tag was removed.
    - Swap page: the page's own `#connect` handler is skipped when the header menu owns the button (`aria-haspopup="menu"`). Before this, tapping the wallet button a second time within 5 seconds (for example, to close the menu) disconnected the wallet.
    - Verified live: without the extension, the dialog shows "Kondor isn't answering…".
    - Still to confirm: the owner should retest with the real Kondor extension.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, ROADMAP.md; game spec pending in .ai/games/ (2026-11-02)

---

### Questions: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Questions
- **Category:** open question
- **Content:**
  - **Scheduled check-ins**
    - Mon 2 Nov, 21:00 UTC: Week 2 closes and Week 3 starts.
    - Wed 4 Nov, 17:30 UTC: delete the old node basedir folders if `heal.log` is clean.
    - Tue 10 Nov, 21:00 UTC: the first payout under the v5 rules.
  - **Waiting on the owner**
    - Delete the `diag-health` branch in the GitHub UI.
    - Retest "+ Add another account" with Kondor installed. To add a second account, create or import it in Kondor first.
    - Hand over the wallets: new owner on a hardware wallet, and the cold treasury.
    - Give the go-ahead for the full platform audit.
  - **Later**
    - Next sponsor version: guest prize claims and the L-3 fix. Coordinate this with the sponsor v2 and Vault v6 chats.
    - Send the KOIN Vault developer message (the owner sends it).
    - Consider moving `header-wallet.js`'s provider off Armana to `api.koinos.io`.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Questions: CORRECTION — payout time and Week 3 free prize
- **Date:** 2026-11-02
- **Source chat:** Questions
- **Category:** warning
- **Content:**
  - The "21:00 UTC" times in the Questions ROADMAP entry above (Mon 2 Nov, Tue 10 Nov) were check-in reminder times, not game times. The game: week ends Mon 00:00 UTC, closes Mon 12:00, winners final Tue 12:00 (≈ 12:07 when the hourly bot finalizes).
  - On chain (2026-11-02): `reward_rule_week_plus_one=3`, `v6_rule_week_plus_one=4`, both fixed. Week 2 pays free players nothing; Week 3 (2–9 Nov, paid Tue 10 Nov) pays free players 1 + 1 VHP under v5; v6 2 + 1 from Week 4 (Mon 9 Nov).
- **Status:** Filed → platform/OPENISSUES.md (I-003, I-066 closed; I-067 updated), DECISIONS.md (C-08 resolved, C-25 updated)

---

## Chat: VAULT (exported 2026-11-02)

The KnodeGames Vault (game contract v6): audits, emergency build, seed, testnet check, mainnet upload on 2 Nov, sponsor and stake-panel integration.

---

### VAULT: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** fact
- **Content:**
  - **Chain:** Koinos mainnet, chain id `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==`.
  - **RPC nodes:**
    - Default is `https://koinos.armana.io` (`main` switched to it on 2026-10-28).
    - `https://api.koinos.io` returns HTML error pages intermittently. In folders whose `deployment.json` still names it, override with `$env:RPC = "https://koinos.armana.io"` in PowerShell.
  - **Repository:** `bawcejawn/Knode`.
  - **Owner's PC:**
    - `C:\kprediction`: day-to-day work, currently on the `picks` branch with uncommitted Block X files.
    - `C:\kprediction-vault`: a git worktree on `vault-v6`, used for the vault build and upload. Its `.env` is copied from `C:\kprediction`.
  - **Stack:** AssemblyScript (`@koinos/sdk-as` 1.5.1), as-pect with MockVM, koilib 9.4.1, protoc 21.12 (pinned and checksummed by `tools/protoc-pin.cjs`), Node 22, tsx.
  - **Mainnet addresses:**

    - **Game / Vault contract**: address `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`
    - **Owner (also desk treasury)**: address `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717`
    - **Operator**: address `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv`
    - **Seed owner (since 2026-10-30)**: address `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z`
    - **Bot wallet**: address `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ`
    - **Desk (Knode Swap)**: address `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR`, code `309506cc…`
    - **Sponsor v3**: address `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8`, code `b61ac238da27c4a71c01127f39a7b95f19fabf15e35df9f9715546d221e256e4`
    - **Picks (Block X)**: address `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm`, code `700c296a…`
    - **KOIN token**: address `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK`
    - **VHP token**: address `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq`
    - **PoB**: address `159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv`

  - **Koinos Foundation testnet:**
    - RPC `https://testnet.koinosfoundation.org`, chain id `EiAIKVvm6-V2qmsmUvPJy09vCCLbtn9lHFpwrJbcTIEWRQ==`.
    - tKOIN `1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju`, test VHP `17n12ktwN79sR6ia9DDgCfmw77EgpbTyBi`.
    - Faucet: @KoinosTestnetFaucetBot on Telegram.
  - **Vault v6 test copy on testnet:**
    - Contract `1MXay5pSvPNzc8sBcZAMWfqaY4T9DkBvLn`, with 10-minute weeks, close delay and notice of 2 min, and a minimum stake of 1 VHP.
    - Owner, operator and seed are all `1GtQHbDsC2yAEguR6uNQpjksuon2kxyJbr`. Its key is in `testnet-v6/keys.json`, which is gitignored and was held only in the Vault chat's sandbox. It held about 129 tKOIN after the owner topped it up on 2026-10-30.
    - Games 2 "Who Signs Block X" and 7 "Producer Race" are active. Games 3–6 and 8–13 ("Test game N") are stopped.
    - No bot runs on it: a week closes only when a player acts or someone calls `close_week`.
    - Its settings file is `testnet/vault.json` on `main`.
  - **Testnet resource prices (2026-10-29):** compute 6 per tick, disk 7,130 per byte, network 1,079 per byte. Mainnet prices are higher: the v6 upload cost 46.84 KOIN of Mana on mainnet against 7.53 on testnet.
  - **Site:** knodegames.com, served from the root of `main`. The testnet staking page is `stake-testnet.html`.
- **Status:** Filed → platform/PLATFORM.md, KOINOS.md (2026-11-02)

---

### VAULT: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** fact
- **Content:**
  - **Vault v6 (game contract)**, upgraded in place at the same address:
    - **Live build:** `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d`, 86,114 bytes.
    - **Emergency withdrawals-only build:** `e84fec492d47e08f583c352bb26e3d36dc0149926c0482d0820b0dbd97af9fe3`, 84,688 bytes, pinned as `safeWasmSha256` in `game-data/deployment.json`. It is built with `npm run build:safe`, which flips `game/assembly/Mode.ts` `SAFE_MODE`.
    - **In safe mode:** 14 entry points are refused. Result recording (settle, resolve and correct questions, `post_results`, `post_prize_winners`, seal, correct, void) stays open. `advance()` does nothing, `sponsorOk` is false, and `get_state.safe_mode` (field 12) is true.
    - **Accounting:** u128 liabilities, checked subtraction `less()`, and the seed takes the first loss (`seedFree`).
    - **Per-week claim caps:**
      - game week: `(rolled_over ? 0 : bucket) + prize_first·first_n + prize_second·second_n`;
      - question week: `rolled_over ? pot_free : pot`.
    - **Other games' results timing:**
      - due 3/7 of a week after the week ends (`RESULTS_DAYS = 3`, i.e. 3 days on mainnet);
      - finalize starts after `seal + 2·close_delay` and `last_change + close_delay`;
      - corrections and voids are refused once finalizing has started.
    - **Registry:** at most 12 games besides game 1.
      - `propose_game` then `apply_game` after the timelock (48 h on mainnet), within 7 days.
      - A game applied during week W earns from W+1.
      - `deactivate_game`: the game earns through the current week, and stake stays withdrawable.
      - Restarting before the last earning week ends keeps the game running, but the season length can't change.
      - Restarting after a gap needs `weeks_closed >= last_week_plus_one`.
    - **Closing:** `advance()` closes one week and does one finalize step per call. `close_week` is callable by anyone. A deposit, claim or move triggers `advance`.
    - **When v6 rules start:** `v6_rule_week_plus_one` is set by the first v6 write, and the rules start the following Monday. After the upload it stayed 0 until v6's first transaction.
    - **Stakes:** `deposit_to` accepts whole numbers only and can burn KOIN 1:1 into VHP. `withdraw_from` takes any amount at any time. `move_stake` is refused while paused, and the target game must be active and staked.
    - **2nd place:** paid even when nobody placed 1st (audit V6-9); 1st's share goes back to the pool.
    - **Week weight:** `weight_set` is saved only when a game moves past that week; otherwise `weightFor` uses the live `week_stake`/`next_stake`.
    - **Seed:** two-step handover (`propose_seed_owner`, then `accept_seed_owner` 28,800 blocks later). Accepting cancels any pending seed withdrawal. Seed withdrawals have a 48 h timelock and are paid to the current seed owner.
    - **Upgrades:** `PRE_VAULT_CODE` refuses the old hashes `ff4207b4…`, `917708a7…` and `c17066ae…`.
  - **Entry points other tools pin:**
    - Vault calls: `deposit_to` 0x7bb5c436, `withdraw_from` 0x5b0aaef8, `move_stake` 0x7c268e69, `claim_game` 0x4107e3ab, `finalize_game_week` 0xec300c11.
    - Reads: `get_game_player` 0x0feb472b, `get_player` 0x37ce3085, `get_state` 0x3d02a349, `list_games` 0x02efa793, `get_game` 0x6f8d72cf.
    - Token: `approve` 0x74e21680, `balance_of` 0x5c721497.
  - **Sponsor v3:** has a "vault live" switch, `config.game_has_vault`.
    - While off, it never calls `get_game_player` and refuses vault calls with `VAULT_NOT_LIVE`.
    - Its tool reads `get_state` `config.v6_rule_week_plus_one` from two nodes.
    - A plain `config` resets the caps to defaults, so always pass the current caps.
  - **Bot (`bot/bot.ts`, `bot/vault.ts`, `bot/chain.ts`):**
    - Hourly GitHub Action; posts results, seals, finalizes 24 h after the seal, and looks back 12 closed weeks.
    - Skips posting, closing and finalizing in safe mode.
    - `pagePlayers()` stops on a repeated address.
    - `upgradeGuard()` refuses a normal upgrade that matches the safe build.
    - `--testnet` targets the local Harbinger node (`127.0.0.1:8081`, `.env.testnet`, `testnet-data/`), **not** the Koinos Foundation copy.
    - Results files are `W${week}.json` (unpadded), from the `vaultGames` sources in `game-data/deployment.json`.
  - **Simulator:** `tools/mockvm-bytewise.cjs` patches the MockVM database so keys order bytewise (`BytewiseMap`, `getNextObject`/`getPrevObject`, copy on `putObject`). The testnet check confirmed the real chain orders bytewise (audit V2-14).
  - **Tooling:**
    - `npm run bot -- testnet-v6`: the one-command testnet check, which writes `testnet-v6/report.md`.
    - `bot/rehearse-v6.ts`: the rehearsal on a snapshot (`vault-snapshot`, then `rehearse-v6`).
    - `tools/mode-switch.cjs`: one shared parser for `Mode.ts`.
  - **Measured on testnet:** heaviest player call 4.63 M ticks (a deposit that closes a 13-game week, 1.6% of the per-transaction limit); 16-row post 1.50 M; finalize of 16 places 1.75 M; claim 2.44 M; withdraw 1.72 M; upload disk 86,257 B. Upper bounds: 50 rows ≈ 4.7 M ticks; 500-place finalize ≈ 55 M (19%). See `docs/TESTNET-V6-RESULTS.md`.
  - **Stake panel (Hub):** `stake-panel.js`, `stake-page.js`, `stake-testnet*.js`, `stake.html` and `stake-testnet.html`, merged in PRs #41 and #42. Its interface matches the v6 ABI field for field (checked by script).
  - **Admin page:** `admin/actions.ts`, PR #43 into `picks`. Its mainnet "Knode Vault (v6)" buttons match the bot's commands.
- **Status:** Filed → platform/ARCHITECTURE.md (2026-11-02)

---

### VAULT: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** decision
- **Content:**
  - **Funds safety first:** every staked VHP stays withdrawable at all times, and only the vault holds tokens.
  - **The owner's own audit programs count as the audit (2026-10-29).** RepoLens fix-check 4 said "ready for the rehearsal", and the rehearsal plus the testnet check passed.
  - **Every game is stakeable (Q15).** Block X, Survivor, Race and Bracket are added `--staked --free`.
  - **Producer Bracket (game 9):** staked plus free prize (2 + 1 VHP), 1-week seasons (owner, 2026-10-30).
  - **Survivor (game 3):** `--season 2` (prizes 4 + 2 VHP). Its Season 1 starts Mon 16 Nov (vault week 4).
  - **Withdrawals-only emergency build:** so funds can never be locked.
  - **Seed:** 20,000 VHP deposited 2026-10-30, total 21,050 VHP. Seed owner handed over to a new dedicated wallet `1K8VV…`.
  - **Upload timing:** announce on a weekend, upload on Monday (actual upload Mon 2 Nov 02:33 UTC), so games start the same Monday as the rules.
  - **Launch policy:** launch as many games as possible as soon as they're ready, and upgrade game contracts during the week. The vault itself needs a 48 h notice for any upgrade.
  - **Branch hygiene:**
    - Freeze `vault-v6` after the fingerprint check; don't rebuild or pull in `C:\kprediction-vault` before an upload.
    - Pushing the backup branch `vault-v6-next` is established practice.
  - **Mana cost per call:** ticks × compute price + disk bytes × disk price + network bytes × network price.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### VAULT: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** fact
- **Content:**
  - **1 Questions**: vault results source built in; status live
  - **2 Who Signs Block X**: vault results source `games-data:blockx/vault`; status Picks contract live; ready to announce
  - **3 Survivor**: vault results source `games-data:survivor/vault`; status announce Sat 7–Fri 13 Nov, apply Mon 9–Sun 15 Nov; `--season 2`
  - **4 Fantasy**: vault results source `games-data:fantasy/vault`; status in audits
  - **6 Block Golf**: vault results source `games-data:golf/vault`; status in audits; `GOLF_STAKED_FROM_WEEK`, unpadded `W57`
  - **7 Producer Race**: vault results source `race-data:vault`; status ready to announce
  - **8 Combo Card**: vault results source `games-data:combo/vault`; status in audits; recorder uses `get_game_player(...).week_stake`
  - **9 Producer Bracket**: vault results source `games-data:bracket/vault`; status ready to announce; staked + free
  - **13 Last Node Standing**: vault results source `games-data:lastnode/vault`; status in audits; rows only

  - **Race and Block X (`picks` branch):**
    - race.yml holds back a vault `W<week>.json` that fails `vault_ok`, with a warning; a final vault file can never change.
    - On upload day the Block X chat ships:
      - **V4:** drop the early return on `v6_rule_week_plus_one` in `readStaked`; keep the guard in `stakedFrom`/`earningFrom`.
      - **B1-1:** `GAME_ABI` → `kpred-v6.koilib.json`.
      - **B1-5:** check v6 once per run and per node, cached.
  - The **`games-data` branch** exists, with folders blockx, survivor, fantasy, combo, bracket, lastnode and golf.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, DECISIONS.md (2026-11-02)

---

### VAULT: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** fact
- **Content:**
  - **Done:**
    - Vault v6 audited and rehearsed (162/162 specs, 38/38 node tests).
    - Testnet check run; announced 2026-10-30 (tx `0x1220db16…8af`).
    - **Uploaded 2026-11-02 02:33 UTC**: chain-check all ✔, holdings unchanged at 21,120.07528353.
    - `vault-v6` merged into `main` (PR #51, `eeb1bf6`). Sponsor v3 merged (PR #38) and live. Picks live.
  - **By Fri 6 Nov, 4 pm Pacific:** announce games 2, 7 and 9, plus 8 and 13 if cleared.
  - **Right after the first `game-add`:** switch the sponsor to the vault.
  - **48 h later, before Sun 8 Nov 4 pm Pacific:** `game-apply` each game.
  - **Mon 9 Nov:** v6 rules and the 2 + 1 VHP free prizes start.
  - **Mon 16 Nov 12:00 UTC:** first vault close. Corrections are possible for 24 h after each seal; the 5% fee is collected with `claim-fee-vhp all`.
  - **Later:** Survivor (window above), then Fantasy, Golf, Combo and Last Node as each clears.
- **Status:** Filed → platform/ROADMAP.md, TODOS.md, DECISIONS.md (2026-11-02)

---

### VAULT: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** open question
- **Content:**
  - **Stake panel fixes (sent to the Hub):**
    1. `claimable()` for 2nd place must return `gw.prize_second` even when `first_n = 0`.
    2. "Last week: new" shows for weeks that paid. Mirror `weightFor`, which needs `game_object` `next_stake` (13) and `next_week` (14).
    3. The panel doesn't re-render after a wallet connects.
    4. The status bar and "Where to stake" list don't refresh after an action.
    5. The testnet wallet's 1 tKOIN Mana cap triggers "insufficient pending account resources" (code 104) on back-to-back actions. Lower the cap to about 0.5 and add a "wait a minute" message.
  - **Admin page fixes (PR #43):**
    1. "Add a game" needs a season field (Survivor uses `--season 2`).
    2. The "Vault v6 trial" buttons (`--testnet`) can't reach the testnet copy: they go to the local Harbinger node, and the test copy's owner key isn't in `.env.testnet`.
    3. Wording: "testnet/stake.html" should read `stake-testnet.html`.
  - **No bot support for the Koinos Foundation testnet copy yet.** Planned: a flag that reads `testnet/vault.json`, added on `main` after v6.
  - **`C:\kprediction` (`picks` branch)** has uncommitted changes, including `picks-data/deployment.json` showing as deleted. The Block X chat should check this.
  - **The `vault-v6` folder's `deployment.json` still names `api.koinos.io`.** Consider switching it to armana.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### VAULT: TODOS
- **Date:** 2026-11-02
- **Source chat:** VAULT
- **Category:** open question
- **Content:**
  - [ ] Owner: `game-add` 2, 7 and 9 (`--staked --free --send`) by Fri 6 Nov, 4 pm Pacific.
  - [ ] Owner: sponsor switch. `npm run sponsor -- status`, copy the caps exactly, run the `config` preview (it must show "vault (v6) live: no → yes" with the caps unchanged), then `--send`, then `status` again.
  - [ ] Owner: `game-apply` each game 48 h after announcing.
  - [ ] Owner: ask the Combo Card and Last Node Standing chats whether they're cleared for mainnet.
  - [ ] Owner: tell the Block X chat the upload is done so it ships V4, B1-1 and B1-5.
  - [ ] Hub: apply the five panel fixes and the three admin fixes above.
  - [ ] Vault chat: add bot support for the testnet copy (`testnet/vault.json`) on `main`.
  - [ ] Survivor: announce Sat 7–Fri 13 Nov.
  - [ ] After the first close (16 Nov): check status, the buckets, the free prizes and the fee.
  - [ ] Keep the emergency steps at hand: `upgrade --safe` (`e84fec49…`), sponsor limit 0, pause.
  - **Project docs to carry over:** `claude/vault-v6-live.md`, `claude/vault-v6-testnet-results.md`, `claude/handoff-hub-vault-testnet-check.md`, `claude/handoff-sponsor-v6-day.md`, `claude/handoff-vault-results.md`, `claude/handoff-stake-in-every-game.md`, `claude/audit-vault-v6-*`, and `docs/UPGRADE-V6.md` and `docs/V6-PLAN.md` in the repository.
- **Status:** Filed → platform/TODOS.md, OPENISSUES.md (2026-11-02)

---

## Chat: HUB (exported 2026-11-02)

The KnodeGames site and Hub (captain) chat. Covers the domain and the site moved to the repo root, the shared stake panel, status bars and staking hub, the testnet staking page, wallet names (Koinos @names and pool names), the admin page and cross-chat coordination. Covers up to Fri 30 Oct 2026.

---

### HUB: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** fact
- **Content:**
  - **Domain:** knodegames.com is registered at Cloudflare and served by GitHub Pages from the **repo root**; `/site/` was removed by PR #31 (PR #30 set up the domain).
    - DNS: 4 A and 4 AAAA records on `@`, plus `www` CNAME → `bawcejawn.github.io`, all grey cloud (DNS only).
  - **Branches:**
    - `main` is the live site.
    - `picks` is the development branch. It merges `main` from time to time, and the admin page lives there.
    - Data branches: `race-data`, `blocks-data`, `games-data`, `names-data` (`names.json`), `testnet-data`.
  - **Admin page (owner's PC):**
    - Start it from `C:\kprediction` with `git checkout picks`, `git pull`, `npm ci`, `npm run admin`.
    - It opens a local link with a one-time key.
  - **Chat ownership:**
    - **Race chat (KG 02 · Hub + Race Show)** owns `bot/race.ts`, `race.html`, `race.js`, `race-math.js`, `race.yml`, `race/`, the `race-data` branch and the race tests. The Hub doesn't edit them; requests go through the owner.
    - **Vault chat** owns the `vault-v6` branch and the testnet copy's owner and operator steps.
    - Block X, Combo, LNS, Bracket, Fantasy and Survivor each have their own chat.
    - **Repo Lens** is the audit chat.
  - **Game id registry:** 1 Question, 2 Block X, 3 Survivor, 4 Fantasy, 5 Rival (Picks only), 6 Block Golf, 7 Race, 8 Combo, 9 Bracket, 13 Last Node Standing.
  - **Vault weeks:** week 0 began Mon 19 Oct 2026 00:00 UTC (genesis 1792368000000), so week 2 is Mon 2 Nov.
  - **Koinos Nicknames contract:** `1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz`. Total supply was about 2,137 names on 30 Oct.
  - **Testnet Picks contract:** `12xNetHpajRi8Xrv4ub8MbMWWjC2q7VrX5`.
  - **Live on 30 Oct:** Sponsor v3 on mainnet, the Picks contract on mainnet, `NAMES_ENABLED=true` (set by the owner), the staking hub, status bars, and the @name page.
- **Status:** Filed → platform/PLATFORM.md, KOINOS.md (2026-11-02)

---

### HUB: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** fact
- **Content:**
  - **koilib 9.4.1 in the browser:**
    - The bundle puts `Provider`, `Signer` and `utils` on `window` itself, not on `window.koinos`. Code must fall back to `window`.
    - The header wallet missed this, which caused "getChainId of null" on names.html and stake.html. Fixed in PR #49.
    - Kondor `signMessage` signs sha256 of the text. Verify with `Signer.recoverAddress`.
  - **wallet.js (`KWallet`):**
    - Each page must call `KWallet.init({ provider, chainId, payer, sponsor })` from `game-data/deployment.json`; the header only does a default init.
    - `sponsorFor()` uses the Mana sponsor only when every operation is covered (`covers[0]` is the game).
    - `move_stake` (`0x7c268e69`) is never sponsored.
  - **Vault v6 player calls:**
    - `deposit_to 0x7bb5c436 {from, game, amount, koin}`
    - `withdraw_from 0x5b0aaef8 {to, game, amount}`
    - `move_stake 0x7c268e69 {player, from_game, to_game, amount}`
    - `claim_game 0x4107e3ab {player, game, week}`
  - **Vault v6 reads:**
    - `get_game_player 0xfeb472b`, `get_game 0x6f8d72cf`, `get_state 0x3d02a349`, `list_games 0x2efa793`, `get_player 0x37ce3085`, `list_players 0x44d79744`.
    - The vault is live when `config.v6_rule_week_plus_one > 0`.
    - `game_object` field `next_stake` is 13 and `next_week` is 14.
  - **Token entry points:** approve `0x74e21680`, balance_of `0x5c721497`.
  - **stake-panel.js (`KStake`):**
    - Functions: `mount` (game-page panel), `mountList`, `badge` (staked/free status bar), `status`, `overview(who)`, `send(action, a)` (up to 10 claims in one transaction), `sayError`.
    - After any action it fires `kstake:changed`, which refreshes the bar, list and panels.
    - Only the latest refresh renders (a generation counter).
    - `per100()` uses the vault's `weightFor` until a week's weight is saved.
    - `claimable()`: 2nd place gets `prize_second` as is; it is 0 when 1st place is tied.
    - A busy-Mana refusal (code 104) says "wait a minute and try again".
    - On a `kg-network=testnet` page it uses `testnet/vault.json` and `KTestStakeWallet`.
  - **stake.html (staking hub):**
    - Summary: staked, in your wallet, rewards.
    - Games tab: one card per game with your stake, the game total, your share % and bar, and a status chip.
    - Stake, Withdraw and Move open as inline forms with quick amounts (1/10/100/Max; 25%/50%/All).
    - Rewards tab with Claim all.
    - `#g<id>` opens that game's Stake form.
    - The page sets up the wallet with the sponsor, as the game pages do.
  - **stake-testnet.html:**
    - Public, noindex. Its wallet is `stake-testnet-wallet.js`.
    - The wallet signs only the 4 vault player calls on the test vault, plus an approve directly before a `deposit_to`.
    - It refuses mainnet, requires the signed operations to equal the built ones, and caps Mana at 0.5 per transaction.
  - **names.html ("Your Koinos @name"):**
    - Typing runs a live `verify_valid_name` read. The contract answers "@x is available" for a good name; otherwise it errors with the reason (for example "already exists", "similar to the existing name …", "words must start with a lowercase letter").
    - Create mints `{to, token_id: hex(name)}` through `KWallet.send`, using the player's own Mana.
    - Success is confirmed with `get_address`, and `KNames.setLocal` shows the name on that device at once.
  - **names.js (`KNames`):**
    - Display order: pool name → older Knode Games name → **Koinos @name** (the @name wins). The short address is always shown with the name.
    - Rules: `fold` (lookalike pairs cl/nn/rn/ri/ii/vv, with cl→d run again after digits), `reserved` (knode*, Koinos + Group/Team/Support/Admin/Official/Network/Labs/Foundation…), `addressLike`, `okNick`, `okPool`.
    - Pages ignore a `names.json` over 2 MB.
  - **bot/names.ts and the hourly `names.yml` workflow:**
    - Jobs: check (read-only), publish (no repository code), reply. Gated by `vars.NAMES_ENABLED`. Scheduled only, never triggered by issues.
    - Chain reads time out after 8 s, and a node that times out is skipped for the rest of the run. The whole run has a 7-minute deadline, and the process exits when done.
    - Nicknames are read 20 at a time within 240 s, named wallets and producers first. Both nodes must agree, and a failed read keeps the old value.
    - **Pool names:** Fogata `get_pool_params` (entry 2396056273), field 1. The producer address is the pool contract. Stored as `pools`.
    - `names.json` is kept under 900 kB (the publish limit is 1 MB). Owner command: `npm run names -- remove <address>`.
  - **CI guards:**
    - `tests/audit/site.ci-deps.test.mjs` bans issue triggers, `write-all`, `secrets: inherit` and `toJSON(secrets)` in any case. Issue permissions are allowed only in `names.yml`. `workflow-guard.yml` runs it.
    - `bot/workflow.test.ts`: no `${{ }}` inside run scripts, and no job output may be named `run`.
  - **Admin page (`admin/actions.ts`, on `picks`):**
    - Tools: bot, desk, sponsor, picks, racepicks, names.
    - Vault area: Sunday upgrade steps (status, apply, clear); Add a game (with a season field); post/seal/finalize; correct/unprize/void; collect the 5% VHP fee.
    - Also a Wallet names area, and "Vault v6 trial (local node)". Its `--testnet` reaches only the local Harbinger node.
  - **Sponsor v3 on chain** allows every vault player call, `move_stake` included. Per-action caps must be above 0, so blocking moves on chain would need a tiny cap.
- **Status:** Filed → platform/ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### HUB: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** decision
- **Content:**
  - **Prizes:**
    - A prize shortfall is cut and never owed later.
    - Balances always cover total liabilities.
    - Free-game rewards are extra and come second to stakers.
    - No free-game prizes until the vault is fully live.
  - **Sponsor:**
    - Caps are 25 Mana per wallet per day and 150 per week, with no extra cap.
    - Its KOIN is sized from measured use once everything is live.
    - The Mana sponsor pays for **stake, withdraw and claim, never for moving stake** (owner, 30 Oct).
  - **Names:** one name per wallet, the **Koinos @name**.
    - The signed Knode Games name claim plus GitHub step was removed from the site (owner, 30 Oct); older claims are still honoured.
    - Producers show their pool names.
    - The owner accepts the lookalike false positives (Clover/Dover, Mario/Mano; "Node 123456" refused as address-like).
  - **Staking UX:** easy, functional and simple. Stake, withdraw, move and claim take a couple of taps. Show the share % against the game total.
  - **Working rules:**
    - Merge only on the owner's explicit "merge N"; never push to `main` or deploy otherwise.
    - Keys are never pasted; they stay in `.env`. Mainnet sends need `CONFIRM_MAINNET`.
    - New games launch on Mondays, one at a time.
    - No daily payout cap on the Desk.
- **Status:** Filed → platform/DECISIONS.md, standards/VAULT_STANDARD.md (2026-11-02)

---

### HUB: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** fact
- **Content:**
  - **Question (1):** live on v5 and moves into the vault with v6. Its stake buttons stay on `index.html`; `withdraw_from` doesn't apply to game 1.
  - **Block X (2):**
    - The status bar is on `blockx.html` (on `picks`).
    - It reaches `main` with the Block X launch PR (`picks` → `main`) once game 2 is applied.
    - No prizes until the vault is live.
  - **Race (7):**
    - Live, with the status bar (PR #44).
    - Testnet play-through on the test copy: stake, move, withdraw and a claim of 0.95 VHP for week 163 all worked.
  - **Survivor (3):** a free game, next after Block X. Testnet season and audit on the `survivor` branch. Seasons are 2 weeks (`--season 2`).
  - **Block Golf (6):** no contract of its own; it's scored from every game's board. Practice scorecards come with Block X; staked after the vault.
  - **Combo (8):** last in line. It needs the Picks v2 CARD upgrade. Testnet cards: 6 legs 0.1313 Mana, 10 legs 0.1457.
  - **Bracket (9), LNS (13), Fantasy (4) / Rival (5):** staked, after the vault. Each is in audit fix-checks in its own chat.
- **Status:** Filed → platform/PLATFORM.md; game specs pending in .ai/games/ (2026-11-02)

---

### HUB: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** idea
- **Content:**
  1. Apply the Vault v6 upgrade (admin → Knode Vault steps 1–3, with `docs/UPGRADE-V6.md`).
  2. Merge `vault-v6` into `picks` / `main`; the admin's vault buttons need it.
  3. Add the games to the vault: Block X (2) and Race (7) first.
  4. Block X goes live, with Block Golf practice scorecards.
  5. Survivor.
  6. Block Golf staked → LNS → Bracket → Fantasy → Combo (after Picks v2 CARD).
  7. Size the sponsor's KOIN from measured use.
  - **Retention ideas offered (the owner hasn't chosen):** streaks, a "Your week" card, a claim reminder dot, a weekly recap page, badges next to names.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### HUB: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** open question
- **Content:**
  - **PN-30:** the @name mint hasn't been confirmed end to end with a real wallet. The owner was retrying "primeproducer" after PR #49; the result isn't recorded.
  - The admin's vault buttons answer "Unknown command" until `vault-v6` is merged into `picks`.
  - Sponsor v3 would still pay for a `move_stake` sent outside the site. Blocking it on chain needs a tiny per-action cap (the owner's call).
  - **PN-8 / C2-4:** the CI guard is regex-based and misses rare YAML spellings (indent digits, tags, anchors). Add a YAML parser before anyone else gets write access.
  - **Info items:**
    - C2-3: a node that is slow once is skipped for the whole names run.
    - C1-7: nickname updates freeze near 1 MB.
  - **The panel's "Connect wallet after connecting" race** is fixed by reasoning (generation counter) and was never reproduced.
  - **When `picks` merges `main`:** keep both testnet-wallet exceptions in the guard tests.
  - **`docs/NAMES.md`:** the old claim workflow is still documented as legacy.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### HUB: TODOS
- **Date:** 2026-11-02
- **Source chat:** HUB
- **Category:** open question
- **Content:**
  - [ ] Owner: retry creating an @name on names.html and report the result.
  - [ ] Owner: after the vault upgrade, tell the Hub so it can check the staking hub, bars and panels on mainnet.
  - [ ] Owner: Add a game 2 and 7 (then the others as their chats are ready).
  - [ ] Owner (optional): decide the on-chain move-stake sponsor cap; pick retention features.
  - [ ] Hub: verify staking on mainnet after v6.
  - [ ] Hub: remove the legacy claim workflow, the issue template and the claim CLI. This drops the `issues` permissions.
  - [ ] Hub: add a YAML parser to the CI guard.
  - [ ] Every new game page: mount `KStake.badge(el, {game: id})` at the top of `<main>`, with the full panel lower.
  - [ ] Block X chat: open the launch PR (`picks` → `main`) after game 2 is applied.
  - [ ] Vault chat: add bot support for the testnet copy (`testnet/vault.json`) on `main`.
  - **Done since the VAULT chat's list:** the five panel fixes (PR #46: busy-Mana message and cap 0.5, `weightFor`, wallet race, refresh after actions, 2nd-place prize) and the three admin fixes (PR #43: season field, local-node wording, `stake-testnet.html`).
  - **Project docs to carry over:** `claude/launch-order.md`, `claude/stake-panel.md`, `claude/producer-names.md`, `claude/handoff-status-bar-testnet.md`, `claude/names-fixcheck-prompt.md`, `claude/names-fixcheck2-prompt.md`, `claude/audit-names-prompt.md`, `claude/domain-knodegames.md`, `claude/site-at-root.md`, `claude/admin-page.md`; in the repo, `docs/NAMES.md` and `docs/ADMIN.md`.
- **Status:** Filed → platform/TODOS.md, OPENISSUES.md (2026-11-02)

---

## Chat: KG 02 · Hub + Race Show (exported 2026-11-02)

The Producer Race (game 7): Build 2 (Knode Games rename, Games hub, Race Show), the staked and free boards, the Race's weekly Vault results file, medals for earners, the shared stake panel and the status bar. This chat owns the Race.

---

### KG 02 · Hub + Race Show: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** fact
- **Content:**
  - **Name and site:** Knode Games (two words on pages; "Knode" before Build 2, and "KnodeGames" in early Build 2 text). Live at https://knodegames.com on GitHub Pages, with the site files at the repo root (PR #31).
  - **Repository:** `bawcejawn/Knode` (now `bawcejawn/KnodeGames`). One branch and PR per build; the owner merges. Claude never pushes to `main` without the owner's OK.
  - **Vault:** game contract `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`, upgraded in place to the Knode Games Vault (v6). The v6 ABI is on `main`, and the Race's first weekly Vault file (week 1) went final.
  - **Vault game ids:** 1 Daily Questions, 2 Who Signs Block X, 3 Survivor, 4 Fantasy Producers, 6 Block Golf, 7 Producer Race, 8 Combo Card, 9 Producer Bracket, 13 Last Node Standing.
  - **Weeks:** week 0 began Mon 19 Oct 2026 00:00 UTC (`GENESIS` 1792368000000). Weeks run Monday to Monday UTC; week = floor((t − genesis) / 7 days).
  - **Who owns what:**
    - The Race chat (`KG 02 · Hub + Race Show`, session `0173PPUtFZWbkCLXcA57bDGS`) owns the Producer Race.
    - The site/Hub chat (session `0173PPUsRKcFfG89XdWYy7LD`) owns the shared site files: `board.js`, `stake-panel.js`, `styles.css`, `games.*`, the tab bar and `stake.html`.
    - Another chat (session `0173PPUrAJx3x5GM6g8LJmND`) changed the tab bar and the guest-wallet text.
    - The written rule is in `claude/owners-race.md`.
  - **Owner checklist:** a Claude artifact with a Today list (https://claude.ai/artifact/Qjk951Qvntsa15yrhJ2db6), backed by the `tasks` collection in its database.
  - **Owner preferences:** explain plainly (the owner works in finance and is new to running code), keep asking questions, keep the checklist up to date.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md (2026-11-02)

---

### KG 02 · Hub + Race Show: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** fact
- **Content:**
  - **Race recorder:** `bot/race.ts`, run by `.github/workflows/race.yml` hourly at minute 37 while `RACE_ENABLED=true`.
    - Two jobs. `record` has a read-only token and no secrets, and runs the repo's code. `publish` has the write token, runs no repo code, shape-checks every file with embedded Python, and pushes only to the `race-data` branch.
    - Only irreversible blocks count. Blocks and picks must match on two nodes (`RPC` and `RPC_CHECK`); stake reads come from the Vault and must agree on both nodes for the Vault file.
    - Files on `race-data`: `index.json`, `W<NNN>.json` (race weeks), `board.json`, `vault/W<week>.json` (unpadded week number).
    - If the last run's files can't be read, the record job fails. A missing branch is the only case where it starts fresh.
    - Publish refuses a `final` Vault file for a week that hasn't ended, by the runner's own clock (`RACE_CHECK_NOW` is for tests only). It also refuses any change to a Vault file already published as final (exact `cmp`, plus a JSON `final` check).
    - Shared rules in `race-math.js`: `standings`, `winners`, `shows`, `POINTS {win:3, show:1}`, the handicap math. The page and the recorder both use it.
  - **Pick row:** `[player, horse, time, won 0/1, 0, show 0/1]`. Field 5 used to mean "may be ranked"; it is now always 0 and no wallet is read for it. Picks recorded before Show existed are back-filled from the stored standings.
  - **`board.json` rows:** `{a, pts, correct, shows, picks, ranked, boardPlace, earns}`.
    - `ranked`: on the Staked board.
    - `boardPlace`: the place on the wallet's own board, shared by ties (1, 1, 3…).
    - `earns`: 1 or 2 = free-prize place, 3 = a share of the staked bucket, 0 = nothing. Nonzero only on This week and Last week.
  - **Vault results file:** `race-data:vault/W<week>.json`, the source string for `vaultGames."7".results` being `race-data:vault`:
    `{"game":7,"week":N,"final":bool,"rows":[{"player","points"}],"first":[],"second":[],"skipped":[]}`
    - `rows`: staked players with at least 1 point, as 255, 254, … per tied group.
    - `first` / `second`: free players, at most 10 each.
    - `skipped`: races left out.
  - **Stake test** (matches the Vault contract's `post_results` / `post_prize_winners` and `bot/vault.ts`):
    - Staked: `peak_stake` (or `active_stake` when there's no entry) is at least that week's minimum (`min_stake`, or `min_stake_next` from `min_stake_next_week`).
    - Earning: `week_stake` is at least the minimum.
  - **Fails closed** (no final file) when the repo ABI has no `get_game_player`, `deployment.json` has no contract, `get_state` comes back empty, any stake read fails, or the two nodes disagree. A failure of the whole read is reported once a run.
  - **Site:**
    - `board.js` (`KBoard`): Today / This week / Last week / All time, with Staked and Free play tabs. `boardPlace` came from the picks branch (audit BX-41). `freeWinners` decides Free play medals; the optional `earned(row, weekly)` decides Staked medals, so only rows that earn get one.
    - `stake-panel.js` (`KStake`, Hub PRs #32/#33/#35/#41): `mount(el, {game})` gives Stake (approve + `deposit_to`), Withdraw (`withdraw_from`, always offered), Move (`move_stake`) and Claim (`claim_game`). Claims follow the Vault's `claimableG` / `rewardOfG` and look back 52 weeks, including weeks before a game restart. `badge(el, {game})` shows the "Staked · X VHP / Playing free" bar.
    - `race.html`: `#stake-badge` at the top of `<main>` (PR #44), and the `#stake` panel spot lower down. The Games page's "Where to stake" list links to `race.html#stake`, so that id must stay.
    - `games.html`, `games.js`, `games.json` make up the hub list (`games.json` is validated). `tools/site-nav.mjs` writes the tab bar into every page, and a test keeps every copy identical. `tools/site-seo.mjs` writes the share tags. The service worker never caches game or race data.
    - Strict CSP: no inline scripts or handlers, only pinned CDN scripts, content built with `textContent` only.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md (2026-11-02)

---

### KG 02 · Hub + Race Show: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** decision
- **Content:**
  - **Build 2 (27 Oct):** Race Show scores win 3, show 1 (2nd or 3rd with at least one step). The welcome page stays the home page and lists every game. No "New" tag on games. The KOIN Vault dapp name stays "Knode", and the connect text says "approve Knode (KnodeGames)", until the KOIN Vault developer is asked.
  - **Every game takes stakes (28 Oct):** the Race is set up in the Vault as `--staked --free`. Staked players are those staked in game 7 that week; everyone else (guests included) is free. Staked players share the game's bucket; free players play for 2 VHP and 1 VHP.
  - **Race ranking:** points, then wins, then picks placed. Wallets still tied share the place. The Daily Questions tie-breaks were dropped (option A, 28 Oct).
  - **Ties:** a tie for 1st shares all 3 VHP and 2nd stays empty. When more than 10 tie for a place, the 10 with the earliest first pick that week share it and the rest get nothing.
  - **Free prize:** any free player can win; no VHP holding or minimum play is required.
  - **A race that won't finalize** is skipped 12 hours after its week ends. Its picks don't count, and it is listed in `skipped`.
  - **Medals (29 Oct):** only wallets that earn get one, and only on the weekly boards. Free play: the paid 1st and 2nd. Staked: the Vault's top 30% by headcount, rounded up, with a tied group taken whole.
  - **Ownership (29 Oct):** the Race chat owns all Race files. Other chats send Race requests through the owner.
  - **Status bar (30 Oct):** the badge sits at the top of every game page, with the full panel lower down (Hub, owner-approved).
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### KG 02 · Hub + Race Show: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** fact
- **Content:**
  - **Producer Race:** four 6-hour races a day (00, 06, 12, 18 UTC). Each race has 6 one-hour legs with hourly handicap cards; races recorded before 27 Oct have 3 cards. Results need irreversible blocks that match on both nodes.
  - **Race contract:** picks lock when a race starts. Up to 5 picks a day, changes included; the sponsor pays the Mana. The `pick.at` time is the latest pick or change, and it decides the more-than-10 tie rule.
  - **Live status (2 Nov):** week 1 Vault file `{"final":true,"rows":[],"first":["1Fdg4H…"],"second":["1MVRxw…"],"skipped":[]}`. `lastWeek` on the board matches it: places 1 and 2 have `earns` 1 and 2.
  - **Merged PRs from this chat:** #23 (Build 2: rename, Games hub, Race Show, tab bar), #34 (two boards, Vault file, review fixes, medals for earners). **Open PR:** #44 (status bar).
- **Status:** Filed → platform/PLATFORM.md, DECISIONS.md, KOINOS.md; Race spec pending in .ai/games/ (2026-11-02)

---

### KG 02 · Hub + Race Show: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** fact
- **Content:**
  - **Block X (`picks` branch):** it changes the same three Race files: `bot/race.ts` (anti-gaming handicap: effective VHP, random samples, 6-hour high, production floor, BX fixes), `race.yml` and `tests/audit/race-recorder.test.mjs`. The Race chat resolves the conflicts by hand when Block X is ready to merge.
  - **Other game chats** (Survivor, Fantasy, Golf, Combo, Bracket, Last Node Standing) use `KStake.mount` and `KStake.badge` and write their own Vault files (`claude/handoff-vault-results.md`, `claude/handoff-stake-in-every-game.md`).
  - **Free-prize wording** across the site should be updated now that the Vault is live. The Race page still says "both start once the vault is live".
- **Status:** Filed → platform/ROADMAP.md, OPENISSUES.md (2026-11-02)

---

### KG 02 · Hub + Race Show: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** open question
- **Content:**
  - PR #44 (status bar) is not merged yet.
  - The Block X merge with the Race files is still to do.
  - The Race page describes the Vault as "not yet live" (rules text in `race.html` and the `index.html` Race rules). It needs updating now that v6 is live.
  - The panel's "Staked board" label is based on `peak_stake`. A wallet that withdrew below the minimum mid-week ends up with no bucket share and no free prize; the shared panel should explain this.
  - The board reads `get_game_player` once per wallet per run across All time. Fine at current scale, but it grows with players.
  - If `RPC_CHECK` is turned off, stakes are classified on one node only, with no warning.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### KG 02 · Hub + Race Show: TODOS
- **Date:** 2026-11-02
- **Source chat:** KG 02 · Hub + Race Show
- **Category:** open question
- **Content:**
  - [ ] Owner: review and merge PR #44, then confirm the badge on the live Race page at phone width.
  - [ ] Race chat: update the Race page and home-page rules for the live Vault (two boards active, prizes paid).
  - [ ] Race chat: merge `picks` into `main` with the Race files resolved when Block X is ready, then re-run all suites and open the PR.
  - [ ] Race chat: each week, check `vault/W<week>.json` is final with sensible `first`, `second` and `rows`, and that `race.yml` runs succeed.
  - [ ] Owner: ask the KOIN Vault developer whether the dapp name can change to "Knode Games" (checklist t27).
  - [ ] Owner, from the checklist: full platform audit; new owner key on a hardware wallet; cold treasury for the Desk; move the seed and Desk owner; empty the old bot and test wallets; pin the Desk node key; clean up old node data and the stale folder/branch; launch announcement; analytics decision; ads and the SwarmTales listing.
  - [ ] Keep the reference docs current: `claude/race-vault.md` (status), `claude/owners-race.md` (ownership), `claude/stake-panel.md` (panel).
  - **Project docs to carry over:** `claude/race-vault.md`, `claude/owners-race.md`, `claude/stake-panel.md`, `claude/builds/02-hub-and-race-show.md`, and `race/README.md` (the "Weekly results for the KnodeGames Vault" section) in the repository.
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---

## Chat: Block X and Picks (exported 2026-11-02)

Who Signs Block X (game 2), the Picks contract, Mana sponsor v3, the publish checks for the race and Block X data, and the Repo Lens rounds. State as of 2026-10-30 (last commit on `picks`: `3e08c58`). This chat never saw the result of step 8 (applying game 2).

---

### Block X and Picks: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** fact
- **Content:**
  - **Branches and process**
    - Work branch `picks`; Claude may push to it. `main` changes only through PRs the owner merges. Other chats also push to `picks`, so always pull before pushing.
    - The owner's checkout is `C:\kprediction`; a second checkout for Combo is `C:\kg-combo-preview`. Once the checkout was on `lastnode` and a tool ran old code: check `git checkout picks` / `git log --oneline -1` before running tools.
  - **Chain**
    - Mainnet RPC `https://api.koinos.io`, plus `koinos.armana.io` and `api.koinosblocks.com` (the second node, `RPC_CHECK`).
    - Testnet `https://testnet.koinosfoundation.org`.
  - **Mainnet contracts**
    - Mana sponsor v3: wasm `b61ac238…`, upload tx `0x122040b7…72`, 2026-10-30.
      - ON, with caps 1 Mana per tx; 25 per player per day; 150 per player per week; 5,000 for everyone per day; 2,000 a day for free players. The vault switch is off.
      - Picks is allowlisted with a `pick` row of 0.2 Mana (20,000,000; observed 11,600,000).
    - Picks: `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm`, wasm `700c296a…`, upload tx `0x12207d67…d809`, 2026-10-30T20:35:42Z.
      - Owner `1635QUr…H717`. The upload key was deleted after the upload.
      - The contract's `authorize` refuses everything except an owner-approved upgrade.
  - **Testnet sponsor** `1Dg8zKeHFRvEZeF1o4thSUs6eC2zHNg7qC`
    - It is OFF, still allowlisting Combo's Picks v2 `1PQZWWHbGnzHQW99frzJLmQLZ4Lwpjj8rX`.
    - Before using it for the Block X testnet again (Picks `12xNetHpajRi8Xrv4ub8MbMWWjC2q7VrX5`), run `config --testnet --send` without the `TESTNET_PICKS*` env vars.
  - **Tools** (all dry runs by default; mainnet needs `--send --mainnet`)
    - `npm run picks`: keys, build-testnet, status, upload, announce, apply, pause, lock-test, mana-test. On the `combo` branch only: upgrade-schedule, upgrade-upload, upgrade-clear.
    - `npm run sponsor`: status, upload, config, enable, disable, mana-report, mana-limit, site-limits, watch, payer.
  - **Data branches:** `race-data` (index, board, W###, `vault/W<week>.json`), `race-samples` (`vhp-samples.json`), `games-data` (`blockx/…`).
  - **Publish workflows:** `games.yml`, `games-testnet.yml`, `race.yml`, `race-samples.yml`.
  - **Tests**
    - `npm run test:audit`: last 644 tests, 634 pass, 0 fail, 5 todo, 5 skipped (the skips are pwsh-only).
    - Also `test:audit:serial`, `test:resolver`, and `cd sponsor && npm test`.
  - **Repo Lens** is the owner's AI auditor. It gets a zip (`00-COMMIT.txt` + `00-FIXCHECK-PROMPT.md`) and returns a Claude Docs report.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Block X and Picks: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** fact
- **Content:**
  - **Why the publish checks look the way they do:** the recorders (`bot/games/blockx.ts`, `bot/race.ts`) are JavaScript and write `JSON.stringify(x)+"\n"`. The publish checks are Python.
  - **The publish job, in all four workflows**
    1. `find` refusals: symlinks, unexpected files or folders, files over 2 MB. `race.yml` allows only `$IN/vault` and `vault/W[0-9]{1,4}.json`.
    2. An inline `node -e` check: the raw bytes must equal `JSON.stringify(JSON.parse(text))+"\n"`. Regular files only, path after `--`, and it walks subfolders.
    3. Python checks:
       - `js_safe`: numbers within ±2^53−1, finite, no integer-valued floats, depth ≤ 64;
       - type-strict `isaddr`, `one()` and `same()`;
       - ASCII `[0-9]` only, never `\d`. A guard test enforces this, including `python3 -c` / `python3 -I -c` one-liners.
    4. `setup-node` 22, SHA-pinned, in every publish job.
  - **Published history is append-only**
    - A published card never changes (BX-44).
    - Index weeks are append-only; a new week only for cw−1..cw (the race allows cw−1..cw+1).
    - W targets: new rounds only for the current or just-ended week, never after P is published. Height = round × 2400 + 0, and its time is ≤ now and inside the week.
    - A run that rewrites history is held whole.
  - **race.yml, the record job**
    - `git ls-remote --exit-code refs/heads/race-data`: exit 2 means the first run; any other error stops the run.
    - `ls-tree -r -z` into a file, then a `read -d ''` loop. It fetches W/index/board and `vault/`, plus `race-samples`.
  - **race.yml, the publish job**
    - Python `vault_ok` checks the vault file: game 7, rows ordered with points 1–255, first/second ≤ 10, no wallet twice, final only after the week ends.
    - A vault file that fails `js_safe`/`vault_ok` is held on its own with a warning; the race files still publish (blind review V1).
    - A vault file already published as final never changes; changing it refuses the whole run.
  - **race.ts**
    - Samples and cards take the lower of the two nodes' reads. `topInDoubt` uses a floor re-run with 0.5% tolerance.
    - Also: a supply cap, a clock check (BX-89), an early check-head (BX-114) and a lag bound (BX-101).
    - Boards: Staked / Free play, with `boardPlace` and `earns` (0 nothing, 1–2 a free prize place, 3 a staked share). Ranking is the vault stake (`stakedOf`).
    - The old "holds 1 VHP" read (`rawRead`) was removed; each pick's 5th field is always 0.
    - `readStaked` uses `GAME_ABI` = v5 (`game/abi/kpred.koilib.json`, no `get_game_player`), so it throws "still v5". Everyone shows on Free play and the vault file is never final.
  - **Block X recorder**
    - `canonicalTransferValue` / `NonCanonicalTransfer`.
    - A target is voided at once only if both nodes report it; otherwise it's held and voided at the 3-day edge.
    - Short receipt pages are read on (BX-90). No vault file past its 3-day window (BX-92).
    - Block X reads only top-level `W###.json` race cards; `vault/` is invisible to it.
  - **Sponsor tool**
    - `capsOf` keeps 0. `tighterCaps` takes the lowest of both nodes and the default.
    - `allowedBuilds` mainnet [v3, v2]. `codeOn` checks two nodes. The SP-50 swap check runs only on v3.
    - `mana-limit --limit X` needs X ≥ 1.25 × the observed most and ≤ the per-tx cap.
    - Testnet only: `TESTNET_PICKS` / `TESTNET_PICKS_CARDS=yes`.
    - Mainnet upload Mana pricing: 1.2 per KB + 10.
  - **Site**
    - `blockx-math.js`: `MAINNET_GAME = {id:2, round:2400, offset:0, lead:100, ahead:28900, picksPerDay:30, maxChanges:1}`.
    - `wallet.js`: `PINNED_PICKS = ""`, to be set at publish.
    - `blockx.html` has the Hub's `#stake-badge`; `KStake.badge(…, {game: 2})` is called in `setupStake`, mainnet only.
    - The Block X testnet page uses `testnet-wallet.js`; the staking testnet page uses `stake-testnet-wallet.js`.
  - **Picks upgrade path:** owner `schedule_upgrade(sha256)`, then 48 hours, then an owner-signed upload within 7 days, then `schedule_upgrade` with an empty hash. The three overrides stay on.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md, KOINOS.md (2026-11-02)

---

### Block X and Picks: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** decision
- **Content:**
  - **Split launch:** contracts first. Block X goes live prize-free; the scoring fixes happen off-chain before Vault v6 prizes.
  - **One change per pick** (owner), instead of 5. The page says "change it once".
  - **Picks `pick` sponsor row: 0.2 Mana** (chain row and the site's `rcLimits`).
  - **Raise the row to 0.25 Mana at Combo launch, not now.**
    - Testnet, sponsored, game 98: a 6-leg card used 0.1313 Mana and a 10-leg card 0.1457. That's only 1.37× under 0.2, below the 1.5× rule.
    - Block X single picks (0.116 Mana) are fine at 0.2.
  - **PRs merged to main:** #38 (sponsor-only), #39 (the swap pays its own Mana), #40 (picks sponsored).
  - **Neighbour-time rule removed:** it caused honest stalls. The BX-97 week-end re-read moved to before prizes.
  - **BX-137 accepted:** the test clock variables aren't refused in GitHub Actions, because CI runs the tests there.
  - **V4, B1-1 and B1-5 held until the v6 upload day.** Any change now is outside the Repo Lens GO, and this is race-card code.
  - **The Hub's status bar** goes to main in the Block X launch PR; no separate PR.
  - **Standing rules**
    - Root-cause fixes, and a blind review before each Repo Lens round.
    - Mainnet steps one at a time, as PowerShell blocks for `C:\kprediction`.
    - Never handle keys or WIFs (if one is pasted, tell the owner to rotate it).
    - Never push to main, merge, deploy, upload or change chain settings without asking.
    - Plain language, and a "Today" checklist in every reply.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Block X and Picks: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** fact
- **Content:**
  - **Who Signs Block X (game 2)**
    - Announced with 1 change per pick; can be applied from 2026-11-01 21:23:34 UTC (Sun 1:23 pm Pacific).
    - Repo Lens: round 10 GO at a55390f; round 11 GO at 3472d8c (nothing must be fixed).
    - Record: `docs/history/AUDIT-2026-10-28-repolens-blockx.md` (rounds 5–10 and the blind reviews; round 11 not yet written). Runbook: `docs/blockx/MAINNET-LAUNCH.md`.
  - **Producer Race (game 7):** the weekly vault results file is `race-data/vault/W<week>.json` (Race chat).
  - **Combo Card (game 8)**
    - Picks v2 release `92d555d0680157854452e35162c1b1c5c100904996194b8c1c848df50e5e1c3d` (37,689 bytes).
    - Testnet contract `1PQZWWHb…`, game 98. The upgrade commands are on `combo` @ 5052fa6.
    - Measured results are in `docs/blockx/TESTNET-RESULTS.md`.
  - **Vault game ids:** Block X 2, Survivor 3, Fantasy 4, Golf 6, Race 7, Combo 8, Bracket 9, Last Node Standing 13.
  - **Vault week 0:** Mon 19 Oct 2026 00:00 UTC (genesis 1792368000).
- **Status:** Filed → platform/PLATFORM.md, ROADMAP.md, KOINOS.md; game spec pending in .ai/games/ (2026-11-02)

---

### Block X and Picks: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** fact
- **Content:**
  1. **Step 8** (from Sun 1:23 pm PT): `npm run picks -- apply 2 --send --mainnet`, then `npm run picks -- status --mainnet`. It must show 1 change.
  2. **Mana check:** `npm run sponsor -- mana-report` on mainnet (BX-123). Raise the pick row if mainnet is more than ~1.5× testnet.
  3. **Step 9, publish**
     - Set `PINNED_PICKS` in `wallet.js` to `1LmgqB…`, and record Repo Lens round 11.
     - Open the `picks` → `main` PR; the owner merges.
     - Expect about 6 hours of targets voided ("no handicap card") while the samples fill.
  4. **Hub:** send it the launch PR link (the status bar comes with it).
  5. **After launch:** Repo Lens tidy items B1-4, B1-6, B1-7, B1-8, then a short fix-check.
  6. **Step 10:** after a full day of play, per-action Mana limits (`mana-report --save`, `site-limits --send`, a PR, `config --send`). Again a day after the sponsor's v6 switch (`claude/handoff-sponsor-v6-day.md`).
  7. **v6 upload day:** B1-1 + V4 + B1-5 together, with a test and a short fix-check.
  8. **Picks v2 upgrade**, in `MAINNET-LAUNCH.md` "Later: the Picks v2 upgrade":
     1. Publish the source and a reproducible build.
     2. `upgrade-schedule --send --mainnet --code 92d555d0`, then wait 48 hours.
     3. `upgrade-upload`.
     4. `upgrade-clear`.
     5. Write `wasmSha256` / `uploadTx` / `uploadedAt` into `picks-data/deployment.json` by a PR to main (FC2-13).
     6. `status --mainnet`.
     7. Raise the pick row to 0.25 (`mana-limit picks:pick 0.1457 --limit 0.25 --save`, the site PR, `config --send`).
     8. Announce game 8, wait 48 hours, `apply_game`.
  9. **Before prizes:** BX-97/BX-88 week-end re-read on both nodes, BX-105 board freeze, BX-72 VHP decoder, BX-118 race card clock, BX-115, BX-116, BX-120, SP-59, G-K-1.
- **Status:** Filed → platform/ROADMAP.md, TODOS.md (2026-11-02)

---

### Block X and Picks: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** open question
- **Content:**
  - **B1-1 (before game 7 prizes):** race.ts uses the v5 ABI, so stake reads always throw and the vault file is never final. Weeks that pass stay not-final; past weeks need a back-fill or a "no prize" decision.
  - **B1-2 (before game 7 prizes; High at that stage):** a final vault file is decided by one run and locked forever. It isn't re-derived from the W### files, and there's no 12-hour hold.
  - **B1-3 (owner decision):** free-prize farming by many empty wallets on sponsored picks. The related todo test for Block X is BXS-1.
  - **B1-4 (Low):** a vault file over 2 MB, not in canonical byte form, or with a nested folder still stops the whole race run, cards included.
  - **B1-5 (Low):** stake reads run before the race files are written, with retries per wallet. A failing node could pass the 30-minute job limit and lose that hour's cards.
  - **V4:** a non-v6 chain reads as "not staked" without an error. Fix: drop the `v6_rule_week_plus_one` early return (race.ts about line 297), with a fail-fast v6 check once per run and per node.
  - **B1-6:** the race.ts header comment is stale.
  - **B1-7:** `bot.yml` has `\d` in two Python row checks, and the guard doesn't scan `bot.yml`.
  - **B1-8:** two test-clock variable names in the race.yml publish.
  - **BX-129:** until step 8 is applied, the chain allows 5 changes while the page says 1.
  - **BX-127:** the Block X record job fails until game 2 is applied.
  - **Todo tests:** BXS-1, G-K-1, FC3-VHP-2, WEB3-23, WEB3-31.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Block X and Picks: TODOS
- **Date:** 2026-11-02
- **Source chat:** Block X and Picks
- **Category:** open question
- **Content:**
  - [ ] Owner: step 8, apply game 2 on mainnet and confirm 1 change. Not reported as done in this chat.
  - [ ] Owner: mainnet `npm run sponsor -- mana-report` before publishing.
  - [ ] Claude: set `PINNED_PICKS`, record Repo Lens round 11, open the `picks` → `main` PR. Owner: merge it.
  - [ ] Send the Hub the launch PR link, and confirm the phone-width screenshot of the bar reached it.
  - [ ] Optional, owner: `npm ci --ignore-scripts && npm run test:audit:serial` on the PC (Repo Lens asked).
  - [ ] After launch: B1-4 (run the find, size and byte checks on `vault/` inside the hold, with a test), B1-6, B1-7, B1-8, then a short fix-check.
  - [ ] v6 upload day (ask the Vault chat for the date):
    - `GAME_ABI` → `kpred-v6.koilib.json`;
    - drop the early return;
    - a fail-fast v6 check;
    - a test: a v5 chain with 50 players finishes, the cards publish, the vault file stays not final;
    - a fix-check.
  - [ ] Combo launch: raise the pick row to 0.25 (chain and site `rcLimits`), then check with `mana-report`.
  - [ ] The Combo upgrade commands reach `picks` / `main` only after Combo's Repo Lens review and merge.
  - [ ] Before prizes: the BX-97/88, BX-105, BX-72, BX-118, BX-115/116/120 and SP-59 items, and the B1-2 / B1-3 decisions for game 7.
  - **Project docs to carry over:** `claude/blockx/FIXCHECK-PROMPT.md`, `claude/handoff-sponsor-v6-day.md`, `claude/blockx/SPONSOR-TESTNET.md`, `claude/blockx/README.md`. In the repository: `docs/blockx/MAINNET-LAUNCH.md`, `docs/blockx/TESTNET-RESULTS.md`, `docs/history/AUDIT-2026-10-28-repolens-blockx.md`.
- **Status:** Filed → platform/TODOS.md, OPENISSUES.md (2026-11-02)

---

## Chat: Swap Desk (exported 2026-11-02)

Knode Swap (the VHP→KOIN desk), the three nodes on the owner's PC, self-healing and alerts, on-time question release, who pays Mana, and the game v5 / Desk v2 upgrade. The chat ran 2026-10-16 to 2026-10-28; facts are as of then (the repo and site were later renamed to KnodeGames / knodegames.com).

---

### Swap Desk: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** fact
- **Content:**
  - **Repo and hosting**
    - The repo was `bawcejawn/Knode` and stays **public**. Public means GitHub Actions and Pages cost nothing.
    - The owner's working copy is `C:\kprediction`. Run `npm` from there.
    - The site was on GitHub Pages and deploys from `main`.
    - Chain: Koinos mainnet, chain id `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==`.
  - **RPC nodes**
    - Bot and local tools: `https://koinos.armana.io`. The bot reads repo variable `vars.RPC`, which defaults to Armana. Locally, set it for a PowerShell session with `$env:RPC = "https://koinos.armana.io"`.
    - Site: `https://api.koinos.io`. It sometimes returns HTML error pages.
    - Second, independent check (`RPC_CHECK`): `https://api.koinosblocks.com`.
  - **Addresses**
    - Game: `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`
    - Desk: `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR`
    - Owner, treasury and seed owner: `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717`
    - Operator (bot): `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv`, rotated in on 2026-10-26.
    - Old operator: `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ`, retired. Its key is still in the owner's local `.env`.
    - Mana sponsor: `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8`
    - Race picks: `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K`
    - KOIN: `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK`
    - VHP: `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq`
    - PoB: `159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv`
    - Desk producer key: `AzCYCDLDa49PPVHKk60xQbOErS6XY1TcEA8bkSo8Sk6E`
    - Game producer key: `Ak0vGklNyfkjroA5_nT04sfBy_IkloaNbXYiOClcjMm3`
  - **Code fingerprints** (live since 2026-10-28, about 19:25 UTC)
    - Game v5: `c17066ae988d204fd43d43f662ad87fcdc38170419943c20b5164a5bd34dd784`, replacing v3 `917708a7…`.
    - Desk v2: `309506ccfaadd3427e937aa88cd34c9ea2a9e6088e49e51f014d546489dd5f35`, replacing v1 `05039d74…`.
    - Sponsor v2: `fa4659e65c6156da3dde34238e0545a489a8b7f00cdf51df9bf79517a0019f33`.
  - **Nodes on the owner's PC** (Docker Compose on Windows)

    | Node | Folder | RPC port |
    |---|---|---|
    | Desk | `C:\kpred-desk-node\koinos` (basedir `C:\kpred-desk-node\basedir`) | 8100 |
    | Game | `C:\kpred-node\koinos` (basedir `C:\kpred-node\basedir`) | 8080 |
    | Personal | `C:\koinos-personal\koinos` | 8090 |

    - The desk node uses P2P port 8908 and Compose project `kpred-desk-node`.
    - Images: chain v1.5.2, block_store v1.1.0, p2p v1.3.0, block_producer v1.3.1.
    - **Never delete `basedir\block_producer`**: it holds `private.key`.
  - **GitHub Actions**
    - `bot.yml` (Kpred bot): runs hourly at :07, plus a daily release run at `48 11 * * 1-6`.
      - Jobs: blocks-in, tick, publish, blocks-out.
      - `OPERATOR_WIF` lives in the `bot` environment, which only `main` can use.
    - `race.yml`: hourly at :37.
    - `watch.yml`: every 15 minutes. It emails once if `vars.PERSONAL_PRODUCER` hasn't produced a block for 30+ minutes, then again every 3 hours.
    - `heal-alert.yml`: started by the owner's PC. It fails on purpose so GitHub emails the owner.
  - **Windows scheduled tasks on the owner's PC**
    - Both run through `conhost --headless`, so no window flashes.
    - "Knode self-heal" runs every 20 minutes.
    - "Knode question release" runs daily 11:45–14:05 UTC, every 5 minutes. Its start time is stored in UTC, so daylight saving time doesn't move it.
  - **Secrets**
    - Kept in `C:\kprediction\.env`. Never paste them into chat or GitHub.
    - `GITHUB_ALERT_TOKEN` is a fine-grained PAT for `bawcejawn/Knode` only, with Actions read/write. It's used by `heal.mjs` and `release-kick.mjs`.
  - **Costs**
    - Public repo: free.
    - A private repo would use roughly 15–18k Actions minutes a month, about $75–120 a month (estimate). Pages and environments would also need Pro.
    - A custom domain costs about $10–20 a year and doesn't affect Actions.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md (2026-11-02)

---

### Swap Desk: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** fact
- **Content:**
  - **Game contract**
    - Daily `compound` burns returned KOIN into VHP.
      - It keeps `seed_koin + creator_fee` as KOIN.
      - It is capped by the contract's Mana. Minted KOIN arrives with equal Mana (checked in the Koinos KOIN contract source).
    - `set_sponsor_limit(max, min)`: owner only, takes effect at once. `max_sponsor_rc = 0` means the contract pays for no one.
    - Code upgrades have a 48 h timelock. In v5 an announcement expires 7 days after its timelock.
  - **Desk contract (Knode Swap)**
    - Swaps VHP → KOIN at 1:1 minus 3%. The fee is capped at 10%.
    - `authorize` refuses every outside token move and every Mana payment.
    - A swap pays at most min(desk KOIN, desk Mana).
    - Withdrawals go to the treasury only. Treasury and code changes have a 48 h timelock.
    - The desk refuses its own address as owner or treasury.
    - Desk v2 adds:
      - a two-step owner handover;
      - a daily payout cap, which starts with no cap;
      - 48 h waits for a lower fee, a higher cap or a new key;
      - a 7-day expiry on announcements.
  - **Mana sponsor**
    - Pays only for listed player actions: on the game, the desk, race picks, and approvals to the game or desk.
    - Answers and picks are free for any wallet, inside a free sub-cap. Everything else needs at least 1 VHP or a stake.
    - Caps are counted in rc_limits: per transaction, per player per day and per week, and for everyone per day (hard cap 1,000).
    - It never pays for operator or owner actions.
  - **Bot tick order:** resolve → post → close/finalize → health checks → settle → compound. Then it publishes `game-data/`.
    - Release: when within 12 minutes of release, `postPass` waits for 12:00 UTC (`releaseWaitMs`), with one bounded retry.
    - Mana tally: the bot records what its own wallet spends per UTC day in `game-data/bot-state.json` → `manaByDay`, keeping 60 days.
    - Settles: the bot first asks the contract to pay. If the contract declines, the bot pays itself, up to `MAX_BOT_PAID_SETTLES` (10 per run). The cap is lifted in the last hours before `settle_end`, and `BOT_MANA_FLOOR` still applies.
  - **`bot/release-kick.mjs`** (owner's PC)
    - 11:50–11:58 UTC: starts `bot.yml` unless a run is already active.
    - 12:06–14:00 UTC: checks that `game-data/questions/W###-D#.json` is on `main`, using the public API with no token.
      - Starts the bot again at most every 12 minutes.
      - Emails once at 12:20.
      - Marks the day done as soon as the file is there.
    - Day label: genesis is Monday 2026-10-19 00:00 UTC. Labels are `W{week:03}-D{day}`, with Monday = D1. Sunday has no questions.
  - **`bot/heal.mjs`** (owner's PC)
    - Restarts a node (`docker compose down`, then `up -d`) when it is more than 200 blocks behind and not moving, or silent on two checks in a row.
      - 50-minute cooldown between restarts.
      - Stops after 3 restarts in 6 hours and emails "check by hand".
    - A block store that started 3+ times in 20 minutes is a crash loop: it emails instead of restarting. Auto-repair was added later by another session.
    - Every heal emails the owner through `heal-alert.yml`.
  - **Repair scripts**
    - `node/repair-desk-data.ps1` copies the game node's `block_store\db` and `chain\blockchain` onto the desk node.
      - The old data is kept as `…-broken-<stamp>`.
      - Keys, p2p and config are never touched.
      - The game node is always restarted.
    - `node/repair-node-data.ps1` is the general version, added later.
  - **Site payer flow** (`site/wallet.js`, `sendKondor`)
    - If the sponsor covers every operation and `would_pay` says yes, the sponsor is the payer and the player is the payee. The rcLimit is 1 for an answer or pick, 3 for anything else.
    - Otherwise the player's own wallet is named as payer. A transaction that comes back re-pointed to the game contract is refused.
    - KOIN Vault picks its own payer.
    - The site re-reads chain state and questions every minute.
    - From 12:00 UTC until the day's questions appear it shows "Today's questions are on their way". If they're more than 2 hours late it says "running late".
  - **Commands**
    - `npm run bot -- …`: status, chain-check, upgrade, sponsor-limit, node-status…
    - `npm run desk -- …`: status, node-status, key-status, fund, withdraw, daily-cap, upgrade, treasury…
    - `npm run sponsor -- …`: status, config, enable, disable, payer.
    - `npm run heal`
    - `npm run admin`
- **Status:** Filed → platform/ARCHITECTURE.md (2026-11-02)

---

### Swap Desk: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** decision
- **Content:**
  - **2026-10-16 · Swap desk design:** a separate contract with a flat 3% fee. The desk node's VHP, fees included, produces blocks, and that refills the KOIN on offer ("burn without burning"). It is kept separate from game and personal funds.
  - **Treasury:** stays the owner wallet for now. It can be changed later, with the 48 h timelock.
  - **2026-10-23 · Self-heal:** checks every 20 minutes and emails on every heal. The watchdog is based on the personal node.
  - **Site:**
    - Koinosscan replaced the KoinosProof footer link.
    - The song was removed from the Learn page.
    - The "Swap now or wait" calculator and the "added since you opened" stat were removed.
  - **2026-10-23 · Upgrade path:** skip v4 and go straight to game v5 together with Desk v2.
  - **2026-10-28 · On-time questions:** questions must come out at 12:00 UTC on the dot, for the site's integrity. This added:
    - an 11:48 release run;
    - the bot waiting for 12:00;
    - a backup starter on the owner's PC.
  - **2026-10-28 · Bot Mana:** the bot wallet pays its own Mana (post, resolve, compound, settle). The owner tops up its KOIN; target 50 KOIN.
  - **2026-10-28 · Player Mana:** the sponsor pays for every player transaction; past the caps, players pay their own (PR #28, merged). The owner chose not to set the game's `max_sponsor_rc` to 0 for now; it stays at 2 KOIN on chain and in `deployment.json`.
  - **2026-10-28 · Repo:** stays public.
  - **2026-10-28 · Release task:** runs only 11:45–14:05 UTC each day, stored in UTC so daylight saving can't move it.
  - **Finding:** adding seed KOIN does not increase the VHP that's producing. At steady state the idle KOIN is about 5 × the daily Mana spend. The fix is to stop others spending the contract's Mana.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Swap Desk: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** fact
- **Content:**
  - **Schedule (UTC)**
    - Weeks run Monday 00:00 to Monday 00:00.
    - Questions come out Monday–Saturday at 12:00. Answers close at 00:00. Sunday is results day.
    - Corrections are allowed until Monday 12:00. Winners are final Tuesday 12:00 when everything runs on time.
  - **Questions:** five a day.
    - Types: producer quartiles, group block counts, transactions in a window, largest gap, average interval.
    - Templates M1, M4, M5, M7, M10; model v5; `hashRule` 2.
    - v5 allows at most 30 questions a week.
  - **v5 rewards** (from week 3, starting 2026-11-02)
    - Take the 5% fee.
    - Take a 2 VHP free-player prize: 1 VHP each to the best 2 free players.
    - Split the rest: 40% to basket A (place weight × stake, capped at 10 VHP per wallet) and 60% to basket B (place weight × full stake).
    - Winners are the top 30% of staked players with at least 1 point. Minimum stake: 1 VHP.
  - **Game snapshot, 2026-10-28 13:41 UTC**
    - Holding: VHP 21,622 + KOIN 546.6. Contract Mana: 174.9.
    - Owed: 22,151.7 in total:

      | Item | Amount |
      |---|---|
      | Stakes | 21,011 |
      | Seed | 1,050 (1,000 VHP + 50 KOIN) |
      | Producer fee | 4.54 |
      | Pots | 86.17 |

    - Week 1: gain 90.71, pot 86.17, 1 winner.
  - **Compounding**
    - It ran every day from Oct 20 to Oct 27.
    - The bot's "day" is 28,800 blocks, so each compound comes about 1 hour later than the last.
    - About 317 KOIN went uncompounded because the contract's Mana was spent on others' transactions.
  - **Desk snapshot, 2026-10-28**
    - 478.18 KOIN and 20,720 VHP producing.
    - 2 swaps so far: 3,001 VHP in, 2,910.97 KOIN out, 90.03 VHP in fees.
  - **Mana costs, measured**

    | Action | Mana |
    |---|---|
    | Simple call | ~0.21 |
    | Each write | ~0.02 |
    | Answer or pick | ~0.3 |
    | `deposit_koin` | ~1.38 |
    | `compound` | ~1.08 |
    | Game v5 upload | 26.8 |
    | `cancel_upgrade` | ~0.25 |

  - **Daily Mana budget (estimate)**
    - Bot: about 5–6 Mana a day. Hold 50 KOIN.
    - Sponsor: about 3 Mana per active player per day. Hold 5 × the daily use.
    - The 1,000-a-day cap covers about 100 fully active players. Keep 5,000 KOIN in the sponsor.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, DECISIONS.md (2026-11-02)

---

### Swap Desk: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** idea
- **Content:**
  - A custom domain. It also unblocks guest play, which is held back by the shared github.io origin.
  - Sponsor v3: a generic allowlist. It could also pay for operator transactions if one wallet should cover everything; that needs an audit.
  - Replace the Mana estimates with measured numbers: `manaByDay` plus the sponsor's daily use, after a week. See `claude/mana-budget.md` in the project.
  - Optional: compound at a fixed time each day instead of every 28,800 blocks.
  - Wallet handovers after v5 (`docs/WALLETS.md`).
  - Launch kit: week 1 is for testing; weeks 2–3 push the number of players.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Swap Desk: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** open question
- **Content:**
  - **The game contract still pays Mana for others.** Its `max_sponsor_rc` is 2 KOIN, so KOIN Vault or Kondor "free Mana" users can still spend the contract's Mana.
    - The fix is `npm run bot -- sponsor-limit 0 --send`, which the owner has postponed.
    - If it's done, set `game-data/deployment.json` `maxSponsorRc` to `"0"` at the same time. Otherwise the bot emails a settings alert.
  - **The sponsor caps are probably too tight.**
    - The per-transaction cap may still be 1, while stakes and claims ask for 3, so those fall back to the player's own Mana.
    - Staked answers now count against the per-player day cap of 10.
    - Suggested (not applied): `--per-tx 3 --per-player-day 16 --per-player-week 90 --per-day 1000 --free-per-day 300 --min-vhp 1`.
  - **The desk's daily payout cap isn't set yet** after Desk v2. Suggestion: about 25% of the float, around 120 KOIN.
  - **The bot wallet's Mana (`1HsM33…`) hasn't been confirmed.**
  - **A flaky audit test:** one run failed and then passed on re-run (PR #28).
  - **api.koinos.io** sometimes returns HTML error pages, and the site uses it.
  - **Desk node incident, Oct 22–23**
    - The desk's block-store database was damaged. Requests for missing blocks hit a nil-pointer panic in `GetBlocksByHeight`, and the store crashed and restarted over and over.
    - It was repaired from the game node's data on 2026-10-24 00:39 UTC.
    - The old data is kept as `…-broken-20261023-1739` (about 50 GB).
  - **`status` can mislead:** its "last produced" line reads a cached `bot-state.json`. The audit suggested scanning recent block signers instead.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Swap Desk: TODOS
- **Date:** 2026-11-02
- **Source chat:** Swap Desk
- **Category:** open question
- **Content:**
  - [ ] Compare `npm run bot -- status` with `before-upgrade.txt`.
  - [ ] Set the desk's daily cap: `npm run desk -- daily-cap <KOIN> --send`.
  - [ ] Check that the first "Kpred bot" run after v5 is green.
  - [ ] Top up the bot wallet `1HsM33…` to about 50 KOIN.
  - [ ] Remove the old `OPERATOR_WIF` (`1JSTwo…`) from the local `.env` and move that wallet's leftover KOIN to the owner.
  - [ ] Decide on `sponsor-limit 0` and the new sponsor caps, or roll back the site's payer change (a one-step revert).
  - [ ] Once the desk has run a full day without freezing, delete `C:\kpred-desk-node\basedir\block_store\db-broken-20261023-1739` and `chain\blockchain-broken-20261023-1739`.
  - [ ] After the Nov 1 clock change, check that NextRunTime for "Knode question release" shows 3:45 AM local time (11:45 UTC).
  - [ ] Watch `node\release-kick.log` and `node\heal.log` for the first few days.
  - [ ] Test a real swap on the site with Kondor, about 1 VHP.
  - [ ] After a week, recompute the daily Mana budget from `manaByDay` and `npm run sponsor -- status`.
  - [ ] Delete `C:\Users\alcat\repos\Knode` and the `diag-health` branch. (The Questions chat reports the folder as already deleted.)
  - [ ] Wallet handovers, per `docs/WALLETS.md`.
- **Status:** Filed → platform/TODOS.md, OPENISSUES.md (2026-11-02)

---

## Chat: Survivor (exported 2026-11-02)

Survivor (Build 4, game 3 on the Picks contract): rules, the recorder, the publish checks, the testnet kit and the Repo Lense rounds. State as of 2026-10-30. The last commit on `survivor` is `a8a1979`; it is pushed but not merged, and nothing is deployed.

---

### Survivor: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** fact
- **Content:**
  - **Branch:** `survivor` in `bawcejawn/Knode`.
    - It contains Build 3's `picks`, `main` (merged 28 Oct) and Survivor, plus later merges of `picks` (`6e22c73`, and `c50d423` with Block X round 6).
    - Claude may push to `survivor`. A merge to `main` and any deploy need the owner's explicit OK.
  - **Checkouts:** the live game runs from `C:\kprediction`. The test copy, created 30 Oct, is `C:\kprediction-test`; it is used for the testnet and for Repo Lense audits.
  - **Testnet:** the Koinos Foundation testnet (`testnet.koinosfoundation.org`) through its public API; the owner has no testnet node.
    - Funding comes from the Telegram faucet bot: `/faucet <address>` gives 100 test KOIN a day.
    - That covers 50 KOIN for the contract upload plus 6 KOIN per test player.
  - **Test page ports:** the page runs at `127.0.0.1:8370`, or the next free port. It never uses 8090 (the owner's node) or 8350 (Block X).
  - **Picks fingerprints:** the audited build sha256 is `700c296a…c594`; the audited `Picks.ts` sha256 is `444209c1…83d6`; protoc is pinned to 21.12. The tooling uses koilib 9.4.1.
  - **Tests at `a8a1979`:**
    - Site tests: 201, all pass.
    - `npm run test:audit:serial`: 673 tests, 663 pass, 0 fail; the rest are todo or skipped.
    - The rehearsal (`node --import tsx tools/survivor-testnet/rehearse.mjs`) passes and reproduces the audited build.
    - A fuzz of 150 seasons with random stakes found 0 Python/JS disagreements.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Survivor: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** fact
- **Content:**
  - **`survivor-math.js`** (repo root) is shared by the page and the recorder.
    - `KSurvivor.withConfig` is the test clock; tests pin the mainnet values.
    - `playSeason(days, staked)` plays two boards and returns `ends: {staked, free}`.
    - `weekRows(days, k, staked, board)` gives one board's rows for week k.
    - `outByMissing` treats knockouts logged `n` (no pick), `f` (not in field) or `u` (already used) as unable to win a prize.
  - **Recorder `bot/games/survivor.ts`** (no keys):
    - Nodes: mainnet seasons need two nodes, compared on settings only. A check node that is down doesn't stop the run; days seen by one node are re-checked later, oldest first.
    - Time limits: an 8-min budget (`SURVIVOR_BUDGET_MS`); a day that starts within the budget is kept. A hard stop for chain reads comes 4 min after the budget.
    - Folder swap: it stages the new output in a side folder and moves the old one aside as `.survivor-old-<hash>`; `recoverOut` repairs an interrupted swap.
    - It writes v2 season files with a `stakes` array, and keeps every season player's picks, in or out.
    - `boardOf(sf)` returns the union of staked wallets.
    - Vault reads: `vaultSettings`, `vaultMismatch`, `readStaked`, and `readRanked` (using `stake_other`).
  - **Vault v6 use:**
    - `get_game_player` returns peak_stake and active_stake; `get_player` returns `stake_other`.
    - `min_stake` and `min_stake_next` set the stake needed.
    - Week 0 is UTC day 20745.
    - Results go to `games-data:survivor/vault/W<week>.json`. Each file is written once; published weeks are copied forward from the last run unchanged.
  - **Publish job `.github/workflows/games.yml`:**
    - Python replays every season (`play`, rank, prizes, `week_rows`) to mirror the JS, and refuses any other result.
    - It checks everything against the job's own clock (`CHECK_NOW_MS`), with 1 h of slack. A vault file whose stakes were read late is held.
    - The index's season list is append-only, and listed seasons must have started. Season 1's start can still move while no season is listed.
    - A single failing file is dropped on its own (exit 3). Files over 2 MB are dropped with an alert. Published vault files aren't checked again.
    - The Survivor step runs only `if: !cancelled() && steps.prev.outcome == 'success'`.
    - Limits: the job 45 min, the Block X step 25 min, the Survivor step 15 min. A failed recorder's files are left out.
    - The whole workflow stays off until `GAMES_ENABLED=true`.
  - **Page `survivor.html` + `survivor.js`:**
    - It shows the chain clock, and pauses picking until picks are read cleanly or while the game settings are paused.
    - `canPickDay` returns false once the season is over or the player's board has ended.
    - Sent picks are tracked per wallet and day, and dropped after 3 min unseen, with a note.
    - It warns before a player picks their own producer, and shows a no-field note and a guest note.
  - **Testnet kit `bot/survivor-test.ts`** (`npm run survivor-test`) **and `tools/survivor-testnet/`** (`fake-testnet.mjs`, `rehearse.mjs`):
    - It refuses mainnet by node name and by chain id, and uploads are bound to the testnet chain id.
    - It reproduces the audited build before patching it. The testnet Picks build is the audited source with two constants changed: the test owner, and a 10-min admin wait.
    - Game 3 on testnet uses 1-hour rounds and 50 picks a day.
    - Six test players: p1 is the owner's; p2–p6 are robots, and p6 skips every third round.
    - The local server keeps the test keys and signs only Survivor picks. 1 test KOIN stands in for 1 VHP.
    - It takes an exclusive (`wx`) lock and releases it on Ctrl+C. It refuses device names and symlinks, and strips `PICKS_*` env vars.
  - **Docs:** `docs/SURVIVOR.md`, `docs/SURVIVOR-TESTNET.md`, `docs/SURVIVOR-CODE-WALKTHROUGH.md`, `docs/SURVIVOR-RUNBOOK.md`.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md (2026-11-02)

---

### Survivor: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** decision
- **Content:**
  - **27 Oct**
    - The handicap comes from recent blocks, not VHP: h = kTop ÷ k, where k is the producer's own blocks over days d−8 … d−2. (With a VHP handicap, three producers that sign only 75–80% of their VHP share would land in the out-zone about 90% of days.)
    - Seasons last two weeks, with prizes of 4 VHP and 2 VHP.
    - Ties at the out-zone line are safe.
    - A prize needs 1 VHP (or a stake) at every daily check.
    - Knode's two producers stay in the field, and the page discloses it.
    - Launch waits for the other launch pieces.
  - **28 Oct**
    - A season needs 3+ players with 2+ valid picks.
    - A player knocked out by a missed pick gets no prize.
    - There is no promise that Knode-run wallets stay out of Survivor; it is an open market.
    - Testnet first, then the audit bot.
    - Survivor is the second new game to launch.
  - **29 Oct**
    - Every game takes stakes (Vault v6), with a staked board and a free board.
    - The free prize goes only to players who were free in both weeks of the season, and it still needs 1 VHP.
    - Staked weekly points come from the season standings at each week's end.
    - Survivor waits for the Hub's shared stake panel.
  - **30 Oct**
    - SV-A2 residual: the 3-player minimum stays.
    - SV-A10, two boards: free players must not reduce staked players' chance to win, and must not get more than the free prize. Each board has its own safety net and its own end, and the free board counts only wallets that can still win.
    - SV-A19: a knockout by an invalid pick (a producer not in the field, or one already used) can't win.
  - **Left to the Block X chat:** Block X's python check runs without `-I`, and its `|| true` on listings (S3-21, S3-22). Block X's tests pin those lines.
- **Status:** Filed → platform/DECISIONS.md, OPENISSUES.md (2026-11-02)

---

### Survivor: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** fact
- **Content:**
  - **Season:** 14 UTC days, Monday to Monday. `FIRST_DAY` is `null` until launch.
  - **Picks:** one producer per UTC day.
    - Picks lock 5 min before 00:00 UTC and open 7 days ahead.
    - Up to 5 changes and 20 picks a day.
    - A player joins by picking for day 1.
  - **Out-zone:** floor(field × (12 + day) ÷ 52). With 17 producers that is 4,4,4,5,5,5,6,6,6,7,7,7,8,8. A tie at the line is safe.
  - **Field:** producers with 280+ blocks in the 7-day window.
  - **Lives:** 2. A player loses a life for:
    - a pick in the out-zone;
    - no pick;
    - a producer not in the field;
    - a producer already used (each producer can be picked once a season).
  - **Boards:** staked (staked in Survivor in either week of the season) and free.
    - Each board has its own safety net, which saves only out-zone losses.
    - A board ends after the day that leaves 2 or fewer of its counted players (if more than 2 started), when none is left, or after day 14.
    - The season ends when both boards have ended; the final comes 12 h later.
  - **Ranking:** lasted longest, then lives, then total score.
  - **Free prize:** 4 / 2 VHP, ties split. It goes only to players who:
    - were free in both weeks;
    - held 1 VHP at every check;
    - were not knocked out by a missed or invalid pick;
    - played in a season with 3+ such players.
  - **Staked:** weekly vault points come from the staked board's standings. Points collapse to 1 beyond 255 places.
  - **Game 3 registration:**
    - kind 1, list_size 1, lock_mode 2;
    - round_size 86,400,000, round_offset 0;
    - lead 300,000, ahead 604,800,000;
    - max_changes 5, 20 picks a day, enabled.
  - **Simulation** (field of 17; script `claude/builds/04-survivor-sim.mjs`):

    | Players | Season ends |
    |---|---|
    | 10 | about day 11 |
    | 50 | about day 13 |
    | 200 | about 4 still in on day 14; the ranking decides |
- **Status:** Filed → platform/DECISIONS.md (D-051), ARCHITECTURE.md; game spec pending in .ai/games/ (2026-11-02)

---

### Survivor: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** idea
- **Content:**
  1. Run Repo Lense pass 4 on `a8a1979` with the brief `claude/audit-survivor-prompt.md`; it produces `AUDIT-SURVIVOR-REPORT-4.md`. Then fix and get an independent fix-check.
  2. Play a testnet season (`docs/SURVIVOR-TESTNET.md`).
  3. Make the Picks contract live on mainnet (done 30 Oct per the Block X and Picks chat), then register game 3 with the settings above.
  4. Set `FIRST_DAY` to the launch Monday, then commit and merge (owner OK needed).
  5. Vault v6 must be live: it pays the free prizes and the staked points.
  6. Add Survivor to the Games menu and set `games.json` to live.
  7. Leaderboards and Results: Survivor needs a `board.json` and a Results adapter.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Survivor: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** warning
- **Content:**
  - **Known and accepted:**
    - Forged days or stake lists in games-data can't be caught without the chain, so the vault must recompute each season from the chain before paying.
    - About 10k one-day wallets push a season file past 2 MB; that file then stops updating and an alert fires.
    - A UTC day with no blocks can't be recorded.
    - VHP balances are read at each node's head.
    - A check node that hangs after its first read (N7) is bounded only by the step limit.
    - Lookalike producer addresses (S3-27).
    - The pre-launch "guest wallet" text (S3-26).
    - A Block X publish failure also stops Survivor (picks' design).
    - The test server times rounds with the PC clock.
  - **Rehearsal flake:** the fake testnet sometimes reports a pick "not mined" within its 2-minute wait; rerun it.
  - **For audit pass 4 to check:**
    - Can a board change mid-season be exploited (staking in week 2, or withdrawing)?
    - Can the per-board nets or ends be gamed with cheap wallets?
    - Can the clock checks refuse legitimate output (UTC midnight, the correction window, a job clock that lags the chain)?
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Survivor: TODOS
- **Date:** 2026-11-02
- **Source chat:** Survivor
- **Category:** open question
- **Content:**
  - [ ] Owner: in `C:\kprediction-test`, run `git pull`, then `npm ci`, then `git log -1 --oneline` and check it shows `a8a1979`. Then run Repo Lense and send back `AUDIT-SURVIVOR-REPORT-4.md`.
  - [ ] Owner: choose the Season 1 start Monday.
  - [ ] Fix the pass-4 findings, get a fix-check, and push to `survivor`. Then update the brief, `claude/builds/04-survivor-plan.md` and the checklist artifact (task t06).
  - [ ] Tell the Block X chat about python `-I` and `|| true` (S3-21, S3-22).
  - [ ] Tell the Vault chat that `vault.ts` should alert when a prize post is refused.
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---

### Last Node Standing: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** fact
- **Content:**
  - **Chain:** Koinos mainnet. RPC `https://koinos.armana.io` (primary) and `https://api.koinosblocks.com` (check node). Testnet paths refuse the mainnet chain id.
  - **Repo:** `bawcejawn/Knode`. The owner's clone is `C:\kprediction` (Windows, PowerShell), and several chats share it.
  - **Branches:**
    - `main`: the live site at the repo root (never `site/`), served at knodegames.com.
    - `picks`: Block X, the Picks tooling and the VHP sampler; not merged into `main` yet.
    - `lastnode`: this game.
    - `games-data`: recorder output.
    - `race-data`: hourly race cards.
    - `race-samples`: 5-minute VHP samples; doesn't exist yet.
  - **Live mainnet contracts:**
    - **Picks:** `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm`, uploaded 2026-10-30 20:35 UTC. Game 2 (Block X) announced; it goes on 2026-11-01 21:23 UTC.
    - **Game / Vault:** `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`. Owner `1635QUr…H717`; genesis 2026-10-19 00:00 UTC (`1792368000000`); minimum stake 1 VHP.
    - **Sponsor (Mana):** live; covers the Picks `pick` row.
  - **CI:** the "Resolver tests" workflow runs `npm run test:audit` on Linux on every push to `lastnode`, and is the authoritative run. Scheduled workflows run only from `main`, which is why `race-samples.yml` (on `picks`) isn't running.
  - **Tests:** built for Linux (bash, Python 3). On Windows, the Last Node tests import files by file URL, find Python as `python3`, `python` or `py`, and skip bash-only steps with a reason. Other games' tests still need Linux.
  - **Picks build:** sometimes fails with EAGAIN from protoc or yarn; rerun it.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Last Node Standing: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** fact
- **Content:**
  - **Rules** (`lastnode-math.js`, shared by the page and the recorder):
    - `KLastNode` is game 13; `forGame()` gives other timings. Game 13 cuts hourly from 14:00 UTC daily. Game 94 is the testnet fast game (20-minute cuts, an event every 4 hours). Game 33 is the testnet copy of the real timing.
    - Round `OFFSET = (PHASE − LOCK_BEFORE + LEAD) mod PERIOD`: each round targets 13:55 UTC with a 5-minute lead. Picks open 24 h ahead and lock at 13:50 UTC.
    - Picks registration: kind 2, list_size 2, lock_mode 2 (time), round_size 1 day, lead 5 minutes, ahead 24 h, 5 changes, 10 picks a day.
  - **Recorder** (`bot/games/lastnode.ts`):
    - Read-only on the chain, no keys. Reads two nodes, irreversible blocks only, and they must match.
    - Writes `games-data/lastnode/D<day>.json`, `index.json`, `board.json`, `vault/W<week>.json` and `vault/HOLD-W<week>.json`.
    - `finish()` exits once the files are written.
    - Testnet mode (`--testnet --game N`) uses `TESTNET_*` env names and writes only inside `testnet-data/`.
  - **Workflow** (`.github/workflows/lastnode.yml`):
    - **record** job: a read-only token and no secrets. Fetches race-data, games-data and the race-samples history (a snapshot every 6 h, 60 h back).
    - **publish** job: runs no repository code. A Python shape check, then the `histcheck.py` heredoc with Python ports of `cuts_from` (with `hh`), `player_result`, `board_rows`, `vault_scores`, `race_cut`, `watch_week` and `js_round`.
    - The publish job has its own stdlib Python Koinos JSON-RPC client: `chain.get_head_info`, `block_store.get_blocks_by_height` (200-block pages) and `chain.read_contract` (`list_picks`, entry 2118033200, hand-written protobuf, base64url). Its timeout is 20 minutes.
  - **What the publish job re-checks on two nodes:**
    - **New hours:** boundary blocks and every field node's count.
    - **New hour-0 picks:** exactly `list_picks`; picks at or after the lock are dropped.
    - **A new field:** must come from the event's race card (the first card from 12:00 UTC the day before until picks open), with every node's VHP, kh and node set from that card, and every h from the formula at the field's c.
  - **Other publish rules:**
    - A vault file is published only in a later run than the final board, and only if that run leaves last week's files unchanged.
    - "Final" needs every event done or void, and 12 hours after the week ends.
    - Write-once history: published fields, picks, hours, finished events and a final week can't change.
    - Only JS-safe numbers.
    - Status files use `\n` line endings; every failure is printed and the run fails once, at the end.
  - **Still trusted to the record job:** c, each node's form r, and the staked-wallet list (the v6 `get_game_player` ABI isn't in the repo).
  - **Page** (`lastnode.js`, `lastnode.html`): uses the chain's clock; live windows follow the recorder's card rule; it sends only one transaction, a Picks `pick` of [start, backup].
  - **Test infrastructure:**
    - `tests/audit/lastnode-vault.helpers.mjs`: `publisher()` runs the real publish shell against a bare repo; also `chainFor`, `fieldCard`, `dayFile`, `gamed`.
    - `tests/audit/lastnode-form.helpers.mjs`.
    - `tests/audit/lib/fake-koinos-rpc.py`: a fake two-node RPC (`/a`, `/b`).
    - `tests/audit/lib/platform.mjs`: `PY`, `withPython`, `withBash`.
    - `tests/audit/lib/quiet.mjs`: mutes recorder narration (`LASTNODE_TEST_LOG=1` shows it).
    - `tests/audit/lastnode-ports.test.mjs`: Python/JavaScript parity fuzz.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md, KOINOS.md (2026-11-02)

---

### Last Node Standing: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** decision
- **Content:**
  - **Field:**
    - Taken from the race card at 12:00 UTC the day before (or the next leg's card, if it was taken before picks open).
    - Nodes at ≥ 20 blocks an hour by VHP, at most 23.
    - h = (kTop/k)(1 − c/√k)/(1 − c/√kTop), 4 decimals; c on a 0–2.5 grid from 20,000 seeded simulations.
  - **Form:** 48 h of blocks ÷ the blocks the VHP share gives, hour by hour against that hour's average VHP from the 5-minute samples. Kept within 0.80–1.20; at least 24 usable hours.
  - **Picks:** one per event, a start node plus an optional backup, before the start. The backup takes over automatically at the start node's first cut, if still standing; one jump.
  - **Points and board:**
    - 1 per cut survived, plus +5 for riding the last node without jumping or +3 after a jump.
    - Board order: points, then rides, then fewer jumps; exact ties share a place.
    - The field grows organically.
  - **Race-time cut:** VHP added after the field card can only lower a multiplier. Each window is judged by the first race card taken at or after its end; with no such card 2 h later, the latest card by its end. Hours are recorded about 30 minutes after they end.
  - **Watch-and-hold:**
    - Flag a node at weekly z ≥ 3.4 with at least 2 wins, or at z ≥ 5 in one event it won.
    - Blocks count in every window, also after the node's cut; noise is a leave-one-out over-dispersion estimate.
    - The vault file is held until released with `LASTNODE_RELEASE_WEEKS` (digits and commas only), and the publish job enforces this too.
  - **Owner accepted the N-6 trade-off (2026-10-30):** a 3% form-skimmer is caught in about 13% of weeks, one gamed event in about 98%, and honest weeks are held 1–1.5% of the time. Tests pin these rates.
  - **Launch gate:** no field without form on mainnet unless `LASTNODE_ALLOW_NO_FORM=true`. The owner chose to wait for the sampler.
  - **Process:**
    - Wait for clean reviews and audits before any merge to `main`.
    - No push to `main` or deploy without the owner's OK; standing OK to push `lastnode`.
    - Never touch mainnet from testnet paths. Never print or ask for keys. Don't touch `picks/assembly/Picks.ts`.
  - **Owner preferences:** beginner-level explanations, a "Today" checklist, copy-paste PowerShell with `cd C:\kprediction` and `git branch --show-current` in every block, and keep asking questions.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Last Node Standing: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** fact
- **Content:**
  - **Game ids:** 13 is mainnet; 94 is the testnet fast game; 33 is the testnet real timing (`testnet/lastnode.json`).
  - **Vault file:** `{game:13, week, final:true, rows:[{player, points 1–255}], first:[], second:[]}`. Rows are wallets staked in game 13 that week with at least 1 point. Written from 12 h to 3 days after the week ends; no file before Vault v6.
  - **Reviews:**
    - Round 1: LNF-1 to LNF-31.
    - Round 2 (`FIXCHECK-LASTNODE-2.md`): N-1 to N-12, L-1 to L-12, I-1 to I-9. All fixed except L-9 (not done), L-7 (partly), and I-3 to I-6 and I-8 (Info, not changed).
    - Write-up: `docs/lastnode/FIXCHECK-2-FIXES.md`.
  - **State:**
    - `lastnode` @ `adf95be`, which includes the `picks` merge at `d3203f1` (`picks` has since moved to `3472d8c`).
    - Full suite: 718 tests, 708 pass, 0 fail, 5 skipped, 5 TODO (other games' owner decisions).
    - Last Node tests: 109 on Linux; on Windows, 85 pass and 24 skip.
  - **Project docs:** `claude/lastnode/FIXCHECK-2-FIXES.md`, `claude/lastnode/FIXCHECK-3-PROMPT.md` (the round-3 reviewer prompt), and the earlier `FIXCHECK-1-*` and `TESTNET.md`.
- **Status:** Filed → platform/DECISIONS.md, PLATFORM.md, KOINOS.md; game spec pending in .ai/games/ (2026-11-02)

---

### Last Node Standing: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** idea
- **Content:**
  1. Clean round-3 review of Last Node (fix → re-review until clean).
  2. Clean Block X review (round 11, in the Block X chat).
  3. Merge `picks` into `main` with the owner's OK. This starts the VHP sampler (`race-samples.yml`, with the existing `RACE_ENABLED=true`).
  4. Announce game 13 on the mainnet Picks contract, then apply it after 48 h. Needs the owner key; can overlap with step 5.
  5. 48 h of sampler readings.
  6. PR `lastnode` into `main` with the owner's OK.
  7. Set `LASTNODE_ENABLED=true`; leave `LASTNODE_ALLOW_NO_FORM` unset. `LASTNODE_PICKS` defaults to the mainnet Picks address.
  8. Watch the first live day (the publish job's chain client has never run against a real node).
  9. Staked prizes start once Vault v6 is live; free play and the board work before then.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Last Node Standing: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** warning
- **Content:**
  - **Remaining trust (N-1):** c, form r and the staked list aren't re-checked by the publish job. The vault bot should check that every staked board player is in the vault file. Whether the vault bot honours HOLD files isn't in this repo.
  - **N-6:** a steady 3% form-skim over a week is largely undetectable (accepted). Possible later fixes: a 4-week rolling check, or a shorter or recency-weighted form window.
  - **Chain client:** the publish job's JSON-RPC client is untested on real mainnet nodes (field types, paging, base64url padding).
  - **L-9:** sample averages aren't time-weighted.
  - **Simulation limits:** the fast game leans toward small nodes; form weighs all 48 hours the same.
  - **Windows:** other games' tests (heal, the Block X publish shells, the yml JSON-form tests) fail on Windows; that's expected, they need Linux.
  - **`games.yml` conflict:** taken from `picks`, which dropped `lastnode`'s 3-try push loop in that file (Last Node's own push loop is unchanged).
  - **Out of date with `picks`:** `lastnode` is behind `picks` (`3472d8c`); resync after Block X lands on `main`.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Last Node Standing: TODOS
- **Date:** 2026-11-02
- **Source chat:** Last Node Standing
- **Category:** open question
- **Content:**
  - [ ] Owner: send `claude/lastnode/FIXCHECK-3-PROMPT.md` to the reviewer and return the report. Before each session, run `git branch --show-current` and `git log --oneline -1`: expect `lastnode` and `adf95be` or newer.
  - [ ] Owner: later, run the game-13 announce and apply with the owner key, and set the GitHub variables.
  - [ ] Fix the round-3 findings.
  - [ ] Prepare the game-13 announce/apply commands for mainnet Picks (`bot/picks.ts` registers only Block X on mainnet so far).
  - [ ] Confirm the sponsor covers game-13 picks.
  - [ ] Resync `lastnode` with `main` after the `picks` merge.
  - [ ] Open the `lastnode` → `main` PR.
  - [ ] Write the steps for setting the GitHub variables.
  - [ ] Watch the first live runs.
  - [ ] Tell the Vault chat: the vault file format, what HOLD files mean, and that the vault bot should verify the staked list.
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---

## Chat: Block Golf (exported 2026-11-02)

Block Golf (Build 6, game 6): a platform-wide golf course scored from every other game's weekly leaderboard. State as of 2026-10-29. Branch `golf` (built on `picks`), last commit after `3099006` (docs follow-up); pushed, not merged, nothing deployed.

---

### Block Golf: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** fact
- **Content:**
  - Game week: Monday 00:00 UTC to Monday 00:00 UTC. Vault week 0 began Mon 19 Oct 2026 00:00 UTC (`GENESIS = 1792368000000`); week = floor((t − genesis) / 7 days).
  - About 3 s per block: ~1,200 an hour, ~28,800 a day.
  - Recorder nodes: RPC `https://koinos.armana.io`, check node `https://api.koinosblocks.com`. `api.koinos.io` stopped answering on 28 Oct.
  - Data branches: `race-data` (`board.json`, `W###.json`, `index.json`); `games-data` with one folder per game (`blockx/`, `survivor/`, `bracket/`, `golf/`); `testnet-data`.
  - Real block history: `data/blocks-compact.csv.gz` (3.46M mainnet blocks, ~123 days), read with `readCompact()` in `common.ts`.
  - Sponsor caps (owner, 28 Oct): 25 Mana a day and 150 a week per wallet. They count each transaction's Mana limit (1 per action), not the Mana it burns (~0.3).
  - Picks contract hard limits: at most 50 picks per game per day, 50 changes, 32 games, list size 10; lead at least 100 blocks or 5 min; ahead at most 35 days.
  - Game ids:

    | Id | Game |
    |---|---|
    | 1 | Questions |
    | 2 | Block X |
    | 3 | Survivor |
    | 4 | Fantasy |
    | 5 | Fantasy Rival (records only) |
    | 6 | Block Golf |
    | 7 | Race |
    | 8 | Combo |
    | 9 | Bracket |
    | 13 | Last Node Standing |

  - The owner works in finance, is new to running code, and uses a Windows PC with the repo at `C:\kprediction`. They want plain explanations, a checklist with a Today list, and to keep being asked questions.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Block Golf: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** fact
- **Content:**
  - **`site/golf-math.js`** (`KGolf`, shared by the page and the recorder):
    - Constants: `PAR=4`, `LOST=7`, `MIN_FIELD=5`, `PRACTICE_MIN_FIELD=3`, `MIN_FIELD_VHP=10`.
    - Functions: `strokesFor`, `scoreHole`, `card`, `cards`, `rule`, `courseFor`, `shareText`, `weightOf`.
    - All integer math. Moves to the repo root with the site-at-root change.
  - **`bot/games/golf.ts`** (`npm run golf`) has no picks of its own; it reads other games' published results.
    - Readers: `questions` (the contract, read on two nodes), `race` (the `race-data` board), `blockx` (the `games-data` board). The Survivor and Bracket readers were removed after the audit.
    - Exports: `run`, `sourcesFromGames`, `stakersFrom`, `minStakeFor`, `vaultFile`.
    - It refuses to start if the last run's files exist but can't be read, so it never mistakes a read failure for a fresh start.
  - **Output in `games-data/golf/`:**
    - `index.json`: `weeks`, `course` {id: joinWeek}, `stakedFromWeek`.
    - `W###.json`: `final`, `practice`, `holes[]` (status, why, field, rows `[addr, score, scored, weight]`), `cards[]`.
    - `board.json`: the shared shape, with columns `pts`, `topar`, `holes`, `lost`.
    - `vault/W<n>.json`: unpadded.
  - **`.github/workflows/golf.yml`:** hourly at :57, concurrency group `knode-golf`. Off until `GOLF_ENABLED=true`.
    - The record job uses a read-only token and a `has_branch` check (`ls-remote --exit-code`).
    - The publish job runs no repo code.
      - Its Python shape check verifies `start` and `end` against the week, and rebuilds the vault rows from the W cards.
      - Its history check refuses: rewriting a final week; a shrinking week list; changed join weeks; a changed `stakedFromWeek`; changing a vault file already sent.
      - Pushes are retried 3 times.
  - **Page `site/golf.html`, `golf.js`, `golf.css`:**
    - Shows the week on a navy score panel and the scorecard with paper-card marks (birdie circled, bogey boxed).
    - Also: mulligan, skipped and in-play holes, links to games not yet played this week, the shared `board.js` leaderboard (Staked / Free play), a copyable share line, and a How-it-works stroke key.
    - Read-only, with strict CSP and nothing built from HTML.
  - **`site/games.json`:** the Block Golf entry has a `board` config, with status `soon`. `index.html`'s CSP now allows `games-data/`, and the pinned CSP test was updated.
  - **Block X `games.yml`:** its publish step now retries the push 3 times, since Golf also pushes `games-data`.
  - **Vault v6 interface:**
    - A staker is `get_game_player(player, 6, week).week_stake` ≥ `minStakeFor(week)`. The minimum is `config.min_stake`, or `min_stake_next` from `min_stake_next_week`, and never below 1 VHP. It is read from `get_state` on two nodes, which must agree.
    - Results file: `{game:6, week, final:true, rows:[{player, points}], first:[], second:[]}`.
    - The Vault bot (`bot/vault.ts` on `vault-v6-next`) names files `W${week}.json` with no padding (confirmed 29 Oct).
  - **Runbook:** `docs/GOLF.md`. Testnet workflow and `testnet/golf.json` were removed (owner: no testnet).
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md, KOINOS.md (2026-11-02)

---

### Block Golf: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** decision
- **Content:**
  - **Redesign (owner, 28 Oct):** every live game is a par-4 hole, and a player's place on that game's weekly board sets their strokes. The 27 Oct "guess the block gap" design is dropped.
  - **Strokes by place** (ties share the middle place):

    | Place | Strokes |
    |---|---|
    | 1st, if the player scored | 1 |
    | Top 5% | 2 |
    | Top 25% | 3 |
    | Top 65% | 4 |
    | Top 90% | 5 |
    | The rest, or played but scored 0 | 6 |
    | Didn't play | 7 (lost ball) |

  - **Mulligan:** the worst *played* hole is dropped; a lost ball can't be dropped.
  - **Holes:** every hole counts the same.
  - **Practice:** free practice scorecards from the Block X launch week, with no prizes.
  - **Launch early, not last:** practice with Block X, staked right after Vault v6. Games join the course automatically from the Monday after they go live; no manual or contract change is needed.
  - **Practice weeks:** every player who scored counts; 3 players make a hole.
  - **No testnet run.** The practice weeks on mainnet are the trial.
  - **Staked weeks:** only players **staked in Block Golf** that week count ("absolutely").
    - Count **VHP staked, not wallets**. A player counts as one unit among the others' stake, so their own stake never moves them.
    - A hole needs **5 stakers AND 10 VHP** among its scorers. These are Claude's defaults; the owner can change them.
  - **Question-game hole:** keeps Block Golf's simple rule.
  - **Points to the vault:** 7 × counted holes − strokes. Rows hold only players with at least 1 point. A week with no staked scorers still gets a file, with empty rows.
  - **Finality:**
    - A week is final 12 h after it ends, once every hole is final and the run had no read problem.
    - A hole that isn't final by 60 h is skipped; the Race uses its board's final-race standings at 60 h.
    - From 66 h, a read problem no longer blocks the week.
    - A staked hole becomes final only after the stakes are read once the week has ended.
    - Final weeks are frozen.
  - **Practice or staked** is set by the GitHub variable `GOLF_STAKED_FROM_WEEK`. It is fixed per week when the week is first recorded, can't be changed once published, and is refused until the v6 ABI is merged.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Block Golf: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** fact
- **Content:**
  - **Dropped design, for reference:** on 123 days of real blocks, the gap to an online producer's next block is pure luck. Offline producers (~5% of holes) and pace against the card were the real signals; chain-watchers won ~88% of weeks. Not built.
  - **Audit trail** (all fixed):
    - First audit: 5 High, 4 Medium, 5 Low (H1–H5, M1–M4, L1–L5).
    - Fix-checks N1–N4, S1–S4 and V1–V5, then a last fix-check N1: one 10-VHP wallet could make a hole on its own.
    - Accepted residual: real stake in extra wallets that play and score low nudges everyone above them up a little. It costs locked stake and earns little.
  - **Tests:** full suite 471 pass, 0 fail (481 in all, with 5 skipped and 5 known TODOs). Golf has 29 recorder tests and 26 math/page tests.
  - **Decisions per wallet per day across the platform:** ~26 after the redesign (Golf needs no picks), with a Sunday peak of ~30–35. It was ~35 a day with an ~85–90 Sunday peak under the old design.
  - **Previews:** the "Block Golf Preview" artifact (sample players, view-as switcher) and the "KnodeGames Owner Checklist" artifact (db capability, collection `tasks`).
- **Status:** Filed → platform/DECISIONS.md, PLATFORM.md, KOINOS.md; game spec pending in .ai/games/ (2026-11-02)

---

### Block Golf: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** fact
- **Content:**
  - **Launch order (28 Oct):**
    1. v5
    2. Sponsor caps
    3. Domain
    4. Guest wallet
    5. Questions + Race Show (Mon 2 Nov)
    6. Sponsor v3 + Picks upload
    7. **Block X, with Block Golf practice (Mon 9 Nov)**
    8. Survivor
    9. **Vault v6 (aim: late Nov)**
    10. **Block Golf staked**
    11. Last Node Standing
    12. Bracket
    13. Fantasy
    14. Combo
    15. Sponsor KOIN sizing
  - **Practice launch:**
    - After `picks` merges: `git mv site/golf.* golf.*`, change the import to `../../golf-math.js`, point tests at `${APP}/<file>`, run the full suite, and merge.
    - Set `games.json` to `live` with href `golf.html`, add Block Golf to `tools/site-nav.mjs`, set `GOLF_ENABLED=true`, and run once.
  - **Staked launch:** v6 live → v6 merged → register game 6 (48 h) → set `GOLF_STAKED_FROM_WEEK`. The `vaultGames` line is `"6": { "name": "Block Golf", "results": "games-data:golf/vault" }`.
  - **Later holes:** each game adds its reader plus a test in its own build.
    - Survivor must recompute standings at the week's last season day with `survivor-math`.
    - Bracket must read its W file, not the 1,000-row board.
    - Also: Last Node Standing, Fantasy, Combo.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Block Golf: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** open question
- **Content:**
  - Block Golf is blocked on Block X going live: sponsor v3 (ceiling, fix-check, upload), the Picks upload and testnet trial, the 48 h announcement, and `GAMES_ENABLED`.
  - The `picks` branch and every game branch must move to the site root before merging (`claude/site-at-root.md`).
  - Staked Block Golf needs Vault v6 live: rehearsal, audits, then the 48 h notice.
  - Early practice weeks will have small fields: 3 holes leave only 2 counted after the mulligan. Real Race data on 28 Oct had 2 players, neither ranked.
  - The defaults `MIN_FIELD=5` and `MIN_FIELD_VHP=10` should be revisited once there is real stake data.
  - The question-game field rule differs from that game's own board. The owner chose to keep Golf's simpler rule.
  - Whether 25 Mana a day is enough for heavy players still needs measuring on testnet. Guests can't fall back to their own Mana.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Block Golf: TODOS
- **Date:** 2026-11-02
- **Source chat:** Block Golf
- **Category:** open question
- **Content:**
  - [ ] Rebase `golf` after `picks` merges, move it to the site root, run the full suite, and open the PR/merge with the owner's OK.
  - [ ] Set Block Golf live in `games.json`, add it to the nav, and set `GOLF_ENABLED=true` (practice, with Block X).
  - [ ] At v6: register game 6, set `GOLF_STAKED_FROM_WEEK`, and confirm the Vault reads `games-data:golf/vault`.
  - [ ] Add each later game's hole reader when it launches.
  - [ ] Optional: stop the "vault file has no rows" problem line repeating every hour.
  - [ ] Owner checklist items left: t28 (review the preview) and t30 (turn on Golf practice).
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---

## Chat: Producer Bracket (exported 2026-11-02)

Producer Bracket (Build 9, game 9): a weekly knockout bracket of Koinos block producers, picked as one number on the Picks contract; staked game with a free-play prize. Branch `kg-09-bracket` (built on `picks`, `main` merged in), last commit `ee676ea`; pushed, not merged, nothing deployed. Also the home of the platform-wide **KnodeGames VHP standard**.

---

### Producer Bracket: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** fact
- **Content:**
  - Repo `bawcejawn/Knode` (renamed from Kprediction). Since main's PR #31 the site sits at the repo root (knodegames.com); `site/*.html` are redirect stubs only.
  - Koinos mainnet RPC `https://koinos.armana.io`; check node `https://api.koinosblocks.com` (`RPC_CHECK`). `api.koinos.io` is dead.
  - The cloud workspace and the owner's linked PC both block Koinos node traffic (DNS / proxy 403): live chain reads only run in GitHub Actions.
  - VHP contract `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq`. Vault contract and producer `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (`game-data/deployment.json`).
  - KnodeGames week 0 = Monday 2026-10-19 00:00 UTC (`GENESIS = 1792368000000`); the Vault's week number = the KnodeGames week.
  - Data branches: `games-data` (one folder per game, e.g. `games-data:bracket/`); `bracket-history` (100 days of mainnet data, ~22 MB): keep.
  - Vault v6 code on branches `vault-v6` and `vault-v6-next` (latest seen `6e1c139`); not merged into `main` during this chat. `vault-v6-next` `game-data/deployment.json` has `vaultGames["9"] = {name: "Producer Bracket", results: "games-data:bracket/vault"}`.
  - The Mana sponsor pays for every game play on KnodeGames, guests included.
  - Rules (CLAUDE.md): never push, merge, deploy, upload a contract or change chain settings without asking; never ask for, print or store a private key or WIF; recorders run with no secrets, read two nodes, use irreversible blocks, and publish through a job that runs no repo code.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Producer Bracket: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** fact
- **Content:**
  - **The KnodeGames VHP standard** (`vhp-standard.js` at the root, `KVhp`; docs `docs/VHP-STANDARD.md` and project `claude/vhp-standard.md`):
    - **Source:** VHP is rebuilt block by block from the VHP contract's events (transfers, mints, the ~4.08 VHP each block burns from its signer; the block reward is paid in KOIN). Reverted transactions are skipped. Anchors are balance reads pinned to one block, on two nodes that must agree. A fork check compares block ids.
    - **Effective VHP:** received VHP counts only after 20 blocks; removed VHP stops at once. `effective(a,H) = max(0, before(a,H) − received in H−19…H−1)`. PoB reads it before the block's own transactions. The contract's `effective_balance_of` is entry point `0x629f31e6`.
    - **Constants:** `DELAY_BLOCKS` 20, `ACTIVE_BLOCKS` 7200, `CARD_BLOCKS` 7200, `SEED_BLOCKS` 28800, `MIN_K` 10 (expected blocks in a 6-hour race to be in the field), `Q_SCALE` 1e15.
    - **cardVhp + card credit + average totals (always together):**
      - A producer's own numbers set its multiplier: `vhp` (the highest effective VHP over 7,200 blocks) or `k = 7200 × cardVhp ÷ Σavg`.
      - Each scored block is worth multiplier × `min(1, cardVhp ÷ effective then)` (`cardCredit`).
      - Anything about other producers uses averages: the total, `topAvg`, the field split `kAvg`.
    - **Baseline + credit**, for judging after the fact:
      - Baseline = effective VHP at the window's start.
      - Expected = baseline × Σ over the window's blocks of 1 ÷ the active set's effective VHP.
      - Credited = Σ over the blocks it signed of `min(1, baseline ÷ VHP then)`.
    - **averageVhp** over 28,800 blocks, for seeding and fields.
    - Functions: `vhpDeltas`, `vhpBook`, `activeAt`, `fieldOf`, `cardAt`, `cardCredit`, `averageCard`, `windowStats`, `expectedBlocks`.
    - Rule: never use cardVhp alone, and never take a multiplier from an average-based number.
  - **`bot/vhp-chain.ts`** (shared recorder reads):
    - `chainNode(provider)`: `chain(from, to)` reads blocks with receipts (4 workers, 50 blocks a call); `balance(a)` returns `{v, eff?, h, id}`, read while the head stays unchanged.
    - The `effective_balance_of` cross-check can be skipped: one failure turns it off for the run, with a warning.
    - `heightAt`; `bookFor(n, fromH, toH, also)` returns `{c, book, effCheck: {n, atNext, atHead, skipped}}`. A match at h+1 or at h is accepted; neither stops the run, as do a below-zero rebuild or a fork.
    - About 400 blocks/s with 4 parallel reads.
  - **Bracket files** (branch `kg-09-bracket`):
    - `bracket-math.js` (`KBracketMath`). Page script order: `vhp-standard.js`, `bracket-math.js`, `board.js`, `bracket.js`.
    - `bot/games/bracket.ts` (the recorder, `npm run bracket`); `bracket.html` / `bracket.js` (the page, `ROOT = "./"`).
    - `.github/workflows/games.yml`: the Bracket step (`continue-on-error`) and the publish job (a Python shape check with no repo code, then a push loop that includes `vault/`). `ls-remote` checks tell a missing branch from a fetch error.
  - **Files the recorder writes:**
    - Week file v4: `{v, week, start, end, status, seeding, picks, days, results, points, void?, staked: {checked, list, held?} | null, vault?: "missed"}`.
    - Seeding: `{at, cardAt, size, seeds, vhp, totalVhp, out, pooled, hash}` (SHA-256, covering `pooled`).
    - Hours: `{from, to, n, by, cr, w, q, checked: 2}`.
    - Boards: up to 2,000 rows each, with `ranked` set to true or false.
    - Vault file `bracket/vault/W<week>.json` = `{game: 9, week, final: true, rows: [{player, points 1–255}], first: [], second: []}`.
  - **Recorder limits:** at most 6 hours of chain a run, 4 parallel reads; it refuses to write if last run's files are missing; fetch errors stop the run.
  - **Shared code:**
    - `board.js`: options `free: {show, prize}` and `hide`; Free play now uses a game's shared `place` (ties) when the game gives one.
    - `wallet.js` `guestPicks`: a sponsored guest wallet for picks.
  - **Tests:**
    - `tests/audit/vhp-standard.test.mjs` (8): a line-by-line port of the VHP contract matched on 3,000 random histories; the S-1, S-2 and F-3 cases.
    - `site.bracket.test.mjs` (25); `bracket-recorder.test.mjs` (22).
    - `bracket-vault-abi.test.mjs` (2): reads the real Vault v6 ABI through a fake node.
  - **Simulation tools** (`tools/sim/bracket/`): `sim.mjs`, `hist.mjs`, `replay.mjs` (the real recorder over the 8-day sample `data/bracket-vhp-sample.json.gz`), `sample-vhp.ts`, `analyze-vhp.mjs`, `history-vhp.ts`, `history-analyze.mjs`, `live-effective.ts` (a one-off live check).
  - `docs/bracket/README.md`: the reviewer guide (rules, data flow, trust model, history).
  - **Copied from `vault-v6-next` (`6e1c139`):**
    - `game/abi/kpred.koilib.json`: `get_game_player` (entry point 267077419) and `get_state`.
    - `game-data/deployment.json`.
  - **Vault v6 read fields:**
    - `get_game_player(player, game, week)` returns `{player, entry{stake, voided, points, claimed, reward, prize_place, peak_stake}, active_stake, week_stake}`.
    - `get_state` gives `config.min_stake`, `min_stake_next`, `min_stake_next_week`.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md, KOINOS.md (2026-11-02)

---

### Producer Bracket: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** decision
- **Content:**
  - The whole bracket is stored as one number: bit n = "the lower seed wins matchup n"; bye bits must be 0; sizes 8, 16 or 32; `NUMBER_MAX` = 2³¹−1.
  - Seeding Saturday 12:00 UTC; lock Sunday 23:55 UTC (~36 h of picking); one round per UTC day from Monday.
  - Fewer than 8 producers means no bracket that week. 12–15 producers get 16 slots with byes. The 32-producer bracket is ready from launch.
  - Option A: exact VHP from the chain's own events (2026-10-28).
  - The VHP standard: every game measures VHP the same way; multipliers stay game-specific (2026-10-28).
  - **Player rule:**
    - A staked player has at least the Vault's minimum stake (1 VHP) staked in this game.
    - A player staked at the start of a week stays staked that week.
    - Boards rank players staked in this game.
  - **Forfeit (S-5), owner yes:**
    - A seed whose baseline is under 0.5 × its seeding VHP loses the matchup.
    - If both seeds forfeit, the index decides.
  - **No producer left out:** no producer is left out unless it misses the minimum block production. Our own nodes play too (2026-10-29).
  - **The Vault never forfeits:** its VHP is players' withdrawable stakes; it is recorded as `pooled`.
  - **Free play prize:**
    - 2 VHP for 1st, 1 VHP for 2nd.
    - Players tied for 1st share all 3 VHP.
    - If 1st is a single player, players tied for 2nd share 1 VHP.
    - At most 10 a place; more than 10 tied → that place and those below stay empty.
    - Minimum play: one bracket with at least 1 point.
    - Guests are eligible.
  - **Tie-break:**
    - Order: points → a right champion → more right winners → **who submitted first** (the pick's last-change time) (2026-10-29).
    - Brackets sent in the same block share; the all-time board shares ties.
  - Owner instructions are given as full PowerShell blocks (with the `cd`) or click-by-click steps.
  - The 3 sampling branches may be deleted; keep `bracket-history`.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Producer Bracket: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** fact
- **Content:**
  - **Picks game settings:** game 9, NUMBER kind, TIME lock, `round_size` 7 days, `round_offset` = GENESIS mod WEEK (round = week + 2963), lead ≥ 5 min, ahead ≤ 36 h, 20 picks a day, 20 changes.
  - **Sizes:** under 8 → no bracket; 8–11 → 8 (Mon–Wed); 12–15 → 16 with byes; 16–31 → top 16 (Mon–Thu); 32+ → 32 (Mon–Fri).
  - **Seeding:** averageVhp over 28,800 blocks, on two nodes that must agree; biggest average = seed 1. Not seeded within 24 h → void.
  - **Matchup:** baseline + credit; index = credited ÷ expected; an exact tie goes to the lower seed.
  - **Points:** 1/2/4/8/16 by round, +2 for the champion (max 14 / 34 / 82). Byes score nothing.
  - **Stakes and finality:**
    - Stakes are read on both nodes once the week starts (for the live boards) and again at the close ("held" = the Vault's peak-stake rule).
    - The week is final 12 h after its last round, once the close read is in.
    - Still unreadable 3 days after the week ends → final as `vault: "missed"`, with no file.
  - **Vault rows:** dense-ranked onto 1–255; past 255 distinct places, the best 254 stay exact and the rest share 1.
  - **Boards:** the Staked tab shows staked players and anyone who withdrew during the week; the Free play tab shows the top 6.
  - **Evidence:**
    - The rebuild matched all 780 race-card VHP readings.
    - 100 days of history: 0 node disagreements; the better seed won 54.0% of 113 matchups; a "last week's form" bracket averaged 14.8 points against 4.8 for random picks.
  - **For the other games:**
    - Race and Block X aren't on the standard yet. To switch, they use cardVhp `k` with the card credit, and averages for everything about others. Block X becomes min(3, topAvg ÷ your cardVhp).
    - The Block X files moved to the repo root on this branch (`blockx.html`, `blockx.js`, `blockx-math.js`).
    - cardVhp replaces the random-sample check in `claude/handicap-anti-gaming.md`.
- **Status:** Filed → platform/DECISIONS.md, PLATFORM.md, KOINOS.md; game spec pending in .ai/games/ (2026-11-02)

---

### Producer Bracket: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** idea
- **Content:**
  1. Run the RepoLens audit with `claude/audit-bracket-prompt.md` (branch `kg-09-bracket`, commit `ee676ea`). Expected:
     - site tests 176 (175 pass, 1 TODO);
     - serial audit 457 (447 pass, 0 fail, 5 skipped, 5 TODO);
     - the replay passes.
  2. Fix the findings, then a fix-check prompt.
  3. Merge Vault v6 into `main`, then update the Bracket branch from `main` (recommended; the owner hasn't answered).
  4. Launch steps:
     - Announce game 9 in Picks (48 h timelock).
     - Announce game 9 in the Vault as staked + free_prize with 1-week seasons (48 h).
     - Add a sponsor allowlist row for game 9 picks.
     - Set `games.json` to live.
  5. Switch the Race and Block X to the VHP standard.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Producer Bracket: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** open question
- **Content:**
  - **S-3 / F-7:** the `effective_balance_of` read-only call has never been seen live. Pin which block it uses after the first real recorder run (the logged `effCheck`).
  - **F-2 (Low):** hiding VHP on the seeding day lowers a producer's forfeit bar. It costs a better seed and a day's rewards; accepted.
  - **F-10:**
    - Final weeks are re-scored on every load, so a scoring rule change after launch must apply only from a stated week.
    - Stake reads aren't pinned to a block; the two-node comparison catches drift.
  - A whale withdrawing during a day can still sink the Vault's matchup index. This is inherent to a pooled producer, and disclosed.
  - The 3 sampling branches (`bracket-sampler`, `bracket-samples`, `bracket-history-sampler`) still exist; the delete was refused with a 403, and the owner has GitHub UI steps.
  - The serial audit test `bot.vhp-read-failure.test.ts` failed once; it passes alone and on rerun (timing).
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Producer Bracket: TODOS
- **Date:** 2026-11-02
- **Source chat:** Producer Bracket
- **Category:** open question
- **Content:**
  - [ ] Owner: run RepoLens with the Bracket audit prompt and bring back `AUDIT-BRACKET-REPORT.md`.
  - [ ] Fix the audit findings, rerun all suites and the replay, and write a fix-check prompt.
  - [ ] Vault chat: register game 9 as staked + free_prize with 1-week seasons (the owner has sent this).
  - [ ] Merge Vault v6 into `main`, then update `kg-09-bracket` from `main`.
  - [ ] Owner: delete `bracket-sampler`, `bracket-samples` and `bracket-history-sampler` on GitHub (keep `bracket-history`).
  - [ ] Block X chat: tell it its files moved to the repo root.
  - [ ] Race and Block X chats: adopt cardVhp `k` with the card credit, and average-based numbers for others.
  - [ ] After the first live recorder run: read the `effective VHP cross-check` log line and pin the check.
  - [ ] Launch: announce in Picks and the Vault, add the sponsor allowlist row, set `games.json` to live.
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---

## Chat: Fantasy Producers (exported 2026-11-02)

Fantasy Producers (Build 5, game 4, plus Weekly Rival, game 5): draft five Koinos block producers under a salary cap, captain one, and score daily on how reliably they sign their blocks. State as of 2026-10-30:
- Branch `fantasy`, last commit `2bee805`, with `picks` merged in; pushed, not merged to main.
- Testnet practice deployed.
- Repo Lens fix-check package ready, not yet run.

---

### Fantasy Producers: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** fact
- **Content:**
  - Domain knodegames.com, live since 28 Oct 2026. Pages are at the repo root, not under `/site/`; `site/` holds only redirects, and pages must never be added there (`claude/site-at-root.md`).
  - Repo `bawcejawn/Knode`. Data branches:
    - `games-data` (`blockx/`, `fantasy/`);
    - `race-data`;
    - `blocks-data`;
    - `picks-data/deployment.json` (the Picks contract address).
  - Two folders on the owner's PC:
    - `C:\kprediction` holds mainnet keys and scheduled tasks. Practice tooling must never touch it.
    - `C:\kprediction-fantasy` is a separate clone for Fantasy testnet practice.
  - Testnet: the Koinos Foundation testnet (public API, Telegram faucet `@KoinosTestnetFaucetBot`, 100 tKOIN a day). It has only one block producer.
  - Mainnet reads: two nodes must agree, `koinos.armana.io` (primary) and `api.koinosblocks.com` (check).
  - Shared site pieces:
    - `styles.css` tokens: moss `--violet` #2F6B4F, navy #14213D, sun #F2B33D, tang #FF8A4C, paper #F3F1EA.
    - Fonts: Bricolage Grotesque (display), Atkinson Hyperlegible (body), Archivo with a width axis (numbers).
    - Scripts: `nav.js`, `wallet.js` (Kondor, KOIN Vault, guest), `header-wallet.js`, `stake-panel.js`.
    - Tools: `tools/site-nav.mjs` writes the menus into every page; `tools/site-seo.mjs` handles SEO and the sitemap.
  - Page rules:
    - one strict CSP meta tag per page, and no inline scripts;
    - CDN scripts are pinned by integrity hash (koilib 9.4.1, kondor-js 1.3.0);
    - everything is built with `textContent`, never from HTML strings.
  - Shared stake panel `stake-panel.js` (`claude/stake-panel.md`):
    - mounted with `KStake.mount(el, { game: id })` from the page's own script;
    - hidden until Vault v6 is live;
    - actions: Stake (`deposit_to`), Withdraw (`withdraw_from`), Move (`move_stake`), Claim (`claim_game`).
  - Game ids:

    | Id | Game |
    |---|---|
    | 1 | Question game |
    | 2 | Block X |
    | 3 | Survivor |
    | 4 | Fantasy team |
    | 5 | Weekly Rival |
    | 6 | Block Golf |
    | 7 | Race |
    | 8 | Combo Card |
    | 9 | Bracket |
    | 13 | Last Node Standing |

  - Vault rule: a player counts as staked in a game only with at least 1 VHP staked in that game that week. Each game's weekly vault file holds rows of `{player, points 1–255}`.
  - The owner wants step-by-step PowerShell instructions, plain language, and an owner checklist with a "Today" list (the Docs artifact "KnodeGames owner checklist", https://claude.ai/artifact/AuEhQTJXF25Ce5nNnthCYa). The owner also wants to keep being asked questions.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Fantasy Producers: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** fact
- **Content:**
  - **Files on branch `fantasy`** (at the repo root since the merge with `picks`):

    | File | What it does |
    |---|---|
    | `fantasy-math.js` | Shared rules and scoring, run by both the page and the recorder. Real clock, plus a fast test clock via `KFantasyMath.withClock({day, genesis, sheetBefore})`. |
    | `bot/games/fantasy.ts` | Read-only recorder. Holds no key; publishes `games-data/fantasy/`. |
    | `fantasy.html`, `fantasy.js`, `fantasy.css` | The game page. `noindex`, and not in the menus until launch. |
    | `.github/workflows/games.yml` | Runs the Fantasy step behind `FANTASY_ENABLED`, with `continue-on-error`, so Fantasy never blocks Block X. |
    | `bot/fantasy-test.ts`, `tools/fantasy-testnet/` | The testnet practice kit: `fake-chains.mjs`, `test-wallet.js`, `testnet.css`, `rehearse.mjs`. |
    | `docs/fantasy/README.md`, `TESTNET.md`, `FIXCHECK-PROMPT.md` | The game's docs. |

  - **Picks contract**, audited release sha `700c296a1064b904299c156061d6caf8fcabd0b1765968903f29d89d2426c594`:
    - Pick kinds: 1 = one address, 2 = a list of 2 to 10, 3 = a number.
    - Lock mode 2 (time): target = round × round_size + offset. Picks are refused from target − lead, with lead at least 5 minutes. Picks open `ahead` before the target.
    - Each game sets `max_changes` and `max_picks_per_day`.
    - A game needs a `name` of 1 to 40 bytes, or `announce_game` reverts.
    - Registering a game: announce, wait out the admin wait, then apply.
  - **Fantasy's Picks games:**
    - Game 4 (the team): a list of 5, captain first. Round = UTC day number. Locks 5 minutes before the day; opens 7 days ahead.
    - Game 5 (Weekly Rival): one address. Round = the day number of the week's Monday (rounds are days, offset 0), so the settings never depend on genesis.
  - **What the recorder publishes:**

    | File | Contents |
    |---|---|
    | `index.json` | Settings, plus `vaultBasis`: `"all"` or `"staked"`. |
    | `days.json` | Final days and today so far. Each producer: `[signed, expected, index]`. |
    | `W###.json` | One file per week. A final week keeps each team as positions on that week's price list, and its `picks` is emptied. |
    | `rivals.json` | Weekly Rival records. |
    | `alltime.json` | All-time totals. |
    | `board.json` | `week`, `lastWeek`, `rivals`, `mostChallenged`, `allTime`. |
    | `vault/W<week>.json` | `{game:4, week, final:true, rows, first:[], second:[]}`. |

  - **Recorder safety:**
    - Only irreversible blocks, and both mainnet nodes must agree.
    - A day is final only when every hour that had blocks also has a race card (FX-5).
    - A week is final only when all 7 days' blocks and picks are read, the rivals and stakes are read, and 12 hours have passed (FX-1).
    - If a week still isn't final 2 days after it ends, the recorder raises an `ALERT`; the vault's deadline is 3 days.
    - Unfinished weeks are retried for 8 weeks (FX-6).
  - **Vault file:**
    - Written only once the vault's ABI has `get_game_player`.
    - Stakes come from `get_game_player` (`week_stake` or `entry.stake` ≥ 1 VHP), read on both nodes.
    - The vault's source name for Fantasy is `games-data:fantasy`.
  - **`games.yml` safety:**
    - The record job stops if `games-data` exists but can't be fetched (FX-2).
    - File names are read line by line (BX-34).
    - The publish allowlist covers `blockx/`, `blockx/vault/`, `fantasy/` and `fantasy/vault/`, and each game's files get a shape check.
    - P### and `vault/W*` files are written once and never replaced, now including `fantasy/vault`.
    - Fantasy files are compared with the published branch: a price list, a final week, counted rival weeks, rival records, all-time totals and vault files can't change.
    - Fantasy files may be up to 8 MB; every other file 2 MB.
    - A final day must have `checked == 2`.
  - **Race cards** (`bot/race.ts`, after the merge with `picks`):
    - A card's VHP is the highest *effective* VHP over 6 hours of samples (`windowHigh`, BX-38), read with `effective_balance_of`.
    - A card made from fewer than 12 samples is flagged with `samples`. Block X skips flagged cards; Fantasy currently uses them.
    - Fantasy finds the card in force with `F.cardAt` and works out each producer's expected blocks per hour.
  - **Testnet kit:**
    - Hybrid: picks go to a testnet copy of the Picks contract, and scoring reads mainnet blocks, read only.
    - The testnet Picks build (`picks/scripts/build-testnet.cjs --owner`) changes exactly 3 lines: the owner, a 10-minute admin wait and a 24-hour apply window.
    - A local server on 127.0.0.1:8380:
      - checks the host, the origin and a session token;
      - signs only Fantasy team and rival picks;
      - serves only top-level js/css/svg/png/webmanifest files and `media/`: no JSON, no subfolders, never keys or config.
    - Commands: `setup`, `status`, `fund`, `picks-build`, `picks-upload`, `games`, `week`, `team`, `rival`, `record`, `bots`, `site`, `run [--bots] [--no-open]`.
    - Robots p2 to p6: value, big names, random, chaser, late joiner.
    - Race cards: `cards: "github"` reads the live race-data; `"local"` is for the rehearsal.
    - The rehearsal's fake chain answers `effective_balance_of`.
    - Practice files live in `testnet-data/fantasy/`, which git ignores: `keys.env`, `config.json`, `picks/`, `race/`, `data/`, `bots.json`.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md, KOINOS.md (2026-11-02)

---

### Fantasy Producers: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** decision
- **Content:**
  - **2026-10-27:**
    - Plain handicap; salary from last week's form; budget 100; captain ×2; at most 130 points a day.
    - Knode's two nodes stay in the pool, disclosed on the page.
    - Moving the captain counts as the day's one change.
    - The bot checks each team's budget against the published price list.
    - Prizes are paid on the weekly total.
    - Weekly Rival keeps records only.
    - Late joiners are allowed; days before they join score 0.
    - No rush: launch only once the vault and Picks are audited and live.
    - Simulation option S3 approved.
  - **2026-10-28:**
    - Practice on the testnet, scored on mainnet blocks. 1 test day = 1 hour, with robots.
    - Ids 4 and 5. Five producers per team.
    - An **all-time table** (total, weeks played, best week).
    - A rival match counts only when both players are staked: a Knode Games stake before the vault, staked in Fantasy once the vault is live.
    - Terms, section 3: Knode runs its own nodes the same whatever the game; Knode Games can't control others' staking or unstaking; rival records and the all-time table carry no prize.
  - **Changes Claude made, owner told (28 Oct):**
    - Each week starts fresh: Monday's team can be any valid team. Last week's team carries into Monday only if it fits the new prices.
    - Vault points: 255 for the best week, one less for each lower distinct score. Ties keep the same points, never below 1, ranked among stakers only.
    - Rival rounds are days.
  - **2026-10-29, nothing should feel rushed:**
    - The price list is made on **Saturday 00:00 UTC**, 2 days before the week, from the 7 days before.
    - A team or a change can be planned for any day up to 7 days ahead, and changed until that day's own lock.
    - The page warns when changing an earlier day would make a planned day break the one-change rule.
    - The page reminds players when next week's prices are out and their Monday team won't play.
    - The testnet runs in proportion: its price list comes 2 test hours early.
  - **2026-10-29, why picking late gives no edge** (explained on the page):
    - prices are fixed before anyone can pick;
    - expected blocks follow each producer's VHP every hour;
    - the chain locks picks 5 minutes before the day;
    - the only fresh information is node health, which everyone sees.
  - **2026-10-29:** the page must feel inviting, professional, fun and like fantasy football, be easy to understand, and explain every number in plain words.
  - **2026-10-29, producer names:**
    - Producers register their own real names, shared across every game.
    - Proof: the producer signs a message with the producer wallet. No new contract.
    - Automatic rules, and the owner can hide any name.
    - It's a separate feature that Fantasy doesn't wait for. The owner handed it to the Hub chat.
  - **2026-10-29:** the Fantasy fix-check runs in Repo Lens.
  - **Standing rules:**
    - Push or deploy only with the owner's OK. Pushing the `fantasy` branch is approved; merging to main is not.
    - Never paste keys into chat or GitHub.
    - Test keys are for play money only, and the kit never signs for mainnet.
    - New games launch on a Monday.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Fantasy Producers: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** fact
- **Content:**
  - **Rules:**
    - Pick 5 different producers from the week's price list, costing 100 or less. The first is the captain (×2).
    - Each day a producer scores 100 × blocks signed ÷ blocks expected, at most 130.
    - A week's score is the sum of its 7 days.
    - A team carries on until it's changed.
    - One change a day: swap one producer, or move the captain.
    - Picks lock 5 minutes before each day starts.
    - A team that breaks a rule is ignored, and the previous team plays.
  - **Prices:** 20 + 1.5 × (form − median form), clamped to 8–40. Published with its sha256 and never remade. The pool is the race field when the price list is made.
  - **Prizes:** the top 30% of Fantasy stakers with at least 1 point share Fantasy's part of the vault's weekly reward. A week is final 12 hours after it ends.
  - **Weekly Rival:**
    - One challenge a week, which can be changed until the week's first lock.
    - Any number of players can challenge you.
    - A match counts only if both players had a team all 7 days and both are staked.
    - Records keep challenges made and received apart. No prize.
  - **Page** (rebuilt 29 Oct):
    - **Scoreboard:** a lineup-lock countdown showing the lock and start times, your points, place, today's score and rival, and a "Your move" line.
    - **Sticky tabs:** My team, Players, My week, Rival, League, Help.
    - **The pitch:** your five as SVG shirts in formation, coloured from a hash of each address, with initials. The captain plays up front with a gold "C".
    - **Planning:** "Plan:" day buttons marked "next up", "team set" or "not set", and a one-change counter.
    - **Players list:**
      - Columns: Cost, Avg points, Yesterday, and Today with "signed X of Y blocks".
      - Steady or Swingy under each name, from the blocks the producer is due each day (at least 150, 40 or 10 blocks, or fewer).
      - Sorts: Cost, Avg points, Best value, Steadiest, Today. A search box.
      - A "What these numbers mean" panel and a picking tip.
    - **My week:** a fixture strip with a bar per day, out of 780 (a fair-share day is 600).
    - **Rival:** a head-to-head card.
    - **League:** a podium for the top 3.
    - **Help:** a 4-step quick guide that can be dismissed, and a Questions section.
    - localStorage holds UI flags only, read and written inside try/catch.
  - **Testnet:**
    - The Picks copy is `1DZX8RVrXmG6VBYBHZi9QF3VyM7CYwSsPw`, with games 4 and 5 in force.
    - Genesis 1793293200000: test week 1 started at 10:00am PT on Thu 29 Oct.
    - Practice page: `http://127.0.0.1:8380/site/fantasy-testnet.html`.
  - **Small producers swing:** Knode Swap is due about 2 blocks per test hour, so 3 blocks scores 150 and none scores 0. Its form came out at 129, which gave it the top price of 40.
  - The Fantasy Terms are in the root `terms.html`, section 3.
  - **Tests:** on the merged branch 522 pass and 1 fails. The one failure, `site.mobile-nav.test.mjs`, comes from `picks` (script order on blockx.html).
  - **Producer names plan** (`claude/producer-names.md`):
    - A claim page, `names.html`, where the producer signs: `Knode Games producer name: <name> | <address> | <YYYY-MM-DD>`.
    - Claims arrive through a GitHub issue form, or the owner adds one with `npm run names -- add`.
    - `names.yml` checks each claim in a job with no write token, then publishes only `names.json` to the `names-data` branch.
    - `names.js` gives `KNames.of(address)`. The short address always shows next to the name.
    - Rules: 3 to 24 characters; unique, with lookalike names counted as the same; reserved words; one change every 7 days; the owner can hide or unhide a name.
- **Status:** Filed → platform/DECISIONS.md, PLATFORM.md, KOINOS.md; game spec pending in .ai/games/ (2026-11-02)

---

### Fantasy Producers: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** fact
- **Content:**
  - In the launch order (`claude/launch-order.md`), Fantasy is #13: after Vault v6 (#9), Block Golf staked, Last Node Standing and Bracket, and before Combo Card.
  - Path to launch:
    1. The Repo Lens fix-check (prompt and package ready).
    2. Fix what it finds, then have it re-checked.
    3. Re-run the simulation on a full week of real mainnet data, mainly to test small, swingy producers and the price formula.
    4. The owner finishes a full test week and the roll into week 2: final scores, vault points, rival results, the All time tab.
    5. The Picks contract goes live on mainnet (#6). Vault v6 goes live with Fantasy registered as staked game 4 and `games-data:fantasy` in `vaultGames`.
    6. Register Picks games 4 and 5 on mainnet (a 48-hour wait), with the settings `KFantasyMath.games()` prints.
    7. Merge. Set `FANTASY_ENABLED=true`. Add the page to the menus, `site-seo.mjs` and the sitemap, and remove `noindex`. The first price list comes out the Saturday before the launch Monday.
  - The Hub chat builds producer names on their own branch, with their own audit. Every game shows them once they're live.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Fantasy Producers: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** open question
- **Content:**
  - **Race cards now use the highest VHP over 6 hours (BX-38).** A producer whose VHP drops is expected to sign more blocks than it can for up to 6 hours, so it scores below 100. Fantasy also still scores with flagged low-sample cards. Both questions are in the fix-check prompt.
  - **Small producers swing even on mainnet.** Is there an edge in cheap, noisy producers? Is a price set from 7 noisy days fair? This needs the real-data simulation.
  - **Live race cards are sometimes made late** (about 28 minutes after the hour). Check that day finality copes with this in production.
  - **`site.mobile-nav.test.mjs` fails on `picks`.** This is for the Block X chat: on `blockx.html`, `nav.js` must come after the wallet scripts.
  - **The owner's practice run stopped** at about 2:05pm PT on 29 Oct, partway through test week 1. No full test week has finished yet.
  - **Not yet independently checked:** the FX-1 to FX-10 fixes, and everything added since (planning ahead, the page rebuild, the merge, the kit).
  - **Open question for the owner:** add a Telegram reminder alongside the on-page one?
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Fantasy Producers: TODOS
- **Date:** 2026-11-02
- **Source chat:** Fantasy Producers
- **Category:** open question
- **Content:**
  - [ ] Owner: run the Repo Lens fix-check with `knode-fantasy-fixcheck.zip` (it contains `00-FIXCHECK-PROMPT.md`; also in the project as `claude/fantasy/FIXCHECK-PROMPT.md`) and send the report back.
  - [ ] Owner: restart practice (`cd C:\kprediction-fantasy`, `git pull`, `npm ci`, `npm run fantasy-test -- run --bots`). Leave it running until at least one test week is final, work through "What to try" in `docs/fantasy/TESTNET.md`, and send the output of `npm run fantasy-test -- status`.
  - [ ] Owner: tell the Block X chat about the failing mobile-nav test.
  - [ ] Owner: tell the Vault chat Fantasy's source: `games-data:fantasy`, files `fantasy/vault/W<week>.json`, game 4 (may already be done).
  - [ ] Fantasy chat: fix the Repo Lens findings and write a fix list.
  - [ ] Fantasy chat: decide with the owner how Fantasy treats flagged or low-sample race cards.
  - [ ] Fantasy chat: re-run the simulation on real data.
  - [ ] Fantasy chat: re-merge `picks` before the final merge.
  - [ ] Fantasy chat: keep `claude/builds/05-fantasy-plan.md` and the owner checklist up to date.
  - [ ] Before mainnet: register games 4 and 5 (48 hours); set `FANTASY_ENABLED`; add the page to the menus and SEO and remove `noindex`; afterwards empty and retire the test wallets.
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---

## Chat: Combo Card (exported 2026-11-02)

Combo Card (Build 8, game 8 on the Picks contract): a staked parlay game of 2–6 legs (the contract allows 10), Picks v2 (the CARD type), the recorder, the new verify job, the page, the Picks v2 upgrade commands and the Repo Lens rounds. State as of 2026-10-30. The last commit on `combo` is `c8c652e`; it is pushed but not merged, and nothing is deployed.

---

### Combo Card: PLATFORM
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** fact
- **Content:**
  - **Branch:** `combo` in `bawcejawn/Knode`. It was rebuilt on `picks` (Repo Lens RL-10) and has `picks` merged through `b301bfa` (rounds 8–9 and `main`). Claude may push to `combo`; deploying or scheduling an upgrade needs the owner's OK.
  - **Chain:** Koinos mainnet, chain id `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==`; blocks about 3 s apart. Mainnet nodes: `https://koinos.armana.io` (primary) and `https://api.koinosblocks.com` (check node); every on-chain check must agree on both.
  - **Mainnet addresses:**
    - Owner `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717`.
    - Picks contract `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` (v1, `700c296a…`).
    - Mana sponsor `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` (v3, `b61ac238`).
    - Game `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`; race `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K`; Knode Swap `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR`.
    - VHP `12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq`; KOIN `19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK`.
  - **Testnet:**
    - Sponsor `1Dg8zKeHFRvEZeF1o4thSUs6eC2zHNg7qC`; it is switched OFF again after the card measurement.
    - Combo-only Picks v2 test contract `1PQZWWHbGnzHQW99frzJLmQLZ4Lwpjj8rX` (testnet build `83b251bb…`), test game 98 "Combo test".
    - Shared Block X testnet Picks contract `12xNetHp…`. Test player `19B9gUwbD9aJeDYRjJGMLzQ8PnRhCmpNX3`.
  - **Owner's PC:**
    - `C:\kprediction` holds the keys and settings (`.env`, `.env.testnet`, `testnet/blockx.json`, `testnet-data/`). On 2026-10-30 it was left with an unfinished merge of Last Node files from another chat: leave it to that chat.
    - `C:\kg-combo-preview` is the Combo copy. Combo testnet tools run there with `--home C:\kprediction`.
    - Commands run in PowerShell. Common ports are taken; the page preview used 47863.
  - **Tooling:** AssemblyScript with `@koinos/sdk-as` 1.5.1, koilib 9.4.1, Node 22 pinned in CI, pinned protobufjs helpers in `tools/pbjs-helpers`. `yarn protoc` sometimes fails with EAGAIN: rerun.
  - **Vault v6:** ABI `game/abi/kpred-v6.koilib.json`; `get_state` → `v6_rule_week_plus_one` (live); `get_game_player` → `week_stake`. Results file `{game, week, final, rows:[{player, points 1..255}], first:[], second:[]}`; week 0 began 2026-10-19 00:00 UTC.
  - **Tests at `c8c652e`:** contract 71; `npm run test:audit` 747 pass, 0 fail (5 todo, 6 skipped); browser 7; workflow guard 8.
- **Status:** Filed → platform/PLATFORM.md, ARCHITECTURE.md, KOINOS.md (2026-11-02)

---

### Combo Card: ARCHITECTURE
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** fact
- **Content:**
  - **Picks v2:** release sha256 `92d555d0680157854452e35162c1b1c5c100904996194b8c1c848df50e5e1c3d` (37,689 bytes). v2 ABI sha256 `cea9b073…`; v1 ABI `8efa3ad4…`.
    - kind 4 = CARD: a pick is a card of 2..`max_legs` legs `{code, round, producer}`; `list_size` = the hard maximum, 10.
    - Each leg type has its own lock clock (`lock_mode`, `round_size`, `round_offset`, `lead`, `ahead`).
    - The chain refuses a card unless every leg is open, and a change once any stored leg has locked. One leg per leg type per round; a producer once per card.
    - A card's round is its slot (UTC day × 3 + slot); it can be made or changed only on that day.
    - `announce_game` (48 h) adds or loosens leg types; `tighten_game` switches one off, locks it earlier, opens it later or lowers `max_legs`.
    - No funds: it holds no tokens and never pays Mana; all three overrides stay on.
    - Upgrade: owner + `schedule_upgrade(sha256)` → 48 h → a 7-day window to upload → `schedule_upgrade` with an empty hash.
  - **Shared math** (site root, plain browser JS): `race-math.js`, `blockx-math.js`, `combo-math.js` (globals `KRaceMath`, `KBlockX`, `KCombo`).
    - Race chances from a seeded simulation (`TRIALS = 16000`); Block X chance = the producer's VHP share. `f100Of` rounds down; `MISSING_F100 = 100` (×1 for a producer missing from the card).
    - Price cards: `usableCard` (a field, at least 12 samples, at most 3 h old); `flagsFor(card, who)` per producer (a flag on that producer, or the top in doubt); `priceCard(races, t, who)`, `cardAfter`.
    - `finalWorth`: the lowest check-card worth if more than 10% below the worth when sent. `withMoved` adds VHP moved into the producer to both check cards.
    - `legResult`: hit / miss / void / unresolved / pending. `sortLegs`: by code, round, producer. `toVaultPoints`: board places onto 255…1.
  - **Shared scoring:** `bot/games/combo-score.mjs` (no dependencies). `makeScorer({race, targets, head, agreed, movedInto, problems, errors, moveMargin})` returns `score(card, fixed, day, mode)` (live / verify / moved) and `recheck(card, day, chain)`. Used by both the recorder and the verify job.
  - **Recorder** `bot/games/combo.ts`, hourly at :52 (after race :37 and Block X :47):
    - Reads every slot of last week and this week on two nodes, which must agree. A slot is fixed when both nodes' irreversible block is past its day.
    - Head: the slower node's. A node more than 30 min behind the runner's clock stops the run; 10 min of slack ahead.
    - Published fixed slots and their final cards are kept while the chain holds exactly those cards (`chainKey`); a failed read keeps the published copy.
    - `recheck()` every run: "forged" → off the boards, no Vault file for that week; "unchecked" → no Vault file this run only.
    - Stakes: Vault v6 on both nodes; any disagreement = unknown = no Vault file.
    - Output in `games-data/combo/`: `index.json` (day list, append-only); `D<day>.json` + `D<day>-<k>.json` parts (at most 1,000 cards each; part 0 has `parts`); `board.json` (today and this week 2,000 rows, all-time 1,000, last week 6,000; over that: error, no Vault file); `vault/W<week>.json` (write-once, when the week is final 12 h after it ends, within 3 days).
    - Deadline: 2 days after the week ends. A leg still undecided whose source published past it becomes unresolved; if the source stopped, the card waits with an error.
  - **Workflow** `.github/workflows/combo.yml`, three jobs:
    1. **record:** read-only token, `npm ci`, runs the recorder, uploads the `combo-data` artifact.
    2. **verify:** read-only token, installs nothing, runs plain `node tools/combo-verify.mjs` with `bot/games/vhp-inflows.mjs` (a copy of Block X's moved-VHP decoder, kept identical by a test). It confirms each newly fixed slot against `list_picks` on two nodes (JSON-RPC) and re-scores every new final card. It hands on `name sha256` lines as a job output.
    3. **publish:** write token, no repository code. Shape and exact-JSON byte checks (Node 22), per-file holds, immutability. Card checks against the published race-data and Block X files. The Vault file is checked against the published board, and the board against a recount of the published day files. Only day files the verify job confirmed are published (`COMBO_VERIFY: required`). Day parts no longer written are removed. Pushes `combo/` only.
    - It shares the `knode-games` concurrency group with `games.yml`.
  - **Page:** `combo.html`, `combo.js` at the site root (`knodegames.com/combo.html`). CSP copied from `blockx.html`. Stake check through Vault v6. Send is blocked for guests, unstaked wallets, stale data, and in the last 2 minutes of a UTC day. Double sends are prevented; a wallet switch clears the stake. The page checks the leg-type clocks on chain.
  - **Tools:**
    - `tools/combo-testnet.mjs`: `keys`, `upload`, `build`, `status`, `schedule`, `upgrade`, `announce`, `apply`, `cards` (`--fresh`, `--sponsor <addr>`, `--send`).
    - `bot/picks.ts` accepts v1 or v2. Once `picks-data/deployment.json` has `wasmSha256` = v2, it refuses v1. New commands: `upgrade-schedule`, `upgrade-upload`, `upgrade-clear`. A mainnet send needs `--mainnet`, `CONFIRM_MAINNET=yes` and `--code 92d555d0`; checks run on two nodes, and the upload window is judged on chain time.
  - **Switches and sponsor:** `"cards": true` in `picks-data/deployment.json` is one switch for the page and the sponsor. Sponsor v3 takes 640 argument bytes; card argument types `0x030101130113`.
- **Status:** Filed → platform/ARCHITECTURE.md, standards/VAULT_STANDARD.md, KOINOS.md (2026-11-02)

---

### Combo Card: DECISIONS
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** decision
- **Content:**
  - **Legs:** Win, Show, Top half (on 6-hour Producer Race races) and Block X. Up to 3 legs per race (one Win, one Show, one Top half). One leg per producer per card, Block X included.
  - **Locks:** race legs lock 25 min before the start and open 24 h ahead; Block X legs lock 500 blocks before the target and open 28,800 ahead.
  - **Cards:** 3 a day, each changeable up to 3 times. The game runs at 6 legs; the contract allows 10.
  - **Worth:** clamp(0.5 / chance, 0.25, 3); Block X keeps ×3 as its cap.
  - **Points:** base by legs 2→3, 3→7, 4→15, 5→30, 6→60, 7→120, 8→240, 9→480, 10→960. No point cap.
  - **10% rule** kept (RL-16). A horse missing from the standings: void, dropped (RL-15 kept).
  - **Players:** stake-only game; at least 1 full point in the week to count. A week = the best 10 cards; ties: more hits, the earlier last hit, address.
  - **Vault points** by board place (rank), not score bands: the Vault uses order only (Repo Lens agreed).
  - **Mana:** the sponsor pays for cards. The Picks pick row rises 0.2 → 0.25 Mana at Combo launch (runbook step 7); Block X stays at 0.2.
  - **Order:** the CARD contract upgrade goes on chain after Block X launches.
  - **Page:** shorter page; the Quick card is kept.
  - **Security:** build the verify job (owner, 2026-10-30, FC3-3) rather than accept Block X's level of trust. Unresolved legs never let a card score (a miss decides, otherwise void). Vault files are write-once; published final cards are immutable.
  - **Rules for Claude:** never print or paste keys (WIFs); testnet tools never touch mainnet; nothing on chain without the owner; pushing `combo` is OK; ask before deploying or scheduling an upgrade.
- **Status:** Filed → platform/DECISIONS.md (2026-11-02)

---

### Combo Card: GAME-SPECIFIC
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** fact
- **Content:**
  - **Results:** a race leg is unresolved if the race was missed, voided or not checked on two nodes. A Block X leg is decided by the target's signer when `checked === 2`, even if Block X voided the target; without an agreed signer it is unresolved.
  - **Moved VHP:** read on both nodes from the lock card's block − 25 to the target. Both nodes report a non-canonical transfer → unresolved. Only one does, or a read fails → hold, ending at min(block + 3 days, Vault window − 6 h).
  - **Pricing:** no usable price card in the 3 h before sending → the card is void. No lock or after card → the leg is unresolved.
  - **Finality:** final once the slot is fixed and every leg is decided, or as soon as a leg misses.
  - **Testnet Mana:**

    | Transaction | Paid by | Mana |
    |---|---|---|
    | Card, 2 legs | player | 0.0588 |
    | Card, 6 legs | player | 0.0726 |
    | Card, 10 legs | player | 0.0916 |
    | Change of a card | player | 0.0538 |
    | Card, 6 legs | sponsor | 0.1313 |
    | Card, 10 legs | sponsor | 0.1457 (1.37× under 0.2) |
    | Single Block X pick | sponsor | 0.116 |
    | Upload of v2 | owner | 3.2528 |

    Mainnet upload estimate: 1.2 Mana per KB + 10 (about 55 for v2).
- **Status:** Filed → platform/DECISIONS.md, PLATFORM.md, KOINOS.md; game spec pending in .ai/games/ (2026-11-02)

---

### Combo Card: ROADMAP
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** idea
- **Content:**
  1. Repo Lens fix-check 4 on `combo` @ `c8c652e` (project doc `claude/audit-combo-fixcheck4-prompt.md`, package `combo-fixcheck4-package.zip`). It covers the verify job and the upgrade commands for the first time.
  2. Merge `picks` into `combo` again, then `combo` into `main` once the audits pass.
  3. After Block X launches, the Picks v2 upgrade (runbook "Later: the Picks v2 upgrade" in `docs/blockx/MAINNET-LAUNCH.md`):
     1. publish the source and build;
     2. `upgrade-schedule`;
     3. 48 h later, `upgrade-upload`;
     4. `upgrade-clear`;
     5. a PR writing v2's `wasmSha256`, `uploadTx` and `uploadedAt` into `picks-data/deployment.json`;
     6. `status --mainnet`;
     7. sponsor Picks row 0.25 and a `mana-report` check;
     8. announce game 8, wait 48 h, `apply_game`.
  4. A testnet upgrade rehearsal (route B, the shared `12xNetHp…` contract) once the Block X and Last Node chats are done with it.
  5. Go live: Actions variable `COMBO_ENABLED = true` and `"cards": true` in `picks-data/deployment.json`.
- **Status:** Filed → platform/ROADMAP.md (2026-11-02)

---

### Combo Card: OPEN ISSUES
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** open question
- **Content:**
  - **FC-11 / FC2-14:** the live run time (record + verify) is not measured; choose the concurrency group or cron offset after measuring.
  - **FC-12:** live race-data cards must carry `samples`. They do only once the race recorder from `picks` publishes race-data; until then every card is void (the recorder raises an error).
  - **FC2-13:** nothing writes `wasmSha256` automatically; it is runbook step 5.
  - **Accepted:** FC3-9 (a lagging check node stops recording) and FC2-19 (clock edges can hold a file for one run).
  - **Not yet reviewed:** the verify job's design. The publish check's `COMBO_VERIFY` switch is set only by the workflow (tests run without it). A flaky node can hold an honest run for one hour.
  - **Coordination:** `bot/picks.ts` (Block X's tool) was changed on `combo`; the Block X chat was told. A local merge of `picks` `b301bfa` may not have been pushed: check the branch.
  - **Owner's PC:** an unfinished Last Node merge in `C:\kprediction`.
- **Status:** Filed → platform/OPENISSUES.md (2026-11-02)

---

### Combo Card: TODOS
- **Date:** 2026-11-02
- **Source chat:** Combo Card
- **Category:** open question
- **Content:**
  - [ ] Owner: send fix-check 4 to Repo Lens and return the report and test zip; then fix its findings (FC4-x).
  - [ ] Ask the Block X chat to name `upgrade-schedule`, `upgrade-upload` and `upgrade-clear` in runbook steps 2–4.
  - [ ] Measure a live hourly run (record + verify) before going live.
  - [ ] Testnet upgrade rehearsal (route B) with the new `bot/picks.ts` upgrade commands.
  - [ ] At Combo launch: Picks pick row 0.2 → 0.25 Mana (chain row and the site's `sponsor.rcLimits`), then `mana-report` on mainnet.
  - [ ] Keep `bot/games/vhp-inflows.mjs` identical to `blockx.ts` (a test enforces it); port any future Block X decoder change.
  - [ ] Merge `picks` into `combo` again before the final merge to `main`.
- **Status:** Filed → platform/TODOS.md (2026-11-02)

---
