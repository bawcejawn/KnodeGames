# Knode Games

**Prediction games about the Koinos blockchain, powered by its own block producer.** Players call what Koinos block
producers will do next: answer daily questions, pick who signs a future block, back a producer in a race. Correct
calls climb a weekly leaderboard for each game. Every game is **free to play**, and players who **stake VHP** share
the rewards that the stake earns by producing blocks.

Play: <https://knodegames.com> (any browser; on a phone, "Add to Home Screen" installs it like an app).

**Project status at a glance:** [`STATUS.md`](STATUS.md) (what's live, in progress, blocked and decided).

## How it works

- **One vault holds every stake.** All staked VHP sits in one contract, the vault
  (`1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`), which produces Koinos blocks as the **Knode Games Pool**. Only the vault
  holds players' tokens.
- **Stakes are always withdrawable.** Any amount, at any time, down to the last decimal. Nobody, not the owner, the
  bot or a game, can move a player's stake or rewards. An emergency "withdrawals-only" build exists that stops
  everything except taking money out.
- **Stake per game.** A stake belongs to one game (at least 1 VHP each); you can stake in several games at once and
  move stake between them.
- **Everything that decides money is on chain or checkable.** Stakes, picks, answers, scores and payouts are recorded
  on Koinos. Results that are computed off chain (from the blocks) are published with fingerprints and re-checked on
  two independent nodes before anything is paid.

### How the vault pays
Each week (Monday to Monday, UTC):
1. The vault's block rewards are added up.
2. A flat **5% fee** comes off.
3. **Free-play prizes** are paid: **2 VHP** for 1st and **1 VHP** for 2nd on each game's Free board (where that game's
   free prize is switched on).
4. The rest is **split across the staked games by each game's share of the stake**, and each game shares its part
   among its own staked players by its own rules.

Unclaimed rewards wait for you, with no deadline, and keep producing for the pool meanwhile.

## The games

| Game | What you do | Status |
|---|---|---|
| **Daily Questions** | Answer multiple-choice questions about what producers will do next ("How many blocks will this producer sign in the next 8 hours?") | **Live** and paying |
| **Who Signs Block X** | Pick which producer will sign a target block | **Live**; pays from Mon 9 Nov 2026 |
| **Producer Race** | Four races a day; back a producer, with handicaps so small producers can win too | **Live**; pays from Mon 9 Nov 2026 |
| Survivor | Pick one producer a day for two weeks and avoid the ones that fall behind | coming |
| Producer Bracket | A weekly knockout tournament of producers | coming |
| Fantasy Producers | Draft five producers under a salary cap | coming |
| Last Node Standing | A daily elimination event among producers | coming |
| Block Golf | A course across all the games: each game is a hole | coming |
| Combo Card | Combine Race and Block X calls into one card | coming |

Every new game goes through the same checks before it pays: an independent review, a test run and a public
announcement on chain at least 48 hours ahead.

## Free to play: the Mana sponsor

Koinos has no transaction fees; it uses **Mana**, which comes from holding KOIN and refills on its own. New players
often have none, so Knode Games runs its own **Mana sponsor** (`1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8`): it pays the Mana
for players' game actions (answers, picks, staking, withdrawing, claiming), within per-transaction, daily and weekly
limits. It only pays Mana: it never signs or moves anything for players. When it can't pay (a limit reached, or the
KOIN Vault app, which picks its own payer), the player's own wallet pays, and **withdrawals never depend on it**.
Details: [`sponsor/README.md`](sponsor/README.md).

## Daily Questions in detail

The original game, built into the vault as game 1. Every right answer is a point; each week the best staked players
share Daily Questions' part of the rewards, and the best free players win the free prize.

### The week

All times are UTC. A week runs Monday 00:00 to Sunday 24:00.

| When | What happens |
|---|---|
| Monday to Saturday, 12:00 | New questions: 5 a day (30 a week) until Mon 9 Nov, then the two rounds below. They are numbered Q1, Q2, … within the week. Monday and Tuesday are easy, Wednesday and Thursday medium, Friday and Saturday hard. |
| From Mon 9 Nov: Monday to Saturday, 00:00 and 12:00 | Two rounds a day: 2 at 00:00 (answers close at 12:00) and 3 at 12:00 (answers close at 00:00), 30 a week. From the first week the upgraded contract allows it: 4 + 4, 48 a week. |
| The next day, 00:00 | Answers close (12 hours after release), before the blocks the question is about are made. |
| After each question's blocks are final | The bot posts the result. Your points update right away. |
| Sunday | No new questions: results day. |
| Monday, 12:00 | The week closes (12 hours after it ends, so a wrong result can still be corrected). The bot closes it: a player's action never does. |
| Tuesday, 12:00 | Winners are final (24 hours to settle). Rewards can be collected from then on, with no deadline. |
| Once the vault upgrade applies | Daily Questions is paid like every vault game: no settle step; its weekly results file is posted by **Thursday 00:00**, open to correction for 24 hours, then final; rewards are collected on the Stake page. |

