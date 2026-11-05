// Visit counting (owner, 4 Nov: PostHog, cookieless, for advertising numbers). The library is our own pinned copy, so no
// outside code runs on pages where wallets sign; the settings count page views only and store nothing in the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const APP = process.env.APP || ".";
const read = (f) => fs.readFileSync(`${APP}/${f}`, "utf8");
const LIB = "vendor/posthog-1.438.13.js";
const pages = fs.readdirSync(APP).filter((f) => f.endsWith(".html"));

test("the PostHog library is the pinned posthog-js 1.438.13 no-external build, byte for byte", () => {
  const sha = crypto.createHash("sha256").update(fs.readFileSync(`${APP}/${LIB}`)).digest("hex");
  assert.equal(sha, "e34e0d0f3d35be2924f96d24c6c3c2d974cd5e9d2bddbc47c38c375c13432ee3");
});

test("settings: cookieless always, page views only, nothing extra loaded or recorded, only on knodegames.com", () => {
  const js = read("analytics.js");
  for (const want of [/cookieless_mode: "always"/, /autocapture: false/, /disable_session_recording: true/, /disable_surveys: true/, /disable_web_experiments: true/,
    /capture_heatmaps: false/, /capture_dead_clicks: false/, /rageclick: false/, /capture_performance: false/, /disable_external_dependency_loading: true/,
    /api_host: "https:\/\/us\.i\.posthog\.com"/, /person_profiles: "identified_only"/]) assert.match(js, want);
  assert.match(js, /if \(!\/\(\^\|\\\.\)knodegames\\\.com\$\/\.test\(location\.hostname\)\) return;/, "only the live site counts");
  const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\.identify\(|\.capture\(|\.register\(|address|wallet\.|KWallet/, "no one is identified and nothing else is sent");
  assert.match(js, /phc_[A-Za-z0-9]{40,}/, "the project's public key");
});

test("every public page loads the pinned copy then analytics.js last, and allows only us.i.posthog.com for it; testnet pages don't count", () => {
  for (const p of pages) {
    const h = read(p);
    if (/<meta name="kg-network" content="testnet">/.test(h)) { assert.doesNotMatch(h, /posthog|analytics\.js/, `${p}: testnet pages don't count`); continue; }
    assert.match(h, /<script src="vendor\/posthog-1\.438\.13\.js"><\/script>\s*<script src="analytics\.js"><\/script>\s*<\/body>/, `${p}: counter at the end`);
    assert.doesNotMatch(h, /<script[^>]+src="https:\/\/[^"]*posthog/, `${p}: never PostHog's own hosted script`);
    const csp = h.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
    assert.match(csp, /connect-src [^;]*https:\/\/us\.i\.posthog\.com/, `${p}: connect-src`);
    assert.doesNotMatch(csp, /script-src [^;]*posthog/, `${p}: no PostHog script host`);
  }
});

test("Terms say what is counted", () => {
  assert.match(read("terms.html"), /We count visits without cookies/);
});
