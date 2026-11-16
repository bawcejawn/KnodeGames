// Knode Games — the VHP Ruler chat's check of the Producer Race's ruled weeks (Week 1 = vault week 4, from Sun 15 Nov
// 2026 7 PM ET). Read-only: it reads a race-data checkout (and, if given, a vhp-data checkout) and GitHub's run list and
// logs through the gh CLI (GET requests only). It writes nothing, sends nothing, and no game reads its result.
//
//   node tools/vhp-ruler-race-check.mjs <race-data folder> [--week 4] [--vhp-data <folder>] [--since 2026-11-16T00:00:00Z]
//        [--gh bawcejawn/KnodeGames] [--now <ISO time>]
//
// It checks:
//  1. Every run of race.yml since --since finished green (a run still going is listed, not counted).
//  2. Their record and publish logs (every finished run since --since, page by page): no "differs", "refused", "held, not published" or "doesn't match the ruler's data" line; the
//     "ok: the card matches" lines are counted; the ruler's waits and alerts are listed.
//  3. R<week>.json and R<week>-<type>.json: the header is { week, rulerFrom: 4, mode: "on", shadow: false }; every card is
//     ruleVersion 4, game 7, its own round and window, with no mode / version / include key; its placings are the
//     card's top three by fpct (entry, not void; equal fpct by address); with --vhp-data, the card is rebuilt from the
//     ruler's data with the Race's own settings (KRuler.recompute) and must be byte for byte the same.
//  4. A race with no card is "not yet" (its note is shown); after 3 hours past its end it is listed as late (the Race's
//     own owner alert fires then too: RULER_LATE_ALERT).
// Exit code: 0 OK, 1 problems found, 2 bad usage.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(root + "vhp-ruler.js", "utf8"), box);
const R = box.window.KRuler;

/** The Race's ruler settings, as bot/race-ruler.ts RULER (a test keeps them equal). */
export const RACE = Object.freeze({ game: 7, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: Object.freeze(["1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"]) });
const LATE = 3 * 3600000, BLOCK_MS = 3000;

/** 1st, 2nd, 3rd from a scored card, as bot/race-ruler.ts placingsOf. */
export function placingsFrom(card) {
  const field = (card.producers || []).filter((p) => p.entry && !p.void && p.fpct !== null && p.fpct !== undefined);
  field.sort((x, y) => { const a = BigInt(x.fpct), b = BigInt(y.fpct); return a > b ? -1 : a < b ? 1 : x.a < y.a ? -1 : x.a > y.a ? 1 : 0; });
  return field.slice(0, 3).map((p) => p.a);
}

/** The ruler files of a week: R<week>.json and R<week>-<type>.json, sorted by name. */
export function loadWeek(dir, week) {
  const pre = "R" + String(week).padStart(3, "0");
  return fs.readdirSync(dir).filter((f) => f === pre + ".json" || new RegExp(`^${pre}-\\d+\\.json$`).test(f)).sort()
    .map((name) => ({ name, file: JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) }));
}

