# Names on Knode Games (Koinos @names and pool names)

**Owner, 30 Oct 2026: one name per wallet, the Koinos @name.** Pages show, for each address, in this order of preference:
1. its **Koinos @name** (the main token on the Koinos Nicknames contract `1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz`), `@jga · 1Abc12…wxyz`;
2. for a block producer that runs a pool, the **pool's name** (the pool contract's `get_pool_params`, the same name
   koinosscan.com shows), `JGA Pool #2 · 1MbsVf…8CzW`;
3. otherwise the short address. A name is always shown next to the short address, so it can never pass for another wallet.

**The older "Knode Games names" are gone** (4 Nov 2026, R-HUB-5): players used to claim a name by signing a message
and opening a GitHub issue. That flow, its issue template, the workflow steps that read and answered issues, and the
`check` / `add` / `remove` commands were removed; no workflow holds an issues permission any more. The one name
claimed that way was dropped (owner's call); that wallet shows its @name or short address. `names.json` keeps an
empty `names` object so older pages still read it.

## Get a Koinos @name
knodegames.com/names.html (Tools → Get an @name). Connect the wallet (Kondor or KOIN Vault), type a name: the page asks
the Nicknames contract live whether it's available (`verify_valid_name` answers "@name is available" or the reason),
and **Create** mints it from the player's own wallet (`mint { to: the wallet, token_id: hex of the name }`, their own
Mana; the Mana sponsor never pays for it). Contract rules: 3 to 32 characters, lowercase letters, numbers, dots and
dashes, each word starting with a letter, and not too close to an existing name.

**Your @names** on the same page lists the wallet's names: **Make main** (`set_main_token`: the name Knode Games and
other Koinos apps show) and **Remove** (`burn`, asked twice). Minting does not set the main name (I-020). A change is
"Done" only when a read of the chain shows it (Repo Lens #C-5). Pages show a new main name at once on that device and
everywhere usually within the hour.

## Rules for what pages show (names.js, `KNames.rules`)
- @names: refreshed hourly for producers, leaderboard players and question-game players (producers first, 20 at a
  time, within 4 minutes; at most 3,000); an @name counts only when both nodes return the same one. A wallet whose
  read fails keeps its last @name. The bot shows a main @name only if `get_address(name)` is that wallet (C5-9).
- Reserved: an @name or pool name that imitates Knode Games or Koinos (equal to Koinos, admin, support, Knode;
  containing Knode Games, Knode pool, Knode Swap, official, or Koinos + Foundation / Group / Team …; starting with
  Knode), lookalikes included, is not shown. The two Knode Games nodes keep their names.
- Never shaped like an address: no "1" followed by 5 or more address characters, and no `...` / `…`.
- Pool names are read hourly for the producers seen in the last 30 days, from two nodes that must agree.

## Owner commands (PC, repo folder; dry run unless `--send`; uses your own git login, changes only names-data)
```
npm run names -- list                                  @names, pool names, hidden addresses
npm run names -- hide <address> "<reason>" --send      the site shows its short address instead of its @name
npm run names -- unhide <address> --send
npm run names -- nicknames --send                       refresh @names and pool names now (the workflow does it hourly)
```

## How it runs (.github/workflows/names.yml)
- Once an hour (minute 4), while the repository variable `NAMES_ENABLED` is `true`:
  - **check** (read-only token: contents read, no secrets) runs `bot/names.ts run`, which reads the chain (players,
    @names, pool names) through two nodes (`vars.RPC`, `vars.RPC_CHECK`) and hands on names.json if it changed.
  - **publish** (contents: write, runs no repository code) checks names.json's shape and pushes it as the only file on
    the `names-data` branch. Refused if names-data moved since the check read it; it is read again on the next run.
- Pages read `https://raw.githubusercontent.com/bawcejawn/KnodeGames/names-data/names.json` through `names.js`
  (`KNames.of(address)`, `KNames.node(address)`), check every entry's shape and rules again, ignore a file over 2 MB,
  and only ever use `textContent`.
- The owner CLI pushes to whatever `origin` is in the folder you run it from, and runs the code checked out there.

## Using it on a page
Load `<script src="names.js"></script>` before the page script, add
`https://raw.githubusercontent.com/bawcejawn/KnodeGames/names-data/` to the page's CSP `connect-src`, show wallets with
`KNames.of(a)` (text) or `KNames.node(a)` (element), and redraw on `KNames.onChange(fn)`. The shared leaderboard
(`board.js`) does this by itself on any page that loads `names.js`.
