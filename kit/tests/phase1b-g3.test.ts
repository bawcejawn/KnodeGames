// Kit Phase 1b, G3 (the Ruler chat, 11–12 Nov): the publish job rebuilds every new ruler card with the WHOLE
// vhp_ruler.py embedded byte for byte, plus the kit's small glue (render.mjs KIT_CARDS_PY), from real vhp-data files.
// The cards the recorder made in JS must be exactly the ones the embedded Python rebuilds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeChain } from "../../tests/audit/vhp-ruler.fixture.mjs";
import { loadLedger, vhpFor, cardList, type CardSettings } from "../recorder/sources/vhp-ruler.ts";
import { KIT_CARDS_PY, RULER_HEREDOC, renderJobs, rulerPy } from "../publish/render.mjs";
import { exampleCfg } from "../testing/example/index.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PYTHON = (() => { try { execFileSync("python3", ["--version"]); return true; } catch { return false; } })();

// 354 block-hours (~14.75 days): enough for a paying card's 14 days + 6 h of history.
let fx: { dir: string; L: any; s: CardSettings } | null = null;
function fixture() {
  if (fx) return fx;
  const f = makeChain({ seed: 5, hours: 354, np: 4, busy: 0.002 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-vd-"));
  fs.mkdirSync(path.join(dir, "h"));
  for (const t of f.texts) fs.writeFileSync(path.join(dir, "h", `${JSON.parse(t).n}.json`), t);
  const L = loadLedger(dir), Lb = L.to - 20 - 1200 - 500;
  const s: CardSettings = { game: 4, round: "2026111600", window: { W0: Lb - 7199, W1: Lb, L: Lb, S0: Lb + 1, S1: Lb + 1200 }, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [] };
  return (fx = { dir, L, s });
}
function glue(dataDir: string, files: Record<string, unknown>, pub: Record<string, unknown> = {}) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "kit-g3-"));
  for (const d of ["code", "in/inputs", "pub/inputs"]) fs.mkdirSync(path.join(w, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "vhp_ruler.py"), path.join(w, "code", "vhp_ruler.py"));
  fs.writeFileSync(path.join(w, "code", "kit_cards.py"), KIT_CARDS_PY);
  for (const [k, v] of Object.entries(files)) fs.writeFileSync(path.join(w, "in", k), JSON.stringify(v));
  for (const [k, v] of Object.entries(pub)) fs.writeFileSync(path.join(w, "pub", k), JSON.stringify(v));
  execFileSync("python3", ["-I", "-B", path.join(w, "code", "kit_cards.py"), dataDir, path.join(w, "in"), path.join(w, "pub"), path.join(w, "out.json")], { encoding: "utf8" });
  return JSON.parse(fs.readFileSync(path.join(w, "out.json"), "utf8"));
}

test("G3: a card the kit made in JS is rebuilt byte for byte by the embedded vhp_ruler.py from the vhp-data files", { skip: !PYTHON && "needs python3 (the CI runner has it)" }, () => {
  const { dir, L, s } = fixture(), used = new Map();
  vhpFor(L, used).card(s);
  const cards = cardList(used);
  const r = glue(dir, { "W006.json": { cards }, "inputs/W7.json": { cards } });
  assert.deepEqual(r.ok, [cards[0]], "the [settings, sha256] pair (#G-24 G24-1)");
  assert.deepEqual(r.bad, {});
});

test("G3: a card whose sha256 or settings aren't what the data gives is not in the rebuilt list", { skip: !PYTHON && "needs python3" }, () => {
  const { dir, L, s } = fixture(), used = new Map();
  vhpFor(L, used).card(s);
  const [[set, h]] = cardList(used);
  const fake = "0".repeat(64), moved = { ...set, minK: 11 };
  const r = glue(dir, { "W006.json": { cards: [[set, fake], [moved, h]] } });
  assert.deepEqual(r.ok, []);
  assert.equal(Object.keys(r.bad).length, 2, JSON.stringify(r.bad));
});

