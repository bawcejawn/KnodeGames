// Repo Lens #B-12 (fix-check of #B-11, Shared Game Kit core, PR #210 @ 20339607): the reviewer's failing tests for
// the NEW findings (NK numbers as in the report), each asserting the correct behaviour, moved here from tests/audit/
// once fixed; the three to-dos are real tests now, and every Low and Info finding fixed in the same pass has one too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
import { checkGame, canon, weekHash, weekShape, vaultFileOf, tally, atLimit, FRESH_MS, MAX_BEHIND_MS, JOB_WAIT_MS, BOARD_MAX_BYTES, DATA_BRANCHES } from "../publish/check.inline.mjs";
import { renderJobs, RECORD_TIMEOUT_MIN, SETUP_MIN, LEGACY_WAIT_MAX_MIN } from "../publish/render.mjs";
import { exampleCfg, exampleGame, exampleManifest, EXAMPLE_ROOT } from "../testing/example/index.ts";
import { sampleWorld } from "../testing/example/games/kit-example/tests/sample.ts";
import { Replay } from "../testing/replay.ts";
import { fakeNode } from "../testing/fake-nodes.ts";
import { ReadFailed } from "../recorder/nodes.ts";
import { main as cliMain } from "../recorder/cli.ts";
import { sandboxed, staticChecks } from "../testing/conformance.ts";
import { checkHost, kitGames } from "../../tools/kit-render-workflows.mjs";
import { validateManifest, BUDGET_MAX } from "../../tools/game-manifest.mjs";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";
import { makeWeek } from "../testing/weekfile.ts";
import { boardFor } from "../recorder/boards.ts";
import { MAX_WRITE_BYTES } from "../recorder/store.ts";
import { decide, releaseMatches, releaseCode } from "../recorder/lifecycle.ts";
import { readVaultStakes } from "../recorder/sources/vault-stakes.ts";
import { world } from "../testing/fake-nodes.ts";
import { moduleFiles } from "../testing/conformance.ts";

const Q: any = exampleCfg(), MIN = 60000, S4 = at(4), END = at(5);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const nodes = (w: () => any): [any, any] => [fakeNode("a", w), fakeNode("b", w)];
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ad = (i: number) => { let s = "", x = i; for (let k = 0; k < 8; k++) { s = B58[x % 58] + s; x = Math.floor(x / 58); } return "1" + "q".repeat(25) + s; };
const A = ad(1), B = ad(2), C = ad(3);
function week(state: "open" | "pending" | "final", seenAt: number) {
  return makeWeek({ game: 250, week: 4, start: S4, end: END, state, seenAt,
    rounds: [["q00000201", S4, 0, "s", [[A, 1, S4 + 10], [B, 1, S4 + 20], [C, 1, S4 + 5]]], ["q00000202", S4 + DAY, 0, "s", [[A, 1, S4 + DAY], [B, 1, S4 + DAY], [C, 0]]]],
    players: [[A, "500000000", "500000000", 0], [B, "500000000", "500000000", 0], [C, "0", "0", 0]] });
}
const put = (dir: string, name: string, v: any) => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof v === "string" ? v : canon(v)); };
function check(inFiles: Record<string, any>, pubFiles: Record<string, any>, now: number, cfg: any = Q, release = "") {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b12-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(pub);
  for (const [k, v] of Object.entries(inFiles)) put(inn, k, v);
  for (const [k, v] of Object.entries(pubFiles)) put(pub, k, v);
  return checkGame(cfg, inn, pub, now, release);
}
const vault = (j: any, c: any = Q) => vaultFileOf(j, tally(j, c));

