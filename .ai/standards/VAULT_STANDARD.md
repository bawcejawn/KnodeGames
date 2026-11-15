# Knode Games — Vault Standard

> **Purpose:** what must always be true about how Knode Games holds, accounts for and pays out staked VHP. **Funds safety comes first: when in doubt, don't move funds** (D-003, D-016).
> **Applies to:** the vault contract, the bot's vault code, and every game that sends results to the vault.
> **Last updated:** 12 Nov 2026.
> - v6.1 live (uploaded Tue 10 Nov ~14:57 UTC, PR #114) and the test week of Mon 9 Nov (owner, 10 Nov).
> - Free-prize switch states; games 6 and 9 announced 12 Nov.
> - The vault refuses ruler shadow results (PR #265); the `game-apply` guard (owner, 12 Nov).
> - Unclaimed rewards never expire.
> - Sponsor numbers point to `SPONSOR.md`, timing to `WEEK_CYCLE.md`; the Race's hold after D-125 / #133.
> - Game 1 is on these rules from v6.1's rule week, Mon 16 Nov (D-116, D-130).
>
> **Built from:** `platform/DECISIONS.md` (D-xxx), the Vault, Race, Survivor, Bracket, Golf, Last Node and Combo chats, and the repo. How the contract works in detail: `platform/ARCHITECTURE.md` → Vault v6. Tokens and keys: `TOKEN_STANDARD.md`.

**Words:** **must** = required · **should** = expected · ✅ verified in the repo · ❓ = not yet decided

**Weeks:** the vault counts weeks from Mon 19 Oct 2026 00:00 UTC (vault week 0). Each week runs Monday 00:00 UTC to Monday 00:00 UTC, which is **Sunday 7:00 PM ET to Sunday 7:00 PM ET**. Players' **Week 1 = vault week 4 = Mon 16 Nov**. `bot status` names weeks by the vault's own number ("vault week 3 (test week)", PR #249).

## 1. The vault today
| Item | Value |
|------|-------|
| Contract | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`: the game contract, upgraded in place to Vault v6 on 2 Nov, then to **v6.1 on Tue 10 Nov** (~14:57 UTC; PR #114: 60 questions a week, Daily Questions on the shared rules, the bot closes weeks) ✅ |
| Builds | live **v6.1 `11043e1f…`**; emergency withdrawals-only **`04c27c1a…`**, both recorded in `game-data/deployment.json` ✅. Before 10 Nov: v6 `eed38f7c…` / `e84fec49…` |
| Owner / operator | owner `1635QU…` (the move to the cold owner `1LMV8E…` is postponed until after Week 1); operator (the GitHub bot) `1HsM33…` ✅ |
| Games | see the table below; results sources for 2, 3, 4, 6, 7, 8, 9, 13 are in `vaultGames` ✅ |
| Seed | owner-funded through the seed owner `1K8VV…` (D-022); budget for paid free prizes 12 VHP a week (four games ON); a Koinos Federation seed may come later |
| Producer | the **Knode Games Pool** = the vault address, via the game node (D-073) |
| First paying week | **vault week 4 (Mon 16 Nov) = Week 1** for every game (owner, 10 Nov). See below |

**The test week, vault week 3 (Mon 9 Nov):**
- Every game plays and nothing pays (`"vaultTestWeeks": [3]` in `game-data/deployment.json`).
- Its Daily Questions are VOID on chain, and the page shows practice results.
- Every game's week rolls over: the bucket stays in the game, and the prize goes back to the pool and is paid out with week 4's close.
- Vault week 2 (2–9 Nov) paid as normal. (Before the test week was set, games applied Wed 4 – Sun 8 Nov were to pay from vault week 3, D-062 / D-063.)

**Games on chain (12 Nov):**

| Game | State | Earns from | Free-prize switch |
|---|---|---|---|
| 1 Daily Questions | built in | always | ON from vault week 4 |
| 2 Who Signs Block X | applied | vault week 3 | ON (unset = registration) |
| 7 Producer Race | applied | vault week 3 | ON (unset = registration) |
| 6 Block Golf | announced Thu 12 Nov ~3:16 PM ET | vault week 5 if applied Sun 15 Nov 7 PM ET – Sat 21 Nov 3 PM ET | OFF |
| 9 Producer Bracket | announced Thu 12 Nov ~3:17 PM ET | as for game 6 | OFF |
| 3, 4, 5, 8, 13 | not added | — | OFF (3, 4, 8, 13) |

**Paid free prizes:** 3 games ON = 9 VHP a week, inside the 12 VHP budget. New games ship with the switch OFF (owner, 10 Nov).

## 2. Invariants — must always be true
1. **Balances never fall below total liabilities** (D-029).
2. **Every staked VHP is withdrawable at all times** (D-016).
3. **Only the vault holds player tokens** (D-016; see TOKEN_STANDARD).
4. **A withdrawals-only emergency build is always ready**, so funds can never be locked (D-021).
5. **The seed takes the first loss** (`seedFree`); accounting uses checked u128 arithmetic.
6. **A prize shortfall is cut and never owed later**; free rewards are extra and come second to stakers (D-029).
7. **A results file published as final never changes.**
8. **Won rewards never expire** ✅ (Vault chat, 11 Nov: the contract has no claim deadline; only owner announcements expire, 7 days after their notice ends). While a reward is unclaimed it counts with the house (seed plus unclaimed pots) for production, so its earnings go to the house share, not onto the claim.

## 3. Money flow
1. **Deposit:** whole VHP only; KOIN may be burned 1:1 into VHP on deposit (`deposit_to`).
2. **Earn:** the vault's VHP produces blocks as the **Knode Games Pool**. The vault address `1Mpmf2…` is the producer (D-073), run by the game node; block rewards accrue to the vault.
3. **Fee:** a flat **5%** of gross rewards, collected with `claim-fee-vhp all`. Earnings carried back from earlier weeks (`rolled_over`) are not charged again.
4. **Free prizes:** 2 + 1 VHP per week on each free game (D-062); multi-week seasons pay once at season end (D-068).
   - Every game has a Free play board, and every game is added **with** `--free`.
   - The owner's **free-prize switch** (D-082, `platform/FREE_PRIZE_SWITCH.md`) decides whether the bot posts the winners. The states are in §1.
   - The vault sets aside 3 VHP from the seed's part for **every** earning `--free` game, switch on or off (`closeV6`). With the switch OFF, that 3 VHP goes back to the pool at finalize, fee-free.
   - An unwon or held prize rolls **fee-free into the next week's pot** (`rolled_over`) and never leaves the vault ✅.
5. **Split:** the rest goes to the staked games by each game's staked weight for the week (`weightFor`).
6. **Within a game:** by the game's own rules from its results file (Race medals top 30%, Fantasy top 30%, Combo best 10 cards, Golf 7 × holes − strokes, Bracket / Last Node / Survivor by points).
7. **Claim:** `claim_game` per game and week; the site batches up to 10 claims and looks back 52 weeks.

## 4. Stakes
- **Minimum 1 VHP** per staked game ✅ (`minStake`), read from `get_state` (`min_stake`, `min_stake_next`, `min_stake_next_week`), never below 1 VHP.
  - **Staking in several games at once is allowed and encouraged** (D-074); each game needs its own 1 VHP minimum.
- **Staked** that week = `peak_stake` (or `active_stake` when there's no entry) at or above the minimum; **earning** = `week_stake` at or above it. A player staked at the week's start stays staked that week.
- **Withdraw** any amount at any time (`withdraw_from`).
  - **Game 1 (Daily Questions) uses the same calls from v6.1** (`deposit_to` / `withdraw_from` with `game: 1`). Its old `deposit_vhp` / `deposit_koin` / `withdraw` stay as aliases, and every game-1 stake is read in place from the player's own record (D-116).
- **Move** with `move_stake`. It is refused while paused; the target must be active and staked.
- Withdrawing below the minimum mid-week forfeits that week's share and free prize; the panel should say so (I-028).
- **The VHP ruler (D-162):** the vault races like every producer. A big seed top-up or withdrawal during a race can void the vault for that race (6 h: −10% / +25%; daily: −12% / +50%). Keep top-ups small, or inside those bands.

## 5. Mana sponsorship of vault calls
- The sponsor pays **stake, withdraw and claim**, never **`move_stake`** (D-027; the on-chain gap is I-021).
- Caps and per-action rows: live values in `../platform/SPONSOR.md` (D-028, D-061, D-105, D-117, D-131).
- Sponsor v3 refuses vault calls while its vault switch (`config.game_has_vault`) is off. The switch is **ON** (`SPONSOR.md` §2). Any sponsor `config` must pass the current caps exactly: a plain `config` resets them.
- The bot pays its own Mana; keep about 75 KOIN in the bot wallet (owner, 9 Nov). The bot alerts when its Mana falls below 2 KOIN.

## 6. Results files (every game; game 1 from v6.1's rule week, D-116)
**Game 1 (Daily Questions):** from the v6.1 rule week, game 1 is paid from `games-data:questions/vault/W<week>.json` and `board.json`, like every game: no settle step, no 40/60 baskets.
- The rule week is in `get_state` → `config.q60_rule_week_plus_one`: Mon 16 Nov, with the upload on Tue 10 Nov (D-130). `status` shows it as "60 from vault week 4 (stored rule 5)".
- Its rows also need **at least 2 answers that week and no more points than answers** (the contract refuses otherwise).
- The recorder applies the full rule: at least 2 counted answers and at least 1 point; free winners never staked that week.
- More than 10 tied for a free place: the 10 with the earliest first answer that week share it (D-034's shared rule).
- Weeks before the rule week keep the old path (settle, `finalize_week`, `claim`), and their rewards stay claimable.

**Where:** the game's source in `game-data/deployment.json` → `vaultGames` (`<branch>:<folder>`), file `W<week>.json` with an unpadded vault week ✅ (`bot/vault.ts` reads `origin/<branch>:<folder>/W<week>.json`).

**Shape:**
```
{"game": <id>, "week": <n>, "final": true,
 "rows":   [{"player": "<address>", "points": 1..255}],
 "first":  ["<address>", …],   // free winners, ≤ 10
 "second": ["<address>", …],   // free winners, ≤ 10
 "skipped": [ … ]}             // optional: rounds left out
```
- `rows`: staked players with ≥ 1 point, dense-ranked onto 255 … 1 (ties share).
  - **The paid set comes first (D-152):** the top 30% exactly. A tie that crosses the line is split: its wallets that reached the score first keep the line's value, and the rest take the next value down.
  - Past 255 places, the paid wallets keep values of their own above every unpaid one (I-086: the best 253 exact, the rest of the paid share 2, the unpaid share 1).
  - A week with no qualifying players may still get a file with empty rows.
- **Every game fills `first` and `second`** with its free winners, even when its free prize is off. The owner's free-prize switch decides whether the bot posts them.
- **Free-prize places (D-159, the same for every game):**
  - 1st and 2nd are each paid to **at most 10 wallets**. Wallets tied on a place share it.
  - If more than 10 qualify for the same place, **exactly 10** are paid, chosen by a deterministic tie-break: **earlier score time, then address**. A place is **never left empty because of the cap**.
  - A tie for 1st leaves 2nd empty (D-034); wallets cut by the cap get nothing.
  - Each game's file says what its "score time" is; a game that can't say stops and asks the owner (D-160).
- **No ruler shadow results (PR #265, Repo Lens #G-17):** a file, or any row in one, marked `"shadow"` with anything but `false` is refused.
  - The bot alerts at once, once per game-week, and the week rolls over at its deadline unless the real file arrives.
  - `rulerFrom` / `rulerMode` are carried in week files and not read by the vault.

**Every results file must:**
- be published **only after the week ends**, and for staked rows only after the stakes are read once the week has ended;
- be **due 3 days** after the week ends. Still unreadable then → final as missed, no file;
- be **written once**: later runs copy published weeks forward unchanged, and any change to a final file refuses the whole run;
- **fail closed**: no final file if the ABI or contract is missing, `get_state` is empty, any stake read fails, or the two nodes disagree. A read failure is never "not staked" (V4);
- pass the publish job's checks: right game id, ordered rows with points 1–255, ≤ 10 per free place, no wallet twice, canonical bytes, ≤ 2 MB, no nested folders. A failing vault file is held on its own while the game's other files still publish.

**The Race's own hold:** the Race doesn't publish HOLD/RELEASE files.
- Its recorder keeps the week pending through the review day (`WEEK_CYCLE.md`, D-125), and until the same file was seen on two runs ≥ 1 hour apart.
- It re-scores the week from the chain, and the owner can hold weeks with `RACE_HOLD_WEEKS` (I-034, PR #85, PR #133). A held week fails the run and emails (D-107).
- The vault bot can't see that owner hold; it sees only that no final file exists yet.

**Holds:** a game may publish `HOLD-W<week>.json` instead of paying (Last Node watch-and-hold, released by `LASTNODE_RELEASE_WEEKS`, D-055). Forged or unverified cards, or a stake disagreement, block that week's file (Combo).

**No file by the deadline:** the bot sends finalize with "no results: roll the week over". The game's bucket stays in the game (`g.rolled`) and joins its next earning week's bucket; its free prize returns to the pool. Nothing is stuck and nobody loses stake ✅.

**Before any game pays from its file:**
- the final file must not hinge on a single run with no hold (I-034; done for the Race, #85 / #133);
- the vault recomputes what it can from the chain, since `games-data` files can't prove their own days or stake lists (I-051);
- the vault bot honours HOLD files, verifies that every staked board player is in the file, and alerts on a refused prize post (I-052, I-064).

**Built in PR #74** (merged 4 Nov after Repo Lens #D-4 GO):
- HOLD files hold the week; an unreadable HOLD holds too.
- The results file is cross-checked against the game's `board.json`. `lastWeek` must be the vault week; every staked wallet with points must be in the file; every file wallet must be on the board, in board order. A missing, unreadable or wrong-week board holds the week.
- A refused post or seal is alerted, and that week stops without a seal and isn't retried blindly.
- A file is posted only after the identical file was read on an earlier run at least 30 minutes before. A file that changes is held for good; the owner checks it and posts it by hand (`game-post`).
- A manual `game-post` applies every check except the two-run wait.
- **So every staked game must publish `board.json` next to its vault folder** (rows with `points` and a place), or set `vaultGames.<id>.board` (I-079).
- Points themselves aren't recomputed in the bot yet (I-080).

**After the Repo Lens #D-3 fixes** (PR #74 @ `ec61bb4`, 4 Nov):
- A HOLD file holds the week unless a `RELEASE-W<week>.json` sits next to it.
- Per-game settings live in `game-data/deployment.json` → `vaultGames.<id>`:
  - `board: "none"`: skip the board check (Survivor for now);
  - `minPts`: the file's points floor (Combo 100);
  - `boardCap`: rows the board keeps (Bracket 1,000, Last Node 2,000).
- Only a chain **revert** counts as a refusal; network, Mana and "not seen in a block" are retried next run.
- A failed finalize stops the finalize loop.

## 7. Timing
- **A game applied in vault week W earns from W + 1** (`apply_game`: `from = weekOf(apply time) + 1`) ✅. A game restarted while it is still earning keeps its weeks instead (audit V6-6).
  - The apply is allowed from 48 h after the add (`timelockLength`) until 7 days after that (`ANNOUNCEMENT_EXPIRY`).
  - Results are posted for registered games only, for weeks they earn (`from_week <= w`) ✅.
- **`game-apply` guard (owner, 12 Nov):**
  - The dry run and the send both say which vault week the game would earn from, using the chain's time.
  - The bot refuses an apply inside a test week (an apply there earns from the first paid week) unless `--allow-test-week` is given.
  - It also refuses within 15 minutes before a week change, and when the node's head time is more than 5 minutes from the PC's clock (a node that is behind; Repo Lens #G-38 G38-1).
  - `admin apply_game` refuses and points to `game-apply`, so the guard can't be skipped (G38-2).
- Results are due 3/7 of a week after the week ends.
  - Finalizing starts after `seal + 2 × close_delay` and `last_change + close_delay`.
  - Corrections and voids are allowed for 24 h after each seal and refused once finalizing starts.
- **The weekly rhythm (D-125, D-129)** has one home: `WEEK_CYCLE.md`. That covers play days, the review day, when files go final and when claims open.
  - No contract change: the vault week stays Monday to Monday.
  - Sunday fun rounds never reach a vault results file.
  - Game 1 (Daily Questions) kept its own timing until v6.1's rule week (claims from about Tue 12:00–15:00 UTC, Tue 4–7 AM PST, later if Saturday's questions resolve on Monday). It is on the shared rhythm from Mon 16 Nov (D-116).
- **v6.1 (D-127):** no player action closes or finalizes a week; the bot's hourly `close_week` / `finalize_week` do.

## 8. Admin powers
| Action | Who | Safeguards |
|--------|-----|-----------|
| Add a game (`propose_game` → `apply_game`) | owner | 48 h timelock; apply within 7 days; earns from the next week; at most 12 games besides game 1; `game-apply` guard (§7) |
| Deactivate a game | owner | earns through the current week; stake stays withdrawable |
| Post / seal / finalize / correct / void results | operator (bot) | correction window; skipped in safe mode |
| Upgrade the vault | owner | 48 h notice (D-024); old builds refused (`PRE_VAULT_CODE`); a normal upgrade can't load the safe build (`upgradeGuard`) |
| Emergency: `upgrade --safe`, sponsor limit 0, pause | owner | withdrawals stay open (D-021) |
| Seed withdrawal | seed owner | 48 h timelock; paid to the current seed owner |
| Change the seed owner | seed owner | two steps, 28,800 blocks apart; cancels a pending seed withdrawal |
| Change the owner (handover 4a / 4b) | owner, then new owner | two steps, ~24 h (28,800 blocks) apart; an accept wipes a pending upgrade; postponed until after Week 1 |
| Collect the 5% fee | owner | `claim-fee-vhp all` |

## 9. Checklists
**Adding a game**
- [ ] The game meets `GAME_STANDARD.md` (audited, ready: D-064)
- [ ] `vaultGames` source set; results file produced and fail-closed as in §6
- [ ] Page shows the badge and stake panel (D-031)
- [ ] Free-prize switch **OFF** for a new game (owner, 10 Nov), checked with `npm run prizes -- list` before the add
- [ ] `game-add` with `--staked --free --season N` (every game, D-082). Note the time: the apply window runs from 48 h later for 7 days
- [x] Sponsor vault switch on (done; any `config` passes the caps exactly)
- [ ] `game-apply` (dry run first) inside the week **before** the first earning week; the guard prints "earns from vault week N"
- [ ] `npm run bot -- games` shows "from week N"
- [ ] First week's file checked final and sensible

**Upgrading the vault**
- [ ] Owner's audits pass (D-017); rehearsal on a snapshot and a public-testnet check pass
- [ ] Code fingerprint checked; build branch frozen, backup pushed (D-025)
- [x] Announce on a weekend, upload on a Monday, 48 h notice (D-023, D-024): v6.1 was announced Thu 5 Nov and uploaded Tue 10 Nov
- [x] After upload: chain-check, holdings unchanged (10 Nov: all ✔)
- [ ] Emergency path ready (D-021)
- [ ] After an upload: the next PR records the new `wasmSha256` / `safeWasmSha256` in `deployment.json`; the owner pins `safeWasmSha256` on the PC at once
