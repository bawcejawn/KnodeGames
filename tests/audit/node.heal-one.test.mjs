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
  f("info", "ok"); f("all", "abc123\ndef456"); f("running", "abc123\ndef456"); f("block_store", "bs1"); f("chain", "ch1"); f("restarts_bs1", 0); f("restarts_ch1", 0); f("up_fails", "no");
  const docker = path.join(dir, "fake", "docker");
  fs.writeFileSync(docker, `#!/bin/bash
F="${dir}/fake"
echo "$*" >> "$F/calls"
case "$1" in
  info) [ "$(cat "$F/info")" = ok ] && echo 27.0.0 && exit 0; exit 1 ;;
  inspect) cat "$F/restarts_$4"; exit 0 ;;
  compose)
    case "$2" in
      ps) [ -f "$F/ps_fails" ] && exit 1; if [ "$3" = "-a" ]; then cat "$F/all"; elif [ -n "$4" ]; then cat "$F/$4"; else cat "$F/running"; fi; exit 0 ;;
      down) : > "$F/all"; : > "$F/running"; exit 0 ;;
      up) [ "$(cat "$F/up_fails")" = yes ] && exit 1; echo abc123 > "$F/all"; echo abc123 > "$F/running"; exit 0 ;;
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

  test(`${R.name}: C8-1: no containers = stopped on purpose (never started); stopped containers -> restart after two checks; no answer twice -> restart`, async () => {
    const e = setup();
    const L = { height: 1000 }, N = { height: 1000 };
    const l = await node(L), n = await node(N);
    try {
      e.f("all", ""); e.f("running", "");
      let r = await R.run(e, l.url, n.url, 1e12);
      assert.match(r.out, /stopped on purpose\)\. Not starting it/);
      assert.match(r.out, /NOTICE: Koinos node is stopped/);
      r = await R.run(e, l.url, n.url, 1e12 + 20 * MIN);
      assert.doesNotMatch(r.out, /NOTICE/, "reminds at most every 3 hours");
      assert.doesNotMatch(e.calls(), /compose (down|up)/, "never starts a node that was stopped on purpose");
      e.f("all", "abc");                                                           // containers exist, none running
      r = await R.run(e, l.url, n.url, 1e12 + 40 * MIN);
      assert.match(r.out, /checking again next time/); assert.doesNotMatch(e.calls(), /compose down/);
      r = await R.run(e, l.url, n.url, 1e12 + 60 * MIN);
      assert.match(r.out, /none has been running at two checks in a row\): restarting it/);
      assert.match(e.calls(), /compose down\ncompose up -d/);
      e.f("running", "abc"); fs.writeFileSync(path.join(e.dir, "fake", "calls"), "");
      L.down = true;
      r = await R.run(e, l.url, n.url, 1e12 + 120 * MIN);
      assert.match(r.out, /didn't answer this time/); assert.doesNotMatch(e.calls(), /compose down/);
      r = await R.run(e, l.url, n.url, 1e12 + 140 * MIN);
      assert.match(r.out, /hasn't answered at two checks in a row\): restarting it/);
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: C8-1: the heal-paused file stops every check while the node isn't running`, async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      fs.writeFileSync(path.join(e.dir, "heal-paused"), "");
      e.f("all", "abc"); e.f("running", "");
      for (let i = 0; i < 4; i++) { const r = await R.run(e, l.url, n.url, 1e12 + i * 20 * MIN); assert.match(r.out, /Paused/); }
      assert.doesNotMatch(e.calls(), /compose (down|up)/, "nothing started or stopped while paused");
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: C8-2: a failed restart still counts (cooldown, 3 in 6 h) and its notice comes at most every 3 h`, async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      e.f("up_fails", "yes");
      let out = "";
      for (let i = 0; i < 18; i++) out += (await R.run(e, l.url, n.url, 1e12 + i * 20 * MIN)).out;   // 6 hours of checks
      assert.equal((e.calls().match(/compose down/g) || []).length, 3, "3 tries in 6 hours, not one per check");
      assert.equal((out.match(/NOTICE: Koinos node: restart failed/g) || []).length, 1, "tries at 0, 60 and 120 min: one failure notice (at most every 3 hours)");
      assert.match(out, /NOTICE: Koinos node needs you/, "after 3 tries it stops and says so");
      assert.match(out, /restarted less than 50 minutes ago/);
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: C8-6: times in the future (a clock that was fast) don't block restarts`, async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      const now = 1e12, future = now + 2 * 24 * 60 * MIN;
      fs.writeFileSync(path.join(e.dir, "heal-state.json"), JSON.stringify({ lastHeight: 1000, misses: 0, heals: [future, future, future], lastRestart: future, nagAt: future, dockerAlert: 0, restarts: {} }));
      const r = await R.run(e, l.url, n.url, now);
      assert.match(r.out, /restarting it/);
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
      N.down = false; fs.rmSync(path.join(e.dir, "heal.log"), { force: true });
      const seeded = JSON.stringify({ lastHeight: 1000, misses: 1, heals: [], lastRestart: 0, nagAt: 0, dockerAlert: 0, restarts: {} });
      fs.writeFileSync(path.join(e.dir, "heal-state.json"), seeded);
      e.f("running", "");                                                      // containers exist, none running, 2nd check
      r = await R.run(e, l.url, n.url, 1e12 + 40 * MIN, true);
      assert.match(r.out, /would restart it now/);
      assert.doesNotMatch(e.calls(), /compose (down|up)/);
      assert.equal(fs.readFileSync(path.join(e.dir, "heal-state.json"), "utf8"), seeded, "dry run doesn't change the state");
      assert.ok(!fs.existsSync(path.join(e.dir, "heal.log")), "dry run writes no log");
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });
}

