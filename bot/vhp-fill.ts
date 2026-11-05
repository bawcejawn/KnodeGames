/**
 * Knode Games — the VHP ruler's FIRST FILL (design .ai/standards/VHP_RULER.md §7 L-6, D-112). READ-ONLY: holds no
 * key, sends nothing, costs no Mana.
 *
 * Reads the last FILL_DAYS days (default 30) once, in one-day chunks, on both nodes, and saves each chunk to
 * FILL_STATE as soon as both nodes agree on it. The workflow runs it in three steps (FILL_PART):
 *   plan   — fixes the block-hours to fill (FILL_STATE/plan.json);
 *   chunks — reads chunks FILL_CHUNK_FROM … FILL_CHUNK_TO (three jobs in parallel, each one third of the days; a job
 *            that fails is re-run on its own with GitHub's "Re-run failed jobs": that is the resume);
 *   hours  — with every chunk there, takes ONE live read of every producer on both nodes and writes the hour files:
 *   - every hour but the last: kind "rebuilt" — balances rebuilt backwards from that one read (D-112: never used by
 *     a paying card; the first ~24 h of live hours replace them in every card's size window);
 *   - the last hour: kind "live", carrying the real reads, so the very first file the hourly recorder builds on is
 *     checked against both nodes' effective_balance_of (audit S-3).
 * Then the hourly recorder (bot/vhp-ruler.ts) carries on from the next block-hour.
 *
 *   RPC, RPC_CHECK, FILL_PART, FILL_STATE (dir), VHP_OUT (dir), FILL_DAYS (30), FILL_CHUNK_FROM / FILL_CHUNK_TO,
 *   FILL_TIME_ONE=1 (only time one one-day chunk on each node and report it; writes nothing)
 *   npx tsx bot/vhp-fill.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { chainNode, blocksOnBoth, liveAnchor, balancesAt, type Blk, type RulerNode } from "./vhp-ruler.ts";
await import("../vhp-ruler.js");
await import("../vhp-data.js");
const D: any = (globalThis as any).KVhpData;
const HOUR = 1200, DAY_HOURS = 24;

export type Plan = { v: 1; startN: number; endN: number };
const chunkFile = (dir: string, k: number) => path.join(dir, `c${String(k).padStart(3, "0")}.json`);
export const chunks = (p: Plan) => Math.ceil((p.endN - p.startN + 1) / DAY_HOURS);
const chunkRange = (p: Plan, k: number) => { const n0 = p.startN + k * DAY_HOURS, n1 = Math.min(p.endN, n0 + DAY_HOURS - 1); return { from: n0 * HOUR, to: (n1 + 1) * HOUR - 1 }; };

/** The plan: the FILL_DAYS × 24 block-hours ending with the newest block-hour irreversible on both nodes. Fixed once. */
export async function makePlan(A: RulerNode, B: RulerNode, days: number): Promise<Plan> {
  const [ha, hb] = await Promise.all([A.head(), B.head()]);
  const endN = Math.floor((Math.min(ha.lib, hb.lib) + 1) / HOUR) - 1;
  // #D-10 L-7: start on a day boundary, so every day of the fill can be rolled up into a day file later; rounded UP,
  // so the plan holds at most `days` days and the workflow's chunk jobs cover every chunk (Repo Lens #E-14 / #B-5 N-3)
  return { v: 1, startN: Math.ceil((endN - days * DAY_HOURS + 1) / DAY_HOURS) * DAY_HOURS, endN };
}
/** Phase 1: read and save the chunks not yet saved (both nodes must agree). Stops early when the budget runs out. */
export async function fillChunks(A: RulerNode, B: RulerNode, plan: Plan, dir: string, budgetMs: number, log = console.log, k0 = 0, k1 = Infinity, tries = 3, pauseMs = 120000) {
  const t0 = Date.now();
  for (let k = k0; k < Math.min(chunks(plan), k1 + 1); k++) {
    if (fs.existsSync(chunkFile(dir, k))) continue;
    if (Date.now() - t0 > budgetMs) { log(`budget used up; ${k} of ${chunks(plan)} chunks saved, carries on next run`); return false; }
    const { from, to } = chunkRange(plan, k), t1 = Date.now();
    let bs: Blk[] | null = null;
    for (let t = 1; !bs; t++) {   // a public node can stop answering for minutes: try the whole chunk again
      try { bs = await blocksOnBoth(A, B, from, to); }
      catch (e) { if (t >= tries || /differs between/.test(String((e as Error).message))) throw e; log(`chunk ${k + 1}: ${(e as Error).message}; trying again in ${pauseMs / 60000} min (${t} of ${tries})`); await new Promise((r) => setTimeout(r, pauseMs)); }
    }
    fs.writeFileSync(chunkFile(dir, k) + ".tmp", JSON.stringify(bs));
    fs.renameSync(chunkFile(dir, k) + ".tmp", chunkFile(dir, k));   // a chunk is either whole or absent
    log(`chunk ${k + 1}/${chunks(plan)}: blocks ${from} … ${to} on both nodes in ${((Date.now() - t1) / 60000).toFixed(1)} min`);
  }
  return true;
}
/** The read more than 3 h (3,600 blocks) after the plan's end: the last hour would carry a long tail and the recorder's
 *  next hours would repeat it (#B-6 D-1), so every hour is written rebuilt and the recorder catches up from the plan's
 *  end. Exported so the threshold is tested (Repo Lens re-check of #B-6, F-1). */