/** One ruler file's check. L: the ruler's ledger (null = don't rebuild). now: ms. */
export function checkRulerFile(f, { week, L = null, now = Date.now() }) {
  const problems = [], notYet = [], late = [];
  let cards = 0, recomputed = 0;
  if (f.v !== 1) problems.push(`v is ${f.v}, not 1`);
  if (f.week !== week) problems.push(`week is ${f.week}, not ${week}`);
  if (f.rulerFrom !== 4) problems.push(`rulerFrom is ${f.rulerFrom}, not 4 (RACE_RULER_FROM_WEEK must stay 4)`);
  if (f.mode !== "on") problems.push(`mode is ${JSON.stringify(f.mode)}, not "on" (the switch state, not a scoring mode)`);
  if (f.shadow !== false) problems.push(`shadow is ${f.shadow}, not false`);
  for (const e of Array.isArray(f.races) ? f.races : []) {
    const id = e.id;
    if (!e.card) {
      // "2026-11-16T00" (6-hour), "H1-2026-11-16T05", "H2-…T04", "D-2026-11-16", "W-2026-11-16" (race-math typedId)
      const m = /^(?:(?:H1|H2|D|W)-)?(\d{4}-\d\d-\d\d)(?:T(\d\d))?$/.exec(String(id));
      const start = m ? Date.parse(`${m[1]}T${m[2] ?? "00"}:00:00Z`) : NaN, len = (e.window.S1 - e.window.S0 + 1) * BLOCK_MS;
      const line = `${id}: ${e.note || "no card and no note"}`;
      if (Number.isFinite(start) && now > start + len + LATE) late.push(line); else notYet.push(line);
      if (e.placings && e.placings.length) problems.push(`${id}: placings without a card`);
      continue;
    }
    cards++;
    let c;
    try { c = JSON.parse(e.card); } catch { problems.push(`${id}: the card isn't JSON`); continue; }
    if (c.ruleVersion !== 4) problems.push(`${id}: ruleVersion ${c.ruleVersion}, not 4`);
    if (c.game !== 7) problems.push(`${id}: game ${c.game}, not 7`);
    if (c.round !== e.round) problems.push(`${id}: the card's round ${c.round} isn't the entry's ${e.round}`);
    if (JSON.stringify(c.window) !== JSON.stringify(e.window)) problems.push(`${id}: the card's window isn't the entry's`);
    for (const k of ["mode", "version", "include"]) if (k in c) problems.push(`${id}: the card has a "${k}" key (the Race runs mode A, version 4, no include)`);
    if (!(c.producers || []).some((p) => "fpct" in p)) problems.push(`${id}: the card isn't scored`);
    else if (JSON.stringify(placingsFrom(c)) !== JSON.stringify(e.placings)) problems.push(`${id}: placings ${JSON.stringify(e.placings)} aren't the card's top three by fpct ${JSON.stringify(placingsFrom(c))}`);
    if (L) {
      const r = R.recompute(L, e.card, { ...RACE, round: e.round, window: e.window, pooled: [...RACE.pooled] });
      if (r.same) recomputed++; else problems.push(`${id}: the card doesn't recompute from the ruler's data: ${r.diff}`);
    }
  }
  return { problems, notYet, late, cards, recomputed };
}

