// "Run a node" guide (run-node.html + run-node.js, R-NODE-1): it's in the Tools menu everywhere; it never asks for or
// keeps a key and never talks to a chain or server; every step has its parts and commands for every computer; and the
// commands that change data behave as the page says. Offline, except the unpack proof, which runs GNU tar locally
// (skipped where tar is missing).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import http from "node:http";

const APP = process.env.APP || ".";
const read = (f) => fs.readFileSync(`${APP}/${f}`, "utf8");
const html = read("run-node.html");
const js = read("run-node.js");
const COMMIT = "b05b8337d0a8d09748f9c2d1faef810ee2f5de28";

const unescape = (s) => s.replace(/<span class="rn-addr">[^<]*<\/span>/g, "ADDR").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
/** Every command box: { os: ["win"] | ["mac","linux"] | …, step, text }. */
const boxes = [];
for (const sec of html.matchAll(/<section class="rn-step pg-card" id="step-(\d+)">([\s\S]*?)<\/section>/g)) {
  for (const m of sec[2].matchAll(/<div class="rn-cmd" data-os="([^"]+)">[\s\S]*?<pre><code>([\s\S]*?)<\/code><\/pre>/g)) {
    boxes.push({ step: Number(sec[1]), os: m[1].split(" "), text: unescape(m[2]) });
  }
}

