// Fantasy on the kit's parts ("parts": "d"): the week goes final as day parts, and each day's rows show the team that
// PLAYED that day (the carried state, p1 = captain), not the day's raw pick; a staked wallet with no team shows nulls.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."); const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");
const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB","1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC","1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD","1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const GOOD = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1", NOTEAM = "1NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN1";
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a) => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true, parts: "d" };
const T0 = at(0) - 30 * DAY, libAt = (t: number) => Math.floor((t - T0) / 3000) - 60;
const wd: any = world(at(4) - 2 * DAY + H); wd.blockT0 = T0;
wd.gamePlayers = { [GOOD]: { week_stake: "500000000", peak_stake: "500000000" }, [NOTEAM]: { week_stake: "500000000", peak_stake: "500000000" } };
const team = [P[1], P[0], P[2], P[3], P[4]];
wd.picks = { [`4:${at(4) / DAY}`]: [{ player: GOOD, pick: { producers: team, time: String(at(4) - 600000) } }, { player: NOTEAM, pick: { producers: P.slice(0, 3), time: String(at(4) - 600000) } }] };
const rp = new Replay(m, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const run = async (t: number) => { wd.time = t; wd.lib = libAt(t); return rp.hour(nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); };
test("parts: the week goes final as day parts; each day shows the team that played (carried), nulls for no team", async () => {
  await run(wd.time);
  let h; for (let k = 0; k < 8; k++) { h = await run(at(5, 0, 2 + k)); if (h.result?.state === "final") break; }
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "final");
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(path.join(rp.pub, "W004")).map((f) => path.basename(f));
  for (let d = 1; d <= 7; d++) assert.ok(files.some((f) => f.startsWith(`d${d}.`)), `day part d${d}`);
  assert.ok(files.includes("manifest.json") && files.some((f) => f.startsWith("wk.")));
  const part = (d: number) => JSON.parse(fs.readFileSync(walk(path.join(rp.pub, "W004")).find((f) => path.basename(f).startsWith(`d${d}.`))!, "utf8"));
  const tue = part(2), cols = tue.cols.map((c: any) => c[0]);
  assert.deepEqual(cols.slice(-5), ["p1", "p2", "p3", "p4", "p5"]);
  const rowOf = (p: any, a: string) => p.rows.find((r: any) => p.a[r[0]] === a);
  const g = rowOf(tue, GOOD);
  assert.ok(g, "Tuesday has a row for the carried team, with no pick that day");
  assert.deepEqual(g.slice(-5).map((i: number) => tue.a[i]), team, "p1..p5 = the team that played, captain first");
  const n = rowOf(part(1), NOTEAM);
  assert.ok(n, "a staked wallet that picked an invalid team still has a row (0 points)");
  assert.deepEqual(n.slice(-5), [-1, -1, -1, -1, -1], "no team: the kit writes a null address as -1");
  assert.ok(fs.statSync(walk(path.join(rp.pub, "W004")).find((f) => path.basename(f).startsWith("d1."))!).size < 1.2e6);
});
