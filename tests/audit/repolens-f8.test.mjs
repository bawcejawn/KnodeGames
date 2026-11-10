// Repo Lens #F-8: failing tests for PR #177 (vault-alert-summaries @ 27d60caf), bot/alert-summary.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadAlertRows, matchAlert, renderSummary } from "../../bot/alert-summary.mjs";

const rows = loadAlertRows(fs.readFileSync(".ai/platform/ALERTS.md", "utf8"));
const VOID = "W003-D2-1 (#85) is in test week 3 (vaultTestWeeks), so it must be VOID, but it has outcome 2 on chain. Void it with the owner key: npm run bot -- void-test 85 --send; the owner can correct it until 2026-11-16 21:00 UTC.";
const KEY = "A result was changed on chain: W003-D2-1 (#85) went from outcome 2 to 1000 (void). If you did not do this, your admin key may be compromised.";

test("F8-1 (Medium): a line matches a row only through that row's own opening words, not a generic fragment", () => {
  const r = matchAlert(VOID, rows);
  assert.ok(!r || !/orphan/i.test(Object.values(r.cols)[0]),
    `#114's "must be VOID" alert was matched to the Orphan-question row (key "has outcome"), so its summary says the operator key may be stolen: ${r && Object.values(r.cols)[0]}`);
  // Every key must be specific: none of these generic fragments may decide a match on its own.
  for (const generic of ["has outcome", "already has", "question file", "params hash", "is pending", "is scheduled"]) {
    const hit = matchAlert(`Something unrelated ${generic} something else.`, rows);
    assert.equal(hit, null, `"${generic}" alone matched §${hit?.section}: ${hit && Object.values(hit.cols)[0]}`);
  }
});

test("F8-2 (High): an uncatalogued line saying a key may be compromised is never summarised as 'stakes are safe'", () => {
  const md = renderSummary({ workflow: "Knode Games bot", lines: [KEY], rows, section: 3 });
  const matter = md.split("\n").find((l) => l.startsWith("- **Does it matter:**")) ?? "";
  assert.ok(!/stakes are safe/i.test(matter), `the summary reassures on a possible key compromise: ${matter}`);
  assert.ok(/at once|now|immediately/i.test(md), "it must say to act at once if the owner did not make the change");
});

test("F8-4 (Low): an 'Expected' cell of 'never' isn't rendered as 'Yes, after: never'", () => {
  const md = renderSummary({ workflow: "Knode Games bot", lines: ["Orphan question #90 (it matches no question file) has outcome 2 on chain, not VOID."], rows, section: 3 });
  assert.ok(!/Yes, after: never/i.test(md), md);
});

test("F8-3 (Medium): the section-8 fallback never says 'nothing yet' — a held week (the alert job's exit 1) has a deadline", () => {
  const md = renderSummary({ workflow: "Producer race", lines: [], rows, section: 8 });
  assert.ok(!/nothing yet/i.test(md), "the Race HELD / Block X held alerts fail the run every hour until acted on:\n" + md);
  assert.ok(/held/i.test(md) && /red/i.test(md), "it must say: read the red lines first; a HELD week needs action before its deadline");
});

test("F8-5 (Low): a time in the line that isn't a deadline isn't labelled 'Deadline'", async () => {
  const { deadlines } = await import("../../bot/alert-summary.mjs");
  assert.deepEqual(deadlines("Node down? last block at 2026-11-09 20:00 UTC, 3 h ago."), [], "a past event time is not a deadline");
  assert.equal(deadlines("the owner can correct it until 2026-11-16 21:00 UTC.").length, 1, "control: 'until …' is one");
});
