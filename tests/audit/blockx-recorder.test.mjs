// Who Signs Block X recorder (bot/games/blockx.ts): targets recorded only once irreversible and matching on two nodes,
// picks agreeing on both nodes, points from the race card in force at the lock, void when no card ever comes, the
// leaderboards and the week's prizes after the 12-hour correction window. Offline: fake nodes and fake race files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP || ".";
const { run, vaultFile, releaseCode, releaseMatches } = await import(path.resolve(APP, "bot/games/blockx.ts"));
const M = globalThis.KRaceMath, X = globalThis.KBlockX;
const plain = (x) => JSON.parse(JSON.stringify(x));

const BIG = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", MID = "1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", SMALL = "1CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const ALICE = "1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", BOB = "1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE", GUEST = "1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

// Week 3 (Mon 2 Nov 2026). A made-up chain: block h at time T(h); every target is signed by BIG except every third (MID).
const W3 = M.weekStart(3);
const H0 = 48_000_000;                          // a height at W3 + 1 h
const T = (h) => W3 + 3600000 + (h - H0) * 3000;
const signerOf = (h) => (h % X.ROUND === 0 && (h / X.ROUND) % 3 === 0 ? MID : BIG);
function blockOf(tamperAt = null) {
  return async (node, h) => ({ signer: node === "check" && tamperAt === h ? SMALL : signerOf(h), time: T(h) });
}
// Picks: Alice always picks MID, Bob always BIG, the guest SMALL. Times spread over 3 days.
function picksOf(tamperRound = null) {
  return async (node, r) => {
    const t = T(r * X.ROUND) - 3600000;
    const rows = [{ player: ALICE, producer: MID, time: t }, { player: BOB, producer: BIG, time: t }, { player: GUEST, producer: SMALL, time: t }];
    if (node === "check" && r === tamperRound) rows[0].producer = BIG;
    return rows;
  };
}
const rankedOf = async (who) => new Set(who.filter((a) => a !== GUEST));
const CARD = { at: 0, c: 1, blocksPerRace: 7200, fairness: null, field: [{ a: BIG, vhp: 2000, k: 600, h: 1 }, { a: MID, vhp: 1000, k: 300, h: 2 }], paddock: [{ a: SMALL, vhp: 10, k: 3 }] };
function raceDir({ withCards = true, weeks = [2, 3, 4] } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "race-"));
  for (const w of weeks) {
    const races = [];
    // Each hourly card stamped with the time the race recorder took it (37 minutes into its hour), as on mainnet.
    for (let t = M.weekStart(w); t < M.weekStart(w + 1); t += M.RACE) { const i = M.raceIndex(t); races.push({ id: M.raceId(i), start: t, end: t + M.RACE, cards: Array.from({ length: 6 }, (_, l) => (withCards ? { ...CARD, samples: 36, at: t + l * 3600000 + 37 * 60000 } : null)), result: null }); }
    fs.writeFileSync(path.join(d, `W${String(w).padStart(3, "0")}.json`), JSON.stringify({ v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), races }));
  }
  return d;
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "blockx-"));
const quiet = async (f) => { const log = console.log; console.log = () => {}; try { return await f(); } finally { console.log = log; } };

test("records irreversible targets with picks and capped points from the card at the lock", async () => {
  const out = tmp(), lib = H0 + 10 * X.ROUND + 50;
  const r = await quiet(() => run({ p: "main", check: "check", out, raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf,
    head: { height: lib + 60, time: T(lib + 60), lib } }));
  assert.deepEqual(r.problems, []);
  const wf = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
  const rounds = wf.targets.map((t) => t.round);
  assert.ok(rounds.includes(H0 / X.ROUND + 10) && !rounds.includes(H0 / X.ROUND + 11), "only irreversible targets");
  for (const t of wf.targets) {
    assert.equal(t.height % X.ROUND, 0); assert.equal(t.checked, 2); assert.equal(t.lockTime, T(t.height - 100));
    const byPlayer = Object.fromEntries(t.picks.map((p) => [p[0], p]));
    if (t.signer === MID) { assert.equal(byPlayer[ALICE][3], 200); assert.equal(byPlayer[BOB][3], 0); }
    else { assert.equal(byPlayer[BOB][3], 100); assert.equal(byPlayer[ALICE][3], 0); }
    assert.equal(byPlayer[GUEST][3], 0); assert.equal(byPlayer[GUEST][4], 0, "guest not ranked");
  }
  const board = JSON.parse(fs.readFileSync(path.join(out, "board.json"), "utf8"));
  assert.equal(board.week.week, 3);
  assert.ok(board.week.rows.length === 3 && board.week.rows.every((x) => typeof x.pts === "number"));
});

test("not recorded when the two nodes disagree about the block or the picks", async () => {
  const lib = H0 + 3 * X.ROUND + 50, badH = H0 + 2 * X.ROUND;
  const r1 = await quiet(() => run({ p: "main", check: "check", out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(badH), picksOf: picksOf(), rankedOf, head: { height: lib, time: T(lib), lib } }));
  assert.ok(r1.problems.some((p) => p.includes(`block ${badH}`) && p.includes("disagree")));
  const r2 = await quiet(() => run({ p: "main", check: "check", out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(badH / X.ROUND), rankedOf, head: { height: lib, time: T(lib), lib } }));
  assert.ok(r2.problems.some((p) => p.includes("picks") && p.includes("disagree")));
  const wf = r2.weeks.get(3);
  assert.ok(!wf.targets.some((t) => t.round === badH / X.ROUND));
});

const head0 = (lib) => T(lib);
test("no race card: waits, and a target older than 3 days is recorded void with no points", async () => {
  const lib = H0 + 3 * X.ROUND + 50;
  const r = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: raceDir({ withCards: false }), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: lib, time: T(lib), lib } }));
  assert.ok(r.problems.some((p) => p.includes("no handicap card yet")));
  // Audit BX-48: a lock more than 3 hours ago can never get a card (cards are only made going forward): void now.
  const recorded = r.weeks.get(3)?.targets || [];
  assert.ok(recorded.every((t) => t.void && head0(lib) - t.lockTime > 3 * 3600000), "only old locks are voided; recent ones wait");
  // 3 days later the old ones are void
  const later = lib + 3 * 28800 - X.ROUND;
  const r2 = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: raceDir({ withCards: false }), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: later, time: T(later), lib: later } }));
  const all = [...r2.weeks.values()].flatMap((w) => w.targets);
  const voided = all.filter((t) => t.void);
  assert.ok(voided.length >= 1 && voided.every((t) => t.picks.every((p) => p[3] === 0)));
});

/** Record the whole of week 3, then one run from Monday of week 4 at `hoursAfter`. */
async function weekThenLook(picks, hoursAfter, extra = {}) {
  const rd = raceDir();
  let prev;
  const startH = H0 - Math.floor(3600000 / 3000), endH = startH + 7 * 28800;   // W3 00:00, W4 00:00
  for (let lib = startH + 12 * X.ROUND; lib < endH; lib += 12 * X.ROUND) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: null, prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picks, rankedOf, head: { height: lib, time: T(lib), lib }, ...extra }));
    prev = o;
  }
  const at = endH + hoursAfter * 1200;
  return quiet(() => run({ p: "main", check: null, prev, out: tmp(), raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picks, rankedOf, head: { height: at, time: T(at), lib: at - 60 }, ...extra }));
}
// Here the guest (Free play) picks the signer every time; Bob (Staked) always picks BIG.
const picksGuest = async (node, r) => { const t = T(r * X.ROUND) - 3600000 * (1 + (r % 3)); return [{ player: GUEST, producer: signerOf(r * X.ROUND), time: t }, { player: BOB, producer: BIG, time: t }]; };

test("no prizes are listed until PRIZES_FROM_WEEK (prizes start with the vault, owner 2026-10-28)", async () => {
  const r = await weekThenLook(picksGuest, 13);
  assert.equal(r.board.lastWeek.final, true);
  assert.deepEqual(r.board.lastWeek.prizes, [], "no prize week set: nothing listed, nothing owed");
  const later = await weekThenLook(picksGuest, 13, { prizesFromWeek: 4 });
  assert.deepEqual(later.board.lastWeek.prizes, [], "week 3 is before the first prize week 4");
});

test("PRIZES_FROM_WEEK unset on mainnet: the week is held and the run fails (owner 10 Nov), never final with no prizes", async () => {
  // Mainnet passes prizesUnset (the raw variable) when it is unset or bad: the week that could go final is held instead.
  const r = await weekThenLook(picksGuest, 1.5, { prizesFromWeek: null, prizesUnset: '""' });
  assert.equal(r.board.lastWeek.week, 3);
  assert.equal(r.board.lastWeek.final, false, "held, not final");
  assert.deepEqual(r.board.lastWeek.prizes, []);
  assert.equal(r.held.length, 1, "a hold makes the workflow fail (the owner is emailed)");
  assert.match(r.held[0], /PRIZES_FROM_WEEK is not set to a plain week number \(it reads ""\)/);
  // Once the variable is set the same week goes final by itself (the tests' default, prizesUnset unset, is unchanged).
  const ok = await weekThenLook(picksGuest, 1.5, { prizesFromWeek: 3 });
  assert.equal(ok.board.lastWeek.final, true);
  assert.equal(ok.held.length, 0);
  // main() wires it: the raw value goes in only when prizesFromEnv rejects it.
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /const prizesUnset = prizesFromWeek === null \? JSON\.stringify\(E\.PRIZES_FROM_WEEK \?\? null\) : null;/);
  assert.match(src, /prizesFromWeek, prizesUnset, schedule: X\.MAINNET_SCHEDULE/);
});

test("prizes, from the first prize week: final from Monday 00:00 once two runs an hour apart agree (D-135), only the Free play board's top 2", async () => {
  const early = await weekThenLook(picksGuest, -1, { prizesFromWeek: 3 });
  assert.equal(early.board.lastWeek.week, 2, "Sunday 23:00: week 3 isn't last week yet, so it can't be final");
  assert.equal(early.board.week.week, 3);
  assert.deepEqual(early.board.lastWeek.prizes, []);
  const late = await weekThenLook(picksGuest, 1.5, { prizesFromWeek: 3 });
  assert.equal(late.board.lastWeek.final, true, "Monday 01:30: the run at 00:00 read the same week");
  // Player rule (owner, 2026-10-28): Bob is staked in Block X (the Staked board, the game's bucket), so only the
  // free players play for the prize: the guest, right every time, takes 1st (2 VHP); nobody free is 2nd.
  assert.deepEqual(plain(late.board.lastWeek.prizes).map((x) => [x.player, x.vhp]), [[GUEST, 2]]);
  const rows = late.board.lastWeek.rows;
  assert.equal(rows.find((x) => x.a === GUEST).ranked, false, "Free play board");
  assert.equal(rows.find((x) => x.a === BOB).ranked, true, "Staked board");
});

test("the Free play prize needs picks on 3 different days and at least one point", async () => {
  // Two free wallets: CAROL is right but picks on one day only; DAVE picks on 3 days.
  const CAROL = "1GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", DAVE = "1HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH";
  const picks = async (node, r) => {
    const h = r * X.ROUND, t = T(h);
    return [{ player: CAROL, producer: signerOf(h), time: M.weekStart(3) + 1000 }, { player: DAVE, producer: signerOf(h), time: t - 3600000 }];
  };
  const r = await weekThenLook(picks, 13, { prizesFromWeek: 0, rankedOf: async () => new Set() });   // both Free play
  const pz = plain(r.board.lastWeek.prizes).map((x) => x.player);
  assert.ok(pz.includes(DAVE) && !pz.includes(CAROL), "one-day wallet can't win");
});

