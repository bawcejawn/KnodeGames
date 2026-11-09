// Repo Lens #B-14 (KnodeGames PR #227, main 29075a9): failing tests for B14-1 and B14-3; todos for B14-2.
// Helpers copied verbatim from tests/audit/blockx-recorder.test.mjs lines 1-48 (fake nodes, fake race files; offline).
// Who Signs Block X recorder (bot/games/blockx.ts): targets recorded only once irreversible and matching on two nodes,
// picks agreeing on both nodes, points from the race card in force at the lock, void when no card ever comes, the
// leaderboards and the week's prizes after the 12-hour correction window. Offline: fake nodes and fake race files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const { run, vaultFile, releaseCode, releaseMatches } = await import(path.resolve(APP, "bot/games/blockx.ts"));
const M = globalThis.KRaceMath, X = globalThis.KBlockX;
const plain = (x) => JSON.parse(JSON.stringify(x));

const BIG = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", MID = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", SMALL = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const ALICE = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", BOB = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", GUEST = "1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

// Week 3 (Mon 2 Nov 2026). A made-up chain: block h at time T(h); every target is signed by BIG except every third (MID).
const W3 = M.weekStart(3);
const H0 = 48_000_000;                          // a height at W3 + 1 h
const T = (h) => W3 + 3600000 + (h - H0) * 3000;
const signerOf = (h) => (h % X.ROUND === 0 && (h / X.ROUND) % 3 === 0 ? MID : BIG);
function blockOf(tamperAt = null) {
  return async (node, h) => ({ signer: node === "check" && tamperAt === h ? SMALL : signerOf(h), time: T(h) });
}
// Picks: Alice always picks MID, Bob always BIG, the guest SMALL. Times spread over 3 days.
function picksOf(tamperRound = null) {
  return async (node, r) => {
    const t = T(r * X.ROUND) - 3600000;
    const rows = [{ player: ALICE, producer: MID, time: t }, { player: BOB, producer: BIG, time: t }, { player: GUEST, producer: SMALL, time: t }];
    if (node === "check" && r === tamperRound) rows[0].producer = BIG;
    return rows;
  };
}
const rankedOf = async (who) => new Set(who.filter((a) => a !== GUEST));
const CARD = { at: 0, c: 1, blocksPerRace: 7200, fairness: null, field: [{ a: BIG, vhp: 2000, k: 600, h: 1 }, { a: MID, vhp: 1000, k: 300, h: 2 }], paddock: [{ a: SMALL, vhp: 10, k: 3 }] };
function raceDir({ withCards = true, weeks = [2, 3, 4] } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-"));
  for (const w of weeks) {
    const races = [];
    // Each hourly card stamped with the time the race recorder took it (37 minutes into its hour), as on mainnet.
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) { const i = M.raceIndex(t); races.push({ id: M.raceId(i), start: t, end: t + M.RACE, cards: Array.from({ length: 6 }, (_, l) => (withCards ? { ...CARD, samples: 36, at: t + l * 3600000 + 37 * 60000 } : null)), result: null }); }
    fs.writeFileSync(path.join(d, `W${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "blockx-"));
const quiet = async (f) => { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } };
const SW4 = [{ game: X.MAINNET_GAME, fromWeek: 0, toWeek: 4 }, { game: X.MAINNET_HOURLY, fromWeek: 4, toWeek: Infinity }];
const cfgOf = (g) => ({ round_size: String(g.round), round_offset: "0", lead: String(g.lead), enabled: true });

test("Repo Lens #B-14 B14-1: a round that has picks is never recorded with none, even if both nodes say game 12 isn't registered", async () => {
  // Both nodes answer get_game from a stale state ("not on the Picks contract") until Monday + 1 day, while list_picks
  // already returns real picks. Safe behaviour: those rounds wait (as a disagreement does); none is written with no picks.
  const rd = raceDir({ weeks: [2, 3, 4, 5] });
  const startH = H0 - 1200, w5H = startH + 14 * 28800, until = M.weekStart(4) + X.DAY;
  let now = 0;
  const gameOf = async (_n, id) => (id === 2 ? { result: { game: cfgOf(X.MAINNET_GAME) } } : now >= until ? { result: { game: cfgOf(X.MAINNET_HOURLY) } } : { result: {} });
  const picksH = async (node, r, g) => { const h = g === 12 ? r * 1200 : r * 2400; return [{ player: BOB, producer: signerOf(h), time: T(h) - 3600000 }]; };
  let prev; const outs = [];
  for (let lib = startH + 14400; lib <= w5H + 2400; lib += 14400) {
    const o = tmp(); now = T(lib + 60);
    await quiet(() => run({ p: "main", check: "check", prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksH, gameOf, rankedOf, prizesFromWeek: 3,
      schedule: SW4, vaultGame: X.VAULT_GAME, head: { height: lib + 60, time: now, lib } }));
    prev = o; outs.push(o);
  }
  const w4 = JSON.parse(fs.readFileSync(path.join([...outs].reverse().find((d) => fs.existsSync(path.join(d, "W004.json"))), "W004.json"), "utf8"));
  const emptied = w4.targets.filter((t) => t.picks.length === 0).map((t) => t.round);
  assert.deepEqual(emptied, [], `rounds with picks on chain written with none: ${emptied.length} (${emptied.slice(0, 5).join(", ")}…)`);
  const board = JSON.parse(fs.readFileSync(path.join(prev, "board.json"), "utf8"));
  assert.equal(board.lastWeek.final, true, "and the week still goes final");
});

// Kept as a todo (it reports but doesn't fail CI) until a sponsored move is measured: mana-report after the first real
// sponsored move on mainnet (R-BX-18), then the row in sponsor-data/mana-limits.json and its rcLimits entry.
test("Repo Lens #B-14 B14-3: move_stake has a measured Mana row before the page asks the sponsor for it", { todo: "measure a sponsored move_stake (npm run sponsor -- mana-report) and add its row" }, () => {
  const rows = JSON.parse(fs.readFileSync(path.resolve(APP, "sponsor-data/mana-limits.json"), "utf8")).rows;
  const vault = JSON.parse(fs.readFileSync(path.resolve(APP, "game-data/deployment.json"), "utf8")).contract;
  assert.ok(rows.some((r) => r.contract === vault && Number(r.entry_point) === 0x7c268e69), "sponsor-data/mana-limits.json has no move_stake (0x7c268e69) row: the move asks for the 2.4 per-transaction cap, unmeasured");
  const sp = JSON.parse(fs.readFileSync(path.resolve(APP, "game-data/deployment.json"), "utf8")).sponsor;
  assert.ok(sp.rcLimits && sp.rcLimits[`${vault}:7c268e69`], "game-data/deployment.json sponsor.rcLimits has no move_stake entry");
});

test("Repo Lens #B-14 B14-2 (source): the pick box traps Tab only while it is the top dialog", () => {
  const js = fs.readFileSync(path.resolve(APP, "blockx.js"), "utf8");
  const i = js.indexOf('if (e.key === "Tab") {');
  assert.ok(i > 0);
  const body = js.slice(i, i + 1500);
  assert.match(body, /if \(document\.querySelector\("\.kw-back"\) \|\| \(inOther && inOther !== modal\)\) return;/, "a wallet box or another dialog on top keeps its own Tab order");
  assert.ok(body.indexOf("return;") < body.indexOf("e.preventDefault(); f[next].focus();"), "it returns before trapping");
});

test.todo("Repo Lens #B-14 B14-2 (browser, checked by hand in Chromium 6 Nov: wallet box on top → Tab reaches Open KOIN Vault): with the wallet's own box (KOIN Vault 'Approve' box, .kw-back) open on top of the busy pick box, Tab moves between that box's controls ('Open KOIN Vault' is reachable); the pick box traps Tab only while it is the topmost dialog (run in a browser, e.g. Playwright, against blockx.js pickModal/closeModal and wallet.js open())");
