// Repo Lens #D-14 N-3 / #G-47: the Race picks upload tool is pinned to the audited v2 build, in its own commit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const APP = new URL("../../", import.meta.url).pathname;
test("#G-47: race-picks upload is pinned to the audited v2 build 9993581b… (race/README.md agrees)", () => {
  const src = fs.readFileSync(APP + "bot/race-picks.ts", "utf8"), readme = fs.readFileSync(APP + "race/README.md", "utf8");
  const pin = src.match(/export const RACE_SHA256 = "([0-9a-f]{64})";/)[1];
  assert.equal(pin, "9993581baf822cd070331008441c5ad974f5c0b134520dfb7422b9efd1873864");
  assert.ok(readme.includes(pin), "the README's release hash is the pin");
  assert.match(src, /sha256hex\(wasm\) !== RACE_SHA256/, "upload still refuses any other build");
});
