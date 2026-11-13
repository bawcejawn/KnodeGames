// Repo Lens #G-38 (vault-finish @ 38e0300 on main 519905f). Copy to tests/audit/ and run:
//   TZ=UTC node --import tsx --test tests/audit/g38-vault-apply-guard.test.ts
// A2 checks pass at the reviewed head; G38-1 / G38-2 / G38-3 fail at the reviewed head (by design).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyCheck } from "../../bot/bot.ts";

const G = Date.UTC(2026, 9, 19), W = 7 * 86_400_000;
const at = (iso: string) => Date.parse(iso);
const src = fs.readFileSync(new URL("../../bot/bot.ts", import.meta.url), "utf8");

// A2: games 6 and 9 (notice ends Sat 14 Nov 3:16/3:17 PM ET, expires Sat 21 Nov 3:16/3:17 PM ET = 20:16/20:17 UTC).
test("A2: games 6/9 are refused all through their test-week window, allowed all through vault week 4 until expiry", () => {
  for (let t = at("2026-11-14T20:16:00Z"); t < at("2026-11-16T00:00:00Z"); t += 60_000)
    assert.ok(applyCheck(t, G, W, [3]).refuse, `should refuse at ${new Date(t).toISOString()}`);
  for (let t = at("2026-11-16T00:00:00Z"); t < at("2026-11-21T20:17:00Z"); t += 60_000) {
    const r = applyCheck(t, G, W, [3]);
    assert.equal(r.refuse, undefined, `should allow at ${new Date(t).toISOString()}`);
    assert.equal(r.earnsFrom, 5);
  }
});

test("A1: applyCheck's week equals the contract's weekOf (t <= genesis ? 0 : (t - genesis) / weekLen)", () => {
  const weekOf = (t: number) => (t <= G ? 0 : Math.floor((t - G) / W));
  for (let t = G; t < G + 10 * W; t += 3_600_000 + 7) assert.equal(applyCheck(t, G, W, []).earnsFrom, weekOf(t) + 1);
});

// G38-1 (Low): the guard trusts the RPC node's head time. A node stuck behind real time near a week change passes the
// 15-minute check while the real block lands in the next week. Fix: compare num(s.time) with Date.now() and refuse
// when they differ by more than a few minutes.
test("G38-1: game-apply refuses when the node's head time is far from this computer's clock", () => {
  const body = src.slice(src.indexOf('case "game-apply"'), src.indexOf('case "game-stop"'));
  assert.match(body, /Date\.now\(\)/, "game-apply should cross-check the chain time against the PC clock (stale node)");
});

// G38-2 (Low): `npm run bot -- admin apply_game game=6 --as owner --send` reaches act() with no guard.
// Fix: in act(), when method === "apply_game", refuse unless called from game-apply (or run applyCheck there).
test("G38-2: the raw admin path can't send apply_game around the guard", () => {
  const adm = src.slice(src.indexOf('if (cmd === "admin")'), src.indexOf('if (cmd === "upgrade")'));
  assert.match(adm, /apply_game/, "admin should refuse apply_game (use game-apply) or run applyCheck");
});

// G38-3 (Info): bot/README.md's command list doesn't show --allow-test-week or the guard.
test("G38-3: bot/README.md documents the game-apply guard flag", () => {
  const readme = fs.readFileSync(new URL("../../bot/README.md", import.meta.url), "utf8");
  assert.match(readme, /game-apply[^\n]*--allow-test-week/);
});
