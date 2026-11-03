# Knode Games — Weekly Review

> **Purpose:** once a week, check where everything stands, catch problems early, and reset priorities. This keeps all chats pointed the same way.
> **Who:** the owner with the library chat. Game and platform chats send their session-end reports (`SESSION_END_PROCESS.md`) before it.
> **Last updated:** 2026-11-03

## When
**Every Tuesday, 10:00 AM PT (18:00 UTC), about 30 minutes.** By then:
- the week has closed (Monday 00:00 UTC);
- the vault has closed the week and results files are due;
- the Questions payout has run (Tue about 12:07 UTC).

So the review sees the whole finished week. The first review is **Tue 10 Nov**. The first close with other games is Mon 16 Nov, so **Tue 17 Nov** is the first full one.

## Before the review (owner, 5 minutes)
Run these read-only checks. They change nothing.

```powershell
cd C:\kprediction
git branch --show-current
git pull
npm run bot -- status
npm run bot -- games
npm run sponsor -- status
npm run desk -- status
```

Then paste the output, plus any session-end reports from the week, into the library chat with: **"Weekly review for week <n>."**

## The review: six areas
For each area, give one line per item: ✅ on track · ⚠️ at risk · ⛔ blocked, with D-/I-/PR numbers.

| # | Area | Check | Where to look |
|---|------|-------|---------------|
| 1 | **Platform progress** | Site, bot, nodes, sponsor, names, admin panel: what shipped, what broke. Count workflow failures this week and say whether each recovered. Did the 12:00 UTC question release run every day? | GitHub Actions runs, `bot status`, merged PRs, `ACTIVE_WORK.md` → Platform |
| 2 | **Game progress** | Each game: live / on a branch / in audit / blocked. Audits passed or failed, testnet runs, launch dates (Survivor Mon 16 Nov). Does every live game meet the standards (both boards, nicknames, Leaders entry)? | `games/*.md`, open PRs, session-end reports |
| 3 | **Vault status** | Holdings ≥ liabilities. Games registered and applied, and from which week. Last week closed and each game's week sealed and finalized. Any HOLD files. Seed size. Pending timelocks (`game-add` / `game-apply` deadlines). Emergency build still ready. | `bot games`, `bot status`, `VAULT_STANDARD.md` |
| 4 | **Reward system progress** | Last week paid as planned: the fee taken, free prizes 2 + 1 per game, and the free-prize switch (D-082) matched what you set. Stakers' buckets claimed. Any prize cut or rolled over, and why. Sponsor use against its caps (5,000 a day), and KOIN left in the sponsor. | `bot games`, `sponsor status`, results files, `RULES.md` §4 |
| 5 | **Open blockers** | Every P1 and P2 in `OPENISSUES.md`: still open? Who owns it, and the next date. Anything new from the week's reports. | `OPENISSUES.md`, `TECHNICAL_DEBT.md`, reports |
| 6 | **Priority shifts** | Compared with last week: what moved up or down, and why. Anything to stop or pause. Progress against the targets (D-076: 1,000,000+ VHP in the pool; the sponsor outgrowing itself). | `PRIORITIES.md`, `FOUNDER_INTENT.md` |

## Output
1. **A dated entry in `platform/reviews/<yyyy-mm-dd>.md`** (below).
2. **Updates in the same docs PR:**
   - `CURRENT_STATE.md` (new snapshot date);
   - `ACTIVE_WORK.md`;
   - `PRIORITIES.md` (if anything shifted);
   - `OPENISSUES.md` and `TODOS.md` (closed and new items);
   - new D-xxx for any decision the owner made.
3. **A short "This week" list for the owner**, with dates. Also any prompts to send to chats.

```
WEEKLY REVIEW — week <n> (<Mon dd Mon> – <Mon dd Mon>) — reviewed <date>
1. Platform:   <✅/⚠️/⛔ one line each>
2. Games:      <one line per game>
3. Vault:      holdings <x> vs owed <y>; games applied <ids>; week <n> closed / sealed / finalized; HOLDs <none>
4. Rewards:    fee <x> VHP; free prizes paid <games>; held by the switch <games>; cuts <none>; sponsor <x> of 5,000 a day max, <x> KOIN left
5. Blockers:   <I-xxx — owner — next date>
6. Priorities: <what moved and why>; targets: <VHP in the pool>
Decisions this week: <D-xxx, or none>
This week (owner): <checklist with dates>
```

## Rules
- **Read only.** The review sends nothing. Any fix or send comes after, as its own step, dry run first.
- **Facts from the checks, not memory.** Anything not checked this week is marked ❓.
- **A ⛔ in Vault or Rewards** (holdings below what's owed, a wrong payout, a stuck week) is handled first, before the rest of the review: `platform/RULES.md`, `standards/VAULT_STANDARD.md` §8.
