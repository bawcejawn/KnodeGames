# Plan: a Block X target every hour (R-BX-25, proposed 5 Nov 2026)

> Status: **approved by the owner 5 Nov ("go ahead"), built** (PR: see §7). Asked for by the owner (5 Nov, through the
> VHP Ruler chat): *"Block X also only having blocks to chose from for every 2 hours seems slow to play."* No new
> contract: a new game entry in the same Picks contract (the owner: "I dont want a new contract").

## 1. What changes for players
- A target block every **1,200 blocks (about an hour)** instead of every 2,400 (about two hours).
- The lock stays **100 blocks (about 5 minutes) before** the target. Picks stay open about a day ahead, so **24 open
  targets** instead of 12.
- **24 targets a day** instead of 12, so 168 a week instead of 84. Sunday's 24 stay fun rounds (D-129), so 144 count
  for the week.
- Scoring per pick doesn't change: the handicap card and the points for a right pick are the same.

## 2. What the checks found

| Check | Finding | What it needs |
|---|---|---|
| **Picks contract** | The round size is part of a game's shape and can never change (`sameShape`, `Picks.ts` 431). Game 2 stays 2-hourly forever. | A **new Picks game entry** for hourly targets: `announce_game`, a 48-hour wait, then `apply_game`. Proposed id **12** (free in both Picks and the vault). |
| **The vault and the sponsor use the Picks game id as the vault game** | The sponsor reads a pick's `game` field as the vault game for its "is this a staked player?" check (`gameOfCall`, `Sponsor.ts` 394). The site's `gamesOfOps` does the same, and the recorder writes the vault file under `G.GAME_ID`. Block X's stakes are in vault game **2**. | The recorder and the page must keep **vault game 2** for the vault file and stakes, and use Picks game 12 for picks. **The sponsor** would see game 12, find no stake, and pay hourly picks from the **free pool**. Choice in §6, decision 3. |
| **Switch timing** | Weeks must not mix 2-hourly and hourly targets. | Switch only at **Monday 00:00 UTC**. Game 2's targets stop at the switch (page and recorder), and game 2 is paused on chain after its last target. |
| **Picks handover clash** | `owner-propose` and `owner-accept` refuse while an announcement waits, and the accept would throw it away. | Announce game 12 either before the handover is proposed (and applied first), or after the accept, by the new owner. See §5. |
| **Daily pick cap** | `max_picks_per_day` counts every pick call, changes included. Today it is 30 a day with one change per pick. With 24 open targets, playing every target leaves only 6 changes. The contract's hard limit is 50. | **48 a day** (every target, plus one change each). Changes per pick stay 1. |
| **Race cards** | Cards come every hour at :37 (`race.yml`), samples every 5 minutes (`race-samples.yml`, `MIN_SAMPLES` 12 in 6 h). They are still taken on Sunday (D-125, #C-7). The recorder needs a card at or before the lock, and the first card after the block, each within 3 h (`CARD_MAX_AGE_MS`). | Nothing. An hourly card already covers every hourly target, Sunday included. |
| **Mana** | Measured: a sponsored pick uses up to **0.97 Mana**. The sponsor's limit for a pick is 1.3, and caps count the limit asked for. | Per player, every target every day = 24 × 1.3 = **31.2 of the 40 a day**, which leaves room for about 7 answers. A week of every target is 218 of 250. A player who also plays everything else runs into the cap and pays the rest with their own Mana. That is the fallback the owner wants: "don't raise the daily cap". **Suggested:** lower the pick row 1.3 → **1.2** (0.97 × 1.25 = 1.21), giving 28.8 a day. **Sponsor wallet:** 25,000 KOIN, so about 5,000 Mana a day, the same as the 5,000-a-day total cap. That's about 180 players playing every target every day. The free pool (2,000 a day) is about 70 such players if hourly picks are free-pool (decision 3). |
| **Recorder** | `MAX_TARGETS_PER_RUN` 48 and the 3-day lookback (72 hourly targets) are enough for hourly runs. The week-end re-read checks 168 rows instead of 84: 4 at a time within 22 minutes. Estimate: about 4 minutes. "Two runs agree" and the prize file don't depend on the number of targets. | Make the round size come **from the week**. The recorder, the publish job's new-round check (`h == round × GROUND + GOFFSET`) and the week file all assume one round size today. Each week file gets a `game` (2 or 12), and the job checks against that game's round. A test week that crosses the switch. |
| **Scoring** | Points per right pick come from that target's handicap. Weekly totals roughly double, but every share stays the same: the board order, the free prizes (top 2) and the vault split (each player's share of the points). The 3-days rule is unchanged. | **No rescaling.** One right pick moves the week less, which rewards steady play. |
| **Page** | The list shows every open target (`offerRounds`), so 24 would show. | Show the next 6, with a "Show all 24" button, and keep the Sunday labels. The Results page groups targets by day, so it is unchanged (twice as many cards). |
| **Docs** | `docs/blockx/README.md` ("the next 12 targets"), `.ai/games/BlockX.md` ("30 picks a day"), the decisions-per-day table 12 → 24, `GAME_STANDARD.md`'s Picks settings row. | Updated in the build PR. |