### Playing

- **Wallet.** Kondor in Chrome on a computer, KOIN Vault on a phone, or the site's built-in **guest** wallet (play only, no funds).
- **Free play.** Anyone can answer and climb the leaderboard without staking.
- **Staking.** Stake at least **1 VHP** (whole numbers) to share the weekly rewards, on the **Stake page** (`stake.html`),
  the same for every game: stake, withdraw, or move stake between games. You can also stake KOIN: the game
  burns it into VHP for you. A stake counts from the next week. Your stake is never spent: you can withdraw any
  amount at any time, down to the last decimal. Withdraw part during a week and you keep playing with the lower
  stake; withdraw everything and you are out of that week's rewards.
- **Scoring.** One point per right answer. A voided question counts for nobody. The week's top possible score is that week's number of questions (30 for now, 48 once the upgraded contract allows it).

### Rewards (Daily Questions' share)

Daily Questions' pot each week is its share of what the vault earned producing blocks (see [How the vault pays](#how-the-vault-pays)). Rewards are paid in VHP.

1. **5% fee** comes off first (for the whole vault).
2. **Free-player prize: 2 VHP for 1st and 1 VHP for 2nd** (from the week of 9 Nov, as every free game; the week of
   2 Nov paid 1 + 1 VHP). A free player is one whose stake was never at or above the minimum that week, who answered
   at least 2 questions that counted and scored at least 1 point.
3. **Winners:** the top **30%** of staked players (by headcount) who scored at least 1 point. Ties at the line win too.
   Higher places weigh more: place *r* weighs 1/√*r*.
4. **The rest is split in two baskets:**
   - **Basket A, 40%:** shared by place weight × stake, counting at most **10 VHP** per wallet, so a small stake still
     earns a real share.
   - **Basket B, 60%:** shared by place weight × full stake, so staking more pays more.
5. **No staked winners?** The free-player prize is still paid; the rest carries into next week.
6. **Collect** from Tuesday 12:00 on the Play page; once the vault upgrade applies, on the Stake page with every game's
   rewards (earlier weeks stay collectable on the Play page). Unclaimed rewards wait for you and keep producing for the pool.

Before v5 (Weeks 1 and 2) the rules were: 65% of what the seed and unclaimed pots earned was shared by place alone,
the rest by place × stake; up to 64 questions a week; no free-player prize.

### How results are decided

- Each question is built from the recent block history (see [`docs/QUESTIONS.md`](docs/QUESTIONS.md)). Its settings
  (template, producers, block range, thresholds) are hashed, and the hash (`paramsHash`) is posted on chain when the
  question is released, so the question can't be changed afterwards. Questions released with `hashRule: 2` (from October 2026) also cover their wording, so an option cannot be relabelled
  after release: the hash includes the title, the text and every option's label and range. The website checks every question file against the chain before offering it.
- After the window's blocks are final, the bot counts them and posts the result with `dataHash`, the SHA-256 of the
  exact blocks used (`height,signer,timestamp,txCount` per line). Anyone can recount.
- The bot reads blocks from `koinos.armana.io` and checks every window against a second, independent node
  (`api.koinosblocks.com`); if they disagree, nothing is posted and the owner is emailed. The website reads the chain
  from `api.koinos.io`.
- The owner can correct a result until the correction deadline (before the week is final). The site always shows the
  result recorded on chain.
- To recount recent results against your own node: `npm run bot -- verify-results`.

## Open network: anyone can influence the results

Koinos is an open network. Anyone can stake VHP, run a block producer or send transactions, and each of those changes
what the blocks show. So players, producers and anyone else can influence the results of the questions. That is
allowed: every way of influencing a result counts as part of the game.

The project takes part too. It runs the Knode Swap desk (`1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR`, which produces blocks)
and a block-producer node of its own. Both can appear in questions like any other producer. Only the game's own pool
(the Kpred contract) is never a subject.

A question is **voided** (it counts for nobody) when:

1. a producer it names goes offline during its window (the longest silence is longer than chance allows; the rule and
   its numbers are saved with the question), or
2. **VHP swing:** a producer it is about (its subjects), the combined VHP of a group question's members, or the whole
   network's VHP for network-wide questions (M4–M7: block gaps, block interval, empty blocks, transactions), gained or
   lost **more than `voidVhpSwing`** compared with its release, in a reading taken during the question's window before
   its blocks decided the answer. `voidVhpSwing` is a setting in `game-data/game.json` (`model.voidVhpSwing`, 0.10 = 10%).

