// Who Signs Block X on the VHP ruler: the publish job's checks (.github/workflows/games.yml, the Block X step): the
// embedded vhp_ruler.py, the day files X<week>-<d>.json (switch, mode, entries vs the week file, every new card rebuilt
// from Block X's own settings, every point recounted in Python), a refused switch change, an ON week's board recounted,
// and Repo Lens #G-3 G3-1 (PRIZES_FROM_WEEK). The cards are the recorder's (bot/blockx-ruler.ts) on a made-up chain the
// Python reads too, so a passing check is also JS = Python on the scoring.
// Run: node --import tsx --test tests/audit/blockx-ruler-publish.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { R, P, VHP, timeline, timelineJson, LOCK, X } from "./blockx-ruler.fixture.mjs";

const APP = process.env.APP || ".";
const BR = await import(path.resolve(APP, "bot/blockx-ruler.ts"));
const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
const dirs = [], tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "bx-ruler-pub-")); dirs.push(d); return d; };
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

// The Block X publish step's Python, exactly as the workflow runs it.
const py = (() => {
  const runs = JSON.parse(execFileSync("python3", ["-c", "import yaml,json,sys; w=yaml.safe_load(open(sys.argv[1])); print(json.dumps([s.get('run','') for j in w['jobs'].values() for s in j['steps']]))", path.resolve(APP, ".github/workflows/games.yml")], { encoding: "utf8" }));
  const sh = runs.find((r) => r.includes('"$IN/blockx" 2 "$PUB/blockx"'));
  return sh.slice(sh.indexOf("<<'PY'\n") + 7, sh.indexOf("\nPY\n") + 1);
})();
const GENESIS = 1792368000000, WEEK = 7 * 86400000, DAY = 86400000;
const TL = (() => { const f = path.join(tmp(), "tl.json"); fs.writeFileSync(f, timelineJson()); return f; })();
const L0 = R.ledger(timeline());
const write = (dir, name, obj) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), JSON.stringify(obj) + "\n"); };
function check(incoming, pub, { now, env = {} }) {
  const held = path.join(tmp(), "held"); fs.writeFileSync(held, "");
  const r = spawnSync("python3", ["-I", "-", incoming, "2", pub, held, "blockx", "2400", "0", "12:1200:0:3"], { input: py, encoding: "utf8",
    env: { ...process.env, CHECK_NOW_MS: String(now), RULER_PY: path.resolve(APP, "vhp_ruler.py"), BLOCKX_RULER_TL: TL, ...env } });
  return { code: r.status, out: r.stdout + r.stderr, held: fs.readFileSync(held, "utf8").split("\n").filter(Boolean) };
}

// One hourly target of vault week 4 (Tue 17 Nov 06:20 UTC) at the fixture's block X, signed as the chain says.
const W4 = GENESIS + 4 * WEEK, T_X = W4 + DAY + 6 * 3600000 + 20 * 60000;
const signer = R.ledger(timeline()).signer(X);
const target = { round: Math.floor(X / 1200), height: X, final: true, checked: 2, signer, time: T_X, lockTime: T_X - 300000, card: null,
  picks: [["1W1111111111111111111111111111111", signer, T_X - 3600000, 250, 0], ["1W2222222222222222222222222222222", P[0] === signer ? P[1] : P[0], T_X - 3600000, 0, 0]] };
const weekFile = { v: 1, week: 4, start: W4, end: W4 + WEEK, game: 12, targets: [target] };
const entry = (L = L0) => BR.entryFor(L, target, 100, T_X + 7200000, null);
const dayFile = (rulerFrom, mode, e = entry()) => ({ v: 1, week: 4, day: 1, rulerFrom, mode, shadow: mode === "shadow", targets: [e] });
const pubWith = (extra = {}) => { const p = tmp(); write(p, "W004.json", weekFile); for (const [k, v] of Object.entries(extra)) write(p, k, v); return p; };
const NOW = W4 + 2 * DAY;   // Wed 18 Nov: vault week 4 is running

