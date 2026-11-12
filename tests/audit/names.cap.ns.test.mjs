// tests/audit/names.cap.ns.test.mjs — not run here (static review)
import { test } from "node:test"; import assert from "node:assert/strict";
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
await import(path.join(ROOT, "names.js"));
const R = globalThis.KNames.rules, N = await import(path.join(ROOT, "bot/names.ts"));
test("N-S-5 (R-HUB-5): the hourly run drops the old claimed names, so names.json stays small and in shape", async () => {
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const names = {};
  for (let i = 0; i < 4900; i++) names["1" + B58[(i / 3364 | 0) % 58] + B58[(i / 58 | 0) % 58] + B58[i % 58] + "x".repeat(30)] = { name: ("N" + i).padEnd(24, "x"), date: "2026-10-30", signature: "H" + "a".repeat(86) + "=" };
  const prev = { v: 1, updated: "", names, hidden: {}, nicknames: {} };
  const now = Date.parse("2026-11-04T12:00:00Z");
  const r = N.withoutClaims(prev, now);
  assert.deepEqual(r.names, {});
  assert.ok(Buffer.byteLength(N.serialize(r)) <= 1048576);
  assert.equal(N.withoutClaims(r, now), null, "nothing left to drop: no change");
});

// ---- continued ----
test("N-S-6: 3,000 nickname lookups finish well inside the job budget", async () => {
  const slow = { vhp: async () => 0n, stake: async () => 0n, players: async () => [], nickname: () => new Promise((r) => setTimeout(() => r(null), 5)) };
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const set = new Set(Array.from({ length: 3000 }, (_, i) => "1" + B58[(i / 3364 | 0) % 58] + B58[(i / 58 | 0) % 58] + B58[i % 58] + "x".repeat(30)));
  const t = Date.now(); await N.nicknames(set, [slow, slow]);
  assert.ok(Date.now() - t < 5000, "sequential: ~30 s at 5 ms/call");   // fails today
});
