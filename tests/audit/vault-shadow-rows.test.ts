// The vault's own check against VHP-ruler shadow results (Vault chat, 11 Nov 2026). A shadow week's ruler result is
// published beside the real one and must never pay. Each game's publish job refuses it; the vault bot refuses it too,
// for the hourly pass and for game-post by hand (both use checkResults). Files without the mark keep working.
// Run: node --import tsx --test tests/audit/vault-shadow-rows.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkResults } from "../../bot/vault.ts";

const P = "1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv", Q = "1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717";
const file = (extra: any = {}, row: any = {}) => ({ game: 2, week: 5, final: true, rows: [{ player: P, points: 3, ...row }], first: [Q], second: [], ...extra });

test("files published before the ruler (no shadow mark) pass as before", () => {
  assert.equal(checkResults(file(), 2, 5), "");
  assert.equal(checkResults({ game: 2, week: 5, final: true }, 2, 5), "");
});

test("a shadow week's real result passes: rulerFrom / rulerMode are not read, shadow: false is allowed", () => {
  assert.equal(checkResults(file({ rulerFrom: 6, rulerMode: "shadow" }), 2, 5), "");
  assert.equal(checkResults(file({ rulerFrom: 6, rulerMode: "on", shadow: false }, { shadow: false }), 2, 5), "");
});

test("a file marked shadow is refused, whatever the mark's form (fail closed)", () => {
  for (const v of [true, "true", 1, "yes", {}, null]) assert.match(checkResults(file({ shadow: v }), 2, 5), /marked "shadow"/, JSON.stringify(v));
});

test("a single row marked shadow refuses the whole file", () => {
  const r = file();
  r.rows.push({ player: Q.replace("1635", "1636"), points: 2, shadow: true } as any);
  r.first = [];
  assert.match(checkResults(r, 2, 5), /a row is marked "shadow"/);
  for (const v of [true, "true", 1, null]) assert.match(checkResults(file({ first: [] }, { shadow: v }), 2, 5), /a row is marked "shadow"/);
});