// ── the testnet way: its own hourly cards, a fast game, its own config ──
test("testnet: the recorder takes its own hourly card (no Producer Race there); only locks after a card are scored with it", async () => {
  const FAST = { id: 92, round: 300, offset: 0, lead: 100, ahead: 3700, picksPerDay: 50, maxChanges: 5 };
  const lib = H0 + 10 * 300 + 50;
  const signersOf = async () => ({ signers: [BIG, MID, SMALL], first: T(lib - 7199), last: T(lib), n: 7200 });
  const vhpOf = async () => ({ [BIG]: "200000000000", [MID]: "100000000000", [SMALL]: "1000000000" });
  const fastPicks = async (node, r) => [{ player: ALICE, producer: MID, time: T(r * 300) - 600000 }];
  // First run: the first card is taken now; every target recorded so far locked before it, so none can be scored.
  const out = tmp();
  const r1 = await quiet(() => run({ p: "main", check: null, out, game: FAST, cards: "self", picksContract: "1P", blockOf: blockOf(), picksOf: fastPicks, rankedOf, signersOf, vhpOf,
    head: { height: lib + 60, time: T(lib + 60), lib } }));
  assert.equal(r1.cards.length, 1, "one card taken this hour");
  const cards = JSON.parse(fs.readFileSync(path.join(out, "cards.json"), "utf8"));
  assert.equal(cards.v, 1); assert.equal(cards.cards.length, 1);
  assert.equal(cards.startHeight, lib + 60, "it remembers where it started");
  const w1 = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
  assert.equal(w1.game, 92);
  assert.ok(w1.targets.every((t) => t.height % 300 === 0 && t.lockTime === T(t.height - 100)));
  assert.ok(w1.targets.every((t) => t.void && !t.card), "audit BX-3: a lock before the first card is never scored with a later card");
  // A second run 90 minutes later: targets whose lock came after the first card are scored with that card.
  const lib2 = lib + 1800;
  const out2 = tmp();
  await quiet(() => run({ p: "main", check: null, prev: out, out: out2, game: FAST, cards: "self", picksContract: "1P", blockOf: blockOf(), picksOf: fastPicks, rankedOf, signersOf, vhpOf,
    head: { height: lib2 + 60, time: T(lib2 + 60), lib: lib2 } }));
  const w2 = JSON.parse(fs.readFileSync(path.join(out2, "W003.json"), "utf8"));
  const scored = w2.targets.filter((t) => !t.void);
  assert.ok(scored.length >= 1, "targets locked after the first card are scored");
  assert.ok(scored.every((t) => t.card && t.card.at <= t.lockTime), "every card used was taken at or before its lock");
  const t = scored.find((x) => x.signer === MID);
  if (t) assert.equal(t.picks[0][3], 200, "MID has half the top's VHP: ×2");
});

test("testnet: testnet/blockx.json is a valid config the Picks contract would accept", async () => {
  const { readNetConfig } = await import(path.resolve(APP, "bot/games/blockx.ts"));
  const c = readNetConfig(path.resolve(APP, "testnet/blockx.json"));
  assert.equal(c.network, "koinos-foundation-testnet");
  assert.equal(c.rpc, "https://testnet.koinosfoundation.org");
  assert.notEqual(c.chainId, "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==");
  assert.ok(c.games.some((g) => g.id === 2 && g.round === 2400 && g.lead === 100 && g.ahead === 28900), "game 2 with the real mainnet settings");
  for (const g of c.games) { const G = X.forGame(g); assert.equal(G.openRounds(48_000_000).length, 12, `game ${g.id}: 12 targets open`); assert.ok(g.id < 128); }
  assert.match(c.data, /^https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/testnet-data\/$/, "its own data branch, never games-data");
});

// ── the testnet workflow (.github/workflows/games-testnet.yml): its publish check takes the recorder's real output ──
import { execFileSync, spawnSync } from "node:child_process";
test("testnet workflow: publishes only to testnet-data, off by default, and its shape check takes the real output", async () => {
  const wf = fs.readFileSync(path.resolve(APP, ".github/workflows/games-testnet.yml"), "utf8");
  assert.match(wf, /vars\.TESTNET_GAMES_ENABLED == 'true'/, "off until the owner turns it on");
  assert.ok(!/secrets\./.test(wf), "no secrets");
  const pushes = [...wf.matchAll(/git push[^\n]*/g)].map((m) => m[0]);
  assert.deepEqual(pushes, ['git push -q "$remote" "$commit:refs/heads/testnet-data"'], "it pushes testnet-data and nothing else");
  assert.ok(!/games-data|race-data|refs\/heads\/main"/.test(wf.replace(/never main, never games-data/g, "")), "never names a mainnet branch");
  assert.match(wf, /--testnet --game/);
  // The shape check, exactly as the workflow runs it.
  // The Python exactly as the runner gets it: YAML parsed, then the heredoc body of the publish step (review #1).
  const runs = JSON.parse(execFileSync("python3", ["-c", "import yaml,json,sys; w=yaml.safe_load(open(sys.argv[1])); print(json.dumps([s.get('run','') for j in w['jobs'].values() for s in j['steps']]))", path.resolve(APP, ".github/workflows/games-testnet.yml")], { encoding: "utf8" }));
  const sh = runs.find((r) => r.includes("<<'PY'"));
  const py = sh.slice(sh.indexOf("<<'PY'\n") + 7, sh.indexOf("\nPY\n") + 1);
  assert.ok(py.length > 500 && /^import json/.test(py), "the heredoc body, with the shell's own indentation removed");
  const FAST = { id: 92, round: 300, offset: 0, lead: 100, ahead: 3700, picksPerDay: 50, maxChanges: 5 };
  const lib = H0 + 10 * 300 + 50;
  const signersOf = async () => ({ signers: [BIG, MID, SMALL], first: T(lib - 7199), last: T(lib), n: 7200 });
  const vhpOf = async () => ({ [BIG]: "200000000000", [MID]: "100000000000", [SMALL]: "1000000000" });
  const fastPicks = async (node, r) => [{ player: ALICE, producer: MID, time: T(r * 300) - 600000 }];
  const out = tmp();
  await quiet(() => run({ p: "main", check: null, out, game: FAST, cards: "self", picksContract: "1" + "P".repeat(33), blockOf: blockOf(), picksOf: fastPicks, rankedOf, signersOf, vhpOf,
    head: { height: lib + 60, time: T(lib + 60), lib } }));
  // (Round 5 review: the check also needs the game's round size and offset, and a clock for the new-target rule.)
  const check = (dir, id) => spawnSync("python3", ["-I", "-", dir, String(id), "", "", `blockx-${id}`, "300", "0"], { input: py, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(T(lib + 60)) } });
  const ok = check(out, 92);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /testnet games files ok/);
  assert.notEqual(check(out, 2).status, 0, "files for game 92 can't be published as game 2");
  const bad = tmp(); fs.cpSync(out, bad, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(bad, "cards.json"), "utf8")); c.cards[0].field[0].a = "<script>"; fs.writeFileSync(path.join(bad, "cards.json"), JSON.stringify(c));
  assert.notEqual(check(bad, 92).status, 0, "a card with a bad address is refused");
  void execFileSync;
});

test("every workflow's embedded Python compiles exactly as the runner gets it", () => {
  const out = execFileSync("python3", ["-c", `
import yaml, sys, glob, re
n = 0
for f in sorted(glob.glob(sys.argv[1] + "/.github/workflows/*.yml")):
    w = yaml.safe_load(open(f))
    for j in w["jobs"].values():
        for st in j.get("steps", []):
            r = st.get("run", "")
            for m in re.finditer(r"<<'PY'\\n(.*?)\\n[ ]*PY\\n", r, re.S):
                body = m.group(1)
                # inside a loop the shell keeps the heredoc lines as written; python must still compile them
                compile(body + "\\n", f, "exec"); n += 1
print(n)`, path.resolve(APP)], { encoding: "utf8" });
  assert.ok(Number(out) >= 2, `compiled ${out.trim()} blocks`);
});

// ── audit fixes (Repo Lens, 2026-10-28) ──
test("BX-4: Staked status is read on both nodes, and a disagreement holds the target", async () => {
  const lib = H0 + 2 * X.ROUND + 50, asked = [];
  const lying = async (who, node) => { asked.push(node); return node === "main" ? new Set() : new Set(who.filter((a) => a !== GUEST)); };
  const r = await quiet(() => run({ p: "main", check: "check", out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf: lying,
    head: { height: lib, time: T(lib), lib } }));
  assert.ok(asked.includes("main") && asked.includes("check"), "both nodes asked");
  assert.ok(r.problems.some((p) => /disagree about which players are Staked/.test(p)));
  const ts = [...r.weeks.values()].flatMap((w) => w.targets);
  assert.ok(ts.every((t) => t.void && !t.picks.length), "nothing scored while they disagree (targets past the 3-day window are voided, BX-16)");
  assert.ok(ts.every((t) => /disagreed about Staked/.test(t.void)));
});
test("BX-3: a card taken after the lock is never used for it; a signer missing from the card scores ×1", async () => {
  const lib = H0 + 4 * X.ROUND + 50;
  const r = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf,
    head: { height: lib, time: T(lib), lib } }));
  const ts = [...r.weeks.values()].flatMap((w) => w.targets).filter((t) => t.card);
  assert.ok(ts.length > 0);
  for (const t of ts) assert.ok(t.card.at <= t.lockTime, `card at ${t.card.at} after lock ${t.lockTime}`);
  const FRESH = "1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ";
  const r2 = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: raceDir(), picksContract: "1P",
    blockOf: async (_n, h) => ({ signer: FRESH, time: T(h) }), picksOf: async () => [{ player: ALICE, producer: FRESH, time: T(H0) }], rankedOf,
    head: { height: lib, time: T(lib), lib } }));
  const pts = [...r2.weeks.values()].flatMap((w) => w.targets).flatMap((t) => t.picks).map((p) => p[3]);
  assert.ok(pts.length && pts.every((x) => x <= 100), `fresh signer scored ${pts}`);
});
test("BX-5: last week is not final while its last target is unrecorded; it is once that target is in", async () => {
  const startH = H0 - Math.floor(3600000 / 3000), endH = startH + 7 * 28800;
  const lastTarget = Math.floor((endH - 28800 - 1) / X.ROUND) * X.ROUND;   // Saturday's last (Sunday targets are fun rounds, D-129)
  const down = async (node, h) => { if (h === lastTarget || h === lastTarget - X.ROUND / 24) throw new Error("node down"); return { signer: signerOf(h), time: T(h) }; };
  const missing = await weekThenLook(picksGuest, 13, { blockOf: down, prizesFromWeek: 0 });
  assert.equal(missing.board.lastWeek.final, false, "final with its last target missing");
  assert.deepEqual(missing.board.lastWeek.prizes, []);
  const ok = await weekThenLook(picksGuest, 13, { prizesFromWeek: 0 });
  assert.equal(ok.board.lastWeek.final, true);
});
test("BX-5: the week-final check catches a missing last target in the phase the old 3-hour rule missed", async () => {
  const { targetsCover } = await import(path.resolve(APP, "bot/games/blockx.ts"));
  const H = 3600000, from = M.weekStart(3), to = M.weekStart(4);
  // targets every 2 h, the last one of the week 30 min before its end (round 84), the next one 1.5 h into next week
  const tgt = (round, time) => ({ round, height: round * 2400, final: true, checked: 2, signer: BIG, time, lockTime: time - 300000, card: null, picks: [] });
  const week = (rounds) => ({ v: 1, week: 3, start: from, end: to, targets: rounds.map((r) => tgt(r, from + (r - 1) * 2 * H + 1.5 * H)) });
  const all = (w, next) => new Map([[3, w], [4, { v: 1, week: 4, start: to, end: to + 7 * 24 * H, targets: next }]]);
  const rounds = Array.from({ length: 84 }, (_, i) => i + 1);           // round 84 at to − 0.5 h
  const full = week(rounds), nextFirst = [tgt(85, to + 1.5 * H)];
  assert.equal(targetsCover(full, from, to, all(full, nextFirst)), true);
  const lastMissing = week(rounds.slice(0, -1));                           // round 83 at to − 2.5 h: the old rule said "complete"
  assert.equal(targetsCover(lastMissing, from, to, all(lastMissing, nextFirst)), false, "a missing last target");
  assert.equal(targetsCover(full, from, to, all(full, [])), false, "the next week's first target not recorded yet");
  const gap = week(rounds.filter((r) => r !== 40));
  assert.equal(targetsCover(gap, from, to, all(gap, nextFirst)), false, "a gap");
});

