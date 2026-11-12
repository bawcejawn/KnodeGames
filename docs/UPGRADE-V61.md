# Upgrade to game v6.1 (60 questions a week, and Questions on the shared game rules): runbook

Every command that changes something is a dry run until you add `--send`, and mainnet also needs
`CONFIRM_MAINNET=yes` in `.env`. Run everything in PowerShell in `C:\kprediction`.

| | |
|---|---|
| Contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` (the vault, same address) |
| Live code | `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` (v6, uploaded 2026-11-02) |
| **New code** | `11043e1fde1d8d7dbac75e9e5e788d058a7116b0dab6149fc09ecdc7b1c4258b`, 87,857 bytes (PR #114: the 60-question cap, D-116 and D-127; **Repo Lens #E-16 round 2: GO**, 4 Nov) |
| New emergency build | `04c27c1acde570b97a430dea403d41aab47e083ae30115353ee5f89932dad0bb` (withdrawals-only, same source; pinned in step 3) |
| What changes | **From the week after the upload** (never the running week, the "rule week"): (1) a week may hold 60 questions; (2) **Daily Questions plays by the shared game rules (D-116):** it's paid from a results file like every game (`post_results` → seal → `finalize_game_week` → `claim_game`), with no settle step and no 40/60 baskets; stakes use `deposit_to` / `withdraw_from` (game 1) like every game, read in place from each player's existing record (nothing moves); the old `deposit_vhp` / `deposit_koin` / `withdraw` stay as aliases of the same calls (owner, 4 Nov). A game-1 result needs at least 2 answers that week and no more points than answers (the contract's floor; the recorder applies Questions' full entry rule). Weeks before the rule week are paid the old way, and their rewards stay claimable. `get_state` shows `questions_cap` / `questions_cap_next` |
| Timelock | 48 h after `schedule`, then 7 days to upload |
| Upload paid by | the owner wallet that signs, the **current vault owner `1635QU…`**: **at least 95 Mana in it** (the tool refuses below about 93); about **65** is spent at mainnet prices (owner's `tools/mainnet-mana.ts` run, 4 Nov) |

## Before the announcement and the upload
1. **Testnet (V61-B1, #D-8 D8-1 and D8-2):** `npm run bot -- testnet-v61-d8` deploys a fresh copy of `11043e1f…` with 13 games,
   plays a 90-minute week of 60 questions paid the new way (results posted, sealed, finalized, claimed) and a returning player's
   first answer that also closes the week, and writes the resource units of every call to `testnet-v61-d8/units.json`.
   The earlier run of the 30 → 60 build alone (4 Nov, `399171a2…`): answers 0.054 – 0.061 Mana, settle with 60 answers 0.124.
2. **Mainnet price (D8-1):** on your PC, read-only: `npx tsx tools/mainnet-mana.ts docs/testnet-v61-units.json`. Every answer
   must stay under half of its 1-Mana limit.
3. **Repo Lens** on PR #114 at the commit that holds `11043e1f…`: GO before the announcement.
4. **The rollback rule (V61-A1), below.**
5. **The Questions recorder (R-Q-4)** writes `games-data:questions/vault/W<week>.json` and `board.json` from the rule week on
   (the vault bot reads `vaultGames.1`; results are due 3 days after the week ends). **The Stake hub** stakes game 1 with
   `deposit_to` (Hub chat) before the rule week starts, because the old deposit call closes then.

## When, and which key signs (owner, 4 Nov evening: "push everything ASAP", before Tue 10)
The vault owner handover's accept (weekend runbook step 4b, Tue 10) **wipes an announced upgrade that isn't uploaded
yet**. So both the announcement and the upload happen **before** the accept, signed by the **current vault owner
`1635QU…`** (its key in `OWNER_WIF` for those two sittings only; the old owner paper).
- **Announce Thu 5 Nov** (as soon as possible; at the latest Fri 6 Nov, 9:00 AM Pacific, so the 48 hours end by Sun 8).
- **Upload Mon 9 Nov, from 9:00 AM Pacific (17:00 UTC).** Never before **Sun 8 Nov 4:00 PM Pacific (Mon 9 00:00 UTC)**:
  the rule week is set to the week after the upload's week, so an upload on Sun 8 Pacific before 4 PM would start the
  new rules on Mon 9 instead of Mon 16. Monday morning keeps a wide margin.
- **Right after the upload, the vault handover propose (weekend runbook step 4a), moved from Sun to Mon 9 morning** (before
  4:30 PM Pacific, so the accept can still be Tue 10 from 4:30 PM with the Desk's, as planned). Its check "game
  announced upgrade: none" is then true. **Don't send 4a before the upload**: the upgrade would still be pending.
- **The rule week is Mon 16 Nov:** 60 questions a week and Questions on the shared game rules start then. The week of
  Mon 9 Nov (the upload lands in it) is paid the old way.
- Keep **about 100 KOIN in `1635QU…` until the upload is done** (the weekend runbook's KOIN move to the new owner waits
  until after it; then leave the ~5 KOIN for the later Picks handover).

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
- The first hash must be `11043e1f…`, the second `04c27c1a…`. If either isn't, stop. (A build that stops with `EAGAIN`: run it again.)
- `chain-check`: every line ✔ and "game announced upgrade: none".
- The current vault owner wallet `1635QU…` must hold **at least 95 Mana** on upload day (check in Kondor; `status` shows the bot wallet, not the owner). `upgrade apply` (the dry run) prints it too.
- (Once PR #114 is merged, use `git checkout main` and `git pull` instead.)

## 1. Announce (starts the 48 hours)
```powershell
npm run bot -- upgrade schedule
npm run bot -- upgrade schedule --send
```
The dry run must show "Local build … sha256 0x11043e1f…". The bot emails you "A code upgrade is scheduled" (expected).

## 2. Wait 48 hours
Don't rebuild in between. `npm run bot -- upgrade status` must say "✔ matches the local build".

## 3. Upload (Mon 9 Nov from 9:00 AM Pacific; never before Sun 8 Nov 4:00 PM Pacific) (D8-7)
```powershell
npm run bot -- status > before-v61.txt
npm run bot -- upgrade apply
npm run bot -- upgrade apply --send
npm run bot -- status
```
- `upgrade apply --send` uploads, then clears the notice with `cancel_upgrade` (step "2/2"). That owner call is the first
  action on the new code: it fixes the rule week at once, so no extra action is needed (D8-9, V61-A2). The rule week is
  set by the **first contract action after the upload** (that action's week + 2), not by the upload itself (Repo Lens
  #F-4 F4-2). **If step 2/2 failed**, send `npm run bot -- upgrade cancel --send` (or let the bot run once) **before
  Mon 16 Nov 00:00 UTC**, then check `status` as below. After Mon 16 00:00 UTC, week 4 would run the old rules: stop and
  tell the Vault chat.
- **Check (D8-6):** `status` shows `Questions a week  this week 30, next week 60; 60 from vault week 4 (stored rule 5)`.
  vault week 4 in `status` is the week from Mon 16 Nov (an upload on Mon 9). If the rule says anything else, stop and tell the
  Vault chat.
- `status` shows the same stakes, seed and pots as `before-v61.txt` (apart from new rewards).
- **Right away, the emergency pin (D8-3):** `notepad game-data\deployment.json`, set
  `"safeWasmSha256": "04c27c1acde570b97a430dea403d41aab47e083ae30115353ee5f89932dad0bb"`, save, then check
  `npm run bot -- upgrade status --safe` shows no ✖ about the pinned build. From now on the emergency build is v6.1's.

## 4. Records (one pull request into `main`)
- `game-data/deployment.json`: `wasmSha256` → `11043e1f…` (the tool wrote it on apply) and `safeWasmSha256` → `04c27c1a…` (step 3): commit both.
- **Merge PR #114 as soon as Repo Lens gives GO** (it no longer waits for the upload). Owner, 10 Nov: **Week 1 = Mon 16
  Nov (vault week 4).** The week of Mon 9 (vault week 3) is a **test week**: every game plays, nothing pays, and its
  earnings go to Week 1's pool. **Last week (vault week 2, 2-9 Nov) pays as normal.** #114 sets this with
  `"vaultTestWeeks": [3]` in `game-data/deployment.json`. For week 3 the bot:
  - still posts Daily Questions, but resolves them **VOID** on chain with the real result's data_hash. In an old-rules
    week anyone can settle anyone, so a lone settled player would otherwise take the whole week-3 pot (Repo Lens #F-4
    F4-1). The Questions page shows the real answer as a **practice** result and practice standings, with no rewards;
  - settles nobody, so game 1's week-3 pot rolls into week 4 (the bot still settles week 2);
  - posts no results, prize winners or settles for Block X and the Race: each game's week 3 rolls over at its deadline
    (Thu 19 Nov 00:00 UTC), its stakers' bucket is added to week 4, and its prize goes back to the pool and is paid out
    with week 4's close.

  Until #114 is on `main`, `main`'s bot resolves week-3 questions from their blocks. If one got a real answer first, the
  bot emails "… must be VOID": void it with the owner key, `npm run bot -- void-test <#> --send` (the alert gives the exact line), before week 3
  closes.

## The rollback rule (Repo Lens C-1; replaces V61-A1)
- **Before the rule week starts:** a rollback to the v6 normal build is possible; nothing of the new path has run yet.
- **Once the rule week has started: roll back only to the withdrawals-only build** (`04c27c1a…` → see the pin; the same v6.1
  source), **never to the v6 normal build**, and never make a config call to "reset" the rule week. v6 can't pay game 1's
  new-rule weeks (it refuses game 1 in `finalize_game_week` and `claim_game`).
- The contract is hardened anyway (C-1): a week the new code closed into game 1's game-week stays payable from its results
  file, and is never settled, even after a rollback and a re-upload that moves the rule week. The test "rollback after the
  rule week (Repo Lens C-1)" in `game/scripts/storage-compat-v61.test.ts` proves it, and "rollback (Repo Lens V61-A1)" keeps
  showing why the 60-question cap needs the same care.
