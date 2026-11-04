// I-022 (PN-8 / C2-4): YAML spellings the old regex guard missed. Each is added to a scratch copy of .github and the
// guard (site.ci-deps.test.mjs) must fail. Same harness as ci-guard-bypass.N-C-2 / C1-4.
import { test } from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { spawnSync } from "node:child_process"; import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const steps = "    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n";
const VECTORS = {
  "indent-digit.yml": `name: x\non:\n  push: {}\npermissions: >2-\n    write-all\njobs:\n  a:\n${steps}`,
  "tag-write-all.yml": `name: x\non:\n  push: {}\npermissions: !!str write-all\njobs:\n  a:\n${steps}`,
  "anchor-write-all.yml": `name: x\non:\n  push: {}\nenv:\n  X: &w write-all\npermissions: *w\njobs:\n  a:\n${steps}`,
  "tag-inherit.yml": "name: x\non:\n  push: {}\npermissions:\n  contents: read\njobs:\n  a:\n    uses: ./.github/workflows/other.yml\n    secrets: !!str inherit\n",
  "anchor-trigger.yml": `name: x\nx-t: &t issues\non: [*t]\npermissions:\n  contents: read\njobs:\n  a:\n${steps}`,
  "quoted-on.yml": `name: x\n"on":\n  "issue_comment": {}\npermissions:\n  contents: read\njobs:\n  a:\n${steps}`,
  "job-issues-write.yml": `name: x\non:\n  push: {}\npermissions:\n  contents: read\njobs:\n  a:\n    permissions:\n      "issues": write\n${steps}`,
};
for (const [name, y] of Object.entries(VECTORS)) test(`I-022: the parsed-YAML guard refuses ${name}`, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "yaml-guard-"));
  fs.cpSync(path.join(ROOT, ".github"), path.join(d, ".github"), { recursive: true });
  for (const f of ["package.json", "package-lock.json"]) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
  for (const sub of ["game", "desk"]) for (const f of ["package.json", "package-lock.json"]) if (fs.existsSync(path.join(ROOT, sub, f))) { fs.mkdirSync(path.join(d, sub), { recursive: true }); fs.copyFileSync(path.join(ROOT, sub, f), path.join(d, sub, f)); }
  fs.writeFileSync(path.join(d, ".github/workflows", name), y);
  const env = { ...process.env, APP: d }; delete env.NODE_TEST_CONTEXT;
  const p = spawnSync(process.execPath, ["--test", path.join(ROOT, "tests/audit/site.ci-deps.test.mjs")], { env, encoding: "utf8" });
  assert.notEqual(p.status, 0, `the guard passed a workflow it must refuse (${name})`);
});