test("BX-16: a target that keeps failing is voided with its reason at the edge of the 3-day window", async () => {
  const lib = H0 + 2 * X.ROUND + 50;
  const r = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: async () => { throw new Error("node keeps failing"); },
    picksOf: picksOf(), rankedOf, head: { height: lib, time: T(lib), lib } }));
  const ts = [...r.weeks.values()].flatMap((w) => w.targets);
  assert.ok(ts.length > 0 && ts.every((t) => /could not be recorded within 3 days: node keeps failing/.test(t.void)));
  assert.ok(ts.every((t) => t.height < lib - 3 * 28800 + X.ROUND), "only targets at the edge of the window, not recent ones");
});
test("BX-15: a wallet's board is fixed by its first pick of the period (a later 1 VHP can't push it onto Staked)", async () => {
  // Alice picks Free play at first; later targets record her as Staked (someone sent her 1 VHP).
  const lib = H0 + 4 * X.ROUND + 50;
  let current = 0;
  const lastTwo = Math.floor(lib / X.ROUND) - 1;
  const flip = async (who) => (current >= lastTwo ? new Set(who) : new Set());   // only the newest targets see her as Staked
  const r = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(),
    picksOf: async (node, rd) => { current = rd; return [{ player: ALICE, producer: MID, time: T(rd * X.ROUND) - 3600000 }]; }, rankedOf: flip, head: { height: lib, time: T(lib), lib } }));
  const ts = [...r.weeks.values()].flatMap((w) => w.targets).filter((t) => !t.void);
  assert.ok(ts.some((t) => t.picks[0][4] === 1) && ts.some((t) => t.picks[0][4] === 0), "both kinds of rows were recorded");
  const all = r.board.allTime.rows.find((x) => x.a === ALICE);
  assert.equal(all.ranked, false, "still on the Free play board");
});
test("BX-18 / BX-17 / BX-33: picks are read until an empty page; final needs both nodes; pick days outside the week don't count", () => {
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /if \(!rows\.length\) break;/);
  assert.ok(!/rows\.length < 100\) break/.test(src));
  assert.match(src, /if \(ch\.lib < head\.lib\) head\.lib = ch\.lib;/);
  assert.match(src, /pickTime >= from && pickTime < to \? pickTime : NaN/);
  assert.match(src, /on chain has round/);
});
test("BX-5 / BX-23: a final week's prizes are frozen once (P###.json); the mainnet publish check takes the real output, exact shapes only", async () => {
  const runs = JSON.parse(execFileSync("python3", ["-c", "import yaml,json,sys; w=yaml.safe_load(open(sys.argv[1])); print(json.dumps([s.get('run','') for j in w['jobs'].values() for s in j['steps']]))", path.resolve(APP, ".github/workflows/games.yml")], { encoding: "utf8" }));
  const sh = runs.find((r) => r.includes("<<'PY'"));
  const py = sh.slice(sh.indexOf("<<'PY'\n") + 7, sh.indexOf("\nPY\n") + 1);
  // Round 4 (audit BX-79/80): prize and vault files are judged against the PUBLISHED branch and the job's clock. Here the
  // published copy is the honest run's own board and prize file (as after the run before), and the clock is its head time.
  let pubDir = "", nowMs = 0;
  const check = (dir) => spawnSync("python3", ["-I", "-", dir, "2", pubDir, "", "blockx", "2400", "0"], { input: py, encoding: "utf8", env: { ...process.env, CHECK_NOW_MS: String(nowMs) } });
  const VALID = "1" + "P".repeat(33);
  const rd = raceDir();
  const startH = H0 - Math.floor(3600000 / 3000), endH = startH + 7 * 28800;
  let prev;
  for (let lib = startH + 12 * X.ROUND; lib < endH; lib += 12 * X.ROUND) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: null, prev, out: o, raceDir: rd, picksContract: VALID, blockOf: blockOf(), picksOf: picksGuest, rankedOf, prizesFromWeek: 0, head: { height: lib, time: T(lib), lib } }));
    prev = o;
  }
  const at = endH + 13 * 1200, out = tmp();
  const r = await quiet(() => run({ p: "main", check: null, prev, out, raceDir: rd, picksContract: VALID, blockOf: blockOf(), picksOf: picksGuest, rankedOf, prizesFromWeek: 0, head: { height: at, time: T(at), lib: at - 60 } }));
  assert.equal(r.board.lastWeek.final, true);
  assert.ok(fs.existsSync(path.join(out, "P003.json")), "the final week's prizes are frozen");
  const frozen = JSON.parse(fs.readFileSync(path.join(out, "P003.json"), "utf8"));
  assert.deepEqual(frozen.prizes, r.board.lastWeek.prizes);
  pubDir = tmp(); fs.copyFileSync(path.join(out, "board.json"), path.join(pubDir, "board.json")); fs.copyFileSync(path.join(out, "P003.json"), path.join(pubDir, "P003.json"));
  // (Round 6, BX-98: the published branch also holds the week files the run before published.)
  for (const f of fs.readdirSync(out)) if (/^(W\d{3}|index)\.json$/.test(f)) fs.copyFileSync(path.join(out, f), path.join(pubDir, f));
  nowMs = T(at);
  const ok = check(out);
  assert.equal(ok.status, 0, ok.stderr);
  // The Vault (v6) results file for the week, from the frozen prize list (handoff 2026-10-28): vault/W3.json.
  const vf = JSON.parse(fs.readFileSync(path.join(out, "vault", "W3.json"), "utf8"));
  assert.deepEqual({ ...vf, rows: undefined }, { game: 2, week: 3, final: true, rows: undefined, first: frozen.prizes.filter((x) => x.place === 1).map((x) => x.player).sort(), second: frozen.prizes.filter((x) => x.place === 2).map((x) => x.player).sort() });
  assert.ok(vf.first.length === 1, "one winner in 1st");
  assert.deepEqual(vf.rows, [{ player: BOB, points: 255 }], "Bob, staked in Block X, is the bucket's only row");
  for (const broken of [{ ...vf, rows: [{ player: GUEST, points: 3 }] }, { ...vf, rows: [{ player: BOB, points: 0 }] }, { ...vf, week: 4 }, { ...vf, second: [vf.first[0]] }, { ...vf, first: Array(11).fill(0).map((_, i) => "1" + String.fromCharCode(65 + i).repeat(33)) }]) {
    const d = tmp(); fs.cpSync(out, d, { recursive: true }); fs.writeFileSync(path.join(d, "vault", "W3.json"), JSON.stringify(broken));
    assert.notEqual(check(d).status, 0, JSON.stringify(broken).slice(0, 80));
  }
  // A later run uses the frozen list and doesn't write it again.
  const out2 = tmp();
  fs.copyFileSync(path.join(out, "P003.json"), path.join(out2, "P003.json"));
  fs.cpSync(out, out2, { recursive: true });
  const changed = { ...frozen, prizes: frozen.prizes.slice(0, 1) };
  fs.writeFileSync(path.join(out2, "P003.json"), JSON.stringify(changed));
  const out3 = tmp();
  const r3 = await quiet(() => run({ p: "main", check: null, prev: out2, out: out3, raceDir: rd, picksContract: VALID, blockOf: blockOf(), picksOf: picksGuest, rankedOf, prizesFromWeek: 0, head: { height: at + 200, time: T(at + 200), lib: at + 140 } }));
  assert.deepEqual(r3.board.lastWeek.prizes, changed.prizes, "later runs use the frozen list");
  assert.ok(!fs.existsSync(path.join(out3, "P003.json")), "and never write it again");
  // Exact shapes: an extra key anywhere is refused.
  const bad = tmp(); fs.cpSync(out, bad, { recursive: true });
  const b = JSON.parse(fs.readFileSync(path.join(bad, "board.json"), "utf8")); b.today.extra = "x".repeat(1000); fs.writeFileSync(path.join(bad, "board.json"), JSON.stringify(b));
  assert.notEqual(check(bad).status, 0);
  const bad2 = tmp(); fs.cpSync(out, bad2, { recursive: true });
  const i = JSON.parse(fs.readFileSync(path.join(bad2, "index.json"), "utf8")); i.updated = "<script>"; fs.writeFileSync(path.join(bad2, "index.json"), JSON.stringify(i));
  assert.notEqual(check(bad2).status, 0);
  const wf = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
  assert.match(wf, /\(\/P\[0-9\]\{3\}\|\/vault\/W\[0-9\]\+\)\\\.json\$ \]\] && git cat-file -e/, "the publish step never replaces a published prize file or Vault file");
  assert.match(wf, /if grep -qxF "\$name" "\$HELD"; then continue; fi/, "a held file is skipped, the rest published (BX-81)");
});

test("Vault results file (handoff 2026-10-28): ties share a place, 2+ tied for 1st leave 2nd empty, more than 10 tied leave that place empty, nobody qualifying gives empty lists", () => {
  const a = (c) => "1" + c.repeat(33);
  const f = (prizes) => vaultFile(2, 57, prizes);
  assert.deepEqual(f([]).file, { game: 2, week: 57, final: true, rows: [], first: [], second: [] }, "nobody qualifies");
  assert.deepEqual(f([{ player: a("A"), place: 1, vhp: 2 }, { player: a("B"), place: 2, vhp: 1 }]).file.second, [a("B")]);
  const tied1 = f([{ player: a("B"), place: 1, vhp: 1.5 }, { player: a("A"), place: 1, vhp: 1.5 }]).file;
  assert.deepEqual([tied1.first, tied1.second], [[a("A"), a("B")], []], "two tied for 1st share all 3 VHP; no 2nd");
  const tied2 = f([{ player: a("A"), place: 1, vhp: 2 }, { player: a("B"), place: 2, vhp: 0.5 }, { player: a("C"), place: 2, vhp: 0.5 }]).file;
  assert.deepEqual([tied2.first, tied2.second], [[a("A")], [a("B"), a("C")]], "1st untied, two tied for 2nd share 1 VHP");
  const many = "ABCDEFGHJKLM".split("").map((c) => ({ player: a(c), place: 1, vhp: 0.25 }));
  const r = f(many);
  assert.deepEqual([r.file.first, r.file.second], [[], []], "12 tied for 1st: more than the Vault's 10, so the place goes back to the pool");
  assert.ok(r.problems.some((x) => /12 wallets tied for 1st/.test(x)));
  const ten = f(many.slice(0, 10)).file;
  assert.equal(ten.first.length, 10, "exactly 10 is fine");
});

// ── Block X takes stakes (owner, 2026-10-28; handoff claude/handoff-stake-in-every-game.md) ──
test("stakes: staked in Block X (≥ the vault's minimum that week) vs free; staked elsewhere is free here; a mid-week withdrawal stays staked at its lowest; before v6 nobody is staked", async () => {
  const { vaultView, stakedSet, minStakeFor, vaultPoints } = await import(path.resolve(APP, "bot/games/blockx.ts"));
  const V = 100000000n, cfg = { v6_rule_week_plus_one: "4", min_stake: String(V), min_stake_next: String(2n * V), min_stake_next_week: "9" };
  assert.equal(minStakeFor(cfg, 8), V); assert.equal(minStakeFor(cfg, 9), 2n * V, "a new minimum from its own week");
  const A = "1" + "A".repeat(33), B = "1" + "B".repeat(33), C = "1" + "C".repeat(33), D = "1" + "D".repeat(33);
  const res = new Map([
    [A, { active_stake: String(5n * V), week_stake: String(5n * V), entry: null }],                       // staked here
    [B, { active_stake: "0", week_stake: "0", entry: null }],                                            // staked only in ANOTHER game: game 2 shows nothing
    [C, { active_stake: String(V), week_stake: String(V), entry: { stake: String(V), peak_stake: String(4n * V), voided: false } }],  // withdrew 3 of 4 mid-week
    [D, { active_stake: "0", week_stake: "0", entry: { stake: "0", peak_stake: String(3n * V), voided: true } }],                     // withdrew everything
  ]);
  const v = vaultView(cfg, res, 8);
  assert.deepEqual([...stakedSet(v)].sort(), [A, C, D].sort(), "the Staked board: everyone who held the minimum here that week");
  assert.equal(v.players.get(C).week, V, "C counts at its lowest stake that week");
  assert.equal(v.players.get(D).week, 0n, "D withdrew everything: on the Staked board, but no bucket row and no free prize");
  assert.ok(!stakedSet(v).has(B), "B is staked in another game only: a free player in Block X");
  assert.equal(stakedSet(vaultView({ v6_rule_week_plus_one: "0", min_stake: String(V) }, res, 8)).size, 0, "vault not live: everyone is free");
  // Points 1-255 keep the board's order and ties.
  assert.deepEqual(vaultPoints([{ player: A, place: 1 }, { player: C, place: 2 }, { player: D, place: 2 }, { player: B, place: 4 }]).map((x) => x.points), [255, 254, 254, 253]);
  const many = Array.from({ length: 300 }, (_, i) => ({ player: A, place: i + 1 }));
  assert.ok(vaultPoints(many).every((x) => x.points >= 1 && x.points <= 255), "never below 1 or above 255");
});

