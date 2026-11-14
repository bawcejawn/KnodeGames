// Red team (web attacker), fix check of Knode @ 0e75ca8: CI (.github/workflows) and dependency pinning
// (package.json + package-lock.json in /, game/, desk/).
//
// Guards (expected PASS): every action pinned to a full commit SHA; no pull_request_target / workflow_run triggers;
// no attacker-controlled ${{ github.event.* }} / head_ref expanded in a run: script; secrets used only by bot.yml's tick
// job and never in a workflow that runs on pull requests; bot.yml tick is read-only, persist-credentials false,
// npm ci --ignore-scripts; publish runs no repository code (no npm, no node <file>, no checkout of a PR ref) and only
// git-adds game-data paths; every manifest dependency is an exact version, every lock entry comes from
// registry.npmjs.org with a sha512 integrity, and each lock's root matches its package.json (so `npm ci` can't drift).
//
// Gap (expected FAIL = proof):
//  (D) OPERATOR_WIF is handed to whatever branch "Run workflow" (workflow_dispatch) is started on. GitHub runs the
//      bot.yml and the bot code OF THAT BRANCH, so anyone who can push a branch (a collaborator, a leaked PAT with
//      contents:write, a compromised GitHub App) can start the job on a branch whose bot code prints/sends the key,
//      without touching protected main. Safe: put the tick job in a GitHub Environment restricted to main
//      (environment: + deployment branch rule) or guard it with if: github.ref == 'refs/heads/main'.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";