test("the publish job embeds vhp_ruler.py byte for byte (tools/blockx-ruler-embed.mjs), so it runs no repository code", () => {
  const ind = "          ", a = yml.indexOf(ind + "# BEGIN vhp_ruler.py\n"), b = yml.indexOf(ind + "# END vhp_ruler.py\n");
  assert.ok(a > 0 && b > a);
  const body = yml.slice(a + ind.length + "# BEGIN vhp_ruler.py\n".length, b).split("\n").map((l) => (l.startsWith(ind) ? l.slice(ind.length) : l)).join("\n");
  assert.equal(body, fs.readFileSync(path.join(APP, "vhp_ruler.py"), "utf8"), "run: node tools/blockx-ruler-embed.mjs");
  // (Repo Lens #G-35 G35-2: the code is written on every run; only the data waits for the switch, tested below)
  // (Bracket #285 merged second: the one shared step is "The VHP ruler's code and data (Block X and the Producer Bracket)")
  assert.match(yml, /- name: The VHP ruler's code and data \(Block X and the Producer Bracket\)\n(?:\s+#[^\n]*\n)+\s+run: \|\n\s+set -euo pipefail\n\s+mkdir -p "\$RUNNER_TEMP\/ruler-code"/);
});

test("settings: the publish job's are the recorder's (game 2, c 500000, minK 10, spot, min, paying, the Vault; lead 100, 7,200-block windows, ×120, base 100, the 1-hour band)", () => {
  const g = JSON.parse(yml.match(/RULER_GAME = (\{[^\n]*\})   #/)[1].replace(/True/g, "true"));
  assert.deepEqual(g, { ...BR.RULER, pooled: [...BR.RULER.pooled] });
  assert.match(yml, /RULER_LEAD, RULER_CARD, RULER_SIZE, RULER_CAP, RULER_BASE, RULER_VOID, RULER_WAIT = 100, 7200, 7200, 120, 100, 1200, 3 \* 86400000\n/);
  assert.equal(BR.CARD_BLOCKS, 7200); assert.equal(BR.SIZE_BLOCKS, 7200); assert.equal(BR.CAP, 120n); assert.equal(BR.BASE, 100n); assert.equal(BR.VOID_BLOCKS, 1200); assert.equal(BR.RULER_WAIT_MS, 3 * DAY);
  assert.match(yml, /BLOCKX_RULER_FROM_WEEK: \$\{\{ vars\.BLOCKX_RULER_FROM_WEEK \}\}\n\s+BLOCKX_VHP_DATA: /, "the recorder gets the switch and the data");
});

test("a shadow day file passes: the card is rebuilt from Block X's own settings and its points recounted in Python (JS = Python)", () => {
  const e = entry();
  assert.ok(e.card, e.note || ""); assert.ok(e.points > 0 || e.void);
  const inc = tmp(); write(inc, "X004-1.json", dayFile(5, "shadow", e));
  const r = check(inc, pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "5" } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held, [], r.out);
});

test("a void entry (VHP moved out of the 1-hour band after the card) is recounted as void in Python too", () => {
  const card = JSON.parse(entry().card), own = BigInt(card.producers.find((p) => p.a === signer).own);
  const moves = [{ h: card.T + 5, a: signer, v: -own / 5n }], LV = R.ledger(timeline(moves)), e = entry(LV);
  assert.equal(e.void, true); assert.equal(e.points, 0);
  const tlv = path.join(tmp(), "tlv.json"); fs.writeFileSync(tlv, timelineJson(moves));
  const inc = tmp(); write(inc, "X004-1.json", dayFile(5, "shadow", e));
  const r = check(inc, pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "5", BLOCKX_RULER_TL: tlv } });
  assert.deepEqual(r.held, [], r.out);
  // and the honest card's points claimed on the moved chain are refused
  const inc2 = tmp(); write(inc2, "X004-1.json", dayFile(5, "shadow", { ...e, void: false, points: 777 }));
  const r2 = check(inc2, pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "5", BLOCKX_RULER_TL: tlv } });
  assert.ok(r2.held.includes("blockx/X004-1.json"), r2.out); assert.match(r2.out, /points aren't the card's/);
});

