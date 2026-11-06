// Repo Lens #B-11 (Shared Game Kit core, PR #210 @ e399c2b4): the reviewer's failing tests, KC numbers as in the report,
// each asserting the CORRECT behaviour (all failed at e399c2b4). Moved onto the v2 week file (rows by player index,
// KC-9) with the same assertions; the reviewer's six to-dos (KC-5, 6, 7, 9, 12, 13) are real tests at the end.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkGame, boardOf, tally, vaultFileOf, canon, sha256 } from "../publish/check.inline.mjs";
import { renderJobs } from "../publish/render.mjs";
import { validateManifest } from "../../tools/game-manifest.mjs";
import { exampleCfg, exampleGame } from "../testing/example/index.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import { makeWeek } from "../testing/weekfile.ts";
import YAML from "yaml";
import { Replay } from "../testing/replay.ts";
import { fakeNode, world, type World } from "../testing/fake-nodes.ts";
import { runGame } from "../recorder/runtime.ts";
import { Out } from "../recorder/store.ts";
import { sampleWorld } from "../testing/example/games/kit-example/tests/sample.ts";

const Q: any = exampleCfg();
const addr = (i: number) => "1" + String.fromCharCode(65 + (i % 26)).repeat(33 - String(i).length) + String(i).replace(/0/g, "o");
const A = addr(1), B = addr(2), C = addr(3);
const S4 = at(4), END = at(5);
function week(state: "pending" | "final", at0: number, edit?: (j: any) => void) {
  const j: any = { game: 250, week: 4, start: S4, end: END, min: "100000000", state, seenAt: at0,
    rounds: [["q00000201", S4, 0, "s", [[A, 1, S4 + 10], [B, 1, S4 + 20], [C, 1, S4 + 5]]], ["q00000202", S4 + DAY, 0, "s", [[A, 1, S4 + DAY], [B, 1, S4 + DAY], [C, 0, S4 + DAY]]]],
    players: [[A, "500000000", "500000000", 0], [B, "500000000", "500000000", 0], [C, "0", "0", 0]] };
  edit?.(j); return makeWeek(j);
}
/** A week built straight from address rows (the reviewer's own literals), as a v2 file. */
const v2 = (j: any) => makeWeek({ game: j.game, week: j.week, start: j.start, end: j.end, min: j.min, state: j.state, seenAt: j.seen.at, rounds: j.rounds, players: j.players });
const put = (dir: string, name: string, v: any) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof v === "string" ? v : canon(v)); };
function check(inFiles: Record<string, any>, pubFiles: Record<string, any>, now: number, cfg: any = Q, release = "") {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b11-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(pub);
  for (const [k, v] of Object.entries(inFiles)) put(inn, k, v);
  for (const [k, v] of Object.entries(pubFiles)) put(pub, k, v);
  return checkGame(cfg, inn, pub, now, release);
}
// Kpred v6.1 post_results + finalizeGameStep, written independently of the kit's contractWinners
function contractPays(rows: { player: string; points: number }[]) {
  const n = BigInt(rows.length), need = (n * 30n + 99n) / 100n, max = Math.max(0, ...rows.map((r) => r.points));
  let cut = 0, cum = 0n;
  if (need > 0n) for (let p = max; p >= 1; p--) { cum += BigInt(rows.filter((r) => r.points === p).length); cut = p; if (cum >= need) break; }
  return new Set(rows.filter((r) => cut >= 1 && r.points >= cut).map((r) => r.player));
}
// bot/vault.ts orderBreak (470-479), verbatim logic
function orderBreak(rows: any[], places: Map<string, number>) {
  const xs = rows.filter((x) => places.has(x.player)).map((x) => ({ a: x.player, pl: places.get(x.player)!, p: x.points })).sort((u, v) => u.pl - v.pl);
  for (let i = 1; i < xs.length; i++) { const u = xs[i - 1], v = xs[i];
    if (u.pl === v.pl && u.p !== v.p) return `${u.a} and ${v.a} share place ${u.pl} but get ${u.p} and ${v.p} points`;
    if (u.pl < v.pl && u.p < v.p) return `${u.a} (place ${u.pl}) gets ${u.p} points, fewer than ${v.a} (place ${v.pl}) with ${v.p}`; }
  return "";
}