const APP = process.env.APP || ".";
const wfDir = `${APP}/.github/workflows`;
const workflows = fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ f, y: fs.readFileSync(`${wfDir}/${f}`, "utf8") }));
const bot = workflows.find((w) => w.f === "bot.yml").y;
/** Text of one job (from "  name:" to the next job at the same indent). */
const job = (y, name) => { const m = y.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z_-]+:\\n|$)`)); return m ? m[1] : ""; };

test("(guard) every action is pinned to a full commit SHA", () => {
  const bad = [];
  for (const { f, y } of workflows) for (const m of y.matchAll(/uses:\s*([^\s#]+)/g)) if (!/^\.\/|@[0-9a-f]{40}$/.test(m[1])) bad.push(`${f}: ${m[1]}`);
  assert.deepEqual(bad, []);
});

/** The workflow's triggers: the on: value, inline (on: [issues], on: issues) or as a block, its key quoted or not,
 *  comments removed (audit PN-8: an equivalent spelling must not slip past the guard). */
const triggers = (y) => {
  const t = y.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+#.*$/, "")).join("\n") + "\nzz_end:\n";
  const m = t.match(/^["']?(?:on|true)["']?\s*:([^\n]*)\n([\s\S]*?)(?=^["']?[A-Za-z_-]+["']?\s*:)/m);
  return m ? `${m[1]}\n${m[2]}` : "";
};

test("(guard) no privileged triggers or script injection from event data", () => {
  for (const { f, y } of workflows) {
    assert.ok(!/pull_request_target|workflow_run|issue_comment/.test(y), `${f}: privileged trigger`);
    // No workflow starts from an issue (anyone can open one). names.yml reads issues on a schedule, as data.
    assert.ok(!/(^|[\s\[,{"'])(issues|discussion|discussion_comment|pull_request_review|pull_request_review_comment)(["']?\s*[:,\]}]|\s*$)/m.test(triggers(y)), `${f}: triggered by issues or comments`);
    assert.ok(!/^\s*["']?(?:on|true)["']?\s*:\s*["']?(issues|discussion)/m.test(y), `${f}: triggered by issues`);
    // A blanket write token, or every secret handed on at once, is never used (audit PN-8).
    // Any YAML spelling: plain, quoted, or a block scalar (>-, |) with write-all on the next line (Repo Lens C1-4).
    assert.ok(!/permissions:\s*(?:[>|][+-]?\s*)?["']?write-all/i.test(y), `${f}: permissions: write-all`);
    // GitHub's expression functions ignore case (toJSON, toJson, tojson); "inherit" may be quoted.
    assert.ok(!/secrets:\s*["']?inherit|tojson\(\s*secrets\s*\)|secrets\s*\[/i.test(y), `${f}: hands on all secrets`);
    assert.ok(!/\$\{\{\s*github\.(event\.(pull_request|issue|comment|review|head_commit|commits|pages|inputs)|head_ref)/.test(y), `${f}: event data expanded in the workflow`);
  }
  assert.match(triggers(bot), /schedule:/, "(the trigger parser finds bot.yml's schedule)");
});

test("(guard) no workflow holds an issues permission (R-HUB-5: the name-claim flow that read and answered issues is gone)", () => {
  for (const { f, y } of workflows) {
    const lines = [...y.matchAll(/^\s*["']?issues["']?\s*:\s*(\S+)/gm)].map((m) => m[0].trim());
    assert.deepEqual(lines, [], `${f}: issue permissions`);
  }
});

test("(guard) secrets live only in bot.yml's tick job, never in a workflow that runs on pull requests", () => {
  for (const { f, y } of workflows) {
    const uses = [...y.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);   // any case (audit PN-8)
    if (f !== "bot.yml") assert.deepEqual(uses, [], `${f} uses secrets`);
    if (/\n\s*pull_request:/.test(y)) { assert.deepEqual(uses, [], `${f}: secrets on PRs`); assert.match(y, /contents:\s*read/, `${f}: PR token must be read-only`); }
  }
  assert.ok(!/\n\s*pull_request/.test(bot) && !/\n\s*push:/.test(bot), "bot.yml must not run on pushes/PRs");
  assert.ok(job(bot, "tick").includes("OPERATOR_WIF") && !job(bot, "publish").includes("secrets."), "the key is only in tick");
});

test("(guard) bot.yml: tick is read-only and installs without scripts; publish runs no repository code", () => {
  const tick = job(bot, "tick"), pub = job(bot, "publish");
  assert.match(tick, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(tick, /persist-credentials:\s*false/);
  assert.match(tick, /npm ci\b[^\n]*--ignore-scripts/);
  assert.ok(!/npm (i|install)\b/.test(tick), "tick: npm install would ignore the lockfile");
  assert.match(pub, /permissions:\s*\n\s*contents:\s*write/);
  assert.match(pub, /persist-credentials:\s*false/);
  assert.ok(!/\bnpm\b|\bnpx\b|node\s+(?!-e\b)[\w./-]+\.(m?js|ts)|tsx\b|ref:\s*\$\{\{/.test(pub), "publish must not run repository code or check out another ref");
  assert.ok(!/actions\/cache/.test(pub), "publish must not restore a cache");
  // Only these four paths are staged (one by one, so a missing file doesn't stop the others; AB-030).
  assert.match(pub, /for p in game-data\/questions game-data\/bot-state\.json game-data\/state\.json game-data\/index\.json; do\s*\n\s*if \[ -e "\$p" \]; then git add -- "\$p"; fi/);
  assert.equal((pub.match(/git add\b/g) ?? []).length, 1, "no other git add in the publish job");
  assert.match(pub, /-type l/, "symlinks in the artifact are refused");
});

test("(D) the job that holds OPERATOR_WIF only runs for the default branch (environment rule or ref guard)", () => {
  const tick = job(bot, "tick");
  const guarded = /\n    environment:\s*\S+/.test(tick) || /github\.ref\s*==\s*'refs\/heads\/main'/.test(tick);
  assert.ok(guarded, "workflow_dispatch on any branch runs that branch's bot code with OPERATOR_WIF");
});

test("(guard) dependencies: exact versions, lock entries from npmjs with sha512, lock root matches package.json", () => {
  const bad = [];
  for (const d of ["", "game/", "desk/"]) {
    const pj = `${APP}/${d}package.json`, lj = `${APP}/${d}package-lock.json`;
    if (!fs.existsSync(pj)) continue;
    const p = JSON.parse(fs.readFileSync(pj, "utf8"));
    assert.ok(fs.existsSync(lj), `${d}package-lock.json missing`);
    const l = JSON.parse(fs.readFileSync(lj, "utf8"));
    for (const sec of ["dependencies", "devDependencies", "optionalDependencies"]) for (const [n, v] of Object.entries(p[sec] || {}))
      if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)) bad.push(`${d}package.json ${n}@${v} is not an exact version`);
    const root = l.packages && l.packages[""];
    assert.ok(root && l.lockfileVersion >= 2, `${d}: lockfile v2+`);
    for (const sec of ["dependencies", "devDependencies", "optionalDependencies"]) assert.deepEqual(root[sec] || {}, p[sec] || {}, `${d}package-lock.json root ${sec} differs from package.json (npm ci would refuse or drift)`);
    for (const [k, e] of Object.entries(l.packages)) {
      if (!k || e.link || e.inBundle) continue;
      if (!e.resolved || !e.resolved.startsWith("https://registry.npmjs.org/")) bad.push(`${d}${k}: resolved ${e.resolved}`);
      if (!e.integrity || !e.integrity.startsWith("sha512-")) bad.push(`${d}${k}: integrity ${e.integrity}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("(guard) workflows install from the lockfile (no `npm install` fallback when a lockfile exists)", () => {
  const bad = [];
  for (const { f, y } of workflows) for (const m of y.matchAll(/run:\s*(.*npm (?:i|install)\b.*)/g)) {
    const wd = (y.match(/working-directory:\s*(\S+)/) || [, ""])[1];
    const lock = `${APP}/${wd ? wd + "/" : ""}package-lock.json`;
    if (!/if \[ -f package-lock\.json \]/.test(m[1]) || !fs.existsSync(lock)) bad.push(`${f}: ${m[1].trim()}`);
  }
  assert.deepEqual(bad, []);
});

