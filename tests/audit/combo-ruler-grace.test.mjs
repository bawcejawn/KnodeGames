// Combo Card: a ruled race leg with no ruler card is given up when the Race itself has skipped that race (Repo Lens
// #J-10, J10-2: the Race's own final race-data vault/W<week>.json lists it in "skipped"), never on a clock that only
// predicts the skip; else at Combo's own Vault edge (G51-1) if the race is final. The publish job holds a card given up
// any earlier (J10-4). Before: week end + the Race's RULER_GRACE (48 h) when the R file listed the race with no card
// (#338, owner 15 Nov), which could give up a race the Race later counted (a held Race week, or a late Race run).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const F = await import(path.join(process.env.APP, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { run, M, C, H1, H2, H3, H4, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = F;
const S = await import(path.join(process.env.APP, "bot/games/combo-score.mjs"));
const { RULER_GRACE } = await import(path.join(process.env.APP, "bot/race.ts"));
const YML = fs.readFileSync(path.join(process.env.APP, ".github/workflows/combo.yml"), "utf8");

const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`;
const early = D3 * 4 + 1, rf = D3 * 4 + 3;                 // Mon 06:00 (ruler card published), Mon 18:00 (feed down)
const sent = D3 * M.DAY + 2 * 3600000;
const SKIP_AT = M.weekStart(4) + RULER_GRACE;               // the earliest the Race skips a week-3 race with no ruler card
const cards = (r) => (r === S0 ? [
  { player: ALICE, legs: [{ code: C.SHOW, round: rf, producer: H4 }, { code: C.WIN, round: rf + 1, producer: H3 }], time: sent, height: heightAt(sent), changes: 0 },
  { player: BOB, legs: [{ code: C.WIN, round: early, producer: H1 }, { code: C.SHOW, round: early, producer: H2 }], time: sent, height: heightAt(sent), changes: 0 },
] : []);
const cardText = JSON.stringify({ producers: [[H1, 900], [H2, 800], [H3, 700], [H4, 600]].map(([a, f]) => ({ a, entry: true, void: false, fpct: String(f), signed: 5 })) });
/** The Race's R003.json, ON: ruler cards up to (not including) race `until`; after that "not yet" (vhp-data stopped). */
function rulerUntil(dir, until) {
  const races = [];
  for (let t = M.weekStart(3); t < M.weekStart(4); t += M.RACE) {
    const i = M.raceIndex(t);
    races.push({ id: M.raceId(i), round: "x", window: { W0: 1, W1: 2, L: 2, S0: 3, S1: 4 }, card: i < until ? cardText : null, note: i < until ? null : "not yet: the ruler's data isn't available this run", placings: i < until ? [H1, H2, H3] : [] });
  }
  fs.writeFileSync(path.join(dir, "R003.json"), JSON.stringify({ v: 1, week: 3, rulerFrom: 3, mode: "on", shadow: false, races }));
  return dir;
}
/** The Race's own Vault file for week 3 (race-data vault/W3.json, bot/race.ts VaultFile), or none (null). */
function raceVault(dir, vf) {
  if (vf === null) return dir;
  fs.mkdirSync(path.join(dir, "vault"), { recursive: true });
  fs.writeFileSync(path.join(dir, "vault", "W3.json"), JSON.stringify({ game: 3, week: 3, final: true, rows: [], first: [], second: [], skipped: [], ...vf }));
  return dir;
}
/** Every race of week 3 from race `from` on, by id: what the Race skips when the ruler feed stops at `from`. */
const idsFrom = (from) => { const ids = []; for (let t = M.weekStart(3); t < M.weekStart(4); t += M.RACE) { const i = M.raceIndex(t); if (i >= from) ids.push(M.raceId(i)); } return ids; };
async function aliceAt(at, vf) {
  const out = tmp(), race = raceVault(rulerUntil(raceDir(), rf), vf);
  await quiet(() => run({ p: node({ t: at, cards }), check: node({ t: at, cards }), out, raceDir: race, blockxDir: blockxDir(), picksContract: PICKS, knodeGame: VAULT, now: at, vhpMovesOf: async () => 0n, rulerFrom: 3, raceRulerFrom: 3 })).catch(() => {});
  const cs = read(out, dn(D3)).slots.find((s) => s.round === S0).cards;
  return { out, race, alice: cs.find((c) => c.player === ALICE), bob: cs.find((c) => c.player === BOB), vault: fs.existsSync(path.join(out, "vault", "W3.json")) };
}

test("J10-2: raceSkipped reads the Race's own final Vault file, strictly", () => {
  assert.equal(S.RACE_RULER_GRACE_MS, RULER_GRACE, "the Race's grace, still pinned (the earliest it can skip)");
  assert.equal(S.raceVaultName(3), "vault/W3.json");
  const at = (vf) => { S.clearFiles(); return S.raceSkipped(raceVault(tmp(), vf), rf); };
  assert.equal(at({ skipped: [M.raceId(rf)] }), true);
  assert.equal(at(null), false, "no Vault file yet (the Race's week isn't decided, or its outage)");
  assert.equal(at({ final: false, skipped: [M.raceId(rf)] }), false, "a file not yet final");
  assert.equal(at({ skipped: [] }), false, "final, and the Race counted the race");
  assert.equal(at({ skipped: [M.raceId(rf + 1)] }), false, "another race skipped");
  assert.equal(at({ week: 4, skipped: [M.raceId(rf)] }), false, "a file for another week");
  assert.equal(at({ skipped: M.raceId(rf) }), false, "skipped not a list");
});

test("ruledGiveUp: the Race's skip at once; else Combo's Vault edge if the race is final (a next-week race, a held week)", () => {
  S.clearFiles();
  const none = raceDir(), skip = raceVault(raceDir(), { skipped: [M.raceId(rf)] }), edge = S.comboVaultEdge(D3);
  assert.equal(edge, M.weekStart(4) + S.VAULT_WINDOW_MS - 6 * 3600000);
  assert.equal(S.ruledGiveUp(skip, D3, rf, SKIP_AT), true);
  assert.equal(S.ruledGiveUp(none, D3, rf, SKIP_AT + 3600000), false, "no skip from the Race: it waits");
  assert.equal(S.ruledGiveUp(none, D3, rf, edge - 1), false);
  assert.equal(S.ruledGiveUp(none, D3, rf, edge), true, "the G51-1 edge, the race being final");
  const noResult = raceDir({ noResult: new Set([rf]) });
  assert.equal(S.ruledGiveUp(noResult, D3, rf, edge), false, "not final in the W file: it waits even at the edge (RL-9, J10-1)");
  // A next-week race (a Sunday card's Monday race): the Race decides it with week 4, after Combo's week-3 edge.
  const sunday = C.utcDay(M.weekStart(4) - 3600000), monday = M.raceIndex(M.weekStart(4));
  assert.equal(M.weekOf(sunday * M.DAY), 3); assert.equal(M.weekOf(M.raceStart(monday)), 4);
  assert.equal(S.ruledGiveUp(none, sunday, monday, S.comboVaultEdge(sunday)), true);
  assert.equal(S.ruledGiveUp(none, sunday, monday, S.comboVaultEdge(sunday) - 1), false);
});

test("J10-2: given up in the run that sees the Race's skip; a held Race week (no final Vault file) keeps the card waiting", async () => {
  const skipped = await aliceAt(SKIP_AT + 60000, { skipped: idsFrom(rf) });
  assert.equal(skipped.bob.state, "final", "precondition: BOB's card is decided by published ruler cards");
  assert.notEqual(skipped.alice.state, "pending", `given up with the Race's skip: legs ${JSON.stringify(skipped.alice.legs.map((l) => l[4]))}`);
  assert.ok(skipped.alice.legs.some((l) => l[4] === "unresolved"));
  assert.equal(skipped.bob.outcome, "hit");
  assert.ok(skipped.vault, "week 3's Vault file is written");
  // The Race's week is held (PRIZES_FROM_WEEK unset, an unreadable T file, a stake read, a late run): no final file.
  const held = await aliceAt(SKIP_AT + 60000, null);
  assert.equal(held.alice.state, "pending", "the clock alone never gives it up: the Race may still count it");
  // The Race's week is final and counted the race (its ruler card landed while it was held): Combo waits for the card.
  const counted = await aliceAt(SKIP_AT + 60000, { final: true, skipped: [] });
  assert.equal(counted.alice.state, "pending");
});

