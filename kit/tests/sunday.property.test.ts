// Sunday fun rounds (D-129) as a property: over random weeks, a round on Sunday UTC changes nothing in the week —
// not the board's points or places, the paid set, the vault file or the free winners — while its rows are recorded.
// And the day rule: a round closing at exactly Sun 00:00 is Saturday's (counted); one closing later is Sunday's.
import test from "node:test";
import assert from "node:assert/strict";
import { tally, weekHash, dayOf, isSunday, canon, weekShape } from "../publish/check.inline.mjs";
import { rng } from "../testing/fake-nodes.ts";
import { makeWeek } from "../testing/weekfile.ts";
import { at, DAY, HOUR } from "../testing/fake-clock.ts";

const cfg = { game: 1, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "legacy-tied-whole", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 } };
const B58 = "ABCDEFGHJKLMNPQRSTUVWXYZabc";
const ADDRS = Array.from({ length: 30 }, (_, i) => "1" + B58[i % 24].repeat(32) + B58[24 + Math.floor(i / 24)]);

/** A random week (address form). With Sunday: three fun rounds, some players who play ONLY on Sunday. */
function randomWeek(r: () => number, withSunday: boolean, base?: any) {
  const players: any[] = base ? structuredClone(base.players) : ADDRS.slice(0, 24).filter(() => r() < 0.6).map((a) => [a, r() < 0.5 ? "200000000" : "0", r() < 0.5 ? "200000000" : "0", r() < 0.05 ? 1 : 0]);
  const rounds: any[] = base ? structuredClone(base.rounds) : [];
  if (!base) for (let d = 0; d < 6; d++) for (let k = 0; k < 2; k++) {
    const rows = players.filter(() => r() < 0.7).map(([a]: any) => [a, Math.floor(r() * 4), 1 + Math.floor(r() * 1000)]);
    rounds.push([`r${d}${k}`, at(4, d), 0, "s", rows]);
  }
  if (withSunday) {
    for (const a of ADDRS.slice(24)) if (r() < 0.7) players.push([a, "500000000", "500000000", 0]);   // Sunday-only wallets
    for (let k = 0; k < 3; k++) {
      const rows = players.filter(() => r() < 0.8).map(([a]: any) => [a, Math.floor(r() * 50), 1 + Math.floor(r() * 1000)]);
      rounds.push([`s${k}`, at(4, 6), 1, r() < 0.8 ? "s" : "p", rows]);
    }
  }
  return { game: 1, week: 4, start: at(4), end: at(5), state: "pending", seenAt: at(5), rounds, players };
}

test("Sunday property: fun rounds never change a week's points, places, paid set, vault file, winners or hash (2,000 weeks)", () => {
  const r = rng(129);
  let sundayOnly = 0, sundayPoints = 0;
  for (let i = 0; i < 2000; i++) {
    const plainA = randomWeek(r, false), withA = randomWeek(r, true, plainA);
    const plain = makeWeek(plainA as any), withSun = makeWeek(withA as any);
    assert.equal(weekShape(withSun, "W004.json", cfg), "", `week ${i}: the file is valid`);
    assert.equal(weekHash(withSun), weekHash(plain), `week ${i}: fun rounds are out of the hash (KC-5)`);
    const a = tally(plain, cfg), b = tally(withSun, cfg);
    const strip = (t: any) => canon({ rows: t.rows.map((x: any) => [x.a, x.pts, x.counted, x.place, x.board, x.staked, x.free]), vault: t.vault, paid: [...t.paid].sort(), complete: t.complete });
    // Wallets who played only on Sunday appear (answers) but with 0 points and 0 counted: nothing for the week.
    const onlySunday = new Set(b.rows.filter((x: any) => !a.rows.some((y: any) => y.a === x.a)).map((x: any) => x.a));
    for (const x of b.rows.filter((x: any) => onlySunday.has(x.a))) { assert.equal(x.pts, 0); assert.equal(x.counted, 0); assert.ok(!x.staked && !x.free); }
    const bk = { ...b, rows: b.rows.filter((x: any) => !onlySunday.has(x.a)) };
    assert.equal(strip(bk), strip(a), `week ${i}`);
    if (onlySunday.size) sundayOnly++;
    if (withSun.rounds.some((rd: any) => rd[2] === 1 && rd[3] === "s" && rd[4].some((x: any) => x[1] > 0))) sundayPoints++;
  }
  // The property was really exercised (KC-24: this used to be an assertion that could never fail).
  assert.ok(sundayOnly > 1000 && sundayPoints > 1500, `Sunday-only wallets in ${sundayOnly} weeks, Sunday points in ${sundayPoints}`);
});

test("Sunday: a pending fun round never keeps the week from being complete", () => {
  const r = rng(7);
  const w = randomWeek(r, false);
  w.rounds.push(["s9", at(4, 6), 1, "p", []]);
  assert.equal(tally(makeWeek(w as any), cfg).complete, true);
});

test("the day rule: closing at exactly Sun 00:00 is Saturday's; closing after it is Sunday's", () => {
  assert.equal(dayOf(at(4, 6)), at(4, 5));
  assert.equal(isSunday(dayOf(at(4, 6))), false);
  assert.equal(isSunday(dayOf(at(4, 6) + 1)), true);
  assert.equal(isSunday(dayOf(at(4, 6, 12))), true);
  assert.equal(isSunday(dayOf(at(5))), true, "Mon 00:00 closes Sunday");
  for (let d = 0; d < 6; d++) assert.equal(isSunday(at(4, d)), false, `day ${d}`);
  assert.equal(isSunday(at(4, 6)), true);
  assert.equal(dayOf(at(4, 2, 0) + HOUR), at(4, 2));
});
