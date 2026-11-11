// Knode Games — the VHP ruler's simulations on REAL mainnet history (§8). Read-only: no key, nothing sent, nothing
// published. Reads FILL_DAYS (31) days on both nodes with the first-fill code, writes and checks every hour file the
// way the publish job would, then runs all 11 simulations and writes the results (and a small set of real examples
// for the explainer) to OUT. Run by hand (it was run once by a temporary workflow, since removed).
//   RPC, RPC_CHECK, FILL_DAYS, OUT  ·  npx tsx sims/ruler/real.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chainNode, liveAnchor } from "../../bot/vhp-ruler.ts";
import { makePlan, fillChunks, fillHours } from "../../bot/vhp-fill.ts";
import { run, movedFn, raceCard, raceChances, effArray, raceSlots, synthetic, mod, BLOCKS_PER_DAY, VAULT } from "./sims.mjs";
import { sim5 } from "./faults.mjs";
const R = globalThis.KRuler, D = globalThis.KVhpData;
const E = process.env, OUT = E.OUT || "sims-out", DAYS = Number(E.FILL_DAYS || 31);
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now(), tick = (s) => console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${s}`);

const A = chainNode(E.RPC || "https://koinos.armana.io", "A"), B = chainNode(E.RPC_CHECK || "https://api.koinosblocks.com", "B");
const plan = await makePlan(A, B, DAYS), dir = fs.mkdtempSync(path.join(os.tmpdir(), "fill-"));
tick(`reading block-hours ${plan.startN} … ${plan.endN} (${DAYS} days) on both nodes`);
await fillChunks(A, B, plan, dir, Infinity, tick);
const blocks = fs.readdirSync(dir).filter((f) => /^c\d+\.json$/.test(f)).sort().flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const anc = await liveAnchor(A, B, [...new Set(blocks.map((b) => b.s))].sort(), (plan.endN + 1) * 1200 - 1);
const texts = fillHours(plan, blocks, anc);
tick(`${texts.length} hour files written and checked`);
let prev = "", flagged = 0, bytes = 0;
for (const t of texts) { const c = D.checkHour(prev, t); if (!c.ok) throw new Error(c.why); if (c.quality !== "ok") flagged++; prev = t; bytes += t.length; }
const live = D.checkHour(texts[texts.length - 2], texts[texts.length - 1]);
const hours = texts.map((t) => JSON.parse(t)), L = R.ledger(D.timelineFrom(hours));
tick(`ledger over ${L.to - L.from + 1} blocks; first live hour: ${live.quality}${live.effAt ? `, effective_balance_of matches at the ${live.effAt === "next" ? "block after each read" : "read block"}` : ` (${live.why})`}`);

if (E.DUMP === "1") {   // the whole history, compact and gzipped, into the job's log (public), for checking anywhere
  const tl = D.timelineFrom(hours), zlib = await import("node:zlib");
  const signers = [...new Set(tl.signers)].sort(), ix = new Map(signers.map((a, i) => [a, i]));
  const burns = [], other = [];
  for (const h of hours) { h.burns.forEach((b) => burns.push(b)); for (const e of h.events) other.push(e); }
  const last = hours[hours.length - 1];
  for (const e of last.tail.events) other.push(e);
  const dump = { v: 1, from: tl.from, to: tl.to, signers, sig: Buffer.from(Uint8Array.from(tl.signers.map((a) => ix.get(a)))).toString("base64"),
    burns: burns.join(","), tail: { sig: last.tail.sig.map((i) => last.addrs[i]), burns: last.tail.burns }, events: other, anchor: { at: last.anchor.at, bal: last.anchor.bal },
    hourIds: hours.map((h) => h.ids[h.ids.length - 1]), seedIds: Object.fromEntries(raceSlots(L).map((w) => [w.L + 20, hours[Math.floor((w.L + 20) / 1200) - hours[0].n].ids[(w.L + 20) % 1200]])) };
  const z = zlib.gzipSync(JSON.stringify(dump), { level: 9 }).toString("base64");
  const lines = []; for (let i = 0; i < z.length; i += 20000) lines.push(`DUMP ${i / 20000} ${z.slice(i, i + 20000)}`);
  lines.push(`DUMP END ${Math.ceil(z.length / 20000)} ${z.length}`);
  fs.writeFileSync(path.join(OUT, "dump.txt"), lines.join("\n") + "\n");   // a later step prints it (process.exit can cut stdout)
  tick(`history dump: ${z.length} characters in ${lines.length - 1} lines`);
  if (E.SKIP_SIMS === "1") process.exit(0);
}
const moves = hours.flatMap((h) => h.events.flatMap(([eh, , f, t]) => [f, t].filter(Boolean).map((a) => [eh, a])));
const sims = run(L, { cards: Number(E.CARDS || 60), races: Number(E.RACES || 2500), log: tick, moved: movedFn(moves) });
// sim 5: node faults, through the real data checks
const s5 = sim5();
sims.results.push(s5); tick(`${s5.pass ? "PASS" : "FAIL"} sim 5: ${s5.name} — ${s5.metric}`);
// sim 11: JavaScript vs Python, byte for byte, on real cards
const hd = fs.mkdtempSync(path.join(os.tmpdir(), "vhpdata-")); fs.mkdirSync(path.join(hd, "h"));
texts.forEach((t) => fs.writeFileSync(path.join(hd, "h", `${JSON.parse(t).n}.json`), t));
const slots = raceSlots(L), cards = [];
for (let i = 0; i < Math.min(40, slots.length); i++) {
  const w = slots[Math.floor(i * slots.length / Math.min(40, slots.length))];
  cards.push(R.cardJson(R.scoreCard(L, R.makeCard(L, { game: 7, round: String(w.L), window: w, c: 500000n, ownRule: ["spot", "high1h", "avg24h"][i % 3], paying: false, pooled: [VAULT] }))));
}
fs.writeFileSync(path.join(OUT, "cards.jsonl"), cards.join(""));
const games = cards.map((t, i) => { const c = JSON.parse(t); return { game: 7, round: c.round, window: c.window, c: "500000", ownRule: c.ownRule, paying: false, pooled: [VAULT] }; });
fs.writeFileSync(path.join(OUT, "games.json"), JSON.stringify(games));
const py = execFileSync("python3", ["-I", "-B", "-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(path.resolve("."))}); import vhp_ruler as V
L, _ = V.load_ledger(sys.argv[1]); bad = 0
games = json.load(open(sys.argv[3]))
for line, g in zip(open(sys.argv[2], encoding="utf-8"), games):
    ok, d = V.recompute(L, line, g)
    bad += 0 if ok else 1
print(bad)`, hd, path.join(OUT, "cards.jsonl"), path.join(OUT, "games.json")], { encoding: "utf8", maxBuffer: 1 << 26 }).trim();
const s11 = { id: 11, name: "JavaScript vs Python on real data", metric: `${cards.length - Number(py)} of ${cards.length} real cards byte-identical (Python rebuilt each from the hour files)`, pass: py === "0", mark: "byte-identical cards" };
sims.results.push(s11); tick(`${s11.pass ? "PASS" : "FAIL"} sim 11: ${s11.metric}`);

