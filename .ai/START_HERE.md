# Start Here — Onboarding to Knode Games

> For any AI (or person) joining the project. Read this first, then follow the reading order.
> **Where this lives:** every file named below is in the **`.ai/`** folder at the root of the repo (this file is `.ai/START_HERE.md`). Paths like `platform/RULES.md` mean `.ai/platform/RULES.md`.

## What Knode Games is
Free and staked prediction games on the Koinos blockchain, powered by our own block-producing nodes. Players pick producers, blocks and races; correct calls climb a weekly leaderboard for each game. All staked VHP sits in one vault, which produces blocks as the Knode Games Pool. Each week's rewards, after a flat 5% fee, pay free-game prizes (2 VHP / 1 VHP) and are split across the staked games. **Funds safety comes first:** only the vault holds tokens, and stakes are always withdrawable.

- Site: https://knodegames.com · Repo: `github.com/bawcejawn/KnodeGames` (public; old names `Knode` and `kprediction` still redirect).
- The owner's copy of the repo is **`C:\kprediction`** on their Windows PC — it holds the keys (`.env`) and runs the tools. Other chats share that folder.
- The owner works in finance and is new to running code.
- **Times are UTC unless marked PT.** The owner is in Pacific time; game weeks run Monday 00:00 to Monday 00:00 UTC.

## Where knowledge lives
1. **This `.ai/` library** — the source of truth.
2. **Handoff notes in the KnodeGames Claude project** (`claude/*.md`, e.g. `claude/handoff-sponsor-v6-day.md`) — detailed instructions chats leave for each other. Check them for anything about your game or task.
3. **The repo's own `docs/`** — runbooks for the code (e.g. `docs/UPGRADE-V6.md`, `docs/blockx/MAINNET-LAUNCH.md`). If they disagree with `.ai/`, `.ai/` wins — log it.

**When sources disagree:** the owner's own words → `DECISIONS.md` → what's verified in the code or on chain (✅) → the other `.ai/` files → the repo's `docs/` → chat notes and handoffs (D-002). Log a C-xx and fix the lower source.

## Branches and how work ships
- **`main`** is the live site; the bot also commits game data there. **Never push code to `main` yourself.**
- **Your work goes on a branch**: your game's branch (`survivor`, `fantasy`, `golf`, `kg-09-bracket`, `combo`, `lastnode`), or a new branch from `main` for site or docs fixes.
- **To ship: open a pull request into `main`. Its tests must pass. The owner merges it** — that is the "explicit OK". Tell the owner what changed in plain words.
- **Which branch the owner's folder is on:** it was normally **`picks`**. Since 3 Nov all of `picks` is in `main` (PR #57), and newer tools (the free-prize switch, `npm run prizes`) are only on `main`, so the owner's folder should now run from **`main`** (❓ owner to confirm). Always `git pull` first. If `git branch --show-current` prints something unexpected, stop and ask.
- **Tests:** `npm run test:audit` (built for Linux; many tests skip or fail on Windows by design). Site tests: `node --test tests/audit/site.*.test.mjs`.

