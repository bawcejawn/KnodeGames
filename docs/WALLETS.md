# Knode Games wallets: who controls what, and how to move them safely

> **Rewritten 2026-11-03** (Vault chat), replacing the 26 Oct version: that one predated Vault v6 and would have put
> the seed back on the owner's key (`.ai/platform/DOCUMENTATION_GAPS.md` #1). Revised the same day after an
> independent review (3 High, 6 Medium, 5 Low items fixed).
> Decisions: D-013, D-021, D-022, D-061, D-084 (the operator stays GitHub-only), D-085 (the sponsor's hot key is an
> accepted risk). Owner's choices of 3 Nov:
> - the new owner is a **cold key** (option A below);
> - the **cold treasury has its own recovery words**, made in a separate Chrome profile;
> - a **multisig owner** is on the roadmap.
>
> Marks: ✅ checked in the repo or the contract code · 👤 the owner said · ❓ not verified on chain from here (check on
> your PC with the read-only commands given).

**Funds safety first. When in doubt, don't move anything.** Every command below is a dry run until you add `--send`.
Never paste a private key or recovery words into a chat, an email or GitHub (the one exception is the GitHub secret
`OPERATOR_WIF`). Keys live only in `.env` on your PC, and on paper.

**Placeholders:** `<NEW_OWNER_ADDRESS>` and `<COLD_TREASURY_ADDRESS>` stand for the addresses you write down in
step 1. **Replace every `<…>` (including the brackets) before pasting a command.** Check every address in full,
character by character, against the wallet it came from. Checking only the first and last few characters is not
enough.

---

## 1. Every wallet today (3 Nov 2026)

### People's wallets (each has a key)

| Wallet | Address | What it controls | Where its key lives |
|---|---|---|---|
| **Owner** | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` ✅ | Owner of the **vault** (game contract): game registry, vault upgrades (48 h notice), pause, sponsor limit, corrections, the 5% fee. Owner of the **Swap Desk**: fee, limits, pause, node key, upgrades, withdrawals (always to the treasury). First owner of **Picks** (built into its code ✅; still the owner on chain ❓). Owner of the **Race picks** settings (set at setup to the Knode owner ✅; on chain ❓). **Also the Desk treasury** ✅ | `.env` as `OWNER_WIF` 👤, paper backup 👤 |
| **Desk treasury** | `1635QU…H717`: the same wallet as the owner ✅ | Receives everything the Desk withdraws. This is the main risk today: one key both orders a withdrawal and receives it, with no wait (TD-01) | the owner's key |
| **Seed owner** | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` ✅ (since 30 Oct, D-022) | The vault's seed: 21,050 VHP ✅ (2 Nov). Deposits; withdrawals with a 48 h wait, paid to the current seed owner | `.env` as `SEED_WIF` 👤, paper. **Stays separate; nothing this weekend touches it** |
| **Operator (bot)** | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` ✅ (since 26 Oct) | Posts and resolves questions; posts, seals and finalizes game results. Can't move funds | GitHub secret `OPERATOR_WIF` (environment `bot`) 👤. **GitHub-only** (D-084) |
| **Old operator** | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` ✅ (retired 26 Oct) | Nothing any more. About 100 KOIN left (it showed 103 Mana on 2 Nov) ❓ | **Still in `.env`**, most likely as `OPERATOR_WIF`: `npm run bot -- status` on your PC prints "Bot wallet 1JSTwo…", and that line is `OPERATOR_WIF`'s address ✅. To be swept and removed (I-045) |
| **Mana sponsor** | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | Its own **25,000 KOIN** (D-061), which becomes the Mana it pays for players. Its settings (caps, on/off, the vault switch). It is a contract **and** a wallet: its own key signs | `.env` as `SPONSOR_WIF` 👤, paper. **Your most valuable hot key:** anyone with it can move the 25,000 KOIN at once, with no wait. Recorded as an accepted risk (D-085); see §5 |

### Contract accounts (their keys have little or no power left)

| Contract | Address | Its own key | Power of that key today |
|---|---|---|---|
| Vault (game) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` ✅ | `CONTRACT_WIF` | None while the vault's own rules are on: uploads need the owner's announced upgrade ✅ |
| Swap Desk | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` ✅ | `DESK_CONTRACT_WIF` | None (same kind of rules) ✅ |
| Picks (Block X) | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` ✅ | `PICKS_WIF` | None: uploads need the owner's signature, the announced code and 48 h ✅ |
| Race picks | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` ✅ | `RACE_WIF` | **Can replace the Race picks code**: it was uploaded with no overrides ✅. Keep this key offline |

