// R-VAULT-10: producer key backup and restore. tools/producer-keys.ts (public keys only, checked against the chain),
// node/backup-producer-keys.ps1 and node/setup-node.ps1 -RestoreKey (static checks: PowerShell isn't run here).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Signer } from "koilib";
import { publicKeyOf, checkBackup, producers } from "../../tools/producer-keys.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const backup = fs.readFileSync(path.join(ROOT, "node/backup-producer-keys.ps1"), "utf8");
const setup = fs.readFileSync(path.join(ROOT, "node/setup-node.ps1"), "utf8");
const pub = (s: Signer) => { const pk: any = (s as any).publicKey; return Buffer.from(typeof pk === "string" ? Buffer.from(pk.replace(/^0x/, ""), "hex") : pk).toString("base64url"); };

test("publicKeyOf: WIF and hex keys give the signer's public key; an unknown format never echoes the input", () => {
  const s = Signer.fromSeed("producer-keys test");
  assert.equal(publicKeyOf(s.getPrivateKey("wif", true) + "\n"), pub(s));
  assert.equal(publicKeyOf(s.getPrivateKey("hex")), pub(s));
  assert.throws(() => publicKeyOf("not-a-key-SECRET123"), (e: any) => !String(e.message).includes("SECRET123") && /format/.test(e.message));
});

test("checkBackup: each node's key against Proof-of-Burn and the records; missing or wrong keys are flagged", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pk-"));
  const game = Signer.fromSeed("game node"), desk = Signer.fromSeed("desk node"), other = Signer.fromSeed("someone else");
  fs.mkdirSync(path.join(dir, "game")); fs.writeFileSync(path.join(dir, "game", "private.key"), game.getPrivateKey("wif", true));
  fs.mkdirSync(path.join(dir, "desk")); fs.writeFileSync(path.join(dir, "desk", "private.key"), desk.getPrivateKey("hex"));
  const who = producers(ROOT, {});
  const onChain: Record<string, string> = { [who.game.producer]: pub(game), [who.desk.producer]: pub(other) };
  const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pk-root-"));
  fs.mkdirSync(path.join(fakeRoot, "game-data")); fs.mkdirSync(path.join(fakeRoot, "desk-data"));
  fs.writeFileSync(path.join(fakeRoot, "game-data/deployment.json"), JSON.stringify({ contract: who.game.producer, producerKey: pub(game) }));
  fs.writeFileSync(path.join(fakeRoot, "desk-data/deployment.json"), JSON.stringify({ contract: who.desk.producer }));
  const rows = await checkBackup(dir, async (p) => onChain[p] ?? "", fakeRoot, {});
  const by = Object.fromEntries(rows.map((r) => [r.node, r]));
  assert.equal(by.game.ok, true, by.game.note);
  assert.equal(by.desk.ok, false);
  assert.match(by.desk.note, /NOT the registered key/);
  assert.equal(by.personal.ok, false);
  assert.match(by.personal.note, /no backup/);
  for (const r of rows) assert.ok(!JSON.stringify(r).includes(game.getPrivateKey("wif", true)) && !JSON.stringify(r).includes(desk.getPrivateKey("hex")), "a private key leaked into the output");
});

test("the backup script: never shows a key, refuses the repo and the node folders, checks every copy, warns about two nodes", () => {
  assert.doesNotMatch(backup, /Get-Content[^\n]*private\.key/i, "never reads a key into the console");
  assert.doesNotMatch(backup, /Write-(Host|Output)[^\n]*\$(target|src)\b[^\n]*Get-Content/i);
  assert.match(backup, /Refusing to write keys inside the repository/);
  assert.match(backup, /Refusing to write into a node's own folder/);
  assert.match(backup, /docker cp "\$\{id\}:\/from\/block_producer\/private\.key"/, "a volume's key is copied out with docker cp");
  assert.match(backup, /Get-FileHash -Algorithm SHA256/);
  assert.match(backup, /isn't identical/);
  assert.match(backup, /npx tsx tools\/producer-keys\.ts \$Dest/, "prints public keys, checked against the chain");
  assert.match(backup, /Never run two nodes with the same key at the same time/);
  assert.doesNotMatch(backup, /Remove-Item[^\n]*(basedir|block_producer|\$Roots)/i, "never deletes anything of a node");
});

test("setup-node -RestoreKey: confirmed first, never replaces a different key, in place before the first start", () => {
  assert.match(setup, /\[string\]\$RestoreKey = ""/);
  assert.match(setup, /Read-Host "Type YES if the old node is off for good"/);
  assert.match(setup, /\$answer -cne "YES"/);
  assert.match(setup, /already has a DIFFERENT key/);
  const restore = setup.indexOf("Copy-Item -LiteralPath $RestoreKey");
  const start = setup.indexOf("docker compose up -d");
  assert.ok(restore > 0 && start > restore, "the key is copied before docker compose up");
  assert.ok(setup.indexOf("Read-Host \"Type YES") < setup.indexOf('Step "1/5'), "the confirmation comes before any download");
});
