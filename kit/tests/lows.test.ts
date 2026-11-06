// Repo Lens #B-11's Low findings, one test each (KC-16, KC-19 to KC-22, KC-24 to KC-26), plus the payout fuzz run
// through the WHOLE tally with 0-point and floor rows (KC-24).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tally, boardOf, vaultFileOf, contractWinners, checkGame, canon } from "../publish/check.inline.mjs";
import { makeWeek } from "../testing/weekfile.ts";
import { exampleCfg, exampleGame, exampleManifest, EXAMPLE_ROOT } from "../testing/example/index.ts";
import { Replay } from "../testing/replay.ts";
import { runGame, varName } from "../recorder/runtime.ts";
import { kitConfig, payoutPin, readDeployment, loadManifest } from "../recorder/manifest.ts";
import { readVaultStakes } from "../recorder/sources/vault-stakes.ts";
import { duplicateKeys, validateManifest } from "../../tools/game-manifest.mjs";
import { fakeNode, rng, world } from "../testing/fake-nodes.ts";
import { sampleWorld } from "../testing/example/games/kit-example/tests/sample.ts";
import { at, DAY, HOUR as H } from "../testing/fake-clock.ts";

const Q = exampleCfg();
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (i: number) => { let n = i, t = ""; for (let k = 0; k < 5; k++) { t = B58[n % 58] + t; n = Math.floor(n / 58); } return "1" + "W".repeat(28) + t; };
const nodes = (w: () => any, b: any = {}): [any, any] => [fakeNode("a", w), fakeNode("b", w, b)];

test("KC-24: payout fuzz through the whole tally — 0-point rows, floors (minPts), both rules: kit paid == the contract's walk", () => {
  const r = rng(24);
  for (let i = 0; i < 3000; i++) {
    const n = Math.floor(r() * 40), spread = 1 + Math.floor(r() * (r() < 0.4 ? 3 : 30));
    const players = Array.from({ length: n }, (_, k) => [addr(k), r() < 0.8 ? "200000000" : "0", "200000000", 0] as any);
    const rounds: any[] = [0, 1].map((d) => [`r${d}`, at(4, d), 0, "s", players.map(([a]: any) => [a, r() < 0.3 ? 0 : Math.floor(r() * spread), at(4, d) + 1 + Math.floor(r() * 1000)])]);
    const j = makeWeek({ game: 250, week: 4, start: at(4), end: at(5), state: "final", seenAt: at(5), rounds, players });
    for (const [rule, mode] of [["legacy-tied-whole", "dense255"], ["legacy-tied-whole", "points"], ["d152", "dense255"]]) {
      const cfg = { ...Q, payoutRule: rule, vaultValues: mode, minPts: r() < 0.3 ? 3 : 0 };
      const t: any = tally(j, cfg);
      if (t.vaultError) { assert.match(t.vaultError, /can't go|more paid places/, `week ${i}`); continue; }
      for (const v of t.vault.rows) assert.ok(v.points >= 1);
      for (const row of t.rows.filter((x: any) => x.staked)) assert.ok(row.pts >= Math.max(1, cfg.minPts), "no 0-point or under-floor row is posted");
      const won = contractWinners(t.vault.rows);
      assert.deepEqual([...won].sort(), [...t.paid].sort(), `week ${i} ${rule}/${mode}`);
    }
  }
});

test("KC-16: more score groups than 255 vault values: no throw; the week can't go final (W file held), the board still publishes", () => {
  const players = Array.from({ length: 900 }, (_, k) => [addr(k), "200000000", "200000000", 0] as any);   // ~270 paid score groups
  const rounds: any[] = [0, 1].map((d) => [`r${d}`, at(4, d), 0, "s", players.map(([a]: any, k: number) => [a, d ? 0 : 1000 - k, at(4) + 1])]);
  const cfg = { ...Q, vaultValues: "dense255", maxRoundPoints: 1000000 };
  const fin = makeWeek({ game: 250, week: 4, start: at(4), end: at(5), state: "final", seenAt: at(5, 0, 1), rounds, players });
  const t: any = tally(fin, cfg);
  assert.match(t.vaultError, /more paid places/);
  assert.throws(() => vaultFileOf(fin, t), /no vault file/);
  const pend = makeWeek({ game: 250, week: 4, start: at(4), end: at(5), state: "pending", seenAt: at(5, 0, 1), rounds, players });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kc16-")), inn = path.join(d, "in"), pub = path.join(d, "pub");
  fs.mkdirSync(inn); fs.mkdirSync(pub);
  fs.writeFileSync(path.join(pub, "W004.json"), canon(pend));
  fs.writeFileSync(path.join(inn, "W004.json"), canon(fin));
  fs.writeFileSync(path.join(inn, "board.json"), canon(boardOf(pend, tally(pend, cfg), new Date(at(5, 0, 3)).toISOString())));
  const r = checkGame(cfg, inn, pub, at(5, 0, 3));
  assert.ok(r.held.some((h: any) => h.name === "W004.json" && /no vault file/.test(h.why)));
  assert.ok(r.held.some((h: any) => h.name === "board.json" && !h.alert), "the board just waits for its week (no second alert)");
  // The recorder never gets that far: it keeps such a week pending, with an alert, and its board publishes.
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), "kc16b-")), inn2 = path.join(d2, "in");
  fs.mkdirSync(inn2);
  fs.writeFileSync(path.join(inn2, "W004.json"), canon(pend));
  fs.writeFileSync(path.join(inn2, "board.json"), canon(boardOf(pend, tally(pend, cfg), new Date(at(5, 0, 1)).toISOString())));
  const r2 = checkGame(cfg, inn2, path.join(d2, "none"), at(5, 0, 1) + 300000);
  assert.deepEqual(r2.held, []);
  assert.deepEqual(r2.publish.sort(), ["W004.json", "board.json"]);
});

