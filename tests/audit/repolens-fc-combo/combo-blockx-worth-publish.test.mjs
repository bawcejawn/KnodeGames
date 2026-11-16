// Combo Card, D-188 (owner, Sun 15 Nov 2026): a Block X leg is worth up to ×6 (race legs ×3). Run through the REAL
// bot/games/combo.ts recorder and the REAL combo.yml publish step: an honest ×6 Block X hit is published, a Block X
// worth of 6.01 and a race worth of 3.01 are held (the recorder never gives either).
// The helper lines below are tests/audit/repolens-fc-combo/repolens-fc3-publish.test.mjs lines 5-115 verbatim.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const APP = process.env.APP || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { run } = await import(path.resolve(APP, "bot/games/combo.ts"));
const M = globalThis.KRaceMath, X = globalThis.KBlockX, C = globalThis.KCombo;
const H1 = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", H2 = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", H3 = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", H4 = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const ALICE = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE";
const W3 = M.weekStart(3), H0 = 48_000_000, D3 = C.utcDay(W3);
const heightAt = (t) => H0 + Math.floor((t - W3) / 3000), timeAt = (h) => W3 + (h - H0) * 3000;
// (Combo fix round: cards carry 12 VHP samples, as the race recorder writes them; RL-8.)
const CARD = (at, extra = {}) => ({ at, c: 0, blocksPerRace: 7200, fairness: null, samples: 12, ...extra,
  field: [{ a: H1, vhp: 4000, k: 600, h: 1 }, { a: H2, vhp: 2000, k: 300, h: 2 }, { a: H3, vhp: 1300, k: 200, h: 3 }, { a: H4, vhp: 700, k: 100, h: 6 }], paddock: [] });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cr-"));
const W = (w) => `W${String(w).padStart(3, "0")}.json`;
function raceDir({ noResult = new Set(), from = 2, to = 5, cardsUntil = Infinity, resultsUntil = Infinity, card = CARD } = {}) {
  const d = tmp();
  for (let w = from; w <= to; w++) {
    const races = [];
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) {
      const i = M.raceIndex(t);
      const result = noResult.has(i) || t + M.RACE > resultsUntil ? null : { final: true, checked: 2, standings: [H1, H2, H3, H4].map((a, k) => ({ a, steps: 100 - k * 10, blocks: 10 })) };
      races.push({ id: M.raceId(i), start: t, end: t + M.RACE, cards: [t + 60000 < cardsUntil ? card(t + 60000) : null, null, null, null, null, null], result });
    }
    fs.writeFileSync(path.join(d, W(w)), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
function blockxDir({ from = 2, to = 5, voids = new Map() } = {}) {
  const d = tmp();
  for (let w = from; w <= to; w++) {
    const targets = [];
    for (let r = Math.ceil(heightAt(M.weekStart(w)) / X.ROUND); X.target(r) < heightAt(M.weekStart(w + 1)); r++) {
      const t = { round: r, height: X.target(r), final: true, checked: 2, signer: r % 2 === 0 ? H1 : H2, time: timeAt(X.target(r)), lockTime: 0, card: null, picks: [] };
      if (voids.has(r)) t.void = voids.get(r);
      targets.push(t);
    }
    fs.writeFileSync(path.join(d, W(w)), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), targets }));
  }
  return d;
}
const headAt = (t) => ({ height: heightAt(t), time: t, lib: heightAt(t) - 60, libTime: t - 180000 });
/** A koilib-like node for headOf(): its own head time (possibly a lie), the true irreversible block. */
function node(trueT, claimed = trueT) {
  const h = headAt(trueT);
  return { async getHeadInfo() { return { last_irreversible_block: String(h.lib), head_block_time: String(claimed), head_topology: { id: "0x00", height: String(h.height) } }; },
    async call(_m, a) { return { block_items: [{ block_height: a.ancestor_start_height, block: { header: { timestamp: String(h.libTime) } } }] }; } };
}
const quiet = async (f) => { const l = console.log; console.log = () => {}; try { return await f(); } finally { console.log = l; } };
const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
const staked = async (_w, who) => new Map(who.map((a) => [a, true]));
// (Combo fix round: one file per UTC day, RL-6.)
const slot0 = (out, day = D3) => read(out, `D${String(day).padStart(5, "0")}.json`).slots.find((s) => s.round === C.slotRound(day, 0)).cards;

