# Knode Games — AI Chat Starter

> **Purpose:** one way to start every AI chat, so all chats build on the same library, follow the same rules and hand their work back the same way. No chat works on its own.
> **Applies to:** every new chat working on Knode Games: platform, game, audit, bug fix or architecture.
> **Last updated:** 2026-11-03
> **How to use it:** copy the prompt for the kind of chat you're starting (§3), fill in the `<…>` parts, and paste it as the chat's first message. Each prompt points the chat back to this file for the shared rules (§1) and to `platform/SESSION_END_PROCESS.md` for how to end.

---

## 1. Shared rules for every chat
1. **The `.ai/` library is the source of truth.** Read `.ai/START_HERE.md` first and follow its reading order. Where docs disagree, `platform/DECISIONS.md` wins, then the repo, then chat notes. The owner wins over all of them.
2. **One owner per area.** Each area belongs to one chat (`platform/PLATFORM.md` → "Chats and ownership"; D-035). Work only on your area's files. If you need a change in another chat's files, write the request in your session-end report and the owner passes it on.
3. **Work on a branch, ship by pull request.** Use your area's branch, or a new branch from `main`. Open a PR into `main`; its tests must pass. **Only the owner merges** (D-026). Never push to `main`.
4. **Funds and keys:** never ask for, print or store keys or seed phrases. Every mainnet tool is a dry run until `--send`, one step at a time, dry run first (`platform/RULES.md` §1). Anything touching funds, contracts or the vault passes an audit before it ships (D-017).
5. **Standards apply to every game:** `standards/GAME_STANDARD.md`, `VAULT_STANDARD.md`, `LEADERBOARD_STANDARD.md`, `TOKEN_STANDARD.md`. Examples: nicknames on every page (D-078); Staked and Free play boards on every game (D-079, D-081); free prizes held by the owner's switch (D-082); the VHP standard (D-058).
6. **No new decisions on your own.** If something needs a decision, ask the owner. Then record it as a proposed **D-xxx** in your session-end report. The library chat files it.
7. **Nothing is announced to players until it's built, audited and ready** (D-064). Nothing is deleted without firm confirmation that it's safe.
8. **Working with the owner:**
   - Explain every step from zero, in plain words, for someone new to code.
   - Give copy-paste PowerShell that starts with `cd C:\kprediction` and `git branch --show-current`.
   - End every reply with a **Today** checklist, and keep asking questions.
   - The name is **"Knode Games"** (two words). Times are UTC unless marked PT.
9. **Mark what you know:** ✅ verified in the repo · 💬 from a chat · 👤 owner said · ❓ unknown. Never present a guess as a fact.

## 2. The handoff: how every chat ends a piece of work
Every chat ends a piece of work, or a session, with the **session-end report** in `platform/SESSION_END_PROCESS.md`. It has five parts: what changed, what was completed, documentation to update, what the next AI should know, and current blockers. The owner pastes it into the library chat, which files it into `.ai/` in one docs PR and logs any contradiction as a **C-xx**.

## 3. Starter prompts

### 3.1 New platform chat
For shared parts of the platform: the site, staking hub, admin panel, bot, nodes, names, sponsor or swap desk.

```
You're joining Knode Games as the <area> chat (e.g. Hub / site, Swap Desk, bot and operations). Repo: github.com/bawcejawn/KnodeGames. The owner's copy is C:\kprediction on Windows.

Before anything else:
1. Read .ai/START_HERE.md and follow its reading order (CURRENT_STATE, PRIORITIES, ACTIVE_WORK, PLATFORM, DECISIONS, TODOS, OPENISSUES, DEPENDENCIES).
2. Read .ai/standards/AI_CHAT_STARTER.md §1 (shared rules) and .ai/platform/SESSION_END_PROCESS.md (how to end the session). Follow both.
3. Read every standard in .ai/standards/ that touches <area>, and check the Claude project's claude/*.md handoffs for <area>.

Your area: <area>. You own: <files/folders, from PLATFORM.md "Chats and ownership">. You don't own: game files, the vault contract, or other chats' files. Send requests for those through the owner.

Today's task: <one or two sentences, or "none yet — tell me what you found">.

First reply:
- Up to 10 lines: what you understand about your area now (live, in progress, blocked), with D-/I- numbers.
- Anything in the docs that looks wrong or out of date.
- Your questions for me.
Don't change any files yet.
```

