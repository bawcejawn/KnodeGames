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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

---
