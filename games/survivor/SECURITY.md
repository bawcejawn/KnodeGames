# Survivor (kit module) — security checklist

| Check | Answer |
|---|---|
| Holds tokens? | No. The vault pays; this only records. |
| Keys used by the recorder | None (read-only, through the kit). |
| Chain data read, and from which two nodes | Through the kit only: Picks contract `list_picks` (game 3, one round a day), vault `get_state`, `get_game`, `get_game_player`, on `RPC` and `RPC_CHECK`; both must agree. Block heights through the kit's `ctx.blockAt` (pinned to the lower of the two nodes' irreversible blocks). |
| VHP data | The ruler's published `vhp-data` branch, read only, through the kit's `ctx.vhp`. The publish job rebuilds every card a week file lists (G3). |
| Files it writes | Only through the kit: `games-data:survivor/` (`W<NNN>.json`, `board.json`, `alltime.json`, `vault/…`). |
| Workflow permissions | None yet: no workflow job is rendered while `status` is `building`. When enabled, the kit's rendered job (record `contents: read`, publish writes `games-data` only and runs no repository code). |
| What a wrong run can do at worst | Publish wrong lives, points or staked rows for one week. |
| What stops it | Two-node reads; one ruler card per decided day, rebuilt by the publish job; every round re-read and re-scored on both nodes at the week's end; final only after runs at least 2 h apart agree; finals and vault files are written once; the vault re-checks stakes on chain. `scoreRound` refuses to run without the season's staked board (no guessing the boards). |
| Not covered | The publish job doesn't recompute Survivor's lives (no per-game scorer in the publish job, D-158): it checks the week's tally from the published per-round points. The vault doesn't recompute results from the chain (I-051). |
| Sponsor rows and their measured Mana | Picks `pick` for game 3 (the existing "KnodeGames Picks pick" row, 1.3 Mana). The sponsor allowlist row for game 3 is a launch step. |
| Handicap source | The shared VHP ruler (RULE_VERSION 4), mode A until the kit's card settings carry `mode` (kit need K6). |
| Repo Lens reviews | Pass 4 not sent (owner, 12 Nov: no Repo Lens before Tue 24 Nov). Passes 1–3 reviewed the old recorder (`bot/games/survivor.ts`), which this module replaces. |
| Free-prize ties | The kit's rule (D-159). The free prize is OFF and stays OFF until kit needs K3 and K5 are built. |
| Accepted risks | None new. The ruler finding (two steady under-signing producers land in the out-zone about 90% of days) is an open question to the owner and the Ruler chat (`docs/SURVIVOR.md`). |