/** The rendered Record step run as GitHub runs it (bash -e), with a fake npm exiting `code`: its exit and its rc output. */
function recordStep(code: number) {
  const yml = renderJobs({ branch: "games-data", script: "", games: [{ slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg: Q }] });
  const m = yml.match(/- name: Record\n(?:.*\n)*?\s+run: \|\n((?:\s{10}.*\n)+)/);
  assert.ok(m, "found the Record step");
  const script = m![1].split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b12-step-"));
  fs.writeFileSync(path.join(d, "npm"), `#!/bin/bash\nmkdir -p "$KIT_OUT"; echo '{}' > "$KIT_OUT/W004.json"\nexit ${code}\n`, { mode: 0o755 });
  const out = path.join(d, "gh-output"); fs.writeFileSync(out, "");
  // GitHub runs a `run:` step without `shell:` as `bash -e {0}`
  const r = spawnSync("bash", ["-e", "-c", script], { encoding: "utf8", env: { ...process.env, PATH: `${d}:${process.env.PATH}`, RUNNER_TEMP: d, KIT_OUT: path.join(d, "out"), GITHUB_OUTPUT: out } });
  const rc = /rc=(\d+)/.exec(fs.readFileSync(out, "utf8"))?.[1] ?? "";
  return { status: r.status, rc, uploaded: fs.existsSync(path.join(d, "out", "W004.json")), yml };
}
/** A GitHub `if:` expression evaluated for given job results and outputs (==, !=, &&, ||, always()). */
function evalIf(expr: string, ctx: Record<string, string>) {
  let e = expr.replace(/^\$\{\{\s*|\s*\}\}$/g, "").replace(/always\(\)/g, "true").replace(/github\.ref == 'refs\/heads\/main'/g, "true");
  e = e.replace(/(steps|needs)\.[A-Za-z0-9_.-]+/g, (k) => JSON.stringify(ctx[k] ?? "")).replace(/!=|==/g, (m) => (m === "==" ? "===" : "!=="));
  return Function(`return (${e});`)() as boolean;
}

test("NK-1 (High): the Record step never fails on the recorder's exit code; 0 and 1 upload their files, 2 and a crash don't; the right alert fires", () => {
  for (const [code, upload, alert] of [[0, true, ""], [1, true, "owner"], [2, false, "stopped"], [134, false, "stopped"]] as const) {
    const r = recordStep(code);
    assert.equal(r.status, 0, `npm exit ${code}: the step exits ${r.status} under bash -e`);
    assert.equal(r.rc, String(code), `npm exit ${code}: outputs.rc`);
    assert.equal(r.uploaded, upload, `npm exit ${code}: files left for the upload`);
    const doc = YAML.parse(r.yml.split("\n").filter((l) => !l.includes("BEGIN kit") && !l.includes("END kit")).join("\n").replace(/^  /gm, ""));
    const upl = doc["record-kit-example"].steps.find((x: any) => String(x.uses).startsWith("actions/upload-artifact@"));
    assert.equal(evalIf(upl.if, { "steps.rec.outputs.rc": r.rc }), upload, `npm exit ${code}: the upload step runs`);
    const ctx = { "needs.record-kit-example.result": "success", "needs.record-kit-example.outputs.rc": r.rc, "needs.publish-kit.result": "success" };
    const steps = doc["kit-alerts"].steps;
    const fired = steps.filter((x: any) => evalIf(x.if, ctx)).map((x: any) => (/stopped/.test(x.name) ? "stopped" : /owner/.test(x.name) ? "owner" : "publish"));
    assert.deepEqual(fired, alert ? [alert] : [], `npm exit ${code}: alerts`);
    assert.ok(evalIf(doc["publish-kit"].if, ctx), "publish-kit runs");
  }
  // A job that timed out or was cancelled: publish-kit is skipped, and the separate alert job still says so (NK-16).
  const doc = YAML.parse(recordStep(0).yml.split("\n").filter((l) => !l.includes("BEGIN kit") && !l.includes("END kit")).join("\n").replace(/^  /gm, ""));
  const ctx = { "needs.record-kit-example.result": "cancelled", "needs.record-kit-example.outputs.rc": "", "needs.publish-kit.result": "skipped" };
  assert.equal(evalIf(doc["publish-kit"].if, ctx), false);
  assert.ok(evalIf(doc["kit-alerts"].if, ctx) && doc["kit-alerts"].steps.some((x: any) => /stopped/.test(x.name) && evalIf(x.if, ctx)));
});

