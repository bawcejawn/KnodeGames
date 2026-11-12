// Knode Games — VHP ruler recorder: the "behind" alert (owner, 12 Nov). More than 3 hours behind gives a red ::error:: line
// every run and the same words in plain language at the top of the run page (GitHub's job summary), with the one-line
// owner step the Race's alert quotes. 3 hours or less: no alert. Run: node --import tsx --test <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeChain, FakeNode } from "./vhp-ruler.fixture.mjs";
import { recordHours, runSummary, BEHIND_ALERT, OWNER_STEP } from "../../bot/vhp-ruler.ts";

const c = makeChain({ seed: 23, hours: 40, np: 5, busy: 0.02, write: 31 });
const H = 1200, at = (n) => (n + 1) * H - 1;
const run = async (head) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vhp-alert-")), f = path.join(dir, "summary.md"), lines = [];
  const was = process.env.GITHUB_STEP_SUMMARY; process.env.GITHUB_STEP_SUMMARY = f;
  try {
    const A = new FakeNode(c.raw, { name: "A", head }), B = new FakeNode(c.raw, { name: "B", head });
    await recordHours(A, B, c.texts[30], { waitMs: 50, pollMs: 1, rounds: 3, maxHours: 1, maxChained: 1, log: (s) => lines.push(s) });
    return { lines, summary: fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "" };
  } finally { if (was === undefined) delete process.env.GITHUB_STEP_SUMMARY; else process.env.GITHUB_STEP_SUMMARY = was; fs.rmSync(dir, { recursive: true, force: true }); }
};

test("the alert fires at more than 3 hours behind (3,600 blocks), not before", async () => {
  assert.equal(BEHIND_ALERT, 3600);
  const near = await run(at(c.n0 + 32) + 70);   // about 2 hours behind: a normal run
  assert.equal(near.lines.some((l) => l.startsWith("::error::")), false, near.lines.join("\n"));
  assert.equal(near.summary, "");
  const far = await run(at(c.n0 + 35) + 70);    // about 5 hours behind
  const err = far.lines.find((l) => l.startsWith("::error::the VHP ruler is"));
  assert.ok(err, far.lines.join("\n"));
  assert.match(err, /hours behind \(newest hour \d+\); it catches up by itself/);
  assert.match(far.summary, /^## VHP ruler data is \d+\.\d hours behind/);
  assert.match(far.summary, /nothing is scored wrong/);
  assert.ok(far.summary.includes(OWNER_STEP), "the owner step, word for word");
});

test("the owner step is the one line the Race's alert quotes; runSummary is a no-op without a run page and never throws", () => {
  assert.equal(OWNER_STEP, "GitHub → Actions → VHP ruler data: if the latest run is red, click Re-run all jobs; missed hours are read back from the chain by themselves, and if it is red again the next hour, send its error text to the VHP Ruler chat.");
  const was = process.env.GITHUB_STEP_SUMMARY;
  delete process.env.GITHUB_STEP_SUMMARY; runSummary(["x"]);
  process.env.GITHUB_STEP_SUMMARY = path.join(os.tmpdir(), "no-such-dir-vhp", "s.md"); runSummary(["x"]);
  if (was === undefined) delete process.env.GITHUB_STEP_SUMMARY; else process.env.GITHUB_STEP_SUMMARY = was;
});