test("held alone (with an alert): changed points, a card the data doesn't give, another switch value, a wrong lock or round, a changed published entry, a void before the 3-day wait", () => {
  const e = entry(), env = { BLOCKX_RULER_FROM_WEEK: "5" };
  const heldFor = (day, pub = pubWith()) => { const inc = tmp(); write(inc, "X004-1.json", day); return check(inc, pub, { now: NOW, env }); };
  const cases = [
    [dayFile(5, "shadow", { ...e, points: e.points + 1 }), /points aren't the card's/],
    [dayFile(5, "shadow", { ...e, card: e.card.replace(/"T":(\d+)/, (m, t) => `"T":${Number(t) + 1}`) }), /the ruler's data doesn't give this card/],
    [dayFile(6, "shadow", e), /switch as set/],
    [dayFile(5, "on", e), /mode isn't the switch's/],
    [dayFile(5, "shadow", { ...e, lock: e.lock - 1 }), /lock, round or window/],
    [dayFile(5, "shadow", { ...e, cardRound: "2026111700" }), /lock, round or window/],
    [dayFile(5, "shadow", { ...e, signer: P[15] }), /round, signer or day/],
    [dayFile(5, "shadow", { ...e, card: null, points: 0, void: true, why: "x", note: "x" }), /before the ruler's 3-day wait/],
  ];
  for (const [day, why] of cases) {
    const r = heldFor(day);
    assert.ok(r.held.includes("blockx/X004-1.json") && r.held.includes("!alert"), why + "\n" + r.out); assert.match(r.out, why);
  }
  // a published entry with a card never changes
  const pub = pubWith({ "X004-1.json": dayFile(5, "shadow", e) });
  const r = heldFor(dayFile(5, "shadow", { ...e, note: "changed" }), pub);
  assert.match(r.out, /a published ruler entry would change/);
});

test("the switch: a change that would change how a started week is scored stops the whole publish; shadow → off is allowed", () => {
  // unset → 4 during vault week 4: week 4 (started) would become ON: refused, nothing published
  const inc = tmp(); write(inc, "X004-1.json", dayFile(4, "on"));
  const r = check(inc, pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "4" } });
  assert.notEqual(r.code, 0); assert.match(r.out, /ruler switch change is refused/);
  // 5 (week 4 shadow) → unset: allowed (shadow counts for nothing)
  const r2 = check(tmp(), pubWith({ "X004-1.json": dayFile(5, "shadow") }), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "" } });
  assert.equal(r2.code, 0, r2.out);
  // anything that isn't a plain week number stops the run
  const r3 = check(tmp(), pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "05" } });
  assert.notEqual(r3.code, 0); assert.match(r3.out, /must be empty or a vault week number/);
});

test("an ON week's board is recounted from the week file and the ruler entries; a mismatch, or final before every target is scored, holds the board, prize and vault files", () => {
  const e = entry(), pub = pubWith({ "X004-1.json": dayFile(4, "on", e) });   // the switch was set to 4 during week 3
  const NOW5 = GENESIS + 5 * WEEK + 3600000, env = { BLOCKX_RULER_FROM_WEEK: "4" };
  const pts1 = e.void ? 0 : e.points;
  const row = (a, pts) => ({ a, place: 1, boardPlace: 1, pts, correct: pts > 0 ? 1 : 0, picks: 1, days: 1, lastCorrect: 0, ranked: false });
  const board = (rows, final = true) => ({ v: 1, updated: new Date(NOW5).toISOString(), today: { day: "", rows: [] }, week: { week: 5, start: GENESIS + 5 * WEEK, rows: [] }, lastWeek: { week: 4, start: W4, final, rows, prizes: [] }, allTime: { rows: [] } });
  const ok = tmp(); write(ok, "board.json", board([row(target.picks[0][0], pts1), row(target.picks[1][0], 0)]));
  const r = check(ok, pub, { now: NOW5, env });
  assert.ok(!r.held.includes("blockx/board.json"), r.out);
  const bad = tmp(); write(bad, "board.json", board([row(target.picks[0][0], 250), row(target.picks[1][0], 0)])); write(bad, "P004.json", { v: 1, week: 4, game: 2, at: new Date(NOW5).toISOString(), prizes: [] });
  const rb = check(bad, pub, { now: NOW5, env });
  assert.ok(rb.held.includes("blockx/board.json") && rb.held.includes("blockx/P004.json"), rb.out); assert.match(rb.out, /points aren't the ruler's/);
  // not scored yet but final: held
  const pubWait = pubWith({ "X004-1.json": dayFile(4, "on", { ...e, card: null, points: 0, void: false, note: "not yet: the ruler's data reaches block 1" }) });
  const early = tmp(); write(early, "board.json", board([], true));
  const re = check(early, pubWait, { now: NOW5, env });
  assert.ok(re.held.includes("blockx/board.json"), re.out); assert.match(re.out, /final before the ruler scored every target/);
});

