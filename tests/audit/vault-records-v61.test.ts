// Records after the v6.1 upload (owner, Tue 10 Nov 2026, ~14:57 UTC; cancel_upgrade tx 0x1220c0ab…). The hourly chain
// watch compares the live code with wasmSha256, and the emergency tool refuses any withdrawals-only build but the pinned
// one, so both must be v6.1's (docs/UPGRADE-V61.md §3, D8-3).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("game-data/deployment.json records the live v6.1 build and pins v6.1's withdrawals-only build", () => {
  const dep = JSON.parse(fs.readFileSync("game-data/deployment.json", "utf8"));
  assert.equal(dep.wasmSha256, "11043e1fde1d8d7dbac75e9e5e788d058a7116b0dab6149fc09ecdc7b1c4258b");
  assert.equal(dep.safeWasmSha256, "04c27c1acde570b97a430dea403d41aab47e083ae30115353ee5f89932dad0bb");
});
