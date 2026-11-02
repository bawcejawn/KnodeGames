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
