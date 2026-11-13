# KG parts v1: the shared file standard (split, compact, one hash over all parts)

Status: spec from the Capacity chat, Thu 12 Nov 2026 (asked by the Race chat for every game: Race first, then Block X,
Last Node and the kit games). Shared code: `kit/parts/parts.inline.mjs`, one self-contained file (node:fs, node:path, node:crypto) that recorders import and publish jobs embed verbatim, with tests in `kit/tests/parts.test.mjs` (Capacity builds, Architecture reviews; Repo Lens GO by Mon 16 Nov, merge Tue 17 Nov).
Measure before and after with `tools/capacity-harness/filesize.mjs`. Rule 0: no file a payout already used is converted
or renamed; `vault/W` and `HOLD-`/`RELEASE-` files are unchanged; every existing check stays.

## 1. Names
A logical file that used to be one JSON (`race-data/W004.json`, `T004.json`, `R004-1.json`) becomes a folder with the same base name:
```
race-data/W004/manifest.json            the only file that changes between runs (and the only one a page reads first)
race-data/W004/ref.<h12>.json           optional, write-once reference data (e.g. cards known at week open)
race-data/W004/d3.<h12>.json            one part per unit; the unit is the game's choice: d<1-7> (UTC day of the vault week)
race-data/W004/r017.<h12>.json            or r<NNN> (race / round / target number, 3+ digits)
race-data/W004/top.<h12>.json           optional: the top 100 rows of this file's board
race-data/W004/wk.<h12>.json            optional: small week-level keys (carry, next, extras, cards, inputs) (Architecture A1)
race-data/W004/p/<xx>.<h12>.json        optional: per-player shards (§5)
```
- `<h12>` = the first 12 hex characters of the part's own SHA-256 (of its exact bytes). **Parts are content-addressed: a part's name changes whenever its bytes change**, so a cached old copy (browser, Cloudflare mirror) can never be mistaken for the new one, and a part, once named, is never rewritten.
- Unchanged everywhere: `vault/W<n>.json` and every `HOLD-`/`RELEASE-` file (names and shapes; Golf and the vault read them). A week a payout already used is never converted (rule 0 below).
- Pages find everything through `manifest.json`; nothing hard-codes a part name.

