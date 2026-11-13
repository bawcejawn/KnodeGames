// Combo Card: last week's full board in L<week> parts (the capacity standard; owner, 13 Nov: in the Combo PR). board.json
// keeps the top 100 of last week; every row is in L<week>.json (part 0, it names the part count) and L<week>-<k>.json,
// at most 2,000 rows each. The Vault file is made from, and judged against, the parts. This takes board.json from the
// 2 MB cap at 9,000 weekly players to about 0.9 MB.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const F = await import("./repolens-fc-combo/D-R.fixtures.mjs");
const { APP, run, M, C, H1, H2, H3, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const R = await import(path.join(APP, "bot/games/combo.ts"));
const S = await import(path.join(APP, "bot/games/combo-score.mjs"));
const YML = fs.readFileSync(path.join(APP, ".github/workflows/combo.yml"), "utf8");
const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), t = M.weekStart(4) + 13 * 3600000;
const twoCards = (round) => {
  const sent = D3 * M.DAY + 2 * 3600000, r6 = D3 * 4 + 1;
  const c = (p, l2) => ({ player: p, legs: [{ code: C.WIN, round: r6, producer: H1 }, l2], time: sent, height: heightAt(sent), changes: 0 });
  return round === S0 ? [c(ALICE, { code: C.SHOW, round: r6, producer: H2 }), c(BOB, { code: C.SHOW, round: r6, producer: H3 })] : [];
};
async function record() {
  const out = tmp(), stake = (p) => (p === ALICE ? 200000000n : 0n);
  await quiet(() => run({ p: node({ t, cards: twoCards, stake }), check: node({ t, cards: twoCards, stake }), out, raceDir: raceDir(), blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: t, vhpMovesOf: async () => 0n }));
  return out;
}

test("recorder: last week's top 100 stay in board.json; every row goes in L<week> parts, and the Vault file is made from them", async () => {
  assert.deepEqual([R.LAST_TOP, R.LAST_PART_ROWS, R.lName(3), R.lName(3, 2)], [100, 2000, "L3.json", "L3-2.json"]);
  const out = await record();
  const b = read(out, "board.json"), l = read(out, "L3.json");
  assert.deepEqual(Object.keys(b.lastWeek).sort(), ["final", "parts", "rows", "start", "week"]);
  assert.equal(b.lastWeek.parts, 1);
  assert.deepEqual(Object.keys(l).sort(), ["final", "parts", "rows", "start", "v", "week"]);
  assert.deepEqual([l.v, l.week, l.start, l.final, l.parts], [1, 3, b.lastWeek.start, b.lastWeek.final, 1]);
  assert.deepEqual(b.lastWeek.rows, l.rows.slice(0, 100));
  assert.deepEqual(S.lastRows(out, 3), { final: l.final, parts: 1, rows: l.rows });
  assert.ok(fs.existsSync(path.join(out, "vault", "W3.json")));
  assert.deepEqual(read(out, "vault/W3.json").rows.map((r) => r.player), l.rows.filter((r) => r.staked === true && r.pts >= 1).map((r) => r.a));
  assert.ok(!fs.readdirSync(out).some((f) => /^L(?!3(\.|-))/.test(f)), "parts only for last week");
});

