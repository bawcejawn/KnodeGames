// #G-82 G82-3 (Info; owner, 14 Nov: "every other hour is fine"): in a long ruler-data outage the kept-rounds alert
// (#G-78 G78-1) is emailed every other hour, and every hour in the last 12 h before the deadline; the other hours log
// it as a warning. The G78-1 test (g78-kit.test.mts) still proves an email fires well before the deadline.
import test from "node:test";
import assert from "node:assert/strict";
import { keptAlertEmails, KEPT_ALERT_AFTER_MS } from "../recorder/runtime.ts";
import { at, HOUR as H } from "../testing/fake-clock.ts";

test("G82-3: the kept-rounds alert emails on even UTC hours, and every hour in the last 12 h before the deadline", () => {
  const end = at(5), due = at(5, 3);                       // the week ends Mon 00:00; due Thu 00:00 UTC
  let emails = 0, runs = 0;
  for (let t = end + KEPT_ALERT_AFTER_MS; t < due; t += H) {
    runs++;
    const e = keptAlertEmails(t + 47 * 60000, due);        // the recorder runs at :47
    if (e) emails++;
    if (due - (t + 47 * 60000) <= KEPT_ALERT_AFTER_MS) assert.ok(e, `last 12 h: every hour (${new Date(t).toISOString()})`);
    else assert.equal(e, new Date(t).getUTCHours() % 2 === 0, new Date(t).toISOString());
  }
  assert.ok(emails < runs && emails >= runs / 2, `${emails} of ${runs} hours email`);
  assert.equal(runs, 60);
  assert.equal(emails, 36);                                // 24 of the first 48 hours, then all of the last 12
});
