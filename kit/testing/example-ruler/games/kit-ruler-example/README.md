# Kit Ruler Example (test fixture)

Not a game. The second conformance fixture of the Shared Game Kit: a Fantasy-shaped module that uses every Phase 1 / 1b
hook — Picks-contract picks (`pickRound`), a carried team (`nextState`), `ctx.blockAt` and one VHP ruler card per decided
round (`ctx.vhp`, `cardPerRound`) — so `game:check` proves them end to end through the real publish check (including the
card rebuild). Lives under `kit/testing/example/games/`, so no workflow ever renders it.
