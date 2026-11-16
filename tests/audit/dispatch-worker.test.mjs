// The Cloudflare Worker "kg-dispatch" (tools/cloudflare/kg-dispatch-worker.js): a backstop for GitHub's timer. It starts
// vhp-ruler.yml at :22, race.yml at :41, games.yml at :51, and race-samples.yml and kit-games.yml at :07 and :37, only
// when no run of that workflow on main was created in its window (30 minutes; 45 for kit-games.yml).
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const M = await import(pathToFileURL(path.resolve("tools/cloudflare/kg-dispatch-worker.js")).href);
const TOKEN = "github_pat_" + "x".repeat(40);
const NOW = Date.UTC(2026, 10, 14, 14, 41, 0);
function gh(total, { listStatus = 200, dispatchStatus = 204 } = {}) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers, body: init.body });
    const n = typeof total === "function" ? total(url) : total;
    if (url.includes("/runs?")) return new Response(JSON.stringify({ total_count: n, workflow_runs: [] }), { status: listStatus });
    return new Response(null, { status: dispatchStatus });
  };
  return { f, calls };
}

test("kg-dispatch: no run this hour -> starts the workflow once on main", async () => {
  const { f, calls } = gh(0);
  const [r] = await M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW);
  assert.deepEqual([r.workflow, r.dispatched], ["race.yml", true]);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/api\.github\.com\/repos\/bawcejawn\/KnodeGames\/actions\/workflows\/race\.yml\/runs\?branch=main&per_page=5&created=%3E%3D2026-11-14T14%3A11%3A00Z$/);
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].url, "https://api.github.com/repos/bawcejawn/KnodeGames/actions/workflows/race.yml/dispatches");
  assert.deepEqual(JSON.parse(calls[1].body), { ref: "main" });
  assert.equal(calls[1].headers.Authorization, "Bearer " + TOKEN);
});

