# Survivor: testing (no testnet season)

**Owner, 14 Nov 2026: no testnet season.** The old testnet kit (`bot/survivor-test.ts`, `tools/survivor-testnet/`) only ran the old recorder, which was removed. A real testnet season would take 12 days and push Season 1 past Mon 7 Dec. Instead:

1. **Season 1 is the live rehearsal.** It runs on mainnet from Mon 7 Dec 2026 with real picks and real ruler cards, and pays nothing (the vault's `from_week` is Season 2's first week, 9).
2. **The code is tested on fake nodes**, through the kit's real recorder and publish check, on the ruler's made-up test chain. Run them on any copy of the repo:

```powershell
cd C:\kprediction
git branch --show-current
npm ci
node --import tsx --test games/survivor/tests/math.test.mjs games/survivor/tests/recorder.test.ts games/survivor/tests/page.test.ts
npm run game:check -- survivor
```

What they cover:
- `math.test.mjs`: every rule, plus property tests over thousands of random seasons (the points always rank the season exactly).
- `recorder.test.ts`: the module, the no-card rule, the season-start check, and a whole season week through the kit's recorder and publish check going final.
- `page.test.ts`: the page's own code reads the parts folders the kit wrote and shows exactly the season `math.js` plays.
- `game:check`: the kit's conformance suite (sandboxed: no clock, network or randomness) and the sample week (`tests/sample.ts`, Season 1's first week) going final.

Nothing here touches the chain, a wallet, the vault or GitHub.
