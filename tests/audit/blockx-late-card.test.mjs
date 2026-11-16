// Block X late-card rule (incident Sat 14 Nov 2026: GitHub skipped the race recorder's runs, the current race had no
// card, and the page showed no producers while the recorder could still score with the last card it had).
// One rule, X.cardInForce in blockx-math.js, for the page and the recorder (audit BX-3, BX-24, BX-38); the recorder
// alerts the owner when the newest usable race card is more than 2 hours old. Offline: fake nodes and race files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const { run } = await import(path.resolve(APP, "bot/games/blockx.ts"));
const M = globalThis.KRaceMath, X = globalThis.KBlockX;
const HOUR = 3600000;

/** The recorder's rule before this change (bot/games/blockx.ts at main 5720cc89), kept here as the reference. */
function oldRule(cards, t, race) {
  const usable = (c) => !!c && Number.isFinite(c.at) && Array.isArray(c.field) && c.field.length > 0 && (!race || (Number.isInteger(c.samples) && c.samples >= 12));
  let best = null;
  for (const c of cards) {
    if (!usable(c)) continue;
    if (c.at <= t && t - c.at <= 3 * HOUR && (!best || c.at > best.at)) best = c;
  }
  return best;
}

test("cardInForce: the latest usable card taken at or before t, at most 3 hours old; race cards need 12 samples", () => {
  const f = [{ a: "1A", vhp: 1 }];
  const t = 10 * HOUR;
  const c = (at, samples = 36, field = f) => ({ at, samples, field });
  assert.equal(X.CARD_MAX_AGE_MS, 3 * HOUR); assert.equal(X.MIN_CARD_SAMPLES, 12); assert.equal(X.CARD_LATE_MS, 2 * HOUR);
  assert.equal(X.cardInForce([c(t - HOUR), c(t - 2 * HOUR)], t, 12).at, t - HOUR, "the latest");
  assert.equal(X.cardInForce([c(t + 1)], t, 12), null, "never a card taken after t (BX-3)");
  assert.equal(X.cardInForce([c(t - 3 * HOUR)], t, 12).at, t - 3 * HOUR, "3 hours old still counts");
  assert.equal(X.cardInForce([c(t - 3 * HOUR - 1)], t, 12), null, "older than 3 hours: none");
  assert.equal(X.cardInForce([c(t - HOUR, 9), c(t - 2 * HOUR, 12)], t, 12).at, t - 2 * HOUR, "BX-38: a thin card is skipped");
  assert.equal(X.cardInForce([c(t - HOUR, undefined)], t, 0).at, t - HOUR, "self-made cards: no sample minimum");
  assert.equal(X.cardInForce([c(t - HOUR, 36, [])], t, 12), null, "an empty field is never used");
  assert.equal(X.cardInForce([null, undefined, { at: NaN, field: f, samples: 36 }], t, 12), null);
  const a = c(t - HOUR), b = c(t - HOUR);
  assert.equal(X.cardInForce([a, b], t, 12), a, "a tie: the first listed");
  assert.equal(X.cardInForce(undefined, t, 12), null);
});

test("cardInForce is exactly the recorder's old rule (so no pick is scored differently)", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 4000; i++) {
    const t = 100 * HOUR;
    const cards = Array.from({ length: Math.floor(rnd() * 9) }, () => (rnd() < 0.1 ? null : {
      at: rnd() < 0.05 ? NaN : t - Math.round((rnd() * 5 - 0.5) * HOUR / 600000) * 600000,
      samples: rnd() < 0.1 ? undefined : Math.floor(rnd() * 30),
      field: rnd() < 0.1 ? [] : [{ a: "1A", vhp: 1 }],
    }));
    for (const race of [true, false]) assert.equal(X.cardInForce(cards, t, race ? 12 : 0), oldRule(cards, t, race));
  }
  const src = fs.readFileSync(path.join(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /const latestCardAt = \(cards: \(Card \| null \| undefined\)\[\], t: number, race = false\): Card \| null => X\.cardInForce\(cards, t, race \? MIN_CARD_SAMPLES : 0\);/, "the recorder uses the shared rule");
  assert.match(src, /const usable = \(c: Card \| null \| undefined, race: boolean\): c is Card => X\.cardUsable\(c, race \? MIN_CARD_SAMPLES : 0\);/);
  assert.match(src, /const CARD_MAX_AGE_MS: number = X\.CARD_MAX_AGE_MS;/);
});

