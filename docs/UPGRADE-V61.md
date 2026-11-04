# Upgrade to game v6.1 (up to 60 questions a week): runbook

Every command that changes something is a dry run until you add `--send`, and mainnet also needs
`CONFIRM_MAINNET=yes` in `.env`. Run everything in PowerShell in `C:\kprediction`.

| | |
|---|---|
| Contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (the vault, same address) |
| Live code | `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` (v6, uploaded 2026-11-02) |
| **New code** | `399171a28956ee236d6b41b5779bcda4e2fe18cdc5560ccbfc380c9cf3d9fced` (PR #114; Repo Lens #B-4: GO to announce) |
| New emergency build | `a6bc0164a4a8a3082d3c25e39bdee35221cd77633263b2688642acb3ba07743d` (withdrawals-only, same source; pinned in step 4) |
| What changes | A week may hold 60 questions instead of 30, **from the week after the upload** (never the running week). `get_state` shows `questions_cap` (this week) and `questions_cap_next`. Nothing else |
| Timelock | 48 h after `schedule`, then 7 days to upload |
| Upload paid by | the owner wallet that signs: about **91 KOIN of Mana** (the v6 upload of the same size cost that; the tool checks it) |

## Before the upload (Repo Lens #B-4's three conditions)
1. **Mana of a 60-question week measured on testnet (V61-B1).** `npm run bot -- testnet-v61` deploys a fresh v6.1 copy on the testnet,
   plays a 45-minute week with 60 questions, and writes `testnet-v61/report.md`: the 1st, 30th and 60th answer, settle with
   60 and 30 answers, close and finalize. Each answer and settle must fit 1 Mana (the sponsor's limit). Result: see PR #114.
2. **The emergency build pin (V61-A3):** the records commit after the upload (step 4) sets
   `safeWasmSha256` to `a6bc0164…` in `game-data/deployment.json`. Until then the pinned emergency build stays v6's `e84fec49…`,
   which is compatible with v6.1's storage.
3. **The rollback rule (V61-A1), below.**

## Which key signs
- **Before the vault owner handover is accepted** (weekend runbook step 4b, Tue 10 Nov), the owner is still `1635QU…`: its key
  (`OWNER_WIF` as today) announces and uploads.
- **Never announce between step 4a and 4b without uploading before 4b:** accepting the new owner wipes a pending upgrade.
- After 4b, the new owner `1LMV8E…` signs (its key in `OWNER_WIF` for the day only).

## 0. Build and check on your PC
```powershell
cd C:\kprediction
git branch --show-current
git fetch
git checkout vault-questions-60
git pull
npm ci --ignore-scripts
cd game; npm ci --ignore-scripts; npm test; npm run build:safe; npm run build:sim; npm run check; cd ..
node --import tsx --test game/scripts/storage-compat.test.ts game/scripts/storage-compat-v6.test.ts game/scripts/storage-compat-v61.test.ts bot/*.test.ts
certutil -hashfile game\build\release\contract.wasm SHA256
certutil -hashfile game\build\safe\contract.wasm SHA256
$env:RPC = "https://koinos.armana.io"
npm run bot -- chain-check
npm run bot -- status
```
- The first hash must be `399171a2…`, the second `a6bc0164…`. If either isn't, stop. (A build that stops with `EAGAIN`: run it again.)
- `chain-check`: every line ✔ and "game announced upgrade: none".
- `status`: the owner wallet's Mana must be about 91 KOIN or more by upload day.
- (Once PR #114 is merged, use `git checkout main` and `git pull` instead.)

## 1. Announce (starts the 48 hours)
```powershell
npm run bot -- upgrade schedule
npm run bot -- upgrade schedule --send
```
The dry run must show "Local build … sha256 0x399171a2…". The bot emails you "A code upgrade is scheduled" (expected).

## 2. Wait 48 hours
Don't rebuild in between. `npm run bot -- upgrade status` must say "✔ matches the local build".

## 3. Upload, then one owner action right away
```powershell
npm run bot -- status > before-v61.txt
npm run bot -- upgrade apply
npm run bot -- upgrade apply --send
npm run bot -- pause off
npm run bot -- pause off --send
npm run bot -- admin cancel_upgrade --as owner --send
```
- `pause off` changes nothing (deposits are already open), but it is the first action on the new code: it fixes the
  60-question week as **next Monday** at once (Repo Lens V61-A2). **It must be sent before Monday 00:00 UTC** (Sunday 4 PM
  Pacific) for 60 questions to be allowed from that Monday.
- Then check: `npm run bot -- status` shows the same stakes, seed and pots as `before-v61.txt` (apart from new rewards).
  A read of `get_state` shows `questions_cap` 30 and `questions_cap_next` 60.

## 4. Records (one pull request into `main`)
- `game-data/deployment.json`: `wasmSha256` → `399171a2…` (the tool writes it on apply), `safeWasmSha256` → `a6bc0164…`.
- Merge PR #114 the same day if it isn't merged yet.

## The rollback rule (V61-A1)
If the vault is ever rolled back from v6.1 to the **v6 normal build**: **while v6 is live, make one owner config call**
before v6.1 is uploaded again, for example `npm run bot -- pause off --send` (it changes nothing). It rewrites the stored
settings without v6.1's rule week, so a later re-upload of v6.1 sets a fresh one (next week). Without it, re-uploading v6.1
could raise the running week's limit from 30 to 60 halfway through. The test "rollback (Repo Lens V61-A1)" in
`game/scripts/storage-compat-v61.test.ts` shows both cases. (A rollback to the withdrawals-only build doesn't need this.)
