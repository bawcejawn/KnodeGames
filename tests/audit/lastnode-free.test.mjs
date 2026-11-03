// Last Node Standing: the Free play board and its weekly 2 + 1 VHP prize (owner, 3 Nov; D-081, D-082).
//  - Free play = every wallet not staked in game 13 that week (the vault's rule: peak stake below the minimum).
//  - A free winner played at least 3 of the week's events, scored at least 1 point, and holds 1 VHP or has 1 VHP staked
//    in Knode Games (owner, 3 Nov: "require at least 1 VHP").
//  - Places by the board's order; ties split the places they cover, as Who Signs Block X; at most 10 wallets a place.
//  - Watch-and-hold holds the whole file (staked rows and free winners together).
import "./lib/quiet.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP, A, P1, P2, P3, linux, publisher, idx, dayFile, boardOf, chainFor, voidDay, PICKS, WINNER, CUT_ORDER, NODES } from "./lastnode-vault.helpers.mjs";
const { run, freeWinners, freePlaces, vaultScores, watchWeek } = await import(pathToFileURL(path.resolve(APP, "bot/games/lastnode.ts")).href);
const L = globalThis.KLastNode;
const row = (a, pts, events = 3, rides = 0, jumps = 0) => ({ player: a, a, pts, rides, jumps, events });

test("freePrizes: 3 events and 1 point to qualify; places by points, rides, fewer jumps; 2 + 1 VHP", () => {
  const all = () => true;
  const p = L.freePrizes([row(A("a"), 20, 2), row(A("b"), 15, 3, 1), row(A("c"), 15, 3, 0), row(A("d"), 0, 7)], all);
  assert.deepEqual(p, [{ player: A("b"), place: 1, vhp: 2 }, { player: A("c"), place: 2, vhp: 1 }], "a: only 2 events; b beats c on rides; d: no points");
  assert.equal(L.FREE_MIN_EVENTS, 3); assert.deepEqual(L.FREE_AMOUNTS, [2, 1]);
});

test("freePrizes: ties split the places they cover (two tied for 1st: 1.5 VHP each, no 2nd; a tie for 2nd splits 1 VHP)", () => {
  const all = () => true;
  assert.deepEqual(L.freePrizes([row(A("a"), 9), row(A("b"), 9), row(A("c"), 5)], all).map((x) => [x.player, x.place, x.vhp]), [[A("a"), 1, 1.5], [A("b"), 1, 1.5]]);
  assert.deepEqual(L.freePrizes([row(A("a"), 9), row(A("b"), 5), row(A("c"), 5), row(A("d"), 5)], all).map((x) => [x.player, x.place, x.vhp]),
    [[A("a"), 1, 2], [A("b"), 2, 0.33333333], [A("c"), 2, 0.33333333], [A("d"), 2, 0.33333333]]);
  // Places count only the eligible: a staked or no-VHP wallet above them doesn't take a place.
  assert.deepEqual(L.freePrizes([row(A("s"), 30), row(A("a"), 9), row(A("b"), 5)], (a) => a !== A("s")).map((x) => [x.player, x.place]), [[A("a"), 1], [A("b"), 2]]);
});

test("freePlaces: 1st and 2nd for the vault; two or more tied for 1st leave 2nd empty; more than 10 in a place leaves it empty", () => {
  assert.deepEqual(freePlaces([{ player: A("a"), place: 1 }, { player: A("b"), place: 2 }]), { first: [A("a")], second: [A("b")], problems: [] });
  assert.deepEqual(freePlaces([{ player: A("b"), place: 1 }, { player: A("a"), place: 1 }]).first, [A("a"), A("b")].sort());
  const many = Array.from({ length: 11 }, (_, i) => ({ player: "1" + String.fromCharCode(97 + i).repeat(33), place: 2 }));
  const r = freePlaces([{ player: A("z"), place: 1 }, ...many]);
  assert.deepEqual(r.first, [A("z")]); assert.deepEqual(r.second, []); assert.match(r.problems[0], /11 wallets tied for 2nd/);
});

