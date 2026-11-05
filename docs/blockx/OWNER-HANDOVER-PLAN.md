# Plan: handing the Picks contract to the new owner (R-BX-3, I-076, D-083)

> Status: **plan only, nothing built yet.** Written 2026-11-04 by the Block X chat. Build it, test it on the testnet,
> then Repo Lens, before any mainnet step.

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
