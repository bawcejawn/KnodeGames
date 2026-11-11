// Self-heal Docker reset (bot/heal.mjs): when Docker Desktop is open but its engine doesn't answer at two checks in a
// row (the 10 Nov 2026 WSL-update outage), the heal quits Docker Desktop, runs wsl --shutdown, starts it again and then
// starts the nodes. Runs the real heal.mjs against a fake docker (answers only once Docker Desktop was "started"), fake
// Windows commands (they record their calls), fake nodes and a fake GitHub.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HEAL = path.join(ROOT, "bot", "heal.mjs");
const NET = 1_000_000;

async function world({ desktopOpen = true, dockerDown = 0, dockerWorksAfterStart = true, state = {}, env = {}, pause = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "healdr-"));
  const healDir = path.join(tmp, "state"), sysDir = path.join(tmp, "sys");
  fs.mkdirSync(healDir); fs.mkdirSync(sysDir);
  const calls = path.join(tmp, "calls.log"), started = path.join(tmp, "started");
  fs.writeFileSync(calls, "");
  const nodes = ["desk", "game", "personal"].map((k) => {
    const dir = path.join(tmp, k, "koinos");
    fs.mkdirSync(dir, { recursive: true });
    return { name: `${k} node`, dir, k };
  });
  if (pause) fs.writeFileSync(path.join(nodes[0].dir, "heal-paused"), "");
  const emails = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.url.startsWith("/repos/")) { emails.push(JSON.parse(body).inputs); res.writeHead(204); return res.end(); }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { head_topology: { height: String(NET) } } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sh = (file, body) => fs.writeFileSync(path.join(file.includes("/") ? "" : sysDir, file), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  const fakeDocker = path.join(tmp, "docker.sh");
  sh(fakeDocker, `echo "docker $* @ $PWD" >> "${calls}"\nif [ "$1" = info ]; then [ -e "${started}" ] && exit 0; exit 1; fi\nexit 0`);
  sh("tasklist", `echo "tasklist $*" >> "${calls}"\n${desktopOpen ? 'echo "Docker Desktop.exe   4242 Console"' : 'echo "INFO: No tasks are running"'}`);
  sh("taskkill", `echo "taskkill $*" >> "${calls}"`);
  sh("wsl", `echo "wsl $*" >> "${calls}"`);
  const fakeDesktop = path.join(tmp, "desktop.sh");
  sh(fakeDesktop, `echo "start-docker-desktop" >> "${calls}"\n${dockerWorksAfterStart ? `touch "${started}"` : "true"}`);
  const fullState = { nodes: {}, dockerDown, ...state };
  fs.writeFileSync(path.join(healDir, "heal-state.json"), JSON.stringify(fullState));
  const run = (args = [], more = {}) => new Promise((resolve) => {
    execFile(process.execPath, [HEAL, ...args], {
      cwd: tmp,
      env: {
        PATH: process.env.PATH, HOME: tmp, RPC: `${url}/net`, HEAL_GITHUB_API: url, GITHUB_ALERT_TOKEN: "test", HEAL_DIR: healDir,
        HEAL_DOCKER: fakeDocker, HEAL_PLATFORM: "win32", HEAL_SYS_DIR: sysDir, HEAL_DOCKER_DESKTOP: fakeDesktop, HEAL_FAST: "1", HEAL_RESET_WAIT_MS: "300",
        HEAL_NODES: JSON.stringify(nodes.map((n) => ({ name: n.name, dir: n.dir, rpc: `${url}/${n.k}` }))), HEAL_RPC_FALLBACKS: "", ...env, ...more,
      },
    }, (err, stdout, stderr) => resolve({ out: stdout + stderr }));
  });
  return {
    tmp, healDir, nodes, emails, run,
    calls: () => fs.readFileSync(calls, "utf8"),
    state: () => JSON.parse(fs.readFileSync(path.join(healDir, "heal-state.json"), "utf8")),
    done: async () => { await new Promise((r) => server.close(r)); fs.rmSync(tmp, { recursive: true, force: true }); },
  };
}

test("Docker down at the first check: waits (it may still be starting), no reset, no email", async () => {
  const w = await world({ dockerDown: 0 });
  const r = await w.run();
  assert.match(r.out, /waiting one more check/);
  assert.doesNotMatch(w.calls(), /taskkill|wsl|start-docker-desktop/);
  assert.equal(w.emails.length, 0);
  assert.equal(w.state().dockerDown, 1);
  await w.done();
});

