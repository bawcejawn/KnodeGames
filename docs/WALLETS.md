# Knode Games wallets: who controls what, and how ownership moves

> **Public version (5 Nov 2026).** The step-by-step weekend runbook (creating the cold wallets, where each key is kept, backups, the accepted risks) is **private**: the owner's notes in the Claude project, `claude/private/WALLETS-RUNBOOK-FULL.md`. This page keeps the roles, the on-chain rules of each handover, what must never happen, and the emails to expect.
> Decisions: D-013, D-021, D-022, D-061, D-083, D-084 (the operator stays GitHub-only), D-085, D-096 and D-106 (Race picks moved 4 Nov; Picks moves later, §7.1); a **multisig owner** is on the roadmap.
> Marks: ✅ checked in the repo or the contract code · 👤 the owner said · ❓ not verified on chain from here.

**Funds safety first. When in doubt, don't move anything.** Every command is a dry run until you add `--send` (and `CONFIRM_MAINNET=yes`). Never paste a private key or recovery words into a chat, an email or GitHub. Check every address **in full**, character by character, against the wallet it came from.

---

## 1. Every wallet today

| Wallet | Address | Role |
|---|---|---|
| **Owner** | `1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717` ✅ | Owner of the **vault** (game registry, upgrades with 48 h notice, pause, corrections, the 5% fee), of the **Swap Desk** (fee, limits, pause, node key, upgrades, withdrawals always to the treasury) and of **Picks** (on chain ✅). **Also the Desk treasury** today (TD-01) |
| **Cold owner** | `1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd` ✅ | Owns **Race picks** since 4 Nov (tx `0x1220bd9c…`); becomes the owner of the vault and the Desk at the handover accepts (Tue 10 Nov), Picks later (D-106) |
| **Seed owner** | `1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z` ✅ (D-022) | The vault's seed (21,050 VHP). Stays separate; no handover touches it |
| **Operator (bot)** | `1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv` ✅ | Posts and resolves questions; posts, seals and finalizes results. Can't move funds. GitHub-only (D-084) |
| **Old operator** | `1JSTwoKYNAUq2gmmTg4r1kdYCERR2kUrZ` ✅ (retired 26 Oct) | Nothing; its leftover KOIN is swept (I-045) |
| **Mana sponsor** | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | Its own KOIN becomes the Mana it pays for players (`SPONSOR.md`) |

**Contract accounts** (vault `1Mpmf2…`, Desk `1FKTpX…`, Picks `1LmgqB…`, Race picks `1EN7xU…`) each have their own key; while the contracts' upload rules are on, those keys can't change the code without the owner's announced upgrade, except Race picks (uploaded with no overrides), whose key is taken offline in the weekend runbook. Addresses, builds and owners: `.ai/platform/CONTRACTS.md`.

---

## 2. After the moves (roles)

| Wallet | Role after the weekend |
|---|---|
| **Cold owner** `1LMV8E…` | owner of the vault, the Desk and Race picks; Picks later (D-106) |
| **Cold treasury** (new) | receives the Desk's withdrawals; it only receives |
| Seed owner, operator, sponsor | unchanged |
| Old owner `1635QU…` | still owns **Picks** until its later handover (§7.1) |
| Old operator `1JSTwo…` | retired and emptied |

**The owner and the treasury never share anything** (recovery words, a browser, a storage place): one compromise must never give both the power to order a Desk withdrawal and the wallet that receives it.

**Why a cold key and not a hardware wallet:** no Koinos hardware-wallet signing exists that these tools can use today, so the owner key is a normal key used only on the days it's needed. **Later:** a 2-of-3 multisig owner.

**Never run `npm run bot -- keys`** (or `npm run desk -- keys`, `npm run picks -- keys`): they quietly create new random keys for any entry that's missing from `.env`.

---

## 3. What each change needs on chain, and what it clears

| Change | Steps on chain | Who signs | Wait | What it cancels or clears |
|---|---|---|---|---|
| **Desk treasury** | `schedule_treasury` → `apply_treasury` | owner, both steps | 48 h, then within 7 days | — |
| **Desk owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 48 h, then within 7 days | On accept: a pending **treasury change**, a pending **upgrade** and pending **settings** are wiped ✅. **So the treasury must be finished first** |
| **Vault owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 28,800 blocks (about a day); no expiry | On accept: a pending **vault upgrade** is wiped ✅. **Announced games survive** the handover ✅. The new owner can apply them |
| **Seed owner** | `propose_seed_owner` → `accept_seed_owner` | seed owner, then the new one | 28,800 blocks | Cancels a pending seed withdrawal. **Not part of this weekend** |
| **Picks owner** | `propose_owner` → `accept_owner` | old owner, then the **new** owner | 48 h, then within 7 days (after that, propose again) | On accept: **every pending Picks game announcement and the announced Picks upgrade become unusable** ✅. Games already in force (Block X) are not affected. Cancel: propose an empty address (`owner-cancel`) |
| **Race picks owner** | `set_config` with a new owner | the current owner | **none: one step, immediate** ✅ | **Done 4 Nov** → `1LMV8E…` ✅. A wrong address would have lost control at once; the tool checks the new key is held |
| **Operator** | `set_operator` | vault owner | none | — |

