# Last Node Standing (game 13)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Last Node Standing chat), `DECISIONS.md` (D-054, D-055), the repo (branch `lastnode`). **Last updated:** 2026-11-03; cleaned 2026-11-04; previous version `../archive/2026-11-04b/games/LastNodeStanding.md`.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
A daily elimination event among block producers: each hour the weakest node (by handicapped production) is cut, and players ride a node they think will last. A pick of a start node plus a backup adds strategy, and anti-gaming checks protect the result.

## Gameplay
- **One event a day:** cuts hourly from 14:00 UTC. Rounds target 13:55 UTC; picks open 24 h ahead and lock at 13:50 UTC. 💬
- **Picks:** a start node plus an optional backup (a Picks list of 2, 5 changes, 10 picks a day). The backup takes over automatically at the start node's first cut, if still standing — one jump. 💬
- **Field:** taken from the race card at 12:00 UTC the day before (or the next leg's card if taken before picks open); nodes at ≥ 20 blocks an hour by VHP, at most 23. **This bar is to be lowered** (D-091; target k ≥ 10 expected blocks in the scoring window, value set by simulation, R-LN-4). Handicap h = (kTop/k)(1 − c/√k)/(1 − c/√kTop), 4 decimals; c on a 0–2.5 grid from 20,000 seeded simulations. 💬
- **Form:** 48 h of blocks ÷ the blocks the VHP share gives, hour by hour against 5-minute VHP samples; kept within 0.80–1.20; needs at least 24 usable hours. 💬
- **Race-time cut:** VHP added after the field card can only lower a multiplier; each window is judged by the first race card at or after its end. Hours are recorded ~30 minutes after they end. 💬
- The page uses the chain's clock and sends one transaction: a Picks `pick` of [start, backup]. 💬

## Scoring
- **1 point per cut survived**, plus **+5** for riding the last node without jumping or **+3** after a jump. 💬
- **Board:** points, then rides, then fewer jumps; exact ties share. 💬
- **Watch-and-hold:** a node at weekly z ≥ 3.4 with 2+ wins, or z ≥ 5 in one event it won, is flagged; the week's vault file is held until released with `LASTNODE_RELEASE_WEEKS` (D-055). 💬

## Rewards
- **Staked:** vault file `{game: 13, week, final, rows: [{player, points 1–255}], first: [], second: []}` as built — rows are wallets staked in game 13 that week with ≥ 1 point; **to change:** `first` / `second` must now hold the free winners (D-081, next line); written 12 h to 3 days after the week ends. 💬
- **Free play:** **yes — Free play and Staked boards** (D-081, 3 Nov; was staked-only, D-071). **The Free board pays the 2 + 1 VHP weekly prize from the start** (owner, 3 Nov): the results file fills `first` / `second`, and the free-prize switch (D-082) stays on for game 13. The branch was built staked-only — the Last Node chat must add the free board. 👤

## Dependencies
- **The VHP sampler** (`race-samples.yml`): 48 h of readings before launch; no field without form unless `LASTNODE_ALLOW_NO_FORM=true`, and the owner chose to wait (D-054). Running since 3 Nov 15:58 UTC, up to 12 samples a run since PR #67 ✅; whether that changes the 48 h readiness: R-LN-2.
- **Picks contract:** game 13 announce (owner key) → 48 h → apply; `bot/picks.ts` registers only Block X on mainnet so far. 💬
- Race cards (`race-data`), two nodes, `lastnode.yml` with its own publish-job JSON-RPC client. 💬
- Vault v6 (staked list and HOLD files: built in PR #74; Last Node publishes a RELEASE marker, R-LN-3); sponsor coverage for game-13 picks to confirm (R-LN-5). 💬

## Current status (4 Nov)
- Branch `lastnode` @ `adf95be` ✅ — pushed, **not merged, nothing deployed**; behind `main`. Tests: 718 (708 pass, 0 fail).
- Round-2 fix-check done except L-9 and part of L-7; round-3 review prompt ready (`claude/lastnode/FIXCHECK-3-PROMPT.md`), not yet run.
- To add: the Free play board with its prize (free-winner rule to decide, `claude/lastnode/FREE-PLAY-PROPOSAL.md`), the RELEASE marker for held weeks, and the lower entry bar.
- Work list: `../platform/CHAT_REQUESTS.md` → Last Node Standing (R-LN-1 – R-LN-5).

## Known issues
- **I-058:** c, form and the staked list are trusted to the record job; the publish job's JSON-RPC client has never run against real mainnet nodes; L-9 sample averages aren't time-weighted; N-6 (accepted) — a steady 3% form-skim is largely undetectable; `games.yml` lost `lastnode`'s push-retry loop; the branch is behind `main`.
- **Vault check (PR #74, merged):** the vault bot honours HOLD files and verifies the staked list; a released week stays held until Last Node publishes `RELEASE-W<week>.json` next to the HOLD file, with the reason in a `reason` field (R-LN-3).
- Windows: other games' tests need Linux (expected).

## Future plans
Launch path (`../platform/ROADMAP.md`): clean round-3 review → lower the entry bar (D-091) → add the Free play board and free-winner rule (D-081; proposal `claude/lastnode/FREE-PLAY-PROPOSAL.md`) → announce game 13 on Picks, apply after 48 h → 48 h of sampler data → `lastnode` → `main` (owner OK) → `LASTNODE_ENABLED=true` → watch the first live day. Later: a 4-week rolling form check or a shorter form window against slow skimming.
