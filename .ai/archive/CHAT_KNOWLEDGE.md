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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

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
- **Status:** unsorted

---
