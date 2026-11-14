// Repo Lens #B-10 (the Fantasy fix-check of the old #188 at a60da0b), ported to Fantasy on the Shared Game Kit (#266).
// The original file (b10-failing-tests.zip: tests/audit/fantasy-repolens-b10.test.mjs) tested fantasy-math.js and a
// hand-written Fantasy publish step in games.yml; neither exists any more: the kit's runtime and publish check
// (kit/publish/check.inline.mjs) replaced them, built to close these findings. Each finding is re-asked here of the real
// Fantasy module through the kit's own Replay and publish check, by the same FC number; the few that are the kit's alone
// point at the kit test that covers them. Repo Lens #G-69 G69-5: each reason is asserted; g69-b10-reasons.test.mts (Repo
// Lens's, unchanged) builds FC-4, FC-8 and FC-15 so only the named rule can catch them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { game } from "../recorder.ts";
import { Replay } from "../../../kit/testing/replay.ts";
import { fakeNode, world } from "../../../kit/testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../../../kit/testing/fake-clock.ts";
import { checkGame, paidSet, vaultValues, contractWinners, freePlaces, MAX_PER_PLACE } from "../../../kit/publish/check.inline.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1", LEFT = "1LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL1";
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor!(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const cfg: any = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true };
const T0 = at(0) - 30 * DAY, libAt = (t: number) => Math.floor((t - T0) / 3000) - 60;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "fx-b10-"));

/** Week 4 on fake nodes: GOOD stays staked; LEFT withdrew mid-week (week_stake 0, peak_stake 5 VHP). */
async function weekFour(tamper?: (pub: string) => void) {
  const wd: any = world(at(4) - 2 * DAY + H);
  wd.blockT0 = T0;
  const tick = (t: number) => { wd.time = t; wd.lib = libAt(t); };
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" }, [LEFT]: { week_stake: "0", peak_stake: "500000000" } };
  const team = { producers: P.slice(0, 5), time: String(at(4) - 600000) };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: team }, { player: LEFT, pick: team }] };
  const rp = new Replay(m as any, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)] as any;
  const run = async (t: number) => { tick(t); return rp.hour(nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); };
  const h0 = await run(wd.time);
  assert.equal(h0.error, undefined, h0.error);
  assert.ok(rp.read("inputs/W4.json"));
  tamper?.(rp.pub);
  const hours: any[] = [];
  for (let k = 0; k < 8; k++) { const h = await run(at(5, 0, 2 + k)); hours.push(h); if (h.result?.state === "final") break; }
  return { rp, hours };
}
const copyOf = (pub: string, files: string[], edit?: (rel: string, j: any) => any) => {
  const d = tmp();
  for (const f of files) { const j = JSON.parse(fs.readFileSync(path.join(pub, f), "utf8")); fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), JSON.stringify(edit ? edit(f, j) : j) + "\n"); }
  return d;
};
/** The reason the publish check gave for holding `name` (and never "its ruler cards", so a test can't pass for that). */
const whyHeld = (r: any, name: string) => { const h = r.held.find((x: any) => x.name === name); assert.ok(h, `${name} held (published: ${r.publish})`); assert.doesNotMatch(h.why, /G3|ruler cards/); return h.why; };
const empty = () => { const d = tmp(); fs.mkdirSync(path.join(d, "vault"), { recursive: true }); return d; };
/** The published folder with only week 4's price list in it (published before the week, as it was). */
const withList = () => { const d = copyOf(honest.rp.pub, ["inputs/W4.json"]); fs.mkdirSync(path.join(d, "vault"), { recursive: true }); return d; };

let honest: Awaited<ReturnType<typeof weekFour>>;
test.before(async () => { honest = await weekFour(); });

test("control: the honest week 4 goes final through the real publish check, with its vault file", () => {
  assert.equal(honest.hours.at(-1)?.result?.state, "final");
  assert.equal(honest.rp.read("W004.json").state, "final");
  assert.ok(honest.rp.read("vault/W4.json"));
});

