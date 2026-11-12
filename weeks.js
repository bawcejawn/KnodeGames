/* Knode Games: what players call a week (D-063). On chain and in every file a week is the vault week number, counted
   from Mon 19 Oct 2026 00:00 UTC (week 0). Players see the week of Mon 16 Nov 2026 (vault week 4) as "Week 1", the
   first week that pays, and count on from there (owner, 9 Nov 2026: "Week 1 = Mon 16"). The week of Mon 9 Nov (vault
   week 3) is the "Test week": it pays nothing and its earnings go to Week 1's pool. Earlier weeks are shown by their
   date ("Week of 2 Nov") so nobody reads them as paying weeks. The table of all labels is in .ai/platform/KOINOS.md → Time.
   KWeeks.label(w) → "Week 1" / "Test week" / "Week of 2 Nov"; KWeeks.short(w) → "1" / "Test" / "2 Nov" (for
   "This week (…)" buttons). KWeeks.isTest(w): the test week. */
(() => {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;
  const GENESIS_MS = 1792368000000;            // Mon 19 Oct 2026 00:00 UTC, vault week 0
  const WEEK_MS = 7 * 86400000;
  const FIRST = 4;                             // vault week 4 = Mon 16 Nov 2026 = "Week 1"
  const TEST = 3;                              // vault week 3 = Mon 9 Nov 2026 = "Test week" (pays nothing)
  const n = (w) => { const x = Number(w); return Number.isFinite(x) ? Math.trunc(x) : NaN; };
  const date = (w) => new Date(GENESIS_MS + n(w) * WEEK_MS).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const isTest = (w) => n(w) === TEST;
  const short = (w) => (!Number.isFinite(n(w)) ? "?" : n(w) >= FIRST ? String(n(w) - FIRST + 1) : isTest(w) ? "Test" : date(w));
  const label = (w) => (!Number.isFinite(n(w)) ? "Week" : n(w) >= FIRST ? `Week ${n(w) - FIRST + 1}` : isTest(w) ? "Test week" : `Week of ${date(w)}`);
  /** The vault week a time falls in. */
  const of = (ms) => Math.floor((Number(ms) - GENESIS_MS) / WEEK_MS);
  G.KWeeks = { label, short, of, isTest, FIRST, TEST, GENESIS_MS, WEEK_MS };
})();
