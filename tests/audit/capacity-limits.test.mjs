// tools/capacity/limits.mjs (daily capacity report) and .github/workflows/capacity.yml.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as L from "../../tools/capacity/limits.mjs";

test("CL-1 runs a day from cron lines", () => {
  assert.equal(L.runsPerDay(`on:\n  schedule:\n    - cron: "*/5 * * * *"\n`), 288);
  assert.equal(L.runsPerDay(`    - cron: "7 * * * *"\n    - cron: '7 0,12 * * *'\n`), 26);
  assert.equal(L.runsPerDay(`    - cron: "*/20 * * * *"`), 72);
  assert.equal(L.runsPerDay(`    - cron: "0 9-17/2 * * *"`), 5);
  assert.equal(L.runsPerDay(`name: x\non: push`), 0);
});

test("CL-2 caps and colours", () => {
  assert.equal(L.capOf("games-data", "questions/W004.json").cap, 1_900_000);
  assert.equal(L.capOf("games-data", "blockx/W004.json").cap, 2 * 1024 * 1024);
  assert.equal(L.capOf("vhp-data", "d/1422.json").cap, 16 * 1024 * 1024);
  assert.equal(L.colour(59.9), "green");
  assert.equal(L.colour(60), "amber");
  assert.equal(L.colour(85), "red");
});

test("CL-3 the report covers every workflow's schedule and the data branches it can see", () => {
  const rows = L.collect();
  const sched = rows.find((r) => r.kind === "schedules");
  assert.ok(sched && sched.value > 0);
  assert.equal(L.ALERT_SCHEDULES, false, "switch on once the schedule cut lands (Mon 23 Nov)");
});

test("CL-4 the daily workflow is read-only, pinned, once a day, and runs the report with --ci", () => {
  const y = fs.readFileSync(".github/workflows/capacity.yml", "utf8");
  assert.match(y, /^permissions:\n  contents: read\n/m);
  assert.doesNotMatch(y, /secrets\./);
  assert.doesNotMatch(y, /contents: write|id-token|pull-requests/);
  assert.equal(L.runsPerDay(y), 1);
  assert.match(y, /node tools\/capacity\/limits\.mjs --ci/);
  for (const u of y.matchAll(/uses: ([^\s]+)/g)) assert.match(u[1], /@[0-9a-f]{40}$/, `pinned: ${u[1]}`);
});