test("stakes: the vault file lists only players the vault counts as staked for the week (bucket rows) and only free players as prize winners; nobody staked gives empty rows", async () => {
  const startH = H0 - Math.floor(3600000 / 3000), endH = startH + 7 * 28800;
  const rd = raceDir(); let prev;
  const weekRun = async (stakeOf, rankedOfX) => {
    prev = undefined;
    for (let lib = startH + 12 * X.ROUND; lib < endH; lib += 12 * X.ROUND) {
      const o = tmp();
      await quiet(() => run({ p: "main", check: "check", prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf: rankedOfX, stakeOf, prizesFromWeek: 0, head: { height: lib, time: T(lib), lib } }));
      prev = o;
    }
    const at = endH + 13 * 1200, out = tmp();
    await quiet(() => run({ p: "main", check: "check", prev, out, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf: rankedOfX, stakeOf, prizesFromWeek: 0, head: { height: at, time: T(at), lib: at - 60 } }));
    return JSON.parse(fs.readFileSync(path.join(out, "vault", "W3.json"), "utf8"));
  };
  // Bob is on the Staked board; the vault counts him (week stake ≥ min): one bucket row; the guest wins 1st.
  const staked = await weekRun(async (who) => ({ min: 100000000n, week: new Map(who.map((a) => [a, a === BOB ? 300000000n : 0n])) }), rankedOf);
  assert.deepEqual(staked.rows, [{ player: BOB, points: 255 }]); assert.deepEqual(staked.first, [GUEST]);
  // Bob withdrew everything before the week ended (week stake 0): no bucket row (and he can't win the free prize).
  const voided = await weekRun(async (who) => ({ min: 100000000n, week: new Map(who.map((a) => [a, 0n])) }), rankedOf);
  assert.deepEqual(voided.rows, []); assert.ok(!voided.first.includes(BOB) && !voided.second.includes(BOB));
  // Nobody staked: empty rows; the free players are ranked for the prize.
  const none = await weekRun(async () => null, async () => new Set());
  assert.deepEqual(none.rows, []); assert.ok(none.first.length >= 1);
});

test("audit BX-35 / BX-38: a target scores the LOWER multiplier of the lock's card and the first card after the block; flagged cards (too few samples) are never used", async () => {
  const lib = H0 + 10 * X.ROUND + 50;
  // A race dir where every card after 00:00 of week 3's day 0 shows MID twice as big (so ×1 instead of ×2).
  const rd = raceDir();
  for (const f of fs.readdirSync(rd)) {
    const wf = JSON.parse(fs.readFileSync(path.join(rd, f), "utf8"));
    for (const r of wf.races) r.cards = r.cards.map((c, i) => (c && i % 2 === 1 ? { ...c, field: c.field.map((x) => (x.a === MID ? { ...x, vhp: x.vhp * 2 } : x)) } : c));
    fs.writeFileSync(path.join(rd, f), JSON.stringify(wf));
  }
  const out = tmp();
  await quiet(() => run({ p: "main", check: "check", out, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: lib + 60, time: T(lib + 60), lib } }));
  const wf = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
  const mid = wf.targets.filter((t) => t.signer === MID && !t.void);
  assert.ok(mid.length > 0);
  for (const t of mid) { const alice = t.picks.find((p) => p[0] === ALICE); assert.ok(alice[3] <= 200); assert.ok(t.card.afterAt > t.card.at); }
  assert.ok(mid.some((t) => t.picks.find((p) => p[0] === ALICE)[3] < 200), "where the next card shows MID bigger, the lower multiplier counts");
  // Flagged cards (samples under 12) only: nothing is scored; the targets wait.
  const flagged = raceDir();
  for (const f of fs.readdirSync(flagged)) {
    const wf2 = JSON.parse(fs.readFileSync(path.join(flagged, f), "utf8"));
    for (const r of wf2.races) r.cards = r.cards.map((c) => (c ? { ...c, samples: 3 } : c));
    fs.writeFileSync(path.join(flagged, f), JSON.stringify(wf2));
  }
  const r2 = await quiet(() => run({ p: "main", check: "check", out: tmp(), raceDir: flagged, picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: lib + 60, time: T(lib + 60), lib } }));
  assert.ok([...r2.weeks.values()].flatMap((w) => w.targets).every((t) => t.void || t.picks.every((p) => p[3] === 0)));
});

test("PRIZES_FROM_WEEK: the repository variable reaches the recorder, and only a plain week number turns prizes on", async () => {
  const { prizesFromEnv } = await import(path.resolve(APP, "bot/games/blockx.ts"));
  assert.deepEqual(["3", " 12 ", "0", "", undefined, "abc", "3.5", "-1", "1e3", "99999"].map(prizesFromEnv), [3, 12, 0, null, null, null, null, null, null, null]);
  const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
  assert.match(yml, /PRIZES_FROM_WEEK: \$\{\{ vars\.PRIZES_FROM_WEEK \}\}/);
});

// ── I-042: the whole week read again before its prize list is frozen (BX-88, BX-97, BX-98, G-K-1) ──
/** Records week 3 like weekThenLook, lets `edit` change the published week file, then runs at `hoursAfter` into week 4. */
async function weekEditThenLook(edit, extra = {}, run2 = {}, late = null) {
  const rd = raceDir();
  let prev;
  const startH = H0 - Math.floor(3600000 / 3000), endH = startH + 7 * 28800;
  for (let lib = startH + 12 * X.ROUND; lib < endH; lib += 12 * X.ROUND) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: "check", prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf, head: { height: lib, time: T(lib), lib }, ...extra }));
    prev = o;
  }
  const f = path.join(prev, "W003.json"), wf = JSON.parse(fs.readFileSync(f, "utf8"));
  edit(wf);
  fs.writeFileSync(f, JSON.stringify(wf));
  // D-135: the run looked at (13 h into week 4) agrees with the one before it (Sunday 23:30, which read the edited file
  // and recorded Sunday's targets; `run2` applies to the run looked at only).
  const first = endH - 600, mid = tmp();
  await quiet(() => run({ p: "main", check: "check", prev, out: mid, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf, head: { height: first, time: T(first), lib: first - 60 }, ...extra }));
  // `late`: an edit of the published week after Sunday's targets are in (Repo Lens #E-18).
  if (late) { const g = path.join(mid, "W003.json"), w2 = JSON.parse(fs.readFileSync(g, "utf8")); late(w2); fs.writeFileSync(g, JSON.stringify(w2)); }
  const at = endH + 13 * 1200, out = tmp();
  const r = await quiet(() => run({ p: "main", check: "check", prev: mid, out, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf, head: { height: at, time: T(at), lib: at - 60 }, ...extra, ...run2 }));
  return { r, out };
}
const heldNote = (r) => r.problems.find((p) => /week 3: held before its prize list/.test(p));

test("I-042: an honest week passes the re-read: prize list frozen, vault file written", async () => {
  const { r, out } = await weekEditThenLook(() => {}, { prizesFromWeek: 0 });
  assert.equal(heldNote(r), undefined, JSON.stringify(r.problems));
  assert.equal(r.board.lastWeek.final, true);
  assert.ok(r.board.lastWeek.prizes.length > 0, "the guest wins");
  assert.ok(fs.existsSync(path.join(out, "P003.json")) && fs.existsSync(path.join(out, "vault", "W3.json")));
});

test("I-042: a target that doesn't read the same any more holds the week: no prize list, no vault file", async () => {
  const cases = {
    "another signer": (wf) => { const t = wf.targets.find((x) => !x.void && x.signer === BIG); t.signer = MID; },
    "a pick's points": (wf) => { const t = wf.targets.find((x) => !x.void); t.picks[0][3] += 100; },
    "a pick that was never made": (wf) => { const t = wf.targets.find((x) => !x.void); t.picks.push([ALICE, t.signer, t.picks[0][2], 300, 1]); },
    "a Staked flag": (wf) => { const t = wf.targets.find((x) => !x.void && x.picks.some((p) => p[0] === GUEST)); t.picks.find((p) => p[0] === GUEST)[4] = 1; },
    "another lock card": (wf) => { const t = wf.targets.find((x) => !x.void); t.card.at -= 3600000; },
    "the card's top VHP": (wf) => { const t = wf.targets.find((x) => !x.void); t.card.top += 1; },
  };
  for (const [what, edit] of Object.entries(cases)) {
    const { r, out } = await weekEditThenLook(edit, { prizesFromWeek: 0 });
    assert.ok(heldNote(r), `${what}: held (${JSON.stringify(r.problems).slice(0, 300)})`);
    assert.equal(r.board.lastWeek.final, false, what); assert.deepEqual(r.board.lastWeek.prizes, [], what);
    assert.ok(!fs.existsSync(path.join(out, "P003.json")) && !fs.existsSync(path.join(out, "vault", "W3.json")), `${what}: nothing frozen, nothing for the vault`);
  }
});

test("I-042 (G-K-1): a round that isn't an irreversible target block of the game holds the week", async () => {
  // A round published early with a made-up (past) block time: when the week ends, the real block's time differs.
  const early = await weekEditThenLook((wf) => { wf.targets[wf.targets.length - 1].time -= 3000; });
  assert.ok(heldNote(early.r), JSON.stringify(early.r.problems).slice(0, 300));
  // (A round far in the future leaves a gap, so the week never becomes final at all: nothing is paid either.)
  const gap = await weekEditThenLook((wf) => { const t = wf.targets[wf.targets.length - 1]; t.height += 100 * X.ROUND; t.round += 100; });
  assert.equal(gap.r.board.lastWeek.final, false);
  const off = await weekEditThenLook((wf) => { wf.targets[0].height += 1; });
  // (loadWeek drops a target whose height isn't round × size + offset: a gap, so the week never becomes final.)
  assert.equal(off.r.board.lastWeek.final, false, "a height that isn't round × size + offset is never paid");
  assert.ok(!fs.existsSync(path.join(off.out, "P003.json")));
});

test("I-042: a node that reads a block differently at the week's end holds it (the other node agreeing isn't enough)", async () => {
  const lateLie = (node, h) => ({ signer: node === "check" && h === H0 + 2 * X.ROUND ? SMALL : signerOf(h), time: T(h) });
  const { r } = await weekEditThenLook(() => {}, {}, { blockOf: async (n, h) => lateLie(n, h) });
  assert.ok(heldNote(r));
});

test("BX-72: a target voided for a non-standard VHP transfer is listed when its week becomes final", async () => {
  const { r } = await weekEditThenLook((wf) => {
    const t = wf.targets.find((x) => !x.void);
    t.void = "a non-standard VHP transfer to x between its lock card and the block, so the VHP moved can't be read; no points";
    t.card = null; for (const p of t.picks) p[3] = 0;
  }, { prizesFromWeek: 0 });
  assert.ok(r.problems.some((p) => /voided for a non-standard VHP transfer/.test(p) && /correction window/.test(p)), JSON.stringify(r.problems).slice(0, 400));
});

// ── Repo Lens round 14 (E4-1, E4-2, E4-3, E4-7) ──
const emptyRaceDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "race-empty-"));

