// Repo Lens (Block X late-card round, Sun 15 Nov 2026): L-6. Put in tests/audit/ and run:
//   TZ=UTC node --import tsx --test tests/audit/blockx-thin-card-alert.repolens.test.mjs
// Live race-data W003 on Sun 15 Nov: cards were taken every hour, but from about 03:00 to 20:00 UTC almost all had
// 9-10 VHP samples (< MIN_CARD_SAMPLES 12), so none was usable. The new alert then says "no usable race card … Run
// the race workflow", which points at the wrong workflow: the race recorder ran; the sampler (race-samples) didn't
// give enough samples. The alert should say the recent cards are thin and point at race-samples.
// Expected at 93d859e3: the control passes; L-6 FAILS (the text doesn't mention samples).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const { run } = await import(path.resolve(APP, "bot/games/blockx.ts"));
const M = globalThis.KRaceMath;
const HOUR = 3600000;
const BIG = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", MID = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const W3 = M.weekStart(3), H0 = 48_000_000;
const T = (h) => W3 + HOUR + (h - H0) * 3000;
const CARD = { c: 1, blocksPerRace: 7200, fairness: null, field: [{ a: BIG, vhp: 2000, k: 600, h: 1 }, { a: MID, vhp: 1000, k: 300, h: 2 }], paddock: [] };
/** Hourly cards at :37 for weeks 2-4; cards taken after `thinFrom` have `thin` samples (else 36). */
function raceDir(thinFrom, thin) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-thin-"));
  for (const w of [2, 3, 4]) {
    const races = [];
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) {
      races.push({ id: M.raceId(M.raceIndex(t)), start: t, end: t + M.RACE, result: null,
        cards: Array.from({ length: 6 }, (_, l) => { const at = t + l * HOUR + 37 * 60000; return { ...CARD, samples: at > thinFrom ? thin : 36, at }; }) });
    }
    fs.writeFileSync(path.join(d, `W${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
const quiet = async (f) => { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } };
const runAt = (lib, rd) => quiet(() => run({ p: "main", check: null, out: fs.mkdtempSync(path.join(os.tmpdir(), "bx-thin-")), raceDir: rd, picksContract: "1P",
  blockOf: async (_n, h) => ({ signer: BIG, time: T(h) }), picksOf: async () => [], rankedOf: async () => new Set(),
  head: { height: lib, time: T(lib), lib } }));
const late = (r) => r.held.filter((h) => /race card/.test(h));

test("control: hourly cards, all thin for the last 4 hours: one alert", async () => {
  const lib = H0 + 30 * 1200 + 50, now = T(lib);
  const a = late(await runAt(lib, raceDir(now - 4 * HOUR, 9)));
  assert.equal(a.length, 1, a.join(" | "));
});

test("L-6: when the recent cards exist but are thin (< 12 samples), the alert says so and points at the sampler", async () => {
  const lib = H0 + 30 * 1200 + 50, now = T(lib);
  const a = late(await runAt(lib, raceDir(now - 4 * HOUR, 9)));
  assert.match(a[0] ?? "", /sample/i, `alert text: ${a[0]}`);
  assert.match(a[0] ?? "", /race-samples|sampler/i, `alert text: ${a[0]}`);
});
