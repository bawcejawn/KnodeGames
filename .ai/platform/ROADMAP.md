# Knode Games — Roadmap

> Purpose: What's next, in order. Not a promise — a plan.
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions, Vault, Hub and Race chats). Not yet archived: Block X, Survivor,
> Fantasy, Combo, Bracket, Last Node Standing, Repo Lens, sponsor chats.
> This file holds milestones. Step-by-step actions live in `TODOS.md`; problems in `OPENISSUES.md`.

**Legend:** ✅ verified · 💬 chat only · ⚠️ conflict · ❓ unknown

## Scheduled
| When (UTC) | What | Confidence |
|------------|------|-----------|
| Mon 2 Nov, 21:00 | Week 2 closes, Week 3 starts (new prize rules, D-010) | 💬 ⚠️ C-08 |
| Wed 4 Nov, 17:30 | Delete old node basedir folders if `heal.log` is clean | 💬 |
| Sat 7 Nov, 00:00 (Fri 6 Nov, 4 PM PT) | Deadline to announce (`game-add`) games 2, 7, 9 (+8, 13 if cleared) | 💬 Vault ⚠️ C-14 |
| Mon 9 Nov, 00:00 (Sun 8 Nov, 4 PM PT) | Deadline to `game-apply` | 💬 Vault |
| Mon 9 Nov | v6 rules and 2 + 1 VHP free prizes start | 💬 Vault ⚠️ C-10 |
| Sat 7 – Fri 13 Nov | Survivor announce window (apply Mon 9 – Sun 15 Nov) | 💬 Vault |
| Tue 10 Nov, 21:00 | First payout under the v5 rules | 💬 |
| Mon 16 Nov, 12:00 | First vault close; Survivor Season 1 starts (vault week 4) | 💬 Vault |

## Now (in progress)
| Item | Owner | Blocked by | Target |
|------|-------|------------|--------|
| Resolve open contradictions (C-01 – C-15) | owner | owner answers (planned once all chats are archived) | {{TBD}} |
| Get `vault-v6` into `picks` so admin vault buttons work | Vault + Hub chats | — | before Fri 6 Nov (I-019) |
| Launch week: `game-add` → sponsor vault switch → `game-apply` | owner | I-019 | see Scheduled |
| Retest "+ Add another account" with the real Kondor extension (fix `80cef45` is live; create/import the 2nd account in Kondor first) | owner | — | {{TBD}} |
| Delete `diag-health` branch in the GitHub UI | owner | — | {{TBD}} |
| Wallet handovers: new owner on hardware wallet, cold treasury (D-013) | owner | — | ❓ "this weekend" |

## Next (ready to start)
| Item | Depends on | Notes |
|------|------------|-------|
| Full platform audit (D-014) | owner go-ahead | |
| Game launch sequence | C-14 (pace/order) | Hub order: Block X (2) + Race (7) added first → Block X live with Block Golf practice scorecards → Survivor → Block Golf staked → LNS → Bracket → Fantasy → Combo (after Picks v2 CARD). Vault plan: 2, 7, 9 together, then Survivor, Fantasy, Golf, Combo, LNS as each clears |
| Block X launch PR (`picks` → `main`) | game 2 applied; Race file merge (I-031) | Block X chat |
| Send message to the KOIN Vault developer | owner sends | content {{TBD}} |

## Later
- Next sponsor version: guest prize claims and the L-3 fix — coordinate with the sponsor and Vault v6 chats. ⚠️ sponsor version itself disputed (C-01)
- Consider moving `header-wallet.js` read provider off Armana to `api.koinos.io` (⚠️ C-04: `app.js` and `swap.js` also use Armana in `picks`)
- Games marked "soon" in `games.json`: Who Signs Block X, Survivor, Fantasy Producers, Block Golf — plans {{TBD}}
- Size the sponsor's KOIN from measured use once everything is live (D-028, C-03)
- Retention ideas offered by the Hub, not yet chosen by the owner: streaks, a "Your week" card, a claim reminder dot, a weekly recap page, badges next to names
- Launch announcement; analytics decision; ads and the SwarmTales listing (Race chat's owner checklist)
- Bot support for the Koinos Foundation testnet copy (I-014)
- {{TBD: items from chats not yet archived}}

## Done
| Item | Completed | Notes |
|------|-----------|-------|
| Game v5 + Desk v2 upgrade | 2026-10-28 | ✅ `upgradedAt` in deployment files |
| Race contract upload | 2026-10-27 | ✅ |
| Sponsor upload (v3 per repo) | 2026-10-30 | ⚠️ C-01; Vault + Hub say v3 live (PR #38) |
| Picks contract upload | 2026-10-30 | ✅ |
| Nodes moved to Docker volumes; self-heal every 20 min | ❓ | 💬 |
| "+ Add another account" fix (`80cef45`) | ❓ | 💬 live; owner retest pending |
| Swap page double-tap disconnect fix | ❓ | 💬 |
| Build 2: rename, Games hub, Race Show, tab bar (PR #23) | 2026-10-27 | 💬 Race |
| Domain on GitHub Pages; site moved to repo root (PRs #30, #31) | ❓ | 💬 Hub |
| Race two boards, vault file, medals for earners (PR #34) | ❓ | 💬 Race |
| Vault v6 audited and rehearsed (162/162 specs, 38/38 node tests); testnet check | ≤ 2026-10-30 | 💬 Vault |
| Vault v6 announced (tx `0x1220db16…8af`) | 2026-10-30 | 💬 Vault |
| Staking hub, status bars, @name page, `NAMES_ENABLED` live | 2026-10-30 | 💬 Hub |
| Vault v6 uploaded; chain-check all ✔, holdings unchanged at 21,120.07528353 | 2026-11-02 02:33 UTC | 💬 Vault; ✅ code hash on `main` |
| `vault-v6` merged into `main` (PR #51) | ≤ 2026-11-02 | ✅ |
| Race week 1 vault results file final | 2026-11-02 | 💬 Race |
| Stake panel fixes (PR #46), Race badge (PR #44), wallet provider fix (PR #49) | ≤ 2026-11-02 | ✅ merged on `main` |
| Admin page fixes (PR #43) | ≤ 2026-11-02 | ✅ merged into `picks` |
| `.ai/` library created | 2026-11-02 | |

## Launch Checklist (per game)
- [ ] Spec written in `.ai/games/`
- [ ] Meets GAME_STANDARD.md
- [ ] Tested on {{TBD: testnet / mainnet small amounts}}
- [ ] Audit passed ({{TBD: audit process}})
- [ ] Leaderboard meets LEADERBOARD_STANDARD.md
- [ ] Vault integration meets VAULT_STANDARD.md
- [ ] Announced