/** The publish logs' ruler lines. */
export function scanLogs(text) {
  const problems = [], alerts = [];
  let ok = 0;
  for (const raw of String(text).split("\n")) {
    // GitHub's logs repeat each step's script before it runs, in colour (ESC[36;1m): those are source lines, not output.
    if (raw.includes("[36;1m")) continue;
    const line = raw.replace(/^\S*Z\s/, "").trim();
    if (/ok: the card matches the ruler's data/.test(line)) { ok++; continue; }
    if (/differs|refused|refusing|held, not published|doesn't match the ruler's data/i.test(line) && /::error::|##\[error\]|differs/.test(line)) { problems.push(line.slice(0, 300)); continue; }
    if (/VHP ruler|ruler's data|ruler's result|ruler's cards wait|hours behind/i.test(line) && /::warning::|::error::|##\[(warning|error)\]|waiting|behind/.test(line)) alerts.push(line.slice(0, 300));
  }
  return { ok, problems, alerts };
}

/** The Race's runs since `since` (ms): each finished one must be green. */
export function checkRuns(runs, since) {
  const mine = runs.filter((r) => Date.parse(r.created_at) >= since);
  const running = mine.filter((r) => r.status !== "completed").length;
  const done = mine.filter((r) => r.status === "completed");
  const problems = done.filter((r) => r.conclusion !== "success").map((r) => `run ${r.id} (${r.created_at}) is ${r.conclusion}${r.html_url ? ": " + r.html_url : ""}`);
  return { counted: done.length + running, green: done.length - problems.length, running, problems };
}

/** The plain report. */
export function report({ files, runs, logs }) {
  const out = [], probs = [];
  if (runs) { out.push(`Race runs: ${runs.green} green of ${runs.counted - runs.running} finished${runs.running ? `, ${runs.running} still running` : ""}.`); probs.push(...runs.problems); }
  if (logs) { out.push(`Record and publish logs${logs.of !== undefined ? ` (read for ${logs.read} of ${logs.of} finished runs)` : ""}: ${logs.ok} "card matches" lines.`); probs.push(...logs.problems); if (logs.alerts.length) out.push("Ruler waits and alerts in the logs:", ...logs.alerts.map((a) => "  - " + a)); }
  for (const f of files) {
    out.push(`${f.name}: ${f.cards} card(s)${f.recomputed !== undefined && f.cards ? `, ${f.recomputed} rebuilt from vhp-data and identical` : ""}; ${f.notYet.length} not yet; ${f.late.length} late.`);
    out.push(...f.notYet.map((x) => "  not yet: " + x), ...f.late.map((x) => "  LATE (over 3 h): " + x));
    probs.push(...f.problems.map((p) => `${f.name}: ${p}`));
  }
  const head = probs.length ? `PROBLEMS: ${probs.length}` : "OK: the Race's ruled week checks out";
  return { text: [head, ...probs.map((p) => "  ✗ " + p), "", ...out].join("\n"), problems: probs.length };
}

const gh = (p) => execFileSync("gh", ["api", p], { encoding: "utf8", maxBuffer: 1 << 28 });

/** Every race.yml run created since `since` (ms), page by page (Repo Lens G86-3): GitHub gives at most 100 a page and the
 *  workflow runs hourly, so a week is about 168 runs. get(path) returns parsed JSON (GET only). A list shorter than
 *  GitHub's total_count is a problem: the check would not cover the whole week. */
export function listRuns(get, repo, since) {
  const runs = [], problems = [];
  let total = null;
  for (let page = 1; page <= 20; page++) {
    const r = get(`repos/${repo}/actions/workflows/race.yml/runs?per_page=100&page=${page}&created=%3E%3D${new Date(since).toISOString()}`);
    total = r.total_count;
    runs.push(...r.workflow_runs);
    if (r.workflow_runs.length < 100) break;
  }
  if (total !== null && runs.length !== total) problems.push(`runs listed: ${runs.length} of GitHub's ${total}: the check doesn't cover every run since the start`);
  return { runs, problems };
}

/** The record and publish logs of every completed run (Repo Lens G86-3 and the Info on the record job: the Race recorder's
 *  "waiting for the VHP ruler's result" line is in the record job). A log that can't be read is a problem: the report
 *  says how many runs were read. getText(path) returns the log text. */
export function readLogs(get, getText, repo, runs) {
  let text = "", read = 0;
  const done = runs.filter((r) => r.status === "completed"), problems = [];
  for (const run of done) {
    let ok = true;
    try {
      const jobs = get(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=50`).jobs.filter((x) => /^(record|publish)\b/i.test(x.name));
      if (!jobs.length) ok = false;
      for (const j of jobs) { try { text += getText(`repos/${repo}/actions/jobs/${j.id}/logs`) + "\n"; } catch { ok = false; } }
    } catch { ok = false; }
    if (ok) read++;
  }
  if (read < done.length) problems.push(`logs read for ${read} of ${done.length} finished runs: the rest couldn't be read, so they weren't checked`);
  return { text, read, of: done.length, problems };
}

async function main() {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  if (!args[0] || args[0].startsWith("--")) { console.error("usage: node tools/vhp-ruler-race-check.mjs <race-data folder> [--week 4] [--vhp-data <folder>] [--since <ISO>] [--gh owner/repo] [--now <ISO>]"); process.exit(2); }
  const week = Number(opt("--week", 4)), now = opt("--now") ? Date.parse(opt("--now")) : Date.now();
  let L = null;
  if (opt("--vhp-data")) { const { loadVhpData } = await import("../sims/ruler/v21.mjs"); L = R.ledger(loadVhpData(opt("--vhp-data")).tl); }
  const files = loadWeek(args[0], week).map(({ name, file }) => ({ name, ...checkRulerFile(file, { week, L, now }) }));
  if (!files.length) { console.log(`PROBLEMS: 1\n  ✗ no R${String(week).padStart(3, "0")}*.json in ${args[0]}`); process.exit(1); }
  let runs = null, logs = null;
  const repo = opt("--gh");
  if (repo) {
    const since = Date.parse(opt("--since", "2026-11-16T00:00:00Z"));
    const get = (p) => JSON.parse(gh(p));
    const listed = listRuns(get, repo, since);
    runs = checkRuns(listed.runs, since);
    runs.problems.push(...listed.problems);
    const got = readLogs(get, gh, repo, listed.runs);
    logs = { ...scanLogs(got.text), read: got.read, of: got.of };
    logs.problems.push(...got.problems);
  }
  const r = report({ files, runs, logs });
  console.log(r.text);
  process.exit(r.problems ? 1 : 0);
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main();