if (PYTHON) {
  test("Mac/Linux C8-8: a state file with wrong types starts fresh and still heals", async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      for (const bad of ['{"heals": null}', '{"lastRestart": "soon"}', '{"restarts": []}', '[1,2]', '{"misses": true}', 'not json']) {
        fs.writeFileSync(path.join(e.dir, "heal-state.json"), bad);
        fs.rmSync(path.join(e.dir, "fake", "calls"), { force: true });
        const r = await run(PYTHON, [PY], { KG_HEAL_FOLDER: e.dir, KG_HEAL_RPC: l.url, KG_HEAL_NETWORK: n.url, KG_HEAL_DOCKER: e.docker, KG_HEAL_NOW: "1000000000000" });
        assert.equal(r.code, 0, `${bad}: ${r.out}`);
        assert.doesNotMatch(r.out, /Traceback/, bad);
        fs.writeFileSync(path.join(e.dir, "heal-state.json"), JSON.stringify({ lastHeight: 1000 }));
      }
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test("Mac/Linux C8-8: a second check while one is running skips instead of restarting twice", async () => {
    const e = setup();
    try {
      const holder = execFile(PYTHON, ["-c", `import fcntl,time;f=open(${JSON.stringify(path.join(e.dir, "heal.lock"))},"a");fcntl.flock(f,fcntl.LOCK_EX);print("held",flush=True);time.sleep(5)`]);
      await new Promise((ok) => holder.stdout.once("data", ok));
      const r = await run(PYTHON, [PY], { KG_HEAL_FOLDER: e.dir, KG_HEAL_DOCKER: e.docker });
      holder.kill();
      assert.match(r.out, /Another check is still running; skipping this one/);
      assert.equal(e.calls(), "");
    } finally { fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test("Mac/Linux C8-7: the cron line survives spaces in paths and refuses a % in --rpc", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "heal1 sp "));
    const dir = path.join(base, "John Smith", "koinos-node");
    fs.mkdirSync(path.join(dir, "koinos"), { recursive: true });
    fs.writeFileSync(path.join(dir, "koinos", "docker-compose.yml"), "services: {}\n");
    const script = path.join(dir, "heal-one-node.py"); fs.copyFileSync(PY, script);
    const bin = path.join(base, "bin"); fs.mkdirSync(bin);
    const tab = path.join(base, "crontab.txt"); fs.writeFileSync(tab, "");
    fs.writeFileSync(path.join(bin, "crontab"), `#!/bin/sh\nif [ "$1" = "-l" ]; then cat "${tab}"; else cat > "${tab}"; fi\n`, { mode: 0o755 });
    try {
      const env = { KG_HEAL_FOLDER: dir, PATH: `${bin}:${process.env.PATH}` };
      let r = await run(PYTHON, [script, "--install", "--rpc=http://127.0.0.1:8090"], env);
      assert.match(r.out, /is set up/);
      const line = fs.readFileSync(tab, "utf8").split("\n").find((x) => x.includes("knode-games-heal-one-node"));
      assert.ok(line, "the fake crontab received the line");
      const cmd = line.replace(/^\*\/20 \* \* \* \* /, "").replace(/ >\/dev\/null 2>&1 # knode-games-heal-one-node$/, "");
      // Run the cron command itself (with sh, as cron does) in dry-run form: it must reach the script with the right folder and port.
      const dry = execFileSync("sh", ["-c", cmd.replace(/ '--rpc=/, " --dry-run '--rpc=")], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
      assert.match(dry, /dry run|Can't reach the Koinos network/);
      r = await run(PYTHON, [script, "--install", "--rpc=http://127.0.0.1:8090/?a=%41"], env);
      assert.notEqual(r.code, 0); assert.match(r.out, /can't contain %/);
      r = await run(PYTHON, [script, "--uninstall"], env);
      assert.doesNotMatch(fs.readFileSync(tab, "utf8"), /knode-games-heal-one-node/);
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
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

// ───────────── Repo Lens #E-19: R-1 (own unfinished restart), R-2 (forgotten pause file), "can't tell" ─────────────
for (const R of runners) {
  test(`${R.name}: R-2: a forgotten heal-paused file doesn't switch the self-heal off once the node runs again`, async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      fs.writeFileSync(path.join(e.dir, "heal-paused"), "");                    // containers running (setup default)
      let out = "";
      for (let i = 0; i < 3; i++) out += (await R.run(e, l.url, n.url, 1e12 + i * 20 * MIN)).out;
      assert.match(out, /the node is running again, so checking as usual/);
      assert.match(e.calls(), /compose down\ncompose up -d/, "the frozen node is still healed");
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: when the container list can't be read, nothing is started or called "stopped"`, async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      fs.writeFileSync(path.join(e.dir, "fake", "ps_fails"), "");
      let out = "";
      for (let i = 0; i < 4; i++) out += (await R.run(e, l.url, n.url, 1e12 + i * 20 * MIN)).out;
      assert.match(out, /Couldn't list the node's containers this time/);
      assert.doesNotMatch(out, /stopped on purpose|NOTICE/);
      assert.doesNotMatch(e.calls(), /compose (down|up)/);
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });

  test(`${R.name}: after a restart that worked, the user's own later stop is still "on purpose"`, async () => {
    const e = setup();
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      await R.run(e, l.url, n.url, 1e12);
      await R.run(e, l.url, n.url, 1e12 + 20 * MIN);                           // frozen -> restart (works)
      assert.equal((e.calls().match(/compose up/g) || []).length, 1);
      e.f("all", ""); e.f("running", "");                                       // the user runs docker compose down
      let out = "";
      for (let i = 2; i < 8; i++) out += (await R.run(e, l.url, n.url, 1e12 + i * 20 * MIN)).out;
      assert.match(out, /stopped on purpose/);
      assert.equal((e.calls().match(/compose up/g) || []).length, 1, "never restarted after the user's stop");
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });
}

// Repo Lens #E-19 R-1 (PR #179): append to the END of tests/audit/node.heal-one.test.mjs (it uses that file's setup(),
// node(), runners and MIN). The suite's fake `docker compose down` leaves the containers in place; a real one removes
// them. So after the self-heal's OWN restart fails at `up -d`, the next checks see "no containers" and call the node
// "stopped on purpose": it never tries again and tells you to start it "when you're ready".
for (const R of runners) {
  test(`${R.name}: Repo Lens #E-19 R-1: a restart whose "up" failed is retried later, not taken for "stopped on purpose"`, async () => {
    const e = setup();
    // A fake docker whose `compose down` really removes the containers and whose `up` fails once, then works.
    const F = path.join(e.dir, "fake");
    fs.writeFileSync(e.docker, `#!/bin/bash
F="${F}"
echo "$*" >> "$F/calls"
case "$1" in
  info) echo 27.0.0; exit 0 ;;
  inspect) echo 0; exit 0 ;;
  compose)
    case "$2" in
      ps) if [ "$3" = "-a" ]; then cat "$F/all"; elif [ -n "$4" ]; then cat "$F/$4" 2>/dev/null; else cat "$F/running"; fi; exit 0 ;;
      down) : > "$F/all"; : > "$F/running"; : > "$F/block_store"; : > "$F/chain"; exit 0 ;;
      up) if [ -f "$F/up_failed_once" ]; then echo abc123 > "$F/all"; echo abc123 > "$F/running"; exit 0; fi; touch "$F/up_failed_once"; exit 1 ;;
    esac ;;
esac
exit 0
`, { mode: 0o755 });
    const l = await node({ height: 1000 }), n = await node({ height: 9000 });
    try {
      let out = "";
      for (let i = 0; i < 9; i++) out += (await R.run(e, l.url, n.url, 1e12 + i * 20 * MIN)).out;   // 3 hours of checks
      const ups = (e.calls().match(/compose up/g) || []).length;
      assert.ok(ups >= 2, `the failed "up" is tried again within 3 hours (compose up calls: ${ups})`);
      assert.doesNotMatch(out, /stopped on purpose/, "its own failed restart is not a stop on purpose");
    } finally { l.srv.close(); n.srv.close(); fs.rmSync(e.dir, { recursive: true, force: true }); }
  });
}