How the VHP-swing rule is applied, exactly:

- **At release** the generator reads the VHP balance of each producer the question is about (or the VHP token's total
  supply, saved under the key `network`) at the newest block, and saves it in the question as `model.vhp`, with that
  block height (`model.vhpHeight`) and the limit (`model.voidVhpSwing`). All three are part of the `paramsHash` posted
  on chain, so they cannot be changed afterwards.
- **During the window** the bot reads the same balances again on every run (it runs every hour, at minute 7) and adds
  each reading to the question file's `vhpReadings` (block height, time, values and the bot's seal). The height is read
  after the balances, so the balances are from that block or earlier. A reading whose height is after the window's
  last block is not kept. The readings are hourly samples: a swing that starts and is undone between two readings is
  not seen.
- **Only readings taken before the answer was decided count.** The answer is decided at the first block from which
  the chance that the window's remaining blocks change the option is below `decidedChance` (a setting in
  `game-data/game.json`, `model.decidedChance`, default 1e-9; saved with each question at release, so it is part of
  its `paramsHash`), or from which no remaining block could change it at all (`vhpCheck.decidedHeight` in the result).
  The chance is a conservative bound: each producer that could move the answer is assumed to produce each remaining
  block at an upper bound of its own rate so far in this window (k blocks out of n give at most
  (k + L + √(L² + 2kL)) / n, L = ln(8 / decidedChance), which is wrong with a chance of at most decidedChance / 8),
  the share of empty blocks likewise; the chance of reaching another option is the Chernoff bound of a binomial count
  (e^−μ (eμ / m)^m for m more blocks with mean μ), summed over every way the option could change and added to the
  chance that a rate bound is wrong. Over/under counts, head-to-head and combined differences and the empty-block
  share are decided this way. The network's transactions and the longest gap are decided only once they passed the
  top threshold, and the average block interval only at the window's last block. A reading taken after the decided
  block never voids, whatever it shows. Without this, the last hourly reading of a window would often come when the
  answer is already public, and a loser could buy a void. With `decidedChance` 0, only certainty counts.
- The question is void if, in any counted reading (`windowStart ≤ height ≤ decidedHeight`), for any of those producers
  (or the network, or the group's combined VHP), `|reading − release| > voidVhpSwing × release` (exact integer
  arithmetic).
  - A reading taken after the window's last block never voids, whatever it shows.
  - A group question (M10) is checked on its members' combined VHP, so a gift to its smallest member does not void it
    unless it moves the whole group by more than the limit.
  - If no reading was taken before the answer was decided, the rule is skipped and the question resolves on its
    blocks alone. The result's `vhpCheck.skipped` says why and the site shows it. The bot emails you when no reading
    was taken during the window at all (the bot was down, or every VHP read failed); when its readings all came after
    an early decision, it only logs it.
  - The offline rule (1. above) also stops at the decided block for these questions: a producer that goes silent once
    the answer is public no longer voids it.
  - A producer with no VHP at release is not checked (any amount would be an infinite change).
- The result's `vhpCheck` lists the heights of the readings used and, for each producer (or the group), the reading
  with the largest change, so anyone can check it.
