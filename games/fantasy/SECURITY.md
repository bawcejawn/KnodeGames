# Fantasy Producers recorder (games 4 and 5, on the Shared Game Kit) — security checklist

| Check | Answer |
|---|---|
| Holds tokens? | No. The vault pays; this only records. |
| Keys used by the recorder | None (read-only). |
| Chain data read, and from which two nodes | Through the kit only: Picks contract `list_picks` for games 4 (teams) and 5 (Weekly Rival), and the vault's `get_state` / `get_game_player` for stakes, on both nodes; the kit requires them to agree. |
| Other data read | The VHP Ruler's published `vhp-data` branch (read-only; the rendered job fetches it into `KIT_VHP_DATA`), through the kit's ruler source (`ctx.vhp`, kit Phase 1b, #267): each UTC day's card is made and scored by the real ruler code (`vhp-ruler.js`, RULE_VERSION 4). Block heights for a UTC time come from the kit's `ctx.blockAt` (G7), read on both nodes. |
| Files it writes (data branch and folder) | Through the kit only: `games-data:fantasy/` — `inputs/W<w>.json` (the write-once price list), `W<NNN>.json`, `board.json`, `alltime.json`, `vault/W<w>.json`, `vault/HOLD-W<w>.json`, `vault/RELEASE-W<w>.json`. |
| Workflow permissions | The kit's rendered jobs in `games.yml`: `record-fantasy` (contents: read, no secrets) and the kit's `publish-kit` (contents: write, pushes only kit games' folders on `games-data`, runs no repository code; added to the CI guard's write list, C5-14). Both run only when `FANTASY_ENABLED` is true. |
| What a wrong run can do at worst | Publish wrong points for one week. |
| What stops it | The kit's two-node reads, stability wait, write-once files and holds; the price list is write-once and published before the week opens, its sha256 is in every week file, and the recorder recounts it at the week's end and holds the week if it differs (FC-9); every ruler card used is listed by its settings and sha256 in the week and inputs files, and the publish job rebuilds each new card with its embedded `vhp_ruler.py` (G3, #267). |
| Not covered | Nothing is ever guessed: missing data is NotYet (pending). Until the kit carries the ruler's G6 `include` (Fantasy passes it), a day whose card lacks a listed producer stays pending. The 48-hour no-card rule needs the kit's `ctx.fallback`; until then such a day stays pending. |
| Sponsor rows and their measured Mana | Picks `pick` (a team of 5): limit 1.3 Mana, the same as a Block X pick on the same contract. **To measure on testnet** before launch. |
| Handicap source | The VHP Ruler (RULE_VERSION 4), daily cards. `FANTASY_RULER_FROM_WEEK` = the first live week; the practice week is the shadow week. |
| Repo Lens reviews | Pending (this port). #B-10 (on the old recorder, branch `fantasy` @ `a60da0b`) is the reference. |
| Free-prize ties | The kit's D-159. Free prize OFF (`freePrizeDefault: off`). |
| Picks before the lock | Public on chain for the first week(s) (owner 11 Nov, stated in Terms); hidden picks (FC-14) go in when the Picks contract supports them. |
| Accepted risks | None beyond "Not covered" above. |
