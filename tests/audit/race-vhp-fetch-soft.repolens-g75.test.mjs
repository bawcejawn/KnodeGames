// Repo Lens #G-75: PR #312's soft vhp-data fetch, run for real.
// The record step's shell (and the publish step's fetch lines) are taken from race.yml and run with the vhp-data
// fetch pointed at a source that doesn't exist. Expected: the step exits 0 with the ::warning::, and the data folder is
// left without files (so the recorder's loadLedger fails and the ruler's cards wait). G75-1 (Info): a failure AFTER a
// successful fetch (checkout) is silent in the record step (no -e, no warning) and stops the publish step (set -e).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const APP = process.env.APP || path.resolve(import.meta.dirname, "../..");
const yml = fs.readFileSync(path.join(APP, ".github/workflows/race.yml"), "utf8");

function stepRun(name) {
  const i = yml.indexOf(`- name: ${name}`);
  assert.ok(i > 0, name);
  const rest = yml.slice(i);
  const r = rest.indexOf("run: |\n");
  const lines = rest.slice(r + 7).split("\n");
  const ind = lines[0].match(/^ */)[0];
  const out = [];
  for (const l of lines) { if (l.trim() && !l.startsWith(ind)) break; out.push(l.slice(ind.length)); }
  return out.join("\n");
}

function run(script) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "g75-"));
  const s = script.replaceAll('"https://github.com/${GITHUB_REPOSITORY}.git"', `"${path.join(tmp, "no-such-repo")}"`);
  const p = spawnSync("bash", ["-c", s], { env: { ...process.env, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: "x/y" }, encoding: "utf8" });
  return { ...p, tmp };
}

test("G-75: the record step's vhp-data fetch fails softly: exit 0, a warning, an empty data folder", () => {
  const r = run(stepRun("Take the VHP ruler's data"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::The VHP ruler's data \(vhp-data\) didn't download this run: races are recorded/);
  const files = fs.readdirSync(path.join(r.tmp, "vhp-data")).filter((f) => f !== ".git");
  assert.deepEqual(files, [], "no data files: the recorder's loadLedger fails, the ruler's cards wait");
});

test("G-75: the publish step's fetch lines fail softly under the step's own set -euo pipefail", () => {
  const all = yml.split("\n");
  const k = all.findIndex((l) => l.includes("# Capacity (14 Nov): a download hiccup holds only the ruler's files"));
  assert.ok(k > 0);
  const block = ["set -euo pipefail", 'git init -q "$RUNNER_TEMP/vhp-data"', ...all.slice(k + 1, k + 6).map((l) => l.trim())].join("\n");
  const r = run(block);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::The VHP ruler's data \(vhp-data\) didn't download this run: the ruler's files are held/);
});
