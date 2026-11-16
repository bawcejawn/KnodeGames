// Repo Lens #J-4 (Fantasy PR #344 delta, head 40aa5769), Mon 16 Nov 2026. Finding J4-1.
// Put in games/fantasy/tests/ and run from the repo root:
//   TZ=UTC node --import tsx --test --test-concurrency=1 games/fantasy/tests/page-fresh-start.repolens-j4.test.mjs
//
// The recorder starts the first real week with no teams: recorder.ts carryIn returns an empty map when
// week === FIRST_REAL_WEEK (5), so test week 4's Saturday team never plays into week 5's Monday (D-174).
// The page doesn't know: fantasy.js carriedInto(5, …) still returns week 4's Saturday team (or week 4's `next`) when it
// fits week 5's price list. The page then shows that team as "in force" for Mon 23 Nov and, if the player leaves it as
// it is, REFUSES to send it ("No change: last week's team fits the new prices and carries on", fantasy.js:218). The
// recorder gives that wallet no team, so it scores 0 on Monday; and because the page then believes the team "carries
// on" (fantasy.js:223), a player who changes nothing scores 0 for the whole first staked week.
//
// The test lifts carriedInto out of fantasy.js as written (no browser needed), runs it on a week-4 → week-5 case and a
// week-5 → week-6 control, and compares it with the recorder's own carryIn.
// Expected at 40aa5769: test 1 FAILS (the page carries a team the recorder drops); test 2 (control) passes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const F = await import(path.join(REPO, "games/fantasy/math.js"));
const { game, FIRST_REAL_WEEK } = await import(path.join(REPO, "games/fantasy/recorder.ts"));
const SRC = fs.readFileSync(path.join(REPO, "fantasy.js"), "utf8");

// carriedInto as the page has it (from "function carriedInto" to its closing brace at the same indent).
const m = SRC.match(/\n( *)function carriedInto\(([\s\S]*?)\n\1\}\n/);
assert.ok(m, "carriedInto not found in fantasy.js");
const body = m[0].trim();
/** The page's carriedInto, with its closure (files, listOf, F, and anything it may import for the fix) supplied. */
function pageCarried(files, extra = {}) {
  const listOf = (w) => files.lists.get(w) || null;
  const names = ["files", "listOf", "F", "FIRST_REAL_WEEK", ...Object.keys(extra)];
  const vals = [files, listOf, F, FIRST_REAL_WEEK, ...Object.values(extra)];
  return new Function(...names, `${body}\nreturn carriedInto;`)(...vals);
}

const P = ["1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"];
const ME = "1WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW1";
const team = [P[1], P[0], P[2], P[3], P[4]];
const list = (w) => ({ week: w, start: 0, budget: 100, pool: P.map((a) => ({ a, price: 20, form: 1 })) });

for (const [title, prevState] of [["week 4 still pending (the page uses your Saturday team)", "pending"], ["week 4 final (the page uses week 4's next)", "final"]]) {
  test(`J4-1: first real week (5) starts with no team on the page, as in the recorder; ${title}`, () => {
    assert.equal(FIRST_REAL_WEEK, 5);
    const files = { weeks: new Map([[4, { week: 4, state: prevState, next: [[ME, { t: team }]] }]]), lists: new Map([[5, list(5)]]) };
    const recorder = game.carryIn(new Map([[ME, { t: team }]]), { week: 5 }, list(5));
    assert.equal(recorder.size, 0, "the recorder carries nothing into week 5");
    const page = pageCarried(files)(5, ME, prevState === "pending" ? team : null);
    assert.equal(page, null, `the page shows week 4's team as carried into week 5: ${JSON.stringify(page)}`);
  });
}

test("control: from week 5 on, a final week's team still carries (page = recorder)", () => {
  const files = { weeks: new Map([[5, { week: 5, state: "final", next: [[ME, { t: team }]] }]]), lists: new Map([[6, list(6)]]) };
  const recorder = game.carryIn(new Map([[ME, { t: team }]]), { week: 6 }, list(6));
  assert.deepEqual(recorder.get(ME)?.t, team);
  assert.deepEqual(pageCarried(files)(6, ME, null), team);
});
