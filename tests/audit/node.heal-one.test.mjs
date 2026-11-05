// One-node self-heal for the public "Run a node" guide (node/one/heal-one-node.ps1 for Windows, heal-one-node.py for
// Mac/Linux): the same rules as bot/heal.mjs, for one node. Each scenario runs the real script against a fake docker
// (records every call) and fake Koinos nodes (local and network heights we control):
//   OK -> nothing; frozen (behind and not moving) -> down + up; restarted < 50 min ago -> waits; 3 restarts in 6 h ->
//   stops and tells you; not running -> started; block store restarting 3+ times -> no restart, "repair" notice;
//   Docker down -> nothing; network unreachable -> skips; dry run -> changes and writes nothing.
// Never: deleting volumes or data. The Windows script runs when PowerShell 7 is installed (PWSH=/path/to/pwsh).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PS1 = path.join(ROOT, "node", "one", "heal-one-node.ps1");
const PY = path.join(ROOT, "node", "one", "heal-one-node.py");
const PWSH = process.env.PWSH || (() => { try { return execFileSync("sh", ["-c", "command -v pwsh"], { encoding: "utf8" }).trim(); } catch { return ""; } })();
const PYTHON = (() => { try { return execFileSync("sh", ["-c", "command -v python3"], { encoding: "utf8" }).trim(); } catch { return ""; } })();
const MIN = 60_000;

/** A fake Koinos node answering chain.get_head_info with h.height (or failing when h.down). */
function node(h) {
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      if (h.down) { res.writeHead(502); return res.end("<html>bad gateway</html>"); }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { head_topology: { height: String(h.height) } } }));
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}

/** A folder with a node (koinos/docker-compose.yml) and a fake docker driven by files in dir/fake. */
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heal1-"));
  fs.mkdirSync(path.join(dir, "koinos")); fs.mkdirSync(path.join(dir, "fake"));
  fs.writeFileSync(path.join(dir, "koinos", "docker-compose.yml"), "services: {}\n");
  const f = (n, v) => fs.writeFileSync(path.join(dir, "fake", n), String(v));
  f("info", "ok"); f("running", "abc123\ndef456"); f("block_store", "bs1"); f("chain", "ch1"); f("restarts_bs1", 0); f("restarts_ch1", 0);
  const docker = path.join(dir, "fake", "docker");
  fs.writeFileSync(docker, `#!/bin/bash
F="${dir}/fake"
echo "$*" >> "$F/calls"
case "$1" in
  info) [ "$(cat "$F/info")" = ok ] && echo 27.0.0 && exit 0; exit 1 ;;
  inspect) cat "$F/restarts_$4"; exit 0 ;;
  compose)
    case "$2" in
      ps) if [ -n "$4" ]; then cat "$F/$4"; else cat "$F/running"; fi; exit 0 ;;
      down|up) exit 0 ;;
    esac ;;
esac
exit 0
`, { mode: 0o755 });
  return { dir, f, docker, calls: () => { try { return fs.readFileSync(path.join(dir, "fake", "calls"), "utf8"); } catch { return ""; } } };
}

const runners = [];
if (PYTHON) runners.push({ name: "Mac/Linux (heal-one-node.py)", run: (e, local, net, now, dry) => run(PYTHON, [PY, ...(dry ? ["--dry-run"] : [])], { KG_HEAL_FOLDER: e.dir, KG_HEAL_RPC: local, KG_HEAL_NETWORK: net, KG_HEAL_DOCKER: e.docker, KG_HEAL_NOW: String(now) }) });
if (PWSH) runners.push({ name: "Windows (heal-one-node.ps1)", run: (e, local, net, now, dry) => run(PWSH, ["-NoProfile", "-NonInteractive", "-File", PS1, "-Folder", e.dir, "-Rpc", local, ...(dry ? ["-DryRun"] : [])], { KG_HEAL_NETWORK: net, KG_HEAL_DOCKER: e.docker, KG_HEAL_NOW: String(now) }) });

function run(cmd, args, env) {
  return new Promise((ok) => execFile(cmd, args, { env: { ...process.env, ...env }, timeout: 60_000 }, (err, stdout, stderr) => ok({ code: err ? err.code : 0, out: stdout + stderr })));
}

