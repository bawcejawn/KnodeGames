// Survivor season simulation on REAL ruler day cards (RULE_VERSION 4), for the 12-play-day season (owner 12 Nov).
//   node sims/survivor/season-sim.mjs <cards.json> [runs]
// cards.json: day cards made from the published vhp-data branch with Survivor's settings (sims/survivor/make-cards.mjs).
// Each run plays a season of 12 consecutive real days from a random start (wrapping), with N players on one board.
// Two kinds of player: "naive" picks a random unused producer in the field; "informed" picks the unused producer with
// the lowest out-zone rate over the days already played (what a player watching the page could know).
// Reports, per field rule and player count: the day the board ends (median, 90th percentile), how many are left after
// day 12, and how often each kind of player is among the last standing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const S = await import(pathToFileURL(path.join(here, "../../games/survivor/math.js")).href);
const cards = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const RUNS = Number(process.argv[3] || 400);

// A small seeded generator, so every run of the sim prints the same numbers.
let seed = 20261112;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function season(start, n, informed, outA, outB) {
  const days = [];
  for (let i = 0; i < S.SEASON_DAYS; i++) {
    const c = cards[(start + i) % cards.length];
    const d = S.dayFromCard({ round: String(c.S0), producers: c.producers }, i + 1);
    const o = Math.floor((d.field.length * (outA + i + 1)) / outB);
    const asc = d.field.map((f) => f[1]).sort((x, y) => x - y);
    d.out = o ? d.field.filter((f) => f[1] < asc[o]).map((f) => f[0]) : [];
    days.push(d);
  }
  const players = [];
  for (let p = 0; p < n; p++) players.push({ a: "1" + String(p).padStart(33, "A"), informed: p < n * informed, used: new Set(), list: [] });
  const outRate = new Map(), seen = new Map();
  for (const d of days) {
    for (const x of players) {
      const free = d.field.map((f) => f[0]).filter((a) => !x.used.has(a));
      if (!free.length) continue;
      let a;
      if (x.informed) {
        const r = (q) => (seen.get(q) ? (outRate.get(q) || 0) / seen.get(q) : 0.3);
        a = free.slice().sort((p, q) => r(p) - r(q) || (rnd() < 0.5 ? -1 : 1))[0];
      } else a = free[Math.floor(rnd() * free.length)];
      x.used.add(a); x.list.push([d.n, a]);
    }
    for (const [a] of d.field) { seen.set(a, (seen.get(a) || 0) + 1); if (d.out.includes(a)) outRate.set(a, (outRate.get(a) || 0) + 1); }
  }
  const picks = new Map(players.map((x) => [x.a, x.list]));
  const r = S.playSeason(days, picks, new Set());
  const ps = [...r.players.entries()];
  const left = ps.filter(([, x]) => x.outN === null).length;
  const best = Math.max(...ps.map(([, x]) => x.standing));
  const winners = ps.filter(([, x]) => x.standing === best).map(([a]) => players.find((y) => y.a === a));
  return { end: r.ends.free, left, informedWin: winners.filter((w) => w.informed).length / winners.length };
}

const pct = (xs, q) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
console.log(`Survivor, 12 play days, ${cards.length} real ruler day cards, ${RUNS} seasons per row`);
console.log("out-zone rule                players  end day (median / 90%)  left after day 12 (median)  informed share of wins (half the players are informed)");
for (const [A, B, name] of [[10, 44, "floor(m×(10+n)÷44) ¼→½"], [12, 52, "floor(m×(12+n)÷52) (old)"], [6, 36, "floor(m×(6+n)÷36) ⅕→½"]]) {
  for (const n of [10, 50, 200]) {
    const ends = [], lefts = [], inf = [];
    for (let i = 0; i < RUNS; i++) { const r = season(Math.floor(rnd() * cards.length), n, 0.5, A, B); ends.push(r.end); lefts.push(r.left); inf.push(r.informedWin); }
    const avg = inf.reduce((s, x) => s + x, 0) / inf.length;
    console.log(`${name.padEnd(28)} ${String(n).padStart(7)}  ${String(pct(ends, 0.5)).padStart(10)} / ${String(pct(ends, 0.9)).padEnd(10)}  ${String(pct(lefts, 0.5)).padStart(14)}               ${(avg * 100).toFixed(0)}%`);
  }
}
