# Knode Games Admin page

One page on your PC that controls the whole platform. Start it:

```powershell
cd C:\kprediction
git branch --show-current   # must print main; if not, stop and ask
git pull
npm ci
npm run admin
```

It opens a link with a one-time key (a new one every start). It works only on this computer. Close it with Ctrl+C.

## How it's laid out

**Left: every part of the platform**, under five headings:

| Heading | Areas |
|---|---|
| Start here | Health checks (read-only status of everything); **Games at a glance** (every game on one screen); **All switches** (every GitHub variable) |
| Platform | Mana sponsor; Knode Vault (v6): add games, the free-prize switch, weekly results, corrections, the fees, the seed, pausing deposits, upgrades, the owner and bot wallets; Wallet names: claims sent to you, hide a name, refresh @nicknames |
| Games | One area per game, by game id (Question game 1, Block X 2, Survivor 3, Fantasy 4, Block Golf 6, Race 7, Combo 8, Bracket 9, Last Node Standing 13) |
| Knode Swap | The Desk |
| Testnet | Trials with test KOIN only: Vault v6 trial (your local testnet node; the public test copy is run by the Vault chat), Sponsor v3 trial |

Vault controls run `npm run bot -- games / game-add / …`, names controls run `npm run names -- …`, and the free-prize
switch runs `npm run prizes -- …`. Everything lives on `main`; never `git checkout picks` (it's an old branch without
the newer tools).

A game's id is the same number in the Picks contract and in the vault (the game id registry). Never register a Picks
game under an id the vault uses for a different game: the Mana sponsor treats a stake in vault game N as a stake in
Picks game N (audit SP-27).

Each area shows **Live**, **Launching**, **Testnet** or **Not live yet**. A game that isn't live yet says what will appear there and when.

**Middle: the chosen area.** At the top: what it is, its game id, which contract and key it runs on, and its runbook. Its
controls follow in the same order everywhere:

1. **Check (read-only)**: looks only.
2. **Adjustable rules and settings**: what you tune while the game runs.
3. **Emergency stop**: red edge. Stopping is always allowed, at once.
4. **Money in and out**: fees, seed funds, withdrawals.
5. **Launch steps**: numbered, in order.
6. **Upgrade the contract code**: numbered.
7. **Keys and ownership**: hand-overs.

**Every control card says:**
- **What it does**, in plain words.
- **When to use** it, where that matters.
- **Signed by**: which wallet's key from `.env` signs it.
- **Takes effect**: at once, or after 48 hours' notice.
- **Labels**:
  - Read-only, Edits files on this PC, or Changes the blockchain.
  - Mainnet or Testnet.
  - Step n, for numbered steps.
- **Runs**: the exact command it runs, the same as typing it in PowerShell.

**Right: the result** of the last thing you ran, and **This session**: everything you ran since starting, newest first.
Click one to see its output again.

**Search** (top left) looks through every control on the platform, for example "pause" lists every emergency stop.

## Games at a glance and All switches (12 Nov 2026)

Owner: "the admin panel should cover it all." Two screens under **Start here**, driven by `admin/switches.ts` (plain data, no keys):

- **Games at a glance.** A row per game in the vault's game list (1, 2, 3, 4, 6, 7, 8, 9, 13): the page's status, the vault state, the free-prize switch and the game's GitHub switches. **Check everything** runs six read-only checks one after another (vault games, prizes list, Questions status, Picks status, Race status, Golf status) and fills the table from them; the raw output sits underneath. Under the table, each game has a box with its launch steps (dates as the project docs gave them on 12 Nov: the checks are the truth) and the vault's own cards with **that game's id, name and season fixed** (read-only boxes): Add a game, Apply, Stop, free prize ON and OFF. They keep the usual rule: preview first, send only the same values, within 10 minutes. Every card has a **Copy** button that copies the exact command as you would type it.
- **All switches.** Every GitHub repository variable a workflow reads, for the platform and for each game: what to type, what it does, when, and what cannot be undone (for example `GOLF_STAKED_FROM_WEEK` is permanent). The page never holds a GitHub token, so a button opens GitHub's variables page and you set the value there. The free-prize switches are the exception: they live in `free-prizes.json` on the prize-settings branch and the page sets them itself (your git login, from next Monday).

**What lives where.** On chain (bot commands, signed by a wallet in `.env`): add / apply / stop a game, seed, fees, sponsor, upgrades. In the repository (page sets them): the free-prize switches. On GitHub (you set them): every `vars.*` variable.

**Nothing can be forgotten.** `npm run test:audit` (`tests/audit/admin.overview.test.ts`) fails if a game is in the vault list but not on the page, a workflow reads a variable the page doesn't list (or the page lists one no workflow reads), a game lacks its stake and prize controls, or the page asks for a key or token. When a game launches, its chat adds its controls under the rules below and its variables to `admin/switches.ts`.

## Safety (unchanged)

- Anything that changes something runs as a **dry run first** ("Preview"). The red button only unlocks after a successful
  preview with the exact same values, within 10 minutes, and asks you to confirm (showing mainnet or testnet, who signs
  and when it takes effect).
- Keys stay in `.env`; the page never sees them. Mainnet sends still need `CONFIRM_MAINNET=yes` in `.env`.
- Only this computer, only with the session key, only from the page itself. It can run only the commands listed in
  `admin/actions.ts`, with values checked against a pattern.

## Adding a game's controls (for each game's build chat)

All of it lives in `admin/actions.ts`:

1. The game's area is already in `AREAS` (by game id). When the game launches, set `status` to `"launching"` or
   `"live"`, fill in `contract` and `docs`, and remove `later`.
2. Add one entry to `ACTIONS` per control, with `area` set to the game's id and every field filled in plainly:
   - `kind` (check / settings / emergency / money / launch / upgrade / ownership);
   - `label`, `what`, `when`;
   - `signer`, `effect`, `timing`, `step`;
   - the command (`tool`, `args`, `params` with a strict `pattern`, a `hint` and, where there's a sensible one, a
     default `value`).
3. Every adjustable rule gets its own card, so the owner can see it and change it. Give every game an **Emergency stop**
   card if it has one.
4. A new command-line tool also needs its script in `admin/server.ts` (`run`) and in the `tool` list.
5. `npm run test:audit` checks every control is complete: known area and kind, plain-words fields filled in, a chain
   change names its signer and when it takes effect, testnet controls only in testnet areas, and every default passes
   its own check.
