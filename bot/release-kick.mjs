/**
 * DAILY QUESTION RELEASE — backup starter, runs on your PC every 5 minutes, all day (Windows Task Scheduler; set up with
 * node\install-release-kick.ps1). Around each round's release, Monday to Saturday, it makes sure the round comes out. Rounds open
 * at 12:00 UTC, and from the week of Mon 9 Nov also at 00:00 UTC (D-092; the same SCHEDULE as bot/bot.ts, a test
 * checks they agree). For each round (12:00 shown):
 *
 *   11:50-11:58 UTC   starts the bot on GitHub ("Kpred bot", Run workflow) unless one is already running. The bot
 *                     waits for 12:00 UTC on its own and posts the round's questions on the dot. GitHub also starts
 *                     this run itself at 11:48 (and 23:48), but GitHub often starts scheduled runs late (38 minutes on
 *                     2026-10-28).
 *   12:06-14:00 UTC   checks that the round's question file is on GitHub. If not, and no bot run is going, it starts
 *                     one (at most every 12 minutes). If they are still not out at 12:20, it emails you, once a round.
 *
 * HEARTBEAT (owner, 9 Nov; after GitHub stopped firing every schedule for three days): at any hour, every 15 minutes it
 * checks when the bot last ran. If no "Kpred bot" run has started for 120 minutes and none is going, it starts one.
 * Limits, so it can never hammer GitHub:
 *   - at most HEARTBEAT_PER_DAY (6) heartbeat starts, and MAX_DISPATCH_PER_DAY (12) starts in all, per UTC day;
 *   - after a GitHub error (refused, 403 suspended, 5xx, network) it backs off: 15, 30, 60, 120 minutes, then every 4
 *     hours, before it calls GitHub again; the first success resets it;
 *   - it emails you once when it had to start a missed bot run (the email itself goes through GitHub, so while the whole
 *     account is suspended it can only write the log: node\release-kick.log).
 *
 * It needs GITHUB_ALERT_TOKEN in .env (the same token as the self-heal emails: Actions read and write on the repo).
 * The token can only start the repository's own workflows on main; it can't read secrets or change any file.
 *
 * Run by hand:   node bot\release-kick.mjs --dry-run   (shows what it would do now; starts nothing, emails nothing)
 *                node bot\release-kick.mjs --at 2026-10-29T11:52:00Z --dry-run   (as if it were that time)
 * Log: node\release-kick.log    State between runs: node\release-kick-state.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "node");
const LOG = path.join(DIR, "release-kick.log");
const STATE = path.join(DIR, "release-kick-state.json");
const DRY = process.argv.includes("--dry-run");
const AT = (() => { const i = process.argv.indexOf("--at"); return i > 0 ? Date.parse(process.argv[i + 1]) : NaN; })();

const API = process.env.HEAL_GITHUB_API || "https://api.github.com";
const REPO = process.env.HEAL_REPO || "bawcejawn/KnodeGames";
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
// Offsets from each round's release time.
const EARLY_FROM = -10 * MIN, EARLY_TO = -2 * MIN;
const CHECK_FROM = 6 * MIN, CHECK_TO = 2 * HOUR;
const ALERT_AFTER = 20 * MIN;
// Question rounds by week (week 0 = genesis week): must match SCHEDULE in bot/bot.ts (tests/audit/release-rounds.test.ts).
// Entries with minCap (more questions once the chain allows them) open at the same hours, so this task, which only
// needs the release times, skips them.
export const SCHEDULE = [
  { fromWeek: 0, rounds: [{ open: 12, count: 5 }] },
  { fromWeek: 3, rounds: [{ open: 0, count: 2 }, { open: 12, count: 3 }] },
  { fromWeek: 3, minCap: 48, rounds: [{ open: 0, count: 4 }, { open: 12, count: 4 }] },
];
const roundsOfWeek = (w) => { let r = SCHEDULE[0].rounds; for (const x of SCHEDULE) if (w >= x.fromWeek && !x.minCap) r = x.rounds; return r; };
/** Every round release (label, ms) of UTC day `d` since genesis `g`; none on Sundays. */
export function releasesOfDay(g, d) {
  if (d < 0 || d % 7 >= 6) return [];
  const w = Math.floor(d / 7), dd = d % 7;
  return roundsOfWeek(w).map((r) => ({ label: `W${String(w).padStart(3, "0")}-D${dd + 1}${r.open === 12 ? "" : "-" + String(r.open).padStart(2, "0")}`, at: g + d * DAY + r.open * HOUR, hour: r.open }));
}
/** The round whose release window (10 minutes before to 2 hours after) contains `now`, if any. */
export function roundNear(g, now) {
  const d = Math.floor((now - g) / DAY);
  return [d - 1, d, d + 1].flatMap((x) => releasesOfDay(g, x)).find((r) => now - r.at >= EARLY_FROM && now - r.at < CHECK_TO) || null;
}
const REKICK_MS = 12 * MIN;
// Heartbeat and limits (see the top of this file).
export const HEARTBEAT_EVERY = 15 * MIN, HEARTBEAT_STALE = 120 * MIN, HEARTBEAT_PER_DAY = 6, MAX_DISPATCH_PER_DAY = 12;
export const BACKOFF = [15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 4 * HOUR];
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);
/** Counts a start in the day's tally; false when today's cap (all starts, or heartbeat starts) is used up. */
export function mayDispatch(st, now, heartbeat) {
  const d = utcDay(now);
  if (st.day !== d) { st.day = d; st.dispatches = 0; st.heartbeats = 0; }
  if ((st.dispatches || 0) >= MAX_DISPATCH_PER_DAY) return false;
  if (heartbeat && (st.heartbeats || 0) >= HEARTBEAT_PER_DAY) return false;
  return true;
}
export function countDispatch(st, now, heartbeat) {
  mayDispatch(st, now, heartbeat);
  st.dispatches = (st.dispatches || 0) + 1;
  if (heartbeat) st.heartbeats = (st.heartbeats || 0) + 1;
}
/** After a GitHub error: wait longer each time before calling GitHub again. */
export function backOff(st, now) {
  st.errors = (st.errors || 0) + 1;
  st.backoffUntil = now + BACKOFF[Math.min(st.errors - 1, BACKOFF.length - 1)];
}
export const inBackoff = (st, now) => (st.backoffUntil || 0) > now;
export const clearBackoff = (st) => { st.errors = 0; st.backoffUntil = 0; };

