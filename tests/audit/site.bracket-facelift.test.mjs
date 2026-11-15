// Bracket page facelift (owner, 14 Nov 2026): short hero, rules book at the bottom, the whole bracket as columns on wide
// screens, a round stepper with counts on phones that moves on by itself, game labels, upset tags and a champion card.
// openPage() as in site.bracket-practice.test.mjs, plus a `wide` switch for window.matchMedia.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const APP = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");
await import(path.resolve(APP, "vhp-standard.js")); await import(path.resolve(APP, "bracket-math.js"));
const BM = globalThis.KBracketMath;
const PINNED = "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm";
const ALICE = "1A1iceAAAAAAAAAAAAAAAAAAAAAAAAAAAA", BOB = "1BobBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const seeds = Array.from({ length: 8 }, (_, i) => "1Seed" + "ABCDEFGH"[i] + "x".repeat(28));
const windows = [];
after(() => { for (const w of windows) w.close(); });   // the page's refresh timers would keep the test alive
const flush = async (w, n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => w.setTimeout(r, 0)); };

async function openPage({ now, chainNow = now, picksDeployment = PINNED, index, game, noWeek = false, weekExtra = {}, wide = false } = {}) {
  const W = 4;   // shown week: seeded Sunday, picks until Monday 23:55
  const weekFile = { v: BM.FILE_V, week: W, start: BM.weekStart(W), end: BM.weekStart(W + 1), status: "open",
    seeding: { at: BM.seedTime(W), cardAt: 1, size: 8, seeds, vhp: seeds.map((_, i) => 8 - i), totalVhp: 36, out: [], outVhp: [], raw: {}, pooled: [], hash: "x" },
    picks: null, days: [[], [], []].map(() => new Array(24).fill(null)), results: null, points: [], staked: null, ...weekExtra };
  const dom = new JSDOM(read("bracket.html"), { runScripts: "outside-only", url: "https://knodegames.com/bracket.html" });
  const w = dom.window; windows.push(w);
  w.Date.now = () => now;
  w.matchMedia = (q) => ({ matches: wide && /min-width: 1000px/.test(q), addEventListener() {}, removeEventListener() {} });
  const sent = [], picks = [];
  let chainPick = null;
  w.fetch = async (u) => {
    const s = String(u);
    const json = (o) => ({ ok: true, status: 200, json: async () => o });
    if (s.endsWith("picks-data/deployment.json")) return json({ contract: picksDeployment });
    if (s.endsWith("game-data/deployment.json")) return json({ chainId: "x" });
    if (s.endsWith("picks/abi/picks.koilib.json")) return json({ methods: {} });
    if (s.endsWith(`W00${W}.json`) && !noWeek) return json(weekFile);
    if (s.endsWith("bracket/index.json") && index !== undefined) return json(index);
    return { ok: false, status: 404, json: async () => null };
  };
  w.koilib = {
    Provider: class { async getHeadInfo() { return { head_block_time: String(chainNow) }; } },
    Contract: class {
      constructor(o) {
        this.id = o.id;
        this.functions = {
          ...(game === undefined ? {} : { get_game: async () => ({ result: game === null ? {} : { game } }) }),
          get_pick: async () => ({ result: chainPick === null ? {} : { pick: { number: String(chainPick), time: "1" } } }),
          pick: async (args) => { picks.push({ ...args, contract: o.id }); return { operation: { args } }; },
        };
      }
    },
  };
  const listeners = new Set();
  const wallet = { address: ALICE, kind: "kondor" };
  w.KWallet = {
    get address() { return wallet.address; }, get kind() { return wallet.kind; }, label: () => "Kondor",
    init() {}, subscribe: (f) => listeners.add(f),
    async send(what, ops) { sent.push({ what, ops, from: wallet.address }); chainPick = Number(ops[0].args.number); return "0xtx"; },
  };
  for (const f of ["vhp-standard.js", "bracket-math.js", "bracket.js"]) w.eval(read(f));
  await flush(w, 20);
  const $ = (id) => w.document.getElementById(id);
  const modal = () => w.document.querySelector(".pk-modal");
  const modalText = () => (modal() && !modal().hidden ? modal().textContent : "");
  const button = (text) => [...w.document.querySelectorAll(".pk-modal button")].find((b) => b.textContent === text);
  return {
    w, $, modal, modalText, button, sent, picks, wallet,
    switchAccount: async (a, notify = true) => { wallet.address = a; if (notify) for (const f of listeners) f(); await flush(w); },
    fill: async () => { $("bk-fill-chalk").click(); await flush(w); },
    review: async () => { $("bk-submit").click(); await flush(w); },
    confirm: async () => { const b = button("Confirm in wallet"); assert.ok(b, "a Confirm button: " + modalText()); b.click(); await flush(w, 30); },
  };
}
const SUNDAY = BM.seedTime(4) + 3 * 3600000;
const GAME = { enabled: true };
const page = read("bracket.html");