test("kg-dispatch: :22 starts vhp-ruler.yml when it hasn't run (the Ruler chat, 14 Nov)", async () => {
  const { f, calls } = gh(0);
  const [r] = await M.runJob("22 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW);
  assert.deepEqual([r.workflow, r.dispatched], ["vhp-ruler.yml", true]);
  assert.equal(calls[1].url, "https://api.github.com/repos/bawcejawn/KnodeGames/actions/workflows/vhp-ruler.yml/dispatches");
});

test("kg-dispatch: :07 and :37 start race-samples.yml when it hasn't run in 30 minutes (Block X chat, 15 Nov)", async () => {
  const { f, calls } = gh((u) => (u.includes("race-samples") ? 0 : 1));
  const [r, k] = await M.runJob("7,37 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, Date.UTC(2026, 10, 15, 14, 37, 0));
  assert.deepEqual([r.workflow, r.dispatched], ["race-samples.yml", true]);
  assert.deepEqual([k.workflow, k.dispatched], ["kit-games.yml", false]);
  assert.match(calls[0].url, /workflows\/race-samples\.yml\/runs\?branch=main&per_page=5&created=%3E%3D2026-11-15T14%3A07%3A00Z$/);
  assert.equal(calls[1].url, "https://api.github.com/repos/bawcejawn/KnodeGames/actions/workflows/race-samples.yml/dispatches");
  const busy = gh(1);
  const out = await M.runJob("7,37 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, busy.f, NOW);
  assert.deepEqual(out.map((x) => x.dispatched), [false, false]);
  assert.equal(busy.calls.length, 2, "both ran recently: two lists, nothing started");
});

test("kg-dispatch: :07 and :37 start kit-games.yml (Fantasy) only when it hasn't run in 45 minutes (Repo Lens #J-8 J8-1)", async () => {
  // :07 after a dropped :57 run: the window reaches back to :22, after the last normal :57 run, so it starts one.
  const { f, calls } = gh((u) => (u.includes("kit-games") ? 0 : 1));
  const [, k] = await M.runJob("7,37 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, Date.UTC(2026, 10, 16, 19, 7, 0));
  assert.deepEqual([k.workflow, k.dispatched], ["kit-games.yml", true]);
  assert.match(calls[1].url, /workflows\/kit-games\.yml\/runs\?branch=main&per_page=5&created=%3E%3D2026-11-16T18%3A22%3A00Z$/);
  assert.equal(calls[2].url, "https://api.github.com/repos/bawcejawn/KnodeGames/actions/workflows/kit-games.yml/dispatches");
  assert.deepEqual(JSON.parse(calls[2].body), { ref: "main" });
  // The window is 45 minutes: a normal :57 run is 10 minutes before :07 and 40 before :37, so neither check starts another.
  const kit = M.JOBS["7,37 * * * *"].find((j) => j.workflow === "kit-games.yml");
  assert.equal(kit.windowMin, 45);
  assert.ok(40 < kit.windowMin && kit.windowMin < 70, "covers :57 from :37, and not the :57 before it from :07");
});

test("kg-dispatch: an error on one job still runs the other, then the run fails (logged)", async () => {
  const lines = [];
  const f = async (url, init = {}) => {
    if (url.includes("race-samples")) return new Response("", { status: 502 });
    if (url.includes("/runs?")) return new Response(JSON.stringify({ total_count: 0 }), { status: 200 });
    return new Response(null, { status: 204 });
  };
  await assert.rejects(M.runJob("7,37 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW, (l) => lines.push(l)), /race-samples\.yml: GitHub answered 502 listing/);
  assert.deepEqual(lines, ["kg-dispatch: race-samples.yml: ERROR race-samples.yml: GitHub answered 502 listing runs", `kg-dispatch: kit-games.yml: no run since 2026-11-14T13:56:00Z: started one`]);
});

test("kg-dispatch: a run this hour (GitHub's timer, by hand, or ours) -> nothing started", async () => {
  const { f, calls } = gh(1);
  const [r] = await M.runJob("51 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW);
  assert.deepEqual([r.workflow, r.dispatched], ["games.yml", false]);
  assert.match(r.why, /^already ran in the last 30 minutes/, "the log says the real window (J5-3)");
  assert.equal(calls.length, 1, "only the list, no dispatch");
});

test("kg-dispatch: only its jobs; an unknown trigger, no token, a GitHub error or a bad answer stops without dispatching", async () => {
  const { f, calls } = gh(0);
  await assert.rejects(M.runJob("0 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW), /no job for cron "0 \* \* \* \*"/, "a mistyped trigger is an error, not a quiet no-op (J5-1)");
  await assert.rejects(M.runJob("37,7 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW), /no job for cron/);
  assert.equal(calls.length, 0);
  await assert.rejects(M.runJob("41 * * * *", {}, f, NOW), /GH_DISPATCH_TOKEN/);
  await assert.rejects(M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, gh(0, { listStatus: 401 }).f, NOW), /401 listing/);
  const bad = async () => new Response("{}", { status: 200 });
  await assert.rejects(M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, bad, NOW), /total_count/);
  await assert.rejects(M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, gh(0, { dispatchStatus: 403 }).f, NOW), /403 to the dispatch/);
  assert.deepEqual(Object.keys(M.JOBS), ["22 * * * *", "41 * * * *", "51 * * * *", "7,37 * * * *"], "four triggers: the account's 5th stays free (J5-2)");
  assert.deepEqual(Object.values(M.JOBS).flat().map((j) => j.workflow), ["vhp-ruler.yml", "race.yml", "games.yml", "race-samples.yml", "kit-games.yml"]);
});

test("kg-dispatch: no web endpoint, and the token is never in the file", async () => {
  const r = await M.default.fetch(new Request("https://kg-dispatch.example/run"));
  assert.equal(r.status, 404);
  const fs = await import("node:fs");
  const src = fs.readFileSync(path.resolve("tools/cloudflare/kg-dispatch-worker.js"), "utf8");
  assert.ok(!/github_pat_|ghp_[A-Za-z0-9]{20}/.test(src));
});

test("kg-dispatch: the workflows it starts can be started by hand and never overlap (workflow_dispatch + concurrency)", async () => {
  const fs = await import("node:fs");
  for (const [f, g] of [["vhp-ruler.yml", "knode-vhp-ruler"], ["race.yml", "knode-race"], ["games.yml", "knode-games"], ["kit-games.yml", "knode-games"], ["race-samples.yml", "knode-race-samples"]]) {
    const y = fs.readFileSync(path.resolve(".github/workflows", f), "utf8");
    assert.match(y, /workflow_dispatch:/, f);
    assert.match(y, new RegExp(`concurrency:\\s*\\n\\s*group: ${g}\\s*\\n\\s*cancel-in-progress: false`), f);
  }
});