test("Docker down at two checks in a row: quits Docker Desktop, wsl --shutdown, starts it, then starts each node; two emails", async () => {
  const w = await world({ dockerDown: 1 });
  const r = await w.run();
  const calls = w.calls();
  const order = ["taskkill /IM Docker Desktop.exe /F", "wsl --shutdown", "start-docker-desktop", "docker info"];
  let at = -1;
  for (const s of order) { const i = calls.indexOf(s, at + 1); assert.ok(i > at, `${s}\n${calls}`); at = i; }
  assert.doesNotMatch(calls, /compose down|prune|volume rm|rm -rf/, "never touches the nodes' data");
  const ups = calls.split("\n").filter((l) => /compose up -d/.test(l));
  assert.equal(ups.length, 3);
  for (const n of w.nodes) assert.ok(ups.some((l) => l.endsWith(`@ ${n.dir}`)), n.name);
  assert.equal(w.emails.length, 2);
  assert.match(w.emails[0].detail, /Resetting Docker Desktop/);
  assert.match(w.emails[1].detail, /Docker is back after the reset/);
  assert.match(r.out, /Docker reset finished: started desk node, game node, personal node/);
  const st = w.state();
  assert.equal(st.dockerReset.awaitingUp, false);
  assert.equal(st.dockerDown, 0);
  assert.equal(st.dockerReset.times.length, 1);
  await w.done();
});

test("right after a reset the nodes are not checked for 30 minutes (no crash-loop alarm, no restart)", async () => {
  const w = await world({ dockerDown: 1 });
  await w.run();
  const r2 = await w.run();
  assert.match(r2.out, /settling after the Docker reset/);
  assert.equal((w.calls().match(/compose up -d/g) || []).length, 3, "no second round of starts");
  await w.done();
});

test("Docker Desktop not open (you quit it on purpose): no reset, the plain 'open Docker Desktop' email", async () => {
  const w = await world({ desktopOpen: false, dockerDown: 5 });
  const r = await w.run();
  assert.match(r.out, /isn't open/);
  assert.doesNotMatch(w.calls(), /taskkill|wsl|start-docker-desktop/);
  assert.equal(w.emails.length, 1);
  assert.match(w.emails[0].detail, /Open Docker Desktop/);
  await w.done();
});

test("a heal-paused file means no reset and no email", async () => {
  const w = await world({ dockerDown: 3, pause: true });
  const r = await w.run();
  assert.match(r.out, /heal-paused/);
  assert.doesNotMatch(w.calls(), /taskkill|wsl|start-docker-desktop/);
  assert.equal(w.emails.length, 0);
  await w.done();
});

test("HEAL_DOCKER_RESET=off and Linux fall back to the email only", async () => {
  for (const more of [{ HEAL_DOCKER_RESET: "off" }, { HEAL_PLATFORM: "linux" }]) {
    const w = await world({ dockerDown: 3 });
    await w.run([], more);
    assert.doesNotMatch(w.calls(), /taskkill|wsl|start-docker-desktop/);
    assert.equal(w.emails.length, 1);
    assert.match(w.emails[0].detail, /Open Docker Desktop/);
    await w.done();
  }
});

test("limits: not again within 2 hours, and not more than 3 in 24 hours; it emails why instead", async () => {
  const mk = (...agoMin) => ({ dockerReset: { times: agoMin.map((m) => Date.now() - m * 60_000), awaitingUp: false } });
  let w = await world({ dockerDown: 4, state: mk(30) });
  let r = await w.run();
  assert.match(r.out, /already reset Docker in the last 2 hours/);
  assert.doesNotMatch(w.calls(), /taskkill|wsl/);
  assert.match(w.emails[0].detail, /did not reset it/);
  await w.done();
  w = await world({ dockerDown: 4, state: mk(130, 400, 800) });
  r = await w.run();
  assert.match(r.out, /3 times in 24 hours/);
  assert.doesNotMatch(w.calls(), /taskkill|wsl/);
  await w.done();
  w = await world({ dockerDown: 4, state: mk(130, 1500) });   // one old reset falls out of the 24 hours: allowed
  await w.run();
  assert.match(w.calls(), /wsl --shutdown/);
  await w.done();
});

test("Docker doesn't come back after the reset: one email, no second reset on the next check", async () => {
  const w = await world({ dockerDown: 1, dockerWorksAfterStart: false });
  const r = await w.run();
  assert.match(r.out, /didn't answer within 5 minutes/);
  assert.doesNotMatch(w.calls(), /compose up/);
  assert.equal(w.state().dockerReset.awaitingUp, true);
  const r2 = await w.run();
  assert.match(r2.out, /already reset Docker in the last 2 hours/);
  assert.equal((w.calls().match(/wsl --shutdown/g) || []).length, 1);
  await w.done();
});

test("--dry-run: says what it would do, runs nothing", async () => {
  const w = await world({ dockerDown: 1 });
  const r = await w.run(["--dry-run"]);
  assert.match(r.out, /\(dry run\) would reset Docker Desktop/);
  assert.doesNotMatch(w.calls(), /taskkill|wsl|start-docker-desktop/);
  await w.done();
});