export const FILL_LATE = 3600;
export const fillLate = (at: number, lastTo: number) => at - lastTo > FILL_LATE;
/** The fill's one live read of every producer; a producer that first signs in the tail is read too, as the recorder
 *  does (Repo Lens #E-14 N-6: asking for a re-run could never help, the same producer is in the tail again). */
export async function fillAnchor(A: RulerNode, B: RulerNode, blocks: Blk[], lastTo: number, opts: any = {}) {
  const producers = new Set(blocks.map((b) => b.s));
  let anc = await liveAnchor(A, B, [...producers].sort(), lastTo, opts);
  for (let k = 0; ; k++) {
    const extra = [...new Set(anc.tail.map((b) => b.s))].filter((a) => !producers.has(a));
    if (!extra.length) return anc;
    if (k >= 3) throw new Error(`new producers keep appearing during the reads (${extra.join(", ")}); re-run this hours job (the plan stays)`);
    for (const a of extra) producers.add(a);
    anc = await liveAnchor(A, B, [...producers].sort(), lastTo, opts);
  }
}
/** Phase 2 (pure): the hour texts from the blocks startN … endN (+ the tail) and one live anchor. */
export function fillHours(plan: Plan, blocks: Blk[], anc: { reads: any; tail: Blk[]; at: number; id: string }, opts: { allRebuilt?: boolean } = {}) {
  const all = [...blocks, ...anc.tail], from = plan.startN * HOUR;
  if (all.length !== anc.at - from + 1 || all.some((b, i) => b.h !== from + i)) throw new Error("the fill's blocks aren't consecutive");
  const bal = balancesAt(anc.reads, all, anc.at);
  const live = Object.keys(bal);
  // walk backwards from the read: balance at each hour's end, for every address (anchored set grows hour by hour)
  const balAt = new Map<number, Record<string, bigint>>();
  const cur: Record<string, bigint> = { ...bal };
  let i = all.length - 1;
  for (let n = plan.endN; n >= plan.startN; n--) {
    const end = (n + 1) * HOUR - 1;
    for (; i >= 0 && all[i].h > end; i--) {
      const b = all[i];
      if (b.s in cur) cur[b.s] += BigInt(b.burn);
      for (const e of b.events) { if (e.f in cur) cur[e.f] += BigInt(e.v); if (e.t in cur) cur[e.t] -= BigInt(e.v); }
    }
    balAt.set(n, { ...cur });
  }
  const texts: string[] = [], seen = new Set<string>();
  let prev = "";
  for (let n = plan.startN; n <= plan.endN; n++) {
    // #D-10 M-2: when the read is more than 3 hours after the plan's end (the hours job ran late), the last hour is
    // rebuilt too; the hourly recorder then chains the gap and its first live hour checks it all
    const hf = n * HOUR, ht = hf + HOUR - 1, isLast = n === plan.endN && !opts.allRebuilt;
    for (const b of all) { if (b.h < hf) continue; if (b.h > (isLast ? anc.at : ht)) break; seen.add(b.s); }
    const mine = all.filter((b) => b.h >= hf && b.h <= (isLast ? anc.at : ht));
    const set = [...seen].sort(), b0 = balAt.get(n)!;
    for (const a of set) if (!(a in bal)) throw new Error(`no live read for ${a}`);
    const anchor = isLast
      ? { at: anc.at, id: anc.id, bal, reads: { A: Object.fromEntries(live.map((a) => [a, [anc.reads.A[a].h, anc.reads.A[a].bal, anc.reads.A[a].eff]])), B: Object.fromEntries(live.map((a) => [a, [anc.reads.B[a].h, anc.reads.B[a].bal, anc.reads.B[a].eff]])) } }
      : { at: ht, id: mine[mine.length - 1].id, bal: Object.fromEntries(set.map((a) => [a, b0[a]])), reads: { A: {}, B: {} } };
    const t = D.makeHour({ n, prevText: prev, kind: isLast ? "live" : "rebuilt", blocks: mine.map((b) => ({ s: b.s, id: b.id, burn: b.burn })), events: mine.flatMap((b) => b.events), anchor });
    const c = D.checkHour(prev, t);
    if (!c.ok) throw new Error(`block-hour ${n} fails its check (${c.why})`);
    if (isLast && c.quality !== "ok") console.log(`::warning::the first live hour is flagged: ${c.why}`);
    texts.push(t); prev = t;
  }
  return texts;
}

