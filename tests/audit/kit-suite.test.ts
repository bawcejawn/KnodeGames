// The Shared Game Kit's own tests (kit/tests/, design §F), run by npm run test:audit.
import "../../kit/tests/payout.fuzz.test.ts";
import "../../kit/tests/sunday.property.test.ts";
import "../../kit/tests/faults.test.ts";
import "../../kit/tests/runtime.test.ts";
import "../../kit/tests/publish-check.test.ts";
import "../../kit/tests/tally.diff.test.ts";
import "../../kit/tests/render.test.ts";
import "../../kit/tests/conformance.test.ts";
import "../../kit/tests/repolens-b11.test.ts";
import "../../kit/tests/repolens-b12.test.ts";
import "../../kit/tests/repolens-e24.test.ts";
import "../../kit/tests/repolens-e25.test.ts";
import "../../kit/tests/repolens-e26.test.ts";
import "../../kit/tests/repolens-f2.test.ts";
import "../../kit/tests/repolens-f2-more.test.ts";
import "../../kit/tests/lows.test.ts";
import "../../kit/tests/phase1.test.ts";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("kit suite: every kit/tests/*.test.ts is imported here (none forgotten)", () => {
  const here = fs.readFileSync(new URL(import.meta.url), "utf8");
  const files = fs.readdirSync(new URL("../../kit/tests/", import.meta.url)).filter((f) => f.endsWith(".test.ts"));
  for (const f of files) assert.ok(here.includes(`kit/tests/${f}"`), f);
});
