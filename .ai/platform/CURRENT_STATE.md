# Knode Games — Current State

> **Snapshot:** Tuesday 3 Nov 2026, morning (Pacific). This file goes stale fast — update it when something ships, and check the date before trusting it.
> **Sources:** the repo and GitHub (branches, PRs, workflow runs checked 3 Nov), `DECISIONS.md`, `OPENISSUES.md`, `TODOS.md`. Detail lives there; this is the summary.

## Completed systems
**On chain (Koinos mainnet)**
- **Vault v6** — live since Mon 2 Nov 02:33 UTC at `1Mpmf2…`; holds every stake; produces blocks as the **Knode Games Pool** (D-073). Emergency withdrawals-only build ready (D-021). Holdings 21,133.83 vs 21,124.07 owed (3 Nov).
- **Seed** — 21,050 VHP from a dedicated seed owner wallet (D-022).
- **Mana sponsor v3** — live; 25,000 KOIN; caps 25 a day / 150 a week per wallet, 5,000 a day total (D-061). Vault switch still off.
- **Picks contract** — live since 30 Oct; **Block X (game 2) applied** with 1 change per pick (D-070).
- **Race picks contract** and **Swap Desk v2** (3% fee, no daily cap) — live.

**Live for players**
- **Daily Questions (game 1)** — five questions Mon–Sat at 12:00 UTC; Week 2 finalized and paid 3 Nov; 70 questions posted so far.
- **Producer Race (game 7)** — four races a day, Staked / Free boards, status badge.
- **Site** — knodegames.com on GitHub Pages: staking hub, status bars, @names, guest play, swap page.

**Operations**
- **Bot** — hourly (plus the 11:48 UTC release run); release on time at 12:00 UTC; recovers on its own from node hiccups.
- **Three mainnet nodes** on the owner's PC (desk, game/pool, personal), self-heal every 20 min, watchdog emails, question-release backup task.
- **Two-node checks** — Armana plus `api.koinosblocks.com`, both answering (3 Nov).

**Documentation**
- The `.ai/` library: start guide, platform docs, nine game files, four standards, all 12 chats filed; 74 decisions; no open contradictions.

## In-progress systems
| System | Where it stands | Next step |
|--------|-----------------|-----------|
| **Block X (game 2)** | applied on Picks; round 12 GO; PR #57 merged; **live on the Games page** (PR #58) and recorder on (`GAMES_ENABLED`), prize-free until it's in the vault | `game-add 2` today → apply Thu–Sun → pays from Mon 9 Nov (D-077) |
| **Vault game registration** | game 1 built in; **games 2 and 7 announced 3 Nov**, applicable Thu 5 Nov 15:51 UTC; sponsor vault switch **done** | `game-apply 2` and `7` Thu–Sun → Questions, Race and Block X pay from Mon 9 Nov (D-077) |
| **Sponsor vault switch** | **done 3 Nov** — vault live, caps unchanged | — |
| **Site "Week 1" refresh** | Race `PRIZES_FROM_WEEK = 3` done (PR #56) | show 9 Nov as Week 1 site-wide; replace "vault not yet live" text (I-069, I-027) |
| **Survivor (3)** | branch `survivor` @ `a8a1979`, not merged | Repo Lens pass 4 → testnet season → register game 3 → Season 1 **Mon 16 Nov** (D-065) |
| **Last Node Standing (13)** | branch `lastnode` @ `adf95be` | round-3 review; needs 48 h of VHP sampler data first |
| **Producer Bracket (9)** | branch `kg-09-bracket` @ `ee676ea` | Repo Lens audit (never run yet) |
| **Fantasy Producers (4)** | branch `fantasy` @ `2bee805`; testnet practice deployed | fix-check; a full test week; real-data simulation |
| **Combo Card (8)** | branch `combo` @ `c8c652e` | fix-check 4; then the Picks v2 upgrade after Block X |
| **Block Golf (6)** | branch `golf` @ `6b2200a` | practice with Block X; staked after `game-add 6` |
| **Wallet moves** | seed done | hardware-wallet owner, cold desk treasury, retire old operator key — this weekend |

Staked-only for now: Fantasy, Golf, Combo, Last Node (D-071). No free play on Combo, Golf, Survivor (D-080). Free 2 + 1 VHP prizes on Questions, Block X, Race, Bracket from Mon 9 Nov (D-062).

## Known blockers
1. **Audits not run yet.** Five games wait on Repo Lens (Block X round 12, Survivor pass 4, Last Node round 3, Bracket, Fantasy, Combo fix-check 4). Starting today. Nothing is announced until each passes (D-064).
2. ~~PR #57 must merge~~ — **merged 3 Nov.** The VHP sampler workflow (`race-samples.yml`, every 5 min) is now on `main`; its first runs hadn't started at 15:12 UTC. Last Node's 48 h of samples counts from its first good run (I-059).
   - Last Node can't launch (needs 48 h of samples),
   - Combo cards would all be void, and Fantasy pricing lacks samples (I-059),
   - Block Golf practice can't start.
3. **Race prizes need two fixes first** — the vault file must not be decided by a single run with no hold (I-034), and the free-prize farming question (I-035) needs an owner decision. Block X has its own "before prizes" list (I-042).
4. **The vault bot needs three checks** before paying other games — honour HOLD files, verify staked lists, alert on refused prize posts (I-052, I-064).
5. **Combo needs the Picks v2 upgrade**, which itself waits for Block X to launch (D-060).

Not blocking: the main node (Armana) has short outages — the bot stops and catches up next hour; a fallback node is on hold.

## Highest priorities
1. ~~Repo Lens round 12 for Block X → merge PR #57~~ — **done 3 Nov.** Next for Block X: confirm the sampler is running, announce, `game-add 2`.
2. **`game-add` the Race (7) by Fri 6 Nov 4 PM PT**, then the sponsor vault switch, then `game-apply` before Sun 8 Nov, so the Race earns and pays from Mon 9 Nov. Add Block X and any other game that has passed its audit.
3. **Race prize fixes (I-034) and the farming decision (I-035)** before its first paid week.
4. **Site "Week 1" refresh** before Mon 9 Nov (I-069).
5. **Survivor pass 4 and testnet season** to hold the Mon 16 Nov start.
6. **Wallet moves this weekend** — move the owner to a hardware wallet and the desk treasury to cold storage; move the old operator's leftover KOIN, then remove its key (I-001, I-045).
7. **Remaining audits** — Last Node, Bracket, Fantasy, Combo — each launches when it passes.

## Watch list
- **Tue 10 Nov ~12:07 UTC:** first Questions payout under the v5 split; free players get 1 + 1 VHP for that week (D-069).
- **Mon 16 Nov 12:00 UTC:** first vault close with other games in it — check status, buckets, free prizes and the fee.
- **PR #50** — **closed, not merged, and stays that way** (owner, 3 Nov); branch kept; useful parts to be rebuilt now that #57 is in (I-072, handoff `claude/handoff-pr50-salvage.md`). **PR #57** (Block X launch) — **don't merge until round 12 is GO** (owner).
