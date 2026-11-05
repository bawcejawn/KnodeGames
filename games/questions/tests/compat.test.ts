// Daily Questions on the kit vs PR #203 (the hand-built recorder it replaces): for the same chain data the vault file
// and board.json are byte-identical, hour by hour; and the kit's generic week tally equals #203's scoreWeek (the
// Questions chat's rules) over thousands of random weeks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run as run203 } from "./pr203/recorder.ts";
import { scoreWeek } from "../math.js";
import { game } from "../recorder.ts";
import { kitConfig, loadManifest } from "../../../kit/recorder/manifest.ts";
import { runGame } from "../../../kit/recorder/runtime.ts";
import { tally } from "../../../kit/publish/check.inline.mjs";
import { fakeNode, rng, world, type World } from "../../../kit/testing/fake-nodes.ts";
import { at, DAY, HOUR } from "../../../kit/testing/fake-clock.ts";
import { sampleWorld } from "./sample.ts";

const cfg = kitConfig(loadManifest("questions"));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "kit-q-"));
const prevDir = (root: string) => { const p = path.join(root, "prev"); fs.mkdirSync(path.join(p, "vault"), { recursive: true }); fs.writeFileSync(path.join(p, ".fetched"), ""); return p; };
const quiet = () => {};

test("questions on the kit: vault file and board.json byte-identical to PR #203, run after run", async () => {
  let t = at(5, 0, 1);
  let decided = false;
  const w = () => { const x = sampleWorld(t); if (decided) x.questions[305].outcome = 1; return x; };
  const r1 = tmp(), r2 = tmp();
  const p1 = prevDir(r1), p2 = prevDir(r2);
  let sawFinal = false;
  for (let i = 0; i < 5; i++) {
    if (i === 1) decided = true;
    const o1 = fs.mkdtempSync(path.join(r1, "o-")), o2 = fs.mkdtempSync(path.join(r2, "o-"));
    await run203({ nodes: [fakeNode("a", w).vault, fakeNode("b", w).vault], prev: p1, out: o1, log: quiet });
    await runGame(game, cfg, { nodes: [fakeNode("a", w), fakeNode("b", w)], prev: p2, out: o2, log: quiet });
    for (const f of ["board.json", "vault/W4.json"]) {
      const a = path.join(o1, f), b = path.join(o2, f);
      // Once final and published, #203 writes nothing more; the kit copies the final forward and re-stamps board.json
      // (same lastWeek, a new `updated`). Every file #203 writes, the kit writes byte for byte.
      if (fs.existsSync(a)) assert.equal(fs.readFileSync(b, "utf8"), fs.readFileSync(a, "utf8"), `hour ${i}: ${f}`);
      else if (sawFinal && f === "board.json") assert.deepEqual(JSON.parse(fs.readFileSync(b, "utf8")).lastWeek, JSON.parse(fs.readFileSync(path.join(p1, f), "utf8")).lastWeek, `hour ${i}: board after final`);
      else assert.ok(!fs.existsSync(b) || f === "vault/W4.json" && sawFinal, `hour ${i}: ${f} written by the kit only`);
      if (f.startsWith("vault") && fs.existsSync(a)) sawFinal = true;
    }
    // Each recorder's next run reads its own last files.
    for (const [o, p] of [[o1, p1], [o2, p2]]) fs.cpSync(o, p, { recursive: true });
    t += HOUR;
  }
  assert.ok(sawFinal, "the week went final in both");
});

/** A random shared-rules week: questions over the days (some unresolved, void, on Sunday), random answers and stakes. */
function randomWorld(seed: number): World {
  const r = rng(seed), wd = world(at(5, 0, 3)), s = at(4);
  const nq = 1 + Math.floor(r() * 12);
  wd.questions[99] = { week: "3", outcome: 1, lock_time: String(s - DAY) };
  for (let i = 0; i < nq; i++) {
    const lock = s + Math.floor(r() * 7 * 24) * HOUR + HOUR;
    const k = r();
    wd.questions[100 + i] = { week: "4", outcome: k < 0.1 ? 0 : k < 0.2 ? 1000 : 1 + Math.floor(r() * 4), lock_time: String(Math.min(lock, s + 7 * DAY)) };
  }
  wd.next = 100 + nq;
  const np = Math.floor(r() * 25);
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  for (let p = 0; p < np; p++) {
    const addr = "1" + Array.from({ length: 33 }, () => alpha[Math.floor(r() * alpha.length)]).join("");
    const answers = [];
    for (let i = 0; i < nq; i++) if (r() < 0.7) answers.push({ question_id: 100 + i, option: Math.floor(r() * 4) });
    if (!answers.length) continue;
    const stakes = ["0", "50000000", "100000000", "300000000", "1000000000"];
    const stake = stakes[Math.floor(r() * stakes.length)];
    const peak = r() < 0.2 ? stakes[Math.floor(r() * stakes.length)] : stake;
    wd.players.push({ address: addr, entry: { stake, peak_stake: peak, voided: r() < 0.08, answers } });
  }
  return wd;
}

test("the kit's generic tally equals #203's scoreWeek over 2,000 random Questions weeks", async () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const wd = randomWorld(seed);
    const root = tmp(), out = path.join(root, "out");
    await runGame(game, cfg, { nodes: [fakeNode("a", () => wd), fakeNode("b", () => wd)], prev: prevDir(root), out, log: quiet });
    const j = JSON.parse(fs.readFileSync(path.join(out, "W004.json"), "utf8"));
    const t = tally(j, cfg);
    const qs = Object.entries(wd.questions).filter(([, q]) => q.week === "4").map(([id, q]) => [Number(id), q.outcome, Number(q.lock_time)]).sort((a: any, b: any) => a[0] - b[0]);
    const ps = wd.players.map((p) => [p.address, p.entry.stake, p.entry.peak_stake, p.entry.voided ? 1 : 0, p.entry.answers.map((a) => [a.question_id, a.option])]).sort((a: any, b: any) => (a[0] < b[0] ? -1 : 1));
    const ref = scoreWeek({ week: { start: at(4) }, questions: qs, players: ps, min: "100000000" });
    const strip = (rows: any[]) => rows.map(({ a, pts, counted, answers, staked, free, ranked, board, place, at, scoreAt }) => ({ a, pts, counted, answers, staked, free, ranked, board, place, at: at ?? scoreAt }));
    assert.deepEqual(strip(t.rows), strip(ref.rows), `seed ${seed}: rows`);
    assert.deepEqual(t.vault, ref.vault, `seed ${seed}: vault`);
    assert.deepEqual(t.prizes, ref.prizes, `seed ${seed}: prizes`);
    assert.equal(t.complete, ref.complete, `seed ${seed}: complete`);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
