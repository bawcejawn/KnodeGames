// Repo Lens #G-70: Block X's RULER_VHP_DATA is EMPTY while BLOCKX_RULER_FROM_WEEK is unset (games.yml "Push games-data" env,
// the owner's merge choice at 220b77dc). This checks that the empty value never crashes Block X's publish check and never
// stops the step (Bracket and Questions publish in the same step): with the switch unset, a ruler day file is held alone
// by the mode check before the data is ever read. Copy into tests/audit/ (it uses ./blockx-ruler.fixture.mjs) and run
// from the repository root: TZ=UTC node --import tsx --test tests/audit/g70-2-blockx-data-unset.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { R, P, timeline, X } from "./blockx-ruler.fixture.mjs";

const APP = process.env.APP || ".";
const BR = await import(path.resolve(APP, "bot/blockx-ruler.ts"));
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
const dirs = [], tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "g70-2-")); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const py = (() => {
  const runs = JSON.parse(execFileSync("python3", ["-c", "import yaml,json,sys; w=yaml.safe_load(open(sys.argv[1])); print(json.dumps([s.get('run','') for j in w['jobs'].values() for s in j['steps']]))", path.resolve(APP, ".github/workflows/games.yml")], { encoding: "utf8" }));
  const sh = runs.find((r) => r.includes('"$IN/blockx" 2 "$PUB/blockx"'));
  return sh.slice(sh.indexOf("<<'PY'\n") + 7, sh.indexOf("\nPY\n") + 1);
})();
// The workflow's value of RULER_VHP_DATA for a switch value (the expression in games.yml, evaluated as GitHub does)
const m = yml.match(/\n\s+RULER_VHP_DATA: \$\{\{ vars\.BLOCKX_RULER_FROM_WEEK != '' && format\('\{0\}\/((?:ruler-)?vhp-data)', runner\.temp\) \|\| '' \}\}\n/);
const dataEnv = (sw, runnerTemp) => { assert.ok(m, "the RULER_VHP_DATA expression"); return sw !== "" ? path.join(runnerTemp, m[1]) : ""; };
const GENESIS = 1792368000000, WEEK = 7 * 86400000, DAY = 86400000;
const write = (dir, name, obj) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), JSON.stringify(obj) + "\n"); };
function check(incoming, pub, { now, env = {} }) {
  const held = path.join(tmp(), "held"); fs.writeFileSync(held, "");
  // As the workflow: RULER_PY always set, no made-up chain (BLOCKX_RULER_TL unset)
  const r = spawnSync("python3", ["-I", "-", incoming, "2", pub, held, "blockx", "2400", "0", "12:1200:0:3"], { input: py, encoding: "utf8",
    env: { ...process.env, CHECK_NOW_MS: String(now), RULER_PY: path.resolve(APP, "vhp_ruler.py"), BLOCKX_RULER_TL: "", ...env } });
  return { code: r.status, out: r.stdout + r.stderr, held: fs.readFileSync(held, "utf8").split("\n").filter(Boolean) };
}
const W4 = GENESIS + 4 * WEEK, T_X = W4 + DAY + 6 * 3600000 + 20 * 60000;
const signer = R.ledger(timeline()).signer(X);
const target = { round: Math.floor(X / 1200), height: X, final: true, checked: 2, signer, time: T_X, lockTime: T_X - 300000, card: null,
  picks: [["1W1111111111111111111111111111111", signer, T_X - 3600000, 250, 0], ["1W2222222222222222222222222222222", P[0] === signer ? P[1] : P[0], T_X - 3600000, 0, 0]] };
const weekFile = { v: 1, week: 4, start: W4, end: W4 + WEEK, game: 12, targets: [target] };
const entry = BR.entryFor(R.ledger(timeline()), target, 100, T_X + 7200000, null);
const dayFile = (rulerFrom, mode) => ({ v: 1, week: 4, day: 1, rulerFrom, mode, shadow: mode === "shadow", targets: [entry] });
const idx = (rulerFrom) => ({ v: 1, updated: new Date(W4 + 2 * DAY).toISOString(), weeks: [4], contract: null, game: 2, prizesFromWeek: 4, rulerFrom });
const pubWith = (extra = {}) => { const p = tmp(); write(p, "W004.json", weekFile); for (const [k, v] of Object.entries(extra)) write(p, k, v); return p; };
const NOW = W4 + 2 * DAY;

test("G70: switch unset, RULER_VHP_DATA empty (the workflow's value): an ordinary run publishes, nothing held", () => {
  const rt = tmp(); assert.equal(dataEnv("", rt), "");
  const inc = tmp(); write(inc, "index.json", idx(null));
  const r = check(inc, pubWith({ "index.json": idx(null) }), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "", RULER_VHP_DATA: dataEnv("", rt) } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held, [], r.out);
});

test("G70: switch unset, RULER_VHP_DATA empty, a stray ruler day file with a card: held alone by the mode check, no crash", () => {
  const rt = tmp();
  const inc = tmp(); write(inc, "index.json", idx(null)); write(inc, "X004-1.json", dayFile(null, "off"));
  const r = check(inc, pubWith({ "index.json": idx(null) }), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "", RULER_VHP_DATA: dataEnv("", rt) } });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.held.sort(), ["!alert", "blockx/X004-1.json"], r.out);
  assert.match(r.out + r.held.join(" "), /mode|switch/i);
  assert.doesNotMatch(r.out, /vhp-data\) isn't available/, "the data was never needed");
});

test("G70: switch unset after the shadow week (G35-2), RULER_VHP_DATA empty: the step still exits 0", () => {
  const rt = tmp();
  const inc = tmp(); write(inc, "index.json", idx(null));
  const r = check(inc, pubWith({ "X004-1.json": dayFile(5, "shadow"), "index.json": idx(5) }), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "", RULER_VHP_DATA: dataEnv("", rt) } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held, [], r.out);
});

test("G70: switch 5, the shared fetch failed (no $RUNNER_TEMP/vhp-data): the new card's day file is held alone, exit 0", () => {
  const rt = tmp();   // the shared step removed the half-fetched folder ($RUNNER_TEMP/vhp-data at 220b77dc, ruler-vhp-data at d3731122)
  const inc = tmp(); write(inc, "X004-1.json", dayFile(5, "shadow"));
  const r = check(inc, pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "5", RULER_VHP_DATA: dataEnv("5", rt) } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held.sort(), ["!alert", "blockx/X004-1.json"], r.out);
  assert.match(r.held.join(" ") + r.out, /vhp-data|data/);
});
