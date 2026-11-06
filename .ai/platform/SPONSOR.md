# Knode Games — The Mana Sponsor

> **Purpose:** the Mana sponsor on one page: what it is, what it pays for, its live settings, how to check it, change it, top it up, roll it back and switch it off, and its risks. Written so the owner can act on it without asking a chat.
> **One home:** this page is the home for **the sponsor's live settings and how to operate it**. Other files should point here instead of repeating the caps (several still show the old 25 / 150 / 1 numbers — `HEALTHCHECK.md` §2b). The contract's design and audit notes stay in `../../sponsor/README.md`; the decisions in `DECISIONS.md`.
> **Last updated:** Thu 5 Nov 2026 (the daily Mana rule, §1; cap 2.4 and the per-action rows, D-131; claim choice, D-132). Sources: `sponsor-data/deployment.json`, `sponsor-data/mana-limits.json`, `game-data/deployment.json` (`sponsor`), `bot/sponsor.ts`, `sponsor/README.md`, the Block X and Vault handoffs (5 Nov).
> **Update rule:** any `config`, `upload`, `enable` / `disable` or top-up → update §2 the same day (the Block X chat owns the sponsor tool; the Librarian files the change).

---

## 1. What it is, in plain words

Every Koinos transaction costs **Mana**, which comes from holding KOIN. New players often have no KOIN, so Knode Games runs its own **Mana sponsor**: a small contract on its own wallet that agrees to pay the Mana for players' game actions. The page asks the sponsor first ("would you pay?"); if it says yes, the sponsor pays; if no, the player's own wallet pays (one more confirmation in the wallet).

- It **only pays Mana**. It never signs, moves or holds anything for players.
- It holds **only its own KOIN** (RULES 8, D-061). Its Mana is its KOIN balance, which refills about a fifth a day: **25,000 KOIN ≈ 5,000 Mana a day**, matching the daily cap.
- **Withdrawals never depend on it** (D-027): if it's off or capped, players pay their own Mana and can still withdraw.
- It is the **only payer** for players (Mana Station is shelved, D-053). The vault itself pays Mana for no one (`max_sponsor_rc` = 0, D-099).
- **KOIN Vault** (the mobile wallet) picks its own payer, so its users never use the sponsor (I-007).

