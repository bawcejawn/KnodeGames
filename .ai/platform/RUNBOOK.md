# Knode Games — Emergency Runbook

> **Purpose:** what to do when something goes wrong: how to recognise it, what to run, what to check after. Written for the owner at 3 AM: one section per problem, copy-paste PowerShell, dry run first.
> **Last updated:** 2026-11-04. Vault chat (R-VAULT-5) checked every vault, Desk, sponsor and key step against the code on `main` (`f3a7cb1`): the contract (`game/assembly/Kpred.ts`), `bot/bot.ts`, `bot/desk.ts`, `bot/sponsor.ts` and `docs/UPGRADE-V6.md`. No ❓ steps are left.
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
The full list of every alert, its trigger and your actions is `ALERTS.md`. Note: every alert email is GitHub's "Run failed" email; the bot's problems, the chain watch and the sponsor alert all arrive in the **same** "Run failed: Kpred bot" email (open the run to read the "Needs attention" lines). Sponsor alerts repeat every hour while true.

| You get | From | Means | Go to |
|---|---|---|---|
| GitHub email "Run failed: Kpred bot" | the hourly bot (`bot.yml`) | one run failed. Usually a node hiccup: it catches up next hour | §2 if a second run in a row fails |
| Bot email listing **problems** (e.g. "results not ready … due …", "can't be read", "refused") | the bot's problem list | a game's week is held or a send was refused. Each line names the game, week and deadline | §3 |
| Bot email "…your admin key is compromised" / "Desk owner change … cancel it and withdraw the Desk" / "upgrade announced" | the bot's chain watch | an owner-level change is pending on chain. **Expected** during your own wallet moves or upgrades (`docs/WALLETS.md` lists them) | if you didn't do it: §7 |
| GitHub email "Run failed: Node watchdog" | `watch.yml` (every 15 min on paper, about hourly in practice) | your personal producer hasn't signed for 30+ min: the PC, Docker or the internet is probably down. One email, then a reminder every 3 h | §5 |
| GitHub email "Run failed: Heal alert" | your PC's self-heal or question-release task | a node was restarted or repaired, Docker is down, a node can't be fixed, or a round's questions aren't out | `ALERTS.md` §7; §5 / §6 below |
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
| "Producer Race vault week N … is HELD" (the **Producer race** run fails, D-107) | the Race's results for that week aren't final. From Week 1 (D-125) they're pending through Sunday (the review day) and go final at about 00:37 UTC Monday (Sun 4:37 PM PT); it alerts if still not final 3 h after the week. The alert says why: still not final 15 h after the week (stakes unreadable, nodes disagree, results keep changing), **your own hold**, a bad `RACE_HOLD_WEEKS` value, or the publish job held the file | follow the options in the alert: (1) **wait** if it says it clears by itself; (2) **hold it longer** while you check: GitHub → Settings → Secrets and variables → Actions → Variables → `RACE_HOLD_WEEKS` = the week number; (3) **release your hold**: remove the week from `RACE_HOLD_WEEKS` (it goes final on the next runs); (4) **give up on the week**: `npm run bot -- game-void 7 <week>` (dry run), then `--send`. Unsure: tell the Race chat with the alert text |
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
2. **Start the bot on GitHub by hand:** GitHub → **Actions** → **Kpred bot** → **Run workflow** (branch `main`) → **Run workflow**. It takes a few minutes; it releases the question and does the hour's other work.
   - Don't use `npm run bot -- tick` on the PC to release: since D-084 the PC has no operator key, and a real `tick` stops at once with "OPERATOR_WIF is missing". `npm run bot -- tick --dry-run` still works and shows what the bot would do (read-only).
   - Never put the operator key on the PC to get around this (D-084).
3. A late question still counts once released. Tell the Questions chat.

## 7. A key may be stolen, or a change you didn't make is pending
**First:** don't send anything that uses the suspect key. Then:

| Key | What a thief could do | What to do |
|---|---|---|
| **Operator** (`OPERATOR_WIF`, GitHub only) | post wrong results for at most a week of one game, which you can correct in 24 h; it can't move funds | replace it: `npm run bot -- admin set_operator operator=<new address> --as owner` (dry run, then `--send`); update the GitHub secret `OPERATOR_WIF` (Settings → Environments → `bot`); correct any bad results (§3) |
| **Owner** (cold after the moves, D-083) | **at once:** take the waiting 5% fee; change the operator; pause; stop games; correct or void sealed weeks (24 h window). **After a wait:** an upgrade (48 h), a new game (48 h), take over ownership (a day). It can **never** take stakes without an upgrade | see **§7a** below. Tell the Vault chat at once |
| **Sponsor** (`SPONSOR_WIF`, 25,000 KOIN, no timelock, D-085) | move the sponsor's KOIN at once | see **§7b** below |
| **Seed owner** (`1K8VV…`) | start a seed withdrawal (48 h timelock) | Vault chat at once; the seed owner change takes two steps 28,800 blocks apart |
| **Desk treasury / Desk owner** | the treasury only receives; owner changes take 48 h | Vault chat; `npm run desk -- owner cancel` / `treasury cancel` (dry run first) |

A pasted key is a leaked key: rotate it even if nothing happened (D-003, D-042).

### 7a. The vault owner key is stolen (or an upgrade / owner change you didn't make is pending)
**The hard truth:** you and the thief now have the same power. The vault has no "real owner wins" button. What you have:
- **Time:** an upgrade waits 48 h; an owner change waits 28,800 blocks (about a day).
- **Cancel / replace:** `cancel_upgrade` clears a pending upgrade, and a new `propose_owner` replaces a pending one. But the thief can do the same, and each new announcement restarts its clock.
- **Withdrawals never close:** every stake can be taken out at any time, whatever the owner does. That is the real defence.

