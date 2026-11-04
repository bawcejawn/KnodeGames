// Daily Questions (vault game 1) on the staking hub (owner, 4 Nov: "questions should be managed on the stake page like
// the other games"). stake-panel.js builds game 1's own vault calls (deposit_vhp / deposit_koin, withdraw, claim) the way
// the home page does (app.js), finds its rewards with the same rules (a ported copy of app.js's exactReward, freePrize
// and claimNeedsOwnMana), and asks for the player's own Mana when the home page would. Move uses move_stake both ways.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const src = fs.readFileSync(`${APP}/stake-panel.js`, "utf8");
const appSrc = fs.readFileSync(`${APP}/app.js`, "utf8");
const DEP = JSON.parse(fs.readFileSync(`${APP}/game-data/deployment.json`, "utf8"));
const UNIT = 100000000n;
const ME = "1PlayerAddrXXXXXXXXXXXXXXXXXXXXXXX";
const J = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v)));

/** A fake vault: get_state, list_games, get_player / get_week per question-game week, get_game_player (empty). */
function env({ state, games = [], qnow = {}, qweeks = {}, gweeks = {} } = {}) {
  const sent = [];
  class Contract {
    constructor({ id }) { this.id = id; const self = this;
      this.functions = new Proxy({}, { get: (_, m) => async (args, opt) => {
        if (opt && opt.onlyOperation) return { operation: { call_contract: { contract_id: self.id }, _m: m, _a: args } };
        if (m === "get_state") return { result: state };
        if (m === "list_games") return { result: { games } };
        if (m === "get_player") return { result: args.week === String(state.week) ? qnow : { entry: (qweeks[args.week] || {}).e } };
        if (m === "get_week") { const w = qweeks[args.week] || {}; return { result: { week: w.W, buckets: w.buckets } }; }
        if (m === "get_game_player") return { result: { entry: (gweeks[args.week] || {}).e } };
        if (m === "get_game") { const w = gweeks[args.week] || {}; return { result: { week: w.gw, buckets: w.buckets } }; }
        if (m === "balance_of") return { result: { value: "0" } };
        return { result: {} };
      } }); }
  }
  const ctx = {
    document: { createElement: () => ({}) },
    koilib: { Contract, Provider: class {} },
    KWallet: { address: ME, kind: "kondor", label: () => "Kondor", subscribe: () => {}, send: async (label, ops, opts) => { sent.push({ label, ops, opts }); return "0xtx"; } },
    fetch: async () => ({ ok: true, json: async () => DEP }),
    setInterval: () => 0, console, BigInt, Number, String, JSON, Promise, Object, Error,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { K: ctx.KStake, sent };
}
const LIVE = (o = {}) => ({ config: { genesis_time: String(DEP.genesisTime), week_length: "604800000", min_stake: String(UNIT), paused: false, v6_rule_week_plus_one: "3", max_sponsor_rc: "0" }, week: "5", time: "0",
  totals: { weeks_finalized: "4", seed_koin: "0", creator_fee: "0" }, vhp_balance: String(1000n * UNIT), koin_balance: "0", mana: String(10n * UNIT), ...o });
const QGAME = { id: 1, name: "Daily Questions", staked: true, free_prize: true, active: true, stake: String(120n * UNIT) };
const RACE = { id: 7, name: "Producer Race", staked: true, free_prize: true, active: true, stake: String(500n * UNIT) };

// ── 1. the ported claim rules give exactly what the home page's own code gives ──
/** Cut a top-level `function name(...) { ... }` out of app.js (by matching braces). */
function fnSrc(code, name) {
  const i = code.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `app.js has ${name}`);
  let d = 0, j = code.indexOf("{", i);
  for (let k = j; k < code.length; k++) { if (code[k] === "{") d++; else if (code[k] === "}" && --d === 0) return code.slice(i, k + 1); }
  throw new Error(`no end for ${name}`);
}
/** A one-line `const name = …;` from app.js (Repo Lens #142 I-4: the cap is app.js's too, not re-declared here). */
function constSrc(code, name) {
  const m = new RegExp(`^\\s*const ${name} = [^\\n]*;$`, "m").exec(code);
  assert.ok(m, `app.js has const ${name}`);
  return m[0].trim();
}
test("the hub's question-game claim rules are app.js's own: same answers on 5,000 random weeks", () => {
  const A = new Function("S", `"use strict";
    const big = (x) => { try { return BigInt(x ?? 0); } catch { return 0n; } }; const num = (x) => Number(x || 0);
    const UNIT = 100000000n; ${constSrc(appSrc, "CAP_A")} ${constSrc(appSrc, "capA")}
    ${fnSrc(appSrc, "exactReward")} ${fnSrc(appSrc, "freePrize")} ${fnSrc(appSrc, "claimNeedsOwnMana")}
    return { exactReward, freePrize, claimNeedsOwnMana };`);
  const T = env({ state: LIVE() }).K._test;
  // mulberry32: a small, well-spread 32-bit generator (fixed seed, so a failure always repeats).
  let seed = 7; const rnd = (n) => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) % n; };
  const seen = { reward: 0, prize: 0, own: 0, notOwn: 0 };
  const U = (n) => String(BigInt(rnd(n)) * 1000003n);
  for (let i = 0; i < 5000; i++) {
    const W = { sum_w: U(5000), pot_a: U(90000), pot_b: U(90000), aw_hi: String(rnd(3)), aw_lo: U(70000), bw_hi: String(rnd(3)), bw_lo: U(70000), reward_rule: rnd(2) === 1,
      pot_free: U(300), free_best: rnd(8), free_best_n: rnd(4), free_second: rnd(8), free_second_n: rnd(4) };
    const b = rnd(5) === 0 ? null : { players: rnd(6), sum_w: U(3000) }, e = { stake: U(4000) };
    const st = { totals: { seed_koin: U(500), creator_fee: U(500) }, config: { max_sponsor_rc: U(500) }, koin_balance: U(3000), vhp_balance: U(3000), mana: U(3000) };
    const pts = rnd(9), c = rnd(4) === 0 ? null : { reward: U(3000) };
    const a = A(st);
    assert.equal(T.qExactReward(W, b, e), a.exactReward(W, b, e), `exactReward #${i}`);
    assert.equal(T.qFreePrize(W, pts), a.freePrize(W, pts), `freePrize #${i}`);
    assert.equal(T.qNeedsOwnMana(c, st), a.claimNeedsOwnMana(c, st), `claimNeedsOwnMana #${i}`);
    if (a.exactReward(W, b, e) > 0n) seen.reward++;
    if (a.freePrize(W, pts) > 0n) seen.prize++;
    if (a.claimNeedsOwnMana(c, st)) seen.own++; else seen.notOwn++;
  }
  // Hand-picked edges: the own-Mana rule exactly at its boundary, no spare KOIN, enough VHP, an unknown reward.
  const st0 = (o) => ({ totals: { seed_koin: "100", creator_fee: "50" }, config: { max_sponsor_rc: "20" }, koin_balance: "250", vhp_balance: "10", mana: "120", ...o });
  for (const [c, st] of [[{ reward: "50" }, st0()], [{ reward: "50" }, st0({ mana: "119" })], [{ reward: "50" }, st0({ mana: "121" })],
    [{ reward: "50" }, st0({ koin_balance: "150" })], [{ reward: "5" }, st0()], [null, st0()], [{ reward: "0" }, st0()], [{ reward: "50" }, null]]) {
    assert.equal(T.qNeedsOwnMana(c, st), A(st).claimNeedsOwnMana(c, st), `edge ${JSON.stringify([c, st && st.mana, st && st.koin_balance])}`);
  }
  // The free prize at each place and tie.
  for (const [best, bn, second, sn, pts] of [[4, 1, 2, 1, 4], [4, 1, 2, 1, 2], [4, 2, 2, 1, 4], [4, 3, 2, 1, 4], [4, 1, 0, 0, 4], [4, 1, 2, 3, 2], [4, 2, 2, 1, 2], [4, 1, 2, 1, 3]]) {
    const W = { reward_rule: true, pot_free: String(2n * UNIT), free_best: best, free_best_n: bn, free_second: second, free_second_n: sn };
    assert.equal(T.qFreePrize(W, pts), A(null).freePrize(W, pts), `free prize ${[best, bn, second, sn, pts]}`);
  }
  // The inputs reach every branch (a test of all-zero cases would prove nothing).
  for (const [k, n] of Object.entries(seen)) assert.ok(n >= 100, `${k}: only ${n} of 5,000 cases`);
});

