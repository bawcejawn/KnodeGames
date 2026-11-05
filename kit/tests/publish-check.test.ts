// The kit's publish check (kit/publish/check.inline.mjs, inlined into the workflow) driven with files a bad or broken
// recorder run could hand it. Each must be HELD (with an alert unless it's only "not yet"); one game's bad files never
// stop another game; the job itself never fails on a file (it lists what it held). RECORDER §3, §4, §6.
// Ported from PR #203's questions-publish tests (Python) and the Block X / Race crafted-file classes that apply to the
// kit's generic files (BX-5, BX-79, BX-81, BX-95, BX-112, BX-122; #E-3 H-3, M-3, M-9, L-7; #E-11 H-1; #D-3 VB-1).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkGame, main, weekHash, boardOf, tally, vaultFileOf, canon, sha256 } from "../publish/check.inline.mjs";
import { exampleCfg } from "../testing/example/index.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";

const Q = exampleCfg();
const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const S4 = at(4), END = at(5), NOW = END + 3 * H;
const day = (d: number) => S4 + d * DAY;

/** A kit week file for week 4 (state, seen.at), consistent with its own hash. */
function week(state: "pending" | "final" | "open", at0: number, edit?: (j: any) => void) {
  const j: any = {
    v: 1, game: 250, week: 4, start: S4, end: END, min: "100000000", state, seen: { hash: "", at: at0 },
    rounds: [
      ["q00000201", day(0), 0, "s", [[A, 1, 0], [B, 1, 0], [C, 1, 0]]],
      ["q00000202", day(1), 0, "s", [[A, 1, 0], [B, 1, 0], [C, 0, 0]]],
      ["q00000203", day(2), 0, "s", [[A, 1, 0]]],
    ],
    players: [[A, "500000000", "500000000", 0], [B, "0", "0", 0], [C, "0", "0", 0]],
  };
  edit?.(j);
  j.seen.hash = weekHash(j);
  return j;
}
const board = (j: any, upd = new Date(NOW).toISOString()) => boardOf(j, tally(j, Q), upd);
const vault = (j: any) => vaultFileOf(j, tally(j, Q));
const put = (dir: string, name: string, v: any) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof v === "string" ? v : canon(v)); };
function check(inFiles: Record<string, any>, pubFiles: Record<string, any>, now = NOW, cfg: any = Q) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-pub-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(pub);
  for (const [k, v] of Object.entries(inFiles)) put(inn, k, v);
  for (const [k, v] of Object.entries(pubFiles)) put(pub, k, v);
  const r = checkGame(cfg, inn, pub, now);
  return { ...r, heldNames: r.held.map((h: any) => h.name), alert: r.held.some((h: any) => h.alert), why: r.held.map((h: any) => `${h.name}: ${h.why}`).join("; ") };
}
const pending = week("pending", NOW - 2 * H), final = week("final", NOW - 2 * H);
const finalIn = () => ({ "W004.json": final, "board.json": board(final), "vault/W4.json": vault(final) });

test("publish: the honest pending run, then the honest final run, publish with nothing held; then copied forward", () => {
  let r = check({ "W004.json": pending, "board.json": board(pending, new Date(NOW - 2 * H).toISOString()) }, {}, NOW - 2 * H);
  assert.deepEqual(r.held, [], r.why);
  r = check(finalIn(), { "W004.json": pending });
  assert.deepEqual(r.held, [], r.why);
  assert.deepEqual(r.publish.sort(), ["W004.json", "board.json", "vault/W4.json"]);
  r = check({ "W004.json": final, "board.json": board(final), "vault/W4.json": vault(final) }, finalIn());
  assert.deepEqual(r.held, [], r.why);
  assert.deepEqual(r.publish, ["board.json"], "an unchanged final and its vault file aren't published again");
});

test("publish: final without an earlier PUBLISHED run of the same week is held (alert)", () => {
  assert.ok(check(finalIn(), {}).alert);
  const other = week("pending", NOW - 2 * H, (j) => (j.rounds[2][4] = [[A, 0, 0]]));
  assert.ok(check(finalIn(), { "W004.json": other }).heldNames.includes("W004.json"));
  const otherAt = week("pending", NOW - 3 * H);
  assert.ok(check(finalIn(), { "W004.json": otherAt }).heldNames.includes("W004.json"), "same hash, another first-seen time");
});

