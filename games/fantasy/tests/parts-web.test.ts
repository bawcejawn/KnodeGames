// The page's parts reader (games/fantasy/parts-web.js) rebuilds a week exactly as the publish check does
// (kit/publish/check.inline.mjs readWeekFolder → partsToWeek), so fantasy.js shows the same week whether it was written
// as one file or as day parts. Week from the kit's Replay with Fantasy's real module, staked and free wallets, a carried
// team and a Rival challenge.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."); const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");
const { readWeekFolder } = await imp("kit/publish/check.inline.mjs");
const W = await imp("games/fantasy/parts-web.js");
const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB","1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC","1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD","1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"];
const S = "1SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS", F = "1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", N = "1NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN";
const vhp = { ruleVersion: 4, to: 0, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: P.map((a, i) => ({ a, credited: String((90 + i * 7) * 1000000), expected: "100000000", void: false, entry: true, quality: "ok" })) }) };
const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true, parts: "d" };
const T0 = at(0) - 30 * DAY, libAt = (t: number) => Math.floor((t - T0) / 3000) - 60;

test("parts-web: the page's rebuilt week equals the publish check's, pending and final", async () => {
  const wd: any = world(at(4) - 2 * DAY + H); wd.blockT0 = T0;
  wd.gamePlayers = { [S]: { week_stake: "500000000", peak_stake: "700000000" }, [N]: { week_stake: "100000000", peak_stake: "100000000" } };
  const d0 = at(4) / DAY;
  wd.picks = {
    [`4:${d0}`]: [{ player: S, pick: { producers: [P[1], P[0], P[2], P[3], P[4]], time: String(at(4) - 600000) } }, { player: F, pick: { producers: [P[5], P[0], P[2], P[3], P[4]], time: String(at(4) - 500000) } }, { player: N, pick: { producers: P.slice(0, 2), time: String(at(4) - 400000) } }],
    [`4:${d0 + 2}`]: [{ player: S, pick: { producers: [P[5], P[0], P[2], P[3], P[4]], time: String(at(4) + 2 * DAY - 600000) } }],
    [`5:${d0}`]: [{ player: S, pick: { producers: [F], time: String(at(4) - 300000) } }],
  };
  const rp = new Replay(m, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  const run = async (t: number) => { wd.time = t; wd.lib = libAt(t); return rp.hour(nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); };
  const getText = async (rel: string) => fs.readFileSync(path.join(rp.pub, rel), "utf8");
  await run(wd.time);
  const seen = new Set<string>();
  for (let k = 0; k < 8; k++) {
    const h = await run(at(5, 0, 1 + k));
    assert.equal(h.error, undefined, h.error);
    const dir = path.join(rp.pub, "W004");
    if (!fs.existsSync(path.join(dir, "manifest.json"))) continue;
    const want = readWeekFolder(dir, cfg).week, got = await W.loadWeekParts(getText, "W004");
    assert.deepEqual(got, want, `state ${want.state}`);
    seen.add(want.state);
    if (want.state === "final") break;
  }
  assert.ok(seen.has("final"), `states seen: ${[...seen]}`);
  const wk = await W.loadWeekParts(getText, "W004");
  assert.ok(wk.players.length === 3 && Array.isArray(wk.next) && wk.extras?.rival, "players, carried teams and Rival are there");
});

test("parts-web: no folder, a broken part or a wrong count gives null (shown as not published), never half a week", async () => {
  assert.equal(await W.loadWeekParts(async () => { throw new Error("404"); }, "W009"), null);
  const files: Record<string, string> = { "W001/manifest.json": JSON.stringify({ kgparts: 1, parts: [{ name: "wk.x.json" }] }), "W001/wk.x.json": "{not json" };
  assert.equal(await W.loadWeekParts(async (u: string) => files[u] ?? (() => { throw new Error("404"); })(), "W001"), null);
  assert.throws(() => W.weekFromParts([{ part: "wk", cols: [], extra: { head: [1, "fantasy", 1, 0, 1, 1, "final", "h", "a"], opt: "{}", players: 2, rounds: 0 }, rows: [] }]), /0 players, wk says 2/);
});
