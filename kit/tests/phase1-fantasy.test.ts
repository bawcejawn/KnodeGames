// Fantasy Phase 1, end to end on two fake nodes and the REAL publish check: a Fantasy-shaped test game (not a real game)
// that uses every Phase 1 hook. Picks from the Picks contract (game 40 = team, game 41 = rival, records only), stakes
// from the vault's get_game_player, a write-once inputs file published before the week (FC-9), each wallet's team
// carried across rounds and weeks (FC-5), weekExtras, ctx.published, and the all-time board with medals (FC-16/18).
import test from "node:test";
import assert from "node:assert/strict";
import { runGame, type KitGameCfg } from "../recorder/runtime.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, GENESIS, HOUR as H, WEEK } from "../testing/fake-clock.ts";
import { checkGame, canon, sha256 } from "../publish/check.inline.mjs";
import { PENDING, type GameModule, type Round } from "../recorder/types.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", C = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const TEAM = 40, RIVAL = 41;
const dayNo = (t: number) => Math.floor(t / DAY);

type Inputs = { prices: Record<string, number> };
let lastPublished: any = null;

/** Fantasy-shaped: one producer per team, 10 points a day when the team's producer is the day's winner. */
const game: GameModule<{ producers: string[] }, string, Inputs> = {
  slug: "carry-test",
  picks: [{ source: "picks-contract", gameId: TEAM }, { source: "picks-contract", gameId: RIVAL }],
  extraPickRounds: (week, s) => (s.gameId === RIVAL ? [dayNo(week.start)] : []),
  async inputsFor(_week, ctx) {
    lastPublished = ctx.published;
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
  carryIn(last, _week, inputs) {
    // A carried team plays on only if its producer is on this week's price list.
    return new Map([...last].filter(([, p]) => inputs?.prices[p as string] !== undefined));
  },
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
  weekExtras(_week, ctx) {
    const ch = [...(ctx.picks.get(RIVAL)?.values() ?? [])].flat().map((p) => [p.wallet, (p.pick as any).producers?.[0] ?? ""]);
    return { rivals: ch, points: [...ctx.points].sort() };
  },
};

const cfg: KitGameCfg = {
  slug: "carry-test", game: 240, genesis: GENESIS, weekMs: WEEK, sundayFunRound: false, payoutRule: "d152", vaultValues: "dense255",
  entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, inputsFile: true, inputsLeadMs: 2 * DAY,
};

function fworld(): World {
  const wd = world(at(4) - 2 * DAY + H);
  wd.config.test_prices = "P1:10,P2:20";
  wd.gamePlayers = { [A]: { week_stake: "500000000", peak_stake: "500000000" }, [B]: { week_stake: "0", peak_stake: "0" }, [C]: { week_stake: "0", peak_stake: "0" } };
  const d0 = dayNo(at(4));
  wd.picks = {
    [`${TEAM}:${d0}`]: [{ player: A, pick: { producers: ["P1"], time: String(at(4) - 600000) } }, { player: B, pick: { producers: ["P2"], time: String(at(4) - 500000) } }],
    [`${TEAM}:${d0 + 2}`]: [{ player: B, pick: { producers: ["P1"], time: String(at(4, 2) - 500000) } }],
    [`${RIVAL}:${d0}`]: [{ player: A, pick: { producers: [B], time: String(at(4) - 400000) } }],
  };
  for (let d = 0; d < 13; d++) wd.config[`res_${d0 + d}`] = "P1";
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const hour = (rp: Replay, wd: World) => rp.hour(nodes(wd), wd.time + 5 * 60000);

test("FC-9: the inputs file is made inside its window before the week, published once, and never changed", async () => {
  const wd = fworld(), rp = new Replay(game, cfg);
  wd.time = at(4) - 3 * DAY;                     // before the window: nothing
  assert.ok(!(await hour(rp, wd)).published.includes("inputs/W4.json"));
  wd.time = at(4) - 2 * DAY + H;                 // Saturday 01:00 before week 4
  const h = await hour(rp, wd);
  assert.ok(h.published.includes("inputs/W4.json"), JSON.stringify(h));
  assert.deepEqual(rp.read("inputs/W4.json"), { game: 240, week: 4, data: { prices: { P1: 10, P2: 20 } } });
  wd.config.test_prices = "P1:99"; wd.time += H;  // the price list moves on chain: the published file doesn't
  assert.ok(!(await hour(rp, wd)).published.includes("inputs/W4.json"));
  assert.deepEqual(rp.read("inputs/W4.json").data.prices, { P1: 10, P2: 20 });
});

test("FC-9 publish check: a changed, late, early or misshapen inputs file is held", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "p1in-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(path.join(inn, "inputs"), { recursive: true }); fs.mkdirSync(path.join(pub, "inputs"), { recursive: true });
  const put = (dir: string, v: any) => fs.writeFileSync(path.join(dir, "inputs/W4.json"), canon(v));
  const f = { game: 240, week: 4, data: { prices: { P1: 10 } } };
  put(inn, f);
  assert.deepEqual(checkGame(cfg, inn, pub, at(4) - DAY).publish, ["inputs/W4.json"]);
  assert.match(checkGame(cfg, inn, pub, at(4) + 1).held[0].why, /after its week opened/);
  assert.match(checkGame(cfg, inn, pub, at(4) - 8 * DAY).held[0].why, /more than a week/);
  put(pub, f); put(inn, { ...f, data: { prices: { P1: 11 } } });
  assert.match(checkGame(cfg, inn, pub, at(4) - DAY).held[0].why, /write-once/);
  fs.rmSync(path.join(pub, "inputs/W4.json")); put(inn, { game: 240, week: 4, data: null });
  assert.match(checkGame(cfg, inn, pub, at(4) - DAY).held[0].why, /shape/);
  assert.match(checkGame({ ...cfg, inputsFile: false }, inn, pub, at(4) - DAY).held[0].why, /no inputs file/);
});

async function toWeek4Final() {
  const wd = fworld(), rp = new Replay(game, cfg);
  await hour(rp, wd);                             // the inputs file for week 4
  wd.time = at(5) - 2 * DAY + H; await hour(rp, wd);   // and week 5's
  wd.time = at(5, 0, 2);
  const hs = [];
  for (let i = 0; i < 4; i++) { hs.push(await hour(rp, wd)); wd.time += H; }
  return { wd, rp, hs };
}

test("Phase 1: picks from the Picks contract, stakes from the vault, the team carried day to day; final with a vault file", async () => {
  const { rp, hs } = await toWeek4Final();
  assert.equal(hs[0].result?.state, "pending", JSON.stringify(hs[0]));
  assert.equal(hs[3].result?.state, "final", JSON.stringify(hs[3]));
  const j = rp.read("W004.json");
  assert.equal(j.inputs, sha256(rp.raw("inputs/W4.json")));
  assert.deepEqual(j.carry, []);
  assert.deepEqual(j.next, [[A, "P1"], [B, "P1"]]);
  // A: P1 all six days = 60; B: P2 Mon and Tue (0), P1 from Wednesday = 40. B never picked on Tue, Thu, Fri, Sat: it
  // still scores with its carried team.
  const pts = new Map<string, number>();
  for (const r of j.rounds) for (const [i, p] of r[4]) pts.set(j.players[i][0], (pts.get(j.players[i][0]) ?? 0) + p);
  assert.deepEqual([...pts].sort(), [[A, 60], [B, 40]]);
  assert.equal(j.rounds[1][4].length, 2, "Tuesday: both wallets play with no pick that day");
  assert.deepEqual(j.extras, { rivals: [[A, B]], points: [[A, 60], [B, 40]] });
  assert.deepEqual(rp.read("vault/W4.json"), { game: 240, week: 4, final: true, rows: [{ player: A, points: 255 }], first: [B], second: [] });
});

test("FC-16/FC-18: alltime.json is rebuilt from the final weeks; medals only for weeks with a vault file", async () => {
  const { rp } = await toWeek4Final();
  const t = rp.read("alltime.json");
  assert.deepEqual(t.weeks, [4]);
  assert.deepEqual(t.rows.map((x: any) => [x.a, x.pts, x.weeks, x.gold, x.silver, x.earned, x.best]), [[A, 60, 1, 0, 0, 1, 1], [B, 40, 1, 1, 0, 0, 1]]);
});

test("FC-5: next week starts from the carried teams (no picks needed); it waits while the week before isn't final", async () => {
  const { wd, rp } = await toWeek4Final();
  wd.time = at(6) - 2 * DAY + H; await hour(rp, wd);   // week 6's inputs (not needed here, but the game makes them)
  wd.time = at(6, 0, 2);
  const h = await hour(rp, wd);
  assert.equal(h.result?.state, "pending", JSON.stringify(h));
  const j = rp.read("W005.json");
  assert.deepEqual(j.carry, [[A, "P1"], [B, "P1"]]);
  assert.equal(j.rounds.flatMap((r: any) => r[4]).reduce((s: number, x: any) => s + x[1], 0), 120);

  // Another run of the same game where week 4 is still pending when week 5 is recorded: nothing for week 5.
  const w2 = fworld(), r2 = new Replay(game, cfg);
  await hour(r2, w2); w2.time = at(5) - 2 * DAY + H; await hour(r2, w2);
  w2.time = at(5, 0, 2); await hour(r2, w2);
  assert.equal(r2.read("W004.json").state, "pending");
  w2.time = at(6, 0, 2);
  const h2 = await hour(r2, w2);
  assert.equal(h2.result?.state, "waiting");
  assert.ok(h2.result!.alerts.errors.some((e) => /FC-5/.test(e)));
  assert.equal(r2.read("W005.json"), null);
});

test("FC-5: carryIn drops a carried team whose producer left the price list", async () => {
  const { wd, rp } = await toWeek4Final();
  wd.config.test_prices = "P2:20";
  wd.time = at(6) - 2 * DAY + H; await hour(rp, wd);
  // week 5's inputs file was published with P1 and P2, so the carried teams stay: the published file decides
  wd.time = at(6, 0, 2);
  const h = await hour(rp, wd);
  assert.ok(h.result!.alerts.errors.some((e) => /inputs recount differs/.test(e)), "the recount now differs: held, with an alert");
  assert.notEqual(rp.read("W005.json")?.state, "final");
});

test("FC-9: a week with no inputs file published before it opened is not scored", async () => {
  const wd = fworld(), rp = new Replay(game, cfg);
  wd.time = at(5, 0, 2);
  const h = await hour(rp, wd);
  assert.equal(h.result?.state, "no-inputs");
  assert.ok(h.result!.alerts.errors.some((e) => /no inputs file/.test(e)));
});

test("Phase 1: the two nodes must agree on the Picks contract's picks", async () => {
  const { wd } = await toWeek4Final();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "p1n-"));
  fs.mkdirSync(path.join(d, "prev", "inputs"), { recursive: true }); fs.writeFileSync(path.join(d, "prev", ".fetched"), "");
  fs.writeFileSync(path.join(d, "prev", "inputs", "W4.json"), canon({ game: 240, week: 4, data: { prices: { P1: 10, P2: 20 } } }));
  wd.time = at(5, 0, 2); wd.config.test_prices = "P1:10,P2:20";
  const b = fakeNode("b", () => wd, { tweak: (m, _a, r) => (m === "picks.list_picks" && r.rows.length ? { rows: r.rows.slice(1) } : r) });
  await assert.rejects(runGame(game, cfg, { nodes: [fakeNode("a", () => wd), b], prev: path.join(d, "prev"), out: path.join(d, "out"), log: () => {} }), /picks or stakes/);
});

