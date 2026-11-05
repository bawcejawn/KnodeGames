# Plan: handing the Picks contract to the new owner (R-BX-3, I-076, D-083)

> Status: **built** (5 Nov 2026, the Block X chat): `owner-propose`, `owner-accept`, `owner-cancel` and the extended
> `status` are in `bot/picks.ts`, with offline tests in `tests/audit/picks.tool.test.ts`. Read on mainnet 5 Nov: the owner
> on chain is `1635QU…H717`, with **nothing waiting** (no proposal, no announcement, no upgrade). Still to do: the
> testnet run (step 8 below), Repo Lens, then the mainnet steps on the owner's date. The steps are under **"Running it"**
> at the end.

## What the contract does today (`picks/assembly/Picks.ts`, live code `700c296a…`)

- **Step 1, `propose_owner(new)`:** only the current owner (`1635QUr…H717`). It starts a **48-hour** wait. Proposing an
  empty address cancels a proposal. The new owner can't be the contract itself.
- **Step 2, `accept_owner()`:** signed by the **new** owner, at least 48 hours after step 1 and less than 7 days after
  that (after 7 days the proposal expires and must be made again).
- **Accepting starts clean.** Every game announcement still waiting (`announce_game`) becomes unusable, and a scheduled
  code upgrade (`schedule_upgrade`) is cleared. Games already in force (game 2, Block X) are **not** affected.

## When to do it

Only when **nothing is waiting** on the contract. Otherwise the handover silently throws the waiting change away:
- no game announcement waiting (`list_pending` empty), for example a Combo game-8 announcement;
- no scheduled upgrade (`upgrade_hash` empty), for example the Picks v2 upgrade for Combo.

Recommended order with Combo: **hand over first, then** the new owner runs the Picks v2 upgrade (`upgrade-schedule`,
48 hours, `upgrade-upload`, `upgrade-clear`) and announces game 8. The other order also works, but only once the
upgrade is uploaded and cleared and game 8 is applied.

## The commands to build (`bot/picks.ts`)

Each is a dry run by default. A mainnet send needs `--send --mainnet` and `CONFIRM_MAINNET=yes`, like every owner action.

| Command | Signs with | What it checks before sending (two nodes, as `status`) |
|---|---|---|
| `npm run picks -- owner-propose <address>` | `OWNER_WIF` (the current owner) | <ul><li>the address is a valid wallet, not the current owner, and not a Knode contract, sponsor, game, Picks or Desk address;</li><li>the signer is the on-chain owner;</li><li>**nothing is waiting** (no announcement, no upgrade), or it refuses and names what's waiting;</li><li>prints when step 2 opens and when it expires.</li></ul> |
| `npm run picks -- owner-accept` | `NEW_OWNER_WIF` (the cold key, in `.env` only that day) | <ul><li>a proposal exists for exactly that key's address;</li><li>48 hours have passed and 7 days haven't;</li><li>still nothing waiting.</li></ul> After sending, it reads the owner back from both nodes and prints the line to put in `picks-data/deployment.json`. |
| `npm run picks -- owner-cancel` | `OWNER_WIF` | <ul><li>a proposal exists;</li><li>sends `propose_owner` with an empty address.</li></ul> |
| `npm run picks -- status` (extended) | — | Shows the owner, any proposed owner with its open and expiry times, waiting announcements and the scheduled upgrade. |

**`MAINNET_OWNER` stops being hard-coded.** It is read from `picks-data/deployment.json` (`"owner"`), and every
owner command first checks it equals the owner on chain on two nodes. A mismatch stops the tool. Until the file gains
`"owner"`, the tool keeps today's value, so nothing changes before the handover. After step 2, a pull request to
`main` updates the file (as with `wasmSha256` for the v2 upgrade).

The testnet guard that stops a mainnet owner key from being used on the testnet checks against the file's owner too.

## Tests to write with it (offline, fake nodes, as `tests/audit/picks.tool.test.ts`)

1. `owner-propose` is a dry run without `--send`. With `--send` but no `--mainnet` or `CONFIRM_MAINNET`, it refuses.
2. It refuses: a bad address, the current owner, a known Knode or contract address, and a signer that isn't the on-chain owner.
3. It refuses while a game announcement is waiting, and while an upgrade is scheduled, naming each one.
4. `owner-accept` refuses: before 48 hours, after 7 days, with a key that isn't the proposed owner, and with no proposal.
5. After accept, the owner read back from both nodes must equal the new address, or the tool says so loudly.
6. `MAINNET_OWNER` comes from the deployment file. If the file and the chain disagree (either node), every owner command stops before signing.
7. `status` shows a waiting proposal, with its open and expiry times.
8. On the testnet, a full run against a fresh test contract: propose, wait (the testnet build waits 10 minutes, `picks/scripts/build-testnet.cjs`), accept, and check that a pending announcement made before the handover can't be applied after it.

## Open questions for the owner

- **The new owner's address:** it comes from the wallet runbook (PR #73, `docs/WALLETS.md`). Picks moves on the same
  weekend as the other contracts, or later?
- **Order with Combo:** confirm "hand over first, then the Picks v2 upgrade".

## Running it (PowerShell, from `C:\kprediction`; every send is a dry run first)

**0. Look (read-only):**
```powershell
cd C:\kprediction
git branch --show-current
git pull
$env:RPC = "https://koinos.armana.io"
npm run picks -- status
```
Expect `Owner 1635QU…H717 ✔`, no `Handover` line, no `Announced` line, no `Upgrade` line.

**1. Propose (signed by the current owner, `OWNER_WIF`):**
```powershell
npm run picks -- owner-propose 1LMV8EcRFLFGRMFSC7rKw3eQ3PSzLRRFmd
```
The dry run prints when step 2 opens (48 h) and when it closes (7 days after). It refuses if anything is waiting. If it
looks right: CONFIRM_MAINNET **Turn ON**, then run the same line with `--send --mainnet`, then **Turn OFF**.

**2. Accept (48 h to 7 days later, signed by the new owner):** put `NEW_OWNER_WIF=<the new owner's key>` in `.env`
for this step only. That wallet pays the Mana itself, so it needs a little KOIN.
```powershell
npm run picks -- owner-accept
```
If the dry run says ✔: **Turn ON**, the same line with `--send --mainnet`, **Turn OFF**, then **remove `NEW_OWNER_WIF`
from `.env`**. The tool reads the owner back on both nodes and writes `"owner"` into `picks-data/deployment.json`.
Commit that file in a PR to `main`. From then on, owner commands need `OWNER_WIF` to be the new owner's key.

**Cancel** (before the accept): `npm run picks -- owner-cancel`, then the same with `--send --mainnet`.

**Order with the vault handover (D-130):** the vault is proposed Mon 9 and accepted Tue 10. The Picks steps are separate
and can run on the same days, as long as nothing is announced on Picks in between (Combo's game 8 and the Picks v2
upgrade wait until after the accept).
