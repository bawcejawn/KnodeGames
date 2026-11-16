// GitHub refuses to run a workflow file over 500 KB (docs.github.com/actions/reference/limits#workflow-file-size):
// every run then ends in "startup_failure", and scheduled runs stop with no alert. On Mon 16 Nov 2026 #336 took
// games.yml from 467 KB to 535 KB and every game recorder in it stopped for about 11 hours. This test fails a PR first.
// The kit's jobs live in their own file (kit-games.yml) since then.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve(".github/workflows");
const GITHUB_LIMIT = 500 * 1024;              // GitHub's hard limit
const OUR_LIMIT = 450 * 1024;                  // fail with room to spare (460,800 bytes, 90%)

test("every workflow file is under 450 KB (90% of GitHub's 500 KB limit)", () => {
  const files = fs.readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.includes("games.yml") && files.includes("kit-games.yml"));
  for (const f of files) {
    const n = fs.statSync(path.join(DIR, f)).size;
    assert.ok(n <= OUR_LIMIT, `${f} is ${n} bytes, over ${OUR_LIMIT} (90% of GitHub's ${GITHUB_LIMIT}-byte limit): GitHub would refuse to run it. Split the file before adding to it.`);
  }
});