test("KC-19, KC-20: the alerts name the variable the workflow reads; a hold on a final week, or a change after a release, is reported", async () => {
  assert.equal(varName("kit-example", "RELEASE"), "KIT_EXAMPLE_RELEASE");
  let t = at(5, 0, 1);
  const w = () => { const x = sampleWorld(t); x.questions[305].outcome = 1; return x; };
  const rp = new Replay(exampleGame, Q);
  for (let i = 0; i < 3; i++) { await rp.hour(nodes(w), t + 300000); t += H; }
  assert.equal(rp.read("W004.json").state, "final");
  let h = await rp.hour(nodes(w), t + 300000, { holdWeeks: "4" });
  assert.ok(h.result!.alerts.warnings.some((x) => /already final: the hold does nothing/.test(x)));
  t += H;
  const changed = () => { const x = w(); x.players[0].entry.answers[1].option = 0; return x; };
  h = await rp.hour(nodes(changed), t + 300000);
  const hold = rp.read("vault/HOLD-W4.json");
  assert.ok(h.result!.alerts.errors.some((x) => x.includes("KIT_EXAMPLE_RELEASE") && !x.includes("KIT-EXAMPLE")));
  const code = h.result!.alerts.errors.join(" ").match(/KIT_EXAMPLE_RELEASE = "(4:[0-9a-f]{16})"/)![1];
  t += H;
  await rp.hour(nodes(changed), t + 300000, { release: code });
  assert.ok(rp.read("vault/RELEASE-W4.json"), "released by the owner's value");
  t += H;
  const again = () => { const x = changed(); x.players[1].entry.answers[0].option = 1; return x; };
  h = await rp.hour(nodes(again), t + 300000);
  assert.ok(h.result!.alerts.errors.some((x) => /changed on chain again after its hold was released/.test(x)));
  void hold;
});

test("KC-21: past the results deadline unfinal, every run alerts (not only within 2 hours of it)", async () => {
  for (const late of [10 * 60000, 5 * H, 2 * DAY]) {
    const x = sampleWorld(at(5, 3) + late);
    const rp = new Replay(exampleGame, Q);
    const h = await rp.hour(nodes(() => x), x.time + 300000);
    assert.ok(h.result!.alerts.errors.some((e) => /backstop/.test(e)), `${late / H} h late`);
  }
});

test("KC-22: vault-stakes: the live gate is w + 1 ≥ v6_rule_week_plus_one; the minimum isn't replaced; voided from void_week_plus_one", async () => {
  const wd = world(at(5, 0, 1));
  const node = (cfg: any, p: any) => ({ label: "n", read: async (m: string) => (m === "get_state" ? { time: String(wd.time), config: { ...wd.config, ...cfg } } : p) });
  const A = addr(1);
  let r = await readVaultStakes(node({ v6_rule_week_plus_one: "6" }, {}) as any, 2, [A], 4, wd.time);
  assert.equal(r.live, false, "week 4 is before the v6 rule week (5 + 1 = 6)");
  r = await readVaultStakes(node({ v6_rule_week_plus_one: "5", min_stake: "0" }, { week_stake: "7", entry: { stake: "7", peak_stake: "9" }, player: { void_week_plus_one: "5" } }) as any, 2, [A], 4, wd.time);
  assert.equal(r.live, true);
  assert.equal(r.min, "0", "the vault's own minimum, not 1 KOIN");
  assert.deepEqual(r.stakes.get(A), { stake: "7", peak: "9", voided: true });
});

test("KC-24: a game whose decided rounds can't change (roundsCorrectable false) stops on an on-chain change, naming the round", async () => {
  const cfg = { ...Q, roundsCorrectable: false };
  const t = at(5, 0, 1);
  const x = sampleWorld(t);
  const rp = new Replay(exampleGame, cfg);
  await rp.hour(nodes(() => x), t + 300000);
  x.time += H; x.questions[301].outcome = 2;
  const h = await rp.hour(nodes(() => x), x.time + 300000);
  assert.match(h.error ?? "", /round q00000301 was decided and now reads differently/);
  assert.deepEqual(h.published, []);
});

test("KC-25, KC-26: kit manifests are validated in kit mode; repeated keys are refused; payout fields are pinned in vaultGames", () => {
  const m = exampleManifest();
  assert.deepEqual(validateManifest(m, { kit: true }), []);
  assert.deepEqual(duplicateKeys(`{"a":1,"entry":{"minPoints":1,"minPoints":0}}`), ["entry.minPoints"]);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kc26-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const f = path.join(d, "games/kit-example/game.json");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(`"minPts": 0,`, `"minPts": 0, "minPts": 0,`));
  assert.throws(() => loadManifest("kit-example", d), /repeats a key/);
  const dep = readDeployment();
  const pin = payoutPin(m);
  const withVg = (kit: any) => ({ ...dep, vaultGames: { ...dep.vaultGames, 250: { results: m.data.vaultFolder, minPts: 0, ...(kit === undefined ? {} : { kit }) } } });
  assert.throws(() => kitConfig(m, withVg(undefined)), /no "kit" pin/);
  assert.throws(() => kitConfig(m, withVg({ ...pin, payoutRule: "d152" })), /kit is/);
  assert.equal(kitConfig(m, withVg(pin)).payoutRule, m.payoutRule);
  void runGame;
});
