// Repo Lens fix-check 2 (RC-3): a KOIN Vault bracket request that may still be approved must block a second bracket
// send across a reload or a second tab, for as long as KOIN Vault can still approve it, and also when the request call
// itself failed after KOIN Vault may have created it. The Picks contract keeps the LAST pick (Picks.ts: entries.put),
// so the older request approved last replaces the newer bracket and moves its pick time later.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const page = fs.readFileSync(path.join(APP, "bracket.js"), "utf8");
const wallet = fs.readFileSync(path.join(APP, "wallet.js"), "utf8");

test("RC-3: the open-request lock survives a reload or a second tab (kept in storage, not a page variable)", () => {
  const lockLines = page.split("\n").filter((l) => /openRequestUntil/.test(l));
  assert.ok(lockLines.length, "the lock exists");
  assert.ok(lockLines.some((l) => /localStorage|sessionStorage|store\.(get|set)/.test(l)),
    "openRequestUntil is only an in-memory `let`: reloading the page or opening a second tab sends a second bracket");
});

test("RC-3: the lock lasts until KOIN Vault's own expiry of the request, not a fixed 10 minutes", () => {
  assert.ok(/expiresAt/.test(page) || /openUntil|requestExpires/.test(wallet + page),
    "the page locks for 10 minutes from the error, but never learns when KOIN Vault expires the request (req.expiresAt)");
});

test("RC-3: a failed request call (KOIN Vault may have created it) also locks", () => {
  // sendVault: `req = await vaultApi("request", …)` → a network error after KOIN Vault created the request reaches
  // bracket.js as "Not sent: Failed to fetch", which does not set the lock
  // (#E-26 E26-2 added `maybeOpen ||` in front: errors the wallet marks maybe-open, or a 5xx, lock whatever their text)
  const lockRe = page.match(/if \((?:maybeOpen \|\| )?(\/[^\n]*?\/i)\.test\(m\)\) \{\s*openRequestUntil/);
  assert.ok(lockRe, "lock condition found");
  assert.ok(/fetch|network/i.test(lockRe[1]), `the lock is set only for ${lockRe[1]}; a lost answer to the request call isn't one`);
});
