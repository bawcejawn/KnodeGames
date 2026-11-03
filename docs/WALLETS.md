# Knode Games wallets: who controls what, and how to move them safely

> **Rewritten 2026-11-03** (Vault chat), replacing the 26 Oct version: that one predated Vault v6 and would have put the
> seed back on the owner's key (`.ai/platform/DOCUMENTATION_GAPS.md` #1). Decisions: D-013, D-021, D-022, D-061.
> Owner's choices of 3 Nov: the new owner key is a **cold key** (option A below); a **multisig owner** is on the
> roadmap; the operator key stays **on GitHub only**; the sponsor keeps its **25,000 KOIN**.
>
> Marks: ✅ checked in the repo or the contract code · 👤 the owner said · ❓ not verified on chain from here (check on
> your PC with the read-only commands given).

**Funds safety first. When in doubt, don't move anything.** Every command below is a dry run until you add `--send`.
Never paste a private key or recovery words into a chat, an email or GitHub (the one exception is the GitHub secret
`OPERATOR_WIF`). Keys live only in `.env` on your PC, and on paper.

---

## 1. Every wallet today (3 Nov 2026)

### People's wallets (each has a key)

| Wallet | Address | What it controls | Where its key lives |
|---|---|---|---|
| **Owner** | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` ✅ | Owner of the **vault** (game contract): game registry, vault upgrades (48 h notice), pause, sponsor limit, corrections, the 5% fee. Owner of the **Swap Desk**: fee, limits, pause, node key, upgrades, withdrawals (always to the treasury). First owner of **Picks** (built into its code ✅; still the owner on chain ❓). Owner of **Race picks** settings (set at setup to the Knode owner ✅; on chain ❓). **Also the Desk treasury** ✅ | `.env` as `OWNER_WIF` 👤, paper backup 👤 |
| **Desk treasury** | `1635QU…H717`: the same wallet as the owner ✅ | Receives everything the Desk withdraws. This is the main risk today: one key both orders a withdrawal and receives it, with no wait (TD-01) | the owner's key |
| **Seed owner** | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` ✅ (since 30 Oct, D-022) | The vault's seed: 21,050 VHP ✅ (2 Nov). Deposits; withdrawals with a 48 h wait, paid to the current seed owner | `.env` as `SEED_WIF` 👤, paper. **Stays separate; nothing this weekend touches it** |
| **Operator (bot)** | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` ✅ (since 26 Oct) | Posts and resolves questions; posts, seals and finalizes game results. Can't move funds | GitHub secret `OPERATOR_WIF` (environment `bot`) 👤. **Stays GitHub-only** (owner, 3 Nov) |
| **Old operator** | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` ✅ (retired 26 Oct) | Nothing any more. About 100 KOIN left (it showed 103 Mana on 2 Nov) ❓ | **Still in `.env`**, most likely as `OPERATOR_WIF`: `npm run bot -- status` on your PC prints "Bot wallet 1JSTwo…", and that line is `OPERATOR_WIF`'s address ✅. To be swept and removed (I-045) |
| **Mana sponsor** | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | Its own **25,000 KOIN** (D-061), which becomes the Mana it pays for players. Its settings (caps, on/off, the vault switch). It is a contract **and** a wallet: its own key signs | `.env` as `SPONSOR_WIF` 👤, paper. **Your most valuable hot key:** anyone with it can move the 25,000 KOIN at once, with no wait. It stays as it is (owner, 3 Nov); see §5 |

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
| **New owner** (new, cold) | Owner of the vault, the Desk, and later Picks and Race picks | **Paper only** (recovery words, two copies). It goes into `.env` as `OWNER_WIF` only on a day you need an owner action, and comes out again afterwards (👤 option A). Never connected to a website |
| **Cold treasury** (new) | Receives the Desk's withdrawals | **Paper only. Never exported, never loaded anywhere.** It only receives |
| Seed owner `1K8VV…` | unchanged | unchanged |
| Operator `1HsM33…` | unchanged | GitHub only |
| Sponsor `1ByDDS…` | unchanged, 25,000 KOIN | `.env` |
| Old owner `1635QU…` | retired once Picks and Race picks are handed over too (§3.5) | paper, kept until everything checks out |
| Old operator `1JSTwo…` | retired, emptied | removed from `.env` |

