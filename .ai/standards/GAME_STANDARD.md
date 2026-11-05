# Knode Games — Game Standard

> **Purpose:** what every Knode Games game must do and prove before it is announced. A game that doesn't meet this isn't ready (D-064).
> **Applies to:** every game in `.ai/games/`, new or changed.
> **Last updated:** 5 Nov 2026 (§4 now points to `WEEK_CYCLE.md`, the one home for game timing)
> **Built from:** `platform/DECISIONS.md` (cited as D-xxx) and the rules the game chats already follow. Related standards: `LEADERBOARD_STANDARD.md`, `VAULT_STANDARD.md`, `TOKEN_STANDARD.md`, `RECORDER_STANDARD.md`, `VHP_RULER.md`, `GO_LIVE_CHECKLIST.md`; `WEEK_CYCLE.md` (weekly timing) and `NEW_GAME.md` (onboarding a new game), both being written.

**Words:** **must** = required for launch · **should** = expected unless the owner agrees otherwise · ❓ = not yet decided

## 1. Release gate
A game is announced to players only when all of these are true (D-064 — "only the correct and best version"):
- [ ] Its spec is written in `.ai/games/<Game>.md` with the eight sections (Purpose, Gameplay, Scoring, Rewards, Dependencies, Current Status, Known Issues, Future Plans).
- [ ] It passed the owner's audit programs, including any fix-checks, on the exact commit that ships (D-017).
- [ ] It ran on the **public Koinos testnet** first, where it has on-chain parts (D-066; Block Golf is the agreed exception — its practice weeks on mainnet are the trial, D-056).
- [ ] Its full test suite passes on Linux.
- [ ] It meets the leaderboard, vault, token and recorder standards.
- [ ] It follows `WEEK_CYCLE.md` and has its row in that file's compliance table.
- [ ] The owner gives an explicit OK to merge and to deploy (D-026).

## 2. Play types and prizes
- **Every game must be stakeable** (D-018); a staked player has at least **1 VHP** staked in that game that week. Players may — and are encouraged to — stake in several games at once (D-074); pages should make that easy.
- **Every game is Staked + Free play** (D-081; the older "Staked only" option, D-071, is superseded):
  - **Every game has Free play** (a Free play board; D-081). What differs is the free VHP prize:
  - Free board **with** the 2 + 1 VHP prize: Daily Questions, Block X, Producer Race, Producer Bracket, Last Node Standing.
  - Free board **without** a prize for now (standings only): Combo Card, Block Golf, Survivor, Fantasy Producers (D-081).
  - The owner switches the free prize on for each remaining game when the seed is ready (D-081).
