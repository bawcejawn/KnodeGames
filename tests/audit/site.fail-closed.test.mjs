// Fail-closed live load: missing deployment must not silently enter demo; SW shell must match first paint.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");

test("play page: demo only with ?demo; failed deployment shows live-error (never setupDemo as fallback)", () => {
  const js = read("app.js");
  assert.match(js, /const wantDemo = \/\[\?&\]demo\\b\/\.test\(location\.search\)/);
  assert.match(js, /showLiveError\(/);
  assert.match(js, /Couldn't load the live game config/);
  assert.match(js, /if \(wantDemo\)/);
  assert.match(js, /loadDemoScript/);
  assert.match(js, /if \(wantDemo\) \{\s*try \{ await loadDemoScript\(\); setupDemo\(\);/);
  assert.match(js, /Fail closed: never call setupDemo/);
  assert.match(js, /if \(!dep \|\| !dep\.contract \|\| !lib\.Contract\) \{\s*showLiveError/);
  assert.match(js, /if \(!ready\) return/);
  assert.doesNotMatch(js, /if \(!dep \|\| !dep\.contract[\s\S]{0,80}setupDemo\s*\(/);
  assert.match(read("index.html"), /id="live-error"/);
  assert.match(read("index.html"), /id="live-error-msg"/);
  assert.doesNotMatch(read("index.html"), /<script[^>]+demo-data\.js/);
});

test("swap page: same fail-closed rule", () => {
  const js = read("swap.js");
  assert.match(js, /showLiveError/);
  assert.match(js, /if \(wantDemo\) \{\s*setupDemo\(\);/);
  assert.match(js, /Fail closed: never call setupDemo/);
  assert.match(js, /if \(!dep \|\| !dep\.contract \|\| !lib\.Contract\) \{\s*showLiveError/);
  assert.match(js, /if \(!ready\) return/);
  assert.doesNotMatch(js, /if \(!dep \|\| !dep\.contract[\s\S]{0,80}setupDemo\s*\(/);
  assert.match(read("swap.html"), /id="live-error"/);
});

test("service worker shell includes header/stake/names scripts and excludes demo-data", () => {
  const sw = read("sw.js");
  assert.match(sw, /knode-shell-v8/);
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  for (const need of ["names.js", "header-wallet.js", "stake-panel.js", "wallet.js", "app.js", "nav.js"]) {
    assert.match(shell, new RegExp(`"${need}"`));
  }
  assert.doesNotMatch(shell, /demo-data\.js/);
});

test("site/ redirects cover names and stake", () => {
  for (const p of ["site/names.html", "site/stake.html"]) {
    assert.ok(fs.existsSync(p), p);
    assert.match(read(p), /location\.replace\("\.\.\/(names|stake)\.html"/);
    assert.match(read(p), /noindex/);
  }
});

test("admin is noindex and robots disallow /admin/", () => {
  assert.match(read("admin/index.html"), /noindex/);
  assert.match(read("robots.txt"), /Disallow:\s*\/admin\//);
});

test("WALLETS.md marks Desk treasury==owner as the overlap to fix and lists cold treasury create step", () => {
  const md = read("docs/WALLETS.md");
  assert.match(md, /treasury = owner/i);
  assert.match(md, /Cold Desk treasury/);
  assert.match(md, /1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z/);
  assert.match(md, /treasury schedule/);
  assert.match(md, /daily-cap/);
});
