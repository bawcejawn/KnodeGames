# Fantasy Producers (game 4) and Weekly Rival (game 5)

The first game on the Shared Game Kit (D-158 #4). Rules: `.ai/games/FantasyProducers.md`; decisions in
`claude/fantasy/SIM-FANTASY-ON-RULER-2026-11-11.md` and `claude/fantasy/TO-ARCHITECTURE-FANTASY-PORT-PREP-2026-11-11.md`.

| File | What |
|---|---|
| `math.js` | Every rule, pure (the page uses the same file): price list, points (cap 150, captain ×2, void 0), one change a day, Weekly Rival. |
| `recorder.ts` | The kit `GameModule`: 7 rounds a week (Mon–Sat play, Sunday fun round), the write-once price list (`inputsFile`), each day's result from the VHP Ruler's day card, the carried team, Rival records. |
| `ruler-view.ts` | The contract the kit's ruler source (`ctx.vhp`, kit Phase 1b) must meet. |
| `tests/` | `math.test.mjs` (the rules), `recorder.test.ts` (the module with a fake ruler). |

**Status:** building. Waits on kit PR #261, kit Phase 1b (the ruler source), ruler PR #262 and the Ruler chat's G6
(a row for every listed producer). Until `ctx.vhp` exists the module makes no price list and every day is PENDING.

Points are kept in hundredths: a producer's day is at most 15000 (= 150.00); a team's day at most 90000.