// ── a few real examples for the explainer ──
const names = (() => { try { return JSON.parse(execFileSync("git", ["show", "FETCH_HEAD:names.json"], { cwd: E.NAMES_DIR || ".", encoding: "utf8" })); } catch { return null; } })();
const nameOf = (a) => (names && (names.nicknames?.[a] ? "@" + names.nicknames[a] : names.pools?.[a])) || null;
const w = slots[Math.floor(slots.length * 0.75)];
const card = R.scoreCard(L, R.makeCard(L, { game: 7, round: String(w.L), window: w, c: 500000n, ownRule: "spot", paying: false, pooled: [VAULT] }));
const ex = {
  data: { from: L.from, to: L.to, days: (L.to - L.from + 1) / BLOCKS_PER_DAY, hours: texts.length, flaggedHours: flagged, mbPerDay: bytes / 1e6 / DAYS, firstLiveHour: live },
  card: { T: card.T, seedBlock: card.seedBlock, seedProducer: card.seedProducer, window: card.window, total: String(card.total), producers: card.producers.map((p) => ({ a: p.a, name: nameOf(p.a), own: String(p.own), avg: String(p.avg), k: String(p.k), form: String(p.form), entry: p.entry, pooled: p.pooled, isNew: p.isNew, expected: String(p.expected), signed: p.signed, credited: String(p.credited) })) },
  // a shrinking producer over 14 days: daily effective VHP of the three biggest
  daily: Object.fromEntries(card.producers.slice(0, 4).map((p) => [p.a, Array.from({ length: Math.floor((L.to - L.from) / BLOCKS_PER_DAY) }, (_, d) => Number(L.eff(p.a, L.from + 20 + d * BLOCKS_PER_DAY)) / 1e8)])),
  network: Array.from({ length: Math.floor((L.to - L.validFrom) / BLOCKS_PER_DAY) }, (_, d) => Number(L.N(L.validFrom + d * BLOCKS_PER_DAY)) / 1e8),
};
// a hide example: a 2% producer hides 97% for 25 h at this card
{
  const base = w.W0 - BLOCKS_PER_DAY - 1300, ps = L.active(w.W0).filter((a) => Number(L.eff(a, w.W0)) > 0), paths = {};
  for (const p of ps) paths[p] = effArray(L, p, base, w.S1);
  const Nreal = new Float64Array(w.S1 - base + 1); for (const p of ps) for (let i = 0; i < Nreal.length; i++) Nreal[i] += paths[p][i];
  const f = { w, base, ps, paths, Nreal, T: card.T }, e = synthetic(Nreal, 0.02, true);
  const N = new Float64Array(w.S1 - w.S0 + 1); for (let b = w.S0; b <= w.S1; b++) N[b - w.S0] = Nreal[b - base] + e[b - base];
  const out = {};
  for (const [name, path_] of [["honest", e], ["hides 97% for 25 h, back after the lock", mod(e, f, (H) => (H > w.L - 30000 && H <= w.L + 20 ? 0.03 : 1))], ["doubles its VHP during the race", mod(e, f, (H) => (H >= w.S0 + 20 ? 2 : 1))], ["hides 50% for 7 days", mod(e, f, (H) => (H <= w.L + 20 ? 0.5 : 1))]]) {
    const c = raceCard({ ...paths, "~me": path_ }, base, card.T, w.S0, w.S1, "spot", { N }), me = c.rows.find((r) => r.p === "~me");
    const ch = raceChances(c, 20000, 99);
    const noCredit = raceCard({ ...paths, "~me": path_ }, base, card.T, w.S0, w.S1, "spot", { N });
    for (const r of noCredit.rows) r.cred = r.lam;   // the same race without card credit
    const chNo = raceChances(noCredit, 20000, 99);
    out[name] = { ownVHP: me.own / 1e8, k: me.k, expectedBlocks: me.lam, creditedBlocks: me.cred, winChance: ch?.["~me"]?.chance ?? 0, winChanceWithoutCredit: chNo?.["~me"]?.chance ?? 0, fieldSize: ch ? Object.keys(ch).length : 0 };
  }
  ex.trick = out;
}
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(sims, null, 1));
fs.writeFileSync(path.join(OUT, "explainer.json"), JSON.stringify(ex));
tick(`done: ${sims.results.filter((r) => r.pass === true).length} pass, ${sims.results.filter((r) => r.pass === false).length} fail`);
