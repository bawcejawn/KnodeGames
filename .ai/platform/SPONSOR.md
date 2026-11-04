# Knode Games — The Mana Sponsor

> **Purpose:** the Mana sponsor on one page: what it is, what it pays for, its live settings, how to check it, change it, top it up, roll it back and switch it off, and its risks. Written so the owner can act on it without asking a chat.
> **One home:** this page is the home for **the sponsor's live settings and how to operate it**. Other files should point here instead of repeating the caps (several still show the old 25 / 150 / 1 numbers — `HEALTHCHECK.md` §2b). The contract's design and audit notes stay in `../../sponsor/README.md`; the decisions in `DECISIONS.md`.
> **Last updated:** Wed 4 Nov 2026, from `sponsor-data/deployment.json`, `sponsor-data/mana-limits.json`, `game-data/deployment.json` (`sponsor`), `bot/sponsor.ts`, `sponsor/README.md`, `claude/sponsor/ROLLOUT-STEPS-2026-11-04.md` (Block X chat) and decisions D-027, D-028, D-053, D-061, D-076, D-085, D-099, D-105.
> **Update rule:** any `config`, `upload`, `enable` / `disable` or top-up → update §2 the same day (the Block X chat owns the sponsor tool; the Librarian files the change).

---

## 1. What it is, in plain words

Every Koinos transaction costs **Mana**, which comes from holding KOIN. New players often have no KOIN, so Knode Games runs its own **Mana sponsor**: a small contract on its own wallet that agrees to pay the Mana for players' game actions. The page asks the sponsor first ("would you pay?"); if it says yes, the sponsor pays; if no, the player's own wallet pays (one more confirmation in the wallet).

- It **only pays Mana**. It never signs, moves or holds anything for players.
- It holds **only its own KOIN** (RULES 8, D-061). Its Mana is its KOIN balance, which refills about a fifth a day: **25,000 KOIN ≈ 5,000 Mana a day**, matching the daily cap.
- **Withdrawals never depend on it** (D-027): if it's off or capped, players pay their own Mana and can still withdraw.
- It is the **only payer** for players (Mana Station is shelved, D-053). The vault itself pays Mana for no one (`max_sponsor_rc` = 0, D-099).
- **KOIN Vault** (the mobile wallet) picks its own payer, so its users never use the sponsor (I-007).

---

## 2. Live settings (4 Nov 2026)

| Setting | Value | Since / source |
|---|---|---|
| Address (contract and wallet) | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` ✅ | — |
| Code | v3 guest-fix **`b84e1add3ffa14a7d1933d5ce5a4ad33caa4bca887a489f87f710b3c121c83a6`** ✅ | 4 Nov 07:27 UTC, upload tx `0x122093bb…c340` |
| Chain switches | pays for transactions **ON**; calls and uploads **not** overridden (stay with its own key) | checked by `status` |
| Switched | **ON** | — |
| **Vault switch** (`game_has_vault`) | **ON** (tx `0x12208deb…6f81`, 4 Nov) | lets it pay vault calls (`deposit_to`, `withdraw_from`, `claim_game`, `finalize_game_week`; `move_stake` never) |
| Per transaction | **1.5 Mana** | config tx `0x122075ac…d5c4` |
| Per player per day | **40 Mana** | D-105 (was 25) |
| Per player per week | **250 Mana** (weeks Monday 00:00 UTC) | D-105 (was 150) |
| Everyone per day | **5,000 Mana** (the v3 ceiling, `CAP_LIMIT`) | D-061 |
| Free players per day | **2,000 Mana** of the 5,000, **released by the hour** (~83 an hour) | D-061 |
| Real player | a wallet with **≥ 1 VHP of active stake this week** in the call's own game (`--min-vhp 1`); holding VHP doesn't count | v3 |
| KOIN held | **25,000 KOIN** (may grow) | D-061, D-076, D-085 |
| What it covers (`game-data/deployment.json` → `sponsor.covers`) | vault `1Mpmf2…`, VHP `12Y5vW…`, KOIN `19GYjD…`, Race picks `1EN7xU…`, Picks `1LmgqB…` | ✅ |

### Per-action Mana limits (what the site asks for each action; measured 4 Nov, blocks 40,783,100 – 40,795,033, vault switch on)
| Action | Contract | Limit | Measured (4 Nov, guest) |
|---|---|---|---|
| Block X pick (Picks `pick`) | `1LmgqB…` | **1.2 Mana** (proposed 1.3, D-117) | 0.864 – **0.970** (a first pick, new storage) |
| Producer Race pick | `1EN7xU…` | **1.2 Mana** | 0.888 – 0.892 |
| Daily Questions answer | vault `1Mpmf2…` | 1.2 Mana (`rcLimit`) | 0.806 – 0.943 (switch on) |
| Stake / withdraw / claim (`deposit_to`, `withdraw_from`, `claim_game`, Questions' `deposit_vhp` / `withdraw`) | vault | **1.0 Mana** (`rcLimitOther`) — **proposed 1.5** (D-117, I-088) | none seen yet |

The caps count each transaction's **Mana limit**, not what it really used, so tighter rows mean more plays per cap. Plan: after a week of play, run `mana-report` and tighten each row to about **1.25 × the most used** (step 7 of the rollout; R-BX-18).

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
- The vault (switch on): `deposit_to`, `withdraw_from`, `claim_game`, `finalize_game_week` for the payee.
- A `pick` on Race picks, and the Picks contract's `pick`, for the player's own wallet.
- A VHP or KOIN `approve` whose spender is the game and owner is the player.

**Never pays:** Knode Swap (owner, 29 Oct); `move_stake` (D-027); owner, operator, seed or upgrade actions; burning KOIN into VHP; any transaction signed by anyone besides the player.

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
npm run sponsor -- config --per-tx 1.5 --per-player-day 40 --per-player-week 250 --per-day 5000 --min-vhp 1 --free-per-day 2000
```
Read the dry run: only the arrows you meant to change (`old → new`), the 1.2 rows, no `⚠ website` lines. Then Turn ON, the same line with `--send`, Turn OFF.

