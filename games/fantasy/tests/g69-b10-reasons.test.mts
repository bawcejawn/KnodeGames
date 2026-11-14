// Repo Lens #G-69 G69-5 (Low, tests only): games/fantasy/tests/b10-ported.test.ts PRINTS the publish check's reason
// (console.log) but never asserts it, and its FC-15 test hands checkGame a published folder without inputs/W4.json, so
// with FC-15's own guards removed it still passes (held for "its inputs hash isn't the published inputs file's").
// The FC-8 and FC-4 negatives are first caught by the freshness/future rules, not the rule they are named for.
// This file asks the same questions with the reason ASSERTED and each case built so only the named rule can catch it.
// Run from a checkout of 10a20768 (repo root):
//   REPO=$PWD TZ=UTC node --import tsx --test --test-concurrency=1 /home/claude/g1/tests-g69/g69-b10-reasons.test.mts
// Expected: passes at 10a20768; each test FAILS when its named guard in kit/publish/check.inline.mjs is removed
// (mutations in /home/claude/g1/g69/mutate-g69-5.sh). Paste-ready as a replacement for the console.log lines.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = process.env.REPO ?? process.cwd();
const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");
const { checkGame } = await imp("kit/publish/check.inline.mjs");

const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const cfg: any = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true };
const T0 = at(0) - 30 * DAY, libAt = (t: number) => Math.floor((t - T0) / 3000) - 60;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "g69-b10-"));

let pub = "";
test.before(async () => {
  const wd: any = world(at(4) - 2 * DAY + H);
  wd.blockT0 = T0;
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: P.slice(0, 5), time: String(at(4) - 600000) } }] };
  const rp = new Replay(m, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  const run = async (t: number) => { wd.time = t; wd.lib = libAt(t); return rp.hour(nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); };
  await run(wd.time);
  for (let k = 0; k < 8; k++) { const h = await run(at(5, 0, 2 + k)); if (h.result?.state === "final") break; }
  assert.equal(rp.read("W004.json").state, "final");
  pub = rp.pub;
});
const copyOf = (files: string[], edit?: (rel: string, j: any) => any) => {
  const d = tmp();
  fs.mkdirSync(path.join(d, "vault"), { recursive: true });
  for (const f of files) { const j = JSON.parse(fs.readFileSync(path.join(pub, f), "utf8")); fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), JSON.stringify(edit ? edit(f, j) : j) + "\n"); }
  return d;
};
const why = (r: any, name: string) => r.held.find((x: any) => x.name === name)?.why ?? `(not held; published: ${r.publish})`;

test("FC-4: a final dated in the past but checked on Tuesday of the week itself: the job's clock refuses it (not the future rule)", () => {
  const now = at(4, 1, 1);
  const out = copyOf(["W004.json"], (_f, j) => ({ ...j, seen: { ...j.seen, at: now - 60000 } }));
  assert.equal(why(checkGame(cfg, out, copyOf(["inputs/W4.json"]), now, "", null), "W004.json"), "an ended week first read before its end");
});

test("FC-4: the honest final checked on Tuesday of the week: seen in the future", () => {
  assert.equal(why(checkGame(cfg, copyOf(["W004.json"]), copyOf(["inputs/W4.json"]), at(4, 1, 1), "", null), "W004.json"), "seen in the future by this job's clock");
});

test("FC-4: start/end moved a week back", () => {
  const out = copyOf(["W004.json"], (_f, j) => ({ ...j, start: j.start - 7 * DAY, end: j.end - 7 * DAY }));
  assert.equal(why(checkGame(cfg, out, copyOf(["inputs/W4.json"]), at(5, 1), "", null), "W004.json"), "wrong start or end for that week");
});

test("FC-8: a one-run final, freshly stamped, with no published pending copy: held by the no-earlier-run rule itself", () => {
  const now = at(5, 1, 6);
  const out = copyOf(["W004.json"], (_f, j) => ({ ...j, seen: { ...j.seen, at: now - 60000 } }));
  assert.equal(why(checkGame(cfg, out, copyOf(["inputs/W4.json"]), now, "", null), "W004.json"), "final without an earlier published run of the same week");
});

test("FC-15: a published final re-sent with \"v\": true, the published inputs file present: held for its version", () => {
  const out = copyOf(["W004.json"], (_f, j) => ({ ...j, v: true }));
  assert.equal(why(checkGame(cfg, out, copyOf(["W004.json", "inputs/W4.json"]), at(5, 2), "", null), "W004.json"), "wrong version or game");
});

test("FC-15: any other change to a published final (its seen.at, outside the hash): held as a change to a published final", () => {
  const out = copyOf(["W004.json"], (_f, j) => ({ ...j, seen: { ...j.seen, at: j.seen.at + 1 } }));
  assert.equal(why(checkGame(cfg, out, copyOf(["W004.json", "inputs/W4.json"]), at(5, 2), "", null), "W004.json"), "it changes a published final week");
});