These four keys are only needed to set a contract up. Keep them on paper or in an offline backup, not in `.env` (§4).

---

## 2. After the moves

| Wallet | Role | Where its key lives |
|---|---|---|
| **New owner** (new, cold) | Owner of the vault and the Desk; later also Picks and Race picks | **Paper only** (its own recovery words, two copies). It goes into `.env` as `OWNER_WIF` only on a day you need an owner action, and comes out again afterwards (👤 option A). Never connected to a website |
| **Cold treasury** (new) | Receives the Desk's withdrawals | **Its own recovery words, on paper only.** Made in its own Chrome profile, then removed from that browser. It's never loaded anywhere again, except once to confirm its address before step 2b. It only receives |
| Seed owner `1K8VV…` | unchanged | unchanged |
| Operator `1HsM33…` | unchanged | GitHub only (D-084) |
| Sponsor `1ByDDS…` | unchanged, 25,000 KOIN | `.env` (D-085) |
| Old owner `1635QU…` | still owns Picks and Race picks until their tools can hand them over (§3) | paper; loaded as `OWNER_WIF` only for a Picks or Race picks action |
| Old operator `1JSTwo…` | retired, emptied | removed from `.env` |

**The owner and the treasury must never share recovery words, a browser profile, or a place where their paper is
kept.** One stolen paper or one compromised browser must not give both the power to order a Desk withdrawal and the
wallet that receives it: that's exactly the TD-01 risk this weekend removes.

**Why a cold key and not a hardware wallet:**
- No Koinos hardware-wallet signing exists that our tools can use today.
- Kondor keeps keys in the browser.
- Manuscript (Ledger and Trezor through MetaMask) was announced, but isn't verified for contract calls ❓.
- Every tool here signs with a key from `.env`.

So the new owner is a normal key that lives on paper and is only on the PC on the days it's needed.

**Later (roadmap):** a **2-of-3 multisig owner**, an audited smart-contract wallet as the owner, so one stolen key
can't act alone. The owner has built a multisig for another project 👤, which could be the starting point ❓.

### What changes in `.env`

| Entry | Today | After |
|---|---|---|
| `OWNER_WIF` | old owner `1635QU…` | the **new** owner, **only on owner-action days**, otherwise absent. For a Picks or Race picks action, the **old** owner key goes in instead, for that action only |
| `NEW_OWNER_WIF` | absent | only during the two "accept" steps (Tue), then removed |
| `SEED_WIF` | seed `1K8VV…` | unchanged |
| `OPERATOR_WIF` | most likely the **old** operator `1JSTwo…` | **removed** (D-084). PC commands that need the operator key then stop working on the PC: manual `game-post`, `game-seal`, `game-finalize`, and the admin page's weekly vault buttons. The hourly bot does them. `npm run bot -- status` still works and shows a placeholder bot wallet |
| `SPONSOR_WIF` | sponsor | unchanged |
| `CONTRACT_WIF`, `DESK_CONTRACT_WIF`, `PICKS_WIF`, `RACE_WIF` | in `.env` ❓ | removed; on paper or offline backup only |

**Never run `npm run bot -- keys` (or `npm run desk -- keys`, `npm run picks -- keys`).** They quietly create new
random keys for any entry that's missing from `.env`. After the clean-up, entries are meant to be missing.

---

## 3. What each change needs on chain, and what it clears

| Change | Steps on chain | Who signs | Wait | What it cancels or clears |
|---|---|---|---|---|
| **Desk treasury** | `schedule_treasury` → `apply_treasury` | owner, both steps | 48 h, then within 7 days | — |
| **Desk owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 48 h, then within 7 days | On accept: a pending **treasury change**, a pending **upgrade** and pending **settings** are wiped ✅. **So the treasury must be finished first** |
| **Vault owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 28,800 blocks (about a day); no expiry | On accept: a pending **vault upgrade** is wiped ✅. **Announced games survive** the handover ✅. The new owner can apply them |
| **Seed owner** | `propose_seed_owner` → `accept_seed_owner` | seed owner, then the new one | 28,800 blocks | Cancels a pending seed withdrawal. **Not part of this weekend** |
| **Picks owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 48 h, then within the expiry | On accept: **every pending Picks game announcement and the announced Picks upgrade become unusable** ✅ |
| **Race picks owner** | `set_config` with a new owner | the current owner | **none: one step, immediate** ✅ | A wrong address loses control of Race picks settings at once |
| **Operator** | `set_operator` | vault owner | none | — |

