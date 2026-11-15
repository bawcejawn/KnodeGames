// Repo Lens #G-52 fixes and the owner's 13 Nov rules, tested on the module directly (fake ruler and blockAt):
// G52-3 all form cards flagged → NotYet; G52-4 the Rival cap keeps the matches with the most points and counts the
// rest; the week's list goes in as the card's `include`; the 48-hour no-card fallback (only with the kit's hook).
import test from "node:test";
import assert from "node:assert/strict";
import { game } from "../recorder.ts";
import * as F from "../math.js";
import { daySettings } from "../ruler-view.ts";
import { NotYet } from "../../../kit/recorder/types.ts";

const DAY = 86400000, START = 1792368000000 + 4 * 7 * DAY;   // vault week 4
const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"];
const blockAt = async (ms: number) => Math.floor(ms / 3000);
const row = (a: string, quality = "ok") => ({ a, credited: "100000000", expected: "100000000", void: false, entry: true, quality });
const vhpOf = (quality: string, seen: any[] = []) => ({ ruleVersion: 4, card: (s: any) => { seen.push(s); return { ruleVersion: 4, game: 4, round: s.round, quality, producers: P.map((a) => row(a, quality)) }; } });
const week = { week: 4, start: START, end: START + 7 * DAY };

test("G52-3: all 7 form cards flagged → NotYet (the kit waits and retries), never a plain error", async () => {
  await assert.rejects(game.inputsFor!(week, { now: START - DAY, vhp: vhpOf("flagged"), blockAt } as any), (e: unknown) => e instanceof NotYet);
  const ok = await game.inputsFor!(week, { now: START - DAY, vhp: vhpOf("ok"), blockAt } as any);
  assert.equal((ok as any).pool.length, 5);
});

test("G52-4: above 2,500 matches the ones with the most points are kept, sorted by address, and the rest counted", () => {
  const all: [string, string][] = [], pts = new Map<string, number>();
  for (let i = 0; i < F.MAX_RIVAL + 3; i++) {
    const a = `1A${String(i).padStart(32, "0")}`, b = `1B${String(i).padStart(32, "0")}`;
    all.push([a, b]); pts.set(a, i); pts.set(b, i);
  }
  const { rival, dropped } = F.capMatches(all, pts);
  assert.equal(dropped, 3);
  assert.equal(rival.length, F.MAX_RIVAL);
  assert.ok(!rival.some((m: string[]) => m[0] === all[0][0] || m[0] === all[1][0] || m[0] === all[2][0]), "the 3 lowest-point matches are the ones left out");
  assert.deepEqual(rival, [...rival].sort((x: string[], y: string[]) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));
  assert.deepEqual(F.capMatches(all.slice(0, 10), pts), { rival: all.slice(0, 10), dropped: 0 });
});

test("include: the week's listed producers go into the card's settings, sorted and distinct; none → no include", async () => {
  const s = await daySettings(START, blockAt, undefined, [P[2], P[0], P[2]]);
  assert.deepEqual((s as any).include, [P[0], P[2]]);
  assert.equal("include" in (await daySettings(START, blockAt)), false);
  const seen: any[] = [];
  const inputs = await game.inputsFor!(week, { now: START - DAY, vhp: vhpOf("ok"), blockAt } as any);
  await game.resultOf({ id: "d", day: START, locksAt: START + 1, resolvesAt: START + DAY } as any, null as any, inputs, { now: START + 2 * DAY, vhp: vhpOf("ok", seen), blockAt } as any);
  assert.deepEqual(seen.at(-1).include, [...P].sort());
});

test("no ruler card: pending within 48 hours and without the kit's hook; 0 for every team after, with the hook", async () => {
  const inputs = await game.inputsFor!(week, { now: START - DAY, vhp: vhpOf("ok"), blockAt } as any);
  const round = { id: "d", day: START, locksAt: START + 1, resolvesAt: START + DAY } as any;
  const none = { ruleVersion: 4, card: () => { throw new NotYet("not yet: no data"); } };
  const libAt = (t: number) => async (ms: number) => { if (ms > t) throw new NotYet("not yet: block"); return Math.floor(ms / 3000); };
  // no hook: waits, whatever the time
  await assert.rejects(game.resultOf(round, null as any, inputs, { vhp: none, blockAt: libAt(START + 10 * DAY) } as any), (e: unknown) => e instanceof NotYet);
  const why: string[] = [];
  const fallback = async (w: string) => { why.push(w); };
  // hook, but only 47 hours after the day: waits
  await assert.rejects(game.resultOf(round, null as any, inputs, { vhp: none, blockAt: libAt(START + DAY + 47 * 3600000), fallback } as any), (e: unknown) => e instanceof NotYet);
  assert.equal(why.length, 0);
  // hook, 48 hours after: 0 for every listed producer, recorded
  const r: any = await game.resultOf(round, null as any, inputs, { vhp: none, blockAt: libAt(START + 3 * DAY), fallback } as any);
  assert.equal(r.fallback, true);
  assert.deepEqual(Object.values(r.rows), P.map(() => ["0", "0", false]));
  assert.equal(why.length, 1);
  // a plain error is never turned into a fallback
  const broken = { ruleVersion: 4, card: () => { throw new Error("bad card"); } };
  await assert.rejects(game.resultOf(round, null as any, inputs, { vhp: broken, blockAt: libAt(START + 3 * DAY), fallback } as any), /bad card/);
});
