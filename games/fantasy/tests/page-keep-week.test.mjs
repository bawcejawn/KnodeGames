// Repo Lens #J-4 J4-2 (Low): when a week fails to load (a cached manifest briefly names parts the publish job has just
// replaced), the page keeps the week it already had instead of showing it as not published.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const js = fs.readFileSync(path.join(ROOT, "fantasy.js"), "utf8");
test("J4-2: a failed week load keeps the week already shown; a file for another week is still dropped", () => {
  assert.match(js, /if \(wf && wf\.week === w && wf\.start === weekStart\(w\)\) files\.weeks\.set\(w, wf\); else if \(wf\) files\.weeks\.delete\(w\);/);
  assert.doesNotMatch(js, /files\.weeks\.set\(w, wf\); else files\.weeks\.delete\(w\);/);
});