- **Anyone can trigger a VHP-swing void, not only the producer.** A producer can move its own VHP (it costs only
  Mana). Anyone else can do it too, by sending or burning VHP to a producer the question is about, or by swapping VHP
  into the Knode Swap desk (a producer like any other). It costs the VHP they move: more than 10% of the producer's VHP
  (of the group's combined VHP for a group question). This is part of "anyone can influence the results", and the
  reason readings stop counting once the blocks have decided the answer.
- Questions released before this rule existed have no `model.vhp`; they keep the rules they were released with.

## Getting KOIN and VHP

There are no exchange listings for KOIN at the moment. The route (also on the site's **Get VHP** page):

1. Get a Koinos wallet (KOIN Vault or Kondor).
2. Buy **vKOIN** on Ethereum (Uniswap, token `0xa50ad3a559a10f384a5bb2e27516f63e0b937b1a`) or on Solana (Jupiter,
   token `8AUxdPqYU4FBy5rZDhMJxTniPs7gtEfdHjP3UKM71m6G`).
3. Bridge it to Koinos with the **Vortex bridge** (<https://vortexbridge.io/bridge>). It arrives as KOIN.
4. Burn KOIN into VHP 1:1 (keep a little KOIN for Mana), or stake KOIN directly and let the game burn it.
5. Stake in Knode Games (the **Stake** tab).
6. To turn VHP back into KOIN: **Knode Swap** on the site (the **Swap** page) (or KoinDX).

## Knode Swap

A separate contract (`1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR`) that swaps VHP for KOIN at 1:1 minus a **3%** fee, paid
from the KOIN it holds, in one transaction. You always set the minimum KOIN you accept. Any change that loosens it (a
lower fee, a higher limit, a new owner) waits 48 hours. Details: [`desk/README.md`](desk/README.md).

## Who controls what

| Role | Can | Can't |
|---|---|---|
| Players | stake, withdraw any time, move stake between games, play, collect | anything else |
| Bot (operator) | post questions and results, close and settle weeks | move any funds |
| Owner | correct results before they are final, pause new deposits, add or stop games and upgrade contracts (announced on chain 48 hours ahead) | move players' stakes or rewards |
| Seed owner | add or withdraw the seed fund (withdrawals announced ahead) | touch players' stakes |
| Mana sponsor | pay players' Mana within its limits | sign or move anything for players |

Every change that could matter to players is announced on chain first, and the hourly bot watches the chain and
alerts the owner to anything unexpected.

## Check the contracts yourself

Anyone can rebuild the contracts and compare their fingerprints (sha256) with the code on chain:

```
npm ci --ignore-scripts
cd game && npm ci --ignore-scripts && npm test && npm run check && cd ..
cd desk && npm ci --ignore-scripts && npm test && npm run check && cd ..
sha256sum game/build/release/contract.wasm desk/build/release/contract.wasm
npm run bot -- chain-check
```

| Contract | Address | Live code (sha256) |
|---|---|---|
| Vault (game contract, v6) | `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr` | `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` |
| Knode Swap (v2) | `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` | `309506ccfaadd3427e937aa88cd34c9ea2a9e6088e49e51f014d546489dd5f35` |
| Picks (Block X and later games) | `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm` | `700c296a1064b904299c156061d6caf8fcabd0b1765968903f29d89d2426c594` |
| Race picks | `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` | `61e8f21230e8b4bdb165bacfe7281517a5adf78f6c6b1b8a0d84ce41537afac5` |
| Mana sponsor (v3) | `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8` | `b84e1add3ffa14a7d1933d5ce5a4ad33caa4bca887a489f87f710b3c121c83a6` |

The site's **Trust** page shows the same numbers live. Upgrade runbooks are in [`docs/`](docs/).

## Repository layout

| Folder / file | What it is |
|---|---|
| `*.html`, `*.js`, `*.css`, `media/` | The website (GitHub Pages, https://knodegames.com) · `site/` only redirects old links |
| `game/` | The vault contract (AssemblyScript) and its tests ([`game/README.md`](game/README.md)) |
| `picks/`, `race/` | The Picks and Race picks contracts |
| `desk/` | Knode Swap contract and tests ([`desk/README.md`](desk/README.md)) |
| `sponsor/` | The Mana sponsor contract ([`sponsor/README.md`](sponsor/README.md)) |
| `bot/` | The hourly bot (questions, game results, payouts, chain watch) and the owner's tools ([`bot/README.md`](bot/README.md)) |
| `generator.ts`, `resolver.ts`, `common.ts` | Build and score the Daily Questions ([`docs/QUESTIONS.md`](docs/QUESTIONS.md)) |
| `backtest.ts`, `export-blocks.ts`, `data/` | Tune the question templates on real history |
| `game-data/`, `*-data/` | The public game files (questions, results, deployment details) |
| `.github/workflows/` | The bot, the game recorders and the test runs (GitHub Actions) |
| `node/` | Scripts for the project's Koinos nodes ([`node/README.md`](node/README.md)) |
| `tests/` | Security and regression tests from the reviews |
| `docs/` | Runbooks and wallet procedures |
| `.ai/` | The project's working library: plans, decisions, standards and status ([`.ai/START_HERE.md`](.ai/START_HERE.md)). Adding a game: [`.ai/standards/NEW_GAME.md`](.ai/standards/NEW_GAME.md); how every game's week runs: [`.ai/standards/WEEK_CYCLE.md`](.ai/standards/WEEK_CYCLE.md) |

## Running the tests

```
npm ci --ignore-scripts
cd game && npm ci --ignore-scripts && npm test && cd ..
cd desk && npm ci --ignore-scripts && npm test && cd ..
npm run test:resolver
node --import tsx --test bot/*.test.ts
node --import tsx --test --test-concurrency=1 tests/audit/*.test.ts tests/audit/*.test.mjs
```

The contract builds need `protoc` on the PATH. `.gitattributes` keeps every file with LF line endings.

## Security

Found a problem? Please report it privately: see [SECURITY.md](SECURITY.md).

## License

Copyright (c) 2026 Knode Games. All rights reserved. The source is **source-available**: it is public so anyone can
review it and check the deployed contracts, but it isn't open source. See [LICENSE](LICENSE).