test("control: honest pending, then honest final an hour after the pending copy could have been published (NK-8: 2 h after seen.at), publish", () => {
  const p = week("pending", END + 60000), f = week("final", END + 60000);
  assert.deepEqual(check({ "W004.json": p }, {}, END + 2 * 60000).held, []);
  const r = check({ "W004.json": f, "vault/W4.json": vaultFileOf(f, tally(f, Q)) }, { "W004.json": p }, END + 60000 + 2 * H);
  assert.deepEqual(r.held, []);
});

test("KC-1 (High): a back-dated seen.at doesn't skip the hour: final 5 minutes after the pending copy is held", () => {
  const p = week("pending", 0), f = week("final", 0);
  assert.ok(!check({ "W004.json": p }, {}, END + 5 * 60000).publish.includes("W004.json"), "a pending copy first 'seen' in 1970 must be held");
  const r = check({ "W004.json": f, "vault/W4.json": vaultFileOf(f, tally(f, Q)) }, { "W004.json": p }, END + 10 * 60000);
  assert.ok(!r.publish.includes("W004.json"), "final 5 min after its pending copy was published");
});

test("KC-2 (High): with entry.minPoints 0 the contract pays exactly the kit's paid set (and the schema refuses 0)", () => {
  const ws = [addr(11), addr(12), addr(13), addr(14)];
  const j: any = v2({ v: 1, game: 250, week: 4, start: S4, end: END, min: "100000000", state: "final", seen: { hash: "", at: 0 },
    rounds: [["r1", S4, 0, "s", ws.map((a, i) => [a, i === 0 ? 2 : 0, S4 + 1])], ["r2", S4 + DAY, 0, "s", ws.map((a) => [a, 0, S4 + DAY])]],
    players: ws.map((a) => [a, "100000000", "100000000", 0]) });
  const t: any = tally(j, { ...Q, vaultValues: "dense255", entry: { minRounds: 1, minPoints: 0 } });
  const pays = contractPays(t.vault.rows);
  assert.deepEqual([...pays].sort(), [...t.paid].sort(), `kit pays ${t.paid.size}, contract pays ${pays.size}`);
  const m = JSON.parse(fs.readFileSync(new URL("../../kit/testing/example/games/kit-example/game.json", import.meta.url), "utf8"));
  assert.ok(validateManifest({ ...m, entry: { minRounds: 2, minPoints: 0 } }, { kit: true }).length > 0, "minPoints 0 accepted");
});

test("KC-3 (High): a RELEASE from a recorder run alone (no owner value in the publish job) is held", () => {
  const hold = { game: 250, week: 4, reason: "week 4 changed on chain after it went final (aaaaaaaaaaaa → bbbbbbbbbbbb)" };
  const rel = { game: 250, week: 4, code: sha256(hold.reason).slice(0, 16) };
  assert.ok(!check({ "vault/RELEASE-W4.json": rel }, { "vault/HOLD-W4.json": hold }, END + 3 * H).publish.includes("vault/RELEASE-W4.json"), "run-made release of a published HOLD");
  assert.ok(!check({ "vault/HOLD-W4.json": hold, "vault/RELEASE-W4.json": rel }, {}, END + 3 * H).publish.includes("vault/RELEASE-W4.json"), "HOLD and RELEASE in one run");
  assert.ok(!check({ "vault/HOLD-W4.json": hold, "vault/RELEASE-W4.json": rel }, {}, END + 3 * H, Q, `4:${rel.code}`).publish.includes("vault/RELEASE-W4.json"), "HOLD and RELEASE in one run, even with the owner's value");
  assert.ok(check({ "vault/RELEASE-W4.json": rel }, { "vault/HOLD-W4.json": hold }, END + 3 * H, Q, `4:${rel.code}`).publish.includes("vault/RELEASE-W4.json"), "the owner's own release still works");
});