| You want to | Change in the line above | Notes |
|---|---|---|
| Slow down spam from new wallets | lower `--free-per-day` | `0` turns free play off |
| Slow down staked-wallet farming | raise `--min-vhp` | — |
| Let heavy players play more | raise `--per-player-day` / `--per-player-week` | the owner keeps these moderate because of spam (D-105) |
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
| Guests refused again / a trap after a change | Turn ON, then `npm run sponsor -- config --vault off --per-tx 1.5 --per-player-day 40 --per-player-week 250 --per-day 5000 --min-vhp 1 --free-per-day 2000 --send`, Turn OFF. (Vault calls then aren't sponsored; picks and answers are.) Tell the Block X chat |
| Free Mana draining fast (watch email) | lower `--free-per-day` with the full line (§5). Running out only means players pay their own Mana until 00:00 UTC; nobody loses anything |
| Sponsor Mana low (watch email) | send it KOIN from a wallet of yours (Kondor). **Never** from the vault or Desk |
| Something looks wrong and you don't know what | `npm run sponsor -- disable --send`. It's instant and harmless to players |
| **`SPONSOR_WIF` may be stolen** | `RUNBOOK.md` §7: move any KOIN left to a safe wallet of yours, then `disable --send`. ❓ exact steps to be confirmed by the Vault chat (R-VAULT-5) |
| The second node disagrees in a preview | it sends only with `disable --rebuilt --send` (caps never looser) |

---

## 7. Risks and open items

| Item | State | Ref |
|---|---|---|
| **25,000 KOIN behind a hot key, no timelock** | accepted risk; protection: a PC used only for this, paper backup, never on GitHub, instant `disable` | D-085, `KEYS_AND_ROLES.md` §1 |
| **Option to decide:** keep most KOIN in a cold wallet and a working float in the sponsor (e.g. enough for a few days), topped up by hand | owner to decide; reduces the worst case without changing players' experience. Trade-off: top-ups become an owner chore, and Mana refills from the balance, so a smaller balance means fewer Mana a day | `HEALTHCHECK.md` priority 4 |
| Empty new wallets can use up the free pool | accepted (audit SP-3): 2,000 a day, by the hour; lower `--free-per-day` if spam appears | SP-3 |
| Many 1-VHP staked wallets can use up the day | accepted (audit SP-2): raise `--min-vhp` if it happens | SP-2 |
| Near 00:00 UTC a "Sent" transaction can drop from the block | the player retries | README |
| Tighten the 1.2 rows after a week of play | open: `mana-report --save`, `site-limits`, PR, `config` with the full line | R-BX-18, TODOS → Later |
| Combo launch raises its pick row (planned 0.25 under the old scale) | open; re-measure first | D-038, ComboCard |
| The site's message for any refusal is "Free answers / picks are used up" | open (wrong reason shown) | I-082, R-HUB-4 |
| An on-chain cap on `move_stake` sponsoring | optional | I-021 |
| Testnet sponsor `1Dg8zK…` still allowlists Combo's Picks v2 | test only, OFF | I-041 |

**Alerts it raises:** `ALERTS.md` → "Mana sponsor".