**Why a cold key and not a hardware wallet:** no Koinos hardware-wallet signing exists that our tools can use today.
Kondor keeps keys in the browser. Manuscript (Ledger and Trezor through MetaMask) was announced but not verified for
contract calls ❓. Every tool here signs with a key from `.env`. So the new owner is a normal key that lives on paper and
is only on the PC on the days it's needed.

**Later (roadmap):** a **2-of-3 multisig owner**, an audited smart-contract wallet as the owner, so one stolen key
can't act alone. The owner has built a multisig for another project 👤, which could be the starting point ❓.

### What changes in `.env`

| Entry | Today | After |
|---|---|---|
| `OWNER_WIF` | old owner `1635QU…` | the new owner, **only on owner-action days**, otherwise absent |
| `NEW_OWNER_WIF` | absent | only during an "accept" step, then removed |
| `SEED_WIF` | seed `1K8VV…` | unchanged |
| `OPERATOR_WIF` | most likely the **old** operator `1JSTwo…` | **removed** (the operator is GitHub-only). PC commands that need the operator key (manual `game-post`, `game-seal`, `game-finalize`, and the admin page's weekly vault buttons) then stop working on the PC. The hourly bot does them. `npm run bot -- status` still works and shows a placeholder bot wallet |
| `SPONSOR_WIF` | sponsor | unchanged |
| `CONTRACT_WIF`, `DESK_CONTRACT_WIF`, `PICKS_WIF`, `RACE_WIF` | in `.env` ❓ | removed; on paper or offline backup only |

---

## 3. What each change needs on chain, and what it clears

| Change | Steps on chain | Who signs | Wait | What it cancels or clears |
|---|---|---|---|---|
| **Desk treasury** | `schedule_treasury` → `apply_treasury` | owner, both steps | 48 h, then within 7 days | — |
| **Desk owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 48 h, then within 7 days | On accept: a pending **treasury change**, a pending **upgrade** and pending **settings** are wiped ✅. **So the treasury must be finished first** |
| **Vault owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 28,800 blocks (about a day) | On accept: a pending **vault upgrade** is wiped ✅ |
| **Seed owner** | `propose_seed_owner` → `accept_seed_owner` | seed owner, then the new one | 28,800 blocks | Cancels a pending seed withdrawal. **Not part of this weekend** |
| **Picks owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 48 h, then within the expiry | On accept: **every pending Picks game announcement and the announced Picks upgrade become unusable** ✅ |
| **Race picks owner** | `set_config` with a new owner | the current owner | **none: one step, immediate** ✅ | A wrong address loses control of Race picks settings at once |
| **Operator** | `set_operator` | vault owner | none | — |

The bot emails you about every proposed vault handover or treasury change. That's expected, and it's how you'd learn
of one you didn't make.

### Not this weekend: Picks and Race picks
- **The tools can't do these handovers yet.** `npm run picks` has no owner-handover command and has the mainnet
  owner `1635QU…` built in (`MAINNET_OWNER` in `bot/picks.ts`) ✅. `npm run racepicks` has no owner-change command, and
  checks `OWNER_WIF` against the owner in `game-data/deployment.json` ✅.
- **Picks has announcements on the way** (Last Node, Bracket, Fantasy, the Combo upgrade): a handover would kill them.
- **Plan:** leave Picks and Race picks on the old owner `1635QU…` for now. Keep its paper backup safe. Ask the Block
  X and Race chats for owner-handover commands (requests in §7), and hand them over once their announcements are
  done.
- **Meanwhile:** for a Picks or Race picks owner action, `OWNER_WIF` must be the **old** owner key that day. Once the
  vault owner has moved and `game-data/deployment.json` names the new owner, `npm run racepicks` refuses the old key
  until its tool is updated. Race picks settings (on/off, picks per day) rarely change.

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
5. **Typing an address by hand.** Copy and paste it, then check the first 4 and last 4 characters in the dry run
   against your paper.
6. **The cold treasury's key ever being exported or loaded.**
7. **Removing a key from `.env` before its wallet is emptied** (I-045), or before you've confirmed its paper backup.
8. **Sending KOIN to a contract address** (vault, Desk, Picks, Race picks): it can get stuck. Fund only people's
   wallets.
9. **Changing the Race picks owner without its updated tool and a second check.** It's immediate and can't be undone
   by you.

---

## 5. Risks we accept for now

- **The sponsor key (`SPONSOR_WIF`) controls 25,000 KOIN with no timelock** and lives in `.env`. The owner keeps it
  that way so the sponsor's Mana is always there (3 Nov), and the amount may grow. Protection: a PC used only for
  this, a paper backup, never on GitHub, and the sponsor can be switched off (`npm run sponsor -- disable --send`,
  paid with its own Mana). A later option: a multisig, or a smaller hot balance topped up from cold.
- **The new owner key is on the PC during an owner action.** Load it, do the action, remove it the same day.
- **The old owner `1635QU…` keeps Picks and Race picks** until their tools can hand them over.

---

## 6. Weekend runbook (Fri 6 – Tue 10 Nov 2026)

**Order, and why:**
1. Create the two new wallets.
2. Desk treasury: it needs 48 h and must finish before the Desk owner moves.
3. Sweep the old operator, while its KOIN still goes to the old owner wallet.
4. Vault owner: **after** the games are applied (games 2 and 7 on Thu 5 Nov, Bracket by Sun 8 Nov 4 pm PT), so no
   owner action is needed mid-handover.
5. Desk owner: after step 2 is applied.
6. Clean up `.env` and the records.

Picks and Race picks come later (§3).

| When (PT) | Step | Takes |
|---|---|---|
| Fri 6 Nov | 0. Read-only check · 1. New wallets · 2a. Treasury: schedule | 30 min |
| Sat 7 Nov | 3. Sweep the old operator | 10 min |
| Sun 8 Nov, morning | 2b. Treasury: apply (48 h after 2a) | 5 min |
| Sun 8 Nov, after every `game-apply` is done | 4a. Vault owner: propose · 5a. Desk owner: propose | 10 min |
| Mon 9 Nov, a day after 4a | 4b. Vault owner: accept | 10 min |
| Tue 10 Nov, 48 h after 5a | 5b. Desk owner: accept · 6. Clean-up | 20 min |

Every block starts the same way. Open PowerShell and run:

```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
```

`git branch --show-current` must print **`picks`**. If it prints anything else, stop and ask.

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
- `chain-check`: every line ✔, including game owner `1635QU…`, desk owner `1635QU…`, desk treasury `1635QU…`,
  "game ownership transfer: none", "desk treasury change: none" and "game announced upgrade: none".
- `picks status` and `racepicks status`: their owners. **Write them down** (both expected `1635QU…` ❓).

**If anything is ✖ or unexpected, stop.** Send the output to the Vault chat.

### Step 1: create the two new wallets (Fri)
1. In Chrome, add a new profile used only for this (profile icon → Add). Install **Kondor** in that profile.
2. Kondor → Create new wallet → a strong password. **Write the recovery words on paper, twice.** Keep the two copies
   in two places. No photos, no cloud, no chat.
3. Make **two accounts**: one named **New owner**, one named **Cold treasury**. Copy each **address** (starts with 1)
   onto paper and into a note on the PC. Addresses are safe to share.
4. **Cold treasury: stop here.** Never export its key.
5. **New owner:** don't export its key yet. You'll need it on Mon 9 Nov (step 4b).
6. Send the new owner **10 KOIN** from your current owner wallet. It pays the Mana for the accept steps and later
   owner actions. Later, before any vault upgrade, it needs about 100 KOIN.
7. Tell the Vault chat both **addresses**, never the keys. It checks them and puts them in the commands below.

### Step 2a: Desk treasury, schedule (Fri)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- treasury schedule <COLD_TREASURY_ADDRESS>
```
**The dry run must show:**
- "Announce `<COLD_TREASURY_ADDRESS>` as the new treasury";
- "As 1635QU…H717";
- `desk.schedule_treasury {"treasury":"<COLD_TREASURY_ADDRESS>"}`, with the first 4 and last 4 characters checked
  against your paper;
- "Dry run only".

Then send it:
```powershell
npm run desk -- treasury schedule <COLD_TREASURY_ADDRESS> --send
npm run bot -- chain-check
```
**Check:** **✔ done** with a transaction ID. `chain-check` now shows "desk treasury change: ANNOUNCED to `<COLD…>`,
from `<date>`". The bot emails you about it (expected).
**If it fails:** nothing changed. Send the output to the Vault chat. **If the address is wrong:**
`npm run desk -- treasury cancel --send`, then start again.

### Step 3: sweep the old operator (Sat)
```powershell
cd C:\kprediction
git branch --show-current
npx tsx tools/sweep-old-bot.ts
```
**The dry run must show:**
- "Found the old bot wallet's key in .env under: `<NAME>`" (expected `OPERATOR_WIF`). **Note the name.**
- Old bot wallet `1JSTwo…`: about 100 KOIN.
- Plan: send `<amount>` KOIN to `1635QU…H717`, leaving about 2 behind.

**If it stops with an HTML or "invalid json" error:** this tool reads the node only from `.env`, not from `$env:RPC`.
Add one line `RPC=https://koinos.armana.io` to `.env` (`notepad .env`), save, and run it again.

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

### Step 2b: Desk treasury, apply (Sun morning, 48 h after 2a)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- treasury apply
npm run desk -- treasury apply --send
npm run desk -- status
```
**Check:** **✔ done**. `desk status` shows treasury `<COLD…>`. Then tell the Vault chat: it opens a pull request
changing `"treasury"` in `desk-data/deployment.json`. Until that's merged, `chain-check` shows the treasury line with
✖ (expected).
**If "the timelock has not passed yet":** wait and retry. **"This request expired":** run step 2a again.

### Step 4a: vault owner, propose (Sun, after every `game-apply`)
First confirm nothing is pending that a handover would wipe:
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run bot -- chain-check
npm run bot -- games
```
**Must show:** "game announced upgrade: none" and "game ownership transfer: none". `games` lists every game you meant
to apply as applied ("from week 3"). **If a game is still only announced, apply it first.**

```powershell
npm run bot -- admin propose_owner new_owner=<NEW_OWNER_ADDRESS> --as owner
```
**The dry run must show:** "As owner (1635QU…H717)" and `propose_owner {"new_owner":"<NEW_OWNER_ADDRESS>"}`, with
the address checked against your paper. Then:
```powershell
npm run bot -- admin propose_owner new_owner=<NEW_OWNER_ADDRESS> --as owner --send
npm run bot -- chain-check
```
**Check:** "game ownership transfer: PENDING to `<NEW…>`" (this line shows ✖, which is expected). The bot emails you.
**If the address is wrong:** propose again with the right address (a new proposal replaces the old one).

### Step 5a: Desk owner, propose (Sun, only after step 2b is applied)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- status
npm run desk -- upgrade status
npm run bot -- chain-check
npm run desk -- owner propose <NEW_OWNER_ADDRESS>
```
**Before sending, check:**
- `desk status` shows Treasury `<COLD…>` (already applied) and no "⚠ Treasury change announced".
- `desk upgrade status` says "No upgrade announced".
- `chain-check` shows "desk announced upgrade: none".
- If you scheduled a fee cut, cap raise or node-key change in the last week, finish it (`npm run desk -- settings
  apply --send`) first: a handover wipes pending settings.
- The dry run shows "As 1635QU…" and `desk.propose_owner {"new_owner":"<NEW…>"}`.

Then:
```powershell
npm run desk -- owner propose <NEW_OWNER_ADDRESS> --send
```
**Check after:** **✔ done**, with the time it can be accepted (48 h later).
**If wrong:** `npm run desk -- owner cancel --send`.

### Step 4b: vault owner, accept (Mon, a day after 4a)
1. In the Kondor profile, export the **New owner** private key (account settings → show private key).
2. `notepad .env`, add a line `NEW_OWNER_WIF=<the key>`, save. Close Kondor.
3. Run:
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run bot -- admin accept_owner --as new
npm run bot -- admin accept_owner --as new --send
npm run bot -- chain-check
```
**The dry run must show:** "As new (`<NEW_OWNER_ADDRESS>`)". **Check after:** **✔ done**. `chain-check` shows game
owner `<NEW…>` (✖ against `deployment.json` until the record is updated, which is expected) and "game ownership
transfer: none".
**If "can be accepted only 28,800 blocks…":** wait an hour and retry; nothing happened.
**Then:** keep `NEW_OWNER_WIF` in `.env` until step 5b. Tell the Vault chat: it opens a pull request changing
`"owner"` in `game-data/deployment.json`.

### Step 5b: Desk owner, accept (Tue, 48 h after 5a)
```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run desk -- owner accept
npm run desk -- owner accept --send
npm run desk -- status
```
**The dry run must show:** "As `<NEW_OWNER_ADDRESS>`". **Check after:** `desk status` shows owner `<NEW…>` and treasury
`<COLD…>`. Tell the Vault chat: `desk-data/deployment.json` `"owner"` gets updated in the same records pull request.

### Step 6: clean-up (Tue)
1. `notepad .env`:
   - delete `NEW_OWNER_WIF`;
   - delete `OWNER_WIF` **unless** you have a Picks or Race picks action coming (those still need the **old** key,
     §3);
   - move `CONTRACT_WIF`, `DESK_CONTRACT_WIF`, `PICKS_WIF` and `RACE_WIF` to your offline backup **after checking each
     is on paper**, then delete them from `.env`.
2. Once the records pull request is merged:
   ```powershell
   cd C:\kprediction
   git branch --show-current
   git pull
   $env:RPC = "https://koinos.armana.io"
   npm run bot -- chain-check
   ```
   Every line ✔: game owner `<NEW…>`, desk owner `<NEW…>`, desk treasury `<COLD…>`.
3. Leave the old owner `1635QU…` with enough KOIN for later Picks and Race picks handovers (about 5). Move the rest
   to the new owner or the cold treasury once Picks and Race picks are handed over. Keep its recovery words.

**For any owner action from now on** (fee claim, `game-add`, `game-apply`, corrections, pause, vault upgrade): put
`OWNER_WIF=<new owner key>` in `.env`, do the action, then remove it.

---

## 7. Requests for other chats (through the owner)
- **Block X chat (`bot/picks.ts`):** owner-handover commands (`owner propose <address>`, `owner accept` signing with
  `NEW_OWNER_WIF`, `owner cancel`). Read the owner from the chain, not the built-in `MAINNET_OWNER`. Warn when a game
  announcement or an upgrade is pending (a handover kills them).
- **Race chat (`bot/race-picks.ts`):** an owner-change command (`set_config` keeping every other setting), with a
  dry run that shows the old and new owner and a typed confirmation, since it's one step and immediate. Accept
  `OWNER_WIF` matching the **contract's** owner, not only `game-data/deployment.json`.
- **Vault chat:** `tools/sweep-old-bot.ts` could honour `$env:RPC` and default to `koinos.armana.io`.
- **Records:** after each on-chain change, a small pull request updates `game-data/deployment.json` (`owner`) and
  `desk-data/deployment.json` (`owner`, `treasury`). The owner merges it.

---

## 8. GitHub: what protects `main`
The hourly bot commits its data to `main` with the workflow's own token, so `main` can't require pull requests: that
would block the bot. Its ruleset blocks deletion and force pushes only (audit M-3, accepted). What matters is who can
push at all:
- Only you have write access. Add nobody else as a collaborator.
- Any personal access token on your PC (for example `GITHUB_ALERT_TOKEN` for the node alerts) must be fine-grained,
  for this repository only, with **Actions: read and write** and never **Contents: write**.
- `OPERATOR_WIF` is the only secret, in the `bot` environment.