// ── 2. the operations ──
test("Daily Questions stake / withdraw / claim are the home page's own calls; Move uses move_stake both ways", async () => {
  const e = env({ state: LIVE(), games: [QGAME, RACE] });
  await e.K.send("stake", { game: 1, units: 5n * UNIT, koin: false });
  assert.deepEqual(J(e.sent[0].ops.map((o) => [o._m, o._a])), [
    ["approve", { owner: ME, spender: DEP.contract, value: String(5n * UNIT) }],
    ["deposit_vhp", { from: ME, amount: String(5n * UNIT) }]]);
  assert.equal(e.sent[0].ops[0].call_contract.contract_id, DEP.vhp);
  await e.K.send("stake", { game: 1, units: 3n * UNIT, koin: true });
  assert.deepEqual(J(e.sent[1].ops.map((o) => o._m)), ["approve", "deposit_koin"]);
  assert.equal(e.sent[1].ops[0].call_contract.contract_id, DEP.koin);
  await e.K.send("withdraw", { game: 1, units: UNIT / 2n });
  assert.deepEqual(J(e.sent[2].ops.map((o) => [o._m, o._a])), [["withdraw", { to: ME, amount: String(UNIT / 2n) }]]);
  await e.K.send("move", { game: 1, to: 7, units: UNIT });
  await e.K.send("move", { game: 7, to: 1, units: UNIT });
  assert.deepEqual(J([e.sent[3], e.sent[4]].map((s) => s.ops.map((o) => [o._m, o._a]))), [
    [["move_stake", { player: ME, from_game: 1, to_game: 7, amount: String(UNIT) }]],
    [["move_stake", { player: ME, from_game: 7, to_game: 1, amount: String(UNIT) }]]]);
  for (const s of e.sent) assert.ok(s.ops.every((o) => [DEP.contract, DEP.vhp, DEP.koin].includes(o.call_contract.contract_id)));
  // Other games are unchanged.
  await e.K.send("stake", { game: 7, units: UNIT, koin: false });
  assert.deepEqual(J(e.sent[5].ops.map((o) => o._m)), ["approve", "deposit_to"]);
});