test("Repo Lens #G-3 G3-1: with PRIZES_FROM_WEEK set but not a plain week number, a new prize file or vault file is held (alert)", () => {
  const inc = tmp(); write(inc, "P004.json", { v: 1, week: 4, game: 2, at: new Date(NOW).toISOString(), prizes: [] });
  write(inc, "vault/W4.json", { game: 2, week: 4, final: true, rows: [], first: [], second: [] });
  for (const bad of ["", "four", "04x", " "]) {
    const r = check(inc, pubWith(), { now: NOW, env: { PRIZES_FROM_WEEK: bad } });
    assert.ok(r.held.includes("blockx/P004.json") && r.held.includes("blockx/vault/W4.json") && r.held.includes("!alert"), JSON.stringify(bad) + r.out);
    assert.match(r.out, /PRIZES_FROM_WEEK isn't a plain week number \(G3-1\)/);
  }
  const good = check(inc, pubWith(), { now: NOW, env: { PRIZES_FROM_WEEK: "4" } });
  assert.doesNotMatch(good.out, /G3-1/, "a plain week number: the usual checks only");
});

test("the publish job lets the day files through and reads the published ones back", () => {
  assert.match(yml, /\\\|X\[0-9\]\[0-9\]\[0-9\]-\[0-6\]\\\)\\\.json"/, "the file allow-list");
  assert.match(yml, /\^\(board\|index\|P\[0-9\]\{3\}\|W\[0-9\]\{3\}\|X\[0-9\]\{3\}-\[0-6\]\)\\\.json\$/, "the published files read back");
  void VHP; void LOCK;
});

// ── Repo Lens #G-35 ──
test("G35-1: the recorder gets the day files back, and an entry with a card or a void is kept as published (never made again)", () => {
  assert.match(yml, /\^\(index\|board\|W\[0-9\]\{3\}\|P\[0-9\]\{3\}\|X\[0-9\]\{3\}-\[0-6\]\)\\\.json\$ \]\]; then git show "FETCH_HEAD:blockx\/\$f" > "\$RUNNER_TEMP\/prev\/blockx\/\$f"/, "the record job fetches X files");
  const old = { ...entry(), card: null, points: 0, void: true, why: "the ruler couldn't score this target within 3 days: no pick on it counts", note: "not yet: x" };
  // a run whose data could now make the card still keeps the published void entry
  assert.deepEqual(BR.entryFor(L0, target, 100, T_X + 9 * DAY, old), old);
  const withCard = entry();
  assert.deepEqual(BR.entryFor(null, target, 100, T_X + 9 * DAY, withCard), withCard, "and one with a card, even with no data this run");
});