test("FC-4 (High): a final week and vault file are refused on Tuesday of the week itself (the job's own clock decides)", () => {
  const out = copyOf(honest.rp.pub, ["W004.json", "vault/W4.json"]);
  const r = checkGame(cfg, out, withList(), at(4, 1, 1), "", null);
  assert.ok(!r.publish.includes("W004.json") && !r.publish.includes("vault/W4.json"), `published early: ${r.publish}`);
  assert.equal(whyHeld(r, "W004.json"), "seen in the future by this job's clock");
});

test("FC-4: start/end moved a week back are refused (they must follow the week number)", () => {
  const out = copyOf(honest.rp.pub, ["W004.json"], (_f, j) => ({ ...j, start: j.start - 7 * DAY, end: j.end - 7 * DAY }));
  const r = checkGame(cfg, out, withList(), at(5, 1), "", null);
  assert.ok(!r.publish.includes("W004.json"), `published: ${r.publish}`);
  assert.equal(whyHeld(r, "W004.json"), "wrong start or end for that week");
});

test("FC-8 (Medium): no one-run final: a final week with no published pending copy is not published", () => {
  const out = copyOf(honest.rp.pub, ["W004.json"]);
  const r = checkGame(cfg, out, withList(), at(5, 1, 6), "", null);
  assert.ok(!r.publish.includes("W004.json"), `published: ${r.publish}`);
  assert.match(whyHeld(r, "W004.json"), /new content first read long before this run|final without an earlier published run/);
});

test("FC-15 (Low): a published final week re-sent with \"v\": true is refused (no silent change of a final)", () => {
  const pub = copyOf(honest.rp.pub, ["W004.json", "inputs/W4.json"]);
  const out = copyOf(honest.rp.pub, ["W004.json"], (_f, j) => ({ ...j, v: true }));
  const r = checkGame(cfg, out, pub, at(5, 2), "", null);
  assert.ok(!r.publish.includes("W004.json"), `published: ${r.publish}`);
  assert.equal(whyHeld(r, "W004.json"), "wrong version or game");
});

test("FC-9 (Medium): a price list long before its window (8 days ahead) is held", () => {
  const out = copyOf(honest.rp.pub, ["inputs/W4.json"], (_f, j) => ({ ...j, week: 6 }));
  fs.renameSync(path.join(out, "inputs/W4.json"), path.join(out, "inputs/W6.json"));
  const r = checkGame(cfg, out, empty(), at(6) - 8 * DAY, "", null);
  assert.ok(!r.publish.includes("inputs/W6.json"), `published: ${r.publish}`);
  assert.match(whyHeld(r, "inputs/W6.json"), /more than a week before its week/);
});

test("FC-9 (Medium): a tampered price list (a producer twice, budget 1000) is caught by the recount: the week stays pending, alerted", async () => {
  const bad = await weekFour((pub) => {
    const f = path.join(pub, "inputs/W4.json"), j = JSON.parse(fs.readFileSync(f, "utf8"));
    j.data.budget = 1000; j.data.pool = [...j.data.pool, { ...j.data.pool[0] }];
    fs.writeFileSync(f, JSON.stringify(j) + "\n");
  });
  const last = bad.hours.at(-1);
  assert.equal(last.result?.state, "pending");
  assert.ok(last.result.alerts.errors.some((x: string) => /inputs recount differs/.test(x)), last.result.alerts.errors.join(" | "));
  assert.equal(bad.rp.read("vault/W4.json"), null);
});

test("FC-1 (High): a staker who withdrew mid-week (week_stake 0, peak above) is not in the vault rows; the walk pays exactly the medals", () => {
  const v = honest.rp.read("vault/W4.json"), w = honest.rp.read("W004.json");
  const players = JSON.stringify(v);
  assert.ok(players.includes(GOOD), "the staker is paid");
  assert.ok(!players.includes(LEFT), "the wallet that withdrew is not");
  assert.ok(JSON.stringify(w.players).includes(LEFT), "it still has its score on the week (free board)");
});

