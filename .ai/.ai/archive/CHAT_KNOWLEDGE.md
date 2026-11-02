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
