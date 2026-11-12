# Knode Games — Rules

> **Purpose:** the rules that protect players' funds and the platform. **Nothing here changes casually.**
> **Last updated:** 5 Nov 2026 (status sync: timing and sponsor numbers point to their one home; the owner's push-ASAP rule)
> **Built from:** `DECISIONS.md` (D-xxx), the standards in `../standards/`, and the owner's standing instructions (👤). Where this file and `DECISIONS.md` disagree, `DECISIONS.md` wins — then fix this file.

## How a rule may change
1. **Only the owner** can change a rule — never an AI chat on its own.
2. The change is written as a new decision (**D-xxx**) in `DECISIONS.md`; the old one is marked superseded, never deleted.
3. If it touches funds, contracts or the vault, it passes the owner's audit programs first (D-017).
4. This file and the affected standards are updated in the same change.

---

## 1. User fund safety
1. **Funds must never be at risk.** Token security comes first, ahead of features, speed or launch dates (D-003).
2. **Only the vault holds players' tokens** (D-016). No other contract, wallet or bot may hold player funds.
3. **The vault always holds at least what it owes** — balances never fall below total liabilities (D-029).
4. **A withdrawals-only emergency build is always ready**, so funds can never be locked (D-021).
5. **Private keys and seed phrases** live only in `.env` on the owner's PC. Never pasted into chat or GitHub; never printed, stored or asked for by an AI. A pasted key is rotated (D-003, D-042).
6. **GitHub holds one secret only:** `OPERATOR_WIF`, in the `bot` environment, usable only from `main` (D-012).
7. **Guest wallets never hold funds** — they are play-only keys (D-009).
8. **The Mana sponsor holds only its own KOIN**, for Mana (D-061).
9. **Every contract upgrade** passes the owner's audits and a rehearsal before upload (D-017).
10. **Mainnet sends are dry runs unless `--send`**; every chain tool also needs `CONFIRM_MAINNET=yes` in `.env`, and the Picks tool (`npm run picks`) alone also needs `--mainnet` on the command line ✅ (code checked 3 Nov). They go one step at a time (D-004).

## 2. Vault requirements
1. **Address:** `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` — the game contract, upgraded in place to Vault v6. It is also the **Knode Games Pool** block producer (D-073).
2. **The seed takes the first loss**; accounting uses checked whole-number arithmetic (no rounding errors, no overflow).
3. **Upgrades:** 48 h public notice for any vault upgrade (D-024); announce on a weekend, upload on a Monday (D-023); old builds are refused on chain; a normal upgrade can't load the emergency build.
4. **Seed:** owned by a dedicated wallet (D-022); changing the owner takes two steps 28,800 blocks apart; seed withdrawals have a 48 h timelock.
5. **Games:** added with `propose_game` → 48 h → `apply_game` within 7 days; a game earns from the week after it's applied; at most 12 games besides game 1.
6. **Results files** are the only way a game's results reach the vault. They must be fail-closed, published only after the week ends, and **never changed once final** (`VAULT_STANDARD.md` §6).
7. **The vault never forfeits** in any game; its VHP is players' stakes (D-057).
8. **The vault build branch is frozen** after the fingerprint check; nothing is rebuilt before an upload (D-025).

## 3. Withdrawal requirements
1. **Any amount, any time.** Every staked VHP can be withdrawn at any moment (D-016).
2. **Withdrawals survive emergencies:** the emergency build, a paused vault and a deactivated game all keep withdrawals open (D-021).
3. **Withdrawals never depend on the sponsor.** The sponsor pays for them (D-027), but if it is down or capped, the player can pay their own Mana and still withdraw.
4. **Withdrawing never costs a player their stake.** Dropping below 1 VHP in a game mid-week only forfeits that week's share and free prize in that game (I-028) — the panel must say so.
5. **Moving stake between games** (`move_stake`) is allowed, but never sponsored (D-027).
6. **Seed and treasury withdrawals** are timelocked (48 h) and go only to their owner wallet.

## 4. Reward distribution rules
1. **Source:** rewards come only from the vault's block production — never from new money (D-016, D-073).
2. **Fee:** a flat **5%** of gross rewards, taken first.
3. **Free prizes:** **2 VHP for 1st, 1 VHP for 2nd, per week**, on the games with the free prize switched on (Questions, Block X, Race, Bracket, Last Node). Every game has a Free play board, but Survivor, Combo, Golf and Fantasy pay no free prize until the owner switches it on (D-081). Prizes start with the vault week of Mon 9 Nov (D-062). Multi-week seasons pay once at season end (D-068; Survivor's would be 4 + 2, off for now). Nothing is paid for weeks before the vault start (D-063). One exception: the Questions game's week of 2–9 Nov pays its on-chain 1 + 1 VHP (D-069).
4. **A Free play board without a prize** must say so on the page; nothing is owed for weeks played before its prize is switched on (D-081).
5. **Stakers come first.** Free rewards are extra; **a shortfall is cut and never owed later** (D-029).
6. **The rest is split across staked games** by each game's share of the stake that week; each game splits its part by its own written rules.
7. **Who counts:** at least **1 VHP** staked in that game that week, at least 1 point; ranked among that game's stakers only. Players may stake in many games at once — encouraged (D-074).
8. **Players claim their rewards** (`claim_game`); the vault never pushes funds to wallets.
9. **A prize needs a final, verified results file.** A missed, held or disputed week pays nothing until resolved.
10. **There is no Knode Games token** (D-072).
11. **Not gambling:** no wagers, odds or player-funded pots on any game; stakes are never at risk (D-075).
12. **The weekly rhythm (D-125, D-129):** every game plays Monday to Saturday UTC; **Sunday UTC is the review day** (results re-checked on chain, the owner can hold), with Sunday **fun rounds** that never count for a week; results go final no earlier than Monday 00:00 UTC, so nothing is paid before a full day of review. The times (final, payout, the held-week backstop) have one home: `../standards/WEEK_CYCLE.md`. **Daily Questions** keeps its own timing (Saturday's windows run on Sunday's blocks; claims from about Tue 12:00–15:00 UTC, Tue 4–7 AM PST, later if Saturday's questions resolve on Monday) until Vault v6.1's rule week (Mon 16 Nov), then follows the same rhythm (D-116).

## 5. Architecture rules
1. **Cost $0:** a static site on GitHub Pages; the repo stays **public** (D-005, D-043).
2. **Recorders hold no keys**, read **two nodes that must agree**, count **irreversible blocks only**, and publish through a job that **runs no repository code**.
3. **Fail closed:** on missing data, node disagreement or a failed read, publish nothing final. A read failure is never treated as "not staked".
4. **Published history is write-once:** final weeks, cards and vault files never change.
5. **Every game measures VHP the same way** — the VHP standard (D-058).
6. **The Mana sponsor is the only payer** for players; Mana Station is shelved (D-053). Caps are passed exactly on any config change (a plain `config` resets them).
7. **Merges and deploys follow D-026 and the owner's standing push-ASAP rule** (D-133: built, tested work is pushed and its PR merged once green and any needed Repo Lens review is GO; the owner, or the library chat on his standing OK, presses merge); one branch and one PR per build; review-only PRs stay unmerged until audited. **Mainnet sends and spending funds always need the owner's OK.**
8. **One chat owns each game's files** (D-035); requests for another chat's files go through the owner.
9. **Pages:** at the site root, one strict CSP, no inline scripts, CDN scripts pinned by hash, content built with `textContent` only; the browser stores only public data.
10. **Nothing is announced to players until it's built, audited and ready** (D-064).
11. **Nothing is deleted** — files, folders or branches — without firm confirmation that it's safe 👤.

## 6. Koinos requirements
1. **Mainnet chain id** `EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==`; tools refuse any other chain for mainnet sends, and testnet tools refuse mainnet.
2. **Nodes:** primary `koinos.armana.io`, check node `api.koinosblocks.com`; every result needs both to agree.
3. **Effective VHP:** received VHP counts only after 20 blocks; removed VHP stops at once.
4. **Testnet:** only the public Koinos Foundation testnet; the owner runs no testnet node (D-066).
5. **The owner's three mainnet nodes** (desk, game/pool, personal) are **never exposed publicly** — no open ports, no published IP 👤. Their ports aren't written in this public repo.
6. **Never delete a node's `basedir\block_producer`** — it holds the producer's private key.
7. **Contract upgrades** follow schedule → 48 h → upload within 7 days → clear.
8. **Never mention Chainge;** Vortex is the bridge (D-006).

---

## Never change casually
These values are relied on by contracts, files or players. Changing one needs a decision, an audit and usually a migration.

| Item | Value | Why |
|------|-------|-----|
| Vault / pool address | `1Mpmf2…` | holds every stake; the producer |
| Contract addresses | Picks `1LmgqB…`, Race `1EN7xU…`, sponsor `1ByDDS…`, desk `1FKTpX…` | the site, bots and players point at them |
| Vault genesis and weeks | Mon 19 Oct 2026 00:00 UTC; Monday-to-Monday UTC weeks | every week number and file name depends on it |
| Weekly rhythm (D-125, D-129) | `../standards/WEEK_CYCLE.md` | players plan around it; the 24 h review protects payouts |
| Game ids | 1 Questions, 2 Block X, 3 Survivor, 4 Fantasy, 5 Rival, 6 Golf, 7 Race, 8 Combo, 9 Bracket, 13 Last Node | on-chain registration, results files |
| Results file format and sources | `VAULT_STANDARD.md` §6; `vaultGames` | the vault reads them as-is |
| Published final files | any final week, card or vault file | players were paid from them |
| Platform fee | 5% | the money flow |
| Free prize | 2 + 1 VHP per week | promised to players |
| Minimum stake | 1 VHP per game | staked status, rankings |
| Timelocks | 48 h upgrades, games, seed and treasury changes | the players' warning period |
| Emergency build | withdrawals-only build kept ready | the last line of defence |
| Sponsor caps | live values: `SPONSOR.md` | budgets and fairness |
| Picks game settings (once applied) | e.g. Block X 1 change per pick | players rely on the lock rules |
| Question release | 12:00 UTC on the dot (D-047) | the site's integrity |
| Keys location | the owner's `.env` only | fund safety |