test("G3: an already-published file isn't rebuilt again (pruned data never holds an old final)", { skip: !PYTHON && "needs python3" }, () => {
  const { s } = fixture();
  const same = { cards: [[s, "0".repeat(64)]] };
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "kit-vd-empty-"));
  const r = glue(empty, { "W005.json": same }, { "W005.json": same });     // no data at all: still fine, nothing to rebuild
  assert.deepEqual(r, { bad: {}, ok: [] });
});

test("G3 render: a ruler game's publish job embeds vhp_ruler.py and the glue byte for byte; without the ruler it's refused", () => {
  const g = { slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg: { ...exampleCfg(), vhpData: true } };
  assert.throws(() => renderJobs({ branch: "games-data", script: "", games: [g] }), /vhp_ruler.py/);
  const py = rulerPy(pathToFileURL(ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep));
  const yml = renderJobs({ branch: "games-data", script: "", games: [g], ruler: py });
  const lines = yml.split("\n"), a = lines.findIndex((l) => l.trim() === "# BEGIN vhp_ruler.py"), b = lines.findIndex((l) => l.trim() === "# END vhp_ruler.py");
  assert.ok(a > 0 && b > a);
  const body = lines.slice(a + 1, b).map((l) => (l.startsWith("          ") ? l.slice(10) : l)).join("\n") + "\n";
  assert.equal(body, py, "the embedded vhp_ruler.py is byte for byte the repository's");
  assert.ok(yml.includes(`<<'${RULER_HEREDOC}'`));
  const g0 = lines.findIndex((l) => l.includes("kit_cards.py\" <<'KIT_CARDS_PY'")), g1 = lines.findIndex((l, i) => i > g0 && l.trim() === "KIT_CARDS_PY");
  assert.equal(lines.slice(g0 + 1, g1).map((l) => (l.startsWith("          ") ? l.slice(10) : l)).join("\n") + "\n", KIT_CARDS_PY);
  assert.match(yml, /python3 -I -B "\$RUNNER_TEMP\/ruler-code\/kit_cards.py"/);
  assert.match(yml, /KIT_CARDS_DIR: \$\{\{ runner.temp \}\}\/kit-cards/);
  // a game without ruler data renders no ruler step
  const plain = renderJobs({ branch: "games-data", script: "", games: [{ ...g, cfg: exampleCfg() }] });
  assert.ok(!plain.includes("vhp_ruler.py"));
});

// ── #G-24 G24-1 fix (Architecture's own tests; Repo Lens's are appended below when received) ──
test("G24-1: a real card's sha256 listed with OTHER settings is not rebuilt as fine (the pair counts, in Python too)", { skip: !PYTHON && "needs python3" }, () => {
  const { dir, L, s } = fixture(), used = new Map();
  vhpFor(L, used).card(s);
  const [[set, h]] = cardList(used);
  const other = { ...set, round: "2026111601" };            // same sha256, settings that give another card
  const r = glue(dir, { "W006.json": { cards: [[set, h]] }, "W007.json": { cards: [[other, h]] } });
  assert.deepEqual(r.ok, [[set, h]], "only the true pair");
  assert.equal(Object.keys(r.bad).length, 1);
});

test("G24-1: the check requires each entry's own pair; a sha256 twice in one file is refused; malformed files aren't rebuilt", { skip: !PYTHON && "needs python3" }, async () => {
  const { cardKey, isCardList } = await import("../publish/check.inline.mjs");
  const { dir, L, s } = fixture(), used = new Map();
  vhpFor(L, used).card(s);
  const [[set, h]] = cardList(used);
  const ok = new Set([cardKey(set, h)]);
  assert.ok(ok.has(cardKey(JSON.parse(JSON.stringify(set)), h)), "key order and copies don't matter");
  assert.ok(!ok.has(cardKey({ ...set, round: "2026111601" }, h)), "other settings with the same sha256 don't match");
  assert.ok(!isCardList([[set, h], [{ ...set, round: "2026111601" }, h]]), "a sha256 listed twice");
  const r = glue(dir, { "W006.json": { cards: [[set, h], "junk"] }, "W007.json": { cards: [[set, h], [set, h]] } });
  assert.deepEqual(r, { bad: {}, ok: [] }, "nothing from a malformed file is rebuilt");
});

