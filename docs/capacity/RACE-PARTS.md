# Race files in KG parts v1: design (Race chat, 14 Nov 2026)

**Goal:** Capacity's gate is 9,000 weekly players with no file over 2 MB. Today W, T, R-1 and `board.json` each pass 2 MB well before that.

**Merge:** the Sun 29 Nov night slot (Mon 30 Nov 01:40–06:30 UTC), only if Week 1's paid close was clean. Repo Lens on Opus.

**Code:** `bot/race-parts.ts`. **Tests:** `tests/audit/race-parts.test.mjs`.

## 1. What changes and what doesn't
- **Changes:** how each logical Race file is laid out on `race-data`, from vault week `PARTS_FROM_WEEK = 6` (the week the slot opens). Content, scoring, points, payouts and every check stay as they are.
- **Never changes:**
  - `vault/W<n>.json`, `PENDING-`, `HOLD-`, `RELEASE-`;
  - `index.json`, `deployment.json` and the samples file;
  - any week before 6. A week a payout used is never converted.

## 2. Layout (kit/parts, `kit/parts/parts.inline.mjs`, unchanged)

| Logical file | Folder | Parts |
|---|---|---|
| `W<www>.json` | `W<www>/` | `wk` (the file's header); `r001`…`r028`: one 6-hour race each. The race's own text minus its picks goes in `extra`; the picks are rows `[i, who, horse, at, w, x, s]`, where `i` keeps the original order (D-152) and `s = -1` marks an old 5-field pick. |
| `T<www>.json` | `T<www>/` | `wk`; `d1`…`d7`: that UTC day's ledger hours, plus the typed races that start that day (picks as rows with a race column). |
| `R<www>.json`, `R<www>-<t>.json` | same name | `wk`; `d1`…`d7`: that day's entries, each entry's text unchanged (so the cards are byte for byte). |
| `board.json` | `board/` | `wk` (the skeleton); `top`: the first 100 rows of each section; `p/<x>`: 16 per-player shards holding every row of their players. |

- Each object is kept as its own JSON text, with key order and floats as they are. The reassembled file is the **same text** as the old single file. That is tested on the recorder's own output and on the real `race-data` files W001–W003, R003 and board.
- **The manifest's part-set hash replaces the single-file hash** wherever the Race uses one: the two-node match, `seen`, the vault bot's double read and the publish job.

**Measured at 9,000 weekly players (tests):**
- W race part, every player picking that one race: 576 KB (27%).
- Largest board shard: 341 KB (16%).
- `top`: 54 KB.

## 3. Readers: two steps, so no other game breaks
**Step A, this PR.**
- The recorder writes the parts folders as the source of truth.
- It also keeps writing the old single files as **compat copies** while each is under 1.2 MB (60%).
- The publish job checks the parts (`checkParts`, inline), runs today's full recompute on the reassembled files, and checks that every compat copy is byte-identical to the reassembled text.
- If a compat copy would pass 1.2 MB, it is left out, and the owner is emailed with the games that read it.

**The Race's own readers move to parts:** `race.js`, `results.js` (the Race parts), `ruler-void.js`, `race-samples.yml` and the recorder's `readPrev`.

**Other readers keep the compat copies until they switch to `readRaceFile(dir, base)` (Node) or `KRaceData.load(base)` (pages), by Mon 7 Dec:**

| Reader | Reads | Owner chat |
|---|---|---|
| `games.yml` / `bot/games/blockx.ts` | W cards | Block X |
| `bot/games/golf.ts` | `board.json` | Golf |
| `bot/names.ts` | W, `board.json` | Names / Hub |
| `bot/stats.ts` | `board.json` | Stats / Hub |
| `leaders.js`, `games.js` | `board.json` | Hub |
| `bot/vault.ts` (`boardSpec`) | `board.json` | Vault |

**Step B, a later small PR:** stop writing the compat copies.

## 4. The checks that stay
- Two nodes.
- Final only after two runs an hour apart.
- Write-once finals: a final manifest and its parts never change.
- The full recompute at publish.
- The 60% / 85% alerts, now per part.
- The vault bot's double read.
- The owner's hold and release.
- Fix 1's guards and the G-87 card guard. They run on the reassembled races.

## 5. Build order
1. ✅ `bot/race-parts.ts` plus round-trip tests.
2. Recorder: write the parts folders and compat copies; `readPrev` reads the parts first; hashes come from the manifest.
3. Publish job: embed `checkParts`; reassemble; existing checks on the reassembled files; compat equality; write-once finals on manifests.
4. Pages: `race-data.js` (`KRaceData.load`), used by `race.js`, `results.js` and `ruler-void.js`.
5. Capacity's sizer report, the TO notes to the reader chats, and the Repo Lens prompt.