- **Free prize: 2 VHP for 1st, 1 VHP for 2nd per week**, from the vault's start (D-062). A multi-week season pays its total once, at season end, to the season's winners (rule kept for later — Survivor's free prize is off for now, D-081; it would be 4 + 2 per 2-week season, D-068). Nothing is paid for weeks before the vault start (D-063).
- Free rewards are extra and come second to stakers; a shortfall is cut, never owed (D-029).
- Records-only side games (Weekly Rival) carry no prize and must say so.

## 3. Fairness
- **Open market:** Knode's own nodes stay in every field; the page discloses it; no promise they stay out (D-051, D-057, D-059).
- **Rules are fixed before anyone can pick** — prices, fields and seeds are published before picks open (D-059, D-057).
- **Measure VHP the KnodeGames way** — the VHP standard (D-058; the shared ruler in `VHP_RULER.md`, D-108); multipliers stay game-specific.
- **Anti-gaming:** each game documents how it resists cheap wallets, late picks and producer gaming, and which residual risks the owner accepted (e.g. D-055).
- **Ties** share a place unless the game's rules give a written tie-break.

## 4. Timing — nothing should feel rushed
**The week every game follows (play days, the Sunday review day and its fun rounds, when results go final, when rewards are claimable, the held-week backstop) has one home: `WEEK_CYCLE.md`** (D-125, D-129). Don't repeat its times here or in a game file; point to it.

What stays here (not timing of the week):
- Picks should open well ahead (days where the game allows) and be changeable until each round's own lock (D-059).
- Locks are enforced **on chain** by the Picks contract's lock clock, not just by the page.
- Week numbers follow the vault (week 0 = Mon 19 Oct 2026); players see the week of Mon 9 Nov as "Week 1" (D-063).
- **Each game launches when it's audited and ready** (D-052, D-064; the older "launch on a Monday" rule, D-059, is superseded); a game earns from the vault week after it's applied. New games wait for the core work (D-113).
- **Daily Questions (game 1)** keeps its own timing (Saturday's windows run on Sunday's blocks; claims from about Tue 12:00–15:00 UTC, Tue 4–7 AM PST, later if Saturday's questions resolve on Monday) only until Vault v6.1's rule week, **Mon 16 Nov**; from then it follows `WEEK_CYCLE.md` like every game (D-116).

## 5. On-chain registration
- **Picks contract:** announce the game (owner key) → wait 48 h → apply within the window. Settings (kind, list size, lock mode, round size and offset, lead, ahead, changes, picks a day) are written in the game's spec. Hard limits: 50 picks a day, 50 changes, list size 10, ahead ≤ 35 days, lead ≥ 5 min.
- **Vault:** `game-add <id> "<name>" --staked --free --season <n>` (**`--free` on every game**, D-082; the free-prize switch decides whether free winners are paid — `platform/FREE_PRIZE_SWITCH.md`) → 48 h → `game-apply` within 7 days; a game applied in week W earns from W + 1 (see `VAULT_STANDARD.md`).
- **Sponsor:** an allowlist row for the game's picks, with a per-action Mana limit at least 1.25× the measured cost and at most the per-transaction cap; raise it when measured use reaches ~1.5× headroom (D-038). Live caps and rows: `../platform/SPONSOR.md`.

## 6. Recorder and data
Every game that publishes results **must**:
- run its recorder with **no keys and no secrets**, reading **two nodes** that must agree, using **irreversible blocks only**;
- publish through a job that **runs no repository code** (shape checks in plain Python or Node, canonical bytes `JSON.stringify(JSON.parse(text))+"\n"`, numbers JS-safe, ASCII `[0-9]` only, files ≤ 2 MB unless agreed);
- keep **published history write-once** (final weeks, cards and vault files never change; a run that rewrites history is held whole);
- **fail closed** — on missing ABI, empty state, a failed stake read or node disagreement, publish no final file;
- refuse to start if the last run's files exist but can't be read;
- sit behind its own `<GAME>_ENABLED` switch and not block other games' steps (or document the dependency).

## 7. Page
- At the site root (never under `site/`), with one strict CSP meta tag, no inline scripts, CDN scripts pinned by integrity hash, content built with `textContent` only.
- Uses the shared wallet (`KWallet.init` with the deployment's payer and sponsor) and the guest wallet where free play is offered (D-009).
- Shows the **status badge** (`KStake.badge`) at the top of `<main>` and the full stake panel (`KStake.mount`) lower down (D-031); uses "Staked" / "Free play" labels.
- Has **its own Staked and Free play leaderboards**, built from its own results and picks, shown on the game page and on the Leaders page (`board.js`, `LEADERBOARD_STANDARD.md`, D-079).
- Publishes **`board.json`** next to its vault folder in the shape the vault bot checks (`LEADERBOARD_STANDARD.md` §1, I-079), and its vault file **always fills `first` / `second`** (D-082).
- Has its open work listed in `platform/CHAT_REQUESTS.md` (D-089).
- **Shows every producer and player by nickname** — loads `names.js` before the page's own script, allows names-data in its CSP, and displays `KNames.of(address)` (name with the short address), re-rendering on `KNames.onChange` (D-078).
- Explains every number in plain words; feels inviting, professional and fun (D-059); works at phone width.
- Uses the chain's clock for locks and countdowns.

## 8. Ownership and process
- One chat owns each game's files; other chats send requests through the owner (D-035).
- One branch and one PR per build; merges follow D-026 and the owner's push-ASAP rule (`AI_CHAT_STARTER.md` §1 rule 11): built, tested work is merged once green; mainnet sends and spending funds need the owner's OK.
- Mainnet sends are dry runs unless `--send`; every chain tool also needs `CONFIRM_MAINNET=yes` in `.env`, and the Picks tool (`npm run picks`) alone also needs `--mainnet` on the command line ✅ (code checked 3 Nov), and they go one step at a time as copy-paste PowerShell for `C:\kprediction` (D-004, D-042).
- Never handle, print or store private keys; if one is pasted, the owner rotates it (D-003, D-042).
- Root-cause fixes, and a blind review before each audit round (D-042).

## 9. Spec template
```
# <Game> (game <id>)
> Sources · Last updated · Legend
## Purpose
## Gameplay        (picks, locks, field, page)
## Scoring         (points, ranking, ties, finality)
## Rewards         (staked; free play and whether its free prize is on; season payout)
## Dependencies    (contracts, Picks/vault registration, sponsor row, data, workflows)
## Current Status  (branch @ commit, tests, audits, what's live)
## Known Issues    (I-xxx links)
## Future Plans
```
