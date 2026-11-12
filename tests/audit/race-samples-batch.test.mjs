// The VHP sampler takes up to 12 samples a run (2026-11-03: GitHub ran its */5 schedule only about once an hour, and a
// race card needs MIN_SAMPLES = 12 in its 6 hours, or Block X never scores with it). This runs the workflow's own step
// script with a stand-in for `npm run race -- --sample`.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APP = process.env.APP || ".";
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/race-samples.yml"), "utf8");
const step = yml.split("- name: Take up to 12 samples")[1].split("\n        run: |\n")[1].split("\n        env:")[0]
  .split("\n").map((l) => l.slice(10)).join("\n");

/** Runs the step with a fake npm: each call appends one sample to RACE_PREV's file and writes it to RACE_OUT;
 *  calls listed in `fail` exit 1 without writing. Returns { ok, count, out }. */
function runStep(fail = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "rs-")), bin = path.join(d, "bin"), prev = path.join(d, "prev"), out = path.join(d, "out");
  for (const x of [bin, prev, out]) fs.mkdirSync(x);
  fs.writeFileSync(path.join(bin, "npm"), `#!/usr/bin/env bash
n=$(cat "${d}/n" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "${d}/n"
for f in ${fail.join(" ")}; do [ "$n" = "$f" ] && exit 1; done
node -e 'const fs=require("fs");const p=process.argv[1]+"/vhp-samples.json";let j={v:1,samples:[]};try{j=JSON.parse(fs.readFileSync(p))}catch{};j.samples.push({at:Date.now()-600000});fs.writeFileSync(process.argv[2]+"/vhp-samples.json",JSON.stringify(j))' "$RACE_PREV" "$RACE_OUT"
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RACE_PREV: prev, RACE_OUT: out };
  let ok = true, log = "";
  try { log = execFileSync("bash", ["-c", step], { env, stdio: "pipe" }).toString(); } catch (e) { ok = false; log = String(e.stdout); }
  const f = path.join(out, "vhp-samples.json");
  const count = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).samples.length : 0;
  fs.rmSync(d, { recursive: true, force: true });
  return { ok, count, log };
}

test("sampler: one run takes 12 samples, each building on the last (published together)", () => {
  const r = runStep();
  assert.equal(r.ok, true); assert.equal(r.count, 12); assert.match(r.log, /12 sample\(s\) taken/);
});

test("sampler: a failed sample is skipped and the others are kept; no sample at all fails the run", () => {
  const some = runStep([3, 7]);
  assert.equal(some.ok, true); assert.equal(some.count, 10, "10 of 12, the earlier ones kept"); assert.match(some.log, /sample 3 failed/);
  const none = runStep([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(none.ok, false, "nothing to publish: the run is red");
});

test("sampler: the job can take its 12 samples inside its time limit, and the samples file can hold 8 hours of them", () => {
  assert.match(yml, /timeout-minutes: 58/);
  assert.match(step, /-ge 2880/, "stops starting samples after 48 minutes (12 × at most 4 minutes of waiting)");
  const cap = Number(yml.match(/assert type\(s\) is list and len\(s\) <= (\d+)/)[1]);
  assert.ok(cap >= 8 * 12, `8 hours at 12 an hour fit (cap ${cap})`);
});

test("sampler: never two samples within 4 minutes, so 8 hours hold at most SAMPLE_MAX (120) whatever the schedule", async () => {
  assert.match(step, /if \[ "\$age" -lt 240 \]; then sleep \$\(\( 240 - age \)\); fi/);
  const { SAMPLE_MAX, SAMPLE_KEEP } = await import(path.resolve(APP, "bot/race.ts"));
  assert.ok(SAMPLE_KEEP / (4 * 60000) <= SAMPLE_MAX, "8 hours / 4 minutes fits SAMPLE_MAX");
  // The gate's age reading: a sample 1 minute old waits 3 minutes; no file waits nothing.
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "rs-"));
  const age = (samples) => { if (samples) fs.writeFileSync(path.join(d, "vhp-samples.json"), JSON.stringify({ samples })); else fs.rmSync(path.join(d, "vhp-samples.json"), { force: true });
    const line = step.split("\n").find((l) => l.includes("age=$(node -e"));
    return Number(execFileSync("bash", ["-c", line + '; echo "$age"'], { env: { ...process.env, RACE_PREV: d } }).toString().trim()); };
  const a = age([{ at: Date.now() - 60000 }]); assert.ok(a >= 59 && a <= 62, String(a));
  assert.ok(age(null) >= 240, "no samples yet: no wait");
  fs.rmSync(d, { recursive: true, force: true });
});
