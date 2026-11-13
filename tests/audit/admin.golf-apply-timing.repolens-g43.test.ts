// Repo Lens #G-43 G43-1: the Hub's Block Golf launch text still tells the owner to apply game 6 "before Sunday 4 PM PT"
// and gives the old example (apply Sat 7 Nov -> week 3, "Sunday 4:57 PM PST"). For the owner's plan (Golf earns from
// vault week 5, Week 1 practice-only) the apply must land AFTER Mon 16 Nov 00:00 UTC (Sun 15 Nov 7 PM ET).
// Run from the repo root: TZ=UTC node --import tsx --test /home/claude/g1/tests-g43/g43-hub-golf-apply-timing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
const { ACTIONS, AREAS } = await import(path.resolve("admin/actions.ts"));
const A = (id: string) => ACTIONS.find((a: any) => a.id === id)!;

test("G43-1: the Hub's game-apply 6 step does not steer the apply into vault week 3", () => {
  const when = String(A("golf-game-apply").when || "");
  assert.doesNotMatch(when, /before Sunday 4 PM PT/, `golf-game-apply.when says: ${when}`);
});

test("G43-1: the Hub's GOLF_STAKED_FROM_WEEK step has no stale 'Sat 7 Nov -> 3' example and names ET", () => {
  const step = AREAS.find((x: any) => x.id === "golf")!.guides![0].steps[1];
  assert.doesNotMatch(step, /Sat 7 Nov it is 3/, step);
  assert.match(step, /ET/, "the owner works in ET: give the ET time (7:57 PM ET in winter)");
});
