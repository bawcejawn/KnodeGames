// The Daily Questions publish check (.github/workflows/games.yml, the "$IN/questions" heredoc), driven with files a bad
// or broken recorder run could hand it. Each must be HELD (with an alert unless it is only "not yet"), and the check
// must never fail the job's other games (it exits 0 and lists what it held). RECORDER_STANDARD §3, §4, §6.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildWeek, snapshotHash, type Snapshot } from "../../games/questions/recorder.ts";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const G = 1792368000000, DAY = 86400000, WK = 7 * DAY, H = 3600000;
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const S4 = G + 4 * WK, END = S4 + WK, NOW = END + 3 * H;
const SRC = (() => {
  const y = fs.readFileSync(path.join(APP, ".github/workflows/games.yml"), "utf8").split("\n");
  const a = y.findIndex((l) => l.includes(`/usr/bin/python3 - "$IN/questions" "$PUB/questions" "$HELD" <<'PY'`));
  const e = y.findIndex((l, i) => i > a && l.trim() === "PY");
  return y.slice(a + 1, e).map((l) => l.replace(/^ {10}/, "")).join("\n");
})();
const snap = (): Snapshot => ({
  week: 4, start: S4, end: END, min: "100000000", shared: true, time: NOW,
  questions: [[201, 1, S4 + DAY], [202, 2, S4 + DAY], [203, 1, S4 + 2 * DAY]],
  players: [[A, "500000000", "500000000", 0, [[201, 0], [202, 1], [203, 0]]], [B, "0", "0", 0, [[201, 0], [202, 1]]], [C, "0", "0", 0, [[201, 0], [202, 0]]]],
});
const write = (dir: string, name: string, o: any) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof o === "string" ? o : JSON.stringify(o) + "\n"); };
function check(inFiles: Record<string, any>, pubFiles: Record<string, any>, now = NOW) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "q-pub-")), inn = path.join(d, "in"), pub = path.join(d, "pub"), held = path.join(d, "held");
  fs.mkdirSync(path.join(inn, "vault"), { recursive: true }); fs.mkdirSync(path.join(pub, "vault"), { recursive: true });
  for (const [k, v] of Object.entries(inFiles)) write(inn, k, v);
  for (const [k, v] of Object.entries(pubFiles)) write(pub, k, v);
  const r = spawnSync("python3", ["-I", "-", inn, pub, held], { input: SRC, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(now) } });
  assert.equal(r.status, 0, "the check never fails the job itself (Block X still publishes): " + r.stderr);
  const lines = fs.readFileSync(held, "utf8").split("\n").filter(Boolean);
  return { held: lines.filter((x) => x !== "!alert"), alert: lines.includes("!alert"), log: r.stdout };
}
/** The honest sequence: a pending file seen at `seen`, then the final one (and its board and vault file). */
function honest(seen = NOW - 2 * H) {
  const pending = buildWeek(snap(), null, seen);
  const final = buildWeek(snap(), pending.file, NOW);
  assert.equal(final.file.final, true);
  return { pending, final };
}
const finalIn = (f: ReturnType<typeof honest>["final"]) => ({ "W004.json": f.file, "board.json": f.board, "vault/W4.json": f.vault });

test("questions publish: the honest pending run, then the honest final run, publish with nothing held", () => {
  const { pending, final } = honest();
  assert.deepEqual(check({ "W004.json": pending.file, "board.json": pending.board }, {}, NOW - 2 * H).held, []);
  const r = check(finalIn(final), { "W004.json": pending.file, "board.json": pending.board });
  assert.deepEqual(r.held, [], r.log);
  // and the next run copies the final forward unchanged
  assert.deepEqual(check({ "W004.json": final.file, "board.json": final.board }, finalIn(final)).held, []);
});

test("questions publish: a final week with no earlier published run of the same snapshot is held (alert)", () => {
  const { final } = honest();
  const r = check(finalIn(final), {});
  assert.ok(r.held.includes("questions/W004.json") && r.alert, r.log);
  assert.ok(r.held.includes("questions/vault/W4.json"), "its vault file can't go out either");
});

test("questions publish: final less than an hour after the snapshot was first seen, by the job's clock: held, not yet", () => {
  const pending = buildWeek(snap(), null, NOW - 30 * 60000);
  const forged = { ...buildWeek(snap(), pending.file, NOW).file, final: true };
  const r = check({ "W004.json": forged }, { "W004.json": pending.file });
  assert.ok(r.held.includes("questions/W004.json"));
  assert.equal(r.alert, false, r.log);
});