test("NK-2 (Medium, latent): vault-stakes reads voided from the week's own entry, as the contract's resultEntry does", async () => {
  const wd = world(at(5, 0, 1));
  const chain: any = { [A]: { player: { stake: "0", void_week_plus_one: "6" }, entry: { stake: "50000000", peak_stake: "50000000", voided: true, points: 0, prize_place: 0 }, active_stake: "0", week_stake: "0" } };
  const node: any = { label: "n", read: async (mth: string, a: any) => (mth === "get_state" ? { time: String(wd.time), config: wd.config } : chain[a.player]) };
  const r = await readVaultStakes(node, 2, [A], 4, wd.time);
  if (!r.live) return; // the fixture's config has no v6 rule: nothing to read
  assert.equal(r.stakes.get(A)!.voided, true, "withdraw-all in week 4, redeposit, withdraw-all in week 5: week 4 is voided on chain");
});

test("NK-3 (Medium): a week of 1,400 wallets answering 60 questions fits the writer (no stop, no lost payout)", () => {
  const ws = Array.from({ length: 1400 }, (_, i) => ad(100 + i));
  const rounds: any = Array.from({ length: 60 }, (_, q) => [`q${String(q).padStart(8, "0")}`, S4 + Math.floor(q / 10) * DAY, 0, "s", ws.map((a, i) => [a, 1, S4 + Math.floor(q / 10) * DAY + 1000 + i])]);
  const j = makeWeek({ game: 250, week: 4, start: S4, end: END, state: "pending", seenAt: END + MIN, rounds, players: ws.map((a, i) => [a, i % 3 ? "0" : "100000000", i % 3 ? "0" : "100000000", 0]) });
  assert.ok(Buffer.byteLength(canon(j)) <= MAX_WRITE_BYTES, `week file ${Buffer.byteLength(canon(j))} bytes, over the writer's ${MAX_WRITE_BYTES}: the run stops every hour`);
});

test("NK-4 (Medium): an honest 16,000-wallet one-round week gets a board.json the recorder can write", () => {
  const ws = Array.from({ length: 16000 }, (_, i) => ad(i)).sort();
  const j = makeWeek({ game: 250, week: 4, start: S4, end: END, state: "pending", seenAt: END + MIN,
    rounds: [["r1", S4, 0, "s", ws.map((a, i) => [a, 1 + (i % 7), S4 + 1 + i])]], players: ws.map((a, i) => [a, i % 6 ? "0" : "100000000", i % 6 ? "0" : "100000000", 0]) });
  assert.ok(Buffer.byteLength(canon(j)) < MAX_WRITE_BYTES);
  assert.ok(Buffer.byteLength(canon(boardFor(j, { ...Q, rowCap: 0 }, END + MIN))) <= MAX_WRITE_BYTES, "board.json over the writer cap: the run stops every hour");
});

test("NK-5 (Medium): the conformance scan follows ./helper.js and ./helper imports the way tsx resolves them", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b12-conf-")), g = path.join(root, "games", "x");
  fs.mkdirSync(path.join(root, "kit"), { recursive: true }); fs.mkdirSync(g, { recursive: true });
  fs.writeFileSync(path.join(g, "recorder.ts"), 'import { a } from "./helper.js";\nimport { b } from "./other";\nexport const m = a + b;\n');
  fs.writeFileSync(path.join(g, "helper.ts"), 'import fs from "node:fs";\nexport const a = 1;\n');
  fs.writeFileSync(path.join(g, "other.ts"), "export const b = 2;\n");
  const files = moduleFiles(path.join(g, "recorder.ts"), root).map((f) => path.relative(g, f)).sort();
  assert.deepEqual(files, ["helper.ts", "other.ts", "recorder.ts"]);
});
/** A copy of the kit-example fixture with recorder.ts edited (absolute kit paths, so it can live outside the repo). */
function variant(edit: (recorder: string) => string) {
  const KIT = path.resolve(EXAMPLE_ROOT, "../..");
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b12-var-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const dir = path.join(d, "games/kit-example"), rec = path.join(dir, "recorder.ts"), sample = path.join(dir, "tests/sample.ts");
  fs.writeFileSync(rec, edit(fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${KIT}/`)));
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1))}/`));
  return d;
}
const G = `const G: any = (0, eval)("this");`;
const atTop = (code: string) => (s: string) => s.replace("export const game", `${G}\n${code}\nexport const game`);
const inScore = (code: string) => (s: string) => atTop("")(s).replace("scoreRound(round, picks, outcome) {", `scoreRound(round, picks, outcome) { ${code}`);