**The real cut-over is the accept.** Until a handover is accepted, the old owner key stays the owner and does
everything as today. Proposing changes nothing else.

**Cancelling a handover before it's accepted:**
- **Desk:** `npm run desk -- owner cancel --send` (old owner key).
- **Vault:** there is no cancel. Propose **your current owner address** instead:
  `npm run bot -- admin propose_owner new_owner=1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717 --as owner --send`. A new proposal
  replaces the old one, so the wrong address can no longer accept. `chain-check` then shows "PENDING to 1635QU…" until
  you clear it a day later with `npm run bot -- admin accept_owner --as owner --send`.

### Not this weekend: Picks and Race picks
- **The tools can't do these handovers yet.** `npm run picks` has no owner-handover command and has the mainnet
  owner `1635QU…` built in (`MAINNET_OWNER` in `bot/picks.ts`) ✅. `npm run racepicks` has no owner-change command, and
  checks `OWNER_WIF` against the owner in `game-data/deployment.json` ✅.
- **Picks has announcements on the way** (Last Node, Bracket, Fantasy, the Combo upgrade): a handover would kill them.
- **Plan:** leave Picks and Race picks on the old owner `1635QU…` for now. Keep its paper backup safe. Ask the Block
  X and Race chats for owner-handover commands (requests in §8), and hand them over once their announcements are
  done.
- **Meanwhile:**
  - For a Picks action, `OWNER_WIF` must be the **old** owner key that day.
  - Once `game-data/deployment.json` names the new owner, `npm run racepicks` refuses the old key until its tool is
    updated. Race picks settings (on/off, picks per day) rarely change.

---

## 4. What must never happen

1. **The seed going back onto the owner's key** (or any shared key). The seed stays on `1K8VV…` (D-022).
2. **A key in chat, email, a screenshot or GitHub.** The only exception is `OPERATOR_WIF` as a GitHub secret. A key
   that leaks is replaced at once.
3. **A handover while something is pending that it would wipe:**
   - the vault: an announced upgrade;
   - the Desk: a pending treasury change, upgrade or settings;
   - Picks: pending game announcements or an upgrade.
4. **The Desk owner handover before the Desk treasury change is applied.**
5. **Typing an address by hand, or checking only part of it.** Copy and paste it, then compare the **full** address in
   the dry run against Kondor or your paper.
6. **The cold treasury sharing recovery words, a browser profile or a paper hiding place with the owner**, or its key
   being exported or loaded anywhere.
7. **Removing a key from `.env` before its wallet is emptied** (I-045), or before you've confirmed its paper backup.
8. **Sending KOIN to a contract address** (vault, Desk, Picks, Race picks, sponsor, tokens): it can get stuck. Fund
   only people's wallets. `tools/send-koin.ts` refuses contracts.
9. **Changing the Race picks owner without its updated tool and a second check.** It's immediate and can't be undone
   by you.
10. **Running `npm run bot -- keys`** (or the desk and picks `keys` commands) after the clean-up.

---

## 5. Risks we accept for now

- **The sponsor key (`SPONSOR_WIF`) controls 25,000 KOIN with no timelock** and lives in `.env` (D-085). The owner
  keeps it that way so the sponsor's Mana is always there, and the amount may grow. Protection:
  - a PC used only for this;
  - a paper backup;
  - never on GitHub;
  - the sponsor can be switched off with `npm run sponsor -- disable --send`, paid with its own Mana.

  A later option: a multisig, or a smaller hot balance topped up from cold.
- **The new owner key is on the PC during an owner action.** Load it, do the action, remove it the same day.
- **The old owner `1635QU…` keeps Picks and Race picks** until their tools can hand them over.

---

## 6. Emails the hourly bot will send (expected; don't panic)

The hourly bot checks the chain against `game-data/deployment.json` and `desk-data/deployment.json` **on `main`**.
Each alert below emails you **once**. They are expected **only if you did that step**. The "…is compromised" wording
stays in each email until the records pull request (§7, step 6) is merged into `main`. Each alert fires once per
change, not every hour.