test("#G-24 Info, cardPerRound: a ruler round decided without a card stops the run; the check counts cards against decided rounds", async () => {
  const { exampleGame } = await import("../testing/example/index.ts");
  const { Replay } = await import("../testing/replay.ts");
  const { fakeNode, world } = await import("../testing/fake-nodes.ts");
  const { at, DAY } = await import("../testing/fake-clock.ts");
  const { checkGame } = await import("../publish/check.inline.mjs");
  const wd: any = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(at(4) - DAY) };
  for (let i = 0; i < 2; i++) wd.questions[201 + i] = { week: "4", outcome: 1, lock_time: String(at(4) + (i + 1) * DAY) };
  wd.next = 203;
  wd.players = [{ address: "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", entry: { stake: "0", peak_stake: "0", voided: false, answers: [{ question_id: 201, option: 0 }] } }];
  const cfg = { ...exampleCfg(), vhpData: true, cardPerRound: true };
  const nodes = (): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  const { L } = fixture();
  const h = await new Replay(exampleGame, cfg).hour(nodes(), wd.time + 5 * 60000, { vhpLedger: L });   // makes no card
  assert.match(h.error ?? "", /decided without a ruler card \(cardPerRound;/);
  const off = await new Replay(exampleGame, { ...cfg, cardPerRound: false }).hour(nodes(), wd.time + 5 * 60000, { vhpLedger: L });
  assert.equal(off.result?.state, "pending", "cardPerRound: false lets such a game run");
  // the check side: a week file with decided rounds and too few cards is held
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-cpr-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(pub);
  const wf = new Replay(exampleGame, { ...cfg, cardPerRound: false });
  await wf.hour(nodes(), wd.time + 5 * 60000, { vhpLedger: L });
  fs.writeFileSync(path.join(inn, "W004.json"), wf.raw("W004.json")!);
  assert.ok(checkGame(cfg, inn, pub, wd.time + 5 * 60000, "", new Set()).held.some((x: any) => /decided rounds but only 0 ruler cards/.test(x.why)));
});

// ── Repo Lens #G-24 (kit-phase1b-ruler @ 3c12312): append to kit/tests/phase1b-g3.test.ts (uses its fixture() and glue()) ──
// G24-1 (Low): the glue keys the listed cards by sha256 alone (render.mjs KIT_CARDS_PY: refs[x[1]] = x[0], the last listing
// wins), and the check only asks "is this entry's sha256 in the rebuilt set" (check.inline.mjs cardsWhy). So an entry
// [settings A, sha256 of B's card] passes whenever another entry, in the same file or in another file of the run, lists
// B's real settings with that sha256 later in the glue's order: a card the data doesn't give is published as rebuilt.
// (The JS twin, replay.ts rebuiltCards, returns bare sha256 values too, so checkGame accepts it the same way; the
// blind verifier published such a W file end to end, and a junk W file the check holds can supply the honest entry.) Fix: the glue rebuilds every entry
// and writes the [canonical settings, sha256] pairs that match (or per file and index), and cardsWhy requires each
// entry's own pair; a sha256 listed twice in a file is refused (one card, one settings).
test("G24-1 (Low): an entry whose settings don't give its sha256 is never in the rebuilt list, whatever else the run lists", { skip: !PYTHON && "needs python3" }, () => {
  const { dir, L, s } = fixture(), used = new Map();
  vhpFor(L, used).card(s);
  const [[set, h]] = cardList(used);
  const forged = { ...set, round: "2026111500" };          // another round (sorts first): its own card isn't h
  // one file: [forged, h] then [set, h] (sorted by round, as isCardList wants)
  const one = glue(dir, { "W006.json": { cards: [[forged, h], [set, h]] } });
  assert.ok(!one.ok.includes(h) || false, "a file citing B's card for A's settings passed the rebuild");
  // two files of one run: the forged week file, then an honest inputs file with the real settings
  const two = glue(dir, { "W006.json": { cards: [[forged, h]] }, "inputs/W7.json": { cards: [[set, h]] } });
  assert.ok(!two.ok.includes(h), "the forged week file's entry passes because the inputs file lists the real settings with the same sha256");
});
