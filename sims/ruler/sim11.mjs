// Knode Games — VHP ruler simulation 11 on real data (§8): JavaScript and Python make byte-identical v2.1 cards
// (pct, rate, the steering cap, minK and poolRule included). Python rebuilds every card from the hour files themselves
// (vhp_ruler.load_ledger, every hour checked) and recompute()s it from the game's settings.
//   node sims/ruler/sim11.mjs <vhp-data dir> [cards]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadVhpData } from "./v21.mjs";
import { raceSlots, VAULT } from "./sims.mjs";
const R = globalThis.window ? null : null;   // (the library is loaded by v21.mjs into its own sandbox)
import vm from "node:vm";
const here = new URL("../../", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(here + "vhp-ruler.js", "utf8"), box);
const K = box.window.KRuler;
const dir = process.argv[2], want = Number(process.argv[3] || 40);
const { tl } = loadVhpData(dir), L = K.ledger(tl);
const slots = raceSlots(L).filter((w) => w.W0 - K.FORM - K.ACTIVE >= L.from), cards = [], games = [];
for (let i = 0; i < Math.min(want, slots.length); i++) {
  const w = slots[Math.floor(i * slots.length / Math.min(want, slots.length))];
  const g = { game: 7, round: String(w.L), window: w, c: "500000", minK: [10, 15, 20, 30][i % 4], poolRule: "min", ownRule: ["spot", "high1h", "avg24h"][i % 3], paying: i % 2 === 0, pooled: [VAULT] };
  let c;
  try { c = K.makeCard(L, { ...g, c: 500000n }); c = K.scoreCard(L, c); } catch (e) { if (/not yet/.test(e.message)) continue; throw e; }
  cards.push(K.cardJson(c)); games.push(g);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sim11-"));
fs.writeFileSync(path.join(tmp, "cards.jsonl"), cards.join("")); fs.writeFileSync(path.join(tmp, "games.json"), JSON.stringify(games));
const t0 = Date.now();
const out = execFileSync("python3", ["-I", "-B", "-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(here)}); import vhp_ruler as V
L, _ = V.load_ledger(sys.argv[1]); bad = []
for i, (line, g) in enumerate(zip(open(sys.argv[2], encoding="utf-8"), json.load(open(sys.argv[3])))):
    ok, d = V.recompute(L, line, g)
    if not ok: bad.append([i, d])
print(json.dumps(bad))`, dir, path.join(tmp, "cards.jsonl"), path.join(tmp, "games.json")], { encoding: "utf8", maxBuffer: 1 << 26 }).trim();
const bad = JSON.parse(out), steady = cards.reduce((s, t) => s + JSON.parse(t).producers.filter((p) => BigInt(p.rate) < 1000000n).length, 0);
console.log(JSON.stringify({ cards: cards.length, same: cards.length - bad.length, bad, producersWithRateBelow1: steady, pythonSeconds: (Date.now() - t0) / 1000 }));