test("claims: Daily Questions weeks use claim(week); a claim that needs the player's own Mana makes the transaction own-Mana", async () => {
  const e = env({ state: LIVE(), games: [QGAME, RACE] });
  await e.K.send("claim", { claims: [{ game: 1, week: 2n, ownMana: false }, { game: 7, week: 3n }] });
  assert.deepEqual(J(e.sent[0].ops.map((o) => [o._m, o._a])), [["claim", { player: ME, week: "2" }], ["claim_game", { player: ME, game: 7, week: "3" }]]);
  assert.deepEqual(J(e.sent[0].opts), {}, "no own-Mana request: the wallet decides as usual");
  await e.K.send("claim", { claims: [{ game: 1, week: 1n, ownMana: true }] });
  assert.deepEqual(J(e.sent[1].opts), { ownMana: true });
});

// ── 3. finding the rewards, as the home page does ──
test("overview: Daily Questions rewards from the finished weeks: staked reward, free prize (own Mana), nothing claimed twice", async () => {
  const W = { sum_w: "100", pot_a: String(40n * UNIT), pot_b: String(60n * UNIT), aw_hi: "0", aw_lo: String(1000n * UNIT), bw_hi: "0", bw_lo: String(1000n * UNIT), reward_rule: true, cutoff: 3,
    pot_free: String(2n * UNIT), free_best: 4, free_best_n: 1, free_second: 2, free_second_n: 1 };
  const buckets = []; buckets[5] = { players: 1, sum_w: "100" };
  const qweeks = {
    3: { W, buckets, e: { stake: String(10n * UNIT), points: 5, counted: 5, eligible: true, settled: true } },                       // staked, above the cutoff
    2: { W, buckets, e: { stake: "0", points: 4, counted: 4, eligible: false, settled: true, free_player: true } },                  // free player, best score
    1: { W, buckets, e: { stake: String(10n * UNIT), points: 5, counted: 5, eligible: true, settled: true, claimed: true } },        // already claimed
    0: { W, buckets, e: { stake: String(10n * UNIT), points: 2, counted: 2, eligible: true, settled: true } },                       // below the cutoff
  };
  const e = env({ state: LIVE(), games: [QGAME], qnow: { player: { stake: String(10n * UNIT), pending: "0" }, active_stake: String(10n * UNIT) }, qweeks });
  const o = await e.K.overview(ME);
  const q = o.games.find((g) => g.id === 1);
  assert.equal(q.mine, 10n * UNIT); assert.equal(q.staked, true);
  assert.deepEqual(J(q.claims.map((c) => [c.week, c.free, c.ownMana])), [["2", true, true], ["3", false, false]]);
  const T = e.K._test;
  assert.equal(q.claims[1].reward, T.qExactReward(W, buckets[5], qweeks[3].e));
  assert.equal(q.claims[0].reward, 1n * UNIT, "best free score, one second place: 1 VHP");
  // The pool short of VHP with spare KOIN above its Mana: that claim is paid with the player's own Mana.
  const short = env({ state: LIVE({ vhp_balance: "1", koin_balance: String(50n * UNIT), mana: String(UNIT) }), games: [QGAME], qnow: {}, qweeks });
  const q2 = (await short.K.overview(ME)).games[0];
  assert.equal(q2.claims.find((c) => !c.free).ownMana, true);
});

