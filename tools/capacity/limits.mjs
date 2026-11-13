#!/usr/bin/env node
/**
 * Capacity limits report (Capacity chat, Nov 2026). READ-ONLY.
 * Shows every file-size and schedule limit as a percentage, green / amber / red, so the owner sees a wall weeks
 * before it is hit. Reads only the git copies of the published data branches and the workflow files; touches no
 * chain, no wallet, no key, no GitHub API.
 *
 *   node tools/capacity/limits.mjs              the table (fetch the data branches first; README below)
 *   node tools/capacity/limits.mjs --ci         the same, and exit 1 when anything is at 60% or more, so the daily
 *                                               workflow (.github/workflows/capacity.yml) fails and GitHub emails the owner
 *   node tools/capacity/limits.mjs --json       machine-readable
 *
 * Colours: green under 60%, amber 60% to under 85%, red 85% and up. Limits: every published file 2 MB (the publish
 * jobs' cap), the Daily Questions week file 1.9 MB (its recorder's cap), VHP ruler day files 16 MiB (its own cap),
 * scheduled workflow runs 400 a day (Capacity target ~300; the free plan allows 20 jobs at once).
 * Not covered here (read them with their own commands): the sponsor's daily Mana (`npm run sponsor -- status`) and the
 * Cloudflare Worker's requests (Cloudflare dashboard -> Workers -> kg-data -> Metrics; free limit 100,000 a day).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const CI = args.includes("--ci"), JSON_OUT = args.includes("--json");
const MB = 1024 * 1024;
const BRANCHES = ["games-data", "race-data", "blocks-data", "names-data", "stats-data", "vhp-data"];
const AMBER = 60, RED = 85;
export const SCHED_LIMIT = 400;
// The schedule count is shown every day but doesn't fail the daily run (email) until the planned cut to ~300 a day
// lands (Race samples every 15 min, testnet job off when idle; Race and Architecture chats, by Mon 23 Nov). Then set
// this to true so schedules alert at 60% like every other limit.
export const ALERT_SCHEDULES = false;

const git = (a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * MB });
const hasRef = (r) => { try { git(["rev-parse", "--verify", "--quiet", r]); return true; } catch { return false; } };
export const colour = (pct) => (pct >= RED ? "red" : pct >= AMBER ? "amber" : "green");

/** The cap that applies to a published file. */
export function capOf(branch, file) {
  if (branch === "vhp-data") return { cap: 16 * MB, why: "VHP ruler file cap 16 MiB" };
  if (branch === "games-data" && /^questions\/W\d+\.json$/.test(file)) return { cap: 1_900_000, why: "Questions recorder cap 1.9 MB" };
  return { cap: 2 * MB, why: "publish cap 2 MB" };
}

/** Scheduled runs a day for one workflow, from its cron lines ("m h dom mon dow"; steps, lists, ranges). */
export function runsPerDay(yaml) {
  let total = 0;
  for (const m of yaml.matchAll(/-\s*cron:\s*["']([^"']+)["']/g)) {
    const [mi, h] = m[1].trim().split(/\s+/);
    total += count(mi, 60) * count(h, 24);
  }
  return total;
}
function count(field, n) {
  if (field === "*") return n;
  let c = 0;
  for (const part of field.split(",")) {
    const step = part.match(/^\*\/(\d+)$/);
    if (step) { c += Math.ceil(n / Number(step[1])); continue; }
    const rng = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rng) { const s = Number(rng[3] || 1); c += Math.floor((Number(rng[2]) - Number(rng[1])) / s) + 1; continue; }
    c += 1;
  }
  return c;
}

