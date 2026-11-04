# Knode Games — Current State

> **Snapshot:** Tuesday 3 Nov 2026, ~20:00 UTC (12 PM PT). This file goes stale fast. Update it when something ships, and check the date before trusting it.
> **Sources:** the repo and GitHub (branches, PRs, workflow runs checked 3 Nov), `DECISIONS.md`, `OPENISSUES.md`, `TODOS.md`. Detail lives there; this is the summary. By area: `ACTIVE_WORK.md`.

## Completed systems
**On chain (Koinos mainnet)**
- **Vault v6:**
  - live since Mon 2 Nov 02:33 UTC at `1Mpmf2…`;
  - holds every stake and produces blocks as the **Knode Games Pool** (D-073);
  - the emergency withdrawals-only build is ready (D-021);
  - holdings 21,133.83 VHP vs 21,124.07 owed (3 Nov).
- **Seed:** 21,050 VHP from a dedicated seed owner wallet (D-022).
- **Mana sponsor v3:**
  - live with 25,000 KOIN;
  - caps 1 Mana per transaction, 25 a day and 150 a week per wallet, 5,000 a day in total, 2,000 a day for free players (D-061);
  - **vault switch on since 3 Nov**, caps unchanged.
- **Picks contract:** live since 30 Oct; **Block X (game 2) applied** with 1 change per pick (D-070).
- **Race picks contract** and **Swap Desk v2** (3% fee, no daily cap): live.
- **Vault game registration:**
  - game 1 (Questions) is built in;
  - **games 2 (Block X) and 7 (Race) announced 3 Nov**: tx `0x122082c6…` and `0x1220d394…`, applicable from **Thu 5 Nov 15:51 UTC**.