function loadEnv() {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const stamp = (t = Date.now()) => new Date(t).toISOString().replace("T", " ").slice(0, 19) + " UTC";
function log(msg) {
  const line = `${stamp()}  ${DRY ? "(dry run) " : ""}${msg}`;
  console.log(line);
  if (DRY) return;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(LOG, line + "\n");
    const lines = fs.readFileSync(LOG, "utf8").split("\n");
    if (lines.length > 3000) fs.writeFileSync(LOG, lines.slice(-2000).join("\n"));
  } catch {}
}
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } };
const writeState = (s) => { if (!DRY) fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); };

function genesis() {
  try { return Number(JSON.parse(fs.readFileSync(path.join(ROOT, "game-data", "deployment.json"), "utf8")).genesisTime) || 1792368000000; }
  catch { return 1792368000000; } // 2026-10-19 00:00 UTC (a Monday)
}

async function gh(method, url, body, auth = true) {
  const r = await fetch(`${API}${url}`, {
    method,
    headers: { ...(auth ? { authorization: `Bearer ${process.env.GITHUB_ALERT_TOKEN}` } : {}), accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000), // a hung call must fail (and back off), not stall the task until it is killed
  });
  return r;
}

class GitHubError extends Error {}
/** The latest "Kpred bot" runs (newest first). */
async function botRuns() {
  let r;
  try { r = await gh("GET", `/repos/${REPO}/actions/workflows/bot.yml/runs?per_page=10`); }
  catch (e) { throw new GitHubError(`GitHub couldn't be reached listing bot runs (${e.message})`); }
  if (!r.ok) throw new GitHubError(`GitHub said ${r.status} listing bot runs`);
  return (await r.json()).workflow_runs || [];
}
/** Is a "Kpred bot" run queued or running right now? (Started after `since`, so a stale run doesn't count.) */
async function botRunGoing(since) {
  return (await botRuns()).find((x) => x.status !== "completed" && Date.parse(x.created_at) >= since - 3 * HOUR) || null;
}
/** What the heartbeat should do, from the bot's recent runs (pure, for the tests). */
export function heartbeatDecision(runs, now) {
  if (runs.some((x) => x.status !== "completed" && Date.parse(x.created_at) >= now - 3 * HOUR)) return { start: false, why: "a bot run is going" };
  const last = Math.max(0, ...runs.map((x) => Date.parse(x.created_at)).filter(Number.isFinite));
  if (now - last < HEARTBEAT_STALE) return { start: false, why: "the bot ran recently" };
  return { start: true, why: last ? `no bot run has started since ${stamp(last)}` : "no bot run found" };
}

/** Today's question file on main: null (not there), or { n: number of questions, skipped }. */
async function todaysFile(label) {
  // Read without the token: the repository is public, and the token only has Actions permission.
  const r = await gh("GET", `/repos/${REPO}/contents/game-data/questions/${label}.json?ref=main`, null, false);
  if (r.status === 404) return null;
  if (!r.ok) throw new GitHubError(`GitHub said ${r.status} reading ${label}.json`);
  const j = await r.json();
  const d = JSON.parse(Buffer.from(j.content || "", "base64").toString("utf8") || "{}");
  return { n: (d.questions || []).length, skipped: d.skipped || "" };
}

async function startBot(why, st, now, heartbeat = false) {
  if (!mayDispatch(st, now, heartbeat)) { log(`not starting the bot (${why}): today's limit of ${heartbeat ? `${HEARTBEAT_PER_DAY} heartbeat` : MAX_DISPATCH_PER_DAY} starts is used up`); return false; }
  if (DRY) { log(`would start the bot on GitHub: ${why}`); return true; }
  let r;
  try { r = await gh("POST", `/repos/${REPO}/actions/workflows/bot.yml/dispatches`, { ref: "main" }); }
  catch (e) { throw new GitHubError(`GitHub couldn't be reached starting the bot (${e.message})`); }
  if (r.status === 204) { countDispatch(st, now, heartbeat); log(`started the bot on GitHub: ${why}`); return true; }
  log(`GitHub refused to start the bot (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}. Check GITHUB_ALERT_TOKEN.`);
  throw new GitHubError(`GitHub said ${r.status} starting the bot`);
}

