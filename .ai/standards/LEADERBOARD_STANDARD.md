# Knode Games — Leaderboard Standard

> **Purpose:** how every game's leaderboard is built, ranked, published and shown, so all boards look and behave the same.
> **Applies to:** every game, through the shared `board.js` (`KBoard`). **Every game has both boards** (D-079).
> **Last updated:** 2026-11-02
> **Built from:** `platform/DECISIONS.md` (D-xxx) and the shared board as the Race, Hub and game chats built it.

**Words:** **must** = required · **should** = expected · ❓ = not yet decided

## 1. Boards
| Board | Who appears | Shown |
|-------|-------------|-------|
| **Staked** | players staked in *this game* that week (≥ 1 VHP), plus anyone who withdrew during the week — so the board doesn't silently drop them | all ranked rows (cap below) |
| **Free play** | everyone else, guests included — on **every** game (D-079); the 2 + 1 VHP prize applies only on games with a free prize (GAME_STANDARD §2) | the top 6 |

- Labels are exactly **"Staked"** and **"Free play"** on every game (D-031).
- **Both boards on every game, built from that game's own results and picks** (D-079) — **except Combo Card, Block Golf and Survivor, which have a Staked board only for now** (D-080). On Fantasy and Last Node the Free play board ranks free players but pays no prize — the page says so.
- **Every game's boards are listed on the Leaders page** (a `board` entry in `games.json`).

## 2. Periods
- Tabs: **Today**, **This week**, **Last week**, **All time** (games may omit Today when it makes no sense).
- A week runs **Monday 00:00 to Monday 00:00 UTC**. Week numbers in files follow the vault (week 0 = Mon 19 Oct); **players see the week of Mon 9 Nov as "Week 1"** (D-063).
- Prizes are shown only from the vault's first paying week (`PRIZES_FROM_WEEK = 3` in vault numbering), never for weeks the vault won't pay (D-063).

## 3. Ranking
- Each game ranks by its own written rules (points first, then the game's tie-breaks — see `.ai/games/`).
- **Ties share a place:** `boardPlace` goes 1, 1, 3 … (standard competition ranking).
- Only players with **at least 1 point** are ranked for prizes.
- Staked status follows the vault's rule: staked = that week's peak stake (or active stake when there's no entry) at or above the minimum; earning = `week_stake` at or above it. The panel should explain that withdrawing below the minimum mid-week forfeits the week (I-028).

## 4. Medals and prize marks
- **Only wallets that earn get a medal**, and only on the weekly boards (D-034).
  - Free play: the paid 1st and 2nd.
  - Staked: the wallets that earn a share of the game's bucket (for the Race, the vault's top 30% by headcount, rounded up, tied groups whole).
- The `earns` field marks it: 1 or 2 = a free-prize place, 3 = a share of the staked bucket, 0 = nothing; nonzero only on This week and Last week.

## 5. Data
- Source: the game's published `board.json` on its data branch, written by the recorder and checked by the publish job (GAME_STANDARD §6).
- Shared row shape (Race reference): `{a, pts, correct, shows, picks, ranked, boardPlace, earns}`; games add their own columns (e.g. Golf: `pts`, `topar`, `holes`, `lost`).
- Size: up to 2,000 rows per board (Bracket, Combo); over the cap → error, no vault file (Combo).
- Updates hourly with the recorder. **Final weeks are frozen** — a published final board never changes.
- Numbers JS-safe (within ±2⁵³−1, no integer-valued floats).
- The vault's points come from the final board but are published separately (VAULT_STANDARD).

## 6. Display
- **Names (required on every game, D-078):** the producer's or pool's name, else the older Knode Games name, else the player's **Koinos @name** (the @name wins), with the **short address always shown** next to it (D-030). Lookalike names are folded; reserved words refused.
- Highlight the connected wallet's own row.
- Built with `textContent` only; works at phone width.
- Explain every column in plain words (D-059).

## 7. Privacy
- Never show keys, `.env` values or anything but public addresses and names.
- Pages ignore a `names.json` over 2 MB.

## 8. Open
- Free play boards for Combo, Golf and Survivor open with a bigger seed (D-080).