## 3. The build (one PR, before any announce; Repo Lens before the announce, D-140)
1. **`blockx-math.js`:** a schedule of games, `[{ from week 0: game 2, round 2400 }, { from week W: game 12, round 1200 }]`, with `gameForWeek(w)` / `gameAt(t)`.
   - `MAINNET_GAME` gets id 12, round 1200, lead 100, ahead 28,900, 48 picks a day, 1 change.
   - The vault game stays **2** (`VAULT_GAME`).
2. **Recorder (`bot/games/blockx.ts`):**
   - It records each week with that week's game.
   - The week file gets `game`, and the vault file is always vault game 2.
   - It checks both games' on-chain settings.
   - The re-read and "two runs agree" work per week.
   - Tests: a week on game 2, the switch Monday, then a week on game 12, including Sunday fun rounds and a prize file each week.
3. **Publish job (`games.yml`):** the new-round height check uses the week file's `game` round (2 → 2400, 12 → 1200). Week files are checked to be one game each.
4. **Page (`blockx.js`):**
   - Picks go to game 12 from the switch, and game 2's targets are offered only before it.
   - "Show all 24".
   - The pick limit comes from the game.
   - **`wallet.js` / `gamesOfOps`:** a Block X pick counts for vault game 2.
5. **Picks tool:** `MAINNET_GAMES` gets game 12. The owner's steps are `announce 12` (dry run, then send), and 48 h later `apply 12`.
6. **Sponsor:** decision 3.
7. **Docs** as in §2.

## 4. What stays the same
- Week 1 (Mon 9 Nov) and the first payout (Mon 16 Nov) stay on 2-hourly targets.
- D-125 / D-129 / D-135 timing: Sunday fun rounds, final from Monday 00:00.
- Points, handicap, prizes, the vault split and the 3-days rule.

## 5. Timeline (if the owner says yes to Week 2)

| When | What |
|---|---|
| Thu 5 – Fri 6 Nov | Build + tests (this chat), then Repo Lens. |
| Sat 7 – Sun 8 Nov | Fix-check. |
| **Option A:** Mon 9 | Announce game 12 (current owner). Apply Wed 11. Then propose the Picks handover Wed 11 and accept Fri 13 or later. |
| **Option B:** Mon 9 | Propose the handover. Accept Wed 11. The new owner announces game 12 Wed 11 and applies it Fri 13. |
| **Mon 16 Nov 00:00 UTC** | Hourly targets start (Week 2). Game 2's last target is Sun 15 Nov. Pause game 2 after it. |

Either option is ready by Mon 16. **Option A** keeps the new owner's first job simple. **Option B** keeps today's key out of new announcements.

## 6. Decisions for the owner
1. **Start week:** Mon 16 Nov (Week 2), or Mon 23 Nov for more slack?
2. **Game 2 stops at the switch** (recommended), or runs alongside game 12 for a week? Both at once means two pick lists and two boards in one week.
3. **The sponsor and stakes for hourly picks:**
   - **(a)** pay them from the free pool (no sponsor change; stakers share the free pool for Block X picks); or
   - **(b)** a sponsor update that maps Picks game 12 to vault game 2, so stakers keep their own budget (a contract upload plus Repo Lens; can go in the next sponsor version, R-BX-5).

   Recommended: (a) now, (b) in the next sponsor version.
4. **Daily pick cap:** 48 (every target plus one change each), or something else up to 50?
5. **The pick Mana limit:** lower it 1.3 → 1.2 (a sponsor config send by the owner)?
6. **Handover order:** Option A or Option B (§5)?

## 7. What was decided (5 Nov; the owner said "go ahead" without picking, so the recommended options)
1. **Start:** Mon 16 Nov 2026 00:00 UTC (Week 2). Week 1 and its payout stay every 2 hours.
2. **Game 2 stops at the switch:** the page offers its targets only before it (10 minutes clear), the recorder records a
   game-2 target only if its block lands before Mon 16 00:00, and game 12's only from then. Pause game 2 on chain after
   its last target (optional; nothing records it anyway).
3. **The sponsor:** (a), no change. Hourly picks are paid from the free pool (stakers too). A mapping of Picks game 12 to
   vault game 2 goes into the next sponsor version (R-BX-5).
4. **Daily cap 48**, one change per pick.
5. **The pick Mana row stays 1.3** for now (lowering it to 1.2 is an optional config send).
6. **Handover order A:** after Repo Lens's GO, `announce 12` with today's owner key (by Mon 9), `apply 12` 48 h later;
   then the Picks handover (propose after the apply, accept 48 h later). Game 12 must be applied before Mon 16 00:00:
   the recorder refuses to record a game that isn't on the contract once its weeks have started.