test("top of the page: the game in one line and three steps; the long rules are in the rules book at the bottom", () => {
  const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  const hero = main.slice(main.indexOf('class="bk-hero"'), main.indexOf("</section>"));
  assert.match(hero, /Pick who wins every matchup\./);
  assert.equal((hero.match(/<li>/g) || []).length, 3);
  assert.ok(hero.replace(/<[^>]+>/g, "").length < 330, "short");
  const rules = main.slice(main.indexOf('id="how"'));
  for (const t of ["The week", "The field", "Your pick", "A matchup", "Forfeits", "The Knode Games Pool", "Points", "Fair checks", "The leaderboard", "Reading the bracket"]) assert.match(rules, new RegExp(`<summary>${t}</summary>`));
  assert.ok(main.indexOf('id="how"') > main.indexOf('id="board-box"'), "rules after the leaderboard");
  assert.ok(rules.includes('id="bk-ruler"'), "the ruler note lives in the rules book");
});

test("phones: a round stepper with counts; picking the whole round moves on to the next; the Final shows the champion card", async () => {
  const p = await openPage({ now: SUNDAY, game: GAME });
  const d = p.w.document;
  assert.equal(p.$("bk-rounds").hidden, false);
  assert.equal(p.$("bk-quick").hidden, false);
  assert.match(p.$("bk-rounds").textContent, /0\/4.*0\/2.*0\/1/);
  const games = [...d.querySelectorAll("#bk-list .bk-match")];
  assert.deepEqual(games.map((g) => g.querySelector(".bk-game").textContent), ["Game 1", "Game 2", "Game 3", "Game 4"]);
  // pick the lower seed in game 1 (an upset), then the better seed in the rest
  d.querySelectorAll("#bk-list .bk-match")[0].querySelectorAll("button.bk-side")[1].click(); await flush(p.w);
  assert.match(d.querySelectorAll("#bk-list .bk-match")[0].textContent, /Upset pick/);
  for (let m = 1; m < 4; m++) { d.querySelectorAll("#bk-list .bk-match")[m].querySelectorAll("button.bk-side")[0].click(); await flush(p.w); }
  assert.match(p.$("bk-day").textContent, /^Semifinals/, "moved on to the next round by itself");
  assert.match(p.$("bk-rounds").textContent, /4\/4/);
  assert.match(p.$("bk-progress").textContent, /^4 of 7 picked/);
  assert.equal(p.$("bk-bar").style.width, "57%");
  await p.fill();
  p.$("bk-rounds").querySelectorAll("button")[2].click(); await flush(p.w);
  const champ = d.querySelector("#bk-list .bk-champ");
  assert.ok(champ, "champion card on the Final");
  assert.match(champ.textContent, /Your champion.*Seed 1/);
});

test("phones: a TBD slot names the game it waits for", async () => {
  const p = await openPage({ now: SUNDAY, game: GAME });
  p.$("bk-rounds").querySelectorAll("button")[1].click(); await flush(p.w);
  assert.match(p.$("bk-list").textContent, /Winner of Quarterfinals game 1.*Winner of Quarterfinals game 2/);
});

