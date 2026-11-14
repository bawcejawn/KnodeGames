// Fantasy's kit ask 1 (13 Nov) and #G-69 G69-3: the ruler's `include` (G6) and scoring `mode` (#284) carried through
// the kit's card settings, the publish job's Python rebuild and the publish check; a published card is re-made from
// the settings stored with it, so switching include or a mode on never makes a published week look changed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeChain } from "../../tests/audit/vhp-ruler.fixture.mjs";
import { loadLedger, vhpFor, cardList, pinsOf, cardIdentity, type CardSettings } from "../recorder/sources/vhp-ruler.ts";
import { KIT_CARDS_PY } from "../publish/render.mjs";
import { isCardList } from "../publish/check.inline.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PYTHON = (() => { try { execFileSync("python3", ["--version"]); return true; } catch { return false; } })();
let fx: { dir: string; L: any; s: CardSettings } | null = null;
function fixture() {
  if (fx) return fx;
  const f = makeChain({ seed: 5, hours: 354, np: 4, busy: 0.002 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-inc-"));
  fs.mkdirSync(path.join(dir, "h"));
  for (const t of f.texts) fs.writeFileSync(path.join(dir, "h", `${JSON.parse(t).n}.json`), t);
  const L = loadLedger(dir), Lb = L.to - 20 - 1200 - 500;
  const s: CardSettings = { game: 4, round: "2026111600", window: { W0: Lb - 7199, W1: Lb, L: Lb, S0: Lb + 1, S1: Lb + 1200 }, c: "500000", minK: 10, poolRule: "min", ownRule: "spot", paying: true, pooled: [] };
  return (fx = { dir, L, s });
}
function glue(dataDir: string, files: Record<string, unknown>) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "kit-inc-g3-"));
  for (const d of ["code", "in/inputs", "pub/inputs"]) fs.mkdirSync(path.join(w, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "vhp_ruler.py"), path.join(w, "code", "vhp_ruler.py"));
  fs.writeFileSync(path.join(w, "code", "kit_cards.py"), KIT_CARDS_PY);
  for (const [k, v] of Object.entries(files)) fs.writeFileSync(path.join(w, "in", k), JSON.stringify(v));
  execFileSync("python3", ["-I", "-B", path.join(w, "code", "kit_cards.py"), dataDir, path.join(w, "in"), path.join(w, "pub"), path.join(w, "out.json")], { encoding: "utf8" });
  return JSON.parse(fs.readFileSync(path.join(w, "out.json"), "utf8"));
}
const producersOf = (card: any): string[] => (card.producers ?? []).map((p: any) => p.address ?? p.a ?? p[0]).filter((a: any) => typeof a === "string").sort();

test("include and mode: carried into the card, covered by its sha256, listed in its settings", () => {
  const { L, s } = fixture();
  const u0 = new Map(), u1 = new Map(), u2 = new Map();
  const plain = vhpFor(L, u0).card(s);
  const inc = producersOf(plain).slice(0, 2);
  assert.equal(inc.length, 2, "the fixture card has producers");
  const withInc = vhpFor(L, u1).card({ ...s, include: [...inc].reverse() });
  const withMode = vhpFor(L, u2).card({ ...s, mode: "A" });
  assert.deepEqual(withInc.include, inc, "the card records include (in rising order)");
  assert.equal(withMode.mode, "A");
  for (const a of inc) assert.ok(producersOf(withInc).includes(a), `a row for ${a}`);
  const [c0, c1, c2] = [cardList(u0)[0], cardList(u1)[0], cardList(u2)[0]];
  assert.notEqual(c1[1], c0[1], "include changes the sha256"); assert.notEqual(c2[1], c0[1], "mode changes the sha256");
  assert.deepEqual(c1[0].include, inc); assert.equal(c2[0].mode, "A");
  assert.deepEqual(Object.keys(c1[0]).slice(-1), ["include"]);
  for (const c of [c0, c1, c2]) assert.ok(isCardList([c]), JSON.stringify(c[0]));
});

test("publish check: mode must be A-D; include a rising list of addresses; keys in order", () => {
  const { L, s } = fixture(), u = new Map();
  vhpFor(L, u).card(s);
  const [base, h] = cardList(u)[0];
  const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
  assert.ok(isCardList([[{ ...base, mode: "D", include: [A, B] }, h]]));
  assert.ok(!isCardList([[{ ...base, mode: "E" }, h]]), "unknown mode");
  assert.ok(isCardList([[{ ...base, mode: "A", version: 5 }, h]]));
  assert.ok(!isCardList([[{ ...base, version: 6 }, h]]), "unknown version");
  assert.ok(!isCardList([[{ ...base, version: 4, mode: "A" }, h]]), "version before mode: out of order");
  assert.ok(!isCardList([[{ ...base, include: [B, A] }, h]]), "include not rising");
  assert.ok(!isCardList([[{ ...base, include: [A, A] }, h]]), "include repeats");
  assert.ok(!isCardList([[{ ...base, include: [] }, h]]), "empty include");
  assert.ok(!isCardList([[{ ...base, include: ["nope"] }, h]]), "not an address");
  const { pooled, ...rest } = base;
  assert.ok(!isCardList([[{ ...rest, include: [A], pooled }, h]]), "include before pooled: keys out of order");
});

test("include and mode: the publish job's embedded vhp_ruler.py rebuilds the same sha256 as the kit's JS", { skip: !PYTHON && "needs python3 (the CI runner has it)" }, () => {
  const { dir, L, s } = fixture(), u0 = new Map();
  const inc = producersOf(vhpFor(L, u0).card(s)).slice(0, 2);
  for (const extra of [{ include: inc }, { mode: "B" as const }, { mode: "C" as const, include: inc }, { version: 4 as const }]) {
    const u = new Map();
    vhpFor(L, u).card({ ...s, ...extra });
    const cards = cardList(u);
    const r = glue(dir, { "W006.json": { cards } });
    assert.deepEqual(r.ok, [cards[0]], JSON.stringify(extra));
    assert.deepEqual(r.bad, {});
  }
});

test("G69-3: a card already published is re-made from its own stored settings, whatever the game asks for today", () => {
  const { L, s } = fixture(), pub = new Map();
  vhpFor(L, pub).card(s);                                  // published without include
  const published = cardList(pub);
  const inc = producersOf(vhpFor(L, new Map()).card(s)).slice(0, 2);
  const again = new Map();
  vhpFor(L, again, pinsOf(published)).card({ ...s, include: inc });   // today's settings add include
  assert.deepEqual(cardList(again), published, "the same [settings, sha256] as published");
  // a card for another round isn't pinned
  const other = new Map();
  vhpFor(L, other, pinsOf(published)).card({ ...s, round: "2026111700", include: inc });
  assert.deepEqual(cardList(other)[0][0].include, inc);
  assert.equal(cardIdentity({ ...s, include: inc, mode: "A" }), cardIdentity(s));
});
