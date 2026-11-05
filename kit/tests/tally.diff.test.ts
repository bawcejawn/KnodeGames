// The kit's generic week tally (kit/publish/check.inline.mjs) vs PR #203's scoreWeek (Daily Questions' own rules,
// kit/tests/fixtures/pr203-math.mjs): over 2,000 random weeks run through the kit (the kit-example fixture reads the
// same vault answers), the rows, places, vault file, free winners (D-159) and completeness are identical. This is the
// proof the later port of #203 onto the kit rests on (D-160: scoring not rewritten).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scoreWeek } from "./fixtures/pr203-math.mjs";
import { exampleGame as game, exampleCfg } from "../testing/example/index.ts";
import { runGame } from "../recorder/runtime.ts";
import { tally } from "../publish/check.inline.mjs";
import { fakeNode, rng, world, type World } from "../testing/fake-nodes.ts";
import { at, DAY, HOUR } from "../testing/fake-clock.ts";

const cfg = exampleCfg();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "kit-q-"));
const prevDir = (root: string) => { const p = path.join(root, "prev"); fs.mkdirSync(path.join(p, "vault"), { recursive: true }); fs.writeFileSync(path.join(p, ".fetched"), ""); return p; };
const quiet = () => {};

/** A random shared-rules week: questions over the days (some unresolved, void, on Sunday), random answers and stakes. */
function randomWorld(seed: number): World {
  const r = rng(seed), wd = world(at(5, 0, 3)), s = at(4);
  const crowd = seed % 4 === 0;   // a crowd of free players on few questions: many ties at the 10-a-place cap (D-159)
  const nq = crowd ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 12);
  wd.questions[99] = { week: "3", outcome: 1, lock_time: String(s - DAY) };
  for (let i = 0; i < nq; i++) {
    const lock = s + Math.floor(r() * 7 * 24) * HOUR + HOUR;
    const k = r();
    wd.questions[100 + i] = { week: "4", outcome: k < 0.1 ? 0 : k < 0.2 ? 1000 : 1 + Math.floor(r() * 4), lock_time: String(Math.min(lock, s + 7 * DAY)) };
  }
  wd.next = 100 + nq;
  const np = crowd ? 30 + Math.floor(r() * 20) : Math.floor(r() * 45);
  const alpha = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  for (let p = 0; p < np; p++) {
    const addr = "1" + Array.from({ length: 33 }, () => alpha[Math.floor(r() * alpha.length)]).join("");
    const answers = [];
    for (let i = 0; i < nq; i++) if (r() < 0.7) answers.push({ question_id: 100 + i, option: Math.floor(r() * 4) });
    if (!answers.length) continue;
    const stakes = ["0", "50000000", "100000000", "300000000", "1000000000"];
    const stake = crowd && r() < 0.9 ? "0" : stakes[Math.floor(r() * stakes.length)];
    const peak = r() < 0.2 ? stakes[Math.floor(r() * stakes.length)] : stake;
    wd.players.push({ address: addr, entry: { stake, peak_stake: peak, voided: r() < 0.08, answers } });
  }
  return wd;
}

test("the kit's generic tally equals #203's scoreWeek over 2,000 random weeks (rows, vault file, D-159 free places)", async () => {
  let capped = 0;
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
    if (ref.vault.first.length === 10 || ref.vault.second.length === 10) capped++;
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.ok(capped >= 5, `only ${capped} random weeks reached the 10-a-place cap (D-159)`);
});