export function collect() {
  const rows = [];
  for (const b of BRANCHES) {
    const ref = `origin/${b}`;
    if (!hasRef(ref)) { rows.push({ group: b, name: `${b} (not fetched)`, value: 0, limit: 1, pct: 0, status: "unknown", note: `run: git fetch origin ${b}:refs/remotes/origin/${b}` }); continue; }
    const files = git(["ls-tree", "-r", "-l", ref]).split("\n").filter(Boolean).map((l) => { const m = l.match(/^\S+ blob \S+\s+(\d+)\t(.+)$/); return m ? { bytes: Number(m[1]), file: m[2] } : null; }).filter((x) => x && x.file.endsWith(".json"));
    // The biggest file of each folder (and of each kind of file in it) is what hits a wall first.
    const worst = new Map();
    for (const f of files) {
      const { cap, why } = capOf(b, f.file);
      const pct = (100 * f.bytes) / cap;
      const kind = `${b}/${path.posix.dirname(f.file) === "." ? "" : path.posix.dirname(f.file) + "/"}${path.posix.basename(f.file).replace(/\d+/g, "#")}`;
      const cur = worst.get(kind);
      if (!cur || pct > cur.pct) worst.set(kind, { group: b, name: `${b}/${f.file}`, kind, value: f.bytes, limit: cap, pct, status: colour(pct), note: why });
    }
    rows.push(...[...worst.values()].sort((x, y) => y.pct - x.pct));
  }
  const wf = path.join(ROOT, ".github/workflows");
  let runs = 0; const per = [];
  for (const f of fs.readdirSync(wf).filter((x) => /\.ya?ml$/.test(x))) { const n = runsPerDay(fs.readFileSync(path.join(wf, f), "utf8")); if (n) { runs += n; per.push(`${f.replace(/\.ya?ml$/, "")} ${n}`); } }
  const pct = (100 * runs) / SCHED_LIMIT;
  rows.push({ group: "github", name: "scheduled workflow runs a day", kind: "schedules", value: runs, limit: SCHED_LIMIT, pct, status: colour(pct), note: per.sort((a, b) => Number(b.split(" ").pop()) - Number(a.split(" ").pop())).slice(0, 4).join(", ") });
  return rows;
}

const fmt = (r) => (r.kind === "schedules" ? `${r.value} / ${r.limit}` : `${(r.value / MB).toFixed(2)} / ${(r.limit / MB).toFixed(2)} MB`);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rows = collect();
  const flagged = rows.filter((r) => (r.status === "amber" || r.status === "red") && (ALERT_SCHEDULES || r.kind !== "schedules"));
  if (JSON_OUT) console.log(JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
  else {
    const mark = { green: "GREEN", amber: "AMBER", red: "RED  ", unknown: "?    " };
    console.log(`Knode Games capacity limits, ${new Date().toISOString()} (read-only)`);
    for (const r of rows.slice().sort((a, b) => b.pct - a.pct).slice(0, 40)) console.log(`  ${mark[r.status]} ${String(Math.round(r.pct)).padStart(3)}%  ${fmt(r).padEnd(20)} ${r.name}${r.note ? `  (${r.note})` : ""}`);
    console.log(flagged.length ? `\n${flagged.length} limit(s) at 60% or more: see docs/capacity/RUNBOOK.md for what to do.` : "\nEverything under 60%.");
    console.log("Also check daily: npm run sponsor -- status (sponsor Mana) and Cloudflare -> Workers -> kg-data -> Metrics (requests, free 100,000 a day).");
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = ["| Status | % | Used / limit | What |", "|---|---|---|---|", ...rows.slice().sort((a, b) => b.pct - a.pct).slice(0, 40).map((r) => `| ${r.status} | ${Math.round(r.pct)}% | ${fmt(r)} | ${r.name} |`)];
    try { fs.appendFileSync(summary, `## Capacity limits\n\n${lines.join("\n")}\n`); } catch { /* summary is optional */ }
  }
  if (CI && flagged.length) { console.error(`::error::${flagged.length} capacity limit(s) at 60% or more: ${flagged.map((r) => `${r.name} ${Math.round(r.pct)}%`).join("; ")}`); process.exit(1); }
}