test("NK-6 (Medium): conformance can't be switched off: stackTraceLimit / prepareStackTrace, Date.prototype.constructor, a fixed-at-import time bomb, a Worker", async () => {
  const run = (edit: (s: string) => string) => sandboxed("kit-example", variant(edit));
  assert.deepEqual(run(atTop("")).violations, [], "control: the copy with the global object alone trips nothing");
  const cases: [string, (s: string) => string, string][] = [
    ["stackTraceLimit = 0, then the clock", inScore(`try { G["Err" + "or"]["stackTrace" + "Limit"] = 0; } catch {} void G["Da" + "te"]["no" + "w"]();`), "Date.now"],
    ["prepareStackTrace, then the clock", inScore(`try { G["Err" + "or"]["prepareStack" + "Trace"] = () => ""; } catch {} void G["Da" + "te"]["no" + "w"]();`), "Date.now"],
    ["Date.prototype.constructor", inScore(`void new (new G["Da" + "te"](0))["constr" + "uctor"]();`), "new Date() (the clock)"],
    ["a time bomb fixed at import", atTop(`const BOMB = new (new G["Da" + "te"](0))["constr" + "uctor"]().getTime();`), "new Date() (the clock)"],
    ["a Worker via getBuiltinModule", atTop(`try { new (G["pro" + "cess"]["getBuiltin" + "Module"]("node:worker_" + "threads").Worker)("1", { eval: true }); } catch {}`), "process.getBuiltinModule"],
    ["a Worker via an eval'd import()", atTop(`(0, eval)("imp" + "ort('node:worker_" + "threads')").then((m: any) => { try { new m.Worker("1", { eval: true }); } catch {} });`), "worker_threads.Worker"],
  ];
  for (const [what, edit, want] of cases) {
    const r = run(edit);
    assert.ok(r.violations.includes(want), `${what}: wanted ${want}, saw ${JSON.stringify(r).slice(0, 300)}`);
  }
  // Reads: the repo yes, /proc (the parent's environment) no. A successful read shows up as a Date.now use.
  const reads = (file: string) => run(atTop(`(0, eval)("imp" + "ort('node:f" + "s')").then((f: any) => { let x = ""; try { x = f.readFileSync(${JSON.stringify(file)}, "utf8"); } catch {} if (x) { try { G["Da" + "te"]["no" + "w"](); } catch {} } });`)).violations.includes("Date.now");
  assert.equal(reads(path.join(REPO, "package.json")), true, "control: the repo is readable");
  assert.equal(reads(`/proc/${process.pid}/environ`), false, "the parent's environment isn't");
  // The static scan names them too.
  for (const src of [`Error.stackTraceLimit = 0;`, `Error.prepareStackTrace = f;`, `new (d.constructor)()`, `x["constructor"]`, `Object.getPrototypeOf(d)`, `process.getBuiltinModule("x")`])
    assert.ok(staticChecks(src).some((c) => !c.pass), src);
  assert.ok(staticChecks(`class A { constructor() {} }`).every((c) => c.pass), "a class's own constructor is fine");
});

test("NK-7 (Medium, latent): liveWeek: a week whose open copy already had its final content can still go final (recorder and check agree)", () => {
  const c = { ...Q, liveWeek: true }, T = END - 30 * MIN, open = week("open", T), pend = week("pending", T), fin = week("final", T);
  assert.ok(check({ "W004.json": open }, {}, END - 20 * MIN, c).publish.includes("W004.json"));
  assert.ok(check({ "W004.json": pend }, { "W004.json": open }, END + 10 * MIN, c).publish.includes("W004.json"));
  const rec = decide({ now: END + 3 * H, end: END, due: END + 72 * H, complete: true, hash: pend.seen.hash, prev: { state: "pending", seen: pend.seen }, rereadOk: true, held: null } as any);
  const pub = check({ "W004.json": fin, "vault/W4.json": vault(fin, c) }, { "W004.json": pend }, END + 3 * H, c).publish.includes("W004.json");
  assert.equal(rec.state === "final", pub, `recorder says ${rec.state}, the check ${pub ? "publishes" : "holds"} the final`);
});