### The daily Mana rule (owner, 5 Nov 2026 — every game, every action)
- **Every player address has one daily Mana budget: 40 Mana a day, shared across every game and every action** — picks, answers, stakes, moves, claims, withdrawals, settles. No game or action has its own separate budget.
- **Use it or lose it** (owner, 5 Nov): the budget starts again at 00:00 UTC every day and nothing carries over. There is no weekly cap: the contract still needs a weekly number, so it is set to 7 × 40 = 280, which a player can never reach (§2).
- **Inside that budget the sponsor pays everything a player does on Knode Games.** Once it is used up, the player pays with their own Mana until 00:00 UTC (the page asks once more in the wallet). Withdrawals always work either way (D-027).
- A new game or action **must** get a sponsor row (§2) and count against this same budget. It never gets a budget of its own, and a game never raises the per-player cap for itself.
- Two limits sit above it and don't change the rule: one transaction can ask for at most 2.4 Mana, and everyone together gets at most 5,000 a day (free players 2,000 of it).
- **Free players** (no stake in the call's game, which today includes every hourly Block X pick) count against their own 40 a day **and** the shared 2,000-a-day free pool (Repo Lens #E-23 I-2; owner 5 Nov: "ok").
- **Moving stake** (`move_stake`) is covered (owner, 5 Nov: "cover them"; replaces D-027). The contract always allowed it; the page now asks the sponsor for it too.
- **Knode Swap** is to be covered too (owner, 5 Nov), but sponsor v3 refuses swaps in its code (audit SP-24), so it waits for the **next sponsor version** (with R-BX-5, game 12 → vault game 2). A swap names no game, so it would count as free play (the 2,000 pool) as well as the swapper's own 40.

---

## 2. Live settings (since 4 Nov 2026; checked 5 Nov)

| Setting | Value | Since / source |
|---|---|---|
| Address (contract and wallet) | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | — |
| Code | v3 guest-fix **`b84e1add3ffa14a7d1933d5ce5a4ad33caa4bca887a489f87f710b3c121c83a6`** ✅ | 4 Nov 07:27 UTC, upload tx `0x122093bb…c340` |
| Chain switches | pays for transactions **ON**; calls and uploads **not** overridden (stay with its own key) | checked by `status` |
| Switched | **ON** | — |
| **Vault switch** (`game_has_vault`) | **ON** (tx `0x12208deb…6f81`, 4 Nov) | lets it pay vault calls (`deposit_to`, `withdraw_from`, `move_stake`, `claim_game`, `finalize_game_week`) |
| Per transaction | **2.4 Mana** (D-131; was 1.5) | config tx `0x1220a593…1bfc` (4 Nov), read back on chain; site side #158 |
| Per player per day | **40 Mana** | D-105 (was 25) |
| Per player per week | **280 Mana** (7 × 40, never reached: daily only), set 5 Nov (`0x1220a4fa…81f4c`) | D-169 (was 250, D-105; 150 before) |
| Everyone per day | **5,000 Mana** (the v3 ceiling, `CAP_LIMIT`) | D-061 |
| Free players per day | **2,000 Mana** of the 5,000, **released by the hour** (~83 an hour) | D-061 |
| Real player | a wallet with **≥ 1 VHP of active stake this week** in the call's own game (`--min-vhp 1`); holding VHP doesn't count | v3 |
| KOIN held | **25,000 KOIN** (may grow) | D-061, D-076, D-085 |
| What it covers (`game-data/deployment.json` → `sponsor.covers`) | vault `1Mpmf2…`, VHP `12Y5vW…`, KOIN `19GYjD…`, Race picks `1EN7xU…`, Picks `1LmgqB…` | ✅ |

### Per-action Mana limits (on chain as 8 `mana_caps` rows and in the site files, D-131, #158)
| Action (contract) | Limit | Measured through the sponsor |
|---|---|---|
| Block X pick (Picks `1LmgqB…` `pick`) | **1.3** | 0.97 (mainnet, a first pick, new storage) |
| Producer Race pick (`1EN7xU…`) | **1.2** | 0.89 (mainnet) |
| Daily Questions answer (vault `1Mpmf2…`) | **1.2** | 0.94 (mainnet) |
| `claim_game` / `claim` | **2.0** | 1.55 (v6.1 testnet, at mainnet prices) |
| `withdraw_from` / `withdraw` | **1.55** | 1.23 (same) |
| `settle` | **1.45** | ~1.15 (an estimate; the Vault chat measures it on testnet) |
| Stake (approve + `deposit_to` / `deposit_vhp` / `deposit_koin`) | **2.4**, the per-transaction cap (no row; `rcLimitOther`) | 1.86 (same) |

- **Why 2.4:** the sponsor's own checks add about **0.43 Mana to every sponsored transaction**. At the old 1.5 cap every sponsored claim and stake ran out of Mana (owner, 4 Nov: "Raise sponsor limit to 2.4").
- **Where the numbers come from:** on mainnet `npm run sponsor -- mana-report`; on the v6.1 test vault `docs/testnet-v61-units.json` (keys ending in `Sp` are sponsored), priced with mainnet's resource prices.
- **Claiming several rewards (D-132, #157):** with 2 or more rewards the Stake page asks the player: **free, one approval per reward** (one sponsored claim per transaction) or **all at once with your own Mana** (up to 10 in one transaction). #154 splits a sponsored batch as a fallback. With KOIN Vault or the player's own Mana a batch stays one transaction.
- **Over the cap:** a sponsored transaction whose Mana adds up to more than 2.4 (e.g. several Block X picks at once) is turned down, then retried with the player's own Mana (I-095).
- The caps count each transaction's **Mana limit**, not what it really used, so tighter rows mean more plays per cap. Plan: after the first real sponsored stake, claim and withdraw, run `mana-report` and tighten each row to about **1.25 × the most used** (R-BX-18).
- **Race picks with no per-game limit (Race contract v2, `max_picks_per_day` 0; Repo Lens #C-10 C10-1, C10-6):** one wallet can then use its whole `--per-player-day` of the free pool on picks (about 45 a day), and the free pool is one record shared by every unstaked wallet, so about 50 fresh wallets can empty it for everyone until 00:00 UTC (they then pay their own Mana). Sponsored KOIN/VHP `approve`s already allow the same today (no cap row, repeatable). If new wallets drain free play: lower `--free-per-day`, or keep a race limit. The real fix needs a sponsor version: a per-wallet free sub-cap and a cap row for `approve`.
- **How a cap or row is raised (order matters):** dry run → `config --send` on chain → **then** merge the site PR (`site-limits`). The site must never ask for more Mana than the chain allows. Steps: `claude/sponsor/ROLLOUT-STEPS-2026-11-04.md` and `ROLLOUT-STEP-8-2026-11-04.md` (Claude project).

### Code history
| Version | Code | Live | Notes |
|---|---|---|---|
| v2 | `fa4659e6…` | to Oct | added Race picks |
| v3 | `b61ac238…` | to 4 Nov | any wallet within caps, free pool; **traps guests when the vault switch is on** (the 4 Nov guest trap). **Never upload it again while the switch is on** (the tool refuses) |
| v3 guest fix | `b84e1add…` | **now** | fixes the trap (Repo Lens #C-3 GO) |

---

## 3. What it pays for, and what it never pays for

**Pays** (when the player signs alone, and every operation is covered, within the caps):
- Questions: `answer`, `settle`, `claim`, `close_week`, `finalize_week`, deposits and withdrawals of the question game.
- The vault (switch on): `deposit_to`, `withdraw_from`, `move_stake`, `claim_game`, `finalize_game_week` for the payee.
- A `pick` on Race picks, and the Picks contract's `pick`, for the player's own wallet.
- **Node runners** (owner, 5 Nov): Proof-of-Burn `register_public_key` (`159myq…iyv`, entry `0x53192be1`, arguments producer + key only), for the producer's own key, as free play. An allowlist row: a `config` send, no new code. Live once the owner's config send shows `allowlisted calls … → …, 159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv:1394158561`; the site lists it in `sponsor.covers` only after that.
- A VHP or KOIN `approve` whose spender is the game and owner is the player.

**Never pays:** Knode Swap until the next sponsor version (v3 refuses it in code; the owner wants it covered, 5 Nov); owner, operator, seed or upgrade actions; burning KOIN into VHP; any transaction signed by anyone besides the player.

---

## 4. Checking it (read-only, safe any time)

```powershell
cd C:\kprediction
git branch --show-current
$env:RPC = "https://koinos.armana.io"
npm run sponsor -- status
npm run sponsor -- mana-report
```

- `status` shows: KOIN and Mana, code hash (should be `b84e1add…`, "as uploaded"), the switches, ON/off, the vault switch, every cap, today's use, and what the website asks.
- `mana-report` shows what each action really used (`manaByDay`); `--save` writes it for the next limits PR.
- The **hourly bot** runs `npm run sponsor -- watch` every hour and emails you (a failed run) if a cap is past 80%, its Mana is low, or it can't read the chain (`ALERTS.md`).

---

## 5. Changing it (the owner sends; dry run first)

**Every mainnet send needs both `--send` and `CONFIRM_MAINNET=yes` in `.env`.** Turn it on right before the send and off right after, so nothing can send by accident in between:

Turn ON:
```powershell
cd C:\kprediction
Add-Content -Path .env -Value "`r`nCONFIRM_MAINNET=yes"
Select-String -Path .env -Pattern '^CONFIRM_MAINNET='
```
Turn OFF (expect no output afterwards):
```powershell
cd C:\kprediction
(Get-Content .env) | Where-Object { $_ -notmatch '^\s*CONFIRM_MAINNET\s*=' } | Set-Content .env
Select-String -Path .env -Pattern '^CONFIRM_MAINNET='
```

**Change the caps: always pass all of them, exactly.** A plain `config` resets anything you leave out (an unset free cap means 500). Today's full line:
```powershell
npm run sponsor -- config --per-tx 2.4 --per-player-day 40 --per-player-week 280 --per-day 5000 --min-vhp 1 --free-per-day 2000
```
(280 = 7 × 40: daily only, owner 5 Nov, D-169; on chain since 5 Nov, tx `0x1220a4fa…81f4c`.) Read the dry run: only the arrows you meant to change (`old → new`), the 1.2 rows, no `⚠ website` lines. Then Turn ON, the same line with `--send`, Turn OFF.

| You want to | Change in the line above | Notes |
|---|---|---|
| Slow down spam from new wallets | lower `--free-per-day` | `0` turns free play off |
| Slow down staked-wallet farming | raise `--min-vhp` | — |
| Let heavy players play more | raise `--per-player-day`, and set `--per-player-week` to 7 × it | the owner keeps the day moderate because of spam (D-105) |
| More than 5,000 a day in total | **can't**: needs a new contract version (raise `CAP_LIMIT`, audit, upload) | add KOIN first |

**Other commands** (each a dry run until `--send`):
| Command | Does |
|---|---|
| `npm run sponsor -- disable --send` | **switch it off at once** (players pay their own Mana) |
| `npm run sponsor -- enable --send` | switch it back on |
| `npm run sponsor -- payer sponsor\|self --send` | what the **website** asks for (then commit and push the deployment files) |
| `npm run sponsor -- site-limits --send` | write the per-action limits into the site files (then a PR) |
| `npm run sponsor -- upload --send` | upload new code (refuses any build but the audited one; refuses a trapping build while the switch is on) |

---

## 6. Rollback and emergencies

| Situation | Do this |
|---|---|
| Guests refused again / a trap after a change | Turn ON, then `npm run sponsor -- config --vault off --per-tx 2.4 --per-player-day 40 --per-player-week 280 --per-day 5000 --min-vhp 1 --free-per-day 2000 --send`, Turn OFF. (Vault calls then aren't sponsored; picks and answers are.) Tell the Block X chat |
| Free Mana draining fast (watch email) | lower `--free-per-day` with the full line (§5). Running out only means players pay their own Mana until 00:00 UTC; nobody loses anything |
| Sponsor Mana low (watch email) | send it KOIN from a wallet of yours (Kondor). **Never** from the vault or Desk |
| Something looks wrong and you don't know what | `npm run sponsor -- disable --send`. It's instant and harmless to players |
| **`SPONSOR_WIF` may be stolen** | `RUNBOOK.md` §7: move any KOIN left to a safe wallet of yours, then `disable --send`. ❓ exact steps to be confirmed by the Vault chat (R-VAULT-5) |
| The second node disagrees in a preview | it sends only with `disable --rebuilt --send` (caps never looser) |

---

## 7. Risks and open items

| Item | State | Ref |
|---|---|---|
| **The sponsor's own key controls its settings and its KOIN** | the owner keeps all its KOIN in it so Mana recharges fully (D-148); the protections are in the owner's private notes; `disable` switches it off at once | D-085, D-148 |
| Empty new wallets can use up the free pool | accepted (audit SP-3): 2,000 a day, by the hour; lower `--free-per-day` if spam appears | SP-3 |
| Many 1-VHP staked wallets can use up the day | accepted (audit SP-2): raise `--min-vhp` if it happens | SP-2 |
| Near 00:00 UTC a "Sent" transaction can drop from the block | the player retries | README |
| Tighten the rows after the first real sponsored stake / claim / withdraw | open: `mana-report --save`, `site-limits`, PR, `config` with the full line | R-BX-18, TODOS → Later |
| Combo launch raises its pick row (planned 0.25 under the old scale) | open; re-measure first | D-038, ComboCard |
| The site's message for any refusal is "Free answers / picks are used up" | open (wrong reason shown) | I-082, R-HUB-4 |
| An on-chain cap on `move_stake` sponsoring | optional | I-021 |
| A sponsored batch over 2.4 is refused, then retried with own Mana | open (P3) | I-095 |
| Testnet sponsor `1Dg8zK…` still allowlists Combo's Picks v2 | test only, OFF | I-041 |

**Alerts it raises:** `ALERTS.md` → "Mana sponsor".