/** combo.yml's publish step, verbatim except the remote (a local bare repo). Returns { ok, out }. */
function publish(IN, remote) {
  const y = fs.readFileSync(path.resolve(APP, ".github/workflows/combo.yml"), "utf8").split("\n");
  const i = y.findIndex((l) => l.includes("Push games-data/combo (and nothing else)")), j = y.findIndex((l, k) => k > i && l.trim() === "run: |");
  const body = y.slice(j + 1).map((l) => (l.startsWith("          ") ? l.slice(10) : l)).join("\n").replace(/remote="https:[^\n]*"/, 'remote="$REMOTE"');
  const sh = path.join(tmp(), "p.sh"); fs.writeFileSync(sh, "set -euo pipefail\n" + body);
  try { return { ok: true, out: execFileSync("bash", [sh], { env: { ...process.env, IN, REMOTE: remote, RUNNER_TEMP: tmp() }, cwd: tmp(), stdio: "pipe" }).toString() }; }
  catch (e) { return { ok: false, out: String(e.stdout) + String(e.stderr) }; }
}

// ── D-C additions ──
const { NonCanonicalTransfer } = await import(path.resolve(APP, "bot/games/blockx.ts"));
/** A bare remote whose games-data holds the files of `dir` (combo/...). */
function remoteWith(dir) {
  const T = tmp(), remote = path.join(T, "r.git"); execFileSync("git", ["init", "-q", "--bare", remote]);
  const s = path.join(T, "s"); fs.cpSync(dir, path.join(s, "combo"), { recursive: true });
  const g = (...a) => execFileSync("git", ["-C", s, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
  g("init", "-q"); g("add", "-A"); g("commit", "-qm", "s"); g("push", "-q", remote, "HEAD:refs/heads/games-data");
  return remote;
}
const show = (remote, p) => { try { return execFileSync("git", ["--git-dir", remote, "show", `games-data:${p}`]).toString(); } catch { return null; } };
/** publish() with the job's clock pinned (CHECK_NOW_MS, the hook the workflow's own tests use). */
function publishAt(IN, remote, now) { const o = process.env.CHECK_NOW_MS; process.env.CHECK_NOW_MS = String(now); try { return publish(IN, remote); } finally { if (o === undefined) delete process.env.CHECK_NOW_MS; else process.env.CHECK_NOW_MS = o; } }
const asIncoming = (out) => { const IN = tmp(); fs.cpSync(out, path.join(IN, "combo"), { recursive: true }); return IN; };
const oneCard = (legs, sent = D3 * M.DAY + 3600000) => async (_n, r) => (r === C.slotRound(D3, 0) ? [{ player: ALICE, legs, time: sent, height: heightAt(sent), changes: 0 }] : []);
const mon18 = D3 * 4 + 3;

// ── G-C additions ──
// (forge: repolens-fc2-publish.test.mjs E-C additions, verbatim)
const forge = (dir, day, round) => {   // a bad run: a PENDING card on a fixed slot turned final "hit", worths 300 (who, legs, time, changes kept)
  const f = `D${String(day).padStart(5, "0")}.json`, d = read(dir, f), s = d.slots.find((x) => x.round === round), c = s.cards[0];
  assert.equal(s.fixed, true); assert.equal(c.state, "pending");
  for (const l of c.legs) { l[3] = 300; l[4] = "hit"; }
  Object.assign(c, { state: "final", outcome: "hit", pts: C.pointsFor(c.legs.map((l) => l[3])), settled: c.time + 7 * 3600000 });
  fs.writeFileSync(path.join(dir, f), JSON.stringify(d) + "\n");
  return c;
};
const pad = (d) => String(d).padStart(5, "0");
/** A bare remote with games-data (combo/ + blockx/) AND race-data, as the live repository has: the publish job reads both. */
function remoteFull(comboDir, rd, bx) {
  const T = tmp(), remote = path.join(T, "r.git"); execFileSync("git", ["init", "-q", "--bare", remote]);
  const push = (src, branch) => { const g = (...a) => execFileSync("git", ["-C", src, "-c", "user.name=t", "-c", "user.email=t@t", ...a]); g("init", "-q"); g("add", "-A"); g("commit", "-qm", "s"); g("push", "-q", remote, `HEAD:refs/heads/${branch}`); };
  const s = path.join(T, "g"); fs.cpSync(comboDir, path.join(s, "combo"), { recursive: true }); fs.cpSync(bx, path.join(s, "blockx"), { recursive: true }); push(s, "games-data");
  const r = path.join(T, "r"); fs.cpSync(rd, r, { recursive: true }); push(r, "race-data");
  return remote;
}
/** D-C-5's set-up: race cards every hour (so lock and after cards exist), a card with a WIN leg on H1 (H1 wins mon18) and a
 *  Block X leg on H2 for an odd round (H2 signs odd rounds; a producer once per card, as the publish job requires). */
function bxSetup() {
  const sent = D3 * M.DAY + 3600000, r0 = Math.floor(heightAt(D3 * M.DAY + 20 * 3600000) / X.ROUND), odd = r0 % 2 ? r0 : r0 + 1;
  const legs = [{ code: C.WIN, round: mon18, producer: H1 }, { code: C.BLOCK, round: odd, producer: H2 }];
  const rd = raceDir();
  for (const f of fs.readdirSync(rd)) { const j = read(rd, f); for (const r of j.races) r.cards = [0, 1, 2, 3, 4, 5].map((k) => CARD(r.start + 60000 + k * 3600000)); fs.writeFileSync(path.join(rd, f), JSON.stringify(j)); }
  return { sent, legs, rd, bx: blockxDir(), now: (D3 + 2) * M.DAY + 12 * 3600000 };
}

// ── D-188 additions ──
// H2 holds 100 of 6,100 VHP (1.64%): a Block X leg on it is worth 0.25 ÷ 0.0164 → capped at ×6 (600).
const SMALL = (at, extra = {}) => ({ ...CARD(at, extra), field: [{ a: H1, vhp: 4000, k: 600, h: 1 }, { a: H2, vhp: 100, k: 20, h: 6 }, { a: H3, vhp: 1300, k: 200, h: 3 }, { a: H4, vhp: 700, k: 100, h: 6 }] });
function smallSetup() {
  const s = bxSetup();
  for (const f of fs.readdirSync(s.rd)) { const j = read(s.rd, f); for (const r of j.races) r.cards = [0, 1, 2, 3, 4, 5].map((k) => SMALL(r.start + 60000 + k * 3600000)); fs.writeFileSync(path.join(s.rd, f), JSON.stringify(j)); }
  return s;
}
async function honest() {
  const { sent, legs, rd, bx, now } = smallSetup(), o1 = tmp();
  await quiet(() => run({ p: "p", check: "c", head: headAt(now), out: o1, raceDir: rd, blockxDir: bx, picksContract: "1P", cardsOf: oneCard(legs, sent), stakedOf: staked, vhpMovesOf: async () => 0n }));
  fs.rmSync(path.join(o1, "vault"), { recursive: true, force: true });
  return { o1, rd, bx, now, f: `D${pad(D3)}.json` };
}
const cardIn = (d) => d.slots.find((s) => s.round === C.slotRound(D3, 0)).cards[0];
const pubCard = (remote, f) => { const t = show(remote, `combo/${f}`); return t === null ? null : cardIn(JSON.parse(t)); };

test("D-188: the recorder scores an honest Block X long shot at ×6 and the publish job publishes it", async () => {
  const { o1, rd, bx, now, f } = await honest();
  const c = cardIn(read(o1, f));
  assert.equal(c.state, "final"); assert.equal(c.outcome, "hit");
  assert.equal(c.legs[1][0], C.BLOCK); assert.equal(c.legs[1][3], 600, "×6: above the old ×3 cap");
  assert.ok(c.legs[0][3] <= 300, "the race leg keeps the race cap");
  assert.equal(c.pts, C.pointsFor([c.legs[0][3], 600]));
  const remote = remoteFull(tmp(), rd, bx), p = publishAt(asIncoming(o1), remote, now + 60000);
  const pub = pubCard(remote, f);
  assert.ok(pub, "published: " + p.out.slice(-400));
  assert.equal(pub.state, "final"); assert.equal(pub.legs[1][3], 600);
});

test("D-188: the publish job holds a Block X worth above ×6 and a race worth above ×3 (the recorder gives neither)", async () => {
  const { o1, rd, bx, now, f } = await honest();
  for (const [k, w] of [[1, 601], [0, 301]]) {
    const bad = tmp(); fs.cpSync(o1, bad, { recursive: true });
    const d = read(bad, f), c = cardIn(d);
    c.legs[k][3] = w; c.pts = C.pointsFor(c.legs.map((l) => l[3]));
    fs.writeFileSync(path.join(bad, f), JSON.stringify(d) + "\n");
    const remote = remoteFull(tmp(), rd, bx), p = publishAt(asIncoming(bad), remote, now + 60000);
    assert.equal(pubCard(remote, f), null, `leg ${k} at ${w} is held`);
    assert.match(p.out, /not the recorder's shape/, `leg ${k} at ${w}: held by the shape check`);
  }
});
