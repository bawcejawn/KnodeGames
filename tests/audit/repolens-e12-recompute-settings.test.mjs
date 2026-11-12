// Repo Lens #E-12, finding M-1 (added to the repo with the fix; its chain lengthened for #E-12 L-1) (vhp-ruler @ 32a8797; same in 45cb328): recompute() rebuilds a card from the card's OWN window,
// c, ownRule, paying and pooled flags, so a card made with other settings than the game's passes. Proposed shape of the fix:
// recompute(L, published, game) where `game` = { game, round, window, c, ownRule, paying, pooled } comes from the game's own
// config, and any difference in those fields is reported. Written, not run against the repo. Fails on 32a8797 (the third
// argument is ignored); passes once recompute compares the card's settings with the game's.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { longTimeline, PY } from "./vhp-ruler.fixture.mjs";

const ROOT = process.env.APP || fileURLToPath(new URL("../..", import.meta.url));
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(`${ROOT}/vhp-ruler.js`, "utf8"), box);
const R = box.window.KRuler;

// A chain long enough for a paying card (14 days + 6 h of data before T, #E-12 L-1): the same shape the reviewer used.
const { tl, ps } = longTimeline({ n: 440000 });
const W0 = tl.from + 415000, window = { W0, W1: W0 + 7199, L: W0 + 7200, S0: W0 + 7201, S1: W0 + 14400 };
const game = { game: 7, round: "2026111006", window, c: 400000n, minK: 10, poolRule: "min", ownRule: "high1h", paying: true, pooled: [ps[2]] };
const L = R.ledger({ ...tl, rebuilt: [{ h0: W0 - 2000, h1: W0 - 1000 }] });

test("E12-M1 (fixture check): the game's own card recomputes as the same", () => {
  const card = R.cardJson(R.makeCard(L, game));
  assert.equal(R.recompute(L, card, game).same, true);
});

for (const [what, change] of [
  ["paying: false (skips the D-112 rebuilt-hour rule)", { paying: false }],
  ["c: 0", { c: 0n }],
  ["ownRule: avg24h", { ownRule: "avg24h" }],
  ["the window moved by 3,000 blocks (another T)", { window: { ...window, W0: W0 - 3000, W1: W0 + 4199 } }],
  ["no pooled producer", { pooled: [] }],
]) {
  test(`E12-M1: a card made with ${what} doesn't pass as the game's card`, () => {
    const forged = R.cardJson(R.makeCard(L, { ...game, ...change }));
    assert.equal(R.recompute(L, forged, game).same, false, "recompute must compare the card's settings with the game's");
  });
}

test("E12-M1 (Python twin): recompute(L, card, game) refuses the same forged cards and passes the game's own", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e12-"));
  const cards = [R.makeCard(L, game), ...[{ paying: false }, { c: 0n }, { ownRule: "avg24h" }, { window: { ...window, W0: W0 - 3000, W1: W0 + 4199 } }, { pooled: [] }].map((ch) => R.makeCard(L, { ...game, ...ch }))].map(R.cardJson);
  const j = (x) => JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v));
  fs.writeFileSync(path.join(dir, "in.json"), j({ tl: { ...tl, rebuilt: [{ h0: W0 - 2000, h1: W0 - 1000 }] }, cards, game }));
  const out = PY(`j = json.load(open(${JSON.stringify(path.join(dir, "in.json"))}))
L = V.Ledger(j["tl"]); print(json.dumps([V.recompute(L, c, j["game"])[0] for c in j["cards"]]))`);
  assert.deepEqual(JSON.parse(out), [true, false, false, false, false, false]);
});