test("publish: final less than an hour after first read, by the JOB's clock: held as not yet (no alert)", () => {
  const f = week("final", NOW - 30 * 60000), p = week("pending", NOW - 30 * 60000);
  const r = check({ "W004.json": f }, { "W004.json": p });
  assert.ok(r.heldNames.includes("W004.json") && !r.alert, r.why);
});

test("publish: final before Mon 00:00 or with a pending round is held (D-125)", () => {
  const early = END - H;
  const f = week("final", early - 2 * H), p = week("pending", early - 2 * H);
  assert.ok(check({ "W004.json": f }, { "W004.json": p }, early).alert);
  const open = (j: any) => (j.rounds[2][3] = "p", j.rounds[2][4] = [[A, 0, 0]]);
  const f2 = week("final", NOW - 2 * H, open), p2 = week("pending", NOW - 2 * H, open);
  assert.match(check({ "W004.json": f2 }, { "W004.json": p2 }).why, /rounds are still pending/);
});

test("publish: a changed published final is held (alert); its vault file is write-once (BX-5, BX-81, #E-11 H-1)", () => {
  const changed = week("final", NOW - 2 * H, (j) => (j.rounds[0][4][2][1] = 0));
  let r = check({ "W004.json": changed }, finalIn());
  assert.ok(r.alert && r.heldNames.includes("W004.json"), r.why);
  const v2 = { ...vault(final), rows: [] };
  r = check({ "vault/W4.json": v2 }, finalIn());
  assert.match(r.why, /write-once/);
});

test("publish: a vault file whose rows or winners aren't the recomputed ones is held (alert)", () => {
  for (const bad of [
    { ...vault(final), rows: [{ player: A, points: 255 }] },
    { ...vault(final), first: [A] },
    { ...vault(final), second: [B, C] },
    { ...vault(final), game: 2 },
  ]) {
    const r = check({ ...finalIn(), "vault/W4.json": bad }, { "W004.json": pending });
    assert.ok(r.heldNames.includes("vault/W4.json") && r.alert, JSON.stringify(bad));
    assert.ok(r.publish.includes("W004.json"), "the week file still publishes");
  }
});

test("publish: a vault file outside the vault's 3 days, or before its week is final, is held", () => {
  let r = check({ "vault/W4.json": vault(final) }, { "W004.json": pending });
  assert.ok(r.heldNames.includes("vault/W4.json") && !r.alert, "not final yet: not yet");
  r = check({ "vault/W4.json": vault(final) }, { "W004.json": final }, END + 3 * DAY + H);
  assert.ok(r.heldNames.includes("vault/W4.json") && r.alert, "past the window");
});

test("publish: a board whose rows aren't recomputed from the week file is held (alert)", () => {
  const b = board(pending, new Date(NOW).toISOString());
  b.lastWeek.rows[0].points = 9;
  const r = check({ "W004.json": pending, "board.json": b }, {});
  assert.ok(r.heldNames.includes("board.json") && r.alert);
  const b2 = board(pending, new Date(NOW + DAY).toISOString());
  assert.ok(check({ "W004.json": pending, "board.json": b2 }, {}).heldNames.includes("board.json"), "updated in the future");
});

test("publish: a week file whose hash isn't its content's, or for another week, is held (alert)", () => {
  const j = structuredClone(pending); j.rounds[0][4][0][1] = 0;
  assert.match(check({ "W004.json": j }, {}).why, /hash/);
  const w3 = week("pending", NOW - 2 * H);
  assert.ok(check({ "W003.json": w3 }, {}).alert, "named for another week");
  const old = { ...week("pending", NOW - 2 * H) };
  assert.ok(check({ "W004.json": old }, {}, NOW + 7 * DAY).alert, "not the week that just ended by the job's clock");
});

test("publish: not the recorders' own JSON form (BX-95, BX-112, BX-122) is held (alert)", () => {
  const raw = canon(pending);
  for (const bad of [raw.replace('"v":1', '"v":1.0'), raw.trimEnd(), raw.replace(/,/, ", "), JSON.stringify(pending, null, 1) + "\n", raw.replace('"game":250', '"game":250,"game":250')]) {
    const r = check({ "W004.json": bad }, {});
    assert.ok(r.heldNames.includes("W004.json") && r.alert, bad.slice(0, 60));
  }
});