test("the page: producers from the card in force (this race or the one before), a late note after 2 hours, none after 3", () => {
  const js = fs.readFileSync(path.join(APP, "blockx.js"), "utf8");
  const i = js.indexOf("async function loadCard()"), body = js.slice(i, js.indexOf("function producers()", i));
  assert.ok(i > 0);
  assert.match(body, /const races = \[M\.raceAt\(now\), M\.raceAt\(now - M\.RACE\)\]/, "this race and the one before, as raceCardAt");
  assert.match(body, /const c = X\.cardInForce\(all, now, X\.MIN_CARD_SAMPLES\);/, "the recorder's rule, with BX-38's minimum");
  assert.doesNotMatch(body, /cardForLeg/, "no longer this leg's card only");
  assert.match(body, /else if \(!failed\) \{ card = null; cardAt = 0; \}/, "no card in force: no chips (BX-24)");
  assert.match(body, /if \(!TESTNET && card && !\(card\.at <= now && now - card\.at <= X\.CARD_MAX_AGE_MS\)\) \{ card = null; cardAt = 0; \}/, "a kept card stops at 3 hours");
  assert.match(js, /if \(card && !TESTNET && Date\.now\(\) - card\.at > X\.CARD_LATE_MS\) whoLine\.append\(/, "the late note");
  assert.match(js, /the next card is late/);
  assert.match(js, /if \(!card && !TESTNET\) return \[\];/, "BX-24 kept: no card, no chips");
});

// ── the recorder's alert ──
const BIG = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", MID = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const W3 = M.weekStart(3), H0 = 48_000_000;
const T = (h) => W3 + HOUR + (h - H0) * 3000;
const CARD = { c: 1, blocksPerRace: 7200, fairness: null, field: [{ a: BIG, vhp: 2000, k: 600, h: 1 }, { a: MID, vhp: 1000, k: 300, h: 2 }], paddock: [] };
/** Race files for weeks 2 to 4 with an hourly card at :37, none taken after `until`. */
function raceDir(until = Infinity) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-late-"));
  for (const w of [2, 3, 4]) {
    const races = [];
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) {
      races.push({ id: M.raceId(M.raceIndex(t)), start: t, end: t + M.RACE, result: null,
        cards: Array.from({ length: 6 }, (_, l) => { const at = t + l * HOUR + 37 * 60000; return at <= until ? { ...CARD, samples: 36, at } : null; }) });
    }
    fs.writeFileSync(path.join(d, `W${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
const quiet = async (f) => { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "blockx-late-"));
const runAt = (lib, rd, extra = {}) => quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: rd, picksContract: "1P",
  blockOf: async (_n, h) => ({ signer: BIG, time: T(h) }), picksOf: async () => [], rankedOf: async () => new Set(),
  head: { height: lib, time: T(lib), lib }, ...extra }));
const late = (r) => r.held.filter((h) => /race card/.test(h));

test("recorder: no alert while the newest race card is fresh", async () => {
  const lib = H0 + 30 * 1200 + 50;
  const r = await runAt(lib, raceDir());
  assert.deepEqual(late(r), []);
});

test("recorder: the newest race card more than 2 hours old alerts (held list = an error and an email), nothing else changes", async () => {
  const lib = H0 + 30 * 1200 + 50, now = T(lib);
  const c0 = Math.floor((now - 37 * 60000) / HOUR) * HOUR + 37 * 60000;   // the newest :37 card time at or before now
  assert.ok(now > c0);
  const fresh = await runAt(lib, raceDir());
  const r = await runAt(lib, raceDir(c0 - 2 * HOUR));   // the newest card is 2 to 3 hours old
  const a = late(r);
  assert.equal(a.length, 1);
  assert.match(a[0], /the newest race card is \d+ minutes old \(late after 120\)/);
  assert.ok(r.problems.includes(a[0]), "printed as an ::error:: line");
  // The alert itself records nothing differently: every target recorded in both runs is the same.
  const key = (x) => JSON.stringify([...x.weeks.values()].map((w) => w.targets.filter((t) => t.lockTime < c0 - 2 * HOUR)));
  assert.equal(key(r), key(fresh));
  // Between 1 and 2 hours old: not late yet.
  assert.deepEqual(late(await runAt(lib, raceDir(c0 - HOUR))), []);
});

test("recorder: no usable card in 3 hours alerts that the page offers no producers", async () => {
  const lib = H0 + 30 * 1200 + 50, now = T(lib);
  const r = await runAt(lib, raceDir(now - 3.5 * HOUR));
  const a = late(r);
  assert.equal(a.length, 1);
  assert.match(a[0], /no usable race card in the last 3 hours: the Block X page offers no producers/);
});

test("recorder: thin cards (fewer than 12 samples) don't count as fresh", async () => {
  const lib = H0 + 30 * 1200 + 50, now = T(lib);
  const d = raceDir(now - 2.5 * HOUR);
  for (const f of fs.readdirSync(d)) {   // add a thin card 10 minutes ago
    const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
    const race = j.races.find((x) => x.start <= now - 10 * 60000 && now - 10 * 60000 < x.end);
    if (race) { race.cards[M.legOf(race.start, now - 10 * 60000)] = { ...CARD, samples: 9, at: now - 10 * 60000 }; fs.writeFileSync(path.join(d, f), JSON.stringify(j)); }
  }
  assert.equal(late(await runAt(lib, d)).length, 1);
});

test("recorder: no alert on the testnet (self-made cards) or when the race files are missing (already an error)", async () => {
  const lib = H0 + 30 * 1200 + 50;
  const self = await runAt(lib, raceDir(0), { cards: "self" }).catch(() => ({ held: [] }));
  assert.deepEqual(late(self), []);
  const none = await runAt(lib, fs.mkdtempSync(path.join(os.tmpdir(), "race-none-")));
  assert.deepEqual(late(none), []);
});