test("freeWinners: reads candidates in batches of 25 and stops once 1st and 2nd are settled (never a partial tie)", async () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ a: "1" + i.toString(36).padStart(2, "x") + "q".repeat(31), pts: 200 - i, rides: 0, jumps: 0, events: 5 }));
  const asked = [];
  const status = async (who) => { asked.push(...who); return { staked: new Set([rows[0].a]), ok: new Set(who.filter((a) => a !== rows[1].a)) }; };
  const r = await freeWinners(rows, status);
  assert.deepEqual([r.first, r.second], [[rows[2].a], [rows[3].a]], "the staked and the no-VHP wallets are passed over");
  assert.equal(asked.length, 25, "one batch was enough");
  // The 25th and 26th tie for 2nd: the next batch is read, so the tie is whole.
  const tied = rows.map((x, i) => (i === 24 || i === 25 ? { ...x, pts: 50 } : x));
  const deep = await freeWinners(tied, async (who) => ({ staked: new Set(), ok: new Set(who.filter((a) => tied.indexOf(tied.find((x) => x.a === a)) >= 23)) }));
  assert.deepEqual(deep.first, [tied[23].a]); assert.deepEqual(deep.second, [tied[24].a, tied[25].a].sort());
  // Fewer than 3 events or no point: not a candidate at all.
  const none = await freeWinners([{ a: A("a"), pts: 9, rides: 0, jumps: 0, events: 2 }, { a: A("b"), pts: 0, rides: 0, jumps: 0, events: 7 }], async () => { throw new Error("not asked"); });
  assert.deepEqual([none.first, none.second], [[], []]);
});

// ── the recorder: last week's vault file with the free winners ──
import fs from "node:fs";
import os from "node:os";
const FM = A("m"), FN = A("n"), FQ = A("q"), FS = A("s");
function weekDir(w, players, events = [1, 2, 3]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lns-free-"));
  const days = [];
  for (let t = L.weekStart(w); t < L.weekStart(w + 1); t += L.DAY) {
    const ev = L.eventOf(t); days.push(ev.day);
    fs.writeFileSync(path.join(dir, `D${ev.day}.json`), JSON.stringify({ v: 1, day: ev.day, start: ev.start, week: w, field: null, void: "test", hours: [], picks: {}, cuts: [], standing: [], winner: null, done: false, players: [] }));
  }
  const N = [A("N"), A("M")];
  for (const k of events) {
    const ev = L.eventOf(L.weekStart(w) + k * L.DAY);
    const field = { at: 0, c: 0, fairness: null, vt: 3, nodes: [{ a: N[0], vhp: 2, kh: 100, h: 1 }, { a: N[1], vhp: 1, kh: 50, h: 2 }] };
    fs.writeFileSync(path.join(dir, `D${ev.day}.json`), JSON.stringify({ v: 1, day: ev.day, start: ev.start, week: w, field,
      hours: [{ i: 0, from: 1, to: 2, blocks: { [N[0]]: 100, [N[1]]: 10 }, checked: 2 }], picks: { 0: players.map(([p, n]) => [p, N[n], ev.start - 3600000]) }, cuts: [], standing: [], winner: null, done: false, players: [] }));
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ v: 1, days, contract: null, game: 13 }));
  return dir;
}
const goWeek = (dir, w, { staked, free, release } = {}) => run({ p: "m", check: null, prev: dir, out: dir, raceDir: "", picksContract: null, windowOf: async () => { throw new Error("no blocks needed"); },
  picksOf: async () => [], rankedOf: async (who) => new Set(who.filter((a) => staked.has(a))), stakedOf: async (_w, who) => new Set(who.filter((a) => staked.has(a))),
  freeOf: free, releaseWeeks: release, trials: 200, now: { time: L.weekStart(w + 1) + 13 * 3600000, libTime: L.weekStart(w + 1) + 13 * 3600000 } });