test("E4-1 (a): a run with no race files (failed race-data fetch) never writes a target void; the next run with the files scores it", async () => {
  const lib = H0 + 3 * X.ROUND + 50;   // head well past 3 hours after the early locks
  const o1 = tmp();
  const r1 = await quiet(() => run({ p: "main", check: "check", out: o1, raceDir: emptyRaceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: lib, time: T(lib), lib } }));
  assert.ok(r1.problems.some((p) => /no race cards for its lock \(the race-data files are missing\)/.test(p)), JSON.stringify(r1.problems).slice(0, 300));
  const t1 = r1.weeks.get(3)?.targets || [];
  assert.equal(t1.filter((t) => t.void).length, 0, "no void rows from a run without race files");
  assert.ok(head0(lib) - T(H0 + X.ROUND - 100) > 3 * 3600000, "the first target's lock is more than 3 hours old (on the old code it was written void)");
  // The next run has the race files: the same targets are scored, not void.
  const r2 = await quiet(() => run({ p: "main", check: "check", prev: o1, out: tmp(), raceDir: raceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: lib, time: T(lib), lib } }));
  const t2 = r2.weeks.get(3).targets;
  assert.ok(t2.length > 0 && t2.every((t) => !t.void && t.card), JSON.stringify(t2.map((t) => t.void)).slice(0, 200));
});

test("E4-1 (a): with the race files still missing at the 3-day edge, the target is voided with that reason (not 'no handicap card')", async () => {
  const later = H0 + 3 * X.ROUND + 3 * 28800;
  const r = await quiet(() => run({ p: "main", check: null, out: tmp(), raceDir: emptyRaceDir(), picksContract: "1P", blockOf: blockOf(), picksOf: picksOf(), rankedOf, head: { height: later, time: T(later), lib: later } }));
  const voided = [...r.weeks.values()].flatMap((w) => w.targets).filter((t) => t.void);
  assert.ok(voided.length >= 1);
  assert.ok(voided.every((t) => /race cards .* could not be read until it left the 3-day window/.test(t.void) && t.checked === 0 && t.picks.length === 0), JSON.stringify(voided.map((t) => t.void)).slice(0, 300));
});

test("E4-1 (b): a 'no card' void whose card IS in the race files holds the week at its end (each void reason re-checked)", async () => {
  const toVoid = {
    "no card at the lock": "no handicap card was recorded for this target's lock; no points",
    "no card after the block": "no handicap card was taken within 3 hours after the block; no points",
    "a disputed lock card": "the two nodes disagreed about the signer's VHP on the lock's handicap card; no points",
  };
  for (const [what, why] of Object.entries(toVoid)) {
    const { r, out } = await weekEditThenLook((wf) => {
      const t = wf.targets.find((x) => !x.void);
      t.void = why; t.card = null; for (const p of t.picks) p[3] = 0;
    }, { prizesFromWeek: 0 });
    const note = heldNote(r);
    assert.ok(note && /a void target has a card now/.test(note), `${what}: held (${JSON.stringify(r.problems).slice(0, 300)})`);
    assert.equal(r.board.lastWeek.final, false, what);
    assert.ok(!fs.existsSync(path.join(out, "P003.json")) && !fs.existsSync(path.join(out, "vault", "W3.json")), `${what}: nothing frozen`);
    assert.deepEqual(r.held, [note], `${what}: reported as a hold (E4-7)`);
  }
});

test("E4-2: a read that fails during the re-read holds the week but still publishes everything else", async () => {
  const failAt = H0 + 2 * X.ROUND;
  const { r, out } = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, {
    blockOf: async (n, h) => { if (h === failAt) throw new Error("block 2400: 503 (calls=6)"); return { signer: signerOf(h), time: T(h) }; },
  });
  const note = heldNote(r);
  assert.ok(note && /a read failed during the re-read: block 2400: 503/.test(note), JSON.stringify(r.problems).slice(0, 300));
  assert.ok(fs.existsSync(path.join(out, "board.json")) && fs.existsSync(path.join(out, "index.json")), "the hour's other files are still written");
  assert.ok(!fs.existsSync(path.join(out, "P003.json")) && !fs.existsSync(path.join(out, "vault", "W3.json")));
});

test("E4-3: the re-read reads 4 targets at a time and holds (try next run) once its time budget is spent", async () => {
  let inFlight = 0, most = 0;
  const slow = async (n, h) => { inFlight++; most = Math.max(most, inFlight); await new Promise((res) => setTimeout(res, 2)); inFlight--; return { signer: signerOf(h), time: T(h) }; };
  const ok = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, { blockOf: slow });
  assert.equal(heldNote(ok.r), undefined, JSON.stringify(ok.r.problems).slice(0, 300));
  assert.ok(most > 1 && most <= 4, `at most 4 targets read at once (saw ${most})`);
  const late = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, { reverifyBudgetMs: -1 });
  assert.ok(/ran out of time this run/.test(heldNote(late.r) || ""), JSON.stringify(late.r.problems).slice(0, 300));
});

test("E4-1 (a) / E4-7 in the workflow: a failed fetch of a branch that exists stops the run; a held week fails it after publishing", () => {
  const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
  for (const b of ["games-data", "race-data"]) assert.match(yml, new RegExp(`git ls-remote --exit-code --heads "https://github.com/\\$\\{GITHUB_REPOSITORY\\}.git" refs/heads/${b} `), b);   // Repo Lens B3-6: the exact ref
  assert.match(yml, /if \[ "\$rc" -eq 2 \]; then echo "No race-data branch yet: targets wait for cards."; else echo "::error::The race-data branch could not be fetched/);
  assert.match(yml, /held: \$\{\{ steps\.blockx\.outputs\.held \}\}/);
  // (the Bracket's failed-step alert shares this job: #E-3 M-4)
  assert.match(yml, /alert:\n    needs: \[record, record_bracket, publish\]\n    if: \$\{\{ always\(\) && \(needs\.record\.outputs\.held == 'true' \|\| needs\.record_bracket\.result == 'failure'\) \}\}/);
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /fs\.appendFileSync\(E\.GITHUB_OUTPUT, "held=true\\n"\)/);
});

// ── Repo Lens round-14 fix-check Lows (L-1, L-2, L-3) ──
test("L-1: the re-read's budget counts from the start of the run, and reads in it get 2 tries", async () => {
  // 1 ms into the run is always past by the time the week-end re-read starts: held, tried next run.
  const { r } = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, { reverifyBudgetMs: 1 });
  assert.ok(/ran out of time this run/.test(heldNote(r) || ""), JSON.stringify(r.problems).slice(0, 300));
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /export const REVERIFY_BUDGET_MS = 22 \* 60000;/);
  assert.match(src, /export const REVERIFY_TRIES = 2;/);
  assert.match(src, /const reDeadline = runStart \+ \(o\.reverifyBudgetMs \?\? REVERIFY_BUDGET_MS\);/);
  assert.match(src, /blockReader\(o\.p, headId, REVERIFY_TRIES\)/);
  assert.match(src, /readPicks\(node, contract, g, r, REVERIFY_TRIES, beforeRead\)/, "R-BX-25: the week's game");
});

// One problem with nothing after it: the guest's Staked flag (Repo Lens B4-1: a release lets through only that reason,
// and every other check on the round still runs; a signer change would also break the round's card values).
const tamper = (wf) => { const t = wf.targets.find((x) => !x.void && x.picks.some((p) => p[0] === GUEST)); t.picks.find((p) => p[0] === GUEST)[4] = 1; };
test("L-2: a held week prints its release code; BLOCKX_RELEASE with that exact code frees it once", async () => {
  const held = await weekEditThenLook(tamper, { prizesFromWeek: 0 }, { release: null });
  const note = heldNote(held.r);
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(note)[1];
  const code = `3:${releaseCode(reason)}`;
  assert.ok(note.includes(`BLOCKX_RELEASE = ${code}`), note);
  // the wrong week, a wrong code, or junk: still held, nothing frozen
  for (const bad of [`4:${releaseCode(reason)}`, "3:0123456789abcdef", "yes", ""]) {
    const x = await weekEditThenLook(tamper, { prizesFromWeek: 0 }, { release: bad });
    assert.ok(heldNote(x.r), `"${bad}" doesn't release`);
    assert.ok(!fs.existsSync(path.join(x.out, "P003.json")), `"${bad}": nothing frozen`);
  }
  // the right code: frozen, vault file written, a warning (not an error), not reported as held
  const ok = await weekEditThenLook(tamper, { prizesFromWeek: 0 }, { release: code });
  assert.equal(heldNote(ok.r), undefined);
  assert.ok(ok.r.problems.some((p) => /week 3: RELEASED by BLOCKX_RELEASE/.test(p)));
  assert.deepEqual(ok.r.held, []);
  assert.ok(fs.existsSync(path.join(ok.out, "P003.json")) && fs.existsSync(path.join(ok.out, "vault", "W3.json")));
  assert.equal(releaseMatches(` ${code} `, 3, reason), true);
  assert.equal(releaseMatches(code, 3, reason + "x"), false);
});

test("L-2: a hold that passes on its own (a failed read, a timeout) prints no code and can't be released", async () => {
  const failAt = H0 + 2 * X.ROUND;
  const failing = { blockOf: async (n, h) => { if (h === failAt) throw new Error("block 2400: 503 (calls=6)"); return { signer: signerOf(h), time: T(h) }; } };
  const a = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, { ...failing, release: null });
  const note = heldNote(a.r);
  assert.ok(note && !/BLOCKX_RELEASE/.test(note), note);
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(note)[1];
  const b = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, { ...failing, release: `3:${releaseCode(reason)}` });
  assert.ok(heldNote(b.r), "still held");
  assert.ok(!fs.existsSync(path.join(b.out, "P003.json")));
  const late = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, { reverifyBudgetMs: 1, release: `3:${releaseCode("the re-read ran out of time this run")}` });
  assert.ok(heldNote(late.r), "a timeout can't be released");
});

test("L-2 / L-3 in the workflows: BLOCKX_RELEASE reaches the recorder; the testnet fetch fails like mainnet's", () => {
  const yml = fs.readFileSync(path.resolve(APP, ".github/workflows/games.yml"), "utf8");
  assert.match(yml, /BLOCKX_RELEASE: \$\{\{ vars\.BLOCKX_RELEASE \}\}/);
  const t = fs.readFileSync(path.resolve(APP, ".github/workflows/games-testnet.yml"), "utf8");
  assert.match(t, /git ls-remote --exit-code --heads "https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}\.git" refs\/heads\/testnet-data /);   // B3-6
  assert.match(t, /if \[ "\$rc" -eq 2 \]; then echo "No testnet-data branch yet."; else echo "::error::The testnet-data branch could not be fetched/);
});

// ── Repo Lens #B-3 (round-14 Lows fix-check): a release frees only the hold the owner checked ──
// Written by Repo Lens, NOT run here. Append to the end of tests/audit/blockx-recorder.test.mjs (it uses that file's
// weekEditThenLook, heldNote, releaseCode, BIG and MID). It should FAIL on 4e6334f and PASS once B3-1 is fixed.
test("Repo Lens B3-1: BLOCKX_RELEASE for the first hold doesn't free a second, unread difference in the same week", async () => {
  // Two problems in week 3: the first non-void BIG target's signer (the hold the owner sees and checks), and a
  // LATER target's points (never read: the re-read stops at the first hold).
  const two = (wf) => {
    const live = wf.targets.filter((x) => !x.void);
    const first = live.find((x) => x.signer === BIG); first.signer = MID;
    const later = [...live].reverse().find((x) => x.round > first.round && x.picks.length);
    assert.ok(later, "the fixture has a later scored target with picks");
    later.picks[0][3] += 100;
  };
  const held = await weekEditThenLook(two, { prizesFromWeek: 0 }, { release: null });
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(heldNote(held.r))[1];
  assert.match(reason, /signer or times read differently now/, "the first hold reported is the signer change");
  const released = await weekEditThenLook(two, { prizesFromWeek: 0 }, { release: `3:${releaseCode(reason)}` });
  // The released reason is gone, but the week must still be held for the second difference: nothing frozen.
  const note = heldNote(released.r);
  assert.ok(note && /points recompute differently/.test(note), "still held for the later target: " + JSON.stringify(released.r.problems).slice(0, 400));
  assert.ok(!fs.existsSync(path.join(released.out, "P003.json")), "no prize list frozen");
  assert.ok(!fs.existsSync(path.join(released.out, "vault", "W3.json")), "no vault file written");
});

// ── Repo Lens #B-3: B3-2 (the deadline before every read; the re-read's vault reads on REVERIFY_TRIES) and B3-3 ──
test("B3-2: past the deadline, a target already in flight stops before its next read (a passing hold, no code)", async () => {
  // Every block read waits; the budget runs out while the first targets are still reading.
  let reads = 0;
  const slow = { reverifyBudgetMs: 0, blockOf: async (n, h) => { reads++; await new Promise((r) => setTimeout(r, 1)); return { signer: signerOf(h), time: T(h) }; } };
  const { r } = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, slow);
  const note = heldNote(r) || "";
  assert.match(note, /ran out of time this run/);
  assert.doesNotMatch(note, /BLOCKX_RELEASE/, "a timeout prints no release code");
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /const timed = <T,>\(f: \(\) => Promise<T>\): Promise<T> => \(Date\.now\(\) > deadline \? Promise\.reject\(new OutOfTime\(\)\) : f\(\)\);/);
  for (const call of ["timed(() => read(t.height))", "timed(() => read(t.height - G.LEAD))", "timed(() => reread(node, t.round, G.GAME_ID))", "timed(() => rerank(players, node, M.weekOf(t.time)))"]) assert.ok(src.includes(call), call);
  assert.match(src, /const reVault = vaultReader\(KNODE, VG, VAULT_ABI, REVERIFY_TRIES, beforeRead\);/, "R-BX-25: the vault game");
  // Repo Lens B4-2: the deadline inside the vault reader's reads and each picks page too
  assert.match(src, /beforeRead\(\);   \/\/ Repo Lens B4-2: the re-read's deadline before every one of these reads too/);
  assert.match(src, /beforeRead\(\);   \/\/ Repo Lens B4-2: before every page, not only the first/);
  assert.match(src, /withRetry\("vault state", \(\) => \(c\.functions as any\)\.get_state\(\{\}\), tries\)/);
  assert.match(src, /get_game_player\(\{ player: a, game, week: String\(week\) \}\), tries\)/);
});

