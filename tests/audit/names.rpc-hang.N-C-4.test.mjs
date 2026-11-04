// tests/audit/names.rpc-hang.N-C-4.test.mjs   (node --import tsx --test)
// A node that never answers can't hang the hourly @name refresh: each read gives up inside the call budget, and a
// failed read is left out (the other node's answer isn't trusted alone, audit PN-4), so the old @name stays.
import { test } from "node:test"; import assert from "node:assert/strict"; import net from "node:net"; import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const N = await import(new URL("bot/names.ts", `file://${ROOT}`).href);
test("N-C-4: a node that never answers can't hang the @name refresh (gives up within 30 s; the read is left out)", { timeout: 40000 }, async () => {
  const srv = net.createServer(() => { /* accept, never reply */ }).listen(0);
  const port = srv.address().port;
  const ok = { vhp: async () => 0n, stake: async () => 0n, players: async () => [], nickname: async () => "alice" };
  try {
    const t0 = Date.now(), a = "1AbcdefghijkmnopqrstuvwxyzABC";
    const r = await N.nicknames(new Set([a]), [N.chainAt(`http://127.0.0.1:${port}`), ok]);
    assert.ok(Date.now() - t0 < 30000, "within 30 s");
    assert.equal(r[a], undefined, "a read the hanging node didn't confirm is left out (the old @name stays)");
  } finally { srv.close(); }
});
