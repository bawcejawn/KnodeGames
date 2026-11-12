/**
 * Plain-language alert summaries (R-VAULT-9, D-107). Every alert email is GitHub's "Run failed" email; the owner then
 * has to find out what failed. This writes a short job summary ($GITHUB_STEP_SUMMARY, shown at the top of the run
 * page) with, for each alert line: What happened, Does it matter, Expected?, What to do, and any deadline in UTC and
 * Pacific time. The wording comes from the alert catalogue, .ai/platform/ALERTS.md: each alert line is matched to its
 * row there (the quoted words in the row's first cell). An alert that has no row says so and points to the Vault chat.
 *
 * Plain JavaScript with no dependencies, so the bot (tsx), the watchdog (node) and any workflow step can use it.
 *
 *   node bot/alert-summary.mjs --workflow "Knode Games bot" "alert line" "alert line" …
 *   node bot/alert-summary.mjs --workflow "Producer race" --section 8            (no lines: the step-failed fallback)
 *
 * Writes to $GITHUB_STEP_SUMMARY when it is set, else prints the summary. Never fails the run itself (exit 0).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ALERTS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".ai", "platform", "ALERTS.md");
const MAX_LINES = 40;            // one summary never lists more alerts than this (the rest are counted)
const MAX_LINE = 600;            // characters of one alert line shown
const MIN_KEY = 16;              // a key shorter than this is too generic to decide a match ("has outcome", "is pending": Repo Lens #F-8 F8-1)
const MIN_LEAD = 10;             // a row's opening words count from this length, but only at the start of the line
/** A line that says a key may be stolen gets this, whatever its row says (Repo Lens #F-8 F8-2): the owner key can
 *  schedule an upgrade, so a real compromise does put funds at risk. */
const KEY_RISK = /compromised|stolen|if you did not|if you didn't/i;
const RISK = {
  matter: "Possibly serious. If you did NOT make this change yourself, act at once: your admin key may be stolen, and the owner key can schedule a contract upgrade. If you made it (an upgrade, a handover, a void, a setting), it's the expected echo.",
  expected: "Only if you just made this change yourself",
  todo: "if you did NOT make it: follow `RUNBOOK.md` §7 now (and `KEYS_AND_ROLES.md`), then tell the Vault chat. If you did: nothing; it stops once the records are updated",
};
const UNKNOWN_MATTER = "This line isn't in the catalogue yet, so this summary can't judge it: read the line itself.";

/** What each section of ALERTS.md means for the players' money, and whether it is usually expected. */
const SECTION = {
  2: { matter: "Only if you did NOT make this change yourself: then act at once (a key may be stolen). If you made it, it's the expected echo and stops once the records PR is merged. Players' stakes are not at risk from the alert itself.",
    expected: "Yes, if you just did the owner step named in the row" },
  3: { matter: "Players' stakes are safe. It repeats every hourly run while it's true.", expected: "Not usually" },
  4: { matter: "Players' stakes are safe. If nothing is fixed before that game's results deadline, its week rolls over (the stakers' bucket stays in the game, the free prize goes back to the pool).", expected: "Not usually" },
  5: { matter: "Players' stakes are safe. At worst players pay their own Mana until 00:00 UTC.", expected: "Not usually" },
  6: { matter: "Players' stakes are safe. Your nodes may be down: the pool earns nothing while they are.", expected: "Not usually" },
  7: { matter: "Players' stakes are safe. A node, or today's question release, needs a look.", expected: "Not usually" },
  8: { matter: "Players' stakes are safe and nothing wrong was published. A held week isn't paid until it's released.", expected: "Not usually" },
};
const DEFAULT_SECTION = { matter: "Players' stakes are never at risk from an alert by itself (ALERTS.md §0).", expected: "Not usually, unless you just did an owner step (docs/WALLETS.md §6)" };

