// Survivor's page (survivor.js) reads the files the kit's real recorder wrote: a season week recorded hour by hour on
// fake nodes and the ruler's test chain, published as KG parts v1 folders through the kit's publish check, then decoded
// and read by the page's own code (the functions survivor.js exports, the same ones its screen uses). Every player's
// lives, days, score, place and day-by-day log must equal math.js playing the same season from the same cards.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R, timeline, FROM, N, T_FIRST } from "../../../tests/audit/race-ruler.fixture.mjs";
import { kitConfig, loadManifest } from "../../../kit/recorder/manifest.ts";
import { Replay } from "../../../kit/testing/replay.ts";
import { fakeNode, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, HOUR } from "../../../kit/testing/fake-clock.ts";
import { makeGame, settingsFor } from "../recorder.ts";
import * as S from "../math.js";
// @ts-ignore: the page is plain JavaScript (an ES module; its screen code runs only with a document)
import { decodePart, weekFromParts, weekFromFile, seasonView, placesOf } from "../../../survivor.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEEK = 2;
const W = ["a", "b", "c", "d", "e", "f"].map((c) => "1" + c.repeat(33));
const [PA, PB, PC, PD, PE] = ["A", "B", "C", "D", "E"].map((c) => "1" + c.repeat(33));
const blockAt = async (ms: number) => FROM + Math.ceil((ms - T_FIRST) / 3000);
const stake = (vhp: number) => ({ week_stake: String(vhp * 1e8), peak_stake: String(vhp * 1e8) });

function seasonWorld(picks: Record<string, (string | null)[]>, staked: string[]): World {
  const wd = world(at(WEEK + 1, 0, 3), { gamePlayers: Object.fromEntries(staked.map((a) => [a, stake(2)])) });
  wd.config.v6_rule_week_plus_one = "1";
  wd.lib = FROM + N - 1;
  wd.blockT0 = T_FIRST - FROM * 3000;
  wd.picks = {};
  for (const [a, xs] of Object.entries(picks)) xs.forEach((p, i) => {
    if (!p) return;
    const day = S.weekStart(WEEK) + i * S.DAY;
    (wd.picks![`3:${day / S.DAY}`] ??= []).push({ player: a, pick: { producers: [p], time: String(day - S.DAY) } });
  });
  return wd;
}
const nodes = (wd: World): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
const readFolder = (dir: string) => {
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  return m.parts.map((p: any) => decodePart(fs.readFileSync(path.join(dir, p.name), "utf8")));
};

