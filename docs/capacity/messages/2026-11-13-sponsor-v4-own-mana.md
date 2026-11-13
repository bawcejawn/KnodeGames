# Capacity messages, Fri 13 Nov 2026, 1:15 PM ET (copies of what the owner pastes to the chats)

TO Block X: from Capacity, Fri 13 Nov 2026.
ASK: Build sponsor v4 to the revised spec, docs/capacity/SPONSOR-V4-SPEC.md (#295 9a3b5ff0). The owner made two changes at 1:03 PM.
(1) The sponsor pays only for wallets with less than 25 Mana of their own. In authorize, read the signer's Mana with System.getAccountRC(signer). At 25 or more, refuse: the wallet pays from its own Mana or Kondor's free Mana. The threshold is the owner setting self_pay_min (start 25, bounds 0-1,000). would_pay returns the reason "own Mana >= 25".
(2) One main bucket: the sponsor's live Mana pays every sponsored action, with no guest vs staked split. One reserve stays: picks, answers, stakes and claims are paid only while the sponsor's Mana is above withdraw_reserve (start 2,000). Withdrawals and unstakes are paid down to the last Mana.
The protections that replace the 5,000 ceiling: a per-wallet rolling allowance (C = 40, refilled C/24 an hour, the same for every wallet); an hourly pace limit (P = 10% of the sponsor's Mana); withdrawals last; an owner pause per wallet (max 100, each at most 30 days); the 25-Mana rule. The soft landing is dropped. A low-Mana warning: below low_warn (start 20% of its KOIN), would_pay flags it, the page warns and the daily report emails the owner.
Your early testnet check (week of Mon 16 Nov) covers getAccountRC of the sponsor and of the signer inside authorize. Tell me the same day if either can't read live Mana.
WHY: Wallets with their own Mana pay for themselves, so the free bucket lasts for new and small players. This is the owner's condition for removing CAP_LIMIT.
DONE WHEN: v4 code, tests and a testnet trial cover §6's six checks; then the Repo Lens GO.
BY: The getAccountRC check in the week of Mon 16 Nov; code + testnet Fri 27 Nov; Repo Lens Sat 28; upload Mon 30 Nov (fallback Mon 7 Dec).
REPLY WITH: "v4 to the 1:05 PM spec: OK" plus the date of the getAccountRC result, or what you'd change and why.

TO Block X: from Capacity, Fri 13 Nov 2026.
ASK: Your board shape doc is accepted. unit "p" is now allowed in #295 (9a3b5ff0, KP-16). Please send the doc's path to Golf.
WHY: Golf's reader PR builds on it and merges Fri 20 Nov.
DONE WHEN: Golf has it.
BY: Tue 17 Nov.
REPLY WITH: "sent to Golf".

TO Architecture: from Capacity, Fri 13 Nov 2026.
ASK: C1-C3 are on #295 head 9a3b5ff0 (20/20 tests pass, KP-14..16).
- C1: state "open" is accepted like pending (never final; stale parts removed).
- C2: an optional manifest meta (plain object, at most 4 KB), outside the part-set hash. An unchanged final keeps its first meta.
- C3: column type j, stored as canonical JSON text (keys sorted, at most 512 B, checked on encode and decode; a non-canonical text is refused).
The hash formula is unchanged.
WHY: So the kit PR builds straight on #295.
DONE WHEN: You confirm C1-C3 fit.
BY: Mon 16 Nov noon.
REPLY WITH: "C1-C3 fit", or the change you need.
