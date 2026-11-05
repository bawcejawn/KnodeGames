# Knode Games — Free-Prize Switch (how it works)

> **Purpose:** a plain-words guide to the free-prize switch: what it controls, what it never touches, how and when to use it, and the starting settings.
> **Decisions:** D-081 (every game has Free play), D-082 (the switch). **Code:** `bot/free-prizes.ts`, `bot/vault.ts` (merged 3 Nov, PR #65). **Audit:** Repo Lens 3 Nov, GO.
> **Last updated:** 5 Nov 2026 (status sync: Questions joins the shared rules at v6.1's rule week; paused games)

## 1. Three separate things
| | What it is | Who gets it | Can the switch change it? |
|---|---|---|---|
| **Free play** | Anyone can play any game free, with no stake, and rank on that game's **Free play** leaderboard | everyone without a stake in that game | **No.** Free play is always on, on every game (D-081) |
| **Free prize** | 2 VHP for 1st and 1 VHP for 2nd on a game's Free play board, each week (a 2-week season pays 4 + 2 once, at its end) | free players only | **Yes, per game.** This is the only thing the switch controls |
| **Staked prize** | The game's share of the vault's weekly rewards, split among its stakers by its rules | players with 1+ VHP staked in that game that week | **No, never.** Every staked game always pays its stakers |

So a game with its switch **OFF** still has free play and a Free play leaderboard; the free players just play for standings, not VHP. Its stakers are paid as normal.

## 2. How it works, step by step
1. **Every game is added to the vault with the free prize allowed** (`game-add <id> "<name>" --staked --free --season <n>`). The vault then sets aside 3 VHP a week for that game's free prize.
2. **Each game's recorder always works out its free winners** (1st and 2nd) and puts them in its weekly results file, whatever the switch says.
3. **After each week ends, the bot reads the switch**, then posts the results to the vault:
   - **ON:** it posts the stakers' points and the free winners. Free winners get 2 + 1 VHP.
   - **OFF:** it posts the stakers' points only. The 3 VHP that was set aside goes back into the next week's pot, without the 5% fee, and is split as usual. It never leaves the vault.
4. **Questions (game 1) is not on the switch** today: its free prize is built into the vault contract. From Vault v6.1's rule week (Mon 16 Nov, D-116) Questions is a regular vault game; **its free prize then follows the switch like every game (owner, 5 Nov, D-136)**, starting **ON**; the Vault chat confirms how the bot reads game 1 (R-VAULT-14).

## 3. The timing rules
- **A change always starts next Monday 00:00 UTC (Sunday 4 PM PT).** It never changes the week in progress or a past week. A change made on Wednesday of week 4 counts from week 5.
- **Two-week seasons (Survivor):** the season's prize pays only if the switch was ON for **both** weeks. Turning it on mid-season starts with the next season.
- **Quiet window:** nothing can be sent between **Sunday 3:30 PM and 4:30 PM PT** (Sunday 23:30 – Monday 00:30 UTC), so a slow PC clock can't put a change in the wrong week.
- **Changing your mind in the same week:** the latest change wins. The earlier one for that same next week is replaced.
- **A game you never set** follows its vault registration, which means **ON**. That's why every game gets an explicit setting (§4).

## 4. Starting settings (owner, D-081)
| Game | Id | Free play | Free prize | Staked prize |
|---|---|---|---|---|
| Daily Questions | 1 | ✅ | ✅ built into the vault (not on the switch until Mon 16 Nov; then on it, starting ON, D-136) | ✅ |
| Who Signs Block X | 2 | ✅ | ✅ **ON** | ✅ |
| Producer Race | 7 | ✅ | ✅ **ON** | ✅ |
| Producer Bracket | 9 | ✅ | ✅ **ON** | ✅ |
| Last Node Standing | 13 | ✅ | ✅ **ON** | ✅ |
| Survivor | 3 | ✅ | ⛔ **OFF** for now | ✅ |
| Fantasy Producers | 4 | ✅ | ⛔ **OFF** for now | ✅ |
| Block Golf | 6 | ✅ | ⛔ **OFF** for now | ✅ |
| Combo Card | 8 | ✅ | ⛔ **OFF** for now | ✅ |

**When to set them:** now, all eight, while no game but 2 and 7 is in the vault (the other games are paused, D-113). Setting a game that isn't in the vault yet is harmless, and it means each game starts with the right value. Avoid the Sunday quiet window.

## 5. How to use it
**Admin panel** (`npm run admin`) → **Knode Vault** → *Free prizes: which games pay them* (read only), then *Free prize ON* or *Free prize OFF* → enter the game id → **Preview** → **Write the files**.

**Or in PowerShell** (preview first; `--send` publishes):
```powershell
cd C:\kprediction
git branch --show-current
npm run prizes -- list
npm run prizes -- off 3
npm run prizes -- off 3 --send
```
- `list` shows each game for this week and next week.
- A send pushes `free-prizes.json` to the `prize-settings` branch on GitHub, with your own git login. The first send creates that branch.
- **Run it from `main`.** The `prizes` command and the panel buttons exist only on `main` (PR #65). `picks` has nothing that isn't in `main`, and your folder is on `main` since 3 Nov ✅.

**After the first send:** add the GitHub ruleset on `prize-settings` (no deletion, no force-push). Steps: Settings → Rules → Rulesets → New branch ruleset → target `prize-settings` → tick *Restrict deletions* and *Block force pushes* (Repo Lens FP-1).

## 6. What if something goes wrong
- **The bot can't read the switch** (bad file, GitHub down): it still posts the stakers' points, holds only the free winners, and emails a problem every hour. If it's still unreadable within 6 hours of the results deadline (3 days after the week), it closes the week without free winners, so the prize goes back to the pool. **Stakers never lose a week.**
- **Wrong setting:** send the right one. It counts from the next Monday. A week already under way can't be changed, by design.
- **The branch is deleted:** every game falls back to ON. That's why the ruleset blocks deletion.

## 7. Limits to know
- The switch can only **hold back** a free prize the vault allows. It can never pay more, add a winner, or touch stakers' buckets.
- **While a game is OFF, the vault still sets aside its 3 VHP a week** from the seed's part, then returns it the next week. If the seed's part were ever smaller than all the set-asides together (about 27 VHP a week with 9 games), every free prize, Questions included, would be cut in proportion. Today the seed's part is about 85–90 VHP a week, so this doesn't happen (Vault chat, 3 Nov). A later vault upgrade could make an OFF game set aside nothing.
- Anyone who can push to the repo could edit the branch. The ruleset and keeping push access to yourself are the protection.
- **Seasons and restarts:** don't change a game's season length after a gap while its old last week is still open (Repo Lens FP-6).