test("G35-2: the ruler's code is written on every run; with the switch unset after a ruler file was published, the publish still runs", () => {
  assert.match(yml, /- name: The VHP ruler's code and data \(Block X and the Producer Bracket\)\n(?:\s+#[^\n]*\n)+\s+run: \|/, "no `if:` on the code step");
  assert.match(yml, /RULER_PY: \$\{\{ format\('\{0\}\/ruler-code\/vhp_ruler\.py', runner\.temp\) \}\}/, "RULER_PY always set");
  // published: a shadow day file and index.json with rulerFrom 5; this run: the switch unset, no new day file
  const idx = (rulerFrom) => ({ v: 1, updated: new Date(NOW).toISOString(), weeks: [4], contract: null, game: 2, prizesFromWeek: 4, rulerFrom });
  const pub = pubWith({ "X004-1.json": dayFile(5, "shadow"), "index.json": idx(5) });
  const inc = tmp(); write(inc, "index.json", idx(null));
  const r = check(inc, pub, { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "" } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held, [], r.out);
  // the previous value comes from index.json: 4 published (week 4 ON), now unset during week 4: refused
  const pub4 = pubWith({ "index.json": idx(4) });
  const r4 = check(tmp(), pub4, { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "" } });
  assert.notEqual(r4.code, 0); assert.match(r4.out, /ruler switch change is refused/);
  // an index.json made with another switch value than the variable's is held alone, with an alert (Repo Lens #G-49 G49-2)
  const bad = tmp(); write(bad, "index.json", idx(6));
  const rb = check(bad, pubWith({ "index.json": idx(5) }), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "5" } });
  assert.equal(rb.code, 0, rb.out); assert.ok(rb.held.includes("blockx/index.json") && rb.held.includes("!alert"), rb.out); assert.match(rb.out, /ruler switch as set/);
});

test("G35-5: a failed vhp-data fetch never stops the recorder or the publish (the ruler waits)", () => {
  assert.match(yml, /- name: Take the VHP ruler's data\n(?:\s+#[^\n]*\n)+\s+if: \$\{\{ vars\.BLOCKX_RULER_FROM_WEEK != '' \}\}\n\s+continue-on-error: true/);
  // the publish job's fetch is in the shared step (Bracket #285, Repo Lens #G-48 G48-2): tolerant, a warning on failure
  assert.match(yml, /else\n\s+rm -rf "\$RUNNER_TEMP\/ruler-vhp-data"\n\s+echo "::warning::Couldn't fetch the vhp-data branch this run/);
  // no data: a day file with a new card is held alone, the rest publishes
  const inc = tmp(); write(inc, "X004-1.json", dayFile(5, "shadow"));
  const r = check(inc, pubWith(), { now: NOW, env: { BLOCKX_RULER_FROM_WEEK: "5", BLOCKX_RULER_TL: "", RULER_VHP_DATA: path.join(tmp(), "missing") } });
  assert.equal(r.code, 0, r.out); assert.deepEqual(r.held.sort(), ["!alert", "blockx/X004-1.json"], r.out);
});

test("G35-4: in an ON week the page shows the ruler's points, not the week file's", () => {
  const js = fs.readFileSync(path.join(APP, "blockx.js"), "utf8");
  assert.match(js, /const shownPts = \(t, p\) => \{\n    const e = rulerOn\.get\(t\.height\);\n    if \(!e\) return weekOn\(t\) \? undefined : p\[3\];[^\n]*\n    if \(!e\.card && !e\.void\) return undefined;\n    return !e\.void && p\[1\] === e\.signer \? e\.points : 0;/);
  assert.match(js, /const pp = p \? shownPts\(t, p\) : 0, right = p && pp > 0;/);
  assert.match(js, /const sp = \(t\.picks \|\| \[\]\)\.map\(\(x\) => shownPts\(t, x\)\);/);
  assert.match(js, /sp\.some\(\(x\) => x === undefined\) \? "being scored by the ruler"/, "G49-3: no \"0 of N right\" while waiting");
  assert.match(js, /for \(const j of files\) if \(modeAt\(j\.week, j\.mode\) === "on" && j\.mode === "on"\) for \(const e of j\.targets\) rulerOn\.set\(e\.height, e\);/, "only ON files, never shadow");
  assert.match(js, /\$\("mult-sub"\)\.textContent = rulerOn\.size\n/, "the old multiplier table is marked reference-only in an ON week");
});
