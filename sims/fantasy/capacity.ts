// Fantasy Producers capacity sim (Fantasy chat, Mon 16 Nov 2026): one full week on the kit's parts ("parts": "d"),
// run hour by hour through the kit's Replay (recorder + the publish job's own check), with N wallets.
//
//   node --import tsx sims/fantasy/capacity.ts 5000 10000 20000
//
// Each wallet picks a team on Monday; on each later play day 40% make their one change (swap a producer or move the
// captain); 30% send a Weekly Rival challenge; 60% are staked. 21 producers, all at the same price (form days alike),
// day results differ by producer so points and ranks spread. Prints, per N: the slowest hour, the biggest file, every
// file kind's size, and the total, against the 1.2 MB-per-file limit the publish check keeps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const imp = (p: string) => import(path.join(REPO, p));
const { game } = await imp("games/fantasy/recorder.ts");
const { Replay } = await imp("kit/testing/replay.ts");
const { fakeNode, world } = await imp("kit/testing/fake-nodes.ts");
const { at, DAY, HOUR: H } = await imp("kit/testing/fake-clock.ts");

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const addr = (k: number, tag: string) => { let s = "", n = k; for (let i = 0; i < 12; i++) { s += B58[n % 58]; n = Math.floor(n / 58); } return ("1" + tag + s).padEnd(34, "z").slice(0, 34); };
const PROD = Array.from({ length: 21 }, (_, i) => addr(i, "P"));
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pickN = (n: number, from: string[]) => { const c = [...from], o: string[] = []; while (o.length < n) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };

async function runN(N: number) {
  seed = 7;
  const W = Array.from({ length: N }, (_, i) => addr(i, "W"));
  const weekStartYmd = Number(new Date(at(4)).toISOString().slice(0, 10).replace(/-/g, ""));
  // Form days alike (one price for every producer); play days differ by producer and day.
  const vhp = { ruleVersion: 4, to: 0, loaded: true, card: (s: any) => ({ ruleVersion: 4, game: 4, round: s.round, producers: PROD.map((a, i) => {
    const play = Number(s.round) >= weekStartYmd, k = play ? 60 + ((i * 37 + Number(s.round) * 11) % 90) : 100;
    return { a, credited: String(k * 1000000), expected: "100000000", void: false, entry: true, quality: "ok" };
  }) }) };
  const m = { ...game, inputsFor: (w: any, c: any) => game.inputsFor(w, { ...c, vhp }), resultOf: (r: any, rd: any, i: any, c: any) => game.resultOf(r, rd, i, { ...c, vhp }) };
  const cfg = { slug: "fantasy", game: 4, genesis: at(0), weekMs: 7 * DAY, sundayFunRound: true, payoutRule: "d152", vaultValues: "dense255", entry: { minRounds: 1, minPoints: 1 }, minPts: 0, rowCap: 0, liveWeek: false, roundsCorrectable: false, maxRoundPoints: 90000, inputsFile: true, inputsLeadMs: 2 * DAY, vhpData: true, parts: "d" };
  const T0 = at(0) - 30 * DAY, libAt = (t: number) => Math.floor((t - T0) / 3000) - 60;
  const wd: any = world(at(4) - 2 * DAY + H); wd.blockT0 = T0;
  wd.gamePlayers = Object.fromEntries(W.filter((_, i) => i % 5 < 3).map((a) => [a, { week_stake: "500000000", peak_stake: "500000000" }]));
  const d0 = Math.floor(at(4) / DAY), picks: Record<string, any[]> = {};
  const teams = W.map(() => pickN(5, PROD));
  picks[`4:${d0}`] = W.map((a, i) => ({ player: a, pick: { producers: teams[i], time: String(at(4) - 600000 + i) } }));
  for (let d = 1; d < 6; d++) {
    const day: any[] = [];
    W.forEach((a, i) => {
      if (rnd() >= 0.4) return;
      const t = [...teams[i]];
      if (rnd() < 0.5) { const j = 1 + Math.floor(rnd() * 4); [t[0], t[j]] = [t[j], t[0]]; }
      else { const out = PROD.filter((p) => !t.includes(p)); t[Math.floor(rnd() * 5)] = out[Math.floor(rnd() * out.length)]; }
      teams[i] = t; day.push({ player: a, pick: { producers: t, time: String(at(4) + d * DAY - 600000 + i) } });
    });
    picks[`4:${d0 + d}`] = day;
  }
  picks[`5:${d0}`] = W.filter(() => rnd() < 0.3).map((a, i) => ({ player: a, pick: { producers: [W[Math.floor(rnd() * N)]], time: String(at(4) - 500000 + i) } }));
  wd.picks = picks;
  const rp = new Replay(m, cfg), nodes = () => [fakeNode("a", () => wd), fakeNode("b", () => wd)];
  let slow = 0;
  const run = async (t: number) => { wd.time = t; wd.lib = libAt(t); const s = Date.now(); const h = await rp.hour(nodes(), t + 5 * 60000, { vhpLedger: { to: 0 } }); slow = Math.max(slow, Date.now() - s); return h; };
  await run(wd.time);
  let h: any, runs = 0, budget = 0;
  for (let k = 0; k < 24; k++) {
    h = await run(at(5, 0, 2 + k)); runs++;
    if (h.error && /read budget used up/.test(h.error)) { budget++; continue; }   // the kit carries on next run
    if (h.error) throw new Error(h.error);
    if (h.result?.state === "final") break;
  }
  if (h.result?.state !== "final") console.log("  NOT FINAL:", JSON.stringify({ error: h.error, held: h.held, alerts: h.result?.alerts }).slice(0, 1500));
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(rp.pub).map((f) => ({ f: path.relative(rp.pub, f), b: fs.statSync(f).size }));
  const kind = (f: string) => f.replace(/[0-9a-f]{8,}/g, "#").replace(/d[1-7]\./, "dN.");
  const by = new Map<string, number>(); for (const x of files) by.set(kind(x.f), Math.max(by.get(kind(x.f)) ?? 0, x.b));
  const big = files.reduce((a, b) => (b.b > a.b ? b : a));
  const picksTotal = Object.values(picks).reduce((s, p) => s + p.length, 0);
  console.log(`\nN = ${N} wallets (${Object.keys(wd.gamePlayers).length} staked, ${picksTotal} picks in the week): state ${h.result?.state} after ${runs} runs after the week (${budget} stopped by the read budget)`);
  console.log(`  slowest hour ${(slow / 1000).toFixed(1)} s; biggest file ${big.f} ${(big.b / 1e6).toFixed(3)} MB (${Math.round((100 * big.b) / 1.2e6)}% of 1.2 MB); total ${(files.reduce((s, x) => s + x.b, 0) / 1e6).toFixed(2)} MB`);
  for (const [k, b] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${k.padEnd(28)} ${(b / 1e3).toFixed(1)} KB`);
  fs.rmSync(rp.root, { recursive: true, force: true });
}

for (const n of process.argv.slice(2).map(Number).filter((x) => x > 0)) await runN(n);
