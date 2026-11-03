# Start Here — Onboarding to Knode Games

> For any AI (or person) joining the project. Read this first, then follow the reading order.

## What Knode Games is
Free and staked prediction games on the Koinos blockchain, powered by our own block-producing nodes. Players pick producers, blocks and races; correct calls climb a weekly leaderboard for each game. All staked VHP sits in one vault, which produces blocks as the Knode Games Pool. Each week's rewards, after a flat 5% fee, pay free-game prizes (2 VHP / 1 VHP) and are split across the staked games. **Funds safety comes first:** only the vault holds tokens, and stakes are always withdrawable.

- Site: https://knodegames.com · Repo: `github.com/bawcejawn/KnodeGames` (public)
- The owner works in finance and is new to running code.

## Reading order
1. **`platform/PLATFORM.md`** — the one-page picture: games, contracts, money, wallets, branches, who owns what.
2. **`platform/DECISIONS.md`** — every decision (D-xxx). **This file wins** if anything disagrees.
3. **`platform/TODOS.md`** and **`platform/OPENISSUES.md`** — what's happening now and what's broken or waiting.
4. **`platform/DEPENDENCIES.md`** — how the vault, games, leaderboards, rewards, wallets and swap desk connect.
5. **The game you're working on** — `games/<Game>.md`.
6. **The standards that apply** — `standards/GAME_STANDARD.md` first, then `VAULT_STANDARD.md`, `LEADERBOARD_STANDARD.md`, `TOKEN_STANDARD.md`.
7. **Only when needed:** `platform/ARCHITECTURE.md` (how things work in detail), `platform/KOINOS.md` (chain facts, testnet), `platform/ROADMAP.md` (plans), `platform/VISION.md` (why and brand).

Don't read `archive/CHAT_KNOWLEDGE.md` to learn the project — it's an inbox of raw chat exports, already filed into the files above.

## Rules you must follow
- **Never ask for, print, store or handle private keys or seed phrases.** Keys live only in the owner's `.env`. If one is pasted, tell the owner to rotate it.
- **Never push to `main`, merge, deploy, upload a contract or change chain settings without the owner's explicit OK.**
- **Mainnet sends are dry runs** unless `--send`, and need `--mainnet` plus `CONFIRM_MAINNET=yes`. One step at a time.
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
- If two sources disagree, log a **C-xx** contradiction in `DECISIONS.md`; the repo wins over chat notes, and the owner wins over both.
- Mark what you know: ✅ verified in the repo · 💬 from a chat · 👤 owner said · ❓ unknown.
- New knowledge from a chat can be appended to `archive/CHAT_KNOWLEDGE.md` and filed later.
