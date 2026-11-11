// Repo Lens fix-check 2 (PR #186 @ 8d3d942f), area RA / F9: what a forged or failed record_bracket artifact can do to
// Block X's publish. Both artifacts are downloaded into the SAME folder ($RUNNER_TEMP/incoming), so the Bracket's artifact
// can carry files outside bracket/. Runs the publish step's own first shell lines (cut from games.yml: the Bracket
// quarantine and the whole-folder name check) with bash on a copy of an incoming folder. FAILS on 8d3d942f.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const YML = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8");
const lines = YML.split("\n");

function shellHead() {
  const s = lines.findIndex((l) => l.trim() === 'BRACKET_ALERT=""'), e = lines.findIndex((l) => l.includes("Refusing to publish unexpected files"));
  assert.ok(s > 0 && e > s, "the publish step's first checks are in games.yml");
  const ind = lines[s].match(/^ */)[0].length;
  return "set -euo pipefail\n" + lines.slice(s, e + 1).map((l) => l.slice(ind)).join("\n") + '\necho "PASSED"\n';
}
// fix-check 2 fix: the Bracket's artifact now lands in its own folder ($RUNNER_TEMP/incoming-bracket, F9-a), so its
// files are written there (`br`), Block X's artifact in $IN (`files`)
function run(files, br = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "e3fc2-split-")), IN = path.join(d, "incoming"), BR = path.join(d, "incoming-bracket");
  for (const [dir, fs_] of [[IN, files], [BR, br]]) for (const [f, o] of Object.entries(fs_)) { const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o) + "\n"); }
  const r = spawnSync("bash", ["-c", shellHead()], { encoding: "utf8", env: { ...process.env, IN, RUNNER_TEMP: d } });
  return { status: r.status, out: r.stdout + r.stderr, IN };
}
const downloads = () => {
  // each download-artifact step: its artifact name and its path
  const out = []; let cur = null;
  for (const l of lines) {
    if (l.includes("actions/download-artifact@")) { cur = {}; out.push(cur); continue; }
    if (!cur) continue;
    const m = l.match(/^\s+(name|path):\s*(.+)$/); if (m) cur[m[1]] = m[2].trim();
    if (/^\s+- /.test(l)) cur = null;
  }
  return out;
};

test("F9-a: the Bracket artifact is downloaded apart from Block X's, and only its bracket/ folder is taken", () => {
  const d = downloads(), bx = d.find((x) => x.name === "games-data"), br = d.find((x) => x.name === "games-data-bracket");
  assert.ok(bx && br, JSON.stringify(d));
  assert.notEqual(br.path, bx.path, "games-data-bracket must not be extracted over games-data (same folder: it can add or replace blockx/ files)");
});

test("F9-b: a stray file in the Bracket's artifact holds the Bracket, never Block X's publish", () => {
  const blockx = { "blockx/index.json": { v: 1 } };
  const ctl = run(blockx, { "bracket/index.json": { v: 1 } });
  assert.equal(ctl.status, 0, "control: " + ctl.out);
  assert.ok(fs.existsSync(path.join(ctl.IN, "bracket/index.json")), "control: the Bracket's own files are taken");
  // what a forged record_bracket artifact (its job's own games-data/ folder) can carry next to bracket/
  for (const stray of ["notes.json", "blockx/P001.json.bak", "race/W001.json", "blockx/index.json"]) {
    const r = run(blockx, { "bracket/index.json": { v: 1 }, [stray]: { x: 1 } });
    assert.equal(r.status, 0, `${stray} from the Bracket's artifact stopped Block X's publish (exit ${r.status}): ${r.out.trim().slice(0, 200)}`);
    assert.match(r.out, /Producer Bracket artifact held/, "the Bracket is held, with an alert");
    assert.ok(!fs.existsSync(path.join(r.IN, "bracket")), "nothing of that Bracket artifact is taken");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r.IN, "blockx/index.json"), "utf8")), { v: 1 }, "Block X's files untouched");
  }
});

test("F9-c: Bracket files in Block X's artifact are never published (they come only from the Bracket's own job)", () => {
  const r = run({ "blockx/index.json": { v: 1 }, "bracket/index.json": { forged: 1 } });
  assert.equal(r.status, 0, r.out);
  assert.ok(!fs.existsSync(path.join(r.IN, "bracket")), "dropped when record_bracket sent nothing");
});
