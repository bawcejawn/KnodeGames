// Repo Lens #F-14 (run-node-shorter bundle @ f9454ee2): F14-1. Harness copied from tests/audit/heal.dockerreset.test.mjs (same PR). Fails today.
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

test("F14-1 (Low): while a repair holds the lock, the Docker reset neither kills Docker nor starts the nodes being repaired", async () => {
  const w = await world({ dockerDown: 1 });
  // node\repair-node-data.ps1 (or the self-heal's own repair) holds this lock while it copies one node's data into the other
  fs.writeFileSync(path.join(w.healDir, "repair.lock"), JSON.stringify({ broken: "game", from: "desk", startedAt: Date.now() - 5 * 60_000 }));
  try {
  await w.run();
  const calls = w.calls();
  const upIn = (k) => calls.split("\n").some((l) => l.startsWith("docker compose up -d @ ") && l.endsWith(w.nodes.find((n) => n.k === k).dir));
  assert.doesNotMatch(calls, /taskkill|wsl --shutdown/, "no Docker reset while a repair is running (it would kill the repair's copy):\n" + calls);
  assert.ok(!upIn("game") && !upIn("desk"), "never 'docker compose up -d' in a node the repair is working on:\n" + calls);
  } finally { await w.done(); }
});

// Added with the F14-1 fix: the lock only blocks while FRESH, a repair on another node doesn't block starting this one,
// and with no lock the reset still happens.
test("F14-1: a stale lock (over 90 min) does not block the reset; no lock: reset happens", async () => {
  for (const startedAt of [Date.now() - 100 * 60_000, null]) {
    const w = await world({ dockerDown: 1 });
    if (startedAt) fs.writeFileSync(path.join(w.healDir, "repair.lock"), JSON.stringify({ broken: "game", from: "desk", startedAt }));
    try { await w.run(); assert.match(w.calls(), /wsl --shutdown/); } finally { await w.done(); }
  }
});

test("F14-1: Docker already back after a reset while a repair runs: starts only the node not being repaired", async () => {
  const w = await world({ dockerDown: 0, state: { dockerReset: { times: [Date.now() - 10 * 60_000], awaitingUp: true } } });
  fs.writeFileSync(path.join(w.healDir, "repair.lock"), JSON.stringify({ broken: "game", from: "desk", startedAt: Date.now() - 60_000 }));
  fs.writeFileSync(path.join(w.tmp, "started"), "");   // the fake docker answers
  try {
    await w.run();
    const ups = w.calls().split("\n").filter((l) => l.startsWith("docker compose up -d @ "));
    assert.equal(ups.length, 1, ups.join("\n"));
    assert.ok(ups[0].endsWith(w.nodes.find((n) => n.k === "personal").dir));
  } finally { await w.done(); }
});