Do these in order. Each one: run it once without `--send`, read it, then again with `--send`. Load the owner key into `.env` only for this, then take it out (§0).
1. **Take the fee before the thief does** (it has no timelock). Send it to a wallet you control that is **not** the owner:
   ```powershell
   npm run bot -- claim-fee-vhp <safe wallet address> all
   npm run bot -- claim-fee <safe wallet address>
   ```
   `claim-fee-vhp` refuses by itself when no fee is owed. `claim-fee` is the old KOIN fee: run it only if `status` shows one (the "producer fee" on the Owed line).
2. **Stop new money:** `npm run bot -- pause on`, then with `--send`.
3. **Cancel a hostile upgrade:** `npm run bot -- admin cancel_upgrade --as owner`, then with `--send`. Check with `npm run bot -- status`.
   **Repeat this every time the bot emails "A code upgrade is scheduled".** Each new announcement restarts the 48 h, so a cancel within 48 h always works. Read the email the day it arrives.
4. **Replace a hostile owner change:** propose a **fresh** address you control (new Kondor profile, new recovery words; not the stolen one):
   `npm run bot -- admin propose_owner new_owner=<fresh address> --as owner`, then with `--send`.
   Your proposal replaces the thief's. If the thief proposes again, propose again: it can only be accepted a day after the **latest** proposal. When a day passes with yours still pending, accept it from the fresh wallet (`docs/WALLETS.md`, the accept step). Accepting also wipes any pending upgrade.
5. **Put your operator back** if the thief changed it (the bot emails "The game's operator is …"):
   `npm run bot -- admin set_operator operator=<the GitHub operator address> --as owner`, then with `--send`.
6. **Tell players to withdraw** (site banner, Discord) and stop the games: `game-stop <id>` for each. Stakes, finished prizes and claims stay open whatever happens.
7. **Afterwards:** a stolen owner key can't be "un-stolen". Once the stakes are out, the Vault chat plans the next step with you (a new vault, or a handover once the thief stops). Rotate every other key that was on the same PC.
- **Watch for:** "producer key … not …" (the thief registered its own block key: blocks still pay the vault, but your node stops producing; the Vault chat writes the fix), "seed owner", and "operator" emails. The bot emails each one once.
- **The Desk** has `cancel_owner`: `npm run desk -- owner cancel`, then with `--send`. Then withdraw the Desk to the treasury (the Desk chat writes the exact command).

### 7b. The sponsor key is stolen
The thief can move the sponsor's KOIN at once (no timelock; risk accepted, D-085). The only defence is speed:
1. **Move what's left** to a safe wallet in Kondor, signed with the sponsor key (the sponsor is a normal wallet for KOIN transfers). A KOIN transfer needs as much Mana as the amount, so move the most Kondor allows now, and the rest as its Mana comes back (it refills in about 5 days).
2. **Switch the sponsor off:** `npm run sponsor -- disable`, then with `--send` (this also uses the sponsor key).
3. **Make the site stop asking the sponsor to pay:** `npm run sponsor -- payer self`. It edits `game-data` and `desk-data` `deployment.json` on the PC; commit and push them on a branch, and merge the PR. Until it is merged, sponsored sends fail and players see a Mana error.
4. Players then pay their own Mana. Every stake and claim still works (D-027).
5. A new sponsor needs a new upload and new KOIN: the Vault chat plans it with you.

## 8. The sponsor is running out
1. `npm run sponsor -- status` shows today's use against the caps (since 4 Nov: 40 a day / 250 a week per wallet, 5,000 a day in total, 2,000 a day for free players; the live values are in `SPONSOR.md` §2).
2. Running out today only means some players pay their own Mana until midnight UTC; nobody loses anything.
3. To change caps, pass **all of them exactly** (a plain `config` resets them): the full command line, rollback and emergency steps are in `SPONSOR.md` §5–6.

## 9. The last resort: the withdrawals-only build (vault)
Only if the vault itself is wrong and everything must stop. It keeps the same address and storage. Every stake, finished prize and the fee can still be taken out; deposits, moves and new weeks stop; recording results stays open. Full steps in `docs/UPGRADE-V6.md` → "Emergency: the withdrawals-only build" (checked 4 Nov against the code: the commands and the pinned safe-build fingerprint `safeWasmSha256` in `deployment.json` match):
0. Build it on the PC: `cd game; npm run build:safe; cd ..`. It prints `sha256 …`; `upgrade schedule --safe` refuses a build whose fingerprint isn't the pinned one.
1. `npm run bot -- pause on --send` and `game-stop <id> --send` for any misbehaving game. Optional: `npm run bot -- admin set_sponsor_limit max_sponsor_rc=0 min_sponsor_rc=0 --as owner --send` keeps the vault's own Mana for withdrawals.
2. `npm run bot -- upgrade schedule --safe`, then again with `--send` (starts the 48 h). If the owner key may be stolen, read §7a first: the thief can cancel this.
3. Let the bot settle and seal every ended week.
4. 48 h later: `npm run bot -- upgrade apply --safe`, then `--send`.
5. Tell players on the site: withdraw any time.

**Never roll back to v5**; the vault refuses it anyway. Decide this step with the Vault chat, never alone at 3 AM.

## 10. After any incident
- Write down what happened, when (UTC), what you ran and what it printed. Paste it to the library chat.
- Check: `npm run bot -- status`, `games`, `chain-check`, `npm run sponsor -- status`, `npm run desk -- status`.
- The library chat adds an I-xxx issue, updates this runbook if a step was missing, and adds work to `CHAT_REQUESTS.md`.
