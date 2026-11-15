// firstWeek (Fantasy, 14 Nov: TO-ARCHITECTURE-FIRST-WEEK-NO-FALSE-ALARMS): a kit game switched on mid-season records
// from its first week only. Weeks before it are never read, recorded or alerted on (no hourly backstop or "no inputs
// file" errors for weeks it never played), no inputs file is made for them, and the first week's own inputs file is
// still made in its window. firstWeek can't skip a week that is already final.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { type KitGameCfg } from "../recorder/runtime.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, GENESIS, HOUR as H, WEEK } from "../testing/fake-clock.ts";
import { PENDING, type GameModule, type Round } from "../recorder/types.ts";
import { validateManifest } from "../../tools/game-manifest.mjs";
import { kitConfig } from "../recorder/manifest.ts";

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const TEAM = 40;
const dayNo = (t: number) => Math.floor(t / DAY);

/** Fantasy-shaped (as phase1-fantasy.test.ts): Picks-contract picks, a write-once inputs file, a carried team. */
const game: GameModule<{ producers: string[] }, string, { prices: Record<string, number> }> = {
  slug: "first-week-test",
  picks: [{ source: "picks-contract", gameId: TEAM }],
  async inputsFor(_week, ctx) {
    const st = await ctx.read.read("get_state", {});
    const prices: Record<string, number> = {};
    for (const x of String(st.config.test_prices ?? "").split(",").filter(Boolean)) { const [p, v] = x.split(":"); prices[p] = Number(v); }
    return { prices };
  },
  roundsFor(week): Round[] {
    return Array.from({ length: 6 }, (_, i) => {
      const day = week.start + i * DAY;
      return { id: `d${i}`, day, locksAt: day + 1, resolvesAt: day + DAY, pickRound: dayNo(day) };
    });
  },
  async resultOf(round, read) {
    const st = await read.read("get_state", {});
    const x = st.config[`res_${round.pickRound}`];
    return x ? String(x) : PENDING;
  },
  carryIn(last, _week, inputs) { return new Map([...last].filter(([, p]) => inputs?.prices[p as string] !== undefined)); },
  nextState(state, picks, _round, inputs) {
    const n = new Map(state);
    for (const p of picks) { const x = p.pick.producers?.[0]; if (x && inputs?.prices[x] !== undefined) n.set(p.wallet, x); }
    return n;
  },
  scoreRound(round, _picks, winner, _inputs, state) {
    const out = new Map<string, { points: number; at: number }>();
    for (const [a, p] of state ?? []) out.set(a, p === winner ? { points: 10, at: round.day + 1000 } : { points: 0, at: 0 });
    return out;
  },
};

const cfg: KitGameCfg = {
  slug: "first-week-test", game: 240, genesis: GENESIS, weekMs: WEEK, sundayFunRound: false, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, inputsFile: true, inputsLeadMs: 2 * DAY,
};