**The real cut-over is the accept.** Until a handover is accepted, the old owner key stays the owner and does
everything as today. Proposing changes nothing else.

**Cancelling a handover before it's accepted:**
- **Desk:** `npm run desk -- owner cancel --send` (old owner key).
- **Vault:** there is no cancel. Propose **your current owner address** instead:
  `npm run bot -- admin propose_owner new_owner=1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717 --as owner --send`. A new proposal
  replaces the old one, so the wrong address can no longer accept. `chain-check` then shows "PENDING to 1635QU…" until
  you clear it a day later with `npm run bot -- admin accept_owner --as owner --send`.

### Picks and Race picks (D-096, D-106)
- **Race picks: done** on 4 Nov → `1LMV8E…` (tx `0x1220bd9c…`, read back on both nodes) ✅. `npm run racepicks` reads
  the owner from the chain, so for a Race picks action `OWNER_WIF` is the new owner key that day. `RACE_WIF` (the
  contract's own key, which can still replace its code) goes offline in step 6.
- **Picks: later, not this weekend** (D-106). It moves once the handover commands (R-BX-3, plan in PR #79) are built,
  tested on testnet and pass Repo Lens, and **after Survivor's game 3 is applied on Picks** (the accept throws away every
  Picks announcement and upgrade still waiting). Target the weekend of 14–15 Nov or later; then the Picks v2 upgrade.
  The draft steps are in §7.1.

---

---

## 4. What must never happen

1. **The seed going back onto the owner's key** (or any shared key). The seed stays on `1K8VV…` (D-022).
2. **A key in chat, email, a screenshot or GitHub.** The only exception is `OPERATOR_WIF` as a GitHub secret. A key that leaks is replaced at once.
3. **A handover while something is pending that it would wipe:** the vault: an announced upgrade; the Desk: a pending treasury change, upgrade or settings; Picks: pending game announcements or an upgrade.
4. **The Desk owner handover before the Desk treasury change is applied.**
5. **Typing an address by hand, or checking only part of it.** Copy and paste it, then compare the **full** address in the dry run against the wallet it came from.
6. **The cold treasury sharing anything with the owner**, or its key being exported or loaded anywhere.
7. **Removing a key from `.env` before its wallet is emptied** (I-045), or before its backup is confirmed.
8. **Sending KOIN to a contract address** (vault, Desk, Picks, Race picks, sponsor, tokens): it can get stuck. Fund only people's wallets. `tools/send-koin.ts` refuses contracts.
9. **Changing the Race picks owner again without `npm run racepicks -- owner`** (it checks the address twice and that you hold the new key). It's immediate and can't be undone.
10. **Running `npm run bot -- keys`** (or the desk and picks `keys` commands).

---

## 5. Risks we accept for now

Kept in the owner's private notes (`claude/private/`), with the protections for each.

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
| 4a (vault propose) | "An ownership transfer to `1LMV8E…` is pending (it can be accepted a day after it was proposed). If you did not do this, your admin key may be compromised: propose your own address again right away." | The proposal you just made |
| 5a (Desk propose) | "A Desk owner change to `1LMV8E…` is proposed (it can accept from …). If you did not do this, your admin key is compromised: cancel it (npm run desk -- owner cancel --send) and withdraw the Desk to the treasury." | The proposal you just made. **Do nothing**: don't cancel, don't withdraw |
| 4b (vault accept) | "The game's owner is `1LMV8E…`, not 1635QU… as in deployment.json. If you did not hand it over, your admin key is compromised." | The record still has the old owner |
| 5b (Desk accept) | "The Desk's owner is `1LMV8E…`, not 1635QU… as in desk-data/deployment.json. If you did not change it, your admin key is compromised." | The record still has the old owner |

**An email that names an address you didn't write down in step 1, or a step you didn't do, is real.** Stop and act on
it (vault: propose your own address, §3; Desk: `owner cancel`).

**How to read these emails.** Every one arrives as GitHub's **"Run failed: Knode Games bot"** email: the bot fails its run
on purpose so GitHub tells you. The email itself doesn't say why. Open it → **View workflow run** → the red run →
the lines marked **Needs attention**. Each line is one alert. Several alerts in the same hour arrive in **one** email.
The full list of alerts, and what to do about each, is `.ai/platform/ALERTS.md`.

### Other owner steps this week that also send an email (expected)
These come from the same chain watch. Each emails **once**, the hour after you do the step. They're expected **only
if you did that step**; the "if you did not do this" wording is the same safety sentence as above.

| You did | Email text (start) | What it means in plain words | Do you need to do anything? |
|---|---|---|---|
| `game-add <id> …` (announce a game) | "A game is announced: id N \"name\" …" | the vault has a new game waiting its 48 h before it can be applied | no. Apply it after 48 h (`game-apply`) |
| **`game-apply 2` / `game-apply 7`** (Thu) | "The vault's game list changed (a game was added, stopped or restarted) …" | the game is now in the vault and earns from next week | no. Check with `npm run bot -- games` that it shows "from week 3" |
| `game-stop <id>` | "The vault's game list changed …" | the game takes no new stakes; it earns through this week | no, if you meant it |
| `game-correct` / `game-unprize` | "The owner corrected results for &lt;game&gt; week N …" | your correction is on chain | no |
| `game-void` | "The owner voided &lt;game&gt; week N …" | that week's bucket rolls over in the game; its free prize goes back to the pool | no |
| `pause on` / `pause off`, a minimum-stake or sponsor-limit change | "Owner settings: …" | a vault setting you changed is now live | no. If it stays every hour, the setting still differs from `game-data/deployment.json`: tell the Vault chat |
| `upgrade apply` (a vault upgrade) | "The game contract on chain is not what deployment.json records …" | the new code is live but the record on `main` still names the old code | yes, a records PR: the Vault chat updates `wasmSha256`; you merge it, and the email stops |
| `register-key node` (a new node key) | "The block-producer key registered for the game is …" | the pool now produces with the new node's key | yes, a records PR updates `producerKey` |
| `set_operator` (a new bot key) | "The game's operator is X …", then **every hour** "The contract's operator is X, not this bot" | the contract has a new operator but GitHub's `OPERATOR_WIF` is still the old key, so the bot can't post | yes, update the GitHub secret `OPERATOR_WIF` (Settings → Environments → `bot`) and the records PR |

**Also expected this week, not from the chain watch:** a **"Run failed: Heal alert"** email if you restart Docker or a
node by hand ("Self-healing restarted …"); it means the PC's self-heal task restarted a node, and it's nothing to act
on unless it says it **stopped trying** (`.ai/platform/ALERTS.md` §7).

---

## 7. Weekend runbook (Fri 6 – Tue 10 Nov 2026)

**The full steps are private** (`claude/private/WALLETS-RUNBOOK-FULL.md`), because they cover creating the cold wallets and where their keys are kept. The order, for reference (dates: `.ai/platform/CALENDAR.md`):

| Step | What | On chain |
|---|---|---|
| 0 | read-only check (`npm run bot -- status`, `chain-check`, `npm run desk -- status`, `npm run picks -- status`) | nothing |
| 1 | create the cold treasury; fund the cold owner with a little KOIN for Mana (`tools/send-koin.ts`) | a KOIN transfer |
| 2a / 2b | Desk treasury: `schedule_treasury`, then `apply_treasury` 48 h later | owner |
| 3 | sweep the old operator's KOIN (`tools/sweep-old-bot.ts`) | a KOIN transfer |
| 4a | vault owner: `propose_owner` to `1LMV8E…` (**Mon 9, after the v6.1 upload**, D-130) | owner |
| 5a | Desk owner: `propose_owner` to `1LMV8E…`, only after 2b | owner |
| 4b / 5b | both accepts (Tue 10) | cold owner |
| 6 | records PR (deployment files, `KEYS_AND_ROLES.md`) and clean-up | — |

### 7.1 Later: the Picks handover (D-106)
Tool built (#180, `owner-propose` / `owner-accept` / `owner-cancel`); plan: `docs/blockx/OWNER-HANDOVER-PLAN.md`. Runs after its Repo Lens review and a testnet run, on a date the owner picks.

---

## 8. Requests for other chats (through the owner)
- **Block X chat (`bot/picks.ts`, R-BX-3, plan in PR #79):** `owner-propose`, `owner-accept` (signs with
  `NEW_OWNER_WIF`) and `owner-cancel`, built, tested on testnet and through Repo Lens (D-106), then confirm the exact lines in §7.1.
- **Race chat:** done (R-RACE-3, PRs #84 and #93; the owner moved 4 Nov).
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
- Any personal access token on your PC must be fine-grained,
  for this repository only, with **Actions: read and write** and never **Contents: write**.
- `OPERATOR_WIF` is the only secret, in the `bot` environment.