test("publish: names, folders and symlinks the game may not publish are held (#E-3 M-9)", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-pub-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(path.join(inn, "vault"), { recursive: true }); fs.mkdirSync(pub);
  put(inn, "index.json", {}); put(inn, "W4.json", {}); put(inn, "nested/W004.json", {}); put(inn, "vault/W4.json.bak", {});
  fs.symlinkSync("/etc/passwd", path.join(inn, "board.json"));
  const r = checkGame(Q, inn, pub, NOW);
  assert.deepEqual(r.publish, []);
  for (const n of ["index.json", "W4.json", "nested/", "vault/W4.json.bak", "board.json"]) assert.ok(r.held.some((h: any) => h.name === n), n);
});

test("publish: Sunday rounds must be tagged fun, and a decided round can't change in a game whose rounds aren't correctable", () => {
  const sun = week("pending", NOW - 2 * H, (j) => j.rounds.push(["q00000204", day(6), 0, "s", [[A, 1, 0]]]));
  assert.match(check({ "W004.json": sun }, {}).why, /fun flag/);
  const strict = { ...Q, roundsCorrectable: false };
  const changed = week("pending", NOW - H, (j) => (j.rounds[0][4][0][1] = 0));
  assert.match(check({ "W004.json": changed }, { "W004.json": pending }, NOW, strict).why, /changes or drops published round/);
  const dropped = week("pending", NOW - H, (j) => j.rounds.pop());
  assert.match(check({ "W004.json": dropped }, { "W004.json": pending }, NOW, strict).why, /drops published round|changes or drops/);
  // Questions: an owner correction on chain may change a decided round while the week is pending.
  assert.deepEqual(check({ "W004.json": changed }, { "W004.json": pending }).held, []);
});

test("publish: HOLD and RELEASE: shapes, a RELEASE needs a HOLD and its exact code, both only ever added (#D-3 VB-1)", () => {
  const hold = { game: 250, week: 4, reason: "checking a question" };
  assert.deepEqual(check({ "vault/HOLD-W4.json": hold }, {}).held, []);
  assert.ok(check({ "vault/HOLD-W4.json": { game: 250, week: 4 } }, {}).alert);
  const rel = { game: 250, week: 4, code: sha256(hold.reason).slice(0, 16) };
  assert.deepEqual(check({ "vault/RELEASE-W4.json": rel }, { "vault/HOLD-W4.json": hold }).held, []);
  assert.ok(check({ "vault/RELEASE-W4.json": rel }, {}).alert, "no HOLD");
  assert.ok(check({ "vault/RELEASE-W4.json": { ...rel, code: "0000000000000000" } }, { "vault/HOLD-W4.json": hold }).alert, "wrong code");
  assert.ok(check({ "vault/HOLD-W4.json": { ...hold, reason: "other" } }, { "vault/HOLD-W4.json": hold }).alert, "a published HOLD never changes");
});

test("publish: one game's unreadable files hold only that game; the job lists what it publishes", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-main-")), inn = path.join(d, "in"), pub = path.join(d, "pub"), list = path.join(d, "list.txt");
  put(path.join(inn, "kit-example"), "W004.json", pending);
  put(path.join(inn, "kit-example"), "board.json", board(pending, new Date(NOW - 2 * H).toISOString()));
  put(path.join(inn, "other"), "W004.json", "{broken");
  fs.mkdirSync(pub);
  const env = { KIT_GAMES: JSON.stringify([Q, { ...Q, slug: "other", game: 99 }]), CHECK_NOW_MS: String(NOW - 2 * H) };
  const r = main([inn, pub, list], env as any);
  assert.deepEqual(fs.readFileSync(list, "utf8").split("\n").filter(Boolean).sort(), ["kit-example/W004.json", "kit-example/board.json"]);
  assert.ok(r.alert && fs.existsSync(list + ".alert"), "the broken game alerts");
  put(inn, "stray.json", {});
  const r2 = main([inn, pub, list], env as any);
  assert.ok(r2.alert, "a folder that isn't a kit game alerts");
});
