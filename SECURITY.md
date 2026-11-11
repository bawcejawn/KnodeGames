# Security policy

Knode Games holds players' stakes in on-chain contracts on Koinos, so security reports are welcome and taken seriously.

## Reporting a problem
- **Please don't open a public issue** for anything that could put funds at risk.
- Report it privately through GitHub: **Security → Report a vulnerability** on this repository (a private advisory).
- Say what you found, how to reproduce it, and what it could affect. Please give us reasonable time to fix it before you
  share it publicly.

## What's in scope
- The contracts and their addresses: the vault `1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr`, Knode Swap
  `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR`, Picks `1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm`, Race picks
  `1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K` and the Mana sponsor `1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8`.
- The bot and the game recorders (`bot/`, `.github/workflows/`), and the website (https://knodegames.com).

## How the platform protects funds
- Only the vault holds players' tokens, and stakes are always withdrawable.
- Owner changes and upgrades are announced on chain at least 48 hours ahead, and the hourly bot alerts on anything
  unexpected.
- Results are checked on two independent nodes before anything is paid; a doubtful week is held, never paid on a guess.
- Every contract can be rebuilt from this repository and its fingerprint compared with the code on chain (see the
  README, "Check the contracts yourself").
