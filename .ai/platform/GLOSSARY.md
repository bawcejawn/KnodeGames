# Knode Games — Glossary

> **Purpose:** the words used across the repo and the chats, in plain language, A to Z. If a file uses a term not here, add it.
> **Last updated:** 2026-11-05 (first written)

| Term | Meaning | More |
|---|---|---|
| **Active stake** | VHP staked in a game *this week*. A new stake counts from the next week. | `standards/WEEK_CYCLE.md` |
| **All time board** | A game's career board. Sunday fun rounds count here, never on the week. | D-129 |
| **Announce (upgrade)** | Step 1 of a contract upgrade: publish the new code's hash; it can be uploaded no sooner than 48 h later. | `RUNBOOK.md` |
| **Armana** | `koinos.armana.io`, the public Koinos node the site and tools read from. Turns bursts of reads away (I-006). | `KOINOS.md` |
| **board.json** | A game's published leaderboard file, which the vault bot checks against its results file. | `standards/LEADERBOARD_STANDARD.md` |
| **Claim / claim_game** | A player collecting a week's reward from the vault. `claim_game(game, week)` for vault games; `claim(week)` for older Questions weeks. | `SPONSOR.md`, D-116 |
| **Cold owner** | The new owner wallet `1LMV8E…`, kept offline, that takes over the vault and Desk on Tue 10 Nov. | `KEYS_AND_ROLES.md` |
| **CONFIRM_MAINNET** | A line in the PC's `.env`; without `CONFIRM_MAINNET=yes` no tool can send to mainnet. Turn it on just before a `--send`, off right after. | `RUNBOOK.md` |
| **Desk (Swap Desk)** | The KOIN ↔ VHP swap contract `1FKTpX…` (3% fee). | `PLATFORM.md` |
| **Dry run / `--send`** | Every mainnet tool only shows what it would do until `--send` is added. | D-004 |
| **Fix-check** | A short second Repo Lens review of the fixes to an earlier review. | `AUDITS.md` |
| **Free play / Free board** | Playing without a stake. Each game has a Free board; 1st and 2nd win 2 and 1 VHP a week where the free-prize switch is on. | D-081, D-082 |
| **Free-prize switch** | The owner's ON / OFF per game for free VHP prizes; a change counts from the next week. | `FREE_PRIZE_SWITCH.md` |
| **game-add / game-apply** | Registering a game in the vault: `game-add` starts a 48 h notice; `game-apply` finishes it (within 7 days). | `standards/GO_LIVE_CHECKLIST.md` |
| **Handover (4a / 4b / 5a / 5b)** | The steps that move vault and Desk ownership to the cold owner: propose (a), then accept (b). | `docs/WALLETS.md` §7 |
| **Held week** | A week the recorder or the owner stops from going final. It rolls over at Thu 00:00 UTC if still held. | `standards/WEEK_CYCLE.md` |
| **Knode Games Pool** | The block producer the vault runs with all staked VHP. | D-073 |
| **Mana** | Koinos's fee resource; it refills from KOIN held. A transaction has a Mana limit. | `SPONSOR.md` |
| **Mana sponsor** | Contract `1ByDDSB…` that pays players' Mana within caps (2.4 per transaction). | `SPONSOR.md` |
| **Picks contract** | `1LmgqB…`: the shared contract that records picks and enforces locks on chain. | `PLATFORM.md` |
| **Pending / final** | A week's results first publish as pending (Sunday review); they go final no earlier than Mon 00:00 UTC after two agreeing runs. | `standards/RECORDER_STANDARD.md` |
| **Recorder** | A game's bot job that reads the chain, scores picks and publishes boards and the vault file. | `standards/RECORDER_STANDARD.md` |
| **Repo Lens** | The outside code reviewer the owner runs before merges that touch funds or payouts. | `AUDITS.md` |
| **Results file (vault file)** | The file a game publishes for the vault bot: who scored what, plus `first` / `second` free winners. | `standards/VAULT_STANDARD.md` §6 |
| **Review day** | Sunday UTC: nothing scores for the week; results are re-checked. | D-125 |
| **Rule week (R)** | The first week v6.1's new rules apply: **Mon 16 Nov**. R − 1 is the switch-over week. | D-130 |
| **Seal** | The vault bot locking a game's posted results; claims open 24 h later. | `standards/VAULT_STANDARD.md` |
| **Session-end report** | The report every chat writes at the end of a session; the library chat files it. | `SESSION_END_PROCESS.md` |
| **Settle** | Old Questions-rules step that splits a week for a player. Not used from the rule week. | D-116 |
| **Staked board** | The board of players with an active stake in the game; they share the game's reward. | `standards/LEADERBOARD_STANDARD.md` |
| **VHP** | Koinos's Virtual Hash Power: staked to produce blocks; the platform's reward token. | `standards/TOKEN_STANDARD.md` |
| **VHP ruler** | The shared measure of producers' size and form that handicaps use. | `standards/VHP_RULER.md` |
| **Vault** | Contract `1Mpmf2…`: holds every stake, produces blocks, pays weekly rewards. The only contract that holds tokens. | `standards/VAULT_STANDARD.md` |
| **Vault week** | Week number counted from Mon 19 Oct 2026 (week 0). Site "Week 1" = vault week 3. | D-063 |
| **Withdrawals-only build** | The emergency vault code (`04c27c1a…`) that only lets players withdraw. | D-021 |
| **Worktree** | A second folder of the same repo on another branch, so two chats can work without clashing. | `RUNBOOK.md` |