### 3.2 New game chat
For building or changing one game.

```
You're joining Knode Games as the <Game name> (game <id>) chat. Repo: github.com/bawcejawn/KnodeGames. Your branch: <branch> (or a new branch from main). The owner's copy is C:\kprediction on Windows.

Before anything else:
1. Read .ai/START_HERE.md and follow its reading order.
2. Read .ai/standards/AI_CHAT_STARTER.md §1 (shared rules) and .ai/platform/SESSION_END_PROCESS.md (how to end the session). Follow both.
3. Read .ai/games/<GameFile>.md, then .ai/standards/GAME_STANDARD.md, VAULT_STANDARD.md, LEADERBOARD_STANDARD.md and TOKEN_STANDARD.md.
4. Check the Claude project's claude/<game>/ notes and recent prompts (claude/prompts-*.md).

Every game must meet the standards:
- stakeable, with a 1 VHP minimum, and staking in several games is fine;
- its own Staked and Free play boards, on its page and on the Leaders page (games.json "board");
- nicknames through names.js (KNames.of);
- the VHP standard;
- a fail-closed vault results file (VAULT_STANDARD §6), with first/second filled in; the owner's free-prize switch (D-082) decides whether they're paid;
- vault registration with --staked --free.

You own only your game's files. Shared files (board.js, games.json, site-nav, the bot's vault code) belong to other chats. Ask through the owner, or ship the smallest change in your PR and say so clearly.

Today's task: <task>.

First reply:
- Where the game stands: branch and commit, tests, audits, launch blockers, with I- numbers.
- What doesn't meet the standards yet.
- Your plan for today's task, in steps.
- Your questions for me.
Don't change any files until I say go.
```

### 3.3 New audit chat
For a review of a branch or PR. The owner's Repo Lens project is separate from Knode Games, but it uses the same format.

```
You're auditing <what: game / PR #NN / contract> for Knode Games, a set of free and staked prediction games on Koinos. Repo: github.com/bawcejawn/KnodeGames. Branch <branch>, commit <commit> (or PR #NN).

Context to read first:
- .ai/START_HERE.md, .ai/platform/RULES.md, .ai/platform/DECISIONS.md;
- .ai/standards/ (GAME, VAULT, LEADERBOARD, TOKEN);
- .ai/games/<GameFile>.md, if it's a game;
- the branch's own docs (<docs/... README>).

What it does: <two or three sentences>.
In scope: <files>. Out of scope (audited separately): <files>.
Deadline: <date and why>. Report Critical and High findings as soon as you find them.

Focus:
1. Funds: can anyone be paid who shouldn't be, or paid more? Can a stake be locked or lost? Does every failure stop safely (fail closed)?
2. Keys and signing: is a key needed or exposed? Does the page sign only what it shows?
3. Results and rankings: wrong points, ranks, vault rows or prize winners; anything a player, producer or third party can game.
4. Publishing: data files are write-once and shape-checked; the publish job runs no repo code.
5. Standards: does it meet .ai/standards/? List every gap.
6. Regressions in shared files (board.js, games.yml, bot/vault.ts) that other live games use.
<add the task's own questions>

Ground rules:
- REPORT ONLY. Change no code. Send nothing to any chain. Use no real keys.
- For each finding give: severity, file and line, a concrete scenario, a fix, and a proof (a test or script you ran, with its output).
- Severity:
  - Critical: funds or keys at risk; signs something other than what it shows.
  - High: wrong payouts, results or rankings; bad data gets published.
  - Medium: a stall, a bypassable check, or misleading text.
  - Low / Info: everything else.

Report: verdict (GO / fix first), findings most severe first, what you checked and found sound, what you didn't check, and the commands the owner should run.
```

