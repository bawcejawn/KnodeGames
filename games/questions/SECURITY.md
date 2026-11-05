# Daily Questions recorder — security checklist

| Check | Answer |
|---|---|
| Holds tokens? | No. The vault pays; this only records. |
| Keys used by the recorder | None (read-only). |
| Chain data read, and from which two nodes | Kpred vault `get_state`, `get_question`, `list_players`, on `RPC` (Armana) and `RPC_CHECK` (koinosblocks). The two snapshots must be identical; any failed read stops the run. |
| Files it writes (data branch and folder) | `games-data:questions/` — `W<NNN>.json`, `board.json`, `vault/W<w>.json`, `vault/HOLD-W<w>.json`, `vault/RELEASE-W<w>.json`. |
| Workflow permissions (must match the CI guard's list) | `games.yml`: record `contents: read` (no secrets); publish `contents: write` to `games-data` only, runs no repository code; `questions-alert` `permissions: {}`. |
| What a wrong run can do at worst | Publish wrong points or winners for one week. |
| What stops it | Two-node match; final only after two runs ≥ 1 h apart; the publish job recomputes every point, place and winner from the inputs with its own scorer and checks the hash, the week, the 3-day window and its own clock; finals and vault files are written once; the vault bot reads the file twice ≥ 30 min apart, checks it against `board.json`, re-checks every stake and free winner on chain; the contract refuses points above a player's answers or fewer than 2 answers; the owner can hold the week and correct results for 24 h after the seal. |
| Not covered | The publish job can't re-read the chain: inputs that both nodes agreed on are trusted. The vault bot doesn't recompute points yet (I-080). |
| Sponsor rows and their measured Mana | None new (players' `answer` is unchanged: limit 1.2 Mana). |
| Handicap source | None (no VHP handicap in Daily Questions). |
| Repo Lens reviews | Pending (PR for I-101). |
| Free-prize ties | Up to 10 wallets per place, ties share. More than 10 qualifying for one place: exactly 10, by the earlier score time, then address (owner, 5 Nov); never zero for the cap. Score time = the lock time of the question that gave the player's last point (entries don't store answer times). |
| Accepted risks | None beyond "Not covered" above. |
