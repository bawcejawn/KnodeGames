# Upgrade to game v6.1 (60 questions a week, and Questions on the shared game rules): runbook

Every command that changes something is a dry run until you add `--send`, and mainnet also needs
`CONFIRM_MAINNET=yes` in `.env`. Run everything in PowerShell in `C:\kprediction`.

| | |
|---|---|
| Contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (the vault, same address) |
| Live code | `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` (v6, uploaded 2026-11-02) |
| **New code** | `4dcc89a6c87b47479e87abc744abc9f34379e135e335840307825c9c64364d4a`, 87,761 bytes (PR #114: the 60-question cap and D-116; **Repo Lens next**) |
| New emergency build | `72910f7cdca271ad1faec22e20118d907bd979028ceb8d16a4ee008b44364a70` (withdrawals-only, same source; pinned in step 3) |
| What changes | **From the week after the upload** (never the running week, the "rule week"): (1) a week may hold 60 questions; (2) **Daily Questions plays by the shared game rules (D-116):** it's paid from a results file like every game (`post_results` → seal → `finalize_game_week` → `claim_game`), with no settle step and no 40/60 baskets; stakes use `deposit_to` / `withdraw_from` (game 1) like every game, read in place from each player's existing record (nothing moves); the old `deposit_vhp` / `deposit_koin` / `withdraw` stay as aliases of the same calls (owner, 4 Nov). A game-1 result needs at least 2 answers that week and no more points than answers (the contract's floor; the recorder applies Questions' full entry rule). Weeks before the rule week are paid the old way, and their rewards stay claimable. `get_state` shows `questions_cap` / `questions_cap_next` |
| Timelock | 48 h after `schedule`, then 7 days to upload |
| Upload paid by | the owner wallet that signs: **at least 95 Mana in it** (the tool refuses below about 93); about **47** is spent at mainnet prices (Repo Lens #D-8, D8-5) |

## Before the announcement and the upload
1. **Testnet (V61-B1, #D-8 D8-1 and D8-2):** `npm run bot -- testnet-v61-d8` deploys a fresh copy of `4dcc89a6…` with 13 games,
   plays a 45-minute week of 60 questions paid the new way (results posted, sealed, finalized, claimed) and a returning player's
   first answer that also closes the week, and writes the resource units of every call to `testnet-v61-d8/units.json`.
   The earlier run of the 30 → 60 build alone (4 Nov, `399171a2…`): answers 0.054 – 0.061 Mana, settle with 60 answers 0.124.
2. **Mainnet price (D8-1):** on your PC, read-only: `npx tsx tools/mainnet-mana.ts docs/testnet-v61-units.json`. Every answer
   must stay under half of its 1-Mana limit.
3. **Repo Lens** on PR #114 at the commit that holds `4dcc89a6…`: GO before the announcement.
4. **The rollback rule (V61-A1), below.**
5. **The Questions recorder (R-Q-4)** writes `games-data:questions/vault/W<week>.json` and `board.json` from the rule week on
   (the vault bot reads `vaultGames.1`; results are due 3 days after the week ends). **The Stake hub** stakes game 1 with
   `deposit_to` (Hub chat) before the rule week starts, because the old deposit call closes then.

## When, and which key signs (owner, 4 Nov: Path 2)
- **Announce Tue 10 Nov**, right after the vault owner handover is accepted (weekend runbook step 4b), signed by the **new owner
  `1LMV8E…`** (its key in `OWNER_WIF` for the day only). Never announce between steps 4a and 4b: the accept wipes a pending upgrade.
- **Upload Thu 12 Nov** (48 h later), again signed by `1LMV8E…`.
- **The rule week is Mon 16 Nov:** 60 questions a week and Questions on the shared game rules start then. The week of
  Mon 9 Nov (the upload lands in it) is paid the old way.
- Only after Repo Lens's two rounds say GO (and the testnet run and mainnet prices are in).

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
- The first hash must be `4dcc89a6…`, the second `72910f7c…`. If either isn't, stop. (A build that stops with `EAGAIN`: run it again.)
- `chain-check`: every line ✔ and "game announced upgrade: none".
- The new owner wallet `1LMV8E…` must hold **at least 95 Mana** by upload day (check in Kondor; `status` shows the bot wallet, not the owner).
- (Once PR #114 is merged, use `git checkout main` and `git pull` instead.)

## 1. Announce (starts the 48 hours)
```powershell
npm run bot -- upgrade schedule
npm run bot -- upgrade schedule --send
```
The dry run must show "Local build … sha256 0x4dcc89a6…". The bot emails you "A code upgrade is scheduled" (expected).

## 2. Wait 48 hours
Don't rebuild in between. `npm run bot -- upgrade status` must say "✔ matches the local build".

## 3. Upload (48 h after step 1; Thu 12 Nov, so it is confirmed well before Mon 16 Nov 00:00 UTC, Sun 15 Nov 4 PM Pacific) (D8-7)
```powershell
npm run bot -- status > before-v61.txt
npm run bot -- upgrade apply
npm run bot -- upgrade apply --send
npm run bot -- status
```
- `upgrade apply --send` uploads, then clears the notice with `cancel_upgrade` (step "2/2"). That owner call is the first
  action on the new code: it fixes the rule week at once, so no extra action is needed (D8-9, V61-A2).
- **Check (D8-6):** `status` shows `Questions a week  this week 30, next week 60; 60 from Week 5 (stored rule 5)`.
  Week 5 in `status` is the week from Mon 16 Nov (an upload on Thu 12). If the rule says anything else, stop and tell the
  Vault chat.
- `status` shows the same stakes, seed and pots as `before-v61.txt` (apart from new rewards).
- **Right away, the emergency pin (D8-3):** `notepad game-data\deployment.json`, set
  `"safeWasmSha256": "72910f7cdca271ad1faec22e20118d907bd979028ceb8d16a4ee008b44364a70"`, save, then check
  `npm run bot -- upgrade status --safe` shows no ✖ about the pinned build. From now on the emergency build is v6.1's.

## 4. Records (one pull request into `main`)
- `game-data/deployment.json`: `wasmSha256` → `4dcc89a6…` (the tool wrote it on apply) and `safeWasmSha256` → `72910f7c…` (step 3): commit both.
- Merge PR #114 the same day if it isn't merged yet.

## The rollback rule (V61-A1)
If the vault is ever rolled back from v6.1 to the **v6 normal build**: **while v6 is live, make one owner config call**
before v6.1 is uploaded again, for example `npm run bot -- pause off --send` (it changes nothing). It rewrites the stored
settings without v6.1's rule week, so a later re-upload of v6.1 sets a fresh one (next week). Without it, re-uploading v6.1
could raise the running week's limit from 30 to 60 halfway through. The test "rollback (Repo Lens V61-A1)" in
`game/scripts/storage-compat-v61.test.ts` shows both cases. (A rollback to the withdrawals-only build doesn't need this.)
