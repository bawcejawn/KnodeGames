# Knode Games — Emergency Runbook

> **Purpose:** what to do when something goes wrong: how to recognise it, what to run, what to check after. Written for the owner at 3 AM: one section per problem, copy-paste PowerShell, dry run first.
> **Last updated:** 2026-11-03 (first version, from the code on `main`, `docs/UPGRADE-V6.md`, `VAULT_STANDARD.md` §8 and today's audits). Steps marked ❓ are not yet confirmed by the Vault chat (R-VAULT-5).
> **Golden rules:**
> 1. **Stakes are always withdrawable.** No step here can lock players' funds. When in doubt, **stop new money, don't move existing money.**
> 2. **Send nothing more until you understand the problem.** A wrong fix is worse than a held week: results have a 3-day window, upgrades 48 h.
> 3. **Every tool is a dry run until `--send`.** Run it once without `--send`, read the output, then repeat with `--send`.
> 4. **Never paste a key** into a chat, an email or GitHub. If one leaked, see §7.
> 5. Then tell the library chat what happened (session-end report), so the docs and the work lists catch up.

## 0. Before anything: open a PowerShell window like this
```powershell
cd C:\kprediction
git branch --show-current
git pull
$env:RPC = "https://koinos.armana.io"
npm run bot -- status
npm run bot -- games
npm run bot -- chain-check
```
- `git branch --show-current` should print `main` (since 3 Nov; was `picks`). If not, stop and ask.
- The `RPC` line makes the tools use Armana. `api.koinos.io` has been unreliable. If Armana itself is down, use `https://api.koinosblocks.com`.
- `status`, `games` and `chain-check` are read-only. Save their output; every section below asks for it.
- **Owner key:** after the weekend wallet moves (D-083), the owner key is cold. Load it into `.env` only for the owner steps below, then take it out again (`docs/WALLETS.md`).

## 1. Alerts: what each one means
| You get | From | Means | Go to |
|---|---|---|---|
| GitHub email "Run failed: Kpred bot" | the hourly bot (`bot.yml`) | one run failed. Usually a node hiccup: it catches up next hour | §2 if a second run in a row fails |
| Bot email listing **problems** (e.g. "results not ready … due …", "can't be read", "refused") | the bot's problem list | a game's week is held or a send was refused. Each line names the game, week and deadline | §3 |
| Bot email "…your admin key is compromised" / "Desk owner change … cancel it and withdraw the Desk" / "upgrade announced" | the bot's chain watch | an owner-level change is pending on chain. **Expected** during your own wallet moves or upgrades (`docs/WALLETS.md` lists them) | if you didn't do it: §7 |
| GitHub email "Run failed: Node watchdog" | `watch.yml` (every 15 min on paper, about hourly in practice) | your personal producer hasn't signed for 30+ min: the PC, Docker or the internet is probably down. One email, then a reminder every 3 h | §5 |
| A question wasn't released at 12:00 UTC | you see it on the site, or the release backup log | the release run and the PC's backup task both missed it | §6 |
| `games-data` / `race-data` publish job failed | GitHub email for `games.yml` / `race.yml` | a recorder wrote a file the publish check refused; that game's files didn't publish this hour | §4 |
| The sponsor email or `sponsor -- watch` says over 80% of the daily caps | sponsor watch | free Mana is running out today | §8 |

## 2. The bot keeps failing
1. Open GitHub → **Actions** → **Kpred bot** → the red run → read the last lines.
2. **"node" / "timeout" / "HTML error" / "fetch failed"** is a node problem. It recovers by itself (Armana outage, 3 Nov). Wait one more run. If three runs in a row fail, check `https://koinos.armana.io` in a browser, then tell the library chat.
3. **"not seen in a block"**: the transaction was sent but not confirmed in 3 minutes. The next run re-checks it. Don't resend by hand.
4. **Anything else** (a code error, "operator only", "insufficient Mana"): send nothing. Paste the last 30 lines to the Vault chat.
   - "Insufficient Mana": the bot wallet (`1HsM33…`) needs KOIN (target ~50, I-046).

## 3. A game's week is held, or a send was refused
The vault bot holds a week instead of paying it whenever something is in doubt. That's safe: results have **3 days** after the week ends (Monday 00:00 UTC → Thursday 00:00 UTC). After that the week **rolls over**: its stakers' bucket stays in the game for next week, and its free prize goes back to the pool. Nobody loses their stake.

| The alert says | Meaning | What to do |
|---|---|---|
| "results not ready" | the game's recorder hasn't published its final file yet | wait; it's normal on Monday–Tuesday. Under 12 h left: tell that game's chat |
| "free-prize switches can't be read" | the `prize-settings` file is broken or GitHub is down. Stakers' points are still posted; only free winners and the seal wait | check with `npm run prizes -- list`. Fix by sending the right setting again (it rewrites the file). Under 6 h before the deadline the bot seals without free winners by itself |
| "HOLD" (Last Node) | the game's watch-and-hold flagged the week | the Last Node chat decides; release with `LASTNODE_RELEASE_WEEKS` (needs R-LN-3 / PR #74 VB-1 first) |
| "board missing / not on board / order" (after PR #74) | the results file doesn't match the game's published leaderboard | tell that game's chat (R-ALL-3). Don't post by hand unless the chat confirms the file is right |
| "file changed after it was first read" (after PR #74) | a final file changed: something is wrong upstream | don't post. Tell that game's chat and the Vault chat. Post by hand (`game-post`) only after both confirm |
| "refused: …" | the vault contract said no; the reason is in the alert | paste the alert to the Vault chat. Don't retry by hand |

**Wrong results after a seal** (you have **24 hours** after each seal to correct):
```powershell
npm run bot -- game-correct <game> <week> <player address> <right points>
npm run bot -- game-correct <game> <week> <player address> <right points> --send
```
- Remove a wrong free-prize winner: `game-unprize <game> <week> <player>`.
- Throw the whole week away (its bucket rolls over within the game, its prize goes back to the pool): `game-void <game> <week>`.
- All three use the **owner** key.

## 4. A game misbehaves (wrong scores, a broken page, a bad recorder)
1. **Stop new stakes in that game** (players keep their stake, can withdraw and claim; the game earns through this week):
   ```powershell
   npm run bot -- game-stop <game id>
   npm run bot -- game-stop <game id> --send
   ```
2. **Picks-based games** (Block X 2, Survivor 3, Bracket 9 …) can also stop taking picks at once: `npm run picks -- pause <game id> --mainnet` (dry run), then add `--send`. Restarting needs a new announcement and 48 h.
3. **Hide it from players:** ask the Hub chat to set the game to "soon" in `games.json` (a PR you merge).
4. **Its weeks:** let the bot hold them (§3), or void them with `game-void`.
5. Restarting a stopped game needs a new `game-add` (48 h) and `game-apply`, after its old weeks have closed.

## 5. A node or the PC is down
- **Watchdog email** (personal producer silent): check the PC is on, Docker is running, and the internet works. The self-heal task restarts nodes every 20 min. If a node doesn't come back within an hour, open Docker Desktop and check the three containers (desk, game/pool, personal).
- **Never delete a node's `basedir\block_producer` folder**: it holds the producer's key.
- While the game/pool node is down, the Knode Games Pool produces fewer blocks, so weekly rewards are smaller. Stakes are safe.
- **Armana (the main RPC) down:** the bot stops and catches up next hour. To work by hand, use `$env:RPC = "https://api.koinosblocks.com"`.

## 6. The daily question wasn't released at 12:00 UTC
1. The release run (11:48 UTC) and the PC's backup task (11:45 – 14:05 UTC, every 5 min) both try. Check `node\release-kick.log` on the PC.
2. Run the bot once by hand: `npm run bot -- tick --dry-run`, then `npm run bot -- tick`.
   - ❓ Confirm with the Questions chat that a manual `tick` from the PC can release: since D-084 the PC has no operator key, so it may be refused.
3. A late question still counts once released. Tell the Questions chat.

## 7. A key may be stolen, or a change you didn't make is pending
**First:** don't send anything that uses the suspect key. Then:

| Key | What a thief could do | What to do |
|---|---|---|
| **Operator** (`OPERATOR_WIF`, GitHub only) | post wrong results for at most a week of one game, which you can correct in 24 h; it can't move funds | replace it: `npm run bot -- admin set_operator operator=<new address> --as owner` (dry run, then `--send`); update the GitHub secret `OPERATOR_WIF` (Settings → Environments → `bot`); correct any bad results (§3) |
| **Owner** (cold after the moves, D-083) | announce a vault or Desk upgrade or owner change (48 h notice; you get an email), change settings, stop games | **you have 48 h.** Tell the Vault chat at once. ❓ Exact steps to cancel a hostile announcement and move ownership (the vault has no `cancel_owner`; proposing your own address replaces a pending one): Vault chat to confirm (R-VAULT-5). Pause deposits: `npm run bot -- pause on` + `--send` |
| **Sponsor** (`SPONSOR_WIF`, 25,000 KOIN, no timelock, D-085) | move the sponsor's KOIN at once | ❓ if any KOIN is left: move it to a safe wallet, then `npm run sponsor -- disable --send`. Players then pay their own Mana and can still withdraw (D-027). Vault chat to confirm the exact steps |
| **Seed owner** (`1K8VV…`) | start a seed withdrawal (48 h timelock) | Vault chat at once; the seed owner change takes two steps 28,800 blocks apart |
| **Desk treasury / Desk owner** | the treasury only receives; owner changes take 48 h | Vault chat; `npm run desk -- owner cancel` / `treasury cancel` (dry run first) |

A pasted key is a leaked key: rotate it even if nothing happened (D-003, D-042).

## 8. The sponsor is running out
1. `npm run sponsor -- status` shows today's use against the caps (25 a day / 150 a week per wallet, 5,000 a day in total, 2,000 a day for free players).
2. Running out today only means some players pay their own Mana until midnight UTC; nobody loses anything.
3. To change caps, pass **all of them exactly** (a plain `config` resets them): see `FREE_PRIZE_SWITCH.md` and `claude/handoff-sponsor-v6-day.md`. The Vault or Block X chat writes the exact command.

## 9. The last resort: the withdrawals-only build (vault)
Only if the vault itself is wrong and everything must stop. It keeps the same address and storage. Every stake, finished prize and the fee can still be taken out; deposits, moves and new weeks stop; recording results stays open. Full steps in `docs/UPGRADE-V6.md` → "Emergency: the withdrawals-only build":
1. `npm run bot -- pause on --send` and `game-stop <id> --send` for any misbehaving game.
2. `npm run bot -- upgrade schedule --safe`, then again with `--send` (starts the 48 h).
3. Let the bot settle and seal every ended week.
4. 48 h later: `npm run bot -- upgrade apply --safe`, then `--send`.
5. Tell players on the site: withdraw any time.

**Never roll back to v5**; the vault refuses it anyway. Decide this step with the Vault chat, never alone at 3 AM.

## 10. After any incident
- Write down what happened, when (UTC), what you ran and what it printed. Paste it to the library chat.
- Check: `npm run bot -- status`, `games`, `chain-check`, `npm run sponsor -- status`, `npm run desk -- status`.
- The library chat adds an I-xxx issue, updates this runbook if a step was missing, and adds work to `CHAT_REQUESTS.md`.