test("questions publish: a changed published final is held (alert)", () => {
  const { final } = honest();
  const s = snap(); s.players[1][4] = [[201, 0], [202, 0]];
  const other = { ...buildWeek(s, null, NOW).file, final: true };
  const r = check({ "W004.json": other }, finalIn(final));
  assert.ok(r.held.includes("questions/W004.json") && r.alert, r.log);
});

test("questions publish: a vault file whose rows or winners aren't the recomputed ones is held (alert)", () => {
  const { pending, final } = honest();
  for (const bad of [
    { ...final.vault, rows: [{ player: A, points: 2 }] },
    { ...final.vault, rows: [...final.vault!.rows, { player: C, points: 1 }] },
    { ...final.vault, first: [C] },
    { ...final.vault, second: [] },
  ]) {
    const r = check({ ...finalIn(final), "vault/W4.json": bad }, { "W004.json": pending.file });
    assert.ok(r.held.includes("questions/vault/W4.json") && r.alert, JSON.stringify(bad));
  }
});

test("questions publish: a vault file outside the vault's 3 days, or before its week is final, is held", () => {
  const { pending, final } = honest();
  let r = check(finalIn(final), finalIn(final), END + 3 * DAY + 1);
  assert.ok(r.held.includes("questions/vault/W4.json") && r.alert);
  r = check({ "vault/W4.json": final.vault }, { "W004.json": pending.file });
  assert.ok(r.held.includes("questions/vault/W4.json"));
});

test("questions publish: a board whose rows aren't recomputed from the week file is held (alert)", () => {
  const { pending } = honest();
  const b = structuredClone(pending.board); b.lastWeek.rows[0].points = 9; b.lastWeek.rows[0].pts = 9;
  const r = check({ "W004.json": pending.file, "board.json": b }, {}, NOW - 2 * H);
  assert.ok(r.held.includes("questions/board.json") && r.alert, r.log);
  const b2 = structuredClone(pending.board); b2.lastWeek.rows[1].ranked = true;
  assert.ok(check({ "W004.json": pending.file, "board.json": b2 }, {}, NOW - 2 * H).held.includes("questions/board.json"));
});

test("questions publish: a week file whose hash isn't its content's, or for another week, is held (alert)", () => {
  const { pending } = honest();
  const lie = structuredClone(pending.file); lie.players[2][4] = [[201, 0], [202, 1]];
  let r = check({ "W004.json": lie }, {}, NOW - 2 * H);
  assert.ok(r.held.includes("questions/W004.json") && r.alert);
  assert.equal(snapshotHash(pending.file), pending.file.seen.hash);
  r = check({ "W004.json": pending.file }, {}, NOW + WK);          // a week later: not the week that just ended
  assert.ok(r.held.includes("questions/W004.json") && r.alert);
  r = check({ "W004.json": pending.file }, {}, END - H);           // before it ends
  assert.ok(r.held.includes("questions/W004.json") && r.alert);
});

test("questions publish: answers to questions the file doesn't list are held (alert)", () => {
  const f = structuredClone(honest().pending.file);
  f.players[0][4] = [[201, 0], [202, 1], [999, 0]];
  f.seen.hash = snapshotHash(f);
  const r = check({ "W004.json": f }, {}, NOW - 2 * H);
  assert.ok(r.held.includes("questions/W004.json") && r.alert, r.log);
});

test("questions publish: HOLD and RELEASE shapes; a RELEASE needs a HOLD", () => {
  assert.deepEqual(check({ "vault/HOLD-W4.json": { game: 1, week: 4, reason: "x" } }, {}).held, []);
  let r = check({ "vault/RELEASE-W4.json": { game: 1, week: 4 } }, {});
  assert.ok(r.held.includes("questions/vault/RELEASE-W4.json") && r.alert);
  assert.deepEqual(check({ "vault/RELEASE-W4.json": { game: 1, week: 4 } }, { "vault/HOLD-W4.json": { game: 1, week: 4, reason: "x" } }).held, []);
  r = check({ "vault/HOLD-W4.json": { game: 2, week: 4, reason: "x" } }, {});
  assert.ok(r.held.includes("questions/vault/HOLD-W4.json"));
});

test("questions publish: a file it can't even read holds only Daily Questions' files, with an alert", () => {
  const r = check({ "W004.json": "{not json", "board.json": { v: 1 } }, {});
  assert.ok(r.alert);
  assert.ok(r.held.includes("questions/W004.json") && r.held.includes("questions/board.json"), r.log);
});