| After step | Email text (start) | Why |
|---|---|---|
| 2a (treasury schedule) | "A Desk treasury change to `<COLD_TREASURY_ADDRESS>` is scheduled (possible from …). If you did not do this, your admin key may be compromised." | The change you just scheduled |
| 2b (treasury apply) | "The Desk's treasury is `<COLD…>`, not 1635QU… as in desk-data/deployment.json. If you did not change it, your admin key is compromised (if you did, update desk-data/deployment.json)." | The record still has the old treasury |
| 4a (vault propose) | "An ownership transfer to `<NEW…>` is pending (it can be accepted a day after it was proposed). If you did not do this, your admin key may be compromised: propose your own address again right away." | The proposal you just made |
| 5a (Desk propose) | "A Desk owner change to `<NEW…>` is proposed (it can accept from …). If you did not do this, your admin key is compromised: cancel it (npm run desk -- owner cancel --send) and withdraw the Desk to the treasury." | The proposal you just made. **Do nothing**: don't cancel, don't withdraw |
| 4b (vault accept) | "The game's owner is `<NEW…>`, not 1635QU… as in deployment.json. If you did not hand it over, your admin key is compromised." | The record still has the old owner |
| 5b (Desk accept) | "The Desk's owner is `<NEW…>`, not 1635QU… as in desk-data/deployment.json. If you did not change it, your admin key is compromised." | The record still has the old owner |

**An email that names an address you didn't write down in step 1, or a step you didn't do, is real.** Stop and act on
it (vault: propose your own address, §3; Desk: `owner cancel`).

---

## 7. Weekend runbook (Fri 6 – Tue 10 Nov 2026)

Your PC folder `C:\kprediction` is now on **`main`** (everything from `picks` is in `main`). Every block below starts
the same way. Open PowerShell and run:

```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
```

`git branch --show-current` must print **`main`**. If it prints anything else, stop and ask.