test("NK-8 (Low): a final is held until an hour after its pending copy was published (not 20 minutes)", () => {
  const P = END + 45 * MIN, p = week("pending", P - 40 * MIN), f = week("final", P - 40 * MIN);
  assert.ok(check({ "W004.json": p }, {}, P).publish.includes("W004.json"));
  assert.ok(!check({ "W004.json": f, "vault/W4.json": vault(f) }, { "W004.json": p }, P + 20 * MIN).publish.includes("W004.json"));
});

test("NK-9 (Low): the recorder and the publish check read <SLUG>_RELEASE the same way", () => {
  const reason = "week 4 changed on chain after it went final (aaaaaaaaaaaa → bbbbbbbbbbbb)", code = releaseCode(reason), v = `04:${code}`, f = week("final", END + 30 * MIN);
  const pub = check({ "vault/RELEASE-W4.json": { game: 250, week: 4, code } }, { "W004.json": f, "vault/HOLD-W4.json": { game: 250, week: 4, reason }, "vault/W4.json": vault(f) }, END + 3 * H, Q, v).publish.length > 0;
  assert.equal(releaseMatches(v, 4, reason), pub);
});
test("NK-10 (Low): a game not active yet (q60 unset) raises no past-due error each run between Thursday and Monday; an active one does", async () => {
  for (const late of [H, DAY, 3 * DAY + 20 * H]) {
    const x = sampleWorld(at(5, 3) + late);
    x.config.q60_rule_week_plus_one = "0";
    for (const p of x.players) p.entry.answers = [];
    const h = await new Replay(exampleGame, Q).hour(nodes(() => x), x.time + 5 * MIN);
    assert.deepEqual(h.result!.alerts.errors, [], `${late / H} h past due, not active`);
    assert.equal(h.result!.state, "not-active");
  }
  const x = sampleWorld(at(5, 3) + H);
  const h = await new Replay(exampleGame, Q).hour(nodes(() => x), x.time + 5 * MIN);
  assert.ok(h.result!.alerts.errors.some((e) => /backstop/.test(e)), "an active game still alerts");
});

test("NK-11 (Low): content first read 45 min (or up to FRESH_MS) before the publish check is published; the window is derived from the job limits", () => {
  const T = END + 10 * MIN;
  for (const back of [45 * MIN, FRESH_MS]) assert.ok(check({ "W004.json": week("pending", T) }, {}, T + back).publish.includes("W004.json"), `${back / MIN} min`);
  assert.ok(!check({ "W004.json": week("pending", T) }, {}, T + FRESH_MS + 1).publish.includes("W004.json"));
  assert.equal(FRESH_MS, MAX_BEHIND_MS + JOB_WAIT_MS);
  assert.equal(JOB_WAIT_MS, (LEGACY_WAIT_MAX_MIN + 5) * MIN);
  assert.ok(RECORD_TIMEOUT_MIN <= LEGACY_WAIT_MAX_MIN, "a kit game's own job ends before publish-kit stops waiting");
  // The hand-written jobs publish-kit waits for must fit, or the render refuses (games.yml and race.yml do).
  for (const f of ["games.yml", "race.yml"]) checkHost(fs.readFileSync(path.join(REPO, ".github/workflows", f), "utf8"), f);
  assert.throws(() => checkHost("jobs:\n  record:\n    timeout-minutes: 30\n  publish:\n    timeout-minutes: 30\n", "x.yml"), /more than/);
  assert.throws(() => checkHost("jobs:\n  record:\n    timeout-minutes: 30\n", "x.yml"), /no publish job/);
});

