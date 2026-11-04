/* Knode Games: what players call a week (D-063). On chain and in every file a week is the vault week number, counted
   from Mon 19 Oct 2026 00:00 UTC (week 0). Players see the week of Mon 9 Nov 2026 (vault week 3) as "Week 1", the
   first week that pays, and count on from there. Earlier weeks are shown by their date ("Week of 2 Nov") so nobody
   reads them as paying weeks. The table of all three labels is in .ai/platform/KOINOS.md → Time.
   KWeeks.label(w) → "Week 1" / "Week of 2 Nov"; KWeeks.short(w) → "1" / "2 Nov" (for "This week (…)" buttons). */
(() => {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;
  const GENESIS_MS = 1792368000000;            // Mon 19 Oct 2026 00:00 UTC, vault week 0
  const WEEK_MS = 7 * 86400000;
  const FIRST = 3;                             // vault week 3 = Mon 9 Nov 2026 = "Week 1"
  const n = (w) => { const x = Number(w); return Number.isFinite(x) ? Math.trunc(x) : NaN; };
  const date = (w) => new Date(GENESIS_MS + n(w) * WEEK_MS).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const short = (w) => (!Number.isFinite(n(w)) ? "?" : n(w) >= FIRST ? String(n(w) - FIRST + 1) : date(w));
  const label = (w) => (!Number.isFinite(n(w)) ? "Week" : n(w) >= FIRST ? `Week ${n(w) - FIRST + 1}` : `Week of ${date(w)}`);
  /** The vault week a time falls in. */
  const of = (ms) => Math.floor((Number(ms) - GENESIS_MS) / WEEK_MS);
  G.KWeeks = { label, short, of, FIRST, GENESIS_MS, WEEK_MS };
})();