test("G51-1 still holds: with no skip from the Race, the card is given up 6 h before its week's Vault window closes", async () => {
  const before = await aliceAt(S.comboVaultEdge(D3) - 60000, null);
  assert.equal(before.alice.state, "pending");
  const after = await aliceAt(S.comboVaultEdge(D3) + 60000, null);
  assert.notEqual(after.alice.state, "pending");
  assert.ok(after.alice.legs.some((l) => l[4] === "unresolved"));
  assert.ok(after.vault, "week 3's Vault file is written, 6 h before its window closes");
});

// ── the publish job (J10-4) ──
/** combo.yml's publish step, verbatim except the remote (a local bare repo); as combo-ruler.test.mjs. */
function publish(IN, remote, now) {
  const y = YML.split("\n");
  const i = y.findIndex((l) => l.includes("Push games-data/combo (and nothing else)")), j = y.findIndex((l, k) => k > i && l.trim() === "run: |");
  const body = y.slice(j + 1).map((l) => (l.startsWith("          ") ? l.slice(10) : l)).join("\n").replace(/remote="https:[^\n]*"/, 'remote="$REMOTE"');
  const sh = path.join(tmp(), "p.sh"); fs.writeFileSync(sh, "set -euo pipefail\n" + body);
  try { return { ok: true, out: execFileSync("bash", [sh], { env: { ...process.env, IN, REMOTE: remote, RUNNER_TEMP: tmp(), CHECK_NOW_MS: String(now), RACE_RULER_FROM_WEEK: "3", COMBO_RULER_FROM_WEEK: "3" }, cwd: tmp(), stdio: "pipe" }).toString() }; }
  catch (e) { return { ok: false, out: String(e.stdout) + String(e.stderr) }; }
}
function remoteWith(race) {
  const T = tmp(), remote = path.join(T, "r.git"); execFileSync("git", ["init", "-q", "--bare", remote]);
  const g = (s, ...a) => execFileSync("git", ["-C", s, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
  const s = path.join(T, "s"); fs.mkdirSync(s); fs.writeFileSync(path.join(s, "x"), "");
  g(s, "init", "-q"); g(s, "add", "-A"); g(s, "commit", "-qm", "s"); g(s, "push", "-q", remote, "HEAD:refs/heads/games-data");
  const r = path.join(T, "race"); fs.cpSync(race, r, { recursive: true });
  g(r, "init", "-q"); g(r, "add", "-A"); g(r, "commit", "-qm", "r"); g(r, "push", "-q", remote, "HEAD:refs/heads/race-data");
  return remote;
}
const asIncoming = (out) => { const IN = tmp(); fs.cpSync(out, path.join(IN, "combo"), { recursive: true }); return IN; };
const pubAlice = (remote) => {
  let t = null; try { t = execFileSync("git", ["--git-dir", remote, "show", `games-data:combo/${dn(D3)}`]).toString(); } catch { return null; }
  return JSON.parse(t).slots.find((s) => s.round === S0).cards.find((c) => c.player === ALICE);
};

test("J10-4: the publish job takes a card given up on the Race's skip, and holds one given up without it", async () => {
  const at = SKIP_AT + 60000;
  const ok = await aliceAt(at, { skipped: idsFrom(rf) });
  assert.equal(ok.alice.state, "final");
  // The Race's skip file goes to race-data with its results: published.
  const r1 = remoteWith(ok.race), a = publish(asIncoming(ok.out), r1, at + 60000);
  const pub = pubAlice(r1);
  assert.ok(pub && pub.state === "final", "published: " + a.out.slice(-600));
  // The same files, but race-data has no skip from the Race (a bad recorder run gave it up on the clock): held.
  const noSkip = tmp(); fs.cpSync(ok.race, noSkip, { recursive: true }); fs.rmSync(path.join(noSkip, "vault"), { recursive: true, force: true });
  const r2 = remoteWith(noSkip), b = publish(asIncoming(ok.out), r2, at + 60000);
  const held = pubAlice(r2);
  assert.ok(held === null || held.state !== "final", "held: " + b.out.slice(-600));
  assert.match(b.out, /unresolved, but its sources give it a result \(pending\)/);
  // At Combo's Vault edge the publish job takes it without a skip (G51-1), the race being final.
  const late = S.comboVaultEdge(D3) + 60000, c2 = await aliceAt(late, null);
  assert.equal(c2.alice.state, "final");
  const r3 = remoteWith(c2.race); publish(asIncoming(c2.out), r3, late + 60000);
  assert.equal(pubAlice(r3)?.state, "final");
});

test("J10-2: the record, verify and publish jobs each copy the Race's own Vault files (race-data vault/W<week>.json)", () => {
  const into = [...YML.matchAll(/git ls-tree --name-only FETCH_HEAD:vault [^\n]*\n[^\n]*\^W\[0-9\]\+\\\.json\$[^\n]*git show "FETCH_HEAD:vault\/\$f" > "\$(RUNNER_TEMP\/race|PUB\/race)\/vault\/\$f"/g)].map((m) => m[1]);
  assert.deepEqual(into, ["RUNNER_TEMP/race", "RUNNER_TEMP/race", "PUB/race"], "record, verify, publish");
  // Only W<week>.json is taken (not the Race's PENDING-W files): the same strict name rule as every other copy.
  assert.ok(!/FETCH_HEAD:vault\/\$f" > [^\n]*PENDING/.test(YML));
});