test("KC-4 (High): each kit game records in its own job, with its own timeout, and budgets.ms is capped", () => {
  const block = renderJobs({ branch: "games-data", script: "", games: [
    { slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg: Q },
    { slug: "kit-other", name: "Kit Other", enabledVar: "KIT_OTHER_ENABLED", cfg: { ...Q, slug: "kit-other" } }] });
  const jobs = YAML.parse(`jobs:\n${block}`, { uniqueKeys: true }).jobs;
  const rec = Object.keys(jobs).filter((k) => k.startsWith("record-"));
  assert.deepEqual(rec.sort(), ["record-kit-example", "record-kit-other"], "one job per game");
  for (const k of rec) assert.ok(Number.isInteger(jobs[k]["timeout-minutes"]) && jobs[k]["timeout-minutes"] <= 30, `${k} has its own timeout`);
  assert.match(jobs["publish-kit"].if, /\|\|/, "the publish job runs when any one game recorded");
  const m = JSON.parse(fs.readFileSync(new URL("../../kit/testing/example/games/kit-example/game.json", import.meta.url), "utf8"));
  assert.ok(validateManifest({ ...m, budgets: { ms: 1e12 } }, { kit: true }).length > 0, "budgets.ms 10^12 accepted");
});

test("KC-8 (Medium): roundsCorrectable lets a correction change status and points only, never drop a round or its wallets", () => {
  const p = week("pending", END + 60000), bad = week("pending", END + 60000, (j) => { j.rounds = [j.rounds[1]]; });
  const r = check({ "W004.json": bad }, { "W004.json": p }, END + 2 * H, { ...Q, roundsCorrectable: true });
  assert.ok(!r.publish.includes("W004.json"), "a pending copy that drops a decided round is published");
});

test("KC-10 (Medium): a d152 week with a tie across the paid line passes the vault bot's order check", () => {
  const ws = Array.from({ length: 10 }, (_, i) => addr(i + 20)).sort(), pts = [5, 4, 4, 4, 1, 1, 1, 1, 1, 1];
  const j: any = v2({ v: 1, game: 250, week: 4, start: S4, end: END, min: "100000000", state: "final", seen: { hash: "", at: 0 },
    rounds: [["r1", S4, 0, "s", ws.map((a, i) => [a, pts[i], S4 + 100 * i + 1])], ["r2", S4 + DAY, 0, "s", ws.map((a) => [a, 0, S4 + DAY])]],
    players: ws.map((a) => [a, "100000000", "100000000", 0]) });
  const c = { ...Q, payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 } }, t: any = tally(j, c);
  const b: any = boardOf(j, t, new Date(END).toISOString());
  assert.equal(orderBreak(vaultFileOf(j, t).rows, new Map(b.lastWeek.rows.map((r: any) => [r.a, r.place]))), "");
});

test("KC-11 (Medium): an honest week with 2,001 rounds (about 70 KB) isn't held for good", () => {
  const p = week("pending", END + 3 * H - 60000, (j) => { j.rounds = Array.from({ length: 2001 }, (_, k) => [`b${String(k).padStart(6, "0")}`, S4, 0, "s", []]); });
  assert.ok(check({ "W004.json": p }, {}, END + 3 * H).publish.includes("W004.json"));
});

test("KC-14 (Medium): a game name must be one plain line (no YAML injection into the rendered workflow)", () => {
  const m = JSON.parse(fs.readFileSync(new URL("../../kit/testing/example/games/kit-example/game.json", import.meta.url), "utf8"));
  assert.ok(validateManifest({ ...m, name: "Evil\n      - name: injected\n        run: echo INJECTED" }, { kit: true }).length > 0);
});