const plain = (s) => String(s ?? "").replace(/\*\*|`/g, "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());

/**
 * The alert rows of ALERTS.md: { section, title, keys (lowercase literal pieces of the quoted alert text), cols (header
 * → cell) }. A table counts when its first header starts with "Alert".
 */
export function loadAlertRows(md) {
  const rows = [];
  let section = 0, title = "", header = null;
  for (const line of String(md).split(/\r?\n/)) {
    const h = line.match(/^## (\d+)\.\s*(.*)$/);
    if (h) { section = Number(h[1]); title = plain(h[2]); header = null; continue; }
    if (!line.startsWith("|")) { header = null; continue; }
    const c = cells(line);
    if (/^-+$/.test(c[0].replace(/:/g, ""))) continue;                      // the |---| line
    if (!header) { header = /^alert/i.test(c[0]) ? c.map(plain) : []; continue; }
    if (!header.length) continue;
    const cols = {};
    header.forEach((name, i) => { cols[name] = plain(c[i] ?? ""); });
    const quoted = [...c[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const keys = [], leads = [];
    for (const q of quoted) {
      // The row's opening words: the alert text's literal start, matched only at the start of a line.
      const lead = plain(q).split(/…|\.\.\.|<[^>]*>|\b[NXY]\b| \/ /)[0].toLowerCase().replace(/[“”"]/g, "").trim();
      if (lead.length >= MIN_LEAD) leads.push(lead);
    }
    for (const q of quoted.length ? quoted : [plain(c[0])]) {
      // Literal pieces between the "…", the placeholders (N, X, Y, <…>) and " / " alternatives, long enough to be specific.
      for (const piece of plain(q).split(/…|\.\.\.|<[^>]*>|\b[NXY]\b| \/ /)) {
        const k = piece.toLowerCase().replace(/[“”"]/g, "").trim();
        if (k.length >= MIN_KEY) keys.push(k);
      }
    }
    if (keys.length || leads.length) rows.push({ section, title, keys, leads, cols });
  }
  return rows;
}

/** The row an alert line belongs to: the one with the longest specific piece found in the line (at least MIN_KEY
 *  characters), or whose opening words start the line; null when none fits (Repo Lens #F-8 F8-1). */
export function matchAlert(line, rows) {
  const l = plain(line).toLowerCase();
  let best = null, len = 0;
  for (const r of rows) {
    for (const k of r.keys) if (k.length > len && l.includes(k)) { best = r; len = k.length; }
    for (const k of r.leads ?? []) if (k.length > len && l.startsWith(k)) { best = r; len = k.length; }
  }
  return best;
}

const col = (r, re) => { for (const [k, v] of Object.entries(r.cols)) if (re.test(k) && v) return v; return ""; };

/** A time in the line that is a deadline ("until / by / before / due / deadline / closes / ends …") →
 *  "Mon 16 Nov 00:00 UTC (Sun 15 Nov 4:00 PM PT)". A past event time ("last block at …") is not one (Repo Lens #F-8 F8-5). */
export function deadlines(line) {
  const out = [];
  const re = /(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d)(?::\d\d(?:\.\d+)?)?(?:Z| UTC)/g;
  const text = String(line);
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (!/\b(until|by|before|due|deadline|closes?|ends?)\b[^.;:]*$/i.test(before)) continue;
    const t = Date.parse(`${m[1]}T${m[2]}:00Z`);
    if (!Number.isFinite(t)) continue;
    const day = (opts) => new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", ...opts }).format(t);
    const utc = `${day({ timeZone: "UTC" })} ${m[2]} UTC`;
    const pt = `${day({ timeZone: "America/Los_Angeles" })} ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(t)} PT`;
    const s = `${utc} (${pt})`;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** The summary's markdown for one run. `lines` empty: the fallback for a step that failed without an alert line. */
export function renderSummary({ workflow, lines, rows, section }) {
  const list = (lines ?? []).map((l) => String(l).replace(/\r?\n/g, " ").trim()).filter(Boolean);
  const out = [`## ${workflow || "This run"}: what needs your attention`, ""];
  if (!list.length) {
    const s = SECTION[section] ?? DEFAULT_SECTION;
    out.push(
      "**What happened:** a step of this run failed without a known alert line (a held week, a publish check that refused, a network hiccup or a job error).",
      `**Does it matter:** ${s.matter}`,
      "**Expected?** Not if it's a held week: that fails every run until it's dealt with. A one-off failure is often a hiccup the next run retries.",
      `**What to do:** open the step with the red ✖ and read its red lines first. If they say a week is HELD, it needs action before that week's results deadline (\`RUNBOOK.md\` §3, and the game's chat). Otherwise, if the next run fails too, copy the red lines (never \`.env\`) and paste them to the chat named in \`.ai/platform/ALERTS.md\`${section ? ` §${section}` : ""}.`,
      "");
    return out.join("\n");
  }
  out.push(`${list.length} alert${list.length === 1 ? "" : "s"}. Players' stakes are never at risk from an alert by itself. Each one is explained below; the full catalogue is \`.ai/platform/ALERTS.md\`.`, "");
  list.slice(0, MAX_LINES).forEach((line, i) => {
    const r = matchAlert(line, rows ?? []);
    const risk = KEY_RISK.test(line);
    const s = (r && SECTION[r.section]) || SECTION[section] || DEFAULT_SECTION;
    const shown = line.length > MAX_LINE ? line.slice(0, MAX_LINE) + " …" : line;
    out.push(`### ${i + 1}. ${plain(shown).slice(0, 90)}${plain(shown).length > 90 ? " …" : ""}`);
    out.push(`- **What happened:** ${plain(shown)}`);
    const fires = r && col(r, /^trigger/i) ? ` (It fires when: ${col(r, /^trigger/i)}.)` : "";
    out.push(`- **Does it matter:** ${risk ? RISK.matter : r ? s.matter : UNKNOWN_MATTER}${fires}`);
    const exp = r && col(r, /expected/i);
    const never = !exp || /^(never|none|no|—|-|n\/a)\.?$/i.test(exp.trim());
    out.push(`- **Expected?** ${!never ? `Yes, after: ${exp}. Otherwise no.` : exp ? "No." : risk ? RISK.expected + "." : r ? s.expected + "." : "Unknown: it isn't in the catalogue."}`);
    const todo = r && col(r, /what you can do|did not do it|how to/i);
    out.push(`- **What to do:** ${todo || (risk ? RISK.todo + "." : "it isn't in the catalogue yet: paste this line (never `.env`) to the Vault chat.")}${r ? ` (ALERTS.md §${r.section}: ${r.title})` : ""}`);
    const d = deadlines(line);
    out.push(`- **Deadline:** ${d.length ? d.join("; ") : "none stated in the alert"}`);
    out.push("");
  });
  if (list.length > MAX_LINES) out.push(`…and ${list.length - MAX_LINES} more in the run's log.`, "");
  return out.join("\n");
}

/** Appends the summary to $GITHUB_STEP_SUMMARY (or prints it). Never throws: a summary must not break an alert. */
export function writeSummary({ workflow, lines, section, alertsFile = ALERTS_FILE, env = process.env, print = console.log }) {
  try {
    let rows = [];
    try { rows = loadAlertRows(fs.readFileSync(alertsFile, "utf8")); } catch { /* no catalogue: every line says so */ }
    const md = renderSummary({ workflow, lines, rows, section });
    if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, md + "\n");
    else print(md);
    return md;
  } catch (e) {
    try { print(`(alert summary skipped: ${e?.message ?? e})`); } catch { /* nothing */ }
    return "";
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2);
  let workflow = "", section = 0;
  const lines = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--workflow") workflow = a[++i] ?? "";
    else if (a[i] === "--section") section = Number(a[++i] ?? 0) || 0;
    else lines.push(a[i]);
  }
  writeSummary({ workflow, lines, section });
}
