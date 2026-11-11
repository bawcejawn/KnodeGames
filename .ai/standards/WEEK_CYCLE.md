# Knode Games — Week Cycle Standard

> **Purpose:** the **one home** for how every game's week runs: when play opens and closes, the Sunday review day, when results go final, when rewards can be claimed, and how prizes are shared. Game files, chat starters and other standards **point here and don't copy these times** (D-134).
> **Decisions behind it:** D-125 (play Mon–Sat, Sunday review), D-129 (Sunday fun rounds), D-116 (Daily Questions joins from Vault v6.1's rule week), D-127 (the bot closes weeks), D-063 (week labels), D-062 / D-081 / D-082 (free prizes).
> **Last updated:** 2026-11-05 (first written, from `GAME_STANDARD.md` §4, D-125, D-129 and the Block X chat's proposal)
> **Change rule:** a change to the cycle is an owner decision (D-xxx) and is made **here first**, then in the games' code, in the same PR or the next one.

## 1. The clock
- **All times are UTC.** Pacific times are shown as a help only: PST is UTC − 8 (until 14 Mar 2027), PDT UTC − 7.
- **Vault week 0** started **Mon 19 Oct 2026, 00:00 UTC**. Vault week = floor((time − that start) ÷ 7 days).
- Players see **vault week 3 (Mon 9 Nov 2026) as "Week 1"** (D-063). Site label = vault week − 2.
- A week is Monday 00:00 → next Monday 00:00 UTC (Sunday 4 PM → Sunday 4 PM PST).

## 2. The cycle (every game)

| Step | When (UTC) | Pacific (PST) | What happens |
|---|---|---|---|
| **Play** | Mon 00:00 → Sat 24:00 | Sun 4 PM → Sat 4 PM | Rounds, races, targets and picks that count for the week. Picks open ahead and lock **on chain** at each round's own lock (D-059). |
| **Review day** | Sun 00:00 → Mon 00:00 | Sat 4 PM → Sun 4 PM | Nothing scores for the week. The recorder settles the week, re-checks it on chain on **both nodes**, and publishes it as **pending**. The owner can look and hold it. |
| **Sunday fun rounds** | Sunday | Sat 4 PM → Sun 4 PM | Games stay playable (D-129). Sunday rounds are played and scored, and count on the **Today** and **All time** boards only: never the week's board, medals, prizes, staked shares or vault file. The page labels them "Today and All time, not the week". |
| **Final** | **no earlier than Mon 00:00** | Sun 4 PM | Once two runs an hour apart agree and the chain still matches. |
| **Vault close and payout** | Monday: the vault bot posts results and seals; **+ 24 h** correction window | claims about **Mon 6–8 PM** | The bot closes weeks; no player action closes one (D-127). Later if a game is held. |
| **Backstop** | **Thu 00:00** | Wed 4 PM | A week still held rolls over: it pays nothing more for that week. |

**Other rules of the cycle**
- **Only scoring stops on Sunday.** Data that other games read keeps running: Race handicap cards (Block X needs a card up to 3 h after each target block), VHP samples, ruler hours.
- **Multi-week seasons** rest on their Sundays too.
- **A stake** counts from the **next** week, in every game (a stake made on the review day counts from the next Monday).
- **A Sunday round is recorded like any round**; every weekly tally (board, medals, vault file, the publish job's recompute) leaves it out.
- **Page line (required):** "Sunday is review day: results are checked and paid from Monday."
- **A new game** earns from the vault week after its `game-apply` (`GO_LIVE_CHECKLIST.md` → "The timing rule").

## 3. Rewards (every game)
- **Fee:** a flat **5%** of the week's vault rewards.
- **Free play prizes:** **2 VHP for 1st, 1 VHP for 2nd** each week (D-062), only on games whose free-prize switch is ON (D-081, D-082; a change counts from the next week). Ties: a tie for 1st shares all 3 VHP and 2nd stays empty (D-034). **Each place pays up to 10 wallets; if more than 10 qualify, exactly 10 are paid, by earlier score time, then address; a place is never left empty because of the cap; wallets cut by the cap get nothing (D-159).**
- **Season games:** 4 + 2 VHP for the season, when their free prize is on.
- **Staked play:** the rest of the week's rewards is split across the staked games **by each game's share of the stake**, then inside a game by its results file (`VAULT_STANDARD.md` §6).
- **Who gets paid in a staked game (D-152, every game):** exactly the **top 30%** of the game's earning stakers with at least 1 point (by headcount, rounded up). Tied wallets above the line share their level, which leaves less for the levels below. A tie that crosses the line lets in the wallets that **reached that score first** (the time of their last scoring pick or answer that week, then the address); the rest of the tie gets nothing that week. (Daily Questions keeps "the whole tie at the line" until a vault upgrade, R-VAULT-20.)
- **Boards:** every game has a Staked board and a Free play board (`LEADERBOARD_STANDARD.md`). The results file always fills `first` / `second`; the switch decides whether they're paid.

## 4. Compliance table (one row per game)
A game's chat adds or updates its row **in its first PR** and whenever its timing changes.

| Game (id) | On the cycle | Sunday | Goes final | Claims | PR / exception | To do |
|---|---|---|---|---|---|---|
| Daily Questions (1) | **from Mon 16 Nov** (Vault v6.1 rule week, D-116, D-130) | today: Saturday's windows resolve on Sunday's blocks | today: Tue ~12:00 | today: Tue 12:00–15:00 UTC, Tue 4–7 AM PST | own timing until the rule week; #114 (vault), #152 (page, bot) | Questions chat confirms the Sunday shape from Mon 16 (R-Q-4) |
| Who Signs Block X (2) | **yes** (from Week 1, #160, #175) | fun rounds (Today and All time only), first **Sun 15 Nov** | **Mon 00:00** + two runs an hour apart + the re-read (D-135, #175) | Mon evening PT | #159, #160, #175 | none |
| Producer Race (7) | **yes** (#149) | fun races, unscored for the week (D-129, #155) | Mon 00:00 + checks (00:37 final run) | Mon 6–8 PM PT | #149, #155 | none |
| Survivor (3) | ⏸ paused (D-113) | must rest on Sundays | built as 12 h after | — | branch `survivor` | adopt before launch (R-ALL-8) |
| Fantasy (4, 5) | **yes**, on branch `fantasy` (▶ reactivated 5 Nov, D-142; not launched) | fun round: the Saturday team plays on (D-150), Today and All time only | **Mon 00:00 + two runs ≥ 1 h apart agree + the week re-checked from the chain** | Mon evening PT | branch `fantasy`, PR #188 | none for the cycle |
| Block Golf (6) | **yes**, on branch `golf-v2` (▶ reactivated 5 Nov, D-142; not launched) | no rounds of its own; each hole is a game's weekly board, which already leaves Sunday out | Mon 00:00 + every hole final + two matching runs ≥ 1 h apart; waits on its slowest hole (Questions: Tue ~12:00 until its rule week, Mon 16 Nov) | about 24 h after the seal (≈ Wed morning PT while it waits on Questions) | branch `golf-v2`, PR #187 (D-138, D-142) | owner merges; launch steps in `docs/GOLF.md` |
| Combo Card (8) | ⏸ paused | — | built as 12 h after | — | branch `combo` | adopt before launch |
| Producer Bracket (9) | **yes**, on branch `kg-09-bracket` (▶ reactivated 5 Nov, D-142; built to D-141 / D-153; not launched) | review day: every hour re-read in a later run, results pending; **Sunday 00:00 seeding opens next week's picks** (lock Mon 23:55); no Sunday rounds (a knockout: the final is Saturday) | **Mon 00:00 + checks** (results in, every hour re-read, end-of-week stakes read on both nodes); backstop Thu 00:00 → closed without a file | Mon evening PT | branch `kg-09-bracket`, PR #186 (Repo Lens #E-3 fixes + D-141) | fix-check; Sunday fun rounds: none (owner to confirm) |
| Last Node Standing (13) | ⏸ paused | — | built as 12 h after | — | branch `lastnode` | adopt before launch |

## 5. Checking a game against this page
1. Its page shows the Sunday line and offers Sunday picks only as fun rounds.
2. Its recorder publishes the week as pending on Sunday, final no earlier than Monday 00:00, after two agreeing runs.
3. Its weekly tallies (board, medals, vault file) leave out Sunday rounds; tests prove it.
4. Its row above is filled in and true.