test("KC-17 (Low): zero-padded vault names (W04, HOLD-W004) aren't published as extra write-once files", () => {
  const hold = { game: 250, week: 4, reason: "x" };
  const r = check({ "vault/HOLD-W004.json": hold }, {}, END + 3 * H);
  assert.ok(!r.publish.includes("vault/HOLD-W004.json"));
});

test("KC-18 (Low): a HOLD with no reason next to a RELEASE holds those files, it doesn't throw for the whole game", () => {
  assert.doesNotThrow(() => check({ "vault/HOLD-W4.json": { game: 250, week: 4 }, "vault/RELEASE-W4.json": { game: 250, week: 4, code: "0".repeat(16) } }, {}, END + 3 * H));
});


// ───── the reviewer's to-dos, as real tests ─────
const nodes2 = (w: () => World, b: any = {}): [any, any] => [fakeNode("a", w), fakeNode("b", w, b)];

test("KC-5 (Medium): a Sunday fun round resolved after the week is final publishes no HOLD", async () => {
  const cfg = { ...Q, sundayFunRound: true };
  let t = at(5, 0, 1);
  const wd = () => { const x = sampleWorld(t); x.questions[305].outcome = 1; x.questions[306].outcome = late ? 2 : 0; return x; };
  let late = false;
  const rp = new Replay(exampleGame, cfg);
  for (let i = 0; i < 3; i++) { await rp.hour(nodes2(wd), t + 300000); t += H; }
  assert.equal(rp.read("W004.json").state, "final");
  late = true;   // the Sunday question's outcome is set after Monday's final
  const h = await rp.hour(nodes2(wd), t + 300000);
  assert.equal(rp.read("vault/HOLD-W4.json"), null, "no false HOLD");
  assert.ok(!h.result!.alerts.errors.length, h.result!.alerts.errors.join("; "));
});

test("KC-6 (Medium): after final, a run where node b disagrees writes no HOLD; an unreleased HOLD re-alerts every run", async () => {
  const cfg = { ...Q, sundayFunRound: true };
  let t = at(5, 0, 1);
  const wd = () => { const x = sampleWorld(t); x.questions[305].outcome = 1; return x; };
  const rp = new Replay(exampleGame, cfg);
  for (let i = 0; i < 3; i++) { await rp.hour(nodes2(wd), t + 300000); t += H; }
  assert.equal(rp.read("W004.json").state, "final");
  // Node b reads every round differently this run (a module whose resultOf reads the chain): the run must not HOLD.
  const flaky = { ...exampleGame, async resultOf(r: any, read: any, inputs: any) { return read.label.startsWith("b") ? 4 : exampleGame.resultOf(r, read, inputs); } };
  const rp2 = new Replay(flaky as any, cfg, rp.root);
  const h = await rp2.hour(nodes2(wd), t + 300000);
  assert.equal(rp.read("vault/HOLD-W4.json"), null, "one bad run writes no HOLD");
  // …but it does alert the owner: two nodes disagreeing on a final week can't go quiet (#B-12 NK-12).
  assert.ok(h.result!.alerts.errors.some((w) => /nodes disagree on its rounds/.test(w)));
  // A real change after final (both nodes): HOLD once, then an alert on every later run until released.
  t += H;
  const changed = () => { const x = wd(); x.players[0].entry.answers[1].option = 0; return x; };
  await rp.hour(nodes2(changed), t + 300000);
  assert.ok(rp.read("vault/HOLD-W4.json"));
  for (let i = 0; i < 2; i++) { t += H; const r = await rp.hour(nodes2(changed), t + 300000); assert.ok(r.result!.alerts.errors.some((e) => /is held/.test(e)), `run ${i}: still alerting`); }
});