test("NK-12 (Low): after final, nodes that disagree on a round are an error every run; a plain read failure stays a warning", async () => {
  let t = at(5, 0, 1);
  const wd = () => { const x = sampleWorld(t); x.questions[305].outcome = 1; return x; };
  const rp = new Replay(exampleGame, Q);
  for (let i = 0; i < 3; i++) { await rp.hour(nodes(wd), t + 5 * MIN); t += H; }
  assert.equal(rp.read("W004.json").state, "final");
  const flaky = { ...exampleGame, async resultOf(r: any, read: any, inputs: any) { return read.label.startsWith("b") ? 4 : exampleGame.resultOf(r, read, inputs); } };
  for (let i = 0; i < 2; i++) {
    const h = await new Replay(flaky as any, Q, rp.root).hour(nodes(wd), t + 5 * MIN);
    assert.ok(h.result!.alerts.errors.some((e) => /nodes disagree/.test(e)), `run ${i}`);
    assert.equal(rp.read("vault/HOLD-W4.json"), null);
    t += H;
  }
  const down = { ...exampleGame, async resultOf(r: any, read: any, inputs: any) { if (read.label.startsWith("b")) throw new ReadFailed("b", "get_question", new Error("down")); return exampleGame.resultOf(r, read, inputs); } };
  const h = await new Replay(down as any, Q, rp.root).hour(nodes(wd), t + 5 * MIN);
  assert.deepEqual(h.result!.alerts.errors, []);
  assert.ok(h.result!.alerts.warnings.some((w) => /couldn't re-read every round/.test(w)));
});

test("NK-13 (Low): the recorder mirrors the check: points over maxRoundPoints stop the run; a decided round going back says why; a fun-round correction never stops a non-correctable game", async () => {
  const t = at(5, 0, 1);
  const big = { ...exampleGame, scoreRound(r: any, p: any, o: any, i: any) { const m = exampleGame.scoreRound(r, p, o, i); for (const v of m.values()) if (v.points) v.points = 5000; return m; } };
  const h = await new Replay(big as any, { ...Q, maxRoundPoints: 1000 }).hour(nodes(() => sampleWorld(t)), t + 5 * MIN);
  assert.match(h.error ?? "", /over the game's maxRoundPoints/);
  // Correctable game: a decided round reads as pending again → an owner alert naming the check's reason.
  const x = sampleWorld(t);
  const rp = new Replay(exampleGame, Q);
  await rp.hour(nodes(() => x), t + 5 * MIN);
  x.time += H; x.questions[301].outcome = 0;
  const h2 = await rp.hour(nodes(() => x), x.time + 5 * MIN);
  assert.ok(h2.result!.alerts.errors.some((e) => /publish check will hold this week file \(decided round q00000301 goes back to pending\)/.test(e)), JSON.stringify(h2.result?.alerts));
  // Non-correctable game with Sunday fun rounds: a fun round's correction is fine on both sides.
  const fun = { ...Q, roundsCorrectable: false, sundayFunRound: true };
  const y = sampleWorld(t);
  const rp3 = new Replay(exampleGame, fun);
  const first = await rp3.hour(nodes(() => y), t + 5 * MIN);
  const wf = rp3.read("W004.json");
  const sun = wf.rounds.find((r: any) => r[2] === 1 && r[3] !== "p");
  if (sun) {
    const qid = Number(sun[0].replace(/^q0*/, ""));
    y.time += H; y.questions[qid].outcome = (y.questions[qid].outcome % 2) + 1;
    const h3 = await rp3.hour(nodes(() => y), y.time + 5 * MIN);
    assert.equal(h3.error, undefined, "no stop");
    assert.deepEqual(h3.held.filter((x: any) => x.alert), []);
  } else assert.ok(first.result, "the sample has no decided Sunday round to correct");
});

test("NK-14 (Low): a throw before the run (an unknown game, a bad manifest) is a stop, exit 2, never exit 1", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b12-cli-"));
  const out = path.join(d, "out");
  assert.equal(await cliMain(["no-such-game"], { KIT_OUT: out, RPC: "http://a", RPC_CHECK: "http://b" } as any), 2);
  assert.deepEqual(fs.readdirSync(out), [], "nothing left to upload");
});

test("NK-15 (Low): a game's whole budget, a last read's retries and setup fit the record job's timeout", () => {
  assert.ok(BUDGET_MAX.ms / MIN + 4.1 + SETUP_MIN <= RECORD_TIMEOUT_MIN);
});

test("NK-16 (Low): two data branches in one workflow file are refused", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kit-b12-two-"));
  fs.mkdirSync(path.join(root, "game-data")); fs.copyFileSync(path.join(REPO, "game-data/deployment.json"), path.join(root, "game-data/deployment.json"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(root, "games"), { recursive: true });
  fs.cpSync(path.join(root, "games/kit-example"), path.join(root, "games/kit-second"), { recursive: true });
  const f = path.join(root, "games/kit-second/game.json");
  const m = JSON.parse(fs.readFileSync(f, "utf8"));
  m.slug = "kit-second"; m.id = 251; m.name = "Kit Second"; m.workflow.enabledVar = "KIT_SECOND_ENABLED";
  m.data.branch = m.data.branch === "race-data" ? "games-data" : "race-data";
  fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "games/kit-second/recorder.ts"), fs.readFileSync(path.join(root, "games/kit-second/recorder.ts"), "utf8").replace(/slug: "kit-example"/, 'slug: "kit-second"'));
  assert.throws(() => kitGames(root), /two data branches|kit-second/);
});

