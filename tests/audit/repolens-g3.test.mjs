// Repo Lens #G-3 (blockx-prizes-unset-loud, af919665 on main 18192711). Place in tests/audit/. Fails today (optional Low).
// G3-1: the Block X publish job, like the Race's (race.yml PRIZES_OK, Repo Lens #F-11/#F-12), should hold any new
//       prize file (P<w>.json) or vault file when PRIZES_FROM_WEEK is not a plain week number, so the write-once files
//       have a second, independent check besides the recorder's own hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const yml = fs.readFileSync(path.join(ROOT, ".github/workflows/games.yml"), "utf8");

test("G3-1 (Low): the Block X publish job checks PRIZES_FROM_WEEK itself and holds new prize/vault files when it's bad", () => {
  const publish = yml.slice(yml.indexOf("\n  publish:"), yml.indexOf("\n  alert:"));
  assert.ok(publish.length > 100, "publish job found");
  assert.match(publish, /PRIZES_FROM_WEEK: \$\{\{ vars\.PRIZES_FROM_WEEK \}\}/, "the publish job is given the variable");
  assert.match(publish, /PRIZES_FROM_WEEK[\s\S]{0,400}fullmatch\(r"\[0-9\]\{1,4\}"/, "and checks it is a plain week number before accepting a new P/vault file");
});
