// The games.yml publish job's file-name allowlists (the Bracket's own `brbad` check and the whole-folder `bad` check),
// run with bash on the names the recorders really write. GNU find's default (emacs) regex treats "\?" as a literal "?"
// (findutils manual, "findutils-default regular expression syntax"), so an optional group written "\(...\)\?" never
// matched: Daily Questions' vault/W<w>.json, HOLD- and RELEASE- files and the Bracket's ruler cards would have been
// refused (the Bracket held; for Questions, the whole publish stopped). This test FAILS on main before the fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const lines = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");

/** The publish step's shell from `BRACKET_ALERT=""` to the "Refusing to publish unexpected files" line, as the job runs it. */
function shellHead() {
  const s = lines.findIndex((l) => l.trim() === 'BRACKET_ALERT=""'), e = lines.findIndex((l) => l.includes("Refusing to publish unexpected files"));
  assert.ok(s > 0 && e > s, "the publish step's first checks are in games.yml");
  const ind = lines[s].match(/^ */)[0].length;
  return "set -euo pipefail\n" + lines.slice(s, e + 1).map((l) => l.slice(ind)).join("\n") + '\necho "PASSED"\n';
}
function run(blockxAndQuestions, bracket) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-")), IN = path.join(d, "incoming"), BR = path.join(d, "incoming-bracket");
  for (const [dir, names] of [[IN, blockxAndQuestions], [BR, bracket]]) for (const f of names) { const p = path.join(dir, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "{}\n"); }
  const r = spawnSync("bash", ["-c", shellHead()], { encoding: "utf8", env: { ...process.env, IN, RUNNER_TEMP: d } });
  return { status: r.status, out: r.stdout + r.stderr };
}

test("allowlist: Daily Questions' results, HOLD and RELEASE files are published, not refused", () => {
  const r = run(["blockx/index.json", "questions/board.json", "questions/W004.json", "questions/vault/W4.json", "questions/vault/HOLD-W4.json", "questions/vault/RELEASE-W4.json", "questions/vault/W12.json"], []);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /PASSED/);
  assert.doesNotMatch(r.out, /Refusing to publish/);
});

test("allowlist: the Bracket's ruler day cards and shadow summary pass its own check", () => {
  const r = run(["blockx/index.json"], ["bracket/index.json", "bracket/W005.json", "bracket/vault/W5.json", "bracket/ruler/W005.json", "bracket/ruler/W005-R0.json", "bracket/ruler/W005-R4.json"]);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /Producer Bracket files held/, r.out);
  assert.doesNotMatch(r.out, /Refusing to publish/);
});

test("allowlist: names that are not a recorder's are still refused", () => {
  for (const bad of ["questions/vault/HOLDW4.json", "questions/vault/HOLD-RELEASE-W4.json", "questions/vault/X-W4.json", "questions/vault/W4.json.bak", "questions/notes.json"]) {
    const r = run(["blockx/index.json", bad], []);
    assert.notEqual(r.status, 0, `${bad} was let through`);
    assert.match(r.out, /Refusing to publish unexpected files/, bad);
  }
  for (const bad of ["bracket/ruler/W005-R5.json", "bracket/ruler/W005-R.json", "bracket/ruler/W5.json"]) {
    const r = run(["blockx/index.json"], ["bracket/index.json", bad]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Producer Bracket files held/, `${bad} was let through`);
  }
});
