// Repo Lens #G-48 G48-2: the publish job's shared ruler step ("The VHP ruler's code and data") fails the whole step when
// the vhp-data fetch fails, so the next step ("Push games-data") is skipped: Block X and Daily Questions are not published
// that hour because of a Bracket-only input. The record job treats the same failure as a warning.
// Run from the repository root: APP=. TZ=UTC node --import tsx --test <this file>. Offline: the fetch is pointed at a
// path that doesn't exist (git url.insteadOf), which is what a GitHub fetch failure looks like to the step.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const APP = process.env.APP || ".";
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");

function stepOf(name) {
  const i = yml.indexOf("- name: " + name); assert.ok(i >= 0, "step " + name);
  const j = yml.indexOf("\n      - ", i + 10), body = yml.slice(i, j < 0 ? undefined : j);
  const k = body.indexOf("run: |\n"); assert.ok(k >= 0);
  return { head: body.slice(0, k), run: body.slice(k + 7).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n") };
}

test("G48-2: a failed vhp-data fetch in the shared ruler step must not stop the publish job (Block X, Questions)", () => {
  const st = stepOf("The VHP ruler's code and data");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "g48-2-"));
  const env = { ...process.env, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: "owner/repo", GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "url." + path.join(tmp, "no-such-remote") + "/.insteadOf", GIT_CONFIG_VALUE_0: "https://github.com/" };
  const r = spawnSync("bash", ["-e", "-c", st.run], { env, encoding: "utf8" });
  assert.ok(fs.existsSync(path.join(tmp, "ruler-code", "vhp_ruler.py")), "the embedded ruler was written first");
  const tolerated = r.status === 0 || /continue-on-error:\s*true/.test(st.head);
  assert.ok(tolerated, "the step exits " + r.status + " with no continue-on-error: GitHub skips 'Push games-data' for every game (" + (r.stderr || "").trim().slice(0, 160) + ")");
});