test("in the Tools menu (top and More sheet) of every page that has the menu, and in the sitemap and SEO list", () => {
  const nav = read("tools/site-nav.mjs");
  assert.match(nav, /\["Run a node", "run-node\.html", "server"\]/);
  assert.match(nav, /\["Run a node", "run-node\.html"\]/);
  const pages = fs.readdirSync(APP).filter((f) => f.endsWith(".html"));
  for (const p of pages) {
    const h = read(p);
    if (!/class="dd-menu"/.test(h)) continue;   // pages without the site menu (producer.html, testnet pages)
    assert.match(h, /<a href="run-node\.html"( aria-current="page")?>Run a node<\/a>/, `${p}: top Tools menu`);
    assert.match(h, /<a href="run-node\.html"><svg[^>]*>[\s\S]*?<\/svg><span>Run a node<\/span><\/a>/, `${p}: More sheet`);
  }
  assert.match(read("sitemap.xml"), /<loc>https:\/\/knodegames\.com\/run-node\.html<\/loc>/);
  assert.match(read("tools/site-seo.mjs"), /file: "run-node\.html"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/knodegames\.com\/run-node\.html">/);
  assert.match(read("robots.txt"), /Disallow: \/admin\//, "the SEO tool keeps the admin rule");
  assert.match(read("tools/site-seo.mjs"), /Disallow: \/admin\//);
});

test("never asks for a key: the only text box is the public address; no forms; says so plainly", () => {
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  const text = inputs.filter((i) => !/type="checkbox"/.test(i));
  assert.equal(text.length, 1, "one text box");
  assert.match(text[0], /id="rn-addr"/);
  assert.doesNotMatch(html, /<form\b|<textarea\b|type="password"/i);
  assert.match(html, /never asks for a private key or recovery words/);
});

test("talks to no chain and no server: no network calls, wallet or chain library use in the page script", () => {
  const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|koilib|koinos\.|Provider|KWallet|Contract|signer|import\(/i);
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  // Storage is optional and wrapped.
  for (const m of code.matchAll(/localStorage\.(get|set)Item/g)) assert.ok(code.slice(Math.max(0, m.index - 40), m.index).includes("try"), "storage use inside try");
});

test("an address fills the commands; something shaped like a private key is refused and not kept", () => {
  const addrRe = new RegExp(js.match(/const ADDR_RE = \/(.+?)\/;/)[1]);
  const keyRe = new RegExp(js.match(/const KEYLIKE_RE = \/(.+?)\/;/)[1]);
  assert.ok(addrRe.test("1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"));
  assert.ok(!addrRe.test("5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ"), "a WIF is not an address");
  assert.ok(!addrRe.test("1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1s0"), "0 isn't base58");
  for (const k of ["5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ", "KwdMAjGmerYanjeui5SHS7JkmpZvVipYvB2LJGU1ZxJwYvP98617", "0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d"]) assert.ok(keyRe.test(k), k);
  const wordsRe = new RegExp(js.match(/const WORDS_RE = \/(.+?)\/i;/)[1], "i");
  assert.ok(wordsRe.test("legal winner thank year wave sausage worth useful legal winner thank yellow"), "12 recovery words");
  assert.ok(wordsRe.test(Array(24).fill("abandon").join(" ")), "24 recovery words");
  assert.ok(!wordsRe.test("1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"));
  assert.match(js, /if \(KEYLIKE_RE\.test\(v\) \|\| WORDS_RE\.test\(v\)\) \{\s*input\.value = "";\s*state\.addr = ""; save\(\);/, "cleared and not stored");
  assert.match(js, /code\.querySelector\("\.rn-addr"\) && !state\.addr/, "won't copy a command that still has the placeholder");
});

test("ten steps, each with what it does, what you should see, a fix list and a Done box; commands for every computer", () => {
  const steps = [...html.matchAll(/<section class="rn-step pg-card" id="step-(\d+)">([\s\S]*?)<\/section>/g)];
  assert.deepEqual(steps.map((s) => Number(s[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const [, n, body] of steps) {
    assert.match(body, /<b>What this does:<\/b>/, `step ${n}`);
    assert.match(body, /<b>You should see:<\/b>/, `step ${n}`);
    assert.match(body, /<summary>If it doesn't work<\/summary>\s*<ul>\s*<li>/, `step ${n}`);
    assert.match(body, new RegExp(`data-check="step-${n}"`), `step ${n}`);
    const oses = new Set(boxes.filter((b) => b.step === Number(n)).flatMap((b) => b.os));
    if (oses.size) assert.deepEqual([...oses].sort(), ["linux", "mac", "win"], `step ${n}: commands for Windows, Mac and Linux`);
  }
  assert.ok(boxes.length >= 40);
  assert.match(html, /What can go wrong/);
  for (const row of ["Node behind", "Crash loop", "Disk full", "Docker won't start", "PC asleep"]) assert.ok(html.includes(row), row);
  assert.match(html, /id="checklist"/);
});

test("Windows (PowerShell) commands come first in every step", () => {
  for (let n = 1; n <= 10; n++) {
    const s = boxes.filter((b) => b.step === n);
    if (s.length) assert.deepEqual(s[0].os, ["win"], `step ${n}`);
  }
});

test("one pinned Koinos version everywhere; the official repo; the volume is never pruned or removed by a command box", () => {
  const all = boxes.map((b) => b.text).join("\n");
  const pins = [...all.matchAll(/checkout ([0-9a-f]{40})/g)].map((m) => m[1]);
  assert.ok(pins.length >= 4);
  assert.ok(pins.every((p) => p === COMMIT));
  assert.ok(all.includes("git clone https://github.com/koinos/koinos.git koinos"));
  for (const b of boxes) assert.doesNotMatch(b.text, /volume prune|prune --volumes|prune -a --volumes|volume rm|rm -rf \/k\/block_producer|rm -rf \/k\b(?!\/)/, `step ${b.step}: ${b.text.slice(0, 60)}`);
  // The key is only ever read (public) or copied whole to a stick; never printed.
  for (const b of boxes) if (/private\.key/.test(b.text)) {
    // Only ever: check the stick is there, then copy the key file straight onto it (read-only volume).
    assert.match(b.text, /^if (\(Test-Path E:\\\)|\[ -d \/Volumes\/MYUSB \] && diskutil info \/Volumes\/MYUSB|mountpoint -q "\/media\/\$USER\/MYUSB")/, b.text);
    assert.match(b.text, /docker run --rm -v koinos-data:\/k:ro -v \S+ alpine:3\.20 cp \/k\/block_producer\/private\.key \/usb\/koinos-node-private\.key/, b.text);
    assert.doesNotMatch(b.text.replace(/\/usb\/koinos-node-private\.key|\/k\/block_producer\/private\.key|[\w/"$]*\/koinos-node-private\.key"?|E:\\koinos-node-private\.key/g, ""), /private\.key/, b.text);
  }
  assert.doesNotMatch(all, /cat \/k\/block_producer\/private/);
  assert.match(all, /cat \/k\/block_producer\/public\.key/);
});

test("the volume override covers exactly the services that mount BASEDIR in the Koinos compose file", () => {
  const compose = read("tests/fixtures/koinos-docker-compose.yml");
  const want = [];
  let cur = null;
  for (const line of compose.split("\n")) {
    const s = line.match(/^ {2,3}([a-z_]+):\s*$/);
    if (s) cur = s[1];
    if (cur && /\$\{BASEDIR\}:\/koinos/.test(line)) want.push(cur);
  }
  for (const b of boxes.filter((x) => /docker-compose\.override\.yml/.test(x.text) && /services:/.test(x.text))) {
    const got = [...b.text.matchAll(/^ {2}([a-z_]+):\n {4}volumes: \["koinos-data:\/koinos"\]$/gm)].map((m) => m[1]);
    assert.deepEqual(got.sort(), [...new Set(want)].sort(), b.os.join(","));
    assert.match(b.text, /volumes:\n {2}koinos-data:\n {4}external: true\n {4}name: koinos-data/);
  }
});

test("the producer line edit turns the example's commented line into the address, on Windows and Mac/Linux", () => {
  const example = "block_producer:\n  algorithm: pob                                      # Block production algorithm\n  # producer:                                         # Address at which which blocks are produced\n  # private-key-file: private.key                     # File\n  # pob-production: 100                               # Control\n";
  const win = boxes.find((b) => b.os[0] === "win" && /-replace/.test(b.text)).text;
  const [, pat, rep] = win.match(/-replace '([^']+)', '([^']+)'/);
  const out = example.replace(new RegExp(pat.replace("(?m)", ""), "m"), rep);
  assert.match(out, /\n {2}producer: ADDR\n/);
  assert.equal((out.match(/^ {2}producer:/gm) || []).length, 1, "only that line changes");
  assert.match(out, /# pob-production: 100/);
  const nix = boxes.find((b) => b.os.includes("mac") && /sed -i\.bak/.test(b.text)).text;
  assert.match(nix, /sed -i\.bak 's\|\^ {2}# producer:\.\*\$\| {2}producer: ADDR\|' config\/config\.yml/);
});

test("the unpack command takes only chain and block_store, works with either archive layout, and refuses a second run", { skip: !hasGnuTar() && "GNU tar not installed" }, () => {
  const box = boxes.find((b) => b.os.includes("mac") && /debian:bookworm-slim/.test(b.text));
  const winBox = boxes.find((b) => b.os[0] === "win" && /debian:bookworm-slim/.test(b.text));
  const sh = box.text.match(/sh -c "([^"]+)"$/)[1];
  assert.equal(winBox.text.match(/sh -c "([^"]+)"$/)[1], sh, "the same unpack on every computer");
  for (const prefix of [".koinos", "./.koinos"]) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), "rn-"));
    for (const d of ["chain/blockchain", "block_store/db", "account_history", "transaction_store"]) fs.mkdirSync(path.join(t, "src/.koinos", d), { recursive: true });
    fs.writeFileSync(path.join(t, "src/.koinos/chain/blockchain/x"), "1");
    fs.writeFileSync(path.join(t, "src/.koinos/block_store/db/y"), "2");
    fs.writeFileSync(path.join(t, "src/.koinos/account_history/z"), "3");
    fs.mkdirSync(path.join(t, "dl")); fs.mkdirSync(path.join(t, "k"));
    execFileSync("tar", ["-czf", path.join(t, "dl/snapshot.tar.gz"), prefix], { cwd: path.join(t, "src") });
    const local = sh.replaceAll("/k/", `${t}/k/`).replaceAll(" /k;", ` ${t}/k;`).replaceAll("ls /k", `ls ${t}/k`).replaceAll("/dl/", `${t}/dl/`);
    const out = execFileSync("sh", ["-c", local], { encoding: "utf8" });
    assert.match(out, /UNPACKED OK/);
    assert.deepEqual(fs.readdirSync(path.join(t, "k")).sort(), ["block_store", "chain"], prefix);
    assert.equal(fs.readFileSync(path.join(t, "k/chain/blockchain/x"), "utf8"), "1");
    let again = "";
    try { execFileSync("sh", ["-c", local], { encoding: "utf8" }); } catch (e) { again = String(e.stdout); }
    assert.match(again, /STOP: this volume already holds chain data/, "a second run changes nothing");
    assert.equal(fs.readFileSync(path.join(t, "k/chain/blockchain/x"), "utf8"), "1");
    fs.rmSync(t, { recursive: true, force: true });
  }
});

test("producer.html points public node runners at their public.key, not the owner's bot command", () => {
  const p = read("producer.html");
  assert.doesNotMatch(p, /npm run bot/);
  assert.match(p, /block_producer\/public\.key/);
  assert.match(p, /href="run-node\.html"/);
  assert.doesNotMatch(read("producer.js"), /from node-key/);
});

test("words: no Chainge, the brand is two words, Vortex for the bridge", () => {
  const visible = html.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(html, /chainge/i);
  assert.doesNotMatch(visible.replace(/bawcejawn\/KnodeGames\//g, ""), /KnodeGames/, "the repo name in a link is fine; the brand is two words");
  assert.match(html, /Vortex/);
});

function hasGnuTar() {
  try { return /GNU tar/.test(execFileSync("tar", ["--version"], { encoding: "utf8" })); } catch { return false; }
}

// ───────────── Repo Lens #173 fixes, proven by running the page's own boxes ─────────────
const PWSH = process.env.PWSH || (() => { try { return execFileSync("sh", ["-c", "command -v pwsh"], { encoding: "utf8" }).trim(); } catch { return ""; } })();
const box = (os, needle) => { const b = boxes.filter((x) => x.os.includes(os) && x.text.includes(needle)); assert.equal(b.length, 1, `${os}: ${needle}`); return b[0].text; };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rn-box-"));
const bash = (script, cwd, env = {}) => execFileSync("bash", ["-c", script], { cwd, encoding: "utf8", env: { ...process.env, ...env } });

test("F-1: the fingerprint check never says MATCH without a snapshot list and a file (Mac/Linux, and Windows with pwsh)", () => {
  const nix = box("mac", 'echo "STOP - no snapshot.json yet').replace("cd ~/koinos-node", "");
  const t = tmp();
  assert.match(bash(nix, t), /STOP - no snapshot\.json yet/, "empty folder");
  fs.writeFileSync(path.join(t, "snapshot.tar.gz"), "data");
  const sha = execFileSync("sh", ["-c", "sha256sum snapshot.tar.gz | cut -c1-64"], { cwd: t, encoding: "utf8" }).trim();
  assert.match(bash(nix, t), /STOP - no snapshot\.json yet/, "a file but no list");
  fs.writeFileSync(path.join(t, "snapshot.json"), JSON.stringify({ sha256: sha.toUpperCase() }));
  assert.match(bash(nix, t), /^MATCH/m);
  fs.writeFileSync(path.join(t, "snapshot.json"), JSON.stringify({ sha256: "0".repeat(64) }));
  assert.match(bash(nix, t), /^NO MATCH/m);
  fs.rmSync(path.join(t, "snapshot.tar.gz"));
  assert.match(bash(nix, t), /STOP - no snapshot\.tar\.gz yet/, "a list but no file");
  if (PWSH) {
    const win = box("win", '"STOP - no snapshot.json yet').replace("cd C:\\koinos-node", "");
    const ps = (dir) => execFileSync(PWSH, ["-NoProfile", "-NonInteractive", "-Command", win], { cwd: dir, encoding: "utf8" });
    const e = tmp();
    assert.match(ps(e), /STOP - no snapshot\.json yet/);
    fs.writeFileSync(path.join(e, "snapshot.json"), JSON.stringify({ sha256: sha }));
    assert.match(ps(e), /STOP - no snapshot\.tar\.gz yet/);
    fs.writeFileSync(path.join(e, "snapshot.tar.gz"), "data");
    assert.match(ps(e), /^MATCH/m);
    fs.rmSync(e, { recursive: true, force: true });
  }
  fs.rmSync(t, { recursive: true, force: true });
});

test("F-5: 'Behind by' is only printed when both heights were read", async () => {
  const nix = box("mac", "Couldn't read the network height");
  const serve = (h) => new Promise((ok) => { const s = http.createServer((q, r) => { q.resume(); q.on("end", () => r.end(JSON.stringify({ result: { head_topology: { height: String(h) } } }))); }); s.listen(0, "127.0.0.1", () => ok(s)); });
  const run = (script) => new Promise((ok) => execFile("bash", ["-c", script], { encoding: "utf8" }, (e, out) => ok(out)));
  const me = await serve(1000), net = await serve(1005);
  const at = (s) => `http://127.0.0.1:${s.address().port}`;
  try {
    assert.match(await run(nix.replace("http://127.0.0.1:8080", at(me)).replace("https://koinos.armana.io", at(net))), /Your node: 1000 {3}Network: 1005 {3}Behind by: 5 blocks/);
    assert.match(await run(nix.replace("http://127.0.0.1:8080", at(me)).replace("https://koinos.armana.io", "http://127.0.0.1:9")), /Couldn't read the network height/);
    assert.match(await run(nix.replace("http://127.0.0.1:8080", "http://127.0.0.1:9").replace("https://koinos.armana.io", at(net))), /Your node didn't answer yet/);
  } finally { me.close(); net.close(); }
  const win = box("win", "Couldn't read the network height");
  assert.match(win, /^\$me = \$null; \$net = \$null$/m, "Windows clears stale numbers first");
  assert.match(win, /-not \(\$me -gt 0\)[\s\S]*-not \(\$net -gt 0\)[\s\S]*Behind by/);
});

test("F-12: the key backup refuses when the USB stick isn't there, and runs nothing", () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, "docker"), `#!/bin/sh\necho "$*" >> "${t}/calls"\n`, { mode: 0o755 });
  for (const [os_, needle] of [["linux", "/media/$USER/MYUSB"], ["mac", "/Volumes/MYUSB"]]) {
    const out = bash(box(os_, needle), t, { PATH: `${t}:${process.env.PATH}`, USER: "nobody-here" });
    assert.match(out, /STOP - no USB stick named MYUSB/, os_);
  }
  assert.ok(!fs.existsSync(path.join(t, "calls")), "docker never ran");
  assert.match(box("win", "E:/:/usb"), /^if \(Test-Path E:\\\) \{ docker run[\s\S]*\} else \{ "STOP - there is no drive E:/);
  fs.rmSync(t, { recursive: true, force: true });
});

test("F-7: an archive holding links is refused and leaves nothing behind", { skip: !hasGnuTar() && "GNU tar not installed" }, () => {
  const sh = box("mac", "debian:bookworm-slim").match(/sh -c "([^"]+)"$/)[1];
  assert.doesNotMatch(sh, /\$/, "no $ for the host shell to expand inside the double quotes");
  const t = tmp();
  fs.mkdirSync(path.join(t, "src/.koinos/chain/blockchain"), { recursive: true }); fs.mkdirSync(path.join(t, "src/.koinos/block_store/db"), { recursive: true });
  fs.writeFileSync(path.join(t, "src/.koinos/chain/blockchain/x"), "1");
  fs.symlinkSync("/koinos/block_producer/private.key", path.join(t, "src/.koinos/block_store/db/LOG"));
  fs.mkdirSync(path.join(t, "dl")); fs.mkdirSync(path.join(t, "k"));
  execFileSync("tar", ["-czf", path.join(t, "dl/snapshot.tar.gz"), ".koinos"], { cwd: path.join(t, "src") });
  const local = sh.replaceAll("/k/", `${t}/k/`).replaceAll("ls /k", `ls ${t}/k`).replaceAll("/dl/", `${t}/dl/`);
  let out = "";
  try { execFileSync("sh", ["-c", local], { encoding: "utf8" }); } catch (e) { out = String(e.stdout); }
  assert.match(out, /STOP: the snapshot holds unexpected links/);
  assert.deepEqual(fs.readdirSync(path.join(t, "k")), [], "nothing unpacked, nothing left");
  fs.rmSync(t, { recursive: true, force: true });
});

test("F-2, F-4, F-6 and the Lows: wording", () => {
  assert.ok(html.includes(`<code>...${COMMIT.slice(-6)}</code>`), "F-4: the pin's real last six characters");
  assert.doesNotMatch(html, /Both Armana fingerprints agree/, "F-2");
  assert.match(html, /second source/);
  for (const b of [box("win", "Invoke-RestMethod https://snapshots.armana.io"), box("mac", 'urlopen("https://snapshots.armana.io')]) assert.match(b, /half-finished older download was removed/, "F-6: no resume onto a different snapshot");
  assert.match(html, /404/);
  assert.match(html, /about 180 GB/, "F-3");
  assert.match(html, /If you never saw it/, "F-8");
  assert.match(html, /add those lines again after updating/, "F-9");
  assert.equal((box("win", "Invoke-RestMethod https://snapshots.armana.io").match(/Tls12/g) || []).length, 1, "F-10");
  assert.match(html, /It never sends your address or anything you type/, "F-11");
});

test("N-1: a hostile height answer can't run code or read as caught up in the Mac/Linux 5b box", async () => {
  const nix = box("mac", "Couldn't read the network height");
  const serve = (h) => new Promise((ok) => { const s = http.createServer((q, r) => { q.resume(); q.on("end", () => r.end(JSON.stringify({ result: { head_topology: { height: h } } }))); }); s.listen(0, "127.0.0.1", () => ok(s)); });
  const run = (script, cwd) => new Promise((ok) => execFile("bash", ["-c", script], { cwd, encoding: "utf8" }, (e, out) => ok(out)));
  const at = (s) => `http://127.0.0.1:${s.address().port}`;
  const me = await serve("1000");
  try {
    for (const bad of ["a[$(touch PWNED)]", "x", "ME", "0x10", "-5", "0", "999", "1e9", "", null]) {
      const t = tmp();
      const net = await serve(bad);
      const out = await run(nix.replace("http://127.0.0.1:8080", at(me)).replace("https://koinos.armana.io", at(net)), t);
      net.close();
      assert.ok(!fs.existsSync(path.join(t, "PWNED")), `${bad}: nothing ran`);
      assert.match(out, /Couldn't read the network height/, `${JSON.stringify(bad)} -> ${out}`);
      assert.doesNotMatch(out, /Behind by/, `${bad}: no "Behind by"`);
      fs.rmSync(t, { recursive: true, force: true });
    }
    for (const bad of ["a[$(touch PWNED)]", "x"]) {
      const t = tmp(), net = await serve("2000"), mine = await serve(bad);
      const out = await run(nix.replace("http://127.0.0.1:8080", at(mine)).replace("https://koinos.armana.io", at(net)), t);
      net.close(); mine.close();
      assert.ok(!fs.existsSync(path.join(t, "PWNED")));
      assert.match(out, /Your node didn't answer yet/);
      fs.rmSync(t, { recursive: true, force: true });
    }
  } finally { me.close(); }
});

test("L-1: on Linux an ordinary folder named like the stick is not a USB stick", () => {
  const t = tmp();
  fs.writeFileSync(path.join(t, "docker"), `#!/bin/sh\necho "$*" >> "${t}/calls"\n`, { mode: 0o755 });
  fs.mkdirSync(path.join(t, "media", "me", "MYUSB"), { recursive: true });
  const linux = box("linux", "/media/$USER/MYUSB").replaceAll("/media/$USER/MYUSB", `${t}/media/$USER/MYUSB`);
  assert.match(bash(linux, t, { PATH: `${t}:${process.env.PATH}`, USER: "me" }), /STOP - no USB stick named MYUSB/);
  assert.ok(!fs.existsSync(path.join(t, "calls")), "docker never ran");
  fs.rmSync(t, { recursive: true, force: true });
});
