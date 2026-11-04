# Upgrade to game v6.1 (60 questions a week, and Questions on the shared game rules): runbook

Every command that changes something is a dry run until you add `--send`, and mainnet also needs
`CONFIRM_MAINNET=yes` in `.env`. Run everything in PowerShell in `C:\kprediction`.

| | |
|---|---|
| Contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (the vault, same address) |
| Live code | `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` (v6, uploaded 2026-11-02) |
| **New code** | `da9dc9c984ca16764712efeed49b653ec62fe555dc5afe5127efbd7d19ab594a`, 87,558 bytes (PR #114: the 60-question cap and D-116; **Repo Lens next**) |
| New emergency build | `a15d3dbe8f4fd6849a50b2da69b0917922a1e45b18c8d8b1a3813697ba77d545` (withdrawals-only, same source; pinned in step 3) |
| What changes | **From the week after the upload** (never the running week, the "rule week"): (1) a week may hold 60 questions; (2) **Daily Questions plays by the shared game rules (D-116):** it's paid from a results file like every game (`post_results` → seal → `finalize_game_week` → `claim_game`), with no settle step and no 40/60 baskets; stakes use `deposit_to` / `withdraw_from` (game 1) like every game, read in place from each player's existing record (nothing moves); the old `deposit_vhp` / `deposit_koin` stop taking new stakes from that week (owner, 4 Nov), and `withdraw` keeps working forever. Weeks before the rule week are paid the old way, and their rewards stay claimable. `get_state` shows `questions_cap` / `questions_cap_next` |
| Timelock | 48 h after `schedule`, then 7 days to upload |
| Upload paid by | the owner wallet that signs: **at least 95 Mana in it** (the tool refuses below about 93); about **47** is spent at mainnet prices (Repo Lens #D-8, D8-5) |

## Before the announcement and the upload
1. **Testnet (V61-B1, #D-8 D8-1 and D8-2):** `npm run bot -- testnet-v61-d8` deploys a fresh copy of `da9dc9c9…` with 13 games,
   plays a 45-minute week of 60 questions paid the new way (results posted, sealed, finalized, claimed) and a returning player's
   first answer that also closes the week, and writes the resource units of every call to `testnet-v61-d8/units.json`.
   The earlier run of the 30 → 60 build alone (4 Nov, `399171a2…`): answers 0.054 – 0.061 Mana, settle with 60 answers 0.124.
2. **Mainnet price (D8-1):** on your PC, read-only: `npx tsx tools/mainnet-mana.ts docs/testnet-v61-units.json`. Every answer
   must stay under half of its 1-Mana limit.
3. **Repo Lens** on PR #114 at the commit that holds `da9dc9c9…`: GO before the announcement.
4. **The rollback rule (V61-A1), below.**
5. **The Questions recorder (R-Q-4)** writes `games-data:questions/vault/W<week>.json` and `board.json` from the rule week on
   (the vault bot reads `vaultGames.1`; results are due 3 days after the week ends). **The Stake hub** stakes game 1 with
   `deposit_to` (Hub chat) before the rule week starts, because the old deposit call closes then.

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
- The first hash must be `da9dc9c9…`, the second `a15d3dbe…`. If either isn't, stop. (A build that stops with `EAGAIN`: run it again.)
- `chain-check`: every line ✔ and "game announced upgrade: none".
- The owner wallet `1635QU…` must hold **at least 95 Mana** by upload day (check in Kondor; `status` shows the bot wallet, not the owner).
- (Once PR #114 is merged, use `git checkout main` and `git pull` instead.)

## 1. Announce (starts the 48 hours)
```powershell
npm run bot -- upgrade schedule
npm run bot -- upgrade schedule --send
```
The dry run must show "Local build … sha256 0xda9dc9c9…". The bot emails you "A code upgrade is scheduled" (expected).

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
  `"safeWasmSha256": "a15d3dbe8f4fd6849a50b2da69b0917922a1e45b18c8d8b1a3813697ba77d545"`, save, then check
  `npm run bot -- upgrade status --safe` shows no ✖ about the pinned build. From now on the emergency build is v6.1's.

## 4. Records (one pull request into `main`)
- `game-data/deployment.json`: `wasmSha256` → `da9dc9c9…` (the tool wrote it on apply) and `safeWasmSha256` → `a15d3dbe…` (step 3): commit both.
- Merge PR #114 the same day if it isn't merged yet.

## The rollback rule (V61-A1)
If the vault is ever rolled back from v6.1 to the **v6 normal build**: **while v6 is live, make one owner config call**
before v6.1 is uploaded again, for example `npm run bot -- pause off --send` (it changes nothing). It rewrites the stored
settings without v6.1's rule week, so a later re-upload of v6.1 sets a fresh one (next week). Without it, re-uploading v6.1
could raise the running week's limit from 30 to 60 halfway through. The test "rollback (Repo Lens V61-A1)" in
`game/scripts/storage-compat-v61.test.ts` shows both cases. (A rollback to the withdrawals-only build doesn't need this.)