## Reading order
0. **Your work list:** your chat's section of **`platform/CHAT_REQUESTS.md`** (D-089). Every session starts there.
1. **`platform/CURRENT_STATE.md`** — what's done, in progress, blocked and next, as of its date; then **`platform/PRIORITIES.md`** — what matters most. **`platform/ACTIVE_WORK.md`** splits the current work by area (platform, games, vault, leaderboards, rewards, swap desk).
2. **`platform/PLATFORM.md`** — the one-page picture: games, contracts, money, wallets, branches, who owns what.
3. **`platform/DECISIONS.md`** — every decision (D-xxx). **This file wins** if anything disagrees.
4. **`platform/TODOS.md`** and **`platform/OPENISSUES.md`** — what's happening now and what's broken or waiting.
5. **`platform/DEPENDENCIES.md`** — how the vault, games, leaderboards, rewards, wallets and swap desk connect.
6. **The game you're working on** — `games/<Game>.md`.
7. **The standards that apply** — `standards/GAME_STANDARD.md` first, then `VAULT_STANDARD.md`, `LEADERBOARD_STANDARD.md`, `TOKEN_STANDARD.md`. How every chat starts and hands work back: `standards/AI_CHAT_STARTER.md`. Building or fixing a game's recorder: `standards/RECORDER_STANDARD.md`. Launching a game: `standards/GO_LIVE_CHECKLIST.md`.
8. **Before any big decision:** `platform/FOUNDER_INTENT.md` (why this exists) and `platform/RULES.md` (what never changes casually).
9. **Before touching prizes:** `platform/FREE_PRIZE_SWITCH.md` (free play vs free prizes vs staked prizes). **Before planning work:** `platform/TECHNICAL_DEBT.md` (risks and shortcuts) and `platform/DOCUMENTATION_GAPS.md` (what the library still lacks, with the action plan).
10. **Only when needed:** `platform/ARCHITECTURE.md` (how things work in detail), `platform/KOINOS.md` (chain facts, testnet), `platform/ROADMAP.md` (plans), `platform/VISION.md` (why and brand).

Don't read `archive/CHAT_KNOWLEDGE.md` to learn the project — it's an inbox of raw chat exports, already filed into the files above.

## Rules you must follow
The full list — including what must never change casually — is in **`platform/RULES.md`**. The essentials:
- **Never ask for, print, store or handle private keys or seed phrases.** Keys live only in the owner's `.env`. If one is pasted, tell the owner to rotate it.
- **Never push to `main`, merge, deploy, upload a contract or change chain settings without the owner's explicit OK.**
- **Every mainnet tool is a dry run unless you add `--send`.** Always show the owner the dry run first, then the send — one step at a time. The Picks tool (`npm run picks`) also needs `--mainnet` (and `CONFIRM_MAINNET=yes` in `.env`); the bot, desk and sponsor tools (`npm run bot | desk | sponsor`) need only `--send`.
- **Check the node in the dry run.** If it says `api.koinos.io`, set `$env:RPC = "https://koinos.armana.io"` in that PowerShell window first (that node has been unreliable).
- **Emergencies** (a bad send, a stuck game, a node down, a leaked key): send nothing more, tell the owner at once, and follow **`platform/RUNBOOK.md`**. Tools that exist: `npm run bot -- game-stop <id> --send` stops one game (players keep their stake); the vault's emergency path is in `standards/VAULT_STANDARD.md` §8 and `docs/UPGRADE-V6.md` ("If something goes wrong").
- **Don't delete anything** (files, folders, branches) without firm confirmation that it's safe.
- **Nothing is announced to players until it's built, audited and ready** (D-064).
- **Never mention Chainge.** Vortex is the bridge.
- Each game's files belong to one chat; send requests for another chat's files through the owner.

## How to work with the owner
- Explain every step as if to someone with no prior knowledge; say what to expect.
- Give **copy-paste PowerShell blocks** that start with `cd C:\kprediction` and include `git branch --show-current` (several chats share that folder).
- End with a **"Today" checklist** they can tick off, and keep asking questions.
- Use plain language; the platform name is **"Knode Games"** (two words).

## How to keep these docs current
- Facts go in the right file; decisions get a new **D-xxx** in `DECISIONS.md` (never delete — mark old ones superseded).
- Problems get an **I-xxx** in `OPENISSUES.md`; owner actions go in `TODOS.md`.
- If two sources disagree, log a **C-xx** contradiction in `DECISIONS.md` and follow the order above (D-002).
- Mark what you know: ✅ verified in the repo · 💬 from a chat · 👤 owner said · ❓ unknown.
- **Before a session ends**, follow `platform/SESSION_END_PROCESS.md`: write the five-part session-end report; the library chat files it.
- **Every Tuesday** the owner and the library chat run `platform/WEEKLY_REVIEW.md`; entries go in `platform/reviews/`.
- New knowledge from a chat can be appended to `archive/CHAT_KNOWLEDGE.md` and filed later.