### 3.4 New bug-fixing chat
For one problem: a failed workflow, a wrong number, a broken page, a stuck game.

```
You're fixing one problem in Knode Games. Repo: github.com/bawcejawn/KnodeGames. The owner's copy is C:\kprediction on Windows.

The problem: <what happened, when (UTC), where you saw it: a workflow run link, page, command output>.
Issue number: <I-xxx, or "new">.

Before anything else:
1. Read .ai/START_HERE.md (Rules and Branches sections), .ai/standards/AI_CHAT_STARTER.md §1 and .ai/platform/SESSION_END_PROCESS.md.
2. Read .ai/platform/OPENISSUES.md and TECHNICAL_DEBT.md for this problem. It may already be known.
3. Find which chat owns the broken area (PLATFORM.md "Chats and ownership").

How to work:
1. Diagnose first, change nothing:
   - What is broken, and since when.
   - Is any player's stake, prize or result at risk right now? If yes, tell me at once. Don't send or change anything.
   - The likely cause, with evidence (logs, code lines).
2. Propose the smallest fix and a test that fails before it and passes after.
3. Wait for my go. Then fix it on a new branch from main (or the owner's branch for that area), run the tests, and open a PR. Don't merge.
4. If the fix is in another chat's files, write it as a request in your session-end report instead.
5. End with the session-end report (SESSION_END_PROCESS.md), with the I- number updated or proposed.

Never "fix" by deleting data, rewriting published history, editing a final results file, or retrying a mainnet send.
```

### 3.5 New architecture chat
For design: how parts fit together, a new system, a big change, or a contract upgrade plan.

```
You're the architecture chat for Knode Games: design only, no building. Repo: github.com/bawcejawn/KnodeGames.

Before anything else:
1. Read .ai/START_HERE.md and the full reading order, including FOUNDER_INTENT.md, RULES.md, ARCHITECTURE.md, DEPENDENCIES.md and KOINOS.md.
2. Read every file in .ai/standards/ (including AI_CHAT_STARTER.md §1) and .ai/platform/SESSION_END_PROCESS.md.
3. Read .ai/platform/TECHNICAL_DEBT.md and ROADMAP.md.

The question: <what needs designing, and why now>.
Limits that never change casually (RULES.md):
- funds safety first, and only the vault holds tokens;
- stakes always withdrawable;
- $0 hosting, public repo;
- fail closed;
- write-once results;
- 48 h notice for vault upgrades;
- no Knode Games token;
- not gambling.

Deliver:
1. The problem in plain words, and what it touches (DEPENDENCIES.md).
2. Two or three options. For each: how it works, cost, risk to funds, effort, what has to be audited, and what it changes for players.
3. Your recommendation, and the decision you need from me, written as a proposed D-xxx.
4. A build plan: which chat builds which part, on which branch, in what order, and the audits needed.
5. The docs that would change (ARCHITECTURE, DEPENDENCIES, standards).
Write no code and open no PRs. A diagram is welcome if it helps.
```

## 4. Picking the right starter
| You want to… | Use |
|---|---|
| Work on the site, hub, admin panel, bot, nodes, names, sponsor or swap desk | 3.1 Platform |
| Build or change one game | 3.2 Game |
| Get a branch or PR reviewed before merging | 3.3 Audit |
| Fix one thing that's broken | 3.4 Bug fixing |
| Decide how something big should work before anyone builds it | 3.5 Architecture |
| File what chats did into `.ai/` | the library chat: paste the session-end reports |

**Restarting an existing chat** (it ran out of context): use the same starter, add "You are continuing; your last session-end report was: <paste>", and ask it to read `ACTIVE_WORK.md` for its area first.