async function main() {
  const E = process.env;
  const ra = E.RPC || "https://koinos.armana.io", rb = E.RPC_CHECK || "https://api.koinosblocks.com";
  if (ra.replace(/\/+$/, "") === rb.replace(/\/+$/, "")) throw new Error("RPC and RPC_CHECK are the same node: two different nodes are needed");
  const A = chainNode(ra, "A"), B = chainNode(rb, "B");
  if (E.FILL_TIME_ONE === "1") {   // the owner's timing question: how long does one day take on each node?
    const [ha, hb] = await Promise.all([A.head(), B.head()]);
    const to = Math.min(ha.lib, hb.lib), from = to - 28800 + 1;
    for (const n of [A, B]) {
      const t0 = Date.now(); const bs = await n.blocks(from, to); const min = (Date.now() - t0) / 60000;
      const ev = bs.reduce((s, b) => s + b.events.length, 0);
      console.log(`::notice title=vhp-fill timing ${n.name}::one day (blocks ${from}-${to}, ${bs.length} blocks, ${ev} other VHP events) read in ${min.toFixed(1)} min on node ${n.name}; ${(min * 30 / 60).toFixed(1)} h for 30 days at this speed`);
    }
    return;
  }
  const dir = E.FILL_STATE || "fill-state", out = E.VHP_OUT || "vhp-out", days = Number(E.FILL_DAYS || 30), part = E.FILL_PART || "";
  fs.mkdirSync(dir, { recursive: true });
  const pf = path.join(dir, "plan.json");
  if (part === "plan") {
    const plan = await makePlan(A, B, days); fs.writeFileSync(pf, JSON.stringify(plan));
    console.log(`plan: block-hours ${plan.startN} … ${plan.endN} (${chunks(plan)} one-day chunks)`); return;
  }
  const plan: Plan = JSON.parse(fs.readFileSync(pf, "utf8"));
  if (!(plan.v === 1 && Number.isSafeInteger(plan.startN) && plan.endN >= plan.startN && plan.endN - plan.startN < 24 * 40)) throw new Error("bad plan.json");
  if (part === "chunks") {
    const k0 = Number(E.FILL_CHUNK_FROM), k1 = Number(E.FILL_CHUNK_TO);
    if (!Number.isSafeInteger(k0) || !Number.isSafeInteger(k1)) throw new Error("FILL_CHUNK_FROM / FILL_CHUNK_TO");
    await fillChunks(A, B, plan, dir, Infinity, console.log, k0, k1); return;
  }
  if (part !== "hours") throw new Error("FILL_PART must be plan, chunks or hours");
  const blocks: Blk[] = [];
  for (let k = 0; k < chunks(plan); k++) {
    if (!fs.existsSync(chunkFile(dir, k))) throw new Error(`chunk ${k} is missing: re-run the failed chunk job`);
    for (const b of JSON.parse(fs.readFileSync(chunkFile(dir, k), "utf8"))) blocks.push(b);
  }
  const lastTo = (plan.endN + 1) * HOUR - 1, anc = await fillAnchor(A, B, blocks, lastTo);
  const late = fillLate(anc.at, lastTo);
  if (late) console.log(`::warning::the read is ${((anc.at - lastTo) / 1200).toFixed(1)} hours after the plan's end: every hour is written rebuilt; the hourly recorder chains the gap, then goes live`);
  const texts = fillHours(plan, blocks, anc, { allRebuilt: late });
  fs.mkdirSync(path.join(out, "h"), { recursive: true });
  for (const t of texts) fs.writeFileSync(path.join(out, "h", `${JSON.parse(t).n}.json`), t);
  console.log(`wrote ${texts.length} hour files (${texts.length - 1} rebuilt, 1 live): block-hours ${plan.startN} … ${plan.endN}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(`::error::${(e as Error).message}`); process.exit(1); });
