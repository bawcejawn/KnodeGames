// Repo Lens #G-70 (delta of PR #285 at 220b77dc, after merging main c33047bd / Block X #292): the ONE shared publish step
// "The VHP ruler's code and data (Block X and the Producer Bracket)". Adapted from tests-g68/g68-2-ruler-step.test.mjs:
// the data folder is now $RUNNER_TEMP/vhp-data (was ruler-vhp-data) and Block X's env is checked too.
// Run from the repository root: APP=. TZ=UTC node --import tsx --test <this file>. Offline (git url.insteadOf).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
const APP = process.env.APP || ".";
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
const publish = yml.slice(yml.indexOf("\n  publish:"), yml.indexOf("\n  alert:"));
const NAME = "The VHP ruler's code and data (Block X and the Producer Bracket)";
// The shared data folder, as the Bracket's env names it ($RUNNER_TEMP/vhp-data at 220b77dc, $RUNNER_TEMP/ruler-vhp-data at d3731122)
const DATA = (publish.match(/\n\s+BRACKET_RULER_VHP_DATA: \$\{\{ runner\.temp \}\}\/([a-z-]+)\n/) || [])[1];
const rx = (t) => t.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
function stepOf(src, name) {
  const i = src.indexOf("- name: " + name); assert.ok(i >= 0, "step " + name);
  const j = src.indexOf("\n      - ", i + 10), body = src.slice(i, j < 0 ? undefined : j);
  const k = body.indexOf("run: |\n");
  return { head: k < 0 ? body : body.slice(0, k), env: body, run: k < 0 ? "" : body.slice(k + 7).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n") };
}
const dirs = []; test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const runStep = (st, remoteRoot) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "g70-1-")); dirs.push(tmp);
  const to = remoteRoot || path.join(tmp, "no-such-remote");
  const env = { ...process.env, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: "owner/repo", GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "url." + to + "/.insteadOf", GIT_CONFIG_VALUE_0: "https://github.com/" };
  return { tmp, r: spawnSync("bash", ["-e", "-c", st.run], { env, encoding: "utf8" }) };
};

test("G70: exactly one shared ruler step, one embed block, one fetch in the publish job", () => {
  assert.equal(publish.split("- name: The VHP ruler's").length - 1, 1, "one ruler step in the publish job");
  // Adjusted by the Bracket chat (14 Nov, after Fantasy #266 merged): the kit-rendered jobs carry their own copy (written by
  // npm run kit:render), so the hand-written jobs are counted on their own, above the kit marker.
  const hand = yml.slice(0, yml.indexOf("  # ── BEGIN kit-rendered jobs") < 0 ? yml.length : yml.indexOf("  # ── BEGIN kit-rendered jobs"));
  assert.equal(hand.split("# BEGIN vhp_ruler.py\n").length - 1, 1, "one embed block in games.yml's hand-written jobs");
  assert.equal((publish.match(/fetch -q --depth 1 [^\n]* vhp-data/g) || []).length, 1, "one vhp-data fetch in the publish job");
});

test("G70 / G48-2 / G35-5: no if:, a failed fetch exits 0 with a warning, code written, no half-fetched folder", () => {
  const st = stepOf(publish, NAME);
  assert.doesNotMatch(st.head, /^\s+(if|continue-on-error):/m, "no if: (G35-2) and the step itself is tolerant");
  const { tmp, r } = runStep(st);
  assert.equal(r.status, 0, (r.stderr || "").slice(0, 200));
  assert.match(r.stdout, /::warning::Couldn't fetch the vhp-data branch/);
  assert.equal(fs.readFileSync(path.join(tmp, "ruler-code", "vhp_ruler.py"), "utf8").replace(/^# BEGIN vhp_ruler\.py\n/, "").replace(/# END vhp_ruler\.py\n$/, ""), fs.readFileSync(path.resolve(APP, "vhp_ruler.py"), "utf8"), "the code is written, byte for byte (inside its two marker comments)");
  assert.ok(DATA, "the shared data folder"); assert.ok(!fs.existsSync(path.join(tmp, DATA)), "no half-fetched data folder");
});

test("G70: a good fetch leaves the data at $RUNNER_TEMP/vhp-data (the path both games read)", () => {
  const st = stepOf(publish, NAME);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "g70-1-remote-")); dirs.push(root);
  const src = path.join(root, "src"), bare = path.join(root, "owner", "repo.git");
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  fs.mkdirSync(path.join(src, "h"), { recursive: true }); fs.writeFileSync(path.join(src, "h", "x.json"), "{}\n");
  g(root, "init", "-q", "-b", "vhp-data", src); g(src, "add", "."); g(src, "commit", "-qm", "d");
  fs.mkdirSync(path.dirname(bare), { recursive: true }); g(root, "clone", "-q", "--bare", src, bare);
  const { tmp, r } = runStep(st, root);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /vhp-data ready/);
  assert.ok(fs.existsSync(path.join(tmp, DATA, "h", "x.json")), "the data is where both games read it");
});

test("G70: the publish step's ruler env for both games points at the shared paths", () => {
  const st = stepOf(publish, "Push games-data");
  assert.match(st.env, /\n\s+BRACKET_RULER_PY: \$\{\{ runner\.temp \}\}\/ruler-code\/vhp_ruler\.py\n/);
  assert.ok(DATA === "vhp-data" || DATA === "ruler-vhp-data", "BRACKET_RULER_VHP_DATA unconditional, at the shared folder: " + DATA);
  assert.match(stepOf(publish, NAME).run, new RegExp('git init -q "\\$RUNNER_TEMP/' + rx(DATA) + '"'), "the fetch writes that same folder");
  assert.match(st.env, /\n\s+RULER_PY: \$\{\{ format\('\{0\}\/ruler-code\/vhp_ruler\.py', runner\.temp\) \}\}\n/, "Block X's code path, unconditional (G35-2)");
  // Block X's data path: the shared folder while its switch is set, empty while unset (the owner's choice; G70 test 2 shows it is harmless)
  assert.ok(st.env.includes("\n          RULER_VHP_DATA: ${{ vars.BLOCKX_RULER_FROM_WEEK != '' && format('{0}/" + DATA + "', runner.temp) || '' }}\n"), "Block X's data path: the same folder while set, empty while unset");
});

test("G70: the Questions check reads none of the ruler's inputs (a failed fetch never touches it)", () => {
  const st = stepOf(publish, "Push games-data");
  const blocks = [...st.run.matchAll(/\/usr\/bin\/python3 - ("\$IN\/[a-z]+")[^\n]*<<'PY'\n([\s\S]*?)\nPY\n/g)].map((m) => [m[1], m[2]]);
  const q = blocks.filter(([n]) => !/bracket|blockx/.test(n));
  assert.ok(q.length >= 1, "found the Questions check: " + blocks.map(([n]) => n));
  for (const [n, py] of q) assert.doesNotMatch(py, /RULER_(PY|VHP_DATA)|vhp-data|vhp_ruler/, n);
});
