// Knode Games Cloudflare Worker "kg-dispatch": a backstop for GitHub's own timer (Block X incident, Sat 14 Nov 2026).
// GitHub doesn't guarantee scheduled runs: under load it delays or drops them, and on Fri 13 / Sat 14 Nov it dropped
// most of race.yml's hourly runs, so the current race had no card and the Block X page had no producers.
// Source of truth: this file. To change the live Worker: Cloudflare -> Compute (Workers) -> kg-dispatch -> Edit code ->
// paste this whole file -> Deploy. Owner steps: docs/ops/RECORDER-BACKSTOP.md. Tests: tests/audit/dispatch-worker.test.mjs.
//
// What it does, and only this: on its two Cron Triggers it asks GitHub whether the recorder already ran this hour, and
// if not, starts it once (workflow_dispatch on main), like the owner pressing "Run workflow" by hand.
//   - :41 every hour -> race.yml   (GitHub's own timer is :37; the card must be taken before each leg at :00)
//   - :51 every hour -> games.yml  (GitHub's own timer is :47; after the race recorder)
// "Already ran": a run of that workflow on main created in the last 30 minutes (queued, running or finished), from
// GitHub's timer, a manual run or this Worker. The GitHub timers stay on as they are; the workflows' concurrency groups
// (knode-race, knode-games) mean two runs never overlap. It never changes a file, a setting or a workflow.
// The only secret is GH_DISPATCH_TOKEN, a Worker secret (a fine-grained GitHub token for this one repository with
// "Actions: Read and write" and nothing else). It is never in this file, never logged, never sent anywhere but GitHub.
const REPO = "bawcejawn/KnodeGames";
export const JOBS = {
  "41 * * * *": { workflow: "race.yml", windowMin: 30 },
  "51 * * * *": { workflow: "games.yml", windowMin: 30 },
};
const API = "https://api.github.com/repos/" + REPO + "/actions/workflows/";

/** One Cron Trigger: returns what it did ({ workflow, dispatched, why }); throws on a GitHub error (Cloudflare logs it). */
export async function runJob(cron, env, f = fetch, now = Date.now()) {
  const job = JOBS[cron];
  if (!job) return { workflow: null, dispatched: false, why: `no job for cron "${cron}"` };
  const token = env && env.GH_DISPATCH_TOKEN;
  if (typeof token !== "string" || token.length < 20) throw new Error("GH_DISPATCH_TOKEN isn't set (a Worker secret)");
  const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "kg-dispatch" };
  const since = new Date(now - job.windowMin * 60000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const list = await f(API + job.workflow + "/runs?branch=main&per_page=5&created=" + encodeURIComponent(">=" + since), { headers });
  if (!list.ok) throw new Error(`${job.workflow}: GitHub answered ${list.status} listing runs`);
  const j = await list.json();
  const n = Number(j && j.total_count);
  if (!Number.isFinite(n)) throw new Error(`${job.workflow}: GitHub's run list had no total_count`);
  if (n > 0) return { workflow: job.workflow, dispatched: false, why: `already ran this hour (${n} run(s) since ${since})` };
  const d = await f(API + job.workflow + "/dispatches", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ ref: "main" }) });
  if (d.status !== 204) throw new Error(`${job.workflow}: GitHub answered ${d.status} to the dispatch`);
  return { workflow: job.workflow, dispatched: true, why: `no run since ${since}: started one` };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runJob(event.cron, env).then((r) => console.log(`kg-dispatch: ${r.workflow}: ${r.why}`)));
  },
  // No web endpoint: nobody can start a run through this Worker's address.
  async fetch() { return new Response("not found", { status: 404, headers: { "Cache-Control": "no-store" } }); },
};