function fworld(t: number): World {
  const wd = world(t);
  wd.config.test_prices = "P1:10,P2:20";
  wd.gamePlayers = { [A]: { week_stake: "500000000", peak_stake: "500000000" }, [B]: { week_stake: "0", peak_stake: "0" } };
  const d4 = dayNo(at(4)), d5 = dayNo(at(5));
  wd.picks = {
    [`${TEAM}:${d4}`]: [{ player: A, pick: { producers: ["P1"], time: String(at(4) - 600000) } }],
    [`${TEAM}:${d5}`]: [{ player: A, pick: { producers: ["P1"], time: String(at(5) - 600000) } }, { player: B, pick: { producers: ["P2"], time: String(at(5) - 500000) } }],
  };
  for (let d = dayNo(at(2)); d < dayNo(at(7)); d++) wd.config[`res_${d}`] = "P1";
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const hour = (rp: Replay, wd: World, t: number) => { wd.time = t; return rp.hour(nodes(wd), t + 5 * 60000); };

test("firstWeek 5: hourly runs in weeks 3 and 4 raise no error and record nothing; week 5's inputs file is still made in its window", async () => {
  const wd = fworld(at(3)), rp = new Replay(game, { ...cfg, firstWeek: 5 });
  // every hour of weeks 3 and 4 (records weeks 2 and 3; week 4's inputs window is the Saturday of week 3)
  for (let t = at(3, 0, 1); t < at(5) - 2 * DAY; t += 6 * H) {
    const h = await hour(rp, wd, t);
    assert.equal(h.error, undefined, h.error);
    assert.deepEqual(h.result!.alerts.errors, [], `${new Date(t).toISOString()}: ${h.result!.alerts.errors}`);
    assert.equal(h.result!.state, "before-first-week");
    assert.deepEqual(h.published, [], "nothing published before the first week");
  }
  assert.equal(rp.read("inputs/W4.json"), null, "no inputs file for a week before firstWeek");
  assert.equal(rp.read("W002.json"), null); assert.equal(rp.read("W003.json"), null);
  // Saturday 01:00 before week 5: week 5's inputs file is made, still with no error for week 3
  const h = await hour(rp, wd, at(5) - 2 * DAY + H);
  assert.deepEqual(h.result!.alerts.errors, [], String(h.result!.alerts.errors));
  assert.ok(h.published.includes("inputs/W5.json"), JSON.stringify(h.published));
  assert.deepEqual(rp.read("inputs/W5.json").data, { prices: { P1: 10, P2: 20 } });
  // the rest of week 4 (records week 3): still nothing
  const h4 = await hour(rp, wd, at(5) - H);
  assert.deepEqual(h4.result!.alerts.errors, []);
  assert.equal(rp.read("W004.json"), null);
  // week 5 itself is recorded from an empty carried state (no "earlier weeks" from before firstWeek), then final
  const hs = [];
  for (let t = at(6, 0, 2); t < at(6, 0, 6); t += H) hs.push(await hour(rp, wd, t));
  for (const x of hs) assert.ok(!x.result!.alerts.errors.some((e) => /FC-5|G13-1/.test(e)), String(x.result!.alerts.errors));
  assert.equal(rp.read("W005.json").state, "final");
  assert.deepEqual(rp.read("W005.json").carry, []);
});

test("firstWeek unset: the same mid-season start alerts for a week the game never played (the case firstWeek fixes)", async () => {
  const wd = fworld(at(4, 1, 2)), rp = new Replay(game, cfg);
  const h = await hour(rp, wd, at(4, 1, 2));
  assert.equal(h.result!.state, "no-inputs");
  assert.ok(h.result!.alerts.errors.some((e) => /no inputs file/.test(e)));
});

test("firstWeek can't skip a week already final: an error, and the week is recorded as usual", async () => {
  const wd = fworld(at(4) - 2 * DAY + H), rp = new Replay(game, cfg);
  await hour(rp, wd, at(4) - 2 * DAY + H);
  for (let t = at(5, 0, 2); t < at(5, 0, 6); t += H) await hour(rp, wd, t);
  assert.equal(rp.read("W004.json").state, "final");
  const before = rp.raw("W004.json");
  const moved = new Replay(game, { ...cfg, firstWeek: 6 }, rp.root);
  const h = await hour(moved, wd, at(5, 1, 2));
  assert.ok(h.result!.alerts.errors.some((e) => /firstWeek is 6, but week 4 is already final/.test(e)), String(h.result!.alerts.errors));
  assert.notEqual(h.result!.state, "before-first-week");
  assert.equal(moved.raw("W004.json"), before, "the final week is unchanged");
});

test("firstWeek in game.json: a whole number 0–9999, passed into the kit's config", () => {
  const m = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../games/fantasy/game.json"), "utf8"));
  for (const bad of [-1, 2.5, "5", 10000]) assert.ok(validateManifest({ ...m, firstWeek: bad }, { kit: true }).some((p: string) => /firstWeek/.test(p)), String(bad));
  assert.deepEqual(validateManifest({ ...m, firstWeek: 5 }, { kit: true }), []);
  const dep = { genesisTime: String(GENESIS), weekLength: String(WEEK) };
  assert.equal(kitConfig({ ...m, firstWeek: 5 }, dep).firstWeek, 5);
  const { firstWeek: _fw, ...m0 } = m;   // Fantasy's game.json sets firstWeek: test the unset case on a copy without it
  assert.equal("firstWeek" in kitConfig(m0, dep), false, "unset stays unset");
});

test("firstWeek 4, then parts from week 5: week 4 stays one file, week 5 is a parts folder carrying week 4's teams (G13-1 fine)", async () => {
  const wd = fworld(at(4) - 2 * DAY + H), rp = new Replay(game, { ...cfg, firstWeek: 4 });
  await hour(rp, wd, at(4) - 2 * DAY + H);                       // week 4's inputs file
  await hour(rp, wd, at(5) - 2 * DAY + H);                       // week 5's
  for (let t = at(5, 0, 2); t < at(5, 0, 6); t += H) await hour(rp, wd, t);
  assert.equal(rp.read("W004.json").state, "final");
  const w4 = rp.raw("W004.json");
  const parts = new Replay(game, { ...cfg, firstWeek: 4, parts: "d" }, rp.root);   // the parts PR lands mid-season
  const hs = [];
  for (let t = at(6, 0, 2); t < at(6, 0, 6); t += H) hs.push(await hour(parts, wd, t));
  for (const x of hs) assert.ok(!x.result!.alerts.errors.some((e) => /FC-5|G13-1/.test(e)), String(x.result!.alerts.errors));
  assert.ok(fs.existsSync(path.join(rp.pub, "W005", "manifest.json")), "week 5 is a parts folder");
  assert.equal(fs.readFileSync(path.join(rp.pub, "W004.json"), "utf8"), w4, "week 4 stays one file, unchanged");
  assert.deepEqual(parts.read("W005.json").carry, rp.read("W004.json").next, "week 5 starts from week 4's teams");
  assert.equal(parts.read("W005.json").state, "final");
});