test("wide screens: the whole bracket as columns (each round and the champion), no round stepper", async () => {
  const p = await openPage({ now: SUNDAY, game: GAME, wide: true });
  const d = p.w.document;
  assert.ok(p.$("bk-list").classList.contains("tree"));
  assert.equal(p.$("bk-rounds").hidden, true);
  const cols = [...d.querySelectorAll("#bk-list .bk-col")];
  assert.deepEqual(cols.map((c) => c.querySelector(".bk-col-h b").textContent), ["Quarterfinals", "Semifinals", "Final", "Champion"]);
  assert.deepEqual(cols.slice(0, 3).map((c) => c.querySelectorAll(".bk-match").length), [4, 2, 1]);
  await p.fill();
  assert.match(d.querySelector(".bk-col-champ").textContent, /Your champion.*Seed 1/);
  assert.equal(d.querySelectorAll("#bk-list .bk-side.picked").length, 7, "every pick shows in the tree");
});

test("results: a real upset says Upset!, losers are struck through, a real champion says whether you called it", async () => {
  const res = { rounds: [[1, 4, 3, 7], [1, 3], [3]], done: true };   // 8 seeds play 1–8, 4–5, 3–6, 2–7
  const p = await openPage({ now: BM.weekStart(5) - 3600000, weekExtra: { status: "final", picks: { rows: [] }, results: res } });
  const d = p.w.document;
  p.$("bk-rounds").querySelectorAll("button")[0].click(); await flush(p.w);
  const g3 = d.querySelectorAll("#bk-list .bk-match")[3];
  assert.match(g3.textContent, /Upset!/, "seed 7 beat seed 2");
  assert.ok(g3.querySelector(".bk-side.lost"));
  assert.doesNotMatch(d.querySelectorAll("#bk-list .bk-match")[0].textContent, /Upset/, "seed 1 beating 8 is no upset");
  p.$("bk-rounds").querySelectorAll("button")[2].click(); await flush(p.w);
  assert.match(d.querySelector("#bk-list .bk-champ").textContent, /^🏆Champion/);
});

test("follow a producer: pick one, its games light up, its standing shows, and the page link keeps it (no storage)", async () => {
  const p = await openPage({ now: SUNDAY, game: GAME });
  const d = p.w.document, sel = d.querySelector("#bk-follow select");
  assert.ok(sel, "the Follow picker");
  assert.equal(sel.options.length, 9, "Nobody + 8 seeds");
  sel.value = seeds[2]; sel.dispatchEvent(new p.w.Event("change")); await flush(p.w);
  assert.equal(new URLSearchParams(p.w.location.search).get("follow"), seeds[2]);
  assert.equal(p.w.localStorage.getItem("bk-follow"), null, "nothing stored");
  assert.equal(p.$("bk-follow-st").textContent, "Seed #3, still in (Quarterfinals)");
  const lit = [...d.querySelectorAll("#bk-list .bk-side.follow")];
  assert.equal(lit.length, 1);
  assert.match(lit[0].querySelector(".bk-seed").textContent, /^3$/);
  d.querySelector("#bk-follow select").value = ""; d.querySelector("#bk-follow select").dispatchEvent(new p.w.Event("change")); await flush(p.w);
  assert.equal(d.querySelectorAll("#bk-list .bk-side.follow").length, 0);
  assert.equal(new URLSearchParams(p.w.location.search).get("follow"), null);
});

test("follow a producer: with results, knocked out / champion as the Bracket chat's rule says", async () => {
  const res = { rounds: [[1, 4, 3, 7], [1, 3], [3]], done: true };   // 1–8, 4–5, 3–6, 2–7
  const p = await openPage({ now: BM.weekStart(5) - 3600000, weekExtra: { status: "final", picks: { rows: [] }, results: res } });
  const pick = async (k) => { const s = p.w.document.querySelector("#bk-follow select"); s.value = seeds[k - 1]; s.dispatchEvent(new p.w.Event("change")); await flush(p.w); return p.$("bk-follow-st").textContent; };
  assert.equal(await pick(2), "Seed #2, knocked out in the Quarterfinals");
  assert.equal(await pick(1), "Seed #1, knocked out in the Final");
  assert.equal(await pick(3), "Seed #3, champion! 🏆");
});