async function alert(detail) {
  if (DRY) { log(`would email: ${detail}`); return; }
  let r;
  try { r = await gh("POST", `/repos/${REPO}/actions/workflows/heal-alert.yml/dispatches`, { ref: "main", inputs: { node: "daily questions", detail: detail.slice(0, 900) } }); }
  catch (e) { log(`couldn't email (${e.message})`); return; }
  log(r.status === 204 ? `emailed you: ${detail}` : `couldn't email (HTTP ${r.status})`);
}

/** The heartbeat (every HEARTBEAT_EVERY, any hour): start the bot if it hasn't run for HEARTBEAT_STALE. */
async function heartbeat(st, now) {
  if (now - (st.hbChecked || 0) < HEARTBEAT_EVERY) return;
  st.hbChecked = now;
  const d = heartbeatDecision(await botRuns(), now);
  if (!d.start) { if (st.hbMissed) { log(`heartbeat: the bot is running again`); st.hbMissed = false; } return; }
  log(`heartbeat: ${d.why}`);
  if (await startBot(`heartbeat: ${d.why}`, st, now, true) && !st.hbMissed) {
    st.hbMissed = true;
    await alert(`The Kpred bot hadn't run since ${d.why.replace(/^no bot run has started since /, "")}, so the PC started it. If GitHub's schedules stopped, re-enable them: Actions, each scheduled workflow, Disable then Enable.`);
  }
}

async function main() {
  loadEnv();
  const now = Number.isFinite(AT) ? AT : Date.now();
  const g = genesis();
  if (now < g) return;
  if (!process.env.GITHUB_ALERT_TOKEN) { const r0 = roundNear(g, now); if (r0) log("No GITHUB_ALERT_TOKEN in .env, so the bot can't be started from here."); return; }
  const st = readState();
  if (inBackoff(st, now)) return;                    // after a GitHub error: wait (logged when it started)
  try {
    await releaseCheck(st, now, g);
    await heartbeat(st, now);
    clearBackoff(st);
  } catch (e) {
    if (!(e instanceof GitHubError)) throw e;
    backOff(st, now);
    log(`${e.message}: not calling GitHub again before ${stamp(st.backoffUntil)} (back-off ${Math.round((st.backoffUntil - now) / MIN)} min)`);
  } finally { writeState(st); }
}

/** The release checks around each round (see the top of this file). */
async function releaseCheck(st, now, g) {
  const r = roundNear(g, now);
  if (!r) return;                                    // not near a release: nothing to do (and nothing logged)
  const t = now - r.at, hh = `${String(r.hour).padStart(2, "0")}:00 UTC`;
  const inEarly = t >= EARLY_FROM && t < EARLY_TO, inCheck = t >= CHECK_FROM && t < CHECK_TO;
  if (!inEarly && !inCheck) return;
  const label = r.label;
  if (st.round !== label) { st.round = label; st.early = 0; st.lastKick = 0; st.alerted = false; st.done = false; }
  if (st.done) return;
  if (inEarly) {
    if (st.early) return;
    const going = await botRunGoing(now);
    if (going) log(`${label}: a bot run is already ${going.status} (started ${going.created_at}); it will post at ${hh}`);
    else if (await startBot(`${label} release (the bot waits for ${hh})`, st, now)) st.lastKick = now;
    else return; // over today's limit: try again in 5 minutes
    st.early = now;
    return;
  }
  // After the release: are the round's questions out?
  const f = await todaysFile(label);
  if (f && f.n > 0) { log(`${label}: ${f.n} questions are out`); st.done = true; return; }
  if (f && f.skipped) {
    log(`${label}: the bot skipped today (${f.skipped})`);
    if (!st.alerted) { await alert(`${label}: the bot skipped today's questions ("${f.skipped}"). Please check the Kpred bot runs on GitHub.`); st.alerted = true; }
    st.done = true;
    return;
  }
  const going = await botRunGoing(now);
  if (going) log(`${label}: not out yet; a bot run is ${going.status} (started ${going.created_at})`);
  else if (now - (st.lastKick || 0) >= REKICK_MS) { if (await startBot(`${label} questions are not out yet`, st, now)) st.lastKick = now; }
  else log(`${label}: not out yet; started the bot ${Math.round((now - st.lastKick) / MIN)} min ago, waiting for it`);
  if (t >= ALERT_AFTER && !st.alerted) {
    await alert(`${label}: today's questions are not out yet at ${stamp(now)} (they're due at ${hh}). ${going ? `A bot run is ${going.status}.` : "No bot run is going; one was started."} Check the Kpred bot runs on GitHub.`);
    st.alerted = true;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { log(`release check failed: ${e.message}`); process.exitCode = 1; });
