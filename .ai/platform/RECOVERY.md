# Knode Games — PC Disaster Recovery

> **Purpose:** what to do if the owner's PC goes off, breaks, dies or is stolen: what keeps running without it, what stops, and how to get back, in order, with how long each step takes. It answers the health check's risk #1 (`HEALTHCHECK.md` §2a, TD-08).
> **One home:** this page is the home for **recovering from losing the PC**. A planned move to a new PC (old PC still working) is `../../docs/MIGRATION.md`; a single alert or node hiccup is `RUNBOOK.md`; who controls which wallet is `KEYS_AND_ROLES.md`.
> **Last updated:** Thu 5 Nov 2026 (made public-safe: key backup details and the compromise order moved to the private notes; handover dates in `CALENDAR.md`). Built 4 Nov from `docs/MIGRATION.md`, `RUNBOOK.md`, `PLATFORM.md` (the owner's PC), `ARCHITECTURE.md` (infrastructure), `bot/heal.mjs`, `bot/release-kick.mjs`, `node/setup-node.ps1`, `docs/WALLETS.md` and `KEYS_AND_ROLES.md`. **Not yet rehearsed** — times marked ❓ are estimates.
> **Private part:** the list of which keys are backed up and how, and the key-compromise order with each key's value, are in the owner's private notes (Claude project `claude/private/RECOVERY-FULL.md`). This public page keeps the steps.
> **Golden rule:** **players' stakes never depend on the PC.** They sit in the vault on chain and are always withdrawable. Losing the PC costs block rewards and convenience, not players' funds — unless the PC's keys are stolen (§5).

---

## 1. What lives where

| Piece | Lives on | Without the PC |
|---|---|---|
| Vault, Desk, Picks, Race picks, sponsor contracts | Koinos chain | ✅ keep working: players can stake, withdraw, claim, pick, answer, swap |
| Website (knodegames.com) | GitHub Pages | ✅ keeps working |
| Hourly bot: questions, results, seals, payouts, compounding, sponsor watch, chain watch | GitHub Actions (`bot.yml`) | ✅ keeps working (it needs only `OPERATOR_WIF` on GitHub) |
| Game recorders and publish jobs (Block X, Race), VHP sampler, @names refresh | GitHub Actions | ✅ keep working |
| **Node watchdog** (`watch.yml`) | GitHub Actions | ✅ keeps working — it is what **tells you** the PC is down |
| **Game / pool node** — produces blocks for the **Knode Games Pool** (the vault) | the PC (Docker) | ❌ **stops**: the pool produces no blocks, so **that week's rewards shrink** for every game |
| **Desk node** — produces blocks for the Swap Desk | the PC | ❌ stops: the Desk's KOIN stops refilling; swaps still work while KOIN lasts |
| **Personal node** — the owner's own producer `1DAHmr…` | the PC | ❌ stops (owner's own rewards) |
| **Self-heal task** ("Knode self-heal", every 20 min) | the PC (Task Scheduler) | ❌ stops (nothing to heal) |
| **Question release backup** ("Knode question release", 11:45 – 14:05 UTC) | the PC | ❌ stops: only GitHub's own 11:48 UTC run releases questions (GitHub sometimes starts late; it did by 38 min on 28 Oct) |
| **Admin keys** (owner, seed, sponsor and the PC's alert token) | the PC, with an offline backup | ❌ no owner actions until restored from the backup: no `game-apply`, corrections, fee claims, sponsor changes, upgrades |
| Admin page (`npm run admin`) | the PC | ❌ unavailable |
| Audit and practice folders (`C:\kprediction-test`, `-fantasy`, `kg-combo-preview`) | the PC | ❌ re-clone; nothing in them is unique ❓ |

**The one-line summary:** a dead PC means **fewer blocks and no owner actions**, not lost funds. A **stolen** PC means treat every key on it as stolen (§5).

---

## 2. Be ready before anything happens (do these once)

| # | Prepare | Why | State |
|---|---|---|---|
| 1 | **An offline backup of every key you'd need to rebuild `.env`** (the list and its state: private notes) | `.env` can't be recovered from a dead disk; GitHub never holds them | private notes |
| 2 | Know which **Kondor wallets** come back from which recovery words (personal producer, owner's daily wallet) | rebuilding Kondor on a new PC | 👤 |
| 3 | A **second machine you could use** (another PC, or a cloud server ❓) with ~300 GB free SSD | two big nodes need the space during setup | ❓ owner to decide |
| 4 | **An offline backup of each node's producer key** | with a backup, a new PC can produce **at once** with the same key; without, the **Desk needs a 48 h wait** to register a new key (the pool's re-register is immediate). Only one machine may run a given key at a time | owner: yes (4 Nov); scripts in R-VAULT-10 (#178) |
| 5 | GitHub: a **second way into your account** (2FA recovery codes, kept offline) | GitHub holds the bot, the site and the secret | ❓ |
| 6 | This page and `KEYS_AND_ROLES.md` printed, or readable from your phone | the PC holding the instructions is the thing that broke | — |

---

## 3. Scenario A — the PC is off for a while (power cut, internet down, Windows update, sleep)

**How you'll know:** the **Node watchdog** emails "Run failed: Node watchdog" (your personal producer silent 30+ min), then every 3 h. Possibly "Run failed: Knode Games bot" if a question release needed the backup.

1. **Nothing urgent for players.** Stakes, the site and the bot keep working.
2. When the PC is back: Docker Desktop starts by itself (if set to start at sign-in); the self-heal task restarts any frozen node within 20–60 min.
3. Check (read-only):
   ```powershell
   cd C:\kprediction
   git branch --show-current
   $env:RPC = "https://koinos.armana.io"
   npm run bot -- node-status
   npm run desk -- node-status
   npm run bot -- node-status personal
   ```
   Each should say caught up. A node far behind catches up on its own (minutes to hours, depending on how long it was off ❓).
4. If a question was missed at 12:00 UTC: `RUNBOOK.md` §6.
5. **Cost:** blocks not produced while off. A 4-hour outage is about 4 / 168 ≈ 2.4% of a week's pool blocks ❓ (rough; depends on VHP share).

**Prevent it:** power settings "never sleep when plugged in" ✅ (`MIGRATION.md` B.2); a small UPS for short power cuts ❓.

---

## 4. Scenario B — the PC is dead (disk, motherboard), keys safe in the offline backup

**Goal:** get the **game/pool node** producing again first (it earns for every game), then the Desk node, then the personal node and the PC tasks.

| Step | What | Time ❓ | Needs |
|---|---|---|---|
| 0 | **Tell the Vault and Hub chats** (or the Librarian) — they hold the commands; nothing on chain is urgent | 5 min | — |
| 1 | Set up the replacement machine: Git, Node.js LTS, Docker Desktop (start at sign-in), power "never sleep" | 1 h | replacement machine |
| 2 | Clone the repo: `git clone https://github.com/bawcejawn/KnodeGames C:\kprediction`, then `cd C:\kprediction`, `npm ci --ignore-scripts` | 15 min | internet |
| 3 | **Rebuild `.env` from the offline backup**, one key at a time, only the ones needed now (owner key for re-registering; nothing else yet). Never type a key into a chat. Check with `npm run bot -- status` that each address printed matches `KEYS_AND_ROLES.md` | 20 min | the offline backup |
| 4 | **Game / pool node:** `powershell -ExecutionPolicy Bypass -File node\setup-node.ps1 -Producer 1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr -SnapshotSha256 <hash from a second source> -KeepArchive` | snapshot download (~60 GB) + unpack + catch-up: **several hours** | ~150–300 GB SSD |
| 5 | When `npm run bot -- node-status` says caught up: **register the new key** — `npm run bot -- register-key node` (dry run shows the **new** public key), then with `--send` (and `CONFIRM_MAINNET=yes`). The pool produces about a minute later | 5 min | owner key in `.env` |
| 6 | **Desk node:** the same setup in `C:\kpred-desk-node` for the Desk `1FKTpX…`, then `npm run desk -- register-key node --send`, then **wait 48 h** and `npm run desk -- settings apply --send` ❓ (exact desk-node setup steps: Swap Desk / Vault chat to confirm) | hours + **48 h** | owner key |
| 7 | **Personal node:** `MIGRATION.md` §D (new address or the same one, register on `producer.html`) | hours | Kondor from recovery words |
| 8 | **PC tasks:** create a new fine-grained `GITHUB_ALERT_TOKEN` (repo only, Actions read and write), add it to `.env`, then `powershell -ExecutionPolicy Bypass -File node\install-heal.ps1` and `node\install-release-kick.ps1`; test with `node bot\heal.mjs --test-alert` | 20 min | GitHub login |
| 9 | **Take owner keys back out of `.env`** (action-day rule, D-083); revoke the old `GITHUB_ALERT_TOKEN` in GitHub | 5 min | — |
| 10 | Check everything: `npm run bot -- status`, `games`, `chain-check`, `npm run desk -- status`, `npm run sponsor -- status`. Send the output to the Vault chat. Tell the Librarian (session-end report) | 15 min | — |

**Total ❓:** the pool producing again in **roughly half a day to a day**; the Desk producing **2–3 days** later (the 48 h key wait) unless its old key was backed up (§2 #4).

**While it's down:** owner deadlines still run on chain. Check `TODOS.md` for anything due (a `game-apply` deadline, a 24 h correction window, a pending handover accept). If a deadline would be missed, the vault's rules make it safe: an unapplied game simply doesn't earn yet; an unsealed week rolls over (`RUNBOOK.md` §3).

---

## 5. Scenario C — the PC is stolen, or someone else got into it

**Treat every key that was in `.env` as stolen**, even if nothing has happened yet (D-003, D-042). Use **another device** and your offline backup. Act on the fastest-acting keys first, in the order in your private notes (`claude/private/RECOVERY-FULL.md` §5); `RUNBOOK.md` §7 has the commands. In short: switch the sponsor off and move its funds, protect the owner role (propose your own address again, pause, Desk `owner cancel`), tell the Vault chat about the seed owner, revoke the PC's GitHub token, change the GitHub password and rotate the operator key, then register new producer keys.

Then rebuild as in Scenario B, with **new** keys where you replaced them, and update `KEYS_AND_ROLES.md`.

---

## 6. Scenario D — one node keeps breaking (PC fine)

The self-heal task handles most of it (`bot/heal.mjs`):
- a frozen node (200+ blocks behind and not moving, or not answering twice) → full restart; waits 50 min before restarting it again;
- 3 restarts in 6 h without a fix → stops and **emails you**;
- a block store that keeps crashing → **auto-repair**: copies block data from a healthy node (one repair at a time, at most once per node per 24 h); emails before and after; off switch `HEAL_AUTO_REPAIR=off`.

If it emails that it can't fix a node: open Docker Desktop, check the three containers; `node\heal.log` and `node\repair-<node>-<time>.log` say what happened. Paste the last lines to the Vault chat. **Never delete `basedir\block_producer`.** Manual repair: `node\repair-node-data.ps1` (ask the Vault chat first).

---

## 7. Scenario E — services outside the PC fail

| Fails | Effect | Do |
|---|---|---|
| **Armana RPC** (`koinos.armana.io`, the bot's main node) | bot runs fail and catch up next hour | wait; by hand use `$env:RPC = "https://api.koinosblocks.com"`. A permanent second RPC is open (TD-10) |
| `api.koinos.io` (the site's reads) | site reads may fail or show HTML errors | the site's RPC choice is open (I-006, I-015) |
| **GitHub Actions** | no questions, results or payouts until it's back; deadlines: results have 3 days after a week ends, then the week rolls over safely | wait; nothing to do on chain. If it's over a day near a deadline, tell the Vault chat |
| **GitHub account locked** | no merges or secret changes; site and bot keep running | GitHub account recovery (2FA codes, §2 #5) |
| **GitHub account suspended** (6–9 Nov 2026) | site, bot, recorders and emails all stop; stakes stay withdrawable on chain; weeks close late; rounds whose answers would close within the hour are skipped, not posted late | wait. **When it's back:** (1) Actions → each scheduled workflow → ⋯ Disable workflow, then Enable workflow (GitHub doesn't restart schedules by itself; the PC's heartbeat starts the bot meanwhile); (2) run "Knode Games bot" once by hand; (3) expect late closes: a week closes 12 h after its latest result, and the bot says so as a notice, not an alarm |
| Snapshot server (`snapshots.armana.io`) | a new node must replay the chain (much slower ❓) | get the snapshot and its hash from a second operator |

---

## 8. Gaps this page leaves (to close)

- **Not rehearsed.** A dry rehearsal on a spare machine (without registering any key) would turn the ❓ times into facts.
- `docs/MIGRATION.md` is out of date: it clones the old repo name (`bawcejawn/knode`), covers only two nodes (no Desk node), and expects 47 game tests. Vault chat to refresh it.
- The Desk node's exact rebuild steps (folder, Docker project, `register-key`, `settings apply`) aren't written anywhere; Vault / Swap Desk chat to add them.
- Owner decisions: a replacement machine (§2 #3; one PC for now, D-147).