test("Phase 1 item 6: ctx.published carries the game's own final weeks to inputsFor", async () => {
  const { wd, rp } = await toWeek4Final();
  wd.time = at(6) - 2 * DAY + H; await hour(rp, wd);
  assert.deepEqual(Object.keys(lastPublished.own), ["4"]);
  assert.equal(lastPublished.own[4].state, "final");
});


// ── Repo Lens #G-13 (kit-phase1-fantasy @ 7572152): G13-1. Append to kit/tests/phase1-fantasy.test.ts (uses its helpers).
// Fails today. ──
// G13-1: a week with NO file (an outage through its 3 days, a missed inputs file, or a week that "waited" on a held
// week before it) is treated as "the game's first week": the next week starts every wallet from EMPTY state
// (runtime.ts: `const last = new Map((pwk?.next ?? []) ...)` when pwk is null), with no alert. Carried teams are lost
// and that week is scored and paid as if nobody had one. Fix: when the game has any published final week before w − 1
// but no file for w − 1, don't record week w (state "waiting", an error alert), as for a non-final w − 1; start from
// empty only when no earlier week file exists at all.
test("G13-1 (High, latent): a week with no file doesn't silently reset the carried state of the week after it", async () => {
  const { wd, rp } = await toWeek4Final();
  assert.deepEqual(rp.read("W004.json").next, [[A, "P1"], [B, "P1"]]);
  wd.time = at(6) - 2 * DAY + H; await hour(rp, wd);    // week 6's inputs file, before week 6 opens
  // Outage: no run while week 5 is "last week" (Mon–Wed of week 6), so week 5 never gets a file.
  wd.time = at(7, 0, 2);
  const h = await hour(rp, wd);
  assert.equal(rp.read("W005.json"), null, "the outage left week 5 without a file");
  const j = rp.read("W006.json");
  assert.ok(!(j && Array.isArray(j.carry) && j.carry.length === 0),
    `week 6 was recorded from empty state after a gap (carry ${JSON.stringify(j?.carry)}; state ${h.result?.state}); A and B carried teams into week 5`);
  assert.ok(h.result!.alerts.errors.some((e) => /week 5/.test(e)), "an alert names the missing week");
});

// G13-2 (Low): inputsLeadMs may be up to 7 days (runtime.ts, game-manifest inputsLeadHours 1–168), but ctx.published
// for week u's inputs is "final weeks ≤ u − 2", and week u − 2 can still turn final until its vault deadline,
// start(u − 1) + 3 days. A lead over 4 days can make the inputs file before u − 2 is final and recount it after, with a
// different ctx.published: the recount differs and week u is held for good. Fix: cap the lead at 4 days (96 hours), or
// cut ctx.published at u − 3 when the lead is longer.
test("G13-2 (Low): an inputs lead longer than 4 days is refused (ctx.published could change before the recount)", async () => {
  const wd = fworld(), rp = new Replay(game, { ...cfg, inputsLeadMs: 5 * DAY });
  const h = await hour(rp, wd);
  assert.match(h.error ?? "", /inputsLeadMs/, `a 5-day lead was accepted (${h.result?.state})`);
});