// I-022 (PN-8 / C2-4): the same rules on the parsed YAML, so no spelling (flow or block style, quotes, tags such as
// !!str, anchors and aliases, block scalars with indentation digits) can hide a trigger, a write token or the secrets.
const parsed = workflows.map(({ f, y }) => ({ f, doc: YAML.parse(y, { merge: true, maxAliasCount: 100 }) }));
const BANNED_TRIGGERS = ["issues", "issue_comment", "discussion", "discussion_comment", "pull_request_target", "workflow_run", "pull_request_review", "pull_request_review_comment"];
const triggerNames = (on) => (typeof on === "string" ? [on] : Array.isArray(on) ? on.map(String) : on && typeof on === "object" ? Object.keys(on) : []);
/** Every permissions block in a workflow (top level and each job), as { where, perm }. */
const permBlocks = (doc) => [{ where: "top", perm: doc && doc.permissions }, ...Object.entries((doc && doc.jobs) || {}).map(([j, v]) => ({ where: j, perm: v && v.permissions }))].filter((x) => x.perm !== undefined);
/** Every string in the document, keys included (GitHub evaluates ${{ }} in keys too, Repo Lens C5-12). */
const strings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(String(k)); strings(x, out); } return out; };

test("(guard, parsed YAML) no issue or privileged triggers in any spelling", () => {
  for (const { f, doc } of parsed) {
    // YAML 1.1 readers (GitHub's) turn an unquoted key `on` into true; the yaml package keeps "on". Check both.
    const on = doc && (doc.on ?? doc[true] ?? doc["true"]);
    for (const t of triggerNames(on)) assert.ok(!BANNED_TRIGGERS.includes(String(t).trim()), `${f}: trigger ${t}`);
  }
});

test("(guard, parsed YAML) no write-all, and no issue permissions anywhere", () => {
  for (const { f, doc } of parsed) for (const { where, perm } of permBlocks(doc)) {
    assert.ok(!(typeof perm === "string" && /write-all/i.test(perm)), `${f} ${where}: permissions ${perm}`);
    if (perm && typeof perm === "object") {
      for (const [k, v] of Object.entries(perm)) {
        assert.ok(["read", "write", "none"].includes(String(v).trim()), `${f} ${where}: ${k}: ${v}`);
        assert.notEqual(String(k).trim(), "issues", `${f} ${where}: issues permission`);
      }
    }
  }
});

