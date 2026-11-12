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
  assert.deepEqual(r.ok, [cards[0][1]]);
  assert.deepEqual(r.bad, {});
});

test("G3: a card whose sha256 or settings aren't what the data gives is not in the rebuilt list", { skip: !PYTHON && "needs python3" }, () => {
  const { dir, L, s } = fixture(), used = new Map();
  vhpFor(L, used).card(s);
  const [[set, h]] = cardList(used);
  const fake = "0".repeat(64), moved = { ...set, minK: 11 };
  const r = glue(dir, { "W006.json": { cards: [[set, fake], [moved, h]] } });
  assert.deepEqual(r.ok, []);
  assert.ok(r.bad[fake] && r.bad[h], JSON.stringify(r.bad));
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
