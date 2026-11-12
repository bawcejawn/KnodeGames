// tests/audit/ci-guard-bypass.C5-99.test.mjs   (node --test)   Repo Lens #C-5, PR #99 findings Y99-1..Y99-7
// Same harness as ci-guard-bypass.yaml-parser.test.mjs, with two changes (Y99-7): the clean tree must PASS (a control), and
// each vector must fail a GUARD test by name, not just exit non-zero (a crash or a missing `yaml` package no longer counts).
// Written, not run here. Every vector parses without errors in GitHub's published @actions/workflow-parser.
import { test } from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { spawnSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const steps = (run = "echo") => `    runs-on: ubuntu-latest\n    steps:\n      - run: ${run}\n`;
const head = (on = "  push: {}") => `name: x\non:\n${on}\npermissions:\n  contents: read\njobs:\n  a:\n`;
const VECTORS = {
  "Y1-secret-space.yml": head() + steps(`echo "\${{ secrets . OPERATOR_WIF }}"`),
  "Y1-secret-format-case.yml": head() + steps(`echo "\${{ format('{0}', SECRETS.OPERATOR_WIF) }}"`),
  "Y2-tojson-paren.yml": head() + steps(`echo '\${{ toJSON((secrets)) }}'`),
  "Y3-no-permissions.yml": `name: x\non:\n  push: {}\njobs:\n  a:\n${steps()}`,
  "Y3-every-scope-write.yml": `name: x\non:\n  push: {}\npermissions:\n  contents: write\n  actions: write\n  packages: write\n  pull-requests: write\njobs:\n  a:\n${steps()}`,
  "Y4-unpinned-quoted-key.yml": head() + `    runs-on: ubuntu-latest\n    steps:\n      - "uses": some-owner/some-action@v1\n`,
  "Y5-event-injection.yml": `name: x\non:\n  pull_request: {}\npermissions:\n  contents: read\njobs:\n  a:\n${steps(`echo "\${{ format('{0}', github.event.pull_request.title) }}"`)}`,
};
function runGuard(extra) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "c5-99-"));
  fs.cpSync(path.join(ROOT, ".github"), path.join(d, ".github"), { recursive: true });
  for (const f of ["package.json", "package-lock.json"]) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
  for (const sub of ["game", "desk"]) for (const f of ["package.json", "package-lock.json"]) if (fs.existsSync(path.join(ROOT, sub, f))) { fs.mkdirSync(path.join(d, sub), { recursive: true }); fs.copyFileSync(path.join(ROOT, sub, f), path.join(d, sub, f)); }
  if (extra) extra(d);
  const env = { ...process.env, APP: d }; delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--test", path.join(ROOT, "tests/audit/site.ci-deps.test.mjs")], { env, encoding: "utf8" });
}
test("C5-99 control: the clean tree passes the guard (so a refusal below means a rule fired, not a crash)", () => {
  const p = runGuard();
  assert.equal(p.status, 0, p.stdout.slice(-2000));
  assert.match(p.stdout, /# fail 0/);
});
for (const [name, y] of Object.entries(VECTORS)) test(`C5-99: the guard refuses ${name} by a guard rule`, () => {
  const p = runGuard((d) => fs.writeFileSync(path.join(d, ".github/workflows", name), y));
  assert.notEqual(p.status, 0, `the guard passed a workflow it must refuse (${name})`);
  assert.match(p.stdout, /not ok \d+ - \(guard/, `${name}: the run failed, but not on a guard rule:\n${p.stdout.slice(-1500)}`);
});
test("C5-99 (Y99-6): bot.yml with push/pull_request added in flow style is refused", () => {
  const p = runGuard((d) => {
    const f = path.join(d, ".github/workflows/bot.yml");
    const y = fs.readFileSync(f, "utf8");
    // Put push and pull_request into a flow-style `on:` next to bot.yml's own schedule + workflow_dispatch.
    const flow = 'on: {schedule: [{cron: "7 * * * *"}], workflow_dispatch: {}, push: {}, pull_request: {}}\n';
    fs.writeFileSync(f, y.replace(/^on:\n(?:[ #].*\n|\n)*/m, flow));
  });
  assert.notEqual(p.status, 0, "bot.yml now also runs on push and pull_request, and the guard passed it");
  assert.match(p.stdout, /not ok \d+ - \(guard/);
});

// ── Hub additions: more spellings from the C5-11 / C5-12 / C5-16 / C5-19 write-ups ──
const MORE = {
  "H-secret-brackets.yml": head() + steps(`echo "\${{ (SECRETS).OPERATOR_WIF }}"`),
  "H-secret-in-key.yml": head() + `    runs-on: ubuntu-latest\n    env:\n      \${{ SECRETS.OPERATOR_WIF }}: x\n    steps:\n      - run: echo\n`,
  "H-env-bot.yml": head() + `    runs-on: ubuntu-latest\n    environment: bot\n    steps:\n      - run: echo\n`,
  "H-github-index.yml": `name: x\non:\n  pull_request: {}\npermissions:\n  contents: read\njobs:\n  a:\n${steps(`echo "\${{ github['event'].pull_request.title }}"`)}`,
  "H-watch-trigger.yml": head("  watch: {}"),
  "H-top-write.yml": `name: x\non:\n  push: {}\npermissions:\n  contents: write\njobs:\n  a:\n${steps()}`,
};
for (const [name, y] of Object.entries(MORE)) test(`C5-99 (Hub): the guard refuses ${name} by a guard rule`, () => {
  const p = runGuard((d) => fs.writeFileSync(path.join(d, ".github/workflows", name), y.endsWith("jobs:\n  a:\n") ? y + steps() : y));
  assert.notEqual(p.status, 0, `the guard passed ${name}`);
  assert.match(p.stdout, /not ok \d+ - \(guard/, `${name}:\n${p.stdout.slice(-1500)}`);
});
