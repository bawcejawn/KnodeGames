// D-175 readiness: Fantasy carries the kit's ruler mode / version (ctx.ruler, Architecture's next kit PR) into its card
// settings, and checks the card came back under the version asked for. Unset (today): byte for byte as before.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RV = await import(path.join(REPO, "games/fantasy/ruler-view.ts"));
const DAY = 86400000, D = Date.UTC(2026, 10, 24);
const blockAt = async (ms: number) => 1_000_000 + Math.floor(ms / 3000);
const seen: any[] = [];
const vhp = (ver = 4) => ({ ruleVersion: 4, to: 9e9, loaded: true, card: (s: any) => { seen.push(s); return { ruleVersion: s.version ?? ver, game: 4, round: s.round, producers: [] }; } });
const ctx = (ruler?: unknown, v = vhp()) => ({ vhp: v, blockAt, ...(ruler === undefined ? {} : { ruler }) });

test("no ctx.ruler: settings have no mode or version key, and a version 4 card is accepted (as today)", async () => {
  seen.length = 0;
  const src = RV.sourcesOf(ctx());
  assert.deepEqual(src.ruler, {});
  await RV.dayCard(D, src);
  assert.ok(!("mode" in seen[0]) && !("version" in seen[0]));
  assert.deepEqual(await RV.daySettings(D, blockAt), await RV.daySettings(D, blockAt, RV.CARD, [], {}));
});

test("ctx.ruler {} or null is the same as unset", async () => {
  for (const r of [{}, null]) assert.deepEqual(RV.sourcesOf(ctx(r)).ruler, {});
});

test("mode B and version 5 are carried into the card settings; the version 5 card is accepted", async () => {
  seen.length = 0;
  const src = RV.sourcesOf(ctx({ mode: "B", version: 5 }));
  const c = await RV.dayCard(D, src);
  assert.equal(c.ruleVersion, 5);
  assert.equal(seen[0].mode, "B"); assert.equal(seen[0].version, 5);
});

test("a card under another version than asked is refused (both ways)", async () => {
  await assert.rejects(RV.dayCard(D, RV.sourcesOf(ctx(undefined, { ...vhp(), card: (s: any) => ({ ruleVersion: 5, game: 4, round: s.round, producers: [] }) }))), /ruler version 5, not 4/);
  await assert.rejects(RV.dayCard(D, RV.sourcesOf(ctx({ version: 5 }, { ...vhp(), card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: [] }) }))), /ruler version 4, not 5/);
});

test("defaults or unknown values in ctx.ruler stop the run (mode A and version 4 are 'no key', rule 4)", () => {
  for (const r of [{ mode: "A" }, { mode: "Z" }, { version: 4 }, { version: "5" }, { other: 1 }, [], "B"]) assert.throws(() => RV.sourcesOf(ctx(r)), /ctx\.ruler/, JSON.stringify(r));
});

test("the price list's form-day cards follow the same ruler settings", async () => {
  seen.length = 0;
  await RV.dayCard(D - 3 * DAY, RV.sourcesOf(ctx({ mode: "C" })));
  assert.equal(seen[0].mode, "C");
  assert.ok(!("version" in seen[0]));
});
