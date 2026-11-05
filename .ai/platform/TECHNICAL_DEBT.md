# Knode Games — Technical Debt

> **Purpose:** the shortcuts, unfinished systems, temporary fixes and known risks we're carrying, ranked by how much harm they could do — so they're paid down in the right order.
> **Reviewed:** 2026-11-03, from `OPENISSUES.md`, the chats' audit notes, `DECISIONS.md` and the repo; cleaned 2026-11-04 (paid-down items TD-06 and TD-07 moved to `../archive/DONE.md`; ids kept); status sync 5 Nov 2026 (TD-02, TD-13, TD-15, TD-24 paid down; TD-03 in part). Each item links to its issue (I-xxx) or decision (D-xxx); fixes are tracked there, not here.
> **Severity:** **Critical** — could lose or mispay funds · **High** — could stop games or payouts, or weakens a key safeguard · **Medium** — hurts players, growth or reliability · **Low** — tidy-up.
> **Type:** 🔐 security · 📜 smart contract · 🚧 unfinished system · 🩹 temporary fix · ⏩ shortcut · 📈 scalability

## Critical
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-01 | 🔐 | **One hot key controls everything, and the desk treasury *is* that key.** The single-signature owner wallet `1635QU…` owns the vault, the desk and the Picks contract, and is also the desk treasury. All hot keys (owner, sponsor, operator, seed) sit in one `.env` on one home PC | A stolen owner key could withdraw the desk's funds at once (no timelock, since the treasury is already that wallet). Vault stakes are protected by the 48 h upgrade notice and always-open withdrawals, but only if someone notices in time | The weekend runbook (`docs/WALLETS.md` §7; dates: `CALENDAR.md`): cold desk treasury (48 h timelock), then the **cold-key** owner `1LMV8E…` (exists; already owns Race picks since 4 Nov) takes the vault and the Desk (D-083; no hardware wallet can sign these calls today); the Picks handover later, once its tool is built and checked (D-106; I-076); multisig on the roadmap. The sponsor's hot key (25,000 KOIN) stays, risk accepted (D-085). The operator goes GitHub-only (D-084) | I-001, D-013, D-083 |

## High
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-03 | 🔐 | **Anything pushed to `main` runs with the operator key.** The bot needs to push to `main`, so there's no pull-request requirement; `OPERATOR_WIF` is limited to `main`; AI work reaches `main` only through PRs. The workflow guard part is **fixed** (it parses each workflow, #99 / #111); **the bot still pushes its data to `main`** | The operator can't move funds, but it posts results and resolves questions — bad code on `main` could post wrong results, which decides who gets paid | Move the bot's data commits off `main`, then require reviews | I-022, D-012, D-026 |
| TD-04 | 🔐 | **The retired operator's key is still in `.env`** | A forgotten key with KOIN on it is a free target | Move its KOIN, then remove the key | I-045 |
| TD-08 | 📈 | **All three block producers, plus the question-release backup, run on one home PC and internet line** | A power or internet cut stops the Knode Games Pool's production (smaller rewards), the desk's production and the 12:00 release backup at the same time | Accept for now; later, a second machine or a hosted backup node for the pool | D-048, D-047 |

## Medium
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-09 | ⏩ | **Audits are the owner's own programs only** — no independent third-party audit before contract upgrades | A shared blind spot can survive every round | Consider one outside review of the vault before TVL grows toward the 1,000,000 VHP target | D-017, D-076 |
| TD-10 | 📈 | **One RPC node for everything.** The site (every player's browser), the bot and the recorders all read from Armana; the second node is only a checker; no fallback | Armana outages already caused failed runs (3 Nov); more players means more rate-limit failures | Fallback node (on hold); lighter polling from the PR #50 salvage | I-006, I-072 |
| TD-12 | 📈 | **Sponsor sizing is still an estimate** — a fixed daily cap, first come first served (live values: `SPONSOR.md`) | Success (D-076) means demand outgrows it; when the daily cap is hit, guests can't play at all | Measure real use after launch; set per-action limits; plan top-ups | D-061, D-028 |
| TD-14 | 📜 | **Trust and untested paths in the newer games:** Last Node's form, c and staked list aren't re-checked on publish, and its JSON-RPC client has never run on a real node; Combo's verify job design is unreviewed; `effective_balance_of` (Bracket) has never been seen live | Each could publish wrong results at launch | Their audits; watch each game's first live day | I-058, I-061, I-063 |
| TD-16 | 🚧 | **KOIN Vault (mobile) can't use the sponsor** — it picks its own payer | Mobile free play, a top founder priority, depends on the guest wallet workaround | KOIN Vault developer request | I-007 |
| TD-17 | 🚧 | **Unfinished pieces before launch:** the site's "Week 1" display, Survivor's leaderboard and Results adapter, Race and Block X onto the VHP standard, the next sponsor version (guest prize claims, L-3) | Inconsistent player experience across games | Per the roadmap | I-069, I-056, D-058, I-005 |
| TD-18 | 📈 | **File and size limits in the recorders:** `names.json` freezes near 1 MB; a Survivor season file stops past 2 MB (~10k one-day wallets); boards cap at 2,000 rows; vault points collapse past 255 places; Race board reads grow with players; one failing step in `games.yml` stops the steps after it | Growth breaks quietly | Revisit each limit as player counts grow | I-023, I-029, I-055 |

## Low
| ID | Type | Debt | Refs |
|----|------|------|------|
| TD-19 | 🩹 | Legacy label fallback (`legacyLabelsOk`) for questions released before `hashRule` 2 | WEB3-31 |
| TD-20 | 🩹 | Records that disagree with the chain: the `vault-v6` folder still names `api.koinos.io` (the sponsor-record part was fixed by PR #57, I-043) | I-015 |
| TD-21 | 🩹 | Leftovers kept "just in case": old node data folders and the desk's ~50 GB broken copy; PR #50's branch; testnet tools aimed at a local node the owner doesn't run | I-008, I-072, I-068 |
| TD-22 | ⏩ | The Questions game's v5 free-prize rule is fixed on chain — changing it needs a contract upgrade | D-069 |
| TD-23 | 🔐 | Sponsor v3 would still pay for a `move_stake` sent outside the site | I-021 |
| TD-25 | ⏩ | Tests run only on Linux; the owner can't run the full suite on Windows. Known flaky tests (an audit test, Bracket VHP read, Survivor rehearsal) | I-047, I-057 |
| TD-26 | 📈 | Daily compounding drifts ~1 hour a day (28,800-block "day") | I-049 |
| TD-27 | 🚧 | No bot support for the public-testnet vault copy; its owner key lives only in one chat's sandbox | I-014, I-017 |

## Paid down
Moved to `../archive/DONE.md` ("Moved 2026-11-05 (late)").

## Accepted on purpose (not debt to fix — risks the owner chose)
- **TD-11, free-prize farming** with many empty wallets (D-097, 4 Nov): accepted for now; a farmed prize can be removed in the correction window.
- Last Node's slow form-skimming (N-6) and its hold rate (D-055); Bracket's seeding-day VHP trick (F-2); a whale withdrawal sinking the vault's Bracket index; Combo's lagging-node hold (FC3-9) and clock-edge hold (FC2-19); Survivor's accepted list (I-055); one person running many free wallets (owner, 28 Oct).

## Suggested order
1. **This weekend (dates: `CALENDAR.md`):** TD-01, TD-04.
2. **Next:** TD-03 (move the bot's data commits off `main`).
3. **Before each paused game launches (D-113):** TD-14.
4. **As players grow:** TD-08 – TD-10, TD-12, TD-18.