// ── the publish job on a hand-made 2,001-row week (two parts) ──
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const fake = (i) => { const h = crypto.createHash("sha256").update(`lw${i}`).digest(); let s = "1"; for (let k = 0; k < 33; k++) s += B58[h[k % 32] % 58]; return s; };
/** A recorder run, then its last week widened to n players (2,000 a part), the board's top 100 cut from it. */
async function wide(n) {
  const out = await record();
  fs.rmSync(path.join(out, "vault"), { recursive: true, force: true });
  const b = read(out, "board.json"), l0 = read(out, "L3.json"), tpl = l0.rows[0];
  const rows = [...l0.rows];
  for (let i = rows.length; i < n; i++) rows.push({ ...tpl, a: fake(i), place: i + 1, boardPlace: i + 1, pts: 1, hits: 0, best: 1, lastHit: 0, staked: false, free: true, ranked: false });
  const parts = Math.ceil(rows.length / 2000);
  for (const f of fs.readdirSync(out)) if (/^L3/.test(f)) fs.rmSync(path.join(out, f));
  for (let k = 0; k < parts; k++) {
    const chunk = rows.slice(k * 2000, (k + 1) * 2000);
    fs.writeFileSync(path.join(out, R.lName(3, k)), JSON.stringify(k ? { v: 1, week: 3, part: k, rows: chunk } : { ...l0, parts, rows: chunk }) + "\n");
  }
  b.lastWeek = { ...b.lastWeek, parts, rows: rows.slice(0, 100) };
  fs.writeFileSync(path.join(out, "board.json"), JSON.stringify(b) + "\n");
  return out;
}
/** combo.yml's publish step, verbatim except the remote; as D-C.publish.test.mjs. */
function publish(IN, remote) {
  const y = YML.split("\n");
  const i = y.findIndex((l) => l.includes("Push games-data/combo (and nothing else)")), j = y.findIndex((l, k) => k > i && l.trim() === "run: |");
  const body = y.slice(j + 1).map((l) => (l.startsWith("          ") ? l.slice(10) : l)).join("\n").replace(/remote="https:[^\n]*"/, 'remote="$REMOTE"');
  const sh = path.join(tmp(), "p.sh"); fs.writeFileSync(sh, "set -euo pipefail\n" + body);
  try { return { ok: true, out: execFileSync("bash", [sh], { env: { ...process.env, IN, REMOTE: remote, RUNNER_TEMP: tmp(), CHECK_NOW_MS: String(t + 60000) }, cwd: tmp(), stdio: "pipe" }).toString() }; }
  catch (e) { return { ok: false, out: String(e.stdout) + String(e.stderr) }; }
}
function remoteWith(dir) {
  const T = tmp(), remote = path.join(T, "r.git"); execFileSync("git", ["init", "-q", "--bare", remote]);
  const g = (d, ...a) => execFileSync("git", ["-C", d, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
  const s = path.join(T, "s"); fs.mkdirSync(s); if (dir) fs.cpSync(dir, path.join(s, "combo"), { recursive: true }); else fs.writeFileSync(path.join(s, "x"), "");
  g(s, "init", "-q"); g(s, "add", "-A"); g(s, "commit", "-qm", "s"); g(s, "push", "-q", remote, "HEAD:refs/heads/games-data");
  const r = path.join(T, "race"); fs.cpSync(raceDir(), r, { recursive: true });        // the same fixture race-data
  g(r, "init", "-q"); g(r, "add", "-A"); g(r, "commit", "-qm", "r"); g(r, "push", "-q", remote, "HEAD:refs/heads/race-data");
  return remote;
}
const asIncoming = (out) => { const IN = tmp(); fs.cpSync(out, path.join(IN, "combo"), { recursive: true }); return IN; };
const show = (remote, p) => { try { return execFileSync("git", ["--git-dir", remote, "show", `games-data:${p}`]).toString(); } catch { return null; } };
const edit = (d, f, fn) => { const j = read(d, f); fn(j); fs.writeFileSync(path.join(d, f), JSON.stringify(j) + "\n"); };

test("publish job: a two-part last week is published with its board; board.json stays small", async () => {
  const out = await wide(2001), remote = remoteWith(null);
  const r = publish(asIncoming(out), remote);
  assert.ok(!/combo\/(board|L3)/.test(r.out), r.out.slice(-600));
  assert.ok(show(remote, "combo/L3.json") && show(remote, "combo/L3-1.json") && show(remote, "combo/board.json"), r.out.slice(-600));
  assert.equal(JSON.parse(show(remote, "combo/L3-1.json")).rows.length, 1);
  assert.ok(Buffer.byteLength(show(remote, "combo/board.json")) < 40000, "the board carries only the top 100 of last week");
});

test("publish job: a missing part, a board top 100 that isn't the parts', or a part of another week is held, board and parts together", async () => {
  const held = async (f) => { const out = await wide(2001); f(out); const remote = remoteWith(null); const r = publish(asIncoming(out), remote); return { r, board: show(remote, "combo/board.json"), l0: show(remote, "combo/L3.json") }; };
  const a = await held((out) => fs.rmSync(path.join(out, "L3-1.json")));
  assert.equal(a.board, null, "missing part: the board waits"); assert.equal(a.l0, null);
  const b = await held((out) => edit(out, "board.json", (j) => { j.lastWeek.rows[0].pts += 1; }));
  assert.equal(b.board, null, "a board top 100 that isn't the parts' first rows: held");
  const c = await held((out) => edit(out, "L3.json", (j) => { j.rows.splice(500, 1); }));
  assert.equal(c.board, null, "a part that isn't the recorder's cut (part 0 one row short: a row dropped): held");
  const d = await held((out) => edit(out, "L3.json", (j) => { j.rows[5] = { ...j.rows[4] }; }));
  assert.equal(d.board, null, "a wallet twice: held");
  const e = await held((out) => fs.writeFileSync(path.join(out, "L2.json"), fs.readFileSync(path.join(out, "L3.json"))));
  assert.ok(e.board && show(remoteWith(null), "combo/L2.json") === null, "a part for another week is held alone");
});

test("publish job: published parts the week no longer has are removed; the Vault check reads every row from the published parts", async () => {
  const two = await wide(2001), remote = remoteWith(two);
  const one = await record();                              // the same week back to one part (honest: fewer rows)
  const r = publish(asIncoming(one), remote);
  assert.ok(!/held, not published: combo\/(board|L3)/.test(r.out), r.out.slice(-600));
  assert.equal(show(remote, "combo/L3-1.json"), null, "the part past the new count is removed: " + r.out.slice(-900));
  assert.ok(show(remote, "combo/L3.json"));
  assert.match(YML, /pl = l_merge\(pub, w\)/, "the Vault check's rows come from the published parts");
  assert.ok(!/rows = \{r\["a"\]: r for r in plw\["rows"\]\}/.test(YML), "never from the board's top 100 alone");
});

test("every job that reads published Combo files takes the L<week> parts too (verify job, publish job)", () => {
  const y = YML.split("\n");
  const pubLines = y.filter((l) => /git show "(FETCH_HEAD|\$parent):combo\/\$f" > "\$(RUNNER_TEMP\/pub|PUB)\/combo\/\$f"/.test(l));
  assert.equal(pubLines.length, 2, "the verify job's and the publish job's copies of the published files");
  for (const l of pubLines) assert.match(l, /L\[0-9\]\{1,6\}/, l.trim());
  assert.match(YML, /-regex "\$IN\/combo\/\\\(index.*L\[0-9\]\[0-9\]\*/, "the publish job's file filter admits L parts");
});
