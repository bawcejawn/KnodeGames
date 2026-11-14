# Sponsor v4: spec (Capacity chat, Fri 13 Nov 2026; revised 1:05 PM ET with the owner's adjustment)

Owner, Fri 13 Nov 11:51 AM ET: "top off the sponsor wallet to 50,000 KOIN and we can increase limits to 20% of that in
Mana. Transactions request more Mana than they actually use, so the Sponsor contract should track how much Mana to give
out daily based on what was actually used, not shown to the user. The 20% should be rolling over 24 hours, not a reset
at X time. There should be some type of floating cap since some days will be busier than others."

Owner, 12:24 PM: drop the hard 5,000 ceiling, "but with different type of restrictor to protect the mana balance from
abuse so anyone can still enjoy and play." No pick limits in the games (no Race daily limit).

Owner, 1:03 PM: "Sponsor only covers users who have <25 available mana in their wallet. This way if users do have their
own mana, they can pay for transactions too, or use kondor's free mana. ... and then there can just be 1 main bucket
to pull from, not a free vs staked bucket."

## 1. Who the sponsor pays for: only wallets with less than 25 Mana of their own
- In `authorize`, the sponsor reads the **signer's** available Mana with `System.getAccountRC(signer)`.
- **25 or more:** the sponsor refuses. The wallet pays for itself, from its own Mana or Kondor's free Mana.
- **Under 25:** the sponsor may pay, subject to §2 to §4.
- The threshold `self_pay_min` is an owner setting. It starts at 25, bounds-checked 0 to 1,000.
- About 25 Mana means holding about 25 KOIN or more, since Mana refills up to the KOIN balance. Players with their own
  KOIN pay their own way. The sponsor's Mana goes to new and small wallets.
- **Site:** before sending, the page reads the wallet's Mana (the same call as today's Mana display).
  - At 25 or more, it sends normally, with no sponsor. The wallet pays.
  - Under 25, it asks the sponsor (`would_pay` first, as today).
  - If a wallet is refused because it holds 25+, the page says: "You have your own Mana: this one is on you."
- **Edge, accepted:** a wallet at 25.1 that spends down to 24.9 becomes sponsored for its next transaction. Moving KOIN
  out to get under 25 leaves the wallet with little Mana anyway, and §3 still limits it.

## 2. The budget: the sponsor's own live Mana, one main bucket
- One live reading, `System.getAccountRC(sponsor)`. Koinos refills it continuously (20% of the KOIN a day, rolling, no
  reset) up to the KOIN balance, and it goes down by what transactions **actually burn**.
- With 50,000 KOIN that's up to ~50,000 stored and ~10,000 refilled a day. A quiet day leaves Mana for a busy one:
  the floating cap.
- **One main bucket for every sponsored action.** There is no free vs staked split and no guest share.
- **One reserve is kept** (funds safety): picks, answers, stakes and claims are paid only while the sponsor's Mana
  stays above `withdraw_reserve`. Withdrawals and unstakes are paid down to the last Mana, so a busy day can never
  block someone taking their stake out. It starts at 2,000; owner setting.
- **Removed from v3:** the hard 5,000-a-day ceiling (`CAP_LIMIT`), the counted daily and free-pool totals, the weekly
  caps, and the guest / staked split.

## 3. Protecting the bucket from abuse (so anyone can still play)
| # | Restrictor | What it stops | Start value (owner sets) |
|---|---|---|---|
| 1 | **Per-wallet rolling allowance:** each sponsored wallet can use up to C Mana, refilled C/24 an hour. Same for every wallet | one wallet taking a big share of the day | C = 40 (about 33 picks a day; a typical player uses ~12) |
| 2 | **Pace limit:** all sponsored transactions together spend at most P% of the sponsor's Mana in any rolling hour | a flood of new wallets draining the bucket in minutes | P = 10% an hour |
| 3 | **Withdrawals last** (§2) | abuse ever blocking a withdrawal | reserve 2,000 |
| 4 | **Owner pause per wallet:** the owner can stop sponsoring one wallet (max 100 entries, each with an end date at most 30 days ahead) | one abusive wallet that stays inside its allowance all day | empty |
| 5 | **The 25-Mana rule** (§1) | wallets with their own Mana using the free bucket | 25 |

- Per-wallet counting uses the transaction's `rc_limit`, because the contract can't see the burn while it decides.
  The site sets `rc_limit` close to the real burn (BATCHED-PICKS-SPEC).
- The soft landing (half-speed refills when the bucket is low) from the 12:24 PM draft is dropped. With one bucket and
  the pace limit it isn't needed.

## 4. Low-Mana warning (owner, 1:03 PM)
- `would_pay` reports the sponsor's live Mana and which rule would stop a transaction.
- When the sponsor's Mana falls under `low_warn` (start 20% of its KOIN), the page shows: "Free Mana is low right now.
  If a pick fails, try again later, or use your own Mana or Kondor's free Mana."
- The daily limits report emails the owner at the same point.

## 5. What stays from v3
- Allow-list and argument checks (S-1 canonical encoding).
- One payee and one signer.
- 1 to 10 operations; the per-transaction cap; the per-action limits.
- The real-player rule (`isPlayer`); the read-only `would_pay`; the owner's own transactions; switch off.

## 6. Safety and testnet (T7, before mainnet)
- The sponsor can never spend more than its Mana (the chain enforces it). KOIN never leaves it except by the owner.
- `set_config` bounds: `self_pay_min` 0 to 1,000; `withdraw_reserve` up to the KOIN balance; C ≥ the per-transaction
  cap; P from 1 to 100; the pause list ≤ 100, with each end date ≤ 30 days.
- Testnet must show:
  1. `getAccountRC` inside `authorize` reads the live Mana of both the sponsor and the signer.
  2. How pending transactions in the same block affect it.
  3. A wallet with ≥ 25 Mana is refused, and one with < 25 is paid.
  4. A flood stops at the pace limit.
  5. Withdrawals pass under the reserve.
  6. A paused wallet is refused.

## Owners and dates
| Step | Who | By (ET) |
|---|---|---|
| This spec | Capacity | Fri 13 Nov (done, revised 1:05 PM) |
| Early check: does `getAccountRC` work inside `authorize` (sponsor and signer) | Block X chat | week of Mon 16 Nov |
| Contract + tests + testnet trial | Block X chat (sponsor owner) | Fri 27 Nov |
| Site: own-Mana check before asking the sponsor, refusal text, low-Mana warning | Hub chat, with Capacity | Fri 27 Nov |
| Repo Lens round | Repo Lens | Sat 28 Nov |
| Top-up to 50,000 KOIN | owner | any time (works on v3 too) |
| Upload (dry run first, owner sends) + settings | owner | Mon 30 Nov (fallback Mon 7 Dec) |