**Timeline (Pacific time; clocks don't change between 6 and 10 Nov):**

| When | Step | Notes |
|---|---|---|
| **Fri 6 Nov, by 10:00** | 0. Read-only check · 1. New wallets and KOIN for the new owner · 2a. Treasury: schedule | 2a must be in by Fri 10:00 for 2b on Sun at 10:00 (48 h on chain). If 2a goes out later, 2b moves later by the same amount |
| Sat 7 Nov | 3. Sweep the old operator | any time |
| **Sun 8 Nov, from 10:00** (48 h after 2a) | 2b. Treasury: apply | `chain-check` shows the exact time it can be applied ("from …") |
| **Sun 8 Nov, after every `game-apply`** (Bracket's deadline is 16:00) | 4a. Vault owner: propose · 5a. Desk owner: propose | Both the same afternoon, e.g. 16:30 |
| **Tue 10 Nov, 48 h after 5a** (e.g. from 16:30) | 4b. Vault owner: accept · 5b. Desk owner: accept · 6. Clean-up | **Both accepts in the same sitting**, so there is never a day when the vault and the Desk have different owners |

**Why the accepts wait until Tuesday:** the vault's accept is possible from Monday, but there's no rush. Until it's
accepted, the old key stays the vault owner and works for everything as today. Doing both accepts together means
there's never a day when the vault needs the new key and the Desk the old one.

### Step 0: read-only check (Fri)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
git pull
npm run bot -- chain-check
npm run desk -- status
npm run picks -- status
npm run racepicks -- status
```
**Must show:**
- `chain-check`: every line ✔, including:
  - game owner `1635QU…`, desk owner `1635QU…`, desk treasury `1635QU…`;
  - "game ownership transfer: none", "desk treasury change: none" and "game announced upgrade: none".
- `desk status`: no ⚠ lines (no treasury change, owner change, upgrade or settings waiting).
- `picks status` and `racepicks status`: their owners. **Write them down** (both expected `1635QU…` ❓).

**If anything is ✖ or unexpected, stop.** Send the output to the Vault chat.

### Step 1: create the two new wallets, and fund the new owner (Fri)
Kondor comes **only from the Chrome Web Store**: search "Kondor", publisher **Kondor**, page
`chromewebstore.google.com/detail/kondor/ghipkefkpgkladckmlmdnadmcchefhjl` ❓ (check the link from Kondor's own site or
koinos.io before installing).

**1a. The new owner (Chrome profile "Knode owner"):**
1. In Chrome: profile icon → Add → name it **Knode owner**. Install Kondor in that profile only.
2. Kondor → Create new wallet → a strong password. **Write its recovery words on paper, twice.** Label them "Knode
   owner". Keep the copies in two places.
3. Copy the account's **address** (starts with 1) onto paper and into a note on the PC. Addresses are safe to share.
4. Don't export its private key yet (that's step 4b). Close the profile.

**1b. The cold treasury (a different Chrome profile, "Knode treasury", with its own recovery words):**
1. Profile icon → Add → **Knode treasury**. Install Kondor there.
2. Create a **new** wallet: new recovery words, a different password. Write them on paper, twice, labelled "Knode
   treasury". **Keep them in different places from the owner's words.**
3. Copy the **address** onto paper and into the note.
4. **Remove the wallet from the browser:** Chrome → profile icon → Manage profiles → Knode treasury → Delete. Its
   only copies are now your two papers.

**1c. Send the new owner 10 KOIN** (its Mana for the two accepts and later owner actions; before a vault upgrade it
needs about 100). Either:
- **from any Kondor wallet of yours that holds KOIN** (not the treasury): Kondor → Send → KOIN → paste
  `<NEW_OWNER_ADDRESS>` → 10. Compare the full address before confirming; or
- **from the current owner wallet**, with the new tool (dry run first):
  ```powershell
  cd C:\kprediction
  git branch --show-current
  $env:RPC = "https://koinos.armana.io"
  npx tsx tools/send-koin.ts --to <NEW_OWNER_ADDRESS> --confirm <NEW_OWNER_ADDRESS> --amount 10
  ```
  **The dry run must show:** "From 1635QU…H717 (OWNER_WIF)", "To `<NEW_OWNER_ADDRESS>`" (compare the full address),
  "Plan: send 10 KOIN". Then the same line with `--send`.

  It refuses contracts, mistyped confirmations and more than 20 KOIN. It only sends from `1635QU…`.

**Check:** the tool prints the new balance. With Kondor, open the "Knode owner" profile and look at the balance. It
must show 10 KOIN before Sunday.

1d. Tell the Vault chat both **addresses** (never the keys). It checks them and fills in the commands below.

### Step 2a: Desk treasury, schedule (Fri, by 10:00)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- treasury schedule <COLD_TREASURY_ADDRESS>
```
**The dry run must show:**
- "Announce `<COLD_TREASURY_ADDRESS>` as the new treasury";
- "As 1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717";
- `desk.schedule_treasury {"treasury":"<COLD_TREASURY_ADDRESS>"}`: compare the **full** address against your treasury
  paper;
- "Dry run only".

Then send it:
```powershell
npm run desk -- treasury schedule <COLD_TREASURY_ADDRESS> --send
npm run desk -- status
npm run bot -- chain-check
```
**Check:**
- **✔ done** with a transaction ID.
- `desk status` shows "⚠ Treasury change announced → `<COLD…>`, possible from `<date>`".
- `chain-check` shows "desk treasury change: ANNOUNCED to `<COLD…>`" **with a ✖. That ✖ is expected** until step 2b.

**If it fails:** nothing changed. Send the output to the Vault chat. **If the address is wrong:**
`npm run desk -- treasury cancel --send`, then start again.

### Step 3: sweep the old operator (Sat)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npx tsx tools/sweep-old-bot.ts
```
**The dry run must show:**
- "Found the old bot wallet's key in .env under: `<NAME>`" (expected `OPERATOR_WIF`). **Note the name.**
- Old bot wallet `1JSTwo…`: about 100 KOIN.
- Plan: send `<amount>` KOIN to `1635QU…H717`, leaving about 2 behind.

It uses the node set by `$env:RPC` (the first lines of the block), else Armana. **If it stops with an HTML or
"invalid json" error:** the node is having a moment. Wait a few minutes and run it again.

Then send it:
```powershell
npx tsx tools/sweep-old-bot.ts --send
```
**Check:** "Included. Owner wallet now holds … KOIN". The link it prints opens on koinosscan.com.
**If it fails:** nothing moved. Send the output to the Vault chat.

**Then remove the old key** (only after the sweep is confirmed):
1. `notepad .env`, delete the whole line whose name the dry run printed (expected `OPERATOR_WIF=…`), save.
2. Check it's gone, without printing the key:
   ```powershell
   npm run bot -- status
   ```
   The "Bot wallet" line should no longer say `1JSTwo…`. The about 2 KOIN left in `1JSTwo…` stay there; the wallet
   is retired.

### Step 2b: Desk treasury, apply (Sun, from 48 h after 2a)
**First confirm the treasury address once more:** in a **new** Chrome profile, install Kondor, choose "Restore /
import with recovery words", type the treasury's words, and compare the address it shows, **in full**, with the one in
step 2a. Then delete that profile again (Manage profiles → Delete).

```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- treasury apply
npm run desk -- treasury apply --send
npm run desk -- status
```
**Check:** **✔ done**. `desk status` shows "Treasury `<COLD…>`" and no "⚠ Treasury change" line. The 2b email in §6 is
expected.
**If "the timelock has not passed yet":** wait until the time `desk status` showed, and retry. **"This request
expired":** run step 2a again.

### Step 4a: vault owner, propose (Sun, after every `game-apply`)
First confirm nothing is pending that the handover would wipe, and that every game you meant to apply is applied:
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run bot -- chain-check
npm run bot -- games
```
**Must show:** "game announced upgrade: none" and "game ownership transfer: none". In `games`, every game you meant to
apply is applied ("from week 3"). (A game still only announced also survives the handover; the new owner can apply
it.)

```powershell
npm run bot -- admin propose_owner new_owner=<NEW_OWNER_ADDRESS> --as owner
```
**The dry run must show:** "As owner (1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717)" and
`propose_owner {"new_owner":"<NEW_OWNER_ADDRESS>"}`. Compare the **full** address against the owner paper. Then:
```powershell
npm run bot -- admin propose_owner new_owner=<NEW_OWNER_ADDRESS> --as owner --send
npm run bot -- chain-check
```
**Check:** "game ownership transfer: PENDING to `<NEW…>`" (shown with ✖, which is expected). The 4a email in §6 is
expected.
**If the address is wrong:** propose again at once with the right address (it replaces the wrong one), or with your own
address to abort (§3).

### Step 5a: Desk owner, propose (Sun, only after step 2b is applied)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- status
npm run bot -- chain-check
npm run desk -- owner propose <NEW_OWNER_ADDRESS>
```
**Before sending, check:**
- `desk status` shows Treasury `<COLD…>` and **no ⚠ lines** (no treasury change, upgrade, owner change or settings
  waiting).
- `chain-check` shows "desk announced upgrade: none".
- The dry run shows "As 1635QU…" and `desk.propose_owner {"new_owner":"<NEW_OWNER_ADDRESS>"}`, with the **full** address
  compared.

Then:
```powershell
npm run desk -- owner propose <NEW_OWNER_ADDRESS> --send
npm run desk -- status
```
**Check:** **✔ done**, and `desk status` now shows "⚠ Owner change proposed → `<NEW…>`, can be accepted from
`<date>`". **Write that date down: it's when 5b can run.** The 5a email in §6 is expected. Don't cancel, don't
withdraw.
**If the address is wrong:** `npm run desk -- owner cancel --send`.

### Step 4b and 5b: both accepts (Tue, from the 5a date)
1. Open the **Knode owner** Chrome profile → Kondor → the account → settings → show private key. Kondor shows the key
   as a WIF, which is what the tools read ❓. The dry run below proves it: it must print the new owner's address.
2. `notepad .env`, add a line `NEW_OWNER_WIF=<the key>`, save. Close Kondor and the profile.
3. Run:
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run bot -- admin accept_owner --as new
npm run desk -- owner accept
```
**Both dry runs must show the new owner's address in full:** "As new (`<NEW_OWNER_ADDRESS>`)" and "As
`<NEW_OWNER_ADDRESS>`".
- If either shows another address, stop: the wrong key is in `NEW_OWNER_WIF`.
- If either errors about the key, it isn't a valid WIF. Remove the line, and ask the Vault chat.

Then:
```powershell
npm run bot -- admin accept_owner --as new --send
npm run desk -- owner accept --send
npm run bot -- chain-check
npm run desk -- status
```
**Check:**
- Both **✔ done**.
- `chain-check`: game owner `<NEW…>` and desk owner `<NEW…>`, each ✖ against the records (expected until step 6),
  and "game ownership transfer: none".
- `desk status`: Owner `<NEW…>`, Treasury `<COLD…>`, no ⚠ lines.
- The 4b and 5b emails in §6 are expected.

**If the vault says "can be accepted only 28,800 blocks…":** wait an hour and retry. **If the Desk says "the timelock
has not passed yet":** wait until the 5a date. Nothing happened either way.

4. **Right away:** `notepad .env`:
   - change `OWNER_WIF=` to the **new** key (the same line as `NEW_OWNER_WIF`);
   - delete the `NEW_OWNER_WIF` line;
   - keep the old owner key **on paper only** (for Picks and Race picks).

**Emergency box, from now on** (the new key is now the owner of the vault and the Desk):
- **Pause the vault's new deposits:** with the new key in `OWNER_WIF`, `npm run bot -- pause on --send`.
  - Undo with `npm run bot -- pause off --send`.
  - Don't use `admin set_paused paused=false`: the `admin` command passes values as text, and the text "false" counts
    as *on*.
- **Pause the Desk:** with the new key in `OWNER_WIF`, `npm run desk -- pause on --send`.
- **Pause a Picks game (Block X etc.):** these still belong to the **old** owner. Put the old key in `OWNER_WIF` for that
  action only: `npm run picks -- pause <id> --mainnet --send`. Then put the new key back.

### Step 6: records and clean-up (Tue)
1. Tell the Vault chat the accepts are done. It opens one **pull request into `main`** with:
   - `game-data/deployment.json` `"owner"` → `<NEW…>`;
   - `desk-data/deployment.json` `"owner"` → `<NEW…>`;
   - `desk-data/deployment.json` `"treasury"` → `<COLD…>`.

   You merge it. The hourly bot then stops sending the §6 emails.
2. Once merged:
   ```powershell
   cd C:\kprediction
   git branch --show-current
   git pull
   $env:RPC = "https://koinos.armana.io"
   npm run bot -- chain-check
   ```
   Every line ✔: game owner `<NEW…>`, desk owner `<NEW…>`, desk treasury `<COLD…>`.
3. `notepad .env`:
   - delete `OWNER_WIF` (the new owner key) **unless** you have an owner action coming soon;
   - move `CONTRACT_WIF`, `DESK_CONTRACT_WIF`, `PICKS_WIF` and `RACE_WIF` to your offline backup **after checking each
     is on paper**, then delete them from `.env`.
4. Leave the old owner `1635QU…` about 5 KOIN, for later Picks and Race picks handovers. Move the rest to the new
   owner (Kondor, or `tools/send-koin.ts`). Keep its recovery words.
5. **Never run `npm run bot -- keys`** (or the desk or picks `keys`) from now on: missing entries are intended.

**For any owner action from now on** (fee claim, `game-add`, `game-apply`, corrections, pause, vault upgrade):
1. put `OWNER_WIF=<new owner key>` in `.env`;
2. do the action;
3. remove it again.

---

## 8. Requests for other chats (through the owner)
- **Block X chat (`bot/picks.ts`):**
  - owner-handover commands: `owner propose <address>`, `owner accept` signing with `NEW_OWNER_WIF`, and
    `owner cancel`;
  - read the owner from the chain, not the built-in `MAINNET_OWNER`;
  - warn when a game announcement or an upgrade is pending (a handover kills them).
- **Race chat (`bot/race-picks.ts`):**
  - an owner-change command (`set_config` keeping every other setting), with a dry run that shows the old and new
    owner and a typed confirmation, since it's one step and immediate;
  - accept `OWNER_WIF` matching the **contract's** owner, not only `game-data/deployment.json`.
- **Swap Desk chat:** this PR adds two read-only lines to `npm run desk -- status` (a proposed owner change; settings
  waiting). Please review.
- **Vault chat:** `tools/sweep-old-bot.ts` now honours `$env:RPC` and defaults to `koinos.armana.io` (I-078, this
  PR). `tools/send-koin.ts` (new in this PR) needs its own review before Friday.
- **Records:** one pull request into `main` after the accepts (step 6).

---

## 9. GitHub: what protects `main`
The hourly bot commits its data to `main` with the workflow's own token, so `main` can't require pull requests: that
would block the bot. Its ruleset blocks deletion and force pushes only (audit M-3, accepted). What matters is who can
push at all:
- Only you have write access. Add nobody else as a collaborator.
- Any personal access token on your PC (for example `GITHUB_ALERT_TOKEN` for the node alerts) must be fine-grained,
  for this repository only, with **Actions: read and write** and never **Contents: write**.
- `OPERATOR_WIF` is the only secret, in the `bot` environment.
