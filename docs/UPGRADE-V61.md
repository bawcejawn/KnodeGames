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
| Upload paid by | the owner wallet that signs: **at least 95 Mana in it** (the tool refuses below about 93); about **47** is spent at mainnet prices (Repo Lens #D-8, D8-5) |

## Before the upload (Repo Lens #B-4's three conditions)
1. **Mana of a 60-question week measured on testnet (V61-B1).** `npm run bot -- testnet-v61` deploys a fresh v6.1 copy on the testnet,
   plays a 45-minute week with 60 questions, and writes `testnet-v61/report.md`: the 1st, 30th and 60th answer, settle with
   60 and 30 answers, close and finalize. Each answer and settle must fit 1 Mana (the sponsor's limit).
   **✅ Done 4 Nov 2026** (fresh copy `1NGJiwjw…` of `399171a2…`): answer no. 1 **0.054**, no. 30 **0.055**, no. 60 **0.061**
   Mana; settle with 60 answers **0.124**, with 30 **0.085**; close 0.083; finalize 0.049; the 61st question refused
   ("too many questions this week"). All far under 1 Mana: no new `mana-limits.json` rows needed.
2. **The emergency build pin (V61-A3, D8-3):** right after the upload (step 3) `safeWasmSha256` becomes `a6bc0164…` in
   `game-data/deployment.json`. Until then the pinned emergency build stays v6's `e84fec49…`, which is compatible with v6.1's storage.
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
- The owner wallet `1635QU…` must hold **at least 95 Mana** by upload day (check in Kondor; `status` shows the bot wallet, not the owner).
- (Once PR #114 is merged, use `git checkout main` and `git pull` instead.)

## 1. Announce (starts the 48 hours)
```powershell
npm run bot -- upgrade schedule
npm run bot -- upgrade schedule --send
```
The dry run must show "Local build … sha256 0x399171a2…". The bot emails you "A code upgrade is scheduled" (expected).

## 2. Wait 48 hours
Don't rebuild in between. `npm run bot -- upgrade status` must say "✔ matches the local build".

## 3. Upload (48 h after step 1, and **confirmed in a block before Monday 00:00 UTC**, Sunday 4 PM Pacific) (D8-7)
```powershell
npm run bot -- status > before-v61.txt
npm run bot -- upgrade apply
npm run bot -- upgrade apply --send
npm run bot -- status
```
- `upgrade apply --send` uploads, then clears the notice with `cancel_upgrade` (step "2/2"). That owner call is the first
  action on the new code: it fixes the rule week at once, so no extra action is needed (D8-9, V61-A2).
- **Check (D8-6):** `status` shows `Questions a week  this week 30, next week 60; 60 from Week 4 (stored rule 4)`.
  Week 4 in `status` is the week from Mon 9 Nov. If the rule says anything else, stop and tell the Vault chat.
- `status` shows the same stakes, seed and pots as `before-v61.txt` (apart from new rewards).
- **Right away, the emergency pin (D8-3):** `notepad game-data\deployment.json`, set
  `"safeWasmSha256": "a6bc0164a4a8a3082d3c25e39bdee35221cd77633263b2688642acb3ba07743d"`, save, then check
  `npm run bot -- upgrade status --safe` shows no ✖ about the pinned build. From now on the emergency build is v6.1's.

## 4. Records (one pull request into `main`)
- `game-data/deployment.json`: `wasmSha256` → `399171a2…` (the tool wrote it on apply) and `safeWasmSha256` → `a6bc0164…` (step 3): commit both.
- Merge PR #114 the same day if it isn't merged yet.

## The rollback rule (V61-A1)
If the vault is ever rolled back from v6.1 to the **v6 normal build**: **while v6 is live, make one owner config call**
before v6.1 is uploaded again, for example `npm run bot -- pause off --send` (it changes nothing). It rewrites the stored
settings without v6.1's rule week, so a later re-upload of v6.1 sets a fresh one (next week). Without it, re-uploading v6.1
could raise the running week's limit from 30 to 60 halfway through. The test "rollback (Repo Lens V61-A1)" in
`game/scripts/storage-compat-v61.test.ts` shows both cases. (A rollback to the withdrawals-only build doesn't need this.)
