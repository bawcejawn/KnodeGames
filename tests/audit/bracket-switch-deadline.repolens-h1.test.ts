// Repo Lens #H-1 (PR #330 @ 55e03cab), H1-3 (Low). Place in tests/audit/. Test 2 fails at 55e03cab.
// From 55e03cab the Bracket's pages say the Free play board wins 2 and 1 VHP from Week 2 (vault week 5). That is paid only
// if the owner's `npm run prizes -- on 9 --send --from 5` lands inside one window: after Mon 16 Nov 00:30 UTC (Sun 15 Nov
// 7:30 PM ET) and before Sun 22 Nov 23:30 UTC (6:30 PM ET). A change counts only if it is made before its week starts,
// and nothing is published from Sun 23:30 to Mon 00:30 UTC. Sent later, it starts week 6, `--from 5` refuses it, and
// week 5 pays no free prize while every page promises one. The launch step gives only the start of that window.
// Run from the repository root: TZ=UTC node --import tsx --test tests/audit/bracket-switch-deadline.repolens-h1.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
const APP = path.resolve(process.env.APP || ".");
const FP = await import(path.join(APP, "bot/free-prizes.ts"));
const { LAUNCH } = await import(path.join(APP, "admin/switches.ts"));
const live = { v: 1, games: { "9": [{ from: 4, on: false, set: "2026-11-11T12:00:00.000Z" }] } };   // the live switch today

test("H1-3: the switch for game 9 only reaches week 5 if sent before Sun 22 Nov 23:30 UTC", () => {
  const inTime = FP.setSwitch(live, 9, true, Date.UTC(2026, 10, 22, 23, 0));   // Sun 22 Nov 6:00 PM ET
  assert.equal(inTime.from, 5);
  assert.equal(FP.prizeOn(inTime.next, 9, 5), true, "sent in time: week 5 pays the free prize");
  const late = FP.setSwitch(live, 9, true, Date.UTC(2026, 10, 23, 1, 0));      // Sun 22 Nov 8:00 PM ET
  assert.equal(late.from, 6, "sent late it starts week 6, and `--from 5` refuses it");
  assert.equal(FP.prizeOn(late.next, 9, 5), false, "week 5 then pays no free prize, though the pages promise one");
});

test("H1-3 (Low): the launch step for game 9 says by when the switch must be sent", () => {
  const text = LAUNCH.find((l: any) => l.game === 9)!.steps.map((x: any) => x.text).join(" ");
  assert.match(text, /prizes -- on 9 --send --from 5/);
  assert.match(text, /before Sun 22 Nov 6:30 PM ET/, "the last moment the switch still reaches Week 2: " + text);
});
