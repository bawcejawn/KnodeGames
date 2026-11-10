// Game Standard (D-157): every games/<slug>/game.json follows the schema, ids and slugs are unique, the template
// stays complete, and the tools work end to end in a temporary copy (nothing in the repo is changed).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, validateManifest, listManifests, readManifest, crossCheck, SPONSOR_TX_CAP } from "../../tools/game-manifest.mjs";
import { newGame } from "../../tools/new-game.mjs";
import { checkGame, REQUIRED_FILES } from "../../tools/game-check.mjs";

const good = () => ({
  schema: 1, slug: "testgame", name: "Test Game", vaultGameId: 42, kinds: ["staked", "free"], seasonWeeks: 1,
  freePrizeDefault: "on", status: "building", picks: { contract: "picks", gameId: 42 },
  sponsor: { actions: [{ name: "pick", manaLimit: 1.3 }] },
  week: { standard: "WEEK_CYCLE", sundayFunRound: true, finalNotBefore: "Mon 00:00 UTC" },
  data: { board: "games-data:testgame/board.json", vaultFolder: "games-data:testgame/vault" },
  workflow: { file: "games.yml", enabledVar: "TESTGAME_ENABLED", prizesFromVar: "TESTGAME_PRIZES_FROM_WEEK" },
  page: "testgame.html", rulesDoc: ".ai/games/TestGame.md", ownerChat: "Test",
});

test("every games/<slug>/game.json in the repo follows the schema and is unique", () => {
  const entries = listManifests().map((file) => ({ file, m: readManifest(file) }));
  for (const { file, m } of entries) assert.deepEqual(validateManifest(m), [], file);
  assert.deepEqual(crossCheck(entries), []);
});

test("a complete manifest passes; each broken rule is caught", () => {
  assert.deepEqual(validateManifest(good()), []);
  const bad = (edit, re) => { const m = good(); edit(m); assert.ok(validateManifest(m).some((p) => re.test(p)), re); };
  bad((m) => (m.slug = "Bad Slug"), /slug/);
  bad((m) => (m.vaultGameId = 2), /belongs to "blockx"/);
  bad((m) => (m.kinds = ["staked"]), /Free play/);
  bad((m) => (m.sponsor.actions[0].manaLimit = SPONSOR_TX_CAP + 0.1), /at most 2\.4/);
  bad((m) => (m.week.finalNotBefore = "Mon 12:00 UTC"), /Mon 00:00/);
  bad((m) => (m.week.standard = "own"), /WEEK_CYCLE/);
  bad((m) => (m.status = "done"), /status/);
  bad((m) => (m.picks = { contract: "picks" }), /picks\.gameId/);
  bad((m) => (m.name = "{{name}}"), /placeholders/);
});

test("every kit game (a GameModule recorder), and the kit's fixture, validates in KIT mode (Repo Lens #B-11 KC-25)", async () => {
  const roots = [ROOT, path.join(ROOT, "kit/testing/example")];
  let n = 0;
  for (const root of roots) for (const f of listManifests(root)) {
    const rec = path.join(path.dirname(f), "recorder.ts");
    if (!fs.existsSync(rec) || !/GameModule/.test(fs.readFileSync(rec, "utf8"))) continue;
    assert.deepEqual(validateManifest(readManifest(f), { kit: true }), [], f);
    n++;
  }
  assert.ok(n >= 1, "the fixture at least");
});

test("the kit's fields (GAME_KIT.md §4): optional for a game still on its old recorder, required and checked for a kit game", () => {
  const kit = () => ({ ...good(), payoutRule: "legacy-tied-whole", vaultValues: "dense255", minPts: 0, rowCap: 0, entry: { minRounds: 1, minPoints: 1 } });
  assert.deepEqual(validateManifest(good()), [], "no kit fields: still valid (not on the kit yet)");
  assert.ok(validateManifest(good(), { kit: true }).some((p) => /payoutRule/.test(p)), "a kit game must have them");
  assert.deepEqual(validateManifest(kit(), { kit: true }), []);
  const bad = (edit, re) => { const m = kit(); edit(m); assert.ok(validateManifest(m).some((p) => re.test(p)), re); };
  bad((m) => (m.payoutRule = "top-30"), /payoutRule/);
  bad((m) => (m.vaultValues = "raw"), /vaultValues/);
  bad((m) => ((m.payoutRule = "d152"), (m.vaultValues = "points")), /d152 needs vaultValues/);
  bad((m) => (m.minPts = -1), /minPts/);
  bad((m) => (m.rowCap = 1.5), /rowCap/);
  bad((m) => (m.entry = { minRounds: 0, minPoints: 1 }), /entry/);
  bad((m) => (m.budgets = { reads: 0 }), /budgets/);
  bad((m) => (m.budgets = { other: 5 }), /budgets/);
  bad((m) => (m.roundsCorrectable = "yes"), /roundsCorrectable/);
});

test("the template is complete: every required file, and its manifest has only placeholders to fill", () => {
  const dir = path.join(ROOT, "templates", "game");
  for (const f of REQUIRED_FILES) assert.ok(fs.existsSync(path.join(dir, f)), f);
  const raw = fs.readFileSync(path.join(dir, "game.json"), "utf8");
  assert.match(raw, /\{\{slug\}\}/);
  for (const key of ["schema", "slug", "vaultGameId", "kinds", "sponsor", "week", "data", "workflow", "page", "rulesDoc", "ownerChat"])
    assert.ok(raw.includes(`"${key}"`), key);
});

test("game:new copies the template and game:check reports what is left, in a temporary copy", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kg-game-"));
  fs.cpSync(path.join(ROOT, "templates"), path.join(tmp, "templates"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".ai/standards"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".ai/standards/WEEK_CYCLE.md"), "| Test Game (42) | ... |\n");
  const dest = newGame("testgame", 42, "Test Game", tmp);
  assert.ok(fs.existsSync(path.join(dest, "game.json")));
  assert.throws(() => newGame("testgame", 42, "Test Game", tmp), /already exists/);
  assert.throws(() => newGame("other", 7, "Other", tmp), /belongs to "race"/);
  // Unfilled: the check fails on placeholders (the template's raw values aren't valid JSON numbers either).
  assert.ok(checkGame("testgame", tmp).some((r) => !r.pass && r.required));
  // Filled: everything required passes.
  fs.writeFileSync(path.join(dest, "game.json"), JSON.stringify(good(), null, 2));
  fs.mkdirSync(path.join(tmp, ".ai/games"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".ai/games/TestGame.md"), "# Test Game\n");
  const res = checkGame("testgame", tmp);
  assert.deepEqual(res.filter((r) => !r.pass && r.required).map((r) => r.msg), []);
  fs.rmSync(tmp, { recursive: true, force: true });
});
