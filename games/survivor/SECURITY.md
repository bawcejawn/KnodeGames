# Survivor (kit module) — security checklist

| Check | Answer |
|---|---|
| Holds tokens? | No. The vault pays; this only records. |
| Keys used by the recorder | None (read-only, through the kit). |
| Chain data read, and from which two nodes | Through the kit only: Picks contract `list_picks` (game 3, one round a day), vault `get_state`, `get_game`, `get_game_player`, on `RPC` and `RPC_CHECK`; both must agree. Block heights through the kit's `ctx.blockAt` (both nodes, pinned to the lower last irreversible block). |
| VHP data | The ruler's published `vhp-data` branch, read only, through the kit's `ctx.vhp`. The publish job rebuilds every card a week file lists (G3). |
| Files it writes | Only through the kit: `games-data:survivor/` (`W<NNN>/` parts folders, `board.json`, `alltime.json`, `vault/…`). |
| Workflow permissions | The kit's rendered job in `games.yml`, gated by `SURVIVOR_ENABLED`: record `contents: read`; publish writes `games-data` only and runs no repository code. |
| What a wrong run can do at worst | Publish wrong lives, points or staked rows for one week. |
| What stops it | Two-node reads; one ruler card per card-decided day, rebuilt by the publish job; every round re-read on both nodes at the week's end; final only after runs at least 2 h apart agree; finals and vault files are written once; the vault re-checks stakes on chain. `scoreRound` refuses to run without the season's staked board, and stops if the kit's season start isn't `math.js`'s. A day with no card is skipped only through the kit's fallback (48 h on both nodes, the ruler's data loaded) and only with the kit's record of decided rounds, so a published day never flips. A round waits until every earlier day of the season is in. |
| Not covered | The publish job doesn't recompute Survivor's lives (no per-game scorer in the publish job, D-158): it checks the week's tally from the published per-round points. The vault doesn't recompute results from the chain (I-051). |
| Page | `survivor.js` builds everything with `textContent`, decodes only kgparts v1 parts (addresses checked), and sends one Picks `pick` operation the player confirms in their wallet. Picking is off if game 3's settings on chain differ from the page's. |
| Sponsor rows and their measured Mana | Picks `pick` for game 3 (the existing "KnodeGames Picks pick" row, 1.3 Mana). The sponsor allowlist row for game 3 is a launch step. |
| Handicap source | The shared VHP ruler (RULE_VERSION 4), mode A for Season 1 (Ruler chat, 13 Nov). |
| Repo Lens reviews | Pass 4 on the Survivor PR. Passes 1–3 reviewed the old recorder, now removed. |
| Free-prize ties | The kit's rule (D-159). The free prize is OFF and stays OFF until kit needs K3 and K5 are built. |
| Accepted risks | Season 1 (mode A): two steady under-signing producers land in the out-zone on most days; accepted for the practice season, out-zone rates recorded (Ruler chat, 13 Nov). |
