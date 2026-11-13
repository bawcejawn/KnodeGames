# Batched picks: spec (Capacity chat, Fri 13 Nov 2026)

**Goal:** one sponsored transaction carries a player's several picks or answers, so the sponsor's own checks and the
transaction's fixed costs are paid once instead of once per pick. Needed for free play at 1,500+ daily players
(`claude/capacity/GATE-1500-2026-11-13.md` §c).

## Phase 1: multi-operation transactions (no contract change, no timelock)
The live sponsor (v3, `b84e1add`) already accepts **1 to 10 operations in one transaction**, checks every operation
against its allow-list (`checkOperation`), and caps the transaction at the sum of each operation's per-action limit
(`manaCapOf`) and at `max_mana_per_tx`. The game contracts (Picks, Race picks, the vault's `answer`) take each operation
as an ordinary call, so the chain stores exactly the same picks and answers as N single transactions: **recorders,
publish jobs and the vault bot see no difference.**

What changes:
1. **Site (wallet code; Hub chat with Capacity):** a "send my picks" step that puts up to 10 pending picks/answers of
   one player into one transaction (one signature), with `rc_limit` = the sum of the measured per-action limits
   (`sponsor-data/mana-limits.json`), capped at the sponsor's `max_mana_per_tx`. Single picks keep working as today.
   Rules: one payee and one signer (the sponsor already requires it); never more than 10 operations; a pick whose
   round has locked is left out before signing (otherwise the whole transaction fails and nothing is saved, which the
   page must say plainly); Questions answers of one round go together; mixed games in one transaction are allowed
   (each operation is checked on its own).
2. **Sponsor settings (owner, one `config` send, dry run first):** raise `max_mana_per_tx` from 2.4 to fit 10
   operations (about 10 x the largest row, ~13 Mana counted). The v3 rule "per transaction <= per player per day"
   holds with the per-wallet day at 40. No upload.
3. **Testnet measurement first (T7 in the test plan):** the Mana really burned by a 1-, 4-, 8- and 10-operation
   sponsored transaction for each game's call; this sets the real saving and the new `mana-limits.json` rows.

Expected effect (E, to be replaced by the testnet numbers): today ~0.81-0.93 Mana burned per sponsored pick, about
0.43 of it the sponsor's own checks and the transaction's fixed cost. Ten picks in one transaction: ~0.43 + 10 x ~0.45
= ~4.9 instead of ~8.3, **about 40% less Mana per typical player.** Counted against caps: ~5.5 a player a day instead
of 12.

## Phase 2 (optional, later): batch entry points in the contracts
`pick_many` / `answer_many` taking repeated entries, writing the same records as N single calls (so recorders stay
unchanged). Saves the per-call overhead too (E: to ~2.5 counted a player a day). Contract changes: Repo Lens, 48 h
timelock each; Picks: never between `propose_owner` and `accept_owner`. The vault's `answer_many` is a vault upgrade
(funds contract): only if Phase 1 isn't enough. **Decide after the Phase 1 testnet numbers.**

## Owners and dates
| Step | Who | By (ET) |
|---|---|---|
| Testnet measurement (1/4/8/10 operations, each call) | Capacity writes the script; owner runs it on testnet (test wallets, faucet KOIN) | Wed 18 Nov |
| Site "send my picks" (multi-operation) | Hub chat, with Capacity | Mon 23 Nov |
| `max_mana_per_tx` raise (config, dry run) | owner, after the measurement | Mon 23 Nov |
| Phase 2 decision | owner, from the measurement | Tue 24 Nov (first review) |
