# Knode Games — To-Dos

> Purpose: The owner's action list — what to do today, this week and later.
> Rule: Tick items off, don't delete them; move finished items to "Done" with the date.
> Link each item to its issue or decision where one exists (I-XXX in OPENISSUES.md, D-XXX / C-XX in DECISIONS.md),
> so the details live in one place.
> Last updated: 2026-11-02
> Times are shown in UTC and in your time (PT).

**Priority:** P1 funds or security · P2 breaks a game or the site · P3 confusing or annoying · P4 nice to have

## Today
- [ ] Answer C-02: which sponsor caps are live — the chat's 1,000-a-day set or the code's 5,000-a-day set? — P1 — C-02, C-03, D-008
- [ ] Tell the Block X chat the vault upload is done, so it ships V4, B1-1 and B1-5 — P2
- [ ] Run the push block so `main` gets the updated platform docs — P3

## This Week
- [ ] Ask the Combo Card and Last Node Standing chats whether they're cleared for mainnet — P2 — I-016
- [ ] `game-add` games 2, 7 and 9 (`--staked --free --send`), plus 8 and 13 if cleared — P2 — D-024 — due Fri 6 Nov, 4 PM PT
- [ ] Right after the first `game-add`: switch the sponsor to the vault — `npm run sponsor -- status`, copy the caps exactly, run the `config` preview (must show "vault (v6) live: no → yes" with caps unchanged), then `--send`, then `status` again — P1 — C-02 (a plain `config` resets caps)
- [ ] `game-apply` each game 48 h after announcing — P2 — due before Sun 8 Nov, 4 PM PT
- [ ] Delete old node basedir folders, only if `heal.log` is clean — P3 — I-008 — on or after Wed 4 Nov, 17:30 UTC (9:30 AM PT)
- [ ] Retest "+ Add another account" with the real Kondor extension — P2 — I-004 — due {{TBD}}
- [ ] Confirm which sponsor version is live on chain (v2 or v3) — P2 — C-01 (unblocks I-005) — due {{TBD}}
- [ ] Wallet handovers: new owner on a hardware wallet, cold treasury — P1 — I-001, D-013 — target this weekend ❓ (7–8 Nov)
- [ ] Confirm `reward_rule_week_plus_one=3` on chain — P2 — I-003, D-010 — due before Tue 10 Nov, 21:00 UTC (1:00 PM PT), the first v5 payout

## Later
- [ ] Give the go-ahead for the full platform audit — P1 — I-002, D-014
- [ ] Decide the site's read RPC (Armana or `api.koinos.io`) — P3 — I-006, C-04
- [ ] Send the message to the KOIN Vault developer — P3 — I-007
- [ ] Export the Vault v6, Race, sponsor and new-game chats into `CHAT_KNOWLEDGE.md` — P3 — I-009
- [ ] Confirm the GitHub repo name (`KnodeGames` or `Knode`) — P4 — C-06
- [ ] Explain the 21:00 UTC week boundary — P4 — C-08
- [ ] Delete the `diag-health` branch in the GitHub UI — P4 — I-010
- [ ] Survivor: announce Sat 7–Fri 13 Nov, `game-apply` Mon 9–Sun 15 Nov — P2 — D-020
- [ ] After the first vault close (Mon 16 Nov, 12:00 UTC / 4:00 AM PT): check status, the buckets, the free prizes, and collect the fee with `claim-fee-vhp all` — P1
- [ ] Then Fantasy, Golf, Combo and Last Node as each clears audits — P3
- [ ] Carry the Vault chat's project docs into `.ai/`: `claude/vault-v6-live.md`, `claude/vault-v6-testnet-results.md`, `claude/handoff-*.md`, `claude/audit-vault-v6-*`, `docs/UPGRADE-V6.md`, `docs/V6-PLAN.md` — P3 — I-009

## Waiting on Someone Else
| Item | Waiting on | Since | Link |
|------|------------|-------|------|
| Next sponsor version: guest prize claims and the L-3 fix | sponsor + Vault v6 chats (after C-01) | 2026-11-02 | I-005 |
| Five stake-panel fixes and three admin-page fixes | Hub chat | 2026-11-02 | I-012, I-013 |
| Bot support for the testnet copy (`testnet/vault.json`) | Vault chat | 2026-11-02 | I-014 |
| Ship V4, B1-1, B1-5 | Block X chat (after you tell it) | 2026-11-02 | — |

## Done
| Item | Done | Link |
|------|------|------|
| `.ai/` library created | 2026-11-02 | — |
| Platform docs generated from the Questions chat; contradictions logged | 2026-11-02 | DECISIONS.md → Contradictions |
| `OPENISSUES.md` filled | 2026-11-02 | OPENISSUES.md |
| C-09 answered: the vault is the game contract | 2026-11-02 | C-09 (from the Vault chat) |
| `C:\kprediction-vault` check — answered by the Vault chat; folder in use | 2026-11-02 | I-011 |
| Clean up stale Git worktrees — **cancelled**, not needed | 2026-11-02 | I-011 |
| Vault v6 uploaded (Mon 2 Nov, 02:33 UTC) | 2026-11-02 | D-023 |
| `.ai/.ai/` nesting on `main` fixed (by the Vault chat) | 2026-11-02 | I-018 |