test("page: reads the kit's parts folders and shows exactly the season math.js plays", async () => {
  const picks: Record<string, (string | null)[]> = {
    [W[0]]: [PA, PB, PC, PD, PE, PA],          // PA again on day 6: already used
    [W[1]]: [PE, PD, PC, PB, PA, PE],
    [W[2]]: [PB, PB, PC, PD, PE, PA],          // PB twice
    [W[3]]: [PC, null, PA, PB, PD, PE],        // a missed day
    [W[4]]: [null, PA, PB, PC, PD, PE],        // no day-1 pick: not in the season
    [W[5]]: [PD, PC, PB, PA, PE, null],
  };
  const stakedList = [W[0], W[1]];
  const wd = seasonWorld(picks, stakedList), L = R.ledger(timeline());
  // The test chain is in early November: the season starts on the test's own week (game.json says week 7 on mainnet).
  const cfg = { ...kitConfig(loadManifest("survivor", ROOT)), firstWeek: WEEK };
  assert.equal(cfg.parts, "d", "Survivor's week files are KG parts v1 folders (CAPACITY_STANDARD rule 4)");
  const rp = new Replay(makeGame(WEEK) as any, cfg);
  let h: any;
  for (let i = 0; i < 4; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000, { vhpLedger: L }); wd.time += HOUR; }
  assert.equal(h.error, undefined, h.error);
  assert.equal(h.result?.state, "final", JSON.stringify(h.result?.alerts));
  const dir = path.join(rp.pub, "W002");
  assert.ok(fs.existsSync(path.join(dir, "manifest.json")), "the week is a parts folder");
  const wk = weekFromParts(readFolder(dir));
  assert.equal(wk.week, WEEK);
  assert.equal(wk.state, "final");
  assert.equal(wk.rounds.length, 6);

  // The same week as the kit's own reader rebuilds it, in the one-file form: the page reads it the same way.
  const one = weekFromFile(rp.read("W002.json"));
  assert.deepEqual(one.rounds, wk.rounds, "parts and one-file forms give the page the same rounds");

  // The display column: each player's pick that day, from the chain.
  for (let n = 1; n <= 6; n++) {
    const id = wk.rounds[n - 1][0];
    for (const [a, xs] of Object.entries(picks)) if (wk.pk.get(id)?.has(a)) assert.equal(wk.pk.get(id).get(a), xs[n - 1] ?? null, `${a} day ${n}`);
  }

  // math.js on the same cards.
  const days: any[] = [];
  for (let n = 1; n <= 6; n++) {
    const day = S.weekStart(WEEK) + (n - 1) * S.DAY, s = await settingsFor(day, blockAt);
    days.push(S.dayFromCard(JSON.parse(R.cardJson(R.scoreCard(L, R.makeCard(L, { ...s, c: BigInt(s.c) })))), n));
  }
  const want = S.playSeason(days, new Map(Object.entries(picks).map(([a, xs]) => [a, xs.map((p, i) => [i + 1, p] as [number, string | null]).filter((x) => x[1]) as [number, string][]])), new Set(stakedList)).players;
  const v = seasonView([wk]);
  assert.equal(v.decided, 6);
  assert.deepEqual(v.players.map((x: any) => x.a).sort(), [...want.keys()].sort(), "the season's players: a day-1 pick joins");
  for (const x of v.players) {
    const y = want.get(x.a)!;
    assert.equal(x.board, y.board, `${x.a} board`);
    assert.equal(x.lives, Math.max(0, y.lives), `${x.a} lives`);
    assert.equal(x.days, y.days, `${x.a} days`);
    assert.equal(x.total, y.total, `${x.a} total`);
    assert.equal(x.outN, y.outN, `${x.a} out day`);
    assert.equal(x.standing, y.standing, `${x.a} standing`);
    // The page's day log, from the published points: a lost life where math.js's code costs one.
    const lost = [...y.log].map((c: string) => (c === "s" || c === "v" || c === "x" ? "safe" : c === "-" ? "skip" : "life"));
    assert.deepEqual(x.log.map((l: any) => l.what), lost, `${x.a} log (${y.log})`);
  }
  for (const board of ["staked", "free"]) {
    const mine = placesOf(v.players, board).map((x: any) => [x.a, x.place]);
    const ref = S.rank([...want.values()].filter((x: any) => x.board === board).map((x: any, i: number) => ({ ...x, a: [...want.keys()].find((k) => want.get(k) === x) })) as any).map((x: any) => [x.a, x.place]);
    assert.deepEqual(mine, ref, `${board} places`);
  }

  // The live copy of the season's second week (K4): open, its days pending, read alongside the first.
  const live = path.join(rp.pub, "W003");
  if (fs.existsSync(path.join(live, "manifest.json"))) {
    const w3 = weekFromParts(readFolder(live));
    assert.equal(w3.state, "open");
    const v2 = seasonView([wk, w3]);
    assert.equal(v2.decided, 6, "nothing guessed for days without results");
    assert.ok(v2.days.slice(6).every((d: any) => d.status === "p"));
  }
});

test("page: refuses anything that isn't a kgparts v1 part", () => {
  assert.throws(() => decodePart("{}"), /kgparts/);
  assert.throws(() => decodePart(JSON.stringify({ kgparts: 1, cols: [["player", "a"]], a: ["<script>"], rows: [] })), /address/);
  assert.throws(() => decodePart(JSON.stringify({ kgparts: 1, cols: [["player", "a"]], a: [], rows: [[5]] })), /address index/);
  assert.throws(() => weekFromParts([]), /no wk part/);
});

test("page: a day that didn't count (a fallback round) shows as skipped and changes no player", () => {
  const A1 = W[0], st0 = S.standingOf({ days: 0, lives: 2, total: 0 }), st1 = S.standingOf({ days: 1, lives: 2, total: 700 });
  const wk = {
    week: 7, start: 0, state: "open", min: "100000000", players: [[A1, "0", "0", 0]],
    rounds: [["d1", 0, 0, "s", [[A1, st0]]], ["d2", S.DAY, 0, "s", [[A1, st1 - st0]]], ["d3", 2 * S.DAY, 0, "p", []]],
    pk: new Map([["d1", new Map([[A1, PA]])], ["d2", new Map([[A1, PA]])]]), next: [], fallbacks: ["d1"],
  };
  const v = seasonView([wk]);
  const x = v.players[0];
  assert.deepEqual(x.log.map((l: any) => l.what), ["skip", "safe", "pending"]);
  assert.equal(x.lives, 2); assert.equal(x.days, 1); assert.equal(x.total, 700);
  assert.equal(v.days[0].skip, true);
});

test("page source: built with textContent (no HTML strings), the rules come from games/survivor/math.js, no old files", () => {
  const js = fs.readFileSync(path.join(ROOT, "survivor.js"), "utf8"), html = fs.readFileSync(path.join(ROOT, "survivor.html"), "utf8");
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(js), "no HTML strings");
  assert.ok(/import \* as S from "\.\/games\/survivor\/math\.js"/.test(js));
  assert.ok(!/survivor-math\.js/.test(html) && /<script type="module" src="survivor\.js"><\/script>/.test(html));
  assert.ok(!/fields\.json|S0\d\d\.json/.test(js), "no reads of the old recorder's files");
  assert.ok(/https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/games-data\//.test(html), "the CSP allows the games-data branch");
});
