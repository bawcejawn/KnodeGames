// The Cloudflare Worker "kg-dispatch" (tools/cloudflare/kg-dispatch-worker.js): a backstop for GitHub's timer. It starts
// race.yml at :41 and games.yml at :51 only when no run of that workflow on main was created in the last 30 minutes.
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
    if (url.includes("/runs?")) return new Response(JSON.stringify({ total_count: total, workflow_runs: [] }), { status: listStatus });
    return new Response(null, { status: dispatchStatus });
  };
  return { f, calls };
}

test("kg-dispatch: no run this hour -> starts the workflow once on main", async () => {
  const { f, calls } = gh(0);
  const r = await M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW);
  assert.deepEqual([r.workflow, r.dispatched], ["race.yml", true]);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/api\.github\.com\/repos\/bawcejawn\/KnodeGames\/actions\/workflows\/race\.yml\/runs\?branch=main&per_page=5&created=%3E%3D2026-11-14T14%3A11%3A00Z$/);
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].url, "https://api.github.com/repos/bawcejawn/KnodeGames/actions/workflows/race.yml/dispatches");
  assert.deepEqual(JSON.parse(calls[1].body), { ref: "main" });
  assert.equal(calls[1].headers.Authorization, "Bearer " + TOKEN);
});

test("kg-dispatch: a run this hour (GitHub's timer, by hand, or ours) -> nothing started", async () => {
  const { f, calls } = gh(1);
  const r = await M.runJob("51 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW);
  assert.deepEqual([r.workflow, r.dispatched], ["games.yml", false]);
  assert.equal(calls.length, 1, "only the list, no dispatch");
});

test("kg-dispatch: only its two jobs; no token, a GitHub error or a bad answer stops without dispatching", async () => {
  const { f, calls } = gh(0);
  assert.equal((await M.runJob("0 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, f, NOW)).dispatched, false);
  assert.equal(calls.length, 0);
  await assert.rejects(M.runJob("41 * * * *", {}, f, NOW), /GH_DISPATCH_TOKEN/);
  await assert.rejects(M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, gh(0, { listStatus: 401 }).f, NOW), /401 listing/);
  const bad = async () => new Response("{}", { status: 200 });
  await assert.rejects(M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, bad, NOW), /total_count/);
  await assert.rejects(M.runJob("41 * * * *", { GH_DISPATCH_TOKEN: TOKEN }, gh(0, { dispatchStatus: 403 }).f, NOW), /403 to the dispatch/);
  assert.deepEqual(Object.keys(M.JOBS), ["41 * * * *", "51 * * * *"]);
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
  for (const [f, g] of [["race.yml", "knode-race"], ["games.yml", "knode-games"]]) {
    const y = fs.readFileSync(path.resolve(".github/workflows", f), "utf8");
    assert.match(y, /workflow_dispatch:/, f);
    assert.match(y, new RegExp(`concurrency:\\s*\\n\\s*group: ${g}\\s*\\n\\s*cancel-in-progress: false`), f);
  }
});
