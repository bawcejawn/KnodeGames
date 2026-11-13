# Sponsor v4: spec (Capacity chat, Fri 13 Nov 2026)

Owner, Fri 13 Nov 11:51 AM ET: "top off the sponsor wallet to 50,000 KOIN and we can increase limits to 20% of that in
Mana. Transactions request more Mana than they actually use, so the Sponsor contract should track how much Mana to give
out daily based on what was actually used, not shown to the user. The 20% should be rolling over 24 hours, not a reset
at X time. There should be some type of floating cap since some days will be busier than others."

## The idea: the sponsor's own Mana is the budget
Koinos already does exactly what the owner describes: an account's Mana **refills continuously** (20% of its KOIN a
day, rolling, never a reset) up to its KOIN balance, and goes down by what transactions **actually burn**, not by what
they ask for. With 50,000 KOIN the sponsor holds up to 50,000 Mana and refills ~10,000 a day; a quiet day leaves Mana
in the tank for a busy one (the floating cap).

So v4 replaces the counted daily totals with one live reading: `System.getAccountRC(sponsor)` (the toolkit call exists
in `@koinos/sdk-as`). A transaction asking for L Mana is paid only if the sponsor's current Mana minus L stays above
the **floor for that kind of action**:

| Kind of action | Pays while the sponsor's Mana stays above | Example floors at 50,000 KOIN (owner sets them) |
|---|---|---|
| Withdraw / unstake (stakes always withdrawable) | 0 | 0 |
| Claims | the withdraw reserve | 2,000 |
| Players' picks, answers, stakes (wallets with a stake) | withdraw + claim reserves | 5,000 |
| Guests (wallets without a stake) | a guest floor | 15,000 |

As Mana runs low, guests stop first, then players' picks, then claims; **withdrawals are paid to the last Mana.** When
Mana refills, they come back in the same order. Nobody has to pick a reset time.

## Fairness per wallet: rolling 24 hours
Each wallet gets an allowance that refills evenly over 24 hours (a "bucket": up to C Mana, refilled C/24 an hour), so a
wallet that played this morning gets part of its allowance back this afternoon. No midnight reset. C = 40 (today's per-
wallet day) to start. Per-wallet counting uses the transaction's limit (the contract can't see the actual burn while it
decides), which is close to the burn because the site asks for the measured per-action limits.

## What stays from v3
Allow-list and argument checks; one payee, one signer; 1 to 10 operations; the per-transaction cap; the per-action
limits; real-player rule (`isPlayer`); the read-only `would_pay`; the owner's own transactions; switch off.
**Removed:** the hard 5,000-a-day ceiling (`CAP_LIMIT`), the counted everyone-per-day and free-pool totals, the weekly
caps. `would_pay` also reports the live Mana and which floor would stop a transaction.

## Safety
- The sponsor can never spend more than its Mana (the chain enforces it); KOIN never leaves it except by the owner.
- Floors are owner settings with bounds checked on `set_config` (withdraw <= claim <= player <= guest <= max Mana).
- **To check on testnet before mainnet** (T7): that `getAccountRC` during `authorize` reads the sponsor's current
  Mana, how pending transactions in the same block affect it, and that a burst of guest transactions stops at the
  guest floor while withdrawals still pass.

## Owners and dates
| Step | Who | By (ET) |
|---|---|---|
| This spec | Capacity | Fri 13 Nov (done) |
| Contract + tests + testnet trial | the sponsor's owner chat (Block X chat ran v3) | Fri 27 Nov |
| Repo Lens round | Repo Lens | Sat 28 Nov |
| Top-up to 50,000 KOIN | owner | any time (works on v3 too) |
| Upload (dry run first, owner sends) + floors set | owner | Mon 30 Nov |