test("B3-3: holds that pass on their own print no release code and are never released", async () => {
  // "isn't irreversible yet" (a source check: a run can't record a target past the irreversible block to test it with).
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /if \(t\.height > head\.lib\) return hold\(" isn't irreversible yet", true\);/);
  assert.match(src, /return why \? hold\(`: a void target has a card now \(\$\{why\}\)`, \/\^this run has no race cards\/\.test\(why\)\) : null;/);
  // A void "no card" row checked by a run whose race files are missing: held, passing, no code, never released.
  const v = (wf) => { const t = wf.targets.find((x) => !x.void); t.void = "no handicap card was recorded for this target's lock; no points"; t.card = null; for (const p of t.picks) p[3] = 0; };
  // Race files present for week 4 (so week 3 is complete) but not week 3 itself (a fetch gap for that week's file).
  const empty = raceDir(); fs.rmSync(path.join(empty, "W003.json"));
  const a = await weekEditThenLook(v, { prizesFromWeek: 0 }, { raceDir: empty, release: null });
  const note = heldNote(a.r) || "";
  assert.match(note, /this run has no race cards for its lock/, JSON.stringify(a.r.problems).slice(0, 400));
  assert.doesNotMatch(note, /BLOCKX_RELEASE/);
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(note)[1];
  const b = await weekEditThenLook(v, { prizesFromWeek: 0 }, { raceDir: empty, release: `3:${releaseCode(reason)}` });
  assert.ok(heldNote(b.r), "still held");
  assert.ok(!fs.existsSync(path.join(b.out, "P003.json")));
});

test("B3-1: a release lets through only its own target: one problem released freezes the week; with two, the second still holds", async () => {
  const one = tamper;
  const a = await weekEditThenLook(one, { prizesFromWeek: 0 }, { release: null });
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(heldNote(a.r))[1];
  const ok = await weekEditThenLook(one, { prizesFromWeek: 0 }, { release: `3:${releaseCode(reason)}` });
  assert.ok(ok.r.problems.some((p) => /RELEASED by BLOCKX_RELEASE .* the rest of the week read the same/.test(p)), JSON.stringify(ok.r.problems).slice(0, 300));
  assert.ok(fs.existsSync(path.join(ok.out, "P003.json")) && fs.existsSync(path.join(ok.out, "vault", "W3.json")));
  // the B3-1 case itself (two problems) is the Repo Lens test above; here: the run says why it stays held
  const two = (wf) => { one(wf); const live = wf.targets.filter((x) => !x.void && x.picks.length && !sunday(x)); live[live.length - 1].picks[0][3] += 100; };
  const b = await weekEditThenLook(two, { prizesFromWeek: 0 }, { release: `3:${releaseCode(reason)}` });
  assert.ok(b.r.problems.some((p) => /BLOCKX_RELEASE matches .* but the rest of the week doesn't read the same either; still held/.test(p)));
  const note = heldNote(b.r);
  const second = /held before its prize list: (.*)\. Nothing is paid/.exec(note)[1];
  assert.ok(note.includes(`BLOCKX_RELEASE = 3:${releaseCode(second)}`), "the new hold prints its own code");
});
// ── Repo Lens #B-3 re-check: B4-1, a release frees only the reason checked ──
// Written by Repo Lens, NOT run here (static review).
test("Repo Lens B4-1: a release frees only the reason checked, not the released round's other checks", async () => {
  // One target, two differences: its signer (the hold the owner checks) and its first pick's points (never read).
  const both = (wf) => {
    const t = wf.targets.find((x) => !x.void && x.signer === BIG && x.picks.length);
    assert.ok(t, "the fixture has a scored BIG target with picks");
    t.signer = MID; t.picks[0][3] += 100;
  };
  const a = await weekEditThenLook(both, { prizesFromWeek: 0 }, { release: null });
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(heldNote(a.r))[1];
  assert.match(reason, /signer or times read differently now/);
  const b = await weekEditThenLook(both, { prizesFromWeek: 0 }, { release: `3:${releaseCode(reason)}` });
  assert.ok(heldNote(b.r), "still held: the same round's points were never checked " + JSON.stringify(b.r.problems).slice(0, 400));
  assert.ok(!fs.existsSync(path.join(b.out, "P003.json")), "no prize list frozen");
  assert.ok(!fs.existsSync(path.join(b.out, "vault", "W3.json")), "no vault file written");
});

test("B4-1: a released signer change still has its round's other checks run (the card values no longer match): held", async () => {
  const sig = (wf) => { const t = wf.targets.find((x) => !x.void && x.signer === BIG); t.signer = MID; };
  const a = await weekEditThenLook(sig, { prizesFromWeek: 0 }, { release: null });
  const reason = /held before its prize list: (.*)\. Nothing is paid/.exec(heldNote(a.r))[1];
  const b = await weekEditThenLook(sig, { prizesFromWeek: 0 }, { release: `3:${releaseCode(reason)}` });
  const note = heldNote(b.r) || "";
  assert.match(note, /card values read differently now|points recompute differently/, JSON.stringify(b.r.problems).slice(0, 300));
  assert.ok(!fs.existsSync(path.join(b.out, "P003.json")));
});

// ── R-BX-22 / R-BX-23 (D-125, D-129, WEEK_CYCLE.md): play counts Mon–Sat; Sunday targets are fun rounds (scored, on
// Today and All time, never the week's board, prizes or vault file) ──
const sunday = (t) => new Date(t.time).getUTCDay() === 0;
test("D-129: Sunday targets (from Week 1) are scored as fun rounds: All time yes, the week's board and prizes no", async () => {
  const { r, out } = await weekEditThenLook(() => {}, { prizesFromWeek: 0 });
  const wf = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
  const sun = wf.targets.filter(sunday), play = wf.targets.filter((t) => !sunday(t));
  assert.ok(sun.length === 12 && play.length === 72, `a full week (${sun.length} Sunday, ${play.length} other targets)`);
  assert.ok(sun.every((t) => !t.void && t.picks.length > 0) && sun.some((t) => t.picks.some((p) => p[3] > 0)), "Sunday targets are recorded and scored like any target");
  const pts = (ts, who) => ts.flatMap((t) => t.picks).filter((p) => p[0] === who).reduce((s, p) => s + p[3], 0);
  assert.equal(heldNote(r), undefined, JSON.stringify(r.problems).slice(0, 300));
  assert.equal(r.board.lastWeek.final, true, "the week goes final with its fun rounds left out");
  for (const who of [GUEST, BOB]) {
    assert.equal(r.board.lastWeek.rows.find((x) => x.a === who).pts, pts(play, who), `${who}: the week counts Monday to Saturday only`);
    assert.ok(r.board.allTime.rows.find((x) => x.a === who).pts >= pts(wf.targets, who), `${who}: All time counts Sunday too`);
  }
  const vf = JSON.parse(fs.readFileSync(path.join(out, "vault", "W3.json"), "utf8"));
  assert.deepEqual(plain(vf.rows).map((x) => x.player), [BOB], "the vault file comes from the week's board (Sunday left out)");
});

test("D-129: before Week 1 a Sunday counts for the week; the cycle's math", async () => {
  const { r, out } = await weekEditThenLook(() => {}, { restFromWeek: 4 });
  const wf = JSON.parse(fs.readFileSync(path.join(out, "W003.json"), "utf8"));
  const all = wf.targets.flatMap((t) => t.picks).filter((p) => p[0] === GUEST).reduce((s, p) => s + p[3], 0);
  assert.equal(r.board.lastWeek.rows.find((x) => x.a === GUEST).pts, all, "the whole week, Sunday included");
  assert.equal(X.RHYTHM_FROM_WEEK, 3, "Week 1 = vault week 3 (Mon 9 Nov 2026), as the Race (race-math.js)");
  assert.equal(X.restDay(Date.UTC(2026, 10, 15, 12)), true, "Sun 15 Nov 2026");
  assert.equal(X.restDay(Date.UTC(2026, 10, 14, 23, 59)), false, "Sat 14 Nov 23:59 UTC");
  assert.equal(X.restDay(Date.UTC(2026, 10, 16, 0)), false, "Mon 16 Nov 00:00 UTC");
  assert.equal(X.restDay(Date.UTC(2026, 10, 8, 12)), false, "Sun 8 Nov 2026 is before Week 1");
  assert.equal(X.playEnd(3), Date.UTC(2026, 10, 15), "Week 1 counts until Sat 24:00 UTC");
  assert.equal(X.playEnd(2), Date.UTC(2026, 10, 9), "before Week 1: the whole week");
});

test("D-129: a play-day target given a Sunday time (to drop it from the week) holds the week", async () => {
  const { r, out } = await weekEditThenLook((wf) => {
    const t = wf.targets.filter((x) => !sunday(x) && !x.void && x.picks.some((p) => p[3] > 0))[10];   // mid-week
    t.time = Date.UTC(2026, 10, 15, 1);   // a Sunday
  }, { prizesFromWeek: 0 });
  assert.ok(heldNote(r), JSON.stringify(r.problems).slice(0, 300));
  assert.equal(r.board.lastWeek.final, false);
  assert.ok(!fs.existsSync(path.join(out, "P003.json")));
});

test("D-135: final from Monday 00:00 once two runs an hour apart agree; a run that reads the week differently waits", async () => {
  // weekThenLook's last recording run is Sunday 00:00. Monday 00:30 agrees with it (a day apart): final.
  assert.equal((await weekThenLook(picksGuest, 0.5, { prizesFromWeek: 3 })).board.lastWeek.final, true);
  // The last Sunday run (its "this week" board is the week's Mon–Sat) and the first Monday run, an hour apart: final at once.
  const rd = raceDir(), startH = H0 - 1200, endH = startH + 7 * 28800;
  let prev;
  for (const lib of [startH + 24 * X.ROUND, startH + 48 * X.ROUND, startH + 72 * X.ROUND, endH - 1200 - 60]) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: null, prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf, prizesFromWeek: 3, head: { height: lib + 60, time: T(lib + 60), lib } }));
    prev = o;
  }
  const at = endH + 120;   // Monday 00:06
  const mon = await quiet(() => run({ p: "main", check: null, prev, out: tmp(), raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksGuest, rankedOf, prizesFromWeek: 3, head: { height: at, time: T(at), lib: at - 60 } }));
  assert.equal(mon.board.lastWeek.final, true, "Sunday 23:00 and Monday 00:06 read the same Mon–Sat week: final");
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /const STABLE_MS = 3600000;/);
  assert.match(src, /const ready = head\.time >= M\.weekStart\(nowW\) && complete;/);
  assert.ok(!/CORRECTION_MS/.test(src), "the 12-hour final is gone");
});
// Repo Lens #E-18 K-1 (PR #175, post-merge): append to the END of tests/audit/blockx-recorder.test.mjs
// (it uses that file's own helpers: weekEditThenLook, sunday, heldNote, fs, path, assert).
// A play-day target given a Sunday time AND "checked: 0" (as one bad recording run could write it) must still hold the week:
// the re-read has to read its block, not skip it because the row says it was never checked.

