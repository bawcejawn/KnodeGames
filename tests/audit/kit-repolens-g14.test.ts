// Repo Lens #G-14 (kit-phase1-fantasy @ 94f6c53, fix-check of #G-13): G14-1. Fails today.
// Place in tests/audit/ (or add it to tests/audit/kit-suite.test.ts if it goes in kit/tests/).
// G14-1: the G13-1 fix tells the owner to recover by setting <SLUG>_RESET_FROM_WEEK, and kit/recorder/cli.ts reads it,
// but the rendered workflow passes only <SLUG>_HOLD_WEEKS and <SLUG>_RELEASE to the recorder step, so in a real
// workflow the reset never arrives and the game waits for good. Fix: add the variable to the recorder step's env in
// kit/publish/render.mjs, next to HOLD_WEEKS and RELEASE.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("G14-1 (Low): the rendered recorder step passes <SLUG>_RESET_FROM_WEEK, which cli.ts reads", () => {
  assert.match(read("kit/recorder/cli.ts"), /_RESET_FROM_WEEK/, "the recorder reads it");
  const r = read("kit/publish/render.mjs");
  for (const v of ["HOLD_WEEKS", "RELEASE", "RESET_FROM_WEEK"])
    assert.match(r, new RegExp(`\\$\\{up\\(g\\.slug\\)\\}_${v}: \\\\\\$\\{\\{ vars\\.\\$\\{up\\(g\\.slug\\)\\}_${v} \\}\\}`), `the recorder step's env has ${v}`);
});
