// Repo Lens #F-8: static checks for PR #178 (vault-producer-keys @ fbbeff68). The PowerShell can't run in CI, so these
// read the scripts, as tests/audit/producer-keys.test.ts does. Each fails today and passes once its fix is in.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const backup = fs.readFileSync("node/backup-producer-keys.ps1", "utf8");
const setup = fs.readFileSync("node/setup-node.ps1", "utf8");
const restoreBlock = setup.slice(setup.indexOf("if ($RestoreKey)"), setup.indexOf("docker compose up -d"));

test("F8-6 (Low): the destination guard resolves junctions/symlinks and refuses non-removable or cloud-synced folders", () => {
  assert.match(backup, /LinkType|ResolveLinkTarget|\.Target\b/, "Inside() compares unresolved paths: a junction into C:\\kprediction passes");
  assert.match(backup, /DriveType|Removable|OneDrive/i, "any folder is accepted, including a OneDrive-synced Desktop (the key would upload)");
});

test("F8-7 (Low): -RestoreKey checks the key belongs to -Producer (and that the producer isn't live) before starting", () => {
  assert.match(restoreBlock, /producer-keys\.ts|get_public_key|publicKeyOf/, "a game key restored into the desk node (or any wrong file) is put in place unchecked");
});

test("F8-8 (Low): -RestoreKey refuses a node that runs from a Docker volume (the key would go to the unused folder)", () => {
  assert.match(setup.slice(0, setup.indexOf("docker compose up -d")), /knode-volume/, "with a knode-volume override, compose reads the volume, not basedir");
});

// Vault chat: fixed by running no image code at all with the key mounted (the helper is only created, never started,
// and the copy is checked by a second docker cp), so the image's digest no longer matters; the helper has no network.
test("F8-9 (Low): no image code runs with the key mounted, and the helper container has no network", () => {
  assert.match(backup, /docker create --network[ =]none/, "the helper container must have no network");
  assert.doesNotMatch(backup, /docker run[^\n]*\$\{vol\}/, "docker run executes image code with the key volume mounted");
});