test("Repo Lens #E-18 K-1: a play-day target given a Sunday time and checked 0 still holds the week", async () => {
  const { r, out } = await weekEditThenLook((wf) => {
    const t = wf.targets.filter((x) => !sunday(x) && !x.void && x.picks.some((p) => p[3] > 0))[10];   // mid-week, scored
    t.time = Date.UTC(2026, 10, 15, 1);   // a Sunday (as the D-129 test above)
    t.checked = 0;                         // "never read": the new Sunday branch returns at once
  }, { prizesFromWeek: 0 });
  assert.ok(heldNote(r), "held: " + JSON.stringify(r.problems).slice(0, 300));
  assert.equal(r.board.lastWeek.final, false);
  assert.ok(!fs.existsSync(path.join(out, "P003.json")), "no prize file");
  assert.ok(!fs.existsSync(path.join(out, "vault", "W3.json")), "no vault file");
});

test("Repo Lens #E-18 K-1: a Sunday row with picks and checked 0 holds the week (only a void row with no picks may be unread)", async () => {
  // (Sunday's targets are recorded by the Sunday 23:30 run, so the edit is made after it: `late`.)
  const { r } = await weekEditThenLook(() => {}, { prizesFromWeek: 0 }, {}, (wf) => {
    const t = wf.targets.find((x) => sunday(x) && !x.void && x.picks.length > 0);
    t.checked = 0;
  });
  assert.ok(heldNote(r), "held: " + JSON.stringify(r.problems).slice(0, 300));
});

test("Repo Lens #E-18 K-1: any non-void row with checked 0 holds; a 3-day-edge void row (no picks) still passes unread", async () => {
  const a = await weekEditThenLook((wf) => { wf.targets.filter((x) => !sunday(x) && !x.void)[5].checked = 0; }, { prizesFromWeek: 0 });
  assert.match(heldNote(a.r) || "", /never read on chain/);
  const b = await weekEditThenLook((wf) => {
    const t = wf.targets.filter((x) => !sunday(x) && !x.void)[5];
    Object.assign(t, { checked: 0, signer: null, card: null, picks: [], void: "could not be recorded within 3 days: node keeps failing" });
  }, { prizesFromWeek: 0 });
  assert.equal(heldNote(b.r), undefined, JSON.stringify(b.r.problems).slice(0, 300));
});

test("Repo Lens #E-18 K-2: a release on a run that can't freeze yet doesn't say it froze", () => {
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /if \(!h\) problems\.push\(agreed\n\s+\? `week \$\{lw\}: RELEASED by BLOCKX_RELEASE/);
  assert.match(src, /keep BLOCKX_RELEASE until the board shows the week final/);
});

// ── R-BX-25 (owner 5 Nov: "go ahead"): hourly targets from Mon 16 Nov (vault week 4) as Picks game 12; vault game 2 ──
// (The mainnet switch is week 3; the test switches at week 4 so week 3 can be game 2's, with this file's 2-hourly fakes.)
const SW4 = [{ game: X.MAINNET_GAME, fromWeek: 0, toWeek: 4 }, { game: X.MAINNET_HOURLY, fromWeek: 4, toWeek: Infinity }];
test("R-BX-25: week 3 on game 2 (every 2,400 blocks), week 4 on hourly game 12 (every 1,200), both final with vault game 2", async () => {
  const rd = raceDir({ weeks: [2, 3, 4, 5] });
  const startH = H0 - 1200, w4H = startH + 7 * 28800, w5H = startH + 14 * 28800;
  const seen = [];
  const picksH = async (node, r, g) => {
    const h = g === 12 ? r * 1200 : r * 2400, t = T(h) - 3600000 * (1 + (r % 3));
    seen.push(g);
    return [{ player: GUEST, producer: signerOf(h), time: t }, { player: BOB, producer: BIG, time: t }];
  };
  let prev; const outs = [];
  for (let lib = startH + 14400; lib <= w5H + 2400; lib += 14400) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: "check", prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksH, rankedOf, prizesFromWeek: 3,
      schedule: SW4, vaultGame: X.VAULT_GAME, head: { height: lib + 60, time: T(lib + 60), lib } }));
    prev = o; outs.push(o);
  }
  const last = prev, read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
  const latest = (f) => read([...outs].reverse().find((d) => fs.existsSync(path.join(d, f))), f);   // as the branch keeps it
  const w3 = latest("W003.json"), w4 = latest("W004.json");
  assert.equal(w3.game, 2); assert.equal(w4.game, 12);
  assert.equal(w3.targets.length, 84, "week 3: every 2,400 blocks (12 a day)");
  assert.ok(w3.targets.every((t) => t.height === t.round * 2400 && t.time >= M.weekStart(3) && t.time < M.weekStart(4)));
  assert.ok(w4.targets.length >= 160 && w4.targets.length <= 168, `week 4: every 1,200 blocks (24 a day): ${w4.targets.length}`);
  assert.ok(w4.targets.every((t) => t.height === t.round * 1200 && t.time >= M.weekStart(4) && t.time < M.weekStart(5)), "no hourly target before the switch, none of game 2 after it");
  assert.ok(seen.includes(2) && seen.includes(12), "picks read from each game");
  // Both weeks final and frozen once; the prize and vault files are vault game 2's.
  const find = (f) => outs.map((d) => path.join(d, f)).find((x) => fs.existsSync(x));
  for (const [w, f] of [[3, "P003.json"], [4, "P004.json"]]) {
    const pf = find(f);
    assert.ok(pf, `${f} frozen`);
    assert.equal(JSON.parse(fs.readFileSync(pf, "utf8")).game, 2, `${f}: vault game 2`);
    const vf = find(path.join("vault", `W${w}.json`));
    assert.ok(vf, `vault file for week ${w}`);
    assert.equal(JSON.parse(fs.readFileSync(vf, "utf8")).game, 2);
  }
  const idx = read(last, "index.json");
  assert.equal(idx.game, 2, "index.json names the vault game, as before");
  // Week 4's board counts Monday to Saturday's 144 hourly targets (Sunday's 24 are fun rounds, D-129).
  const board = read(last, "board.json");
  assert.equal(board.lastWeek.week, 4); assert.equal(board.lastWeek.final, true);
  const play = w4.targets.filter((t) => new Date(t.time).getUTCDay() !== 0);
  assert.equal(play.length, 144);
  const bobPts = play.flatMap((t) => t.picks).filter((p) => p[0] === BOB).reduce((s, p) => s + p[3], 0);
  assert.equal(board.lastWeek.rows.find((x) => x.a === BOB).pts, bobPts);
});

test("R-BX-25: the mainnet schedule, the page and the tool agree on game 12", () => {
  assert.deepEqual(plain(X.MAINNET_HOURLY), { id: 12, round: 1200, offset: 0, lead: 100, ahead: 28900, picksPerDay: 48, maxChanges: 1 });
  assert.equal(X.HOURLY_FROM_WEEK, 3); assert.equal(M.weekStart(3), Date.UTC(2026, 10, 9), "owner 5 Nov: from Mon 9 Nov 2026 00:00 UTC (Week 1)");
  assert.equal(X.scheduleOf(2).game.id, 2); assert.equal(X.scheduleOf(3).game.id, 12); assert.equal(X.VAULT_GAME, 2);
  const G12 = X.forGame(X.MAINNET_HOURLY);
  assert.equal(G12.openRounds(48_000_000).length, 24, "24 open targets a day ahead");
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /schedule: X\.MAINNET_SCHEDULE as any, vaultGame: X\.VAULT_GAME/, "the mainnet run uses the schedule");
});

test("owner 5 Nov: the multiplier's cap is ×5 from Week 1 (×3 before), by the target's own time; the same points per pick hourly", () => {
  const card = { field: [{ a: BIG, vhp: 1000, k: 1, h: 1 }, { a: MID, vhp: 250, k: 1, h: 1 }], paddock: [{ a: SMALL, vhp: 10, k: 1 }] };
  const w2 = Date.UTC(2026, 10, 8, 12), w3 = Date.UTC(2026, 10, 9, 0, 30);
  assert.equal(X.multiplier(card, MID, w2), 3, "before Week 1: capped at ×3");
  assert.equal(X.multiplier(card, MID, w3), 4, "from Week 1: top ÷ VHP = 4, under the ×5 cap");
  assert.equal(X.multiplier(card, SMALL, w2), 3); assert.equal(X.multiplier(card, SMALL, w3), 5);
  assert.equal(X.multiplier(card, BIG, w3), 1);
  assert.equal(X.pointsOf(card, SMALL, SMALL, w3), 500); assert.equal(X.pointsOf(card, SMALL, SMALL, w2), 300);
  assert.equal(X.pointsOf(card, SMALL, BIG, w3), 0);
  assert.equal(X.capAt(), 5, "no time: the newest cap (the page's producer list)");
  // The same points per right pick on the hourly game as on the 2-hour game (owner: "the same point value").
  assert.equal(X.pointsOf(card, MID, MID, w3), 400);
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /X\.pointsOf\(lockC, producer, b\.signer, b\.time\), X\.pointsOf\(afterC, producer, b\.signer, b\.time\)/, "recorded with the target's own cap");
  assert.match(src, /X\.pointsOf\(lockC, p\[1\], t\.signer, t\.time\), X\.pointsOf\(afterC, p\[1\], t\.signer, t\.time\)/, "re-read with the target's own cap");
});

test("Repo Lens #E-21 L-1: after the switch a run doesn't read blocks that can't be its games' (more than 6 h past an edge)", async () => {
  const rd = raceDir({ weeks: [2, 3, 4, 5] });
  const startH = H0 - 1200, w4H = startH + 7 * 28800, sw = M.weekStart(4);
  const picksH = async (node, r, g) => { const h = g === 12 ? r * 1200 : r * 2400; return [{ player: GUEST, producer: signerOf(h), time: T(h) - 3600000 }]; };
  let prev;
  for (let lib = w4H - 3 * 28800; lib < w4H; lib += 14400) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: "check", prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksH, rankedOf, schedule: SW4, vaultGame: 2, head: { height: lib + 60, time: T(lib + 60), lib } }));
    prev = o;
  }
  const read = [];
  const spy = blockOf();
  const at = w4H + 12 * 1200;   // Monday 12:00
  await quiet(() => run({ p: "main", check: "check", prev, out: tmp(), raceDir: rd, picksContract: "1P", blockOf: (node, h) => { read.push(h); return spy(node, h); }, picksOf: picksH, rankedOf, schedule: SW4, vaultGame: 2, head: { height: at + 60, time: T(at + 60), lib: at } }));
  const targets = [...new Set(read)].filter((h) => h % 1200 === 0);   // target blocks (locks are 100 below)
  const g12Before = targets.filter((h) => (h / 1200) % 2 === 1 && T(h) < sw - 6 * 3600000);   // E-23 I-1: ±6 h
  assert.deepEqual(g12Before, [], "no hourly-only round from before Sunday 18:00 is read");
  assert.ok(read.length > 0 && read.length < 4 * (12 + 6) * 2, `few reads: ${read.length}`);
});

test("Repo Lens #E-21 L-2: a game that starts within 2 days is checked early; a wrong started game is skipped, not the whole run", () => {
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /SCHED\.filter\(\(x\) => x\.from <= head\.time \+ 2 \* X\.DAY && x\.to > head\.time - LOOKBACK_BLOCKS \* X\.BLOCK_MS - 7 \* X\.DAY\)/);
  assert.match(src, /announce and apply it before then \(npm run picks -- announce \$\{G\.GAME_ID\}/);
  assert.match(src, /badGames\.add\(G\);/);
  assert.match(src, /if \(e\.from > head\.time \|\| badGames\.has\(e\.G\)\) continue;/);
  assert.match(src, /if \(startedGames\.length && startedGames\.every\(\(G\) => badGames\.has\(G\)\)\) throw new Error/);
  assert.match(src, /Number\(pg\.eta\) <= e\.from\) \{ console\.log\(`game \$\{G\.GAME_ID\}: announced, can be applied from/, "announced in time: no alarm during the 48 h wait");
});