**Live for players**
- **Daily Questions (game 1):** five questions Mon–Sat at 12:00 UTC. Week 2 finalized and paid 3 Nov; 70 questions posted so far.
- **Producer Race (game 7):** four races a day, Staked and Free boards, status badge, **nicknames** (PR #62).
- **Who Signs Block X (game 2):**
  - **live since 3 Nov** (PRs #57–#59) on the Games page, home page and menus, with nicknames (PR #60) and a **Leaders page tab** (PR #63);
  - recorder on (`GAMES_ENABLED`);
  - prize-free until it pays from Mon 9 Nov (D-077).
- **Site:** knodegames.com on GitHub Pages: staking hub, status bars, @names, guest play, swap page, Leaders page (Questions, Race, Block X).

**Operations**
- **Bot:** hourly, plus the 11:48 UTC release run. The release is on time at 12:00 UTC, and the bot recovers on its own from node hiccups.
- **Free-prize switch (D-082):** merged 3 Nov (PR #65). It isn't in use yet: the `prize-settings` branch is created by the first ON/OFF send. Guide: `FREE_PRIZE_SWITCH.md`.
- **VHP sampler** (`race-samples.yml`, every 5 min on paper): running since 3 Nov 15:58 UTC, and a manual run ~17:15 UTC was green. How often GitHub really runs it is still being watched (I-059).
- **Three mainnet nodes** on the owner's PC (desk, game/pool, personal): self-heal every 20 min, watchdog emails, question-release backup task.
- **Two-node checks:** Armana plus `api.koinosblocks.com`, both answering (3 Nov).
- **Weekly review:** every Tuesday 10 AM PT (`WEEKLY_REVIEW.md`), with a reminder at 9:45 AM PT. First review Tue 10 Nov.

**Documentation**
- The `.ai/` library:
  - start guide, platform docs, nine game files;
  - five standards (Game, Vault, Leaderboard, Token, AI chat starter);
  - session-end and weekly-review processes;
  - all 12 chats filed;
  - 82 decisions (D-001 – D-082), no open contradictions.

## In-progress systems
| System | Where it stands | Next step |
|--------|-----------------|-----------|
| **Vault: games 2 and 7** | announced 3 Nov | **Owner — Thu 5 Nov after 7:51 AM PT:** `game-apply 2` and `game-apply 7`, then `games` must show "staked + free prize, from week 3"; then repo variable `PRIZES_FROM_WEEK = 3`. Deadline **Sun 8 Nov 4 PM PT** |
| **Free-prize switch** | merged; not used yet | **Owner:** set the starting values (`FREE_PRIZE_SWITCH.md` §4), then add the GitHub ruleset on `prize-settings` (FP-1) |
| **Site "Week 1" refresh** | Race `PRIZES_FROM_WEEK = 3` done (PR #56) | show 9 Nov as Week 1 site-wide; replace "vault not yet live" text (I-069, I-027) |
| **Survivor (3)** | branch `survivor` @ `a8a1979`, not merged | Repo Lens pass 4 → testnet season → register game 3 → Season 1 **Mon 16 Nov** (D-065). Free board stays; free prize off (D-081) |
| **Last Node Standing (13)** | branch `lastnode` @ `adf95be` | round-3 review; needs 48 h of sampler data; add a Free board **with** the 2 + 1 prize (decided, D-081); **still to decide:** how its free winners are picked (proposal in `claude/lastnode/FREE-PLAY-PROPOSAL.md`) |
| **Producer Bracket (9)** | branch `kg-09-bracket` @ `5b2492e`; **Repo Lens #E-3: fix first** (2 Critical, 6 High) | fixes (R-BR-1, R-BR-2) → fix-check → merge `main` → launch **when ready** (D-088; no 9 Nov target) |
| **Fantasy Producers (4)** | branch `fantasy` @ `2bee805`; testnet practice deployed | fix-check; a full test week; real-data simulation; add a Free board (no prize yet) |
| **Combo Card (8)** | branch `combo` @ `c8c652e` | fix-check 4; then the Picks v2 upgrade; let free players send cards (I-074) |
| **Block Golf (6)** | branch `golf` @ `6b2200a` | practice with Block X (the 3 Nov morning snapshot said Golf practice couldn't start without the sampler; `BlockGolf.md` says it waited on Block X going live — ❓ Golf chat to confirm); add a Free board (no prize yet); staked after `game-add 6` |
| **Vault bot checks** | **built, PR #74** (Vault chat, 3 Nov; GitHub checks green; not merged) | Repo Lens (prompt `claude/audit-vault-bot-checks-prompt.md`) → merge by **Fri 13 Nov**. Every staked game must publish `board.json` (I-079) |
| **Wallet moves** | seed done; **new `docs/WALLETS.md` and weekend runbook in PR #73** (not merged) | owner reviews #73 → **Fri 6 Nov:** step 0 (read-only check), create the cold-key owner (D-083) and cold treasury, start the treasury move → Sat: sweep the old operator → Sun: after every `game-apply`, start the vault and Desk handovers → Mon/Tue: accept. Picks and Race picks later (I-076, I-077) |

**Free play on every game** (D-081):
- **2 + 1 VHP free prizes:** Questions, Block X, Race, Bracket and Last Node, from Mon 9 Nov or each game's launch (D-062).
- **Free board, no prize until the owner switches it on (D-082):** Combo, Golf, Survivor, Fantasy.
- **Staked prizes:** every staked game always pays its stakers. The switch never touches them.

## Known blockers
1. **Audits still to run.** Each game launches when its audit passes (D-064):
   - Survivor pass 4;
   - Last Node round 3;
   - Bracket (first audit);
   - Fantasy fix-check;
   - Combo fix-check 4.

   ~~Block X round 12~~ passed (GO) and Block X is live.
2. **Sampler cadence (I-059).** The sampler runs, but maybe only about hourly:
   - Block X cards want 12 samples per 6 h;
   - Last Node needs 48 h of samples;
   - Combo cards are void without samples, and Fantasy pricing uses them;
   - Golf practice: the morning snapshot said it can't start without samples; ❓ Golf chat to confirm.
3. **Race prizes need two fixes first:** the vault file must not be decided by a single run with no hold (I-034), and the free-prize farming question (I-035) needs an owner decision. Block X has its own "before prizes" list (I-042).
4. **The vault bot needs its checks** before the first close with other games: honour HOLD files, verify staked lists, alert on refused prize posts (I-052, I-064), and recompute from the chain (I-051).
5. **Combo needs the Picks v2 upgrade** (D-060). Block X has launched, so this can now be planned.
6. ~~`docs/WALLETS.md` is stale~~ — rewritten in PR #73; it must be **merged before** any wallet move (I-001).

Not blocking: the main node (Armana) has short outages; the bot stops and catches up the next hour. A fallback node is on hold.

## Highest priorities
Full order and reasons: `PRIORITIES.md`.
1. **Apply games 2 and 7, Thu 5 – Sun 8 Nov** (above), so Questions, Race and Block X pay from Mon 9 Nov (D-077).
2. **Race prize fixes (I-034) and the farming decision (I-035)** before its first paid week closes (Mon 16 Nov).
3. **Review and merge PR #73 (`docs/WALLETS.md`), then the wallet moves this weekend** (I-001, I-045; D-083, D-084).
4. **Vault bot checks (PR #74): Repo Lens, then merge by Fri 13 Nov** (I-051, I-052, I-064).
5. **Site "Week 1" refresh** before Mon 9 Nov (I-069).
6. **Survivor pass 4 and testnet season** to hold the Mon 16 Nov start.
7. **Bracket fixes** after its audit (fix first; launches when ready, D-088), then the remaining audits: Last Node, Fantasy, Combo.

## Watch list
- **Thu 5 Nov 15:51 UTC:** games 2 and 7 become applicable (reminder set for 9 AM PT).
- **Tue 10 Nov ~12:07 UTC:** first Questions payout under the v5 split; free players get 1 + 1 VHP for that week (D-069). First weekly review at 10 AM PT.
- **Mon 16 Nov 12:00 UTC:** first vault close with other games in it. Check status, buckets, free prizes, the switch and the fee. Survivor Season 1 starts the same day.
- **PR #50:** **closed, not merged, and stays that way** (owner, 3 Nov). The branch is kept; useful parts are to be rebuilt (I-072, `claude/handoff-pr50-salvage.md`).
- **PR #57** (Block X launch): ~~don't merge until round 12 is GO~~. Round 12 passed and #57 merged on 3 Nov.
