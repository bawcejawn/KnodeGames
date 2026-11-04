# Knode Games — Technical Debt

> **Purpose:** the shortcuts, unfinished systems, temporary fixes and known risks we're carrying, ranked by how much harm they could do — so they're paid down in the right order.
> **Reviewed:** 2026-11-03, from `OPENISSUES.md`, the chats' audit notes, `DECISIONS.md` and the repo; cleaned 2026-11-04 (paid-down items TD-06 and TD-07 moved to `../archive/DONE.md`; ids kept). Each item links to its issue (I-xxx) or decision (D-xxx); fixes are tracked there, not here.
> **Severity:** **Critical** — could lose or mispay funds · **High** — could stop games or payouts, or weakens a key safeguard · **Medium** — hurts players, growth or reliability · **Low** — tidy-up.
> **Type:** 🔐 security · 📜 smart contract · 🚧 unfinished system · 🩹 temporary fix · ⏩ shortcut · 📈 scalability

## Critical
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-01 | 🔐 | **One hot key controls everything, and the desk treasury *is* that key.** The single-signature owner wallet `1635QU…` owns the vault, the desk and the Picks contract, and is also the desk treasury. All hot keys (owner, sponsor, operator, seed) sit in one `.env` on one home PC | A stolen owner key could withdraw the desk's funds at once (no timelock, since the treasury is already that wallet). Vault stakes are protected by the 48 h upgrade notice and always-open withdrawals, but only if someone notices in time | This weekend (runbook PR #73): cold desk treasury (48 h timelock), then a **cold-key** owner for the vault and Desk (D-083; no hardware wallet can sign these calls today); Picks and Race picks the same weekend once their tools are built (D-096; I-076, I-077); multisig on the roadmap. The sponsor's hot key (25,000 KOIN) stays, risk accepted (D-085). The operator goes GitHub-only (D-084) | I-001, D-013, D-083 |
| TD-02 | 📜 | **The vault pays from files it can't fully verify.** Game results reach the vault as files in `games-data` written by off-chain recorders. Since PR #74 (4 Nov) the bot re-checks stakes on chain, honours HOLD files, cross-checks each results file against the game's `board.json`, posts only a file read unchanged on two runs, and alerts on refusals. **Still missing:** points aren't recomputed from the chain, and a Race vault file is decided by one run with no hold | A recorder bug that writes the board and the results file wrong the same way could still pay the wrong players. The first payouts beyond Daily Questions start from the vault week of **Mon 9 Nov** (first close Mon 16 Nov) | The Race file gets a hold (or a re-derive) before 16 Nov; points recompute in the bot after 16 Nov | I-034, I-051, I-080 |

## High
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-03 | 🔐 | **Anything pushed to `main` runs with the operator key.** The bot needs to push to `main`, so there's no pull-request requirement; `OPERATOR_WIF` is limited to `main`; since 3 Nov AI docs reach `main` only through PRs the owner merges (the bot still pushes data); the workflow guard is regex-based and misses some YAML spellings | The operator can't move funds, but it posts results and resolves questions — bad code on `main` could post wrong results, which decides who gets paid | Keep pushes to reviewed branches only (owner merges); move the bot's data commits off `main`, then require reviews; finish the YAML-parser guard | I-022, D-012, D-026 |
| TD-04 | 🔐 | **The retired operator's key is still in `.env`** | A forgotten key with KOIN on it is a free target | Move its KOIN, then remove the key | I-045 |
| TD-05 | 📜 | **The game/vault contract still pays Mana for other people's transactions** (`max_sponsor_rc` = 2 KOIN) | ~317 KOIN of compounding lost by 28 Oct; the drain continues while it's on | `sponsor-limit 0` with `maxSponsorRc: "0"` in the same change | I-044, D-046 |
| TD-08 | 📈 | **All three block producers, plus the question-release backup, run on one home PC and internet line** | A power or internet cut stops the Knode Games Pool's production (smaller rewards), the desk's production and the 12:00 release backup at the same time | Accept for now; later, a second machine or a hosted backup node for the pool | D-048, D-047 |

## Medium
| ID | Type | Debt | Why it matters | Pay it down | Refs |
|----|------|------|----------------|-------------|------|
| TD-09 | ⏩ | **Audits are the owner's own programs only** — no independent third-party audit before contract upgrades | A shared blind spot can survive every round | Consider one outside review of the vault before TVL grows toward the 1,000,000 VHP target | D-017, D-076 |
| TD-10 | 📈 | **One RPC node for everything.** The site (every player's browser), the bot and the recorders all read from Armana; the second node is only a checker; no fallback | Armana outages already caused failed runs (3 Nov); more players means more rate-limit failures | Fallback node (on hold); lighter polling from the PR #50 salvage | I-006, I-072 |
| TD-11 | 📈 | **Free prizes can be farmed with many empty wallets**, and they share the sponsor's first-come free pool | Real players can find the free pool empty; prizes go to farmers | Owner decision before Race and Block X free prizes | I-035 |
| TD-12 | 📈 | **Sponsor sizing is still an estimate** — 25,000 KOIN, 5,000 Mana a day, first come first served | Success (D-076) means demand outgrows it; when the daily cap is hit, guests can't play at all | Measure real use after launch; set per-action limits; plan top-ups | D-061, D-028 |
| TD-13 | 🚧 | **Block X has a "before prizes" fix list** (week-end re-reads on both nodes, board freeze, VHP decoder, card clock and others) | Block X launched prize-free (3 Nov); prizes start with the week of 9 Nov (D-077), so the fixes must be in before that week starts | Built in PR #80; Repo Lens round 14 wants one fix (E4-1) first; merge before Mon 9 Nov 00:00 UTC | I-042 |
| TD-14 | 📜 | **Trust and untested paths in the newer games:** Last Node's form, c and staked list aren't re-checked on publish, and its JSON-RPC client has never run on a real node; Combo's verify job design is unreviewed; `effective_balance_of` (Bracket) has never been seen live | Each could publish wrong results at launch | Their audits; watch each game's first live day | I-058, I-061, I-063 |
| TD-15 | 🚧 | **Nicknames don't stick** — the mint never sets the main token, and the refresh only reads known wallets | Players create a name and never see it | Hub chat fix + audit | I-020 |
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
| TD-24 | 🔐 | Legacy name-claim workflow keeps `issues` permissions | I-026 |
| TD-25 | ⏩ | Tests run only on Linux; the owner can't run the full suite on Windows. Known flaky tests (an audit test, Bracket VHP read, Survivor rehearsal) | I-047, I-057 |
| TD-26 | 📈 | Daily compounding drifts ~1 hour a day (28,800-block "day") | I-049 |
| TD-27 | 🚧 | No bot support for the public-testnet vault copy; its owner key lives only in one chat's sandbox | I-014, I-017 |

## Accepted on purpose (not debt to fix — risks the owner chose)
- Last Node's slow form-skimming (N-6) and its hold rate (D-055); Bracket's seeding-day VHP trick (F-2); a whale withdrawal sinking the vault's Bracket index; Combo's lagging-node hold (FC3-9) and clock-edge hold (FC2-19); Survivor's accepted list (I-055); one person running many free wallets (owner, 28 Oct).

## Suggested order
1. **This weekend:** TD-01, TD-04.
2. **Before the first vault close (Mon 16 Nov):** TD-02 (the Race hold), TD-03 (stop direct pushes to `main`), TD-05.
3. **Before each game's prizes:** TD-11, TD-13, TD-14.
4. **As players grow:** TD-08 – TD-10, TD-12, TD-18.