test("the recorder's vault file: staked rows, and the Free play board's 1st and 2nd (not staked, 3+ events, 1 VHP)", async () => {
  // Node N wins every event: riding it scores 1 + 5 = 6 an event. FM and FQ ride N in all 3 events; FN rides M (0).
  // FQ holds no VHP; FS staked and then withdrew (peak at the minimum): neither may win. P1 is staked.
  const w = 3, staked = new Set([P1]);
  const dir = weekDir(w, [[P1, 0], [FM, 0], [FQ, 0], [FS, 0], [FN, 1]]);
  const free = async (_w, who) => ({ staked: new Set(who.filter((a) => a === FS)), ok: new Set(who.filter((a) => a !== FQ)) });
  const r = await goWeek(dir, w, { staked, free });
  assert.ok(r.vault, r.problems.join("; "));
  assert.deepEqual(r.vault.rows, [{ player: P1, points: 18 }]);
  assert.deepEqual([r.vault.first, r.vault.second], [[FM], []], "FN has no point, FQ no VHP, FS was staked: only FM wins, and 2nd is unfilled");
  // The Staked board is staked-in-game-13 only; everyone else ranks on Free play.
  assert.deepEqual(r.board.lastWeek.rows.filter((x) => x.ranked).map((x) => x.a), [P1]);
});

test("the recorder: two free players tied for 1st share it (2nd empty); a failed eligibility read means no file this run", async () => {
  const w = 3, staked = new Set();
  const dir = weekDir(w, [[FM, 0], [FN, 0], [FQ, 1]]);
  const r = await goWeek(dir, w, { staked, free: async (_w, who) => ({ staked: new Set(), ok: new Set(who) }) });
  assert.deepEqual([r.vault.first, r.vault.second], [[FM, FN].sort(), []]);
  const dir2 = weekDir(w, [[FM, 0]]);
  const r2 = await goWeek(dir2, w, { staked, free: async () => { throw new Error("node down"); } });
  assert.equal(r2.vault, null); assert.ok(r2.problems.some((p) => /free winners: node down/.test(p)));
});

test("watch-and-hold holds the whole week: no staked rows and no free winners until the owner releases it", async () => {
  const w = 3, staked = new Set([P1]);
  const dir = weekDir(w, [[P1, 1], [FM, 1]]);
  // M (50 expected an hour) signs 80 and wins all 3: flagged.
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("D"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (d.field) { d.hours[0].blocks = { [A("N")]: 100, [A("M")]: 80 }; fs.writeFileSync(path.join(dir, f), JSON.stringify(d)); }
  }
  const free = async (_w, who) => ({ staked: new Set(), ok: new Set(who) });
  const r = await goWeek(dir, w, { staked, free });
  assert.equal(r.vault, null); assert.ok(r.hold); assert.ok(!fs.existsSync(path.join(dir, "vault", `W${w}.json`)));
  const r2 = await goWeek(dir, w, { staked, free, release: [w] });
  assert.deepEqual([r2.vault.rows.map((x) => x.player), r2.vault.first], [[P1], [FM]], "released: both boards are paid");
});

// ── the publish job: the free winners are checked against the day files and the chain ──
const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12"], REST = ["2026-11-13", "2026-11-14", "2026-11-15"];
// FM rides the winner every day (15 points a day, like P1 and P2, who are staked); FN rides the last node cut (9 a day).
const FPICKS = [...PICKS, [FM, WINNER], [FN, CUT_ORDER[9]]];
const files3 = () => {
  const ds = DAYS.map((d) => dayFile(d, FPICKS));
  return { ds, files: { "board.json": boardOf(ds), ...Object.fromEntries(ds.map((d) => [`D${d.day}.json`, d])), ...Object.fromEntries(REST.map((x) => [`D${x}.json`, voidDay(x)])),
    "index.json": { ...idx, days: [...DAYS, ...REST] } } };
};
const goodVault = (ds) => ({ game: 13, week: 3, final: true, rows: vaultScores(boardOf(ds).lastWeek.rows.filter((r) => [P1, P2, P3].includes(r.a))), first: [FM], second: [FN] });
const chain3 = (o = {}) => chainFor([...DAYS, ...REST], { picks: FPICKS, vhp: { [FM]: 100000000, [FN]: 250000000 }, ...o });