for (const R of runners) {
  test(`${R.name}: OK, catching up, frozen -> restart, cooldown, 3-in-6h limit`, async () => {
    const e = setup();
    const L = { height: 1000 }, N = { height: 1005 };
    const l = await node(L), n = await node(N);
    try {
      let t = 1_000_000_000_000;
      let r = await R.run(e, l.url, n.url, t);
      assert.match(r.out, /OK: height 1000, network 1005/); assert.doesNotMatch(e.calls(), /compose down/);
      N.height = 3000; L.height = 1500; t += 20 * MIN;
      r = await R.run(e, l.url, n.url, t);
      assert.match(r.out, /Catching up: 1500 blocks behind/); assert.doesNotMatch(e.calls(), /compose down/);
      t += 20 * MIN;                                                         // not moving
      r = await R.run(e, l.url, n.url, t);
      assert.match(r.out, /FROZEN \(it is 1500 blocks behind and hasn't moved since the last check\): restarting it/);
      assert.match(e.calls(), /compose down\ncompose up -d/);
      t += 20 * MIN;
      r = await R.run(e, l.url, n.url, t);
      assert.match(r.out, /restarted less than 50 minutes ago/);
      assert.equal((e.calls().match(/compose down/g) || []).length, 1);
      t += 40 * MIN; r = await R.run(e, l.url, n.url, t);                     // 2nd restart
      t += 60 * MIN; r = await R.run(e, l.url, n.url, t);                     // 3rd restart
      assert.equal((e.calls().match(/compose down/g) || []).length, 3);
      t += 60 * MIN; r = await R.run(e, l.url, n.url, t);                     // limit reached
      assert.match(r.out, /already restarted 3 times in 6 hours\. Not trying again/);
      assert.match(r.out, /NOTICE: Koinos node needs you/);
      assert.equal((e.calls().match(/compose down/g) || []).length, 3);
      assert.match(fs.readFileSync(path.join(e.dir, "heal.log"), "utf8"), /FROZEN/);
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: not running -> started; no answer twice -> restarted`, async () => {
    const e = setup();
    const L = { height: 1000 }, N = { height: 1000 };
    const l = await node(L), n = await node(N);
    try {
      e.f("running", "");
      let r = await R.run(e, l.url, n.url, 1e12);
      assert.match(r.out, /FROZEN \(the node isn't running\): restarting it/);
      assert.match(e.calls(), /compose up -d/);
      e.f("running", "abc"); fs.writeFileSync(path.join(e.dir, "fake", "calls"), "");
      L.down = true;
      r = await R.run(e, l.url, n.url, 1e12 + 60 * MIN);
      assert.match(r.out, /didn't answer this time/); assert.doesNotMatch(e.calls(), /compose down/);
      r = await R.run(e, l.url, n.url, 1e12 + 80 * MIN);
      assert.match(r.out, /hasn't answered at two checks in a row\): restarting it/);
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: block store crash loop -> no restart, a repair notice (once per 3 hours)`, async () => {
    const e = setup();
    const L = { height: 1000 }, N = { height: 5000 };
    const l = await node(L), n = await node(N);
    try {
      await R.run(e, l.url, n.url, 1e12);
      e.f("restarts_bs1", 4);
      let r = await R.run(e, l.url, n.url, 1e12 + 20 * MIN);
      assert.match(r.out, /CRASH LOOP: block_store restarted 4 times since the last check\. Not restarting/);
      assert.match(r.out, /NOTICE: Koinos node needs a repair/);
      e.f("restarts_bs1", 8);
      r = await R.run(e, l.url, n.url, 1e12 + 40 * MIN);
      assert.match(r.out, /CRASH LOOP/); assert.doesNotMatch(r.out, /NOTICE/, "not nagging again within 3 hours");
      assert.doesNotMatch(e.calls(), /compose down/);
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: Docker down, network unreachable, dry run: nothing changes`, async () => {
    const e = setup();
    const L = { height: 1000 }, N = { height: 9000 };
    const l = await node(L), n = await node(N);
    try {
      e.f("info", "no");
      let r = await R.run(e, l.url, n.url, 1e12);
      assert.match(r.out, /Docker isn't running/); assert.doesNotMatch(e.calls(), /compose/);
      e.f("info", "ok");
      N.down = true;
      r = await R.run(e, l.url, n.url, 1e12 + 20 * MIN);
      assert.match(r.out, /Can't reach the Koinos network/); assert.doesNotMatch(e.calls(), /compose/);
      N.down = false; fs.rmSync(path.join(e.dir, "heal-state.json"), { force: true }); fs.rmSync(path.join(e.dir, "heal.log"), { force: true });
      e.f("running", "");
      r = await R.run(e, l.url, n.url, 1e12 + 40 * MIN, true);
      assert.match(r.out, /would restart it now/);
      assert.doesNotMatch(e.calls(), /compose (down|up)/);
      assert.ok(!fs.existsSync(path.join(e.dir, "heal-state.json")) && !fs.existsSync(path.join(e.dir, "heal.log")), "dry run writes nothing");
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });
}

test("both scripts: never delete, prune or touch the key; the Windows script is plain ASCII (Windows PowerShell 5.1)", () => {
  for (const f of [PS1, PY]) {
    const s = fs.readFileSync(f, "utf8").replace(/^\s*(#|""").*$/gm, "");
    assert.doesNotMatch(s, /prune|volume rm|"rm"|Remove-Item|rmtree|os\.remove|unlink\(|private\.key|block_producer/, f);
    assert.doesNotMatch(s, /api\.github\.com|GITHUB|TOKEN|fetch\(.*(POST)?/i, `${f}: talks to no one but two Koinos nodes`);
  }
  assert.ok(/^[\x00-\x7F]*$/.test(fs.readFileSync(PS1, "utf8")), "heal-one-node.ps1 must be ASCII only");
  assert.ok(runners.length > 0, "python3 or pwsh available to run the scenarios");
});

test("the guide's download boxes name the right files and show their real SHA-256", async () => {
  const crypto = await import("node:crypto");
  const html = fs.readFileSync(path.join(ROOT, "run-node.html"), "utf8");
  for (const [file, local] of [["heal-one-node.ps1", PS1], ["heal-one-node.py", PY]]) {
    const sha = crypto.createHash("sha256").update(fs.readFileSync(local)).digest("hex");
    assert.ok(html.includes(`https://raw.githubusercontent.com/bawcejawn/KnodeGames/main/node/one/${file}`), `${file}: download link`);
    assert.ok(html.toLowerCase().includes(sha), `${file}: the page shows its SHA-256 ${sha}`);
  }
});