## 2. A part (every part file has this shape)
```json
{
  "kgparts": 1,
  "game": "race",
  "file": "T004",
  "part": "d3",
  "t0": 1795564800000,
  "cols": [["player", "a"], ["race", "i"], ["pick", "a"], ["t", "i"]],
  "a": ["1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz", "1MbsVfNw6yzQqA8499d8KQj8qdLyRs8CzW"],
  "rows": [[0, 12, 1, 3600], [1, 12, 0, 3725]],
  "extra": {}
}
```
- `cols`: column name and type. Types: `"a"` = index into this part's `a` (address table), `"i"` = integer, `"s"` = short string, `"n"` = decimal string for big numbers (satoshi-style VHP), `"b"` = 0/1.
- `a`: every address used in this part, **once**, sorted ascending (so the same rows always give the same bytes). Players and producers share one table.
- `rows`: arrays in `cols` order, sorted by the game's natural key (e.g. race, then player). Times are integers relative to `t0` in the unit the game declares in `extra.tUnit` (`"s"` or `"ms"`; default `"s"`).
- `extra`: anything else the unit needs (a race's settings, its result, its standings), small. Big per-player data never goes in `extra`.
- Canonical JSON: `JSON.stringify(part) + "\n"` with keys in the order shown. The part's SHA-256 is over exactly those bytes.
- **Size:** any part over 1.2 MB (60%) is a warning in the run; over 2 MB the writer refuses (and splits by a smaller unit first if the game allows it).

## 3. The manifest (written last, in the same commit as its parts)
```json
{
  "kgparts": 1,
  "game": "race",
  "file": "T004",
  "week": 4,
  "state": "pending",
  "writtenAt": 1795737600000,
  "unit": "d",
  "expect": ["d1", "d2", "d3", "d4", "d5", "d6"],
  "shards": 0,
  "parts": [
    { "part": "d1", "name": "d1.3fa1c2b49e0d.json", "bytes": 81234, "sha256": "3fa1c2b49e0d…(64 hex)", "rows": 1830 },
    { "part": "ref", "name": "ref.9b07aa4c11e2.json", "bytes": 210331, "sha256": "9b07aa4c11e2…", "rows": 0 }
  ],
  "rows": 1830,
  "hash": "…(64 hex)"
}
```
- `parts` sorted by `part`. Every part listed exactly once. `rows` = that part's row count; top-level `rows` = the sum.
- **The part-set hash:** `hash = SHA-256( "kgparts1\n" + game + "\n" + file + "\n" + week + "\n" + for each listed part in order: part + " " + sha256 + " " + bytes + "\n" )`. It covers every part's bytes (through their SHA-256), the set of parts, their order and the week. **This replaces today's single-file snapshot hash everywhere it's used**: the two-node match, `seen` (final after two runs an hour apart), the vault bot's double read, and the publish job's check.
- `expect`: the units that must exist for this `state`. For `pending`, the units up to now (e.g. days so far); for `final`, all of them. A game declares its rule in its README (Race 6-hour W: `r001`…`r028`; T: `d1`…`d6`; R: `d1`…`d7`).
- `state`: `pending` or `final`. A final manifest and all its parts are **written once**: later runs copy them forward unchanged, and a run whose part-set hash differs from a published final **stops** (same as today's rule for finals).

## 4. How a publish job proves the set is complete (the check, in the inline file; no repository code runs)
For every `<base>/manifest.json` it publishes, the job:
1. Parses the manifest; `kgparts` is 1; `game`, `file`, `week` match the folder and the run.
2. For each listed part: the file `<base>/<name>` exists; its byte length equals `bytes`; its SHA-256 equals `sha256`; `name` equals `<part>.<first 12 hex of sha256>.json`; the part's own `game`/`file`/`part` fields match; its `rows` count matches.
3. **No missing unit:** every unit in `expect` is in `parts` (and for `final`, `expect` is the game's full list).
4. **No stale or extra file:** the folder holds exactly the listed part files plus `manifest.json` (`find <base> -type f`); anything else, or a symlink or a sub-folder other than `p/`, refuses the publish. (Old content-addressed parts of a pending week are removed by the writer in the same commit; a final's never change.)
5. Recomputes the part-set `hash` and compares it with the manifest's.
6. Decodes all parts back into the game's logical rows (the inline decoder) and runs the game's existing recompute (every point, place and winner) on them, exactly as today on the single file.
7. Size: every file ≤ 2 MB (today's `find -size +2048k` rule, unchanged); the warning at 60% is the recorder's job.
Any failure: the publish is refused and the run fails with an alert, as today. Nothing is half-published: parts and manifest go in one commit.

## 5. Board files and per-player shards
- **`top.<h12>.json`**: a part with this file's top 100 rows (same columns as the board's rows). Pages show the top 100 from it.
- **Per-player shards** (only when the game needs a player's own rows beyond the top 100): `shards` in the manifest is 16 or 256; a player's shard is the first 1 or 2 hex digits of `SHA-256(address as UTF-8)` (not the address's first letters: every address starts with `1`). Each shard is a part named `p/<xx>` holding only that shard's players' rows. Start with 16; 256 above ~50,000 players a file. Pages fetch only `top` and their own wallet's shard.
- The game's existing `board.json` stays as it is until that game moves its board to `top` + shards in its own PR.

## 6. The 60% warning (every recorder, every run)
For every file it writes (parts, manifest, `board.json`, vault file): over 1.2 MB is a warning that fails the run's alert step (the owner is emailed) but still publishes; it names the file, its size and the cap. #277 already does this for Race; `kit/parts` does it for every kit game.

## 7. What `kit/parts` contains
One file, `kit/parts/parts.inline.mjs`: `encodePart`, `decodePart`, `partName`, `shardOf`, `partSetHash`,
`buildManifest`, `planParts` (the writer with no file system: returns the files to write; Architecture A2), `writeParts` (content-addressed parts, unlisted pending parts removed, finals never changed, manifest
last), `checkParts` (§4 steps 1-5; returns the decoded parts for the game's own recompute, step 6) and `sizeWarnings`
(the 60% warning). Tests: `kit/tests/parts.test.mjs` (KP-1..11). How kit games call it: Architecture's decision.