test("NK-17 (Info): a trimmed board keeps every free prize winner's row; NK-4: it fits its byte budget", () => {
  const ws = Array.from({ length: 300 }, (_, i) => ad(5000 + i)).sort();
  const j = makeWeek({ game: 250, week: 4, start: S4, end: END, state: "pending", seenAt: END + MIN,
    rounds: [["r1", S4, 0, "s", ws.map((a, i) => [a, i === 250 ? 99 : 1 + (i % 3), S4 + 1 + i])]], players: ws.map((a) => [a, "0", "0", 0]) });
  const b = boardFor(j, { ...Q, rowCap: 5 }, END + MIN);
  const t = tally(j, Q);
  for (const p of t.prizes) assert.ok(b.lastWeek.rows.some((r: any) => r.a === p.player), `prize winner ${p.player} kept`);
  assert.ok(b.lastWeek.rows.length <= 5 + t.prizes.length);
  assert.ok(Buffer.byteLength(canon(boardFor(j, { ...Q, rowCap: 0 }, END + MIN))) <= BOARD_MAX_BYTES);
});

test("NK-19 (Info): a row's score time must lie in [start, results deadline); NK-20: one rule for week names, branches, variables", () => {
  const j = week("pending", END + MIN);
  const bad = structuredClone(j); bad.rounds[0][4][0][2] = atLimit(j); bad.seen.hash = weekHash(bad);
  assert.match(weekShape(bad, "W004.json", Q), /score time outside/);
  const ok = structuredClone(j); ok.rounds[0][4][0][2] = atLimit(j) - 1; ok.seen.hash = weekHash(ok);
  assert.equal(weekShape(ok, "W004.json", Q), "");
  const yml = renderJobs({ branch: "games-data", script: "", games: [{ slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg: Q }] });
  assert.ok(!/W\[0-9\]\{3,4\}/.test(yml), "the shell uses the check's week-name rule (W0004 refused)");
  const sh = spawnSync("bash", ["-c", `for f in W004.json W0004.json W1000.json; do [[ "$f" =~ ^(board|W([0-9]{3}|[1-9][0-9]{3}))\\.json$ ]] && echo "$f"; done`], { encoding: "utf8" });
  assert.deepEqual(sh.stdout.trim().split("\n"), ["W004.json", "W1000.json"]);
  assert.throws(() => renderJobs({ branch: "vhp-data", script: "", games: [{ slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg: Q }] }), /not a data branch/);
  assert.deepEqual(DATA_BRANCHES, ["games-data", "race-data", "games-data-testnet"]);
  const m = exampleManifest(); m.workflow.enabledVar = "K" + "X".repeat(64);
  assert.ok(validateManifest(m, { kit: true }).some((p: string) => /enabledVar/.test(p)), "the manifest caps the variable at 64 like the render");
});
