// R-BR-7 phase 2: the games publish job (.github/workflows/games.yml) carries vhp_ruler.py byte for byte between
// "# BEGIN vhp_ruler.py" and "# END vhp_ruler.py" (tools/games-ruler-embed.mjs), so the job runs no repository code.
// This fails while the copy differs: run `node tools/games-ruler-embed.mjs` after any change to vhp_ruler.py.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const APP = process.env.APP || ".";
test("games.yml embeds vhp_ruler.py byte for byte (tools/games-ruler-embed.mjs)", () => {
  const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8"), py = fs.readFileSync(path.resolve(APP, "vhp_ruler.py"), "utf8");
  const ind = "          ", B = ind + "# BEGIN vhp_ruler.py\n", E = ind + "# END vhp_ruler.py\n";
  // the hand-written jobs only: the kit-rendered jobs (Fantasy #266) carry their own copy, written and checked by kit:render
  const KIT = "  # ── BEGIN kit-rendered jobs", end = yml.indexOf(KIT) < 0 ? yml.length : yml.indexOf(KIT);
  const i = yml.indexOf(B), j = yml.indexOf(E);
  assert.ok(i > 0 && j > i && j < end && yml.slice(i + 1, end).indexOf(B) < 0, "exactly one pair of markers in the hand-written jobs");
  const copy = yml.slice(i + B.length, j).split("\n").map((l) => (l.startsWith(ind) ? l.slice(ind.length) : l)).join("\n");
  assert.equal(copy, py.replace(/\n$/, "") + "\n", "the embedded copy differs from vhp_ruler.py: run node tools/games-ruler-embed.mjs");
  // the here-doc it sits in, written to the path the Bracket check loads it from
  assert.match(yml.slice(0, i), /cat > "\$RUNNER_TEMP\/ruler-code\/vhp_ruler\.py" <<'RULERPY'\n$/);
  assert.match(yml.slice(j), /^ {10}# END vhp_ruler\.py\n {10}RULERPY\n/);
});
