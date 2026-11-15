// game-apply guard (Vault chat, owner 12 Nov 2026). Games 6 and 9 were added a day early, so their applies opened inside
// the test week (vault week 3): an apply then earns from vault week 4 (Week 1), which they must not. The bot now says what
// an apply would do and refuses it inside a test week (unless --allow-test-week) or within 15 minutes of a week change.
// Run: node --import tsx --test tests/audit/vault-game-apply-guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyCheck, etTime, APPLY_EDGE_MS } from "../../bot/bot.ts";

const G = Date.UTC(2026, 9, 19), W = 7 * 86_400_000;   // mainnet genesis Mon 19 Oct 2026 00:00 UTC, 7-day weeks
const at = (iso: string) => Date.parse(iso);

test("etTime prints New York time with the weekday", () => {
  assert.equal(etTime(at("2026-11-16T00:00:00Z")), "Sun 15 Nov 7:00 PM ET");
  assert.equal(etTime(at("2026-11-21T20:16:00Z")), "Sat 21 Nov 3:16 PM ET");
});

test("an apply in the test week is refused, and says what it would do", () => {
  const r = applyCheck(at("2026-11-14T20:30:00Z"), G, W, [3]);   // Sat 14 Nov 3:30 PM ET, vault week 3
  assert.equal(r.week, 3); assert.equal(r.earnsFrom, 4);
  assert.match(r.text, /vault week 3 \(test week\).*a new game earns from vault week 4, which starts Sun 15 Nov 7:00 PM ET.*restarted/);
  assert.match(r.refuse ?? "", /test week.*applies from Sun 15 Nov 7:00 PM ET \(when vault week 4 begins\).*--allow-test-week/);
});

test("--allow-test-week lets it through (a game that should earn from the first paid week)", () => {
  assert.equal(applyCheck(at("2026-11-14T20:30:00Z"), G, W, [3], true).refuse, undefined);
});

test("in Week 1 (vault week 4) an apply goes through and earns from vault week 5", () => {
  const r = applyCheck(at("2026-11-16T15:00:00Z"), G, W, [3]);   // Mon 16 Nov 10 AM ET
  assert.equal(r.refuse, undefined); assert.equal(r.earnsFrom, 5);
  assert.match(r.text, /vault week 5, which starts Sun 22 Nov 7:00 PM ET/);
});

test("within 15 minutes before a week change it is refused, whatever the week", () => {
  const edge = at("2026-11-23T00:00:00Z");
  assert.match(applyCheck(edge - 60_000, G, W, [3]).refuse ?? "", /Too close to the week change at Sun 22 Nov 7:00 PM ET.*Wait until after Sun 22 Nov 7:00 PM ET/);
  assert.equal(applyCheck(edge - APPLY_EDGE_MS - 1, G, W, [3]).refuse, undefined);
  // the minutes right after a change are in the new week: Sun 15 Nov 7:01 PM ET is vault week 4, fine
  assert.equal(applyCheck(at("2026-11-16T00:01:00Z"), G, W, [3]).refuse, undefined);
});

test("a state it can't read stops the command", () => {
  assert.throws(() => applyCheck(at("2026-11-16T15:00:00Z"), G, 0, [3]), /can't read the vault's week/);
  assert.throws(() => applyCheck(G - 1, G, W, [3]), /can't read the vault's week/);
});

test("game-apply runs the guard before it sends (dry run included)", () => {
  const src = fs.readFileSync(new URL("../../bot/bot.ts", import.meta.url), "utf8");
  const i = src.indexOf('case "game-apply"'), j = src.indexOf('case "game-stop"');
  const body = src.slice(i, j);
  assert.ok(body.indexOf("applyCheck(") > 0 && body.indexOf("applyCheck(") < body.indexOf('act("owner", "apply_game"'));
  assert.match(body, /if \(chk\.refuse\) throw/);
  assert.match(body, /num\(s\.time\)/, "uses the chain's time, not the PC clock");
  // Repo Lens #G-38 G38-1: a node whose head time is far from this computer's clock is refused, before the send
  assert.ok(body.indexOf("Date.now()") > 0 && body.indexOf("Date.now()") < body.indexOf('act("owner", "apply_game"'));
});