// ── Repo Lens #142 fixes ──
const Q61 = (o = {}) => LIVE({ config: { ...LIVE().config, q60_rule_week_plus_one: "6" }, week: "6", totals: { weeks_finalized: "6", seed_koin: "0", creator_fee: "0" }, ...o });
test("V61-1: from v6.1's rule week, Daily Questions stakes and withdraws with deposit_to / withdraw_from (game 1)", async () => {
  const e = env({ state: Q61(), games: [QGAME, RACE] });
  await e.K.send("stake", { game: 1, units: 2n * UNIT, koin: true });
  assert.deepEqual(J(e.sent[0].ops.map((o) => [o._m, o._a])), [
    ["approve", { owner: ME, spender: DEP.contract, value: String(2n * UNIT) }],
    ["deposit_to", { from: ME, game: 1, amount: String(2n * UNIT), koin: true }]]);
  await e.K.send("withdraw", { game: 1, units: UNIT });
  assert.deepEqual(J(e.sent[1].ops.map((o) => [o._m, o._a])), [["withdraw_from", { to: ME, game: 1, amount: String(UNIT) }]]);
  // Before the rule week (v6, or a v6.1 vault before R) the old calls stay.
  const old = env({ state: Q61({ week: "4" }), games: [QGAME] });
  await old.K.send("stake", { game: 1, units: UNIT, koin: false });
  assert.deepEqual(J(old.sent[0].ops.map((o) => o._m)), ["approve", "deposit_vhp"]);
});

