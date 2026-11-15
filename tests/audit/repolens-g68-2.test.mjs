// Repo Lens #G-68 (fix-check of #G-48 G48-2 at c749d6a6): the shared step "The VHP ruler's code and data" always runs, a failed
// vhp-data fetch is only a warning, and the publish step's ruler paths are unconditional. Run from the repository root:
// APP=. TZ=UTC node --import tsx --test <this file>. Offline: fetches are pointed at paths that don't exist (git url.insteadOf).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const APP = process.env.APP || ".";
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
const publish = yml.slice(yml.indexOf("\n  publish:"));
function stepOf(src, name) {
  const i = src.indexOf("- name: " + name); assert.ok(i >= 0, "step " + name);
  const j = src.indexOf("\n      - ", i + 10), body = src.slice(i, j < 0 ? undefined : j);
  const k = body.indexOf("run: |\n");
  return { head: k < 0 ? body : body.slice(0, k), env: body, run: k < 0 ? "" : body.slice(k + 7).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n") };
}
const runStep = (st, extra = {}) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "g68-2-"));
  const env = { ...process.env, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: "owner/repo", GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "url." + path.join(tmp, "no-such-remote") + "/.insteadOf", GIT_CONFIG_VALUE_0: "https://github.com/", ...extra };
  return { tmp, r: spawnSync("bash", ["-e", "-c", st.run], { env, encoding: "utf8" }) };
};

test("G68 / G48-2: the shared ruler step has no if:, a failed fetch exits 0 with a warning and leaves no half-fetched data", () => {
  const st = stepOf(publish, "The VHP ruler's code and data");
  assert.doesNotMatch(st.head, /^\s+if:/m, "no if: on the step");
  const { tmp, r } = runStep(st);
  assert.equal(r.status, 0, (r.stderr || "").slice(0, 200));
  assert.match(r.stdout, /::warning::Couldn't fetch the vhp-data branch/);
  assert.ok(fs.existsSync(path.join(tmp, "ruler-code", "vhp_ruler.py")), "the ruler code is still written");
  assert.ok(!fs.existsSync(path.join(tmp, "ruler-vhp-data")), "no half-fetched data folder (the check then says 'no data' and holds)");
});

test("G68 / G48-2: the publish step's ruler paths are unconditional (the variant: both Bracket variables unset)", () => {
  const st = stepOf(publish, "Push games-data");
  assert.match(st.env, /\n\s+BRACKET_RULER_PY: \$\{\{ runner\.temp \}\}\/ruler-code\/vhp_ruler\.py\n/);
  assert.match(st.env, /\n\s+BRACKET_RULER_VHP_DATA: \$\{\{ runner\.temp \}\}\/ruler-vhp-data\n/);
});

test("G68 / G48-2: the Block X and Questions checks in the same step never read the ruler's paths (a missing fetch holds only the Bracket)", () => {
  const st = stepOf(publish, "Push games-data");
  const blocks = [...st.run.matchAll(/\/usr\/bin\/python3 - ("\$IN\/[a-z]+")[^\n]*<<'PY'\n([\s\S]*?)\nPY\n/g)].map((m) => [m[1], m[2]]);
  const other = blocks.filter(([n]) => !n.includes("bracket"));
  assert.ok(other.length >= 2, "found the Block X and Questions checks: " + other.map(([n]) => n));
  for (const [n, py] of other) assert.doesNotMatch(py, /BRACKET_RULER_(PY|VHP_DATA)|ruler-vhp-data/, n + " reads the Bracket's ruler inputs");
});
