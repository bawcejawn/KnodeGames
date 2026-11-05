# Survivor (game 3)

> **Sources:** `claude/repo-history/CHAT_KNOWLEDGE.md` (Claude project, private) (Survivor, Vault, Hub chats), `DECISIONS.md` (D-020, D-051, D-062, D-065, D-068), the repo (branch `survivor`). **Last updated:** 2026-11-03; cleaned 2026-11-04; previous version `../archive/2026-11-04b/games/Survivor.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A two-week elimination game: pick one producer a day and avoid the ones that fall behind. The last players standing win. It rewards reading the network's daily health, and each producer can be used only once a season, so planning matters.

## Gameplay
- **Season:** 14 UTC days, Monday to Monday. **Season 1 starts Mon 16 Nov** (D-065). 👤
- **Picks:** one producer per UTC day; picks open 7 days ahead and lock 5 minutes before 00:00 UTC; up to 5 changes and 20 picks a day. A player joins by picking for day 1. Each producer can be picked once a season. 💬
- **Field:** producers with 280+ blocks in the 7-day window. Knode's own producers stay in, disclosed on the page; it's an open market (D-051). 💬
- **Handicap:** from recent blocks, not VHP: h = kTop ÷ k, where k is the producer's own blocks over days d−8 … d−2. 💬 **Season 1 keeps this blocks-based handicap** (D-095); later seasons move onto the one VHP ruler (D-090, `../platform/HANDICAP_REVIEW.md` §5.3). 👤
- **Out-zone:** floor(field × (12 + day) ÷ 52) — with 17 producers: 4,4,4,5,5,5,6,6,6,7,7,7,8,8. A tie at the line is safe. 💬
- **Lives:** 2. A life is lost for an out-zone pick, no pick, a producer not in the field, or one already used. 💬
- **Boards:** staked (staked in Survivor in either week of the season) and free — **the free board stays; the free prize is off for now (D-081)**. Each board has its own safety net (saves only out-zone losses) and its own end: after the day that leaves 2 or fewer counted players (if more than 2 started), when none is left, or after day 14. The final comes 12 h after both boards end. 💬
- The page shows the chain clock, pauses picking until picks read cleanly, tracks sent picks for 3 minutes, warns before you pick your own producer. 💬

## Scoring
- **Ranking:** lasted longest, then lives left, then total score. 💬
- Staked weekly vault points come from the staked board's standings at each week's end; beyond 255 places points collapse to 1. 💬
- A season needs 3+ players with 2+ valid picks. 💬
- Simulation (field of 17): 10 players → ends about day 11; 50 → about day 13; 200 → ~4 still in on day 14, ranking decides. 💬

## Rewards
- **Free play: yes, standings only** (D-081, replaces D-080) — the Free play board stays; its **4 + 2 VHP season prize (D-068) is off** until the owner switches it on. Before launch the page must say no VHP is paid on the Free board, and the owner's free-prize switch (D-082) must be **off** for game 3 so no winners are posted; the vault entry still uses `--free`. 👤
- Free-prize winners must have been free in both weeks, held 1 VHP at every daily check, not been knocked out by a missed or invalid pick, and played in a season with 3+ such players (SV-A10, SV-A19). 💬
- **Staked:** points to the vault from the staked board (D-051). 💬

## Dependencies
- **Picks contract**, game 3 registration (kind 1, list 1, lock mode 2, round 86,400,000 ms, lead 300,000 ms, ahead 604,800,000 ms, 5 changes, 20 picks a day) — not yet registered. 💬
- Recorder `bot/games/survivor.ts` + `survivor-math.js`, published by `games.yml` (Survivor step 15 min, runs only if Block X's step succeeded). 💬
- Vault v6 for prizes and staked points; results `games-data:survivor/vault/W<week>.json` ✅ `vaultGames`.
- The Hub's shared stake panel; a `board.json` and Results adapter (I-056).

## Current status (4 Nov)
- Branch `survivor` @ `a8a1979` ✅ — pushed, **not merged, nothing deployed**; behind `main`; `FIRST_DAY` still unset ✅; `games.json` "soon" ✅.
- Testnet kit ready (`npm run survivor-test`); tests pass (673 serial, 0 fail).
- Still to do before Season 1 (Mon 16 Nov): Repo Lens pass 4, fixes and fix-check, a testnet season, game 3 registration, merge (I-050). Not announced until ready (D-064).
- Vault check: no `board.json` yet, so PR #74 sets `vaultGames.3.board: "none"` for now (R-SV-3).
- Work list: `../platform/CHAT_REQUESTS.md` → Survivor (R-SV-1 – R-SV-4).

## Known issues
- **I-050:** launch prerequisites above.
- **I-053:** pass-4 questions — mid-season board changes, cheap-wallet gaming of nets or ends, clock checks refusing honest output.
- **I-051:** the vault can't yet recompute points from the chain (stakes and the two-run rule are checked since PR #74; points recompute is planned, I-080).
- **I-055 (accepted):** ~10k one-day wallets can push a season file past 2 MB; a blockless UTC day can't be recorded; VHP read at each node's head; N7 node hang; lookalike addresses (S3-27); guest text (S3-26); a Block X publish failure also stops Survivor.
- **I-057:** rehearsal flake ("not mined" within 2 minutes) — rerun.

## Future plans
Launch path: `../platform/ROADMAP.md` (Repo Lens pass 4 → fixes → testnet season → register game 3 → set `FIRST_DAY` = Mon 16 Nov and merge (owner OK) → Games menu and `games.json` live → `board.json` and Results adapter). Later seasons: the one VHP ruler (VHP card + clamped form) instead of blocks (D-095). Block Golf will need a Survivor hole reader that recomputes standings at each week's last season day.
