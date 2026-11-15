// KG parts v1 for kit games (game.json "parts"): the recorder writes the week as W<NNN>/ (kit/parts manifest + parts),
// the publish job checks the folder with kit/parts' checkParts and rebuilds the exact week file, then judges it like any
// other. Fantasy's display columns (partCols, with a null address for a wallet with no team), and a 9,000-player
// Fantasy-shaped week under the 60% warning in every part.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { exampleGame, exampleCfg } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import { weekToParts, partsToWeek, canon, weekHash, useKitParts } from "../publish/check.inline.mjs";
import * as KP from "../parts/parts.inline.mjs";
import type { GameModule } from "../recorder/types.ts";
useKitParts(KP);

const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", B = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
function qworld() {
  const wd = world(at(5, 0, 2));
  wd.questions[200] = { week: "3", outcome: 1, lock_time: String(at(4) - DAY) };
  for (let i = 0; i < 4; i++) wd.questions[201 + i] = { week: "4", outcome: 1 + (i % 2), lock_time: String(at(4) + (i + 1) * DAY) };
  wd.next = 205;
  const ans = (o: number[]) => o.map((x, i) => ({ question_id: 201 + i, option: x }));
  wd.players = [
    { address: A, entry: { stake: "500000000", peak_stake: "500000000", voided: false, answers: ans([0, 1, 0, 1]) } },
    { address: B, entry: { stake: "0", peak_stake: "0", voided: false, answers: ans([0, 1, 1]) } },
  ];
  return wd;
}
const nodes = (wd: any): [any, any] => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
async function toFinal(rp: Replay, wd: any) {
  let h;
  for (let i = 0; i < 3; i++) { h = await rp.hour(nodes(wd), wd.time + 5 * 60000); assert.equal(h.error, undefined, h.error); wd.time += H; }
  return h!;
}

test("parts: a parts game publishes W004/ (manifest + parts); the rebuilt week is exactly the one-file week, and goes final", async () => {
  const plain = new Replay(exampleGame, exampleCfg()), wdA = qworld();
  await toFinal(plain, wdA);
  const parts = new Replay(exampleGame, { ...exampleCfg(), parts: "d" }), wdB = qworld();
  const h = await toFinal(parts, wdB);
  assert.equal(parts.read("W004.json").state, "final");
  assert.ok(fs.existsSync(path.join((parts as any).pub, "W004", "manifest.json")), "the folder is published");
  assert.ok(!fs.existsSync(path.join((parts as any).pub, "W004.json")), "no one-file copy");
  const a = plain.read("W004.json"), b = parts.read("W004.json");
  assert.equal(weekHash(b), weekHash(a), "the same week hash");
  assert.equal(canon({ ...b, seen: a.seen }), canon(a), "the same week file");
  assert.ok(parts.read("vault/W4.json"), "its vault file is published as before");
  const m = JSON.parse(fs.readFileSync(path.join((parts as any).pub, "W004", "manifest.json"), "utf8"));
  assert.equal(m.state, "final");
  assert.ok(m.expect.includes("wk") && m.expect.some((x: string) => /^d[1-7]$/.test(x)) && m.expect.some((x: string) => x.startsWith("p/")));
  // a final folder is never written again
  wdB.time += H;
  const h2 = await parts.hour(nodes(wdB), wdB.time + 5 * 60000);
  assert.equal(h2.error, undefined, h2.error);
  assert.ok(!h2.published.some((x) => x.startsWith("W004/")), JSON.stringify(h2.published));
  void h;
});

test("parts: a tampered, stale or extra part file is held by the publish job's kit/parts check", async () => {
  const rp = new Replay(exampleGame, { ...exampleCfg(), parts: "r" }), wd = qworld();
  await rp.hour(nodes(wd), wd.time + 5 * 60000);
  const { partsViews } = await import("../publish/check.inline.mjs");
  const pub = (rp as any).pub;
  const out = fs.mkdtempSync(path.join((rp as any).root, "t-"));
  fs.cpSync(path.join(pub, "W004"), path.join(out, "W004"), { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(out, "W004", "manifest.json"), "utf8"));
  const part = path.join(out, "W004", m.parts.find((p: any) => p.part === "wk").name);
  fs.writeFileSync(part, fs.readFileSync(part, "utf8").replace('"pending"', '"final"'));
  let v = partsViews({ ...exampleCfg(), parts: "r" }, out, pub, (rp as any).root);
  assert.ok(v.held.some((x: any) => x.name === "W004/" && /SHA-256|bytes/.test(x.why)), JSON.stringify(v.held));
  fs.rmSync(path.join(out, "W004"), { recursive: true });
  fs.cpSync(path.join(pub, "W004"), path.join(out, "W004"), { recursive: true });
  fs.writeFileSync(path.join(out, "W004", "d1.000000000000.json"), "{}");
  v = partsViews({ ...exampleCfg(), parts: "r" }, out, pub, (rp as any).root);
  assert.ok(v.held.some((x: any) => /not listed|stale/.test(x.why)), JSON.stringify(v.held));
  fs.writeFileSync(path.join(out, "W004.json"), "{}");
  v = partsViews({ ...exampleCfg(), parts: "r" }, out, pub, (rp as any).root);
  assert.ok(v.held.some((x: any) => /both as a file and as a parts folder/.test(x.why)), JSON.stringify(v.held));
});

