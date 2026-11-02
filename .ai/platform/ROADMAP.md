# Knode Games — Roadmap

> Purpose: What's next, in order. Not a promise — a plan.
> Last updated: 2026-11-02
> Sources: `.ai/archive/CHAT_KNOWLEDGE.md` (Questions chat). Only the Questions chat has been archived so far —
> other chats' plans (Vault v6, Race, new games) are not in here yet.

**Legend:** ✅ verified · 💬 chat only · ⚠️ conflict · ❓ unknown

## Scheduled
| When (UTC) | What | Confidence |
|------------|------|-----------|
| Mon 2 Nov, 21:00 | Week 2 closes, Week 3 starts (new prize rules, D-010) | 💬 ⚠️ C-08 |
| Wed 4 Nov, 17:30 | Delete old node basedir folders if `heal.log` is clean | 💬 |
| Tue 10 Nov, 21:00 | First payout under the v5 rules | 💬 |

## Now (in progress)
| Item | Owner | Blocked by | Target |
|------|-------|------------|--------|
| Resolve contradictions C-01 to C-09 | owner | owner answers | {{TBD}} |
| Retest "+ Add another account" with the real Kondor extension (fix `80cef45` is live; create/import the 2nd account in Kondor first) | owner | — | {{TBD}} |
| Delete `diag-health` branch in the GitHub UI | owner | — | {{TBD}} |
| Wallet handovers: new owner on hardware wallet, cold treasury (D-013) | owner | — | ❓ "this weekend" |

## Next (ready to start)
| Item | Depends on | Notes |
|------|------------|-------|
| Full platform audit (D-014) | owner go-ahead | |
| Send message to the KOIN Vault developer | owner sends | content {{TBD}} |

## Later
- Next sponsor version: guest prize claims and the L-3 fix — coordinate with the sponsor and Vault v6 chats. ⚠️ sponsor version itself disputed (C-01)
- Consider moving `header-wallet.js` read provider off Armana to `api.koinos.io` (⚠️ C-04: `app.js` and `swap.js` also use Armana in `picks`)
- Games marked "soon" in `games.json`: Who Signs Block X, Survivor, Fantasy Producers, Block Golf — plans {{TBD}}
- {{TBD: items from other chats}}

## Done
| Item | Completed | Notes |
|------|-----------|-------|
| Game v5 + Desk v2 upgrade | 2026-10-28 | ✅ `upgradedAt` in deployment files |
| Race contract upload | 2026-10-27 | ✅ |
| Sponsor upload (v3 per repo) | 2026-10-30 | ⚠️ C-01 |
| Picks contract upload | 2026-10-30 | ✅ |
| Nodes moved to Docker volumes; self-heal every 20 min | ❓ | 💬 |
| "+ Add another account" fix (`80cef45`) | ❓ | 💬 live; owner retest pending |
| Swap page double-tap disconnect fix | ❓ | 💬 |
| `.ai/` library created | 2026-11-02 | |

## Launch Checklist (per game)
- [ ] Spec written in `.ai/games/`
- [ ] Meets GAME_STANDARD.md
- [ ] Tested on {{TBD: testnet / mainnet small amounts}}
- [ ] Audit passed ({{TBD: audit process}})
- [ ] Leaderboard meets LEADERBOARD_STANDARD.md
- [ ] Vault integration meets VAULT_STANDARD.md
- [ ] Announced
