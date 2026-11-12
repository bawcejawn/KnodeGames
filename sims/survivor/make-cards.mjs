// Survivor simulation input: real RULE_VERSION 4 day cards from the published vhp-data branch, with Survivor's settings
// (games/survivor/math.js CARD). Read only: it reads a local copy of vhp-data and writes one JSON file.
//   git clone --depth 1 -b vhp-data https://github.com/bawcejawn/KnodeGames.git <dir>
//   node --import tsx sims/survivor/make-cards.mjs <repo> <vhp-data dir> <out.json> [days]
//   MODE=D node --import tsx sims/survivor/make-cards.mjs …        (a ruler scoring mode, A–D; default A)
// A "day" here is 28,800 blocks ending just before the data's last block, not a UTC day: the data has heights, not
// clock times. The lock is 101 blocks (about 5 minutes) before the day, the size window the 7,200 blocks before that.
import fs from "node:fs";
import path from "node:path";
const [repo, dir, out, nDays = "20"] = process.argv.slice(2);
const { loadLedger } = await import(path.join(repo, "kit/recorder/sources/vhp-ruler.ts"));
const S = await import(path.join(repo, "games/survivor/math.js"));
await import(path.join(repo, "vhp-ruler.js"));
const R = globalThis.KRuler;
const L = loadLedger(dir);
console.log("ledger blocks", L.from, "to", L.to);
const days = [];
for (let S1 = L.to - R.DELAY - 1; days.length < Number(nDays); S1 -= 28800) {
  const S0 = S1 - 28799, Lk = S0 - 101;
  const window = { W0: Lk - S.CARD_BLOCKS + 1, W1: Lk, L: Lk, S0, S1 };
  try {
    const c = R.scoreCard(L, R.makeCard(L, { game: S.CARD.game, round: String(S0), window, c: BigInt(S.CARD.c), minK: S.CARD.minK, poolRule: S.CARD.poolRule,
      ownRule: S.CARD.ownRule, paying: false, ...(process.env.MODE ? { mode: process.env.MODE } : {}), pooled: [...S.CARD.pooled] }));
    const j = JSON.parse(R.cardJson(c));
    days.push({ S0, producers: j.producers.map((p) => ({ a: p.a, entry: p.entry, void: p.void, fpct: p.fpct, expected: p.expected, signed: p.signed })) });
  } catch (e) { console.log("stopped at", S0, e.message.slice(0, 120)); break; }
}
fs.writeFileSync(out, JSON.stringify(days.reverse()));
console.log("cards", days.length);