test("KC-7 (Medium): node b's head 3.5 days behind stops the run with an error; a stalled node never silently loses the week", async () => {
  const wd = sampleWorld(at(5, 0, 2));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kc7-")), prev = path.join(d, "prev");
  fs.mkdirSync(prev); fs.writeFileSync(path.join(prev, ".fetched"), "");
  await assert.rejects(runGame(exampleGame, Q, { nodes: nodes2(() => wd, { lagMs: 3.5 * DAY }), prev, out: path.join(d, "o"), log: () => {} }), /apart/);
  await assert.rejects(runGame(exampleGame, Q, { nodes: nodes2(() => wd), prev, out: path.join(d, "o2"), log: () => {}, wallNow: () => wd.time + 3.5 * DAY }), /stalled/);
});

test("KC-9 (Medium): 578 wallets answering 60 questions (and 2,363 at 14) still publish", async () => {
  for (const [nw, nq] of [[578, 60], [2363, 14]]) {
    const t = at(5, 0, 2);
    const x: World = world(t);
    const s4 = at(4);
    for (let q = 0; q < nq; q++) x.questions[1000 + q] = { week: "4", outcome: 1 + (q % 3), lock_time: String(s4 + 3600000 + Math.floor((q * 6 * DAY) / nq)) };
    x.questions[999] = { week: "3", outcome: 1, lock_time: String(s4 - DAY) };
    x.next = 1000 + nq;
    const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    for (let i = 0; i < nw; i++) {
      let n = i, tail = ""; for (let k = 0; k < 6; k++) { tail = B58[n % 58] + tail; n = Math.floor(n / 58); }
      x.players.push({ address: "1" + "Q".repeat(27) + tail, entry: { stake: i % 3 ? "0" : "200000000", peak_stake: i % 3 ? "0" : "200000000", voided: false, answers: Array.from({ length: nq }, (_, q) => ({ question_id: 1000 + q, option: (i + q) % 3 })) } });
    }
    const rp = new Replay(exampleGame, Q);
    const h = await rp.hour(nodes2(() => x), t + 300000);
    assert.equal(h.error, undefined, `${nw}×${nq}: ${h.error}`);
    assert.ok(h.published.includes("W004.json") && h.published.includes("board.json"), `${nw}×${nq}: ${JSON.stringify(h.held.slice(0, 2))}`);
    assert.ok(Buffer.byteLength(rp.raw("W004.json")!) < 2 * 1024 * 1024);
  }
});

test("KC-12 (Medium): conformance fails modules that use the clock, randomness, the environment, files or processes", async () => {
  const { staticChecks } = await import("../testing/conformance.ts");
  for (const src of [`new Date`, `performance.now()`, `process.hrtime()`, `crypto.getRandomValues(a)`, `import x from "node:crypto";`, `const e = process.env.X;`, `import f from "node:fs/promises";`, `createRequire(import.meta.url)`])
    assert.ok(staticChecks(src).some((c) => !c.pass), src);
  // Run-time traps (scoreRound, top-level code) and the file sandbox: kit/tests/conformance.test.ts.
});

test("KC-13 (Medium): one game's step can't write another game's files (its own job and artifact)", () => {
  const block = renderJobs({ branch: "games-data", script: "", games: [
    { slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg: Q },
    { slug: "kit-other", name: "Kit Other", enabledVar: "KIT_OTHER_ENABLED", cfg: { ...Q, slug: "kit-other" } }] });
  const jobs = YAML.parse(`jobs:\n${block}`, { uniqueKeys: true }).jobs;
  const up = (k: string) => jobs[k].steps.find((x: any) => String(x.uses).startsWith("actions/upload-artifact@")).with;
  assert.equal(up("record-kit-example").name, "kit-games-data-kit-example");
  assert.equal(up("record-kit-other").name, "kit-games-data-kit-other");
  const dl = jobs["publish-kit"].steps.filter((x: any) => String(x.uses).startsWith("actions/download-artifact@")).map((x: any) => [x.with.name, x.with.path]);
  assert.deepEqual(dl, [["kit-games-data-kit-example", "${{ runner.temp }}/incoming/kit-example"], ["kit-games-data-kit-other", "${{ runner.temp }}/incoming/kit-other"]]);
  void Out;
});