test("partCols: display columns ride along in the day parts (null for no address), and aren't in the week file", async () => {
  const g: GameModule<any, any, any> = { ...exampleGame, partCols: { cols: [["opt", "i"], ["who", "a"]], row: (pick: any) => [pick?.option ?? -1, pick?.option === 1 ? A : null] } };
  const rp = new Replay(g, { ...exampleCfg(), parts: "d" }), wd = qworld();
  const h = await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.equal(h.error, undefined, h.error);
  const pub = (rp as any).pub, m = JSON.parse(fs.readFileSync(path.join(pub, "W004", "manifest.json"), "utf8"));
  const d = m.parts.filter((p: any) => /^d[1-7]$/.test(p.part)).map((p: any) => KP.decodePart(fs.readFileSync(path.join(pub, "W004", p.name), "utf8")));
  const rows = d.flatMap((x: any) => x.rows);
  assert.ok(rows.some((r: any) => r.opt === 1 && r.who === A));
  assert.ok(rows.some((r: any) => r.opt === 0 && r.who === null), "null for no address (Fantasy: a wallet with no team)");
  assert.ok(!("opt" in rp.read("W004.json").rounds[0]), "not in the week file");
});

test("parts sizes: a Fantasy-shaped week at 9,000 weekly players fits, every part under the 60% warning", () => {
  const N = 9000, start = at(4);
  const enc = (i: number) => String(i).padStart(6, "0").split("").map((c) => "ABCDEFGHJK"[Number(c)]).join("");
  const addr = (i: number) => "1" + enc(i) + "z".repeat(27);
  const prods = Array.from({ length: 30 }, (_, i) => "1P" + enc(i) + "y".repeat(26));
  const players: any[] = [];
  for (let i = 0; i < N; i++) players.push([addr(i), "500000000", "500000000", 0]);
  players.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const team = (i: number) => ({ t: [0, 1, 2, 3, 4].map((k) => prods[(i + k * 7) % 30]), at: start });
  const rounds: any[] = [];
  for (let d = 0; d < 6; d++) rounds.push([`d2026111${d}`, start + d * DAY, 0, "s", players.map((_, i) => [i, 1000 + (i % 90000), 3600 * 1000 * (d + 1)])]);
  const state = players.map((p, i) => [p[0], team(i)]);
  const j: any = { v: 2, game: 4, week: 4, start, end: start + 7 * DAY, min: "100000000", state: "pending", seen: { hash: "x".repeat(64), at: start + 7 * DAY }, rounds, players, carry: state, next: state, extras: { rival: Array.from({ length: 2500 }, (_, i) => [addr(i), addr(i + 1), 1]) } };
  const disp = { cols: [["p1", "a"], ["p2", "a"], ["p3", "a"], ["p4", "a"], ["p5", "a"]] as any, rows: new Map(rounds.map((r) => [r[0], new Map(players.map((p, i) => [p[0], team(i).t]))])) };
  const { encoded } = weekToParts(j, { ...exampleCfg(), slug: "fantasy", parts: "d" }, disp);
  const big = encoded.map((e: any) => [e.part, e.bytes]).sort((x: any, y: any) => y[1] - x[1]);
  for (const [p, b] of big) assert.ok(b < KP.WARN_BYTES, `${p} is ${b} bytes, over the 60% warning`);
  const total = encoded.reduce((s: number, e: any) => s + e.bytes, 0);
  console.log(`# 9,000 players: ${encoded.length} parts, largest ${big[0][0]} ${(big[0][1] / 1048576).toFixed(2)} MB, total ${(total / 1048576).toFixed(2)} MB`);
  const dec = encoded.map((e: any) => { const d = KP.decodePart(e.text); return { part: e.part, header: d.header, rows: d.rows }; });
  const back = partsToWeek(dec, { ...exampleCfg(), parts: "d" });
  for (const k of Object.keys(j)) assert.equal(JSON.stringify(back[k]), JSON.stringify(j[k]), `key ${k}`);
  assert.equal(canon(back), canon(j), "lossless at size");
});

test("parts: a parts game passes game:check (the publish check's temp folder is the caller's, never read from the environment)", async () => {
  const { conformance } = await import("../testing/conformance.ts");
  const os = await import("node:os");
  const { fileURLToPath } = await import("node:url");
  const EX = fileURLToPath(new URL("../testing/example/", import.meta.url)), KITDIR = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-conf-parts-"));
  fs.cpSync(path.join(EX, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example");
  const rec = path.join(dir, "recorder.ts");
  fs.writeFileSync(rec, fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KITDIR.split(path.sep).join("/")}/`));
  const sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EX, "games/kit-example/tests", m.slice(1)).split(path.sep).join("/")}/`));
  const gj = path.join(dir, "game.json"), j = JSON.parse(fs.readFileSync(gj, "utf8"));
  fs.writeFileSync(gj, JSON.stringify({ ...j, parts: "d" }, null, 2) + "\n");
  const failed = (await conformance("kit-example", d)).filter((c) => !c.pass).map((c) => c.msg);
  assert.deepEqual(failed, []);
});

test("G73-1: ctx.vhp says loaded: true with the ruler's data, false for the kit's no-data stand-in", async () => {
  const { R, timeline } = await import("../../tests/audit/race-ruler.fixture.mjs");
  const { vhpFor } = await import("../recorder/sources/vhp-ruler.ts");
  assert.equal(vhpFor(R.ledger(timeline()), new Map()).loaded, true);
  const seen: boolean[] = [];
  const g: GameModule<any, any, any> = { ...exampleGame, async resultOf(r, read, inputs, ctx) { seen.push(ctx!.vhp!.loaded); return exampleGame.resultOf(r, read, inputs); } };
  const rp = new Replay(g, { ...exampleCfg(), vhpData: true, cardPerRound: false }), wd = qworld();
  await rp.hour(nodes(wd), wd.time + 5 * 60000);
  assert.ok(seen.length && seen.every((x) => x === false), JSON.stringify(seen));
});