linux("publish: a vault file with the right free winners is published; one that skips or swaps a winner is refused", () => {
  const { ds, files } = files3();
  const pub = publisher(); pub.chain(chain3()); pub.seed(files);
  for (const [why, first, second] of [["skips the true 1st", [FN], []], ["swaps 1st and 2nd", [FN], [FM]], ["a stranger", [A("x")], [FN]], ["no free winners", [], []]]) {
    const r = pub.publish({ ...files, "vault/W3.json": { ...goodVault(ds), first, second } });
    assert.notEqual(r.status, 0, why); assert.match(r.out, /free winners \(first\/second\) aren't what last week's Free play board gives|stranger|rows aren't/, why);
    assert.equal(pub.show("vault/W3.json"), null, why);
  }
  const ok = pub.publish({ ...files, "vault/W3.json": goodVault(ds) });
  assert.equal(ok.status, 0, ok.out); assert.deepEqual(JSON.parse(pub.show("vault/W3.json")).first, [FM]);
});

linux("publish: the chain decides who may win: no VHP, or staked in game 13 that week, passes the place on", () => {
  const { ds, files } = files3();
  // FM holds no VHP and no Knode stake: FN is 1st, and nobody else qualifies for 2nd.
  const noVhp = publisher(); noVhp.chain(chain3({ vhp: { [FN]: 250000000 } })); noVhp.seed(files);
  assert.notEqual(noVhp.publish({ ...files, "vault/W3.json": goodVault(ds) }).status, 0);
  const r = noVhp.publish({ ...files, "vault/W3.json": { ...goodVault(ds), first: [FN], second: [] } });
  assert.equal(r.status, 0, r.out);
  // FM has 1 VHP staked in another Knode Games game instead: eligible.
  const other = publisher(); other.chain(chain3({ vhp: { [FN]: 250000000 }, knode: { [FM]: { stake: 0, pending: 0, stake_other: 100000000 } } })); other.seed(files);
  assert.equal(other.publish({ ...files, "vault/W3.json": goodVault(ds) }).status, 0);
  // FM staked in game 13 and withdrew mid-week (peak at the minimum, counted stake 0): not free, and not in the rows.
  const peak = publisher(); peak.chain(chain3({ extra: { [`3:${FM}`]: { week_stake: 0, peak: 100000000, active: 0 } } })); peak.seed(files);
  assert.notEqual(peak.publish({ ...files, "vault/W3.json": goodVault(ds) }).status, 0, "FM can't win: it was staked that week");
  assert.equal(peak.publish({ ...files, "vault/W3.json": { ...goodVault(ds), first: [FN], second: [] } }).status, 0);
});

linux("publish: the two nodes disagree about a winner's VHP: the vault file waits (not published, tried again next run)", () => {
  const { ds, files } = files3();
  const pub = publisher(); const ch = chain3(); pub.chain({ ...ch, b: { vhp: { [FN]: 250000000 } } }); pub.seed(files);
  const r = pub.publish({ ...files, "vault/W3.json": goodVault(ds) });
  assert.equal(pub.show("vault/W3.json"), null); assert.match(r.out, /couldn't be checked on the chain/);
});

linux("publish: the shape check refuses a free winner who is also a staked row, 11 in a place, or a 2nd beside a shared 1st", () => {
  const { ds, files } = files3();
  for (const [why, v] of [["staked and free", { ...goodVault(ds), first: [P1] }], ["11 in 2nd", { ...goodVault(ds), second: Array.from({ length: 11 }, (_, i) => "1" + String.fromCharCode(97 + i).repeat(33)) }],
    ["2nd beside a tie for 1st", { ...goodVault(ds), first: [FM, FN], second: [A("x")] }], ["twice", { ...goodVault(ds), first: [FM], second: [FM] }]]) {
    const pub = publisher(); pub.chain(chain3()); pub.seed(files);
    const r = pub.publish({ ...files, "vault/W3.json": v });
    assert.notEqual(r.status, 0, why); assert.equal(pub.show("vault/W3.json"), null, why);
  }
});
