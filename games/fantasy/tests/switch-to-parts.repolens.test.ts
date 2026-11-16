// Repo Lens (Fantasy parts PR, 1be57312), Sun 15 Nov 2026. Put in games/fantasy/tests/ and run from the repo root:
//   TZ=UTC node --import tsx --test games/fantasy/tests/switch-to-parts.repolens.test.ts
// The recorder writes a week's file only after the week ends (liveWeek false): week 4's first W004 is written Mon 23 Nov
// 00:xx UTC. Merged before then (the plan: by Sun 22 Nov 3 PM ET), week 4 is written as parts from the start (control).
// FP-1 (Info, kit): a game that switches to parts while its week is published PENDING as one file: the recorder writes
// W004/, the publish job adds it but never removes W004.json (it force-removes only the folder's old files), and every
// later run stops in Prev.load ("both a file and a parts folder"). For Fantasy that window is Mon 23 Nov 00:00 to about
// 03:00 UTC, inside the owner's no-merge window, so it can't happen if the timing rule is kept.
// FP-2 (High, kit; blind verifier VALID, High): test week 4 left non-final past its Thursday deadline (past-due: a
// FANTASY_HOLD_WEEKS left set, a ruler-data outage, the FC-9 recount hold, nodes disagreeing) makes week 5, the first
// real week, "wait" on it for good, though week 5 carries nothing from week 4 (FIRST_REAL_WEEK). RESET_FROM_WEEK=5
// doesn't help: runtime.ts ~:425 returns "waiting" before the reset is read (G55-3). Week 6 then waits on week 5.
// Expected at 1be57312: the control passes; FP-1 and FP-2 FAIL.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path"; import fs from "node:fs"; import os from "node:os";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."); const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");
const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB","1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC","1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD","1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const base: any = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true };
const T0 = at(0) - 30 * DAY, libAt = (t: number) => Math.floor((t - T0) / 3000) - 60;
function setup() {
  const wd: any = world(at(4) - 2 * DAY + H); wd.blockT0 = T0;
  wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" } };
  wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: [P[1], P[0], P[2], P[3], P[4]], time: String(at(4) - 600000) } }] };
  return wd;
}
const nodes = (wd: any) => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const run = (rp: any, wd: any, t: number) => { wd.time = t; wd.lib = libAt(t); return rp.hour(nodes(wd), t + 5 * 60000, { vhpLedger: { to: 0 } }); };

test("control: merged during week 4 (parts on before week 4 ends): week 4 is recorded as W004/ and goes final", async () => {
  const wd = setup(), root = fs.mkdtempSync(path.join(os.tmpdir(), "fp0-"));
  const before = new Replay(m, base, root);
  for (const t of [wd.time, at(4, 1, 2), at(4, 3, 2)]) { const h = await run(before, wd, t); assert.equal(h.error, undefined, h.error); }
  assert.ok(!fs.existsSync(path.join(root, "pub", "W004.json")), "nothing of week 4 is written during the week");
  const after = new Replay(m, { ...base, parts: "d" }, root);
  let state = "";
  for (const t of [at(5, 0, 1), at(5, 0, 2), at(5, 0, 3), at(5, 0, 4)]) { const h = await run(after, wd, t); assert.equal(h.error, undefined, h.error); state = h.result?.state ?? state; }
  assert.equal(state, "final");
  assert.ok(fs.existsSync(path.join(root, "pub", "W004", "manifest.json")) && !fs.existsSync(path.join(root, "pub", "W004.json")));
});

// FP-1 is Info (timing): it can only happen if #344 merges while W004.json is published pending (Mon 23 Nov 00:00 to
// ~03:00 UTC, inside the no-merge window); the kit chat fixes the cause. Kept as a to-do (Repo Lens #J-4).
test.todo("FP-1: week 4 published as W004.json before the merge, then the recorder (parts on) keeps running", async () => {
  const wd = setup(), root = fs.mkdtempSync(path.join(os.tmpdir(), "fp1-"));
  const before = new Replay(m, base, root);                       // main today: one file
  await run(before, wd, wd.time);
  await run(before, wd, at(4, 3, 2));
  const h1 = await run(before, wd, at(5, 0, 1));                   // Mon 23 Nov 01:00 UTC: W004.json published pending
  assert.equal(h1.error, undefined, h1.error);
  assert.ok(fs.existsSync(path.join(root, "pub", "W004.json")), "week 4 is published as one file");
  const after = new Replay(m, { ...base, parts: "d" }, root);     // the PR merged
  const errs: string[] = [];
  for (const t of [at(5, 0, 2), at(5, 0, 3), at(5, 0, 4)]) { const h = await run(after, wd, t); if (h.error) errs.push(h.error); }
  // The publish job keeps W004.json beside the new folder (it force-removes only the folder's old files).
  const both = fs.existsSync(path.join(root, "pub", "W004.json")) && fs.existsSync(path.join(root, "pub", "W004"));
  assert.ok(!errs.length && !both, `runs after the switch: ${errs.join(" | ") || "ok"}; published both W004.json and W004/: ${both}`);
});

test("FP-2: test week 4 past-due; the owner sets FANTASY_RESET_FROM_WEEK=5: week 5 is still recorded and goes final", async () => {
  const wd = setup(), rp = new Replay(m, { ...base, parts: "d" });
  wd.picks[`4:${at(5) / DAY}`] = [{ player: GOOD, pick: { producers: [P[1], P[0], P[2], P[3], P[4]], time: String(at(5) - 600000) } }];
  const go = (t: number, env: any = {}) => { wd.time = t; wd.lib = libAt(t); return rp.hour(nodes(wd), t + 5 * 60000, { vhpLedger: { to: 0 }, ...env }); };
  for (const t of [wd.time, at(4, 3, 2), at(4, 6, 1)]) await go(t);
  for (const t of [at(5, 0, 1), at(5, 0, 2), at(5, 1, 2), at(5, 3, 1)]) await go(t, { holdWeeks: "4" });   // held past Thursday
  assert.equal(JSON.parse(fs.readFileSync(path.join(rp.pub, "W004", "manifest.json"), "utf8")).meta?.state ?? "pending", "pending", "week 4 stays pending (past-due)");
  let last: any;
  for (const t of [at(6, 0, 1), at(6, 0, 2), at(6, 0, 3), at(6, 0, 4)]) last = await go(t, { resetFromWeek: 5 });
  assert.ok(last.result?.week === 5 && last.result?.state === "final", `week 5: ${last.result?.state} (${(last.result?.alerts?.errors ?? []).join(" ; ").slice(0, 200)})`);
});
