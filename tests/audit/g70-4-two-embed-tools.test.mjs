// Repo Lens #G-70 (Info), G70-1: two tools wrote the ONE vhp_ruler.py block in games.yml (tools/blockx-ruler-embed.mjs and
// tools/games-ruler-embed.mjs), and with a second marker pair only games-ruler-embed refused. The fix (owner and Block X OK,
// Sat 14 Nov): tools/blockx-ruler-embed.mjs is deleted, so games-ruler-embed.mjs is the one tool for the hand-written jobs.
// Adjusted by the Bracket chat from Repo Lens's file (its test 1 compared the two tools; test 2 now checks only the remaining
// tool), and the second pair goes into the hand-written jobs, above the kit marker (the kit's own copy sits below it since
// Fantasy #266). Run from the repository root: APP=. TZ=UTC node --test <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const APP = path.resolve(process.env.APP || ".");
const KIT = "  # ── BEGIN kit-rendered jobs";
const dirs = []; test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
function scratch(mutYml = (y) => y) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "g70-4-")); dirs.push(r);
  fs.mkdirSync(path.join(r, ".github/workflows"), { recursive: true }); fs.mkdirSync(path.join(r, "tools"));
  fs.copyFileSync(path.join(APP, "tools", "games-ruler-embed.mjs"), path.join(r, "tools", "games-ruler-embed.mjs"));
  fs.writeFileSync(path.join(r, "vhp_ruler.py"), fs.readFileSync(path.join(APP, "vhp_ruler.py"), "utf8") + "# a later change\n");
  fs.writeFileSync(path.join(r, ".github/workflows/games.yml"), mutYml(fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8")));
  return r;
}
const run = (r) => spawnSync("node", [path.join(r, "tools", "games-ruler-embed.mjs")], { encoding: "utf8" });
const wf = (r) => fs.readFileSync(path.join(r, ".github/workflows/games.yml"), "utf8");

test("G70-1: one embed tool for the hand-written jobs; tools/blockx-ruler-embed.mjs is gone and named nowhere", () => {
  assert.ok(!fs.existsSync(path.join(APP, "tools", "blockx-ruler-embed.mjs")), "tools/blockx-ruler-embed.mjs is deleted");
  // git grep exits 1 when nothing matches (the result we want), 0 with matches, anything else on an error
  const g = spawnSync("git", ["grep", "-l", "blockx-ruler-embed", "--", ".", ":!tests/audit/g70-4-two-embed-tools.test.mjs"], { cwd: APP, encoding: "utf8" });
  assert.equal(g.status, 1, "no file names the deleted tool: " + (g.stdout || g.stderr));
});

test("G70: after a change to vhp_ruler.py, games-ruler-embed writes it into the hand-written block and leaves the kit's copy alone", () => {
  const before = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8"), r = scratch();
  assert.equal(run(r).status, 0);
  const after = wf(r), k = after.indexOf(KIT) < 0 ? after.length : after.indexOf(KIT);
  assert.match(after.slice(0, k), /\n {10}# a later change\n {10}# END vhp_ruler\.py\n/);
  assert.equal(after.slice(k), before.slice(before.indexOf(KIT) < 0 ? before.length : before.indexOf(KIT)), "the kit-rendered jobs are unchanged");
});

test("G70 (Info): with a second marker pair in the hand-written jobs, the one tool refuses and writes nothing", () => {
  const two = (y) => { const k = y.indexOf(KIT) < 0 ? y.length : y.indexOf(KIT); return y.slice(0, k) + "# test-only second pair\n          # BEGIN vhp_ruler.py\n          # END vhp_ruler.py\n" + y.slice(k); };
  const r = scratch(two), before = wf(r);
  assert.notEqual(run(r).status, 0, "games-ruler-embed refuses two pairs");
  assert.equal(wf(r), before, "and leaves games.yml as it was");
});