test("V61-1: game-1 rewards from the rule week come from claim_game; earlier weeks keep the old claim; no week shows twice", async () => {
  const buckets = []; buckets[5] = { players: 1, sum_w: "100" };
  const W = { sum_w: "100", pot_a: String(40n * UNIT), pot_b: String(60n * UNIT), aw_hi: "0", aw_lo: String(1000n * UNIT), bw_hi: "0", bw_lo: String(1000n * UNIT), reward_rule: true, cutoff: 3 };
  const staked = { stake: String(10n * UNIT), points: 5, counted: 5, eligible: true, settled: true };
  const gw = { finalized: true, cutoff: 3, pot_a: String(4n * UNIT), pot_b: "0", aw_hi: "0", aw_lo: String(10n * UNIT), bw_hi: "0", bw_lo: "0" };
  const gb = []; gb[5] = { players: 1, sum_w: "100" };
  const e = env({ state: Q61(), games: [QGAME], qnow: {}, qweeks: { 4: { W, buckets, e: staked }, 5: { W, buckets, e: staked } },
    gweeks: { 5: { gw, buckets: gb, e: { stake: String(10n * UNIT), points: 5 } } } });
  const q = (await e.K.overview(ME)).games[0];
  assert.deepEqual(J(q.claims.map((c) => [c.week, !!c.shared])), [["4", false], ["5", true]], "week 4 the old way, week 5 (the rule week) like every game");
  await e.K.send("claim", { claims: q.claims.map((c) => ({ game: 1, week: c.week, reward: c.reward })) });
  assert.deepEqual(J(e.sent[0].ops.map((o) => [o._m, o._a])), [["claim", { player: ME, week: "4" }], ["claim_game", { player: ME, game: 1, week: "5" }]]);
});

test("L-1: Daily Questions looks back 104 finished weeks, as the home page does", async () => {
  const buckets = []; buckets[5] = { players: 1, sum_w: "100" };
  const W = { sum_w: "100", pot_a: String(40n * UNIT), pot_b: "0", aw_hi: "0", aw_lo: String(1000n * UNIT), bw_hi: "0", bw_lo: "0", reward_rule: true, cutoff: 3 };
  const e = env({ state: LIVE({ week: "61", totals: { weeks_finalized: "60", seed_koin: "0", creator_fee: "0" } }), games: [QGAME], qnow: {},
    qweeks: { 3: { W, buckets, e: { stake: String(10n * UNIT), points: 5, counted: 5, eligible: true, settled: true } } } });
  const q = (await e.K.overview(ME)).games[0];
  assert.deepEqual(J(q.claims.map((c) => c.week)), ["3"], "a reward 57 weeks back still shows");
});

test("I-1: the own-Mana rule is worked out again at send time, from the vault as it is then", async () => {
  // The page's list said no own Mana; the pool is now short of VHP with spare KOIN above its Mana.
  const e = env({ state: LIVE({ vhp_balance: "1", koin_balance: String(50n * UNIT), mana: String(UNIT) }), games: [QGAME] });
  await e.K.send("claim", { claims: [{ game: 1, week: 2n, reward: 5n * UNIT, ownMana: false }] });
  assert.deepEqual(J(e.sent[0].opts), { ownMana: true });
  const ok = env({ state: LIVE(), games: [QGAME] });
  await ok.K.send("claim", { claims: [{ game: 1, week: 2n, reward: 5n * UNIT, ownMana: false }] });
  assert.deepEqual(J(ok.sent[0].opts), {}, "enough VHP: the wallet decides as usual");
  await ok.K.send("claim", { claims: [{ game: 1, week: 2n, reward: 5n * UNIT, free: true }] });
  assert.deepEqual(J(ok.sent[1].opts), { ownMana: true }, "a free prize: always own Mana");
});
