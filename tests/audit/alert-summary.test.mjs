// R-VAULT-9: plain-language alert summaries. bot/alert-summary.mjs matches each alert line to its row in
// .ai/platform/ALERTS.md and writes What happened / Does it matter / Expected? / What to do / Deadline to the run page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadAlertRows, matchAlert, renderSummary, writeSummary, deadlines, ALERTS_FILE } from "../../bot/alert-summary.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const rows = loadAlertRows(fs.readFileSync(ALERTS_FILE, "utf8"));

test("the catalogue is read: rows from every alert section", () => {
  assert.ok(rows.length >= 40, `only ${rows.length} rows`);
  for (const s of [2, 3, 4, 5, 6, 7, 8]) assert.ok(rows.some((r) => r.section === s), `no rows from §${s}`);
});

test("real alert lines find their rows (and the row's own action)", () => {
  const cases = [
    ["A code upgrade is scheduled (possible from 2026-11-07 05:00 UTC). If you did not do this, your admin key may be compromised.", 2, /Vault chat/],
    ["The game's owner is 1LMV8E…, not 1635QU… as in deployment.json. If you did not hand it over, your admin key is compromised.", 2, /RUNBOOK/],
    ["The pool has produced no block for 75 min (last #40,800,000).", 3, /node-status/],
    ["The bot's wallet 1HsM33… is low on Mana (1.4 left).", 3, /KOIN/],
    ["Mana sponsor: everyone's sponsored Mana today is 85% used.", 5, /fine/],
    ["Node down? No block from your personal node for 45 minutes (last block #40,000,000).", 6, /RECOVERY/],
  ];
  for (const [line, section, todo] of cases) {
    const r = matchAlert(line, rows);
    assert.ok(r, `no row for: ${line}`);
    assert.equal(r.section, section, line);
    const md = renderSummary({ workflow: "t", lines: [line], rows });
    assert.match(md, todo, line);
  }
});

test("every alert gets the five parts; an unknown one points to the Vault chat", () => {
  const md = renderSummary({ workflow: "Knode Games bot", lines: ["The bot's wallet 1HsM33… is low on Mana (1.4 left).", "something nobody catalogued"], rows });
  for (const part of ["What happened", "Does it matter", "Expected?", "What to do", "Deadline"]) assert.equal(md.split(`**${part}`).length - 1, 2, part);
  assert.match(md, /isn't in the catalogue yet: paste this line .*Vault chat/);
  assert.match(md, /stakes are never at risk/);
});

test("deadlines are shown in UTC and Pacific time", () => {
  assert.deepEqual(deadlines("results are due 2026-11-19 00:00 UTC"), ["Thu, Nov 19 00:00 UTC (Wed, Nov 18 4:00 PM PT)"]);
  assert.deepEqual(deadlines("from 2026-11-07T05:00:00.000Z"), ["Sat, Nov 7 05:00 UTC (Fri, Nov 6 9:00 PM PT)"]);
  assert.deepEqual(deadlines("no time here"), []);
});

test("no alert lines: the step-failed fallback names the section to read", () => {
  const md = renderSummary({ workflow: "Producer race", lines: [], rows, section: 8 });
  assert.match(md, /failed without a known alert line/);
  assert.match(md, /ALERTS\.md` §8/);
});

test("a failing run shows the summary: the CLI appends it to $GITHUB_STEP_SUMMARY and exits 0", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alert-summary-"));
  const out = path.join(dir, "summary.md");
  const p = spawnSync(process.execPath, [path.join(root, "bot/alert-summary.mjs"), "--workflow", "Knode Games bot", "Week 3 is overdue to close"], { env: { ...process.env, GITHUB_STEP_SUMMARY: out }, encoding: "utf8" });
  assert.equal(p.status, 0, p.stderr);
  const md = fs.readFileSync(out, "utf8");
  assert.match(md, /## Knode Games bot: what needs your attention/);
  assert.match(md, /Week 3 is overdue to close/);
  assert.match(md, /wait one run; then Vault chat/);
});

test("a broken catalogue never breaks the alert itself", () => {
  const md = writeSummary({ workflow: "x", lines: ["anything"], alertsFile: "/nonexistent/ALERTS.md", env: {}, print: () => {} });
  assert.match(md, /isn't in the catalogue yet/);
});

test("wired in: the bot, the watchdog, the heal alert and every game workflow write a summary on failure", () => {
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  assert.match(read("bot/bot.ts"), /writeSummary\(\{ workflow: "Knode Games bot", lines: ctx\.problems/);
  assert.match(read("bot/watch.mjs"), /writeSummary\(\{ workflow: "Node watchdog"/);
  assert.match(read(".github/workflows/heal-alert.yml"), /GITHUB_STEP_SUMMARY/);
  for (const f of ["games", "race", "race-samples", "names"]) {
    const y = read(`.github/workflows/${f}.yml`);
    assert.match(y, /\n  summary:\n[\s\S]*if: \$\{\{ failure\(\) \}\}[\s\S]*node bot\/alert-summary\.mjs --workflow "\$WORKFLOW_NAME" --section 8/, f);
  }
});