test("(guard, parsed YAML) secrets are never handed on whole, and only bot.yml uses any", () => {
  for (const { f, doc } of parsed) {
    for (const [j, job] of Object.entries((doc && doc.jobs) || {})) assert.ok(!(job && typeof job.secrets === "string" && /inherit/i.test(job.secrets)), `${f} ${j}: secrets: inherit`);
    const all = strings(doc).join("\n");
    assert.doesNotMatch(all, /tojson\s*\(\s*secrets\s*\)|secrets\s*\[|\bsecrets\s*\}\}/i, `${f}: all secrets in an expression`);
    if (f !== "bot.yml") assert.doesNotMatch(all, /\$\{\{[^}]*\bsecrets\./i, `${f}: uses secrets`);
  }
});

// ── Repo Lens #C-5 (C5-11..C5-19): rules on GitHub's expression language, not on its spelling ──
// GitHub's ${{ }} reader ignores case and whitespace and allows brackets: `secrets . X`, `(SECRETS).X`,
// format('{0}', SECRETS.X) and toJSON((secrets)) all read secrets. So each expression is cut out properly (a } inside a
// '…' string doesn't end it), its string literals are dropped, and what's left is lower-cased with no spaces. The only way
// to reach a context is its name as an identifier, so a bare `secrets` (not after a dot) is a use of the secrets context.
/** The ${{ … }} expressions in a string, each as its tokens: lower case, no whitespace, string literals as ''. */
function expressions(str) {
  const out = [];
  for (let i = str.indexOf("${{"); i >= 0; i = str.indexOf("${{", i)) {
    let j = i + 3, body = "", q = false;
    for (; j < str.length; j++) {
      const c = str[j];
      if (q) { if (c === "'" && str[j + 1] === "'") { j++; continue; } if (c === "'") { q = false; body += "''"; } continue; }
      if (c === "'") { q = true; continue; }
      if (c === "}" && str[j + 1] === "}") break;
      body += c;
    }
    out.push(body.toLowerCase().replace(/\s+/g, ""));
    i = j + 2;
  }
  return out;
}
const exprsOf = (v) => strings(v).flatMap(expressions);
/** The secrets context used at all (C5-11): `secrets` as an identifier, not a property after a dot. */
const SECRETS_ANY = /(^|[^.\w])secrets(?![\w])/;
/** The whole secrets object (C5-12): `secrets` not followed by `.name` (toJSON((secrets)), secrets[...], (secrets).x). */
const SECRETS_WHOLE = /(^|[^.\w])secrets(?!\.[a-z_])/;
/** Data a stranger writes (C5-16): event payload fields, head_ref, or github[...] (any key, any case). */
const EVENT_DATA = /(^|[^.\w])github(\.event\.(pull_request|issue|comment|review|head_commit|commits|pages|inputs|discussion)|\.head_ref|\[)/;
/** The only triggers allowed (C5-19): strangers can't start any of these. */
const TRIGGERS_OK = ["push", "pull_request", "schedule", "workflow_dispatch", "workflow_call"];
/** Where a write token is allowed (C5-14): file → job → scopes. Everything else is read or none. */
const WRITES = {
  "bot.yml": { publish: ["contents"] },
  // games.yml publish-kit: the Shared Game Kit's publish job (kit/publish/render.mjs), rendered once a kit game exists
  // (Fantasy, #266). It pushes only kit games' folders on games-data and runs no repository code (GAME_KIT.md).
  "games.yml": { publish: ["contents"], "publish-kit": ["contents"] }, "games-testnet.yml": { publish: ["contents"] },
  "race.yml": { publish: ["contents"] }, "race-samples.yml": { publish: ["contents"] }, "names.yml": { publish: ["contents"] }, "stats.yml": { publish: ["contents"] },
  "vhp-ruler.yml": { publish: ["contents"] },   // the VHP ruler pushes only its vhp-data branch (R-RULER-1)
  "golf.yml": { publish: ["contents"] },        // Block Golf pushes only games-data/golf, like games.yml (R-GO-3)
};
const onOf = (doc) => doc && (doc.on ?? doc[true] ?? doc["true"]);
const jobsOf = (doc) => Object.entries((doc && doc.jobs) || {});

test("(guard, expressions) the secrets context, in any spelling, only in bot.yml's tick job and never whole (C5-11, C5-12)", () => {
  const bad = [];
  for (const { f, doc } of parsed) {
    for (const e of exprsOf(doc)) if (SECRETS_WHOLE.test(e)) bad.push(`${f}: all secrets at once: \${{ ${e} }}`);
    const outside = { ...doc, jobs: Object.fromEntries(jobsOf(doc).filter(([j]) => !(f === "bot.yml" && j === "tick"))) };
    for (const e of exprsOf(outside)) if (SECRETS_ANY.test(e)) bad.push(`${f}: secrets outside bot.yml's tick job: \${{ ${e} }}`);
    for (const [j, v] of jobsOf(doc)) {
      const env = v && v.environment, name = env && typeof env === "object" ? env.name : env;
      if (name != null && !(f === "bot.yml" && j === "tick")) bad.push(`${f} ${j}: environment ${JSON.stringify(name)} (the bot's key lives in an environment)`);
    }
  }
  assert.deepEqual(bad, []);
});

test("(guard, expressions) no event data or head_ref in any expression, in any spelling (C5-16)", () => {
  const bad = [];
  for (const { f, doc } of parsed) for (const e of exprsOf(doc)) if (EVENT_DATA.test(e)) bad.push(`${f}: \${{ ${e} }}`);
  assert.deepEqual(bad, []);
});

test("(guard, parsed YAML) every workflow sets read-only top-level permissions; write only where listed (C5-14)", () => {
  const bad = [];
  const check = (f, where, perm) => {
    if (typeof perm === "string") { if (!/^\s*(read-all|none)?\s*$/i.test(perm) || perm.trim() === "") bad.push(`${f} ${where}: permissions ${JSON.stringify(perm)}`); return; }
    if (!perm || typeof perm !== "object") { bad.push(`${f} ${where}: permissions ${JSON.stringify(perm)}`); return; }
    for (const [k, v] of Object.entries(perm)) {
      const scope = String(k).trim(), val = String(v).trim();
      if (val !== "write") continue;
      if (!(where !== "top" && ((WRITES[f] || {})[where] || []).includes(scope))) bad.push(`${f} ${where}: ${scope}: write`);
    }
  };
  for (const { f, doc } of parsed) {
    if (!doc || doc.permissions === undefined || doc.permissions === null) bad.push(`${f}: no top-level permissions`);
    else check(f, "top", doc.permissions);
    for (const [j, v] of jobsOf(doc)) if (v && v.permissions !== undefined) check(f, j, v.permissions);
  }
  assert.deepEqual(bad, []);
});

test("(guard, parsed YAML) every uses (steps and reusable jobs) is local, a full commit SHA, or a docker digest (C5-15)", () => {
  const bad = [];
  const ok = (u) => /^\.\//.test(u) || /^[^@\s]+@[0-9a-f]{40}$/.test(u) || /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/.test(u);
  for (const { f, doc } of parsed) for (const [j, v] of jobsOf(doc)) {
    const usesOf = (o) => Object.entries(o || {}).filter(([k]) => String(k).trim() === "uses").map(([, u]) => String(u).trim());
    for (const u of usesOf(v)) if (!ok(u)) bad.push(`${f} ${j}: ${u}`);
    for (const st of (v && Array.isArray(v.steps) ? v.steps : [])) for (const u of usesOf(st)) if (!ok(u)) bad.push(`${f} ${j}: ${u}`);
  }
  assert.deepEqual(bad, []);
});

test("(guard, parsed YAML) triggers come from an allowlist; bot.yml runs only on schedule and workflow_dispatch (C5-17, C5-19)", () => {
  const bad = [];
  for (const { f, doc } of parsed) {
    const names = triggerNames(onOf(doc)).map((t) => String(t).trim());
    if (!names.length) bad.push(`${f}: no triggers found`);
    for (const t of names) if (!TRIGGERS_OK.includes(t)) bad.push(`${f}: trigger ${t}`);
    if (f === "bot.yml") assert.deepEqual([...names].sort(), ["schedule", "workflow_dispatch"], "bot.yml triggers");
  }
  assert.deepEqual(bad, []);
});