test("Repo Lens #E-23 L-1: game 12 applied 4 days after its weeks start: its early targets are recorded with no picks and the week still goes final", async () => {
  const rd = raceDir({ weeks: [2, 3, 4, 5] });
  const startH = H0 - 1200, w5H = startH + 14 * 28800, applied = M.weekStart(4) + 4 * X.DAY;
  const cfg = (g) => ({ round_size: String(g.round), round_offset: "0", lead: String(g.lead), enabled: true });
  let now = 0;
  const gameOf = async (_node, id) => (id === 2 ? { result: { game: cfg(X.MAINNET_GAME) } } : now >= applied ? { result: { game: cfg(X.MAINNET_HOURLY) } } : { result: {} });
  const read12 = [];
  const picksH = async (node, r, g) => {
    const h = g === 12 ? r * 1200 : r * 2400, t = T(h) - 3600000;
    if (g === 12) read12.push(now);
    if (g === 12 && t < applied) return [];   // as the chain: nobody could pick before the game existed
    return [{ player: BOB, producer: signerOf(h), time: t }];
  };
  let prev; const outs = []; let problems = [];
  for (let lib = startH + 14400; lib <= w5H + 2400; lib += 14400) {
    const o = tmp(); now = T(lib + 60);
    const r = await quiet(() => run({ p: "main", check: "check", prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picksH, gameOf, rankedOf, prizesFromWeek: 3,
      schedule: SW4, vaultGame: X.VAULT_GAME, head: { height: lib + 60, time: now, lib } }));
    problems.push(...(r.problems || []));
    prev = o; outs.push(o);
  }
  const read = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
  const w4 = read([...outs].reverse().find((d) => fs.existsSync(path.join(d, "W004.json"))), "W004.json");
  assert.equal(w4.game, 12);
  assert.ok(w4.targets.length >= 160, `week 4 has its hourly targets from Monday: ${w4.targets.length}`);
  assert.ok(w4.targets[0].time < M.weekStart(4) + 2 * 3600000, "the first target is at the start of the week");
  const early = w4.targets.filter((t) => t.time < applied - 3 * X.DAY - 3600000);
  assert.ok(early.length > 0 && early.every((t) => !t.void && t.picks.length === 0), "targets from before the apply: recorded, no picks");
  // B14-1: picks are still read while game 12 reads as missing (none here: nobody could pick), so a stale answer can't empty a round.
  assert.ok(problems.some((p) => /game 12 is not on the Picks contract.*recorded with no picks/.test(p)), "the run says so");
  const board = read(prev, "board.json");
  assert.equal(board.lastWeek.week, 4); assert.equal(board.lastWeek.final, true, "week 4 goes final");
});

test("Repo Lens #E-23 L-1: only when every node says game 12 is missing are its picks skipped; a disagreement skips the game", async () => {
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /if \(v === nodeCount\) \{ badGames\.delete\(G\); missingGames\.add\(G\);/);
  assert.match(src, /else badGames\.add\(G\);   \/\/ the nodes disagree/);
  assert.match(src, /if \(missingGames\.has\(G\) && \(raw\.length \|\| other\.length\)\) \{ problems\.push/, "B14-1: picks found for a 'missing' game: the round waits");
  assert.match(src, /est >= e\.from - 6 \* 3600000 && est < e\.to \+ 6 \* 3600000/, "E-23 I-1: ±6 h");
});

// ── the VHP ruler switch (owner, 11 Nov 2026; bot/blockx-ruler.ts): off / shadow / on through the recorder ──
// The ruler's own scoring is tested in tests/audit/blockx-ruler.test.mjs on a chain it can read; here a stub stands in
// for it (rulerEntryOf), so these tests check only how the recorder uses the entries.
const RR = await import(path.resolve(APP, "bot/blockx-ruler.ts"));
const stubEntry = (points, { card = "stub-card\n", note = null, isVoid = false } = {}) => (t, lead, now, old) => old && (old.card || old.void) ? old
  : { round: t.round, height: t.height, lock: t.height - lead, cardRound: RR.roundOf(t.time), window: RR.windowOf(t.height - lead), card: t.void ? null : card, note, signer: t.signer, points: isVoid ? 0 : points, void: !!t.void || isVoid, why: null };
async function weekThenLookOut(picks, hoursAfter, extra = {}) {
  const rd = raceDir();
  let prev;
  const startH = H0 - Math.floor(3600000 / 3000), endH = startH + 7 * 28800;
  for (let lib = startH + 12 * X.ROUND; lib < endH; lib += 12 * X.ROUND) {
    const o = tmp();
    await quiet(() => run({ p: "main", check: null, prev, out: o, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picks, rankedOf, head: { height: lib, time: T(lib), lib }, ...extra }));
    prev = o;
  }
  const at = endH + hoursAfter * 1200, out = tmp();
  const r = await quiet(() => run({ p: "main", check: null, prev, out, raceDir: rd, picksContract: "1P", blockOf: blockOf(), picksOf: picks, rankedOf, head: { height: at, time: T(at), lib: at - 60 }, ...extra }));
  return { r, out };
}
const xFiles = (out) => fs.readdirSync(out).filter((f) => /^X\d{3}-\d\.json$/.test(f)).sort();

test("VHP ruler off: no ruler files; the board is as before", async () => {
  const { r, out } = await weekThenLookOut(picksGuest, 13, { rulerFrom: null, rulerEntryOf: stubEntry(1234) });
  assert.deepEqual(xFiles(out), []);
  assert.equal(r.board.lastWeek.final, true);
});

test("VHP ruler shadow (week N − 1): day files marked shadow carry every target's entry; the board and prizes are the ruler-off ones", async () => {
  const off = await weekThenLookOut(picksGuest, 13, { rulerFrom: null, prizesFromWeek: 3 });
  const sh = await weekThenLookOut(picksGuest, 13, { rulerFrom: 4, prizesFromWeek: 3, rulerEntryOf: stubEntry(1234) });
  assert.deepEqual(sh.r.board.lastWeek.rows, off.r.board.lastWeek.rows, "shadow counts for nothing");
  assert.deepEqual(sh.r.board.lastWeek.prizes, off.r.board.lastWeek.prizes);
  const days = xFiles(sh.out).filter((f) => f.startsWith("X003-"));
  assert.ok(days.length >= 6, "a file per day of week 3: " + days);
  const d0 = JSON.parse(fs.readFileSync(path.join(sh.out, days[0]), "utf8"));
  assert.deepEqual([d0.v, d0.week, d0.mode, d0.shadow, d0.rulerFrom], [1, 3, "shadow", true, 4]);
  assert.ok(d0.targets.length > 0 && d0.targets.every((e) => e.card === "stub-card\n" || e.void));
  for (const f of days) assert.ok(fs.statSync(path.join(sh.out, f)).size < 500000, "a day file stays small");
});

test("VHP ruler on (from week N): a right pick scores the ruler entry's points, a wrong pick 0; a void target or void producer counts nothing", async () => {
  const on = await weekThenLookOut(picksGuest, 13, { rulerFrom: 3, rulerEntryOf: stubEntry(1234) });
  const lw = on.r.board.lastWeek, g = lw.rows.find((x) => x.a === GUEST);
  assert.equal(lw.final, true);
  assert.ok(g.correct > 0); assert.equal(g.pts, 1234 * g.correct, "every right pick scores the ruler's points");
  const b = lw.rows.find((x) => x.a === BOB);
  if (b) assert.equal(b.pts, 1234 * b.correct, "Bob's picks on BIG score only when BIG signed");
  const v = await weekThenLookOut(picksGuest, 13, { rulerFrom: 3, rulerEntryOf: stubEntry(1234, { isVoid: true }) });
  assert.ok(v.r.board.lastWeek.rows.every((x) => x.pts === 0), "a void producer: a miss, never a refund of points");
});

test("VHP ruler on: a week isn't final until the ruler has scored every target (not yet: it waits, then counts no pick after 3 days)", async () => {
  const wait = await weekThenLookOut(picksGuest, 13, { rulerFrom: 3, rulerEntryOf: stubEntry(1234, { card: null, note: "not yet: the ruler's data reaches block 1" }) });
  assert.equal(wait.r.board.lastWeek.final, false, "not final while targets wait for the ruler");
  assert.deepEqual(wait.r.board.lastWeek.rows, [], "nothing counts until scored");
  // the real entryFor: past the 3-day wait with no data, the target counts no pick (void), so the week can close
  const t = { round: 1, height: 5000000, time: Date.parse("2026-11-16T00:00Z"), signer: BIG };
  const e = RR.entryFor(null, t, 100, t.time + RR.RULER_WAIT_MS, null);
  assert.equal(e.void, true); assert.match(e.why, /within 3 days/);
  assert.equal(RR.entryFor(null, t, 100, t.time + 3600000, null).void, false, "before that it just waits");
  assert.equal(RR.ruledPoints(RR.entryFor(null, t, 100, t.time + 3600000, null), BIG), undefined);
});

test("capacity: a Block X file over 60% of the 2 MB publish limit (1.2 MB) warns in every run", async () => {
  const { SIZE_WARN_BYTES } = await import(path.resolve(APP, "bot/games/blockx.ts"));
  assert.equal(SIZE_WARN_BYTES, 1258291, "60% of 2,048 KB");
  const src = fs.readFileSync(path.resolve(APP, "bot/games/blockx.ts"), "utf8");
  assert.match(src, /st\.size > SIZE_WARN_BYTES\) problems\.push\(`\$\{f\} is .* MB: near the 2 MB publish limit/);
});

test("Repo Lens #G-49 G49-1: in an ON week, targets waiting over 6 hours for the ruler alert (held), and so does each 3-day void when it is made; never in a shadow week", async () => {
  const { RULER_LATE_MS } = await import(path.resolve(APP, "bot/games/blockx.ts"));
  assert.equal(RULER_LATE_MS, 6 * 3600000);
  const wait = await weekThenLookOut(picksGuest, 13, { rulerFrom: 3, rulerEntryOf: stubEntry(1234, { card: null, note: "not yet: the ruler's data reaches block 1" }) });
  assert.ok(wait.r.held.some((h) => /the VHP ruler's data is missing or behind: \d+ ON-week target\(s\) have waited more than 6 hours/.test(h)), JSON.stringify(wait.r.held).slice(0, 300));
  const v = await weekThenLookOut(picksGuest, 13, { rulerFrom: 3, rulerEntryOf: stubEntry(0, { card: null, isVoid: true, note: "the ruler couldn't score this target within 3 days (x)" }) });
  assert.ok(v.r.held.some((h) => /couldn't score this ON-week target within 3 days/.test(h)), "a 3-day void alerts when made");
  // (switch 5: week 4, the running week, is the shadow week and week 3 is off)
  const sh = await weekThenLookOut(picksGuest, 13, { rulerFrom: 5, rulerEntryOf: stubEntry(1234, { card: null, note: "not yet: x" }) });
  assert.ok(!sh.r.held.some((h) => /VHP ruler/.test(h)), "shadow: no alert (it counts for nothing)");
});