test("FC-10 (Medium): the medals (D-152 paid set) are exactly what the contract's walk pays, scores in hundredths", () => {
  const A = (i: number) => `1${String.fromCharCode(65 + i).repeat(33)}`;
  for (const pts of [[61240, 59010, 48000, 35], [100, 100, 100, 99, 1], [5, 4, 3, 2, 1, 1, 1, 1, 1, 1]]) {
    const rows = pts.map((p, i) => ({ a: A(i), pts: p, at: i }));
    const paid = paidSet(rows, "d152");
    assert.deepEqual([...contractWinners(vaultValues(rows.filter((r) => r.pts >= 1), paid, "dense255"))].sort(), [...paid].sort(), JSON.stringify(pts));
  }
});

test("FC-14 (Medium): copies tying the leader still fill 1st (up to 10 wallets, earliest first); the free prize is off anyway", () => {
  const A = (i: number) => `1${String(i).padStart(33, "Z")}`;
  const free = [...Array.from({ length: 11 }, (_, i) => ({ a: A(100 + i), pts: 3600, at: i })), { a: A(200), pts: 3500, at: 99 }];
  const fp = freePlaces(free);
  assert.equal(fp.first.length, MAX_PER_PLACE);
  assert.ok(!fp.first.includes(A(110)), "the latest of the 11 copies is the one left out (earlier final team wins, owner 13 Nov)");
});

test("FC-2 / FC-3 (High): Fantasy runs in its own job with its own timeout, and publishes in its own job: a slow or bad Fantasy run can't stop Block X", () => {
  const yml = fs.readFileSync(path.join(REPO, ".github/workflows/games.yml"), "utf8");
  const job = (name: string) => { const a = yml.indexOf(`\n  ${name}:\n`); assert.ok(a > 0, name); const b = yml.slice(a + 1).search(/\n  [a-z][\w-]*:\n/); return yml.slice(a, b < 0 ? undefined : a + 1 + b); };
  const rec = job("record-fantasy"), pubk = job("publish-kit"), blockx = job("record"), pubx = job("publish");
  const t = Number(rec.match(/\n    timeout-minutes:\s*(\d+)/)?.[1]);
  assert.ok(t > 0 && t <= 30, `record-fantasy timeout ${t}`);
  assert.ok(Number(pubk.match(/\n    timeout-minutes:\s*(\d+)/)?.[1]) > 0, "publish-kit has a timeout");
  assert.doesNotMatch(blockx, /fantasy/i, "Block X's record job has no Fantasy step");
  assert.doesNotMatch(pubx, /games\/fantasy|record-fantasy/, "the hand-written publish job doesn't depend on Fantasy");
});

test("FC-7 (Medium): a decided day can't change silently: see g52-flagged-cutoff-blockat.test.mts G52-c and G52-e (the run stops loudly, KC-8)", () => {
  assert.ok(fs.existsSync(path.join(REPO, "games/fantasy/tests/g52-flagged-cutoff-blockat.test.mts")));
});

// The kit's alone (no Fantasy code involved); covered by the kit's own tests:
test.todo("FC-5: the carried team and the week before's finality: kit/tests/phase1-fantasy.test.ts \"FC-5: next week starts from the carried teams…\" and G13-1");
test.todo("FC-6: 2,001 / 9,000 players: Fantasy moves to kit parts (Architecture's kit-next, a 9,000-player Fantasy-shaped test week) before its first real week");
test.todo("FC-11: a ruler card is made per day from the published vhp-data and rebuilt by the publish job (G3: kit/tests/phase1b-g3.test.ts)");
test.todo("FC-12 / FC-13: final after two runs an hour apart by the job's clock; chain time ahead of the runner is capped (kit/tests: \"FC-13: chain time ahead…\", NK-8)");
test.todo("FC-17: a week recovered later goes final (tests/audit/kit-repolens-g14.test.ts)");
