# Knode Games — Alert Catalogue

> **Purpose:** every alert the platform can send the owner: what triggers it, how it reaches you, how often, what it means, and **what you can do about it** (D-107: an alert must name the owner's actions, not only notify). Also the conditions that are **silent** today, so nobody assumes they're watched.
> **One home:** this page is the home for **the list of alerts**. What to do in a real emergency stays in `RUNBOOK.md` (it points here); the emails expected during the wallet moves are in `../../docs/WALLETS.md` §6.
> **Last updated:** Thu 5 Nov 2026 (status sync: Race held-week alerts merged in #133; sponsor numbers point to `SPONSOR.md`). Built 4 Nov from a read of every workflow (`.github/workflows/*.yml`), `bot/bot.ts`, `bot/vault.ts`, `bot/sponsor.ts`, `bot/watch.mjs`, `bot/heal.mjs`, `bot/release-kick.mjs`, `bot/games/*`, `bot/race.ts`, `bot/names.ts` and the node install scripts, on `main` @ `38702c4`. File:line references are to that commit.
> **Update rule:** any PR that adds, removes or rewords an alert updates this page in the same PR (the game chats and the Vault chat). The Librarian checks it at each weekly review.

---

## 0. Got a "Run failed" email? Three steps

1. **Open it** → **View workflow run** (or GitHub → Actions → the red run).
2. **Read the red lines at the top of the run page** marked **"Needs attention"** (or the step with the red ✖). Each line is one alert. Copy the first few words.
3. **Find those words in this page** (Ctrl+F) — the row tells you what it means, whether it was expected, and what to do. If you can't find it, paste the red lines (never `.env`) to the Vault chat.

**The quick rules:**
- **Players' stakes are never at risk from an alert by itself.** The worst case of a held or late week is that it **rolls over** to the next week.
- **If you just did an owner step** (a `game-apply`, a wallet move, a pause, an upgrade), the email is most likely the expected echo of it (§2 and `docs/WALLETS.md` §6).
- **One email can hold several alerts**; the next hour's run may already be green.
- A plain-language summary at the top of each failed run (what happened, does it matter, what to do) is on the way (R-VAULT-9).

## 1. How alerts reach you
> The bot workflow is named **"Knode Games bot"** since PR #131 (merged); older emails say "Kpred bot".

- **The repo sends no email of its own.** Nothing uses a mail server. **Every alert email is GitHub's "Run failed" email** for a workflow run that failed on purpose.
- **One failed run = one email, whatever is inside it.** The bot's problem list, the chain watch and the sponsor alert all arrive inside the **same** "Run failed: Knode Games bot" email. Open the run (Actions → the red run) to read the lines marked **"Needs attention"**. ❓ Whether GitHub's email body shows those lines is unchecked; the run page always does.
- **A yellow warning (`::warning::`) or a notice never emails.** The run stays green. Those are the **silent** cases in §10.
- **Who gets the email** is decided by GitHub, not by the repo:
  - scheduled runs → the account that last changed that workflow's schedule line ❓ (check that it's yours);
  - runs started by your PC (heal alerts, the release backup) → the owner of `GITHUB_ALERT_TOKEN`;
  - push and PR test runs → whoever pushed.
  - Check: GitHub → Settings → Notifications → **Actions** must be on for email.
- **Repeat pattern:** "once per change" alerts email once and again only if the condition clears and comes back. "Every run" alerts email **every hour** while the condition lasts.

**Email subjects you can get:**

| Subject | Workflow | Section |
|---|---|---|
| Run failed: **Knode Games bot** | `bot.yml` (hourly, 11:48 and 23:48 UTC) | §2 – §5 |
| Run failed: **Node watchdog** | `watch.yml` (scheduled every 15 min) | §6 |
| Run failed: **Heal alert** | `heal-alert.yml`, started by your PC | §7 |
| Run failed: **KnodeGames recorders** (Block X) | `games.yml` (hourly at :47) | §8 |
| Run failed: **Producer race** | `race.yml` (hourly at :37) | §8 |
| Run failed: **Race VHP samples** | `race-samples.yml` | §8 |
| Run failed: **Knode Games names** | `names.yml` | §8 |
| Run failed: a test workflow | `test.yml`, `*-test.yml`, `workflow-guard.yml` | §9 |

---

## 2. Knode Games bot — chain watch (owner-level changes) · once per change

The bot compares the chain with the records on `main` (`game-data/deployment.json`, `desk-data/deployment.json`). **If you made the change, it's expected** and stops once the records PR is merged. **If you didn't, act at once.**

| Alert (text starts) | Trigger | Expected when | If you did NOT do it |
|---|---|---|---|
| "A code upgrade is scheduled (possible from …)" | vault upgrade announced | `upgrade schedule` (incl. `--safe`) | 48 h to react: Vault chat now; `RUNBOOK.md` §7 |
| "A seed withdrawal is scheduled…" | seed withdrawal announced | `seed-withdraw` | Vault chat; seed-owner change (cancels it) |
| "An ownership transfer to X is pending…" | vault `propose_owner` | weekend step 4a | **propose your own address again** (`docs/WALLETS.md` §3) |
| "A seed handover to X is pending…" | `propose_seed_owner` | seed move | `admin propose_seed_owner … --as seed --send` (your own) |
| "The game's owner / seed owner / operator is X, not Y…" | chain ≠ records | after an accept or rotation, until the records PR is merged | key may be stolen: `RUNBOOK.md` §7 |
| "Owner settings: …" | min stake, sponsor limit, paused, or any owner setting changed | `pause on`, stake or limit changes | undo the setting; check the owner key |
| "The block-producer key registered for the game is…" / "has no producerKey" | pool key differs from records | `register-key node` | register your node's key again |
| "The game contract on chain is not what deployment.json records…" | code or switches differ | after `upgrade apply`, until `wasmSha256` is recorded | Vault chat at once |
| "A game is announced: id N…" | `propose_game` | `game-add` | Vault chat; it can't earn until applied |
| "The vault's game list changed…" | game added, stopped or restarted | **`game-apply`, `game-stop`** | Vault chat |
| "The owner corrected results for … week N" / "voided … week N" | correction or void | `game-correct`, `game-unprize`, `game-void` | check the owner key |
| "Orphan question #N … has outcome …" | a question with no file resolved oddly | never | Questions chat; operator key may be stolen |
| "The Desk's owner / treasury is X, not Y…" | Desk ≠ records | weekend steps 5b / 2b | `RUNBOOK.md` §7 |
| "A Desk code upgrade is scheduled…" | Desk upgrade | Desk upgrade | 48 h; Vault chat |
| "A Desk treasury change to X is scheduled…" | treasury change | step 2a | `npm run desk -- treasury cancel --send` |
| "A Desk owner change to X is proposed… cancel it…" | Desk `propose_owner` | step 5a (**then do nothing**) | `npm run desk -- owner cancel --send`, withdraw the Desk to the treasury |
| "A Desk settings change is waiting…" | fee, cap or key change pending | Desk settings changes | `npm run desk -- settings cancel --send` |
| "The Desk: …" (fee, timelock) | Desk settings changed | Desk config | check the owner key |
| "The Desk's KOIN fell by…" | KOIN left the Desk beyond swaps | an owner withdrawal | check the owner key |
| **"Swaps took … pause the Desk"** | swaps took > 50% of the float in one hour | never | `npm run desk -- pause on --send`, then ask the Vault chat |
| "The Desk contract on chain is not what … records… act now." | Desk code or switches differ | Desk upgrade | Vault chat at once |

> `docs/WALLETS.md` §6 lists only the wallet-move emails. The **game-list**, **owner settings** and **code fingerprint** alerts above are also expected after `game-apply`, `pause` and upgrades.

---

## 3. Knode Games bot — running problems · **every hourly run** while true

| Alert (text starts) | Trigger | What you can do |
|---|---|---|
| **"The pool has produced no block for N min"** | the Knode Games Pool silent > 60 min (or a 1-in-1,000 luck gap) | check the game/pool node: `npm run bot -- node-status`; `RECOVERY.md` §3 |
| "… is still unresolved N h after its window ended" | a question result > 6 h late | `npm run bot -- pause on --send` and `void <id> --send` if it can't resolve; Questions chat |
| "Week N is overdue to close" | 3 h past the normal close | wait one run; then Vault chat |
| "The contract's operator is X, not this bot" | operator ≠ `OPERATOR_WIF` | expected after an operator rotation until the GitHub secret is updated |
| "The bot's wallet … is low on Mana" | bot wallet `1HsM33…` below 2 Mana | send it KOIN (target ~50, I-046) |
| "The contract is low on Mana … no recent compound explains it" | vault Mana drained | Vault chat |
| "Week N: … staked player(s) are still not settled" | settling incomplete | Vault chat |
| "A transaction failed: …" / "<step> failed: …" | a bot send failed | usually a node hiccup; if it repeats, paste to the Vault chat (`RUNBOOK.md` §2) |
| "the two nodes disagree … One node is wrong or lying" / RPC_CHECK unreadable | the two-node check failed | wait a run; if it repeats, Vault chat (TD-10) |
| Question file / params hash / VHP list mismatch; result changed on chain; resolver failed; generator failed; no fair questions; day file not sealed by this bot; week slot full | question pipeline problems | Questions chat; don't post by hand |
| "bot-state.json … was not written by this bot" | state file distrusted | fires once; tell the Vault chat |

---

## 4. Knode Games bot — vault results checks (paying the games)

**Once per game, week and kind**, plus one reminder under 12 h before the deadline. Every hold says the safe outcome: if nothing is fixed, the week **rolls over** (stakers' bucket stays in the game, free prize back to the pool). Deadline: results are due **3 days** after the week ends (Mon 00:00 → Thu 00:00 UTC; the whole week's timing: `../standards/WEEK_CYCLE.md`).

| Alert | Trigger | What you can do |
|---|---|---|
| HOLD file | a game published `HOLD-W<n>.json` and no release | the game's chat decides; Last Node: `LASTNODE_RELEASE_WEEKS` |
| hold / release file unreadable | file can't be read | game chat |
| late | results first seen < 2 h before the deadline | `npm run bot -- game-post <id> <week>` (dry run first) once the chat confirms |
| changed | a final file changed after the first read | **don't post**; game chat + Vault chat; then `game-post` |
| refused | the vault reverted a send | paste to the Vault chat; don't retry by hand |
| board / staked-list / not-on-board / order | results don't match the game's published board | game chat (R-ALL-3) |

**Every hourly run:**
| Alert | When | What you can do |
|---|---|---|
| "results are not ready (…) and are due …" | **only in the last 12 h** before the deadline (before that: silent, §10) | game chat; under 12 h it's urgent |
| "already has N points on chain… `game-correct …`" | posted points differ | `game-correct` (owner) if the chat confirms |
| "free-prize switches can't be read" | the `prize-settings` file broken | `npm run prizes -- list`; resend the setting. Under 6 h the bot seals without free winners |
| prize winner already has a result / was staked / too many tied | free-prize list problem | game chat |
| "didn't go through" | network or Mana; retried | wait; Vault chat if it repeats |

Correcting after a seal (24 h window), `game-unprize`, `game-void`: `RUNBOOK.md` §3.

---

## 5. Knode Games bot — Mana sponsor · **every hourly run** (not de-duplicated)

| Alert | Trigger | What you can do (`SPONSOR.md` §5–6) |
|---|---|---|
| "Mana sponsor: everyone's sponsored Mana today is N% used" | > 80% of the everyone-per-day cap (live values: `SPONSOR.md`) | usually fine (players then pay their own Mana until 00:00 UTC); watch for spam |
| "Mana sponsor: free play has used N% of what is released so far today" | > 80% of the free pool released so far | lower `--free-per-day` with the **full** config line if spam |
| "the sponsor wallet has N Mana, less than … today's caps still allow" | sponsor's own Mana low | send it KOIN, or lower `--per-day` |
| "Mana sponsor watch failed: …" | couldn't read the chain | wait a run |

Also in the bot run: **publish refusals** for `game-data` ("Refusing to publish unexpected files / over 2 MB / N changed files / outside paths", "Could not push game-data/") — nothing was published; paste to the Vault chat.

---

## 6. Node watchdog (`watch.yml`) · once per outage, then every 3 h

| Alert | Trigger | What you can do |
|---|---|---|
| **"Node down? No block from your personal node for N minutes…"** | the personal producer (`PERSONAL_PRODUCER` variable, `1DAHmr…`) silent past ~30 min or its luck gap | the PC, Docker or the internet is probably down: `RECOVERY.md` §3. The pool and Desk nodes are on the same PC, so they're likely down too |

It watches **only the personal node**; the pool's silence is caught by the bot (§3).

---

## 7. Heal alert — from your PC's scheduled tasks

Your PC starts the "Heal alert" workflow, which fails on purpose so GitHub emails you. The run title names the node (or "daily questions"). Needs the PC's alert token (`GITHUB_ALERT_TOKEN`, RUNBOOK).

**"Knode self-heal"** (every 20 min, `bot/heal.mjs`, log `node\heal.log`):
| Alert | Trigger | How often | What you can do |
|---|---|---|---|
| "Docker Desktop isn't running on the PC…" | `docker info` fails | at most every 3 h | start Docker Desktop |
| "… Self-healing restarted at …" | a node frozen (200+ blocks behind and not moving, or no answer twice) | each restart | nothing; check `node-status` in ~30 min |
| "…restarted it 3 times in 6 hours … stopped trying" | restarts didn't fix it | every 3 h | open Docker Desktop; `docker compose logs --tail 40 chain`; Vault chat (`RECOVERY.md` §6) |
| "The block store keeps crashing… Repair it by hand: … repair-node-data.ps1 …" | crash loop that auto-repair can't handle | every 3 h | ask the Vault chat before running the repair |
| "Repairing the X from the Y…" / "Repair finished" / "Repair FAILED" | auto-repair | once each | on FAILED: Vault chat with `node\repair-<node>-<time>.log` |
| "This is a test of the Knode self-healing email." | `node bot\heal.mjs --test-alert` | manual | proves the email path works |

**"Knode question release"** (every 5 min, all day, `bot/release-kick.mjs`, log `node\release-kick.log`; re-run `node\install-release-kick.ps1` after the 10 Nov update):
| Alert | Trigger | What you can do |
|---|---|---|
| "The Kpred bot hadn't run since …, so the PC started it…" | heartbeat: no bot run for 75 min (at most 6 starts a day; it backs off 15 min → 4 h after a GitHub error) | re-enable the schedules (`RECOVERY.md` §7); Questions chat |
| "…today's questions are not out yet at …" | the round's file missing 20 min after release | `RUNBOOK.md` §6; Questions chat |
| "…the bot skipped today's questions (…)" | the bot logged a skip | Questions chat |

---

## 8. Game recorders and data jobs

**Block X (`games.yml`, "KnodeGames recorders", hourly at :47):**
| Alert | Trigger | What you can do |
|---|---|---|
| "Block X held a week before its prize list…" | the re-read didn't match (E4-7) — **every run** until it matches | Block X chat; the vault won't pay that week until it's released (§4) |
| "A file was held, or a published file needs your check…" | a publish check held a file (prizes differ from the board, rows out of order, points or winners mismatch, history rewritten, staked players missing, a write-once file changed) | Block X chat; nothing wrong was published |
| fetch failed / `npm run blockx` threw / publish refused | job error (e.g. "no second node", "game N is not on the Picks contract") | wait a run; then Block X chat |

**Producer Race (`race.yml`, hourly at :37):**
| Alert | Trigger | What you can do |
|---|---|---|
| race-data unreadable / `npm run race` error / publish refused / "Refusing to change vault/W…: already published as final" | job errors | wait a run; then Race chat |
| **"Producer Race vault week N … is HELD"** (the run fails, D-107) | a Race week isn't final 3 h after the week, a stored race result doesn't match the chain, or your own `RACE_HOLD_WEEKS` hold (that one emails once a day, L-4) | follow the options in the alert; `RUNBOOK.md` §3 (merged in #133, I-087) |

**VHP sampler (`race-samples.yml`):** emails if **no** sample succeeded in a run, or a publish is refused (a published sample would change or drop). → wait a run; then Race chat (the ruler and handicaps depend on these samples).

**@names (`names.yml`):** emails if a branch can't be read, `bot/names.ts` throws, a publish is refused, or "names-data changed since the check read it" (expected if you ran `npm run names -- add/hide … --send` meanwhile; rechecked next run). → Hub chat.

**Testnet games (`games-testnet.yml`):** same publish refusals as Block X; test only.

---

## 9. Tests (push and pull requests only)

`workflow-guard.yml` (the CI guard: workflow safety rules), `resolver-test.yml`, `test.yml` (vault), `desk-test.yml`, `picks-test.yml`, `race-test.yml`, `sponsor-test.yml`, `status-test.yml`. A red test blocks or flags a change; it isn't an operational alert. **Don't merge a PR with a red check** unless its chat explains why.

---

## 10. Silent today: conditions that send **no** email

| # | Condition | Effect | Fix / owner |
|---|---|---|---|
| 1 | ~~Race holds~~ — **now alert** (PR #133 merged: held weeks fail the run; the owner's own hold emails daily, L-4). Check whether the Race's publish-side holds alert too ❓ | — | Race chat |
| 2 | **Vault "results not ready"** or a malformed results file, earlier than 12 h before the deadline | log only | consider an earlier warning (Vault chat) |
| 3 | **Block X:** notice-level holds and every non-hold problem — node disagreements, missing race cards, a voided target, a 10+ tie that empties a place, "no results file within the vault's 3 days", "running on ONE node" | warning only | Block X chat to decide which should fail the run |
| 4 | **Watchdog blind:** when the public RPC can't be read or the script crashes, and when `PERSONAL_PRODUCER` is unset | warning or notice only — blind exactly when Armana is down | Hub / Vault chat; second RPC (TD-10) |
| 5 | **PC tasks can't reach you:** network down, missing or invalid `GITHUB_ALERT_TOKEN`, GitHub refused the dispatch, the script crashed; a failed release alert is **not retried** | log only; if the PC is off, only the watchdog (§6) notices | Vault chat |
| 6 | **Bot:** contract Mana low after a compound, duplicate question, publish merge warnings, block history or snapshot check failures, checkpoint commit failures | warning or log only | low risk |
| 7 | **Sampler:** single failed samples, race-data unreadable. **Names:** eligibility unknown | warning only | low risk |
| 8 | **A workflow switched off:** a `*_ENABLED` variable not `true` (`BOT_ENABLED`, `GAMES_ENABLED`, `RACE_ENABLED`, `NAMES_ENABLED`, …), or **GitHub auto-disabling schedules after 60 days with no repo activity**, or emails going to the wrong account | nothing runs, nothing alerts | owner: check notifications (§1); keep the repo active |
| 9 | **Safe mode:** overdue week closes | logged, not alerted | by design |

---

## 11. Known corrections to other pages (for the status-sync pass)

- ✅ Done 4 Nov: `RUNBOOK.md` §1 now says they're one email and has the **"Heal alert"** row.
- ✅ Done: `RUNBOOK.md` §1 says sponsor alerts repeat every hour while true.
- ✅ Done 4 Nov: `docs/WALLETS.md` §6 now lists the other expected emails (`game-add`, `game-apply`, `game-stop`, corrections, voids, pause, upgrade, key and operator changes) with what each means.
- `bot/sponsor.ts` line ~224 comment says the watch exits 0 either way: out of date (it exits 1 on an alert).
